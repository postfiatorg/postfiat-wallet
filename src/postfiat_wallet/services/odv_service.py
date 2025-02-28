from typing import List, Optional, AsyncIterator
from xrpl.wallet import Wallet

from postfiat.models.transaction import Transaction
from postfiat.nodes.task.codecs.v0.remembrancer.encode import encode_account_msg
from postfiat.nodes.task.codecs.v0.remembrancer.decode import decode_account_txn, decode_account_stream
from postfiat.nodes.task.models.messages import Message, UserLogMessage, NodeLogResponseMessage


class ODVService:
    """
    Service for interacting with the On-Demand Validator (ODV) or Remembrancer node.
    Handles encoding messages to the node and decoding messages from the node.
    """
    
    def __init__(self, node_account: Wallet | str, user_account: Wallet):
        """
        Initialize the ODV service.
        
        Args:
            node_account: The node wallet or public key
            user_account: The user wallet
        """
        self.node_account = node_account
        self.user_account = user_account
    
    def encode_message_to_node(self, message: Message) -> List[Transaction] | None:
        """
        Encode a message to be sent to the remembrancer node.
        
        Args:
            message: The message to encode
            
        Returns:
            List of transactions to submit or None if encoding failed
        """
        return encode_account_msg(
            message, 
            node_account=self.node_account, 
            user_account=self.user_account
        )
    
    def decode_transaction(self, txns: Transaction | List[Transaction]) -> Message | None:
        """
        Decode transaction(s) from the remembrancer node into a message.
        
        Args:
            txns: A single transaction or list of transactions to decode
            
        Returns:
            Decoded message or None if decoding failed
        """
        return decode_account_txn(
            txns,
            node_account=self.node_account,
            user_account=self.user_account
        )
    
    async def decode_transaction_stream(self, txns: AsyncIterator[Transaction]) -> AsyncIterator[Message]:
        """
        Decode a stream of transactions from the remembrancer node.
        
        Args:
            txns: An async iterator of transactions
            
        Returns:
            An async iterator of decoded messages
        """
        async for message in decode_account_stream(
            txns,
            node_account=self.node_account,
            user_account=self.user_account
        ):
            yield message
    
    def create_user_log_message(self, message_id: str, message_content: str, amount_pft: int = 0) -> UserLogMessage:
        """
        Create a user log message to send to the node.
        
        Args:
            message_id: Unique identifier for the message
            message_content: The actual message content
            amount_pft: Optional amount of PFT to include (default: 0)
            
        Returns:
            A UserLogMessage ready to be encoded
        """
        user_address = self.user_account.address if isinstance(self.user_account, Wallet) else self.user_account
        node_address = self.node_account.address if isinstance(self.node_account, Wallet) else self.node_account
        
        return UserLogMessage(
            message_id=message_id,
            message=message_content,
            amount_pft=amount_pft,
            user_wallet=user_address,
            node_wallet=node_address
        )
    
    def create_user_logging_entry(self, log_id: str, log_content: str, amount_pft: int = 0) -> UserLogMessage:
        """
        Create a user logging entry to send to the node.
        This is a one-way message that doesn't expect a response.
        
        Args:
            log_id: Unique identifier for the log entry
            log_content: The log content
            amount_pft: Optional amount of PFT to include (default: 0)
            
        Returns:
            A UserLogMessage formatted as a logging entry
        """
        # We use the same UserLogMessage type but with a log_ prefix to distinguish it
        # from regular chat messages
        user_address = self.user_account.address if isinstance(self.user_account, Wallet) else self.user_account
        node_address = self.node_account.address if isinstance(self.node_account, Wallet) else self.node_account
        
        return UserLogMessage(
            message_id=f"log_{log_id}",
            message=log_content,
            amount_pft=amount_pft,
            user_wallet=user_address,
            node_wallet=node_address
        )