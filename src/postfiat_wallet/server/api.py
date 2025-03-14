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
from xrpl.models.transactions import TrustSet
import json
from postfiat_wallet.services.odv_service import ODVService
from xrpl.wallet import Wallet
import uuid
from postfiat.nodes.task.codecs.v0.serialization.cipher import decrypt_memo, encrypt_memo
from postfiat.nodes.task.codecs.v0.remembrancer.encode import encode_account_msg
from postfiat.nodes.task.models.messages import UserLogMessage, Direction
from decimal import Decimal
import random
import string
import datetime

# Import SDK constants and models
from postfiat.nodes.task.constants import REMEMBRANCER_ADDRESS

REMEMBRANCER_PUBKEY = "ED5C677D5039D7412E2B978268F55C77937F9088C29028BEBFD0BCEA574DD7FF90"
REMEMBRANCER_ADDRESS = "rJ1mBMhEBKack5uTQvM8vWoAntbufyG9Yn"

TASK_NODE_PUBKEY = "ED81962C730DDDA7AD72936142ABCCE0F2E3F7C562D6F38D8C50B74CB4EA0BE0A9"
TASK_NODE_ADDRESS = "r4yc85M1hwsegVGZ1pawpZPwj65SVs8PzD"

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

# Create ODVService instance (will be initialized per user when needed)
odv_services = {}  # Map of user address -> ODVService instance

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

class PFLogRequest(BaseModel):
    """
    Request model for sending an encrypted/compressed/chunked PF log
    """
    account: str
    password: str
    log_message: str
    log_id: str
    username: str
    remote_ed_pubkey: str
    use_pft: bool = True

class SeedRequest(BaseModel):
    account: str
    password: str

class ODVMessageRequest(BaseModel):
    """Request model for sending messages to ODV node"""
    account: str
    password: str
    message: str
    message_id: Optional[str] = None
    amount_pft: int = 0

class LoggingRequest(BaseModel):
    """Request model for sending logging entries to the Remembrancer node"""
    account: str
    password: str
    log_content: str
    log_id: Optional[str] = None
    amount_pft: int = 0

# Request model for decrypting ODV messages
class DecryptMessagesRequest(BaseModel):
    password: str
    refresh: bool = False  # Add this field to control whether to force refresh from blockchain

class DecryptDocLinkRequest(BaseModel):
    account: str
    password: str
    encrypted_link: str

class HandshakeRequest(BaseModel):
    """Request model for sending handshake transactions"""
    account: str
    password: str
    ecdh_public_key: str

