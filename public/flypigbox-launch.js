(()=>{
  'use strict';

  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const dialog=$('#auth-dialog');
  const form=$('#auth-form');
  const status=$('#auth-status');
  let mode='login';
  let sb=null;
  let authRedirecting=false;

  function compatibleAuthOptions(config){
    let projectRef='';
    try{projectRef=new URL(String(config.url||'')).hostname.split('.')[0]||'';}catch(_){}
    const primary=projectRef?`sb-${projectRef}-auth-token`:'';
    const legacy='flypigbox-auth-session-v1';
    const storage={
      getItem(key){
        try{return localStorage.getItem(key)||localStorage.getItem(primary)||localStorage.getItem(legacy)||null;}catch(_){return null;}
      },
      setItem(key,value){
        try{
          if(key)localStorage.setItem(key,value);
          if(primary)localStorage.setItem(primary,value);
          localStorage.setItem(legacy,value);
        }catch(_){}
      },
      removeItem(key){
        try{
          if(key)localStorage.removeItem(key);
          if(primary)localStorage.removeItem(primary);
          localStorage.removeItem(legacy);
        }catch(_){}
      }
    };
    try{
      const a=primary?localStorage.getItem(primary):null;
      const b=localStorage.getItem(legacy);
      if(a&&!b)localStorage.setItem(legacy,a);
      if(!a&&b&&primary)localStorage.setItem(primary,b);
    }catch(_){}
    return {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:primary||undefined,storage};
  }

  const params=new URLSearchParams(location.search);
  const hashParams=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const authErrorCode=String(params.get('error_code')||hashParams.get('error_code')||'').trim();
  const authErrorDescription=String(params.get('error_description')||hashParams.get('error_description')||'').trim();
  const recoveryTokenHash=String(params.get('token_hash')||hashParams.get('token_hash')||'').trim();
  const recoveryTokenType=String(params.get('type')||hashParams.get('type')||'').trim().toLowerCase();
  const isRecoveryConfirmRequest=params.get('auth')==='recovery-confirm'&&Boolean(recoveryTokenHash)&&recoveryTokenType==='recovery';
  const isRecoveryRequest=!authErrorCode&&(isRecoveryConfirmRequest||params.get('mode')==='reset'||params.get('type')==='recovery'||hashParams.get('type')==='recovery');

  function safeReturn(){
    const value=String(params.get('return')||'').trim();
    if(!value)return '';
    if(value.includes('://')||value.startsWith('//')||/[\r\n]/.test(value))return '';
    if(value.startsWith('/'))return `.${value}`;
    if(value.startsWith('./'))return value;
    return '';
  }

  const returnTarget=safeReturn();
  const isEditorRequest=()=>{
    const current=new URLSearchParams(location.search);
    return current.has('doc')||current.has('openDocument')||location.hash==='#editorTop'||current.get('editor')==='1';
  };

  if(isEditorRequest()){
    location.replace(`./editor.html${location.search}${location.hash}`);
    return;
  }

  try{
    const config=window.FLYPIGBOX_SUPABASE||{};
    sb=window.FlypigBOXCloudCore?.getClient?.()||window.FlypigBOXSupabaseClient||null;
    if(!sb&&config.url&&config.publishableKey&&window.supabase?.createClient){
      sb=window.supabase.createClient(String(config.url).replace(/\/$/,''),config.publishableKey,{
        auth:compatibleAuthOptions(config)
      });
      window.FlypigBOXSupabaseClient=sb;
    }
  }catch(error){
    console.error(error);
  }

  function msg(text='',kind=''){
    status.textContent=text;
    status.className=`status ${kind}`;
  }

  function validEmail(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||''));
  }

  async function notifyAdminAuthEvent(user,type='user.registered'){
    const config=window.FLYPIGBOX_SUPABASE||{};
    if(!user?.id||!config.url||!config.publishableKey)return{ok:false,skipped:true};
    if(type==='user.email_verified'&&!user.email_confirmed_at)return{ok:false,skipped:true};
    const marker=`flypigbox_admin_auth_event_${type}_${user.id}`;
    if(type==='user.email_verified'){
      try{if(localStorage.getItem(marker)==='1')return{ok:true,deduplicated:true};}catch(_){}
    }
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),2600);
    try{
      const response=await fetch(`${String(config.url).replace(/\/$/,'')}/functions/v1/flypigbox-admin-notification-gateway/registration-event`,{
        method:'POST',signal:controller.signal,
        headers:{apikey:config.publishableKey,'content-type':'application/json','x-flypigbox-app-id':'app.HUIDI.trade-documents'},
        body:JSON.stringify({type,userId:user.id,email:user.email||''})
      });
      const payload=await response.json().catch(()=>({}));
      if(response.ok&&payload?.ok){try{if(type==='user.email_verified')localStorage.setItem(marker,'1');}catch(_){}return payload;}
      console.warn('HUIDI ADMIN auth event was not accepted',payload);
      return{ok:false,payload};
    }catch(error){
      console.warn('HUIDI ADMIN auth event notification skipped',error);
      return{ok:false,error};
    }finally{clearTimeout(timer);}
  }

  const PASSWORD_RULE_TEXT='密码至少 8 位，并包含字母和数字。';
  const PASSWORD_RULE_ERROR='密码不符合要求，请使用至少 8 位，并包含字母和数字。';

  function passwordRuleError(password){
    return password.length>=8&&/[A-Za-z]/.test(password)&&/[0-9]/.test(password)?'':PASSWORD_RULE_TEXT;
  }

  function loginErrorMessage(error){
    const raw=String(error?.message||error||'').trim();
    const lower=raw.toLowerCase();
    if(raw==='Invalid login credentials'||lower.includes('invalid login credentials'))return '邮箱或密码不正确，请检查后重试。';
    if(raw==='Email not confirmed'||lower.includes('email_not_confirmed')||lower.includes('email not confirmed'))return '请先完成邮箱验证后再登录。';
    return '登录失败，请稍后重试。';
  }

  function registerErrorMessage(error){
    const raw=String(error?.message||error||'').trim();
    const lower=raw.toLowerCase();
    if(raw.includes('请输入密码')||raw.includes(PASSWORD_RULE_TEXT)||raw.includes('两次输入的密码不一致')||raw.includes('请输入正确的邮箱地址'))return raw;
    if(raw==='User already registered'||lower.includes('user already registered')||lower.includes('already registered')||lower.includes('already exists')||lower.includes('email rate limit'))return lower.includes('rate limit')?'注册失败，请稍后重试。':'该邮箱已注册，请直接登录或找回密码。';
    if(lower.includes('password')||lower.includes('weak password')||lower.includes('minimum')||lower.includes('length')||lower.includes('character')||lower.includes('digit')||lower.includes('number'))return PASSWORD_RULE_ERROR;
    if(lower.includes('invalid email')||lower.includes('email address'))return '请输入正确的邮箱地址。';
    return '注册失败，请稍后重试。';
  }

  function forgotErrorMessage(error){
    const raw=String(error?.message||error||'').trim();
    const lower=raw.toLowerCase();
    const code=String(error?.code||'').toLowerCase();
    if(lower.includes('email address not authorized')||code.includes('email_address_not_authorized'))return '当前邮件发送服务尚未开放给这个邮箱，请联系管理员配置正式邮件发送服务。';
    if(lower.includes('rate limit')||lower.includes('too many requests')||code.includes('rate_limit')||Number(error?.status)===429)return '重设邮件请求过于频繁，请至少等待 60 秒后再试。';
    if(lower.includes('redirect')&&(lower.includes('not allowed')||lower.includes('invalid')))return '重设页面地址尚未在后台允许，请联系管理员检查网站回跳设置。';
    if(lower.includes('smtp')||lower.includes('email provider')||lower.includes('send email')||lower.includes('mail'))return '重设邮件暂时无法发送，请联系管理员检查邮件发送设置。';
    if(lower.includes('captcha'))return '安全验证未通过，请刷新页面后重试。';
    return '重设邮件发送失败，请稍后重试或联系管理员。';
  }

  function resetErrorMessage(error){
    const raw=String(error?.message||error||'').trim();
    const lower=raw.toLowerCase();
    if(raw.includes(PASSWORD_RULE_TEXT)||raw.includes('两次输入的密码不一致')||raw.includes('请输入新密码'))return raw;
    if(lower.includes('password')||lower.includes('weak password')||lower.includes('minimum')||lower.includes('length')||lower.includes('character')||lower.includes('digit')||lower.includes('number'))return PASSWORD_RULE_ERROR;
    if(lower.includes('session')||lower.includes('expired')||lower.includes('invalid token')||lower.includes('jwt'))return '重设链接已失效或已过期，请返回登录页重新发送重设邮件。';
    return '新密码保存失败，请重新打开邮件中的重设链接后再试。';
  }

  function recoveryLinkErrorMessage(code=authErrorCode,description=authErrorDescription){
    const raw=`${code} ${description}`.toLowerCase();
    if(raw.includes('otp_expired')||raw.includes('expired')||raw.includes('invalid'))return '这封重设邮件中的链接已失效或已被使用。请重新发送，并只打开最后一封邮件。';
    if(raw.includes('access_denied'))return '这次密码重设验证未通过。请重新发送重设邮件后再试。';
    return '密码重设链接无法验证，请重新发送重设邮件。';
  }

  function returnLabel(){
    if(!returnTarget)return '工作台';
    if(/catalog-studio/i.test(returnTarget))return '产品目录';
    if(/editor\.html/i.test(returnTarget))return '单据编辑器';
    if(/document-start\.html/i.test(returnTarget))return '新建单据';
    return '原页面';
  }

  function setMode(next){
    mode=next;
    dialog.dataset.authMode=next;

    const register=next==='register';
    const forgot=next==='forgot';
    const reset=next==='reset';
    const recoveryConfirm=next==='recovery-confirm';
    const email=$('#auth-email');
    const password=$('#auth-password');
    const confirm=$('#auth-confirm');
    const emailLabel=email?.closest('label');
    const passwordLabel=password?.closest('label');
    const authLinks=dialog.querySelector('.auth-links');

    $$('button[data-auth-mode]').forEach(button=>{
      button.hidden=reset||recoveryConfirm||button.dataset.authMode===next;
    });

    if(emailLabel){
      emailLabel.classList.toggle('hidden',reset||recoveryConfirm);
      emailLabel.hidden=reset||recoveryConfirm;
    }
    if(email){
      email.required=!(reset||recoveryConfirm);
      email.disabled=reset||recoveryConfirm;
    }

    if(passwordLabel){
      passwordLabel.classList.toggle('hidden',forgot||recoveryConfirm);
      passwordLabel.hidden=forgot||recoveryConfirm;
    }
    password.required=!(forgot||recoveryConfirm);
    password.disabled=forgot||recoveryConfirm;
    if(forgot||recoveryConfirm)password.value='';
    password.autocomplete=register||reset?'new-password':'current-password';
    password.placeholder=register||reset?'至少 8 位，含字母和数字':'请输入密码';

    $('#auth-confirm-wrap').classList.toggle('hidden',!(register||reset));
    if(confirm){
      confirm.required=register||reset;
      confirm.disabled=!(register||reset);
      confirm.autocomplete='new-password';
    }

    $('#auth-kicker').textContent=register?'欢迎使用':forgot?'找回密码':recoveryConfirm?'安全验证':reset?'设置密码':'欢迎回来';
    $('#auth-title').textContent=register?'申请 HUIDI 体验账号':forgot?'重设密码':recoveryConfirm?'继续重设密码':reset?'设置新的登录密码':'登录 HUIDI';
    $('#auth-copy').textContent=register
      ?'注册后可获得基础体验额度。联系官方客服，可领取额外试用或开通更多功能。'
      :forgot
        ?'请输入注册邮箱，我们会发送重设密码链接。'
        :recoveryConfirm
          ?'请点击下方按钮完成身份验证，再设置新的登录密码。'
          :reset
            ?'请输入并确认新密码。保存成功后，请使用新密码重新登录。'
            :returnTarget?`登录后继续进入${returnLabel()}。`:'登录后进入工作台。';

    $('#auth-password-rule')?.classList.toggle('hidden',!(register||reset));
    $('#trial-cta')?.classList.toggle('hidden',!register);
    $('#auth-legal-wrap')?.classList.toggle('hidden',!register);
    if(authLinks){
      authLinks.classList.toggle('hidden',reset||recoveryConfirm);
      authLinks.hidden=reset||recoveryConfirm;
    }
    if(!register&&$('#auth-legal'))$('#auth-legal').checked=false;

    $('#auth-submit').textContent=register
      ?'申请体验账号'
      :forgot
        ?'发送重设邮件'
        :recoveryConfirm
          ?'验证并继续'
          :reset
            ?'保存新密码'
            :returnTarget?'登录并继续':'登录并进入工作台';

    msg();
  }

  function openAuth(next){
    setMode(next);
    dialog.hidden=false;
    document.body.classList.add('fp-auth-open');
    if(!dialog.open){
      try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}
    }
    requestAnimationFrame(()=>$(next==='reset'?'#auth-password':next==='recovery-confirm'?'#auth-submit':'#auth-email')?.focus());
  }

  async function completeLogin(session){
    if(authRedirecting)return;
    const target=returnTarget||'./workspace.html';
    let persisted=session||null;
    for(let attempt=0;attempt<5&&!persisted?.user;attempt+=1){
      const result=await sb.auth.getSession();
      if(result?.error)throw result.error;
      persisted=result?.data?.session||null;
      if(!persisted?.user)await new Promise(resolve=>setTimeout(resolve,160*(attempt+1)));
    }
    if(!persisted?.user)throw new Error('登录成功，但浏览器未能保存会话。请确认未禁用本站存储后重试。');
    await window.FlypigBOXCloudCore?.recoverSession?.().catch(()=>null);
    await window.FlypigBOXCloudCore?.refresh?.().catch(()=>null);
    await notifyAdminAuthEvent(persisted.user,'user.email_verified');
    authRedirecting=true;
    msg('登录成功，正在进入工作台…','ok');
    window.setTimeout(()=>location.replace(target),80);
  }

  window.FlypigBOXOpenAuth=openAuth;

  $$('[data-open-auth]').forEach(button=>button.addEventListener('click',()=>openAuth(button.dataset.openAuth)));
  $$('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.authMode)));
  $$('[data-close-auth]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('close',()=>document.body.classList.remove('fp-auth-open'));
  dialog.addEventListener('cancel',()=>document.body.classList.remove('fp-auth-open'));
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  $$('[data-open-help]').forEach(button=>button.addEventListener('click',()=>$('#help-dialog').showModal()));
  $$('[data-close-help]').forEach(button=>button.addEventListener('click',()=>$('#help-dialog').close()));

  async function ensureRecoverySession(){
    if(!sb?.auth?.getSession)return false;
    try{
      await window.FlypigBOXCloudCore?.ready?.();
      const {data,error}=await sb.auth.getSession();
      if(error)throw error;
      return Boolean(data?.session?.user);
    }catch(error){
      console.warn('HUIDI recovery session unavailable',error);
      return false;
    }
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!sb){
      msg('登录服务暂未加载，请刷新页面后重试。','error');
      return;
    }

    const email=$('#auth-email').value.trim();
    const password=$('#auth-password').value;
    const confirm=$('#auth-confirm').value;

    if(mode!=='reset'&&mode!=='recovery-confirm'){
      if(!email){msg('请输入邮箱。','error');return;}
      if(!validEmail(email)){msg('请输入正确的邮箱地址。','error');return;}
    }

    const submit=$('#auth-submit');
    submit.disabled=true;

    try{
      if(mode==='recovery-confirm'){
        if(!recoveryTokenHash)throw Error('Recovery token missing');
        const {data,error}=await sb.auth.verifyOtp({token_hash:recoveryTokenHash,type:'recovery'});
        if(error)throw error;
        if(!data?.session?.user&&!await ensureRecoverySession())throw Error('Recovery session unavailable');
        history.replaceState({},document.title,`${location.pathname}?mode=reset`);
        openAuth('reset');
        msg('身份验证成功，请设置新的登录密码。','ok');
        return;
      }

      if(mode==='forgot'){
        const redirectUrl=new URL(location.pathname,location.origin);
        redirectUrl.searchParams.set('mode','reset');
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl.toString()});
        if(error)throw error;
        msg('重设邮件已发送，请检查邮箱。请以最后一封邮件中的链接为准。','ok');
        return;
      }

      if(mode==='reset'){
        if(!password)throw Error('请输入新密码。');
        const passwordError=passwordRuleError(password);
        if(passwordError)throw Error(passwordError);
        if(password!==confirm)throw Error('两次输入的密码不一致。');
        if(!await ensureRecoverySession())throw Error('Recovery session expired');

        const {error}=await sb.auth.updateUser({password});
        if(error)throw error;

        msg('密码已重置成功，正在返回登录页。','ok');
        await sb.auth.signOut({scope:'local'}).catch(()=>{});
        $('#auth-password').value='';
        $('#auth-confirm').value='';
        history.replaceState({},document.title,`${location.pathname}?auth=login&reset=success`);
        window.setTimeout(()=>{
          setMode('login');
          msg('密码已重置，请使用新密码登录。','ok');
          $('#auth-email')?.focus();
        },500);
        return;
      }

      if(mode==='register'){
        if(!password){msg('请输入密码。','error');return;}
        const passwordError=passwordRuleError(password);
        if(passwordError)throw Error(passwordError);
        if(password!==confirm)throw Error('两次输入的密码不一致。');
        if(!$('#auth-legal')?.checked){
          msg('请先阅读并同意用户协议、隐私政策与退款政策。','error');
          return;
        }
        const {data,error}=await sb.auth.signUp({
          email,
          password,
          options:{emailRedirectTo:`${location.origin}${location.pathname}`}
        });
        if(error)throw error;
        if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
          msg('该邮箱已注册，请直接登录或找回密码。','error');
          return;
        }
        await notifyAdminAuthEvent(data?.user,'user.registered');
        if(data?.session){
          msg('账号已创建，当前为基础体验额度。联系官方客服可领取额外试用或开通更多功能。','ok');
          setTimeout(()=>{location.href=returnTarget||'./workspace.html';},1200);
          return;
        }
        msg('注册成功，请前往邮箱完成验证。验证后可联系官方客服申请额外试用权限。','ok');
        return;
      }

      if(!password){msg('请输入密码。','error');return;}
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error)throw error;
      await completeLogin(data?.session||null);
    }catch(error){
      console.error('HUIDI auth error',error);
      msg(mode==='register'?registerErrorMessage(error):mode==='forgot'?forgotErrorMessage(error):mode==='recovery-confirm'?recoveryLinkErrorMessage(error?.code,error?.message):mode==='reset'?resetErrorMessage(error):loginErrorMessage(error),'error');
    }finally{
      submit.disabled=false;
    }
  });

  if(sb){
    (async()=>{
      await window.FlypigBOXCloudCore?.ready?.();
      if(isRecoveryRequest||['login','forgot'].includes(String(params.get('auth')||'')))return;
      const {data,error}=await sb.auth.getUser();
      if(error||!data?.user){
        const raw=`${error?.code||''} ${error?.message||''}`.toLowerCase();
        if(error)console.warn('HUIDI landing-page user check did not confirm a user; stored sessions were retained',error);
        return;
      }
      if(returnTarget)location.replace(returnTarget);
      else if(!location.search&&!location.hash)location.replace('./workspace.html');
    })().catch(()=>{});

    const onAuth=({event,session}={})=>{
      if(event==='PASSWORD_RECOVERY'){
        openAuth('reset');
        msg('重设链接已验证，请设置新密码。','ok');
        return;
      }
      if(session&&event==='SIGNED_IN'&&dialog.open&&mode==='login'&&!authRedirecting){
        completeLogin(session).catch(error=>{
          console.error('HUIDI login completion failed',error);
          authRedirecting=false;
          msg(error?.message||'登录会话保存失败，请稍后重试。','error');
        });
      }
    };

    if(window.FlypigBOXCloudCore?.subscribe)window.FlypigBOXCloudCore.subscribe(onAuth,{immediate:false});
    else sb.auth.onAuthStateChange((event,session)=>onAuth({event,session}));
  }

  if(authErrorCode){
    openAuth('forgot');
    msg(recoveryLinkErrorMessage(),'error');
    history.replaceState({},document.title,`${location.pathname}?auth=forgot`);
  }else if(isRecoveryConfirmRequest){
    openAuth('recovery-confirm');
    msg('请点击“验证并继续”，完成后即可设置新密码。');
  }else if(isRecoveryRequest){
    openAuth('reset');
    msg('正在验证重设链接…');
    ensureRecoverySession().then(valid=>{
      if(mode!=='reset')return;
      if(valid){
        msg('重设链接已验证，请设置新密码。','ok');
      }else{
        setMode('forgot');
        msg('重设链接无效或已过期，请重新发送重设邮件。','error');
      }
    });
  }else if(params.get('auth')==='login'||params.get('auth')==='forgot'||returnTarget){
    openAuth(params.get('auth')==='forgot'?'forgot':'login');
    if(params.get('reset')==='success')msg('密码已重置，请使用新密码登录。','ok');
    window.setTimeout(()=>{if(!dialog.open)openAuth(params.get('auth')==='forgot'?'forgot':'login');},180);
  }
})();
