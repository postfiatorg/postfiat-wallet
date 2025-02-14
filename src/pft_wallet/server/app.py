import os
import pkg_resources
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pft_wallet.server.api import router as api_router  # Adjust the import if your API router is defined elsewhere

def create_app():
    app = FastAPI(title="PFT Wallet API")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In production, restrict this to your frontend domains
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(api_router, prefix="/api")
    
    # Only serve static files when not in development mode
    if not os.getenv("PFT_DEV"):
        static_dir = pkg_resources.resource_filename("pft_wallet", "static")
        if os.path.exists(static_dir):
            app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
        else:
            print(f"Static directory '{static_dir}' not found. UI will not be available.")
    
    
    return app
