# HUIDI Online · 当前接管交接（新会话必读）

更新时间：2026-09-05

> 本文件是新 ChatGPT / Codex 会话的接管入口。不要仅凭聊天记忆继续施工；先核 GitHub 当前状态。

## 1. 仓库与正式边界

- Repo：`su907692083/HUIDI-Docs-Community-Local`
- 正式主线：`main`
- Community Local 正式发布仍为：`v1.2.0-rc16.29` / RC16.29
- Online 开发分支：`online/v0.1-lead-workbench`
- Online Draft PR：`#2`
- PR 定位：`HUIDI Online — Foreign Trade Daily Workbench`
- 当前 PR 必须继续保持 Draft，除非用户明确要求合并。
- 不要把 Online 施工直接覆盖或破坏已发布的 Community Local 主线。

新会话首先执行：
1. 读取 PR #2 当前 metadata / head SHA / changed files。
2. 查看最新 `Online V0.1 Check`。
3. 读取本文件、`online/README.md`、`online/DAILY-WORKBENCH-CONTRACT.zh-CN.md`、`online/STAGE2-CLOSURE-CONTRACT.zh-CN.md`、`online/UX-CLOSURE-CONTRACT.zh-CN.md`。
4. 只读核对以后再继续施工。

## 2. 产品定位——这是最重要的原则

HUIDI Online **不是“获客小工具”或“单据工具网页版”**。

最终定位：

**外贸人的每日专属工作台 / Foreign Trade Daily Workbench**。

用户每天打开它，核心路径应当是：

`今天 → 待跟进 → 客户回复 → 找新客户 → 背调 → 联系人 → AI 开发信 → 真实邮件发送 → 询盘 / 业务 → 商品 / 产品目录 → Quotation → PI → Contract → CI / Packing List → 出运 / 下一步`

单据只是工作流的一部分，不是整个产品。

设计原则：
- 简单、快捷、高效、一页式优先。
- 表格优先，少跳页，详情优先使用右侧抽屉。
- 复杂能力必须隐藏在用户自然动作后面，不要让用户学 Agent / Prompt / 技术参数。
- 所有实用能力必须尽量真实调用业务场景，避免“规划卡片”“假按钮”“演示功能”。
- Online 是联网主产品，可以充分利用外部 Provider、API、SMTP、OAuth、地图、贸易数据、汇率、物流、关税、通知等能力。
- Community Local 作为本地/离线模式、文件/单据能力和隐私补充，不再限制 Online 的联网能力。

## 3. 已经形成的核心业务链

### Product / Growth

`Local Product → Product Brain → Campaign / ICP → Lead Search → A/B/C/D 透明评分 → Buying Signals → Due-Diligence → Contact → AI Draft → Mail → Follow-up`

### Business

`Lead → Customer / Inquiry → Catalog → Quotation → PI → Sales Contract → Commercial Invoice → Packing List`

### Bridge

Online → Local：`huidi.business.bundle/v1`

Local → Online：`huidi.local.business.status/v1`

Local → Online 目前采用显式用户确认；不要偷偷上传整套本机客户库 / 商品库 / 单据历史。

## 4. 已完成的主要能力

### Lead / Customer Development
- FastAPI Online API
- Serper 搜索入口
- Demo fallback
- 域名去重
- A/B/C/D 透明评分
- 产品匹配 / 买家角色 / 市场 / 采购信号 / 官网 / 联系性等 breakdown
- 联系人 / 公开业务邮箱查找
- 客户背调初筛
- Buying Signals
- Open Threads
- Next Best Action
- Lead Activity 时间线
- Follow-up
- Lead → HUIDI Customer / Inquiry Bridge

### Product Brain
- `huidi.product.brain/v1`
- Product Brain / Lead-Customer Memory / Runtime Context 分层
- Local 商品显式交给 Online
- 保留 Local Product ID
- 商品事实不能被临时网页搜索或 AI 推断污染

### Community Local UX Closure
- Deals / Customers / Products / Documents / Mail 分页
- 默认 50 行，可切 20 / 50 / 100 / 200
- 只重绘当前列表
- 客户 / 询盘 / 商品统一快速详情抽屉
- document-start 搜索式选择
- 二级页返回上下文
- Hash 导航统一
- Catalog 常用 / 高级分层
- Notification Center
- Mail 与 customerId + dealId + Online Lead 关联

### Bidirectional Business Bridge
- Online Lead → Local Customer + Deal + Mail + Product match
- Local Deal → Online Lead Timeline 状态回传
- Lead A/B/C/D 评分与 Deal probability / stage 分离

## 5. 邮件能力——方向已经改为“真实可用”，不要再阉割

用户明确要求：Online 是联网版，**SMTP 等真实能力必须开放**。

