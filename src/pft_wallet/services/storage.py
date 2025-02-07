import sqlite3
from pathlib import Path
from pft_wallet.config import settings

DB_PATH = Path(settings.paths.data_dir) / "wallet.db"

def get_connection():
    """
    Create and return a connection to the SQLite database.
    The connection uses sqlite3.Row 
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
      - wallet: to store private key data and wallet addresses
      - transactions: to store transaction history
      - cache:  for caching local data
    """
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS wallet (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL UNIQUE,
            private_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )

    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_id INTEGER NOT NULL,
            tx_hash TEXT NOT NULL,
            amount REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(wallet_id) REFERENCES wallet(id)
        )
        '''
    )

    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print(f"SQLite database successfully initialized at {DB_PATH}")
