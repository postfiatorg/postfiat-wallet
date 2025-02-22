from typing import List, Dict, Any
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.constants import CryptoAlgorithm
from xrpl.models.requests import AccountInfo, AccountTx, AccountLines
from xrpl.wallet import Wallet
from xrpl.utils import drops_to_xrp
from xrpl.core.keypairs import derive_keypair
from xrpl.models.transactions import Payment, TrustSet
from xrpl.transaction import sign_and_submit
from xrpl.core import addresscodec
import logging
import asyncio

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
        request = AccountInfo(
            account=account,
            ledger_index="validated"
        )
        response = await self.client.request(request)
        balance_drops = response.result["account_data"]["Balance"]
        return drops_to_xrp(balance_drops)

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
            logger.info(f"XRP balance: {xrp_balance}")
            pft_balance = await self.get_pft_balance(account)
            logger.info(f"PFT balance: {pft_balance}")

            summary = {
                "xrp_balance": xrp_balance,
                "pft_balance": pft_balance
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

    def get_ecdh_public_key_from_seed(self, wallet_seed: str) -> str:
        """
        Derive an Ed25519-based ECDH public key (hex) from a wallet seed.
        
        Args:
            wallet_seed: The wallet seed (secret key)
            
        Returns:
            str: The ED25519 public key in hex format
            
        Raises:
            ValueError: If the seed is invalid or key derivation fails
        """
        try:
            # Decode seed to raw entropy bytes
            seed_bytes, _ = addresscodec.decode_seed(wallet_seed)
            
            # Derive ED25519 keypair using XRPL method
            pub_hex, _ = derive_keypair(seed_bytes, is_validator=False, algorithm=CryptoAlgorithm.ED25519)
            
            return pub_hex
        except Exception as e:
            logger.error(f"Error deriving ECDH public key: {str(e)}")
            raise ValueError(f"Failed to derive ECDH public key: {str(e)}")