已施工方向包括：
- 多发送邮箱
- SMTP host / port
- STARTTLS / SSL-TLS / Plain
- SMTP username + password / app password
- `HUIDI_SECRET_KEY` 加密保存凭据
- SMTP 连接测试
- 真实 `send_message()` 路径
- 每日额度
- 最小发送间隔
- 退订 / 黑名单
- 回复 / 转询盘 / 归档后停止冷开发
- 发送审计日志
- Message-ID
- 成功发送后 Lead 状态推进到 `contacted`

注意：
- 不要再把 Online 邮件改回永久 `review_only`。
- 可以保留发送前治理与确认，但不能把真实 SMTP 能力藏掉或禁用掉。
- 后续优先继续 Gmail OAuth2 / Outlook OAuth2 / Inbox / Thread / Reply detection / Bounce / Unsubscribe / Queue / Retry。

## 6. Daily Workbench 方向

Online 首页要成为每天打开的主页面，不是“开发客户搜索页”。

真实摘要应来自数据库，例如：
- 今日发送
- 发送失败
- 待处理线索
- 客户回复
- 已转询盘
- 已配置 / 已连接邮箱
- 待跟进
- 最近业务活动
- 今日下一步

导航应该围绕日常工作，而不是技术模块：

**今日工作**
- 工作台
- 待跟进
- 客户回复
- 通知 / 待办

**开发客户**
- 找客户
- 地图找客户
- 线索池
- 背调
- 联系人

**邮件与跟进**
- 收件箱
- 已发送
- 草稿
- 邮箱账户
- 跟进序列

**客户与业务**
- 客户
- 询盘 / Deal
- 报价
- PI
- 合同
- CI / PL

**商品与内容**
- 商品
- Product Brain
- 产品目录

**外贸工具 / Intelligence**
- Trade Intelligence
- HS / Tariff
- FX
- Shipping / Schedule
- Tool Box

## 7. 研究过的第三方项目与融合原则

研究源包括：
- `1099271/smart-lead-agent`
- `Tommy-old/b2b-buyer-discovery`
- `kakacells/Customer_background_check_version1.2`
- `uyoufu/UZonMail`
- `chnjames/tradehot-skill`
- `dongsheng123132/ai-tungke`
- `tshwangq/awesome-foreign-trade`
- `CreatiBI/cli`
- `howarliu1993/NPI-repo`
- `eicloud/eicloud.github.io`
- `SuperGokou/caijiwaimao`
- `wanlang0118/xian-yu-guan-li`

原则：
- Apache-2.0 / MIT：可在保留许可与归属后择优改造。
- GPL / 未明确 LICENSE / README 自述许可 / Internal / 禁止商业用途：只研究产品思路与架构，HUIDI 独立重写，不直接复制源码。
- 不把多个仓库简单拼接成“功能杂货铺”；所有能力必须回到 HUIDI 的 Customer / Product / Lead / Deal / Mail / Document / Next Action 主模型。

## 8. 下一阶段优先级

优先继续：

1. Gmail OAuth2 + Outlook OAuth2
2. Inbox / Sent / Thread / Reply detection
3. 客户回复自动写入 Lead / Customer / Deal Timeline，并停止冷开发序列
4. Mail Queue / Retry / Bounce / Unsubscribe
5. Product Brain 服务端持久化
6. 真实公司 / 工商 / 海关背调 Provider
7. 地图找客户
8. Trade Intelligence
9. HS / Tariff
10. FX
11. Shipping / Schedule
12. Online 多租户 / 用户 / 团队 / 权限 / 协作
13. 生产级 Secret / Notification Router / Audit

## 9. 施工纪律

新会话禁止：
- 不看 PR 当前状态就直接改代码。
- 从旧版本 / 旧聊天记忆拼装回退。
- 直接改 `main`。
- 把 Online 再定位回“单据为主”。
- 把真实联网能力阉割成 Demo。
- 为每个新功能单独造 Customer / Product / Inquiry 数据孤岛。
- 把临时搜索 / AI 推断写成正式 Product Brain 事实。
- 大数据量页面重新回到一次渲染全部 DOM。

新会话每轮建议流程：
1. Read-only audit。
2. 明确唯一 Owner / Contract。
3. 最小范围施工。
4. Python / JS 语法与专项回归。
5. GitHub Actions 全绿。
6. 明确“已实现 / 仍未实现”，不要夸大。
7. PR #2 保持 Draft，除非用户明确要求合并。

## 10. 给新会话的第一句话

用户可以直接复制：

> 你现在接手我的 `su907692083/HUIDI-Docs-Community-Local` 项目。先不要施工。请读取 `online/HANDOFF-CURRENT.md`、`online/README.md`、PR #2、`online/v0.1-lead-workbench` 当前 head 和最新 Online V0.1 Check，做只读接管审计。正式 `main` / Community Local RC16.29 不要动。Online 定位是“外贸人的每日专属工作台”，不是获客附属页或单据工具；真实联网能力（SMTP、OAuth、搜索、背调、地图、贸易数据等）应充分发挥并接入实际业务链。只读审计完成后先向我汇报当前基线、已完成能力、未完成能力、下一施工优先级，再等我说开始施工。
