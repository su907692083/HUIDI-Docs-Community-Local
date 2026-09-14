from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


HERE = Path(__file__).resolve()
REPO = HERE.parents[3]
APP = REPO / "online" / "api" / "app"
PUBLIC = REPO / "public"


class CommunityCloudAdapterContractTests(unittest.TestCase):
    def setUp(self):
        self.mode_path = PUBLIC / "community-local-mode.js"
        self.adapter_path = PUBLIC / "huidi-community-cloud-adapter-v1.js"
        self.mode = self.mode_path.read_text(encoding="utf-8")
        self.adapter = self.adapter_path.read_text(encoding="utf-8")
        self.scope = (APP / "workspace_scope.py").read_text(encoding="utf-8")
        self.bulk = (APP / "community_sync_bulk.py").read_text(encoding="utf-8")
        self.daily = (APP / "daily_app.py").read_text(encoding="utf-8")
        self.surface = (APP / "community_surface.py").read_text(encoding="utf-8")

    def test_online_cache_scope_requires_community_path_and_server_cookie(self):
        self.assertIn("huidi_workspace_scope", self.mode)
        self.assertIn("communityPath", self.mode)
        self.assertIn(r"/^org-\d+$/", self.mode)
        self.assertIn("HUIDI_COMMUNITY_ONLINE", self.mode)
        self.assertIn("huidi_workspace_${ONLINE.scope}__", self.mode)
        self.assertIn("/community/huidi-community-cloud-adapter-v1.js", self.mode)

    def test_local_session_and_indexeddb_are_scoped_before_local_owners_load(self):
        self.assertIn("Storage?.prototype", self.mode)
        self.assertIn("storage===window.localStorage", self.mode)
        self.assertIn("storage===window.sessionStorage", self.mode)
        self.assertIn("storages:['localStorage','sessionStorage']", self.mode)
        self.assertIn("IDBFactory?.prototype", self.mode)
        self.assertIn("HUIDI_DOCS_ONLINE_DB_", self.mode)
        # Standalone Local still uses the published Local contract when no
        # authenticated Community Online scope exists.
        self.assertIn("if(!ONLINE)return", self.mode)
        self.assertIn("localOnly:true", self.mode)

    def test_direct_document_reads_wait_for_current_tenant_cloud_hydration(self):
        self.assertIn("installCloudDocumentReadGate", self.mode)
        self.assertIn("HUIDI:community-cloud-ready", self.mode)
        self.assertIn("window.HUIDILocalDB=Object.freeze({...db", self.mode)
        self.assertIn("getDocument:async function(...args){await ready;return nativeGet(...args)}", self.mode)
        self.assertNotIn("Object.defineProperty(db,", self.mode)
        self.assertIn("HUIDI_COMMUNITY_DOCUMENT_READ_READY", self.mode)
        self.assertIn("if(ONLINE)loadCloudAdapter();", self.mode)
        # The Local editor remains the restore owner; this layer only delays its
        # canonical LocalDB read until the tenant cloud projection is hydrated.
        self.assertNotIn("FlypigBOXApp?.applyState", self.mode)

    def test_scope_cookie_is_cache_namespace_not_auth_owner(self):
        self.assertIn('WORKSPACE_SCOPE_COOKIE = "huidi_workspace_scope"', self.scope)
        self.assertIn("request.state", self.scope)
        self.assertIn("httponly=False", self.scope)
        self.assertIn("not authorization", self.scope)
        self.assertNotIn("TeamSession", self.scope)
        self.assertNotIn("set_current_organization", self.scope)
        self.assertIn('request.url.path == "/api/team/logout"', self.scope)

    def test_adapter_reuses_local_and_online_canonical_owners(self):
        self.assertIn("HUIDILocalCore", self.adapter)
        self.assertIn("HUIDILocalDB", self.adapter)
        self.assertIn("/api/team/me", self.adapter)
        self.assertIn("/api/community-sync/bootstrap", self.adapter)
        self.assertIn("/api/community-sync/state", self.adapter)
        self.assertIn("/api/community-sync/document-records", self.adapter)
        self.assertIn("/api/community-sync/documents/", self.adapter)
        self.assertNotIn("127.0.0.1", self.adapter)
        self.assertNotIn("localhost", self.adapter.lower())
        self.assertNotIn("class CommunityCustomer", self.adapter)
        self.assertNotIn("class CommunityDeal", self.adapter)

    def test_cloud_bootstrap_is_server_first_not_standalone_cache_upload(self):
        boot = self.adapter[self.adapter.index("async function boot") :]
        self.assertLess(boot.index("verifyIdentity"), boot.index("/api/community-sync/bootstrap"))
        self.assertLess(boot.index("/api/community-sync/bootstrap"), boot.index("state.ready=true"))
        self.assertNotIn("syncState();", boot.split("state.ready=true", 1)[0])

    def test_full_documents_are_hydrated_through_existing_document_ref_projection(self):
        self.assertIn("OnlineDocumentRef", self.bulk)
        self.assertIn("_community_document_record", self.bulk)
        self.assertIn("FORMAL_DOCUMENT_TYPES", self.bulk)
        self.assertIn("Depends(get_db)", self.bulk)
        self.assertNotIn("__tablename__", self.bulk)
        self.assertNotIn("Base.metadata", self.bulk)

    def test_packaged_community_surface_prefers_explicit_public_dir(self):
        self.assertIn('os.getenv("HUIDI_COMMUNITY_PUBLIC_DIR", "")', self.surface)
        self.assertIn("if configured:", self.surface)
        self.assertIn("for parent in current.parents:", self.surface)
        self.assertIn('candidate = parent / "public"', self.surface)
        # Docker installs the module at /app/app/community_surface.py. Fixed
        # parents[n] indexing is invalid there and must never be reintroduced.
        self.assertNotIn("parents[3]", self.surface)

    def test_daily_app_loads_scope_and_bulk_adapter(self):
        self.assertIn("from . import community_sync_bulk", self.daily)
        self.assertIn("from . import workspace_scope", self.daily)
        self.assertLess(self.daily.index("from . import auth_portal"), self.daily.index("from . import workspace_scope"))
        self.assertLess(self.daily.index("from . import workspace_scope"), self.daily.index("from . import community_surface"))

    def test_new_browser_files_parse_with_node_when_available(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node is not installed in this local test environment")
        for path in (self.mode_path, self.adapter_path):
            result = subprocess.run(
                [node, "--check", str(path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
