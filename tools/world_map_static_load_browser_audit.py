from __future__ import annotations

import json
import os
import time
import uuid

import httpx
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE = os.environ.get("HUIDI_WORLD_MARKET_BASE", "http://127.0.0.1:18096").rstrip("/")
PASSWORD = "world-map-static-load-2026"
ASSETS = [
    "/community/huidi-community-online-intelligence-v2.js",
    "/community/huidi-world-market-command-center-v1.js",
    "/assets/world-basemap-v2.js",
    "/assets/world-intelligence-map.js",
    "/assets/world-country-interaction.js",
    "/assets/world-country-face-parity-v1.js",
    "/assets/world-map-source-parity-v2.css",
]


def main() -> None:
    email = f"world-map-load-{uuid.uuid4().hex[:10]}@example.test"
    client = httpx.Client(base_url=BASE, follow_redirects=False, timeout=20)
    created = client.post(
        "/api/auth/register",
        json={
            "account_type": "individual",
            "display_name": "World Map Static Load",
            "organization_name": "",
            "email": email,
            "password": PASSWORD,
        },
    )
    assert created.status_code == 200, created.text

    options = Options()
    for arg in ("--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--window-size=1440,1000"):
        options.add_argument(arg)
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 35)
    try:
        driver.get(BASE + "/login")
        login = driver.execute_async_script(
            """
            const email=arguments[0],password=arguments[1],done=arguments[arguments.length-1];
            fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
              .then(async r=>done({status:r.status,body:await r.text()})).catch(e=>done({status:0,body:String(e)}));
            """,
            email,
            PASSWORD,
        )
        assert login["status"] == 200, login
        driver.get(BASE + "/")
        wait.until(lambda d: "/community/workspace.html" in d.current_url)
        wait.until(lambda d: d.execute_script("return document.documentElement.dataset.huidiCloud==='ready'"))

        result = driver.execute_async_script(
            """
            const assets=arguments[0],done=arguments[arguments.length-1];
            const started=performance.now();
            const jobs=[];
            for(let round=0;round<4;round++) for(const path of assets){
              const url=path+(path.includes('?')?'&':'?')+'loadgate='+Date.now()+'-'+round+'-'+Math.random().toString(36).slice(2);
              jobs.push((async()=>{const t=performance.now();try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});await r.arrayBuffer();return{path,status:r.status,ok:r.ok,ms:Math.round(performance.now()-t)}}catch(e){return{path,status:0,ok:false,ms:Math.round(performance.now()-t),error:String(e)}}})());
            }
            Promise.all(jobs).then(rows=>done({rows,totalMs:Math.round(performance.now()-started)})).catch(e=>done({error:String(e),rows:[],totalMs:Math.round(performance.now()-started)}));
            """,
            ASSETS,
        )
        rows = result.get("rows") or []
        assert len(rows) == len(ASSETS) * 4, result
        failed = [row for row in rows if not row.get("ok") or row.get("status") != 200]
        assert not failed, json.dumps(failed, ensure_ascii=False)
        slowest = max((int(row.get("ms") or 0) for row in rows), default=0)
        assert result.get("totalMs", 999999) < 15000, result
        assert slowest < 10000, {"slowestMs": slowest, "result": result}

        # Prove the browser event loop remains usable after the concurrent cache-busting burst.
        driver.execute_script("window.__huidiLoadGateTick=0;setTimeout(()=>window.__huidiLoadGateTick=1,30)")
        wait.until(lambda d: d.execute_script("return window.__huidiLoadGateTick===1"))
        print(json.dumps({"staticRequests": len(rows), "totalMs": result["totalMs"], "slowestMs": slowest}, ensure_ascii=False), flush=True)
        print("HUIDI world-map Team Access static-load gate PASS", flush=True)
    finally:
        driver.quit()
        client.close()


if __name__ == "__main__":
    main()
