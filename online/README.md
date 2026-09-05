# HUIDI Docs Online · Lead Workbench

> 在线版开发线：把“开发客户”直接接到 HUIDI 已有的客户、询盘、商品、产品目录、邮件草稿、报价、PI、合同、CI 和装箱单业务链。

当前阶段：**V0.1.1 Lead Workbench + Business Bridge V1**

## 产品方向

Community Local 继续保持本地优先、离线可用和低学习成本；Online 专门承接必须联网或更适合云端的能力：

- 搜索潜在客户公司
- 发现公司官网与公开业务邮箱
- Buyer / Procurement / Sourcing / Purchasing 联系线索
- 透明买家评分与 A/B/C/D 优先级
- 客户背调初筛与证据缺口
- AI 开发信草稿
- 人工确认 / 退回修改
- 跟进时间和开发记录
- 合格线索同步到 Community Local
- 继续产品目录、报价、PI、合同、CI / Packing List

## 已经做通的主链

```text
产品 / 市场 / 客户类型
        ↓
搜索潜在公司
        ↓
透明买家评分 A/B/C/D
        ↓
来源证据 + 公司官网
        ↓
客户背调初筛
        ↓
采购 / Buyer 联系线索
        ↓
AI 开发信草稿
        ↓
人工确认 / 安排跟进
        ↓
真实机会
        ↓
Online → Local 显式同步桥
        ↓
客户中心 + 新询盘 + 邮件草稿
        ↓
本机商品匹配
        ↓
产品目录 / Quotation
        ↓
PI → Contract → CI / Packing List
```

## Business Bridge V1

这一版已经不再只是 API 返回一个“customer / inquiry payload”。

Online 线索详情增加 **“同步到本地并转询盘”**：

1. Online 生成 `huidi.business.bundle/v1`。
2. 打开用户自己的 `127.0.0.1` Community Local 桥接页。
3. Local 只读取 URL Fragment，不主动请求 Online。
4. 用户先核对客户、询盘、背调和邮件草稿。
5. Local 在已有商品资料库中匹配商品，用户可勾选。
6. 用户点击“确认导入本机”后才写入现有 `HUIDILocalCore`。
7. 导入后直接进入客户、询盘、邮件、Catalog 或五类正式单据。

### Local 复用的是现有数据 Owner

- 客户：`huidi_local_customers_v1`
- 商品：`huidi_local_products_v1`
- 询盘 / 订单：`huidi_local_deals_v2`
- 邮件草稿：`huidi_local_mail_drafts_v2`
- 单据上下文：`HUIDILocalCore.context`
- 正式单据：现有 Local DB / Document linkage

因此 Online 不会再造一套孤立 CRM。

详细映射见：[`BRIDGE-CONTRACT.zh-CN.md`](./BRIDGE-CONTRACT.zh-CN.md)

## 客户 / 询盘去重

同一 Online 线索重复同步时不会重复建客户和询盘。

客户匹配顺序：

1. Online source lead ID
2. Email
3. 官网域名
4. 公司名称

已有 Local 客户的完整字段优先保留；Online 空字段不能覆盖本地已有资料。

## 商品互通

Online 的搜索关键词**不能自动创造正式商品**。

桥接页只匹配用户已经在 Community Local 商品资料库中维护的：

- 名称
- SKU
- 分类
- 规格
- 备注
- 报关品名

用户确认勾选后才写入询盘 `product_ids`。

没有匹配到商品也不会阻断客户 / 询盘导入，可以之后在本地继续选择。

## Catalog 与五类正式单据

同步完成后可以直接进入：

- 产品目录 Catalog
- Quotation / 报价单
- Proforma Invoice / PI
- Sales Contract
- Commercial Invoice / CI
- Packing List

五类单据统一使用现有：

```js
HUIDILocalCore.context.create({
  type,
  dealId,
  customerId,
  productIds
})
```

所以单据使用的是同一个客户、同一个询盘和同一批商品。后续保存仍由现有 `linkDocumentRecord()` 回挂原 Deal，保持 Quotation → PI → Contract → CI / PL 的原有链路。

## 透明买家评分

HUIDI 不把“AI 分数”当黑盒结论。当前评分拆成：

- 产品匹配
- 买家角色信号
- 目标市场
- 采购 / 进口信号
- 独立官网
- 可联系性
- 商业主体信号
- 供应端 / 目录站扣分

