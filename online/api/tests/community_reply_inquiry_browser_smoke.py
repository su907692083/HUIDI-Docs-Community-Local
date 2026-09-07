from __future__ import annotations

import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from sqlalchemy.orm import Session

from app.mail_sync import _record_message
from app.online_app import MailboxAccount
from app.tenant_storage import ensure_tenant_schema


BASE = "http://127.0.0.1:18085"
PASSWORD = "reply-inquiry-password-2026"
BUYER = "Reply Smoke Buyer"


def browser_snapshot(driver) -> dict:
    return driver.execute_script(
        """
        const rows=[...document.querySelectorAll('#dealRows tr')].map(tr=>({
          text:(tr.innerText||'').trim(),
          nextId:tr.querySelector('[data-action="deal-next"]')?.dataset.id||'',
          focused:tr.dataset.huidiFocusedInquiry||''
        }));
        return {
          view:document.body.dataset.huidiView||'',
          activeViews:[...document.querySelectorAll('.view.active')].map(v=>v.id),
          activeNavs:[...document.querySelectorAll('.nav-btn.active')].map(v=>v.dataset.view||''),
          search:document.querySelector('#dealSearch')?.value||'',
          focused:document.querySelectorAll('#dealRows tr[data-huidi-focused-inquiry="1"]').length,
          rows,
          dealsNav:Boolean(document.querySelector('.nav-btn[data-view="deals"]')),
          routing:window.HUIDICommunityDevelopmentRouting?.version||'',
          cloud:document.documentElement.dataset.huidiCloud||'',
          cloudState:document.documentElement.dataset.huidiCloudState||'',
          onlineFindActive:Boolean(document.querySelector('#view-online-find')?.classList.contains('active')),
          dealsActive:Boolean(document.querySelector('#view-deals')?.classList.contains('active')),
          iframeCount:document.querySelectorAll('iframe').length
        };
        """
    )


