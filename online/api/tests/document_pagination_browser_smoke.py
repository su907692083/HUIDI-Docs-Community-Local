from __future__ import annotations

import json
import time

from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18080"
SEED_COUNT = 55


def options() -> Options:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1440,1000")
    return opts


def pointer_click(driver: webdriver.Chrome, element) -> None:
    driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'nearest'});", element)
    ActionChains(driver).move_to_element(element).pause(0.05).click().perform()


def dom_text(driver: webdriver.Chrome, selector: str) -> str:
    return str(
        driver.execute_script(
            "return document.querySelector(arguments[0])?.textContent || '';",
            selector,
        )
        or ""
    )


def dom_attr(driver: webdriver.Chrome, selector: str, attribute: str) -> str:
    return str(
        driver.execute_script(
            "return document.querySelector(arguments[0])?.getAttribute(arguments[1]) || '';",
            selector,
            attribute,
        )
        or ""
    )


def seed_deals(driver: webdriver.Chrome, stamp: str) -> list[int]:
    result = driver.execute_async_script(
        """
        const [count, stamp, done] = arguments;
        (async () => {
          const ids = [];
          for (let i = 0; i < count; i += 1) {
            const suffix = String(i).padStart(3, '0');
            const response = await fetch('/api/leads/manual', {
              method: 'POST',
              credentials: 'same-origin',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                company_name: `Document Scale ${stamp}-${suffix}`,
                product_keyword: 'stainless steel hinge',
                country: 'DE',
                website: '',
                contact_name: 'Buyer',
                contact_email: '',
                requirements: 'Quantity 1000 pcs',
                create_inquiry: true
              })
            });
            const body = await response.text();
            if (!response.ok) {
              done({ok: false, status: response.status, body});
              return;
            }
            const payload = JSON.parse(body || '{}');
            if (!payload.deal?.id) {
              done({ok: false, status: response.status, body});
              return;
            }
            ids.push(Number(payload.deal.id));
          }
          done({ok: true, ids});
        })().catch(error => done({ok: false, status: 0, body: String(error)}));
        """,
        SEED_COUNT,
        stamp,
    )
    assert result.get("ok"), result
    ids = [int(value) for value in result.get("ids", [])]
    assert len(ids) == SEED_COUNT, result
    return ids


def get_json(driver: webdriver.Chrome, path: str) -> dict:
    result = driver.execute_async_script(
        """
        const [path, done] = arguments;
        fetch(path, {credentials: 'same-origin'})
          .then(async response => done({status: response.status, body: await response.text()}))
          .catch(error => done({status: 0, body: String(error)}));
        """,
        path,
    )
    assert 200 <= int(result["status"]) < 400, result
    return json.loads(result["body"] or "{}")


def main() -> None:
    driver = webdriver.Chrome(options=options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(120)
    wait = WebDriverWait(driver, 30)
    stamp = str(int(time.time() * 1000))[-8:]
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIDocumentWorkbench?.open") == "function")
        seeded_ids = seed_deals(driver, stamp)
        assert len(seeded_ids) > 50

        hub = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".side [data-huidi-doc-workbench]")))
        pointer_click(driver, hub)
        wait.until(EC.visibility_of_element_located((By.ID, "hdwList")))
        wait.until(lambda d: "第 1/" in dom_text(d, "#hdwPager small"))

        first_rows = driver.find_elements(By.CSS_SELECTOR, "#hdwList [data-hdw-deal]")
        assert len(first_rows) == 50, len(first_rows)
        first_ids = {int(row.get_attribute("data-hdw-deal")) for row in first_rows}
        assert set(seeded_ids[-50:]).issubset(first_ids), (seeded_ids[-50:], sorted(first_ids))

        next_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-hdw-next]")))
        driver.execute_script(
            """
            window.__hdwFetchUrls = [];
            window.__hdwOriginalFetch = window.fetch;
            window.fetch = function(...args) {
              window.__hdwFetchUrls.push(String(args[0]));
              return window.__hdwOriginalFetch.apply(this, args);
            };
            """
        )
        pointer_click(driver, next_button)
        wait.until(lambda d: "第 2/" in dom_text(d, "#hdwPager small"))
        fetch_urls = driver.execute_script("return Array.from(window.__hdwFetchUrls || []);")
        assert any(
            url.startswith("/api/business/deals?") and "page=2" in url and "page_size=50" in url
            for url in fetch_urls
        ), fetch_urls

        second_rows = driver.find_elements(By.CSS_SELECTOR, "#hdwList [data-hdw-deal]")
        assert second_rows, "second page must contain deals"
        second_ids = {int(row.get_attribute("data-hdw-deal")) for row in second_rows}
        assert first_ids.isdisjoint(second_ids), (sorted(first_ids), sorted(second_ids))

        target = next(
            (
                row for row in second_rows
                if f"Document Scale {stamp}-" in row.text
                and int(row.get_attribute("data-hdw-deal")) in seeded_ids[:5]
            ),
            None,
        )
        assert target is not None, [row.text for row in second_rows]
        target_id = int(target.get_attribute("data-hdw-deal"))
        assert target_id not in first_ids
        pointer_click(driver, target)
        wait.until(
            lambda d: "active"
            in dom_attr(d, f'[data-hdw-deal="{target_id}"]', "class").split()
        )

        quote = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-hdw-doc="quotation"]')))
        pointer_click(driver, quote)
        wait.until(EC.presence_of_element_located((By.ID, "hwpDocumentFrame")))
        wait.until(lambda d: "/documents/online/" in dom_attr(d, "#hwpDocumentFrame", "src"))
        frame_src = dom_attr(driver, "#hwpDocumentFrame", "src")
        assert "8765" not in frame_src, frame_src

        deal = get_json(driver, f"/api/business/deals/{target_id}")
        documents = deal.get("documents") or []
        assert any(item.get("type") == "quotation" for item in documents), documents

        driver.execute_script(
            """
            if (window.__hdwOriginalFetch) window.fetch = window.__hdwOriginalFetch;
            delete window.__hdwOriginalFetch;
            delete window.__hdwFetchUrls;
            """
        )
        print(
            "HUIDI document workbench large-data pagination PASS:",
            {
                "seeded": len(seeded_ids),
                "page1": len(first_ids),
                "page2": len(second_ids),
                "selected_off_page_deal": target_id,
                "quotation": frame_src,
            },
        )
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
