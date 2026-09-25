from __future__ import annotations

import base64
import json
import re
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18080"
DOC_TYPES = (
    "quotation",
    "proforma_invoice",
    "sales_contract",
    "commercial_invoice",
    "packing_list",
)


def options() -> Options:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1600,1100")
    return opts


def api(driver: webdriver.Chrome, path: str, method: str = "GET", payload: dict | None = None) -> dict:
    result = driver.execute_async_script(
        """
        const [path, method, payload, done] = arguments;
        const options={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};
        if(payload!==null)options.body=JSON.stringify(payload);
        fetch(path,options)
          .then(async response=>done({status:response.status,body:await response.text()}))
          .catch(error=>done({status:0,body:String(error)}));
        """,
        path,
        method,
        payload,
    )
    assert 200 <= int(result["status"]) < 300, result
    return json.loads(result["body"] or "{}")


def pdf_media_box(pdf: bytes) -> tuple[float, float]:
    hit = re.search(
        rb"/MediaBox\s*\[\s*0(?:\.0+)?\s+0(?:\.0+)?\s+([0-9.]+)\s+([0-9.]+)\s*\]",
        pdf,
    )
    assert hit, "PDF MediaBox not found"
    return float(hit.group(1)), float(hit.group(2))


def assert_print_contract(driver: webdriver.Chrome, expected: str) -> tuple[int, int]:
    wait = WebDriverWait(driver, 15)
    wait.until(
        lambda d: d.execute_script(
            "return document.documentElement.dataset.huidiPrintStandard||'';"
        )
        == "huidi-native-document-print-standard-v1"
    )
    layout = driver.execute_script("return document.documentElement.dataset.huidiPrintLayout||'';")
    assert layout == expected, (layout, expected, driver.title)

    driver.execute_script(
        """
        const long='Formal requirement / specification '.repeat(12).trim();
        const target=document.querySelector('[data-k="requirements"]');
        if(target){target.value=long;target.dispatchEvent(new Event('input',{bubbles:true}));}
        window.dispatchEvent(new Event('beforeprint'));
        """
    )
    mirror = driver.execute_script(
        """
        const target=document.querySelector('[data-k="requirements"]');
        const value=target?.nextElementSibling;
        return {count:document.querySelectorAll('[data-huidi-print-value]').length,text:value?.textContent||''};
        """
    )
    assert int(mirror["count"]) >= 1, mirror
    assert "Formal requirement / specification" in mirror["text"], mirror

    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "print"})
    probe = driver.execute_script(
        """
        const paper=document.querySelector('.paper');
        const table=document.querySelector('.item-table')||document.querySelector('table');
        const top=document.querySelector('.top');
        const ctx=document.querySelector('.ctx');
        const control=document.querySelector('[data-item-k],[data-k]:not([type="hidden"])');
        const mirror=document.querySelector('[data-huidi-print-value]');
        const head=document.querySelector('thead');
        const p=paper?.getBoundingClientRect(),t=table?.getBoundingClientRect();
        return {
          top:top?getComputedStyle(top).display:'',
          ctx:ctx?getComputedStyle(ctx).display:'',
          control:control?getComputedStyle(control).display:'',
          mirror:mirror?getComputedStyle(mirror).display:'',
          head:head?getComputedStyle(head).display:'',
          paperWidth:p?.width||0,
          tableWidth:t?.width||0,
          bodyOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)
        };
        """
    )
    assert probe["top"] == "none", probe
    assert probe["ctx"] in ("", "none"), probe
    assert probe["control"] == "none", probe
    assert probe["mirror"] != "none", probe
    assert probe["head"] == "table-header-group", probe
    assert float(probe["tableWidth"]) <= float(probe["paperWidth"]) + 2.0, probe
    assert float(probe["bodyOverflow"]) <= 2.0, probe

    encoded = driver.execute_cdp_cmd(
        "Page.printToPDF",
        {"printBackground": True, "preferCSSPageSize": True},
    )["data"]
    pdf = base64.b64decode(encoded)
    assert pdf.startswith(b"%PDF-"), pdf[:16]
    assert len(pdf) > 6000, len(pdf)
    width, height = pdf_media_box(pdf)
    if expected == "landscape":
        assert width > height, (width, height)
    else:
        assert height > width, (width, height)
    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "screen"})
    return len(pdf), int(mirror["count"])


def main() -> None:
    driver = webdriver.Chrome(options=options())
    driver.set_page_load_timeout(25)
    driver.set_script_timeout(30)
    stamp = str(int(time.time() * 1000))[-10:]
    results: list[tuple[str, str, int, int]] = []
    try:
        driver.get(BASE + "/")
        product_a = f"pdf-{stamp}-base"
        product_b = f"pdf-{stamp}-variant"
        imported = api(
            driver,
            "/api/product-brains/import",
            "POST",
            {
                "items": [
                    {
                        "brain_id": product_a,
                        "payload": {
                            "id": product_a,
                            "local_product_id": product_a,
                            "name": f"PDF Audit Hinge {stamp}",
                            "sku": f"PDF-A-{stamp}",
                            "spec": "SUS304 4 inch / customer artwork confirmed",
                            "unit": "pcs",
                            "reference_price": "1.25",
                        },
                    },
                    {
                        "brain_id": product_b,
                        "payload": {
                            "id": product_b,
                            "local_product_id": product_b,
                            "name": f"PDF Audit Hinge Heavy {stamp}",
                            "sku": f"PDF-B-{stamp}",
                            "spec": "SUS316 5 inch heavy duty / export carton",
                            "unit": "pcs",
                            "reference_price": "2.40",
                        },
                    },
                ]
            },
        )
        assert int(imported.get("saved") or 0) == 2, imported

        lead = api(
            driver,
            "/api/leads/manual",
            "POST",
            {
                "company_name": f"PDF Layout Buyer {stamp}",
                "product_keyword": f"PDF Audit Hinge {stamp}",
                "country": "DE",
                "contact_name": "Purchasing",
                "contact_email": f"pdf-{stamp}@example.com",
                "requirements": "Quantity 5000 pcs, FOB Ningbo, formal layout audit",
                "create_inquiry": True,
            },
        )
        deal_id = int(lead["deal"]["id"])
        selected = api(
            driver,
            f"/api/business/deals/{deal_id}/products",
            "PUT",
            {"product_ids": [product_a, product_b]},
        )
        assert len(selected.get("selected") or []) == 2, selected

        for document_type in DOC_TYPES:
            created = api(
                driver,
                f"/api/business/deals/{deal_id}/native-document",
                "POST",
                {"document_type": document_type},
            )
            driver.get(BASE + created["url"])
            size, mirrors = assert_print_contract(driver, "landscape")
            results.append((document_type, "landscape", size, mirrors))

        single = api(
            driver,
            "/api/leads/manual",
            "POST",
            {
                "company_name": f"PDF Portrait Buyer {stamp}",
                "product_keyword": f"Portrait Product {stamp}",
                "country": "US",
                "requirements": "Quantity 100 pcs, portrait quotation audit",
                "create_inquiry": True,
            },
        )
        portrait_id = int(single["deal"]["id"])
        quote = api(
            driver,
            f"/api/business/deals/{portrait_id}/native-document",
            "POST",
            {"document_type": "quotation"},
        )
        driver.get(BASE + quote["url"])
        size, mirrors = assert_print_contract(driver, "portrait")
        results.append(("quotation-single", "portrait", size, mirrors))

        print("HUIDI native table/PDF layout smoke PASS:", results)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
