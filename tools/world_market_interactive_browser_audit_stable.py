from __future__ import annotations

import runpy
import time
from pathlib import Path

from selenium.webdriver.remote.webdriver import WebDriver

_ORIGINAL_SET_WINDOW_SIZE = WebDriver.set_window_size


def _stable_set_window_size(self: WebDriver, width: int, height: int, windowHandle: str = "current"):
    # Every resize starts a fresh continuous-visibility window. Full Fusion V2 can
    # finish a late pane render after the native resize, so a handful of good
    # frames is not enough: the real world-map pane must remain visible and keep
    # the same stage/search identities for a sustained period before returning.
    try:
        self.execute_script("""
          window.__huidiAuditStablePane=null;
          window.__huidiAuditStableSearch=null;
          window.__huidiAuditStableStage=null;
          window.__huidiAuditStableSince=0;
        """)
    except Exception:
        pass

    result = _ORIGINAL_SET_WINDOW_SIZE(self, width, height, windowHandle)

    # 150 * 40ms keeps the gate bounded at about six seconds. A candidate frame
    # must remain continuously usable for 1.2s; any late hide/re-render resets
    # the window instead of letting the following layout assertion sample 0x0.
    for _ in range(150):
        try:
            stable = self.execute_script("""
              const pane=document.querySelector('#view-online-intel [data-fv2-pane="world-map"].active');
              const view=document.querySelector('#view-online-intel');
              const map=pane?.querySelector('.wi-map-card'),side=pane?.querySelector('.wi-side');
              const stage=pane?.querySelector('.wi-country-stage');
              const svg=pane?.querySelector('.wi-country-svg');
              const search=pane?.querySelector('#wiCountrySearch') || document.querySelector('#wiCountrySearch');
              const owner=window.HUIDIWorldCountryInteraction;
              const ar=map?.getBoundingClientRect(),sr=side?.getBoundingClientRect(),vc=view?.clientWidth||0;
              const paneStyle=pane?getComputedStyle(pane):null;
              const ready=Boolean(
                view?.classList.contains('active') && pane && !pane.hidden &&
                paneStyle?.display!=='none' && paneStyle?.visibility!=='hidden' &&
                map && side && stage && svg && search && owner &&
                vc>0 && ar && sr && ar.width>=vc*.90 && sr.width>=vc*.90 &&
                ar.height>0 && sr.height>0
              );
              if(!ready){
                window.__huidiAuditStablePane=null;
                window.__huidiAuditStableSearch=null;
                window.__huidiAuditStableStage=null;
                window.__huidiAuditStableSince=0;
                return false;
              }
              if(
                window.__huidiAuditStablePane!==pane ||
                window.__huidiAuditStableSearch!==search ||
                window.__huidiAuditStableStage!==stage
              ){
                window.__huidiAuditStablePane=pane;
                window.__huidiAuditStableSearch=search;
                window.__huidiAuditStableStage=stage;
                window.__huidiAuditStableSince=performance.now();
                return false;
              }
              if(!window.__huidiAuditStableSince)window.__huidiAuditStableSince=performance.now();
              return performance.now()-window.__huidiAuditStableSince>=1200;
            """)
            if stable:
                return result
        except Exception:
            pass
        time.sleep(0.04)

    # Diagnostic only: do not change timing or recovery behavior. If the gate
    # expires, record which pane/root actually owns the already-created map DOM.
    try:
        diagnostic = self.execute_script("""
          const view=document.querySelector('#view-online-intel');
          const active=view?.querySelector(':scope > .fv2-panes > .fv2-pane.active');
          const world=view?.querySelector(':scope > .fv2-panes > [data-fv2-pane="world-map"]');
          const root=document.querySelector('#huidiIntelBack');
          const map=document.querySelector('.wi-map-card'),side=document.querySelector('.wi-side');
          const ws=world?getComputedStyle(world):null,rs=root?getComputedStyle(root):null;
          return {
            href:location.href,
            bodyView:document.body?.dataset?.huidiView||'',
            viewActive:Boolean(view?.classList.contains('active')),
            activePane:active?.dataset?.fv2Pane||'',
            worldHidden:Boolean(world?.hidden),
            worldBusy:world?.getAttribute('aria-busy')||'',
            worldDisplay:ws?.display||'',
            worldVisibility:ws?.visibility||'',
            rootParentPane:root?.parentElement?.dataset?.fv2Pane||'',
            rootParentId:root?.parentElement?.id||'',
            rootOpen:Boolean(root?.classList.contains('open')),
            rootDisplay:rs?.display||'',
            rootVisibility:rs?.visibility||'',
            mapExists:Boolean(map),
            sideExists:Boolean(side),
            mapInWorld:Boolean(world&&map&&world.contains(map)),
            sideInWorld:Boolean(world&&side&&world.contains(side))
          };
        """)
        print('WORLD-MARKET STABLE TIMEOUT:', diagnostic, flush=True)
    except Exception as error:
        print('WORLD-MARKET STABLE TIMEOUT DIAGNOSTIC FAILED:', repr(error), flush=True)
    return result


WebDriver.set_window_size = _stable_set_window_size
runpy.run_path(str(Path(__file__).with_name('world_market_interactive_browser_audit.py')), run_name='__main__')
