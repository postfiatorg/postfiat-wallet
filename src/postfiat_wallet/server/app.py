import os
from importlib import resources
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from postfiat_wallet.server.api import router as api_router  # Adjust the import if your API router is defined elsewhere
from postfiat_wallet.services.storage import init_storage

def create_app():
    app = FastAPI(title="Post Fiat Wallet API")
    
    # Configure CORS for development
    origins = [
        "http://localhost:8000",  # Development server
        "http://127.0.0.1:8000",
    ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if os.getenv("POSTFIAT_DEV") else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(api_router, prefix="/api")
    
    # Only serve static files when not in development mode
    if not os.getenv("POSTFIAT_DEV"):
        static_dir = resources.files('postfiat_wallet').joinpath('static')
        if static_dir.exists():
            app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
        else:
            print(f"Static directory '{static_dir}' not found. UI will not be available.")

    init_storage()
    
    return app
