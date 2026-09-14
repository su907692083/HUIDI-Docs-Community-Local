"""Browser acceptance for formal Customer / Inquiry -> exact source Lead evidence reuse.

The test creates one isolated real Lead -> Customer -> Deal chain, renames the
formal Customer, then uses the actual Community fused Customer/Inquiry lists and
Quick Detail owner. The evidence action is exposed only after an exact formal
record GET returns a persisted source_lead_id. No company/email/domain matching
is used to recover the source Lead.
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


def exercise(base: str, output: Path) -> None:
    stamp = uuid.uuid4().hex[:8]
    lead_company = f"Exact Source Evidence {stamp} GmbH"
    renamed_customer = f"Renamed Formal Customer {stamp}"
    report = {
        "status": "RUNNING",
        "checks": [],
        "page_errors": [],
        "dangerous_requests": [],
        "formal_lookup_requests": [],
        "evidence_requests": [],
        "source_identity": {},
        "external_providers": "NOT TESTED; isolated real Lead/Customer/Deal records only",
    }

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 960}, locale="zh-CN")
        auth = context.request.post(
            base + "/api/auth/register",
            data={
                "account_type": "individual",
                "display_name": "Formal Business Evidence QA",
                "email": f"formal-evidence-{stamp}@example.test",
                "password": uuid.uuid4().hex,
            },
        )
        assert auth.status == 200, auth.text()

        seeded = context.request.post(
            base + "/api/leads/manual",
            data={
                "company_name": lead_company,
                "product_keyword": "Garden Tool Set",
                "country": "Germany",
                "website": "https://exact-source-evidence.example",
                "contact_name": "Anna Weber",
                "contact_role": "Purchasing Manager",
                "contact_email": "anna@exact-source-evidence.example",
                "requirements": "Importer reviewing Garden Tool Set suppliers",
                "create_inquiry": True,
            },
        )
        assert seeded.status == 200, seeded.text()
        seeded_body = seeded.json()
        lead_id = str((seeded_body.get("lead") or {}).get("id") or "")
        customer_id = str((seeded_body.get("customer") or {}).get("id") or "")
        deal_id = str((seeded_body.get("deal") or {}).get("id") or "")
        assert lead_id and customer_id and deal_id, seeded_body

        renamed = context.request.patch(
            base + f"/api/business/customers/{customer_id}",
            data={"company_name": renamed_customer},
        )
        assert renamed.status == 200, renamed.text()

        customer_payload = context.request.get(base + f"/api/business/customers/{customer_id}")
        deal_payload = context.request.get(base + f"/api/business/deals/{deal_id}")
        assert customer_payload.status == 200, customer_payload.text()
        assert deal_payload.status == 200, deal_payload.text()
        customer_json = customer_payload.json()
        deal_json = deal_payload.json()
        report["source_identity"] = {
            "lead_id": lead_id,
            "customer_id": customer_id,
            "customer_source_lead_id": str(customer_json.get("source_lead_id") or ""),
            "deal_id": deal_id,
            "deal_source_lead_id": str(deal_json.get("source_lead_id") or ""),
            "lead_company": lead_company,
            "renamed_customer": renamed_customer,
        }

        page = context.new_page()
        page.on("pageerror", lambda e: report["page_errors"].append(str(e)))

        def record_request(request) -> None:
            url = request.url
            if request.method == "GET" and (
                f"/api/business/customers/{customer_id}" in url
                or f"/api/business/deals/{deal_id}" in url
            ):
                report["formal_lookup_requests"].append({"method": request.method, "url": url})
            if f"/api/leads/{lead_id}" in url or f"/api/intel/customer/{lead_id}" in url:
                report["evidence_requests"].append({"method": request.method, "url": url})
            if request.method != "POST":
                return
            if any(
                token in url
                for token in (
                    "/api/business/from-lead/",
                    "/native-document",
                    "/send",
                    "/queue",
                    "/find-contact",
                    "sequence-enrollments",
                )
            ):
                report["dangerous_requests"].append(url)

        page.on("request", record_request)

        def check(name: str, ok: bool = True) -> None:
            report["checks"].append({"name": name, "ok": bool(ok)})
            assert ok, name

        def shot(name: str) -> None:
            page.screenshot(path=str(output / f"{name}.png"), full_page=True)

        def evidence_text() -> str:
            return page.locator("#hospEvidenceDialog").inner_text()

        try:
            check("Customer persists exact source_lead_id", str(customer_json.get("source_lead_id") or "") == lead_id)
            check("Inquiry persists exact source_lead_id", str(deal_json.get("source_lead_id") or "") == lead_id)
            check("Formal Customer rename is independent of source Lead identity", customer_json.get("company_name") == renamed_customer)

            page.goto(base + "/", wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDIWorkspaceClosure) && Boolean(window.HUIDICommunityDevelopmentRouting)",
                timeout=35000,
            )

            # Actual Community Inquiry list -> existing Quick Detail owner.
            deals_nav = page.locator('.nav-btn[data-view="deals"]').first
            deals_nav.wait_for(state="visible", timeout=15000)
            deals_nav.click()
            page.wait_for_function("() => document.body.dataset.huidiView==='deals'", timeout=10000)
            deal_row = page.locator(f'#dealRows tr[data-quick-kind="deal"][data-quick-id="{deal_id}"]')
            deal_row.wait_for(state="visible", timeout=12000)
            deal_row.click()
            page.wait_for_selector(
                f'#huidiQuickBackdrop.open[data-kind="deal"][data-id="{deal_id}"]',
                timeout=10000,
            )
            inquiry_evidence = page.locator('#huidiQuickBackdrop [data-hdw-formal-evidence]')
            inquiry_evidence.wait_for(state="visible", timeout=12000)
            check("Inquiry Quick Detail exposes due-diligence evidence only after exact record lookup", inquiry_evidence.inner_text().strip() == "背调证据")
            check("Inquiry evidence button carries persisted exact source Lead id", inquiry_evidence.get_attribute("data-hdw-route-lead") == lead_id)
            check("Inquiry exact metadata lookup uses formal Deal id", any(f"/api/business/deals/{deal_id}" in x["url"] for x in report["formal_lookup_requests"]))
            shot("01-community-inquiry-evidence-entry")

            inquiry_evidence.click()
            page.wait_for_selector("#hospEvidenceDialog[open]", timeout=12000)
            page.wait_for_function(
                "() => (document.querySelector('#hospEvidenceDialog')?.innerText||'').includes('销售资格证据完整度')",
                timeout=12000,
            )
            inquiry_text = evidence_text()
            check("Inquiry opens existing six-dimension evidence owner", all(label in inquiry_text for label in ["基础身份", "公司线索", "人员关联", "数字资产", "贸易记录", "业务匹配"]))
            check("Inquiry evidence resolves the exact original Lead", lead_company in inquiry_text)
            check("Evidence remains explicitly not a credit score", "不是信用分" in inquiry_text and "不等同于信用报告" in inquiry_text)
            shot("02-community-inquiry-existing-lead-evidence")
            page.locator("#hospEvidenceDialog [data-hosp-close]").click()
            page.locator("#huidiQuickBackdrop [data-quick-close]").click()

            # Actual Community Customer list -> same Quick Detail owner after company rename.
            customers_nav = page.locator('.nav-btn[data-view="customers"]').first
            customers_nav.click()
            page.wait_for_function("() => document.body.dataset.huidiView==='customers'", timeout=10000)
            customer_row = page.locator(f'#customerRows tr[data-quick-kind="customer"][data-quick-id="{customer_id}"]')
            customer_row.wait_for(state="visible", timeout=12000)
            check("Renamed formal Customer is rendered by Community owner", renamed_customer in customer_row.inner_text())
            customer_row.click()
            page.wait_for_selector(
                f'#huidiQuickBackdrop.open[data-kind="customer"][data-id="{customer_id}"]',
                timeout=10000,
            )
            customer_evidence = page.locator('#huidiQuickBackdrop [data-hdw-formal-evidence]')
            customer_evidence.wait_for(state="visible", timeout=12000)
            check("Customer Quick Detail exposes due-diligence evidence only after exact record lookup", customer_evidence.inner_text().strip() == "背调证据")
            check("Customer evidence button carries persisted exact source Lead id", customer_evidence.get_attribute("data-hdw-route-lead") == lead_id)
            check("Customer exact metadata lookup uses formal Customer id", any(f"/api/business/customers/{customer_id}" in x["url"] for x in report["formal_lookup_requests"]))
            shot("03-community-customer-evidence-entry-after-rename")

            customer_evidence.click()
            page.wait_for_selector("#hospEvidenceDialog[open]", timeout=12000)
            page.wait_for_function(
                f"() => (document.querySelector('#hospEvidenceDialog')?.innerText||'').includes({json.dumps(lead_company)})",
                timeout=12000,
            )
            customer_text = evidence_text()
            check("Customer evidence still resolves original Lead after formal name changes", lead_company in customer_text)
            check("Customer evidence does not replace Lead identity with renamed Customer name", renamed_customer not in customer_text)
            check("Customer and Inquiry reuse the same six-dimension evidence owner", all(label in customer_text for label in ["基础身份", "公司线索", "人员关联", "数字资产", "贸易记录", "业务匹配"]))
            check("Evidence navigation creates no formal business/send/contact side effects", not report["dangerous_requests"])
            check("No uncaught page errors", not report["page_errors"])
            check("No horizontal overflow", page.evaluate("() => document.documentElement.scrollWidth<=innerWidth+2"))
            check("Evidence navigation stays in one browser page", len(context.pages) == 1)
            report["status"] = "PASS"
            shot("04-community-customer-same-existing-lead-evidence")
        except Exception as exc:
            report["status"] = "FAIL"
            report["error"] = str(exc)
            try:
                shot("failure")
                (output / "failure.html").write_text(page.content(), encoding="utf-8")
            except Exception:
                pass
            raise
        finally:
            (output / "FORMAL-BUSINESS-DUE-DILIGENCE-REPORT.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(report, ensure_ascii=False), flush=True)
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/huidi-formal-business-due-diligence")
    output = Path(parser.parse_args().output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="huidi-formal-business-due-diligence-") as temp:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        env = {
            k: v
            for k, v in os.environ.items()
            if not any(token in k for token in ("API_KEY", "CLIENT_ID", "CLIENT_SECRET", "SMTP_PASSWORD"))
        }
        env.update(
            HUIDI_SECRET_KEY=uuid.uuid4().hex,
            HUIDI_TEAM_ACCESS="1",
            HUIDI_COMMUNITY_SURFACE="1",
            HUIDI_SIGNUP_ENABLED="1",
            HUIDI_DISABLE_BACKGROUND_JOBS="1",
            HUIDI_AUTO_BACKUP="0",
            HUIDI_PUBLIC_BASE_URL=base,
            DATABASE_URL=f"sqlite:///{temp}/app.db",
        )
        with (output / "server.log").open("w") as log:
            process = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "app.daily_app:app", "--host", "127.0.0.1", "--port", str(port)],
                cwd=ROOT / "online/api",
                env=env,
                stdout=log,
                stderr=log,
            )
            try:
                for _ in range(100):
                    try:
                        if httpx.get(base + "/login", timeout=1).status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    if process.poll() is not None:
                        raise RuntimeError("isolated app exited")
                    time.sleep(0.2)
                else:
                    raise RuntimeError("isolated app did not start")
                exercise(base, output)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    main()
