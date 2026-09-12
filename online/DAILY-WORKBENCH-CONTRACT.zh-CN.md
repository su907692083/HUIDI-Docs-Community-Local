# HUIDI Online · Daily Workbench Contract

本契约用于防止 Online 再退回“单据联网版 / 获客 Demo / 功能集合页”。

## 1. 产品身份

HUIDI Online 是外贸人的每日主工作台。

用户每天进入系统首先回答：

- 今天要跟谁？
- 哪些客户回复了？
- 哪些邮件要发？
- 哪些业务要继续？
- 哪些客户值得开发？
- 哪些订单 / 单据正在推进？

单据只是业务链的一部分。

## 2. 主工作链

`Product → Lead → Customer → Contact → Mail → Reply → Inquiry / Deal → Catalog / Quotation → PI → Contract → CI / PL → Follow-up`

任何新能力必须能关联至少一个业务实体：

- Product
- Lead
- Customer
- Deal
- Mail / Thread
- Document

禁止长期存在“用完即丢、无法回到业务”的孤立工具。

## 3. 首页

首页不是宣传 Dashboard。

必须使用真实数据展示：

- 今日已发送
- 待处理线索
- 客户回复
- 已转询盘
- 邮箱连接状态
- 待跟进
- 最近业务活动

每个卡片最终都应能进入对应可执行任务。

## 4. 邮件

联网版邮件能力必须是真实生产能力，而不是只生成草稿。

当前 SMTP 必须支持：

- 配置
- 凭据加密
- 连接测试
- 真实发送
- 每日额度
- 最小间隔
- 黑名单 / 退订
- 回复停止
- 审计日志
- Message-ID
- Customer / Deal / Lead 关联

后续继续增加：

- Gmail OAuth2
- Outlook OAuth2
- Inbox / Sent
- Thread
- Reply detection
- Bounce
- Sequence
- Queue

发送治理不能被理解为阉割。治理用于让真实发送能力长期可用、可审计、不会误发。

## 5. 在线 Provider

Online 应优先使用真实联网 Provider：

- 搜索 / 地图
- 工商 / 公司数据
- 海关 / 贸易数据
- HS / 关税
- 汇率
- 物流 / 船期
- 新闻 / Trade Intelligence

没有 Provider 时可以明确显示“未配置 / 未验证”，不能用假数据伪装生产能力。

## 6. 一页式原则

高频动作必须满足：

- 当前页面直接完成，或
- 一次跳转进入明确目标

复杂配置进入 Settings；业务页面只显示当前需要的信息和下一步。

## 7. Online 与 Community Local

Online 是主产品。

Community Local 继续作为：

- 离线模式
- 本地数据模式
- 本地单据 / 文件工作流补充

两者通过显式 Business Bridge 互通，但 Online 不能依赖 Local 才能完成核心联网业务。

## 8. 禁止回退

后续不得：

- 把真实 SMTP 再改回永久 review-only
- 把 Online 首页重新变成单一“找客户”页面
- 把单据中心当成 Online 的全部产品
- 新增无法关联 Customer / Deal / Product / Lead 的孤立业务工具
- 用静态 Demo 冒充真实联网 Provider
- 因配置复杂而把核心能力直接隐藏或删除
