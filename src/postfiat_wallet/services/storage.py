import json
import datetime
from pathlib import Path
from typing import Iterator, List, Dict, Any
from postfiat_wallet.config import settings
from cryptography.fernet import Fernet
from base64 import b64encode, b64decode
import hashlib

# Define the base directory and file paths
DATA_DIR = Path(settings.PATHS["data_dir"])
TX_CACHE_DIR = DATA_DIR / "tx_cache"
WALLETS_FILE = DATA_DIR / "wallets.json"
STATE_FILE = DATA_DIR / "state.json"

def init_storage():
    """
    Initialize file storage by ensuring the data directories and base files exist.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TX_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Create an empty wallets file if it doesn't exist
    if not WALLETS_FILE.exists():
        with open(WALLETS_FILE, "w") as f:
            json.dump({}, f, indent=2)

    # Create an empty state file if it doesn't exist
    if not STATE_FILE.exists():
        with open(STATE_FILE, "w") as f:
            json.dump({}, f, indent=2)

# === Wallets management ===

def load_wallets() -> Dict[str, Any]:
    """
    Load wallet data from the wallets JSON file.
    Returns a dict mapping wallet addresses to wallet info.
    """
    try:
        with open(WALLETS_FILE, "r") as f:
            wallets = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        wallets = {}
    return wallets

def save_wallets(wallets: Dict[str, Any]) -> None:
    """
    Save wallet data to the wallets JSON file.
    """
    with open(WALLETS_FILE, "w") as f:
        json.dump(wallets, f, indent=2)

def generate_key_from_password(password: str) -> bytes:
    """Generate encryption key from password"""
    salt = b'postfiat'  # In production, use a proper salt
    return b64encode(hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode(), 
        salt, 
        100000  # Number of iterations
    ))

def encrypt_private_key(private_key: str, password: str) -> str:
    """Encrypt private key using password"""
    key = generate_key_from_password(password)
    f = Fernet(key)
    return f.encrypt(private_key.encode()).decode()

def decrypt_private_key(encrypted_key: str, password: str) -> str:
    """Decrypt private key using password"""
    try:
        key = generate_key_from_password(password)
        f = Fernet(key)
        return f.decrypt(encrypted_key.encode()).decode()
    except Exception:
        raise ValueError("Invalid password")

def add_wallet(address: str, private_key: str, username: str, password: str) -> None:
    """
    Add a new wallet to storage.
    Raises ValueError if the wallet already exists.
    """
    wallets = load_wallets()
    if address in wallets:
        raise ValueError(f"Wallet with address {address} already exists.")
    
    # Check if username is already taken
    for wallet in wallets.values():
        if wallet.get('username') == username:
            raise ValueError(f"Username {username} is already taken.")
    
    encrypted_key = encrypt_private_key(private_key, password)
    wallets[address] = {
        "encrypted_key": encrypted_key,
        "username": username,
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    save_wallets(wallets)

def get_wallet(address: str) -> Dict[str, Any]:
    """
    Retrieve wallet information for a given address.
    Raises ValueError if the wallet is not found.
    """
    wallets = load_wallets()
    if address not in wallets:
        raise ValueError(f"Wallet with address {address} not found.")
    return wallets[address]

# === Application state (replacing a general cache) ===

def load_state() -> Dict[str, Any]:
    """
    Load the application state from its JSON file.
    """
    try:
        with open(STATE_FILE, "r") as f:
            state = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        state = {}
    return state

def save_state(state: Dict[str, Any]) -> None:
    """
    Save the application state to its JSON file.
    """
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

# === Transactions caching and retrieval ===

def load_tx_cache(wallet_address: str) -> List[Dict[str, Any]]:
    """
    Load cached transactions for a given wallet.
    Returns a list of transaction dictionaries.
    """
    file_path = TX_CACHE_DIR / f"{wallet_address}.json"
    if file_path.exists():
        try:
            with open(file_path, "r") as f:
                transactions = json.load(f)
            return transactions
        except json.JSONDecodeError:
            return []
    return []

def save_tx_cache(wallet_address: str, transactions: List[Dict[str, Any]]) -> None:
    """
    Save the transaction list to a cache file for a given wallet.
    """
    file_path = TX_CACHE_DIR / f"{wallet_address}.json"
    with open(file_path, "w") as f:
        json.dump(transactions, f, indent=2)

if __name__ == "__main__":
    init_storage()
    print(f"File storage initialized at: {DATA_DIR}")
