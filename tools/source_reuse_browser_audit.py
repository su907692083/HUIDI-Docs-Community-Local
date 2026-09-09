"""Human-operated source reuse against a real isolated app/storage.
Only the Feishu upstream boundary is replaced with explicit test fixtures.
This file is not shipped in the production Docker image. No live email/API calls.
"""
from __future__ import annotations
import argparse, json, os, socket, subprocess, sys, tempfile, time, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]


def fixture_server(port: int, output: Path):
    sys.path.insert(0,str(ROOT/'online/api'))
    from app.daily_app import app
    from app import feishu_documents as f
    from fastapi import HTTPException
    import uvicorn
    calls=output/'FIXTURE-UPSTREAM-CALLS.jsonl'
    def upstream(method, path, token='', body=None, params=None):
        with calls.open('a') as h: h.write(json.dumps({'method':method,'path':path,'params':params})+'\n')
        if path=='auth/v3/tenant_access_token/internal':
            assert body=={'app_id':'cli_qa_reuse','app_secret':'qa-only-not-a-real-secret'}
            return {'code':0,'tenant_access_token':'fixture-access-only'}
        if 'blocked_fixture' in path: raise HTTPException(502,'目标文件权限不足（测试夹具）')
        if path=='drive/v1/files':
            return {'code':0,'data':{'files':[{'token':'base_fixture','name':'验收用客户表','type':'bitable'}], 'has_more':not bool(params.get('page_token')), 'next_page_token':'folder-2' if not params.get('page_token') else ''}}
        if path.endswith('/tables'):
            return {'code':0,'data':{'items':[{'table_id':'tbl_customers','name':'客户资料'},{'table_id':'tbl_other','name':'不应误选的表'}]}}
        if path.endswith('/records'):
            assert '/tbl_customers/' in path
            start=50 if params.get('page_token')=='records-2' else 0
            records=[{'fields':{'公司':f'验收客户 {n+1:03}','邮箱':f'buyer{n+1}@example.test','国家':'Germany'}} for n in range(start,min(start+params['page_size'],52))]
            return {'code':0,'data':{'items':records,'has_more':start==0,'page_token':'records-2' if start==0 else ''}}
        if path.endswith('/sheets/query'):
            return {'code':0,'data':{'sheets':[{'sheet_id':'sheet_fixture','title':'验收用产品表','grid_properties':{'row_count':3,'column_count':3}}]}}
        if '/values/' in path:
            matrix=[['产品名称','SKU','单位']] if 'A1%3AAZ1' in path else [['Test product A','QA-A','PCS'],['Test product B','QA-B','SETS']]
            return {'code':0,'data':{'valueRange':{'values':matrix}}}
        raise AssertionError('Unexpected external operation: '+method+' '+path)
    f.request_json=upstream
    uvicorn.run(app,host='127.0.0.1',port=port,log_level='warning')


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',default='/tmp/huidi-reuse-evidence');ap.add_argument('--serve',type=int,default=0)
    args=ap.parse_args();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if args.serve: return fixture_server(args.serve,out)
    import httpx
    from playwright.sync_api import sync_playwright
    report={'status':'RUNNING','checks':[],'page_errors':[], 'external_mode':'Feishu HTTP boundary mocked; real pages, routes, encrypted storage and Community persistence', 'live_services_tested':False,'real_emails_sent':0}
    with tempfile.TemporaryDirectory(prefix='huidi-reuse-qa-') as temp:
        with socket.socket() as s: s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        env={k:v for k,v in os.environ.items() if not any(x in k for x in ('API_KEY','CLIENT_ID','CLIENT_SECRET','TOKEN'))}
        env.update(HUIDI_SECRET_KEY='qa-reuse-isolated-only', HUIDI_TEAM_ACCESS='1', HUIDI_SIGNUP_ENABLED='1',HUIDI_COMMUNITY_SURFACE='1', HUIDI_DISABLE_BACKGROUND_JOBS='1',HUIDI_AUTO_BACKUP='0',HUIDI_PUBLIC_BASE_URL=base,DATABASE_URL=f'sqlite:///{temp}/app.db')
        proc=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'--serve',str(port),'--output',str(out)],cwd=ROOT,env=env,stdout=(out/'SERVER.log').open('w'),stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    if httpx.get(base+'/login',timeout=1).status_code==200:break
                except httpx.HTTPError: pass
                time.sleep(.15)
            with sync_playwright() as pw:
                launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
                if os.getenv('HUIDI_QA_CHROMIUM'):launch['executable_path']=os.environ['HUIDI_QA_CHROMIUM']
                browser=pw.chromium.launch(**launch)
                ctx=browser.new_context(viewport={'width':1640,'height':920},locale='zh-CN')
                auth=ctx.request.post(base+'/api/auth/register',data={'account_type':'individual','display_name':'Source reuse QA','email':f'reuse-{uuid.uuid4().hex[:12]}@example.test','password':uuid.uuid4().hex})
                assert auth.status==200,auth.text()
                p=ctx.new_page();p.on('pageerror',lambda e:report['page_errors'].append(str(e)))
                def check(name,condition=True):
                    report['checks'].append({'name':name,'ok':bool(condition)});assert condition,name
                def ready():p.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready' && !!window.HUIDICommunityOnlineFullV2",timeout=35000)
                def nav(view):
                    b=p.locator(f'.sidebar .nav-btn[data-view="{view}"]')
                    if not b.is_visible():p.locator('.huidi-online-more summary').click()
                    b.click()
                def read(url):
                    p.locator('#feishuSourceUrl').fill(url)
                    with p.expect_response(lambda r:'/api/feishu/source/inspect' in r.url) as r:p.locator('[data-feishu-action=inspect]').click()
                    return r.value
                try:
                    p.goto(base+'/',wait_until='domcontentloaded');ready()
                    nav('online-admin');p.locator('#view-online-admin [data-fv2-tab=sources]').click()
                    pane=p.locator('#view-online-admin [data-fv2-pane=sources]');pane.locator('[data-ss-card=tavily]').wait_for()
                    check('all ten existing provider configurations retained',pane.locator('[data-ss-card]:visible').count()==10)
                    pane.locator('[data-ss-group=search]').click()
                    check('find-customer group shows only three relevant services',pane.locator('[data-ss-card]:visible').count()==3)
                    tav=pane.locator('[data-ss-card=tavily]');tav.locator('[data-ss-edit]').click()
                    check('official API URL not required on primary form',not tav.locator('[data-ss-field=endpoint_url]').is_visible())
                    tav.locator('[data-ss-field=token]').fill('unsaved-ui-fixture')
                    pane.locator('[data-ss-group=mail]').click();pane.locator('[data-ss-group=search]').click()
                    check('switching source filters preserves in-progress credential input',tav.locator('[data-ss-field=token]').input_value()=='unsaved-ui-fixture')
                    pane.locator('[data-ss-search]').fill('Hunter')
                    check('search source by name',pane.locator('[data-ss-card]:visible').count()==1)
                    pane.locator('[data-ss-search]').fill('no-such-source')
                    check('no-match state explicit','没有匹配' in pane.locator('[data-ss-count]').inner_text())
                    pane.locator('[data-ss-search]').fill('');pane.locator('[data-ss-group=all]').click()
                    p.screenshot(path=str(out/'sources-by-purpose.png'))
                    pane.locator('[data-ss-feishu]').click();p.wait_for_selector('#view-feishu.active')
                    check('source settings navigates to existing Feishu work domain',p.locator('#feishuSourceUrl').is_visible())
                    check('missing Feishu status is actionable not 404',ctx.request.get(base+'/api/feishu/status').status==200)
                    response=read('https://qa.feishu.cn/base/base_fixture');check('unconfigured read fails without fake data',response.status==503)
                    p.locator('#feishuReadMessage[data-state=error]').wait_for()
                    p.locator('#view-feishu [data-feishu-action=config]:visible').click()
                    p.locator('#feishuAppId').fill('cli_qa_reuse');p.locator('#feishuAppSecret').fill('qa-only-not-a-real-secret')
                    p.locator('#feishuTenantDomain').fill('qa.feishu.cn');p.locator('#feishuFolderToken').fill('fld_fixture')
                    p.locator('#feishuSaveConfig').click();p.locator('#appDialog').wait_for(state='hidden')
                    check('saved secret cleared from dialog',p.locator('#feishuAppSecret').input_value()=='')
                    check('no secret returned in status','qa-only-not-a-real-secret' not in ctx.request.get(base+'/api/feishu/status').text())
                    check('table input survives configuration round trip',p.locator('#feishuSourceUrl').input_value().endswith('base_fixture'))
                    p.locator('#view-feishu [data-feishu-action=config]:visible').click();p.locator('#feishuAppSecret').fill('will-be-cancelled');p.keyboard.press('Escape')
                    p.locator('#appDialog').wait_for(state='hidden');check('Escape cancels config and clears typed secret',p.locator('#feishuAppSecret').input_value()=='')
                    response=read('https://qa.feishu.cn/base/base_fixture');check('read button reaches real backend after legacy event interception repair',response.status==200)
                    p.locator('#feishuSourceTable').wait_for();check('multiple tables require explicit selection',p.locator('#feishuSourceTable option').count()==2)
                    p.locator('#feishuSourceTable').select_option('tbl_customers');p.get_by_role('button',name='读取所选表',exact=True).click()
                    p.wait_for_selector('#feishuPreview tbody tr');check('preview has only first fifty records',p.locator('#feishuPreview tbody tr').count()==50)
                    p.locator('#feishuImportTarget').select_option('customers');check('company header auto-mapped',p.locator('[data-feishu-map=company]').input_value()=='公司')
                    check('overwrite existing records off by default',not p.locator('#feishuUpdateExisting').is_checked())
                    check('mapping and table text remains readable',p.locator('#feishuPreview td').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=12 and p.locator('[data-feishu-map=company]').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=12)
                    p.screenshot(path=str(out/'feishu-table-choice-preview-50.png'))
                    p.locator('[data-feishu-action=import]').click();p.wait_for_selector('#view-customers.active')
                    p.reload(wait_until='domcontentloaded');ready();nav('customers')
                    p.wait_for_function("() => window.HUIDILocalCore?.repoForKey('huidi_local_customers_v1')?.list().length===50")
                    check('imported fifty customers persist after reload')
                    nav('feishu');p.locator('#feishuSourceUrl').wait_for()
                    response=read('https://qa.feishu.cn/base/base_fixture?table=tbl_customers');p.wait_for_selector('#feishuPreview tbody tr')
                    p.locator('[data-feishu-action=import]').click();p.wait_for_selector('#view-customers.active')
                    check('reimport skips duplicates',p.evaluate("HUIDILocalCore.repoForKey('huidi_local_customers_v1').list().length") == 50)
                    nav('feishu');read('https://qa.feishu.cn/base/base_fixture?table=tbl_customers');p.wait_for_selector('[data-feishu-action=next-page]')
                    p.locator('[data-feishu-action=next-page]').click();p.wait_for_function("() => document.querySelectorAll('#feishuPreview tbody tr').length===2")
                    check('next page contains remaining two, not all fifty-two',p.locator('#feishuPreview tbody tr').count()==2)
                    p.screenshot(path=str(out/'feishu-last-page.png'))
                    p.locator('[data-feishu-action=import]').click();p.wait_for_selector('#view-customers.active')
                    p.reload(wait_until='domcontentloaded');ready();nav('customers')
                    p.wait_for_function("() => HUIDILocalCore.repoForKey('huidi_local_customers_v1').list().length===52")
                    check('all fifty-two imported through explicit pages persist after reload')
                    nav('feishu');read('https://qa.feishu.cn/base/base_fixture?table=tbl_customers');p.wait_for_selector('#feishuPreview tbody tr')
                    response=read('https://qa.feishu.cn/base/blocked_fixture')
                    check('permission error returned',response.status==502)
                    p.locator('#feishuReadMessage[data-state=error]').wait_for()
                    check('failed new read clears stale data and import action',p.locator('#feishuPreview tbody tr').count()==0 and p.locator('[data-feishu-action=import]').count()==0)
                    check('failed input retained',p.locator('#feishuSourceUrl').input_value().endswith('blocked_fixture'))
                    response=read('https://other.example/base/base_fixture');check('unrelated site rejected before authorization',response.status==400)
                    read('https://qa.feishu.cn/sheets/sheet_file?sheet=sheet_fixture');p.wait_for_selector('#feishuPreview tbody tr')
                    check('Sheets preview through existing read button',p.locator('#feishuPreview tbody tr').count()==2)
                    p.locator('#feishuImportTarget').select_option('products')
                    check('product name and SKU auto-mapped',p.locator('[data-feishu-map=name]').input_value()=='产品名称' and p.locator('[data-feishu-map=sku]').input_value()=='SKU')
                    p.locator('[data-feishu-action=import]').click();p.wait_for_selector('#view-products.active')
                    p.reload(wait_until='domcontentloaded');ready();nav('products')
                    p.wait_for_function("() => HUIDILocalCore.repoForKey('huidi_local_products_v1').list().length===2")
                    check('two imported products survive reload',p.evaluate("HUIDILocalCore.repoForKey('huidi_local_products_v1').list().some(x=>x.sku==='QA-A' && x.name==='Test product A' && x.unit==='PCS')"))
                    check('product import preserves existing customers',p.evaluate("HUIDILocalCore.repoForKey('huidi_local_customers_v1').list().length") == 52)
                    p.screenshot(path=str(out/'imported-products-reloaded.png'))
                    nav('feishu');read('https://qa.feishu.cn/sheets/sheet_file?sheet=sheet_fixture');p.wait_for_selector('#feishuPreview tbody tr')
                    p.locator('[data-feishu-action=import]').click();p.wait_for_selector('#view-products.active')
                    p.reload(wait_until='domcontentloaded');ready()
                    check('product reimport skips duplicate SKUs',p.evaluate("HUIDILocalCore.repoForKey('huidi_local_products_v1').list().length") == 2)
                    nav('feishu');p.locator('#feishuSourceUrl').wait_for()
                    p.locator('#feishuFolderTokenInput').fill('fld_fixture');p.locator('[data-feishu-action=browse-folder]').click()
                    p.get_by_role('button',name='下一页文件',exact=True).wait_for();check('folder list has explicit next-page action')
                    p.get_by_role('button',name='下一页文件',exact=True).click();p.get_by_role('button',name='下一页文件',exact=True).wait_for(state='detached')
                    check('folder next page is bounded and terminates')
                    for w,h in [(1366,768),(1640,920),(2048,1118)]:
                        p.set_viewport_size({'width':w,'height':h});check(f'no page overflow at {w}',not p.evaluate('document.documentElement.scrollWidth>innerWidth+2'));p.screenshot(path=str(out/f'feishu-{w}.png'))
                    check('no uncaught browser errors',not report['page_errors'])
                    report['status']='PASS'
                except Exception as e:
                    report.update(status='FAIL',error=str(e));p.screenshot(path=str(out/'FAIL.png'));(out/'FAIL.html').write_text(p.content())
                    raise
                finally:
                    (out/'SOURCE-REUSE-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
        finally:
            proc.terminate()
            try:proc.wait(timeout=8)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
