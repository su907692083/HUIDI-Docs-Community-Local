/* HUIDI V9.0 — Integrated Template Center + PDF Brand Studio
   Public examples are embedded intentionally. Private, team and Vault templates
   are still requested only through the authorized Edge Function. */
(() => {
  'use strict';

  const cfg = window.FLYPIGBOX_TEMPLATE_CENTER_CONFIG || {};
  const isLocalPreview = cfg.localPreview === true || location.protocol === 'file:' || new URLSearchParams(location.search).get('localPreview') === '1';
  const tierLabel = value => ({ guest: '游客', free: '免费版', trial: '试用版', vip: '专业版', pro: '专业版', team: '团队版', ultimate: '定制版', admin: '管理员' }[String(value || '').toLowerCase()] || String(value || '游客'));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[char]));

  const DOC_TYPES = [
    ['proforma_invoice', '形式发票（PI）'],
    ['quotation', '报价单'],
    ['commercial_invoice', '商业发票'],
    ['sales_contract', '销售合同'],
    ['packing_list', '装箱单'],
    ['clause', '交易条款'],
    ['knowledge_note', '行业知识笔记'],
    ['checklist', '业务核对清单']
  ];

  const DOC_LABEL = Object.fromEntries(DOC_TYPES);
  const DOC_PROFILE_TYPES = new Set(['proforma_invoice', 'quotation', 'commercial_invoice', 'sales_contract', 'packing_list']);
  const VIP_BRAND_TIERS = new Set(['vip', 'team', 'ultimate', 'admin']);

  const CATEGORIES = [
    ['all', '全部'],
    ['style', 'PDF 样式'],
    ['document', '单据类型'],
    ['knowledge', '行业知识笔记'],
    ['clause', '交易条款'],
    ['checklist', '业务清单']
  ];

  const PUBLIC_TEMPLATE_CATEGORIES = CATEGORIES.filter(([id]) => id !== 'style');

  const LIBRARY_TEMPLATE_CATEGORIES = [
    ['all', '全部模板'],
    ['document', '完整单据 / 快捷字段'],
    ['clause', '常用条款 / 说明'],
    ['knowledge', '业务资料']
  ];

  const FIELD_DEFS = {
    sellerName: ['卖方公司名称', '例如：HUIDI TRADING CO., LTD.'],
    sellerContact: ['卖方联系人', '例如：Sales Department'],
    sellerEmail: ['卖方邮箱', '例如：sales@example.com'],
    sellerTaxId: ['卖方税号 / VAT / EORI', '例如：统一社会信用代码、VAT No. 或 EORI'],
    buyerName: ['默认买方公司（可选）', '例如：ABC IMPORTS LLC'],
    buyerCountry: ['默认买方国家（可选）', '例如：United States'],
    buyerTaxId: ['买方税号 / VAT / EORI', '例如：客户 VAT、EORI 或 Tax ID'],
    originCountry: ['原产地（英文）', '例如：China'],
    paymentTerms: ['付款条款（英文原文）', '例如：30% deposit, 70% balance before shipment.'],
    tradeTerms: ['贸易术语（英文原文）', '例如：FOB Ningbo, Incoterms® 2020'],
    deliveryTime: ['交货期（英文原文）', '例如：20–25 days after receiving deposit.'],
    shippingMethod: ['运输方式（英文原文）', '例如：By sea'],
    portOfLoading: ['起运港（英文名称）', '例如：Ningbo, China'],
    destinationPort: ['目的港（英文名称）', '例如：Los Angeles, USA'],
    packageCount: ['箱数', '例如：12'],
    packageType: ['包装方式（英文）', '例如：Cartons'],
    netWeight: ['净重（KG）', '例如：120'],
    grossWeight: ['毛重（KG）', '例如：145'],
    cbm: ['体积（CBM）', '例如：1.20'],
    shippingMarks: ['唛头 / 包装标识（英文）', '例如：ABC IMPORTS / PO-2026-001'],
    remarks: ['备注 / 补充条款（英文原文）', '例如：All bank charges outside China are for buyer’s account.']
  };

  const TYPE_FIELD_KEYS = {
    proforma_invoice: ['sellerName', 'sellerTaxId', 'buyerName', 'buyerTaxId', 'paymentTerms', 'tradeTerms', 'deliveryTime', 'shippingMethod', 'portOfLoading', 'destinationPort', 'remarks'],
    quotation: ['sellerName', 'buyerName', 'buyerCountry', 'paymentTerms', 'deliveryTime', 'shippingMethod', 'destinationPort', 'remarks'],
    commercial_invoice: ['sellerName', 'sellerTaxId', 'buyerName', 'buyerTaxId', 'originCountry', 'shippingMethod', 'portOfLoading', 'destinationPort', 'shippingMarks', 'remarks'],
    sales_contract: ['sellerName', 'sellerTaxId', 'buyerName', 'buyerTaxId', 'paymentTerms', 'tradeTerms', 'deliveryTime', 'remarks'],
    packing_list: ['sellerName', 'buyerName', 'shippingMethod', 'packageCount', 'packageType', 'netWeight', 'grossWeight', 'cbm', 'shippingMarks'],
    clause: ['paymentTerms', 'tradeTerms', 'deliveryTime', 'remarks'],
    knowledge_note: [],
    checklist: []
  };

  const BRAND_THEMES = {
    business_blue: { label: '标准商务蓝', color: '#0f7bdc', note: '适合 PI、报价单与日常商务单据' },
    minimal_black: { label: '极简黑白', color: '#1b1f26', note: '适合合同、商业发票与装箱单' },
    navy_gold: { label: '深海蓝金', color: '#173b69', note: '适合品牌报价与高端商务场景' },
    fragrance_ivory: { label: '高端美妆 / 香水', color: '#9a6a4b', note: '适合美妆、香水与礼盒类报价' },
    fashion_sage: { label: '时尚服饰', color: '#5d7c6e', note: '适合服饰、配饰与生活方式品牌' },
    clearance_clean: { label: '无 Logo 清关版', color: '#2f5f86', note: '适合商业发票与装箱单清晰输出' }
  };

  const PDF_STYLES = {
    classic_business: { label: '商务标准模板', note: '标准外贸单据版式，信息卡片、表格、金额和签署区均衡排列。' },
    minimal_trade: { label: '极简黑白模板', note: '黑白打印友好，使用账单式信息条和低装饰表格，适合正式往来。' },
    formal_contract: { label: '正式合同模板', note: '强化合同标题、条款顺序和签署区，销售合同会呈现合同文书结构。' },
    brand_showcase: { label: '品牌展示模板', note: '使用提案式左右分栏、摘要卡和品牌标题区，报价单变化最明显。' },
    customs_clean: { label: '清关报关模板', note: '使用报关/装箱核对式结构，强化申报、运输、箱规和表格边界。' }
  };
  const PDF_PAPER_SPECS = {
    classic_business: { format: 'a4', orientation: 'p', widthMm: 210, heightMm: 297, label: 'A4 Portrait' },
    minimal_trade: { format: 'a4', orientation: 'p', widthMm: 210, heightMm: 297, label: 'A4 Portrait' },
    formal_contract: { format: 'a4', orientation: 'p', widthMm: 210, heightMm: 297, label: 'A4 Portrait' },
    brand_showcase: { format: 'a4', orientation: 'l', widthMm: 297, heightMm: 210, label: 'A4 Landscape' },
    customs_clean: { format: 'a4', orientation: 'p', widthMm: 210, heightMm: 297, label: 'A4 Portrait' }
  };
  const FREE_DEFAULT_PDF_STYLE = 'classic_business';

  const PUBLIC_DEMOS = [
    demo('pub_pi_general', '通用英文形式发票（PI）', 'document', 'proforma_invoice', ['通用外贸'], ['全球'], ['通用产品'],
      '适合首次创建英文 PI。包含常见付款、交期、运输与港口字段。',
      { paymentTerms: '30% T/T deposit, 70% balance before shipment.', tradeTerms: 'FOB Ningbo, Incoterms® 2020', deliveryTime: '20–25 days after receiving deposit.', shippingMethod: 'By sea', portOfLoading: 'Ningbo, China', remarks: 'All bank charges outside China are for buyer’s account.' }),
    demo('pub_quote_fashion', '服饰出口报价单', 'document', 'quotation', ['服饰与配饰'], ['美国', '法国'], ['女装', '连衣裙'],
      '适合服饰类客户初次报价与样品确认。',
      { paymentTerms: '30% deposit before production, 70% balance before shipment.', deliveryTime: '30–35 days after sample approval.', shippingMethod: 'By sea or air upon buyer’s request.', destinationPort: 'Los Angeles, USA', remarks: 'MOQ and color assortment are subject to final confirmation.' }),
    demo('pub_quote_fragrance', '香水礼盒报价单', 'document', 'quotation', ['美妆与香水'], ['法国', '阿联酋'], ['香水礼盒', '节日礼品'],
      '适合香水、香氛及礼盒类产品的英文报价。',
      { paymentTerms: '50% deposit before production, 50% balance before shipment.', deliveryTime: '35–45 days after artwork approval.', shippingMethod: 'By air or by sea.', remarks: 'Packaging artwork and labeling must be approved by buyer before mass production.' }),
    demo('pub_pi_home', '家居用品出口 PI', 'document', 'proforma_invoice', ['家居生活'], ['美国', '德国'], ['收纳用品', '家居用品'],
      '适合家居、收纳与日用产品的标准 PI。',
      { paymentTerms: '30% T/T deposit, 70% balance against copy of B/L.', tradeTerms: 'FOB Shanghai, Incoterms® 2020', deliveryTime: '25–30 days after receiving deposit.', shippingMethod: 'By sea', portOfLoading: 'Shanghai, China', remarks: 'Product dimensions and carton marks are subject to final confirmation.' }),
    demo('pub_ci_standard', '通用商业发票资料模板', 'document', 'commercial_invoice', ['通用外贸'], ['全球'], ['通用产品'],
      '用于发货前核对商业发票中的原产地、运输与唛头信息。',
      { originCountry: 'China', shippingMethod: 'By sea', portOfLoading: 'Ningbo, China', destinationPort: 'Los Angeles, USA', shippingMarks: 'ABC IMPORTS / PO-2026-001', remarks: 'Commercial invoice values must match the final shipment and customs declaration.' }),
    demo('pub_pl_standard', '通用装箱单资料模板', 'document', 'packing_list', ['通用外贸'], ['全球'], ['通用产品'],
      '用于装箱单的箱数、重量、体积、运输方式与唛头准备。',
      { shippingMethod: 'By sea', packageCount: '12', packageType: 'Cartons', netWeight: '120', grossWeight: '145', cbm: '1.20', shippingMarks: 'ABC IMPORTS / PO-2026-001' }),
    demo('pub_contract_standard', '英文国际销售合同基础条款', 'document', 'sales_contract', ['通用外贸'], ['全球'], ['通用产品'],
      '用于创建正式合同前的基础付款、交期与贸易术语参考。',
      { paymentTerms: '30% deposit within 5 business days after contract confirmation; 70% balance before shipment.', tradeTerms: 'FOB Ningbo, Incoterms® 2020', deliveryTime: 'Production shall be completed within 30 days after receipt of deposit.', remarks: 'The parties shall resolve disputes through friendly consultation before submitting the matter to the competent court or arbitration institution agreed in writing.' }),
    demo('pub_clause_first_order', '首次合作付款条款', 'clause', 'clause', ['通用外贸'], ['全球'], ['通用产品'],
      '可套用到付款条款区域，适合新客户的基础风险控制。',
      { paymentTerms: 'For first cooperation, 30% T/T deposit is required before production and 70% balance shall be paid before shipment.' }),
    demo('pub_clause_sea', '海运运输条款', 'clause', 'clause', ['通用外贸'], ['全球'], ['通用产品'],
      '可套用到备注区域，提示客户海运相关责任边界。',
      { remarks: 'Sea freight, customs clearance requirements and destination charges are subject to the carrier and local regulations. Buyer shall provide accurate consignee and customs information before shipment.' }),
    noteDemo('pub_knowledge_eu', '欧盟客户资料核对要点', 'knowledge', 'knowledge_note', ['通用外贸'], ['欧盟'], ['通用产品'],
      '适合作为销售人员发货前的内部提示，不会自动覆盖 PI 字段。',
      ['确认公司抬头、税号与收货地址。', '核对产品标签、包装语言与合规文件要求。', '确认商业发票、装箱单、HS Code 与原产地描述一致。']),
    noteDemo('pub_checklist_ship', '发货前业务核对清单', 'checklist', 'checklist', ['通用外贸'], ['全球'], ['通用产品'],
      '适合作为发货前的内部检查参考。',
      ['客户已确认 PI / 合同。', '付款状态已核对。', '产品名称、数量、金额与最终订单一致。', '收货地址、联系人、运输方式与唛头已确认。', '商业发票、装箱单及附件已复核。'])
  ];

  const PDF_STYLE_DEMOS = [
    styleDemo('pub_style_classic_business', 'PDF 样式：经典商务', 'classic_business', 'business_blue', ['通用外贸'], ['全球'], ['PI', '报价单', '商业发票'], '稳重页眉、清晰表格，适合大多数日常商务单据。'),
    styleDemo('pub_style_minimal_trade', 'PDF 样式：极简外贸', 'minimal_trade', 'minimal_black', ['通用外贸'], ['全球'], ['合同', '商业发票', '装箱单'], '低干扰、打印友好，适合正式往来。'),
    styleDemo('pub_style_formal_contract', 'PDF 样式：正式合同', 'formal_contract', 'navy_gold', ['通用外贸'], ['全球'], ['销售合同', '订单确认'], '强化合同结构、条款和签署区，销售合同会呈现合同文书结构。'),
    styleDemo('pub_style_brand_showcase', 'PDF 样式：品牌展示', 'brand_showcase', 'fragrance_ivory', ['品牌出海', '美妆与香水', '服饰与配饰'], ['全球'], ['报价单', '产品目录式报价'], '强化品牌色与标题表现，适合品牌报价和产品展示。'),
    styleDemo('pub_style_customs_clean', 'PDF 样式：清关实用', 'customs_clean', 'clearance_clean', ['通用外贸'], ['全球'], ['商业发票', '装箱单', '清关资料'], '表格边界更明确，适合报关、清关和物流核对。')
  ];

  const VIP_KNOWLEDGE_DEMOS = [
    vipNoteDemo('vip_knowledge_quote_price', '报价单价格与有效期判断', ['通用外贸'], ['全球'], ['报价单', '价格策略', '有效期'],
      '报价前用于核对价格、MOQ、交期、包装和有效期，避免报价单变成订单确认文件。',
      ['报价单重点是价格、MOQ、交期、包装和报价有效期，不建议加入完整银行账户。', '如果价格受原材料或汇率影响，应写明报价有效期和重新确认条件。', '样品报价和批量报价建议分别注明 MOQ、样品费、交期和包装限制。']),
    vipNoteDemo('vip_knowledge_pi_payment', 'PI 付款与银行信息核对', ['通用外贸'], ['全球'], ['PI', '付款方式', '银行信息'],
      '用于生成 PI 前核对付款方式、收款信息和订单确认风险。',
      ['PI 应清楚显示 PI 编号、买卖双方、金额、币种、付款条款和收款信息。', '银行信息未确认时不要自动显示，避免客户按错误账户付款。', '客户 PO、交期、贸易术语和备注应与最终订单确认一致。']),
    vipNoteDemo('vip_knowledge_customs_ci', '商业发票清关字段核对', ['清关报关', '通用外贸'], ['美国', '欧盟', '全球'], ['商业发票', 'HS Code', '原产国'],
      '用于商业发票出货前复核申报信息，避免清关资料与装箱单不一致。',
      ['商业发票重点是发票编号、申报金额、原产国、运输方式、Incoterms 和声明备注。', 'HS Code、品名、数量和币种应与客户清关要求一致。', '未填写的声明、物流和金额字段不应出现在正式 PDF 中。']),
    vipNoteDemo('vip_knowledge_packing_logistics', '装箱单箱规与唛头核对', ['物流清关', '通用外贸'], ['全球'], ['装箱单', '唛头', '重量体积'],
      '用于装箱单生成前核对箱数、净重、毛重、体积、包装方式和唛头。',
      ['装箱单不应显示单价、金额、付款方式或银行信息。', '箱数、净重、毛重、体积和包装方式未填写时不要用占位符污染 PDF。', '唛头和物流信息应与货代、仓库和客户确认版本一致。']),
    vipNoteDemo('vip_knowledge_contract_terms', '销售合同核心条款清单', ['通用外贸'], ['全球'], ['销售合同', '付款条款', '交付条款'],
      '用于销售合同生成前确认付款、交付、质量、违约和争议解决条款。',
      ['销售合同应呈现买卖双方主体、合同编号、商品、金额、付款条款、交付条款和签署区。', '不要自动生成用户未确认的违约、争议或质量条款。', '空条款不进入 PDF，避免合同看起来像系统代写。']),
    vipNoteDemo('vip_knowledge_fragrance', '美妆香水出口资料提示', ['美妆与香水'], ['欧盟', '中东', '全球'], ['香水', '礼盒', '标签'],
      '适合香水、香氛、礼盒和美妆类客户报价及出货前资料核对。',
      ['报价单应重点确认包装、标签、MOQ、打样周期和外箱要求。', '出口前应核对成分、标签语言、容量、危险品运输要求和客户清关文件。', '礼盒和节日产品建议在备注中明确包装确认和设计稿确认流程。']),
    vipNoteDemo('vip_knowledge_fashion', '服饰配饰订单资料提示', ['服饰与配饰'], ['美国', '欧盟', '全球'], ['服装', '配饰', '尺码颜色'],
      '适合服饰、配饰、尺码颜色组合较多的报价和订单确认。',
      ['报价时应明确颜色、尺码、面料、包装、吊牌和 MOQ。', 'PI 或合同中应确认样品批准、生产交期和大货检验要求。', '装箱单建议按颜色、尺码或箱号保持清晰，方便客户收货核对。']),
    vipNoteDemo('vip_knowledge_home_goods', '家居日用品出口资料提示', ['家居生活'], ['美国', '欧盟', '全球'], ['家居用品', '收纳用品', '包装'],
      '适合家居、收纳、日用品等体积和包装要求明显的产品。',
      ['报价单应提前确认包装尺寸、外箱数量、CBM 和运输方式。', '商业发票和装箱单中的品名、数量、箱数、重量和体积应互相一致。', '如果客户有平台标签或条码要求，应在备注中单独列明。'])
  ];

  function demo(id, title, category, documentType, industries, countries, products, summary, fields) {
    return {
      id, template_scope: 'public', title, summary,
      document_type: documentType,
      industry_tags: industries, country_tags: countries, product_tags: products,
      payload: { fields, templateMeta: { category, sourceLanguage: 'en', demo: true, editorMode: 'fields' } },
      isDemo: true
    };
  }
  function noteDemo(id, title, category, documentType, industries, countries, products, summary, lines) {
    return {
      id, template_scope: 'public', title, summary,
      document_type: documentType,
      industry_tags: industries, country_tags: countries, product_tags: products,
      payload: { noteContent: lines.join('\n'), templateMeta: { category, demo: true, editorMode: 'note' } },
      isDemo: true
    };
  }
  function vipNoteDemo(id, title, industries, countries, products, summary, lines) {
    return {
      id, template_scope: 'vip_knowledge', title, summary,
      document_type: 'knowledge_note',
      industry_tags: industries, country_tags: countries, product_tags: products,
      payload: { noteContent: lines.join('\n'), templateMeta: { category: 'knowledge', demo: true, editorMode: 'note', templateKind: 'vip_knowledge_note' } },
      isDemo: true
    };
  }
  function styleDemo(id, title, pdfStyle, theme, industries, countries, products, summary, documentType = 'proforma_invoice') {
    return {
      id, template_scope: 'public', title, summary,
      document_type: documentType,
      industry_tags: industries, country_tags: countries, product_tags: products,
      payload: { branding: { pdfStyle, theme, logoPosition: 'left', logoScope: 'first_page', showFooter: false }, templateMeta: { category: 'style', demo: true, templateKind: 'pdf_style' } },
      isDemo: true
    };
  }

  const state = {
    opened: false,
    tab: 'public',
    status: null,
    templates: [],
    tier: 'guest',
    vault: { configured: false, active: false, expiresAt: null, feedback: '', feedbackType: '' },
    vaultToken: '',
    editor: null,
    publicCategory: 'all',
    publicIndustry: 'all',
    publicDocType: 'all',
    publicSearch: '',
    preview: null,
    toast: null
  };

  const tabs = [
    ['public', '公开模板'],
    ['pdf_brand', 'PDF 样式与品牌'],
    ['vip_knowledge', '行业知识库'],
    ['private', '我的私有模板'],
    ['team', '团队模板']
  ];

  const Branding = (() => {
    const STORE = 'HUIDI.v9.branding';
    const DEFAULT = {
      theme: 'business_blue',
      brandColor: '',
      logo: '',
      pdfStyle: 'classic_business',
      logoPosition: 'left',
      logoScope: 'first_page',
      showFooter: false,
      headerText: '',
      footerText: '',
      documentType: 'proforma_invoice'
    };
    let settings = load();
    let scheduled = false;

    function load() {
      try {
        const stored = JSON.parse(localStorage.getItem(STORE) || '{}');
        return { ...DEFAULT, ...stored };
      } catch {
        return { ...DEFAULT };
      }
    }

    function save() {
      try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {}
    }

    function hasBrandAccess() {
      return !!window.HUIDI_LOCAL_ONLY?.localOnly || VIP_BRAND_TIERS.has(state.tier);
    }

    function normalizedTheme() {
      if (!hasBrandAccess()) return 'business_blue';
      return BRAND_THEMES[settings.theme] ? settings.theme : 'business_blue';
    }

    function normalizedPdfStyle() {
      if (!hasBrandAccess()) return FREE_DEFAULT_PDF_STYLE;
      return PDF_STYLES[settings.pdfStyle] ? settings.pdfStyle : FREE_DEFAULT_PDF_STYLE;
    }

    function normalizedDocumentType(type) {
      return DOC_PROFILE_TYPES.has(type) ? type : 'proforma_invoice';
    }

    function effectiveSettings() {
      if (hasBrandAccess()) return settings;
      return {
        ...DEFAULT,
        pdfStyle: FREE_DEFAULT_PDF_STYLE,
        documentType: normalizedDocumentType(settings.documentType)
      };
    }

    function companyFooterFallback() {
      const read = id => String(document.getElementById(id)?.value || '').trim();
      return [read('sellerName'), read('sellerEmail'), read('sellerPhone'), read('sellerAddress')]
        .filter(Boolean)
        .join(' · ');
    }

    function emitUpdate() {
      document.dispatchEvent(new CustomEvent('HUIDI:branding-updated', { detail: get() }));
    }

    function documentTitle(type) {
      return {
        proforma_invoice: 'PROFORMA INVOICE',
        quotation: 'QUOTATION',
        commercial_invoice: 'COMMERCIAL INVOICE',
        sales_contract: 'SALES CONTRACT',
        packing_list: 'PACKING LIST'
      }[type] || 'PROFORMA INVOICE';
    }

    function scheduleDecorate() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        decorate();
      });
    }

    function decorate() {
      const paper = document.getElementById('piPaper');
      if (!paper) return;
      const active = effectiveSettings();
      const theme = normalizedTheme();
      Object.keys(BRAND_THEMES).forEach(key => paper.classList.remove(`fp-brand-theme-${key}`));
      paper.classList.add(`fp-brand-theme-${theme}`);
      const pdfStyle = normalizedPdfStyle();
      Object.keys(PDF_STYLES).forEach(key => paper.classList.remove(`fp-pdf-style-${key}`));
      paper.classList.add(`fp-pdf-style-${pdfStyle}`);
      const paperSpec = window.FlypigBOXApp?.resolveDocumentPaperSpec?.({ pdfStyle }) || window.FlypigBOXPaperLayout?.resolveDocumentPaperSpec?.({ pdfStyle }) || PDF_PAPER_SPECS[pdfStyle] || PDF_PAPER_SPECS.classic_business;
      const documentType = normalizedDocumentType(active.documentType);
      paper.dataset.fpBrandLogoPosition = active.logoPosition || 'left';
      paper.dataset.fpBrandLogoScope = active.logoScope || 'first_page';
      paper.dataset.fpDocumentType = documentType;
      paper.dataset.fpPdfStyle = pdfStyle;
      paper.dataset.fpPaperFormat = paperSpec.format;
      paper.dataset.fpPaperOrientation = paperSpec.jsPdfOrientation || paperSpec.orientation;
      paper.dataset.fpPaperMode = paperSpec.orientation === 'landscape' || paperSpec.orientation === 'l' ? 'landscape' : 'portrait';
      paper.dataset.fpPaperLabel = paperSpec.label;
      paper.style.setProperty('--fp-paper-width-mm', String(paperSpec.widthMm));
      paper.style.setProperty('--fp-paper-height-mm', String(paperSpec.heightMm));
      paper.style.setProperty('--fp-brand-color', active.brandColor || BRAND_THEMES[theme].color);

      // renderPreview assigns a generation before it builds a fresh unpaginated
      // document.  Once that generation has been decorated, later observer
      // callbacks must not remove and re-insert header/footer nodes after
      // pagination; doing so changes page height after measurement and can make
      // overflow:hidden cut the final rows of a table.
      const renderGeneration = String(paper.dataset.fpRenderGeneration || '');
      if (renderGeneration && paper.dataset.fpBrandDecoratedGeneration === renderGeneration) return;

      const hero = paper.querySelector('.doc-hero, .pdf-quotation-hero, .pdf-commercial-hero, .pdf-contract-hero, .pdf-packing-hero');
      if (!hero) return;
      const template = hero.closest('.pdf-template') || paper;

      const existing = paper.querySelector('[data-fp-brand-logo]');
      if (existing) existing.remove();
      const oldHeader = paper.querySelector('[data-fp-brand-header]');
      if (oldHeader) oldHeader.remove();
      const oldFooter = paper.querySelector('[data-fp-brand-footer]');
      if (oldFooter) oldFooter.remove();

      if (active.logo && active.logoScope !== 'none') {
        const logoRow = document.createElement('div');
        logoRow.className = `fp-doc-brand-logo-row fp-doc-brand-logo-row--${active.logoPosition || 'left'}`;
        logoRow.dataset.fpBrandLogo = '1';
        logoRow.innerHTML = `<div class="fp-doc-brand-logo fp-doc-brand-logo--${active.logoPosition || 'left'}"><img src="${active.logo}" alt="Company logo"></div>`;
        hero.parentNode.insertBefore(logoRow, hero);
      }

      const headerText = String(active.headerText || '').trim();
      if (headerText) {
        const header = document.createElement('div');
        header.className = 'fp-doc-brand-header';
        header.dataset.fpBrandHeader = '1';
        header.textContent = headerText;
        hero.parentNode.insertBefore(header, hero);
      }

      const heading = hero.querySelector('h2');
      if (heading && hero.classList.contains('doc-hero') && documentType !== 'proforma_invoice') {
        heading.textContent = documentTitle(documentType);
      }

      const footerText = String(active.footerText || '').trim() || companyFooterFallback();
      if ((active.showFooter || String(active.footerText || '').trim()) && footerText) {
        const footer = document.createElement('div');
        footer.className = 'fp-doc-brand-footer';
        footer.dataset.fpBrandFooter = '1';
        footer.textContent = footerText;
        template.appendChild(footer);
      }
      if (renderGeneration) paper.dataset.fpBrandDecoratedGeneration = renderGeneration;
    }

    function observe() {
      const paper = document.getElementById('piPaper');
      if (!paper || paper.dataset.fpBrandObserver) {
        scheduleDecorate();
        return;
      }
      paper.dataset.fpBrandObserver = '1';
      const observer = new MutationObserver(() => {
        if (!paper.querySelector('[data-fp-brand-logo], [data-fp-brand-header], [data-fp-brand-footer]')) scheduleDecorate();
      });
      observer.observe(paper, { childList: true });
      scheduleDecorate();
    }

    function apply(next = {}, options = {}) {
      const safe = { ...next };
      if (options.keepLogo !== false) delete safe.logo;
      settings = { ...settings, ...safe };
      settings.theme = normalizedTheme();
      settings.pdfStyle = normalizedPdfStyle();
      settings.documentType = normalizedDocumentType(settings.documentType);
      save();
      scheduleDecorate();
      emitUpdate();
      return get();
    }

    function set(next = {}) {
      settings = { ...settings, ...next };
      settings.theme = normalizedTheme();
      settings.pdfStyle = normalizedPdfStyle();
      settings.documentType = normalizedDocumentType(settings.documentType);
      save();
      scheduleDecorate();
      emitUpdate();
      return get();
    }

    async function readLogo(file) {
      if (!file) return;
      if (!/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type || '')) {
        throw new Error('请上传 PNG、JPG、WEBP 或 SVG 格式的 Logo。');
      }
      if (file.size > 1024 * 1024) {
        throw new Error('Logo 文件请控制在 1MB 以内，以免占满浏览器本地存储。');
      }
      let url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Logo 读取失败。'));
        reader.readAsDataURL(file);
      });
      if (/image\/(webp|svg\+xml)/i.test(file.type || '')) {
        url = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            try {
              const max = 1200, scale = Math.min(1, max / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
              canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
              const context = canvas.getContext('2d');
              context.clearRect(0,0,canvas.width,canvas.height);
              context.drawImage(image,0,0,canvas.width,canvas.height);
              resolve(canvas.toDataURL('image/png'));
            } catch (error) { reject(error); }
          };
          image.onerror = () => reject(new Error('Logo 格式转换失败。'));
          image.src = url;
        });
      }
      set({ logo: url });
    }

    function clearLogo() {
      set({ logo: '' });
    }

    function get() {
      const active = effectiveSettings();
      return { ...active, theme: normalizedTheme(), pdfStyle: normalizedPdfStyle(), documentType: normalizedDocumentType(active.documentType) };
    }

    function exportForTemplate() {
      const { logo, ...publicSettings } = get();
      return publicSettings;
    }

    return { get, set, apply, readLogo, clearLogo, exportForTemplate, observe, decorate, themes: BRAND_THEMES, styles: PDF_STYLES, documentTitle };
  })();

  window.FlypigBOXBranding = Branding;

  function edgeUrl() {
    return cfg.edgeFunctionUrl || (cfg.supabaseUrl
      ? `${String(cfg.supabaseUrl).replace(/\/$/, '')}/functions/v1/flypigbox-template-vault`
      : '');
  }

  async function accessToken() {
    if (isLocalPreview) return '';
    if (typeof cfg.getAccessToken === 'function') return await cfg.getAccessToken();
    for (const client of [window.FlypigBOXSupabaseClient, window.flypigboxSupabase, window.supabaseClient, window.supabase]) {
      if (client?.auth?.getSession) {
        const { data } = await client.auth.getSession();
        if (data?.session?.access_token) return data.session.access_token;
      }
    }
    return '';
  }

  async function api(action, body = {}) {
    if (isLocalPreview) throw new Error('当前为本地预览模式，云端模板服务未连接。');
    const url = edgeUrl();
    if (!url) throw new Error('尚未配置模板中心 Edge Function 地址。');
    const token = await accessToken();
    if (!token) throw new Error('请先登录账号后使用私有模板或团队模板。');
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
    if (state.vaultToken) headers['x-flypigbox-vault-token'] = state.vaultToken;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || '模板服务暂时无法连接。');
    return data;
  }

  let toastTimer = 0;
  function toast(message = '', type = 'ok') {
    state.toast = message ? { message, type } : null;
    const node = $('#fpV9Toast');
    if (node) {
      node.textContent = message || '';
      node.dataset.type = type || '';
      node.classList.toggle('is-visible', Boolean(message));
    }
    window.clearTimeout(toastTimer);
    if (message) {
      toastTimer = window.setTimeout(() => {
        state.toast = null;
        const current = $('#fpV9Toast');
        if (current) current.classList.remove('is-visible');
      }, 4600);
    }
  }

  function status(message = '', type = '') {
    state.status = { message, type };
    const node = $('#fpV9Status');
    if (node) {
      node.textContent = message;
      node.dataset.type = type || '';
    }
  }

  function requestLogin() {
    document.dispatchEvent(new CustomEvent('HUIDI:request-login'));
    document.getElementById('memberAuthBtn')?.click();
  }

  function scopeLabel(scope) {
    return ({
      public: '公开模板',
      vip_knowledge: '行业知识库',
      private: '我的私有',
      team: '团队',
      ultimate_vault: 'Vault 私密'
    })[scope] || scope;
  }

  function categoryOf(template) {
    return template?.payload?.templateMeta?.category
      || (template?.payload?.branding ? 'style' : 'document');
  }

  function isFullTemplate(template) {
    const payload = template?.payload || {};
    return Boolean(payload.workspaceState || payload.state || payload.documentState);
  }

  function baseTemplatesForTab(tab = state.tab) {
    const serverPublic = state.templates.filter(item => item.template_scope === 'public');
    const serverVipKnowledge = state.templates.filter(item => item.template_scope === 'vip_knowledge');
    const publicTemplates = [...PUBLIC_DEMOS, ...serverPublic].filter(item => categoryOf(item) !== 'style');
    if (tab === 'public') return publicTemplates;
    if (tab === 'pdf_brand') return [...PDF_STYLE_DEMOS, ...serverPublic].filter(item => categoryOf(item) === 'style');
    if (tab === 'vip_knowledge') return [...VIP_KNOWLEDGE_DEMOS, ...serverVipKnowledge];
    return state.templates.filter(item => item.template_scope === tab);
  }

  function dedupeTemplates(list) {
    const seen = new Set();
    return list.filter(item => {
      const key = item.id || `${item.title}|${item.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function templateMatchesFilters(item, tab = state.tab) {
      if (tab === 'pdf_brand') {
        if (categoryOf(item) !== 'style') return false;
        const branding = item?.payload?.branding || {};
        if (state.publicDocType !== 'all' && branding.pdfStyle !== state.publicDocType) return false;
        if (state.publicIndustry !== 'all' && !(item.industry_tags || []).includes(state.publicIndustry)) return false;
        const q = state.publicSearch.trim().toLowerCase();
        if (q) {
          const style = PDF_STYLES[branding.pdfStyle] || {};
          const theme = BRAND_THEMES[branding.theme] || {};
          const text = [
            item.title, item.summary, style.label, style.note, theme.label, theme.note,
            ...(item.industry_tags || []), ...(item.country_tags || []), ...(item.product_tags || [])
          ].join(' ').toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      }
      if (state.publicCategory !== 'all' && categoryOf(item) !== state.publicCategory) return false;
      if (state.publicDocType !== 'all') {
        const docLabel = DOC_LABEL[state.publicDocType] || '';
        const related = [item.document_type, ...(item.product_tags || [])].join(' ');
        if (item.document_type !== state.publicDocType && !related.includes(docLabel)) return false;
      }
      if (state.publicIndustry !== 'all' && !(item.industry_tags || []).includes(state.publicIndustry)) return false;
      const q = state.publicSearch.trim().toLowerCase();
      if (q) {
        const text = [
          item.title, item.summary, ...(item.industry_tags || []), ...(item.country_tags || []), ...(item.product_tags || [])
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
  }

  function filteredTemplatesForTab(tab = state.tab) {
    return dedupeTemplates(baseTemplatesForTab(tab)).filter(item => templateMatchesFilters(item, tab));
  }

  function filteredPublicTemplates() {
    return filteredTemplatesForTab('public');
  }

  function currentTemplates() {
    return filteredTemplatesForTab(state.tab);
  }

  function filterIndustriesForTab(tab = state.tab) {
    const source = baseTemplatesForTab(tab);
    return [...new Set(source.flatMap(item => item.industry_tags || []))].filter(Boolean).sort();
  }

  function resetFilters() {
    state.publicCategory = 'all';
    state.publicDocType = 'all';
    state.publicIndustry = 'all';
    state.publicSearch = '';
  }

  function normalizePublicFilters() {
    if (state.publicCategory === 'style') state.publicCategory = 'all';
    if (state.publicDocType !== 'all' && !DOC_LABEL[state.publicDocType]) state.publicDocType = 'all';
  }

  function normalizePdfBrandFilters() {
    state.publicCategory = 'style';
    if (state.publicDocType !== 'all' && !PDF_STYLES[state.publicDocType]) state.publicDocType = 'all';
    const allowedIndustries = new Set(['all', ...filterIndustriesForTab('pdf_brand')]);
    if (!allowedIndustries.has(state.publicIndustry)) state.publicIndustry = 'all';
  }

  function filterBarHtml(count = 0, countLabel = '个匹配模板', tab = state.tab) {
    if (tab === 'pdf_brand') {
      const industries = filterIndustriesForTab('pdf_brand');
      const styleOptions = [['all', '全部样式'], ...Object.entries(PDF_STYLES).map(([id, style]) => [id, style.label])];
      return `
        <div class="fp-v9-filterbar fp-v11-template-filterbar fp-v11-pdf-style-filterbar">
          <label>分类<select id="fpV8Category" disabled><option value="style" selected>PDF 样式</option></select></label>
          <label>样式类型<select id="fpV8DocFilter">${styleOptions.map(([id, label]) => `<option value="${id}" ${id === state.publicDocType ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>
          <label>适用场景<select id="fpV8IndustryFilter"><option value="all">全部场景</option>${industries.map(label => `<option value="${escape(label)}" ${label === state.publicIndustry ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>
          <label class="fp-v9-search">搜索<input id="fpV8Search" value="${escape(state.publicSearch)}" placeholder="搜索 PDF 样式、颜色或场景"></label>
        </div>
        <div class="fp-v8-actions fp-v9-public-actions fp-v11-filter-actions">
          <span class="fp-v9-count">共 ${count} ${countLabel}</span>
          <button class="fp-v8-button fp-v8-secondary" id="fpV8ResetFilters">清除筛选</button>
        </div>`;
    }
    if (tab === 'private' || tab === 'team') {
      return `
        <div class="fp-v9-filterbar fp-v11-template-filterbar fp-v12-library-filterbar">
          <label>模板类型<select id="fpV8Category">${LIBRARY_TEMPLATE_CATEGORIES.map(([id, label]) => `<option value="${id}" ${id === state.publicCategory ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label>单据类型<select id="fpV8DocFilter"><option value="all">全部单据</option>${DOC_TYPES.filter(([id]) => DOC_PROFILE_TYPES.has(id)).map(([id, label]) => `<option value="${id}" ${id === state.publicDocType ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <input id="fpV8IndustryFilter" type="hidden" value="all">
          <label class="fp-v9-search">搜索<input id="fpV8Search" value="${escape(state.publicSearch)}" placeholder="搜索模板名称、客户、条款或备注"></label>
        </div>
        <div class="fp-v8-actions fp-v9-public-actions fp-v11-filter-actions">
          <span class="fp-v9-count">共 ${count} ${countLabel}</span>
          <button class="fp-v8-button fp-v8-secondary" id="fpV8ResetFilters">清除筛选</button>
        </div>`;
    }
    const industries = filterIndustriesForTab();
    return `
      <div class="fp-v9-filterbar fp-v11-template-filterbar">
        <label>分类<select id="fpV8Category">${PUBLIC_TEMPLATE_CATEGORIES.map(([id, label]) => `<option value="${id}" ${id === state.publicCategory ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>单据类型<select id="fpV8DocFilter"><option value="all">全部类型</option>${DOC_TYPES.map(([id, label]) => `<option value="${id}" ${id === state.publicDocType ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>行业<select id="fpV8IndustryFilter"><option value="all">全部行业</option>${industries.map(label => `<option value="${escape(label)}" ${label === state.publicIndustry ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select></label>
        <label class="fp-v9-search">搜索<input id="fpV8Search" value="${escape(state.publicSearch)}" placeholder="搜索模板、行业或国家"></label>
      </div>
      <div class="fp-v8-actions fp-v9-public-actions fp-v11-filter-actions">
        <span class="fp-v9-count">共 ${count} ${countLabel}</span>
        <button class="fp-v8-button fp-v8-secondary" id="fpV8ResetFilters">清除筛选</button>
      </div>`;
  }

  function bindTemplateFilters() {
    const update = () => {
      state.publicCategory = state.tab === 'pdf_brand' ? 'style' : ($('#fpV8Category')?.value || 'all');
      state.publicDocType = $('#fpV8DocFilter')?.value || 'all';
      state.publicIndustry = $('#fpV8IndustryFilter')?.value || 'all';
      state.publicSearch = $('#fpV8Search')?.value || '';
      renderPanel();
    };
    $('#fpV8Category')?.addEventListener('change', update);
    $('#fpV8DocFilter')?.addEventListener('change', update);
    $('#fpV8IndustryFilter')?.addEventListener('change', update);
    $('#fpV8Search')?.addEventListener('input', update);
    $('#fpV8ResetFilters')?.addEventListener('click', () => {
      if (state.tab === 'pdf_brand') {
        state.publicCategory = 'style';
        state.publicDocType = 'all';
        state.publicIndustry = 'all';
        state.publicSearch = '';
      } else resetFilters();
      renderPanel();
    });
  }

  function canCreate() {
    return (
      state.tab === 'private' && ['vip', 'team', 'ultimate', 'admin'].includes(state.tier)
    ) || (
      state.tab === 'team' && ['team', 'ultimate', 'admin'].includes(state.tier)
    ) || (
      state.tab === 'ultimate_vault' && ['ultimate', 'admin'].includes(state.tier) && state.vault.active
    );
  }

  function canUseBrandStudio() {
    return !!window.HUIDI_LOCAL_ONLY?.localOnly || VIP_BRAND_TIERS.has(state.tier);
  }

  function guardBrandStudioAction() {
    if (canUseBrandStudio()) return true;
    const message = '当前账号可以预览基础 PDF 样式；保存 Logo、颜色和页头页脚需要相应权限。';
    status(message, 'error');
    toast(message, 'error');
    if (state.tier === 'guest') requestLogin();
    return false;
  }

  function brandLockedHtml() {
    const isGuest = state.tier === 'guest';
    return `<div class="fp-v8-lock-panel fp-v9-brand-lock">
      <h3>PDF 样式与品牌</h3>
      <p>当前可以预览基础 PDF 样式；保存品牌样式、Logo 和页头页脚需要登录并具备相应权限。</p>
      <p class="fp-v8-note">当前身份：${escape(tierLabel(state.tier))}。${isGuest ? '登录后可保存和套用自己的品牌样式。' : '可用范围以当前账号权限为准。'}</p>
      <div class="fp-v8-actions"><button class="fp-v8-button fp-v8-primary" id="fpV9BrandPlan">查看功能状态</button></div>
    </div>`;
  }

  function currentWorkspaceDocumentType() {
    const type = window.FlypigBOXApp?.getDocumentType?.() || Branding.get().documentType || 'proforma_invoice';
    return DOC_PROFILE_TYPES.has(type) ? type : 'proforma_invoice';
  }

  function templateTitlePrefix(type = currentWorkspaceDocumentType()) {
    return DOC_LABEL[type] || '单据';
  }

  function createTemplateDraft(scope, kind = 'full') {
    const type = currentWorkspaceDocumentType();
    const fullState = kind === 'full' ? window.FlypigBOXApp?.formState?.(true) : null;
    const titlePrefix = templateTitlePrefix(type);
    const base = {
      scope,
      document_type: type,
      title: kind === 'note' ? `${titlePrefix}常用条款 / 说明` : kind === 'fields' ? `${titlePrefix}快捷字段` : `${titlePrefix}完整模板`,
      summary: kind === 'note'
        ? '保存常用付款、交期、备注或客户沟通说明，套用后再按客户修改。'
        : kind === 'fields'
          ? '只保存经常重复填写的公司、付款、物流或备注字段。'
          : '保存当前单据的客户、商品、金额、付款、条款和 PDF 样式，适合后续一键复用。',
      industry_tags: [],
      country_tags: [],
      product_tags: [],
      payload: { templateMeta: { category: kind === 'note' ? 'clause' : 'document', editorMode: kind === 'full' ? 'full' : kind === 'note' ? 'note' : 'fields' } }
    };
    if (kind === 'full' && fullState) {
      base.payload.workspaceState = fullState;
      base.payload.branding = Branding.exportForTemplate();
      base.payload.templateMeta = { ...base.payload.templateMeta, templateKind: 'full_workspace', capturedAt: new Date().toISOString() };
    }
    if (kind === 'fields') base.payload.fields = {};
    if (kind === 'note') base.payload.noteContent = '';
    return base;
  }

  function libraryIntroHtml(tab, count, canWrite) {
    const isTeam = tab === 'team';
    const title = isTeam ? '团队模板怎么用？' : '我的私有模板怎么用？';
    const visibility = isTeam ? '团队模板给同一团队成员共用，适合统一报价口径、付款条款和常用说明。' : '私有模板只对你自己可见，适合保存常用客户、产品、条款和已调好的完整单据。';
    return `<div class="fp-v12-template-home">
      <div class="fp-v12-template-guide">
        <b>${title}</b>
        <p>${visibility} 不需要从空白表单开始，优先把当前已经填好的单据保存成模板。</p>
      </div>
      <div class="fp-v12-template-steps">
        <span><b>完整单据</b>保存当前客户、商品、金额、付款、条款和 PDF 样式。</span>
        <span><b>快捷字段</b>只保存常用卖方、付款、物流、备注等少量字段。</span>
        <span><b>常用条款</b>保存付款说明、交期说明、售后备注或团队知识。</span>
      </div>
      ${canWrite ? `<div class="fp-v8-actions fp-v12-template-actions">
        <button class="fp-v8-button fp-v8-primary" id="fpV12SaveCurrent">保存当前单据为模板</button>
        <button class="fp-v8-button fp-v8-secondary" id="fpV12NewFields">新建快捷字段</button>
        <button class="fp-v8-button fp-v8-secondary" id="fpV12NewNote">新建常用条款 / 说明</button>
      </div>` : '<p class="fp-v8-note">当前账号只能查看和套用已有模板；创建或编辑模板需要对应会员权限。</p>'}
      <p class="fp-v12-template-count">当前共有 ${count} 个模板。套用模板不会自动删除当前已填写内容，完整模板套用前建议先保存草稿。</p>
    </div>`;
  }

  function modalHtml() {
    const tabButtons = tabs.map(([id, label]) =>
      `<button data-tab="${id}" class="${state.tab === id ? 'is-active' : ''}">${label}</button>`
    ).join('');

    return `<div class="fp-v8-backdrop ${state.opened ? 'is-open' : ''}" id="fpV8Backdrop" aria-hidden="${!state.opened}">
      <section class="fp-v8-modal fp-v9-modal" role="dialog" aria-modal="true" aria-label="HUIDI 模板中心">
        <aside class="fp-v8-side">
          <div class="fp-v8-logo"><img src="./assets/brand/flypigbox-icon-64.png" alt="">HUIDI <span>模板与品牌中心</span></div>
          <nav class="fp-v8-nav">${tabButtons}</nav>
          <div class="fp-v8-side-footer">当前身份：${escape(tierLabel(state.tier))}</div>
        </aside>
        <main class="fp-v8-main">
          <header class="fp-v8-head">
            <div>
              <h2>${escape((tabs.find(item => item[0] === state.tab) || [])[1] || '模板中心')}</h2>
              <p>${state.tab === 'public' ? '浏览公开示范模板；可直接套用，登录后可复制到个人空间。' : '模板内容仅在通过相应权限校验后加载。'}</p>
            </div>
            <button class="fp-v8-close" id="fpV8Close" aria-label="关闭">×</button>
          </header>
          <div class="fp-v8-content">
            <p class="fp-v8-status" id="fpV9Status" data-type="${escape(state.status?.type || '')}">${escape(state.status?.message || '')}</p>
            <div id="fpV8Panel"></div>
          </div>
        </main>
      </section>
      <div id="fpV9Toast" class="fp-v9-toast ${state.toast ? 'is-visible' : ''}" data-type="${escape(state.toast?.type || '')}" role="status" aria-live="polite">${escape(state.toast?.message || '')}</div>
    </div>`;
  }

  function renderModal() {
    const root = $('#fpV8Root');
    if (!root) return;
    root.innerHTML = modalHtml();

    $('#fpV8Close')?.addEventListener('click', close);
    $('#fpV8Backdrop')?.addEventListener('click', event => {
      if (event.target.id === 'fpV8Backdrop') close();
    });
    $$('[data-tab]', root).forEach(button => {
      button.addEventListener('click', () => {
        captureEditorDraft();
        state.tab = button.dataset.tab;
        state.editor = null;
        state.preview = null;
        renderModal();
      });
    });
    renderPanel();
  }

  function renderPanel() {
    const panel = $('#fpV8Panel');
    if (!panel) return;

    if (state.tab === 'pdf_brand') {
      normalizePdfBrandFilters();
      const styleCount = filteredTemplatesForTab('pdf_brand').length;
      if (!canUseBrandStudio()) {
        panel.innerHTML = `${filterBarHtml(styleCount, '个 PDF 样式', 'pdf_brand')}${brandLockedHtml()}`;
        bindTemplateFilters();
        $('#fpV9BrandPlan')?.addEventListener('click', () => {
          if (state.tier === 'guest') requestLogin();
          else document.getElementById('membershipPlansBtn')?.click();
        });
        return;
      }
      panel.innerHTML = brandPanelHtml();
      bindTemplateFilters();
      bindBrandPanel();
      return;
    }

    if (state.tab === 'ultimate_vault' && !['ultimate', 'admin'].includes(state.tier)) {
      const templates = currentTemplates();
      panel.innerHTML = `${filterBarHtml(templates.length)}<div class="fp-v8-lock-panel"><h3>高级资料暂未开放</h3><p>该区域暂未开放；当前请使用公开模板、我的模板、团队模板和行业资料。</p></div>`;
      bindTemplateFilters();
      return;
    }

    if (state.tab === 'ultimate_vault' && !state.vault.active) {
      const templates = currentTemplates();
      panel.innerHTML = `${filterBarHtml(templates.length)}${vaultLockedHtml()}`;
      bindTemplateFilters();
      bindVaultLocked();
      return;
    }

    if (state.preview) {
      panel.innerHTML = templatePreviewHtml(state.preview);
      bindPreviewPanel();
      return;
    }

    if (state.editor) {
      panel.innerHTML = editorHtml(state.editor);
      bindEditor();
      return;
    }

    if (state.tab === 'public') {
      panel.innerHTML = publicListHtml();
      bindTemplateFilters();
      bindTemplateCardActions(panel);
      return;
    }

    const templates = currentTemplates();
    const tips = {
      vip_knowledge: '这里仅显示平台的会员行业知识；不会展示其他用户的私有资料。',
      private: '私有模板只对你自己可见。优先保存当前单据，少量内容再用快捷字段或常用条款。',
      team: '团队模板用于统一团队常用单据、字段和条款。建议负责人维护，成员直接套用。',
      ultimate_vault: 'Vault 已解锁。手动锁定、关闭网页或超时后需要再次解锁。'
    };
    const libraryTab = state.tab === 'private' || state.tab === 'team';

    panel.innerHTML = `
      <div class="fp-v8-alert ${state.tab === 'ultimate_vault' ? 'fp-v8-vault-alert' : ''}">${tips[state.tab] || ''}</div>
      ${libraryTab ? libraryIntroHtml(state.tab, templates.length, canCreate()) : ''}
      ${filterBarHtml(templates.length, '个模板', state.tab)}
      <div class="fp-v8-actions">
        ${canCreate() && !libraryTab ? '<button class="fp-v8-button fp-v8-primary" id="fpV8New">＋ 新建模板</button>' : ''}
        ${state.tab === 'ultimate_vault' ? '<button class="fp-v8-button fp-v8-secondary" id="fpV8Lock">锁定保险库</button>' : ''}
        <button class="fp-v8-button fp-v8-secondary" id="fpV8Refresh">刷新</button>
      </div>
      ${templateGridHtml(templates)}
    `;

    $('#fpV8Refresh')?.addEventListener('click', loadTemplates);
    $('#fpV8New')?.addEventListener('click', () => {
      state.editor = {
        scope: state.tab,
        document_type: 'proforma_invoice',
        title: '',
        summary: '',
        industry_tags: [],
        country_tags: [],
        product_tags: [],
        payload: { fields: {}, templateMeta: { category: 'document', editorMode: 'fields', sourceLanguage: 'en' } }
      };
      renderPanel();
    });

    $('#fpV12SaveCurrent')?.addEventListener('click', () => {
      state.editor = createTemplateDraft(state.tab, 'full');
      renderPanel();
    });

    $('#fpV12NewFields')?.addEventListener('click', () => {
      state.editor = createTemplateDraft(state.tab, 'fields');
      renderPanel();
    });

    $('#fpV12NewNote')?.addEventListener('click', () => {
      state.editor = createTemplateDraft(state.tab, 'note');
      renderPanel();
    });

    $('#fpV8Lock')?.addEventListener('click', async () => {
      try {
        await api('lock_vault');
        state.vault.active = false;
        state.vaultToken = '';
        state.templates = state.templates.filter(item => item.template_scope !== 'ultimate_vault');
        status('高级资料暂未开放。');
        renderModal();
      } catch (error) {
        status(error.message, 'error');
      }
    });

    bindTemplateFilters();
    bindTemplateCardActions(panel);
  }

  function publicListHtml() {
    normalizePublicFilters();
    const list = filteredPublicTemplates();
    return `
      <div class="fp-v8-alert">公开模板用于学习、预览与快速套用。公开示范不包含任何用户私有内容；登录后可复制到“我的私有模板”。</div>
      ${filterBarHtml(list.length, '个可用示范模板')}
      ${templateGridHtml(list, { public: true })}
    `;
  }

  function templateGridHtml(templates, options = {}) {
    if (!templates.length) {
      return `<div class="fp-v8-empty">暂无符合条件的模板。可清除筛选，或在“我的私有模板”里创建自己的模板。</div>`;
    }
    return `<div class="fp-v8-grid">${templates.map(template => cardHtml(template, options)).join('')}</div>`;
  }

  function cardHtml(template, options = {}) {
    const tags = [
      ...(template.industry_tags || []),
      ...(template.country_tags || []),
      ...(template.product_tags || [])
    ].slice(0, 5);
    const isPublic = template.template_scope === 'public' || options.public;
    const editable = ['private', 'team', 'ultimate_vault'].includes(template.template_scope);
    const category = CATEGORIES.find(item => item[0] === categoryOf(template))?.[1] || '单据模板';
    const typeLabel = DOC_LABEL[template.document_type] || '资料模板';
    const styleOnly = Boolean(template?.payload?.branding && !template?.payload?.fields && !isFullTemplate(template));

    return `<article class="fp-v8-card fp-v9-card">
      <div class="fp-v8-card-top">
        <h3>${escape(template.title)}</h3>
        <span class="fp-v8-pill ${template.template_scope === 'ultimate_vault' ? 'vault' : ''}">${escape(isPublic ? category : scopeLabel(template.template_scope))}</span>
      </div>
      <p>${escape(template.summary || '未填写模板说明')}</p>
      <div class="fp-v9-meta">${escape(styleOnly ? 'PDF 样式主题' : typeLabel)}</div>
      <div class="fp-v8-tags">${isFullTemplate(template) ? '<span>完整单据</span>' : ''}${tags.map(tag => `<span>${escape(tag)}</span>`).join('')}</div>
      <div class="fp-v8-card-actions">
        <button class="fp-v8-button fp-v8-primary" data-use-template="${escape(template.id)}">${styleOnly ? '套用样式' : '套用到当前单据'}</button>
        <button class="fp-v8-button fp-v8-secondary" data-preview-template="${escape(template.id)}">预览</button>
        ${isPublic ? '<button class="fp-v8-button fp-v8-secondary" data-copy-template="' + escape(template.id) + '">复制到我的模板</button>' : ''}
        ${editable ? '<button class="fp-v8-button fp-v8-secondary" data-edit-template="' + escape(template.id) + '">编辑</button><button class="fp-v8-button fp-v8-danger" data-delete-template="' + escape(template.id) + '">移入回收站</button>' : ''}
      </div>
    </article>`;
  }

  function templatePreviewHtml(template) {
    const payload = template.payload || {};
    const fields = payload.fields || {};
    const branding = payload.branding || null;
    const note = payload.noteContent || '';
    const fieldRows = Object.entries(fields).map(([key, value]) =>
      `<tr><th>${escape(FIELD_DEFS[key]?.[0] || key)}</th><td>${escape(value)}</td></tr>`
    ).join('');

    return `<div class="fp-v8-editor fp-v9-preview">
      <div class="fp-v8-actions"><button class="fp-v8-button fp-v8-secondary" id="fpV8PreviewBack">← 返回模板列表</button></div>
      <h3>${escape(template.title)}</h3>
      <p class="fp-v9-preview-summary">${escape(template.summary || '')}</p>
      <div class="fp-v9-info-grid">
        <div><b>类别</b><span>${escape(CATEGORIES.find(item => item[0] === categoryOf(template))?.[1] || '单据模板')}</span></div>
        <div><b>单据类型</b><span>${escape(DOC_LABEL[template.document_type] || '资料模板')}</span></div>
        <div><b>行业</b><span>${escape((template.industry_tags || []).join('、') || '通用')}</span></div>
        <div><b>适用地区</b><span>${escape((template.country_tags || []).join('、') || '全球')}</span></div>
      </div>
      ${fieldRows ? `<table class="fp-v9-preview-table"><tbody>${fieldRows}</tbody></table>` : ''}
      ${note ? `<div class="fp-v9-note-content">${escape(note).replace(/\n/g, '<br>')}</div>` : ''}
      ${branding ? `<div class="fp-v9-theme-preview"><b>PDF 样式：</b>${escape(PDF_STYLES[branding.pdfStyle]?.label || '经典商务')} · ${escape(BRAND_THEMES[branding.theme]?.label || branding.theme || '自定义主题')}</div>` : ''}
      ${isFullTemplate(template) ? '<div class="fp-v8-alert fp-v8-vault-alert">完整模板会覆盖当前工作台的字段与商品明细。套用前建议先保存草稿。</div>' : ''}
      <div class="fp-v8-actions">
        <button class="fp-v8-button fp-v8-primary" id="fpV8PreviewUse">${branding && !fieldRows && !note ? '套用样式' : '套用到当前单据'}</button>
        ${template.template_scope === 'public' ? '<button class="fp-v8-button fp-v8-secondary" id="fpV8PreviewCopy">复制到我的模板</button>' : ''}
      </div>
    </div>`;
  }

  function bindPublicList() {
    const update = () => {
      state.publicCategory = $('#fpV8Category')?.value || 'all';
      state.publicDocType = $('#fpV8DocFilter')?.value || 'all';
      state.publicIndustry = $('#fpV8IndustryFilter')?.value || 'all';
      state.publicSearch = $('#fpV8Search')?.value || '';
      renderPanel();
    };
    $('#fpV8Category')?.addEventListener('change', update);
    $('#fpV8DocFilter')?.addEventListener('change', update);
    $('#fpV8IndustryFilter')?.addEventListener('change', update);
    $('#fpV8Search')?.addEventListener('input', update);
    $('#fpV8ResetFilters')?.addEventListener('click', () => {
      state.publicCategory = 'all';
      state.publicDocType = 'all';
      state.publicIndustry = 'all';
      state.publicSearch = '';
      renderPanel();
    });
    bindTemplateCardActions($('#fpV8Panel'));
  }

  function allVisibleTemplates() {
    return dedupeTemplates([...PUBLIC_DEMOS, ...PDF_STYLE_DEMOS, ...VIP_KNOWLEDGE_DEMOS, ...state.templates]);
  }

  function findTemplate(id) {
    return allVisibleTemplates().find(item => String(item.id) === String(id));
  }

  function useTemplate(template) {
    if (!template) return;
    const styleOnly = Boolean(template?.payload?.branding && !template?.payload?.fields && !isFullTemplate(template) && !template?.payload?.noteContent);
    if (styleOnly && !canUseBrandStudio()) {
      const message = '当前可以预览基础 PDF 样式；保存品牌样式需要登录并具备相应权限。';
      status(message, 'error');
      toast(message, 'error');
      if (state.tier === 'guest') requestLogin();
      return;
    }
    const result = { ok: false, cancelled: false, message: '' };
    document.dispatchEvent(new CustomEvent('HUIDI:apply-template', { detail: { template, result } }));
    const message = result.message || (result.ok ? `已套用“${template.title}”。` : `未能套用“${template.title}”。`);
    const type = result.ok ? 'ok' : (result.cancelled ? '' : 'error');
    status(message, type);
    toast(message, result.ok ? 'ok' : (result.cancelled ? 'info' : 'error'));
  }

  function bindTemplateCardActions(root) {
    if (!root) return;
    $$('[data-use-template]', root).forEach(button => {
      button.addEventListener('click', () => useTemplate(findTemplate(button.dataset.useTemplate)));
    });
    $$('[data-preview-template]', root).forEach(button => {
      button.addEventListener('click', () => {
        const template = findTemplate(button.dataset.previewTemplate);
        if (template) {
          state.preview = template;
          renderPanel();
        }
      });
    });
    $$('[data-copy-template]', root).forEach(button => {
      button.addEventListener('click', async () => copyToPrivate(findTemplate(button.dataset.copyTemplate)));
    });
    $$('[data-edit-template]', root).forEach(button => {
      button.addEventListener('click', () => {
        const template = findTemplate(button.dataset.editTemplate);
        if (template) {
          state.editor = structuredClone(template);
          renderPanel();
        }
      });
    });
    $$('[data-delete-template]', root).forEach(button => {
      button.addEventListener('click', async () => {
        const template = findTemplate(button.dataset.deleteTemplate);
        if (!template) return;
        if (!window.confirm('确认删除此模板吗？删除后会移入回收站，你可以在回收站内恢复。')) return;
        try {
          await api('archive_template', { templateId: template.id });
          await loadTemplates();
        } catch (error) {
          status(error.message, 'error');
        }
      });
    });
  }

  function bindPreviewPanel() {
    $('#fpV8PreviewBack')?.addEventListener('click', () => {
      state.preview = null;
      renderPanel();
    });
    $('#fpV8PreviewUse')?.addEventListener('click', () => useTemplate(state.preview));
    $('#fpV8PreviewCopy')?.addEventListener('click', () => copyToPrivate(state.preview));
  }

  async function copyToPrivate(template) {
    if (!template) return;
    const token = await accessToken();
    if (!token) {
      status('登录后才能复制公开模板到“我的私有模板”。', 'error');
      requestLogin();
      return;
    }
    try {
      const payload = structuredClone(template.payload || {});
      payload.templateMeta = {
        ...(payload.templateMeta || {}),
        copiedFromPublic: true,
        sourceTemplateTitle: template.title
      };
      await api('save_template', {
        template: {
          scope: 'private',
          title: `${template.title}（我的副本）`,
          summary: template.summary || '',
          documentType: template.document_type || 'proforma_invoice',
          industryTags: template.industry_tags || [],
          countryTags: template.country_tags || [],
          productTags: template.product_tags || [],
          payload
        }
      });
      const message = '已复制到“我的私有模板”。现在可在私有模板中继续编辑或套用。';
      status(message, 'ok');
      toast(message, 'ok');
      await loadTemplates();
    } catch (error) {
      status(error.message, 'error');
      toast(error.message, 'error');
    }
  }

  function vaultLockedHtml() {
    const setup = !state.vault.configured;
    const feedbackColor = state.vault.feedbackType === 'error' ? '#b42318'
      : state.vault.feedbackType === 'ok' ? '#147451' : '#5f6c7b';
    return `<div class="fp-v8-lock-panel">
      <h3>高级资料（暂未开放）</h3>
      <p>该区域暂未开放。内容不会出现在公开模板或其他用户的模板列表中。</p>
      ${state.vault.lockedUntil ? `<p>安全锁定至：${escape(new Date(state.vault.lockedUntil).toLocaleString('zh-CN'))}</p>` : ''}
      ${setup ? '<p>首次使用请设置一组至少 12 位、同时包含字母和数字的保险库密码。</p>' : ''}
      <div class="fp-v9-vault-fields">
        <label> ${setup ? '设置保险库密码' : '输入保险库密码'}<input id="fpV8VaultPassword" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" placeholder="${setup ? '至少 12 位，包含字母和数字' : '输入保险库密码'}"></label>
        ${setup ? '<label>确认保险库密码<input id="fpV8VaultConfirm" type="password" autocomplete="new-password" placeholder="请再次输入相同密码"></label>' : ''}
      </div>
      <p id="fpV8VaultFeedback" role="status" style="min-height:20px;margin:8px 0;color:${feedbackColor};font-size:12px;font-weight:700">${escape(state.vault.feedback || '')}</p>
      <button class="fp-v8-button fp-v8-orange" id="fpV8Unlock">${setup ? '设置并解锁' : '解锁保险库'}</button>
    </div>`;
  }

  function vaultFeedback(message = '', type = '') {
    state.vault.feedback = message;
    state.vault.feedbackType = type;
    const node = $('#fpV8VaultFeedback');
    if (node) {
      node.textContent = message;
      node.style.color = type === 'error' ? '#b42318' : type === 'ok' ? '#147451' : '#5f6c7b';
    }
  }

  function bindVaultLocked() {
    const password = $('#fpV8VaultPassword');
    const confirm = $('#fpV8VaultConfirm');
    const setup = !state.vault.configured;

    const validate = () => {
      if (!setup || !confirm) return;
      if (!password.value && !confirm.value) return vaultFeedback('');
      if (password.value !== confirm.value) return vaultFeedback('两次输入的保险库密码不一致，请重新确认。', 'error');
      const valid = /^(?=.*[A-Za-z])(?=.*\d).{12,}$/.test(password.value);
      vaultFeedback(valid ? '两次密码一致，可以设置并解锁。' : '密码至少 12 位，并且必须同时包含字母和数字。', valid ? 'ok' : 'error');
    };
    password?.addEventListener('input', validate);
    confirm?.addEventListener('input', validate);

    $('#fpV8Unlock')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const pwd = password?.value || '';
      try {
        if (!pwd) throw new Error('请输入保险库密码。');
        if (setup) {
          if (pwd !== (confirm?.value || '')) throw new Error('两次输入的保险库密码不一致，请重新确认。');
          if (!/^(?=.*[A-Za-z])(?=.*\d).{12,}$/.test(pwd)) throw new Error('密码至少 12 位，并且必须同时包含字母和数字。');
          button.disabled = true;
          button.textContent = '正在设置…';
          await api('set_vault_password', { password: pwd });
        }
        button.disabled = true;
        button.textContent = '正在解锁…';
        const data = await api('unlock_vault', { password: pwd });
        state.vault = { ...state.vault, ...(data.vault || {}), configured: true, active: true, feedback: '', feedbackType: '' };
        state.vaultToken = data.vaultToken || '';
        status('高级资料已由管理员启用。');
        await loadTemplates();
      } catch (error) {
        vaultFeedback(error.message || '保险库操作失败，请稍后重试。', 'error');
        status(error.message || '保险库操作失败。', 'error');
      } finally {
        button.disabled = false;
        button.textContent = setup ? '设置并解锁' : '解锁保险库';
      }
    });
  }

  function documentTypeOptions(selected) {
    return DOC_TYPES.map(([id, label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('');
  }

  function profileDocumentTypeOptions(selected) {
    const safe = DOC_PROFILE_TYPES.has(selected) ? selected : 'proforma_invoice';
    return DOC_TYPES.filter(([id]) => DOC_PROFILE_TYPES.has(id))
      .map(([id, label]) => `<option value="${id}" ${id === safe ? 'selected' : ''}>${label}</option>`)
      .join('');
  }

  function fieldValue(template, key) {
    const fields = template?.payload?.fields || template?.payload?.formFields || {};
    return fields[key] !== undefined && fields[key] !== null ? String(fields[key]) : '';
  }

  function templateMode(template) {
    const payload = template?.payload || {};
    if (payload.workspaceState || payload.state || payload.documentState || payload.templateMeta?.editorMode === 'full') return 'full';
    if (['knowledge_note', 'checklist'].includes(template?.document_type)) return 'note';
    return payload.templateMeta?.editorMode || 'fields';
  }

  function editorHtml(template) {
    const mode = templateMode(template);
    const type = DOC_PROFILE_TYPES.has(template.document_type || template.documentType) ? (template.document_type || template.documentType) : currentWorkspaceDocumentType();
    const keys = TYPE_FIELD_KEYS[type] || TYPE_FIELD_KEYS.proforma_invoice;
    const fieldInputs = keys.map(key => {
      const [label, placeholder] = FIELD_DEFS[key] || [key, ''];
      return `<label>${escape(label)}<input id="fpV8Field_${key}" value="${escape(fieldValue(template, key))}" placeholder="${escape(placeholder)}"></label>`;
    }).join('');
    const noteContent = template?.payload?.noteContent || '';
    const fullReady = Boolean(template?.payload?.workspaceState || template?.payload?.state || template?.payload?.documentState);
    const brand = Branding.get();

    return `<div class="fp-v8-editor fp-v9-editor">
      <div class="fp-v8-actions"><button class="fp-v8-button fp-v8-secondary" id="fpV8Back">← 返回模板列表</button></div>
      <div class="fp-v12-editor-guide">
        <b>${scopeLabel(template.scope || template.template_scope || state.tab)} · ${mode === 'full' ? '完整单据模板' : mode === 'note' ? '常用条款 / 说明' : '快捷字段模板'}</b>
        <p>${mode === 'full' ? '适合保存当前已经调好的完整单据。保存后再次套用，会带入客户、商品、金额、条款和 PDF 样式。' : mode === 'note' ? '适合保存常用付款说明、交期说明、售后备注或团队内部提示。' : '适合只保存少量经常重复填写的字段，例如卖方资料、付款条款、物流说明或备注。'}</p>
      </div>
      <div class="fp-v8-form-grid">
        <label>模板名称<input id="fpV8Title" value="${escape(template.title || '')}" placeholder="例如：老客户报价单模板 / 30% 付款条款"></label>
        <label>适用单据<select id="fpV8DocType">${profileDocumentTypeOptions(type)}</select></label>
      </div>
      <label>一句话说明<input id="fpV8Summary" value="${escape(template.summary || '')}" placeholder="说明什么时候使用这个模板，例如：美国客户常用 FOB 报价"></label>
      <details class="fp-v12-template-advanced-tags">
        <summary>可选：搜索标签</summary>
        <div class="fp-v8-form-grid">
          <label>行业 / 场景标签<input id="fpV8Industry" value="${escape((template.industry_tags || []).join(', '))}" placeholder="例如：通用外贸, 美妆, 家居"></label>
          <label>国家 / 地区标签<input id="fpV8Country" value="${escape((template.country_tags || []).join(', '))}" placeholder="例如：美国, 欧盟, 中东"></label>
        </div>
        <label>产品标签<input id="fpV8Product" value="${escape((template.product_tags || []).join(', '))}" placeholder="例如：香水礼盒, 服饰, 收纳用品"></label>
      </details>

      <div class="fp-v8-note fp-v12-simple-note"><b>使用说明：</b>不用把所有内容都填满。完整单据模板适合保存当前页面；快捷字段只填需要复用的字段；常用条款只写对外说明或内部提示。</div>

      <div class="fp-v8-actions fp-v9-mode-tabs">
        <button class="fp-v8-button ${mode === 'full' ? 'fp-v8-primary' : 'fp-v8-secondary'}" id="fpV8FullMode">完整单据模板</button>
        <button class="fp-v8-button ${mode === 'fields' ? 'fp-v8-primary' : 'fp-v8-secondary'}" id="fpV8FieldsMode">快捷字段模板</button>
        <button class="fp-v8-button ${mode === 'note' ? 'fp-v8-primary' : 'fp-v8-secondary'}" id="fpV8NoteMode">常用条款 / 说明</button>
      </div>

      <div id="fpV8EditorModePanel">
        ${mode === 'full' ? `
          <div class="fp-v8-alert fp-v8-vault-alert"><b>保存当前完整单据</b><br>会保存当前客户、商品、金额、付款、物流、条款、翻译版本与 PDF 样式。套用完整模板会覆盖当前单据，建议先保存草稿。</div>
          <div class="fp-v8-actions"><button class="fp-v8-button fp-v8-primary" id="fpV8CaptureCurrent">重新读取当前单据</button></div>
          <p class="fp-v8-note" id="fpV8CaptureStatus">${fullReady ? '已读取当前完整单据；修改名称后可直接保存。' : '尚未读取当前单据。点击上方按钮后再保存模板。'}</p>
        ` : mode === 'note' ? `
          <div class="fp-v8-alert"><b>常用条款 / 说明</b><br>每行写一段常用内容，例如付款条款、交期说明、售后说明、装箱提醒或团队内部注意事项。套用时不会覆盖整份单据。</div>
          <label>内容<textarea id="fpV8NoteContent" placeholder="例如：30% T/T deposit, 70% balance before shipment.&#10;例如：Packaging artwork must be confirmed before mass production.">${escape(noteContent)}</textarea></label>
        ` : `
          <div class="fp-v8-alert"><b>${escape(DOC_LABEL[type] || '快捷字段模板')}</b><br>只填你想复用的字段，其他可以留空。套用时只写入这些字段，不会清空当前单据其他内容。</div>
          <div class="fp-v8-form-grid">${fieldInputs || '<div class="fp-v8-empty">此类型建议使用“常用条款 / 说明”模式。</div>'}</div>
        `}
      </div>

      <div class="fp-v9-brand-inline"><span>当前 PDF 样式：<b>${escape(PDF_STYLES[brand.pdfStyle]?.label || '经典商务')} · ${escape(BRAND_THEMES[brand.theme]?.label || brand.theme)}</b></span><button class="fp-v8-button fp-v8-secondary" id="fpV8OpenBrand">调整样式与 Logo</button></div>
      <div class="fp-v8-actions"><button class="fp-v8-button fp-v8-primary" id="fpV8Save">保存模板</button></div>
    </div>`;
  }

  function parseTags(value) {
    return String(value || '').split(/[,，]/).map(item => item.trim()).filter(Boolean);
  }

  function captureEditorDraft() {
    if (!state.editor || !$('#fpV8Title')) return;
    const current = state.editor;
    current.title = $('#fpV8Title')?.value || current.title || '';
    current.summary = $('#fpV8Summary')?.value || current.summary || '';
    current.document_type = $('#fpV8DocType')?.value || current.document_type || 'proforma_invoice';
    current.industry_tags = parseTags($('#fpV8Industry')?.value || '');
    current.country_tags = parseTags($('#fpV8Country')?.value || '');
    current.product_tags = parseTags($('#fpV8Product')?.value || '');
    current.payload = current.payload || {};
    const fields = { ...(current.payload.fields || {}) };
    Object.keys(FIELD_DEFS).forEach(key => {
      const input = $(`#fpV8Field_${key}`);
      if (input) {
        if (input.value.trim()) fields[key] = input.value.trim();
        else delete fields[key];
      }
    });
    current.payload.fields = fields;
    const note = $('#fpV8NoteContent');
    if (note) current.payload.noteContent = note.value;
  }

  function bindEditor() {
    $('#fpV8Back')?.addEventListener('click', () => {
      captureEditorDraft();
      state.editor = null;
      renderPanel();
    });

    $('#fpV8DocType')?.addEventListener('change', event => {
      captureEditorDraft();
      state.editor.document_type = event.target.value;
      renderPanel();
    });

    $('#fpV8FieldsMode')?.addEventListener('click', () => {
      captureEditorDraft();
      state.editor.payload = { ...(state.editor.payload || {}), templateMeta: { ...(state.editor.payload?.templateMeta || {}), editorMode: 'fields' } };
      renderPanel();
    });

    $('#fpV8FullMode')?.addEventListener('click', () => {
      captureEditorDraft();
      state.editor.payload = { ...(state.editor.payload || {}), templateMeta: { ...(state.editor.payload?.templateMeta || {}), editorMode: 'full' } };
      renderPanel();
    });

    $('#fpV8NoteMode')?.addEventListener('click', () => {
      captureEditorDraft();
      state.editor.payload = { ...(state.editor.payload || {}), templateMeta: { ...(state.editor.payload?.templateMeta || {}), editorMode: 'note' } };
      renderPanel();
    });

    $('#fpV8OpenBrand')?.addEventListener('click', () => {
      captureEditorDraft();
      state.tab = 'pdf_brand';
      renderModal();
    });

    $('#fpV8CaptureCurrent')?.addEventListener('click', () => {
      const fullState = window.FlypigBOXApp?.formState?.(true);
      if (!fullState) {
        status('当前工作台尚未准备完成，请刷新页面后重试。', 'error');
        return;
      }
      captureEditorDraft();
      state.editor.payload = {
        ...(state.editor.payload || {}),
        workspaceState: fullState,
        branding: Branding.exportForTemplate(),
        templateMeta: {
          ...(state.editor.payload?.templateMeta || {}),
          sourceLanguage: 'en',
          editorMode: 'full',
          templateKind: 'full_workspace',
          capturedAt: new Date().toISOString()
        }
      };
      const hint = $('#fpV8CaptureStatus');
      if (hint) hint.textContent = '已读取当前完整单据与 PDF 样式，点击“保存模板”即可保存。';
      status('已读取当前单据。保存后可一键完整套用。', 'ok');
    });

    $('#fpV8Save')?.addEventListener('click', async () => {
      try {
        captureEditorDraft();
        const current = state.editor || {};
        const title = String(current.title || '').trim();
        if (!title) throw new Error('请填写模板名称。');

        const type = current.document_type || 'proforma_invoice';
        const mode = templateMode(current);
        let payload = current.payload || {};

        if (mode === 'full') {
          const fullState = payload.workspaceState || payload.state || payload.documentState;
          if (!fullState || typeof fullState !== 'object') throw new Error('请先点击“读取当前单据作为完整模板”。');
          payload = {
            workspaceState: fullState,
            branding: payload.branding || Branding.exportForTemplate(),
            templateMeta: { ...(payload.templateMeta || {}), sourceLanguage: 'en', editorMode: 'full', templateKind: 'full_workspace' }
          };
        } else if (mode === 'note') {
          const noteContent = String(payload.noteContent || '').trim();
          if (!noteContent) throw new Error('请至少填写一项资料内容。');
          payload = {
            noteContent,
            templateMeta: { ...(payload.templateMeta || {}), category: 'clause', editorMode: 'note', templateKind: 'common_note' }
          };
        } else {
          const fields = payload.fields || {};
          if (!Object.keys(fields).length) throw new Error('请至少填写一项可套用内容，或改用“完整单据模板”。');
          payload = {
            fields,
            templateMeta: { ...(payload.templateMeta || {}), sourceLanguage: 'en', editorMode: 'fields', templateKind: 'common_fields' }
          };
        }

        await api('save_template', {
          template: {
            id: current.id || '',
            scope: current.template_scope || current.scope || state.tab,
            title,
            summary: current.summary || '',
            documentType: type,
            industryTags: current.industry_tags || [],
            countryTags: current.country_tags || [],
            productTags: current.product_tags || [],
            payload
          }
        });

        state.editor = null;
        const message = '模板已保存。套用后会自动选择对应单据字段；可继续在主页面补充和修改。';
        status(message, 'ok');
        toast(message, 'ok');
        await loadTemplates();
      } catch (error) {
        const message = error.message || '模板保存失败。';
        status(message, 'error');
        toast(message, 'error');
      }
    });
  }

  function brandPanelHtml() {
    const brand = Branding.get();
    const activeColor = brand.brandColor || BRAND_THEMES[brand.theme]?.color || '#0f7bdc';
    const activeThemeLabel = BRAND_THEMES[brand.theme]?.label || '自定义主色';
    const activeStyleLabel = PDF_STYLES[brand.pdfStyle]?.label || '商务标准模板';
    const logoText = brand.logo ? (brand.logoScope === 'none' ? 'Logo 已上传，当前不显示' : 'Logo 已上传') : '未上传 Logo';
    const headerText = brand.headerText ? '页头已填写' : '页头未填写';
    const footerText = (brand.showFooter || brand.footerText) ? '页脚已开启' : '页脚未开启';
    const styleTemplates = filteredTemplatesForTab('pdf_brand');
    const styleCards = styleTemplates.map(template => {
      const branding = template?.payload?.branding || {};
      const id = PDF_STYLES[branding.pdfStyle] ? branding.pdfStyle : 'classic_business';
      const style = PDF_STYLES[id] || PDF_STYLES.classic_business;
      const selected = brand.pdfStyle === id;
      return `<button type="button" class="fp-v9-style-card ${selected ? 'is-selected' : ''}" data-pdf-style="${escape(id)}" aria-pressed="${selected}">
        <span class="fp-v10-style-thumb fp-v10-style-thumb-${escape(id)}" aria-hidden="true"><i></i><i></i><i></i></span>
        <b>${escape(template.title || style.label)}</b><small>${escape(template.summary || style.note)}</small>
      </button>`
    }).join('');
    const styleGrid = styleCards
      ? `<div class="fp-v9-style-grid">${styleCards}</div>`
      : '<div class="fp-v8-empty">暂无符合筛选条件的 PDF 样式。请清除筛选后再选择。</div>';
    const colorPresets = Object.entries(BRAND_THEMES).map(([id, theme]) =>
      `<button type="button" class="fp-v10-color-chip ${brand.theme === id && activeColor === theme.color ? 'is-selected' : ''}" data-brand-color-preset="${id}" aria-pressed="${brand.theme === id && activeColor === theme.color}">
        <span style="background:${escape(theme.color)}"></span>${escape(theme.label)}
      </button>`
    ).join('');
    return `<div class="fp-v8-editor fp-v9-brand-studio">
      <div class="fp-v8-alert"><b>PDF 样式与品牌</b><br>这里仅控制 PDF 版式、统一品牌主色、Logo 与页脚。单据类型由编辑器当前单据决定，切换样式不会改写已填写内容或金额来源。</div>
      ${filterBarHtml(styleTemplates.length, '个 PDF 样式', 'pdf_brand')}
      <div class="fp-v10-brand-summary">
        <div><span>当前 PDF 版式</span><b>${escape(activeStyleLabel)}</b></div>
        <div><span>统一品牌主色</span><b><i style="background:${escape(activeColor)}"></i>${escape(activeThemeLabel)} · ${escape(activeColor)}</b></div>
        <div><span>Logo / 页头页脚</span><b>${escape(logoText)} · ${escape(headerText)} · ${escape(footerText)}</b></div>
      </div>
      <div class="fp-v9-style-section"><h3>PDF 版式</h3><p>选择后会立即刷新右侧 PDF 预览。五类单据仍使用各自独立的 PDF 结构。</p>${styleGrid}</div>
      <div class="fp-v10-brand-color-panel">
        <div>
          <h3>统一品牌主色</h3>
          <p>一个颜色控制 PDF 页眉线条、分区标题、表头和重点金额；预设色和自定义色不会重复保存两套配置。</p>
        </div>
        <label class="fp-v10-color-picker"><span>主色</span><input id="fpBrandColor" type="color" value="${escape(activeColor)}"></label>
        <div class="fp-v10-color-chip-row">${colorPresets}</div>
      </div>
      <details class="fp-v10-brand-advanced">
        <summary>Logo、页头与页脚（高级设置）</summary>
        <div class="fp-v8-form-grid">
          <label>Logo 位置<select id="fpBrandPosition"><option value="left" ${brand.logoPosition === 'left' ? 'selected' : ''}>左上角（推荐）</option><option value="center" ${brand.logoPosition === 'center' ? 'selected' : ''}>顶部居中</option><option value="right" ${brand.logoPosition === 'right' ? 'selected' : ''}>右上角</option></select></label>
          <label>Logo 显示范围<select id="fpBrandScope"><option value="first_page" ${brand.logoScope === 'first_page' ? 'selected' : ''}>单据顶部 / PDF 首页（推荐）</option><option value="none" ${brand.logoScope === 'none' ? 'selected' : ''}>不显示 Logo</option></select></label>
        </div>
        <label>页头内容（可选）<input id="fpBrandHeaderText" value="${escape(brand.headerText || '')}" placeholder="例如：HUIDI Trading · sales@example.com"></label>
        <label class="fp-v9-checkbox"><input id="fpBrandFooterEnabled" type="checkbox" ${brand.showFooter ? 'checked' : ''}> 在 PDF 底部显示公司联系信息</label>
        <label>页脚内容（可选）<input id="fpBrandFooterText" value="${escape(brand.footerText || '')}" placeholder="例如：www.example.com · sales@example.com · +86 0000 0000"></label>
        <div class="fp-v9-logo-box">
          <div><b>公司 Logo</b><small>推荐透明 PNG、WEBP 或 SVG，文件不超过 1MB。用于预览与 PDF 导出。</small></div>
          ${brand.logo ? '<img class="fp-v9-logo-preview" src="' + brand.logo + '" alt="Logo preview">' : '<span class="fp-v9-logo-empty">尚未上传 Logo</span>'}
          <div class="fp-v8-actions"><label class="fp-v8-button fp-v8-secondary fp-v9-upload">上传 Logo<input id="fpBrandLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>${brand.logo ? '<button class="fp-v8-button fp-v8-danger" id="fpBrandClearLogo">移除 Logo</button>' : ''}</div>
        </div>
      </details>
      <div class="fp-v8-actions">
        <button class="fp-v8-button fp-v8-primary" id="fpBrandSave">保存并应用</button>
        <button class="fp-v8-button fp-v8-secondary" id="fpBrandReset">恢复默认样式</button>
      </div>
    </div>`;
  }

  function bindBrandPanel() {
    $$('[data-brand-color-preset]').forEach(button => {
      button.addEventListener('click', () => {
        if (!guardBrandStudioAction()) return;
        const theme = BRAND_THEMES[button.dataset.brandColorPreset];
        if (!theme) return;
        Branding.set({ theme: button.dataset.brandColorPreset, brandColor: theme.color });
        renderPanel();
      });
    });

    $$('[data-pdf-style]').forEach(button => {
      button.addEventListener('click', () => {
        if (!guardBrandStudioAction()) return;
        Branding.set({ pdfStyle: button.dataset.pdfStyle });
        renderPanel();
      });
    });

    const colorInput = $('#fpBrandColor');
    colorInput?.addEventListener('input', event => {
      if (!guardBrandStudioAction()) return;
      Branding.set({ brandColor: event.currentTarget.value || '#0f7bdc' });
    });
    colorInput?.addEventListener('change', () => renderPanel());

    $('#fpBrandLogoFile')?.addEventListener('change', async event => {
      if (!guardBrandStudioAction()) {
        event.target.value = '';
        return;
      }
      try {
        const before = Branding.get();
        await Branding.readLogo(event.target.files?.[0]);
        if (before.logoScope === 'none') Branding.set({ logoScope: 'first_page' });
        const message = 'Logo 已保存到当前浏览器，并已设为显示在 PDF 首页。请点击“保存并应用”确认其他品牌设置。';
        status(message, 'ok');
        toast(message, 'ok');
        renderPanel();
      } catch (error) {
        status(error.message, 'error');
        toast(error.message, 'error');
      }
    });

    $('#fpBrandClearLogo')?.addEventListener('click', () => {
      if (!guardBrandStudioAction()) return;
      Branding.clearLogo();
      const message = 'Logo 已移除；主题和页脚设置未受影响。';
      status(message, 'ok');
      toast(message, 'ok');
      renderPanel();
    });

    $('#fpBrandSave')?.addEventListener('click', () => {
      if (!guardBrandStudioAction()) return;
      const prior = Branding.get();
      const logoScope = $('#fpBrandScope')?.value || 'first_page';
      const showFooter = Boolean($('#fpBrandFooterEnabled')?.checked);
      const headerText = $('#fpBrandHeaderText')?.value || '';
      const footerText = $('#fpBrandFooterText')?.value || '';
      const applied = Branding.set({
        brandColor: $('#fpBrandColor')?.value || BRAND_THEMES[prior.theme]?.color || '#0f7bdc',
        logoPosition: $('#fpBrandPosition')?.value || 'left',
        logoScope,
        headerText,
        showFooter: showFooter || Boolean(String(footerText).trim()),
        footerText
      });
      const notes = [];
      if (logoScope !== 'none' && !applied.logo) notes.push('尚未上传 Logo，因此当前仅应用主题与排版');
      if (logoScope === 'none') notes.push('当前设置为不显示 Logo');
      if ((showFooter || String(footerText).trim()) && !String(footerText).trim()) notes.push('页脚将自动读取卖方公司、邮箱、电话和地址；请先在主表单补充卖方信息');
      const message = `已保存并应用：${PDF_STYLES[applied.pdfStyle]?.label || '商务标准模板'} · 主色 ${applied.brandColor || BRAND_THEMES[applied.theme]?.color || '#0f7bdc'}。${notes.length ? ' ' + notes.join('；') + '。' : ' PDF 预览与导出文件已同步更新。'}`;
      status(message, 'ok');
      toast(message, 'ok');
      renderPanel();
    });

    $('#fpBrandReset')?.addEventListener('click', () => {
      if (!guardBrandStudioAction()) return;
      Branding.set({ pdfStyle: 'classic_business', theme: 'business_blue', brandColor: BRAND_THEMES.business_blue.color, logoPosition: 'left', logoScope: 'first_page', showFooter: false, headerText: '', footerText: '' });
      const message = '已恢复默认 PDF 样式与标准商务蓝主色。';
      status(message, 'ok');
      toast(message, 'ok');
      renderPanel();
    });
  }

  async function loadTemplates() {
    const token = await accessToken();
    if (!token) {
      state.tier = 'guest';
      state.templates = [];
      state.vaultToken = '';
      status(isLocalPreview ? '当前为本地预览模式：公开模板可以浏览；私有模板、团队模板和行业资料需要进入线上版登录后使用。' : '当前身份为游客：公开模板可以浏览；登录后可使用私有模板、团队模板和行业资料。');
      renderModal();
      return;
    }
    try {
      status('正在加载权限允许的模板…');
      const data = await api('list_templates');
      state.templates = data.templates || [];
      state.tier = data.tier || 'free';
      state.vault = { ...state.vault, ...(data.vault || {}) };
      if (!state.vault.active) state.vaultToken = '';
      status(`已加载 ${state.templates.length} 个账号模板；公开示范模板始终可浏览。`);
      renderModal();
    } catch (error) {
      state.templates = [];
      const raw = String(error?.message || '');
      const message = /failed to fetch|network|load failed|fetch/i.test(raw)
        ? '当前无法连接云端模板服务；公开模板仍可浏览。请检查网络，或进入线上版重新登录。'
        : (raw || '模板暂时无法加载；公开模板仍可浏览。');
      status(message, 'error');
      renderModal();
    }
  }

  function open(options = {}) {
    state.opened = true;
    state.preview = null;
    state.editor = null;
    if (options.tab) state.tab = options.tab;
    if (options.category) state.publicCategory = options.category;
    if (options.docType) state.publicDocType = options.docType;
    if (options.industry) state.publicIndustry = options.industry;
    if (typeof options.search === 'string') state.publicSearch = options.search;
    renderModal();
    loadTemplates();
  }

  function close() {
    captureEditorDraft();
    state.opened = false;
    state.preview = null;
    state.editor = null;
    renderModal();
  }

  function mount() {
    if ($('#fpV8Root')) return;
    const root = document.createElement('div');
    root.id = 'fpV8Root';
    document.body.appendChild(root);

    const button = document.createElement('button');
    button.className = 'fp-v8-trigger';
    button.type = 'button';
    button.textContent = '模板中心';
    button.addEventListener('click', open);
    const target = document.querySelector(cfg.mountSelector || '.site-header, header, .app-header');
    if (target) target.appendChild(button);
    else {
      button.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9990';
      document.body.appendChild(button);
    }

    Branding.observe();
    document.dispatchEvent(new CustomEvent('HUIDI:branding-ready', { detail: Branding.get() }));
    renderModal();
  }

  window.FlypigBOXTemplateCenter = {
    open,
    close,
    mount,
    refresh: loadTemplates,
    onApplyTemplate: null
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
