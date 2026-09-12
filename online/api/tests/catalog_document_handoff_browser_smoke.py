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

        boxes = driver.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")
        for box in boxes:
            driver.execute_script("arguments[0].click();", box)
        expected = {products[0]["brain_id"], products[1]["brain_id"]}
        wait.until(
            lambda d: set(
                str(value)
                for value in d.execute_script("return window.HUIDIOnlineCatalog.selectedProductIds();")
            )
            == expected
        )

        docs_button = driver.find_element(By.CSS_SELECTOR, "[data-hoc-documents]")
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "[data-hoc-documents]").text == "加入单据工作台")
        click_visible(driver, wait, docs_button)
        confirmation = wait.until(EC.alert_is_present())
        assert "加入当前询盘" in confirmation.text, confirmation.text
        assert "正式单价、金额和执行数量仍需在单据中确认" in confirmation.text, confirmation.text
        confirmation.accept()

        wait.until(lambda d: "page=documents" in d.current_url)
        wait.until(
            lambda d: str(d.execute_script("return window.HUIDIDocumentEntryConnectivity?.dealId?.() || '';"))
            == str(deal_id)
        )
        linked = http_json(f"/api/business/deals/{deal_id}/products?limit=100")
        assert set(linked.get("selected") or []) == expected, linked

        driver.execute_script(
            "window.HUIDIDocumentEntryConnectivity.openForDeal(arguments[0],'quotation');",
            str(deal_id),
        )
        wait.until(lambda d: "/documents/online/" in d.current_url)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "[data-item-row]")) == 2)

        row_text = "\n".join(row.text for row in driver.find_elements(By.CSS_SELECTOR, "[data-item-row]"))
        for product in products:
            assert product["name"] in row_text, row_text
            assert product["sku"] in row_text, row_text
        prices = driver.find_elements(By.CSS_SELECTOR, "input[data-item-k='unit_price']")
        assert len(prices) == 2, len(prices)
        assert all((field.get_attribute("value") or "") == "" for field in prices), [field.get_attribute("value") for field in prices]

        print(
            "HUIDI Catalog -> Document explicit handoff Chrome PASS:",
            {
                "deal_id": deal_id,
                "selected": sorted(expected),
                "workbench": "page=documents",
                "quotation_rows": len(prices),
                "formal_prices_blank": True,
            },
        )
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
