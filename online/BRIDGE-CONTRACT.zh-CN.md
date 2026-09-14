# HUIDI Online ↔ Community Local 业务桥接契约 V1

> 目标：Online 的获客、背调、开发信和跟进结果，不形成第二套孤立 CRM；产生真实机会后，必须进入 Community Local 已有的客户、询盘、商品、Catalog 和单据主链。

## 1. 唯一 Local 数据 Owner

桥接层不直接维护另一套 Local 数据格式，而是调用现有 `window.HUIDILocalCore`：

| 业务对象 | Local Owner / Key |
| --- | --- |
| 客户 | `HUIDILocalCore.repositories.customers` / `huidi_local_customers_v1` |
| 商品 | `HUIDILocalCore.repositories.products` / `huidi_local_products_v1` |
| 询盘 / 订单 | `HUIDILocalCore.repositories.deals` / `huidi_local_deals_v2` |
| 邮件草稿 | `HUIDILocalCore.repositories.mail` / `huidi_local_mail_drafts_v2` |
| 单据上下文 | `HUIDILocalCore.context` |
| 正式单据存储 | `HUIDILocalDB` + `flypigbox_workspace_document_mirror_v1` 索引 |

Online 不直接操作 Local 页面 DOM 来“伪同步”。页面改版时，只要 LocalCore 契约不变，桥接仍可继续使用。

## 2. 传输方式

Online 点击“同步到本地并转询盘”后生成：

`huidi.business.bundle/v1`

数据放在：

```text
http://127.0.0.1:8765/online-bridge.html#bundle=<base64url-json>
```

使用 URL Fragment 的原因：

1. Fragment 不会作为 HTTP 请求内容发送给本机服务器。
2. Community Local 不需要主动请求 Online，不破坏 Local 的主动外联阻断。
3. 真正写入前必须在本地桥接页人工确认。
4. 不要求 Local 开放 CORS 或对云端暴露写接口。

## 3. Canonical Bundle

```json
{
  "schema": "huidi.business.bundle/v1",
  "source": "HUIDI Docs Online",
  "source_lead_id": "88",
  "lead": {
    "priority": "A",
    "score": 86,
    "reason": "产品匹配 · 买家角色信号",
    "market_keyword": "stainless steel hinge",
    "evidence": [],
    "assessment": {}
  },
  "customer": {
    "company": "Acme Import GmbH",
    "contact": "Anna",
    "email": "anna@example.com",
    "country": "Germany",
    "website": "https://example.com"
  },
  "deal": {
    "title": "Acme Import GmbH · stainless steel hinge",
    "stage": "new_inquiry",
    "currency": "USD",
    "product_keyword": "stainless steel hinge",
    "requirements": "...",
    "next_action": "...",
    "next_action_at": "..."
  },
  "mail_draft": {
    "to": "anna@example.com",
    "subject": "...",
    "body": "...",
    "language": "English",
    "approved": true
  },
  "activity": [],
  "recommended_document": "quotation"
}
```

## 4. 客户写入规则

去重优先级：

1. `online_source_lead_id`
2. Email 精确匹配
3. 官网域名匹配
4. 公司名称精确匹配

再次同步同一线索时更新同一个客户，不重复建档。

Online 会补充：

- 公司
- 联系人
- 邮箱
- 国家 / 地区
- 官网
- 来源
- 跟进日期
- Online A/B/C/D 优先级
- Online lead score
- 背调初筛摘要
- 来源证据

如果 Local 已经有更完整字段，Online 的空字段不能覆盖 Local 已有值。

## 5. 询盘 / 订单写入规则

同一 `online_source_lead_id` 只映射一个 Local Deal。

初次导入默认：

- `stage = new_inquiry`
- `probability = 20`（如果 Local 已有值则保持）
- `customer_id` 指向刚才的同一个客户
- `requirements` 使用 Online 的匹配理由 / 客户需求线索
- `next_action` 使用开发信 / 跟进状态
- `next_action_at` 使用最近一次安排的跟进日期
- `online_lead_score` 与 `online_lead_priority` 单独保存

**Online 获客评分不能映射成成交概率。**

买家匹配分和销售人员对成交概率的判断是两个不同概念。

## 6. 商品互通规则

Online 搜索关键词不能自动创造“商品”。

桥接页只在用户已有的 Local 商品资料库中匹配：

- 商品名称
- SKU
- 分类
- 规格
- 备注
- 报关品名

匹配到的商品在桥接页勾选确认后写入 `deal.product_ids`。

如果没有匹配到，客户和询盘仍正常导入，用户之后从商品资料库手动选择。

这保证 Online 获客不会污染正式商品主数据。

## 7. 邮件互通规则

Online 有开发信草稿时，导入 Local 的：

`huidi_local_mail_drafts_v2`

并保存：

- `customer_id`
- `customer_name`
- `deal_id`
- `to`
- `subject`
- `body`
- `draft_language`
- `draft_approved`
- `online_source_lead_id`

V1 仍然只同步草稿；没有开放自动群发。

## 8. Catalog 互通

导入后使用现有：

`flypigbox_catalog_product_ids_v1`

传递：

- `ids = deal.product_ids`
- `dealId`
- `createdAt`

然后打开：

`catalog-studio/index.html`

因此产品目录继续使用用户已经维护的 Local 商品主数据和图片，而不是 Online 再建一套 Catalog 商品。

## 9. 五类正式单据互通

桥接完成后可直接进入：

1. `quotation`
2. `proforma_invoice`
3. `sales_contract`
4. `commercial_invoice`
5. `packing_list`

统一调用：

```js
HUIDILocalCore.context.create({
  type,
  dealId,
  customerId,
  productIds
})
```

随后打开现有 Local Editor。

这样所有单据拿到的是同一个：

**客户 → Deal → 商品**

后续保存单据时继续由现有 `linkDocumentRecord()` 回挂 Deal，所以 Quotation → PI → Contract → CI / Packing List 保持原有业务链。

## 10. 页面直达

导入成功后本地桥接页可直达：

- `workspace.html#customers` 客户中心
- `workspace.html#deals` 询盘与订单
- `workspace.html#mail` 邮件草稿
- Catalog Studio
- Quotation
- PI
- Sales Contract
- CI
- Packing List

## 11. 安全边界

V1 明确禁止：

- Online 绕过用户确认直接写 localhost
- Local 主动 Fetch Online 云端数据
- 用获客分数替代成交概率
- 根据搜索关键词自动创建正式商品
- 把普通 Web Search 当作官方工商 / 海关验证
- 自动批量发送未审核开发信

## 12. CI 契约门

`Online V0.1 Check` 现在必须通过：

- Python 编译
- Buyer scoring tests
- FastAPI import
- Online browser JS syntax
- Local bridge JS syntax
- `huidi.business.bundle/v1` marker
- 5 类正式单据 marker
- Catalog linkage marker
- Local Mail repository marker
- 实际 Node bridge regression：导入 / 去重 / 邮件 / 商品 / quotation context / catalog context
- Secrets 不入库

后续地图获客、Trade Intelligence、Customer Due Diligence Provider、UZonMail 邮箱层，都必须进入这套 Canonical Business Bridge，而不能各自创建孤立客户库。
