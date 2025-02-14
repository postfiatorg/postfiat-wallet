from fastapi import APIRouter, HTTPException, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pydantic import BaseModel
from pft_wallet.services.blockchain import BlockchainService
from pft_wallet.services import storage
import logging

app = FastAPI()

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

class WalletAuth(BaseModel):
    username: str
    password: str
    private_key: str = None  # Only needed for signup
    address: str = None      # Only needed for signup

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
    try:
        # Find wallet by username
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
            
        # Decrypt private key with password
        private_key = storage.decrypt_private_key(wallet_data["encrypted_key"], auth.password)
        
        # Verify the private key is valid
        wallet_info = blockchain.create_wallet_from_secret(private_key)
        
        return {
            "status": "success", 
            "address": wallet_address,
            "username": auth.username
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/auth/create")
async def create_account(auth: WalletAuth):
    if not auth.private_key:
        raise HTTPException(status_code=400, detail="Private key required for account creation")
        
    try:
        wallet_info = blockchain.create_wallet_from_secret(auth.private_key)
        address = wallet_info["address"]
        
        # Add the wallet to storage
        storage.add_wallet(address, auth.private_key, auth.username, auth.password)
        
        return {
            "status": "success",
            "address": address
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.api_route("/wallet/generate", methods=["POST", "OPTIONS"])
async def generate_wallet(request: Request):
    logging.debug(f"Received {request.method} request for /wallet/generate")
    if request.method == "OPTIONS":
        logging.debug("Handling preflight OPTIONS request")
        # Return an empty response for the preflight request.
        return {}
    wallet_info = blockchain.generate_wallet()
    logging.debug(f"Generated wallet: {wallet_info}")
    return wallet_info

# Mount the router to the app with generate_unique_id_function
app.include_router(router, prefix="/api")

# Add OPTIONS handler for all routes
@app.options("/{full_path:path}")
async def options_handler():
    return {"detail": "OK"}
