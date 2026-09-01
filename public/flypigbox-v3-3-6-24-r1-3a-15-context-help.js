/* HUIDI V3.3.6.24-R1.3A.15 — clean form and on-demand trade knowledge. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.15';
  const $=id=>document.getElementById(id);
  const text=value=>String(value??'').replace(/\s+/g,' ').trim();
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const list=value=>Array.isArray(value)?value.filter(Boolean):String(value||'').split('|').map(text).filter(Boolean);

  const K=(title,plain,professional,used,example,watch)=>({title,plain,professional,used:list(used),example,watch:list(watch)});
  const KNOWLEDGE={
    docLanguage:K('单据语言','决定客户最终看到的固定标题和字段名使用中文、英文还是中英双语。','这里只控制系统固定文字。公司名称、型号、编号、金额、HS Code、SWIFT 和 Incoterms® 缩写不会被系统擅自翻译。','所有单据','给中国内部审核可选中文；发给海外客户通常选英文或中英双语。','切换语言不会自动把你手工输入的业务内容全部翻译。'),
    currency:K('主币种','这张单据里价格和总金额使用的货币。','商品单价、费用、折扣、税费、合计和金额大写应使用同一主币种。','报价单|PI|商业发票|销售合同','USD、EUR、CNY。','不要只改币种符号而不核对原金额；切换币种不等于自动完成真实汇率换算。'),
    originCountry:K('原产国','商品实际生产或取得原产资格的国家，不一定等于卖方公司所在国家。','原产国会影响清关、关税、原产地规则和部分贸易限制。','商业发票|装箱单|精细版报价单或PI','China / 中国。','不要仅凭发货地判断原产国；正式申报前应结合商品和原产地规则确认。'),
    documentNo:K('单据编号','给这张文件一个唯一号码，方便客户、订单、付款和后续单据互相对应。','编号应保持唯一、稳定，并在发送客户后锁定。报价单、PI、CI、PL 和合同可使用不同前缀。','所有单据','PI-2607-US01-001。','文件发送后不要直接改原编号；需要修改时优先新建修订版本。'),
    validity:K('有效期','告诉客户这份报价或PI在什么日期前有效。','有效期可限制价格、汇率、运费和供货条件的承诺时间。','报价单|形式发票PI','Valid until 15 Aug 2026。','商业发票和装箱单通常不需要报价有效期。'),
    customerPo:K('客户 PO','客户自己的采购订单编号。','PO 是 Purchase Order 的简称，用于把你的单据与客户内部采购订单对应。','报价单|PI|商业发票|装箱单|销售合同','PO-2026-0186。','不要把你自己的订单号误填为客户PO。'),
    quoteNo:K('关联报价编号','说明当前PI、合同或订单是从哪一份报价转过来的。','用于追踪价格来源和版本关系，避免后续核对时找不到原报价。','PI|销售合同|工作台单据链','QT-2607-US01-003。','报价更新后生成新PI时，应确认关联的是最终报价版本。'),
    moq:K('MOQ 最小起订量','低于这个数量，工厂可能不接单，或需要重新计算价格。','MOQ 是 Minimum Order Quantity。它可以按整单、单个型号、颜色、尺寸或包装分别计算。','报价单|PI|商品资料','500 PCS / color。','不要把MOQ当成客户本次实际订购数量；需要说明MOQ按什么维度计算。'),
    salesperson:K('业务员','这笔业务由谁负责跟进。','可用于内部责任分配，也可在客户文件中显示联系人。','报价单|PI|销售合同','Amy Chen。','没有必要时可以不进入客户文件。'),
    revision:K('修订版本','同一编号内容改了几次。','R0通常代表初版，R1、R2代表后续修订。发送客户后应保留旧版本，避免覆盖历史。','所有单据与工作台版本记录','R0、R1、Rev.02。','版本号变化不等于单据编号必须变化，具体规则应由企业统一。'),
    productionStart:K('生产启动条件','满足哪些条件后工厂才能正式开工。','常见条件包括定金到账、PI签回、样品确认、图纸确认、包装确认等。','PI|销售合同|内部订单','收到30%定金并确认图纸后开始生产。','条件写得不清楚，容易造成交期从哪一天开始计算的争议。'),
    sampleApproval:K('样品确认','量产前是否需要客户确认样品。','可区分无需样品、待客户确认和已经确认，适合定制或质量要求较高的订单。','PI|销售合同|内部订单','客户书面确认金样后量产。','不要只口头确认；重要定制订单应保留确认记录。'),
    artworkApproval:K('图稿与包装确认','标签、彩盒、说明书、条码、唛头等是否已经确认。','包装和图稿错误通常会影响整批货物，确认节点应与生产启动条件关联。','PI|销售合同|装箱资料|内部订单','Artwork approved on 29 Jul 2026。','未经确认直接量产可能导致重做或索赔。'),
    inspectionStandard:K('检验标准','用什么标准判断产品合格。','可以使用双方确认样品、图纸、技术规格或AQL抽样标准。','PI|销售合同|内部验货资料','AQL 2.5 / 4.0，或按确认样品检验。','AQL不是产品质量的全部定义，仍需写清关键规格和外观要求。'),
    qualityTolerance:K('公差','尺寸、颜色、重量或工艺允许有多大偏差。','定制产品应尽量使用可测量的范围，避免只写“基本一致”。','PI|销售合同|产品规格','尺寸公差 ±0.2 mm。','没有确认公差时，买卖双方对“合格”的理解可能不同。'),
    warranty:K('质保与售后','出现质量问题后，卖方负责到什么程度、持续多久。','质保条款应说明起算时间、范围、排除情况、处理方式和证据要求。','报价单|PI|销售合同','发货日起12个月有限质保，不含误用和擅自改装。','不要只写“终身质保”等无法兑现的表述。'),
    taxId:K('Tax ID / VAT / EORI','企业在税务、欧盟增值税或海关系统中的识别号码。','Tax ID 是税号统称；VAT No. 常用于增值税；EORI 常用于欧盟海关业务。不同号码不能随意互相代替。','商业发票|销售合同|部分PI','VAT No.: DE123456789；EORI: DE123456789012345。','不确定时保持空白并向客户、财务或报关人员确认，不要猜测。'),
    countryCode:K('国家代码','用两位字母代表国家，例如美国是US、日本是JP。','通常采用ISO 3166-1 alpha-2代码，可用于客户分类、编号和数据同步。','客户资料|工作台|单据编号','US、DE、JP。','英国通常使用GB，不是UK作为正式ISO两位代码。'),
    consignee:K('Consignee 收货人','实际接收货物的公司或个人。','收货人可以与付款买方不同，尤其是代理采购、第三方仓库或跨国集团订单。','商业发票|装箱单|提单资料','Buyer warehouse / third-party consignee。','买方与收货人不同时必须核对公司名和完整地址。'),
    notifyParty:K('Notify Party 通知方','货物到港或即将交付时，需要被通知的人或公司。','通知方常见于海运和提单资料，可以与买方或收货人相同。','商业发票|装箱单|提单资料','客户指定货代或进口代理。','没有明确要求时不要重复输出一套相同资料。'),
    billTo:K('Bill To 账单地址','发票或账单应开给哪个主体和地址。','付款主体、签约主体与实际收货地址不同时使用。','报价单|PI|销售合同|商业发票','集团总部付款，海外仓收货。','账单地址不等于收货地址。'),
    shipTo:K('Ship To 送货地址','货物最终送到哪里。','适用于门到门、海外仓、第三方仓库或一个买方多个交付地址的情况。','PI|商业发票|装箱单','Buyer Warehouse, full postal address。','应包含城市、邮编和国家；不要只写公司名称。'),
    extraFee:K('附加费用','商品金额之外需要客户承担的费用。','可能包括运费、保险费、模具费、文件费或特殊包装费，并应明确是否计入总计。','报价单|PI|商业发票|销售合同','Freight USD 220。','不要把不计入总计的参考费用误算进应付金额。'),
    vatAmount:K('VAT 税费','增值税或其他需要单独列示的税费金额。','是否收取、税率和开票方式取决于交易地区、主体和税务安排。','报价单|PI|商业发票|销售合同','VAT 20% 或 Tax USD 100。','跨境订单不能凭经验随意添加VAT；应由财务或税务人员确认。'),
    discount:K('折扣','从商品或订单金额中扣减的金额。','可以按百分比或固定金额计算，正式文件应明确折扣后的最终总额。','报价单|PI|商业发票|销售合同','5% discount 或 USD 100 discount。','注意折扣是否作用于运费、税费和其他费用。'),
    amountWords:K('金额大写','用英文文字再写一遍最终金额。','常用于银行、合同或客户格式要求，应与数字总金额和币种完全一致。','PI|商业发票|销售合同','USD Nine Hundred Sixty-Eight Only。','手工覆盖后必须再次核对，避免数字和文字不一致。'),
    destinationPort:K('目的港 / 目的地','货物计划送到哪个港口、机场、城市或最终地址。','具体写法应与运输方式和贸易术语一致；海运常写目的港，门到门订单可写最终交付地址。','报价单|PI|商业发票|装箱单|销售合同','Los Angeles Port, USA。','目的港不一定等于最终送货地址；使用DAP或DDP时尤其要写清指定地点。'),
    logisticsCarrier:K('承运人 / 货代','负责安排或实际运输这票货的公司。','Carrier通常指承运人，Forwarder通常指货运代理；两者可能不是同一家公司。','商业发票|装箱单|发货记录','DHL、Maersk、客户指定货代。','未订舱或未确认时保持空白，不要把供应商名称填成承运人。'),
    packageDimensions:K('单箱尺寸','一个外箱或包装单位的长、宽、高。','尺寸应带单位，可用于计算体积、仓储和运费。','装箱单|物流资料','60 × 40 × 35 cm / carton。','所有尺寸必须使用同一单位；不同箱型应分别记录。'),
    packagingApproval:K('包装确认要求','量产或出货前，哪些包装资料需要客户确认。','可包含彩盒、标签、条码、说明书、唛头、外箱材质和装箱方式。','PI|销售合同|内部订单','量产前确认彩盒、条码和外箱唛头。','包装确认和图稿确认应保留版本与日期，避免使用旧稿。'),
    shippingMethod:K('运输方式','货物主要通过海运、空运、快递、铁路还是陆运。','运输方式会影响适用的贸易术语、物流编号和预计时间。','PI|商业发票|装箱单|销售合同','Sea freight / Air freight / Express。','FOB、CFR、CIF通常用于海运或内河运输，不适合普通空运。'),
    packageCount:K('Packages 总件数','本票货物一共有多少个外包装单位。','可能是箱、托盘、木箱、袋或卷，应与包装类型一起看。','商业发票|装箱单|物流资料','25 CTNS 或 3 PALLETS。','总件数不一定等于商品数量。'),
    packageType:K('包装类型','货物外包装是什么。','常见为Carton、Pallet、Wooden Case、Bag、Roll。','PI|商业发票|装箱单','Export carton / wooden case。','木质包装涉及检疫时，应确认是否需要熏蒸或IPPC标识。'),
    netWeight:K('N.W. 净重','只计算货物本身的重量，不含外包装。','N.W. 是 Net Weight。','商业发票|装箱单|物流资料','N.W. 520 KG。','不要与毛重互换。'),
    grossWeight:K('G.W. 毛重','货物加上包装后的总重量。','G.W. 是 Gross Weight，承运人和货代通常更关心毛重。','商业发票|装箱单|物流资料','G.W. 560 KG。','正常情况下毛重不应小于净重。'),
    cbm:K('CBM 体积','货物占用多少立方米空间。','CBM 是 Cubic Meter，常用于海运拼箱、仓储和运费估算。','商业发票|装箱单|物流资料','1.26 CBM。','单位是立方米，不是平方米；尺寸换算时要统一单位。'),
    trackingNo:K('运单号 / Tracking No.','承运人用于查询运输状态的号码。','快递常用Tracking No.，空运可能使用AWB No.，不同运输方式编号名称不同。','商业发票|装箱单|发货记录','DHL 1234567890 或 AWB 999-12345678。','尚未出运时保持空白，不要用订单号代替。'),
    blNo:K('B/L No. 提单号','海运提单的编号。','B/L 是 Bill of Lading，是承运人或货代签发的重要运输单据。','商业发票|装箱单|发货记录','OOLU1234567890。','提单号通常在订舱后或开船前后产生，PI阶段不应随便预填。'),
    containerNo:K('Container No. 柜号','海运集装箱的唯一编号。','标准柜号通常由4个字母和7个数字组成。','商业发票|装箱单|发货记录','MSCU1234567。','柜号与封条号是两回事。'),
    sealNo:K('Seal No. 封条号','集装箱装货后用于封柜的封条编号。','用于核对运输途中集装箱是否被异常开启。','装箱单|发货记录','SEAL123456。','装柜前通常没有最终封条号。'),
    vesselFlight:K('船名 / 航班 / 车次','实际承运货物的船舶、航班或铁路车次。','根据运输方式填写对应信息。','商业发票|装箱单|发货记录','COSCO STAR / CA123。','不要把承运公司名称误填为船名或航班。'),
    etd:K('ETD','预计离开起运港或起运地的时间。','ETD 是 Estimated Time of Departure。','商业发票|装箱单|发货记录','ETD 5 Aug 2026。','这是预计时间，变更后应更新工作台记录，不应覆盖已发送历史版本。'),
    eta:K('ETA','预计到达目的港或目的地的时间。','ETA 是 Estimated Time of Arrival。','商业发票|装箱单|发货记录','ETA 26 Aug 2026。','ETA不是承诺到货日期，可能受船期、清关和末端派送影响。'),
    shippingMarks:K('Shipping Marks 唛头','印在外箱或包装上的识别信息。','常包含客户简称、订单号、目的港、箱号、产地或特殊搬运标志。','装箱单|包装资料|商业发票','ABC / PO123 / LOS ANGELES / CTN 1-10。','唛头应与客户确认稿和实际包装一致。'),
    bankBeneficiary:K('Beneficiary 收款人','银行账户真正登记的收款主体。','应与开户行记录和合同收款主体一致。','PI|销售合同|收款指令','ABC INDUSTRIAL CO., LTD.。','收款人变更属于高风险信息，应通过已知联系方式二次核验。'),
    swift:K('SWIFT / BIC','跨境汇款用于识别银行的代码。','SWIFT也常称BIC，通常为8位或11位字母数字组合。','PI|销售合同|收款资料','BKCHCNBJXXX。','不要把银行账号或Routing Number误填为SWIFT。'),
    paymentTerms:K('付款条款','客户什么时候付多少款，以及达到什么条件后付款。','常见方式包括T/T、L/C、平台担保、账期等，应写清比例、节点和币种。','报价单|PI|销售合同','30% T/T deposit, 70% balance before shipment。','“发货前”是否包含验货、照片或第三方检验，应按订单写清。'),
    incoterms:K('Incoterms® 2020 贸易术语','说明买卖双方分别负责哪些运输、费用、清关和风险节点。','应写“术语 + 指定地点/港口 + Incoterms® 2020”，例如FOB Ningbo, China — Incoterms® 2020。','报价单|PI|商业发票|销售合同','FCA Shenzhen, China — Incoterms® 2020。','不能只写FOB或DDP；术语不等于付款方式，也不能代替完整合同。'),
    leadTime:K('交货期 / Lead Time','从约定起算点到货物可以交付或出运需要多久。','起算点应明确，例如定金到账、样品确认或图纸确认后。','报价单|PI|销售合同','收到定金和图纸确认后25天。','不要把生产完成时间、开船时间和客户最终收货时间混为一谈。'),
    portOfLoading:K('装运港','货物从哪个港口装船或起运。','海运常填写Port of Loading；空运更适合填写Airport of Departure。','商业发票|装箱单|销售合同','Ningbo, China。','使用FCA、FOB等术语时，地点应与贸易术语保持一致。'),
    estimatedShipment:K('预计发运日期','预计把货交给承运人或安排出运的日期。','它是计划时间，不一定等于ETD。','PI|销售合同|工作台跟进','10 Aug 2026。','客户确认、付款或生产延期后应重新核对。'),
    contractClauses:K('合同补充条款','对付款、交付、验货、质保、索赔、争议等责任作进一步约定。','模板只用于起草，正式合同应结合订单、适用法律和双方谈判结果人工确认。','销售合同','先选择条款模块，再结合订单修改。','系统说明不构成法律意见；重大或高风险合同应由专业人员审核。'),
    sku:K('SKU / 货号','用内部编码快速识别某一个产品或规格。','SKU是Stock Keeping Unit。不同颜色、尺寸或包装通常可以有不同SKU。','所有含商品明细的单据','FPB-CHAIR-BLK-01。','SKU不是HS Code，也不一定等于客户型号。'),
    productSpec:K('规格 / 描述','写清型号、材质、尺寸、颜色、工艺或客户确认的关键要求。','商品名称回答“是什么”，规格描述回答“具体是哪一种”。','所有含商品明细的单据','Stainless steel 304, 600×400 mm, black powder coating。','商业发票的申报描述应清楚但不要堆入无关营销文案。'),
    hsCode:K('HS Code 海关编码','海关用它判断商品类别、监管要求和税费。','HS编码可能因国家、位数和商品细节不同而变化。系统可以保存候选，但不能替代报关行或专业确认。','商业发票|部分装箱单或报价资料','7326909000。','不要仅凭商品名称猜编码；正式申报前必须确认。'),
    unit:K('计量单位','说明数量是件、套、箱、公斤还是其他单位。','单位应与报价、订单、商业发票和装箱单保持一致。','所有含商品明细的单据','PCS、SET、CTN、KG。','CTN代表箱数，不一定代表商品数量。'),
    cartonNo:K('Carton No. 箱号','说明某行商品装在哪些箱子里。','可填写连续范围或单独箱号，用于装箱单核对。','装箱单','1-10、11-15。','箱号范围之间不要重叠或遗漏。'),
    packageDescription:K('包装说明','说明这一行商品使用什么包装以及每箱如何装。','可写纸箱、托盘、木箱、内盒数量等。','装箱单|PI|销售合同','10 PCS / carton, 20 cartons。','应与总箱数、数量和实际包装一致。'),

    clause_payment_30_70:K('30%定金，70%发货前','客户先付30%启动订单，剩余70%在发货前付清。','常用于定制生产订单，可降低卖方备料和生产风险。','报价单|PI|销售合同','30% T/T deposit in advance, 70% balance before shipment.','建议写清尾款节点是否以验货、照片或生产完成为条件。'),
    clause_lead_15_30:K('预付款后15–30天交货','收到预付款后开始计算，预计15到30天内交货。','适合交期存在合理浮动的普通生产订单。','报价单|PI','Within 15–30 days after receipt of advance payment.','还要确认样品、图纸或包装确认是否会影响起算时间。'),
    clause_warranty_12:K('12个月有限质保','发货后12个月内，对符合条件的质量问题提供有限处理。','应配合质保范围、排除情况、证据和处理方式使用。','报价单|PI|销售合同','A 12-month limited warranty applies from the shipment date.','不要省略误用、擅自改装和正常磨损等排除情况。'),
    clause_logistics_confirm:K('运费最终确认','当前运费只是预估，最终按实际体积、目的地和承运人排期确认。','适合尚未完成包装数据或订舱报价的订单。','报价单|PI','Freight is subject to final confirmation.','需要避免客户把暂估运费理解为最终固定价格。'),
    clause_terms_confirmation:K('双方最终确认后生效','这份文件需要双方最终确认后才生效。','可用于PI或补充说明，但不能替代明确的签署、付款和订单确认流程。','PI|销售合同','Effective upon final confirmation by both parties.','应说明什么行为构成确认，例如签字、邮件确认或付款。'),
    clause_packing_export:K('出口标准纸箱','使用适合国际运输的普通出口纸箱包装。','适用于不需要木箱、托盘或特殊防护的常规货物。','报价单|PI|装箱单','Export-standard carton packing.','易碎、超重、防潮或危险品不能只使用这一笼统描述。'),

    contract_inspection:K('检验与验收','约定客户收到货后多长时间检查，以及发现问题如何通知。','应写明检验期限、证据形式和逾期未提出异议的处理。','销售合同','Visible defects shall be notified in writing within 7 days.','期限必须符合实际运输和开箱条件。'),
    contract_warranty:K('质量与质保','约定产品应符合什么标准，以及质保范围和期限。','通常应结合样品、图纸、规格和排除责任。','销售合同','Goods shall conform to the agreed specifications.','不要使用无法验证的绝对承诺。'),
    contract_claims:K('索赔期限','约定数量、损坏或不符合要求的问题应在多久内提出。','应同时约定照片、视频、第三方报告等证据要求。','销售合同','Claims shall be submitted in writing within the agreed inspection period.','索赔期限与质保期限不是同一个概念。'),
    contract_forceMajeure:K('不可抗力','发生双方无法合理控制的重大事件时，如何处理延期或不能履约。','通常要求及时通知、提供证明并尽力减少损失。','销售合同','Neither party shall be liable for delay caused by events beyond reasonable control.','不可抗力不是任何成本上涨或普通延误的万能免责条款。'),
    contract_ip:K('知识产权与保密','明确图纸、品牌、技术和客户资料归谁，以及不能向谁泄露。','定制产品和OEM订单尤其需要区分原有知识产权与新开发成果。','销售合同','Each party retains its pre-existing intellectual property.','客户提供的商标和图稿应确认授权范围。'),
    contract_risk:K('所有权与风险转移','说明货物损坏或灭失风险在什么节点从卖方转给买方。','通常应与约定的Incoterms® 2020术语和指定地点一致。','销售合同','Risk transfers in accordance with the agreed Incoterms® rule.','付款完成、所有权转移和运输风险转移可能不是同一时间。'),
    contract_latePayment:K('逾期付款','客户没有按时付款时，卖方可以采取什么措施。','可约定暂停生产、暂停发货或依法收取费用。','销售合同','Overdue amounts may suspend production or shipment.','违约金和利息需要符合适用法律。'),
    contract_law:K('法律与争议解决','发生争议时适用哪里的法律、去法院还是仲裁。','应明确管辖法院或仲裁机构、地点和语言。','销售合同','Disputes shall be submitted to the agreed court or arbitration institution.','不要只写“友好协商”，却没有协商失败后的处理方式。'),
    contract_language:K('语言版本效力','中英文内容不一致时，以哪个语言版本为准。','多语言合同应明确优先版本，避免解释冲突。','销售合同','The English version shall prevail in case of inconsistency.','双方应真正理解并确认优先语言。'),
    contract_compliance:K('制裁与出口管制','双方承诺遵守适用的制裁、出口管制、海关和反贿赂规则。','高风险地区、受控产品或最终用户不明确时尤其重要。','销售合同','Each party shall comply with applicable sanctions and export-control laws.','条款不能替代真实的客户、目的地和最终用途审查。')
  };

  const FIELD_KEYS={
    docLanguage:'docLanguage',currency:'currency',originCountry:'originCountry',invoiceNo:'documentNo',validUntil:'validity',customerPo:'customerPo',quoteNo:'quoteNo',moq:'moq',salesperson:'salesperson',revisionNo:'revision',productionStartCondition:'productionStart',sampleApproval:'sampleApproval',artworkApproval:'artworkApproval',inspectionStandard:'inspectionStandard',qualityTolerance:'qualityTolerance',packagingConfirmation:'packagingApproval',warrantyTerms:'warranty',sellerTaxId:'taxId',buyerTaxId:'taxId',buyerCountryCode:'countryCode',consigneeName:'consignee',notifyPartyName:'notifyParty',notifyPartyContact:'notifyParty',notifyPartyPhone:'notifyParty',notifyPartyEmail:'notifyParty',notifyPartyAddress:'notifyParty',billToAddress:'billTo',shipToAddress:'shipTo',destinationPort:'destinationPort',extraFeeName:'extraFee',extraFeeAmount:'extraFee',taxAmount:'vatAmount',discountType:'discount',discountValue:'discount',amountWordsOverride:'amountWords',shippingMethod:'shippingMethod',packageCount:'packageCount',packageType:'packageType',netWeight:'netWeight',grossWeight:'grossWeight',cbm:'cbm',packageDimensions:'packageDimensions',logisticsCarrier:'logisticsCarrier',trackingNo:'trackingNo',blNo:'blNo',containerNo:'containerNo',sealNo:'sealNo',vesselFlight:'vesselFlight',etd:'etd',eta:'eta',shippingMarks:'shippingMarks',bankBeneficiary:'bankBeneficiary',bankSwift:'swift',paymentTerms:'paymentTerms',tradeTerms:'incoterms',deliveryTime:'leadTime',portOfLoading:'portOfLoading',estimatedShipment:'estimatedShipment',contractClauseTemplate:'contractClauses',contractClauses:'contractClauses'
  };
  const CLASS_KEYS={
    '.i-sku':'sku','.i-spec':'productSpec','.i-hs':'hsCode','.i-unit':'unit','.i-carton-no':'cartonNo','.i-package-desc':'packageDescription','.i-net-weight':'netWeight','.i-gross-weight':'grossWeight','.i-cbm':'cbm','.i-dimensions':'packageDescription','.i-item-marks':'shippingMarks'
  };
  const CLAUSE_KEYS={
    starter_payment_30_70:'clause_payment_30_70',starter_lead_15_30:'clause_lead_15_30',starter_warranty_12:'clause_warranty_12',starter_logistics_confirm:'clause_logistics_confirm',starter_terms_confirmation:'clause_terms_confirmation',starter_packing_export:'clause_packing_export'
  };
  const CONTRACT_KEYS={inspection:'contract_inspection',warranty:'contract_warranty',claims:'contract_claims',forceMajeure:'contract_forceMajeure',ip:'contract_ip',risk:'contract_risk',latePayment:'contract_latePayment',law:'contract_law',language:'contract_language',compliance:'contract_compliance'};

  let activeAnchor=null;
  let activeKey='';
  let sectionCounter=0;

  function entryFor(key,control){
    if(key==='contractClauses'&&control?.id==='contractClauseTemplate'){
      const selected=CONTRACT_KEYS[control.value];
      if(selected&&KNOWLEDGE[selected])return KNOWLEDGE[selected];
    }
    return KNOWLEDGE[key]||null;
  }
  function ensurePopover(){
    let pop=$('fpContextHelpPopover');
    if(pop)return pop;
    pop=document.createElement('aside');
    pop.id='fpContextHelpPopover';
    pop.className='fp-context-help-popover';
    pop.hidden=true;
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-modal','false');
    pop.innerHTML='<header><div><small>按需说明</small><h3 id="fpContextHelpTitle">字段说明</h3></div><button type="button" data-fp-help-close aria-label="关闭说明">×</button></header><div id="fpContextHelpBody" class="fp-context-help-body"></div>';
    document.body.appendChild(pop);
    pop.addEventListener('click',event=>{
      if(event.target.closest('[data-fp-help-close]'))closeHelp();
      const copy=event.target.closest('[data-fp-copy-example]');
      if(copy){
        const value=copy.dataset.fpCopyExample||'';
        navigator.clipboard?.writeText?.(value).then(()=>showMiniStatus('示例已复制，请核对后再填写。')).catch(()=>showMiniStatus('浏览器未允许复制，请手动选择示例。'));
      }
    });
    return pop;
  }
  function showMiniStatus(message){
    let toast=$('fpContextHelpToast');
    if(!toast){toast=document.createElement('div');toast.id='fpContextHelpToast';toast.className='fp-context-help-toast';document.body.appendChild(toast);}
    toast.textContent=message;toast.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>toast.classList.remove('show'),2200);
  }
  function renderEntry(entry){
    const used=entry.used.length?`<section><b>通常用于</b><p>${entry.used.map(esc).join('、')}</p></section>`:'';
    const watch=entry.watch.length?`<section class="is-warning"><b>容易出错的地方</b><ul>${entry.watch.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`:'';
    const example=entry.example?`<section><b>填写示例</b><div class="fp-help-example"><code>${esc(entry.example)}</code><button type="button" data-fp-copy-example="${esc(entry.example)}">复制示例</button></div><small>示例只用于理解，不会自动写入单据。</small></section>`:'';
    return `<section class="is-plain"><span>先看大白话</span><p>${esc(entry.plain)}</p></section>${used}${example}<details><summary>查看专业解释</summary><p>${esc(entry.professional)}</p></details>${watch}`;
  }
  function positionPopover(pop,anchor){
    if(matchMedia('(max-width:720px)').matches){pop.style.removeProperty('left');pop.style.removeProperty('top');return;}
    const rect=anchor.getBoundingClientRect();
    const width=Math.min(390,window.innerWidth-24);
    const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left-10));
    pop.style.left=`${left}px`;
    pop.style.top=`${Math.min(window.innerHeight-pop.offsetHeight-12,rect.bottom+8)}px`;
  }
  function openHelp(key,anchor,control){
    const entry=entryFor(key,control);
    if(!entry)return;
    const pop=ensurePopover();
    activeAnchor=anchor;activeKey=key;
    $('fpContextHelpTitle').textContent=entry.title;
    $('fpContextHelpBody').innerHTML=renderEntry(entry);
    pop.hidden=false;
    pop.classList.add('open');
    anchor?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>positionPopover(pop,anchor));
  }
  function openSectionHelp(key,anchor){
    const raw=anchor?.dataset.fpSectionHelpText||'';
    if(!raw)return;
    const parts=raw.split('\n').map(text).filter(Boolean);
    const entry=K(anchor.dataset.fpSectionHelpTitle||'本区说明',parts[0]||'点击查看本区说明。',parts.slice(1).join(' ')||parts[0]||'',anchor.dataset.fpSectionHelpUsed||'当前做单页面','',[]);
    KNOWLEDGE[key]=entry;openHelp(key,anchor,null);
  }
  function closeHelp(){
    const pop=$('fpContextHelpPopover');if(pop){pop.hidden=true;pop.classList.remove('open');}
    activeAnchor?.setAttribute('aria-expanded','false');activeAnchor=null;activeKey='';
  }
  function helpButton(key,control,label){
    const button=document.createElement('button');
    button.type='button';button.className='fp-field-help';button.dataset.fpHelpKey=key;button.setAttribute('aria-label',`查看${label||'该字段'}说明`);button.setAttribute('aria-expanded','false');button.textContent='i';button._fpControl=control;return button;
  }
  function wrapLabel(control,key){
    if(!control||control.dataset.fpHelpReady==='1')return;
    const label=control.closest('label');if(!label||label.classList.contains('switch-line')||label.classList.contains('inline-lock')||label.classList.contains('range-row'))return;
    const entry=entryFor(key,control);if(!entry)return;
    let row=label.querySelector(':scope > .fp-field-label-row');
    if(!row){
      row=document.createElement('span');row.className='fp-field-label-row';
      const nodes=[];
      for(const node of [...label.childNodes]){if(node===control)break;nodes.push(node);}
      label.insertBefore(row,control);nodes.forEach(node=>row.appendChild(node));
    }
    if(!row.querySelector(`[data-fp-help-key="${key}"]`))row.appendChild(helpButton(key,control,entry.title));
    label.classList.add('fp-has-field-help');control.dataset.fpHelpReady='1';
  }
  function enhanceFields(root=document){
    Object.entries(FIELD_KEYS).forEach(([id,key])=>{const control=(root.getElementById?root.getElementById(id):root.querySelector?.(`#${CSS.escape(id)}`))||$(id);if(control)wrapLabel(control,key);});
    Object.entries(CLASS_KEYS).forEach(([selector,key])=>root.querySelectorAll?.(selector).forEach(control=>wrapLabel(control,key)));
  }
  function compactGuidance(root=document){
    const selectors=['#piForm .hint','#piForm .subhint','#piForm .paste-tip','#piForm .section-translation-note','#piForm .section-scope-note','#piForm .pi-code-note'];
    root.querySelectorAll?.(selectors.join(',')).forEach(node=>{
      if(node.dataset.fpGuidanceCompacted==='1')return;
      const message=text(node.textContent);if(!message)return;
      let host=node.closest('.card,.pi-code-panel,details');if(!host)return;
      let title=host.querySelector(':scope > .section-title h2,:scope > h2,:scope > .pi-code-head h3,:scope > summary');
      if(!title)title=host.querySelector('h2,h3,summary');if(!title)return;
      let button=title.parentElement?.querySelector(':scope > .fp-section-help');
      if(!button){
        button=document.createElement('button');button.type='button';button.className='fp-field-help fp-section-help';button.textContent='i';button.dataset.fpSectionHelpKey=`section_${++sectionCounter}`;button.dataset.fpSectionHelpTitle=text(title.textContent)||'本区说明';button.dataset.fpSectionHelpText='';button.setAttribute('aria-label',`查看${button.dataset.fpSectionHelpTitle}说明`);button.setAttribute('aria-expanded','false');
        title.insertAdjacentElement('afterend',button);
      }
      const current=button.dataset.fpSectionHelpText||'';button.dataset.fpSectionHelpText=current?`${current}\n${message}`:message;
      node.dataset.fpGuidanceCompacted='1';node.classList.add('fp-guidance-collapsed');
    });
  }
  function compactCompliance(){
    const input=$('tradeTerms'),hint=$('incotermsComplianceStatus');if(!input||!hint)return;
    const sync=()=>hint.classList.toggle('fp-guidance-collapsed',!text(input.value));
    input.addEventListener('input',sync,{passive:true});sync();
  }
  function enhanceClauseLibrary(root=document){
    root.querySelectorAll?.('.copy-library-item').forEach(item=>{
      if(item.dataset.fpClauseHelpReady==='1')return;
      const action=item.querySelector('[data-copy-id]');const key=CLAUSE_KEYS[action?.dataset.copyId];if(!key||!KNOWLEDGE[key])return;
      const strong=item.querySelector('strong');if(!strong)return;
      const button=helpButton(key,null,KNOWLEDGE[key].title);button.classList.add('fp-clause-help');strong.insertAdjacentElement('afterend',button);item.dataset.fpClauseHelpReady='1';
    });
  }
  function stripRuntimePlaceholders(root=document){
    root.querySelectorAll?.('#piForm input[placeholder],#piForm textarea[placeholder]').forEach(control=>{
      control.dataset.fpRemovedPlaceholder=control.getAttribute('placeholder')||'';control.removeAttribute('placeholder');
    });
  }
  function enhanceAll(root=document){enhanceFields(root);compactGuidance(root);enhanceClauseLibrary(root);stripRuntimePlaceholders(root);}

  document.addEventListener('click',event=>{
    const field=event.target.closest('[data-fp-help-key]');
    if(field){event.preventDefault();event.stopPropagation();const key=field.dataset.fpHelpKey;if(activeAnchor===field){closeHelp();return;}openHelp(key,field,field._fpControl);return;}
    const section=event.target.closest('[data-fp-section-help-key]');
    if(section){event.preventDefault();event.stopPropagation();if(activeAnchor===section){closeHelp();return;}openSectionHelp(section.dataset.fpSectionHelpKey,section);return;}
    if(activeAnchor&&!event.target.closest('#fpContextHelpPopover'))closeHelp();
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeHelp();});
  window.addEventListener('resize',()=>{const pop=$('fpContextHelpPopover');if(pop&&!pop.hidden&&activeAnchor)positionPopover(pop,activeAnchor);},{passive:true});
  window.addEventListener('scroll',()=>{const pop=$('fpContextHelpPopover');if(pop&&!pop.hidden&&activeAnchor&&!matchMedia('(max-width:720px)').matches)positionPopover(pop,activeAnchor);},{passive:true,capture:true});

  function boot(){
    if(!$('piForm'))return;
    document.body.classList.add('fp-clean-context-help');
    enhanceAll(document);compactCompliance();
    const observer=new MutationObserver(records=>records.forEach(record=>{if(record.type==='attributes'){const target=record.target;if(target?.matches?.('#piForm input[placeholder],#piForm textarea[placeholder]')){target.dataset.fpRemovedPlaceholder=target.getAttribute('placeholder')||'';target.removeAttribute('placeholder');}return;}record.addedNodes.forEach(node=>{if(node.nodeType===1)enhanceAll(node);});}));observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['placeholder']});
    window.FlypigBOXContextHelp={version:VERSION,open:(key,anchor)=>openHelp(key,anchor,null),close:closeHelp,knowledge:KNOWLEDGE};
    document.dispatchEvent(new CustomEvent('HUIDI:context-help-ready',{detail:{version:VERSION}}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
