# HUIDI Docs Online · Lead Workbench

> 在线版开发线：把“商品事实 → 开发客户 → 客户背调 → 联系人 → 开发信 → 跟进 → 客户/询盘 → 产品目录 → 报价 → PI → 合同 → CI / 装箱单”接成同一条业务链。

当前阶段：**V0.1.3 Product Brain + Growth Workflow + Business Bridge V1**

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

## Product Brain

Product Brain 不是第二套商品库，而是把 Community Local 已有商品资料整理成 Online 获客和开发信可以安全调用的事实源。

主要字段包括：商品名称 / SKU / 分类 / 系列、规格、价格、MOQ、交期、认证、差异化、客户案例、公司基本盘、允许引用事实、禁止擅自承诺、HS Code、原产国、包装、箱规、CBM 和目标关键词。

HUIDI 明确分开三层数据：

1. **Product Brain**：持久产品事实。
2. **Lead / Customer Memory**：Buying Signals、客户画像、联系人、回复、跟进、Deal 状态。
3. **Runtime Context**：某次搜索、模型中间判断、正在生成的邮件草稿。

临时搜索或模型内容不会自动写回正式产品参数。

## Community Local → Online 商品交接

Community Local 商品资料库现在直接出现 **“用于 Online 开发客户”**。

点击后进入 `product-online-handoff.html`，读取现有 `HUIDILocalCore.repositories.products`。用户明确选择一个商品后，才通过 URL Fragment 把该商品交给 Online Product Brain。

- 不自动上传整个本机商品库
- 不后台同步
- 不覆盖 Local 商品
- 保留 Local 商品 ID 用于稳定映射
- Online 只补充认证 / 案例 / 差异化 / 禁止承诺等获客知识

## Campaign Brief

Product Brain 可以形成轻量 Campaign Brief：当前产品、产品关键词、目标国家、买家类型、推荐切入卖点、事实摘要和禁止承诺项。

## Growth Workflow

每条线索详情现在会显示：

- **Next Best Action**：当前最值得做的下一步
- **Buying Signals**：只从已保存公开证据里识别采购、项目、招聘、融资、扩张等信号
- **Open Threads**：联系人、贸易证据、开发信、跟进计划等未收口事项
- **角色进度**：Strategy / Hunter / Profiler / Writer / Outreach / Closer

这些角色不是六个独立按钮，而是同一条业务链的状态视图。没有证据时不会编造 Buying Signal。

## Business Bridge V1

Online 线索可以显式同步回 Community Local：

1. Online 生成 `huidi.business.bundle/v1`。
2. 打开用户自己的 `127.0.0.1` Local Bridge。
3. 用户先核对客户、询盘、背调和邮件草稿。
4. Local 在已有商品库中匹配商品。
5. 用户确认后才写入现有 `HUIDILocalCore`。
6. 导入后继续客户、询盘、邮件、Catalog 或五类正式单据。

Local 继续复用原有数据 Owner：

- 客户：`huidi_local_customers_v1`
- 商品：`huidi_local_products_v1`
- 询盘 / 订单：`huidi_local_deals_v2`
- 邮件草稿：`huidi_local_mail_drafts_v2`
- 单据上下文：`HUIDILocalCore.context`

五类正式单据继续围绕同一 `customerId + dealId + productIds`：Quotation、PI、Sales Contract、CI、Packing List。

## 透明评分与背调

获客分数只用于 A/B/C/D 跟进优先级，不冒充 Local Deal 的成交概率。

客户背调当前只根据真正掌握的基础资料、公司存在信号、联系人、数字资产和业务匹配判断；工商 / 官方注册 / 海关采购历史没有接入时明确显示“未验证”。

## 开发信与跟进

- OpenAI-compatible LLM
- 无 LLM 时模板降级
- 多语言开发信
- Product Brain 事实调用
- 草稿人工确认 / 退回
- 下一次跟进
- LeadActivity 时间线
- 草稿可同步进 Community Local 邮件草稿

当前不自动批量发送冷邮件；真实发送要等邮箱账户、配额、退订、黑名单、Bounce、回复停止与审计门禁完成。

## 第三方研究边界

当前研究包括 smart-lead-agent、b2b-buyer-discovery、UZonMail、Customer Background Check、tradehot-skill、ai-tungke、awesome-foreign-trade、caijiwaimao。

`SuperGokou/caijiwaimao` 的 README 标注 `Internal · Confidential · 仅供核心团队使用`，因此 HUIDI 只研究其 Product Brain、Campaign / ICP、Buying Signals、Open Threads、Brain / Memory 分层等产品方法，**不复制其 HTML、CSS、Demo、内部文案或 Prompt**。详见 `THIRD-PARTY-NOTICES.md`。

## CI 门禁

Online PR 自动检查：

- Python 编译
- Buyer scoring regression
- FastAPI import
- Online browser JS syntax
- Product Brain core / UI / Growth Workflow JS syntax
- Local bridge JS syntax
- Community Local 商品入口 JS syntax
- Local Product → Online handoff marker
- Business Bundle / 五类单据 / Catalog / Mail 契约 marker
- 真实 Node bridge regression
- Product Brain core regression
- 本地 Secrets 不入库

## 下一阶段

1. Product Brain 服务器持久化，同时保持 Community Local 商品为主数据 Owner。
2. Gmail / Outlook / SMTP 邮件账户、发送审批、配额、退订、黑名单、Bounce、回复停止。
3. 真实背调 Provider。
4. Buying Signals Provider。
5. 地图找客户。
6. 外贸情报与 HS / 关税 / 物流 / 风险。
7. 用户明确授权下的 Local → Online 状态回传与冲突策略。

在线公开前仍需登录 / 注册、租户隔离、生产数据库、密钥加密、队列配额、审计、团队权限和正式同步策略。

**目标不是抓越多邮箱越好，而是先把自己的商品事实说清楚，再找到值得联系的客户，把真正的机会一路推进到正式单据。**
