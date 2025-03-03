from pathlib import Path
from dynaconf import Dynaconf

# Default settings
DEFAULT_CONFIG = {
    "SERVER": {
        "port": 28080
    },
    "S3": {
        "bucket": "postfiat-www",
        "region": "us-east-2",
        "base_url": "http://postfiat-www.s3-website.us-east-2.amazonaws.com",
        "ui_prefix": "wallet-ui"  # Where the UI files will live in the bucket
    },
    "PATHS": {
        "data_dir": "~/.postfiat-wallet",
        "cache_dir": "~/.postfiat-wallet/cache"
    }
}

settings = Dynaconf(
    envvar_prefix="POSTFIAT",
    settings_files=["settings.yaml", ".secrets.yaml"],
    environments=True,
    default_settings=DEFAULT_CONFIG
)

# Ensure the PATHS key exists if not provided by external config files.
paths = settings.get("PATHS", None)
if not paths:
    settings.set("PATHS", DEFAULT_CONFIG["PATHS"])
    paths = settings.get("PATHS")

# Expand user paths
paths["data_dir"] = str(Path(paths["data_dir"]).expanduser())
paths["cache_dir"] = str(Path(paths["cache_dir"]).expanduser())
settings.set("PATHS", paths)

# Ensure other sections exist
if not settings.get("SERVER"):
    settings.set("SERVER", DEFAULT_CONFIG["SERVER"])
if not settings.get("S3"):
    settings.set("S3", DEFAULT_CONFIG["S3"])
