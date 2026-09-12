(()=>{'use strict';
if(window.HUIDICatalogDocumentHandoff)return;

const clean=value=>String(value??'').trim();
let busy=false;

async function api(url,opt={}){
  const response=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
  if(!response.ok){
    let detail=await response.text();
    try{detail=JSON.parse(detail).detail||detail}catch(_){}
    throw new Error(detail||response.statusText);
  }
  return response.json();
}

function dealId(){
  return clean(window.HUIDIBusinessContext?.dealId?.()||window.HUIDIDocumentEntryConnectivity?.dealId?.());
}

function catalogIds(){
  const values=window.HUIDIOnlineCatalog?.selectedProductIds?.();
  if(!Array.isArray(values))return[];
  return[...new Set(values.map(clean).filter(Boolean))];
}

function sameIds(left,right){
  const a=[...new Set((left||[]).map(clean).filter(Boolean))].sort();
  const b=[...new Set((right||[]).map(clean).filter(Boolean))].sort();
  return a.length===b.length&&a.every((value,index)=>value===b[index]);
}

function decorate(){
  const button=document.querySelector('[data-hoc-documents]');
  if(!button)return false;
  button.textContent='加入单据工作台';
  button.title='把目录已选产品同步到当前询盘后进入单据工作台；正式价格仍需在单据中确认';
  button.dataset.hocHandoff='1';
  return true;
}

function scheduleDecorate(){
  for(const delay of [0,80,220,520])setTimeout(decorate,delay);
}

async function openDocuments(id){
  await window.HUIDIDocumentEntryConnectivity?.setDeal?.(id);
  if(typeof window.HUIDIWorkspaceFoundation?.documents==='function')window.HUIDIWorkspaceFoundation.documents();
  else document.querySelector('[data-huidi-doc-workbench]')?.click();
  setTimeout(()=>window.HUIDIDocumentEntryConnectivity?.refresh?.(),80);
}

async function handoff(){
  if(busy)return false;
  const id=dealId();
  if(!id){
    alert('请先打开一笔询盘，再从产品目录加入单据工作台。');
    return false;
  }

  const ids=catalogIds();
  if(ids.length>100){
    alert(`单笔询盘最多关联 100 个产品；当前目录选择 ${ids.length} 个。`);
    return false;
  }

  busy=true;
  const button=document.querySelector('[data-hoc-documents]');
  const priorText=button?.textContent||'';
  if(button){button.disabled=true;button.textContent=ids.length?'正在核对并进入…':'正在进入…'}
  try{
    if(ids.length){
      let alreadyLinked=false;
      try{
        const current=await api(`/api/business/deals/${encodeURIComponent(id)}/products?limit=100`);
        alreadyLinked=sameIds(current?.selected,ids);
      }catch(_){}

      if(!alreadyLinked){
        const accepted=confirm(
          `确认把产品目录已选 ${ids.length} 个产品加入当前询盘 #${id} 并进入单据工作台？\n`+
          '产品名称、SKU、规格和其他非价格资料会沿用正式产品资料；正式单价、金额和执行数量仍需在单据中确认。'
        );
        if(!accepted)return false;
        if(button)button.textContent='正在同步并进入…';
        const out=await api(`/api/business/deals/${encodeURIComponent(id)}/products`,{
          method:'PUT',
          body:JSON.stringify({product_ids:ids})
        });
        window.HUIDIPlainLanguage?.toast?.(`已把 ${Number(out.selected_count??ids.length)} 个目录产品交给单据工作台`);
      }else{
        window.HUIDIPlainLanguage?.toast?.(`目录所选 ${ids.length} 个产品已与当前询盘一致，直接进入单据工作台`);
      }
    }else{
      window.HUIDIPlainLanguage?.toast?.('目录未选择产品，保留当前询盘已有产品关联');
    }
    await openDocuments(id);
    return true;
  }catch(error){
    alert(window.HUIDIPlainLanguage?.message?.(error?.message||error)||String(error?.message||error||'暂时无法进入单据工作台'));
    return false;
  }finally{
    busy=false;
    if(button){button.disabled=false;button.textContent=priorText||'加入单据工作台'}
    scheduleDecorate();
  }
}

function onClick(event){
  const button=event.target.closest?.('[data-hoc-documents]');
  if(button){
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handoff();
    return;
  }
  if(event.target.closest?.('.hoc,[data-page],[data-huidi-nav],[data-huidi-doc-workbench]'))scheduleDecorate();
}

document.addEventListener('click',onClick,true);
window.addEventListener('huidi-product-brain-synced',scheduleDecorate);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleDecorate,{once:true});else scheduleDecorate();

window.HUIDICatalogDocumentHandoff=Object.freeze({handoff,refresh:scheduleDecorate});
})();