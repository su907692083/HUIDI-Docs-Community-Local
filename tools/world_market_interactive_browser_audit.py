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
ACTIVE_MAP = '#view-online-intel [data-fv2-pane="world-map"].active'


def main() -> None:
    email = f"world-market-{uuid.uuid4().hex[:10]}@example.test"
    client = httpx.Client(base_url=BASE, follow_redirects=False, timeout=20)
    created = client.post('/api/auth/register', json={
        'account_type': 'individual', 'display_name': 'World Market Browser',
        'organization_name': '', 'email': email, 'password': PASSWORD,
    })
    assert created.status_code == 200, created.text

    options = Options()
    for arg in ('--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,1000'):
        options.add_argument(arg)
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 40)

    def phase(name: str) -> None:
        print(f'WORLD-MARKET PHASE: {name}', flush=True)

    def view_box(svg) -> str:
        return str(driver.execute_script("return arguments[0].getAttribute('viewBox') || ''", svg) or '')

    def selected_code() -> str:
        return driver.execute_script(
            "const p=document.querySelector(arguments[0]);return p?.querySelector('.wi-country-land.selected')?.dataset.marketId || p?.querySelector('.wi-country-face.selected')?.dataset.marketId || p?.querySelector('.wi-country-market.selected')?.dataset.marketId || p?.querySelector('.wi-country-marker.selected')?.dataset.marketId || '';",
            ACTIVE_MAP,
        )

    def wait_selected(code: str) -> None:
        wait.until(lambda _d: selected_code() == code)
        wait.until(lambda d: bool((d.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''") or '').strip()))

    def search_market(term: str, code: str) -> None:
        phase(f'search-{term}-{code}')
        box = wait.until(lambda d: d.find_element(By.ID, 'wiCountrySearch'))
        box.click(); box.send_keys(Keys.CONTROL, 'a'); box.send_keys(term)
        wait.until(lambda d: d.execute_script(
            "return Boolean(document.querySelector('#wiCountryResults.open [data-wi-search-market=\"%s\"]'))" % code
        ))
        box.send_keys(Keys.ENTER)
        wait_selected(code)

    def click_market(code: str) -> None:
        phase(f'click-marker-{code}')
        driver.execute_script('window.HUIDIWorldCountryInteraction?.resetView?.()')
        time.sleep(.12)
        marker = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, f'{ACTIVE_MAP} .wi-country-marker[data-market-id="{code}"]'))
        point = driver.execute_script("const r=arguments[0].getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};", marker)
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mousePressed','x':point['x'],'y':point['y'],'button':'left','buttons':1,'clickCount':1})
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseReleased','x':point['x'],'y':point['y'],'button':'left','buttons':0,'clickCount':1})
        wait_selected(code)

    def click_country_face(code: str, expected_name: str) -> None:
        phase(f'hover-click-face-{code}')
        driver.execute_script('window.HUIDIWorldCountryInteraction?.resetView?.()')
        time.sleep(.12)
        payload = wait.until(lambda d: d.execute_script("""
          const root=document.querySelector(arguments[0]),code=arguments[1];
          const fallbackFace=root?.querySelector(`.wi-country-face[data-market-id="${code}"]`);
          const fullFace=root?.querySelector(`.wi-country-land[data-market-id="${code}"]`);
          const marker=root?.querySelector(`.wi-country-marker[data-market-id="${code}"]`);
          const face=fallbackFace||fullFace;
          if(!face||!marker)return null;
          marker.dataset.testPointerEvents=marker.style.pointerEvents||'';
          marker.style.pointerEvents='none';
          const svg=face.ownerSVGElement,b=face.getBBox(),ctm=face.getScreenCTM();
          if(!svg||!b||!ctm)return null;
          const point=svg.createSVGPoint(),fractions=[.5,.4,.6,.3,.7,.2,.8,.1,.9,.05,.95];
          let best=null,lastHit=null;
          for(const fy of fractions){
            for(const fx of fractions){
              point.x=b.x+b.width*fx;point.y=b.y+b.height*fy;
              if(typeof face.isPointInFill==='function'&&!face.isPointInFill(point))continue;
              const screen=point.matrixTransform(ctm),x=screen.x,y=screen.y;
              if(x<1||y<1||x>=innerWidth-1||y>=innerHeight-1)continue;
              const hit=document.elementFromPoint(x,y),hitFace=hit?.closest?.('.wi-country-land[data-market-id],.wi-country-face[data-market-id]');
              lastHit={x,y,hitCode:hitFace?.dataset.marketId||'',hitClass:hit?.getAttribute?.('class')||''};
              if(hitFace?.dataset.marketId===code){best=lastHit;break}
            }
            if(best)break;
          }
          const chosen=best||lastHit||{};
          return {x:chosen.x??null,y:chosen.y??null,d:(fullFace||fallbackFace)?.getAttribute('d')||'',canonicalD:fallbackFace?.getAttribute('d')||'',hitCode:chosen.hitCode||'',hitClass:chosen.hitClass||''};
        """, ACTIVE_MAP, code))
        try:
            assert len(payload['d']) > 20, payload
            assert len(payload['canonicalD']) > 20, payload
            assert payload['x'] is not None and payload['y'] is not None, payload
            assert payload['hitCode'] == code, payload
            driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseMoved','x':payload['x'],'y':payload['y'],'button':'none','buttons':0})
            wait.until(lambda d: d.execute_script(
                "const b=document.querySelector('.wi-country-bubble.open');return Boolean(b && b.textContent.includes(arguments[0]));",
                expected_name,
            ))
            driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mousePressed','x':payload['x'],'y':payload['y'],'button':'left','buttons':1,'clickCount':1})
            driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseReleased','x':payload['x'],'y':payload['y'],'button':'left','buttons':0,'clickCount':1})
            wait_selected(code)
        finally:
            driver.execute_script("""
              const root=document.querySelector(arguments[0]),marker=root?.querySelector(`.wi-country-marker[data-market-id="${arguments[1]}"]`);
              if(marker){marker.style.pointerEvents=marker.dataset.testPointerEvents||'';delete marker.dataset.testPointerEvents}
            """, ACTIVE_MAP, code)

    def assert_layout(width: int, height: int) -> None:
        phase(f'layout-{width}x{height}')
        driver.set_window_size(width, height); time.sleep(.25)
        metrics = driver.execute_script("""
          const view=document.querySelector('#view-online-intel'),map=document.querySelector('.wi-map-card'),side=document.querySelector('.wi-side');
          const ar=map?.getBoundingClientRect(),sr=side?.getBoundingClientRect();
          return {innerWidth:innerWidth,rootWidth:document.documentElement.scrollWidth,viewClient:view?.clientWidth||0,viewScroll:view?.scrollWidth||0,
            mapWidth:ar?.width||0,mapTop:ar?.top||0,mapBottom:ar?.bottom||0,
            sideWidth:sr?.width||0,sideTop:sr?.top||0,sideBottom:sr?.bottom||0};
        """)
        assert metrics['rootWidth'] <= metrics['innerWidth'] + 4, metrics
        assert metrics['viewScroll'] <= metrics['viewClient'] + 4, metrics
        assert metrics['mapWidth'] >= metrics['viewClient'] * .90, metrics
        assert metrics['sideWidth'] >= metrics['viewClient'] * .90, metrics
        assert metrics['sideTop'] >= metrics['mapBottom'] - 2, metrics
        print('layout-pass', width, height, metrics, flush=True)

    def visible_svg_point(svg):
        driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'center'});", svg); time.sleep(.12)
        return driver.execute_script("""
          const svg=arguments[0],r=svg.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
          for(const fy of [.5,.35,.65,.2,.8]) for(const fx of [.5,.35,.65,.2,.8]){
            const x=Math.max(2,Math.min(vw-3,r.left+r.width*fx)),y=Math.max(2,Math.min(vh-3,r.top+r.height*fy)),hit=document.elementFromPoint(x,y);
            if(hit&&(hit===svg||svg.contains(hit))) return{x,y,tag:hit.tagName,cls:hit.getAttribute?.('class')||'',rect:{left:r.left,top:r.top,width:r.width,height:r.height},vw,vh};
          }
          return{x:null,y:null,rect:{left:r.left,top:r.top,width:r.width,height:r.height},vw,vh,tag:'',cls:''};
        """, svg)

    try:
        phase('login')
        driver.get(BASE + '/login')
        login = driver.execute_async_script("""
          const email=arguments[0],password=arguments[1],done=arguments[arguments.length-1];
          fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}).then(async r=>done({status:r.status,body:await r.text()})).catch(e=>done({status:0,body:String(e)}));
        """, email, PASSWORD)
        assert login['status'] == 200, login
        driver.get(BASE + '/')
        wait.until(lambda d: '/community/workspace.html' in d.current_url)
        wait.until(lambda d: d.execute_script('return Boolean(window.HUIDICommunityOnlineIntelligenceV2)'))
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.nav-btn[data-view=\"online-intel\"]'))"))

        phase('open-world-map')
        driver.execute_script("document.querySelector('.nav-btn[data-view=\"online-intel\"]')?.click()")
        wait.until(lambda d: d.execute_script("return document.querySelector('.view.active')?.id") == 'view-online-intel')
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"world-map\"].active'))"))
        assert driver.execute_script("return document.querySelector('#view-online-intel > .fv2-tabs > .fv2-tab')?.dataset.fv2Tab || ''") == 'world-map'
        wait.until(lambda d: d.execute_script("return Boolean(window.HUIDIWorldIntelligenceMap && document.querySelector('#wiMap'))"))
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector(arguments[0]+' .wi-country-stage .wi-country-svg'))", ACTIVE_MAP))

        phase('country-level-basemap')
        map_state = driver.execute_script("""
          const map=document.querySelector('#wiMap'),land=map?.querySelector('.wi-basemap-land');
          return {geometry:map?.dataset.wiCountryGeometry||'',countryCount:window.HUIDI_WORLD_BASEMAP?.countryCount||0,
            pathLength:(land?.getAttribute('d')||'').length,
            faceCount:Number(map?.dataset.wiCountryFaces||0),
            usFace:(map?.querySelector('.wi-country-face[data-market-id="US"]')?.getAttribute('d')||'').length,
            deFace:(map?.querySelector('.wi-country-face[data-market-id="DE"]')?.getAttribute('d')||'').length,
            jpFace:(map?.querySelector('.wi-country-face[data-market-id="JP"]')?.getAttribute('d')||'').length,
            modes:[...document.querySelectorAll('[data-wic-mode]')].map(x=>x.textContent.trim()),
            external:performance.getEntriesByType('resource').map(x=>x.name).filter(n=>n.includes('cdn.jsdelivr.net')||n.includes('natural-earth-vector'))};
        """)
        assert map_state['geometry'] == 'natural-earth-country-boundaries-v2', map_state
        assert map_state['countryCount'] == 177, map_state
        assert map_state['pathLength'] > 10000, map_state
        assert map_state['faceCount'] >= 3, map_state
        assert map_state['usFace'] > 20 and map_state['deFace'] > 20 and map_state['jpFace'] > 20, map_state
        assert map_state['modes'] == ['地图分析','热力图','数据分析'], map_state
        assert map_state['external'] == [], map_state
        for mode_key in ('heat','data','map'):
            driver.execute_script("document.querySelector('[data-wic-mode=\"%s\"]')?.click()" % mode_key)
            wait.until(lambda d, k=mode_key: d.execute_script("return document.querySelector('.wi-country-stage')?.dataset.mapMode || ''") == k)

        assert_layout(1280, 720); assert_layout(1640, 920)
        driver.set_window_size(1440, 1000); time.sleep(.2)
        search_market('德国', 'DE'); assert '德国' in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")
        click_country_face('US', '美国'); assert '美国' in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")
        click_country_face('JP', '日本'); assert '日本' in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")
        click_market('DE'); assert '德国' in driver.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''")

        phase('zoom')
        driver.execute_script('window.HUIDIWorldCountryInteraction?.resetView?.()')
        svg = driver.find_element(By.CSS_SELECTOR, f'{ACTIVE_MAP} .wi-country-svg')
        before = view_box(svg); assert before
        point = visible_svg_point(svg); assert point['x'] is not None, point
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseMoved','x':point['x'],'y':point['y'],'button':'none','buttons':0})
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseWheel','x':point['x'],'y':point['y'],'deltaX':0,'deltaY':-180})
        wait.until(lambda _d: view_box(svg) != before)

        phase('drag')
        zoomed = view_box(svg)
        ocean = driver.execute_script("""
          const svg=arguments[0],r=svg.getBoundingClientRect(),vw=innerWidth,vh=innerHeight;
          for(const fy of [.88,.78,.68,.58,.48,.38,.28,.18])for(const fx of [.08,.18,.28,.38,.48,.58,.68,.78,.88]){const x=Math.max(2,Math.min(vw-3,r.left+r.width*fx)),y=Math.max(2,Math.min(vh-3,r.top+r.height*fy));if(document.elementFromPoint(x,y)===svg)return{x,y}}return null;
        """, svg)
        assert ocean
        x,y=ocean['x'],ocean['y']
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mousePressed','x':x,'y':y,'button':'left','buttons':1,'clickCount':1})
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseMoved','x':x+70,'y':y-28,'button':'left','buttons':1})
        driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseReleased','x':x+70,'y':y-28,'button':'left','buttons':0,'clickCount':1})
        wait.until(lambda _d: view_box(svg) != zoomed)

        search_market('Germany', 'DE')
        phase('product-context')
        product = driver.find_element(By.ID, 'wiProductContext'); product.click(); product.send_keys(Keys.CONTROL, 'a'); product.send_keys(PRODUCT)
        driver.execute_script('window.HUIDIWorldMarketCommandCenter?.schedule?.()')
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.wmcc'))"))
        labels=driver.execute_script("return [...document.querySelectorAll('.wmcc [data-wmcc]')].map(x=>x.textContent.trim())")
        for label in ('找当地买家','客户情报','贸易记录','HS / 关税','汇率','船期 / 物流','市场动态'): assert label in labels,(label,labels)
        country=driver.execute_script("return document.querySelector('#ciCountry')?.value || ''"); assert country == 'Germany', country

        phase('trade-handoff')
        driver.find_element(By.CSS_SELECTOR, '.wmcc [data-wmcc="trade"]').click()
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"trade\"].active'))"))
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#hsTradeCountry') && document.querySelector('#hsTradeProduct'))"))
        wait.until(lambda d: d.execute_script(
            "return (document.querySelector('#hsTradeCountry')?.value||'')===arguments[0] && (document.querySelector('#hsTradeProduct')?.value||'')===arguments[1]", country, PRODUCT
        ))
        assert len(driver.window_handles) == 1, driver.window_handles
        print('HUIDI local country-face source-parity world-market Chrome PASS', flush=True)
    finally:
        driver.quit(); client.close()


if __name__ == '__main__':
    main()
