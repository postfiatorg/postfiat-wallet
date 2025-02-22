from fastapi import APIRouter, HTTPException, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel
from postfiat_wallet.services.blockchain import BlockchainService
from postfiat_wallet.services import storage
import logging
from postfiat_wallet.services.task_storage import TaskStorage
from enum import Enum
from postfiat.nodes.task.state import TaskStatus
from typing import Optional, Dict, Any
from postfiat_wallet.services.transaction import TransactionBuilder
from postfiat.nodes.task.constants import REMEMBRANCER_ADDRESS
from xrpl.models.transactions import TrustSet

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

# Add this near other service instantiations
transaction_builder = TransactionBuilder()

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

class UserTransactionRequest(BaseModel):
    """Request model for user-to-node transactions"""
    account: str
    tx_type: str  # 'initiation_rite', 'task_request', 'task_refusal', etc.
    password: str  # User's wallet password for decrypting the seed
    data: Dict[str, Any]  # Transaction-specific data (varies by tx_type)

class PaymentRequest(BaseModel):
    """Request model for payment transactions"""
    from_account: str
    to_address: str
    amount: str
    currency: str  # 'XRP' or 'PFT'
    password: str  # User's wallet password
    memo_id: Optional[str] = None
    memo: Optional[str] = None

class FullSequenceRequest(BaseModel):
    """
    Request data for performing a full initialization sequence:
    1) Set PFT trustline
    2) Submit initiation rite
    3) Handshake transaction to the node
    4) Handshake transaction to the remembrancer
    5) Send a google doc transaction
    """
    account: str
    password: str
    username: str
    initiation_rite: str
    ecdh_public_key: str
    google_doc_link: str
    use_pft_for_doc: bool = False

class ECDHRequest(BaseModel):
    account: str
    password: str

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

@router.post("/tasks/clear-state/{account}")
async def clear_task_state(account: str):
    """Clear all task state for an account when they log out."""
    try:
        task_storage.clear_user_state(account)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing state for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/send")
async def send_user_transaction(request: UserTransactionRequest):
    logger.info(f"Received transaction request: {request.tx_type} from {request.account}")
    logger.debug(f"Request data (excluding password): {request.data}")
    
    try:
        # Get wallet info and decrypt the seed
        logger.debug(f"Getting wallet info for account: {request.account}")
        wallet_info = storage.get_wallet(request.account)
        
        try:
            logger.debug("Attempting to decrypt private key")
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {request.account}: {str(e)}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )

        logger.info("Building unsigned transaction")
        unsigned_tx = transaction_builder.build_transaction(
            account=request.account,
            tx_type=request.tx_type,
            data=request.data
        )
        
        logger.info("Signing and sending transaction")
        result = await blockchain.sign_and_send_transaction(
            unsigned_tx=unsigned_tx,
            seed=seed
        )
        
        logger.info("Transaction sent successfully")
        return {
            "status": "success",
            "transaction": result
        }
        
    except ValueError as e:
        logger.error(f"Invalid transaction request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing transaction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payments/{account}")
async def get_user_payments_endpoint(account: str):
    """
    Fetch all XRP/PFT Payment transactions for an account,
    excluding those to/from the node address.
    """
    logger.info(f"Received user payments request for account: {account}")
    try:
        payments = await task_storage.get_user_payments(account)
        return {"payments": payments}
    except Exception as e:
        logger.error(f"Error getting user payments for {account}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/payment")
async def send_payment(request: PaymentRequest):
    """Send a payment transaction (XRP or PFT)"""
    logger.info(f"Received payment request from {request.from_account} to {request.to_address}")
    
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(request.from_account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )

        # Build the payment transaction
        unsigned_tx = transaction_builder.build_payment_transaction(
            account=request.from_account,
            destination=request.to_address,
            amount=request.amount,
            currency=request.currency,
            memo_text=request.memo,
            memo_id=request.memo_id
        )
        
        # Sign and send the transaction
        result = await blockchain.sign_and_send_transaction(
            unsigned_tx=unsigned_tx,
            seed=seed
        )
        
        return {
            "status": "success",
            "transaction": result
        }
        
    except ValueError as e:
        logger.error(f"Invalid payment request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing payment: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/account/{account}/status")
async def get_account_status(account: str):
    """
    Get account status information including initiation rite status,
    context document link, and blacklist status.
    """
    logger.info(f"Received account status request for: {account}")
    try:
        status = await task_storage.get_account_status(account)
        return status
    except Exception as e:
        logger.error(f"Error getting account status for {account}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/initiation/full-sequence")
