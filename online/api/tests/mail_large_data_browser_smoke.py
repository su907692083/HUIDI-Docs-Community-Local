from __future__ import annotations

import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18084"


def options() -> Options:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1440,1000")
    return opts


def install_fetch_probe(driver: webdriver.Chrome) -> None:
    driver.execute_script(
        """
        window.__mailLargeUrls = [];
        window.__mailLargeOriginalFetch = window.fetch;
        window.fetch = function(...args) {
          const url = String(args[0] || '');
          if (url.startsWith('/api/mail/')) window.__mailLargeUrls.push(url);
          return window.__mailLargeOriginalFetch.apply(this, args);
        };
        """
    )


def clear_probe(driver: webdriver.Chrome) -> None:
    driver.execute_script("window.__mailLargeUrls = [];")


def urls(driver: webdriver.Chrome) -> list[str]:
    return [str(x) for x in driver.execute_script("return Array.from(window.__mailLargeUrls || []);")]


def open_page(driver: webdriver.Chrome, wait: WebDriverWait, page: str, title: str) -> list[str]:
    clear_probe(driver)
    driver.execute_script("window.HUIDIWorkspacePages.open(arguments[0]);", page)
    wait.until(
        lambda d: (d.execute_script("return document.querySelector('#huidiServiceMain .hs-head h3')?.textContent || ''") or "").strip()
        == title
    )
    time.sleep(0.7)
    return urls(driver)


def paged_message_requests(rows: list[str], folder: str) -> list[str]:
    return [
        x
        for x in rows
        if x.startswith("/api/mail/messages?")
        and "paged=1" in x
        and f"folder={folder}" in x
        and "page=1" in x
        and "page_size=50" in x
    ]


def paged_queue_requests(rows: list[str]) -> list[str]:
    return [
        x
        for x in rows
        if x.startswith("/api/mail/queue?")
        and "paged=1" in x
        and "page=1" in x
        and "page_size=50" in x
    ]


def main() -> None:
    driver = webdriver.Chrome(options=options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(20)
    wait = WebDriverWait(driver, 20)
    try:
        driver.get(BASE + "/")
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIWorkspacePages?.open === 'function'"))
        wait.until(lambda d: d.execute_script("return typeof window.HUIDIMailListPagination?.adoptMail === 'function'"))
        install_fetch_probe(driver)

        inbox = open_page(driver, wait, "mail", "邮箱与回复")
        inbox_paged = paged_message_requests(inbox, "inbox")
        assert len(inbox_paged) == 1, inbox
        assert not any("limit=80" in x for x in inbox), inbox
        assert not any(x == "/api/mail/messages" for x in inbox), inbox
        assert not any(x.startswith("/api/mail/messages?") and "paged=1" not in x for x in inbox), inbox

        sent = open_page(driver, wait, "sent", "已发送")
        sent_paged = paged_message_requests(sent, "sent")
        assert len(sent_paged) == 1, sent
        assert not any("limit=80" in x for x in sent), sent
        assert not any(x.startswith("/api/mail/messages?") and "paged=1" not in x for x in sent), sent

        queue = open_page(driver, wait, "queue", "待发送")
        queue_paged = paged_queue_requests(queue)
        assert len(queue_paged) == 1, queue
        assert "/api/mail/queue" not in queue, queue
        assert not any(x.startswith("/api/mail/queue?") and "paged=1" not in x for x in queue), queue

        print(
            "HUIDI Mail first-page large-data closure PASS:",
            {
                "inbox": inbox_paged,
                "sent": sent_paged,
                "queue": queue_paged,
            },
        )
    finally:
        try:
            driver.execute_script(
                """
                if (window.__mailLargeOriginalFetch) window.fetch = window.__mailLargeOriginalFetch;
                delete window.__mailLargeOriginalFetch;
                delete window.__mailLargeUrls;
                """
            )
        except Exception:
            pass
        driver.quit()


if __name__ == "__main__":
    main()
