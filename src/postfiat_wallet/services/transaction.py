from typing import Dict, Any, Optional, List
from xrpl.models.transactions import Payment, Memo, TrustSet
import binascii
from xrpl.models.amounts import IssuedCurrencyAmount
import base64
import brotli
import hashlib

from cryptography.fernet import Fernet
from xrpl.wallet import Wallet

# If you have a separate ECDH utility class or handshake logic, import it here.
# For example:
# from .ecdh_utils import ECDHUtils
# from .some_db_logic import handshake_exists, retrieve_remote_ecdh_pubkey

CHUNK_SIZE = 900  # maximum chunk size in bytes (approx ~1KB for XRPL memo field)
WHISPER_PREFIX = "WHISPER__"
COMPRESSED_PREFIX = "COMPRESSED__"

class TransactionBuilder:
    """Service for building XRPL transactions for user-to-node communication."""
    
    def __init__(self):
        self.node_address = 'r4yc85M1hwsegVGZ1pawpZPwj65SVs8PzD'  # Post Fiat Node address
        self.client_url = "https://xrpl.postfiat.org:6007"
        self.pft_issuer = 'rnQUEEg8yyjrwk9FhyXpKavHyCRJM9BDMW'  # PFT token issuer
    
    def _to_hex(self, string: str) -> str:
        """Convert string to hex format"""
        return binascii.hexlify(string.encode()).decode()
    
    def _get_fee(self) -> str:
        """Get current network fee"""
        return "10"  # Simplified for now, we'll implement proper fee logic later
    
    def build_transaction(self, 
                         account: str,
                         tx_type: str,
                         data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build a user-to-node transaction based on the transaction type.
        
        Args:
            account: The user's XRPL address
            tx_type: Type of transaction (e.g., 'initiation_rite', 'task_request', etc.)
            data: Dictionary containing transaction-specific data
            
        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        # Define memo structure based on transaction type
        memo_structures = {
            'initiation_rite': {
                'data': f"{data.get('initiation_rite', '')}",
                'type': "INITIATION_RITE_SUBMISSION",
                'format': data.get('username', ''),
                'use_pft': False
            },
            'task_request': {
                'data': f"REQUEST_POST_FIAT ___ {data.get('request', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'task_acceptance': {
                'data': f"ACCEPTANCE REASON ___ {data.get('message', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'task_refusal': {
                'data': f"REFUSAL REASON ___ {data.get('refusal_reason', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'task_completion': {
                'data': f"COMPLETION JUSTIFICATION ___ {data.get('completion_justification', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            },
            'verification_response': {
                'data': f"VERIFICATION RESPONSE ___ {data.get('verification_response', '')}",
                'type': data.get('task_id', ''),
                'format': data.get('username', ''),
                'use_pft': True
            }
        }
        
        if tx_type not in memo_structures:
            raise ValueError(f"Transaction type '{tx_type}' is not supported")
        
        try:
            memo_structure = memo_structures[tx_type]
            
            # Determine amount and currency based on transaction type
            if memo_structure['use_pft']:
                amount = IssuedCurrencyAmount(
                    currency="PFT",
                    issuer=self.pft_issuer,
                    value="1"
                )
            else:
                amount = "1"  # 1 drop of XRP for initiation rite
            
            # Build the payment transaction
            payment = Payment(
                account=account,
                destination=self.node_address,
                amount=amount,
                fee=current_fee,
                memos=[
                    Memo(
                        memo_data=self._to_hex(memo_structure['data']),
                        memo_type=self._to_hex(memo_structure['type']),
                        memo_format=self._to_hex(memo_structure['format'])
                    )
                ]
            )
            
            return payment.to_dict()
        except KeyError as e:
            raise ValueError(f"Missing required field for {tx_type} transaction: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error building {tx_type} transaction: {str(e)}")

    def build_payment_transaction(self,
                                account: str,
                                destination: str,
                                amount: str,
                                currency: str,
                                memo_text: Optional[str] = None,
                                memo_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Build a simple payment transaction for sending XRP or PFT.
        
        Args:
            account: Sender's XRPL address
            destination: Recipient's XRPL address
            amount: Amount to send
            currency: Either 'XRP' or 'PFT'
            memo_text: Optional memo text
            memo_id: Optional memo ID
            
        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        # Handle amount based on currency
        if currency == 'XRP':
            amount_in_drops = str(int(float(amount) * 1_000_000))
            tx_amount = amount_in_drops
        elif currency == 'PFT':
            tx_amount = IssuedCurrencyAmount(
                currency="PFT",
                issuer=self.pft_issuer,
                value=amount
            )
        else:
            raise ValueError(f"Unsupported currency: {currency}")
        
        # Build payment with optional memos
        payment_fields = {
            "account": account,
            "destination": destination,
            "amount": tx_amount,
            "fee": current_fee
        }
        
        memos = []
        if memo_id:
            memos.append(Memo(
                memo_type=self._to_hex("memo_id"),
                memo_data=self._to_hex(memo_id)
            ))
        if memo_text:
            memos.append(Memo(
                memo_type=self._to_hex("memo_text"),
                memo_data=self._to_hex(memo_text)
            ))
        
        if memos:
            payment_fields["memos"] = memos
        
        payment = Payment(**payment_fields)
        return payment.to_dict()

    def build_trust_line_transaction(self, account: str) -> Dict[str, Any]:
        """
        Build a transaction to set a trust line for the PFT token.
        
        Args:
            account: The user's XRPL address
            
        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        trust_set = TrustSet(
            account=account,
            fee=current_fee,
            limit_amount=IssuedCurrencyAmount(
                currency="PFT",
                issuer=self.pft_issuer,
                value="99000000000"  # Set a high limit for the trust line
            )
        )
        
        return trust_set.to_dict()

    def build_handshake_transaction(self,
                                  account: str,
                                  destination: str,
                                  ecdh_public_key: str,
                                  xrp_amount: float = 0.00001) -> Dict[str, Any]:
        """
        Build a handshake transaction that embeds an ECDH public key in a 'HANDSHAKE' memo
        on a minimal Payment.

        Args:
            account: Sender's XRPL address
            destination: Recipient's XRPL address
            ecdh_public_key: The ECDH public key to embed in the memo
            xrp_amount: Amount of XRP to send (default: 0.00001)

        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        # Convert XRP amount to drops
        drops = str(int(xrp_amount * 1_000_000))
        
        # Create memo with ECDH public key
        payment = Payment(
            account=account,
            destination=destination,
            amount=drops,
            fee=current_fee,
            memos=[
                Memo(
                    memo_data=self._to_hex(ecdh_public_key),
                    memo_type=self._to_hex("HANDSHAKE"),
                    memo_format=self._to_hex("text")
                )
            ]
        )
        
        return payment.to_dict()

    def build_google_doc_transaction(self,
                                   account: str,
                                   encrypted_data: str,
                                   username: str,
                                   use_pft: bool = False) -> Dict[str, Any]:
        """
        Build a transaction containing an encrypted Google Doc link memo.

        Args:
            account: Sender's XRPL address
            encrypted_data: The encrypted Google Doc link
            username: User's username to be used as memo_format
            use_pft: Whether to send PFT (1 PFT) or XRP (0.00001 XRP)

        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        # Determine amount based on use_pft flag
        if use_pft:
            amount = IssuedCurrencyAmount(
                currency="PFT",
                issuer=self.pft_issuer,
                value="1"
            )
        else:
            # Convert 0.00001 XRP to drops
            amount = str(int(0.00001 * 1_000_000))
        
        # Create payment with encrypted memo
        payment = Payment(
            account=account,
            destination=self.node_address,  # Always send to node address
            amount=amount,
            fee=current_fee,
            memos=[
                Memo(
                    memo_data=self._to_hex(encrypted_data),
                    memo_type=self._to_hex('google_doc_context_link'),
                    memo_format=self._to_hex(username)
                )
            ]
        )
        
        return payment.to_dict()

    def build_initiation_rite_transaction(self,
                                        account: str,
                                        initiation_rite: str,
                                        username: str) -> Dict[str, Any]:
        """
        Build a transaction for submitting an initiation rite.

        Args:
            account: Sender's XRPL address
            initiation_rite: The initiation rite commitment text
            username: User's username to be used as memo_format

        Returns:
            Dictionary representing an unsigned XRPL transaction
        """
        current_fee = self._get_fee()
        
        # Initiation rites always use 1 drop of XRP
        amount = "1"  # 1 drop of XRP
        
        # Create payment with initiation rite memo
        payment = Payment(
            account=account,
            destination=self.node_address,
            amount=amount,
            fee=current_fee,
            memos=[
                Memo(
                    memo_data=self._to_hex(initiation_rite),
                    memo_type=self._to_hex("INITIATION_RITE"),
                    memo_format=self._to_hex(username)
                )
            ]
        )
        
        return payment.to_dict()

    def __derive_shared_secret(self, local_seed: str, remote_ed_pubkey: str) -> bytes:
        """
        Example placeholder for deriving an ECDH shared secret.
        Replace with your actual logic. 
        """
        # ---------------------------------------------------
        # from .ecdh_utils import ECDHUtils  # if you place in a separate utility
        # return ECDHUtils.get_shared_secret(remote_ed_pubkey, local_seed)
        # ---------------------------------------------------
        #
        # For demonstration, we'll just return a static key. 
        # Do not do this in production.
        return b"FAKE_SHARED_SECRET"

    def __encrypt_and_compress(self, plaintext: str, shared_secret: bytes) -> str:
        """
        1) Prefix with 'WHISPER__'
        2) Encrypt with Fernet( SHA256(shared_secret) )
        3) Compress with Brotli -> base64
        4) Prefix with 'COMPRESSED__'
        """
        # Step 1: "WHISPER__<fernetCipher>"
        fernet_key = base64.urlsafe_b64encode(hashlib.sha256(shared_secret).digest())
        f = Fernet(fernet_key)
        cipher_text = f.encrypt(plaintext.encode("utf-8")).decode("utf-8")
        whisper_str = f"{WHISPER_PREFIX}{cipher_text}"

        # Step 2: compress + base64
        compressed_bytes = brotli.compress(whisper_str.encode("utf-8"))
        b64_data = base64.b64encode(compressed_bytes).decode("utf-8")

        # Step 3: prefix "COMPRESSED__"
        return f"{COMPRESSED_PREFIX}{b64_data}"

    def __chunkify(self, data_str: str, chunk_size: int) -> List[str]:
        """
        Break data_str into multiple pieces, each prefixed with 'chunk_<i>__'
        Example: ["chunk_1__COMPRESSED__...", "chunk_2__COMPRESSED__...", ...]
        """
        chunks = []
        start = 0
        idx = 1
        while start < len(data_str):
            piece = data_str[start:start + chunk_size]
            chunked_piece = f"chunk_{idx}__{piece}"
            chunks.append(chunked_piece)
            start += chunk_size
            idx += 1
        return chunks

    def build_pf_log_transaction(
        self,
        account: str,
        log_message: str,
        log_id: str,
        username: str,
        remembrancer_address: str,
        use_pft: bool = True
    ) -> Dict[str, Any]:
        """
        A simple 'pf_log' submission without encryption/compression/chunking
        (as originally shown). If you want encryption+chunking, see 
        build_pf_log_chunked_transactions below.
        """
        current_fee = self._get_fee()
        if use_pft:
            amount = IssuedCurrencyAmount(
                currency="PFT",
                issuer=self.pft_issuer,
                value="1"
            )
        else:
            # 1 drop of XRP
            amount = "1"

        payment = Payment(
            account=account,
            destination=remembrancer_address,
            amount=amount,
            fee=current_fee,
            memos=[
                Memo(
                    memo_data=self._to_hex(log_message),
                    memo_type=self._to_hex(log_id),
                    memo_format=self._to_hex(username)
                )
            ]
        )
        return payment.to_dict()

    def build_pf_log_chunked_transactions(
        self,
        account: str,
        log_message: str,
        log_id: str,
        username: str,
        remembrancer_address: str,
        local_seed: str,
        remote_ed_pubkey: str,
        use_pft: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Returns a list of Payment transaction dictionaries that each contain a chunk 
        of the final encrypted/compressed log message.

        Steps:
          1) Derive ECDH shared secret from local_seed and remote_ed_pubkey. 
          2) Encrypt with Fernet, prefix with 'WHISPER__'.
          3) Compress with Brotli, base64 encode, prefix with 'COMPRESSED__'.
          4) Chunk the final to ~900 bytes each. 
          5) Each chunk is placed in a separate Payment's memo_data.

        The caller can then sign_and_send each transaction via BlockchainService.
        """
        # 1) Derive shared secret
        shared_secret = self.__derive_shared_secret(local_seed, remote_ed_pubkey)

        # 2) Encrypt + compress => "COMPRESSED__"
        final_str = self.__encrypt_and_compress(log_message, shared_secret)

        # 3) Chunkify
        chunks = self.__chunkify(final_str, CHUNK_SIZE)

        # 4) Build a Payment transaction for each chunk
        tx_dicts = []
        current_fee = self._get_fee()

        if use_pft:
            base_amount = IssuedCurrencyAmount(
                currency="PFT",
                issuer=self.pft_issuer,
                value="1"
            )
        else:
            # 1 drop of XRP (or some minimal amount)
            base_amount = "1"

        for i, chunk_data in enumerate(chunks, start=1):
            # We'll store the chunk in the memo_data
            # memo_type can be log_id, memo_format can be username, etc.
            memos = [
                Memo(
                    memo_data=self._to_hex(chunk_data),
                    memo_type=self._to_hex(log_id),
                    memo_format=self._to_hex(username)
                )
            ]

            payment = Payment(
                account=account,
                destination=remembrancer_address,
                amount=base_amount,
                fee=current_fee,
                memos=memos
            )
            tx_dicts.append(payment.to_dict())

        return tx_dicts


