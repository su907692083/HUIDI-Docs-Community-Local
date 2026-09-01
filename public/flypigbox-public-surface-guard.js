/* HUIDI ordinary-user surface guard. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18.15-PUBLIC-SURFACE-GUARD.1';
  if(window.FlypigBOXPublicSurfaceGuard?.version===VERSION)return;

  const replacements=new Map([
    ['Founder OS项目桥接','智能处理服务'],
    ['OS智能能力','智能处理服务'],
    ['内置 JSON Schema 验证','字段结构检查'],
    ['Ajv规则验证适配','规则校验增强'],
    ['Paged.js分页适配','分页排版增强'],
    ['Paged.js分页','分页排版增强'],
    ['ExcelJS正式工作簿适配','标准表格增强'],
    ['ExcelJS工作簿','标准表格增强'],
    ['旧版独立智能任务入口',''],
    ['旧版独立历史文件解析',''],
    ['旧版独立扫描件识别',''],
    ['旧版独立PDF输出',''],
    ['旧版独立自动化入口',''],
    ['等待连接','暂未开放']
  ]);
  const hiddenPrefixes=[
    '旧版独立智能任务入口','旧版独立历史文件解析','旧版独立扫描件识别',
    '旧版独立PDF输出','旧版独立自动化入口'
  ];

  function cleanTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const original=node.nodeValue||'';
    let value=original;
    for(const [from,to] of replacements){
      if(value.includes(from))value=value.split(from).join(to);
    }
    if(value!==original)node.nodeValue=value;
  }
  function sanitize(root=document){
    const scope=root.querySelector?.('#ai')||document.querySelector('#ai');
    if(!scope)return;
    scope.querySelectorAll('.fp-a17-status-row').forEach(row=>{
      const text=(row.textContent||'').trim();
      if(hiddenPrefixes.some(prefix=>text.startsWith(prefix)))row.remove();
    });
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(cleanTextNode);
    const old=document.querySelector('#fp-founder-os-bridge-card');
    if(old)old.hidden=true;
    const host=document.querySelector('#fp-smart-processing-panel-host');
    if(host)host.hidden=false;
  }

  let timer=0;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>sanitize(),60);
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  function boot(){
    sanitize();
    setInterval(sanitize,1800);
    document.documentElement.dataset.fpbPublicSurface='ordinary-user';
  }
  window.FlypigBOXPublicSurfaceGuard=Object.freeze({version:VERSION,sanitize});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
