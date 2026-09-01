/* HUIDI V3.3.6.7.2 — Authenticated-user-first runtime gate; page gate never signs users out. */
(()=>{
  'use strict';
  if(window.FlypigBOXRuntimeGate?.version==='V3.3.6.7.2-authenticated-user-first')return;

  const cfg=window.FLYPIGBOX_SUPABASE||{};
  const params=new URLSearchParams(location.search);
  const isLocal=location.protocol==='file:'||params.get('localPreview')==='1'||!!window.HUIDI_LOCAL_ONLY?.localOnly;
  const script=document.currentScript;
  const path=(location.pathname||'').toLowerCase();
  const featureKey=script?.dataset?.feature||(
    /catalog-studio/.test(path)?'catalog_studio':
    /document-start\.html$/.test(path)?'document_start':
    /editor\.html$/.test(path)?'document_editor':
    /workspace\.html$/.test(path)?'workspace':''
  );
  const protectedDefaults=new Set(['workspace','document_start','document_editor','catalog_studio']);
  const configured=/^https:\/\/[^\s]+\.supabase\.co\/?$/i.test(String(cfg.url||''))&&String(cfg.publishableKey||'').length>20;
  const root=document.documentElement;
  let resolved=false;

  function injectPendingStyle(){
    if(document.getElementById('fp-runtime-gate-style'))return;
    const style=document.createElement('style');
    style.id='fp-runtime-gate-style';
    style.textContent=`html.fp-runtime-gate-pending{background:#eef3f9}html.fp-runtime-gate-pending body{opacity:0!important;pointer-events:none!important}html.fp-runtime-gate-pending::before{content:'正在检查登录与使用权限…';position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;color:#173b83;font:700 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;background:radial-gradient(circle at 50% 42%,#fff,#eef3f9 68%)}.fp-runtime-blocked{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#eef3f9,#fff)}.fp-runtime-blocked-card{width:min(520px,100%);padding:30px;border:1px solid #cfdaea;border-radius:20px;background:#fff;box-shadow:0 24px 70px rgba(20,33,61,.16);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#17233d}.fp-runtime-blocked-card small{color:#3c70ea;font-weight:800}.fp-runtime-blocked-card h1{margin:8px 0 10px;font-size:24px}.fp-runtime-blocked-card p{margin:0;color:#64748b;line-height:1.7}.fp-runtime-blocked-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.fp-runtime-blocked-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:10px;text-decoration:none;font-weight:800}.fp-runtime-blocked-actions .primary{background:#2563eb;color:#fff}.fp-runtime-blocked-actions .secondary{background:#edf2f7;color:#17233d}`;
    document.head.appendChild(style);
  }
  function finish(){resolved=true;root.classList.remove('fp-runtime-gate-pending');}
  function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function safeReturnTarget(){
    const file=path.split('/').pop()||'workspace.html';
    if(featureKey==='catalog_studio')return './catalog-studio/';
    return `./${file}${location.search||''}${location.hash||''}`;
  }
  function loginUrl(){
    const base=featureKey==='catalog_studio'?'../index.html':'./index.html';
    return `${base}?auth=login&return=${encodeURIComponent(safeReturnTarget())}`;
  }
  function redirectToLogin(){finish();location.replace(loginUrl());}
  function block(title,message){
    finish();
    const render=()=>{
      document.body.style.opacity='1';document.body.style.pointerEvents='auto';
      document.body.innerHTML=`<main class="fp-runtime-blocked"><section class="fp-runtime-blocked-card"><small>HUIDI 使用权限</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="fp-runtime-blocked-actions"><a class="primary" href="${featureKey==='catalog_studio'?'../workspace.html':'./workspace.html'}">返回工作台</a><a class="secondary" href="${featureKey==='catalog_studio'?'../index.html':'./index.html'}">返回首页</a></div></section></main>`;
    };
    if(document.body)render();else document.addEventListener('DOMContentLoaded',render,{once:true});
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function authState(){
    const core=window.FlypigBOXCloudCore||null;
    await core?.ready?.();
    await core?.recoverSession?.();
    const client=core?.getClient?.()||window.FlypigBOXSupabaseClient||null;
    let session=core?.getSession?.()||null;
    let user=core?.getUser?.()||session?.user||null;
    let lastError=null;

    for(let attempt=0;attempt<6&&!user;attempt+=1){
      try{
        const result=await client?.auth?.getSession?.();
        if(result?.error)throw result.error;
        session=result?.data?.session||session||null;
        user=session?.user||user||null;
      }catch(error){lastError=error;}
      if(!user&&attempt<5)await wait(180*(attempt+1));
    }

    if(session?.access_token&&client?.auth?.getUser){
      try{
        const verified=await client.auth.getUser(session.access_token);
        if(verified?.data?.user)user=verified.data.user;
        else if(verified?.error)lastError=verified.error;
      }catch(error){lastError=error;}
    }

    return {client,session,user,lastError};
  }

  async function fetchRuntime(session){
    const headers={apikey:String(cfg.publishableKey||''),'Content-Type':'application/json'};
    if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
    const response=await fetch(`${String(cfg.url||'').replace(/\/$/,'')}/functions/v1/${String(cfg.runtimeConfigFunction||'public-runtime-config')}`,{method:'POST',headers,body:'{}',cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body?.success===false)throw new Error(body?.error||`HTTP ${response.status}`);
    return body?.data||body;
  }

  function applyRuntimePresentation(runtime){
    if(!runtime)return;
    const color=String(runtime.theme?.primary_color||'').trim();
    if(/^#[0-9a-f]{6}$/i.test(color)){
      root.style.setProperty('--fp-runtime-primary',color);
      root.style.setProperty('--blue',color);
      root.style.setProperty('--primary',color);
    }
  }

  async function run(){
    if(isLocal){root.dataset.fpAuthSession='local';finish();return;}
    const auth=await authState();
    const authenticated=Boolean(auth.user&&auth.session?.access_token);
    let runtime=null;
    if(configured){
      try{runtime=await fetchRuntime(auth.session);}catch(error){console.warn('HUIDI runtime config unavailable; authentication result retained',error);}
    }
    window.FlypigBOXRuntimeConfig=runtime||null;
    applyRuntimePresentation(runtime);
    const rule=runtime?.feature_map?.[featureKey]||runtime?.features?.find?.(item=>item.feature_key===featureKey)||null;
    window.FlypigBOXFeatureAccess=rule||null;
    window.FlypigBOXRuntimeGateDebug={
      version:'V3.3.6.7.3-dual-key-session-compat',
      featureKey,
      authenticated,
      userId:auth.user?.id||'',
      runtimeAccountLoggedIn:runtime?.account?.logged_in??null,
      runtimePlan:runtime?.account?.plan||'',
      ruleReason:rule?.reason||'',
      ruleAccess:rule?.access||'',
      resolvedAt:new Date().toISOString()
    };

    if(!featureKey){finish();return;}
    if(!authenticated){
      const guestAllowed=rule&&(rule.access==='use'||rule.access==='preview')&&!rule.requires_login;
      if(guestAllowed){document.body?.setAttribute('data-fp-access',rule.access);finish();return;}
      if(protectedDefaults.has(featureKey)){
        // Never create an automatic redirect loop. Show a stable recovery screen instead.
        block('登录状态未恢复','账号服务没有在当前页面找到已保存的登录状态。请返回首页重新登录一次；页面不会再自动循环跳转。');
        return;
      }
      finish();return;
    }

    // The page gate never signs an authenticated user out. If runtime config mistakenly
    // reports login_required while Supabase has verified a user, keep the session and continue.
    if(rule?.access==='deny'){
      const denialReason=String(rule.reason||'').trim().toLowerCase();
      const denialMessage=String(rule.message||'');
      const authenticationMisclassification=(
        ['login_required','auth_required','authentication_required','not_logged_in','unauthenticated'].includes(denialReason)
        || /(?:请先登录|需要登录|登录后)/.test(denialMessage)
      );
      if(authenticationMisclassification){
        console.warn('HUIDI runtime config reported an authentication denial for a verified user; continuing to the page-level membership check.',{reason:denialReason});
      }else{
        block(rule.maintenance?'功能维护中':'当前账号暂不能使用此功能',rule.message||'请联系管理员检查套餐或功能权限。');
        return;
      }
    }

    root.dataset.fpAuthSession='ready';
    const apply=()=>{
      document.body?.setAttribute('data-fp-access',rule?.access==='deny'?'use':(rule?.access||'use'));
      document.body?.setAttribute('data-fp-config-version',String(runtime?.config_version||0));
      try{document.dispatchEvent(new CustomEvent('HUIDI:runtime-config',{detail:runtime}));}catch(_){ }
      finish();
    };
    if(document.body)apply();else document.addEventListener('DOMContentLoaded',apply,{once:true});
  }

  const api={version:'V3.3.6.7.3-dual-key-session-compat',get debug(){return window.FlypigBOXRuntimeGateDebug||null;}};
  window.FlypigBOXRuntimeGate=api;
  injectPendingStyle();
  if(!isLocal&&featureKey)root.classList.add('fp-runtime-gate-pending');
  run().catch(error=>{
    console.error('HUIDI page gate failed',error);
    // Do not destroy a potentially valid session on a transient gate failure.
    finish();
  });
  window.setTimeout(()=>{if(!resolved)finish();},15000);
})();
