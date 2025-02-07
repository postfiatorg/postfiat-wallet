from pathlib import Path
from dynaconf import Dynaconf

# Default settings
DEFAULT_CONFIG = {
    "server": {
        "port": 8000
    },
    "s3": {
        "bucket": "postfiat-www",
        "region": "us-east-2",
        "base_url": "http://postfiat-www.s3-website.us-east-2.amazonaws.com",
        "ui_prefix": "wallet-ui"  # Where the UI files will live in the bucket
    },
    "paths": {
        "data_dir": "~/.pft-wallet",
        "cache_dir": "~/.pft-wallet/cache"
    }
}

settings = Dynaconf(
    envvar_prefix="PFT",
    settings_files=["settings.yaml", ".secrets.yaml"],
    environments=True,
    default_settings=DEFAULT_CONFIG
)

# Expand user paths
settings.paths.data_dir = str(Path(settings.paths.data_dir).expanduser())
settings.paths.cache_dir = str(Path(settings.paths.cache_dir).expanduser())
