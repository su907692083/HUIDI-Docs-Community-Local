import warnings

warnings.filterwarnings(
    "ignore",
    message='Field name "schema" in "LocalBusinessEventRequest" shadows an attribute in parent "BaseModel"',
    category=UserWarning,
)

from .online_app import app  # noqa: F401,E402
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
from . import industry_playbooks  # noqa: F401,E402
from . import industry_scenario_actions  # noqa: F401,E402
from . import product_memory  # noqa: F401,E402
from . import business_center  # noqa: F401,E402
# Read-only CRM timeline projection over the existing Lead/Mail/Customer/Deal/
# Document owners. It creates no activity table and never writes formal prices.
from . import business_activity  # noqa: F401,E402
# Standalone closure keeps the same Lead / Customer / Deal / DocumentRef owners,
# but makes the Windows review package usable without Community Local running:
# manual real-data entry + native Online quotation / PI / contract / CI / packing.
from . import standalone_business  # noqa: F401,E402
# Batch entry decorates only the existing native multi-product document renderer.
# It adds row selection + explicit copy-to-selected controls and does not create
# another route, document owner, storage owner, or automatic price path.
from .native_document_batch import install_native_document_batch  # noqa: E402

install_native_document_batch(standalone_business)
# Row locator/grid density is a second presentation-only wrapper around the
# already-batched renderer. It adds search/filter/sticky columns only; the same
# native draft owner still owns all business data and save behavior.
from .native_document_grid import install_native_document_grid  # noqa: E402

install_native_document_grid(standalone_business)
# Excel/TSV paste is a third bounded presentation layer. It only writes into
# existing visible row controls after an explicit user action; product identity
# is match-only and the native draft owner remains the sole persistence path.
from .native_document_paste import install_native_document_paste  # noqa: E402

install_native_document_paste(standalone_business)
# Review is a fourth read-only presentation layer over the same native rows.
# It aggregates anomaly/duplicate/amount signals and navigation only: no merge,
# row creation, API, persistence owner, or automatic price/quantity mutation.
from .native_document_review import install_native_document_review  # noqa: E402

install_native_document_review(standalone_business)
# Manual batch confirmation is a fifth bounded layer. It can copy one existing
# row into a new user-controlled batch row, but the same native Save Draft owner
# remains the only persistence path. Batch confirmation/notes are stored only as
# non-inheritable review metadata on the same OnlineDocumentRef.
from .native_document_batch_confirm import install_native_document_batch_confirm  # noqa: E402

install_native_document_batch_confirm(standalone_business)
# Batch reconciliation is a sixth current-document review layer. It records only
# a non-inheritable pre-split/manual quantity baseline, then reads the same rows
# to show batch quantity totals, delivery sequence and Packing execution sums.
# It never allocates quantities/packing data or creates another persistence path.
from .native_document_batch_reconcile import install_native_document_batch_reconcile  # noqa: E402

install_native_document_batch_reconcile(standalone_business)
# Delivery/Packing risk review is a seventh presentation-only layer. It reads
# explicit calendar dates and current Packing rows to surface overdue/near-due,
# sequence-review, missing-field and whole-vs-batch-total signals. No data write,
# status mutation, date inference, price path or second owner is introduced.
from .native_document_batch_risk import install_native_document_batch_risk  # noqa: E402

install_native_document_batch_risk(standalone_business)
# Pre-save readiness is an eighth presentation-only closure over the existing
# review signals. It replaces the older anomaly-only navigator with one compact
# "next review item" navigator and reports advisory readiness without disabling,
# intercepting or owning the existing Save Draft path.
from .native_document_save_readiness import install_native_document_save_readiness  # noqa: E402

