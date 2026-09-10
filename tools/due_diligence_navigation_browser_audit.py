"""Browser acceptance for first-class due-diligence evidence in the Lead pool.

Uses one isolated real Lead record. No external provider credentials are used.
The acceptance proves navigation into the existing six-dimension evidence owner;
it does not claim official registry, customs, credit, or provider validation.
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
        "external_providers": "NOT TESTED; isolated real Lead record only",
    }
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 960}, locale="zh-CN")
        auth = context.request.post(
            base + "/api/auth/register",
            data={
                "account_type": "individual",
                "display_name": "Due Diligence Navigation QA",
                "email": f"dd-nav-{uuid.uuid4().hex[:12]}@example.test",
                "password": uuid.uuid4().hex,
            },
        )
        assert auth.status == 200, auth.text()
        seeded = context.request.post(
            base + "/api/leads/manual",
            data={
                "company_name": "Nordwerk Evidence GmbH",
                "product_keyword": "Garden Tool Set",
                "country": "Germany",
                "website": "https://nordwerk-evidence.example",
                "contact_name": "Anna Weber",
                "contact_role": "Purchasing Manager",
                "contact_email": "anna@nordwerk-evidence.example",
                "requirements": "Importer reviewing Garden Tool Set suppliers",
                "create_inquiry": False,
            },
        )
        assert seeded.status == 200, seeded.text()
        lead_id = str(seeded.json()["lead"]["id"])

        page = context.new_page()
        page.on("pageerror", lambda e: report["page_errors"].append(str(e)))

        def record_request(request) -> None:
            if request.method != "POST":
                return
            url = request.url
            if any(token in url for token in ("/send", "/queue", "/find-contact", "/native-document", "/business/deals")):
                report["dangerous_requests"].append(url)

        page.on("request", record_request)

        def check(name: str, ok: bool = True) -> None:
            report["checks"].append({"name": name, "ok": bool(ok)})
            assert ok, name

        def shot(name: str) -> None:
            page.screenshot(path=str(output / f"{name}.png"), full_page=True)

        try:
            page.goto(base + "/", wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDICommunityOnlineFullV2)",
                timeout=35000,
            )
            page.locator('.sidebar .nav-btn[data-view="online-find"]').click()
            page.wait_for_selector('#view-online-find.active [data-fv2-tab="pool"]')
            opened = page.evaluate(
                """async () => {
                    const owner = window.HUIDICommunityOnlineFullV2;
                    if (!owner?.openTab) return false;
                    return await owner.openTab('online-find', 'pool', {force: true});
                }"""
            )
            check("existing Lead Pool owner completes its async render", opened is True)
            page.wait_for_selector('#view-online-find [data-fv2-pane="pool"].active:not([hidden])')

            lead_page = context.request.get(base + "/api/leads?paged=true&page=1&page_size=50")
            assert lead_page.status == 200, lead_page.text()
            lead_payload = lead_page.json()
            lead_items = lead_payload if isinstance(lead_payload, list) else lead_payload.get("items", [])
            check(
                "seeded Lead is visible through existing Lead Owner API",
                any(str(item.get("id")) == lead_id for item in lead_items),
            )

            row = page.locator(f'#view-online-find [data-fv2-pane="pool"] tr[data-fv2-lead="{lead_id}"]')
            row.wait_for(state="attached", timeout=12000)
            check("seeded Lead is rendered in existing Lead Pool", row.count() == 1)
            row.scroll_into_view_if_needed()
            check("seeded Lead row is visible", row.is_visible())
            page.wait_for_function(
                "id => Boolean(document.querySelector(`#view-online-find [data-fv2-pane=\"pool\"] tr[data-fv2-lead=\"${id}\"] [data-hdw-route-action=\"evidence\"]`))",
                arg=lead_id,
                timeout=8000,
            )

            assess = row.locator("[data-fv2-assess]")
            evidence = row.locator('[data-hdw-route-action="evidence"]')
            check("lead pool keeps explicit reassessment action", assess.inner_text().strip() == "重新评估")
            check("lead pool exposes first-class due-diligence evidence action", evidence.inner_text().strip() == "背调证据")
            check("development route still exists beside evidence", row.locator('[data-hdw-route-action="develop"]').count() == 1)
            shot("01-lead-pool-evidence-entry")

            evidence.click()
            page.wait_for_selector("#hospEvidenceDialog[open]", timeout=10000)
            page.wait_for_function(
                "() => (document.querySelector('#hospEvidenceDialog [data-hosp-evidence-body]')?.innerText||'').includes('销售资格证据完整度')",
                timeout=12000,
            )
            text = page.locator("#hospEvidenceDialog").inner_text()
            check("evidence panel labels completeness as not a credit score", "销售资格证据完整度" in text and "不是信用分" in text)
            check(
                "same six evidence dimensions are visible from Lead pool",
                all(label in text for label in ["基础身份", "公司线索", "人员关联", "数字资产", "贸易记录", "业务匹配"]),
            )
            check("official registry uncertainty stays explicit", "工商" in text or "官方" in text)
            check("customs or real-purchase uncertainty stays explicit", "海关" in text or "采购" in text)
            check("evidence panel rejects fake official due diligence", "不等同于信用报告" in text or "不等同于" in text)
            check("opening evidence does not search contacts, send, queue, or create formal business records", not report["dangerous_requests"])
            check("no uncaught page errors", not report["page_errors"])
            check("no horizontal overflow", page.evaluate("() => document.documentElement.scrollWidth<=innerWidth+2"))
            report["status"] = "PASS"
            shot("02-existing-six-dimension-evidence")
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
            (output / "DUE-DILIGENCE-NAVIGATION-REPORT.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(report, ensure_ascii=False), flush=True)
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/huidi-due-diligence-navigation")
    output = Path(parser.parse_args().output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="huidi-due-diligence-navigation-") as temp:
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
