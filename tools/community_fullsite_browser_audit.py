"""Real-pointer fullsite inventory in an isolated tenant; never production.
Screenshots and discovery results are evidence, not automatic visual approval.
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

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='/tmp/huidi-fullsite-browser')
    parser.add_argument('--strict', action='store_true')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='huidi-fullsite-') as temp:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        env = {k: v for k, v in os.environ.items() if not any(w in k for w in ('API_KEY', 'CLIENT_SECRET', 'CLIENT_ID', 'SMTP_PASSWORD'))}
        env.update(HUIDI_SECRET_KEY=uuid.uuid4().hex, HUIDI_DISABLE_BACKGROUND_JOBS='1', HUIDI_AUTO_BACKUP='0', HUIDI_TEAM_ACCESS='1', HUIDI_SIGNUP_ENABLED='1', HUIDI_COMMUNITY_SURFACE='1', DATABASE_URL=f'sqlite:///{temp}/app.db')
        with (output / 'server.log').open('w') as log:
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.daily_app:app', '--host', '127.0.0.1', '--port', str(port)], cwd=ROOT / 'online/api', env=env, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        if httpx.get(base + '/login', timeout=1).status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    if process.poll() is not None:
                        raise RuntimeError('Isolated server exited during startup')
                    time.sleep(.2)
                else:
                    raise RuntimeError('Isolated server did not start')
                run_browser(base, output, args.strict)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def run_browser(base, output, strict):
    report = {'mode': 'isolated-real-browser', 'screens': [], 'failures': [], 'page_errors': [], 'http_errors': [], 'dialogs': [], 'checks': []}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1640, 'height': 920}, locale='zh-CN')
        response = context.request.post(base + '/api/auth/register', data={'account_type': 'individual', 'display_name': 'Fullsite QA', 'organization_name': '', 'email': f'fullsite-{uuid.uuid4().hex[:10]}@example.test', 'password': 'Fullsite-isolated-test-2026'})
        assert response.status == 200, response.text()
        for i in range(105):
            response = context.request.post(base + '/api/leads/manual', data={'company_name': f'QA Buyer {i:03d}', 'website': f'https://qa-{i:03d}.example', 'country': 'Germany', 'product_keyword': 'stainless steel hinge', 'contact_name': f'Buyer {i}', 'contact_email': f'buyer@qa-{i:03d}.example', 'create_inquiry': False})
            assert response.status == 200, response.text()
        page = context.new_page()
        page.set_default_timeout(8000)
        page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
        page.on('response', lambda r: report['http_errors'].append({'url': r.url.replace(base, ''), 'status': r.status}) if r.status >= 400 else None)
        page.on('dialog', lambda d: (report['dialogs'].append(d.message), d.dismiss()))
        page.goto(base + '/', wait_until='domcontentloaded')
        page.wait_for_function("document.documentElement.dataset.huidiCloud==='ready'", timeout=35000)
        page.wait_for_function('Boolean(window.HUIDICommunityOnlineFullV2)', timeout=15000)
        page.wait_for_timeout(1600)
        page.evaluate("""() => {const r=HUIDILocalCore.repositories;
          r.customers.upsert({id:'qa-customer',company:'QA Customer Long Company Name',contact:'Tester',email:'qa@example.test',country:'Germany'});
          r.products.upsert({id:'qa-product',name:'QA Stainless Steel Hinge Extended Model Description SUS304',sku:'QA-304',spec:'SUS304 4 inch',price:'1.23',currency:'USD',unit:'PCS',moq:'500',category:'Hardware'});
          r.deals.upsert({id:'qa-deal',title:'QA inquiry connectivity',customer_id:'qa-customer',product_ids:['qa-product'],stage:'new_inquiry',next_action:'Confirm requirements',next_action_at:'2026-09-09'});
        }""")
        page.wait_for_timeout(1500)

        def snapshot(name):
            data = page.evaluate("""() => {
              const v=document.querySelector('.view.active'), scope=v?.querySelector('.fv2-pane.active')||v;
              const rect=x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
              const visible=x=>x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden';
              const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);
              return {view:v?.id,title:document.querySelector('#pageTitle')?.innerText,url:location.pathname+location.search+location.hash,text:scope?.innerText,
                overflow:document.documentElement.scrollWidth>innerWidth+2,duplicateIds:[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))],
                buttons:[...scope?.querySelectorAll('button,a,summary')||[]].filter(visible).map(x=>({text:x.innerText,disabled:!!x.disabled,id:x.id,attrs:[...x.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value]),rect:rect(x)})),
                sidebar:[...document.querySelectorAll('.sidebar .nav-btn')].filter(visible).map(x=>({view:x.dataset.view,text:x.innerText,rect:rect(x)}))};
            }""")
            (output / (name + '.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            page.screenshot(path=str(output / (name + '.png')))
            report['screens'].append({'name': name, 'view': data['view'], 'overflow': data['overflow'], 'duplicateIds': data['duplicateIds'], 'buttonCount': len(data['buttons'])})
            if data['overflow']:
                report['failures'].append(name + ': viewport horizontal overflow')
            if any('undefined' in x['text'] for x in data['sidebar']):
                report['failures'].append(name + ': undefined navigation count')
            print(name, 'buttons=', len(data['buttons']), 'overflow=', data['overflow'], flush=True)
            return data

        def click_nav(view):
            nav = page.locator(f'.sidebar .nav-btn[data-view="{view}"]')
            if not nav.is_visible():
                page.locator('.huidi-online-more > summary').click()
            nav.click(timeout=5000)
            page.wait_for_function('(v)=>document.querySelector(".view.active")?.id === "view-"+v', arg=view)
            page.wait_for_timeout(500)

        def click_tab(view, tab):
            target = page.locator(f'#view-{view} [data-fv2-tab="{tab}"]')
            if not target.is_visible():
                page.locator(f'#view-{view} .huidi-tab-more > summary').click()
            target.click(timeout=5000)
            page.wait_for_function('([v,t])=>Boolean(document.querySelector(`#view-${v} [data-fv2-pane="${t}"].active`))', arg=[view, tab])
            page.wait_for_function('([v,t])=>!document.querySelector(`#view-${v} [data-fv2-pane="${t}"]`)?.hasAttribute("aria-busy")', arg=[view,tab])
            page.wait_for_timeout(500)

        snapshot('home')
        navs = page.locator('.sidebar .nav-btn').evaluate_all('(xs)=>xs.map(x=>x.dataset.view)')
        for view in navs:
            if view == 'home':
                continue
            try:
                click_nav(view)
                snapshot(view)
            except Exception as error:
                report['failures'].append(f'{view}: {error}')
                continue
            tabs = page.locator(f'#view-{view} [data-fv2-tab]').evaluate_all('(xs)=>xs.map(x=>x.dataset.fv2Tab)')
            for tab in tabs:
                if tab == 'base':
                    continue
                try:
                    click_tab(view, tab)
                    snapshot(view + '__' + tab)
                except Exception as error:
                    report['failures'].append(f'{view}:{tab}: {error}')
        for view, tab in [('mail','inbox'),('online-find','map'),('mail','inbox'),('mail','mailbox'),('online-find','contacts'),('online-find','notifications'),('online-find','contacts')]:
            try:
                click_nav(view)
                click_tab(view, tab)
                data = snapshot('revisit_' + view + '__' + tab)
                if not data['text'] or 'Cannot' in data['text']:
                    report['failures'].append(f'revisit {view}:{tab}: empty/error surface')
            except Exception as error:
                report['failures'].append(f'revisit {view}:{tab}: {error}')
        try:
            click_nav('online-find'); click_tab('online-find', 'pool')
            next_button = page.locator('[data-fv2-pool-next]')
            if next_button.count():
                next_button.click()
                page.wait_for_function("Number(document.querySelector('#fv2PoolTable')?.dataset.page)===2")
                report['checks'].append({'name':'lead-pool-page-2','ok':True})
            else:
                report['checks'].append({'name':'lead-pool-page-2','ok':False,'detail':'No functional page-2 control'})
            click_nav('mail'); click_tab('mail', 'mailbox')
            page.locator('[data-other-mail]').click(timeout=5000)
            page.wait_for_selector('#mgModalBack.open', state='visible', timeout=6000)
            report['checks'].append({'name':'other-mailbox-opens','ok':True})
            page.keyboard.press('Escape')
            page.wait_for_selector('#mgModalBack',state='detached')
            report['checks'].append({'name':'other-mailbox-escape-closes','ok':True})
        except Exception as error:
            report['checks'].append({'name':'functional-actions','ok':False,'detail':str(error)})
        try:
            click_nav('online-find'); click_tab('online-find','pool')
            page.locator('#fv2PoolQ').fill('QA Buyer 000')
            page.locator('[data-fv2-pool-form] button[type="submit"]').click()
            page.wait_for_function("document.querySelectorAll('#fv2PoolTable tbody tr[data-fv2-lead]').length===1")
            row=page.locator('#fv2PoolTable tbody tr[data-fv2-lead]').first
            lead_id=row.get_attribute('data-fv2-lead')
            row.locator('[data-hdw-route-action="develop"]').click()
            page.wait_for_function('(id)=>document.querySelector("#hdwLead")?.value===id',arg=lead_id)
            report['checks'].append({'name':'off-page-lead-opens-exact-record','ok':True,'lead_id':lead_id})
            page.locator('#hdwBody').fill('Unsent review text preserved by tab return')
            click_tab('online-find','pool'); click_tab('online-find','develop')
            assert page.locator('#hdwBody').input_value()=='Unsent review text preserved by tab return'
            report['checks'].append({'name':'development-unsaved-text-retained','ok':True})
            click_tab('online-find','map')
            page.locator('#hsMapKeyword').fill('hinges for QA region')
            click_tab('online-find','company'); click_tab('online-find','map')
            assert page.locator('#hsMapKeyword').input_value()=='hinges for QA region'
            report['checks'].append({'name':'shared-service-search-context-retained','ok':True})
            click_nav('mail'); click_tab('mail','mailbox')
            assert page.locator('#huidiServiceMain .hs-head h3').inner_text()=='邮箱设置'
            report['checks'].append({'name':'mailbox-distinct-from-inbox','ok':True})
            for width,height in [(1366,768),(2048,1118)]:
                page.set_viewport_size({'width':width,'height':height})
                click_nav('online-find');click_tab('online-find','pool')
                snapshot(f'viewport-{width}x{height}')
            page.set_viewport_size({'width':1640,'height':920})
        except Exception as error:
            report['checks'].append({'name':'expanded-navigation-forms','ok':False,'detail':str(error)})
        (output / 'REPORT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'screens':len(report['screens']),'failures':report['failures'],'page_errors':report['page_errors'],'checks':report['checks']}, ensure_ascii=False), flush=True)
        browser.close()
    if strict:
        assert not report['failures'], report['failures']
        assert not report['page_errors'], report['page_errors']
        assert all(check['ok'] for check in report['checks']), report['checks']


if __name__ == '__main__':
    main()
