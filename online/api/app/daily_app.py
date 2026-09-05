from .online_app import app  # noqa: F401
from . import mail_delivery  # noqa: F401

# Importing mail_delivery registers real SMTP delivery routes on the same FastAPI app.
