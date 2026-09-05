# HUIDI Docs Online · Lead Workbench

> 在线版开发线：把“商品事实 → 开发客户 → 客户背调 → 联系人 → 开发信 → 跟进 → 客户/询盘 → 产品目录 → 报价 → PI → 合同 → CI / 装箱单”接成同一条业务链。

当前阶段：**V0.1.3 Product Brain + Growth Workflow + Business Bridge V1**

Community Local 商品页现已直接提供 **“用于 Online 开发客户”** 入口；商品显式进入 Product Brain 后，再进入 Campaign Brief、潜在客户搜索、透明评分、Buying Signals、客户背调、开发信、跟进，并可通过 Business Bridge 回到同一个客户 / 询盘 / 商品 / Catalog / Quotation / PI / Contract / CI / Packing List 业务链。

Product Brain、Lead / Customer Memory、Runtime Context 三层严格分离；临时搜索或模型推断不会自动回写正式商品事实。线索详情提供 Next Best Action、Buying Signals、Open Threads 与 Strategy / Hunter / Profiler / Writer / Outreach / Closer 业务进度，但不会在缺少证据时编造买入信号。

`SuperGokou/caijiwaimao` 仅作为产品与架构研究参考。其 README 标注 `Internal · Confidential · 仅供核心团队使用`，HUIDI 不复制其 HTML、CSS、Demo、内部文案或 Prompt；详细许可边界见 `THIRD-PARTY-NOTICES.md`。

Online PR 持续运行 Python、买家评分、FastAPI、Product Brain、Growth Workflow、Local Bridge、商品入口、Business Bundle、五类正式单据、Catalog、Mail、真实 Node Bridge Regression 和 Secrets 门禁。

下一阶段：Product Brain 服务器持久化 → 邮箱账户与发送治理 → 真实背调 Provider → Buying Signals Provider → 地图找客户 → 外贸情报 → 用户授权的 Local → Online 状态回传。
