(()=>{
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  function syncDialogs(){
    const open=document.querySelector('dialog.modal[open]');
    if(open){
      if(!document.body.classList.contains('workspace-dialog-open')){
        document.body.dataset.fpDialogScrollY=String(window.scrollY||0);
        document.body.style.top=`-${window.scrollY||0}px`;
        document.body.classList.add('workspace-dialog-open');
      }
      return;
    }
    if(document.body.classList.contains('workspace-dialog-open')){
      const y=Number(document.body.dataset.fpDialogScrollY||0);
      document.body.classList.remove('workspace-dialog-open');
      document.body.style.top='';
      delete document.body.dataset.fpDialogScrollY;
      requestAnimationFrame(()=>window.scrollTo(0,y));
    }
  }
  function enhanceProductImageField(){
    if ($('#record-fields .fp-product-media-manager')) return;
    const input=$('#record-fields input[name="image_url"]');
    if(!input||input.dataset.fpV33610Enhanced==='1')return;
    input.dataset.fpV33610Enhanced='1';
    const label=input.closest('label');
    if(!label)return;
    const box=document.createElement('div');
    box.className='product-image-editor-v33610';
    box.innerHTML='<div class="product-image-preview-v33610"><span>粘贴图片地址后预览</span></div><div class="product-image-editor-copy-v33610"><b>图片地址检查</b><span>建议使用自己的图床或 Supabase Storage 稳定地址；搜索缓存和临时链接可能失效。</span><div><button type="button" class="btn secondary" data-v33610-image-check>检查图片</button> <button type="button" class="btn ghost" data-v33610-image-clear>清空地址</button></div></div>';
    label.insertAdjacentElement('afterend',box);
    const preview=$('.product-image-preview-v33610',box);
    const setPreviewMessage=message=>{preview.replaceChildren();const span=document.createElement('span');span.textContent=message;preview.appendChild(span);};
    const render=()=>{
      const url=input.value.trim();
      if(!url){setPreviewMessage('尚未填写图片地址');return;}
      preview.replaceChildren();
      const image=document.createElement('img');
      image.alt='商品图片预览';
      image.addEventListener('load',()=>{const status=$('.product-image-editor-copy-v33610 b',box);if(status)status.textContent='图片可以访问';},{once:true});
      image.addEventListener('error',()=>{setPreviewMessage('图片无法访问，请更换地址');const status=$('.product-image-editor-copy-v33610 b',box);if(status)status.textContent='图片地址失效';},{once:true});
      image.src=url;
      preview.appendChild(image);
    };
    input.addEventListener('input',()=>{const status=$('.product-image-editor-copy-v33610 b',box);if(status)status.textContent='图片地址待检查';});
    box.addEventListener('click',event=>{
      if(event.target.closest('[data-v33610-image-check]'))render();
      if(event.target.closest('[data-v33610-image-clear]')){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));render();}
    });
    if(input.value.trim())render();
  }
  const observer=new MutationObserver(()=>{syncDialogs();enhanceProductImageField();});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('close',()=>setTimeout(syncDialogs,0),true);
  document.addEventListener('cancel',()=>setTimeout(syncDialogs,0),true);
  document.addEventListener('DOMContentLoaded',()=>{syncDialogs();enhanceProductImageField();},{once:true});
})();
