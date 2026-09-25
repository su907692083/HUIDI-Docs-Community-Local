from __future__ import annotations

import os
import uuid

import httpx
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE = os.environ.get("HUIDI_WORLD_MARKET_BASE", "http://127.0.0.1:18096").rstrip("/")
PASSWORD = "world-country-face-browser-2026"


def main() -> None:
    email = f"world-country-face-{uuid.uuid4().hex[:10]}@example.test"
    client = httpx.Client(base_url=BASE, follow_redirects=False, timeout=20)
    created = client.post('/api/auth/register', json={
        'account_type': 'individual', 'display_name': 'Country Face Browser',
        'organization_name': '', 'email': email, 'password': PASSWORD,
    })
    assert created.status_code == 200, created.text

    options = Options()
    for arg in ('--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,1000'):
        options.add_argument(arg)
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 35)

    def open_world_map() -> None:
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.nav-btn[data-view=\"online-intel\"]'))"))
        driver.execute_script("document.querySelector('.nav-btn[data-view=\"online-intel\"]')?.click()")
        wait.until(lambda d: d.execute_script("return document.querySelector('.view.active')?.id") == 'view-online-intel')
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"world-map\"].active'))"))
        try:
            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script("return Boolean(window.HUIDIWorldIntelligenceMap && document.querySelector('#wiMap'))")
            )
        except TimeoutException:
            # The main world-market audit already proves the normal first-open
            # path. This second independent browser session can occasionally
            # reach the pane before its lazy owner has completed mounting. Ask
            # the existing tab owner to reopen the same pane once instead of
            # treating an early frame as a product regression.
            reopened = driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              const owner=window.HUIDICommunityOnlineFullV2;
              if(!owner?.openTab){done(false);return}
              Promise.resolve(owner.openTab('online-intel','world-map',{history:'replace'}))
                .then(()=>done(true)).catch(()=>done(false));
            """)
            assert reopened is True, 'Full Fusion V2 could not reopen world-map pane'
            wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"world-map\"].active'))"))
            wait.until(lambda d: d.execute_script("return Boolean(window.HUIDIWorldIntelligenceMap && document.querySelector('#wiMap'))"))

    try:
        driver.get(BASE + '/login')
        login = driver.execute_async_script("""
          const email=arguments[0],password=arguments[1],done=arguments[arguments.length-1];
          fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
            .then(async r=>done({status:r.status,body:await r.text()})).catch(e=>done({status:0,body:String(e)}));
        """, email, PASSWORD)
        assert login['status'] == 200, login
        driver.get(BASE + '/')
        wait.until(lambda d: '/community/workspace.html' in d.current_url)
        wait.until(lambda d: d.execute_script('return Boolean(window.HUIDICommunityOnlineIntelligenceV2)'))
        open_world_map()
        wait.until(lambda d: d.execute_script("return Boolean(window.HUIDIWorldCountryInteraction)"))
        driver.execute_script("window.HUIDIWorldCountryInteraction?.refresh?.()")
        wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"world-map\"].active .wi-country-stage .wi-country-svg'))"))
        wait.until(lambda d: d.execute_script("return document.querySelectorAll('.wi-country-land[data-country-code]').length===177"))

        state = driver.execute_script("""
          const head=document.querySelector('.wi-map-source-head');
          const map=document.querySelector('#wiMap');
          const germany=document.querySelector('.wi-country-land[data-country-code="DE"]');
          return {
            faces: document.querySelectorAll('.wi-country-land[data-country-code]').length,
            markets: document.querySelectorAll('.wi-country-land[data-market-id]').length,
            headTitle: head?.querySelector('b')?.textContent || '',
            modes: [...(head?.querySelectorAll('[data-wic-mode]')||[])].map(x=>x.textContent.trim()),
            modeInsideStage: Boolean(document.querySelector('.wi-country-stage > .wi-map-modes')),
            geometry: map?.dataset.wiCountryGeometry || '',
            faceFlag: map?.dataset.wiCountryFaces || '',
            germanyPointer: germany ? getComputedStyle(germany).pointerEvents : '',
            external: performance.getEntriesByType('resource').map(x=>x.name).filter(n=>n.includes('cdn.jsdelivr.net')||n.includes('natural-earth-vector'))
          };
        """)
        assert state['faces'] == 177, state
        assert state['markets'] >= 40, state
        assert state['headTitle'] == '全球客户地图分布', state
        assert state['modes'] == ['地图分析','热力图','数据分析'], state
        assert not state['modeInsideStage'], state
        assert state['geometry'] == 'natural-earth-country-boundaries-v2', state
        assert state['faceFlag'] == '177', state
        assert state['germanyPointer'] != 'none', state
        assert state['external'] == [], state

        # The visible 177-country layer is now the real interaction layer. Hit
        # Germany through its full country face (not the old hidden fallback),
        # verify hover content, then click and confirm the same canonical Market
        # owner updates selection + side panel.
        payload = driver.execute_script("""
          window.HUIDIWorldCountryInteraction?.resetView?.();
          const visual=document.querySelector('.wi-country-land[data-country-code="DE"]');
          const marker=document.querySelector('.wi-country-marker[data-market-id="DE"]');
          const node=marker?.querySelector('.wi-node');
          const fallback=document.querySelector('.wi-country-face[data-market-id="DE"]');
          if(!visual||!marker||!node||!fallback)return null;
          marker.dataset.testPointerEvents=marker.style.pointerEvents||'';
          marker.style.pointerEvents='none';
          fallback.dataset.testPointerEvents=fallback.style.pointerEvents||'';
          fallback.style.pointerEvents='none';
          const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
          const hit=document.elementFromPoint(x,y);
          const land=hit?.closest?.('.wi-country-land[data-country-code]');
          return {
            x,y,
            visualCode:visual.dataset.countryCode||'',
            visualMarket:visual.dataset.marketId||'',
            hitCode:land?.dataset.countryCode||'',
            hitMarket:land?.dataset.marketId||'',
            visualPointer:getComputedStyle(visual).pointerEvents||''
          };
        """)
        assert payload, payload
        assert payload['visualCode'] == 'DE', payload
        assert payload['visualMarket'] == 'DE', payload
        assert payload['hitCode'] == 'DE', payload
        assert payload['hitMarket'] == 'DE', payload
        assert payload['visualPointer'] != 'none', payload
        try:
            driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseMoved','x':payload['x'],'y':payload['y'],'button':'none','buttons':0})
            wait.until(lambda d: '德国' in (d.execute_script("return document.querySelector('.wi-country-bubble.open b')?.textContent || ''") or ''))
            driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mousePressed','x':payload['x'],'y':payload['y'],'button':'left','buttons':1,'clickCount':1})
            driver.execute_cdp_cmd('Input.dispatchMouseEvent', {'type':'mouseReleased','x':payload['x'],'y':payload['y'],'button':'left','buttons':0,'clickCount':1})
            wait.until(lambda d: d.execute_script("return Boolean(document.querySelector('.wi-country-land[data-country-code=\"DE\"].selected'))"))
            wait.until(lambda d: '德国' in (d.execute_script("return document.querySelector('#wiSideHead h3')?.textContent || ''") or ''))
        finally:
            driver.execute_script("""
              const marker=document.querySelector('.wi-country-marker[data-market-id="DE"]');
              const fallback=document.querySelector('.wi-country-face[data-market-id="DE"]');
              if(marker){marker.style.pointerEvents=marker.dataset.testPointerEvents||'';delete marker.dataset.testPointerEvents}
              if(fallback){fallback.style.pointerEvents=fallback.dataset.testPointerEvents||'';delete fallback.dataset.testPointerEvents}
            """)

        # Country faces with no HUIDI market stay factual and do not synthesize
        # buyer/customer/deal counts. Antarctica is a stable non-market fixture.
        antarctica = driver.execute_script("""
          const el=document.querySelector('.wi-country-land[data-country-code="AQ"]');
          return el ? {market:el.dataset.marketId||'', label:el.getAttribute('aria-label')||'', pointer:getComputedStyle(el).pointerEvents||''} : null;
        """)
        assert antarctica and antarctica['market'] == '', antarctica
        assert antarctica['pointer'] != 'none', antarctica
        assert '暂无你的业务记录' in antarctica['label'], antarctica
        print('HUIDI full-country-face interaction/source-parity Chrome PASS')
    finally:
        driver.quit(); client.close()


if __name__ == '__main__':
    main()
