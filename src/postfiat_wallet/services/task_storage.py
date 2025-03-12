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
import time
<<<<<<< HEAD
=======
import random
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c

from postfiat.nodes.task.constants import EARLIEST_LEDGER_SEQ, TASK_NODE_ADDRESS, REMEMBRANCER_ADDRESS
from postfiat.nodes.task.codecs.v0.task import decode_account_txn
from postfiat.nodes.task.codecs.v0.remembrancer.decode import decode_account_txn
from xrpl.wallet import Wallet

logger = logging.getLogger(__name__)

class TaskStorage:
    """
    TaskStorage manages RPC clients and state for user accounts.
    Each authenticated user gets their own RPC client and state.
    """

    def __init__(self):
        """Initialize with empty collections for per-user data"""
        # Per-user RPC clients
        self._clients = {}
        
        # Per-user state
        self._user_states = {}
        
        # Per-user tracking data
        self._last_processed_ledger = {}
        self._refresh_tasks = {}
        
        # Track update timestamps per task
        self._task_update_timestamps = {}
        
        # Prepare cache directory path
        self._cache_dir = Path(settings.PATHS["cache_dir"]) / "tasknode"
        logger.debug(f"TaskNode cache location: {self._cache_dir.resolve()}")

    def _get_client(self, wallet_address: str) -> Optional[CachingRpcClient]:
        """Get RPC client for a user, return None if not initialized"""
        return self._clients.get(wallet_address)

    def _get_state(self, wallet_address: str) -> Optional[UserState]:
        """Get user state, return None if not initialized"""
        return self._user_states.get(wallet_address)

    async def initialize_user(self, wallet_address: str) -> None:
        """Initialize client and state for a new user"""
        logger.info(f"Initializing user: {wallet_address}")
        
        # Create a client for this user if it doesn't exist
        if wallet_address not in self._clients:
            # Create client with separate cache subdirectory for this user
            user_cache_dir = self._cache_dir / wallet_address
            user_cache_dir.mkdir(parents=True, exist_ok=True)
            
            self._clients[wallet_address] = CachingRpcClient(
                endpoint="https://xrpl.postfiat.org:6007",
                cache_dir=str(user_cache_dir)
            )
            
            # Create state for this user
            self._user_states[wallet_address] = UserState()
            
            # Initialize other tracking data
            self._last_processed_ledger[wallet_address] = EARLIEST_LEDGER_SEQ
            self._task_update_timestamps[wallet_address] = {}

    async def get_ledger_range(self, wallet_address: str) -> tuple[int, int]:
        """
        Get valid ledger range for an account. Defaults to the earliest PostFiat ledger
        and the latest ledger (-1).
        """
        first_ledger = EARLIEST_LEDGER_SEQ
        return first_ledger, -1

    async def initialize_user_tasks(self, wallet_address: str, user_wallet: Optional[Wallet] = None) -> None:
        """Initialize task storage for a user by fetching all their historical transactions"""
        # First ensure user is initialized
        await self.initialize_user(wallet_address)
        
        logger.info(f"Initializing tasks for {wallet_address}")
        
        # Get client for this user
        client = self._get_client(wallet_address)
        if not client:
            logger.error(f"No client found for {wallet_address}")
            return
        
        # Check if we already have a last processed ledger for this wallet
        start_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)
        
<<<<<<< HEAD
        try:
            # Use get_account_txns instead - the client doesn't have get_account_info
            # Just get the latest 1 transaction to determine current ledger
            current_ledger = -1  # Default to latest ledger
            txn_info_stream = client.get_account_txns(wallet_address, -1, -1, limit=1)
            
            # Try to extract current ledger from the first transaction
            async for txn in txn_info_stream:
                if hasattr(txn, 'ledger_index') and txn.ledger_index:
                    current_ledger = txn.ledger_index
                    break
            
            if current_ledger == -1:
                # If we couldn't determine current ledger, use a reasonable default
                # 1 day's worth of ledgers (at ~3.5 sec per ledger) from the last known point
                current_ledger = start_ledger + 24000  # ~24 hours of ledgers
                logger.info(f"Could not determine current ledger for {wallet_address}, using estimate: {current_ledger}")
        except Exception as e:
            logger.warning(f"Error getting account info for {wallet_address}: {str(e)}")
            # Use a reasonable default - just process from last point + 1 day worth of ledgers
            current_ledger = start_ledger + 24000
