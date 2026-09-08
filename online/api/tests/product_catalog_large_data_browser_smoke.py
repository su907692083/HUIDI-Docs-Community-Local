from __future__ import annotations

import json
from urllib import request

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18086"


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


def main() -> None:
    items = []
    for i in range(1, 56):
        brain_id = f"catalog-large-{i:03d}"
        items.append(
            {
                "id": brain_id,
                "brain_id": brain_id,
                "local_product_id": brain_id,
                "name": f"Catalog Product {i:03d}",
                "sku": f"CAT-{i:03d}",
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

    legacy = http_json("/api/product-brains")
    assert isinstance(legacy, list) and len(legacy) == 55, len(legacy) if isinstance(legacy, list) else legacy
    first_api = http_json("/api/product-brains?paged=1&page=1&page_size=50")
    second_api = http_json("/api/product-brains?paged=1&page=2&page_size=50")
    assert first_api["total"] == 55 and len(first_api["items"]) == 50, first_api
    assert second_api["total"] == 55 and len(second_api["items"]) == 5, second_api

    driver = webdriver.Chrome(options=chrome_options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(20)
    wait = WebDriverWait(driver, 25)
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIProductServer?.sync === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIOnlineCatalog?.open === 'function'"))

        first_sync = wait_product_sync(driver)
        second_sync = wait_product_sync(driver)
        assert second_sync.get("mode") == "state-only", (first_sync, second_sync)

        driver.execute_script(
            """
            window.__hocFetchUrls = [];
            window.__hocOriginalFetch = window.fetch;
            window.fetch = function(...args) {
              const url = String(args[0]);
              if (url.startsWith('/api/product-brains')) window.__hocFetchUrls.push(url);
              return window.__hocOriginalFetch.apply(this, args);
            };
            """
        )

        driver.execute_script("window.HUIDIOnlineCatalog.open()")
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocList .hoc-item")) == 50)
        wait.until(lambda d: "共 55 个产品" in d.find_element(By.ID, "hocPager").text)

        first_urls = driver.execute_script("return Array.from(window.__hocFetchUrls || []);")
        assert any("paged=1" in u and "page=1" in u and "page_size=50" in u for u in first_urls), first_urls
        assert "/api/product-brains" not in first_urls, first_urls

        driver.find_element(By.CSS_SELECTOR, "[data-hoc-none]").click()
        first_box = driver.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")[0]
        driver.execute_script("arguments[0].click();", first_box)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocPreview .hoc-card")) == 1)

        driver.find_element(By.CSS_SELECTOR, "[data-hoc-next]").click()
        wait.until(lambda d: "第 2/2 页" in d.find_element(By.ID, "hocPager").text)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocList .hoc-item")) == 5)

        second_box = driver.find_elements(By.CSS_SELECTOR, "#hocList [data-hoc-select]")[0]
        driver.execute_script("arguments[0].click();", second_box)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocPreview .hoc-card")) == 2)

        page_urls = driver.execute_script("return Array.from(window.__hocFetchUrls || []);")
        assert any("paged=1" in u and "page=2" in u and "page_size=50" in u for u in page_urls), page_urls
        assert "/api/product-brains" not in page_urls, page_urls

        search = driver.find_element(By.ID, "hocSearch")
        search.clear()
        search.send_keys("Catalog Product 003")
        wait.until(lambda d: "共 1 个产品" in d.find_element(By.ID, "hocPager").text)
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#hocList .hoc-item")) == 1)
        assert "Catalog Product 003" in driver.find_element(By.CSS_SELECTOR, "#hocList .hoc-item").text

        final_urls = driver.execute_script("return Array.from(window.__hocFetchUrls || []);")
        assert any("paged=1" in u and "q=Catalog+Product+003" in u for u in final_urls), final_urls
        assert "/api/product-brains" not in final_urls, final_urls

        print(
            "HUIDI Product Catalog large-data pagination PASS:",
            {
                "seeded": seeded.get("saved"),
                "page1": len(first_api["items"]),
                "page2": len(second_api["items"]),
                "preview_cross_page": len(driver.find_elements(By.CSS_SELECTOR, "#hocPreview .hoc-card")),
                "search_total": 1,
                "catalog_urls": final_urls,
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
