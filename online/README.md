# HUIDI Docs Online · Lead Workbench

> 在线版开发线：把“商品事实 → 开发客户 → 客户背调 → 联系人 → 开发信 → 跟进 → 客户/询盘 → 产品目录 → 报价 → PI → 合同 → CI / 装箱单”接成同一条业务链。

当前阶段：**V0.1.3 Product Brain + Growth Workflow + Business Bridge V1**

## 产品方向

Community Local 继续保持本地优先、离线可用和低学习成本；Online 专门承接必须联网或更适合云端的能力：

- 从 HUIDI 商品资料建立 Product Brain 产品事实源
- 搜索潜在客户公司
- 发现公司官网与公开业务邮箱
- Buyer / Procurement / Sourcing / Purchasing 联系线索
- 透明买家评分与 A/B/C/D 优先级
- 客户背调初筛与证据缺口
- Buying Signals / Open Threads / 下一步建议
- AI 开发信草稿
- 人工确认 / 退回修改
- 跟进时间和开发记录
- 合格线索显式同步到 Community Local
- 继续产品目录、报价、PI、合同、CI / Packing List

## 已经做通的主链

```text
Community Local 商品资料
        ↓ 商品页“用于 Online 开发客户”
显式选择一个真实商品
        ↓
Product Brain 产品事实源
        ↓
目标市场 / 客户类型 / Campaign Brief
        ↓
搜索潜在公司
        ↓
透明买家评分 A/B/C/D
        ↓
来源证据 + 公司官网 + Buying Signals
        ↓
客户背调初筛 + Open Threads
        ↓
采购 / Buyer 联系线索
        ↓
AI 开发信草稿（调用 Product Brain 真实事实）
        ↓
人工确认 / 安排跟进 / Next Best Action
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

## Product Brain：商品资料真正成为“开发客户事实源”

V0.1.3 新增 Product Brain。它不是第二套商品库，而是把现有商品资料整理成 Online 获客和开发信可以安全调用的正式事实。

一份 Product Brain 可以维护：

- 商品名称 / SKU / 分类 / 系列
- 规格 / 核心参数
- 参考价 / 价格区间
- MOQ / 交期
- 认证 / 资质
- 已确认的差异化卖点
- 可公开的客户案例
- 公司基本盘
- 允许 AI 对外引用的事实 / 承诺
- **禁止 AI 擅自承诺的内容**
- HS Code / 原产国 / 包装 / 箱规 / CBM
- 目标搜索关键词

### Product Brain 的数据纪律

HUIDI 明确区分三层：

1. **Product Brain（持久事实）**：规格、价格、MOQ、交期、认证、案例、经过确认的卖点。
2. **Lead / Customer Memory（客户动态）**：Buying Signals、客户画像、联系人、回复、跟进、Deal 状态。
3. **Runtime Context（临时上下文）**：某次搜索结果、某封邮件正在生成的中间内容、临时模型判断。

临时搜索内容不会自动写回正式产品参数，避免 AI 把猜测当事实。

## Community Local → Online 商品交接

Community Local 商品资料库现在直接出现：

**用于 Online 开发客户**

点击后进入：

`http://127.0.0.1:8765/product-online-handoff.html`

这里直接读取现有：

`HUIDILocalCore.repositories.products`

用户**明确选择一个商品**后才打开 Online，并把该商品的正式资料以 URL Fragment 带到 Product Brain。

- 不自动上传整个本机商品库
- 不后台同步
- 不覆盖 Community Local 商品
- Online 可继续补充认证 / 案例 / 差异化 / 禁止承诺
- Local 商品 ID 会保留，后续用于稳定映射

Online 默认开发地址：

`http://127.0.0.1:8080/`

## Campaign Brief

当前 Product Brain 会形成一份轻量 Campaign Brief：

- 当前产品
- 产品关键词
- 目标国家
- 买家类型
- 推荐切入卖点
- Product Brain 事实摘要
- 禁止承诺项

“开发客户”页面顶部会显示当前 Product Brain，并可一键把商品关键词带入搜索；在线索详情生成开发信时也可以使用当前 Product Brain 事实。

## Growth Workflow：客户详情不再只是“看资料”

每条线索详情现在会根据真实状态给出：

- **Next Best Action**：当前最值得做的下一步
- **Buying Signals**：只从已保存的公开证据里识别采购、项目、招聘、融资、扩张等信号
- **Open Threads**：联系人、贸易证据、开发信、跟进计划等尚未收口事项
- **角色进度**：Strategy / Hunter / Profiler / Writer / Outreach / Closer

这些角色不是六个独立按钮，而是同一条业务链的状态视图。没有公开证据时不会编造 Buying Signal。

## Business Bridge V1

Online 线索详情已有 **“同步到本地并转询盘”**：

1. Online 生成 `huidi.business.bundle/v1`。
2. 打开用户自己的 `127.0.0.1` Community Local 桥接页。
3. Local 只读取 URL Fragment，不主动请求 Online。
4. 用户先核对客户、询盘、背调和邮件草稿。
5. Local 在已有商品资料库中匹配商品，用户可勾选。
6. 用户点击“确认导入本机”后才写入现有 `HUIDILocalCore`。
7. 导入后直接进入客户、询盘、邮件、Catalog 或五类正式单据。

