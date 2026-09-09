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
        page.on('pageerror', lambda error: report['page_errors'].append(getattr(error,'stack',None) or str(error)))
        page.on('response', lambda r: report['http_errors'].append({'url': r.url.replace(base, ''), 'status': r.status}) if r.status >= 400 else None)
        page.on('dialog', lambda d: (report['dialogs'].append(d.message), d.dismiss()))
        page.goto(base + '/', wait_until='domcontentloaded')
        page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready'", timeout=35000)
        page.wait_for_function('() => Boolean(window.HUIDICommunityOnlineFullV2)', timeout=15000)
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
                page.wait_for_function("() => Number(document.querySelector('#fv2PoolTable')?.dataset.page)===2")
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
            page.wait_for_function("() => document.querySelectorAll('#fv2PoolTable tbody tr[data-fv2-lead]').length===1")
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
        # Business list/summary/pager owners, actual edit windows and durable document chain.
        try:
            awaitables = page.evaluate("""async () => {
              const r=HUIDILocalCore.repositories;
              const pad=n=>String(n).padStart(3,'0');
              const fixture={
                customers:n=>({id:'scale-c-'+pad(n),company:'Scale Customer '+pad(n),email:'scale-'+n+'@example.test',country:'Germany'}),
                products:n=>({id:'scale-p-'+pad(n),name:'Scale Product '+pad(n),sku:'SC-'+pad(n),spec:'SUS304 test fixture',unit:'PCS',category:n>=50?'Late match':'General'}),
                deals:n=>({id:'scale-d-'+pad(n),title:'Scale Inquiry '+pad(n),customer_id:'qa-customer',product_ids:['qa-product'],stage:n>=50?'production':'new_inquiry'}),
                mail:n=>({id:'scale-m-'+pad(n),subject:'Scale Draft '+pad(n),to:'qa@example.test',body:'Not sent test fixture',updated_at:'2026-09-09T00:00:00Z'}),
                brands:n=>({id:'scale-b-'+pad(n),brand_name:'Scale Brand '+pad(n),company_name:'Scale Company '+pad(n)}),
                templates:n=>({id:'scale-t-'+pad(n),name:'Scale Terms '+pad(n),trade_terms:'FOB'}),
                recycle:n=>({id:'scale-r-'+pad(n),type:'product',source_key:'huidi_local_products_v1',original_id:'removed-'+pad(n),payload:{id:'removed-'+pad(n),name:'Removed Product '+pad(n)},deleted_at:'2026-09-09T00:00:00Z'})
              };
              for(const [key,fn] of Object.entries(fixture)){const extra=Array.from({length:55},(_,n)=>fn(n));if(r[key])r[key].replaceAll([...r[key].list(),...extra]);else{const storageKey=HUIDILocalCore.keys[key];if(!storageKey)throw new Error('Unknown fixture collection '+key);const current=JSON.parse(localStorage.getItem(storageKey)||'[]');localStorage.setItem(storageKey,JSON.stringify([...current,...extra]));}}
              await HUIDICommunityCloudAdapter.syncState();const persisted=await (await fetch('/api/business/deals?page=1&page_size=100')).json();const deal=(persisted.items||persisted).find(x=>x.title==='QA inquiry connectivity');if(!deal?.id)throw new Error('Fixture inquiry did not persist');
              for(let n=0;n<55;n++)await HUIDILocalDB.putDocument({id:'scale-doc-'+pad(n),deal_id:String(deal.id),document_type:'quotation',document_no:'QA-Q-'+pad(n),customer_name:'QA Customer',customer_id:'qa-customer',product_ids:['qa-product'],updated_at:'2026-09-09T00:00:00Z',payload:{documentType:'quotation',dealId:String(deal.id),state:{documentType:'quotation',fields:{documentType:'quotation',documentNo:'QA-Q-'+pad(n),customerName:'QA Customer'},items:[]}}});
              return true;
            }""")
            assert awaitables
            page.wait_for_timeout(1600)
            for view in ['customers','products','deals','documents','mail','brands','templates','recycle']:
                click_nav(view)
                if view=='mail':click_tab('mail','base')
                pager=page.locator(f'#view-{view} .huidi-pagebar')
                pager.locator('[data-page-next]').click()
                page.wait_for_timeout(750)
                assert pager.get_attribute('data-page')=='2',(view,pager.inner_text())
                report['checks'].append({'name':view+'-page-2-survives-legacy-refresh','ok':True})
                snapshot('paged_'+view)
            click_nav('deals')
            page.locator('[data-r1-summary="deals"][data-r1-filter="execution"]').click()
            page.wait_for_timeout(750)
            assert page.locator('#view-deals .huidi-pagebar').get_attribute('data-total')=='5'
            assert page.locator('#dealRows tr[data-quick-id]').count()==5
            report['checks'].append({'name':'summary-filter-applied-before-pagination','ok':True})
            click_nav('customers')
            row=page.locator('#customerRows tr[data-quick-id]').first
            row.click()
            page.wait_for_selector('#huidiQuickBackdrop.open')
            assert page.locator('.workspace-r1-drawer.open').count()==0
            page.keyboard.press('Escape')
            page.wait_for_selector('#huidiQuickBackdrop.open',state='hidden')
            report['checks'].append({'name':'single-detail-drawer-escape','ok':True})
            row.click()
            page.locator('#huidiQuickBackdrop [data-action="customer-edit"]').click()
            page.wait_for_selector('#appDialog[open]')
            assert page.locator('#huidiQuickBackdrop.open').count()==0
            page.keyboard.press('Escape')
            report['checks'].append({'name':'quick-detail-to-native-edit-and-return','ok':True})
            click_nav('products')
            row=page.locator('#productRows tr[data-quick-id]').first
            assert row.locator('[data-action="product-delete"]').count()==1
            assert row.locator('[data-action="catalog-one"]').count()==1
            row.click()
            page.locator('#huidiQuickBackdrop [data-context-find-product]').click()
            page.wait_for_function('() => document.querySelector(".view.active")?.id === "view-online-find"')
            assert 'Scale Product' in page.locator('#hfKeyword').input_value()
            assert '/community/workspace.html' in page.url
            report['checks'].append({'name':'secondary-product-actions-and-same-workspace-acquisition','ok':True})
            # Discard no data: opening and cancelling the permanent-delete dialog must preserve the row.
            click_nav('recycle')
            before=page.evaluate('() => JSON.parse(localStorage.getItem(HUIDILocalCore.keys.recycle)||"[]").length')
            page.locator('#recycleRows [data-action="recycle-empty"]').first.click()
            page.wait_for_selector('#appDialog[open] [data-trash-cancel]')
            page.locator('[data-trash-cancel]').click()
            assert page.evaluate('() => JSON.parse(localStorage.getItem(HUIDILocalCore.keys.recycle)||"[]").length')==before
            report['checks'].append({'name':'permanent-delete-cancel-preserves-data','ok':True})
            click_nav('documents')
            with page.expect_navigation(wait_until='domcontentloaded'):
                page.locator('#docRows [data-action="doc-next"]').first.click()
            assert '/community/editor.html' in page.url and 'proforma_invoice' in page.url,page.url
            def editor_ready(kind):
                page.wait_for_function("""(kind) => {
                  const p=document.querySelector('#piPaper');
                  return !document.documentElement.classList.contains('huidi-rc1615-boot') &&
                    document.querySelector('#documentType')?.value===kind && p &&
                    (p.dataset.fpDocumentKind===kind || p.dataset.fpDocumentType===kind) &&
                    p.innerText.trim().length>100 && p.getBoundingClientRect().width>100;
                }""", arg=kind, timeout=25000)
                page.wait_for_timeout(900)
                assert not page.evaluate('() => document.documentElement.scrollWidth > innerWidth + 2'), 'Editor viewport overflow'
            editor_ready('proforma_invoice')
            page.screenshot(path=str(output/'native-pi-chain.png'))
            report['checks'].append({'name':'paged-quotation-opens-native-PI-chain','ok':True,'preview_ready':True})
            page.locator('#buyerName').fill('QA Chain Customer')
            for kind in ['sales_contract','commercial_invoice','packing_list']:
                page.locator('#huidiLocalNextHeader > summary').click()
                with page.expect_navigation(wait_until='domcontentloaded'):
                    page.locator(f'#huidiLocalNextMenu [data-local-next="{kind}"]').click()
                editor_ready(kind)
                assert page.locator('#buyerName').input_value()=='QA Chain Customer', 'Downstream customer facts lost'
                page.screenshot(path=str(output/('native-chain-'+kind+'.png')))
                report['checks'].append({'name':'native-chain-'+kind+'-rendered-with-customer','ok':True})
        except Exception as error:
            try:
                page.screenshot(path=str(output/'native-document-failure.png'))
                evidence=page.evaluate('''() => ({url:location.href, classes:document.documentElement.className,
                    type:document.querySelector('#documentType')?.value,
                    paper:document.querySelector('#piPaper')?{data:{...document.querySelector('#piPaper').dataset},
                    text:document.querySelector('#piPaper').innerText.slice(0,800),
                    width:document.querySelector('#piPaper').getBoundingClientRect().width}:null,
                    title:document.title, body:document.body.innerText.slice(0,16000)})''')
                (output/'native-document-failure.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
            except Exception as evidence_error:
                report['failures'].append('Could not capture document failure evidence: '+str(evidence_error))
            report['checks'].append({'name':'core-business-paging-dialog-chain','ok':False,'detail':str(error)})
        (output / 'REPORT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'screens':len(report['screens']),'failures':report['failures'],'page_errors':report['page_errors'],'checks':report['checks']}, ensure_ascii=False), flush=True)
        browser.close()
    if strict:
        assert not report['failures'], report['failures']
        assert not report['page_errors'], report['page_errors']
        assert all(check['ok'] for check in report['checks']), report['checks']


if __name__ == '__main__':
    main()
