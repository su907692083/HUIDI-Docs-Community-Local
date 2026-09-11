"""Browser acceptance for Customer / Inquiry -> existing due-diligence evidence owner.

Uses one isolated real Lead converted through the existing business owner. The gate
proves exact source_lead_id routing only; it does not claim external registry,
customs, credit, or provider validation.
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
    report = {
        "status": "RUNNING",
        "checks": [],
        "page_errors": [],
        "dangerous_requests": [],
        "external_providers": "NOT TESTED; isolated real Lead converted through existing Customer/Deal owner",
    }
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 960}, locale="zh-CN")
        auth = context.request.post(
            base + "/api/auth/register",
            data={
                "account_type": "individual",
                "display_name": "Business Evidence QA",
                "email": f"biz-evidence-{uuid.uuid4().hex[:12]}@example.test",
                "password": uuid.uuid4().hex,
            },
        )
        assert auth.status == 200, auth.text()
        seeded = context.request.post(
            base + "/api/leads/manual",
            data={
                "company_name": "Bergmann Evidence GmbH",
                "product_keyword": "Stainless Steel Garden Tools",
                "country": "Germany",
                "website": "https://bergmann-evidence.example",
                "contact_name": "Eva Bergmann",
                "contact_role": "Buyer",
                "contact_email": "eva@bergmann-evidence.example",
                "requirements": "Importer evaluating garden tool suppliers",
                "create_inquiry": True,
            },
        )
        assert seeded.status == 200, seeded.text()
        payload = seeded.json()
        lead_id = str(payload["lead"]["id"])
        customer_id = str(payload["customer"]["id"])
        deal_id = str(payload["deal"]["id"])

        customer_api = context.request.get(base + f"/api/business/customers/{customer_id}")
        deal_api = context.request.get(base + f"/api/business/deals/{deal_id}")
        assert customer_api.status == 200, customer_api.text()
        assert deal_api.status == 200, deal_api.text()
        assert str(customer_api.json().get("source_lead_id")) == lead_id
        assert str(deal_api.json().get("source_lead_id")) == lead_id

        page = context.new_page()
        page.on("pageerror", lambda e: report["page_errors"].append(str(e)))

        def record_request(request) -> None:
            if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
                return
            url = request.url
            if any(token in url for token in ("/send", "/queue", "/native-document", "/business/from-lead", "/business/deals/")):
                report["dangerous_requests"].append({"method": request.method, "url": url})

        page.on("request", record_request)

        def check(name: str, ok: bool = True) -> None:
            report["checks"].append({"name": name, "ok": bool(ok)})
            assert ok, name

        def shot(name: str) -> None:
            page.screenshot(path=str(output / f"{name}.png"), full_page=True)

        def evidence_text() -> str:
            page.wait_for_selector("#hospEvidenceDialog[open]", timeout=10000)
            page.wait_for_function(
                "() => (document.querySelector('#hospEvidenceDialog [data-hosp-evidence-body]')?.innerText||'').includes('销售资格证据完整度')",
                timeout=12000,
            )
            return page.locator("#hospEvidenceDialog").inner_text()

        try:
            page.goto(base + "/", wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDIBusinessCenter) && Boolean(window.HUIDICommunityDevelopmentRouting) && Boolean(window.HUIDIOpenSourceParity)",
                timeout=35000,
            )

            page.evaluate("() => window.HUIDIBusinessCenter.open('customers')")
            customer_row = page.locator(f'#huidiBusinessMain [data-customer-id="{customer_id}"]')
            customer_row.wait_for(state="visible", timeout=12000)
            customer_row.click()
            customer_evidence = page.locator('#huidiBusinessMain [data-hdw-business-evidence="customer"]')
            customer_evidence.wait_for(state="visible", timeout=12000)
            check("customer detail keeps existing development-record action", page.locator('#huidiBusinessMain [data-source-lead]').count() == 1)
            check("customer evidence button binds exact source Lead id", customer_evidence.get_attribute("data-hdw-route-lead") == lead_id)
            shot("01-customer-evidence-entry")
            customer_evidence.click()
            text = evidence_text()
            check("customer routes to existing six-dimension evidence owner", all(x in text for x in ["销售资格证据完整度", "基础身份", "公司线索", "人员关联", "数字资产", "贸易记录", "业务匹配"]))
            check("customer evidence remains explicitly not a credit report", "不是信用分" in text and "不等同于信用报告" in text)
            shot("02-customer-existing-evidence-owner")
            page.locator("#hospEvidenceDialog [data-hosp-close]").click()

            page.evaluate("() => window.HUIDIBusinessCenter.open('deals')")
            deal_row = page.locator(f'#huidiBusinessMain [data-deal="{deal_id}"]')
            deal_row.wait_for(state="visible", timeout=12000)
            deal_row.click()
            deal_evidence = page.locator('#huidiBusinessMain [data-hdw-business-evidence="deal"]')
            deal_evidence.wait_for(state="visible", timeout=12000)
            check("inquiry detail keeps existing development-record action", page.locator('#huidiBusinessMain [data-open-lead]').count() == 1)
            check("inquiry evidence button binds exact source Lead id", deal_evidence.get_attribute("data-hdw-route-lead") == lead_id)
            shot("03-inquiry-evidence-entry")
            deal_evidence.click()
            text = evidence_text()
            check("inquiry routes to same six-dimension evidence owner", all(x in text for x in ["销售资格证据完整度", "基础身份", "公司线索", "人员关联", "数字资产", "贸易记录", "业务匹配"]))
            check("opening customer/inquiry evidence does not create business records, documents, queue, or send", not report["dangerous_requests"])
            check("no uncaught page errors", not report["page_errors"])
            check("no horizontal overflow", page.evaluate("() => document.documentElement.scrollWidth<=innerWidth+2"))
            report["status"] = "PASS"
            shot("04-inquiry-existing-evidence-owner")
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
            (output / "BUSINESS-EVIDENCE-NAVIGATION-REPORT.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(report, ensure_ascii=False), flush=True)
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/huidi-business-evidence-navigation")
    output = Path(parser.parse_args().output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="huidi-business-evidence-navigation-") as temp:
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
