from __future__ import annotations

import json
import uuid

import httpx
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18085"
PASSWORD = "formal-price-guard-password-2026"
CUSTOMER_ID = "formal-price-guard-customer"
PRODUCT_ID = "formal-price-guard-product"
DEAL_ID = "formal-price-guard-deal"
REFERENCE_PRICE = "1.25"


def main() -> None:
    email = f"formal-price-guard-{uuid.uuid4().hex[:12]}@example.test"
    client = httpx.Client(base_url=BASE, follow_redirects=False, timeout=20)
    registered = client.post(
        "/api/auth/register",
        json={
            "account_type": "individual",
            "display_name": "Formal Price Guard Browser",
            "organization_name": "",
            "email": email,
            "password": PASSWORD,
        },
    )
    assert registered.status_code == 200, registered.text
    org_id = int(registered.json()["organization"]["id"])
    assert org_id > 1, registered.text

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1440,1000")
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 35)
    snapshot: dict = {}

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
                "return Boolean(window.HUIDILocalCore?.repositories?.products && window.HUIDILocalCore?.context)"
            )
        )

        prepared = driver.execute_script(
            """
            const core=window.HUIDILocalCore;
            if(!core?.repositories?.customers||!core?.repositories?.products||!core?.repositories?.deals||!core?.context)return null;
            const customer=core.repositories.customers.upsert({
              id:arguments[0],company:'Formal Price Guard Buyer',contact:'Manual Price Reviewer',
              email:'buyer.formal-price@example.test',country:'Germany',currency:'USD'
            },{silent:true});
            const product=core.repositories.products.upsert({
              id:arguments[1],local_product_id:arguments[1],brain_id:arguments[1],
              name:'Reference Price Hinge',sku:'RPG-1',spec:'SUS304 4 inch',
              price:1.25,currency:'USD',unit:'PCS',moq:'500 pcs',source:'HUIDI Online'
            },{silent:true});
            const deal=core.repositories.deals.upsert({
              id:arguments[2],customer_id:customer.id,title:'Formal Price Guard Deal',
              stage:'qualified',currency:'USD',estimated_amount:0,amount:0,
              probability:30,product_ids:[product.id],
              requirements:'Please quote after manual price confirmation.',
              next_action:'核对价格后报价'
            },{silent:true});
            const ctx=core.context.create({
              type:'quotation',dealId:deal.id,customerId:customer.id,productIds:[product.id]
            });
            return {
              scope:window.HUIDI_WORKSPACE_STORAGE?.scope||'',
              contextDealId:String(ctx?.dealId||''),
              contextProductIds:(ctx?.productIds||[]).map(String),
              contextPrice:String(ctx?.products?.[0]?.price??''),
              formalDealAmount:Number(deal.estimated_amount||deal.amount||0)
            };
            """,
            CUSTOMER_ID,
            PRODUCT_ID,
            DEAL_ID,
        )
        print("FORMAL_PRICE_CONTEXT=" + json.dumps(prepared, ensure_ascii=False))
        assert prepared, prepared
        assert prepared["scope"] == f"org-{org_id}", prepared
        assert prepared["contextDealId"] == DEAL_ID, prepared
        assert PRODUCT_ID in prepared["contextProductIds"], prepared
        assert prepared["contextPrice"] == REFERENCE_PRICE, prepared
        assert prepared["formalDealAmount"] == 0, prepared

        driver.get(BASE + "/community/editor.html?type=quotation&doc=quotation&local=1")
        wait.until(
            lambda d: d.execute_script(
                "return Boolean(window.HUIDICommunityFormalPriceGuard)"
            )
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.documentElement.dataset.huidiFormalPriceGuard || ''"
            )
            == "reference-only"
        )
        wait.until(
            lambda d: d.execute_script(
                "return Boolean([...document.querySelectorAll('.item-row')].find(r=>r.dataset.huidiProductId===arguments[0]))",
                PRODUCT_ID,
            )
        )

        snapshot = driver.execute_script(
            """
            const id=arguments[0];
            const row=[...document.querySelectorAll('.item-row')].find(r=>r.dataset.huidiProductId===id);
            const price=row?.querySelector('.i-price');
            const ctx=JSON.parse(sessionStorage.getItem('huidi_local_document_context_v2')||'null');
            return {
              route:location.pathname,
              scope:window.HUIDI_WORKSPACE_STORAGE?.scope||'',
              policy:document.documentElement.dataset.huidiFormalPriceGuard||'',
              guardVersion:window.HUIDICommunityFormalPriceGuard?.version||'',
              productName:row?.querySelector('.i-name')?.value||'',
              productId:row?.dataset.huidiProductId||'',
              formalPrice:price?.value||'',
              referencePrice:price?.dataset.huidiReferencePrice||'',
              placeholder:price?.placeholder||'',
              title:price?.title||'',
              contextDealId:String(ctx?.dealId||''),
              contextReferencePrice:String(ctx?.products?.[0]?.price??''),
              sourceDocumentId:String(ctx?.sourceDocumentId||''),
              iframeCount:document.querySelectorAll('iframe').length
            };
            """,
            PRODUCT_ID,
        )
        print("FORMAL_PRICE_GUARD_SNAPSHOT=" + json.dumps(snapshot, ensure_ascii=False))
        assert snapshot["route"] == "/community/editor.html", snapshot
        assert snapshot["scope"] == f"org-{org_id}", snapshot
        assert snapshot["policy"] == "reference-only", snapshot
        assert snapshot["guardVersion"] == "1.0.1", snapshot
        assert snapshot["productName"] == "Reference Price Hinge", snapshot
        assert snapshot["productId"] == PRODUCT_ID, snapshot
        assert snapshot["contextDealId"] == DEAL_ID, snapshot
        assert snapshot["contextReferencePrice"] == REFERENCE_PRICE, snapshot
        assert snapshot["sourceDocumentId"] == "", snapshot
        assert snapshot["formalPrice"] == "", snapshot
        assert snapshot["referencePrice"] == REFERENCE_PRICE, snapshot
        assert "USD 1.25" in snapshot["placeholder"], snapshot
        assert "不会自动写入正式单价" in snapshot["title"], snapshot
        assert snapshot["iframeCount"] == 0, snapshot
    finally:
        if not snapshot:
            try:
                print(
                    "FORMAL_PRICE_GUARD_FAILURE="
                    + json.dumps(
                        driver.execute_script(
                            """
                            return {
                              url:location.href,
                              scope:window.HUIDI_WORKSPACE_STORAGE?.scope||'',
                              policy:document.documentElement.dataset.huidiFormalPriceGuard||'',
                              guard:Boolean(window.HUIDICommunityFormalPriceGuard),
                              rows:[...document.querySelectorAll('.item-row')].map(r=>({
                                id:r.dataset.huidiProductId||'',name:r.querySelector('.i-name')?.value||'',
                                price:r.querySelector('.i-price')?.value||'',reference:r.querySelector('.i-price')?.dataset.huidiReferencePrice||''
                              }))
                            };
                            """
                        ),
                        ensure_ascii=False,
                    )
                )
            except Exception as exc:
                print("FORMAL_PRICE_GUARD_FAILURE_ERROR=" + repr(exc))
        driver.quit()
        client.close()

    print(
        "Community Deal/Product context -> formal quotation editor -> reference price visible "
        "but formal unit price remains empty until human confirmation PASS"
    )


if __name__ == "__main__":
    main()
