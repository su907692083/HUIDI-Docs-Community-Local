"""Beginner mailbox setup acceptance. No real provider or email send is used."""
from __future__ import annotations
import argparse,json,os,socket,subprocess,sys,tempfile,time,uuid
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def exercise(base: str, output: Path) -> None:
    report={"status":"RUNNING","checks":[],"page_errors":[],"external_mail_servers":"NOT CONTACTED","real_emails_sent":0}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        context=browser.new_context(viewport={"width":1366,"height":768},locale="zh-CN")
        auth=context.request.post(base+"/api/auth/register",data={"account_type":"individual","display_name":"Mailbox Beginner QA","email":f"mail-{uuid.uuid4().hex[:12]}@example.test","password":uuid.uuid4().hex})
        assert auth.status==200,auth.text()
        page=context.new_page();page.on("pageerror",lambda e:report["page_errors"].append(str(e)))
        def check(name,ok=True):report["checks"].append({"name":name,"ok":bool(ok)});assert ok,name
        def shot(name):page.screenshot(path=str(output/f"{name}.png"),full_page=True)
        try:
            page.goto(base+"/",wait_until="domcontentloaded")
            page.wait_for_function("() => document.documentElement.dataset.huidiCloud==='ready' && Boolean(window.HUIDIMailSetupRefinement)",timeout=35000)
            setup=page.locator('#hufHome [data-huf-open]').first
            setup.wait_for(state="visible",timeout=12000);setup.click()
            page.locator('[data-huf-other-mail]').wait_for(state="visible",timeout=12000);page.locator('[data-huf-other-mail]').click()
            page.wait_for_selector('#hmsBack.open [data-hms-company]:not(.hms-hidden)',timeout=10000)
            modal=page.locator('#hmsBack');text=modal.inner_text()
            check("business-language mailbox setup",all(x in text for x in ["一键连接 Gmail","一键连接 Outlook","连接企业邮箱","授权码 / 专用密码","连接并检查"]))
            check("OAuth internals hidden",all(x not in text for x in ["Client ID","Client Secret","redirect_uri","Bearer"]))
            check("SMTP jargon hidden from normal view","SMTP" not in text)
            check("server field collapsed by default",not page.locator('[data-hms-host]').is_visible())
            check("port field collapsed by default",not page.locator('[data-hms-port]').is_visible())
            check("1366 no document overflow",page.evaluate("() => document.documentElement.scrollWidth<=innerWidth+2"));shot("01-beginner-mailbox-1366")
            page.locator('.hms-advanced summary').click()
            presets={"qq":("smtp.qq.com","465","ssl"),"exmail":("smtp.exmail.qq.com","465","ssl"),"n163":("smtp.163.com","465","ssl"),"n126":("smtp.126.com","465","ssl"),"aliyun":("smtp.qiye.aliyun.com","465","ssl"),"zoho":("smtp.zoho.com","465","ssl"),"custom":("","587","starttls")}
            for key,expected in presets.items():
                page.locator('[data-hms-preset]').select_option(key)
                actual=(page.locator('[data-hms-host]').input_value(),page.locator('[data-hms-port]').input_value(),page.locator('[data-hms-security]').input_value())
                check(f"{key} preset",actual==expected)
            check("advanced fields require explicit expansion",page.locator('[data-hms-host]').is_visible());shot("02-advanced-on-demand")
            page.locator('[data-hms-preset]').select_option('qq')
            intercepted=[]
            def fake_test(route,request):intercepted.append(request.url);route.fulfill(status=200,content_type="application/json",body='{"ok":true}')
            page.route("**/api/mail/accounts/*/test",fake_test)
            email=f"sales-{uuid.uuid4().hex[:8]}@example.test"
            page.locator('[data-hms-email]').fill(email);page.locator('[data-hms-name]').fill('海外业务');page.locator('[data-hms-secret]').fill('ci-only-authorization-code');page.locator('[data-hms-connect]').click()
            page.wait_for_selector('.hms-result.ok',timeout=10000)
            check("connect action reaches existing test endpoint",len(intercepted)==1)
            check("success copy is plain language","连接成功" in page.locator('.hms-result.ok').inner_text())
            rows=context.request.get(base+"/api/mail/accounts");assert rows.status==200,rows.text();account=next((x for x in rows.json() if str(x.get('email') or '').lower()==email.lower()),None)
            check("existing mailbox owner reused",bool(account and account.get('auth_mode')=='smtp'))
            smtp=context.request.get(base+f"/api/mail/accounts/{account['id']}/smtp");assert smtp.status==200,smtp.text();cred=(smtp.json() or {}).get('smtp') or {}
            check("QQ preset persisted",cred.get('host')=='smtp.qq.com' and int(cred.get('port') or 0)==465 and cred.get('security')=='ssl')
            check("secret remains sealed",cred.get('has_secret') is True and 'password' not in cred and 'secret' not in cred)
            for width,height in [(1640,920),(2048,1118)]:
                page.set_viewport_size({"width":width,"height":height});check(f"{width} no document overflow",page.evaluate("() => document.documentElement.scrollWidth<=innerWidth+2"))
            shot("03-mailbox-wide")
            page.keyboard.press("Escape");check("Escape closes setup",page.locator('#hmsBack').is_hidden());check("no page errors",not report["page_errors"]);report["status"]="PASS"
        except Exception as exc:
            report["status"]="FAIL";report["error"]=str(exc)
            try:shot("failure");(output/"failure.html").write_text(page.content(),encoding="utf-8")
            except Exception:pass
            raise
        finally:
            (output/"MAIL-SETUP-BEGINNER-REPORT.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8");print(json.dumps(report,ensure_ascii=False),flush=True);browser.close()

def main():
    p=argparse.ArgumentParser();p.add_argument("--output",default="/tmp/huidi-mail-setup-beginner");output=Path(p.parse_args().output).resolve();output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="huidi-mail-setup-") as temp:
        with socket.socket() as sock:sock.bind(("127.0.0.1",0));port=sock.getsockname()[1]
        base=f"http://127.0.0.1:{port}";env={k:v for k,v in os.environ.items() if not any(t in k for t in ("API_KEY","CLIENT_ID","CLIENT_SECRET","SMTP_PASSWORD"))};env.update(HUIDI_SECRET_KEY=uuid.uuid4().hex,HUIDI_TEAM_ACCESS="1",HUIDI_COMMUNITY_SURFACE="1",HUIDI_SIGNUP_ENABLED="1",HUIDI_DISABLE_BACKGROUND_JOBS="1",HUIDI_AUTO_BACKUP="0",HUIDI_PUBLIC_BASE_URL=base,DATABASE_URL=f"sqlite:///{temp}/app.db")
        with (output/"server.log").open("w") as log:
            process=subprocess.Popen([sys.executable,"-m","uvicorn","app.daily_app:app","--host","127.0.0.1","--port",str(port)],cwd=ROOT/"online/api",env=env,stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try:
                        if httpx.get(base+"/login",timeout=1).status_code==200:break
                    except httpx.HTTPError:pass
                    if process.poll() is not None:raise RuntimeError("isolated app exited")
                    time.sleep(.2)
                else:raise RuntimeError("isolated app did not start")
                exercise(base,output)
            finally:
                process.terminate()
                try:process.wait(timeout=10)
                except subprocess.TimeoutExpired:process.kill();process.wait()

if __name__=="__main__":main()