=======
        # Fetch account info to get current ledger index
        account_info = await client.get_account_info(wallet_address)
        current_ledger = account_info.get("ledger_current_index", 0)
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c
        
        # Only process if there are new transactions
        if start_ledger < current_ledger:
            # Get transaction stream and decode
            txn_stream = client.get_account_txns(
                wallet_address, 
                start_ledger, 
                current_ledger
            )
            
            # Process the transactions
            await self._decode_and_store_transactions(wallet_address, txn_stream, user_wallet)
            
            # Update the last processed ledger
            self._last_processed_ledger[wallet_address] = current_ledger
        
        logger.info(f"Initialized tasks for {wallet_address}, processed ledgers {start_ledger} to {current_ledger}")

<<<<<<< HEAD
    async def start_refresh_loop(self, wallet_address: str, user_wallet: Optional[Wallet] = None) -> None:
        """
        Starts a background loop that periodically polls for new ledger transactions,
        decodes them as TaskNode messages, and updates the in-memory state. If one
        is already active for this wallet, it won't start another.
        """
        if self._is_refreshing.get(wallet_address):
            logger.debug(f"Refresh loop is already running for {wallet_address}")
=======
    async def start_refresh_loop(self, wallet_address: str, user_wallet: Optional[Wallet] = None):
        """Start a background task to periodically refresh tasks for this user"""
        if wallet_address in self._refresh_tasks and not self._refresh_tasks[wallet_address].done():
            logger.info(f"Refresh loop already running for {wallet_address}")
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c
            return
        
        logger.info(f"Starting refresh loop for {wallet_address}")
        
        async def refresh_task():
            # Track consecutive errors for backoff
            consecutive_errors = 0
            # Start with a longer initial delay to let UI load first
            initial_delay = True
            
            while True:
                try:
                    if initial_delay:
                        # Give UI time to load before starting polling
                        await asyncio.sleep(10)
                        initial_delay = False
                    
                    # Calculate adaptive delay based on activity
                    # Start with 10s base polling interval
                    if consecutive_errors == 0:
                        base_delay = 10
                    else:
                        # Use exponential backoff for errors
                        base_delay = min(10 * (2 ** consecutive_errors), 60)
                    
                    # Get last processed ledger or use earliest
                    last_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)
                    
                    # Only log on first poll or errors
                    if consecutive_errors == 0 and last_ledger == EARLIEST_LEDGER_SEQ:
                        logger.debug(f"Starting initial refresh for {wallet_address}")
                    elif consecutive_errors > 0:
                        logger.debug(f"Retrying refresh for {wallet_address} after error")
                    
                    # Process new transactions since last update
                    new_updates = await self._process_new_transactions(wallet_address, last_ledger)
                    
                    # Use adaptive polling - longer when inactive
                    if new_updates:
                        consecutive_errors = 0
                        # Activity detected - poll more frequently
                        await asyncio.sleep(10)  # 10s with activity
                    else:
                        # No activity - gradually increase polling interval
                        consecutive_errors = min(consecutive_errors + 0.2, 3)  # Cap at ~40s
                        await asyncio.sleep(base_delay)
                    
                except asyncio.CancelledError:
                    logger.info(f"Refresh task for {wallet_address} was cancelled")
                    break
                except Exception as e:
                    consecutive_errors += 1
                    logger.error(f"Error in refresh task for {wallet_address}: {str(e)}", exc_info=True)
                    # Longer delay after errors
                    await asyncio.sleep(base_delay)
        
        # Start the refresh task and store it
        refresh_coro = refresh_task()
        self._refresh_tasks[wallet_address] = asyncio.create_task(refresh_coro)

    def stop_refresh_loop(self, wallet_address: str) -> None:
        """
        Stops the background refresh loop for the specified wallet address if it exists.
        """
        logger.debug(f"Stopping refresh loop for {wallet_address}")
        if wallet_address in self._refresh_tasks:
            self._refresh_tasks[wallet_address].cancel()
            del self._refresh_tasks[wallet_address]

    async def get_tasks_by_state(
        self,
        wallet_address: str,
        status: Optional[TaskStatus] = None,
        since: Optional[int] = None
    ) -> List[dict]:
        """
        Get all tasks for a user account, optionally filtered by status.
        If 'since' is provided, only return tasks updated since that timestamp.
        """
        logger.debug(f"Getting tasks by state for {wallet_address} (status filter: {status})")
        
        # Ensure we have initialized state
        if not self._get_state(wallet_address) or wallet_address not in self._last_processed_ledger:
            logger.debug(f"State not initialized for {wallet_address}, initializing now")
            await self.initialize_user_tasks(wallet_address)
        
        # Grab the user's in-memory AccountState
        account_state = self._get_state(wallet_address)
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

        # After the tasks list is populated but before returning:
        if since is not None:
            # Filter to only tasks that have been updated since the provided timestamp
            filtered_tasks = []
            for task in tasks:
                task_id = task["id"]
                # Get the latest update timestamp for this task
                task_ts = self._task_update_timestamps.get(wallet_address, {}).get(task_id, 0)
                if task_ts > since:
                    filtered_tasks.append(task)
            
            tasks = filtered_tasks
        
        # Before returning, update all task timestamps to current time
        current_time = time.time()
        if wallet_address not in self._task_update_timestamps:
            self._task_update_timestamps[wallet_address] = {}
        
        for task in tasks:
            self._task_update_timestamps[wallet_address][task["id"]] = current_time
        
        return tasks

    async def get_tasks_by_ui_section(self, wallet_address: str, since: Optional[int] = None) -> Dict[str, List[dict]]:
        """
        Organize tasks from the in-memory state into their respective status sections.
        If 'since' is provided, only return sections with tasks updated since that timestamp.
        """
        # Fetch all tasks from in-memory state
        tasks = await self.get_tasks_by_state(wallet_address)
        
        # Track removed tasks since last update if we're doing a delta update
        removed_task_ids = []
        if since is not None:
            # Get the set of task IDs we knew about at the last update
            last_known_ids = set(self._task_update_timestamps.get(wallet_address, {}).keys())
            # Get the set of current task IDs
            current_ids = {t["id"] for t in tasks}
            # Find IDs that were in the last update but not in the current one
            removed_task_ids = list(last_known_ids - current_ids)
        
        # Initialize sections for each possible TaskStatus
        sections = {s.name.lower(): [] for s in TaskStatus}
        
        # Track which tasks have been updated since the given timestamp
        updated_sections = {s.name.lower(): [] for s in TaskStatus}
        any_updates = False
        
        for t in tasks:
            sections[t["status"]].append(t)
            
            # If we're doing a delta update, check if this task was updated
            if since is not None:
                task_id = t["id"]
                task_ts = self._task_update_timestamps.get(wallet_address, {}).get(task_id, 0)
                if task_ts > since:
                    updated_sections[t["status"]].append(t)
                    any_updates = True
        
        # Update all task timestamps
        current_time = time.time()
        if wallet_address not in self._task_update_timestamps:
            self._task_update_timestamps[wallet_address] = {}
        
        for t in tasks:
            self._task_update_timestamps[wallet_address][t["id"]] = current_time
        
        # If doing a delta update, only return sections with updates
        result = sections
        if since is not None:
            result = updated_sections
            # Include the list of removed task IDs
            if removed_task_ids:
                result["removed_task_ids"] = removed_task_ids
                any_updates = True
            
            # If nothing has changed, return an empty result
            if not any_updates:
                return {}
        
        # Cache the full result (not the delta)
        cache_key = f"{wallet_address}_{since}" if since else wallet_address
        
        # Make sure _cache dictionary exists before using it
        if not hasattr(self, "_cache"):
            self._cache = {"all_tasks": {}}
            self._cache_timestamps = {"all_tasks": {}}
        
        self._cache["all_tasks"][cache_key] = sections
        self._cache_timestamps["all_tasks"][cache_key] = current_time
        
        return result

    def clear_user_state(self, wallet_address: str):
        """
        Remove all data for a user when they log out
        """
        logger.info(f"Clearing state for account: {wallet_address}")
        
        # Stop refresh loop if running
        self.stop_refresh_loop(wallet_address)
        
        # Remove all data for this user
        if wallet_address in self._clients:
            del self._clients[wallet_address]
        
        if wallet_address in self._user_states:
            del self._user_states[wallet_address]
        
        if wallet_address in self._last_processed_ledger:
            del self._last_processed_ledger[wallet_address]
        
        if wallet_address in self._refresh_tasks:
            del self._refresh_tasks[wallet_address]
        
        if wallet_address in self._task_update_timestamps:
            del self._task_update_timestamps[wallet_address]
        
        logger.info(f"State cleared for account: {wallet_address}")

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

        async for txn in self._get_client(wallet_address).get_account_txns(wallet_address, start_ledger, end_ledger):
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
        
        if not self._get_state(wallet_address):
            return {
                "init_rite_status": "UNSTARTED",
                "context_doc_link": None,
                "is_blacklisted": False,
                "init_rite_statement": None
            }
        
        return {
            "init_rite_status": self._get_state(wallet_address).node_account.init_rite_status.name,
            "context_doc_link": self._get_state(wallet_address).node_account.context_doc_link,
            "is_blacklisted": self._get_state(wallet_address).node_account.is_blacklisted,
            "init_rite_statement": self._get_state(wallet_address).node_account.init_rite_statement
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
        txn_stream = self._get_client(user_account).get_account_txns(
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
    
<<<<<<< HEAD
=======
    def is_initialized(self, wallet_address: str) -> bool:
        """Check if a wallet address has been initialized"""
        return (
            hasattr(self, "_get_state") and 
            self._get_state(wallet_address) and 
            wallet_address in self._last_processed_ledger
        )
    
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c
    async def initialize_recent_tasks(self, wallet_address: str, since_timestamp: int, user_wallet: Optional[Wallet] = None) -> None:
        """
        Initialize only recent tasks for a user based on a timestamp
        This is more efficient for UI refreshes that only need recent data
        """
        logger.info(f"Initializing recent tasks for {wallet_address} since {since_timestamp}")
        
<<<<<<< HEAD
        # Ensure user is initialized
        await self.initialize_user(wallet_address)
        
=======
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c
        # Convert timestamp to an approximate ledger index
        # This is an estimation - 3.5 seconds per ledger on average
        seconds_since = int(time.time()) - since_timestamp
        ledgers_since = max(1, int(seconds_since / 3.5))
        
<<<<<<< HEAD
        try:
            # Use get_account_txns instead of get_account_info
            current_ledger = -1  # Default to latest ledger
            txn_info_stream = self._get_client(wallet_address).get_account_txns(
                wallet_address, -1, -1, limit=1
            )
            
            # Try to extract current ledger from the first transaction
            async for txn in txn_info_stream:
                if hasattr(txn, 'ledger_index') and txn.ledger_index:
                    current_ledger = txn.ledger_index
                    break
            
            if current_ledger == -1:
                # If we couldn't determine current ledger, use a reasonable default from last known
                last_known = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)
                current_ledger = last_known + 24000  # ~24 hours of ledgers
                logger.info(f"Could not determine current ledger for {wallet_address}, using estimate: {current_ledger}")
        except Exception as e:
            logger.warning(f"Error getting account info for {wallet_address}: {str(e)}")
            # Use last known ledger + estimation
            last_known = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)
            current_ledger = last_known + ledgers_since