# Add this function outside of any endpoint
def generate_custom_id():
    """
    Generate a custom ID (task_id) for PostFiat usage.
    Example format: 'YYYY-MM-DD_HH:MM__AB12'
    """
    letters = ''.join(random.choices(string.ascii_uppercase, k=2))
    numbers = ''.join(random.choices(string.digits, k=2))
    second_part = letters + numbers
    date_string = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    output = date_string + '__' + second_part
    output = output.replace(' ', "_")
    return output

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/balance/{account}")
async def get_balance(account: str):
    try:
        xrp_balance = await blockchain.get_xrp_balance(account)
        pft_balance = await blockchain.get_pft_balance(account)
        return {
            "xrp": str(xrp_balance),  # Convert to string for consistent API response
            "pft": str(pft_balance),
            "status": "unactivated" if xrp_balance == 0 else "active"
        }
    except Exception as e:
        logger.error(f"Error getting balance for {account}: {str(e)}")
        # Return zeros instead of throwing an error for unactivated accounts
        return {
            "xrp": "0",
            "pft": "0",
            "status": "unactivated"
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
async def start_refresh(account: str):
    """
    Start the background refresh loop for this account.
    This will automatically update tasks in memory as new messages arrive.
    """
    try:
        await task_storage.start_refresh_loop(account)
        logger.debug(f"Started refresh loop for account: {account}")
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
        logger.debug(f"Stopped refresh loop for account: {account}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error stopping refresh for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks/{account}")
async def get_tasks(account: str, status: Optional[TaskStatusAPI] = None):
    """
    Get all tasks for an account, optionally filtered by status.
    """
    logger.debug(f"Received tasks request for account: {account}, status filter: {status}")
    try:
        # First ensure tasks are initialized
        if not task_storage._state.node_account:
            logger.debug(f"Account {account} not initialized, initializing now...")
            await task_storage.initialize_user_tasks(account)
        
        # Convert API enum to internal enum if status is provided
        internal_status = TaskStatus[status.name] if status else None
        
        if status:
            tasks = await task_storage.get_tasks_by_state(account, internal_status)
            
            # Log task structure for the first task to help debug
            if tasks and len(tasks) > 0:
                logger.debug(f"Task keys available: {list(tasks[0].keys())}")
                sample = {k: "..." for k in tasks[0].keys()}
                if 'message_history' in tasks[0] and tasks[0]['message_history']:
                    sample['message_history'] = [tasks[0]['message_history'][0]]
                    if 'timestamp' in tasks[0]['message_history'][0]:
                        logger.debug("Message history items now include timestamp field")
                logger.debug(f"Sample task structure: {json.dumps(sample, default=str)}")
            
            return tasks
        else:
            sections = await task_storage.get_tasks_by_ui_section(account)
            
            # Log a sample task from each section if available
            for section, section_tasks in sections.items():
                if section_tasks and len(section_tasks) > 0:
                    logger.debug(f"Section '{section}' has {len(section_tasks)} tasks")
                    if section == 'requested' or section == 'completed':  # Just log a couple sections
                        sample = {k: "..." for k in section_tasks[0].keys()}
                        logger.debug(f"Sample task from '{section}' section: {json.dumps(sample, default=str)}")
            
            return sections
            
    except Exception as e:
        logger.error(f"Error getting tasks for {account}: {str(e)}", exc_info=True)
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
        summary = await blockchain.get_account_summary(account)
        return summary
    except Exception as e:
        logger.error(f"Error getting account summary for {account}: {str(e)}")
        # Return a default summary for unactivated accounts
        return {
            "xrp_balance": "0",
            "pft_balance": "0",
            "account_status": "unactivated"
        }

@router.post("/tasks/clear-state/{account}")
async def clear_user_state(account: str):
    """
    Clear all state related to a specific wallet address when they log out.
    """
    try:
        logger.debug(f"Clearing state for account: {account}")
        task_storage.clear_user_state(account)
        return {"status": "success", "message": f"State cleared for {account}"}
    except Exception as e:
        logger.error(f"Error clearing state for {account}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/send")
async def send_user_transaction(request: UserTransactionRequest):
    logger.debug(f"Received transaction request: {request.tx_type} from {request.account}")
    
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(request.account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {request.account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )

        unsigned_tx = transaction_builder.build_transaction(
            account=request.account,
            tx_type=request.tx_type,
            data=request.data
        )
        
        result = await blockchain.sign_and_send_transaction(
            unsigned_tx=unsigned_tx,
            seed=seed
        )
        
        logger.debug("Transaction sent successfully")
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
    logger.debug(f"Received user payments request for account: {account}")
    try:
        payments = await task_storage.get_user_payments(account)
        return {"payments": payments}
    except Exception as e:
        logger.error(f"Error getting user payments for {account}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/payment")
async def send_payment(request: PaymentRequest):
    """Send a payment transaction (XRP or PFT)"""
    logger.debug(f"Received payment request from {request.from_account} to {request.to_address}")
    
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
async def get_account_status(account: str, refresh: bool = True):
    """
    Get account status information including initiation rite status,
    context document link, and blacklist status.
    
    Parameters:
    - account: The account address to check
    - refresh: Whether to refresh transaction data before checking status (default: True)
    """
    logger.debug(f"Received account status request for: {account}")
    try:
        # Force refresh of transaction data if requested
        if refresh:
            logger.debug(f"Refreshing transaction data for account: {account}")
            # Initialize user tasks which will fetch latest transactions
            await task_storage.initialize_user_tasks(account)
            
        # Now get the status with fresh data
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

        # 5) Encrypt the Google Doc link and then build and send the transaction
        logger.info("Encrypting and building google doc transaction...")
        # Create user wallet from seed for encryption
        user_wallet = blockchain.create_wallet_from_seed(seed)
        
        # Encrypt the Google Doc link using the node's public key
        encrypted_link = encrypt_memo(
            req.google_doc_link,
            TASK_NODE_PUBKEY,  # Public key of the Task Node
            user_wallet.private_key  # Private key of the user
        )
        
        google_doc_tx = transaction_builder.build_google_doc_transaction(
            account=req.account,
            encrypted_data=encrypted_link,  # Now actually encrypted
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

@router.post("/transaction/pf_log")
async def send_pf_log_chunked(req: PFLogRequest):
    """
    Send a PF log that is encrypted, compressed, and chunked (if necessary),
    using the build_pf_log_chunked_transactions method in transaction.py.
    Then each chunked transaction is signed and submitted via blockchain.py.
    """
    try:
        # 1) Retrieve and decrypt the user's seed
        wallet_info = storage.get_wallet(req.account)
        seed = storage.decrypt_private_key(wallet_info["encrypted_key"], req.password)

        # 2) Build all chunked transaction dictionaries
        tx_dicts = transaction_builder.build_pf_log_chunked_transactions(
            account=req.account,
            log_message=req.log_message,
            log_id=req.log_id,
            username=req.username,
            remembrancer_address=REMEMBRANCER_ADDRESS,
            local_seed=seed,
            remote_ed_pubkey=req.remote_ed_pubkey,
            use_pft=req.use_pft
        )

        # 3) Sign & send each transaction
        results = []
        for unsigned_tx in tx_dicts:
            result = await blockchain.sign_and_send_transaction(unsigned_tx, seed)
            results.append(result)

        return {
            "status": "success",
            "transactions_submitted": len(results),
            "results": results
        }

    except ValueError as e:
        logger.error(f"Invalid PF Log request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending PF Log transaction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wallet/seed")
async def get_wallet_seed(req: SeedRequest):
    """
    Retrieve the wallet seed using the account address and password.
    This is a sensitive operation and should be used with caution.
    """
    try:
        logger.info(f"Retrieving wallet seed for account: {req.account}")
        
        # Get wallet info from storage
        wallet_info = storage.get_wallet(req.account)
        
        # Decrypt the private key using the provided password
        try:
            seed = storage.decrypt_private_key(wallet_info["encrypted_key"], req.password)
            return {"seed": seed}
        except ValueError as e:
            logger.error(f"Failed to decrypt seed for {req.account}: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid password")
            
    except KeyError:
        logger.error(f"Wallet not found for account: {req.account}")
        raise HTTPException(status_code=404, detail="Wallet not found")
    except Exception as e:
        logger.error(f"Unexpected error retrieving seed for {req.account}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/odv/send_message")
async def send_odv_message(request: ODVMessageRequest):
    """
    Send a message to the ODV node using the SDK's encoding and encryption
    """
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(request.account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {request.account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )
            
        # Create user wallet from seed
        user_wallet = blockchain.create_wallet_from_seed(seed)
        logger.debug(f"Created wallet for {request.account}, address: {user_wallet.classic_address}")
        
        # Generate a custom message ID if not provided
        message_id = request.message_id or generate_custom_id()
        
        # Prepend "ODV " to message if it doesn't already start with it
        message_content = request.message
        if not message_content.startswith("ODV "):
            message_content = f"ODV {message_content}"
        
        logger.debug(f"Sending ODV message: {message_id}")
        
        # Convert amount to Decimal for SDK compatibility
        amount_pft = Decimal(str(request.amount_pft))
        
        # Create a UserLogMessage object for encoding
        user_message = UserLogMessage(
            message_id=message_id,
            message=message_content,
            user_wallet=user_wallet.classic_address,
            node_wallet=REMEMBRANCER_ADDRESS,
            amount_pft=amount_pft,
            direction=Direction.USER_TO_NODE
        )
        
        # Use the SDK function to encode the message into transactions
        encoded_txns = encode_account_msg(
            msg=user_message,
            node_account=REMEMBRANCER_PUBKEY,  # Node's public key
            user_account=user_wallet  # User's wallet object
        )
        
        # Use RpcSender to submit each transaction
        results = []
        for tx in encoded_txns:
            result = await blockchain.rpc_sender.submit_and_wait(tx, user_wallet)
            results.append(result.result)
            
        return {
            "status": "success",
            "message": f"Sent {len(results)} transactions",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error sending ODV message: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/odv/messages/{account}")
async def decrypt_odv_messages(account: str, request: DecryptMessagesRequest):
    """
    Get all messages between the user and ODV node, with decryption support
    """
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )
            
        # Create user wallet from seed
        user_wallet = blockchain.create_wallet_from_seed(seed)
        logger.debug(f"Created wallet for {account}, will use for message decryption")
        
        # Force refresh of blockchain data if requested in the request
        if hasattr(request, 'refresh') and request.refresh:
            await task_storage.initialize_user_tasks(account)
        
        # Get messages using task storage with decryption support by passing the wallet
        messages = await task_storage.get_user_node_messages(
            user_account=account, 
            node_account=REMEMBRANCER_ADDRESS,
            user_wallet=user_wallet
        )
        
        logger.debug(f"Retrieved {len(messages)} raw messages before deduplication")
        
        # Format the messages for the frontend
        formatted_messages = []
        seen_keys = set()  # Track message combinations we've already processed
        
        for msg in messages:
            # Determine direction based on message type
            is_from_user = msg.get("direction") == "USER_TO_NODE"
            
            # Create a more robust deduplication key that combines multiple fields
            msg_id = msg.get("message_id", "")
            content = msg.get("message", "")
            timestamp = msg.get("timestamp", 0)
            
            # Create a deduplication key that includes content, direction and approximate timestamp
            # Round timestamp to nearest minute to handle small differences in timestamps
            minute_timestamp = int(timestamp / 60) * 60 if timestamp else 0
            dedup_key = f"{content}|{is_from_user}|{minute_timestamp}"
            
            # Skip this message if we've already seen an identical one
            if dedup_key in seen_keys:
                logger.debug(f"Skipping duplicate message: {content[:30]}...")
                continue
                
            # Add key to seen set
            seen_keys.add(dedup_key)
            
            formatted_messages.append({
                "id": msg_id or f"msg_{len(formatted_messages)}",
                "from": account if is_from_user else REMEMBRANCER_ADDRESS,
                "to": REMEMBRANCER_ADDRESS if is_from_user else account,
                "content": content,
                "timestamp": timestamp,
                "amount_pft": msg.get("amount_pft", 0)
            })
        
        logger.debug(f"After deduplication: {len(formatted_messages)} messages")
        
        # Sort by timestamp
        formatted_messages.sort(key=lambda x: x["timestamp"])
        
        return {
            "status": "success",
            "messages": formatted_messages
        }
        
    except Exception as e:
        logger.error(f"Error getting ODV messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Apply the same improved deduplication logic to the GET endpoint
@router.get("/odv/messages/{account}")
async def get_odv_messages(account: str):
    """
    Get all messages between the user and ODV node (without decryption)
    """
    try:
        # Get messages from task storage - these are already decoded
        messages = await task_storage.get_user_node_messages(account, REMEMBRANCER_ADDRESS)
        
        logger.debug(f"Retrieved {len(messages)} raw messages before deduplication")
        
        # Format the messages for the frontend with improved deduplication
        formatted_messages = []
        seen_keys = set()  # Track message combinations we've already processed
        
        for msg in messages:
            # Determine direction based on message type
            is_from_user = msg.get("direction") == "USER_TO_NODE"
            
            # Create a more robust deduplication key that combines multiple fields
            content = msg.get("message", "")
            timestamp = msg.get("timestamp", 0)
            
            # Create a deduplication key that includes content, direction and approximate timestamp
            # Round timestamp to nearest minute to handle small differences in timestamps
            minute_timestamp = int(timestamp / 60) * 60 if timestamp else 0
            dedup_key = f"{content}|{is_from_user}|{minute_timestamp}"
            
            # Skip this message if we've already seen an identical one
            if dedup_key in seen_keys:
                logger.debug(f"Skipping duplicate message: {content[:30]}...")
                continue
                
            # Add key to seen set
            seen_keys.add(dedup_key)
            
            formatted_messages.append({
                "id": msg.get("message_id", "") or f"msg_{len(formatted_messages)}",
                "from": account if is_from_user else REMEMBRANCER_ADDRESS,
                "to": REMEMBRANCER_ADDRESS if is_from_user else account,
                "content": content,
                "timestamp": timestamp,
                "amount_pft": msg.get("amount_pft", 0)
            })
        
        logger.debug(f"After deduplication: {len(formatted_messages)} messages")
        
        # Sort by timestamp
        formatted_messages.sort(key=lambda x: x["timestamp"])
        
        return {
            "status": "success",
            "messages": formatted_messages
        }
        
    except Exception as e:
        logger.error(f"Error getting ODV messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/odv/send_log")
async def send_log_entry(request: LoggingRequest):
    """
    Send a logging entry to the Remembrancer node using the SDK's encoding and encryption.
    This is a one-way message that doesn't expect a response.
    """
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(request.account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {request.account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )
            
        # Create user wallet from seed
        user_wallet = blockchain.create_wallet_from_seed(seed)
        logger.debug(f"Created wallet for {request.account}, address: {user_wallet.classic_address}")
        
        # Create a log ID if not provided
        log_id = request.log_id or generate_custom_id()
        
        logger.debug(f"Sending log entry: {log_id}")
        
        # Convert amount to Decimal for SDK compatibility
        amount_pft = Decimal(str(request.amount_pft))
        
        # Use the blockchain service method to encode and send the log
        results = await blockchain.encode_and_send_user_message(
            user_wallet=user_wallet,
            message_id=log_id,
            message_content=request.log_content,
            node_address=REMEMBRANCER_ADDRESS,
            node_pubkey=REMEMBRANCER_PUBKEY,
            amount_pft=amount_pft
        )
        
        return {
            "status": "success",
            "message": f"Sent {len(results)} transactions",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error sending log entry: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/decrypt/doc_link")
async def decrypt_document_link(request: DecryptDocLinkRequest):
    """
    Decrypt a document link that starts with WHISPER__
    """
    try:
        encrypted_link = request.encrypted_link
        
        # Extract the WHISPER__ part if it's in the middle of a URL
        if 'WHISPER__' in encrypted_link and not encrypted_link.startswith('WHISPER__'):
            encrypted_link = encrypted_link[encrypted_link.index('WHISPER__'):]
        
        # Only attempt to decrypt if it has the WHISPER__ prefix
        if not encrypted_link.startswith('WHISPER__'):
            return {"status": "success", "link": request.encrypted_link}
            
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(request.account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                request.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {request.account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )
            
        # Create user wallet from seed
        user_wallet = blockchain.create_wallet_from_seed(seed)
        
        # Use the actual node pubkey for decryption
        node_pubkey = TASK_NODE_PUBKEY
        
        # Decrypt the link
        decrypted_link = decrypt_memo(
            encrypted_link, 
            node_pubkey,          # Public key of the TaskNode
            user_wallet.private_key    # Private key of the recipient (User)
        )
        
        return {
            "status": "success",
            "link": decrypted_link
        }
        
    except Exception as e:
        logger.error(f"Error decrypting document link: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/handshake_node")
async def send_handshake_to_node(req: HandshakeRequest):
    """
    Send a handshake transaction to the node.
    This establishes encrypted communication with the task node.
    """
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(req.account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                req.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {req.account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )

        # Derive ECDH public key from seed instead of using the one from request
        ecdh_pub_key = blockchain.get_ecdh_public_key_from_seed(seed)

        # Build the handshake transaction to the node
        handshake_tx = transaction_builder.build_handshake_transaction(
            account=req.account,
            destination=TASK_NODE_ADDRESS,
            ecdh_public_key=ecdh_pub_key
        )
        
        # Sign and send the transaction
        result = await blockchain.sign_and_send_transaction(handshake_tx, seed)
        
        return {
            "status": "success",
            "transaction": result
        }
        
    except ValueError as e:
        logger.error(f"Invalid handshake request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending handshake to node: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transaction/handshake_remembrancer")
async def send_handshake_to_remembrancer(req: HandshakeRequest):
    """
    Send a handshake transaction to the remembrancer.
    This establishes encrypted communication with the remembrancer node.
    """
    try:
        # Get wallet info and decrypt the seed
        wallet_info = storage.get_wallet(req.account)
        
        try:
            seed = storage.decrypt_private_key(
                wallet_info["encrypted_key"], 
                req.password
            )
        except ValueError as e:
            logger.error(f"Failed to decrypt key for account {req.account}")
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid password: {str(e)}"
            )

        # Derive ECDH public key from seed instead of using the one from request
        ecdh_pub_key = blockchain.get_ecdh_public_key_from_seed(seed)

        # Build the handshake transaction to the remembrancer
        handshake_tx = transaction_builder.build_handshake_transaction(
            account=req.account,
            destination=REMEMBRANCER_ADDRESS,
            ecdh_public_key=ecdh_pub_key
        )
        
        # Sign and send the transaction
        result = await blockchain.sign_and_send_transaction(handshake_tx, seed)
        
        return {
            "status": "success",
            "transaction": result
        }
        
    except ValueError as e:
        logger.error(f"Invalid handshake request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending handshake to remembrancer: {str(e)}", exc_info=True)
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

@router.post("/debug/reset")
async def reset_server_state():
    """
    Reset all server state - clears all accounts, tasks, and caches.
    This is primarily for development to ensure a clean slate.
    """
    try:
        logger.info("FULL SERVER STATE RESET REQUESTED")
        
        # 1. Cancel all background refresh tasks
        for address, task in list(task_storage._refresh_tasks.items()):
            if not task.done():
                logger.info(f"Cancelling refresh task for {address}")
                task.cancel()
                try:
                    # Wait for task to properly terminate
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    pass  # Expected when cancelling
        
        # 2. Clear all data structures
        logger.info("Clearing all server-side state")
        task_storage._clients = {}
        task_storage._user_states = {}
        task_storage._refresh_tasks = {}
        task_storage._last_processed_ledger = {}
        task_storage._task_update_timestamps = {}
        
        # 3. Clear caches
        if hasattr(task_storage, "_cache"):
            task_storage._cache = {}
        if hasattr(task_storage, "_cache_expiry"):
            task_storage._cache_expiry = {}
            
        # 4. Clear ODV services
        global odv_services
        odv_services = {}
        
        logger.info("Server state reset complete")
        return {"status": "success", "message": "Complete server state reset successful"}
    except Exception as e:
        logger.error(f"Error during server reset: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Mount the router under /api
logger.info("Registering API routes...")
app.include_router(router, prefix="/api")
logger.info("API routes registered")