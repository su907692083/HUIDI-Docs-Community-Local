from .online_app import app  # noqa: F401
from . import mail_delivery  # noqa: F401
from . import workbench  # noqa: F401

# Daily Workbench is the Online product entrypoint. Importing the modules above
# registers SMTP delivery, business bridge and daily-work routes on one FastAPI app.
