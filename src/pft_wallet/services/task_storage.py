from typing import List, Dict, Any, Optional
from postfiat.rpc import CachingRpcClient
from postfiat.nodes.task.models.messages import Message
from postfiat.nodes.task.state import TaskStatus, UserState
from postfiat.utils.streams import combine_streams
from postfiat.nodes.task.codecs.v0.task import decode_account_stream as decode_task_stream
from postfiat.nodes.task.codecs.v0.remembrancer import decode_account_stream as decode_remembrancer_stream
from pft_wallet.config import settings
from pathlib import Path
import logging
import asyncio

from postfiat.nodes.task.constants import EARLIEST_LEDGER_SEQ, TASK_NODE_ADDRESS, REMEMBRANCER_ADDRESS
from postfiat.nodes.task.codecs.v0.task import decode_account_txn

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
        logger.info(f"TaskNode cache location: {cache_dir.resolve()}")

        # Create the client that fetches & caches XRPL transactions
        self.client = CachingRpcClient(
            endpoint="https://s2.ripple.com:51234",
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

    async def initialize_user_tasks(self, wallet_address: str) -> None:
        """
        Fetches all existing transactions/messages for the user from the earliest ledger
        to the latest, updating the state.
        """
        logger.info(f"Initializing state for {wallet_address}")

        start_ledger = EARLIEST_LEDGER_SEQ
        end_ledger = -1

        newest_ledger_seen = None
        message_count = 0

        try:
            # Fetch transactions only once
            txn_stream = self.client.get_account_txns(wallet_address, start_ledger, end_ledger)
            
            logger.info(f"Starting to fetch messages for {wallet_address} from ledger {start_ledger}")
            
            # Decode the transactions using both decoders
            task_stream = decode_task_stream(txn_stream, node_account=TASK_NODE_ADDRESS)
            
            async for msg in task_stream:
                logger.debug(f"Processing message: {msg}")
                self._state.update(msg)
                newest_ledger_seen = msg.ledger_seq
                message_count += 1
                
                if self._state.node_account:
                    logger.debug(f"Current task count: {len(self._state.node_account.tasks)}")

            # Store the last processed ledger
            if newest_ledger_seen is not None:
                self._last_processed_ledger[wallet_address] = newest_ledger_seen
                logger.info(f"Processed {message_count} messages, newest ledger: {newest_ledger_seen}")
            else:
                # If no messages found, at least set them to the earliest ledger
                self._last_processed_ledger[wallet_address] = start_ledger
                logger.info("No messages found during initialization")

            # Log final state
            if self._state.node_account:
                logger.info(f"Final task count: {len(self._state.node_account.tasks)}")
                logger.info(f"Task IDs: {list(self._state.node_account.tasks.keys())}")
            else:
                logger.warning("No node_account in state after initialization")

        except Exception as e:
            logger.error(f"Error during initialization: {str(e)}", exc_info=True)
            raise

        logger.info(f"Initialization complete for {wallet_address}. Last processed ledger: "
                    f"{self._last_processed_ledger[wallet_address]}")

    async def start_refresh_loop(self, wallet_address: str) -> None:
        """
        Starts a background loop that periodically polls for new ledger transactions,
        decodes them as TaskNode messages, and updates the in-memory state. If one
        is already active for this wallet, it won't start another.
        """
        if self._is_refreshing.get(wallet_address):
            logger.debug(f"Refresh loop is already running for {wallet_address}")
            return

        logger.info(f"Starting refresh loop for {wallet_address}")
        self._is_refreshing[wallet_address] = True

        async def _refresh():
            # Periodically poll for new messages until asked to stop
            while self._is_refreshing.get(wallet_address, False):
                try:
                    # Grab the last processed ledger for this user
                    start_ledger = self._last_processed_ledger.get(wallet_address)
                    if start_ledger is None:
                        # If the user wasn't initialized, do it now automatically
                        await self.initialize_user_tasks(wallet_address)
                        start_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ)

                    # We'll fetch from the last processed + 1 up to 'latest' (-1)
                    task_txn_stream = self.client.get_account_txns(
                        wallet_address, 
                        start_ledger + 1, 
                        -1
                    )
                    remembrancer_txn_stream = self.client.get_account_txns(
                        wallet_address, 
                        start_ledger + 1, 
                        -1
                    )

                    async for msg in combine_streams(
                        decode_task_stream(task_txn_stream, node_account=TASK_NODE_ADDRESS),
                        decode_remembrancer_stream(remembrancer_txn_stream, node_account=REMEMBRANCER_ADDRESS),
                    ):
                        self._state.update(msg)
                        self._last_processed_ledger[wallet_address] = msg.ledger_seq
                        logger.debug(f"Updated state with message from ledger {msg.ledger_seq}")

                    # Sleep 30s between polls
                    await asyncio.sleep(30)

                except asyncio.CancelledError:
                    logger.debug(f"Refresh loop task cancelled for {wallet_address}")
                    break
                except Exception as e:
                    logger.error(f"Error in refresh loop for {wallet_address}: {e}")
                    # Wait 5s to avoid infinite spin if there's an error
                    await asyncio.sleep(5)

            logger.info(f"Exiting refresh loop for {wallet_address}")

        # Start the refresh loop as a Task
        self._refresh_tasks[wallet_address] = asyncio.create_task(_refresh())

    def stop_refresh_loop(self, wallet_address: str) -> None:
        """
        Stops the background refresh loop for the specified wallet address if it exists.
        """
        logger.info(f"Stopping refresh loop for {wallet_address}")
        if wallet_address in self._is_refreshing:
            self._is_refreshing[wallet_address] = False

        if wallet_address in self._refresh_tasks:
            self._refresh_tasks[wallet_address].cancel()
            del self._refresh_tasks[wallet_address]

        # We typically keep the last processed ledger so that if they re-enable
        # the refresh loop, it picks up from where it left off.

    async def get_user_tasks(
        self, 
        wallet_address: str,
        start_ledger: Optional[int] = None,
        end_ledger: Optional[int] = None
    ) -> List[Message]:
        """
        Returns a fresh list of decoded TaskNode messages directly by streaming from the
        XRPL (using the caching client). This does not solely rely on in-memory state,
        but directly returns messages from the underlying XRPL/cached data.
        
        If start_ledger or end_ledger are None, defaults are used (earliest / latest).
        """
        if start_ledger is None:
            start_ledger = EARLIEST_LEDGER_SEQ
        if end_ledger is None:
            end_ledger = -1

        logger.info(f"Fetching user tasks for {wallet_address} from {start_ledger} to {end_ledger}")
        msgs = []
        try:
            # First get the transactions using the available method
            async for txn in self.client.get_account_txns(
                account=wallet_address,
                start_ledger=start_ledger,
                end_ledger=end_ledger
            ):
                # Then decode them into messages using the task codec
                if msg := decode_account_txn(txn, node_account=wallet_address):
                    msgs.append(msg)
        except Exception as e:
            logger.error(f"Error getting messages for {wallet_address}: {e}")
            raise
        return msgs

    async def get_tasks_by_state(
        self,
        wallet_address: str,
        status: Optional[TaskStatus] = None
    ) -> List[dict]:
        """
        Return tasks from in-memory state for the specified wallet, optionally filtered
        by TaskStatus.
        """
        logger.info(f"Getting tasks by state for {wallet_address} (status filter: {status})")
        
        # Ensure we have initialized state
        if not self._state.node_account or wallet_address not in self._last_processed_ledger:
            logger.info(f"State not initialized for {wallet_address}, initializing now")
            await self.initialize_user_tasks(wallet_address)
        
        # Grab the user's in-memory AccountState
        account_state = self._state.node_account
        if not account_state: 
            logger.warning(f"No AccountState found for {wallet_address} after initialization")
            return []

        # Log the available tasks
        logger.info(f"Found {len(account_state.tasks)} tasks in account state")
        if account_state.tasks:
            logger.info(f"Task IDs: {list(account_state.tasks.keys())}")
        
        # Filter tasks if a status is specified
        tasks = []
        for task_id, tstate in account_state.tasks.items():
            if status is None or tstate.status == status:
                logger.debug(f"Including task {task_id} with status {tstate.status}")
                tasks.append({
                    "id": task_id,
                    "status": tstate.status.name.lower(),
                    "pft_offered": str(tstate.pft_offered) if tstate.pft_offered else None,
                    "pft_rewarded": str(tstate.pft_rewarded) if tstate.pft_rewarded else None,
                    "message_history": [
                        {"direction": direction.name.lower(), "data": data}
                        for direction, data in tstate.message_history
                    ],
                    "timestamp": None,
                })

        logger.info(f"Returning {len(tasks)} tasks after filtering")
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
        logger.info(f"Clearing state for {wallet_address}")
        
        # Stop any running refresh loop
        self.stop_refresh_loop(wallet_address)
        
        # Clear the last processed ledger
        if wallet_address in self._last_processed_ledger:
            del self._last_processed_ledger[wallet_address]
        
        # Clear the user's tasks from state
        if self._state.node_account:
            self._state = UserState()  # Create fresh state
        
        logger.info(f"State cleared for {wallet_address}")

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
        logger.info(f"Fetching account status for {wallet_address}")
        
        if not self._state.node_account:
            return {
                "init_rite_status": "UNSTARTED",
                "context_doc_link": None,
                "is_blacklisted": False
            }
        
        return {
            "init_rite_status": self._state.node_account.init_rite_status.name,
            "context_doc_link": self._state.node_account.context_doc_link,
            "is_blacklisted": self._state.node_account.is_blacklisted
        }
