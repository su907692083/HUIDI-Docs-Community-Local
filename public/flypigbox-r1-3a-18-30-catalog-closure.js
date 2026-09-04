(()=>{
  'use strict';if(window.__FP30_CATALOG_CLOSURE__)return;window.__FP30_CATALOG_CLOSURE__=true;
  const qs=(s,r=document)=>r.querySelector(s),qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const key='flypigbox_catalog_collapsed_sections_v18_30';
  function saved(){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return{}}}
  function write(v){try{localStorage.setItem(key,JSON.stringify(v))}catch(_){}}
  function sections(){
    const state=saved();qsa('.catalog-company-card .section').forEach((section,index)=>{
      if(section.dataset.fp30Section)return;section.dataset.fp30Section=String(index);
      const head=qs('.section-title',section);if(!head)return;const button=document.createElement('button');button.type='button';button.className='fp30-section-toggle';button.setAttribute('aria-label','展开或收起');head.append(button);
      const collapsed=state[index]!==undefined?state[index]:index>2;section.classList.toggle('fp30-collapsed',collapsed);button.textContent=collapsed?'＋':'－';
      button.addEventListener('click',()=>{const next=!section.classList.contains('fp30-collapsed');section.classList.toggle('fp30-collapsed',next);button.textContent=next?'＋':'－';const value=saved();value[index]=next;write(value)});
    });
  }
  function status(){qsa('.fp30-catalog-status').forEach(node=>node.remove())}
  function labels(){const sub=qs('.top .sub');if(sub)sub.textContent='产品目录工作室';qsa('.advanced-note').forEach(el=>{if(/API|JSON|技术|字段映射/.test(el.textContent))el.classList.add('fp-technical-only')})}
  function apply(){document.body.dataset.fpCatalogClosure='18.30';sections();status();labels();window.FlypigBOXUI30?.polish?.(document)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();setTimeout(apply,500)},{once:true});else{apply();setTimeout(apply,500)}
})();
