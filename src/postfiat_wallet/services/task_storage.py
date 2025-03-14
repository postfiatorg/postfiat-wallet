from typing import List, Dict, Any, Optional
from postfiat.rpc import CachingRpcClient
from postfiat.nodes.task.models.messages import Message, Direction
from postfiat.nodes.task.state import TaskStatus, UserState
from postfiat.utils.streams import combine_streams
from postfiat.nodes.task.codecs.v0.task import decode_account_stream as decode_task_stream
from postfiat.nodes.task.codecs.v0.remembrancer import decode_account_stream as decode_remembrancer_stream
from postfiat_wallet.config import settings
from pathlib import Path
import logging
import asyncio
import json
from datetime import datetime

from postfiat.nodes.task.constants import EARLIEST_LEDGER_SEQ, TASK_NODE_ADDRESS, REMEMBRANCER_ADDRESS
from postfiat.nodes.task.codecs.v0.task import decode_account_txn
from postfiat.nodes.task.codecs.v0.remembrancer.decode import decode_account_txn
from xrpl.wallet import Wallet

logger = logging.getLogger(__name__)

class TaskStorage:
    """
    TaskStorage is a local wrapper that uses the TaskNode SDK's CachingRpcClient to
    fetch XRPL transactions, decode them into TaskNode messages, and store them in a
    TaskNodeState in-memory structure. It also creates background refresh loops to
    poll for any new messages.
    
    Each wallet address has:
      • A refresh loop (optional) that will periodically fetch new transactions from
        the last known processed ledger to the 'latest' ledger.
      • In-memory TaskNodeState that tracks tasks and account-level handshake states.
    """

    def __init__(self):
        """
        Initialize TaskStorage with:
          • A caching RPC client (to fetch and decode transactions).
          • An in-memory TaskNodeState (to store all tasks & account states).
          • Dictionaries to track running refresh loops & ledger positions for each user.
        """
        # Prepare local caching directory
        cache_dir = Path(settings.PATHS["cache_dir"]) / "tasknode"
        logger.debug(f"TaskNode cache location: {cache_dir.resolve()}")

        # Create the client that fetches & caches XRPL transactions
        self.client = CachingRpcClient(
            endpoint="https://xrpl.postfiat.org:6007",
            cache_dir=str(cache_dir)
        )

        # UserState is a single aggregator for all user accounts in memory
        self._state = UserState()

        # For each user (wallet address), track:
        #  - last processed ledger
        #  - whether a refresh loop is active
        #  - the asyncio Task object that runs the refresh loop
        self._last_processed_ledger: Dict[str, int] = {}
        self._is_refreshing: Dict[str, bool] = {}
        self._refresh_tasks: Dict[str, asyncio.Task] = {}

    async def get_ledger_range(self, wallet_address: str) -> tuple[int, int]:
        """
        Get valid ledger range for an account. Defaults to the earliest PostFiat ledger
        and the latest ledger (-1).
        """
        first_ledger = EARLIEST_LEDGER_SEQ
        return first_ledger, -1

    async def initialize_user_tasks(self, wallet_address: str, user_wallet: Optional[Wallet] = None) -> None:
        """
        Fetches all existing transactions/messages for the user from the earliest ledger
        to the latest, updating the state.
        """
        logger.debug(f"Initializing state for {wallet_address}")

        start_ledger = EARLIEST_LEDGER_SEQ
        end_ledger = -1

        newest_ledger_seen = None
        message_count = 0

        try:
            # Fetch transactions only once
            txn_stream = self.client.get_account_txns(wallet_address, start_ledger, end_ledger)
            
            # Create a copy of the transaction stream for remembrancer decoder
            remembrancer_txn_stream = self.client.get_account_txns(wallet_address, start_ledger, end_ledger)
            
            # Decode the transactions using both decoders and combine the streams
            combined_stream = combine_streams(
                decode_task_stream(txn_stream, node_account=TASK_NODE_ADDRESS, user_account=user_wallet),
                decode_remembrancer_stream(remembrancer_txn_stream, node_account=REMEMBRANCER_ADDRESS, user_account=user_wallet)
            )
            
            async for msg in combined_stream:
                self._state.update(msg)
                newest_ledger_seen = msg.ledger_seq
                message_count += 1

            # Store the last processed ledger
            if newest_ledger_seen is not None:
                self._last_processed_ledger[wallet_address] = newest_ledger_seen
                logger.debug(f"Processed {message_count} messages, newest ledger: {newest_ledger_seen}")
            else:
                # If no messages found, at least set them to the earliest ledger
                self._last_processed_ledger[wallet_address] = start_ledger
                logger.debug("No messages found during initialization")

        except Exception as e:
            logger.error(f"Error during initialization: {str(e)}", exc_info=True)
            raise

    async def start_refresh_loop(self, wallet_address: str, user_wallet: Optional[Wallet] = None) -> None:
        """
        Starts a background loop that periodically polls for new ledger transactions,
        decodes them as TaskNode messages, and updates the in-memory state. If one
        is already active for this wallet, it won't start another.
        """
        if self._is_refreshing.get(wallet_address):
            logger.debug(f"Refresh loop is already running for {wallet_address}")
            return

        logger.debug(f"Starting refresh loop for {wallet_address}")
        self._is_refreshing[wallet_address] = True

        async def _refresh():
            # Periodically poll for new messages until asked to stop
            while self._is_refreshing.get(wallet_address, False):
                try:
                    # Grab the last processed ledger for this user
                    start_ledger = self._last_processed_ledger.get(wallet_address)
                    if start_ledger is None:
                        # If the user wasn't initialized, do it now automatically
                        await self.initialize_user_tasks(wallet_address, user_wallet)
                        start_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)

                    # Get a single transaction stream and make a copy
                    txn_stream = self.client.get_account_txns(
                        wallet_address, 
                        start_ledger + 1, 
                        -1
                    )
                    
                    # Make a copy for the remembrancer decoder
                    remembrancer_txn_stream = self.client.get_account_txns(
                        wallet_address, 
                        start_ledger + 1, 
                        -1
                    )

                    async for msg in combine_streams(
                        decode_task_stream(txn_stream, node_account=TASK_NODE_ADDRESS, user_account=user_wallet),
                        decode_remembrancer_stream(remembrancer_txn_stream, node_account=REMEMBRANCER_ADDRESS, user_account=user_wallet),
                    ):
                        self._state.update(msg)
                        self._last_processed_ledger[wallet_address] = msg.ledger_seq

                    # Sleep 30s between polls
                    await asyncio.sleep(30)

                except asyncio.CancelledError:
                    logger.debug(f"Refresh loop task cancelled for {wallet_address}")
                    break
                except Exception as e:
                    logger.error(f"Error in refresh loop for {wallet_address}: {e}")
                    # Wait 5s to avoid infinite spin if there's an error
                    await asyncio.sleep(5)

            logger.debug(f"Exiting refresh loop for {wallet_address}")

        # Start the refresh loop as a Task
        self._refresh_tasks[wallet_address] = asyncio.create_task(_refresh())

    def stop_refresh_loop(self, wallet_address: str) -> None:
        """
        Stops the background refresh loop for the specified wallet address if it exists.
        """
        logger.debug(f"Stopping refresh loop for {wallet_address}")
        if wallet_address in self._is_refreshing:
            self._is_refreshing[wallet_address] = False

        if wallet_address in self._refresh_tasks:
            self._refresh_tasks[wallet_address].cancel()
            del self._refresh_tasks[wallet_address]

    async def get_tasks_by_state(
        self,
        wallet_address: str,
        status: Optional[TaskStatus] = None
    ) -> List[dict]:
        """
        Return tasks from in-memory state for the specified wallet, optionally filtered
        by TaskStatus.
        """
        logger.debug(f"Getting tasks by state for {wallet_address} (status filter: {status})")
        
        # Ensure we have initialized state
        if not self._state.node_account or wallet_address not in self._last_processed_ledger:
            logger.debug(f"State not initialized for {wallet_address}, initializing now")
            await self.initialize_user_tasks(wallet_address)
        
        # Grab the user's in-memory AccountState
        account_state = self._state.node_account
        if not account_state: 
            logger.debug(f"No AccountState found for {wallet_address} after initialization")
            return []

        # Log the available tasks
        logger.debug(f"Found {len(account_state.tasks)} tasks in account state")
        
        # Filter tasks if a status is specified
        tasks = []
        for task_id, tstate in account_state.tasks.items():
            if status is None or tstate.status == status:
                # Handle message history with updated SDK structure
                message_history = []
                
                # Check first message to understand format
                if tstate.message_history and len(tstate.message_history) > 0:
                    sample_msg = tstate.message_history[0]
                    
                    # Log structure of the message history item for debugging
                    if len(tasks) == 0:  # Only log for first task
                        logger.debug(f"Message history item type: {type(sample_msg)}")
                        if hasattr(sample_msg, 'timestamp'):
                            logger.debug(f"Sample message timestamp: {sample_msg.timestamp}")
                        if hasattr(sample_msg, 'direction'):
                            logger.debug(f"Sample message direction: {sample_msg.direction}")
                        if hasattr(sample_msg, 'raw_data'):
                            logger.debug(f"Sample message has raw_data attribute")
                
                # Process all messages in the history
                for msg_item in tstate.message_history:
                    try:
                        # New SDK format (each message_history item is a tuple of (timestamp, direction, raw_data))
                        if isinstance(msg_item, tuple):
                            if len(msg_item) == 3:  # New format: (timestamp, direction, raw_data)
                                timestamp, direction, raw_data = msg_item
                                message_history.append({
                                    "timestamp": timestamp.isoformat() if isinstance(timestamp, datetime) else str(timestamp),
                                    "direction": direction.name.lower() if hasattr(direction, "name") else str(direction),
                                    "data": raw_data
                                })
                            elif len(msg_item) == 2:  # Old format: (direction, data)
                                direction, data = msg_item
                                message_history.append({
                                    "timestamp": None,
                                    "direction": direction.name.lower() if hasattr(direction, "name") else str(direction),
                                    "data": data
                                })
                        # Object-based format
                        elif hasattr(msg_item, "direction") and (hasattr(msg_item, "raw_data") or hasattr(msg_item, "data")):
                            direction = msg_item.direction
                            data = getattr(msg_item, "raw_data", None) or getattr(msg_item, "data", "")
                            timestamp = getattr(msg_item, "timestamp", None)
                            
                            message_history.append({
                                "timestamp": timestamp.isoformat() if isinstance(timestamp, datetime) else 
                                            (str(timestamp) if timestamp else None),
                                "direction": direction.name.lower() if hasattr(direction, "name") else str(direction),
                                "data": data
                            })
                        else:
                            # Fallback for unknown formats
                            message_history.append({
                                "timestamp": None,
                                "direction": "unknown",
                                "data": str(msg_item)
                            })
                    except Exception as e:
                        logger.error(f"Error processing message history item: {e}", exc_info=True)
                        message_history.append({
                            "timestamp": None,
                            "direction": "error",
                            "data": f"Error processing message item: {str(e)}"
                        })
                
                # Build the task object
                task_dict = {
                    "id": task_id,
                    "status": tstate.status.name.lower(),
                    "pft_offered": str(tstate.pft_offered) if tstate.pft_offered else None,
                    "pft_rewarded": str(tstate.pft_rewarded) if tstate.pft_rewarded else None,
                    "message_history": message_history,
                    "task_request": tstate.task_request,
                    "task_statement": tstate.task_statement,
                    "completion_statement": tstate.completion_statement,
                    "challenge_statement": tstate.challenge_statement,
                    "challenge_response": tstate.challenge_response,
                    "timestamp": None,  # Legacy field
                }
                
                tasks.append(task_dict)

        logger.debug(f"Returning {len(tasks)} tasks after filtering")
        return tasks

    async def get_tasks_by_ui_section(self, wallet_address: str) -> Dict[str, List[dict]]:
        """
        Organize tasks from the in-memory state into their respective status sections.
        """
        # Fetch all tasks from in-memory state
        tasks = await self.get_tasks_by_state(wallet_address)

        # Initialize sections for each possible TaskStatus
        sections = {s.name.lower(): [] for s in TaskStatus}

        for t in tasks:
            sections[t["status"]].append(t)

        return sections

    def clear_user_state(self, wallet_address: str) -> None:
        """
        Clear all state related to a specific wallet address when they log out.
        """
        logger.debug(f"Clearing state for {wallet_address}")
        
        # Stop any running refresh loop
        self.stop_refresh_loop(wallet_address)
        
        # Clear the last processed ledger
        if wallet_address in self._last_processed_ledger:
            del self._last_processed_ledger[wallet_address]
        
        # Create a completely fresh UserState instead of reusing the existing one
        self._state = UserState()
        
        # Also clear any refresh flags
        if wallet_address in self._is_refreshing:
            self._is_refreshing[wallet_address] = False
        
        logger.debug(f"State cleared for {wallet_address}")

    async def get_user_payments(
        self,
        wallet_address: str,
        start_ledger: Optional[int] = None,
        end_ledger: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch all user Payment-type transactions for the given wallet_address,
        excluding those with the node address (TASK_NODE_ADDRESS). This uses
        the postfiat-sdk's CachingRpcClient to retrieve the transactions directly
        from the XRPL (with caching).
        """
        if start_ledger is None:
            start_ledger = EARLIEST_LEDGER_SEQ
        if end_ledger is None:
            end_ledger = -1

        logger.info(f"Fetching user payments for {wallet_address} from {start_ledger} to {end_ledger}")
        payments = []

        async for txn in self.client.get_account_txns(wallet_address, start_ledger, end_ledger):
            # Only consider Payment transactions
            tx_type = txn.data.get("tx_json", {}).get("TransactionType")
            if tx_type != "Payment":
                continue

            # Exclude transactions involving the node address
            if txn.from_address == TASK_NODE_ADDRESS or txn.to_address == TASK_NODE_ADDRESS:
                continue

            # Build a simple dictionary describing the transaction
            # Note: txn.amount_pft is automatically populated for PFT transfers.
            # For XRP, delivered_amount in the metadata may be a string in drops.
            # If it's a dictionary, it often indicates an issued currency (PFT).
            raw_delivered = txn.data.get("meta", {}).get("delivered_amount", 0)

            if isinstance(raw_delivered, dict):
                # Already accounted for in txn.amount_pft for PFT
                xrp_amount = 0
            else:
                # Likely XRP in drops
                try:
                    xrp_amount = float(raw_delivered) / 1_000_000
                except (ValueError, TypeError):
                    xrp_amount = 0

            payments.append({
                "ledger_index": txn.ledger_index,
                "timestamp": txn.timestamp.isoformat() if txn.timestamp else None,
                "hash": txn.hash,
                "from_address": txn.from_address,
                "to_address": txn.to_address,
                "amount_xrp": xrp_amount,
                "amount_pft": float(txn.amount_pft),
                "memo_data": txn.memo_data,
            })

        return payments

    async def get_account_status(self, wallet_address: str) -> Dict[str, Any]:
        """
        Get account status information including initiation rite status,
        context document link, and blacklist status.
        """
        logger.debug(f"Fetching account status for {wallet_address}")
        
        if not self._state.node_account:
            return {
                "init_rite_status": "UNSTARTED",
                "context_doc_link": None,
                "is_blacklisted": False,
                "init_rite_statement": None
            }
        
        return {
            "init_rite_status": self._state.node_account.init_rite_status.name,
            "context_doc_link": self._state.node_account.context_doc_link,
            "is_blacklisted": self._state.node_account.is_blacklisted,
            "init_rite_statement": self._state.node_account.init_rite_statement
        }

    async def get_user_node_messages(self, user_account: str, node_account: str, user_wallet: Wallet = None):
        """
        Get all messages between a user and a specific node
        
        Args:
            user_account: User account address
            node_account: Node account address
            user_wallet: Optional wallet instance for decrypting messages
            
        Returns:
            List of messages between the user and node
        """
        logger.debug(f"Getting messages between {user_account} and {node_account}")
        
        # Make sure we have the latest transactions by initializing with the wallet for decryption
        if user_wallet:
            await self.initialize_user_tasks(user_account, user_wallet)
        else:
            await self.initialize_user_tasks(user_account)
        
        messages = []
        
        # Get the transaction stream once
        txn_stream = self.client.get_account_txns(
            user_account,
            EARLIEST_LEDGER_SEQ,
            -1
        )
        
        try:
            # Use the proper decoder based on the node account
            if node_account == REMEMBRANCER_ADDRESS:
                # Use the remembrancer decoder with the wallet for decryption
                async for msg in decode_remembrancer_stream(txn_stream, node_account=node_account, user_account=user_wallet):
                    # Format the message for the frontend
                    is_from_user = msg.direction == Direction.USER_TO_NODE
                    
                    messages.append({
                        "message_id": msg.message_id,
                        "direction": "USER_TO_NODE" if is_from_user else "NODE_TO_USER",
                        "message": msg.message,
                        "timestamp": msg.timestamp.timestamp() if hasattr(msg, 'timestamp') and msg.timestamp else 0,
                        "amount_pft": msg.amount_pft if hasattr(msg, 'amount_pft') else 0
                    })
            else:
                # For other node types, use the task decoder
                async for msg in decode_task_stream(txn_stream, node_account=node_account, user_account=user_wallet):
                    is_from_user = msg.direction == Direction.USER_TO_NODE
                    
                    messages.append({
                        "message_id": msg.message_id,
                        "direction": "USER_TO_NODE" if is_from_user else "NODE_TO_USER",
                        "message": msg.message,
                        "timestamp": msg.timestamp.timestamp() if hasattr(msg, 'timestamp') and msg.timestamp else 0,
                        "amount_pft": msg.amount_pft if hasattr(msg, 'amount_pft') else 0
                    })
        except Exception as e:
            logger.error(f"Error processing messages: {str(e)}", exc_info=True)
        
        # Sort by timestamp
        messages.sort(key=lambda x: x["timestamp"])
        
        return messages
    
