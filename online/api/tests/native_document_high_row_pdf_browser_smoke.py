from __future__ import annotations

import base64
import json
import re
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18080"
ROW_COUNT = 32
DOC_TYPES = ("quotation", "packing_list")


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


def pdf_page_count(pdf: bytes) -> int:
    pages = len(re.findall(rb"/Type\s*/Page\b", pdf))
    if pages:
        return pages
    counts = [int(x) for x in re.findall(rb"/Count\s+(\d+)\b", pdf)]
    return max(counts, default=0)


def pdf_media_box(pdf: bytes) -> tuple[float, float]:
    hit = re.search(
        rb"/MediaBox\s*\[\s*0(?:\.0+)?\s+0(?:\.0+)?\s+([0-9.]+)\s+([0-9.]+)\s*\]",
        pdf,
    )
    assert hit, "PDF MediaBox not found"
    return float(hit.group(1)), float(hit.group(2))


def assert_high_row_print(driver: webdriver.Chrome, document_type: str) -> dict:
    wait = WebDriverWait(driver, 20)
    wait.until(
        lambda d: d.execute_script(
            "return document.documentElement.dataset.huidiPrintStandard||'';"
        )
        == "huidi-native-document-print-standard-v1"
    )
    wait.until(lambda d: len(d.find_elements("css selector", "[data-item-row]")) == ROW_COUNT)

    driver.execute_script(
        """
        document.querySelectorAll('[data-item-row]').forEach((row,index)=>{
          const quantity=row.querySelector('[data-item-k="quantity"]');
          if(quantity){quantity.value=String(1000+index*25)+' pcs';quantity.dispatchEvent(new Event('input',{bubbles:true}));}
          const price=row.querySelector('[data-item-k="unit_price"]');
          if(price){price.value=(1.01+index/100).toFixed(2);price.dispatchEvent(new Event('input',{bubbles:true}));}
          const packages=row.querySelector('[data-item-k="packages"]');
          if(packages){packages.value=String(10+index);packages.dispatchEvent(new Event('input',{bubbles:true}));}
          const gross=row.querySelector('[data-item-k="gross_weight"]');
          if(gross){gross.value=String(20+index)+'.5 kg';gross.dispatchEvent(new Event('input',{bubbles:true}));}
        });
        window.dispatchEvent(new Event('beforeprint'));
        """
    )

    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "print"})
    probe = driver.execute_script(
        """
        const rows=[...document.querySelectorAll('[data-item-row]')];
        const paper=document.querySelector('.paper');
        const table=document.querySelector('.item-table')||document.querySelector('table');
        const names=rows.map(row=>row.querySelector('[data-item-k="product"]')?.nextElementSibling?.textContent||'');
        const specs=rows.map(row=>row.querySelector('[data-item-k="spec"]')?.nextElementSibling?.textContent||'');
        const rowStyles=rows.map(row=>({
          breakInside:getComputedStyle(row).breakInside,
          pageBreakInside:getComputedStyle(row).pageBreakInside,
          height:row.getBoundingClientRect().height
        }));
        const p=paper?.getBoundingClientRect(),t=table?.getBoundingClientRect();
        return {
          rowCount:rows.length,
          mirrorCount:document.querySelectorAll('[data-huidi-print-value]').length,
          allNames:Boolean(names.length)&&names.every(Boolean),
          allSpecs:Boolean(specs.length)&&specs.every(Boolean),
          longName:names.some(x=>x.length>70),
          longSpec:specs.some(x=>x.length>100),
          allRowsAvoid:rowStyles.every(x=>x.breakInside==='avoid'||x.pageBreakInside==='avoid'),
          minRowHeight:Math.min(...rowStyles.map(x=>x.height)),
          maxRowHeight:Math.max(...rowStyles.map(x=>x.height)),
          paperWidth:p?.width||0,
          tableWidth:t?.width||0,
          overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
          thead:document.querySelector('thead')?getComputedStyle(document.querySelector('thead')).display:''
        };
        """
    )
    assert probe["rowCount"] == ROW_COUNT, probe
    assert probe["mirrorCount"] >= ROW_COUNT * 3, probe
    assert probe["allNames"] and probe["allSpecs"], probe
    assert probe["longName"] and probe["longSpec"], probe
    assert probe["allRowsAvoid"], probe
    assert float(probe["minRowHeight"]) > 0, probe
    assert float(probe["maxRowHeight"]) < 300, probe
    assert probe["thead"] == "table-header-group", probe
    assert float(probe["tableWidth"]) <= float(probe["paperWidth"]) + 2.0, probe
    assert float(probe["overflow"]) <= 2.0, probe

    encoded = driver.execute_cdp_cmd(
        "Page.printToPDF",
        {"printBackground": True, "preferCSSPageSize": True},
    )["data"]
    pdf = base64.b64decode(encoded)
    assert pdf.startswith(b"%PDF-"), pdf[:16]
    assert len(pdf) > 15000, len(pdf)
    pages = pdf_page_count(pdf)
    assert 2 <= pages <= 20, (document_type, pages, len(pdf))
    width, height = pdf_media_box(pdf)
    assert width > height, (document_type, width, height)
    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "screen"})
    return {"pages": pages, "pdf_bytes": len(pdf), **probe}


