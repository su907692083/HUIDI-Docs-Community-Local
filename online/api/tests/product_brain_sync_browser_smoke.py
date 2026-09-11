from __future__ import annotations

import json
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18080"
KEY = "huidi_online_product_brains_v1"


def options() -> Options:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1440,1000")
    return opts


def await_sync(driver: webdriver.Chrome) -> dict:
    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        Promise.resolve(window.HUIDIProductServer.sync())
          .then(value => done(value || {}))
          .catch(error => done({ok:false, error:String(error)}));
        """
    )
    assert result.get("ok") is True, result
    return result


def fetch_json(driver: webdriver.Chrome, path: str, method: str = "GET", body: dict | None = None) -> dict | list:
    result = driver.execute_async_script(
        """
        const [path, method, body, done] = arguments;
        const options = {method, credentials:'same-origin', headers:{'Content-Type':'application/json'}};
        if (body !== null) options.body = JSON.stringify(body);
        fetch(path, options)
          .then(async response => done({status:response.status, text:await response.text()}))
          .catch(error => done({status:0, text:String(error)}));
        """,
        path,
        method,
        body,
    )
    assert 200 <= int(result["status"]) < 300, result
    return json.loads(result["text"] or "{}")


def product_urls(driver: webdriver.Chrome) -> list[str]:
    urls = driver.execute_script("return Array.from(window.__pbsFetchUrls || []);")
    return [str(url) for url in urls if str(url).startswith("/api/product-brains")]


def clear_urls(driver: webdriver.Chrome) -> None:
    driver.execute_script("window.__pbsFetchUrls = [];")


def server_has(driver: webdriver.Chrome, brain_id: str) -> bool:
    rows = fetch_json(driver, "/api/product-brains")
    return any(str(row.get("brain_id") or row.get("id")) == brain_id for row in rows)


def main() -> None:
    driver = webdriver.Chrome(options=options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(30)
    wait = WebDriverWait(driver, 25)
    stamp = str(int(time.time() * 1000))[-10:]
    brain_id = f"pb-sync-{stamp}"
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIProductServer?.sync === 'function'"))

        first = await_sync(driver)
        assert first["mode"] in ("full", "state-only"), first

        driver.execute_script(
            """
            window.__pbsFetchUrls = [];
            window.__pbsOriginalFetch = window.fetch;
            window.fetch = function(...args) {
              const frames = String(new Error().stack || '').split(String.fromCharCode(10)).slice(1, 4);
              if (frames.some(line => line.includes('product-brain-server.js'))) {
                window.__pbsFetchUrls.push(String(args[0]));
              }
              return window.__pbsOriginalFetch.apply(this, args);
            };
            """
        )

        steady = await_sync(driver)
        steady_urls = product_urls(driver)
        assert steady["mode"] == "state-only", (steady, steady_urls)
        assert "/api/product-brains/state" in steady_urls, steady_urls
        assert "/api/product-brains" not in steady_urls, steady_urls
        assert "/api/product-brains/import" not in steady_urls, steady_urls

        driver.execute_script(
            """
            const [key, brainId] = arguments;
            const rows = JSON.parse(localStorage.getItem(key) || '[]');
            const now = new Date().toISOString();
            rows.unshift({
              id: brainId,
              brain_id: brainId,
              local_product_id: brainId,
              source: 'browser-sync-smoke',
              name: 'Product Sync Smoke ' + brainId,
              sku: 'SYNC-' + brainId.slice(-6),
              category: 'Hardware',
              spec: 'SUS304',
              price_range: '',
              currency: 'USD',
              unit: 'PCS',
              moq: '100',
              lead_time: '20 days',
              certifications: [],
              differentiators: ['sync probe'],
              customer_cases: [],
              company_facts: [],
              target_keywords: ['sync probe'],
              allowed_claims: [],
              restricted_claims: [],
              updated_at: now,
              created_at: now
            });
            localStorage.setItem(key, JSON.stringify(rows.slice(0,500)));
            """,
            KEY,
            brain_id,
        )
        clear_urls(driver)
        changed = await_sync(driver)
        changed_urls = product_urls(driver)
        assert changed["mode"] == "full", (changed, changed_urls)
        assert "/api/product-brains/state" in changed_urls, changed_urls
        assert "/api/product-brains" in changed_urls, changed_urls
        assert "/api/product-brains/import" in changed_urls, changed_urls

        server_rows = fetch_json(driver, "/api/product-brains")
        created = next((row for row in server_rows if str(row.get("id") or row.get("brain_id")) == brain_id), None)
        assert created is not None, brain_id
        first_server_updated_at = str(created.get("server_updated_at") or "")
        assert first_server_updated_at, created
        state_before = fetch_json(driver, "/api/product-brains/state")

        repeated = fetch_json(driver, "/api/product-brains/import", "POST", {"items": [created]})
        assert repeated.get("saved") == 1, repeated
        assert repeated.get("changed") == 0, repeated
        assert repeated.get("unchanged") == 1, repeated
        state_after = fetch_json(driver, "/api/product-brains/state")
        assert state_after.get("version") == state_before.get("version"), (state_before, state_after)
        server_rows_after = fetch_json(driver, "/api/product-brains")
        created_after = next(
            (row for row in server_rows_after if str(row.get("id") or row.get("brain_id")) == brain_id),
            None,
        )
        assert created_after is not None
        assert str(created_after.get("server_updated_at") or "") == first_server_updated_at

        clear_urls(driver)
        steady_again = await_sync(driver)
        final_urls = product_urls(driver)
        assert steady_again["mode"] == "state-only", (steady_again, final_urls)
        assert "/api/product-brains/state" in final_urls, final_urls
        assert "/api/product-brains" not in final_urls, final_urls
        assert "/api/product-brains/import" not in final_urls, final_urls

        # Product Brain used to remove only the local copy; the next merge could
        # resurrect the server copy. Exercise the same #pbDelete capture path and
        # prove the canonical server owner is deleted before the next merge.
        clear_urls(driver)
        deleted_locally = driver.execute_script(
            """
            const [key, brainId] = arguments;
            const button = document.querySelector('#pbDelete');
            if (!button) return false;
            const original = button.onclick;
            button.onclick = () => {
              const rows = JSON.parse(localStorage.getItem(key) || '[]');
              localStorage.setItem(key, JSON.stringify(rows.filter(row => String(row.brain_id || row.id) !== String(brainId))));
            };
            button.click();
            button.onclick = original;
            return true;
            """,
            KEY,
            brain_id,
        )
        assert deleted_locally is True
        wait.until(lambda d: not server_has(d, brain_id))
        wait.until(
            lambda d: not d.execute_script(
                "return JSON.parse(localStorage.getItem(arguments[0]) || '[]').some(row => String(row.brain_id || row.id) === String(arguments[1]));",
                KEY,
                brain_id,
            )
        )
        delete_urls = product_urls(driver)
        assert any(url == f"/api/product-brains/{brain_id}" for url in delete_urls), delete_urls
        await_sync(driver)
        assert not server_has(driver, brain_id), "deleted Product Brain must not be resurrected by sync"

        print(
            "HUIDI Product Brain state-only/create/delete sync PASS:",
            {
                "initial_mode": first["mode"],
                "steady_urls": steady_urls,
                "changed_urls": changed_urls,
                "repeat_changed": repeated.get("changed"),
                "server_version": state_after.get("version"),
                "delete_url": f"/api/product-brains/{brain_id}",
                "deleted_persisted": not server_has(driver, brain_id),
            },
        )
    finally:
        try:
            driver.execute_script(
                """
                if (window.__pbsOriginalFetch) window.fetch = window.__pbsOriginalFetch;
                delete window.__pbsOriginalFetch;
                delete window.__pbsFetchUrls;
                """
            )
        except Exception:
            pass
        driver.quit()


if __name__ == "__main__":
    main()
