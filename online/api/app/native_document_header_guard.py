from __future__ import annotations

import re
from types import ModuleType
from typing import Any, Callable


HEADER_MARKER = "huidi-native-document-header-guard-v1"

_HEADER_STYLE = r"""
/* huidi-native-document-header-guard-v1 */
.top[data-huidi-native-header]{flex-wrap:wrap;box-shadow:0 1px 0 rgba(255,255,255,.08)}
.top[data-huidi-native-header] button{white-space:nowrap}
.top[data-huidi-native-header] button:disabled{opacity:.55;cursor:wait}
.top[data-huidi-native-header] #saveState{white-space:nowrap}
@media(max-width:760px){
  .top[data-huidi-native-header]{padding:8px 10px;gap:6px}
  .top[data-huidi-native-header]>b{flex:1 0 100%;margin-right:0;font-size:12px}
  .top[data-huidi-native-header] #saveState{margin-right:auto}
  .top[data-huidi-native-header] button{flex:1 1 auto;padding:7px 8px;font-size:11px}
}
"""

_HEADER_SCRIPT = r"""
<script id='huidi-native-document-header-guard-v1'>
(()=>{
  const refId='__REF_ID__';
  const returnKey='huidi-native-document-return-v1';
  const top=document.querySelector('.top[data-huidi-native-header]');
  if(!top||!refId)return;
  const state=top.querySelector('#saveState');
  const saveButton=top.querySelector('#save');
  const downloadButton=top.querySelector('#download');
  const printButton=top.querySelector('#print');
  const backButton=top.querySelector('#back');
  const topButtons=[...top.querySelectorAll('button')];
  let dirty=false;
  let saving=null;
  function itemData(){
    return [...document.querySelectorAll('[data-item-row]')].map(row=>{
      const out={product_id:row.dataset.productId||'',brain_id:row.dataset.brainId||''};
      row.querySelectorAll('[data-item-k]').forEach(el=>out[el.dataset.itemK]=el.value);
      return out;
    });
  }
  function payload(){
    const fields=[...document.querySelectorAll('[data-k]')];
    const out=Object.fromEntries(fields.map(el=>[el.dataset.k,el.value]));
    const rows=itemData();
    if(rows.length){
      out.items_json=JSON.stringify(rows);
      if(rows[0]){
        out.product=rows[0].product||out.product||'';
        out.sku=rows[0].sku||out.sku||'';
        out.spec=rows[0].spec||out.spec||'';
      }
    }
    return out;
  }
  function setBusy(value){topButtons.forEach(button=>button.disabled=Boolean(value));}
  function markDirty(){
    dirty=true;
    if(state&&state.textContent!=='保存中…')state.textContent='未保存';
  }
  function localBackup(data){
    try{localStorage.setItem(`huidi-native-doc-${refId}`,JSON.stringify(data));}catch(_){}
  }
  async function saveNow(){
    if(saving)return saving;
    saving=(async()=>{
      const data=payload();
      localBackup(data);
      setBusy(true);
      if(state)state.textContent='保存中…';
      try{
        const response=await fetch(`/api/business/documents/${encodeURIComponent(refId)}/draft`,{
          method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:data})
        });
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        dirty=false;
        if(state)state.textContent='已保存';
        return true;
      }catch(_){
        if(state)state.textContent='仅本机备份';
        return false;
      }finally{
        setBusy(false);
        saving=null;
      }
    })();
    return saving;
  }
  function safeReturn(raw){
    try{
      const url=new URL(String(raw||''),location.origin);
      if(url.origin!==location.origin)return'';
      if(url.pathname==='/login'||url.pathname.startsWith('/documents/online/'))return'';
      return url.pathname+url.search+url.hash;
    }catch(_){return'';}
  }
  function stop(event){event.preventDefault();event.stopImmediatePropagation();}
  saveButton?.addEventListener('click',async event=>{
    stop(event);
    const ok=await saveNow();
    alert(ok?'草稿已保存到联网版':'服务器保存失败，已保留这台电脑的本地备份');
  },true);
  downloadButton?.addEventListener('click',async event=>{
    stop(event);
    await saveNow();
    const blob=new Blob([document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});
    const anchor=document.createElement('a');
    anchor.href=URL.createObjectURL(blob);
    const docno=String(document.querySelector('.docno')?.textContent||'HUIDI-document').trim()||'HUIDI-document';
    anchor.download=`${docno}.html`;
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(anchor.href),1000);
  },true);
  printButton?.addEventListener('click',async event=>{
    stop(event);
    await saveNow();
    window.print();
  },true);
  backButton?.addEventListener('click',async event=>{
    stop(event);
    if(dirty){
      const ok=await saveNow();
      if(!ok&&!confirm('草稿暂时没有保存到服务器，但已保留本机备份。仍要返回工作台吗？'))return;
      if(!ok)dirty=false;
    }
    let target='';
    try{
      target=safeReturn(sessionStorage.getItem(returnKey));
      sessionStorage.removeItem(returnKey);
    }catch(_){}
    if(!target)target=safeReturn(document.referrer);
    location.href=target||'/';
  },true);
  document.addEventListener('input',event=>{
    if(event.target?.matches?.('[data-k],[data-item-k]'))markDirty();
  },true);
  document.addEventListener('change',event=>{
    if(event.target?.matches?.('[data-k],[data-item-k],#buyerAddressSelect,#bankAccountSelect'))markDirty();
  },true);
  window.addEventListener('beforeunload',event=>{
    if(!dirty)return;
    event.preventDefault();
    event.returnValue='';
  });
})();
</script>
"""


def decorate_native_document_header(page: str) -> str:
    """Harden the existing native-document toolbar without creating a new owner.

    The guard uses the same OnlineDocumentRef draft endpoint and the same local
    backup key as the native editor. It adds save-before-print/download behavior,
    a deterministic return target, dirty-state protection, and responsive header
    wrapping. No document/customer/product data model or route is introduced.
    """

    text = str(page or "")
    if HEADER_MARKER in text or "<div class='top'>" not in text:
        return text
    match = re.search(r"/api/business/documents/(\d+)/draft", text)
    if not match:
        return text
    ref_id = match.group(1)
    text = text.replace(
        "<div class='top'>",
        f"<div class='top' data-huidi-native-header='{HEADER_MARKER}'>",
        1,
    )
    text = text.replace(
        "<button class='primary' onclick='window.print()'>打印 / 另存 PDF</button>",
        "<button class='primary' id='print'>打印 / 另存 PDF</button>",
        1,
    )
    if "</style>" in text:
        text = text.replace("</style>", _HEADER_STYLE + "</style>", 1)
    if "</body>" in text:
        script = _HEADER_SCRIPT.replace("__REF_ID__", ref_id)
        text = text.replace("</body>", script + "</body>", 1)
    return text


def install_native_document_header_guard(standalone_module: ModuleType) -> None:
    """Install one final presentation wrapper around the canonical renderer."""

    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_header_guard", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_header(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_header_guard", True)
    setattr(wrapped, "_huidi_native_header_guard_original", original)
    standalone_module._document_html = wrapped