async def perform_full_initiation_sequence(req: FullSequenceRequest):
    """
    Perform a multi-step on-chain initialization sequence:
    1) Create a trustline for PFT.
    2) Submit an initiation rite transaction (1 drop of XRP).
    3) Create a handshake transaction with the node.
    4) Create a handshake transaction with the remembrancer.
    5) Create a google doc transaction (either 1 drop of XRP or 1 PFT).
    """
    try:
        # Decrypt the user's secret key from local storage
        logger.info(f"Fetching wallet info for account: {req.account}")
        wallet_info = storage.get_wallet(req.account)
        seed = storage.decrypt_private_key(wallet_info["encrypted_key"], req.password)

        # 1) Build and send the PFT trustline transaction
        logger.info("Building trust line transaction...")
        trust_line_dict = transaction_builder.build_trust_line_transaction(req.account)
        trust_line_tx = TrustSet.from_dict(trust_line_dict)
        logger.info("Signing and sending trust line transaction...")
        trust_line_result = await blockchain.sign_and_send_trust_set(trust_line_tx, seed)

        # 2) Build and send the initiation rite transaction
        logger.info("Building initiation rite transaction...")
        init_rite_tx = transaction_builder.build_initiation_rite_transaction(
            account=req.account,
            initiation_rite=req.initiation_rite,
            username=req.username
        )
        logger.info("Signing and sending initiation rite transaction...")
        init_rite_result = await blockchain.sign_and_send_transaction(init_rite_tx, seed)

        # 3) Build and send the handshake transaction to the node
        logger.info("Building handshake to node transaction...")
        handshake_node_tx = transaction_builder.build_handshake_transaction(
            account=req.account,
            destination=transaction_builder.node_address,
            ecdh_public_key=req.ecdh_public_key
        )
        logger.info("Signing and sending handshake to node transaction...")
        handshake_node_result = await blockchain.sign_and_send_transaction(handshake_node_tx, seed)

        # 4) Build and send the handshake transaction to the remembrancer
        logger.info("Building handshake to remembrancer transaction...")
        handshake_remembrancer_tx = transaction_builder.build_handshake_transaction(
            account=req.account,
            destination=REMEMBRANCER_ADDRESS,
            ecdh_public_key=req.ecdh_public_key
        )
        logger.info("Signing and sending handshake to remembrancer transaction...")
        handshake_remembrancer_result = await blockchain.sign_and_send_transaction(handshake_remembrancer_tx, seed)

        # 5) Build and send the google doc transaction
        logger.info("Building google doc transaction...")
        google_doc_tx = transaction_builder.build_google_doc_transaction(
            account=req.account,
            encrypted_data=req.google_doc_link,
            username=req.username,
            use_pft=req.use_pft_for_doc
        )
        logger.info("Signing and sending google doc transaction...")
        google_doc_result = await blockchain.sign_and_send_transaction(google_doc_tx, seed)

        # Return the results of all the transactions
        return {
            "trust_line_result": trust_line_result,
            "initiation_rite_result": init_rite_result,
            "handshake_to_node_result": handshake_node_result,
            "handshake_to_remembrancer_result": handshake_remembrancer_result,
            "google_doc_result": google_doc_result
        }

    except ValueError as e:
        logger.error(f"Invalid request in full initiation sequence: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error performing full initiation sequence: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wallet/ecdhkey")
async def get_ecdh_key(req: ECDHRequest):
    """
    Retrieve an Ed25519-based ECDH public key from the user's wallet seed.
    """
    try:
        logger.info(f"Retrieving ECDH public key for account: {req.account}")

        # 1) Load and decrypt the wallet's seed from storage
        wallet_info = storage.get_wallet(req.account)
        seed = storage.decrypt_private_key(wallet_info["encrypted_key"], req.password)

        # 2) Call the blockchain method to derive the ECDH public key
        ecdh_pub_key = blockchain.get_ecdh_public_key_from_seed(seed)

        logger.info(f"Successfully retrieved ECDH public key for {req.account}")
        return {"ecdh_public_key": ecdh_pub_key}
    except ValueError as e:
        logger.error(f"Error deriving ECDH key for {req.account}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError:
        logger.error(f"Wallet not found for account: {req.account}")
        raise HTTPException(status_code=404, detail="Wallet not found")
    except Exception as e:
        logger.error(f"Unexpected error getting ECDH key for {req.account}: {str(e)}", exc_info=True)
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

