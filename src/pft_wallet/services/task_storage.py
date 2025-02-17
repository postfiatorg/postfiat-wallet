import os
from xrpl.wallet import Wallet

# Set a random seed for development before importing tasknode
dev_wallet = Wallet.create()
os.environ['TASK_NODE_SEED'] = dev_wallet.seed

from typing import List, Dict, Any, Optional
from tasknode.rpc import CachingRpcClient
from tasknode.messages import Message
from tasknode.state.state_event_sourcer import TaskStatus, TaskNodeState
from pft_wallet.config import settings
from pathlib import Path
import logging
import asyncio
import re

from tasknode.constants import EARLIEST_LEDGER_SEQ

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

        # TaskNodeState is a single aggregator for all user accounts in memory
        self._state = TaskNodeState()

        # For each user (wallet address), track:
        #  - last processed ledger
        #  - whether a refresh loop is active
        #  - the asyncio Task object that runs the refresh loop
        self._last_processed_ledger: Dict[str, int] = {}
        self._is_refreshing: Dict[str, bool] = {}
        self._refresh_tasks: Dict[str, asyncio.Task] = {}

    async def get_ledger_range(self, wallet_address: str) -> tuple[int, int]:
        """Get valid ledger range for an account"""
        # Use a fixed starting point for now since we don't need account creation ledger
        first_ledger = EARLIEST_LEDGER_SEQ.ledger_seq
        return first_ledger, -1  # -1 indicates latest ledger

    async def initialize_user_tasks(self, wallet_address: str) -> None:
        """
        Fetches all existing transactions/messages for the user from the earliest ledger
        to the latest, updating TaskNodeState. This is typically called when a user
        "signs in" or appears in the UI for the first time.
        
        The result is that the user has an in-memory AccountState in `self._state`
        containing tasks, handshake info, and so on.
        """
        logger.info(f"Initializing TaskNodeState for {wallet_address}")

        # We begin at EARLIEST_LEDGER_SEQ.ledger_seq.  -1 means "latest"
        start_ledger = EARLIEST_LEDGER_SEQ.ledger_seq
        end_ledger = -1

        newest_ledger_seen = None

        # Fetch and decode all messages from earliest to latest
        async for msg in self.client.get_account_msgs(
            account=wallet_address,
            start_ledger=start_ledger,
            end_ledger=end_ledger
        ):
            self._state.update(msg)
            newest_ledger_seen = msg.ledger_seq

        # Store the last processed ledger
        if newest_ledger_seen is not None:
            self._last_processed_ledger[wallet_address] = newest_ledger_seen
        else:
            # If no messages found, at least set them to the earliest ledger
            self._last_processed_ledger[wallet_address] = start_ledger

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
                        start_ledger = self._last_processed_ledger.get(wallet_address, EARLIEST_LEDGER_SEQ.ledger_seq)

                    # We'll fetch from the last processed + 1 up to 'latest' (-1)
                    async for msg in self.client.get_account_msgs(
                        account=wallet_address,
                        start_ledger=start_ledger + 1,
                        end_ledger=-1
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
            start_ledger = EARLIEST_LEDGER_SEQ.ledger_seq
        if end_ledger is None:
            end_ledger = -1

        logger.info(f"Fetching user tasks for {wallet_address} from {start_ledger} to {end_ledger}")
        msgs = []
        try:
            async for msg in self.client.get_account_msgs(
                account=wallet_address,
                start_ledger=start_ledger,
                end_ledger=end_ledger
            ):
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
        # Ensure the user's account is in memory (if not, or if they haven't run init yet, do so)
        if wallet_address not in self._state.accounts:
            logger.debug(f"{wallet_address} not in state, initializing user tasks.")
            await self.initialize_user_tasks(wallet_address)

        # Grab the user's in-memory AccountState
        account_state = self._state.accounts.get(wallet_address)
        if not account_state:
            logger.warning(f"No AccountState found for {wallet_address}")
            return []

        # Filter tasks if a status is specified
        tasks = []
        for task_id, tstate in account_state.tasks.items():
            if status is None or tstate.status == status:
                tasks.append({
                    "id": task_id,
                    "status": tstate.status.name.lower(),
                    "pft_offered": str(tstate.pft_offered) if tstate.pft_offered else None,
                    "pft_rewarded": str(tstate.pft_rewarded) if tstate.pft_rewarded else None,
                    "message_history": [
                        {"direction": direction.name.lower(), "data": data}
                        for direction, data in tstate.message_history
                    ],
                    "timestamp": None,  # If needed, you could store or derive from messages
                })

        return tasks

    async def get_tasks_by_ui_section(self, wallet_address: str) -> Dict[str, List[dict]]:
        """
        Organize tasks from the in-memory state into their respective status sections.
        """
        # Ensure the user is initialized
        if wallet_address not in self._state.accounts:
            logger.debug(f"{wallet_address} not in state, initializing user tasks.")
            await self.initialize_user_tasks(wallet_address)

        # Fetch all tasks from in-memory state
        tasks = await self.get_tasks_by_state(wallet_address)

        # Initialize sections for each possible TaskStatus
        sections = {s.name.lower(): [] for s in TaskStatus}

        for t in tasks:
            sections[t["status"]].append(t)

        return sections
