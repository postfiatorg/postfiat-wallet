# Post Fiat Wallet

## Overview
The Post Fiat Wallet is a local wallet application for interacting with the Post Fiat Network. It combines a Python-based backend service with a pre-built Next.js frontend, providing a secure way to manage your Post Fiat assets while keeping sensitive operations local to your machine.

The architecture consists of:
- A FastAPI backend that handles cryptographic operations, wallet management, and blockchain interactions
- A static Next.js web application that provides an intuitive user interface
- Local storage of encrypted wallet data for enhanced security

When you run the wallet, the Python backend serves both the API endpoints and the pre-built web interface, allowing you to interact with the Post Fiat Network through your web browser while ensuring your private keys never leave your machine.

## Requirements
- Python 3.12 or higher
- pip (Python package installer)

## Installation
### From Source

1. Ensure you have Python 3.12 or higher installed:
   ```bash
   python --version
   ```

2. Clone the repository:
   ```bash
   git clone https://github.com/postfiat/postfiat-wallet.git
   cd postfiat-wallet
   ```

3. Install the packages:
   ```bash
   pip install -e .
   ```

Start the wallet application with:
   ```bash
   postfiat-wallet start
   ```

The wallet will start a local server that you can access through your web browser.

### Dependencies

The wallet depends on several Python packages including:
- fastapi
- uvicorn
- boto3
- dynaconf
- websockets
- click
- xrpl-py
- cryptography
- requests
- packaging
- postfiat-sdk

These will be automatically installed when you install the wallet package.