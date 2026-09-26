const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[LOCAL-SURFACE] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[LOCAL-SURFACE] PASS:',m);

const editor=read('public/editor.html');
const mode=read('public/community-local-mode.js');
const css=read('public/community-local-mode.css');
const catalog=read('public/catalog-studio/index.html');

const hiddenIds=[
  'memberAuthBtn','memberSignOutBtn','membershipPlansBtn',
  'cloudSaveBtn','cloudHistoryBtn','openLaunchPlans','launchPlansBtn',
  'headerTranslateBtn','translateAllBtn','fp-ai-widget','fp-assistant41-launcher'
];

const checks=[
  ['strict local edition flag',mode.includes("localOnly:true,strictNetwork:true")],
  ['production runtime config blanked',mode.includes("window.FLYPIGBOX_SUPABASE={url:'',publishableKey:'',runtimeConfigFunction:''}")],
  ['cross-origin fetch blocked',mode.includes("HUIDI_LOCAL_ONLY_NETWORK_BLOCKED")&&mode.includes("window.fetch=(input,init)=>sameOrigin(input)")],
  ['online-only ids hidden by runtime',hiddenIds.every(id=>mode.includes("'"+id+"'"))],
  ['online-only controls hidden by CSS',css.includes('.huidi-community-local .api-card')&&css.includes('#headerTranslateBtn')&&css.includes('#cloudSaveBtn')],
  ['generic editor launch copy',editor.includes('id="launchStartBtn" type="button">开始制作</button>')&&!editor.includes('id="launchStartBtn" type="button">开始制作 PI</button>')],
  ['generic document intro copy',editor.includes('把多语言外贸单据、客户资料与交易条款，放进一个可控工作台')],
  ['local save success has no cloud setup warning',editor.includes('建议定期导出完整备份。')&&!editor.includes('已保存到本机：${title}。云端同步尚未配置。')],
  ['local save button restores local label',editor.includes("window.HUIDI_LOCAL_ONLY?.localOnly ? '保存到本机' : '💾 一键保存'")],
  ['dead Local assistant is not loaded by editor or catalog',!editor.includes('flypigbox-r1-3a-18-41-assistant.js')&&!editor.includes('flypigbox-r1-3a-18-41-assistant.css')&&!catalog.includes('flypigbox-r1-3a-18-41-assistant.js')&&!catalog.includes('flypigbox-r1-3a-18-41-assistant.css')],
  ['dead account presentation layer is not loaded by Local editor',!editor.includes('flypigbox-v3-3-4-2-prelaunch-account.js')&&!editor.includes('flypigbox-v3-3-4-2-prelaunch-account.css')],
  ['legacy local-preview observer is not loaded by Local editor',!editor.includes('flypigbox-v3-3-6-3-local-guest-ui.js')&&!editor.includes('flypigbox-v3-3-6-3-local-guest-ui.css')],
  ['hidden cloud job center is not loaded by Local editor',!editor.includes('flypigbox-v3-3-6-24-r1-3a-18-job-center.js')],
  ['notification-only realtime bridge is not loaded by Local editor',!editor.includes('flypigbox-r1-3a-18-28-realtime-event-bridge.js')]
];

for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[LOCAL-SURFACE] OK');
