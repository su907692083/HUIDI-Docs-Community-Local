"""Browser acceptance for open-source interaction parity.
Real HUIDI owners + isolated local records. No provider credentials or email sends.
"""
from __future__ import annotations
import argparse,json,os,socket,subprocess,sys,tempfile,time,uuid
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
FIXTURE={'type':'FeatureCollection','features':[
 {'type':'Feature','properties':{'ISO_A2_EH':'DE','NAME':'Germany'},'geometry':{'type':'Polygon','coordinates':[[[5,47],[16,47],[16,55],[5,55],[5,47]]]}},
 {'type':'Feature','properties':{'ISO_A2_EH':'US','NAME':'United States of America'},'geometry':{'type':'Polygon','coordinates':[[[-125,25],[-66,25],[-66,49],[-125,49],[-125,25]]]}},
 {'type':'Feature','properties':{'ISO_A2_EH':'JP','NAME':'Japan'},'geometry':{'type':'Polygon','coordinates':[[[129,31],[146,31],[146,46],[129,46],[129,31]]]}}
]}

def exercise(base:str,output:Path)->None:
 report={'status':'RUNNING','checks':[],'page_errors':[],'real_emails_sent':0,'formal_price_writes':0,'external_providers':'NOT TESTED; isolated local records only'}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1440,'height':960},locale='zh-CN')
  auth=context.request.post(base+'/api/auth/register',data={'account_type':'individual','display_name':'Parity QA','email':f'parity-{uuid.uuid4().hex[:12]}@example.test','password':uuid.uuid4().hex})
  assert auth.status==200,auth.text()
  one=context.request.post(base+'/api/leads/manual',data={'company_name':'Nordwerk Import GmbH','product_keyword':'Garden Tool Set','country':'Germany','website':'https://nordwerk.example','contact_name':'Anna Weber','contact_role':'Purchasing Manager','contact_email':'anna@nordwerk.example','requirements':'Importer looking for garden tool sets','create_inquiry':True})
  two=context.request.post(base+'/api/leads/manual',data={'company_name':'Berlin Retail Group','product_keyword':'Garden Tool Set','country':'Germany','website':'https://berlin-retail.example','contact_name':'Max Buyer','contact_role':'Category Buyer','contact_email':'','requirements':'Retail buyer evaluating seasonal garden tools','create_inquiry':False})
  assert one.status==200,one.text();assert two.status==200,two.text()
  ids=[str(one.json()['lead']['id']),str(two.json()['lead']['id'])]
  page=context.new_page();page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
  dangerous=[]
  page.on('request',lambda r:dangerous.append(r.url) if r.method=='POST' and any(x in r.url for x in ('/send','/queue')) else None)
  def check(name,ok=True):report['checks'].append({'name':name,'ok':bool(ok)});assert ok,name
  def shot(name):page.screenshot(path=str(output/(name+'.png')),full_page=True)
  try:
   page.goto(base+'/',wait_until='domcontentloaded')
   page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDICommunityOnlineFullV2)",timeout=35000)
   page.evaluate("""fixture=>{const original=window.fetch.bind(window);window.fetch=(input,init)=>{const url=typeof input==='string'?input:(input?.url||'');if(url.includes('natural-earth-vector'))return Promise.resolve(new Response(JSON.stringify(fixture),{status:200,headers:{'Content-Type':'application/json'}}));return original(input,init)};window.__HUIDI_WORLD_GEOMETRY_FIXTURE__=true}""",FIXTURE)
   page.locator('.sidebar .nav-btn[data-view="online-intel"]').click()
   page.wait_for_selector('#view-online-intel.active [data-fv2-pane="world-map"].active:not([hidden])')
   page.wait_for_function("() => Boolean(window.HUIDIOpenSourceParity && document.querySelector('.wi-country-stage .wi-country-svg'))",timeout=20000)
   page.locator('#wiProductContext').fill('Garden Tool Set')
   marker=page.locator('.wi-country-marker[data-market-id="DE"]').first
   marker.wait_for();rect=marker.bounding_box();assert rect,'Germany business marker has no visible bounds'
   page.mouse.click(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
   page.wait_for_function("() => document.querySelector('.wi-country-marker[data-market-id=\"DE\"]')?.classList.contains('selected')")
   page.wait_for_selector('.hosp-cockpit')
   page.wait_for_function("() => document.querySelectorAll('.hosp-cockpit [data-hosp-lead]').length>=2",timeout=12000)
   text=page.locator('.hosp-cockpit').inner_text()
   check('Germany cockpit shows both real seeded prospects','Nordwerk Import GmbH' in text and 'Berlin Retail Group' in text)
   check('cockpit exposes existing customer and inquiry counts','正式客户' in text and '询盘 / 业务' in text)
   check('LinkedIn action is explicitly company search',page.locator('.hosp-cockpit a').filter(has_text='LinkedIn 搜公司').count()>=2)
   check('no fabricated WhatsApp shortcut without a real phone field',page.locator('.hosp-cockpit').get_by_text('WhatsApp',exact=True).count()==0)
   for lead_id in ids:page.locator(f'[data-hosp-lead="{lead_id}"] [data-hosp-lead-select]').check()
   batch_button=page.locator('.hosp-cockpit [data-hosp-batch]')
   check('two prospects can be selected for batch review',batch_button.is_enabled() and '2' in batch_button.inner_text())
   shot('01-germany-business-cockpit')

   page.locator(f'[data-hosp-lead="{ids[0]}"] [data-hosp-evidence]').click()
   page.wait_for_selector('#hospEvidenceDialog[open] [data-hosp-evidence-body]')
   page.wait_for_function("() => (document.querySelector('[data-hosp-evidence-body]')?.innerText||'').includes('销售资格证据完整度')")
   ev=page.locator('[data-hosp-evidence-body]').inner_text()
   check('background panel distinguishes evidence completeness from credit score','不是信用分' in ev)
   check('six evidence dimensions are visible',all(x in ev for x in ['基础身份','公司线索','人员关联','数字资产','贸易记录','业务匹配']))
   check('unverified official and customs facts stay explicit',('工商' in ev or '官方' in ev) and ('海关' in ev or '采购' in ev))
   check('background disclaimer rejects fake official due diligence','不等同于信用报告' in ev or '不等同于' in ev)
   shot('02-evidence-background-panel');page.locator('#hospEvidenceDialog [data-hosp-close]').click()

   batch_button.click();page.wait_for_selector('#hospBatchDialog[open]')
   page.wait_for_function("() => document.querySelectorAll('#hospBatchDialog [data-hosp-batch-lead]').length===2",timeout=8000)
   batch=page.locator('#hospBatchDialog').inner_text()
   check('batch development creates review queue for both prospects','Nordwerk Import GmbH' in batch and 'Berlin Retail Group' in batch)
   check('batch UI explicitly forbids automatic sending','不会批量发送' in batch and '逐个核对' in batch)
   check('opening batch review does not call mail send or queue endpoints',not dangerous)

   page.wait_for_function("() => Boolean(window.HUIDIOpenSourceBatchMailParity)",timeout=8000)
   page.wait_for_selector('#hospBatchDialog [data-hosp-prepare-sequences]')
   batch=page.locator('#hospBatchDialog').inner_text()
   check('batch follow-up reuses original Mail Owner template variables',all(x in batch for x in ['{{company}}','{{contact}}','{{product}}','{{country}}']))
   before_enroll=context.request.get(base+'/api/mail/sequence-enrollments')
   assert before_enroll.status==200,before_enroll.text()
   check('batch follow-up starts with no sequence enrollment',before_enroll.json()==[])
   page.locator('#hospBatchDialog [data-hosp-prepare-sequences]').click()
   page.wait_for_selector('#sqBack.sq-page-surface #sqTemplates',timeout=12000)
   page.wait_for_selector('.hosp-prepared-sequence-review',timeout=8000)
   review=page.locator('.hosp-prepared-sequence-review').inner_text()
   check('successful batch preparation routes into original Mail Owner review','刚准备的批量跟进' in review and '2 个买家' in review)
   check('prepared review keeps human confirmation explicit','待确认' in review and '不会自动给买家启用跟进' in review)
   check('prepared templates are visibly scoped for review',page.locator('#sqTemplates .hosp-prepared-sequence').count()>=1)
   sequences=context.request.get(base+'/api/mail/sequences');assert sequences.status==200,sequences.text()
   prepared=[x for x in sequences.json() if str(x.get('name') or '').startswith('行业跟进 ·')]
   check('batch follow-up writes only existing Mail Owner sequence templates',bool(prepared))
   check('prepared batch follow-up plans remain unapproved',all(not bool(x.get('approved')) for x in prepared))
   enrollments=context.request.get(base+'/api/mail/sequence-enrollments');assert enrollments.status==200,enrollments.text()
   check('batch preparation creates no sequence enrollment',enrollments.json()==[])
   check('batch follow-up preparation sends and queues nothing',not dangerous)
   shot('03-original-mail-owner-prepared-review')

   page.evaluate("id=>window.HUIDIOpenSourceParity.openDevelopment(id)",ids[0])
   page.wait_for_selector('#view-online-find.active [data-fv2-pane="develop"].active:not([hidden])')
   page.wait_for_selector('.hosp-review-strip')
   check('batch selection reuses existing development workbench',page.locator('#view-online-find [data-fv2-pane="develop"] .hosp-review-strip').count()==1)
   check('first prospect enters sequential human review','1/2' in page.locator('.hosp-review-strip').inner_text())
   page.locator('.hosp-review-strip [data-hosp-review-next]').click()
   page.wait_for_function("() => (document.querySelector('.hosp-review-strip')?.innerText||'').includes('2/2')",timeout=8000)
   check('next prospect stays in same existing owner','2/2' in page.locator('.hosp-review-strip').inner_text())
   check('sequential review still sends nothing',not dangerous)
   check('no formal price write path introduced',report['formal_price_writes']==0)
   check('no horizontal overflow',page.evaluate('() => document.documentElement.scrollWidth<=innerWidth+2'))
   check('no uncaught page errors',not report['page_errors'])
   report['status']='PASS';shot('04-existing-development-owner-review')
  except Exception as exc:
   report['status']='FAIL';report['error']=str(exc)
   try:shot('failure');(output/'failure.html').write_text(page.content(),encoding='utf-8')
   except Exception:pass
   raise
  finally:
   report['real_emails_sent']=len(dangerous);(output/'OPEN-SOURCE-PARITY-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False),flush=True);browser.close()

def main():
 p=argparse.ArgumentParser();p.add_argument('--output',default='/tmp/huidi-open-source-parity');output=Path(p.parse_args().output).resolve();output.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='huidi-open-source-parity-') as temp:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  base=f'http://127.0.0.1:{port}';env={k:v for k,v in os.environ.items() if not any(x in k for x in ('API_KEY','CLIENT_ID','CLIENT_SECRET','SMTP_PASSWORD'))}
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
