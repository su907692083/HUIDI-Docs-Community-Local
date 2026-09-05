from .online_app import app  # noqa: F401
from .tenant_storage import install_session_router

# Install the company-aware business-session router before importing modules
# that capture SessionLocal. Organization #1 keeps the historical database;
# organization #2+ receive physically separate business databases.
install_session_router()

from . import mail_provider  # noqa: F401,E402
from . import mail_delivery  # noqa: F401,E402
from . import mail_sync  # noqa: F401,E402
from . import mail_plan_compat_owner  # noqa: F401,E402
from . import mail_threads  # noqa: F401,E402
from . import mail_sequences  # noqa: F401,E402
from . import product_memory  # noqa: F401,E402
from . import business_center  # noqa: F401,E402
from . import contact_center  # noqa: F401,E402
from . import company_settings  # noqa: F401,E402
from . import backup_restore  # noqa: F401,E402
from . import backup_automation  # noqa: F401,E402
from . import online_notifications  # noqa: F401,E402
from . import notification_delivery  # noqa: F401,E402
from . import notification_categories  # noqa: F401,E402
from . import intelligence_records  # noqa: F401,E402
from . import deal_reference  # noqa: F401,E402
from . import service_connections  # noqa: F401,E402
from . import service_adapters  # noqa: F401,E402
from . import service_hub  # noqa: F401,E402
from . import service_hub_adapter_patch  # noqa: F401,E402
from . import provider_guard  # noqa: F401,E402
from . import workbench  # noqa: F401,E402
from . import audit_log  # noqa: F401,E402
from . import team_access  # noqa: F401,E402
from . import production_readiness  # noqa: F401,E402
from . import tenant_jobs  # noqa: F401,E402
from . import tenant_webhooks  # noqa: F401,E402

# Daily Workbench is the Online product entrypoint. The imported modules register
# the daily business routes on one FastAPI application.
