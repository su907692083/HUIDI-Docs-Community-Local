from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


API = Path(__file__).resolve().parents[1]
WEB = API / "web"


class WorkspacePagesContractTests(unittest.TestCase):
    def test_router_loads_before_popup_owners(self):
        index = (WEB / "index.html").read_text(encoding="utf-8")
        router = index.index('/assets/workspace-pages.js')
        self.assertLess(router, index.index('/assets/product-brain.js'))
        self.assertLess(router, index.index('/assets/daily-services.js'))
        self.assertLess(router, index.index('/assets/business-center-ui.js'))
        self.assertLess(router, index.index('/assets/daily-navigation.js'))
        self.assertLess(router, index.index('/assets/sequence-ui.js'))
        self.assertLess(router, index.index('/assets/customer-intelligence.js'))
        self.assertLess(router, index.index('/assets/audit-ui.js'))

    def test_primary_sidebar_routes_into_main_workspace_page(self):
        source = (WEB / "workspace-pages.js").read_text(encoding="utf-8")
        self.assertIn("#huidiPageHost", source)
        self.assertIn("hwp-page-active", source)
        self.assertIn("hwp-docked", source)
        self.assertIn("stopImmediatePropagation", source)
        self.assertIn(".side [data-huidi-business]", source)
        self.assertIn(".side [data-huidi-product]", source)
        self.assertIn(".side [data-huidi-catalog]", source)
        self.assertIn(".side [data-huidi-service]", source)
        self.assertIn("#huidiBusinessBack", source)
        self.assertIn("#huidiServiceBack", source)
        self.assertIn("#pbBackdrop", source)
        self.assertIn("#huidiIntelBack", source)
        self.assertIn("#sqBack", source)
        self.assertIn("#auBack", source)
        subprocess.run(["node", "--check", str(WEB / "workspace-pages.js")], check=True)

    def test_catalog_is_native_and_does_not_require_local_8765(self):
        source = (WEB / "workspace-pages.js").read_text(encoding="utf-8")
        self.assertIn("产品目录", source)
        self.assertIn("/api/product-brains", source)
        self.assertIn("生成 / 刷新目录预览", source)
        self.assertIn("打印 / 另存 PDF", source)
        self.assertIn("下载 HTML", source)
        self.assertIn("catalogSelected", source)
        self.assertNotIn("catalog-studio/index.html", source)
        self.assertNotIn("127.0.0.1:8765", source)
        self.assertNotIn("localhost:8765", source)

    def test_catalog_uses_real_product_fields_only(self):
        source = (WEB / "workspace-pages.js").read_text(encoding="utf-8")
        for token in ["name", "sku", "spec", "moq", "lead_time", "certifications", "price_range"]:
            self.assertIn(token, source)
        self.assertIn("暂无产品图片", source)
        self.assertNotIn("Demo Product", source)
        self.assertNotIn("示例产品", source)


if __name__ == "__main__":
    unittest.main()
