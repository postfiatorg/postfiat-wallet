from fastapi import APIRouter, HTTPException, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel
from pft_wallet.services.blockchain import BlockchainService
from pft_wallet.services import storage
import logging
from pft_wallet.services.task_storage import TaskStorage
from enum import Enum
from tasknode.state import TaskStatus
from typing import Optional

app = FastAPI()

# Configure logging
logger = logging.getLogger(__name__)

# Add CORS middleware with more specific configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()
blockchain = BlockchainService()

# Create one global TaskStorage instance
task_storage = TaskStorage()

# This enum mirrors TaskStatus in the backend so we can filter tasks by status
class TaskStatusAPI(str, Enum):
    INVALID = "invalid"
    REQUESTED = "requested"
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REFUSED = "refused"
    COMPLETED = "completed"
    CHALLENGED = "challenged"
    RESPONDED = "responded"
    REWARDED = "rewarded"

class WalletAuth(BaseModel):
    username: str
    password: str
    private_key: Optional[str] = None  # Only needed for signup
    address: Optional[str] = None      # Only needed for signup

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/balance/{account}")
async def get_balance(account: str):
    xrp_balance = await blockchain.get_xrp_balance(account)
    pft_balance = await blockchain.get_pft_balance(account)
    return {
        "xrp": xrp_balance,
        "pft": pft_balance
    }

@router.post("/auth/signin")
async def signin(auth: WalletAuth):
    """
    Sign in a user using their username and password.
    """
    try:
        # Find stored wallet by username
        wallets = storage.load_wallets()
        wallet_address = None
        wallet_data = None
        
        for addr, data in wallets.items():
            if data["username"] == auth.username:
                wallet_address = addr
                wallet_data = data
                break

        if not wallet_data:
            raise ValueError("User not found")
            
        # Decrypt the private key using the user's password
        private_key = storage.decrypt_private_key(wallet_data["encrypted_key"], auth.password)
        
        # Verify the private key is valid (will raise if invalid)
        wallet_info = blockchain.create_wallet_from_secret(private_key)
        
        logger.info(f"User '{auth.username}' signed in with address '{wallet_address}'.")
        return {
            "status": "success", 
            "address": wallet_address,
            "username": auth.username
        }
    except ValueError as e:
        logger.warning(f"Sign-in failed for user '{auth.username}': {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/auth/create")
async def create_account(auth: WalletAuth):
    """
    Create a new user account, storing the encrypted private key.
    """
    if not auth.private_key:
        raise HTTPException(status_code=400, detail="Private key required for account creation")
        
    try:
        wallet_info = blockchain.create_wallet_from_secret(auth.private_key)
        address = wallet_info["address"]
        
        # Add the new wallet to the local storage
        storage.add_wallet(address, auth.private_key, auth.username, auth.password)
        
        logger.info(f"Created new account for user '{auth.username}' under address '{address}'.")
        return {
            "status": "success",
            "address": address
        }
    except ValueError as e:
        logger.error(f"Error creating account for user '{auth.username}': {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.api_route("/wallet/generate", methods=["POST", "OPTIONS"])
async def generate_wallet(request: Request):
    """
    Generate a brand-new wallet. For non-custodial usage, the private key/secret
    must remain with the user. This endpoint is for local test usage or convenience.
    """
    logger.debug(f"Received {request.method} request for /wallet/generate")
    if request.method == "OPTIONS":
        logger.debug("Handling preflight OPTIONS request")
        # Return an empty response for the preflight request
        return {}
    wallet_info = blockchain.generate_wallet()
    logger.debug(f"Generated wallet: {wallet_info}")
    return wallet_info

# --------------------
# Task-related endpoints
# --------------------

@router.post("/tasks/initialize/{account}")
async def initialize_tasks(account: str):
    """
    Fetch all historical tasks/messages for this account
    and store them in memory for querying.
    """
    logger.info(f"Received initialize tasks request for account: {account}")
    try:
        await task_storage.initialize_user_tasks(account)
        logger.info(f"Successfully initialized tasks for account: {account}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error initializing tasks for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/start-refresh/{account}")
async def start_task_refresh(account: str):
    """
    Start an ongoing background polling loop which
    periodically fetches new tasks/messages for this account.
    """
    try:
        await task_storage.start_refresh_loop(account)
        logger.info(f"Started refresh loop for account: {account}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error starting refresh for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tasks/stop-refresh/{account}")
async def stop_task_refresh(account: str):
    """
    Stop the background refresh loop for this account.
    Leave previously fetched data intact in memory.
    """
    try:
        task_storage.stop_refresh_loop(account)
        logger.info(f"Stopped refresh loop for account: {account}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error stopping refresh for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{account}")
async def get_tasks(account: str, status: Optional[TaskStatusAPI] = None):
    """
    Get all tasks for an account, optionally filtered by status.
    """
    logger.info(f"Received tasks request for account: {account}, status filter: {status}")
    try:
        # First ensure tasks are initialized
        if not task_storage._state.node_account:
            logger.info(f"Account {account} not initialized, initializing now...")
            await task_storage.initialize_user_tasks(account)
        
        # Convert API enum to internal enum if status is provided
        internal_status = TaskStatus[status.name] if status else None
        
        if status:
            logger.info(f"Fetching tasks with status {status}")
            tasks = await task_storage.get_tasks_by_state(account, internal_status)
            return tasks
        else:
            logger.info("Fetching all tasks grouped by section")
            sections = await task_storage.get_tasks_by_ui_section(account)
            logger.info(f"Found tasks in sections: {[k for k,v in sections.items() if v]}")
            return sections
            
    except Exception as e:
        logger.error(f"Error getting tasks for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/statuses")
async def get_task_statuses():
    """
    Return all available task statuses used by the system.
    """
    return {
        "statuses": [
            {
                "name": status.name,
                "value": status.value,
                "description": status.__doc__ if status.__doc__ else ""
            } for status in TaskStatusAPI
        ]
    }

@router.get("/account/{account}/summary")
async def get_account_summary(account: str):
    """
    Get a summary of account information including XRP and PFT balances.
    """
    try:
        # Since blockchain.get_account_summary is already async, we just await it
        summary = await blockchain.get_account_summary(account)
        return summary
    except Exception as e:
        logger.error(f"Error getting account summary for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount the router under /api
logger.info("Registering API routes...")
app.include_router(router, prefix="/api")
logger.info("API routes registered")

@app.on_event("startup")
async def startup_event():
    """
    On startup, log the routes for debugging.
    """
    routes = [{"path": route.path, "name": route.name, "methods": list(route.methods)} 
              for route in app.routes]
    logger.info(f"Registered routes: {routes}")

@app.options("/{full_path:path}")
async def options_handler():
    """
    Handle OPTIONS requests for all routes (CORS preflight).
    """
    return {"detail": "OK"}

