# Post Fiat Wallet

## Overview
The Post Fiat Wallet is a local wallet application for interacting with the Post Fiat Network.

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
- postfiat-sdk

These will be automatically installed when you install the wallet package.