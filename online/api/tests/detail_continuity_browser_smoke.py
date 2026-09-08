from __future__ import annotations

import json
import time

from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE = "http://127.0.0.1:18080"


def options() -> Options:
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1440,1000")
    return opts


def post(driver: webdriver.Chrome, path: str, payload: dict) -> dict:
    result = driver.execute_async_script(
        """
        const [path, payload, done] = arguments;
        fetch(path, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        }).then(async response => done({status: response.status, body: await response.text()}))
          .catch(error => done({status: 0, body: String(error)}));
        """,
        path,
        payload,
    )
    assert result["status"] < 400, result
    return json.loads(result["body"] or "{}")


def ctrl_s(driver: webdriver.Chrome) -> None:
    ActionChains(driver).key_down(Keys.CONTROL).send_keys("s").key_up(Keys.CONTROL).perform()


def enabled(element) -> bool:
    return element.is_enabled() and element.get_attribute("disabled") is None


def main() -> None:
    driver = webdriver.Chrome(options=options())
    driver.set_page_load_timeout(20)
    driver.set_script_timeout(10)
    wait = WebDriverWait(driver, 20)
    stamp = str(int(time.time() * 1000))[-8:]
    try:
        driver.get(BASE + "/")

        # Product detail: low-frequency sections collapse, Ctrl+S uses the existing
        # product owner, and current visible product list can be reviewed continuously.
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-huidi-product]'))).click()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '#pbBackdrop.open.pb-page-surface')))
        sections = driver.find_elements(By.CSS_SELECTOR, '#pbForm details.hdc-product-section')
        assert len(sections) == 2, len(sections)
        assert all(section.get_attribute('open') is None for section in sections)

        for suffix in ("A", "B"):
            driver.find_element(By.ID, 'pbNew').click()
            name = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-pbf="name"]')))
            sku = driver.find_element(By.CSS_SELECTOR, '[data-pbf="sku"]')
            name.clear()
            name.send_keys(f'Continuity Product {stamp}-{suffix}')
            sku.clear()
            sku.send_keys(f'HDC-{stamp}-{suffix}')
            ctrl_s(driver)
            wait.until(lambda d: any(f'Continuity Product {stamp}-{suffix}' in x.text for x in d.find_elements(By.CSS_SELECTOR, '#pbList [data-pbid]')))

        items = driver.find_elements(By.CSS_SELECTOR, '#pbList [data-pbid]')
        assert len(items) >= 2, len(items)
        items[0].click()
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '#pbList [data-pbid].active'))
        before_product = driver.find_element(By.CSS_SELECTOR, '[data-pbf="name"]').get_attribute('value')
        wait.until(lambda d: enabled(d.find_element(By.CSS_SELECTOR, '[data-hdc-product-next]')))
        driver.find_element(By.CSS_SELECTOR, '[data-hdc-product-next]').click()
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-pbf="name"]').get_attribute('value') != before_product)
        wait.until(lambda d: enabled(d.find_element(By.CSS_SELECTOR, '[data-hdc-product-prev]')))
        driver.find_element(By.CSS_SELECTOR, '[data-hdc-product-prev]').click()
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-pbf="name"]').get_attribute('value') == before_product)

        # Return through the existing Page Router, then assert the actual lead-list
        # workspace is active. Empty tbody is zero-height, so presence—not visibility—
        # is the correct precondition before the first manual leads are created.
        driver.find_element(By.CSS_SELECTOR, '[data-hpr-home]').click()
        wait.until(lambda d: d.execute_script("return window.HUIDIWorkspacePages?.current?.()") == 'home')
        wait.until(lambda d: 'hpr-active' not in (d.find_element(By.CSS_SELECTOR, '.main').get_attribute('class') or ''))
        wait.until(EC.presence_of_element_located((By.ID, 'tbody')))

        # Lead detail: create two real manual leads, then click the visible “全部” tab.
        # Its mature app.js handler resets the current filter/page and calls the real
        # list load(), matching the actual user path instead of relying on an internal
        # global refresh object.
        lead_names = [f'Continuity Lead {stamp}-A', f'Continuity Lead {stamp}-B']
        for company in lead_names:
            post(driver, '/api/leads/manual', {
                'company_name': company,
                'product_keyword': 'stainless steel hinge',
                'country': 'DE',
                'website': '',
                'contact_name': '',
                'contact_email': '',
                'requirements': '',
                'create_inquiry': False,
            })
        all_tab = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '#tabs .tab[data-status=""]')))
        all_tab.click()
        first_lead = wait.until(EC.element_to_be_clickable((By.XPATH, f'//tr[contains(., "{lead_names[0]}")]//button[@data-open]')))
        first_lead.click()
        rail = wait.until(EC.visibility_of_element_located((By.ID, 'hdcLeadRail')))
        assert rail.is_displayed()
        assert driver.find_element(By.CSS_SELECTOR, '[data-hdc-collapse="客户背调"]').get_attribute('open') is None
        assert driver.find_element(By.CSS_SELECTOR, '[data-hdc-collapse="开发记录"]').get_attribute('open') is None
        before_lead = driver.find_element(By.ID, 'dCompany').text
        lead_next = driver.find_element(By.CSS_SELECTOR, '[data-hdc-lead-next]')
        lead_prev = driver.find_element(By.CSS_SELECTOR, '[data-hdc-lead-prev]')
        nav = lead_next if enabled(lead_next) else lead_prev
        assert enabled(nav), 'lead continuity needs at least one enabled neighbor'
        nav.click()
        wait.until(lambda d: d.find_element(By.ID, 'dCompany').text != before_lead)
        driver.find_element(By.CSS_SELECTOR, '[data-hdc-lead-back]').click()
        wait.until(lambda d: 'open' not in (d.find_element(By.ID, 'backdrop').get_attribute('class') or ''))

        # Inquiry + customer detail: manual confirmed inquiries create the existing
        # Customer -> Deal chain, then the same Business owner is used for continuity.
        inquiry_names = [f'Continuity Buyer {stamp}-A', f'Continuity Buyer {stamp}-B']
        for company in inquiry_names:
            post(driver, '/api/leads/manual', {
                'company_name': company,
                'product_keyword': 'stainless steel hinge',
                'country': 'US',
                'website': '',
                'contact_name': 'Buyer',
                'contact_email': '',
                'requirements': 'Quantity 1000 pcs',
                'create_inquiry': True,
            })

        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-huidi-business="deals"]'))).click()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '#huidiBusinessBack.open.hb-page-surface')))
        deal_row = wait.until(EC.element_to_be_clickable((By.XPATH, f'//tr[@data-deal and contains(., "{inquiry_names[0]}")]')))
        deal_row.click()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '#huidiBusinessMain .hdc-business-rail')))
        reference = driver.find_element(By.CSS_SELECTOR, 'details[data-hdc-collapse="联网业务参考"]')
        assert reference.get_attribute('open') is None
        before_deal = driver.find_element(By.CSS_SELECTOR, '#huidiBusinessMain .hb-card h3').text
        deal_next = driver.find_element(By.CSS_SELECTOR, '[data-hdc-business-next]')
        deal_prev = driver.find_element(By.CSS_SELECTOR, '[data-hdc-business-prev]')
        nav = deal_next if enabled(deal_next) else deal_prev
        assert enabled(nav), 'deal continuity needs at least one enabled neighbor'
        nav.click()
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '#huidiBusinessMain .hb-card h3').text != before_deal)

        driver.find_element(By.CSS_SELECTOR, '[data-back-deals]').click()
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-hb-view="customers"]'))).click()
        customer_row = wait.until(EC.element_to_be_clickable((By.XPATH, f'//tr[@data-customer-id and contains(., "{inquiry_names[0]}")]')))
        customer_row.click()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '#huidiBusinessMain .hdc-business-rail')))
        before_customer = driver.find_element(By.ID, 'hbCustomerCompany').get_attribute('value')
        customer_next = driver.find_element(By.CSS_SELECTOR, '[data-hdc-business-next]')
        customer_prev = driver.find_element(By.CSS_SELECTOR, '[data-hdc-business-prev]')
        nav = customer_next if enabled(customer_next) else customer_prev
        assert enabled(nav), 'customer continuity needs at least one enabled neighbor'
        nav.click()
        wait.until(lambda d: d.find_element(By.ID, 'hbCustomerCompany').get_attribute('value') != before_customer)

        print('HUIDI continuous product / lead / inquiry / customer detail review browser smoke PASS')
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
