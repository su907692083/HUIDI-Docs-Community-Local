"""Beginner-facing mailbox setup browser acceptance.

Exercises the fused workspace with an isolated tenant. Gmail/Outlook OAuth is
not contacted and no real email is sent. The SMTP connection-test request is
fulfilled inside Playwright after the real mailbox + encrypted SMTP credential
records are saved, so CI never connects to a third-party mail server.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import uuid

import httpx
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def exercise(base: str, output: Path) -> None:
    report = {
        "status": "RUNNING",
        "checks": [],
        "page_errors": [],
        "external_mail_servers": "NOT CONTACTED",
        "real_emails_sent": 0,
    }
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1366, "height": 768}, locale="zh-CN")
        auth = context.request.post(
            base + "/api/auth/register",
            data={
                "account_type": "individual",
                "display_name": "Mailbox Beginner QA",
                "email": f"mail-beginner-{uuid.uuid4().hex[:12]}@example.test",
                "password": uuid.uuid4().hex,
            },
        )
        assert auth.status == 200, auth.text()
        page = context.new_page()
        page.on("pageerror", lambda e: report["page_errors"].append(str(e)))

        def check(name: str, condition=True) -> None:
            report["checks"].append({"name": name, "ok": bool(condition)})
            assert condition, name

        def shot(name: str) -> None:
            page.screenshot(path=str(output / f"{name}.png"), full_page=True)

        try:
            page.goto(base + "/", wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDIWorkspaceFoundation) && Boolean(window.HUIDIMailSetupRefinement)",
                timeout=35000,
            )
            setup = page.locator('[data-huidi-foundation]').first
            setup.click()
            page.wait_for_selector('[data-huf-other-mail]', timeout=12000)
            page.locator('[data-huf-other-mail]').click()
            page.wait_for_selector('#hmsBack.open [data-hms-company]:not(.hms-hidden)', timeout=10000)

            modal = page.locator('#hmsBack')
            text = modal.inner_text()
            check("normal mailbox setup uses business language", all(x in text for x in ["一键连接 Gmail", "一键连接 Outlook", "连接企业邮箱", "授权码 / 专用密码", "连接并检查"]))
            check("normal mailbox setup hides OAuth internals", all(x not in text for x in ["Client ID", "Client Secret", "redirect_uri", "Bearer"]))
            check("normal mailbox setup does not expose SMTP jargon", "SMTP" not in text)
            check("technical server field starts collapsed", not page.locator('[data-hms-host]').is_visible())
            check("technical port field starts collapsed", not page.locator('[data-hms-port]').is_visible())
            check("1366 mailbox dialog has no document overflow", page.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 2"))
            shot("01-beginner-mailbox-setup-1366")

            presets = {
                "qq": ("smtp.qq.com", "465", "ssl"),
                "exmail": ("smtp.exmail.qq.com", "465", "ssl"),
                "n163": ("smtp.163.com", "465", "ssl"),
                "n126": ("smtp.126.com", "465", "ssl"),
                "aliyun": ("smtp.qiye.aliyun.com", "465", "ssl"),
                "zoho": ("smtp.zoho.com", "465", "ssl"),
                "custom": ("", "587", "starttls"),
            }
            details = page.locator('.hms-advanced')
            details.locator('summary').click()
            for key, expected in presets.items():
                page.locator('[data-hms-preset]').select_option(key)
                actual = (
                    page.locator('[data-hms-host]').input_value(),
                    page.locator('[data-hms-port]').input_value(),
                    page.locator('[data-hms-security]').input_value(),
                )
                check(f"{key} preset fills the expected sending connection", actual == expected)
            page.locator('[data-hms-preset]').select_option('qq')
            check("advanced settings are available only after explicit expansion", page.locator('[data-hms-host]').is_visible())
            shot("02-mailbox-advanced-on-demand")

            test_requests = []
            def fake_test(route, request):
                test_requests.append(request.url)
                route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
            page.route("**/api/mail/accounts/*/test", fake_test)

            email = f"sales-{uuid.uuid4().hex[:8]}@example.test"
            page.locator('[data-hms-email]').fill(email)
            page.locator('[data-hms-name]').fill('海外业务')
            page.locator('[data-hms-secret]').fill('ci-only-authorization-code')
            page.locator('[data-hms-connect]').click()
            page.wait_for_selector('.hms-result.ok', timeout=10000)
            check("connect-and-check action reaches existing SMTP test endpoint", len(test_requests) == 1)
            check("success copy stays business-oriented", "连接成功" in page.locator('.hms-result.ok').inner_text())

            accounts = context.request.get(base + "/api/mail/accounts")
            assert accounts.status == 200, accounts.text()
            rows = accounts.json()
            account = next((x for x in rows if str(x.get("email") or "").lower() == email.lower()), None)
            check("enterprise mailbox uses existing mailbox owner", bool(account and account.get("auth_mode") == "smtp"))
            smtp = context.request.get(base + f"/api/mail/accounts/{account['id']}/smtp")
            assert smtp.status == 200, smtp.text()
            cred = (smtp.json() or {}).get("smtp") or {}
            check("QQ preset persisted through existing encrypted SMTP owner", cred.get("host") == "smtp.qq.com" and int(cred.get("port") or 0) == 465 and cred.get("security") == "ssl")
            check("saved credential is present without exposing the secret", cred.get("has_secret") is True and "password" not in cred and "secret" not in cred)

            page.set_viewport_size({"width": 1640, "height": 920})
            check("1640 mailbox dialog has no document overflow", page.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 2"))
            page.set_viewport_size({"width": 2048, "height": 1118})
            check("2048 mailbox dialog has no document overflow", page.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 2"))
            shot("03-mailbox-setup-wide")

            page.keyboard.press("Escape")
            check("Escape closes mailbox setup", page.locator('#hmsBack').is_hidden())
            check("no uncaught page errors", not report["page_errors"])
            report["status"] = "PASS"
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
            (output / "MAIL-SETUP-BEGINNER-REPORT.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(report, ensure_ascii=False), flush=True)
            browser.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/huidi-mail-setup-beginner")
    output = Path(parser.parse_args().output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="huidi-mail-setup-") as temp:
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