最终只用于跟进优先级：A / B / C / D。

**Online lead score 与 Local Deal probability 是两个字段。** 获客匹配分不会冒充业务员判断的成交概率。

## 客户背调初筛

当前根据 HUIDI 已经真正掌握的证据判断：

- 基础资料完整度
- 公司存在信号
- 联系人资料
- 数字资产 / 官网证据
- 业务匹配度

工商注册、官方公司状态、海关采购历史尚未接入时明确显示 **“未验证”**，不会把“没有数据”错误算成高风险。

这一层定位是销售资格判断，不是征信报告、法律尽调或官方海关核验。

## 开发信与跟进

- OpenAI-compatible LLM
- 无 LLM 时普通模板降级
- 多语言开发信入口
- 草稿人工确认 / 退回修改
- 下一次跟进日期
- 线索活动时间线
- 草稿可同步进 Community Local 邮件草稿

当前**不自动批量发送冷邮件**。真实发送能力会等邮箱连接、额度、退订、黑名单、Bounce、回复停止和审计门禁完成后再开放。

## 当前技术骨架

- FastAPI
- SQLAlchemy
- SQLite（开发环境）
- `DATABASE_URL` 可切 PostgreSQL
- Serper Search Provider
- OpenAI-compatible LLM Provider
- Table-first Lead Workbench
- `LeadAssessment`
- `LeadActivity`
- HUIDI Business Bundle V1
- Local Bridge confirmation page
- Docker 启动骨架
- GitHub Actions Online 专项门禁

## 本地启动 Online 原型

```bash
cd online/api
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

Online：`http://127.0.0.1:8080/`

Community Local 默认桥接地址：`http://127.0.0.1:8765`

只看 UI / 演示流程不需要外部 API。

真实搜索：

```env
SERPER_API_KEY=...
```

AI 开发信：

```env
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## 本轮研究的外贸开源项目

- `1099271/smart-lead-agent`：FindKP / Writer / MailManager、多搜索、多 LLM
- `Tommy-old/b2b-buyer-discovery`：买家搜索、规则 + AI 评分、联系方式、开发信
- `kakacells/Customer_background_check_version1.2`：背调维度、置信度、降级验证方法
- `uyoufu/UZonMail`：邮箱、多账号、模板、追踪、退订、发送治理
- `chnjames/tradehot-skill`：外贸情报、HS、关税、风险、贸易日历
- `dongsheng123132/ai-tungke`：地图获客、区域遍历、产业集群方法
- `tshwangq/awesome-foreign-trade`：外贸资源导航与工具箱

没有明确允许复用的项目只作为产品 / 架构参考，由 HUIDI 自己重写。第三方归属和许可边界见 `THIRD-PARTY-NOTICES.md`。

## CI 门禁

Online PR 现在会自动检查：

- Python 编译
- Buyer scoring regression
- FastAPI import
- Online browser JS syntax
- Local bridge JS syntax
- Business Bundle / 五类单据 / Catalog / Mail 契约 marker
- **真实 Node bridge regression**：客户导入、询盘导入、邮件导入、商品关联、重复同步去重、Quotation Context、Catalog Context
- 本地 Secrets 不入库

## 下一阶段

1. **邮件账户层**：Gmail / Outlook / SMTP、发送审批、配额、退订、黑名单、Bounce、回复停止。
2. **真实背调 Provider**：公司注册、官方商业信息、可选海关 / 贸易数据，证据分层。
3. **地图找客户**：地图 Provider、城市 / 区域搜索、产业聚类、进入同一线索池。
4. **外贸情报**：市场、HS、关税、物流、风险、贸易日历，并能关联客户、商品和报价。
5. **Local → Online 回传**：在不破坏 Local 主动外联阻断的前提下，用用户确认的显式桥接回传回复状态 / 单据阶段；再定义冲突策略。

## 在线公开前仍必须完成

- 登录 / 注册
- 租户隔离和权限
- 生产 PostgreSQL
- API Key 加密
- 队列 / 并发 / 配额
- 邮箱发送治理
- 审计日志
- 团队协作
- 正式双向同步冲突策略

**目标不是“抓越多邮箱越好”，而是让外贸人从值得联系的客户开始，一路推进到真实询盘和正式单据。**