def main() -> None:
    email = f"reply-inquiry-{uuid.uuid4().hex[:12]}@example.test"
    client = httpx.Client(base_url=BASE, follow_redirects=False, timeout=20)

    registered = client.post(
        "/api/auth/register",
        json={
            "account_type": "individual",
            "display_name": "Reply Inquiry Browser",
            "organization_name": "",
            "email": email,
            "password": PASSWORD,
        },
    )
    assert registered.status_code == 200, registered.text
    org_id = int(registered.json()["organization"]["id"])
    assert org_id > 1, registered.text

    product_id = "reply-smoke-hinge"
    product = client.put(
        "/api/product-brains/" + product_id,
        json={
            "name": "Stainless Steel Hinge",
            "sku": "H-304-4",
            "payload": {
                "id": product_id,
                "brain_id": product_id,
                "name": "Stainless Steel Hinge",
                "sku": "H-304-4",
                "spec": "SUS304 4 inch",
                "moq": "500 pcs",
                "lead_time": "15 days",
                "price": 1.25,
                "currency": "USD",
                "unit": "PCS",
                "target_keywords": ["stainless steel hinge", "hinge"],
            },
        },
    )
    assert product.status_code == 200, product.text

    buyer_email = "anna.reply-buyer@example.test"
    created = client.post(
        "/api/leads/manual",
        json={
            "company_name": BUYER,
            "product_keyword": "stainless steel hinge",
            "country": "Germany",
            "website": "https://reply-smoke-buyer.example",
            "contact_name": "Anna Buyer",
            "contact_role": "Purchasing Manager",
            "contact_email": buyer_email,
            "requirements": "Initial interest in SUS304 hinges.",
            "create_inquiry": False,
        },
    )
    assert created.status_code == 200, created.text
    lead_id = int(created.json()["lead"]["id"])

    mailbox = client.post(
        "/api/mail/accounts",
        json={
            "display_name": "Reply Smoke Mailbox",
            "email": "sales.reply-smoke@example.test",
            "provider": "smtp",
            "auth_mode": "smtp",
            "daily_limit": 40,
            "min_interval_seconds": 120,
            "timezone": "UTC",
        },
    )
    assert mailbox.status_code == 200, mailbox.text
    mailbox_id = int(mailbox.json()["id"])

    engine = ensure_tenant_schema(org_id)
    with Session(engine) as db:
        box = db.get(MailboxAccount, mailbox_id)
        assert box is not None
        row, was_created = _record_message(
            db,
            box,
            {
                "provider_message_id": "reply-" + uuid.uuid4().hex,
                "thread_id": "thread-" + uuid.uuid4().hex,
                "internet_message_id": "<reply-smoke@example.test>",
                "direction": "incoming",
                "folder": "inbox",
                "sender": buyer_email,
                "recipients": ["sales.reply-smoke@example.test"],
                "subject": "Re: Stainless steel hinge inquiry",
                "snippet": (
                    "Thanks. We need 5000 pcs. Specification: SUS304 4 inch. "
                    "Please quote FOB Shanghai. Delivery within 20 days."
                ),
                "received_at": datetime.now(timezone.utc),
                "has_unsubscribe": False,
            },
        )
        assert was_created and row.lead_id == lead_id

    ctx = client.get(f"/api/leads/{lead_id}/development-context")
    assert ctx.status_code == 200, ctx.text
    ctx_body = ctx.json()
    assert ctx_body["lead"]["status"] == "replied", ctx_body["lead"]
    reply = ctx_body["low_input"]["latest_reply"]
    assert reply, ctx_body["low_input"]
    facts = {x["key"]: x["value"] for x in reply["facts"]}
    assert "5000 pcs" in facts.get("quantity", ""), facts
    assert "FOB" in facts.get("incoterm", ""), facts
    assert "SUS304 4 inch" in facts.get("specification", ""), facts
    assert "20 days" in facts.get("delivery", ""), facts

    readiness = client.get(f"/api/leads/{lead_id}/mail-readiness?mailbox_id={mailbox_id}")
    assert readiness.status_code == 200, readiness.text
    checks = {x["key"]: x for x in readiness.json()["checks"]}
    assert checks["lifecycle"]["ok"] is False, checks
    assert checks["suppression"]["ok"] is False, checks
    assert readiness.json()["delivery_ready"] is False, readiness.text

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,1000")
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 35)
    landing: dict = {}

    try:
        driver.get(BASE + "/login")
        login = driver.execute_async_script(
            """
            const email=arguments[0],password=arguments[1],done=arguments[arguments.length-1];
            fetch('/api/auth/login',{
              method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({email,password})
            }).then(async r=>done({status:r.status,body:await r.text()}))
              .catch(e=>done({status:0,body:String(e)}));
            """,
            email,
            PASSWORD,
        )
        assert login["status"] == 200, login

        driver.get(BASE + "/")
        wait.until(lambda d: "/community/workspace.html" in d.current_url)
        wait.until(
            lambda d: d.execute_script(
                "return document.documentElement.dataset.huidiCloud || ''"
            )
            == "ready"
        )
        wait.until(
            lambda d: d.execute_script(
                "return Boolean(window.HUIDICommunityDevelopmentRouting)"
            )
        )

        opened = driver.execute_script(
            """
            const nav=document.querySelector('.nav-btn[data-view="online-find"]');
            if(!nav)return false;
            nav.click();
            setTimeout(()=>window.HUIDICommunityOnlineFullV2?.openTab?.('online-find','develop'),20);
            return true;
            """
        )
        assert opened
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#hdwLead'))"))
        selected = driver.execute_script(
            """
            const id=String(arguments[0]);
            const s=document.querySelector('#hdwLead');
            if(!s||![...s.options].some(x=>x.value===id))return false;
            s.value=id;
            s.dispatchEvent(new Event('change',{bubbles:true}));
            return true;
            """,
            lead_id,
        )
        assert selected
        wait.until(
            lambda d: d.execute_script(
                "return Boolean(document.querySelector('[data-hdw-reply-bridge]'))"
            )
        )

        ui = driver.execute_script(
            """
            const card=document.querySelector('[data-hdw-reply-bridge]');
            return {
              text:card?.innerText||'',
              generateDisabled:Boolean(document.querySelector('[data-hdw-generate]')?.disabled),
              approveDisabled:Boolean(document.querySelector('[data-hdw-approve]')?.disabled),
              armDisabled:Boolean(document.querySelector('[data-hdw-arm]')?.disabled),
              prepare:Boolean(document.querySelector('[data-hdw-prepare-inquiry]')),
              iframeCount:document.querySelectorAll('iframe').length
            };
            """
        )
        assert "客户已回复" in ui["text"], ui
        assert "5000 pcs" in ui["text"], ui
        assert "FOB" in ui["text"], ui
        assert "SUS304 4 inch" in ui["text"], ui
        assert ui["generateDisabled"] and ui["approveDisabled"] and ui["armDisabled"], ui
        assert ui["prepare"], ui
        assert ui["iframeCount"] == 0, ui
        assert len(driver.window_handles) == 1, driver.window_handles

        clicked = driver.execute_script(
            """
            const b=document.querySelector('[data-hdw-prepare-inquiry]');
            if(!b)return false;
            b.click();
            return true;
            """
        )
        assert clicked
        wait.until(
            lambda d: d.execute_async_script(
                """
                const id=arguments[0],done=arguments[arguments.length-1];
                fetch(`/api/leads/${id}/development-context`,{credentials:'same-origin'})
                  .then(r=>r.json()).then(x=>done(x.lead?.status||''))
                  .catch(()=>done(''));
                """,
                lead_id,
            )
            == "converted"
        )

        deadline = time.time() + 18
        while time.time() < deadline:
            landing = browser_snapshot(driver)
            if landing.get("view") == "deals" and landing.get("focused") == 1:
                break
            time.sleep(0.25)

        print("INQUIRY_LANDING_SNAPSHOT=" + json.dumps(landing, ensure_ascii=False))
        assert landing.get("view") == "deals", landing
        assert landing.get("dealsActive") is True, landing
        assert BUYER in landing.get("search", ""), landing
        focused_rows = [x for x in landing.get("rows", []) if x.get("focused") == "1"]
        assert len(focused_rows) == 1, landing
        assert BUYER in focused_rows[0].get("text", ""), landing
        assert landing.get("iframeCount") == 0, landing
        assert len(driver.window_handles) == 1, driver.window_handles
    finally:
        if not landing:
            try:
                landing = browser_snapshot(driver)
                print("INQUIRY_LANDING_FAILURE_SNAPSHOT=" + json.dumps(landing, ensure_ascii=False))
            except Exception as exc:
                print("INQUIRY_LANDING_FAILURE_SNAPSHOT_ERROR=" + repr(exc))
        driver.quit()

    deals = client.get(
        "/api/business/deals",
        params={"q": BUYER, "page": 1, "page_size": 20},
    )
    assert deals.status_code == 200, deals.text
    deal = next(
        x
        for x in deals.json()["items"]
        if int(x.get("source_lead_id") or 0) == lead_id
    )
    assert deal["stage"] == "qualified", deal
    assert float(deal["amount"] or 0) == 0.0, deal
    assert "5000 pcs" in deal["requirements"], deal
    assert "FOB" in deal["requirements"], deal
    assert "SUS304 4 inch" in deal["requirements"], deal
    assert "核对价格" in deal["next_action"], deal
    assert deal["product_keyword"] == "Stainless Steel Hinge", deal

    customers = client.get(
        "/api/business/customers",
        params={"q": BUYER, "page": 1, "page_size": 20},
    )
    assert customers.status_code == 200, customers.text
    assert any(
        int(x.get("source_lead_id") or 0) == lead_id
        for x in customers.json()["items"]
    ), customers.text

    print(
        "Customer reply -> cold-development stop -> confirmed facts -> formal inquiry "
        "-> Community inquiry landing with zero auto amount PASS"
    )
    client.close()


if __name__ == "__main__":
    main()
