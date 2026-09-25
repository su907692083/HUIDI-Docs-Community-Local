from __future__ import annotations

import json
import time
from urllib import request

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18086"


def http_json(path: str, method: str = "GET", body: dict | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8") or "{}")


def chrome_options() -> Options:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1440,1000")
    return opts


def click_visible(driver: webdriver.Chrome, wait: WebDriverWait, element) -> None:
    driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});", element)
    wait.until(
        lambda d: d.execute_script(
            """
            const r=arguments[0].getBoundingClientRect();
            const point=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return Boolean(r.width&&r.height&&(point===arguments[0]||arguments[0].contains(point)));
            """,
            element,
        )
    )
    element.click()


def main() -> None:
    stamp = str(int(time.time() * 1000))[-8:]
    products = []
    for index in (1, 2):
        brain_id = f"catalog-handoff-{stamp}-{index}"
        products.append(
            {
                "id": brain_id,
                "brain_id": brain_id,
                "local_product_id": brain_id,
                "name": f"Catalog Handoff Product {stamp}-{index}",
                "sku": f"HANDOFF-{stamp}-{index}",
                "category": "Hardware",
                "series": "Catalog Handoff",
                "spec": f"SUS304 / handoff spec {index}",
                "price_range": f"USD {10 + index}.00",
                "currency": "USD",
                "unit": "PCS",
                "moq": str(100 * index),
                "lead_time": "20 days",
                "certifications": [],
                "differentiators": ["catalog document handoff smoke"],
                "customer_cases": [],
                "company_facts": [],
                "target_keywords": ["handoff"],
                "allowed_claims": [],
                "restricted_claims": [],
            }
        )
    seeded = http_json("/api/product-brains/import", "POST", {"items": products})
    assert seeded.get("saved") == 2, seeded

    lead = http_json(
        "/api/leads/manual",
        "POST",
        {
            "company_name": f"Catalog Handoff Buyer {stamp}",
            "product_keyword": products[0]["name"],
            "country": "DE",
            "website": "",
            "contact_name": "Buyer",
            "contact_email": "",
            "requirements": "Create a quotation from products explicitly selected in the catalog",
            "create_inquiry": True,
        },
    )
    deal_id = int(lead["deal"]["id"])
    expected = {products[0]["brain_id"], products[1]["brain_id"]}

    driver = webdriver.Chrome(options=chrome_options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(30)
    wait = WebDriverWait(driver, 30)
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIProductServer?.sync === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIOnlineCatalog?.open === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDICatalogDocumentHandoff?.handoff === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIDocumentEntryConnectivity?.openForDeal === 'function'"))

        sync = driver.execute_async_script(
            """
            const done=arguments[arguments.length-1];
            Promise.resolve(window.HUIDIProductServer.sync()).then(v=>done(v||{})).catch(e=>done({ok:false,error:String(e)}));
            """
        )
        assert sync.get("ok") is True, sync

        context = driver.execute_async_script(
            """
            const [dealId,done]=arguments;
            fetch(`/api/business/deals/${dealId}`,{credentials:'same-origin'})
              .then(async response=>done({status:response.status,body:await response.text()}))
              .catch(error=>done({status:0,body:String(error)}));
            """,
            deal_id,
        )
        assert context["status"] == 200, context
        wait.until(lambda d: str(d.execute_script("return window.HUIDIBusinessContext.dealId();")) == str(deal_id))

        driver.execute_script("window.HUIDIOnlineCatalog.open()")
        wait.until(lambda d: d.find_elements(By.ID, "hocSearch"))
        driver.find_element(By.CSS_SELECTOR, "[data-hoc-none]").click()
        search = driver.find_element(By.ID, "hocSearch")
        search.clear()
        search.send_keys(f"Catalog Handoff Product {stamp}")
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")) == 2)

        # Every catalog selection re-renders the list. Re-query the live DOM for each click.
        for index in range(2):
            box = driver.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")[index]
            driver.execute_script("arguments[0].click();", box)
            wait.until(
                lambda d, count=index + 1: len(
                    d.execute_script("return window.HUIDIOnlineCatalog.selectedProductIds();")
                )
                == count
            )
        wait.until(
            lambda d: set(str(value) for value in d.execute_script("return window.HUIDIOnlineCatalog.selectedProductIds();"))
            == expected
        )

        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "[data-hoc-documents]").text == "加入单据工作台")
        click_visible(driver, wait, driver.find_element(By.CSS_SELECTOR, "[data-hoc-documents]"))
        confirmation = wait.until(EC.alert_is_present())
        assert "加入当前询盘" in confirmation.text, confirmation.text
        assert "正式单价、金额和执行数量仍需在单据中确认" in confirmation.text, confirmation.text
        confirmation.accept()

        wait.until(lambda d: "page=documents" in d.current_url)
        wait.until(EC.visibility_of_element_located((By.ID, "hdwList")))
        wait.until(
            lambda d: str(d.execute_script("return window.HUIDIDocumentEntryConnectivity?.dealId?.() || '';"))
            == str(deal_id)
        )
        linked = http_json(f"/api/business/deals/{deal_id}/products?limit=100")
        assert set(linked.get("selected") or []) == expected, linked

        active = driver.find_elements(By.CSS_SELECTOR, f'[data-hdw-deal="{deal_id}"]')
        assert active, f"deal {deal_id} must be visible in document workbench"
        if "active" not in (active[0].get_attribute("class") or "").split():
            click_visible(driver, wait, active[0])
        wait.until(
            lambda d: "active"
            in (d.find_element(By.CSS_SELECTOR, f'[data-hdw-deal="{deal_id}"]').get_attribute("class") or "").split()
        )
        click_visible(driver, wait, wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-hdw-doc="quotation"]'))))

        wait.until(EC.presence_of_element_located((By.ID, "hwpDocumentFrame")))
        wait.until(lambda d: "/documents/online/" in (d.find_element(By.ID, "hwpDocumentFrame").get_attribute("src") or ""))
        frame_src = driver.find_element(By.ID, "hwpDocumentFrame").get_attribute("src") or ""
        deal_after = http_json(f"/api/business/deals/{deal_id}")
        quotes = [item for item in (deal_after.get("documents") or []) if item.get("type") == "quotation"]
        assert len(quotes) == 1, deal_after
        quote_id = int(quotes[0]["id"])
        assert f"/documents/online/{quote_id}" in frame_src, (frame_src, quote_id)

        page_probe = driver.execute_async_script(
            """
            const [url, names, done]=arguments;
            fetch(url,{credentials:'same-origin'}).then(async response=>{
              const text=await response.text();
              done({
                status:response.status,
                rowCount:(text.match(/<tr data-item-row/g)||[]).length,
                names:names.map(name=>text.includes(name)),
                hasNativeHeader:text.includes('data-huidi-native-header')
              });
            }).catch(error=>done({status:0,error:String(error)}));
            """,
            f"/documents/online/{quote_id}",
            [product["name"] for product in products],
        )
        print("CATALOG_HANDOFF_NATIVE_PAGE=" + json.dumps(page_probe, ensure_ascii=False))
        assert page_probe.get("status") == 200, page_probe
        assert page_probe.get("rowCount") == 2, page_probe
        assert page_probe.get("names") == [True, True], page_probe
        assert page_probe.get("hasNativeHeader") is True, page_probe

        driver.switch_to.frame(driver.find_element(By.ID, "hwpDocumentFrame"))
        WebDriverWait(driver, 15).until(lambda d: d.execute_script("return document.readyState") == "complete")
        snapshot = {}
        for _ in range(60):
            snapshot = driver.execute_script(
                """
                const rows=[...document.querySelectorAll('tr[data-item-row],.item-row')];
                const val=(row,selectors)=>{
                  for(const selector of selectors){
                    const node=row.querySelector(selector);
                    if(node)return String(node.value??node.textContent??'');
                  }
                  return '';
                };
                return {
                  url:location.href,
                  title:document.title,
                  ready:document.readyState,
                  rows:rows.map(row=>({
                    product:val(row,['[data-item-k="product"]','.i-name']),
                    sku:val(row,['[data-item-k="sku"]','.i-sku']),
                    spec:val(row,['[data-item-k="spec"]','.i-spec']),
                    price:val(row,['[data-item-k="unit_price"]','.i-price'])
                  })),
                  header:Boolean(document.querySelector('.top[data-huidi-native-header]')),
                  body:String(document.body?.innerText||'').slice(0,800)
                };
                """
            )
            if len(snapshot.get("rows") or []) >= 2:
                break
            time.sleep(0.25)
        print("CATALOG_HANDOFF_FRAME=" + json.dumps(snapshot, ensure_ascii=False))
        rows = snapshot.get("rows") or []
        assert len(rows) == 2, snapshot
        assert {row["product"] for row in rows} == {product["name"] for product in products}, rows
        assert {row["sku"] for row in rows} == {product["sku"] for product in products}, rows
        for product in products:
            assert any(product["spec"] in row["spec"] for row in rows if row["sku"] == product["sku"]), rows
        assert all(row["price"] == "" for row in rows), rows
        assert snapshot.get("header") is True, snapshot
        driver.switch_to.default_content()

        print(
            "HUIDI Catalog -> Document explicit handoff Chrome PASS:",
            {
                "deal_id": deal_id,
                "selected": sorted(expected),
                "workbench": "page=documents",
                "quotation": frame_src,
                "quotation_rows": len(rows),
                "sku_spec_reused": True,
                "formal_prices_blank": True,
            },
        )
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
