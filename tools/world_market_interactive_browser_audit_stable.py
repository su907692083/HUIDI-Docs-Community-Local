from __future__ import annotations

import runpy
import time
from pathlib import Path

from selenium.webdriver.remote.webdriver import WebDriver

_ORIGINAL_SET_WINDOW_SIZE = WebDriver.set_window_size


def _stable_set_window_size(self: WebDriver, width: int, height: int, windowHandle: str = "current"):
    result = _ORIGINAL_SET_WINDOW_SIZE(self, width, height, windowHandle)
    try:
        mounted = self.execute_script(
            "return Boolean(document.querySelector('#view-online-intel [data-fv2-pane=\"world-map\"].active .wi-map-card'))"
        )
        if not mounted:
            return result
        for _ in range(100):
            ready = self.execute_script("""
              const pane=document.querySelector('#view-online-intel [data-fv2-pane="world-map"].active');
              const view=document.querySelector('#view-online-intel');
              const map=pane?.querySelector('.wi-map-card'),side=pane?.querySelector('.wi-side');
              const ar=map?.getBoundingClientRect(),sr=side?.getBoundingClientRect(),vc=view?.clientWidth||0;
              return Boolean(pane&&ar&&sr&&vc>0&&ar.width>=vc*.90&&sr.width>=vc*.90);
            """)
            if ready:
                return result
            time.sleep(0.04)
    except Exception:
        return result
    return result


WebDriver.set_window_size = _stable_set_window_size
runpy.run_path(str(Path(__file__).with_name('world_market_interactive_browser_audit.py')), run_name='__main__')
