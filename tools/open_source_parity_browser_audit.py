"""Browser acceptance for open-source interaction parity.
Uses real HUIDI owners with isolated local data. No provider credentials and no email sends.
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
    report={
        'status':'RUNNING','checks':[],'page_errors':[],
        'real_emails_sent':0,'formal_price_writes':0,
        'external_providers':'NOT TESTED; isolated local records only'
    }
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1440,'height':960},locale='zh-CN')
        # Deterministic geometry only; business records/routes remain the actual app.
        fixture={
            'type':'FeatureCollection','features':[
                {'type':'Feature','properties':{'ISO_A2_EH':'DE','NAME':'Germany'},'geometry':{'type':'Polygon','coordinates':[[[5,47],[16,47],[16,55],[5,55],[5,47]]]}},
                {'type':'Feature','properties':{'ISO_A2_EH':'US','NAME':'United States of America'},'geometry':{'type':'Polygon','coordinates':[[[-125,25],[-66,25],[-66,49],[-125,49],[-125,25]]]}},
                {'type':'Feature','properties':{'ISO_A2_EH':'JP','NAME':'Japan'},'geometry':{'type':'Polygon','coordinates':[[[129,31],[146,31],[146,46],[129,46],[129,31]]]}}
            ]
        }
        def geo(route): route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture))
        context.route('**/natural-earth-vector**',geo)
        auth=context.request.post(base+'/api/auth/register',data={
            'account_type':'individual','display_name':'Parity QA',
            'email':f'parity-{uuid.uuid4().hex[:12]}@example.test','password':uuid.uuid4().hex})
        assert auth.status==200,auth.text()
        seed1=context.request.post(base+'/api/leads/manual',data={
            'company_name':'Nordwerk Import GmbH','product_keyword':'Garden Tool Set','country':'Germany',
            'website':'https://nordwerk.example','contact_name':'Anna Weber','contact_role':'Purchasing Manager',
            'contact_email':'anna@nordwerk.example','requirements':'Importer looking for garden tool sets',
            'create_inquiry':True
        })
        seed2=context.request.post(base+'/api/leads/manual',data={
            'company_name':'Berlin Retail Group','product_keyword':'Garden Tool Set','country':'Germany',
            'website':'https://berlin-retail.example','contact_name':'Max Buyer','contact_role':'Category Buyer',
            'contact_email':'','requirements':'Retail buyer evaluating seasonal garden tools',
            'create_inquiry':False
        })
        assert seed1.status==200,seed1.text();assert seed2.status==200,seed2.text()
        lead1=str(seed1.json()['lead']['id']);lead2=str(seed2.json()['lead']['id'])
        page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
        dangerous=[]
        def watch(req):
            if req.method=='POST' and any(x in req.url for x in ('/send','/queue')): dangerous.append(req.url)
        page.on('request',watch)
        def check(name,condition=True):
            report['checks'].append({'name':name,'ok':bool(condition)});assert condition,name
        def shot(name):page.screenshot(path=str(output/(name+'.png')),full_page=True)
        try:
            page.goto(base+'/',wait_until='domcontentloaded')
            page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDICommunityOnlineFullV2)",timeout=35000)
            page.locator('.sidebar .nav-btn[data-view="online-intel"]').click()
            page.wait_for_selector('#view-online-intel.active [data-fv2-pane="world-map"].active:not([hidden])')
            page.wait_for_function("() => Boolean(window.HUIDIOpenSourceParity && document.querySelector('.wi-country-svg'))",timeout=20000)
            page.locator('#wiProductContext').fill('Garden Tool Set')
            page.locator('.wi-country-market[data-market-id="DE"],.wi-country-marker[data-market-id="DE"]').first.click()
            page.wait_for_selector('.hosp-cockpit')
            page.wait_for_function("() => document.querySelectorAll('.hosp-cockpit [data-hosp-lead]').length>=2",timeout=12000)
            text=page.locator('.hosp-cockpit').inner_text()
            check('Germany cockpit shows both real seeded prospects','Nordwerk Import GmbH' in text and 'Berlin Retail Group' in text)
            check('cockpit exposes existing customer and inquiry counts','正式客户' in text and '询盘 / 业务' in text)
            check('LinkedIn action is explicitly company search',page.locator('.hosp-cockpit a').filter(has_text='LinkedIn 搜公司').count()>=2)
            check('no fabricated WhatsApp shortcut without a real phone field',page.locator('.hosp-cockpit').get_by_text('WhatsApp',exact=True).count()==0)
            for lead_id in (lead1,lead2):
                box=page.locator(f'[data-hosp-lead="{lead_id}"] [data-hosp-lead-select]')
                box.check()
            check('two prospects can be selected for batch review',page.locator('[data-hosp-batch]').first.is_enabled() and '2' in page.locator('[data-hosp-batch]').first.inner_text())
            shot('01-germany-business-cockpit')

            page.locator(f'[data-hosp-lead="{lead1}"] [data-hosp-evidence]').click()
            page.wait_for_selector('#hospEvidenceDialog[open] [data-hosp-evidence-body]')
            page.wait_for_function("() => (document.querySelector('[data-hosp-evidence-body]')?.innerText||'').includes('销售资格证据完整度')")
            ev=page.locator('[data-hosp-evidence-body]').inner_text()
            check('background panel distinguishes evidence completeness from credit score','不是信用分' in ev)
            check('six evidence dimensions are visible',all(x in ev for x in ['基础身份','公司线索','人员关联','数字资产','贸易记录','业务匹配']))
            check('unverified official and customs facts stay explicit',('工商' in ev or '官方' in ev) and ('海关' in ev or '采购' in ev))
            check('background disclaimer rejects fake official due diligence','不等同于信用报告' in ev or '不等同于' in ev)
            shot('02-evidence-background-panel')
            page.locator('#hospEvidenceDialog [data-hosp-close]').click()

            page.locator('.hosp-cockpit [data-hosp-batch]').click()
            page.wait_for_selector('#hospBatchDialog[open]')
            batch=page.locator('#hospBatchDialog').inner_text()
            check('batch development creates review queue for both prospects','Nordwerk Import GmbH' in batch and 'Berlin Retail Group' in batch)
            check('batch UI explicitly forbids automatic sending','不会批量发送' in batch and '逐个核对' in batch)
            check('opening batch review does not call mail send or queue endpoints',not dangerous)
            shot('03-batch-human-review-queue')

            page.locator('#hospBatchDialog [data-hosp-review-first]').click()
            page.wait_for_selector('#view-online-find.active [data-fv2-pane="develop"].active:not([hidden])')
            page.wait_for_selector('.hosp-review-strip')
            check('batch selection reuses existing development workbench',Boolean(page.locator('#view-online-find [data-fv2-pane="develop"] .hosp-review-strip').count()))
            check('first prospect enters sequential human review','1/2' in page.locator('.hosp-review-strip').inner_text())
            page.locator('.hosp-review-strip [data-hosp-review-next]').click()
            page.wait_for_function("() => (document.querySelector('.hosp-review-strip')?.innerText||'').includes('2/2')",timeout=8000)
            check('next prospect stays in same existing owner','2/2' in page.locator('.hosp-review-strip').inner_text())
            check('sequential review still sends nothing',not dangerous)
            check('no formal price write path introduced',report['formal_price_writes']==0)
            check('no horizontal overflow',page.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 2'))
            check('no uncaught page errors',not report['page_errors'])
            report['status']='PASS'
            shot('04-existing-development-owner-review')
        except Exception as exc:
            report['status']='FAIL';report['error']=str(exc)
            try:shot('failure');(output/'failure.html').write_text(page.content(),encoding='utf-8')
            except Exception:pass
            raise
        finally:
            report['real_emails_sent']=len(dangerous)
            (output/'OPEN-SOURCE-PARITY-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(report,ensure_ascii=False),flush=True)
            browser.close()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/huidi-open-source-parity')
    output=Path(parser.parse_args().output).resolve();output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='huidi-open-source-parity-') as temp:
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
                    if process.poll() is not None:raise RuntimeError('isolated app exited')
                    time.sleep(.2)
                else:raise RuntimeError('isolated app did not start')
                exercise(base,output)
            finally:
                process.terminate()
                try:process.wait(timeout=10)
                except subprocess.TimeoutExpired:process.kill();process.wait()

if __name__=='__main__':main()
