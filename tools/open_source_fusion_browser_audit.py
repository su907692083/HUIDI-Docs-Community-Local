"""Focused real-browser evidence for HUIDI open-source fusion P2/P3/P4.

Runs only against an isolated temporary tenant/database. It verifies that the
capabilities absorbed from knowledge/AI, automation/analytics and CRM/Product
references are actually reachable from the fused Community workspace without
creating duplicate business owners or fabricating provider success.
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


def start_server(output: Path):
    temp = tempfile.TemporaryDirectory(prefix="huidi-os-fusion-")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = {
        k: v
        for k, v in os.environ.items()
        if not any(token in k for token in ("API_KEY", "CLIENT_SECRET", "CLIENT_ID", "SMTP_PASSWORD"))
    }
    env.update(
        HUIDI_SECRET_KEY=uuid.uuid4().hex,
        HUIDI_DISABLE_BACKGROUND_JOBS="1",
        HUIDI_AUTO_BACKUP="0",
        HUIDI_TEAM_ACCESS="1",
        HUIDI_SIGNUP_ENABLED="1",
        HUIDI_COMMUNITY_SURFACE="1",
        DATABASE_URL=f"sqlite:///{temp.name}/app.db",
    )
    log_handle = (output / "server.log").open("w")
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.daily_app:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT / "online/api",
        env=env,
        stdout=log_handle,
        stderr=log_handle,
    )
    for _ in range(100):
        try:
            if httpx.get(base + "/login", timeout=1).status_code == 200:
                return temp, log_handle, process, base
        except httpx.HTTPError:
            pass
        if process.poll() is not None:
            break
        time.sleep(0.2)
    process.terminate()
    log_handle.close()
    temp.cleanup()
    raise RuntimeError("isolated open-source fusion server did not start")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="/tmp/huidi-open-source-fusion-browser")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    temp, log_handle, process, base = start_server(output)
    try:
        run_browser(base, output)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log_handle.close()
        temp.cleanup()


def run_browser(base: str, output: Path) -> None:
    report: dict[str, object] = {
        "mode": "isolated-open-source-fusion-browser",
        "checks": [],
        "screens": [],
        "page_errors": [],
        "http_errors": [],
    }

    def record(name: str, ok: bool, detail=""):
        report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
        if not ok:
            raise AssertionError(f"{name}: {detail}")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1640, "height": 920}, locale="zh-CN")
        registered = context.request.post(
            base + "/api/auth/register",
            data={
                "account_type": "individual",
                "display_name": "Open Source Fusion QA",
                "organization_name": "",
                "email": f"os-fusion-{uuid.uuid4().hex[:10]}@example.test",
                "password": "Open-source-fusion-browser-2026",
            },
        )
        assert registered.status == 200, registered.text()

        page = context.new_page()
        page.set_default_timeout(10000)
        page.on("pageerror", lambda error: report["page_errors"].append(getattr(error, "stack", None) or str(error)))
        page.on(
            "response",
            lambda response: report["http_errors"].append(
                {"url": response.url.replace(base, ""), "status": response.status}
            )
            if response.status >= 500
            else None,
        )
        page.goto(base + "/", wait_until="domcontentloaded")
        page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready'", timeout=35000)
        page.wait_for_function("() => Boolean(window.HUIDICommunityOnlineFullV2)", timeout=15000)
        page.wait_for_function("() => Boolean(window.HUIDICommunityCloudAdapter)", timeout=15000)
        page.wait_for_function("() => Boolean(window.HUIDIBusinessActivityTimeline)", timeout=15000)
        page.wait_for_function("() => Boolean(window.HUIDIKnowledgeContext)", timeout=15000)
        page.wait_for_function("() => Boolean(window.HUIDIFusedP3Closure)", timeout=15000)

        def screenshot(name: str):
            path = output / f"{name}.png"
            page.screenshot(path=str(path), full_page=True)
            report["screens"].append(str(path.name))

        def click_nav(view: str):
            button = page.locator(f'.sidebar .nav-btn[data-view="{view}"]')
            if not button.is_visible():
                more = page.locator(".huidi-online-more > summary")
                if more.count() and more.is_visible():
                    more.click()
            button.click()
            page.wait_for_function(
                '(v)=>document.querySelector(".view.active")?.id === "view-"+v', arg=view
            )
            page.wait_for_timeout(220)

        def click_tab(view: str, tab: str):
            target = page.locator(f'#view-{view} [data-fv2-tab="{tab}"]')
            if not target.is_visible():
                more = page.locator(f"#view-{view} .huidi-tab-more > summary")
                if more.count() and more.is_visible():
                    more.click()
            target.click()
            page.wait_for_function(
                '([v,t])=>Boolean(document.querySelector(`#view-${v} [data-fv2-pane="${t}"].active`))',
                arg=[view, tab],
            )
            page.wait_for_function(
                '([v,t])=>!document.querySelector(`#view-${v} [data-fv2-pane="${t}"]`)?.hasAttribute("aria-busy")',
                arg=[view, tab],
            )
            page.wait_for_timeout(180)

        # Seed Community-owned local business facts first, then push them through
        # the real cloud adapter. The local IDs are intentionally strings so the
        # activity API can prove continuity through community_sync's ID mapping.
        seeded = page.evaluate(
            """async () => {
              const r=HUIDILocalCore.repositories;
              r.customers.upsert({
                id:'qa-local-customer', company:'P5 Local Buyer', contact:'Mia Buyer',
                email:'mia@p5-local.example', country:'Germany', status:'active'
              });
              r.products.upsert({
                id:'qa-local-product', name:'P5 Fusion Stainless Hinge', sku:'P5-H304',
                spec:'SUS304 4 inch; reference price USD 3.20', material:'SUS304',
                unit:'PCS', moq:'1000 PCS', lead_time:'25 days', hs_code:'830210',
                country_of_origin:'CN', certifications:['RoHS'], package_type:'inner box + carton',
                carton_size:'42x30x25 cm', qty_per_carton:'50 PCS', gross_weight:'18 kg',
                price:'3.20', currency:'USD', differentiators:['salt-spray tested']
              });
              r.deals.upsert({
                id:'qa-local-deal', title:'P5 Local Inquiry', customer_id:'qa-local-customer',
                product_ids:['qa-local-product'], stage:'quoting', probability:50,
                currency:'EUR', estimated_amount:4200, product_keyword:'P5 Fusion Stainless Hinge',
                requirements:'Need RoHS and SUS304; quote price EUR 4.20 only after review',
                next_action:'Confirm packing', next_action_at:'2026-09-12'
              });
              const sync=await HUIDICommunityCloudAdapter.syncState();
              if(!sync)throw new Error('community sync returned empty result');
              const brains=await (await fetch('/api/product-brains',{credentials:'same-origin'})).json();
              const brain=(Array.isArray(brains)?brains:[]).find(x=>x.name==='P5 Fusion Stainless Hinge');
              if(!brain)throw new Error('synced product brain missing');
              const manual=await fetch('/api/leads/manual',{
                method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                  company_name:'P5 AI Buyer',product_keyword:'P5 Fusion Stainless Hinge',country:'Germany',
                  website:'https://p5-ai-buyer.example',contact_name:'Anna Buyer',contact_role:'Purchasing Manager',
                  contact_email:'anna@p5-ai-buyer.example',requirements:'Needs SUS304 and RoHS for a new sourcing project',
                  create_inquiry:true
                })
              });
              const manualOut=await manual.json();
              if(!manual.ok)throw new Error(JSON.stringify(manualOut));
              const leadId=manualOut.lead?.id;
              const productContext=await fetch(`/api/leads/${leadId}/product-context`,{
                method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({product_brain_id:brain.brain_id})
              });
              if(!productContext.ok)throw new Error(await productContext.text());
              return {leadId,brainId:brain.brain_id,customerId:manualOut.customer?.id,dealId:manualOut.deal?.id};
            }"""
        )
        lead_id = str(seeded["leadId"])
        record("seed-real-owner-chain", bool(lead_id and seeded.get("brainId")), seeded)

        # Runtime API evidence for knowledge retrieval, grounded AI no-provider
        # state, product-fact price isolation, Local-ID mapping, automation and BI.
        runtime = page.evaluate(
            """async ({leadId}) => {
              const get=async u=>{const r=await fetch(u,{credentials:'same-origin'});return {status:r.status,body:await r.json()}};
              const post=async (u,body)=>{const r=await fetch(u,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
              return {
                knowledge:await get('/api/knowledge/search?q='+encodeURIComponent('P5 Fusion Stainless Hinge')+'&limit=8'),
                ai:await post('/api/knowledge/suggest',{query:'P5 Fusion Stainless Hinge P5 AI Buyer',purpose:'outreach_strategy',language:'Chinese',max_sources:6}),
                development:await get(`/api/leads/${leadId}/development-context`),
                localCustomerActivity:await get('/api/business/customers/'+encodeURIComponent('qa-local-customer')+'/activity?limit=20'),
                localDealActivity:await get('/api/business/deals/'+encodeURIComponent('qa-local-deal')+'/activity?limit=20'),
                automation:await get('/api/automation/overview'),
                analytics:await get('/api/growth/funnel')
              };
            }""",
            {"leadId": lead_id},
        )
        knowledge = runtime["knowledge"]
        assert knowledge["status"] == 200, knowledge
        knowledge_text = json.dumps(knowledge["body"], ensure_ascii=False)
        record("knowledge-citations-visible", any(x.get("citation") for x in knowledge["body"].get("items", [])))
        record("knowledge-price-fragment-isolated", "3.20" not in knowledge_text and "价格已隔离" in knowledge_text, knowledge_text[:1200])
        ai = runtime["ai"]
        record("ai-no-provider-explicit", ai["status"] == 200 and ai["body"].get("mode") == "provider_unavailable", ai)
        record("ai-no-fake-suggestion", not ai["body"].get("suggestion"), ai["body"])
        facts = runtime["development"]["body"].get("low_input", {}).get("product_non_price_facts") or {}
        facts_text = json.dumps(facts, ensure_ascii=False)
        record("development-npi-facts-reused", facts.get("compliance", {}).get("hs_code") == "830210" and facts.get("packaging", {}).get("qty_per_carton") == "50 PCS", facts)
        record("development-npi-price-isolated", "3.20" not in facts_text and "价格已隔离" in facts_text, facts_text)
        record("local-customer-id-resolves", runtime["localCustomerActivity"]["status"] == 200 and runtime["localCustomerActivity"]["body"].get("entity", {}).get("requested_id") == "qa-local-customer", runtime["localCustomerActivity"])
        record("local-deal-id-resolves", runtime["localDealActivity"]["status"] == 200 and runtime["localDealActivity"]["body"].get("entity", {}).get("requested_id") == "qa-local-deal", runtime["localDealActivity"])
        automation = runtime["automation"]["body"]
        record("automation-notification-only", automation.get("guardrails", {}).get("allowed_actions") == ["notification_only"], automation.get("guardrails"))
        record("automation-high-risk-blocked", "change_formal_price" in automation.get("guardrails", {}).get("blocked_actions", []), automation.get("guardrails"))
        analytics = runtime["analytics"]["body"]
        record("analytics-read-only", analytics.get("guardrails", {}).get("read_only") is True and analytics.get("guardrails", {}).get("new_analytics_storage") is False, analytics.get("guardrails"))
        record("analytics-currency-separated", analytics.get("guardrails", {}).get("mixed_currency_totals") is False and isinstance(analytics.get("analysis", {}).get("pipeline_by_currency"), list), analytics.get("analysis", {}).get("pipeline_by_currency"))

        # Fused Home must surface the analytics projection, not leave it stranded
        # in the standalone shell.
        click_nav("home")
        page.wait_for_selector("#huidiFusedGrowthAnalytics")
        page.wait_for_function("() => document.querySelector('#huidiFusedGrowthAnalytics')?.innerText.includes('开发进度与经营分析')")
        home_text = page.locator("#huidiFusedGrowthAnalytics").inner_text()
        record("fused-home-analytics-visible", "不同币种分别统计" in home_text, home_text)
        screenshot("p3-home-analytics")

        # Fused Admin notifications must show the safe automation projection and
        # keep system/backup events explicitly opt-in.
        click_nav("online-admin")
        click_tab("online-admin", "notifications")
        page.wait_for_selector('[data-hfp3-automation]')
        page.wait_for_function("() => document.querySelector('[data-hfp3-automation]')?.innerText.includes('notification_only')")
        system_box = page.locator('[data-fv2-route-cat="system"]')
        record("fused-system-trigger-opt-in", system_box.count() == 1 and not system_box.is_checked())
        destination = page.locator("#fv2RouteDestination")
        record("fused-automation-https-copy", "HTTPS" in (destination.get_attribute("placeholder") or ""))
        screenshot("p3-automation-overview")

        # Knowledge UI lives inside the existing development owner. Open the exact
        # seeded Lead from the existing pool rather than creating another AI page.
        click_nav("online-find")
        click_tab("online-find", "pool")
        page.locator("#fv2PoolQ").fill("P5 AI Buyer")
        page.locator('[data-fv2-pool-form] button[type="submit"]').click()
        page.wait_for_function("() => document.querySelectorAll('#fv2PoolTable tbody tr[data-fv2-lead]').length===1")
        row = page.locator("#fv2PoolTable tbody tr[data-fv2-lead]").first
        assert row.get_attribute("data-fv2-lead") == lead_id
        row.locator('[data-hdw-route-action="develop"]').click()
        page.wait_for_function('(id)=>document.querySelector("#hdwLead")?.value===id', arg=lead_id)
        page.wait_for_selector('[data-hkc]')
        panel = page.locator('[data-hkc]')
        record("fused-knowledge-panel-visible", "HUIDI 知识引用" in panel.inner_text())
        panel.locator('[data-hkc-q]').fill("P5 Fusion Stainless Hinge")
        panel.locator('[data-hkc-search]').click()
        page.wait_for_function("() => document.querySelector('[data-hkc-list]')?.innerText.includes('产品资料')")
        panel.locator('[data-hkc-suggest]').click()
        page.wait_for_function("() => document.querySelector('[data-hkc-ai]')?.innerText.includes('AI 建议暂不可用')")
        record("fused-ai-provider-unavailable-honest", "不会用模板冒充 AI" in panel.locator('[data-hkc-ai]').inner_text())
        screenshot("p2-knowledge-ai")

        # Existing Customer/Deal quick drawers receive the timeline. The server
        # has already proven original Local IDs resolve, while the hydrated UI may
        # display the cloud numeric ID as intended by the adapter.
        click_nav("customers")
        customer_row = page.locator("#customerRows tr[data-quick-id]").filter(has_text="P5 Local Buyer").first
        customer_row.click()
        page.wait_for_selector("#huidiQuickBackdrop.open")
        page.wait_for_selector('[data-hbat-card][data-hbat-loaded="1"]')
        customer_timeline = page.locator('[data-hbat-card]').inner_text()
        record("customer-timeline-visible", "客户资料" in customer_timeline and "P5 Local Buyer" in customer_timeline, customer_timeline)
        screenshot("p4-customer-timeline")
        page.keyboard.press("Escape")
        page.wait_for_selector("#huidiQuickBackdrop.open", state="hidden")

        click_nav("deals")
        deal_row = page.locator("#dealRows tr[data-quick-id]").filter(has_text="P5 Local Inquiry").first
        deal_row.click()
        page.wait_for_selector("#huidiQuickBackdrop.open")
        page.wait_for_selector('[data-hbat-card][data-hbat-loaded="1"]')
        deal_timeline = page.locator('[data-hbat-card]').inner_text()
        record("deal-timeline-visible", "询盘 / 业务" in deal_timeline and "P5 Local Inquiry" in deal_timeline, deal_timeline)
        screenshot("p4-deal-timeline")

        record("no-page-errors", not report["page_errors"], report["page_errors"])
        record("no-server-5xx", not report["http_errors"], report["http_errors"])
        (output / "REPORT.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()


if __name__ == "__main__":
    main()
