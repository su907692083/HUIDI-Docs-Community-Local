# HUIDI Docs Online · Lead Workbench

> 在线版开发线：把“商品事实 → 开发客户 → 客户背调 → 联系人 → 开发信 → 跟进 → 客户/询盘 → 产品目录 → 报价 → PI → 合同 → CI / 装箱单”接成同一条业务链。

当前阶段：**V0.1.3 Product Brain + Growth Workflow + Business Bridge V1**

## 已经做通的主链

Community Local 商品资料 → 商品页“用于 Online 开发客户” → Product Brain → Campaign Brief → 搜索潜在公司 → A/B/C/D 透明评分 → Buying Signals → 客户背调 → 联系人 → AI 开发信 → 人工确认 / 跟进 → Online → Local 显式同步 → 客户 / 询盘 / 邮件草稿 → Catalog / Quotation → PI → Contract → CI / Packing List。

## Product Brain

Product Brain 不是第二套商品库，而是把 Community Local 已有商品整理成 Online 获客和开发信可以安全调用的事实源。持久产品事实、Lead / Customer Memory 和临时 Runtime Context 三层明确分开，临时搜索或模型内容不会自动回写正式产品参数。

## Growth Workflow

线索详情显示 Next Best Action、Buying Signals、Open Threads，以及 Strategy / Hunter / Profiler / Writer / Outreach / Closer 业务进度。没有公开证据时不会编造 Buying Signal。

## Business Bridge V1

Online 通过 `huidi.business.bundle/v1` 显式同步回 Community Local；Local 复用现有 `HUIDILocalCore`、客户、商品、询盘、邮件草稿、Catalog 和五类正式单据数据 Owner，不另造一套 CRM。

## 第三方研究边界

`SuperGokou/caijiwaimao` 的 README 标注 `Internal · Confidential · 仅供核心团队使用`，因此 HUIDI 只研究其 Product Brain、Campaign / ICP、Buying Signals、Open Threads、Brain / Memory 分层等产品方法，不复制其 HTML、CSS、Demo、内部文案或 Prompt。详细许可边界见 `THIRD-PARTY-NOTICES.md`。

## CI 门禁

Online PR 检查 Python 编译、买家评分回归、FastAPI 导入、Online / Product Brain / Growth Workflow JS、Local Bridge、Community Local 商品入口、Business Bundle / 五类单据 / Catalog / Mail 契约、真实 Node bridge regression、Product Brain regression 和 Secrets 泄漏。

## 下一阶段

Product Brain 服务器持久化 → Gmail / Outlook / SMTP 邮件账户与发送治理 → 真实背调 Provider → Buying Signals Provider → 地图找客户 → 外贸情报 → 用户授权的 Local → Online 状态回传。

**目标不是抓越多邮箱越好，而是先把自己的商品事实说清楚，再找到值得联系的客户，把真正的机会一路推进到正式单据。**
