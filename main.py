"""Railway root entrypoint for HUIDI Online.

The application code remains under online/api. Keeping this shim at repository
root lets the deployment package the published public/ Community Local assets
without creating a second web application.
"""

from pathlib import Path
import sys

API_DIR = Path(__file__).resolve().parent / "online" / "api"
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.daily_app import app  # noqa: E402,F401
