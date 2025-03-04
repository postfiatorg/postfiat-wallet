import datetime
import os

RELEASE_VERSION = "0.1.1"

if os.getenv('GITHUB_EVENT_NAME') == 'release':
    __version__ = RELEASE_VERSION
else:
    now = datetime.datetime.now()
    __version__ = f"{RELEASE_VERSION}a{now.strftime('%Y%m%d%H%M')}"
