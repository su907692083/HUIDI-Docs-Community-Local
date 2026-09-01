(()=>{'use strict';
 const typeLabel={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票',sales_contract:'销售合同',packing_list:'装箱单'};
 const p=new URLSearchParams(location.search),type=p.get('type')||sessionStorage.getItem('flypigbox_pending_document_type')||'proforma_invoice';
 document.addEventListener('DOMContentLoaded',()=>{const title=document.getElementById('doc-title');if(title&&typeLabel[type])title.dataset.documentType=type;const go=document.getElementById('continue-editor');if(go)go.title='进入单据编辑器后可继续核对版式、高级字段、条款与收款信息。';});
})();