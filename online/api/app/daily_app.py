from .online_app import app  # noqa: F401
from . import mail_provider  # noqa: F401
from . import mail_delivery  # noqa: F401
from . import mail_sync  # noqa: F401
from . import mail_threads  # noqa: F401
from . import mail_sequences  # noqa: F401
from . import product_memory  # noqa: F401
from . import business_center  # noqa: F401
from . import contact_center  # noqa: F401
from . import online_notifications  # noqa: F401
from . import service_hub  # noqa: F401
from . import provider_guard  # noqa: F401
from . import workbench  # noqa: F401

# Daily Workbench is the Online product entrypoint. The imported modules register
# the daily business routes on one FastAPI application.
