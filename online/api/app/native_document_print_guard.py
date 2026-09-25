from __future__ import annotations

from types import ModuleType
from typing import Any, Callable


PRINT_MARKER = "huidi-native-document-print-standard-v1"

_PRINT_STYLE = r"""
<style id='huidi-native-document-print-standard-v1'>
.huidi-print-value{display:none}
@media print{
  html,body{margin:0!important;padding:0!important;background:#fff!important;color:#101828!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{font-size:9.5pt!important;line-height:1.35!important}
  .top,.ctx,.note,.refprice,.item-ref,.review-toolbar,.review-panel,.ngb-toolbar,.npaste-panel,
  .hnd-batch-confirm,.hnd-batch-reconcile,.hnd-batch-risk,.hnd-review button,.hnd-save-readiness,
  [data-hnd-review],[data-hnd-paste],[data-hnd-batch-confirm],[data-hnd-batch-reconcile],[data-hnd-batch-risk],
  button,select{display:none!important}
  .paper{width:auto!important;max-width:none!important;min-height:auto!important;margin:0!important;padding:0!important;box-shadow:none!important;background:#fff!important}
  h1{margin:0 0 1mm!important;font-size:18pt!important;line-height:1.2!important;letter-spacing:1.2px!important;color:#101828!important}
  h3{margin:0 0 2mm!important;font-size:10.5pt!important;color:#101828!important}
  .docno{margin:0 0 4mm!important;font-size:9pt!important;color:#475467!important}
  .section{margin:3mm 0!important;padding:3mm!important;border:.5pt solid #b8c0cc!important;border-radius:0!important;background:#fff!important;break-inside:avoid;page-break-inside:avoid}
  .grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:2.5mm 4mm!important;margin:2.5mm 0!important;break-inside:avoid;page-break-inside:avoid}
  .grid.three{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  .wide{grid-column:1/-1!important}
  label{font-size:8.5pt!important;line-height:1.3!important;color:#344054!important;font-weight:700!important;break-inside:avoid;page-break-inside:avoid}
  [data-k]:not([type='hidden']),[data-item-k]:not([type='hidden']){display:none!important}
  .huidi-print-value{display:block!important;min-height:1.35em!important;margin-top:.7mm!important;color:#101828!important;font:400 8.5pt/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important}
  label>.huidi-print-value{padding:.7mm 0 1mm!important;border-bottom:.35pt solid #d0d5dd!important}
  .table-wrap{width:100%!important;margin:3mm 0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:#fff!important}
  table,.table-wrap table,.item-table,.item-table.packing{width:100%!important;min-width:0!important;margin:3mm 0!important;border-collapse:collapse!important;table-layout:fixed!important}
  .table-wrap table{margin:0!important}
  thead{display:table-header-group!important}
  tfoot{display:table-footer-group!important}
  tr,th,td{break-inside:avoid;page-break-inside:avoid}
  th,td{border:.5pt solid #667085!important;padding:1.35mm!important;text-align:left!important;vertical-align:top!important;font-size:8pt!important;line-height:1.3!important;overflow-wrap:anywhere!important;word-break:break-word!important}
  th{background:#f2f4f7!important;color:#101828!important;font-weight:700!important}
  td .huidi-print-value{margin:0!important;padding:0!important;border:0!important;font-size:7.8pt!important;line-height:1.3!important}
  .item-table .spec-cell{min-width:0!important}
  .item-table.commercial th:nth-child(1),.item-table.commercial td:nth-child(1){width:4%!important}
  .item-table.commercial th:nth-child(2),.item-table.commercial td:nth-child(2){width:17%!important}
  .item-table.commercial th:nth-child(3),.item-table.commercial td:nth-child(3){width:12%!important}
  .item-table.commercial th:nth-child(4),.item-table.commercial td:nth-child(4){width:21%!important}
  .item-table.commercial th:nth-child(5),.item-table.commercial td:nth-child(5){width:10%!important}
  .item-table.commercial th:nth-child(6),.item-table.commercial td:nth-child(6){width:10%!important}
  .item-table.commercial th:nth-child(7),.item-table.commercial td:nth-child(7){width:12%!important}
  .item-table.commercial th:nth-child(8),.item-table.commercial td:nth-child(8){width:14%!important}
  .item-table.packing th,.item-table.packing td{padding:1mm!important;font-size:7pt!important}
  .item-table.packing td .huidi-print-value{font-size:6.9pt!important}
  .item-table.packing th:nth-child(1),.item-table.packing td:nth-child(1){width:3%!important}
  .item-table.packing th:nth-child(2),.item-table.packing td:nth-child(2){width:15%!important}
  .item-table.packing th:nth-child(3),.item-table.packing td:nth-child(3){width:9%!important}
  .item-table.packing th:nth-child(4),.item-table.packing td:nth-child(4){width:8%!important}
  .item-table.packing th:nth-child(5),.item-table.packing td:nth-child(5){width:9%!important}
  .item-table.packing th:nth-child(6),.item-table.packing td:nth-child(6){width:7%!important}
  .item-table.packing th:nth-child(7),.item-table.packing td:nth-child(7){width:7%!important}
  .item-table.packing th:nth-child(8),.item-table.packing td:nth-child(8){width:11%!important}
  .item-table.packing th:nth-child(9),.item-table.packing td:nth-child(9){width:7%!important}
  .item-table.packing th:nth-child(10),.item-table.packing td:nth-child(10){width:10%!important}
  .item-table.packing th:nth-child(11),.item-table.packing td:nth-child(11){width:14%!important}
  .foot{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12mm!important;margin-top:12mm!important;break-inside:avoid;page-break-inside:avoid}
  .sign{padding-top:3mm!important;border-top:.5pt solid #667085!important;color:#344054!important;font-size:8.5pt!important}
}
</style>
"""

