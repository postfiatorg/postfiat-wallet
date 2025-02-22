# src/postfiat_wallet/utils/updater.py
import boto3
import json
from pathlib import Path
from importlib import resources
from ..config import settings

class UIUpdater:
    def __init__(self):
        self.s3 = boto3.client('s3')
        self.static_dir = Path(resources.files('postfiat_wallet').joinpath('static'))
        self.temp_dir = Path(settings.PATHS["cache_dir"]) / 'ui_updates'
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def check_for_updates(self):
        """Check S3 for newer UI version"""
        try:
            # Get current version from packaged manifest
            current_manifest = self.static_dir / 'version.json'
            current_version = '0.0.0'
            if current_manifest.exists():
                current_version = json.loads(current_manifest.read_text())['version']

            # Get latest version from S3
            response = self.s3.get_object(
                Bucket=settings.S3["bucket"],
                Key=f"{settings.S3['ui_prefix']}/version.json"
            )
            latest_version = json.loads(response['Body'].read())['version']

            return latest_version > current_version
        except Exception as e:
            print(f"Failed to check for UI updates: {e}")
            return False

    def download_update(self):
        """Download and apply UI update from S3"""
        try:
            # Clear temp directory
            for file in self.temp_dir.glob('*'):
                file.unlink()

            # Download all UI files
            paginator = self.s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=settings.S3["bucket"], Prefix=settings.S3["ui_prefix"]):
                for obj in page.get('Contents', []):
                    local_path = self.temp_dir / Path(obj['Key']).relative_to(settings.S3["ui_prefix"])
                    local_path.parent.mkdir(parents=True, exist_ok=True)
                    self.s3.download_file(settings.S3["bucket"], obj['Key'], str(local_path))

            # Validate downloaded files (e.g., check index.html exists)
            if not (self.temp_dir / 'index.html').exists():
                raise ValueError("Downloaded UI files are invalid")

            # Replace current UI files
            for file in self.static_dir.glob('*'):
                file.unlink()
            for file in self.temp_dir.glob('*'):
                file.rename(self.static_dir / file.name)

            return True
        except Exception as e:
            print(f"Failed to download UI update: {e}")
            return False