/* HUIDI V3.3.6.24 — Smart Capture Operational Foundation.
   Unified text/CSV/XLSX recognition, human review, classified persistence,
   timestamp visibility, and document preparation on top of the existing workspace. */
(()=>{'use strict';
  if(window.FlypigBOXSmartCapture?.version==='V3.3.6.24-R1.3A.18.19.2')return;
  const VERSION='V3.3.6.24-R1.3A.18.19.2';
  const TASK_TYPE='capture_and_classify';
  const LEGACY_TASK_TYPE='inquiry_to_quotation';
  const DRAFT_PREFIX='flypigbox_smart_capture_draft_v1:';
  const RESULT_KEY='flypigbox_smart_capture_result_v1';
  const SOURCE_LABELS={paste:'粘贴文本',txt:'文本文件',csv:'CSV 文件',tsv:'TSV 文件',xlsx:'Excel 文件',manual:'手动录入',smart_service:'智能整理',local_fast:'本机快速整理',session_cache:'复用本次结果',local_structure:'本机快速整理'};
  const DOC_TYPES={quotation:'报价单',proforma_invoice:'形式发票（PI）',commercial_invoice:'商业发票',packing_list:'装箱单',sales_contract:'销售合同'};
  const DEAL_STAGES={new_inquiry:'新询盘',qualified:'已确认需求',quoted:'已报价',negotiation:'洽谈中',order_confirmed:'已确认订单',won:'已成交',lost:'已结束'};
  const LANGUAGES={auto:'自动识别',en:'英文',zh:'中文',bilingual:'中英双语',es:'西班牙语',fr:'法语',de:'德语',pt:'葡萄牙语',it:'意大利语',ja:'日语',ko:'韩语',ru:'俄语',ar:'阿拉伯语'};
  const CUSTOMER_LANGUAGES={auto:'未确认',en:'英文',zh:'中文',bilingual:'中英双语',es:'西班牙语',fr:'法语',de:'德语',pt:'葡萄牙语',it:'意大利语',ja:'日语',ko:'韩语',ru:'俄语',ar:'阿拉伯语'};
  const CURRENCIES=['USD','EUR','GBP','CNY','RMB','JPY','AUD','CAD','HKD','SGD','AED','SAR','INR','KRW','BRL','MXN'];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const clean=v=>String(v??'').replace(/\u00a0/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const cssEscape=value=>window.CSS?.escape?window.CSS.escape(String(value)):String(value).replace(/[^a-zA-Z0-9_-]/g,ch=>`\\${ch}`);
  const nullableNumber=v=>{const t=clean(v).replace(/[^0-9+\-.]/g,'');if(!t)return null;const n=Number(t);return Number.isFinite(n)?n:null;};
  const today=()=>new Date().toISOString().slice(0,10);
  const isoNow=()=>new Date().toISOString();
  const uuid=()=>crypto?.randomUUID?.()||`fp_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  const fmtTime=value=>{if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);};
  const state={sourceText:'',sourceType:'paste',sourceName:'',matrix:null,result:null,saving:false,lastSaved:null};

  function workspace(){return window.FlypigBOXWorkspaceAPI||null;}
  function workspaceState(){return workspace()?.getState?.()||{};}
  function cloud(){return window.FlypigBOXCloudCore||null;}
  function client(){return cloud()?.getClient?.()||window.FlypigBOXSupabaseClient||null;}
  function user(){return cloud()?.getUser?.()||workspaceState().user||null;}
  function isLocalPreview(){return Boolean(window.FlypigBOXEnvironment?.isLocalPreview||location.protocol==='file:'||new URLSearchParams(location.search).get('localPreview')==='1');}
  function toast(message,error=false){if(workspace()?.toast)return workspace().toast(message,error);console[error?'error':'log'](message);}
  function safeJsonRead(store,key,fallback=null){try{const raw=store.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(_){return fallback;}}
  function safeJsonWrite(store,key,value){try{store.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function draftKey(){return `${DRAFT_PREFIX}${user()?.id||'guest'}`;}
  function saveDraft(){safeJsonWrite(localStorage,draftKey(),{text:state.sourceText,sourceType:state.sourceType,sourceName:state.sourceName,updatedAt:isoNow()});}
  function loadDraft(){let d=safeJsonRead(localStorage,draftKey(),null);if(!d){try{const legacy=clean(sessionStorage.getItem('flypigbox_ai_pending_text_v1'));if(legacy)d={text:legacy,sourceType:'paste',sourceName:'',updatedAt:isoNow()};}catch(_){}}if(d){state.sourceText=clean(d.text);state.sourceType=d.sourceType||'paste';state.sourceName=d.sourceName||'';}return d;}
  function clearDraft(){try{localStorage.removeItem(draftKey());}catch(_){}state.sourceText='';state.sourceType='paste';state.sourceName='';state.matrix=null;}

  function detectLanguage(text){
    const t=clean(text);if(!t)return'auto';
    const script=[];
    if(/[\u4e00-\u9fff]/.test(t))script.push('zh');
    if(/[\u3040-\u30ff]/.test(t))script.push('ja');
    if(/[\uac00-\ud7af]/.test(t))script.push('ko');
    if(/[\u0600-\u06ff]/.test(t))script.push('ar');
    if(/[\u0400-\u04ff]/.test(t))script.push('ru');
    const latin=t.toLowerCase();
    const dictionaries={
      es:['hola','empresa','cantidad','precio','entrega','pago','cotización','cotizacion','cliente','producto','dirección','direccion','factura','presupuesto'],
      pt:['olá','ola','quantidade','preço','preco','pagamento','cotação','cotacao','cliente','produto','endereço','endereco','fatura','orçamento','orcamento'],
      fr:['bonjour','société','societe','quantité','quantite','prix','livraison','paiement','devis','client','produit','adresse','facture'],
      de:['guten tag','firma','menge','preis','lieferung','zahlung','angebot','kunde','produkt','adresse','rechnung'],
      it:['buongiorno','azienda','quantità','quantita','prezzo','consegna','pagamento','preventivo','cliente','prodotto','indirizzo','fattura'],
      en:['hello','company','quantity','price','delivery','payment','quotation','customer','product','address','invoice','buyer']
    };
    const scores={};
    for(const [lang,words] of Object.entries(dictionaries))scores[lang]=words.reduce((n,w)=>n+(latin.includes(w)?1:0),0);
    const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const top=ranked[0]||['en',0],second=ranked[1]||['',0];
    const latinLang=top[1]>=2&&(top[1]>=5||top[1]>=second[1]+2)?top[0]:(top[1]>0&&top[1]===second[1]?'mixed':(top[1]>0?top[0]:'en'));
    if(script.length){
      const strongLatin=top[1]>=2||(latin.match(/[a-z]{3,}/g)||[]).length>=4;
      const unique=[...new Set([...script,...(strongLatin?[latinLang]:[])])];
      return unique.length>1?'mixed':unique[0];
    }
    return latinLang;
  }
  function labelled(text,aliases){
    const pattern=aliases.map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const re=new RegExp(`(?:^|\\n)\\s*(?:${pattern})\\s*[:：-]\\s*([^\\n]+)`,'i');
    return clean(text.match(re)?.[1]);
  }
  function firstMatch(text,re){return clean(text.match(re)?.[1]||text.match(re)?.[0]);}
  function normalizeCurrency(value,text=''){const upper=clean(value).toUpperCase();if(CURRENCIES.includes(upper))return upper==='RMB'?'CNY':upper;const symbol=String(text).match(/\b(USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED|SAR|INR|KRW|BRL|MXN)\b/i)?.[1];if(symbol)return symbol.toUpperCase()==='RMB'?'CNY':symbol.toUpperCase();if(/\$/.test(text))return'USD';if(/€/.test(text))return'EUR';if(/£/.test(text))return'GBP';return'USD';}
  function detectDocType(text){const t=text.toLowerCase();if(/packing\s*list|装箱单|liste de colisage|lista de empaque/.test(t))return'packing_list';if(/commercial\s*invoice|商业发票|factura comercial|facture commerciale/.test(t))return'commercial_invoice';if(/proforma|\bpi\b|形式发票/.test(t))return'proforma_invoice';if(/sales\s*contract|销售合同|contrato de venta|contrat de vente/.test(t))return'sales_contract';return'quotation';}
  function parseDelimited(text,delimiter){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){row.push(clean(cell));cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(clean(cell));cell='';if(row.some(Boolean))rows.push(row);row=[];}else cell+=ch;}
    row.push(clean(cell));if(row.some(Boolean))rows.push(row);return rows;
  }
  function normalizedLabel(value){return clean(value).normalize('NFKC').toLowerCase().replace(/[：:]/g,'').replace(/[()（）\[\]【】]/g,' ').replace(/[／/|\\]/g,' ').replace(/[^a-z0-9\u4e00-\u9fff]+/g,'');}
  function headerKey(value){const v=normalizedLabel(value),parts=String(value??'').split(/[／|\/\\]/).map(normalizedLabel).filter(Boolean);if(!v)return'';const aliases={
    name:['商品名称','产品名称','品名','productname','itemname','product','item','description','nombreproducto','produit','produkt'],
    sku:['sku','型号','modelno','model','itemno','货号','articleno','productcode'],
    specification:['规格描述','规格','参数','specification','spec','size','material','details','productdescription'],
    quantity:['数量','qty','quantity','orderqty','cantidad','quantité','menge'],unit:['单位','unit','uom','unidad','unité'],
    price:['单价','价格','unitprice','price','precio','prix','preis'],currency:['币种','currency','moneda','devise','währung'],
    moq:['moq','最小起订量','起订量','minimumorderquantity'],hs_code:['hscode','hs编码','海关编码','tariffcode'],image_url:['图片链接','图片','imageurl','image','photo','picture','主图'],
    company_name:['买方公司','客户公司','公司名称','buyercompany','customercompany','buyer','customer','companyname','empresa','société','firma'],
    contact_name:['买方联系人','客户联系人','联系人','buyercontact','contactname','contactperson','contact','attn'],email:['买方邮箱','客户邮箱','邮箱','buyeremail','email','e-mail'],
    phone:['买方电话','客户电话','whatsapp','电话','手机','buyerphone','phone','mobile','tel'],country:['买方国家','客户国家','国家地区','国家','地区','buyercountry','country','region','país','pays','land'],
    address:['买方地址','客户地址','地址','buyeraddress','customeraddress','address','dirección','adresse'],trade_terms:['贸易术语','incoterm','tradeterms'],payment_terms:['付款条件','paymentterms','payment'],delivery_time:['交期','交货期','deliverytime','leadtime'],destination:['目的地','目的港','destinationport','destination'],
    invoice_no:['报价单号','形式发票号','商业发票号','装箱单号','合同编号','单据编号','quotationno','proformainvoiceno','invoiceno','packinglistno','contractno','documentno'],
    issue_date:['出单日期','签发日期','开票日期','issuedate','dateofissue'],customer_po:['客户po','采购订单号','customerpo','purchaseorderno','pono'],origin_country:['原产国','countryoforigin','origincountry']
  };let bestKey='',bestLen=0;for(const [key,list] of Object.entries(aliases)){for(const raw of list){const a=normalizedLabel(raw);if(v===a||parts.includes(a))return key;if(a.length>=4&&v.includes(a)&&a.length>bestLen){bestKey=key;bestLen=a.length;}}}return bestKey;}
  function matrixRowText(row){return (row||[]).map(clean).filter(Boolean).join(' | ');}
  function matrixSection(rowText,current=''){const t=normalizedLabel(rowText);if(/买方信息|客户信息|buyerinformation|customerinformation|billto|consigneeinformation/.test(t))return'buyer';if(/卖方信息|sellerinformation|supplierinformation|exporterinformation/.test(t))return'seller';if(/商品明细|产品明细|productdetails|itemdetails|productinformation|goodsdescription/.test(t))return'products';if(/贸易条款|termsconditions|commercialterms/.test(t))return'terms';return current;}
  function nextMatrixValue(matrix,r,c){const row=matrix[r]||[];for(let i=c+1;i<row.length;i++){const v=clean(row[i]);if(v&&!headerKey(v)&&!/^[-—|]+$/.test(v))return v;}for(let rr=r+1;rr<Math.min(matrix.length,r+3);rr++){const v=clean((matrix[rr]||[])[c]);if(v&&!headerKey(v))return v;}return'';}
  function validPhone(value){const v=clean(value),digits=v.replace(/\D/g,'');if(digits.length<7||digits.length>16)return'';if(/^\d{4}[-/]\d{2}[-/]\d{2,4}$/.test(v))return'';if(/^(?:QT|PI|CI|PL|SC)[-_]/i.test(v))return'';return v;}
  function normalizeDate(value){const v=clean(value);if(!v)return'';const m=v.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return v;}
  function productsFromMatrix(matrix){
    if(!Array.isArray(matrix)||!matrix.length)return[];let headerIndex=-1,map={},bestScore=0;
    for(let r=0;r<Math.min(matrix.length,120);r++){const candidate={};(matrix[r]||[]).forEach((v,c)=>{const key=headerKey(v);if(['name','sku','specification','quantity','unit','price','currency','moq','hs_code','image_url'].includes(key)&&candidate[key]===undefined)candidate[key]=c;});const score=['name','sku','quantity','price'].reduce((n,k)=>n+(candidate[k]!==undefined?1:0),0);if(score>bestScore&&(candidate.name!==undefined||candidate.sku!==undefined)){headerIndex=r;map=candidate;bestScore=score;}if(score>=3)break;}
    if(headerIndex<0)return[];const products=[];
    for(let r=headerIndex+1;r<matrix.length;r++){const row=matrix[r]||[],rowText=matrixRowText(row);if(/^(?:total|subtotal|grandtotal|合计|总计|小计|terms|备注|paymentterms)/i.test(normalizedLabel(rowText)))break;const get=k=>map[k]===undefined?'':clean(row[map[k]]);const item={name:get('name'),sku:get('sku'),specification:get('specification'),quantity:nullableNumber(get('quantity')),unit:get('unit')||'PCS',suggested_price:nullableNumber(get('price')),currency:normalizeCurrency(get('currency'),get('price')),moq:nullableNumber(get('moq')),hs_code:get('hs_code'),image_url:get('image_url')};if(!item.name&&!item.sku)continue;if(/^(?:no|序号|item|product)$/i.test(item.name))continue;products.push(item);}
    return products.slice(0,200);
  }
  function fieldsFromMatrix(matrix){
    const out={};if(!Array.isArray(matrix))return out;let section='';
    for(let r=0;r<Math.min(matrix.length,140);r++){const row=matrix[r]||[],rowText=matrixRowText(row);section=matrixSection(rowText,section);
      for(let c=0;c<row.length;c++){const raw=clean(row[c]);if(!raw)continue;const key=headerKey(raw);if(!key||['name','sku','specification','quantity','unit','price','moq','hs_code','image_url'].includes(key))continue;let value=nextMatrixValue(matrix,r,c);if(!value){const split=raw.split(/[:：]\s*/);if(split.length>1)value=clean(split.slice(1).join(':'));}
        const buyerSensitive=['company_name','contact_name','email','phone','country','address'];const explicitBuyer=/买方|客户|buyer|customer|consignee|billto/i.test(raw);const explicitSeller=/卖方|seller|supplier|exporter/i.test(raw);if(buyerSensitive.includes(key)){if(section==='seller'||explicitSeller)continue;if(section!=='buyer'&&!explicitBuyer&&out[key])continue;}
        if(key==='phone')value=validPhone(value);if(key==='issue_date')value=normalizeDate(value);if(value&&!out[key])out[key]=value;
      }
    }
    return out;
  }
  function freeTextProducts(text,currency){
    const lines=text.split(/\r?\n/).map(clean).filter(Boolean);const products=[];
    const explicit=[];
    lines.forEach(line=>{
      const label=line.match(/^(?:product|item|商品|产品|品名|producto|produit|produkt)\s*[:：-]\s*(.+)$/i);if(label)explicit.push({name:clean(label[1])});
      const tab=line.split(/\t|\s*\|\s*/).map(clean);if(tab.length>=3&&/\d/.test(line)&&!/(company|email|phone|address|公司|邮箱|电话|地址)/i.test(line)){
        const qtyIndex=tab.findIndex(v=>/^\d+(?:\.\d+)?\s*(?:pcs?|pieces?|sets?|units?|个|件|套)?$/i.test(v));const priceIndex=tab.findIndex(v=>/(?:USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED|\$|€|£)?\s*\d+(?:\.\d+)?/i.test(v)&&v!==tab[qtyIndex]);if(qtyIndex>0){explicit.push({name:tab[0],sku:qtyIndex>1?tab[1]:'',quantity:nullableNumber(tab[qtyIndex]),unit:(tab[qtyIndex].match(/[A-Za-z\u4e00-\u9fff]+/)||[])[0]||'PCS',suggested_price:priceIndex>=0?nullableNumber(tab[priceIndex]):null,currency:normalizeCurrency('',tab[priceIndex]||currency)});}
      }
    });
    const productLabel=labelled(text,['Product','Product Name','Item','商品','产品','品名','Producto','Produit','Produkt']);
    if(productLabel&&!explicit.some(p=>p.name===productLabel))explicit.unshift({name:productLabel});
    const sku=labelled(text,['SKU','Model','Model No','型号','货号','Référence','Modelo']);
    const qtyText=labelled(text,['Quantity','Qty','Order Quantity','数量','Cantidad','Quantité','Menge'])||firstMatch(text,/(?:qty|quantity|数量|cantidad|quantité|menge)\s*[:：-]?\s*(\d+(?:\.\d+)?)/i);
    const unit=firstMatch(qtyText,/([A-Za-z\u4e00-\u9fff]+)$/)||labelled(text,['Unit','单位','Unidad','Unité'])||'PCS';
    const priceText=labelled(text,['Unit Price','Price','单价','价格','Precio','Prix','Preis'])||firstMatch(text,/(?:USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|HKD|SGD|AED|\$|€|£)\s*\d+(?:\.\d+)?/i);
    const spec=labelled(text,['Specification','Spec','规格','描述','Descripción','Spécification']);
    if(!explicit.length&&(productLabel||sku||qtyText||priceText))explicit.push({name:productLabel||sku||'待确认商品'});
    if(explicit.length===1){Object.assign(explicit[0],{sku:explicit[0].sku||sku,specification:spec,quantity:explicit[0].quantity??nullableNumber(qtyText),unit:explicit[0].unit||unit,suggested_price:explicit[0].suggested_price??nullableNumber(priceText),currency:explicit[0].currency||normalizeCurrency('',priceText||currency),moq:nullableNumber(labelled(text,['MOQ','起订量','Minimum Order Quantity'])),hs_code:labelled(text,['HS Code','HS编码','海关编码']),image_url:labelled(text,['Image','Image URL','图片','图片链接'])});}
    return explicit.slice(0,100).map(p=>({name:clean(p.name),sku:clean(p.sku),specification:clean(p.specification),quantity:p.quantity??null,unit:clean(p.unit)||'PCS',suggested_price:p.suggested_price??null,currency:normalizeCurrency(p.currency,currency),moq:p.moq??null,hs_code:clean(p.hs_code),image_url:clean(p.image_url)})).filter(p=>p.name||p.sku);
  }
  function localRecognize(text,{matrix=null,outputLanguage='auto'}={}){
    const detected=detectLanguage(text),matrixFields=fieldsFromMatrix(matrix),email=matrixFields.email||firstMatch(text,/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    const labelledPhone=labelled(text,['Buyer Phone','Customer Phone','Phone','Mobile','WhatsApp','Tel','买方电话','客户电话','电话','手机','Téléphone','Teléfono']);
    const phone=validPhone(matrixFields.phone||labelledPhone||firstMatch(text,/(?:phone|mobile|whatsapp|tel|电话|手机)\s*[:：-]?\s*(\+?\d[\d\s().-]{5,}\d)/i));
    const labelledCompany=labelled(text,['Buyer Company','Customer Company','Company Name','Buyer','Customer','买方公司','客户公司','公司名称','Empresa','Société','Firma','会社']);
    const legalCompany=firstMatch(text,/^([^\n]{2,80}(?:LLC|LTD\.?|LIMITED|INC\.?|CORP\.?|GMBH|S\.A\.?|SAS|BV|CO\.,?\s*LTD\.?))$/im);
    const safeLegalCompany=/^(?:seller|supplier|exporter|vendor|卖方|供应商|出口商)\s*[:：-]/i.test(legalCompany)?'':legalCompany;
    const company=matrixFields.company_name||labelledCompany||safeLegalCompany;
    const contact=matrixFields.contact_name||labelled(text,['Buyer Contact','Customer Contact','Contact Name','Attn','买方联系人','客户联系人','联系人','Nombre de contacto','Contact person']);
    const country=matrixFields.country||labelled(text,['Buyer Country','Customer Country','Country','Region','买方国家','客户国家','国家','国家/地区','País','Pays','Land']);
    const address=matrixFields.address||labelled(text,['Buyer Address','Customer Address','Address','买方地址','客户地址','地址','Dirección','Adresse']);
    const currency=normalizeCurrency(matrixFields.currency||labelled(text,['Currency','币种','Moneda','Devise']),text);
    const tradeTerms=matrixFields.trade_terms||labelled(text,['Incoterm','Trade Terms','贸易术语'])||firstMatch(text,/\b(EXW|FCA|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)\b/i).toUpperCase();
    const payment=matrixFields.payment_terms||labelled(text,['Payment Terms','Payment','付款条件','Condiciones de pago','Conditions de paiement']);
    const delivery=matrixFields.delivery_time||labelled(text,['Delivery Time','Lead Time','交期','交货期','Tiempo de entrega','Délai de livraison']);
    const destination=matrixFields.destination||labelled(text,['Destination','Destination Port','Port','目的地','目的港']);
    const invoiceNo=matrixFields.invoice_no||labelled(text,['Document No.','Document No','Quotation No.','Quotation No','Invoice No.','PI No.','Packing List No.','Contract No.','单据编号','报价单号','形式发票号','商业发票号','装箱单号','合同编号']);
    const issueDate=normalizeDate(matrixFields.issue_date||labelled(text,['Issue Date','Date of Issue','出单日期','签发日期','开票日期']));
    const customerPo=matrixFields.customer_po||labelled(text,['Customer PO','Purchase Order No.','PO No.','客户 PO','客户PO','采购订单号']);
    const originCountry=matrixFields.origin_country||labelled(text,['Country of Origin','Origin Country','原产国']);
    const matrixProducts=productsFromMatrix(matrix),products=matrixProducts.length?matrixProducts:freeTextProducts(text,currency),docType=detectDocType(text),missing=[],warnings=[];
    if(!company&&!contact)missing.push('客户公司或联系人');if(!email&&!phone)missing.push('客户联系方式');if(!products.length)missing.push('商品明细');
    const priceRequired=docType!=='packing_list';products.forEach((p,i)=>{if(p.quantity===null)missing.push(`商品${i+1}数量`);if(priceRequired&&p.suggested_price===null)missing.push(`商品${i+1}单价`);});
    if(detected==='mixed')warnings.push('检测到混合语言，请核对客户名称、地址、规格与贸易条款。');if(matrix&&matrix.length&&!company)warnings.push('未从表格中找到明确的买方信息；系统已避免把卖方资料或单据编号误当成客户信息。');warnings.push('本机快速整理结果必须人工核对；未识别值保持空白，不会自动填为 0 或 1。');
    const recognized=[company,contact,email,phone,country,address,invoiceNo,issueDate,tradeTerms,payment,delivery,destination,...products.flatMap(p=>[p.name,p.sku,p.quantity,p.suggested_price])].filter(v=>v!==''&&v!==null&&v!==undefined).length;
    const possible=12+Math.max(products.length,1)*4,score=Math.max(20,Math.min(96,Math.round(recognized/possible*100)));
    const requirements=clean(text).slice(0,5000),docLanguage=outputLanguage==='auto'?(detected==='zh'?'en':detected==='mixed'?'bilingual':detected):outputLanguage;
    return{version:VERSION,engine:'local_structure',quality:{score,recognized_fields:recognized,source_rows:Array.isArray(matrix)?matrix.length:0,parser:Array.isArray(matrix)&&matrix.length?'document_matrix_v2':'multilingual_text_v2'},source:{type:state.sourceType,name:state.sourceName,received_at:isoNow(),original_text:text,detected_language:detected},customer:{id:'',company_name:company,contact_name:contact,email,phone,country,address,preferred_language:detected==='mixed'?'en':detected,currency,source:'other'},products,deal:{id:'',title:clean(`${company||contact||country||'客户'} ${products[0]?.name||'新询盘'}`),requirements,stage:'new_inquiry',currency,estimated_amount:null,next_action:'核对识别结果并准备报价',next_action_at:today(),risk_notes:missing.length?`待补：${missing.join('、')}`:''},document:{type:docType,language:docLanguage,fields:{currency,invoiceNo,issueDate,customerPo,originCountry,tradeTerms,deliveryTime:delivery,paymentTerms:payment,destinationPort:destination,docLanguage,remarks:'资料由智能录入识别并经用户核对后生成。'}},missing:[...new Set(missing)],warnings};
  }
  function normalizeGatewayResult(payload,input,outputLanguage){
    const root=payload?.result??payload?.output??payload?.response??payload?.raw?.result??payload??{};
    const customer=root.customer||root.buyer||{};const trade=root.trade||root.trade_terms||root.tradeTerms||root.terms||{};const deal=root.deal||root.business||{};const documentInfo=root.document||root.document_intent||{};const source=root.source||{};
    const rawProducts=Array.isArray(root.products)?root.products:(Array.isArray(root.items)?root.items:[]);
    const detected=clean(source.detected_language||root.detected_language||root.language)||detectLanguage(input);const currency=normalizeCurrency(customer.currency||trade.currency||rawProducts[0]?.currency,input);
    return{version:VERSION,engine:'ai_gateway',source:{type:state.sourceType,name:state.sourceName,received_at:source.received_at||isoNow(),original_text:input,detected_language:detected},customer:{id:clean(customer.id||customer.customer_id),company_name:clean(customer.company_name||customer.company||customer.name),contact_name:clean(customer.contact_name||customer.contact||customer.person),email:clean(customer.email),phone:clean(customer.phone||customer.whatsapp),country:clean(customer.country),address:clean(customer.address),preferred_language:clean(customer.preferred_language||customer.language||detected||'en'),currency,source:clean(customer.source)||'other'},products:rawProducts.map(item=>({id:clean(item.id||item.product_id),name:clean(item.name||item.product_name||item.title),sku:clean(item.sku||item.model),specification:clean(item.specification||item.spec||item.description),quantity:nullableNumber(item.quantity??item.qty),unit:clean(item.unit)||'PCS',suggested_price:nullableNumber(item.unit_price??item.price??item.suggested_price),currency:normalizeCurrency(item.currency||currency,input),moq:nullableNumber(item.moq),hs_code:clean(item.hs_code||item.hs),image_url:clean(item.image_url||item.image)})).filter(p=>p.name||p.sku),deal:{id:clean(deal.id||deal.deal_id),title:clean(deal.title)||clean(`${customer.company_name||customer.name||'客户'} ${rawProducts[0]?.name||rawProducts[0]?.product_name||'新询盘'}`),requirements:clean(deal.requirements||deal.summary||input),stage:clean(deal.stage)||'new_inquiry',currency:normalizeCurrency(deal.currency||currency,input),estimated_amount:nullableNumber(deal.estimated_amount),next_action:clean(deal.next_action)||'核对识别结果并准备报价',next_action_at:clean(deal.next_action_at)||today(),risk_notes:clean(deal.risk_notes)},document:{type:clean(documentInfo.type||documentInfo.document_type)||detectDocType(input),language:clean(documentInfo.language||documentInfo.output_language)||(outputLanguage==='auto'?(detected==='zh'?'en':detected==='mixed'?'bilingual':detected):outputLanguage),fields:{invoiceNo:clean(documentInfo.invoice_no||documentInfo.document_no||root.invoice_no),issueDate:normalizeDate(documentInfo.issue_date||root.issue_date),customerPo:clean(documentInfo.customer_po||trade.customer_po),originCountry:clean(documentInfo.origin_country||trade.origin_country),currency,tradeTerms:clean(trade.incoterm||trade.trade_terms||trade.tradeTerms),deliveryTime:clean(trade.delivery_time||trade.deliveryTime),paymentTerms:clean(trade.payment_terms||trade.paymentTerms),destinationPort:clean(trade.destination||trade.destination_port),docLanguage:clean(documentInfo.language)||(outputLanguage==='auto'?(detected==='zh'?'en':detected==='mixed'?'bilingual':detected):outputLanguage),remarks:'资料由AI智能录入识别并经用户核对后生成。'}},missing:Array.isArray(root.missing_fields)?root.missing_fields:(Array.isArray(root.missing)?root.missing:[]),warnings:Array.isArray(root.warnings)?root.warnings:[]};
  }
  async function recognize(input,options={}){
    const ai=window.FlypigBOXAIClient;const snap=ai?.getState?.()||{};
    if(ai&&snap.configured){
      try{const result=await ai.startTask(TASK_TYPE,input,{language:options.outputLanguage||'auto',customerId:options.customerId||'',dealId:options.dealId||'',context:{source_type:state.sourceType,source_name:state.sourceName,matrix_preview:Array.isArray(options.matrix)?options.matrix.slice(0,100):null,workspace_version:VERSION}});return normalizeGatewayResult(result,input,options.outputLanguage||'auto');}
      catch(error){console.warn('Smart Capture AI task unavailable, using local recognition.',error);const local=localRecognize(input,options);local.warnings.unshift('本次已使用本机快速整理；保存前请重点核对。');return local;}
    }
    return localRecognize(input,options);
  }

  function matchCustomer(draft){const list=workspaceState().customers||[];if(draft.id){const byId=list.find(x=>String(x.id)===String(draft.id));if(byId)return byId;}const email=clean(draft.email).toLowerCase(),phone=clean(draft.phone).replace(/\D/g,''),company=clean(draft.company_name).toLowerCase();return list.find(row=>(email&&clean(row.email).toLowerCase()===email)||(phone&&clean(row.phone).replace(/\D/g,'')===phone)||(company&&clean(row.company_name||row.name).toLowerCase()===company))||null;}
  function matchProduct(draft){const list=workspaceState().products||[];if(draft.id){const byId=list.find(x=>String(x.id)===String(draft.id));if(byId)return byId;}const sku=clean(draft.sku).toLowerCase(),name=clean(draft.name).toLowerCase();return list.find(row=>(sku&&clean(row.sku).toLowerCase()===sku)||(name&&clean(row.name).toLowerCase()===name))||null;}
  function mergeEmpty(existing,patch){const out={...existing};Object.entries(patch).forEach(([k,v])=>{if((out[k]===null||out[k]===undefined||clean(out[k])==='')&&v!==null&&v!==undefined&&clean(v)!=='')out[k]=v;});return out;}
  function customerPayload(draft,sourceText){return{customer_kind:'company',name:clean(draft.company_name||draft.contact_name),company_name:clean(draft.company_name)||null,contact_name:clean(draft.contact_name)||null,email:clean(draft.email)||null,phone:clean(draft.phone)||null,country:clean(draft.country)||null,currency:normalizeCurrency(draft.currency,sourceText),preferred_language:clean(draft.preferred_language)==='auto'?null:(clean(draft.preferred_language)||null),source:clean(draft.source)||'other',customer_stage:'lead',requirements:clean(sourceText).slice(0,5000)||null,visible_notes:clean(draft.address)?`客户地址（原文）：${clean(draft.address)}`:null,notes:`智能录入来源：${SOURCE_LABELS[state.sourceType]||state.sourceType}${state.sourceName?`（${state.sourceName}）`:''}\n首次识别：${fmtTime(state.result?.source?.received_at||isoNow())}`};}
  function productPayload(draft){return{name:clean(draft.name||draft.sku),sku:clean(draft.sku)||null,specification:clean(draft.specification)||null,suggested_price:draft.suggested_price===null?null:Number(draft.suggested_price),currency:normalizeCurrency(draft.currency,''),pricing_unit:clean(draft.unit)||'PCS',moq:draft.moq===null?null:Number(draft.moq),hs_code:clean(draft.hs_code)||null,image_url:clean(draft.image_url)||null,source_platform:'智能录入',internal_notes:`智能录入来源：${SOURCE_LABELS[state.sourceType]||state.sourceType}${state.sourceName?`（${state.sourceName}）`:''}`};}
  function dealPayload(draft,customerId){return{customer_id:customerId||null,title:clean(draft.title)||'智能录入询盘',requirements:clean(draft.requirements)||clean(state.sourceText).slice(0,5000),stage:clean(draft.stage)||'new_inquiry',currency:normalizeCurrency(draft.currency,state.sourceText),estimated_amount:draft.estimated_amount===null?null:Number(draft.estimated_amount),next_action:clean(draft.next_action)||'核对资料并准备报价',next_action_at:clean(draft.next_action_at)||today(),risk_notes:clean(draft.risk_notes)||null};}
  async function writeRecord(table,payload,{id='',mode='fill_empty'}={}){
    const sb=client(),u=user();if(!sb||!u)throw new Error('请先登录后保存资料。');const base={...payload,user_id:u.id};
    if(id){let final=base;if(mode==='fill_empty'){const stateMap={customer_records:workspaceState().customers,product_records:workspaceState().products,business_deals:workspaceState().deals};const existing=(stateMap[table]||[]).find(x=>String(x.id)===String(id))||{};final=mergeEmpty(existing,base);delete final.id;delete final.created_at;delete final.updated_at;delete final.deleted_at;}const result=await sb.from(table).update(final).eq('id',id).eq('user_id',u.id).select().single();if(result.error)throw result.error;return result.data||{...final,id};}
    const result=await sb.from(table).insert(base).select().single();if(result.error)throw result.error;return result.data;
  }
  function documentPreviewContext(review){
    const starterItems=(review.products||[])
      .filter(p=>p.includeDocument&&(!genericProductName(p.name)||p.sku||p.quantity!==null&&p.quantity!==undefined||p.suggested_price!==null&&p.suggested_price!==undefined))
      .map(p=>({
        id:p.existingId||'',
        sku:p.sku,
        name:genericProductName(p.name)?'':p.name,
        spec:p.specification,
        qty:p.quantity,
        unit:p.unit,
        price:p.suggested_price,
        currency:p.currency,
        moq:p.moq,
        hs:p.hs_code,
        image:p.image_url
      }));
    return{
      customer:review.customer,
      deal:null,
      starter_items:starterItems,
      starter_fields:{
        ...review.document.fields,
        buyerAddress:review.customer.address||'',
        docLanguage:review.document.language,
        currency:review.document.fields.currency||review.customer.currency||'USD',
        workspaceDocumentNote:`智能录入草稿预览 · ${SOURCE_LABELS[state.sourceType]||state.sourceType}${state.sourceName?` · ${state.sourceName}`:''}`
      }
    };
  }
  function previewCapture(review){
    const readiness=documentReadiness(review);
    if(readiness.blocking.length){
      toast(`草稿仍缺少：${readiness.blocking.join('、')}。可以先预览，并在单据编辑器中继续补充。`,true);
    }
    safeJsonWrite(sessionStorage,RESULT_KEY,{
      review,
      saved:{previewOnly:true,at:isoNow()},
      createdAt:isoNow()
    });
    closeReview();
    workspace()?.prepareDocument?.(
      review.document.type,
      documentPreviewContext(review),
      'smart_capture_preview'
    );
    toast('已生成单据草稿预览；客户、商品、业务和正式单据均未保存。');
    return true;
  }

  async function saveCapture(review,{generate=false}={}){
    if(state.saving)return;state.saving=true;syncSaving(true);try{
      const sb=client(),u=user();if(!sb||!u){
        if(generate&&isLocalPreview()){const starterItems=review.products.filter(p=>p.includeDocument&&(p.name||p.sku)).map(p=>({id:p.existingId||'',sku:p.sku,name:genericProductName(p.name)?'':p.name,spec:p.specification,qty:p.quantity,unit:p.unit,price:p.suggested_price,currency:p.currency,moq:p.moq,hs:p.hs_code,image:p.image_url}));const context={customer:review.customer,deal:null,starter_items:starterItems,starter_fields:{...review.document.fields,buyerAddress:review.customer.address||'',docLanguage:review.document.language,currency:review.document.fields.currency||review.customer.currency||'USD',workspaceDocumentNote:`本地预览智能录入 · ${SOURCE_LABELS[state.sourceType]||state.sourceType}${state.sourceName?` · ${state.sourceName}`:''}`}};state.lastSaved={previewOnly:true,at:isoNow()};safeJsonWrite(sessionStorage,RESULT_KEY,{review,saved:state.lastSaved,createdAt:isoNow()});closeReview();workspace()?.prepareDocument?.(review.document.type,context,'smart_capture_preview');toast('本地预览已带入单据编辑器；客户、商品和业务尚未写入云端。');return;}throw new Error('当前为本地预览或尚未登录。可以预览生成单据；保存客户、商品和业务请打开线上版登录。');}
      let savedCustomer=null,savedDeal=null;const savedProducts=[];
      if(review.saveCustomer&&(review.customer.company_name||review.customer.contact_name||review.customer.email||review.customer.phone)){
        const matched=matchCustomer(review.customer);savedCustomer=await writeRecord('customer_records',customerPayload(review.customer,state.sourceText),{id:review.customerMode==='new'?'':(review.customerExistingId||matched?.id||''),mode:review.customerMode==='overwrite'?'overwrite':'fill_empty'});
      }else if(review.customerExistingId){savedCustomer=(workspaceState().customers||[]).find(x=>String(x.id)===String(review.customerExistingId))||null;}
      for(let productIndex=0;productIndex<review.products.length;productIndex++){const item=review.products[productIndex];if(!item.save||(!item.name&&!item.sku))continue;const matched=matchProduct(item);const saved=await writeRecord('product_records',productPayload(item),{id:item.mode==='new'?'':(item.existingId||matched?.id||''),mode:item.mode==='overwrite'?'overwrite':'fill_empty'});savedProducts.push({...saved,_capture:item,_captureIndex:productIndex});}
      if(review.saveDeal){savedDeal=await writeRecord('business_deals',dealPayload(review.deal,savedCustomer?.id||review.customerExistingId||null),{id:review.dealMode==='new'?'':(review.dealExistingId||''),mode:review.dealMode==='overwrite'?'overwrite':'fill_empty'});
        if(savedDeal?.id&&savedProducts.length){for(const p of savedProducts){const quantity=p._capture?.quantity??null,price=p._capture?.suggested_price??null;const existing=await sb.from('deal_products').select('id').eq('user_id',u.id).eq('deal_id',savedDeal.id).eq('product_id',p.id).maybeSingle();if(existing.error&&!/0 rows|multiple/i.test(existing.error.message||''))console.warn('deal product duplicate check failed',existing.error);if(!existing.data){const linked=await sb.from('deal_products').insert({user_id:u.id,deal_id:savedDeal.id,product_id:p.id,product_snapshot:{name:p.name||'',sku:p.sku||'',specification:p.specification||''},quantity,unit:p._capture?.unit||p.pricing_unit||'PCS',quoted_price:price,currency:p._capture?.currency||p.currency||review.document.fields.currency||'USD'});if(linked.error)console.warn('Unable to link captured product to deal',linked.error);}}}
      }
      state.lastSaved={customer:savedCustomer,products:savedProducts,deal:savedDeal,at:isoNow()};
      try{const audit=await sb.from('smart_capture_sessions').insert({user_id:u.id,source_type:state.sourceType,source_name:state.sourceName||null,original_text:state.sourceText,detected_language:state.result?.source?.detected_language||null,output_language:review.document.language,status:'confirmed',normalized_result:review,customer_id:savedCustomer?.id||review.customerExistingId||null,deal_id:savedDeal?.id||review.dealExistingId||null,product_ids:savedProducts.map(p=>p.id).filter(Boolean),document_type:review.document.type,confirmed_at:isoNow()});if(audit.error&&!/does not exist|schema cache/i.test(audit.error.message||''))console.warn('Smart Capture audit insert failed',audit.error);}catch(error){console.warn('Smart Capture audit table unavailable',error);}
      await workspace()?.refresh?.();decorateTimestamps();toast(`已保存${[savedCustomer?'客户':'',savedProducts.length?`${savedProducts.length}个商品`:'',savedDeal?'业务':''].filter(Boolean).join('、')||'核对结果'}。`);
      if(generate){const customerForDocument=savedCustomer?{...savedCustomer,address:review.customer.address||savedCustomer.address||''}:review.customer;const starterItems=review.products.map((p,index)=>{if(!p.includeDocument)return null;const saved=savedProducts.find(item=>item._captureIndex===index);return{id:saved?.id||p.existingId||'',sku:p.sku,name:genericProductName(p.name)?'':p.name,spec:p.specification,qty:p.quantity,unit:p.unit,price:p.suggested_price,currency:p.currency,moq:p.moq,hs:p.hs_code,image:p.image_url};}).filter(Boolean);const context={customer:customerForDocument,deal:savedDeal||null,starter_items:starterItems,starter_fields:{...review.document.fields,buyerAddress:review.customer.address||'',docLanguage:review.document.language,currency:review.document.fields.currency||review.customer.currency||'USD',workspaceDocumentNote:`智能录入 · ${SOURCE_LABELS[state.sourceType]||state.sourceType}${state.sourceName?` · ${state.sourceName}`:''}`}};safeJsonWrite(sessionStorage,RESULT_KEY,{review,saved:state.lastSaved,createdAt:isoNow()});closeReview();workspace()?.prepareDocument?.(review.document.type,context,'smart_capture');return;}
      closeReview();clearDraft();
    }catch(error){console.error('Smart Capture save failed',error);toast(error?.message||'智能资料保存失败，请检查账号与数据库字段。',true);syncSaving(false);}finally{state.saving=false;}
  }

  function field(label,name,value='',type='text',extra=''){return`<label><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;}
  function textarea(label,name,value='',extra=''){return`<label class="full"><span>${esc(label)}</span><textarea name="${esc(name)}" ${extra}>${esc(value??'')}</textarea></label>`;}
  function select(label,name,options,current='',extra=''){return`<label><span>${esc(label)}</span><select name="${esc(name)}" ${extra}>${Object.entries(options).map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;}
  function customerOptions(current=''){const rows=workspaceState().customers||[];return{'':'不关联已有客户',...Object.fromEntries(rows.map(x=>[x.id,x.company_name||x.name||x.contact_name||'未命名客户']))};}
  function dealOptions(current=''){const rows=workspaceState().deals||[];return{'':'新建业务',...Object.fromEntries(rows.map(x=>[x.id,x.title||'未命名业务']))};}
  function productOptions(current=''){const rows=workspaceState().products||[];return{'':'新建商品',...Object.fromEntries(rows.map(x=>[x.id,`${x.name||'未命名商品'}${x.sku?` · ${x.sku}`:''}`]))};}
  function productMarkup(p,index){const match=matchProduct(p);const mode=match?'fill_empty':'new';return`<article class="fp-sc-product" data-fp-sc-product data-fp-sc-index="${index}"><div class="fp-sc-product-head"><label class="fp-sc-check"><input type="checkbox" name="product_save_${index}"> 保存到商品库</label><label class="fp-sc-check"><input type="checkbox" name="product_doc_${index}" checked> 带入单据</label><button type="button" data-fp-sc-remove-product>删除</button></div><div class="fp-sc-grid">${select('匹配已有商品',`product_existing_${index}`,productOptions(match?.id||''),match?.id||'')}${select('保存方式',`product_mode_${index}`,{new:'新建商品',fill_empty:'只补充空字段',overwrite:'用核对值更新'},mode)}${field('商品名称',`product_name_${index}`,p.name)}${field('SKU / 型号',`product_sku_${index}`,p.sku)}${textarea('规格 / 描述',`product_spec_${index}`,p.specification)}${field('数量',`product_qty_${index}`,p.quantity??'','number','min="0" step="any" placeholder="未识别时保持空白"')}${field('单位',`product_unit_${index}`,p.unit||'PCS')}${field('单价',`product_price_${index}`,p.suggested_price??'','number','min="0" step="any" placeholder="未识别时保持空白"')}${field('币种',`product_currency_${index}`,p.currency||'USD')}${field('MOQ',`product_moq_${index}`,p.moq??'','number','min="0" step="any"')}${field('HS Code',`product_hs_${index}`,p.hs_code)}${field('图片地址',`product_image_${index}`,p.image_url,'url')}</div></article>`;}
  function genericProductName(value){const text=clean(value).replace(/^[、,，;；:：\-\s]+/,'');return /^(?:产品|商品|货物|item|product|待确认商品|未命名商品|订单|正式单据|订单或正式单据|单据|客户资料|商品资料|业务资料)$/i.test(text);}
  function documentReadiness(review){
    const customer=review?.customer||{},products=(review?.products||[]).filter(p=>p?.includeDocument!==false);
    const first=products[0]||{},docType=review?.document?.type||'quotation';
    const checks=[
      ['客户名称',Boolean(clean(customer.company_name||customer.contact_name))],
      ['商品名称',Boolean(clean(first.name)&&!genericProductName(first.name))],
      ['数量',first.quantity!==null&&first.quantity!==undefined&&Number.isFinite(Number(first.quantity))],
      ['币种',Boolean(clean(review?.document?.fields?.currency||first.currency||customer.currency))],
      ['单价',docType==='packing_list'||(first.suggested_price!==null&&first.suggested_price!==undefined&&Number.isFinite(Number(first.suggested_price)))]
    ];
    const blocking=checks.filter(([,ok])=>!ok).map(([label])=>label);
    const recognized=checks.length-blocking.length;
    const recommended=[];
    if(!clean(customer.email||customer.phone))recommended.push('客户联系方式');
    if(!clean(first.sku))recommended.push('商品SKU');
    if(!clean(first.specification))recommended.push('商品规格');
    if(!clean(review?.document?.fields?.paymentTerms))recommended.push('付款方式');
    if(!clean(review?.document?.fields?.deliveryTime))recommended.push('交货期');
    if(!clean(review?.document?.fields?.tradeTerms))recommended.push('贸易条款');
    return{recognized,total:checks.length,score:Math.round(recognized/checks.length*100),blocking,recommended:[...new Set(recommended)]};
  }
  function ensureReview(){let d=$('#fp-smart-capture-review');if(d)return d;d=document.createElement('dialog');d.id='fp-smart-capture-review';d.className='modal wide fp-sc-dialog';d.innerHTML=`<form class="dialog" id="fp-smart-capture-review-form"><header><div><p>智能资料核对</p><h2>确认分类、关联和保存方式</h2><span>任何写入客户库、商品库、业务库或单据的数据都在这里显示；不会静默覆盖已有资料。</span></div><button type="button" class="close" data-fp-sc-close aria-label="关闭">×</button></header><div class="fp-sc-review-body"><div class="fp-sc-source-summary" data-fp-sc-source-summary></div><section><div class="fp-sc-section-head"><div><h3>客户资料</h3><p>支持匹配已有客户，新建或只补充空字段。</p></div><label class="fp-sc-check"><input type="checkbox" name="save_customer"> 保存客户资料</label></div><div class="fp-sc-grid" data-fp-sc-customer></div></section><section><div class="fp-sc-section-head"><div><h3>商品资料</h3><p>数量、价格未识别时保持空白，不再自动填 1 或 0。</p></div><button type="button" class="btn secondary" data-fp-sc-add-product>＋ 添加商品</button></div><div class="fp-sc-products" data-fp-sc-products></div></section><section><div class="fp-sc-section-head"><div><h3>业务归档</h3><p>保存后建立客户、商品和业务的真实关联。</p></div><label class="fp-sc-check"><input type="checkbox" name="save_deal"> 保存业务记录</label></div><div class="fp-sc-grid" data-fp-sc-deal></div></section><section><div class="fp-sc-section-head"><div><h3>单据生成</h3><p>选择单据类型和输出语言，先进入准备页预览核对，再保存和导出。</p></div></div><div class="fp-sc-grid" data-fp-sc-document></div></section><div class="fp-sc-alerts"><article><b>缺失资料</b><span data-fp-sc-missing></span></article><article><b>风险与提醒</b><span data-fp-sc-warnings></span></article></div></div><footer><button type="button" class="btn ghost" data-fp-sc-close>稍后处理</button><button type="button" class="btn secondary" data-fp-sc-preview-draft>预览单据草稿</button><button type="submit" class="btn secondary" data-fp-sc-save-only>仅保存资料</button><button type="submit" class="btn primary" data-fp-sc-save-generate>确认保存并生成</button></footer></form>`;document.body.appendChild(d);return d;}
  function openReview(result){
    if(Array.isArray(result.products))result.products=result.products.map(product=>({...product,name:genericProductName(product?.name)?'待确认商品':clean(product?.name)}));
    state.result=result;
    if(clean(result?.source?.original_text))state.sourceText=clean(result.source.original_text);
    if(clean(result?.source?.type))state.sourceType=clean(result.source.type);
    if(clean(result?.source?.name))state.sourceName=clean(result.source.name);
    safeJsonWrite(sessionStorage,RESULT_KEY,result);
    const d=ensureReview(),customer=result.customer||{},match=matchCustomer(customer),ready=documentReadiness(result);
    const saveCustomer=$('[name="save_customer"]',d),saveDeal=$('[name="save_deal"]',d);
    if(saveCustomer)saveCustomer.checked=false;if(saveDeal)saveDeal.checked=false;
    const engineLabel=({local_fast:'本机快速整理',local_structure:'本机快速整理',session_cache:'复用本次结果',smart_service:'智能整理',founder_os:'智能整理',ai_gateway:'智能整理'})[result.engine]||'本机快速整理';
    const usageLabel=['local_fast','local_structure','session_cache'].includes(result.engine)?' · 未使用智能额度':'';
    $('[data-fp-sc-source-summary]',d).innerHTML=`<b>${esc(SOURCE_LABELS[result.source?.type]||result.source?.type||'资料')}</b><span>${esc(result.source?.name||'本次处理')} · 原始资料语言：${esc(LANGUAGES[result.source?.detected_language]||result.source?.detected_language||'自动识别')} · 处理方式：${engineLabel}${usageLabel} · 关键内容 ${ready.recognized}/${ready.total} · 开单完整度 ${ready.score}%</span><small>接收时间：${esc(fmtTime(result.source?.received_at))}</small>`;
    $('[data-fp-sc-customer]',d).innerHTML=`${select('匹配已有客户','customer_existing_id',customerOptions(match?.id||''),match?.id||'')}${select('保存方式','customer_mode',{new:'新建客户',fill_empty:'只补充空字段',overwrite:'用核对值更新'},match?'fill_empty':'new')}${field('客户公司','company_name',customer.company_name)}${field('联系人','contact_name',customer.contact_name)}${field('邮箱','email',customer.email,'email')}${field('电话 / WhatsApp','phone',customer.phone)}${field('国家 / 地区','country',customer.country)}${textarea('地址（保留原文）','address',customer.address)}${select('客户常用语言','preferred_language',CUSTOMER_LANGUAGES,customer.preferred_language||'auto')}${field('默认币种','customer_currency',customer.currency||'USD')}`;
    $('[data-fp-sc-products]',d).innerHTML=(result.products?.length?result.products:[{name:'',quantity:null,suggested_price:null,unit:'PCS',currency:customer.currency||'USD'}]).map(productMarkup).join('');
    const deal=result.deal||{};$('[data-fp-sc-deal]',d).innerHTML=`${select('匹配已有业务','deal_existing_id',dealOptions(deal.id||''),deal.id||'')}${select('保存方式','deal_mode',{new:'新建业务',fill_empty:'只补充空字段',overwrite:'用核对值更新'},deal.id?'fill_empty':'new')}${field('业务标题','deal_title',deal.title)}${select('业务阶段','deal_stage',DEAL_STAGES,deal.stage||'new_inquiry')}${field('币种','deal_currency',deal.currency||customer.currency||'USD')}${field('预计金额','deal_amount',deal.estimated_amount??'','number','min="0" step="any"')}${field('下一步动作','deal_next_action',deal.next_action)}${field('下一步日期','deal_next_date',deal.next_action_at||today(),'date')}${textarea('客户需求 / 原始询盘摘要','deal_requirements',deal.requirements)}${textarea('风险与内部提醒','deal_risk',deal.risk_notes)}`;
    const doc=result.document||{};$('[data-fp-sc-document]',d).innerHTML=`${select('单据类型','document_type',DOC_TYPES,doc.type||'quotation')}${select('输出语言','document_language',LANGUAGES,doc.language||'en')}${field('单据编号','invoice_no',doc.fields?.invoiceNo)}${field('出单日期','issue_date',doc.fields?.issueDate||today(),'date')}${field('币种','document_currency',doc.fields?.currency||customer.currency||'USD')}${field('客户 PO','customer_po',doc.fields?.customerPo)}${field('原产国','origin_country',doc.fields?.originCountry)}${field('贸易术语','trade_terms',doc.fields?.tradeTerms)}${field('交货期','delivery_time',doc.fields?.deliveryTime)}${field('目的地 / 目的港','destination',doc.fields?.destinationPort)}${textarea('付款条件','payment_terms',doc.fields?.paymentTerms)}${textarea('单据备注','document_remarks',doc.fields?.remarks)}`;
    $('[data-fp-sc-missing]',d).textContent=(result.missing||[]).map(x=>typeof x==='string'?x:(x.label||x.field||JSON.stringify(x))).join('；')||'未发现明确缺失项';$('[data-fp-sc-warnings]',d).textContent=(result.warnings||[]).map(x=>typeof x==='string'?x:(x.message||x.label||JSON.stringify(x))).join('；')||'请人工核对全部识别结果。';
    if(workspace()?.openWorkspaceDialog)workspace().openWorkspaceDialog(d);else d.showModal();
  }
  function closeReview(){const d=$('#fp-smart-capture-review');if(!d)return;if(workspace()?.closeWorkspaceDialog)workspace().closeWorkspaceDialog(d);else d.close();}
  function formReview(form){const fd=new FormData(form);const rows=$$('[data-fp-sc-product]',form);return{saveCustomer:fd.get('save_customer')==='on',customerExistingId:clean(fd.get('customer_existing_id')),customerMode:clean(fd.get('customer_mode'))||'new',customer:{company_name:clean(fd.get('company_name')),contact_name:clean(fd.get('contact_name')),email:clean(fd.get('email')),phone:clean(fd.get('phone')),country:clean(fd.get('country')),address:clean(fd.get('address')),preferred_language:clean(fd.get('preferred_language'))||'auto',currency:clean(fd.get('customer_currency'))||'USD',source:'other'},products:rows.map(row=>{const index=Number(row.dataset.fpScIndex||0);return{save:fd.get(`product_save_${index}`)==='on',includeDocument:fd.get(`product_doc_${index}`)==='on',existingId:clean(fd.get(`product_existing_${index}`)),mode:clean(fd.get(`product_mode_${index}`))||'new',name:clean(fd.get(`product_name_${index}`)),sku:clean(fd.get(`product_sku_${index}`)),specification:clean(fd.get(`product_spec_${index}`)),quantity:nullableNumber(fd.get(`product_qty_${index}`)),unit:clean(fd.get(`product_unit_${index}`))||'PCS',suggested_price:nullableNumber(fd.get(`product_price_${index}`)),currency:clean(fd.get(`product_currency_${index}`))||'USD',moq:nullableNumber(fd.get(`product_moq_${index}`)),hs_code:clean(fd.get(`product_hs_${index}`)),image_url:clean(fd.get(`product_image_${index}`))}}),saveDeal:fd.get('save_deal')==='on',dealExistingId:clean(fd.get('deal_existing_id')),dealMode:clean(fd.get('deal_mode'))||'new',deal:{title:clean(fd.get('deal_title')),stage:clean(fd.get('deal_stage'))||'new_inquiry',currency:clean(fd.get('deal_currency'))||'USD',estimated_amount:nullableNumber(fd.get('deal_amount')),next_action:clean(fd.get('deal_next_action')),next_action_at:clean(fd.get('deal_next_date'))||today(),requirements:clean(fd.get('deal_requirements')),risk_notes:clean(fd.get('deal_risk'))},document:{type:clean(fd.get('document_type'))||'quotation',language:clean(fd.get('document_language'))||'en',fields:{invoiceNo:clean(fd.get('invoice_no')),issueDate:clean(fd.get('issue_date'))||today(),customerPo:clean(fd.get('customer_po')),originCountry:clean(fd.get('origin_country')),currency:clean(fd.get('document_currency'))||'USD',tradeTerms:clean(fd.get('trade_terms')),deliveryTime:clean(fd.get('delivery_time')),destinationPort:clean(fd.get('destination')),paymentTerms:clean(fd.get('payment_terms')),remarks:clean(fd.get('document_remarks'))}}};}
  function syncSaving(on){const d=$('#fp-smart-capture-review');if(!d)return;$$('button',d).forEach(b=>b.disabled=on);const primary=$('[data-fp-sc-save-generate]',d);if(primary)primary.textContent=on?'正在保存…':'确认保存并生成';}

  async function fileToInput(file){if(!file)return;const ext=(file.name.split('.').pop()||'').toLowerCase();state.sourceName=file.name;state.sourceType=ext==='xlsx'?'xlsx':ext==='csv'?'csv':ext==='tsv'?'tsv':'txt';state.matrix=null;
    if(ext==='xlsx'){if(!window.FlypigBOXXlsxLite?.readFile)throw new Error('当前页面未加载Excel读取器。');const result=await window.FlypigBOXXlsxLite.readFile(file);state.matrix=result.matrix;state.sourceText=window.FlypigBOXXlsxLite.matrixToText(result.matrix);}
    else{const text=await file.text();state.sourceText=text;state.matrix=(ext==='csv'||ext==='tsv')?parseDelimited(text,ext==='tsv'?'\t':','):null;}
    saveDraft();const input=$('[data-fp-sc-input]');if(input)input.value=state.sourceText;const label=$('[data-fp-sc-file-label]');if(label)label.textContent=`已读取：${file.name}`;
    return{text:state.sourceText,matrix:state.matrix,sourceType:state.sourceType,sourceName:state.sourceName};
  }
  function ensureCenter(){
    const old=document.querySelector('#fp-smart-capture-center');
    if(old){old.hidden=true;old.setAttribute('aria-hidden','true');}
    return null;
  }
  function hydrateCenter(){}
  function openCapture(){
    const nav=$('[data-view="ai"]');nav?.click();
    setTimeout(()=>{
      const panel=document.querySelector('#fp-founder-os-task-panel');
      panel?.scrollIntoView({behavior:'smooth',block:'start'});
      panel?.querySelector('[name="os_task_text"]')?.focus();
    },120);
  }
  function installEntryButtons(){const top=$('.topbar-actions');if(top&&!$('[data-fp-sc-open]',top)){const b=document.createElement('button');b.type='button';b.className='btn secondary fp-sc-entry';b.dataset.fpScOpen='1';b.textContent='智能录入';top.prepend(b);}const quick=$('.home-action-grid');if(quick&&!$('[data-fp-sc-open]',quick)){const article=document.createElement('article');article.className='fp-sc-home-entry';article.innerHTML='<b>智能录入资料</b><span>粘贴客户、商品、询盘或单据内容，核对后分类保存并生成单据。</span><button class="btn primary" type="button" data-fp-sc-open>开始智能录入</button>';quick.prepend(article);}}
  function decorateTimestamps(){const s=workspaceState();const groups=[{root:'#customer-list',rows:s.customers||[],find:(root,id)=>$(`[data-open-customer="${id}"]`,root)||$(`[data-edit="customer"][data-id="${id}"]`,root)},{root:'#product-list',rows:s.products||[],find:(root,id)=>$(`[data-edit="product"][data-id="${id}"]`,root)},{root:'#deal-list',rows:s.deals||[],find:(root,id)=>$(`[data-open-deal="${id}"]`,root)||$(`[data-edit="deal"][data-id="${id}"]`,root)}];groups.forEach(group=>{const root=$(group.root);if(!root)return;group.rows.forEach(row=>{const id=cssEscape(String(row.id));const button=group.find(root,id);const card=button?.closest('.table-row,.product-card,.card,.deal-card');if(!card||$('.fp-sc-time-meta',card))return;const meta=document.createElement('small');meta.className='fp-sc-time-meta';meta.textContent=`创建：${fmtTime(row.created_at)} · 修改：${fmtTime(row.updated_at)}`;(card.querySelector('.row-actions,.card-actions')||card).insertAdjacentElement('beforebegin',meta);});});}
  function bind(){document.addEventListener('click',event=>{if(event.target.closest('[data-fp-sc-preview-draft]')){const form=$('#fp-smart-capture-review-form');if(form)return previewCapture(formReview(form));}if(event.target.closest('[data-fp-sc-open]'))return openCapture();if(event.target.closest('[data-fp-sc-clear]')){clearDraft();const input=$('[data-fp-sc-input]');if(input)input.value='';const label=$('[data-fp-sc-file-label]');if(label)label.textContent='支持 TXT、CSV、TSV、XLSX';return;}if(event.target.closest('[data-fp-sc-close]'))return closeReview();if(event.target.closest('[data-fp-sc-add-product]')){const host=$('[data-fp-sc-products]');const indexes=$$('[data-fp-sc-product]',host).map(row=>Number(row.dataset.fpScIndex||0));const index=indexes.length?Math.max(...indexes)+1:0;host?.insertAdjacentHTML('beforeend',productMarkup({name:'',quantity:null,suggested_price:null,unit:'PCS',currency:'USD'},index));return;}const remove=event.target.closest('[data-fp-sc-remove-product]');if(remove)return remove.closest('[data-fp-sc-product]')?.remove();},true);
    document.addEventListener('input',event=>{if(event.target.matches('[data-fp-sc-input]')){state.sourceText=event.target.value;state.sourceType='paste';state.sourceName='';saveDraft();}},true);
    document.addEventListener('change',async event=>{if(event.target.matches('[data-fp-sc-file]')){try{await fileToInput(event.target.files?.[0]);}catch(error){toast(error.message||'文件读取失败。',true);event.target.value='';}}},true);
    document.addEventListener('submit',async event=>{if(event.target.id==='fp-smart-capture-form'){event.preventDefault();const fd=new FormData(event.target);const input=clean(fd.get('input')||state.sourceText);if(input.length<2){toast('请先粘贴资料或上传文件。',true);return;}state.sourceText=input;saveDraft();const button=$('[data-fp-sc-recognize]',event.target);if(button){button.disabled=true;button.textContent='正在识别…';}try{const result=await recognize(input,{matrix:state.matrix,outputLanguage:clean(fd.get('language'))||'auto'});openReview(result);}catch(error){console.error(error);toast(error.message||'识别失败，请稍后重试。',true);}finally{if(button){button.disabled=false;button.textContent='识别并核对';}}return;}if(event.target.id==='fp-smart-capture-review-form'){event.preventDefault();const review=formReview(event.target);const generate=Boolean(event.submitter?.matches('[data-fp-sc-save-generate]'));return saveCapture(review,{generate});}},true);}
  function observe(){const ai=$('#ai-workbench-view');if(ai){let raf=0;new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{ensureCenter();const old=$('#fp-ai-live-center',ai);if(old)old.hidden=true;});}).observe(ai,{childList:true,subtree:true});}let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{installEntryButtons();decorateTimestamps();},80);}).observe(document.body,{childList:true,subtree:true});}
  function boot(){ensureCenter();ensureReview();installEntryButtons();bind();observe();setTimeout(decorateTimestamps,600);const params=new URLSearchParams(location.search);if(params.get('smartCapture')==='1'||params.get('aiTask')==='inquiry')setTimeout(openCapture,300);}
  window.FlypigBOXSmartCapture=Object.freeze({
    version:VERSION,
    open:openCapture,
    recognizeLocal:(text,options={})=>localRecognize(text,options),
    recognize,
    openReview,
    saveReviewed:(review,options={})=>saveCapture(review,options),
    reviewFromForm:form=>formReview(form||$('#fp-smart-capture-review-form')),
    previewReviewed:review=>previewCapture(review),
    readiness:review=>documentReadiness(review),
    loadFile:file=>fileToInput(file),
    getState:()=>({...state}),
    decorateTimestamps
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