_PRINT_SCRIPT = r"""
<script id='huidi-native-document-print-standard-script-v1'>
(()=>{
  const marker='huidi-native-document-print-standard-v1';
  const root=document.documentElement;
  if(root.dataset.huidiPrintStandard===marker)return;
  const wideTable=Boolean(document.querySelector('.item-table'));
  const packing=Boolean(document.querySelector('.item-table.packing'))||String(document.title||'').includes('装箱单');
  const orientation=(wideTable||packing)?'landscape':'portrait';
  root.dataset.huidiPrintStandard=marker;
  root.dataset.huidiPrintLayout=orientation;
  const pageStyle=document.createElement('style');
  pageStyle.id='huidi-native-document-page-size-v1';
  pageStyle.textContent=`@page{size:A4 ${orientation};margin:${orientation==='landscape'?'8mm 8mm 10mm':'10mm 9mm 12mm'}}`;
  document.head.appendChild(pageStyle);

  function clearMirrors(){document.querySelectorAll('[data-huidi-print-value]').forEach(node=>node.remove());}
  function syncMirrors(){
    clearMirrors();
    document.querySelectorAll('[data-k],[data-item-k]').forEach(control=>{
      if(String(control.type||'').toLowerCase()==='hidden')return;
      const mirror=document.createElement(control.tagName==='TEXTAREA'?'div':'span');
      mirror.className='huidi-print-value';
      mirror.dataset.huidiPrintValue='1';
      mirror.textContent=String(control.value??'').trim()||'\u00a0';
      control.insertAdjacentElement('afterend',mirror);
    });
  }
  syncMirrors();
  window.addEventListener('beforeprint',syncMirrors);
  window.addEventListener('afterprint',clearMirrors);
})();
</script>
"""


def decorate_native_document_print(page: str) -> str:
    """Apply one deterministic screen-to-PDF presentation contract.

    The existing native HTML editor remains the sole document owner. This guard
    adds print-only mirrors for editable values, A4 page sizing, deterministic
    table widths, repeated table headers, page-break protection, and removal of
    review/tooling surfaces from formal output. It does not persist or mutate any
    business field.
    """

    text = str(page or "")
    if PRINT_MARKER in text or "</head>" not in text or "</body>" not in text:
        return text
    text = text.replace("</head>", _PRINT_STYLE + "</head>", 1)
    text = text.replace("</body>", _PRINT_SCRIPT + "</body>", 1)
    return text


def install_native_document_print_guard(standalone_module: ModuleType) -> None:
    """Install the final print/PDF presentation wrapper exactly once."""

    original: Callable[..., str] | None = getattr(standalone_module, "_document_html", None)
    if original is None or getattr(original, "_huidi_native_print_guard", False):
        return

    def wrapped(*args: Any, **kwargs: Any) -> str:
        return decorate_native_document_print(original(*args, **kwargs))

    setattr(wrapped, "_huidi_native_print_guard", True)
    setattr(wrapped, "_huidi_native_print_guard_original", original)
    standalone_module._document_html = wrapped
