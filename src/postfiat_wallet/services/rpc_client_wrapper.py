from postfiat.rpc import CachingRpcClient
import logging
import asyncio
from typing import Set, Dict, Any, AsyncGenerator, Optional

logger = logging.getLogger(__name__)

class LazyRpcClient(CachingRpcClient):
    """
    Extends the SDK's CachingRpcClient to prevent automatic transaction fetching
    until explicitly authorized for a specific account.
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._authorized_accounts: Set[str] = set()
        self._pending_authorizations: Dict[str, asyncio.Future] = {}
    
    def authorize_account(self, account: str) -> None:
        """Allow transaction fetching for this account"""
        self._authorized_accounts.add(account)
        # Resolve any pending futures for this account
        if account in self._pending_authorizations:
            self._pending_authorizations[account].set_result(True)
            del self._pending_authorizations[account]
    
    def deauthorize_account(self, account: str) -> None:
        """Remove authorization for an account"""
        if account in self._authorized_accounts:
            self._authorized_accounts.remove(account)
    
    async def wait_for_authorization(self, account: str) -> None:
        """Wait until an account is authorized"""
        if account in self._authorized_accounts:
            return
        
        # Create a future if one doesn't exist
        if account not in self._pending_authorizations:
            self._pending_authorizations[account] = asyncio.Future()
        
        # Wait for authorization
        await self._pending_authorizations[account]
    
    async def get_account_txns(self, account: str, start_ledger: int, end_ledger: int) -> AsyncGenerator[Dict[str, Any], None]:
        """Override to check authorization before fetching transactions"""
        if account not in self._authorized_accounts:
            logger.warning(f"Blocking unauthorized transaction fetch for account: {account}")
            # Return empty generator
            return
            yield  # This line is never reached, but required for AsyncGenerator type
        
        async for txn in super().get_account_txns(account, start_ledger, end_ledger):
            yield txn
