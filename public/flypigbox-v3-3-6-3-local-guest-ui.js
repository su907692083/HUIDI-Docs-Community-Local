/* HUIDI V3.3.6.3 — local preview and guest-state unification. */
(()=>{'use strict';
const env=window.FlypigBOXEnvironment=window.FlypigBOXEnvironment||{};
env.isLocalPreview=location.protocol==='file:'||new URLSearchParams(location.search).get('localPreview')==='1';
env.isOnline=/^https?:$/.test(location.protocol);
env.label=env.isLocalPreview?'本地预览模式':'云端工作台';
function mountBanner(){
  document.body.classList.toggle('fp-local-preview',env.isLocalPreview);
  if(!env.isLocalPreview||document.getElementById('fpLocalPreviewBanner'))return;
  const banner=document.createElement('aside');
  banner.id='fpLocalPreviewBanner';
  banner.className='fp-local-preview-banner';
  banner.setAttribute('role','status');
  banner.innerHTML='<div><b>本地预览模式</b><span>可检查页面、公开模板和本机草稿；客户、业务、私有模板、团队资料及账号权益需要通过线上地址登录使用。</span></div><a href="./document-start.html">开始制作单据</a><button type="button" aria-label="关闭本地预览提示">×</button>';
  const host=document.querySelector('.main')||document.querySelector('.app')||document.body;
  host.insertBefore(banner,host.firstChild);
  banner.querySelector('button')?.addEventListener('click',()=>banner.remove());
}
function sanitizeTechnicalText(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    if(!node.parentElement||/SCRIPT|STYLE|TEXTAREA|INPUT/.test(node.parentElement.tagName))return;
    let text=node.nodeValue||'';
    text=text.replace(/Failed to fetch/gi,'当前无法连接云端服务').replace(/\bguest\b/gi,'游客').replace(/ProductFlow 商品处理/g,'商品资料整理').replace(/Template & Brand Studio/g,'模板与品牌中心');
    if(text!==node.nodeValue)node.nodeValue=text;
  });
}
function boot(){mountBanner();sanitizeTechnicalText();
  const observer=new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(node=>{if(node.nodeType===1)sanitizeTechnicalText(node);else if(node.nodeType===3)sanitizeTechnicalText(node.parentElement||document)})));
  observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