### Local 复用现有数据 Owner

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

桥接页只匹配用户已经在 Community Local 商品资料库中维护的：名称、SKU、分类、规格、备注、报关品名。

用户确认勾选后才写入询盘 `product_ids`。没有匹配到商品也不会阻断客户 / 询盘导入。

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

所以单据继续使用同一个客户、同一个询盘和同一批商品；保存后仍由现有 Document linkage 回挂原 Deal。

## 透明买家评分

当前评分拆成：产品匹配、买家角色、目标市场、采购 / 进口信号、独立官网、可联系性、商业主体信号、供应端 / 目录站扣分。

最终只用于跟进优先级 A / B / C / D。

**Online lead score 与 Local Deal probability 是两个字段。** 获客匹配分不会冒充成交概率。

## 客户背调与 Customer Memory

当前根据已掌握证据判断：基础资料完整度、公司存在信号、联系人、数字资产 / 官网证据、业务匹配度。

工商注册、官方公司状态、海关采购历史尚未接入时明确显示 **“未验证”**。

每条线索保留独立 `LeadActivity` 时间线，用于记录发现、联系人查询、背调、草稿、跟进、同步等动作。Buying Signals / Open Threads 属于 Lead / Customer Memory，不写进 Product Brain。

## 开发信与跟进

- OpenAI-compatible LLM
- 无 LLM 时普通模板降级
- 多语言开发信入口
- 可主动调用当前 Product Brain 事实
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
- Product Brain 浏览器事实层（V0.1.3，后续迁移服务器持久化）
- Campaign Brief
- Growth Workflow
- `LeadAssessment`
- `LeadActivity`
- HUIDI Business Bundle V1
- Local Product → Online Product Brain handoff
- Community Local 商品页显式 Online 入口
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

Community Local：`http://127.0.0.1:8765`

只看 UI / Product Brain / 演示流程不需要外部 API。

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

## 本轮研究的外贸项目

- `1099271/smart-lead-agent`：FindKP / Writer / MailManager、多搜索、多 LLM
- `Tommy-old/b2b-buyer-discovery`：买家搜索、规则 + AI 评分、联系方式、开发信
- `kakacells/Customer_background_check_version1.2`：背调维度、置信度、降级验证
- `uyoufu/UZonMail`：邮箱、多账号、模板、追踪、退订、发送治理
- `chnjames/tradehot-skill`：外贸情报、HS、关税、风险、贸易日历
- `dongsheng123132/ai-tungke`：地图获客、区域遍历、产业集群
- `tshwangq/awesome-foreign-trade`：外贸资源导航与工具箱
- `SuperGokou/caijiwaimao`：Product Brain、Campaign / ICP、客户 / 决策人记忆、Buying Signals、Open Threads、Brain/Memory 分层方法

`caijiwaimao` 的 README 标注为内部机密资料而非开放软件许可，所以 HUIDI 只做产品 / 架构研究，**不复制其 HTML、CSS、Demo、内部文案或 Prompt**。详细边界见 `THIRD-PARTY-NOTICES.md`。

## CI 门禁

Online PR 自动检查：

- Python 编译
- Buyer scoring regression
- FastAPI import
- Online browser JS syntax
- Product Brain core / UI / Growth Workflow JS syntax
- Local bridge JS syntax
- Community Local R6 商品入口 JS syntax
- Local Product → Online handoff marker
- 商品页 Online 入口 marker
- Business Bundle / 五类单据 / Catalog / Mail 契约 marker
- 真实 Node bridge regression：客户、询盘、邮件、商品关联、重复同步去重、Quotation Context、Catalog Context
- Product Brain core regression
- 本地 Secrets 不入库

## 下一阶段

1. **Product Brain 服务器持久化**：保持 Community Local 商品是主数据 Owner，Online 只保存获客所需扩展知识和映射。
2. **邮件账户层**：Gmail / Outlook / SMTP、发送审批、配额、退订、黑名单、Bounce、回复停止。
3. **真实背调 Provider**：公司注册、官方商业信息、可选海关 / 贸易数据。
4. **Buying Signals Provider**：招聘、招标、项目、融资、官网更新等证据持续进入 Lead / Customer Memory。
5. **地图找客户**：地图 Provider、城市 / 区域搜索、产业聚类，进入同一线索池。
6. **外贸情报**：市场、HS、关税、物流、风险、贸易日历，关联商品、客户和报价。
7. **Local → Online 回传**：在用户明确授权下回传回复状态 / 单据阶段，并定义冲突策略。

## 在线公开前仍必须完成

- 登录 / 注册
- 租户隔离和权限
- 生产 PostgreSQL
- API Key 加密
- 队列 / 并发 / 配额
- 邮箱发送治理
- 审计日志
- 团队协作
- Product Brain / Customer Memory / Deal 的云端持久化与冲突策略

**目标不是“抓越多邮箱越好”，而是先把自己的商品事实说清楚，再找到值得联系的客户，把真正的机会一路推进到正式单据。**
