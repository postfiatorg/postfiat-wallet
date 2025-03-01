from typing import List, Dict, Any
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.constants import CryptoAlgorithm
from xrpl.models.requests import AccountInfo, AccountTx, AccountLines, Fee, Ledger
from xrpl.wallet import Wallet
from xrpl.utils import drops_to_xrp
from xrpl.core.keypairs import derive_keypair, ed25519
from xrpl.models.transactions import Payment, TrustSet
from xrpl.transaction import sign_and_submit, autofill, sign
from xrpl.core import addresscodec
from xrpl.core.keypairs.ed25519 import ED25519
import logging
import asyncio
import nacl.bindings

logger = logging.getLogger(__name__)

class BlockchainService:
    def __init__(self, node_url: str = "https://s2.ripple.com:51234"):
        """Initialize blockchain service with XRPL async client"""
        self.client = AsyncJsonRpcClient(node_url)
        self.pft_currency = "PFT"
        self.pft_issuer = "rnQUEEg8yyjrwk9FhyXpKavHyCRJM9BDMW"  # Replace with actual PFT issuer address

    def create_wallet_from_secret(self, secret: str) -> dict:
        """Create a wallet from a secret key"""
        try:
            wallet = Wallet.from_seed(seed=secret)
            return {
                "address": wallet.classic_address,
                "private_key": secret
            }
        except Exception as e:
            raise ValueError(f"Invalid secret key: {str(e)}")

    def generate_wallet(self) -> dict:
        """Generate a new XRP wallet"""
        wallet = Wallet.create()
        return {
            "address": wallet.classic_address,
            "private_key": wallet.seed
        }

    async def get_xrp_balance(self, account: str) -> float:
        """Get XRP balance for the given account"""
        try:
            request = AccountInfo(
                account=account,
                ledger_index="validated"
            )
            response = await self.client.request(request)
            balance_drops = response.result["account_data"]["Balance"]
            return drops_to_xrp(balance_drops)
        except Exception as e:
            # Account not found or other error - return 0 for new/unactivated accounts
            logger.debug(f"Account {account} not found or not activated yet: {str(e)}")
            return 0.0

    async def get_pft_balance(self, account: str) -> float:
        """Get PFT token balance for the given account"""
        request = AccountLines(
            account=account,
            ledger_index="validated"
        )
        response = await self.client.request(request)
        
        for line in response.result["lines"]:
            if line["currency"] == self.pft_currency and line["account"] == self.pft_issuer:
                return float(line["balance"])
        return 0.0

    async def get_transaction_history(self, account: str, limit: int = 20) -> List[Dict[Any, Any]]:
        """Get recent transaction history for the account"""
        request = AccountTx(
            account=account,
            limit=limit
        )
        response = await self.client.request(request)
        
        transactions = []
        for tx in response.result["transactions"]:
            tx_data = tx["tx"]
            transaction = {
                "type": tx_data["TransactionType"],
                "date": tx_data["date"],
                "hash": tx_data["hash"],
                "amount": drops_to_xrp(tx_data["Amount"]) if "Amount" in tx_data else None,
                "fee": drops_to_xrp(tx_data["Fee"]),
                "sender": tx_data["Account"],
                "receiver": tx_data.get("Destination"),
                "status": "success" if tx["meta"]["TransactionResult"] == "tesSUCCESS" else "failed"
            }
            transactions.append(transaction)
            
        return transactions

    async def get_account_summary(self, account: str) -> Dict[str, Any]:
        """Get a summary of account information including XRP and PFT balances"""
        try:
            logger.info(f"Fetching summary for account: {account}")
            xrp_balance = await self.get_xrp_balance(account)
            pft_balance = await self.get_pft_balance(account)
            
            summary = {
                "xrp_balance": float(xrp_balance),
                "pft_balance": float(pft_balance),
                "account_status": "unactivated" if xrp_balance == 0 else "active"
            }
            logger.info(f"Returning summary: {summary}")
            return summary
        except Exception as e:
            logger.error(f"Error in get_account_summary: {str(e)}")
            raise

    def _sign_and_send_transaction_sync(self, unsigned_tx: dict, seed: str) -> dict:
        """
        Synchronous method to sign and send a transaction.
        
        Args:
            unsigned_tx: The unsigned transaction dictionary
            seed: The user's secret key/seed
            
        Returns:
            The transaction submission result
        """
        try:
            wallet = Wallet.from_seed(seed)
            payment = Payment.from_dict(unsigned_tx)
            logger.debug(f"Signing and submitting transaction for account: {wallet.classic_address}")
            
            response = sign_and_submit(
                transaction=payment,
                client=self.client,
                wallet=wallet,
                autofill=True,
                check_fee=True
            )
            logger.debug(f"Transaction response: {response.result}")
            return response.result
        except Exception as e:
            logger.error(f"Error in _sign_and_send_transaction_sync: {str(e)}")
            raise

    async def sign_and_send_transaction(self, unsigned_tx: dict, seed: str) -> dict:
        """
        Asynchronous wrapper to sign and send a transaction.
        
        Args:
            unsigned_tx: The unsigned transaction dictionary
            seed: The user's secret key/seed
            
        Returns:
            The transaction submission result
        """
        try:
            result = await asyncio.to_thread(self._sign_and_send_transaction_sync, unsigned_tx, seed)
            return result
        except Exception as e:
            logger.error(f"Error in sign_and_send_transaction: {str(e)}")
            raise

    def _sign_and_send_trust_set_sync(self, trust_set_tx: TrustSet, seed: str) -> dict:
        """
        Synchronous method to sign and send a trust set transaction.
        
        Args:
            trust_set_tx: The TrustSet transaction object
            seed: The user's secret key/seed
            
        Returns:
            The transaction submission result
        """
        try:
            wallet = Wallet.from_seed(seed)
            logger.debug(f"Signing trust set for account: {wallet.classic_address}")
            logger.debug(f"Trust set object: {trust_set_tx.to_dict()}")
            
            response = sign_and_submit(
                transaction=trust_set_tx,
                client=self.client,
                wallet=wallet,
                autofill=True,
                check_fee=True
            )
            logger.debug(f"Trust set response: {response.result}")
            return response.result
        except Exception as e:
            logger.error(f"Error in _sign_and_send_trust_set_sync: {str(e)}")
            raise

    async def sign_and_send_trust_set(self, trust_set_tx: TrustSet, seed: str) -> dict:
        """
        Asynchronous wrapper to sign and send a trust set transaction.
        
        Args:
            trust_set_tx: The TrustSet transaction object
            seed: The user's secret key/seed
            
        Returns:
            The transaction submission result
        """
        try:
            result = await asyncio.to_thread(self._sign_and_send_trust_set_sync, trust_set_tx, seed)
            return result
        except Exception as e:
            logger.error(f"Error in sign_and_send_trust_set: {str(e)}")
            raise

    def _get_raw_entropy(self, wallet_seed: str) -> bytes:
        """Returns the raw entropy bytes from the specified wallet secret"""
        decoded_seed = addresscodec.decode_seed(wallet_seed)
        return decoded_seed[0]

    def get_ecdh_public_key_from_seed(self, wallet_seed: str) -> str:
        """
        Get ECDH public key directly from a wallet seed
        
        Args:
            wallet_seed: The wallet seed to derive the key from
            
        Returns:
            str: The ECDH public key in hex format
            
        Raises:
            ValueError: If wallet_seed is invalid
        """
        try:
            raw_entropy = self._get_raw_entropy(wallet_seed)
            public_key, _ = ED25519.derive_keypair(raw_entropy, is_validator=False)
            return public_key
        except Exception as e:
            logger.error(f"Failed to derive ECDH public key: {e}")
            raise ValueError(f"Failed to derive ECDH public key: {e}") from e

    def get_shared_secret(self, received_public_key: str, channel_private_key: str) -> bytes:
        """
        Derive a shared secret using ECDH
        
        Args:
            received_public_key: public key received from another party
            channel_private_key: Seed for the wallet to derive the shared secret

        Returns:
            bytes: The derived shared secret

        Raises:
            ValueError: if received_public_key is invalid or channel_private_key is invalid
        """
        try:
            raw_entropy = self._get_raw_entropy(channel_private_key)
            return self._derive_shared_secret(public_key_hex=received_public_key, seed_bytes=raw_entropy)
        except Exception as e:
            logger.error(f"Failed to derive shared secret: {e}")
            raise ValueError(f"Failed to derive shared secret: {e}") from e

    @staticmethod
    def _derive_shared_secret(public_key_hex: str, seed_bytes: bytes) -> bytes:
        """
        Derive a shared secret using ECDH
        Args:
            public_key_hex: their public key in hex
            seed_bytes: original entropy/seed bytes (required for ED25519)
        Returns:
            bytes: The shared secret
        """
        public_key_raw, private_key_raw = derive_keypair(seed_bytes, algorithm=CryptoAlgorithm.ED25519)
        
        private_key_bytes = bytes.fromhex(private_key_raw)
        if len(private_key_bytes) == 33 and private_key_bytes[0] == 0xED:
            private_key_bytes = private_key_bytes[1:]
        
        public_key_self_bytes = bytes.fromhex(public_key_raw)
        if len(public_key_self_bytes) == 33 and public_key_self_bytes[0] == 0xED:
            public_key_self_bytes = public_key_self_bytes[1:]
        
        private_key_combined = private_key_bytes + public_key_self_bytes
        
        public_key_bytes = bytes.fromhex(public_key_hex)
        if len(public_key_bytes) == 33 and public_key_bytes[0] == 0xED:
            public_key_bytes = public_key_bytes[1:]
        
        private_curve = nacl.bindings.crypto_sign_ed25519_sk_to_curve25519(private_key_combined)
        public_curve = nacl.bindings.crypto_sign_ed25519_pk_to_curve25519(public_key_bytes)
        
        shared_secret = nacl.bindings.crypto_scalarmult(private_curve, public_curve)
        return shared_secret

    def create_wallet_from_seed(self, seed: str) -> Wallet:
        """
        Create an XRPL wallet object from a seed.
        This is different from create_wallet_from_secret because it returns
        a Wallet object instead of a dictionary.
        
        Args:
            seed: The seed/secret key
            
        Returns:
            A Wallet object that can be used for signing and encryption
        """
        try:
            # In XRPL, seed and secret are the same thing
            return Wallet.from_seed(seed=seed)
        except Exception as e:
            logger.error(f"Failed to create wallet from seed: {str(e)}")
            raise ValueError(f"Invalid seed: {str(e)}")

    async def sign_odv_transaction(self, transaction: Any, wallet: Wallet) -> Any:
        """
        Sign an ODV transaction using the provided wallet.
        This method is used for transactions generated by encode_account_msg.
        
        Args:
            transaction: The transaction to sign
            wallet: The wallet to use for signing
            
        Returns:
            The signed transaction ready for submission
        """
        try:
            logger.debug(f"Signing ODV transaction from {wallet.classic_address}")
            
            # Convert transaction to the proper XRPL transaction model if needed
            if hasattr(transaction, 'to_dict'):
                # It's already a transaction model object
                tx_model = transaction
            else:
                # Determine the transaction type and convert it
                if isinstance(transaction, dict):
                    if transaction.get("TransactionType") == "Payment":
                        tx_model = Payment.from_dict(transaction)
                    else:
                        # Use a generic transaction model
                        from xrpl.models.transactions import Transaction as XRPLTransaction
                        tx_model = XRPLTransaction.from_dict(transaction)
                else:
                    # Already a transaction object
                    tx_model = transaction
            
            # Autofill transaction fields like Sequence, Fee, etc.
            filled_tx = await autofill(transaction=tx_model, client=self.client)
            
            # Sign the transaction
            signed_tx = sign(transaction=filled_tx, wallet=wallet)
            
            logger.debug("Transaction signed successfully")
            return signed_tx
            
        except Exception as e:
            logger.error(f"Error signing ODV transaction: {str(e)}", exc_info=True)
            raise
            
    async def submit_transaction(self, signed_tx: Any) -> Dict[str, Any]:
        """
        Submit an already signed transaction to the network.
        
        Args:
            signed_tx: The signed transaction object
            
        Returns:
            The transaction submission result
        """
        try:
            logger.debug("Submitting signed transaction to network")
            
            # Convert to dictionary if it's not already
            if hasattr(signed_tx, 'to_xrpl'):
                tx_dict = signed_tx.to_xrpl()
            else:
                tx_dict = signed_tx
                
            # Submit the transaction
            from xrpl.models.requests import Submit
            response = await self.client.request(Submit(tx_blob=tx_dict["tx_blob"]))
            
            logger.debug(f"Transaction submission response: {response.result}")
            return response.result
            
        except Exception as e:
            logger.error(f"Error submitting transaction: {str(e)}", exc_info=True)
            raise