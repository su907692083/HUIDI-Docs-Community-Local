from __future__ import annotations

import os
import time
import uuid

import httpx
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait


BASE = os.environ.get("HUIDI_WORLD_MARKET_BASE", "http://127.0.0.1:18096").rstrip("/")
PASSWORD = "world-market-browser-password-2026"
PRODUCT = "Garden Tool Set"


def main() -> None:
    email = f"world-market-{uuid.uuid4().hex[:10]}@example.test"
    client = httpx.Client(base_url=BASE, follow_redirects=False, timeout=20)
    created = client.post(
        "/api/auth/register",
        json={
            "account_type": "individual",
            "display_name": "World Market Browser",
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
    wait = WebDriverWait(driver, 40)

    def phase(name: str) -> None:
        print(f"WORLD-MARKET PHASE: {name}", flush=True)

    def selected_code() -> str:
        return driver.execute_script(
            "return document.querySelector('.wi-country-market.selected')?.dataset.marketId || "
            "document.querySelector('.wi-country-marker.selected')?.dataset.marketId || '';"
        )

    def wait_selected(code: str) -> None:
        wait.until(lambda _d: selected_code() == code)
        wait.until(lambda d: bool((d.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''") or "").strip()))

    def search_market(term: str, code: str) -> None:
        phase(f"search-{term}-{code}")
        box = wait.until(lambda d: d.find_element(By.ID, "wiCountrySearch"))
        box.click()
        box.send_keys(Keys.CONTROL, "a")
        box.send_keys(term)
        wait.until(
            lambda d: d.execute_script(
                "return Boolean(document.querySelector('#wiCountryResults.open [data-wi-search-market=\"%s\"]'))" % code
            )
        )
        box.send_keys(Keys.ENTER)
        wait_selected(code)

    def click_market(code: str) -> None:
        phase(f"click-{code}")
        driver.execute_script("window.HUIDIWorldCountryInteraction?.resetView?.()")
        time.sleep(0.12)
        marker = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, f'.wi-country-marker[data-market-id="{code}"]'))
        driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'center'});arguments[0].click()", marker)
        wait_selected(code)

    def assert_layout(width: int, height: int) -> None:
        phase(f"layout-{width}x{height}")
        driver.set_window_size(width, height)
        time.sleep(0.25)
        metrics = driver.execute_script(
            """
            const view=document.querySelector('#view-online-intel');
            const map=document.querySelector('.wi-map-card');
            const side=document.querySelector('.wi-side');
            const ar=map?.getBoundingClientRect(),sr=side?.getBoundingClientRect();
            return {innerWidth:window.innerWidth,rootWidth:document.documentElement.scrollWidth,
              viewClient:view?.clientWidth||0,viewScroll:view?.scrollWidth||0,
              mapWidth:ar?.width||0,sideWidth:sr?.width||0,
              overlap:ar&&sr?Math.max(0,ar.right-sr.left):999};
            """
        )
        assert metrics["rootWidth"] <= metrics["innerWidth"] + 4, metrics
        assert metrics["viewScroll"] <= metrics["viewClient"] + 4, metrics
        assert metrics["mapWidth"] > 250 and metrics["sideWidth"] > 250, metrics
        assert metrics["overlap"] <= 1, metrics
        print("layout-pass", width, height, metrics, flush=True)

    try:
        phase("login")
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
        wait.until(lambda d: d.execute_script("return Boolean(window.HUIDICommunityOnlineIntelligenceV2)"))
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.nav-btn[data-view=\"online-intel\"]'))"))

        phase("install-offline-geometry-fixture")
        driver.execute_script(
            """
            const fixture={type:'FeatureCollection',features:[
              {type:'Feature',properties:{ISO_A2_EH:'US',NAME:'United States'},geometry:{type:'Polygon',coordinates:[[[-125,24],[-66,24],[-66,49],[-125,49],[-125,24]]]}},
              {type:'Feature',properties:{ISO_A2_EH:'DE',NAME:'Germany'},geometry:{type:'Polygon',coordinates:[[[5.5,47],[15.5,47],[15.5,55],[5.5,55],[5.5,47]]]}},
              {type:'Feature',properties:{ISO_A2_EH:'JP',NAME:'Japan'},geometry:{type:'Polygon',coordinates:[[[129,31],[146,31],[146,46],[129,46],[129,31]]]}}
            ]};
            const original=window.fetch.bind(window);
            window.fetch=(input,init)=>{
              const url=typeof input==='string'?input:(input?.url||'');
              if(url.includes('natural-earth-vector')) return Promise.resolve(new Response(JSON.stringify(fixture),{status:200,headers:{'Content-Type':'application/json'}}));
              return original(input,init);
            };
            window.__HUIDI_WORLD_GEOMETRY_FIXTURE__=true;
            """
        )

        phase("open-world-map")
        driver.execute_script("document.querySelector('.nav-btn[data-view=\"online-intel\"]')?.click()")
        wait.until(lambda d: d.execute_script("return document.querySelector('.view.active')?.id") == "view-online-intel")
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"world-map\"].active'))"))
        first = driver.execute_script("return document.querySelector('#view-online-intel > .fv2-tabs > .fv2-tab')?.dataset.fv2Tab || ''")
        assert first == "world-map", first
        wait.until(lambda d: d.execute_script("return Boolean(window.HUIDIWorldIntelligenceMap && document.querySelector('#wiMap'))"))
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.wi-country-stage .wi-country-svg'))"))

        assert_layout(1280, 720)
        assert_layout(1640, 920)
        driver.set_window_size(1440, 1000)
        time.sleep(0.2)

        search_market("德国", "DE")
        assert "德国" in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")
        click_market("US")
        assert "美国" in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")
        click_market("JP")
        assert "日本" in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")

        phase("zoom")
        driver.execute_script("window.HUIDIWorldCountryInteraction?.resetView?.()")
        svg = driver.find_element(By.CSS_SELECTOR, ".wi-country-svg")
        before = svg.get_attribute("viewBox")
        driver.execute_script(
            "const el=arguments[0],r=el.getBoundingClientRect();el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-180,clientX:r.left+r.width*.5,clientY:r.top+r.height*.5}));",
            svg,
        )
        wait.until(lambda _d: svg.get_attribute("viewBox") != before)

        phase("drag")
        zoomed = svg.get_attribute("viewBox")
        ocean = driver.execute_script(
            """
            const svg=arguments[0],r=svg.getBoundingClientRect();
            for(const fy of [.88,.78,.68,.58,.48,.38,.28,.18]) for(const fx of [.08,.18,.28,.38,.48,.58,.68,.78,.88]){
              const x=r.left+r.width*fx,y=r.top+r.height*fy;if(document.elementFromPoint(x,y)===svg)return{x,y};
            }
            return null;
            """,
            svg,
        )
        assert ocean, "could not find draggable blank ocean point"
        x, y = ocean["x"], ocean["y"]
        driver.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1})
        driver.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x + 70, "y": y - 28, "button": "left", "buttons": 1})
        driver.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x + 70, "y": y - 28, "button": "left", "buttons": 0, "clickCount": 1})
        wait.until(lambda _d: svg.get_attribute("viewBox") != zoomed)

        search_market("Germany", "DE")
        phase("product-context")
        product = driver.find_element(By.ID, "wiProductContext")
        product.click()
        product.send_keys(Keys.CONTROL, "a")
        product.send_keys(PRODUCT)
        driver.execute_script("window.HUIDIWorldMarketCommandCenter?.schedule?.()")
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.wmcc'))"))
        labels = driver.execute_script("return [...document.querySelectorAll('.wmcc [data-wmcc]')].map(x=>x.textContent.trim())")
        for label in ("找当地买家", "客户情报", "贸易记录", "HS / 关税", "汇率", "船期 / 物流", "市场动态"):
            assert label in labels, (label, labels)
        country = driver.execute_script("return document.querySelector('#ciCountry')?.value || ''")
        assert country == "Germany", country

        phase("trade-handoff")
        driver.find_element(By.CSS_SELECTOR, '.wmcc [data-wmcc="trade"]').click()
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"trade\"].active'))"))
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#hsTradeCountry') && document.querySelector('#hsTradeKeyword'))"))
        wait.until(
            lambda d: d.execute_script(
                "return (document.querySelector('#hsTradeCountry')?.value||'')===arguments[0] && (document.querySelector('#hsTradeKeyword')?.value||'')===arguments[1]",
                country,
                PRODUCT,
            )
        )
        assert len(driver.window_handles) == 1, driver.window_handles
        print("HUIDI interactive world-market parity Chrome PASS", flush=True)
    finally:
        driver.quit()
        client.close()


if __name__ == "__main__":
    main()
