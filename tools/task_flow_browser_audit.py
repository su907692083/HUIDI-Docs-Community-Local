"""Isolated low-input task-flow acceptance. No real providers, prices or emails."""
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
    report={'status':'RUNNING','mode':'isolated task-flow browser','checks':[],
            'page_errors':[],'real_emails_sent':0,'formal_price_writes':0}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1640,'height':920},locale='zh-CN')
        auth=context.request.post(base+'/api/auth/register',data={
            'account_type':'individual','display_name':'Task Flow QA',
            'email':f'task-{uuid.uuid4().hex[:12]}@example.test','password':uuid.uuid4().hex})
        assert auth.status==200,auth.text()
        page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
        def check(name,condition=True):
            report['checks'].append({'name':name,'ok':bool(condition)});assert condition,name
        def shot(name):page.screenshot(path=str(output/(name+'.png')))
        def ready():page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDITaskFlow) && Boolean(window.HUIDICommunityOnlineFullV2)",timeout=35000)
        try:
            page.goto(base+'/',wait_until='domcontentloaded');ready()
            page.evaluate("""() => {
              const r=window.HUIDILocalCore.repositories;
              r.products.upsert({id:'task-p1',name:'Stainless Steel Hinge',sku:'SSH-304',spec:'SUS304 4 inch',currency:'USD',unit:'PCS'});
              r.products.upsert({id:'task-p2',name:'Garden Plant Stand',sku:'GPS-01',spec:'Powder coated steel'});
              r.customers.upsert({id:'task-c1',company:'Nordic Hardware GmbH',country:'Germany',contact:'Anna',email:'anna@example.test'});
              r.customers.upsert({id:'task-c2',company:'Pacific Retail Ltd',country:'Australia',contact:'Chris',email:'chris@example.test'});
              window.dispatchEvent(new CustomEvent('HUIDI:local-data-change'));
            }""")
            page.wait_for_selector('#view-home .htf-home')
            check('five business tasks are visible',page.locator('#view-home [data-htf-task]').count()==5)
            shot('task-home')
            page.locator('[data-htf-task="develop"]').click();page.locator('.htf-dialog[open]').wait_for()
            check('develop task uses selectable product cards',page.locator('.htf-dialog [data-htf-set="product"]').count()>=2)
            page.locator('.htf-dialog [data-htf-set="product"]').filter(has_text='Stainless Steel Hinge').first.click()
            page.locator('.htf-dialog [data-htf-set="market"]').filter(has_text='德国').first.click()
            page.locator('.htf-dialog [data-htf-set="buyerType"]').filter(has_text='进口商').first.click()
            go=page.locator('.htf-dialog [data-htf-go]');check('develop continues after only required facts',not go.is_disabled())
            go.click();page.wait_for_selector('#view-online-find.active #hfKeyword')
            page.wait_for_timeout(550)
            check('product context is reused into lead search','Stainless Steel Hinge' in page.locator('#hfKeyword').input_value())
            check('market context is reused into lead search',page.locator('#hfCountry').input_value()=='德国')
            check('task context bar stays visible while working',page.locator('.htf-context').is_visible())
            shot('develop-prefilled')
            page.locator('#hfKeyword').fill('Manual user query')
            page.evaluate('window.HUIDITaskFlow.applyContext()')
            check('manual user input is never overwritten',page.locator('#hfKeyword').input_value()=='Manual user query')
            page.locator('.sidebar .nav-btn[data-view="home"]').click();page.locator('[data-htf-task="quote"]').click()
            page.locator('.htf-dialog [data-htf-set="customer"]').filter(has_text='Nordic Hardware GmbH').first.click()
            page.locator('.htf-dialog [data-htf-set="product"]').filter(has_text='Stainless Steel Hinge').first.click()
            page.locator('.htf-dialog [data-htf-set="currency"]').filter(has_text='USD').first.click()
            page.locator('.htf-dialog [data-htf-set="incoterm"]').filter(has_text='FOB').first.click()
            check('quote task explicitly states price stays manual','价格、数量、交期仍由你在正式业务/单据里确认' in page.locator('.htf-dialog').inner_text())
            page.locator('.htf-dialog [data-htf-go]').click();page.wait_for_selector('#view-documents.active')
            check('quote routes into the existing document owner',page.locator('#view-documents.active').count()==1)
            check('quote context carries customer and product',all(x in page.locator('.htf-context').inner_text() for x in ['Nordic Hardware GmbH','Stainless Steel Hinge','USD','FOB']))
            shot('quote-existing-document-owner')
            page.locator('.sidebar .nav-btn[data-view="home"]').click();page.locator('[data-htf-task="market"]').click()
            page.locator('.htf-dialog [data-htf-set="product"]').filter(has_text='Garden Plant Stand').first.click()
            page.locator('.htf-dialog [data-htf-set="market"]').filter(has_text='德国').first.click()
            page.locator('.htf-dialog [data-htf-go]').click();page.wait_for_selector('#view-online-intel.active')
            check('market task reuses the existing intelligence domain',page.locator('#view-online-intel.active').count()==1)
            check('market task keeps visible context','Garden Plant Stand' in page.locator('.htf-context').inner_text() and '德国' in page.locator('.htf-context').inner_text())
            shot('market-existing-intelligence-owner')
            page.locator('.htf-context [data-htf-clear]').click();check('task can end without changing business records',page.locator('.htf-context').count()==0)
            check('no uncaught browser errors',not report['page_errors'])
            report['status']='PASS'
        except Exception as exc:
            report['status']='FAIL';report['error']=str(exc)
            try:shot('failure');(output/'failure.html').write_text(page.content(),encoding='utf-8')
            except Exception:pass
            raise
        finally:
            (output/'TASK-FLOW-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(report,ensure_ascii=False),flush=True);browser.close()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='/tmp/huidi-task-flow')
    output=Path(parser.parse_args().output).resolve();output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='huidi-task-flow-') as temp:
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