def main() -> None:
    driver = webdriver.Chrome(options=options())
    driver.set_page_load_timeout(25)
    driver.set_script_timeout(60)
    stamp = str(int(time.time() * 1000))[-10:]
    results: dict[str, dict] = {}
    try:
        driver.get(BASE + "/")
        product_ids: list[str] = []
        items: list[dict] = []
        for index in range(ROW_COUNT):
            suffix = f"{index + 1:02d}"
            product_id = f"high-row-{stamp}-{suffix}"
            product_ids.append(product_id)
            items.append(
                {
                    "brain_id": product_id,
                    "payload": {
                        "id": product_id,
                        "local_product_id": product_id,
                        "name": f"High Row Export Hardware {suffix} / Stainless Steel Multi-Purpose Hinge With Customer-Specific Long Model Description {stamp}",
                        "sku": f"HR-{stamp}-{suffix}",
                        "spec": (
                            "SUS304 precision stamped hinge, 4 inch, brushed finish, custom logo and retail packaging; "
                            f"buyer drawing revision {suffix}; carton mark and inspection requirement retained for formal output"
                        ),
                        "unit": "pcs",
                        "reference_price": f"{1.10 + index / 100:.2f}",
                        "packing": f"{20 + index} pcs/carton",
                        "carton_size": f"{40 + index % 5} x 30 x 20 cm",
                        "shipping_marks": f"HIGH-ROW-{suffix}",
                    },
                }
            )
        imported = api(driver, "/api/product-brains/import", "POST", {"items": items})
        assert int(imported.get("saved") or 0) == ROW_COUNT, imported

        lead = api(
            driver,
            "/api/leads/manual",
            "POST",
            {
                "company_name": f"High Row International Purchasing & Distribution Group With Long Legal Name {stamp}",
                "product_keyword": items[0]["payload"]["name"],
                "country": "DE",
                "contact_name": "Senior Purchasing Manager",
                "contact_email": f"high-row-{stamp}@example.com",
                "requirements": (
                    "Mixed order with many product variants. FOB Ningbo. Each line must remain independently readable "
                    "across printed pages, with repeated headers and no row clipping or horizontal overflow."
                ),
                "create_inquiry": True,
            },
        )
        deal_id = int(lead["deal"]["id"])
        selected = api(
            driver,
            f"/api/business/deals/{deal_id}/products",
            "PUT",
            {"product_ids": product_ids},
        )
        assert len(selected.get("selected") or []) == ROW_COUNT, selected

        for document_type in DOC_TYPES:
            created = api(
                driver,
                f"/api/business/deals/{deal_id}/native-document",
                "POST",
                {"document_type": document_type},
            )
            driver.get(BASE + created["url"])
            results[document_type] = assert_high_row_print(driver, document_type)

        print("HUIDI high-row multi-page native document PDF smoke PASS:", results)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