=======
        # Get account info to get current ledger index
        account_info = await self._get_client(wallet_address).get_account_info(wallet_address)
        current_ledger = account_info.get("ledger_current_index", 0)
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c
        
        # Calculate start ledger (don't go too far back)
        start_ledger = max(EARLIEST_LEDGER_SEQ, current_ledger - ledgers_since)
        
        # Get transaction stream and decode
        txn_stream = self._get_client(wallet_address).get_account_txns(
            wallet_address, 
            start_ledger, 
            current_ledger
        )
        
        # Process the transactions
        await self._decode_and_store_transactions(wallet_address, txn_stream, user_wallet)
        
        # Update the last processed ledger
        self._last_processed_ledger[wallet_address] = current_ledger
        
        logger.info(f"Initialized recent tasks for {wallet_address}, processed ledgers {start_ledger} to {current_ledger}")
<<<<<<< HEAD
    
=======

    def _cache_result(self, cache_type, key, data):
        """Store result in cache with expiry time"""
        current_time = time.time()
        
        # Initialize cache dictionaries if they don't exist
        if not hasattr(self, "_cache"):
            self._cache = {}
        if not hasattr(self, "_cache_expiry"):
            self._cache_expiry = {}
        
        # Create the cache type section if it doesn't exist
        if cache_type not in self._cache:
            self._cache[cache_type] = {}
            self._cache_expiry[cache_type] = {}
        
        # Store the data and set expiry (30 minutes)
        self._cache[cache_type][key] = data
        self._cache_expiry[cache_type][key] = current_time + 1800  # 30 minutes
        
        # Cleanup old cache entries (every 100 operations)
        if random.random() < 0.01:  # 1% chance to run cleanup
            self._cleanup_cache()

    def _cleanup_cache(self):
        """Remove expired cache entries"""
        current_time = time.time()
        
        for cache_type in self._cache_expiry:
            expired_keys = []
            for key, expiry in self._cache_expiry[cache_type].items():
                if expiry < current_time:
                    expired_keys.append(key)
            
            # Remove expired entries
            for key in expired_keys:
                if key in self._cache[cache_type]:
                    del self._cache[cache_type][key]
                if key in self._cache_expiry[cache_type]:
                    del self._cache_expiry[cache_type][key]
>>>>>>> 31f424aadeba0e4923c0cc9ed6958e25638ab38c

