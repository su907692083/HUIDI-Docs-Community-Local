from __future__ import annotations

import runpy
import time
from pathlib import Path

from selenium.webdriver.remote.webdriver import WebDriver

_ORIGINAL_SET_WINDOW_SIZE = WebDriver.set_window_size


def _stable_set_window_size(self: WebDriver, width: int, height: int, windowHandle: str = "current"):
    # Every resize must start from a fresh stability window. Clear the previous
    # search/stage tick state before the native resize can expose any new frame.
    try:
        self.execute_script("""
          window.__huidiAuditStableSearch=null;
          window.__huidiAuditStableStage=null;
          window.__huidiAuditStableTicks=0;
        """)
    except Exception:
        pass

    result = _ORIGINAL_SET_WINDOW_SIZE(self, width, height, windowHandle)

    for _ in range(150):
        try:
            stable = self.execute_script("""
              const pane=document.querySelector('#view-online-intel [data-fv2-pane="world-map"].active');
              const view=document.querySelector('#view-online-intel');
              const map=pane?.querySelector('.wi-map-card'),side=pane?.querySelector('.wi-side');
              const stage=pane?.querySelector('.wi-country-stage');
              const svg=pane?.querySelector('.wi-country-svg');
              const search=document.querySelector('#wiCountrySearch');
              const owner=window.HUIDIWorldCountryInteraction;
              const ar=map?.getBoundingClientRect(),sr=side?.getBoundingClientRect(),vc=view?.clientWidth||0;
              const ready=Boolean(
                pane && map && side && stage && svg && search && owner &&
                vc>0 && ar && sr && ar.width>=vc*.90 && sr.width>=vc*.90 &&
                ar.height>0 && sr.height>0
              );
              if(!ready){
                window.__huidiAuditStableSearch=null;
                window.__huidiAuditStableStage=null;
                window.__huidiAuditStableTicks=0;
                return false;
              }
              if(window.__huidiAuditStableSearch===search && window.__huidiAuditStableStage===stage){
                window.__huidiAuditStableTicks=(window.__huidiAuditStableTicks||0)+1;
              }else{
                window.__huidiAuditStableSearch=search;
                window.__huidiAuditStableStage=stage;
                window.__huidiAuditStableTicks=1;
              }
              return window.__huidiAuditStableTicks>=6;
            """)
            if stable:
                return result
        except Exception:
            pass
        time.sleep(0.04)
    return result


WebDriver.set_window_size = _stable_set_window_size
runpy.run_path(str(Path(__file__).with_name('world_market_interactive_browser_audit.py')), run_name='__main__')
