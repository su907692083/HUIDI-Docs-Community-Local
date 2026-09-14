"""Isolated real-pointer configuration acceptance; never uses live keys or sends mail."""
import argparse, json, os, socket, subprocess, tempfile, time, sys, uuid
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--output', default='/tmp/huidi-provider-browser')
args=parser.parse_args()
OUT=Path(args.output).resolve(); OUT.mkdir(parents=True,exist_ok=True)
temp=tempfile.TemporaryDirectory(prefix='huidi-provider-qa-')
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}' 
env={k:v for k,v in os.environ.items() if not any(x in k for x in ['API_KEY','CLIENT_ID','CLIENT_SECRET'])}
env.update(HUIDI_SECRET_KEY='browser-test-provider-isolated-only',HUIDI_TEAM_ACCESS='1',HUIDI_COMMUNITY_SURFACE='1',HUIDI_SIGNUP_ENABLED='1',HUIDI_DISABLE_BACKGROUND_JOBS='1',HUIDI_AUTO_BACKUP='0',HUIDI_PUBLIC_BASE_URL=base,DATABASE_URL=f'sqlite:///{temp.name}/app.db')
proc=subprocess.Popen([sys.executable,'-m','uvicorn','app.daily_app:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT/'online/api',env=env,stdout=(OUT/'provider-server.log').open('w'),stderr=subprocess.STDOUT)
try:
 for _ in range(70):
  try:
   if httpx.get(base+'/login',timeout=1).status_code==200: break
  except Exception: pass
  time.sleep(.15)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':1640,'height':920},locale='zh-CN')
  auth=ctx.request.post(base+'/api/auth/register',data={'account_type':'individual','display_name':'QA Provider','email':f'provider-{uuid.uuid4().hex[:10]}@example.test','password':'Isolated-QA-only-2026'})
  assert auth.status==200,auth.text()
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base+'/',wait_until='domcontentloaded')
  page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready'",timeout=35000)
  page.wait_for_function('() => Boolean(window.HUIDICommunityOnlineFullV2)',timeout=15000)
  page.locator('.nav-btn[data-view="online-admin"]').click()
  page.locator('#view-online-admin [data-fv2-tab="sources"]').click()
  page.wait_for_selector('#view-online-admin [data-ss-card="tavily"]',timeout=15000)
  pane=page.locator('#view-online-admin [data-fv2-pane="sources"]')
  assert pane.locator('[data-ss-card]').count()==10
  page.screenshot(path=str(OUT/'sources-1640.png'))
  tav=pane.locator('[data-ss-card="tavily"]')
  tav.locator('[data-ss-test]').click()
  tav.locator('[data-ss-result]').filter(has_text='尚未配置').wait_for()
  tav.locator('[data-ss-edit]').click()
  tav.locator('.ss-paste > summary').click()
  tav.locator('[data-ss-paste]').fill('TAVILY_API_KEY=fixture-browser-private-value')
  tav.locator('[data-ss-apply]').click()
  assert tav.locator('[data-ss-field="token"]').input_value()=='fixture-browser-private-value'
  tav.locator('[data-ss-save]').click()
  page.wait_for_function("() => document.querySelector('#view-online-admin [data-ss-card=tavily] [data-ss-state]')?.textContent.includes('已配置')")
  assert tav.locator('[data-ss-field="token"]').input_value()==''
  status=ctx.request.get(base+'/api/acquisition/status').json();assert status['tavily'] is True,status
  assert 'fixture-browser-private-value' not in ctx.request.get(base+'/api/service-connections').text()
  page.screenshot(path=str(OUT/'tavily-saved-1640.png'))
  # No network check is executed with synthetic credentials. Credential transport is covered by mocked-upstream unit tests.
  gmail=pane.locator('[data-ss-card="gmail_oauth"]')
  gmail.locator('[data-ss-edit]').click()
  gmail.locator('[data-ss-field="client_id"]').fill('fixture-browser.apps.googleusercontent.com')
  gmail.locator('[data-ss-field="client_secret"]').fill('fixture-browser-oauth-private-value')
  gmail.locator('[data-ss-save]').click()
  page.wait_for_function("() => document.querySelector('#view-online-admin [data-ss-card=gmail_oauth] [data-ss-state]')?.textContent.includes('已配置')")
  gmail.locator('[data-ss-test]').click()
  gmail.locator('[data-ss-result]').filter(has_text='尚未验证应用密钥').wait_for()
  assert gmail.locator('[data-ss-field="redirect_uri"]').input_value()==base+'/api/mail/connect/gmail/callback'
  page.screenshot(path=str(OUT/'gmail-configured-not-authorized.png'))
  # Persist/reload test, no secret reappears.
  page.reload(wait_until='domcontentloaded')
  page.wait_for_function('() => Boolean(window.HUIDICommunityOnlineFullV2)',timeout=15000)
  page.locator('.nav-btn[data-view="online-admin"]').click()
  page.locator('#view-online-admin [data-fv2-tab="sources"]').click()
  page.wait_for_selector('#view-online-admin [data-ss-card="tavily"]')
  assert '已配置' in tav.locator('[data-ss-state]').inner_text()
  assert tav.locator('[data-ss-field="token"]').input_value()==''
  # Test errors are visible even when a settings form is collapsed.
  hunter=pane.locator('[data-ss-card="hunter"]');hunter.locator('[data-ss-test]').click()
  hunter.locator('[data-ss-result]').filter(has_text='尚未配置').wait_for()
  assert hunter.locator('[data-ss-result]').is_visible()
  # Mail configuration shortcut must actually activate the target work domain.
  pane.locator('[data-ss-mail]').click()
  page.wait_for_selector('#view-mail.active [data-fv2-pane=mailbox].active')
  page.locator('.nav-btn[data-view="online-admin"]').click()
  page.locator('#view-online-admin [data-fv2-tab="sources"]').click()
  # RSS button must open the actual retained owner, not a nonexistent tab.
  pane.locator('[data-ss-rss]').click()
  page.wait_for_selector('#ssBack.open #isWrap [data-is-new]',timeout=12000)
  page.locator('#ssBack .ss-close').click()
  for width,height in [(1366,768),(2048,1118)]:
   page.set_viewport_size({'width':width,'height':height});page.screenshot(path=str(OUT/f'sources-{width}.png'))
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
  result={'status':'PASS','browser':'chromium','checks':['10 real source configuration cards','API key paste -> encrypted save -> actual status -> reload','password fields cleared and not returned','missing-key test visible while form collapsed','OAuth config distinguished from mailbox authorization','correct same-origin callback displayed','existing RSS settings linked','1366/1640/2048 no document overflow'],'page_errors':errors,'live_providers':'NOT TESTED; synthetic isolated credentials; no email sends'}
  (OUT/'PROVIDER-BROWSER-REPORT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps(result,ensure_ascii=False))
  assert not errors,errors
  browser.close()
except Exception as error:
 try:
  page.screenshot(path=str(OUT/'provider-failure.png'))
  (OUT/'provider-failure.html').write_text(page.content(),encoding='utf-8')
 except Exception:
  pass
 (OUT/'PROVIDER-BROWSER-FAILURE.json').write_text(json.dumps({'status':'FAIL','error':str(error)},ensure_ascii=False,indent=2),encoding='utf-8')
 raise
finally:
 proc.terminate()
 try:proc.wait(timeout=10)
 except subprocess.TimeoutExpired:proc.kill();proc.wait()
 temp.cleanup()
