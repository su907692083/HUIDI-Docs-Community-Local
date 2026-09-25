from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


READINESS_MARKER = "huidi-native-document-save-readiness-v1"

_READINESS_STYLE = """
.hnd-review .hnd-save-readiness{display:inline-flex;align-items:center;min-height:28px;padding:3px 8px;border:1px solid #d0d5dd;border-radius:999px;background:#f8fafc;color:#475467;font-size:10px;font-weight:700;white-space:nowrap}.hnd-review .hnd-save-readiness[data-level='ok']{border-color:#86efac;background:#f0fdf4;color:#166534}.hnd-review .hnd-save-readiness[data-level='warn']{border-color:#fedf89;background:#fffaeb;color:#a15c00}.hnd-review .hnd-save-readiness[data-level='bad']{border-color:#fda29b;background:#fff5f5;color:#b42318}.hnd-review [data-hnd-save-next]{height:30px;margin:0;padding:4px 8px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;font-size:12px}.hnd-review [data-hnd-save-next]:disabled{opacity:.45;cursor:not-allowed}.hnd-save-review-focus{outline:2px solid #84adff!important;outline-offset:2px!important}.top #save.hnd-save-has-review{box-shadow:inset 0 0 0 1px #fdb022}
@media print{.hnd-review .hnd-save-readiness,.hnd-review [data-hnd-save-next]{display:none!important}}
"""

_OLD_NEXT = "<button type='button' data-hnd-review-next disabled>下一异常</button>"
_READINESS_INLINE = "<button type='button' data-hnd-save-next disabled>下一待核对</button><span class='hnd-save-readiness' data-hnd-save-readiness data-level='ok' aria-live='polite'>保存前：正在核对</span>"

_READINESS_SCRIPT = r"""
<script id='huidi-native-document-save-readiness-v1'>
(()=>{
  const bar=document.querySelector('[data-hnd-review]');
  const status=bar?.querySelector('[data-hnd-save-readiness]');
  const next=bar?.querySelector('[data-hnd-save-next]');
  const save=document.querySelector('#save');
  if(!bar||!status||!next||!save)return;
  let cursor=-1,scheduled=false;

  function isVisible(target){
    const row=target?.closest?.('[data-item-row]');
    if(row&&(row.hidden||row.classList.contains('hnd-review-hidden')))return false;
    return true;
  }
  function collectIssues(){
    const issues=[];
    const seen=new Set();
    const add=(target,type,severity,label)=>{
      if(!target||seen.has(target))return;
      seen.add(target);issues.push({target,type,severity,label});
    };
    document.querySelectorAll('.hnd-amount-mismatch').forEach(input=>add(input,'amount','bad','金额核对'));
    document.querySelectorAll('.hnd-paste-cell-warning').forEach(input=>add(input,'paste','warn','Excel 粘贴核对'));
    document.querySelectorAll('[data-hnd-batch-target-confirm]').forEach(button=>add(button.closest('.hnd-batch-reconcile-card')||button,'baseline','warn','总量基准待确认'));
    document.querySelectorAll(".hnd-batch-reconcile-card[data-state='bad'],.hnd-batch-reconcile-card[data-state='warn']").forEach(card=>{
      if(card.querySelector('[data-hnd-batch-target-confirm]'))return;
      add(card,'reconcile',card.dataset.state==='bad'?'bad':'warn','批次总量核对');
    });
    document.querySelectorAll(".hnd-batch-risk-card[data-level='bad'],.hnd-batch-risk-card[data-level='warn']").forEach(card=>add(card,'risk',card.dataset.level==='bad'?'bad':'warn','交期 / Packing 核对'));
    return issues;
  }
  function refresh(){
    const issues=collectIssues();
    const bad=issues.filter(item=>item.severity==='bad').length;
    const warn=issues.length-bad;
    status.dataset.level=bad?'bad':warn?'warn':'ok';
    status.textContent=!issues.length
      ? '保存前：已核对 · 可保存'
      : `保存前：${bad?`${bad} 异常${warn?` + ${warn} 待核对`:''}`:`${warn} 项待核对`} · 仍可保存`;
    next.disabled=issues.length===0;
    save.classList.toggle('hnd-save-has-review',issues.length>0);
    save.title=issues.length?`还有 ${issues.length} 项待核对；系统不会阻断保存。`:'当前未发现待核对项。';
    if(cursor>=issues.length)cursor=-1;
  }
  function focusIssue(item){
    const target=item?.target;if(!target)return;
    const details=target.closest?.('details');if(details)details.open=true;
    target.scrollIntoView?.({block:'center',inline:'nearest',behavior:'smooth'});
    const control=target.matches?.('input,textarea,select,button')?target:target.querySelector?.('input,textarea,select,button');
    if(control&&!control.disabled)control.focus?.({preventScroll:true});
    target.classList.add('hnd-save-review-focus');
    setTimeout(()=>target.classList.remove('hnd-save-review-focus'),1200);
  }
  function nextIssue(){
    const visible=collectIssues().filter(item=>isVisible(item.target));
    if(!visible.length){
      const all=collectIssues();
      status.textContent=all.length?'当前筛选隐藏了待核对行；切回“全部”后可继续定位。':'保存前：已核对 · 可保存';
      return;
    }
    cursor=(cursor+1)%visible.length;
    focusIssue(visible[cursor]);
  }
  function schedule(){
    if(scheduled)return;scheduled=true;
    queueMicrotask(()=>{scheduled=false;refresh();});
  }
  next.addEventListener('click',nextIssue);
  document.addEventListener('input',schedule);
  document.addEventListener('change',schedule);
  document.addEventListener('click',schedule);
  refresh();
})();
</script>
"""


def decorate_native_document_save_readiness(page: str) -> str:
    """Unify existing review signals into a non-blocking pre-save status.

    This layer does not own validation, persistence or business state. It only
    reads presentation signals already produced by the amount/paste/batch-risk
    layers, replaces the older anomaly-only navigator with a unified navigator,
    and never disables or intercepts the native Save Draft owner.
    """
    text = str(page or "")
    if READINESS_MARKER in text or "huidi-native-document-review-v1" not in text or "huidi-native-document-batch-risk-v1" not in text:
        return text
    if _OLD_NEXT not in text:
        return text
    text = text.replace(_OLD_NEXT, _READINESS_INLINE, 1)
    if "</style>" in text:
        text = text.replace("</style>", _READINESS_STYLE + "</style>", 1)
    if "</body>" in text:
        text = text.replace("</body>", _READINESS_SCRIPT + "</body>", 1)
    return text


def install_native_document_save_readiness(standalone_module: ModuleType) -> None:
    """Install after the seventh risk layer so initial signals already exist."""
    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_save_readiness", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_save_readiness(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_save_readiness", True)
    setattr(wrapped, "_huidi_native_save_readiness_original", original)
    standalone_module._document_html = wrapped
