"""Isolated mouse/keyboard UX acceptance. No real provider keys or email sends.
Existing browser security policies are not changed. Run on the approved CI runner.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import httpx
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


def exercise(base: str, output: Path) -> None:
    report={'status':'RUNNING','mode':'isolated mouse-and-keyboard','checks':[],
            'page_errors':[],'live_external_services':'NOT TESTED','real_emails_sent':0}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1640,'height':920},locale='zh-CN')
        auth=context.request.post(base+'/api/auth/register',data={
            'account_type':'individual','display_name':'UX Acceptance',
            'email':f'ux-{uuid.uuid4().hex[:12]}@example.test','password':uuid.uuid4().hex})
        assert auth.status==200,auth.text()
        page=context.new_page()
        page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
        dialogs=[]
        page.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
        def check(name, condition=True):
            report['checks'].append({'name':name,'ok':bool(condition)})
            assert condition,name
        def ready():
            page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDIQuickChoices) && Boolean(window.HUIDICommunityOnlineFullV2)",timeout=35000)
        def nav(view,tab='base'):
            page.locator(f'.sidebar .nav-btn[data-view="{view}"]').click()
            page.locator(f'#view-{view} [data-fv2-tab="{tab}"]').click()
            page.wait_for_selector(f'#view-{view}.active [data-fv2-pane="{tab}"].active:not([hidden])')
        def shot(name):
            page.screenshot(path=str(output/(name+'.png')))
        def only_one_pane(view):
            return page.locator(f'#view-{view} > .fv2-panes > .fv2-pane:visible').count()==1
        try:
            page.goto(base+'/',wait_until='domcontentloaded');ready()
            nav('online-find');check('only active customer-development panel is visible',only_one_pane('online-find'))
            check('no lazy-load placeholder leaked into page','首次打开时读取真实数据' not in page.locator('body').inner_text())
            # Ordinary keyboard selection, not setting the final field value from JavaScript.
            keyword=page.locator('#hfKeyword');country=page.locator('#hfCountry')
            keyword.fill('stainless steel hinge')
            keyword.press('Tab');check('Tab reaches country field',country.evaluate('(e)=>e===document.activeElement'))
            country.fill('德国');country.press('ArrowDown');country.press('Enter')
            check('Chinese country search and keyboard selection',country.input_value()=='Germany')
            country.press('Tab');check('Tab reaches buyer-type select',page.locator('#hfBuyerType').evaluate('(e)=>e===document.activeElement'))
            page.locator('#hfBuyerType').select_option('retailer ecommerce')
            with page.expect_response(lambda r:'/api/leads/search' in r.url and r.request.method=='POST') as response:
                page.locator('#hfSearchBtn').click()
            check('unconfigured source returns honest error',response.value.status==503)
            page.locator('#hfFindMessage[data-state=error]').wait_for()
            check('search input retained on failed source',keyword.input_value()=='stainless steel hinge' and country.input_value()=='Germany')
            check('source setup action is visible',page.locator('[data-hf-configure]').is_visible())
            shot('search-country-and-actionable-error')
            page.locator('[data-hf-configure]').click()
            page.wait_for_selector('#view-online-admin.active [data-ss-card="tavily"]')
            page.locator('[data-hf-config-return]').click()
            page.wait_for_selector('#view-online-find.active #hfCountry')
            check('source configuration returns to retained business context',country.input_value()=='Germany' and keyword.input_value()=='stainless steel hinge')
            # Editable input must continue to accept a non-enumerated region.
            country.fill('Custom sales region');country.press('Tab')
            check('free text remains possible',country.input_value()=='Custom sales region')
            country.fill('');country.press('ArrowUp')
            check('initial ArrowUp selects last visible option',page.locator('#huidi-choice-list [role=option]').last.get_attribute('aria-selected')=='true')
            country.press('Escape');check('Escape dismisses choices without changing value',country.input_value()=='' and page.locator('#huidi-choice-list').is_hidden())
            country.fill('德国');country.press('ArrowDown');country.press('Enter')
            # Composition event suppression is an event-level assertion, not a full OS IME claim.
            before=[]
            listener=lambda r:before.append(r.url) if r.method=='POST' and '/api/leads/search' in r.url else None
            page.on('request',listener)
            keyword.dispatch_event('keydown',{'key':'Enter','code':'Enter','isComposing':True,'keyCode':229,'bubbles':True})
            page.wait_for_timeout(150);check('IME confirmation does not trigger search',not before)
            page.remove_listener('request',listener)
            # Tab key navigation must actually activate only the next panel.
            first=page.locator('#view-online-find [data-fv2-tab="base"]');first.focus();first.press('ArrowRight')
            page.wait_for_selector('#view-online-find [data-fv2-pane="pool"].active:not([hidden])')
            check('keyboard tab switching does not expose other pages',only_one_pane('online-find'))
            shot('potential-customer-list')
            nav('online-admin')
            page.wait_for_selector('#hfAdminGrid [data-hf-admin-tab="sources"]')
            text=page.locator('#hfAdminGrid').inner_text()
            check('overview uses user-language summaries',all(t not in text for t in ['Owner','community-online-fused-workspace','services','true']))
            shot('human-readable-workspace-overview')
            page.locator('#hfAdminGrid [data-hf-admin-tab="company"]').click()
            page.wait_for_selector('#view-online-admin [data-fv2-pane=company].active:not([hidden])')
            check('overview action reaches existing company form',only_one_pane('online-admin'))
            # The interactive world map is now the primary market entry. Let that default settle,
            # then explicitly open the retained market-list tab to verify alias filtering there.
            nav('online-intel','world-map')
            page.locator('#view-online-intel [data-fv2-tab="base"]').click()
            page.wait_for_selector('#view-online-intel [data-fv2-pane="base"].active:not([hidden])')
            page.locator('#hfMarkets [data-hf-market]').first.wait_for()
            page.locator('#hfMarketQ').fill('Deutschland')
            check('market filter matches country alias',page.locator('#hfMarkets [data-hf-market]').count()==1)
            check('market filter targets Germany',page.locator('#hfMarkets [data-hf-market]').get_attribute('data-hf-market')=='DE')
            page.locator('#hfMarketQ').fill('');shot('market-search-and-bounded-list')
            check('market list uses bounded scrolling',page.locator('#hfMarkets').evaluate('(e)=>getComputedStyle(e).overflowY==="auto" && e.clientHeight<650'))
            nav('mail')
            page.locator('#hfMailAccounts [data-hf-mailbox]').wait_for()
            page.locator('#hfMailAccounts [data-hf-mailbox]').click()
            page.wait_for_selector('#view-mail [data-fv2-pane="mailbox"].active:not([hidden])')
            check('empty mailbox action opens real connection page',only_one_pane('mail'))
            shot('mailbox-connection-surface')
            # Native modal and portal geometry: pointer actually clicks the option.
            page.locator('.sidebar .nav-btn[data-view="customers"]').click()
            page.locator('#view-customers [data-action="new-customer"]').first.click()
            modal=page.locator('#appDialog[open]');modal.wait_for()
            modal.locator('[data-f="company"]').fill('Unsaved UX Customer')
            modal_country=modal.locator('[data-f="country"]')
            modal_country.fill('Germany')
            page.locator('#huidi-choice-list [role=option]').first.click()
            check('pointer selects country inside native dialog',modal_country.input_value()=='Germany')
            modal_country.click();modal_country.fill('France');modal_country.press('Escape')
            check('first Escape closes dropdown, not edit dialog',modal.is_visible())
            modal_country.press('Tab');check('unselected custom input is preserved',modal_country.input_value()=='France')
            shot('native-customer-dialog-keyboard')
            modal.locator('[data-close]').filter(has_text='取消').click()
            check('cancelling form does not create customer','Unsaved UX Customer' not in page.locator('#customerRows').inner_text())
            for width,height in [(1366,768),(1640,920),(2048,1118)]:
                page.set_viewport_size({'width':width,'height':height})
                for view in ['online-find','mail','online-intel','online-admin']:
                    nav(view);check(f'{view} viewport {width}: single panel',only_one_pane(view))
                    check(f'{view} viewport {width}: no document overflow',page.evaluate('() => document.documentElement.scrollWidth<=innerWidth+2'))
                    shot(f'{view}-{width}')
            # Network failure simulation without changing any browser security policy.
            page.route('**/huidi-community-online-full-v2.css*',lambda route:route.abort())
            page.route('**/huidi-community-online-shell-closure-v1.css*',lambda route:route.abort())
            page.reload(wait_until='domcontentloaded');ready();nav('online-find')
            check('stylesheet failure still keeps inactive panels hidden',only_one_pane('online-find'))
            check('critical tab styling survives stylesheet failure',page.locator('#view-online-find .fv2-tab').first.evaluate('(e)=>parseFloat(getComputedStyle(e).minHeight)>=34'))
            check('stylesheet failure cannot leak placeholders','首次打开时读取真实数据' not in page.locator('body').inner_text())
            shot('stylesheet-failure-isolation')
            check('no blocking browser dialogs',not dialogs)
            check('no uncaught page exceptions',not report['page_errors'])
            report['status']='PASS'
        except Exception as exc:
            report['status']='FAIL';report['error']=str(exc)
            try:
                shot('failure');(output/'failure.html').write_text(page.content(),encoding='utf-8')
            except Exception:pass
            raise
        finally:
            (output/'HUMAN-OPERATION-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(report,ensure_ascii=False),flush=True)
            browser.close()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/huidi-human-operation')
    output=Path(parser.parse_args().output).resolve();output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='huidi-human-qa-') as temp:
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        env={k:v for k,v in os.environ.items() if not any(x in k for x in ('API_KEY','CLIENT_ID','CLIENT_SECRET','SMTP_PASSWORD'))}
        env.update(HUIDI_SECRET_KEY=uuid.uuid4().hex,HUIDI_TEAM_ACCESS='1',HUIDI_COMMUNITY_SURFACE='1',HUIDI_SIGNUP_ENABLED='1',HUIDI_DISABLE_BACKGROUND_JOBS='1',HUIDI_AUTO_BACKUP='0',HUIDI_PUBLIC_BASE_URL=base,DATABASE_URL=f'sqlite:///{temp}/app.db')
        with (output/'server.log').open('w') as log:
            process=subprocess.Popen([sys.executable,'-m','uvicorn','app.daily_app:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT/'online/api',env=env,stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try:
                        if httpx.get(base+'/login',timeout=1).status_code==200:break
                    except httpx.HTTPError:pass
                    if process.poll() is not None:raise RuntimeError('Isolated app exited')
                    time.sleep(.2)
                else:raise RuntimeError('Isolated app did not start')
                exercise(base,output)
            finally:
                process.terminate()
                try:process.wait(timeout=10)
                except subprocess.TimeoutExpired:process.kill();process.wait()

if __name__=='__main__':main()