install_native_document_save_readiness(standalone_business)
# The document workbench adds only navigation/projection over the existing
# Customer / Deal / DocumentRef owners. It also exposes the existing Local bridge
# bundle from an already-confirmed Online deal so users do not re-enter data.
from . import document_workbench  # noqa: F401,E402
# Reuses Product Brain + mailbox replies + the existing business-center owner to
# reduce re-entry. It has no second customer/deal/document tables.
from . import low_input_workflow  # noqa: F401,E402
# Cloud persistence adapter for the published Community Local mother surface.
# It maps Local customer/product/deal/document contracts onto the existing
# OnlineCustomer / ProductBrainRecord / OnlineDeal / OnlineDocumentRef owners;
# it does not create a second business data plane.
from . import community_sync  # noqa: F401,E402
# Relation-only endpoint for selecting existing Product Brain records on the
# current Deal. It reuses CommunityDealProductLink and never owns product price,
# Deal amount or formal document price.
from . import deal_product_selection  # noqa: F401,E402
from . import community_sync_bulk  # noqa: F401,E402
from . import contact_center  # noqa: F401,E402
from . import company_settings  # noqa: F401,E402
# Aggregates the existing Lead, Product Brain, industry, mailbox and company
# owners for the fused Community development page. It adds no second storage
# owner and delegates generation, approval, delivery and follow-up to the
# existing routes.
from . import development_workflow  # noqa: F401,E402
from . import backup_restore  # noqa: F401,E402
from . import backup_automation  # noqa: F401,E402
from . import online_notifications  # noqa: F401,E402
from . import notification_delivery  # noqa: F401,E402
from . import notification_categories  # noqa: F401,E402
# Safe n8n-style projection over the existing notification route/delivery owner:
# business event -> bounded conditions -> notification action -> run/retry result.
# It creates no workflow table or arbitrary-code/business-mutation execution path.
from . import automation_overview  # noqa: F401,E402
from . import intelligence_records  # noqa: F401,E402
from . import deal_reference  # noqa: F401,E402
from . import service_connections  # noqa: F401,E402
from . import feishu_documents  # noqa: F401,E402
from . import service_adapters  # noqa: F401,E402
from . import service_hub  # noqa: F401,E402
from . import service_hub_adapter_patch  # noqa: F401,E402
from . import intelligence_sources  # noqa: F401,E402
from . import customer_intelligence  # noqa: F401,E402
from . import world_intelligence  # noqa: F401,E402
from . import intelligence_source_bridge  # noqa: F401,E402
from . import today_intelligence  # noqa: F401,E402
# Read-only cited retrieval over Product / Lead / Customer / Deal / Intelligence
# owners. It creates no knowledge table/vector store and excludes formal/reference
# prices from reusable AI context.
from . import knowledge_context  # noqa: F401,E402
# Optional LLM suggestion layer over cited retrieval. It uses the existing LLM
# provider only, writes no business data and exposes no arbitrary tool execution.
from . import knowledge_ai  # noqa: F401,E402
from . import provider_guard  # noqa: F401,E402
# Imported after the guard so the acquisition middleware is the outer owner:
# Serper remains primary, Tavily is real-company failover, Hunter is contact
# priority with Serper fallback. All paths still write the same Lead objects.
from . import acquisition_provider_fusion  # noqa: F401,E402
from . import history_pagination  # noqa: F401,E402
from . import workbench  # noqa: F401,E402
from . import growth_funnel  # noqa: F401,E402
from . import audit_log  # noqa: F401,E402
from . import team_access  # noqa: F401,E402
# Public authentication extends the existing TeamMember / Organization session
# owner. Registration creates organization #2+ only; business data remains routed
# through tenant_storage and never creates a second customer/deal data plane.
from . import auth_portal  # noqa: F401,E402
# Expose only a non-sensitive organization cache namespace. Authentication and
# authorization stay owned by the HttpOnly team session and tenant router.
from . import workspace_scope  # noqa: F401,E402
# The published Community Local workspace/editor is the target Online mother
# surface. Import it only after auth so the existing auth/team middleware remains
# the single access gate. Activation is deployment-controlled while the cloud
# storage adapter is converged onto the Local repository contract.
from . import community_surface  # noqa: F401,E402
from . import production_readiness  # noqa: F401,E402
from . import acquisition_status_bridge  # noqa: F401,E402
from . import tenant_jobs  # noqa: F401,E402
from . import tenant_webhooks  # noqa: F401,E402
from . import frontend_runtime_guard  # noqa: F401,E402

# One FastAPI application now has two layers during convergence:
# - the published Community Local workspace/editor is the target business UI;
# - Online modules provide authenticated tenant storage, mail, acquisition,
#   intelligence, automation and other network capabilities.
# HUIDI_COMMUNITY_SURFACE=1 selects the published workspace as GET /.
