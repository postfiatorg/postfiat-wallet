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
from datetime import datetime, timedelta
import time
import random

from postfiat.nodes.task.constants import EARLIEST_LEDGER_SEQ, TASK_NODE_ADDRESS, REMEMBRANCER_ADDRESS
from postfiat.nodes.task.codecs.v0.task import decode_account_txn
from postfiat.nodes.task.codecs.v0.remembrancer.decode import decode_account_txn
from xrpl.wallet import Wallet

logger = logging.getLogger(__name__)

class TaskStorage:
    """
    TaskStorage manages state for user accounts, using a shared RPC client for efficiency.
    Each user gets their own state but shares the caching infrastructure.
    """

    def __init__(self):
        """Initialize with a shared client and per-user state tracking"""
        # Prepare local caching directory
        cache_dir = Path(settings.PATHS["cache_dir"]) / "tasknode"
        logger.debug(f"TaskNode cache location: {cache_dir.resolve()}")

        # A single shared client that fetches & caches XRPL transactions
        self.client = CachingRpcClient(
            endpoint="https://xrpl.postfiat.org:6007",
            cache_dir=str(cache_dir)
        )
        
        # Per-user state tracking
        self._user_states: Dict[str, UserState] = {}
        self._last_processed_ledger: Dict[str, int] = {}
        self._refresh_tasks: Dict[str, asyncio.Task] = {}
        self._last_access_time: Dict[str, datetime] = {}
        
        # Default TTL for inactive users (2 hours)
        self._user_ttl = timedelta(hours=2)
        
        # Task update timestamps
        self._task_update_timestamps: Dict[str, Dict[str, float]] = {}

    async def _cleanup_inactive_users(self):
        """Clean up resources for users who haven't been active recently"""
        now = datetime.now()
        addresses_to_cleanup = []
        
        for wallet_address, last_access in self._last_access_time.items():
            if now - last_access > self._user_ttl:
                addresses_to_cleanup.append(wallet_address)
        
        for address in addresses_to_cleanup:
            logger.info(f"Cleaning up inactive user: {address}")
            self.clear_user_state(address)

    def _get_state(self, wallet_address: str) -> UserState:
        """Get or create user state"""
        # Update access time for TTL
        self._last_access_time[wallet_address] = datetime.now()
        
        # Create state if it doesn't exist
        if wallet_address not in self._user_states:
            self._user_states[wallet_address] = UserState()
            self._task_update_timestamps[wallet_address] = {}
            
        return self._user_states[wallet_address]

    async def get_ledger_range(self, wallet_address: str) -> tuple[int, int]:
        """
        Get valid ledger range for an account. Defaults to the earliest PostFiat ledger
        and the latest ledger (-1).
        """
        first_ledger = EARLIEST_LEDGER_SEQ
        return first_ledger, -1

    async def initialize_user_tasks(self, wallet_address: str, user_wallet: Optional[Wallet] = None) -> None:
        """Initialize task storage for a user by fetching all their historical transactions"""
        logger.info(f"Initializing tasks for {wallet_address}")
        
        start_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)
        end_ledger = -1  # Latest
        
        newest_ledger_seen = None
        message_count = 0
        state = self._get_state(wallet_address)
        
        try:
            # Fetch transaction streams (one for each decoder)
            txn_stream = self.client.get_account_txns(wallet_address, start_ledger, end_ledger)
            remembrancer_txn_stream = self.client.get_account_txns(wallet_address, start_ledger, end_ledger)
            
            # Combine both streams for efficiency
            combined_stream = combine_streams(
                decode_task_stream(txn_stream, node_account=TASK_NODE_ADDRESS, user_account=user_wallet),
                decode_remembrancer_stream(remembrancer_txn_stream, node_account=REMEMBRANCER_ADDRESS, user_account=user_wallet)
            )
            
            # Process all messages
            async for msg in combined_stream:
                state.update(msg)
                newest_ledger_seen = msg.ledger_seq
                message_count += 1
                
                # Track task-specific updates
                if hasattr(msg, 'task_id') and msg.task_id:
                    self._task_update_timestamps[wallet_address][msg.task_id] = time.time()

            # Update the last processed ledger
            if newest_ledger_seen is not None:
                self._last_processed_ledger[wallet_address] = newest_ledger_seen
                logger.debug(f"Processed {message_count} messages, newest ledger: {newest_ledger_seen}")
            else:
                self._last_processed_ledger[wallet_address] = start_ledger
                logger.debug("No messages found during initialization")
                
        except Exception as e:
            logger.error(f"Error during initialization: {str(e)}", exc_info=True)
            raise

    async def start_refresh_loop(self, wallet_address: str, user_wallet: Optional[Wallet] = None):
        """Start a background task to periodically refresh tasks for this user"""
        if wallet_address in self._refresh_tasks and not self._refresh_tasks[wallet_address].done():
            logger.info(f"Refresh loop already running for {wallet_address}")
            return
        
        logger.info(f"Starting refresh loop for {wallet_address}")
        
        async def refresh_task():
            # Track consecutive errors for backoff
            consecutive_errors = 0
            # Start with a delay to let UI load first
            initial_delay = True
            
            while True:
                try:
                    if initial_delay:
                        # Give UI time to load before polling
                        await asyncio.sleep(10)
                        initial_delay = False
                    
                    # Calculate adaptive delay based on activity and errors
                    if consecutive_errors == 0:
                        base_delay = 10  # 10s with no errors
                    else:
                        # Use exponential backoff for errors (max 60s)
                        base_delay = min(10 * (2 ** consecutive_errors), 60)
                    
                    # Get last processed ledger
                    start_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)
                    end_ledger = -1  # Latest
                    
                    # Process new transactions
                    state = self._get_state(wallet_address)
                    new_updates = 0
                    
                    # Get transaction streams
                    txn_stream = self.client.get_account_txns(wallet_address, start_ledger + 1, end_ledger)
                    remembrancer_txn_stream = self.client.get_account_txns(wallet_address, start_ledger + 1, end_ledger)
                    
                    # Combine streams for processing
                    combined_stream = combine_streams(
                        decode_task_stream(txn_stream, node_account=TASK_NODE_ADDRESS, user_account=user_wallet),
                        decode_remembrancer_stream(remembrancer_txn_stream, node_account=REMEMBRANCER_ADDRESS, user_account=user_wallet)
                    )
                    
                    async for msg in combined_stream:
                        state.update(msg)
                        self._last_processed_ledger[wallet_address] = msg.ledger_seq
                        new_updates += 1
                        
                        # Track task-specific updates
                        if hasattr(msg, 'task_id') and msg.task_id:
                            self._task_update_timestamps[wallet_address][msg.task_id] = time.time()
                    
                    # Reset error counter on successful update
                    if new_updates > 0:
                        consecutive_errors = 0
                        # Activity detected - shorter polling interval
                        await asyncio.sleep(10)
                    else:
                        # Periodically clean up inactive users
                        if random.random() < 0.1:  # 10% chance each poll
                            await self._cleanup_inactive_users()
                        
                        # Adaptive polling - longer when inactive
                        await asyncio.sleep(base_delay)
                        
                except asyncio.CancelledError:
                    logger.info(f"Refresh task cancelled for {wallet_address}")
                    break
                except Exception as e:
                    logger.error(f"Error in refresh task for {wallet_address}: {str(e)}", exc_info=True)
                    consecutive_errors += 1
                    # Sleep with backoff to avoid thrashing
                    await asyncio.sleep(base_delay)
        
        # Start the refresh loop
        self._refresh_tasks[wallet_address] = asyncio.create_task(refresh_task())

    def stop_refresh_loop(self, wallet_address: str) -> None:
        """Stop the background refresh loop for a user"""
        if wallet_address in self._refresh_tasks and not self._refresh_tasks[wallet_address].done():
            logger.info(f"Stopping refresh task for {wallet_address}")
            self._refresh_tasks[wallet_address].cancel()

    def clear_user_state(self, wallet_address: str) -> None:
        """Clear all state related to a specific wallet address"""
        logger.info(f"Clearing state for {wallet_address}")
        
        # Stop any refresh task
        self.stop_refresh_loop(wallet_address)
        
        # Remove all user data
        if wallet_address in self._user_states:
            del self._user_states[wallet_address]
        
        if wallet_address in self._last_processed_ledger:
            del self._last_processed_ledger[wallet_address]
            
        if wallet_address in self._last_access_time:
            del self._last_access_time[wallet_address]
            
        if wallet_address in self._task_update_timestamps:
            del self._task_update_timestamps[wallet_address]

    async def get_tasks_by_state(
        self,
        wallet_address: str,
        status: Optional[TaskStatus] = None
    ) -> List[dict]:
        """Get tasks for a user, optionally filtered by status"""
        logger.debug(f"Getting tasks for {wallet_address} with status filter: {status}")
        
        # Make sure state is initialized
        if wallet_address not in self._user_states:
            await self.initialize_user_tasks(wallet_address)
        
        # Mark as accessed
        self._last_access_time[wallet_address] = datetime.now()
        
        # Get account state
        state = self._get_state(wallet_address)
        if not state.node_account:
            return []
            
        account_state = state.node_account
        
        # Filter and format tasks
        tasks = []
        for task_id, tstate in account_state.tasks.items():
            if status is None or tstate.status == status:
                # Format message history
                message_history = []
                if tstate.message_history:
                    for msg_item in tstate.message_history:
                        try:
                            # Support tuple format (timestamp, direction, raw_data)
                            if isinstance(msg_item, tuple):
                                if len(msg_item) == 3:
                                    timestamp, direction, raw_data = msg_item
                                    message_history.append({
                                        "timestamp": timestamp.isoformat() if isinstance(timestamp, datetime) else str(timestamp),
                                        "direction": direction.name.lower() if hasattr(direction, "name") else str(direction),
                                        "data": raw_data
                                    })
                                elif len(msg_item) == 2:
                                    direction, data = msg_item
                                    message_history.append({
                                        "timestamp": None,
                                        "direction": direction.name.lower() if hasattr(direction, "name") else str(direction),
                                        "data": data
                                    })
                            # Support object format
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
                                # Fallback
                                message_history.append({
                                    "timestamp": None,
                                    "direction": "unknown",
                                    "data": str(msg_item)
                                })
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            message_history.append({
                                "timestamp": None,
                                "direction": "error",
                                "data": f"Error: {str(e)}"
                            })
                
                # Get update timestamp if available
                update_timestamp = self._task_update_timestamps.get(wallet_address, {}).get(task_id, 0)
                
                # Format task data
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
                    "last_updated": update_timestamp,
                }
                
                tasks.append(task_dict)
        
        return tasks

    async def get_tasks_by_ui_section(self, wallet_address: str) -> Dict[str, List[dict]]:
        """Group tasks by their UI section (status)"""
        # Get all tasks
        all_tasks = await self.get_tasks_by_state(wallet_address)
        
        # Group by status
        sections = {s.name.lower(): [] for s in TaskStatus}
        
        for task in all_tasks:
            sections[task["status"]].append(task)
            
        return sections

    async def get_user_payments(
        self,
        wallet_address: str,
        start_ledger: Optional[int] = None,
        end_ledger: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get payment transactions for a user"""
        if start_ledger is None:
            start_ledger = EARLIEST_LEDGER_SEQ
        if end_ledger is None:
            end_ledger = -1
            
        # Mark as accessed
        self._last_access_time[wallet_address] = datetime.now()
        
        logger.debug(f"Fetching payments for {wallet_address} from {start_ledger} to {end_ledger}")
        payments = []
        
        async for txn in self.client.get_account_txns(wallet_address, start_ledger, end_ledger):
            # Only consider Payment transactions
            tx_type = txn.data.get("tx_json", {}).get("TransactionType")
            if tx_type != "Payment":
                continue
                
            # Exclude node transactions
            if txn.from_address == TASK_NODE_ADDRESS or txn.to_address == TASK_NODE_ADDRESS:
                continue
                
            # Process delivered amount
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
        """Get account status information"""
        logger.debug(f"Fetching account status for {wallet_address}")
        
        # Mark as accessed
        self._last_access_time[wallet_address] = datetime.now()
        
        state = self._get_state(wallet_address)
        if not state.node_account:
            return {
                "init_rite_status": "UNSTARTED",
                "context_doc_link": None,
                "is_blacklisted": False,
                "init_rite_statement": None
            }
            
        return {
            "init_rite_status": state.node_account.init_rite_status.name,
            "context_doc_link": state.node_account.context_doc_link,
            "is_blacklisted": state.node_account.is_blacklisted,
            "init_rite_statement": state.node_account.init_rite_statement
        }

    async def get_user_node_messages(self, user_account: str, node_account: str, user_wallet: Wallet = None):
        """Get messages between a user and a node"""
        logger.debug(f"Getting messages between {user_account} and {node_account}")
        
        # Mark as accessed
        self._last_access_time[user_account] = datetime.now()
        
        # Initialize if needed
        if user_account not in self._user_states:
            if user_wallet:
                await self.initialize_user_tasks(user_account, user_wallet)
            else:
                await self.initialize_user_tasks(user_account)
                
        messages = []
        
        # Get transaction stream
        txn_stream = self.client.get_account_txns(
            user_account,
            EARLIEST_LEDGER_SEQ,
            -1
        )
        
        try:
            # Use appropriate decoder based on node type
            if node_account == REMEMBRANCER_ADDRESS:
                async for msg in decode_remembrancer_stream(txn_stream, node_account=node_account, user_account=user_wallet):
                    is_from_user = msg.direction == Direction.USER_TO_NODE
                    
                    messages.append({
                        "message_id": msg.message_id,
                        "direction": "USER_TO_NODE" if is_from_user else "NODE_TO_USER",
                        "message": msg.message,
                        "timestamp": msg.timestamp.timestamp() if hasattr(msg, 'timestamp') and msg.timestamp else 0,
                        "amount_pft": msg.amount_pft if hasattr(msg, 'amount_pft') else 0
                    })
            else:
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
        
    def is_initialized(self, wallet_address: str) -> bool:
        """Check if a user is initialized"""
        return (
            wallet_address in self._user_states and
            wallet_address in self._last_processed_ledger
        )
