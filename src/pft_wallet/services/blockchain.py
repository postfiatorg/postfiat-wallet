from typing import List, Dict, Any
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.models.requests import AccountInfo, AccountTx, AccountLines
from xrpl.wallet import Wallet
from xrpl.utils import drops_to_xrp
from xrpl.core.keypairs import derive_classic_address
import logging

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
