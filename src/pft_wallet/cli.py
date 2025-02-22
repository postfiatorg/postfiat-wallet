#!/usr/bin/env python3
import sys
import click
import uvicorn
import requests
import pkg_resources
from packaging import version
from pathlib import Path
import logging
from .server.app import create_app
from .utils.browser import launch_browser
from .utils.updater import UIUpdater
from .config import settings
import os

logger = logging.getLogger(__name__)

def check_package_updates():
    """Check PyPI for newer package versions"""
    try:
        current = pkg_resources.get_distribution('postfiat-wallet').version
        pypi_response = requests.get('https://pypi.org/pypi/postfiat-wallet/json', timeout=2)
        latest = version.parse(pypi_response.json()['info']['version'])
        
        if version.parse(current) < latest:
            click.echo(f"New version {latest} available. Run 'pip install --upgrade postfiat-wallet' to update.")
            return True
    except Exception as e:
        logger.debug(f"Failed to check for package updates: {e}")
    return False

def ensure_data_dir():
    """Ensure data directory exists"""
    data_dir = Path(settings.PATHS["data_dir"])
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir

@click.group()
@click.option('--debug/--no-debug', default=False, help='Enable debug logging')
def cli(debug):
    """PFT Wallet - Local wallet interface"""
    log_level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(level=log_level)

@cli.command()
@click.option('--port', default=None, help='Port to run server on')
@click.option('--no-browser', is_flag=True, help='Don\'t open browser window')
@click.option('--no-updates', is_flag=True, help='Skip update checks')
@click.option('--dev', is_flag=True, help='Run in development mode')
def start(port, no_browser, no_updates, dev):
    """Start the PFT Wallet interface"""
    if dev:
        os.environ["POSTFIAT_DEV"] = "1"
        click.echo("Running in development mode")
        click.echo("Start the Next.js dev server with: cd src/pft_wallet/ui && npm run dev")
        
    # Use configured port if none specified
    if port is None:
        port = settings.SERVER["port"]

    # Create and configure FastAPI app
    app = create_app()

    # Launch browser unless disabled
    if not no_browser and not dev:
        launch_browser(f"http://localhost:{port}")
    
    # Start server
    click.echo(f"Starting server on port {port}")
    uvicorn.run(app, host="localhost", port=port)

@cli.command()
def update():
    """Force update check for UI and package"""
    click.echo("Checking for updates...")
    
    # Check package updates
    package_updated = check_package_updates()
    
    # Check UI updates
    ui_updater = UIUpdater()
    if ui_updater.check_for_updates():
        click.echo("Downloading UI updates...")
        if ui_updater.download_update():
            click.echo("UI updated successfully")
        else:
            click.echo("Failed to update UI")
    else:
        click.echo("UI is up to date")

@cli.command()
@click.option('--force', is_flag=True, help='Force reset without confirmation')
def reset(force):
    """Reset wallet data directory"""
    if not force:
        if not click.confirm('This will delete all local wallet data. Continue?'):
            return
    
    data_dir = Path(settings.PATHS["data_dir"])
    if data_dir.exists():
        import shutil
        shutil.rmtree(data_dir)
        click.echo("Data directory cleared")
    else:
        click.echo("No data directory found")

def main():
    """Entry point for pip installation"""
    cli()

if __name__ == '__main__':
    main()