from __future__ import annotations

import json
import time
from urllib import parse, request

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18086"
CATALOG_STATE_KEY = "huidi_online_catalog_page_v2"


def http_json(path: str, method: str = "GET", body: dict | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
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


def wait_product_sync(driver: webdriver.Chrome) -> dict:
    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        Promise.resolve(window.HUIDIProductServer.sync())
          .then(value => done(value || {}))
          .catch(error => done({ok:false,error:String(error)}));
        """
    )
    assert result.get("ok") is True, result
    return result


def selected_ids(driver: webdriver.Chrome) -> list[str]:
    return [str(value) for value in driver.execute_script("return window.HUIDIOnlineCatalog.selectedProductIds();")]


def main() -> None:
    stamp = str(int(time.time() * 1000))[-8:]
    items = []
    for i in range(1, 56):
        brain_id = f"catalog-large-{stamp}-{i:03d}"
        items.append(
            {
                "id": brain_id,
                "brain_id": brain_id,
                "local_product_id": brain_id,
                "name": f"Catalog Product {i:03d}",
                "sku": f"CAT-{stamp}-{i:03d}",
                "category": "Hardware" if i % 2 else "Garden",
                "series": f"Series {(i % 4) + 1}",
                "spec": f"SUS304 / size {i}",
                "price_range": "",
                "currency": "USD",
                "unit": "PCS",
                "moq": str(100 + i),
                "lead_time": "25 days",
                "certifications": [],
                "differentiators": ["catalog pagination smoke"],
                "customer_cases": [],
                "company_facts": [],
                "target_keywords": ["catalog", "product"],
                "allowed_claims": [],
                "restricted_claims": [],
            }
        )
    seeded = http_json("/api/product-brains/import", "POST", {"items": items})
    assert seeded.get("saved") == 55, seeded

    lead = http_json(
        "/api/leads/manual",
        "POST",
        {
            "company_name": f"Catalog Buyer {stamp}",
            "product_keyword": "Catalog Product 001",
            "country": "DE",
            "website": "",
            "contact_name": "Buyer",
            "contact_email": "",
            "requirements": "Need a customer product catalog before quotation",
            "create_inquiry": True,
        },
    )
    deal_id = int(lead["deal"]["id"])

    legacy = http_json("/api/product-brains")
    assert isinstance(legacy, list) and len(legacy) >= 55, len(legacy) if isinstance(legacy, list) else legacy
    first_api = http_json("/api/product-brains?paged=1&page=1&page_size=50")
    second_api = http_json("/api/product-brains?paged=1&page=2&page_size=50")
    assert first_api["total"] >= 55 and len(first_api["items"]) == 50, first_api
    assert len(second_api["items"]) >= 5, second_api

    ids_probe = items[0]["brain_id"] + "," + items[-1]["brain_id"]
    exact_api = http_json(
        "/api/product-brains?paged=1&page=1&page_size=100&ids=" + parse.quote(ids_probe, safe=","),
    )
    assert {row["brain_id"] for row in exact_api["items"]} == {items[0]["brain_id"], items[-1]["brain_id"]}, exact_api

    driver = webdriver.Chrome(options=chrome_options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(30)
    wait = WebDriverWait(driver, 30)
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIProductServer?.sync === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIOnlineCatalog?.open === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIBusinessContext?.dealId === 'function'"))

        first_sync = wait_product_sync(driver)
        second_sync = wait_product_sync(driver)
        assert second_sync.get("mode") == "state-only", (first_sync, second_sync)

        deal_context = driver.execute_async_script(
            """
            const [dealId, done] = arguments;
            fetch(`/api/business/deals/${dealId}`, {credentials:'same-origin'})
              .then(async response => done({status:response.status, body:await response.text()}))
              .catch(error => done({status:0, body:String(error)}));
            """,
            deal_id,
        )
        assert deal_context["status"] == 200, deal_context
        wait.until(lambda d: str(d.execute_script("return window.HUIDIBusinessContext.dealId();")) == str(deal_id))

        driver.execute_script(
            """
            window.__hocFetchUrls = [];
            window.__hocOriginalFetch = window.fetch;
            window.fetch = function(...args) {
              const url = String(args[0]);
              if (url.startsWith('/api/product-brains') || url.includes('/products')) window.__hocFetchUrls.push(url);
              return window.__hocOriginalFetch.apply(this, args);
            };
            """
        )

        driver.execute_script("window.HUIDIOnlineCatalog.open()")
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocList .hoc-item")) == 50)
        wait.until(lambda d: "当前询盘 #" in d.find_element(By.ID, "hocContext").text)
        wait.until(lambda d: "共 " in d.find_element(By.ID, "hocPager").text)

        first_urls = driver.execute_script("return Array.from(window.__hocFetchUrls || []);")
        assert any("paged=1" in u and "page=1" in u and "page_size=50" in u for u in first_urls), first_urls
        assert "/api/product-brains" not in first_urls, first_urls

        driver.find_element(By.CSS_SELECTOR, "[data-hoc-none]").click()
        first_box = driver.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")[0]
        first_id = str(first_box.get_attribute("data-hoc-select"))
        driver.execute_script("arguments[0].click();", first_box)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocPreview .hoc-card")) == 1)

        driver.find_element(By.CSS_SELECTOR, "[data-hoc-next]").click()
        wait.until(lambda d: "第 2/" in d.find_element(By.ID, "hocPager").text)
        page2_boxes = driver.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")
        assert page2_boxes
        second_box = page2_boxes[0]
        second_id = str(second_box.get_attribute("data-hoc-select"))
        driver.execute_script("arguments[0].click();", second_box)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocPreview .hoc-card")) == 2)
        assert set(selected_ids(driver)) == {first_id, second_id}, selected_ids(driver)

        sync_button = driver.find_element(By.CSS_SELECTOR, "[data-hoc-sync-deal]")
        sync_button.click()
        confirmation = wait.until(EC.alert_is_present())
        assert "产品关联与目录选择一致" in confirmation.text, confirmation.text
        confirmation.accept()
        wait.until(lambda d: "已同步 2 个产品" in d.find_element(By.ID, "hocContext").text)

        linked = http_json(f"/api/business/deals/{deal_id}/products?limit=100")
        assert set(linked.get("selected") or []) == {first_id, second_id}, linked

        driver.find_element(By.CSS_SELECTOR, "[data-hoc-none]").click()
        wait.until(lambda d: len(selected_ids(d)) == 0)
        driver.find_element(By.CSS_SELECTOR, "[data-hoc-load-deal]").click()
        wait.until(lambda d: set(selected_ids(d)) == {first_id, second_id})
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocPreview .hoc-card")) == 2)

        current_rows = {row["brain_id"]: row for row in http_json("/api/product-brains")}
        changed = dict(current_rows[first_id])
        changed["name"] = "Catalog Product Synced Live"
        changed["spec"] = "SUS316 / synchronized latest catalog specification"
        updated = http_json("/api/product-brains/import", "POST", {"items": [changed]})
        assert updated.get("changed") == 1, updated

        sync_after_server_change = wait_product_sync(driver)
        assert sync_after_server_change.get("mode") == "full", sync_after_server_change
        wait.until(lambda d: "Catalog Product Synced Live" in d.find_element(By.ID, "hocPreview").text)
        wait.until(lambda d: "synchronized latest catalog specification" in d.find_element(By.ID, "hocPreview").text)

        catalog_state = driver.execute_script(
            "return JSON.parse(localStorage.getItem(arguments[0]) || '{}');",
            CATALOG_STATE_KEY,
        )
        assert "selected_items" not in catalog_state, catalog_state
        assert set(catalog_state.get("selected") or []) == {first_id, second_id}, catalog_state

        final_urls = driver.execute_script("return Array.from(window.__hocFetchUrls || []);")
        assert any("ids=" in url for url in final_urls if url.startswith("/api/product-brains?")), final_urls
        assert any(f"/api/business/deals/{deal_id}/products" in url for url in final_urls), final_urls

        driver.find_element(By.CSS_SELECTOR, "[data-hoc-documents]").click()
        wait.until(lambda d: "page=documents" in d.current_url)
        wait.until(lambda d: str(d.execute_script("return window.HUIDIDocumentEntryConnectivity?.dealId?.() || '';")) == str(deal_id))

        print(
            "HUIDI Product Catalog canonical sync/linkage PASS:",
            {
                "seeded": seeded.get("saved"),
                "page1": len(first_api["items"]),
                "page2": len(second_api["items"]),
                "selected_cross_page": [first_id, second_id],
                "deal_id": deal_id,
                "deal_selected": linked.get("selected"),
                "live_refresh": "Catalog Product Synced Live",
                "stale_snapshot_removed": "selected_items" not in catalog_state,
                "document_workbench": driver.current_url,
            },
        )
    finally:
        try:
            driver.execute_script(
                """
                if (window.__hocOriginalFetch) window.fetch = window.__hocOriginalFetch;
                delete window.__hocOriginalFetch;
                delete window.__hocFetchUrls;
                """
            )
        except Exception:
            pass
        driver.quit()


if __name__ == "__main__":
    main()
