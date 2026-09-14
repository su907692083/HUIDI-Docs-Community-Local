# HUIDI Notification Contract V1

> 目标：把“要处理的事情”集中到一个通知中心，而不是每个页面各造一套弹窗、红点和第三方推送。

## 1. 两层模型

HUIDI 通知分成两层：

### A. Event / Reminder

业务本身发生了什么，或者今天需要用户做什么。

```text
huidi.notification.event/v1
- id
- key / dedupe_key
- type
- category
- source_view
- entity_type
- entity_id
- title
- summary
- priority
- due_at
- status
- read_at
- created_at / updated_at
- action { view, label }
- payload
```

### B. Channel / Route

用户希望通过什么方式收到重要事件。

```text
huidi.notification.channel/v1
- id
- name
- type
- address / encrypted config
- enabled
- event scope
- created_at / updated_at
```

Community Local 当前只在本机保存 Channel 地址和规则；不自动向外部地址发送。

正式 Online 发送层必须使用服务器端加密存储，并由用户显式启用。

## 2. 当前页面映射

| 页面 / 能力 | 当前提醒 | 点击后 |
|---|---|---|
| 工作台首页 | 汇总重要 / 今天 / 未读 | 通知抽屉内处理 |
| 询盘与订单 | 下一步到期 / 逾期；业务阶段；验货 / ETD / ETA | `deals` |
| 客户中心 | 客户 follow-up 到期 | `customers` |
| 商品资料库 | 默认不因普通修改刷通知 | `products`（后续只提醒关键资料缺口） |
| Online 开发客户 | 线索显式转入 Local | `deals` |
| 邮件草稿 | Online 草稿待确认 / 已确认待发送 | `mail` |
| 产品目录 | 当前不产生高频通知 | `catalog` |
| 单据中心 | 默认不因每次保存刷屏；可在设置开启 | `documents` |
| Quotation / PI / Contract / CI / Packing List | 保存事件可进入通知中心；阶段事件回到同一 Deal | `documents` / `deals` |
| 生产 / 验货 / 订舱 / 出运 | 通过 Deal 阶段与日期提醒 | `deals` |

## 3. 当前 Local 事件来源

Notification Center 直接复用 `HUIDILocalCore`，不维护第二套业务数据库。

已接事件：

- `online.bridge.imported`
- `document.saved`
- `business.event`
- `deal.changed`
- `customer.changed`
- `mail.changed`

并会从以下字段做低成本扫描：

- Deal `next_action_at`
- Customer `followup_date`
- Deal `inspection_date`
- Deal `etd`
- Deal `eta`
- Online mail draft approval / send state

扫描只产生确定性提醒，并通过 deterministic key 去重。

## 4. 默认提醒规则

默认开启：

- 询盘跟进
- 客户跟进
- 验货 / ETD / ETA
- Online 线索转入
- Online 开发信草稿
- 关键业务阶段

默认关闭：

- 每次单据保存
- 每次商品编辑

原则：**通知中心不是操作日志。**

只有需要用户行动、需要留意期限、或业务阶段真正变化的事件才默认提醒。

## 5. 一页式交互

主工作台所有页面共用右上角“提醒”入口。

打开后在同一抽屉完成：

- 看重要提醒
- 看今天
- 看未读
- 看全部记录
- 标记已读
- 标记完成
- 忽略
- 一键回到对应业务页面
- 开关提醒规则
- 配置外部通知地址

不要求用户进入“系统设置 → 通知设置 → 规则 → 渠道 → 返回业务”多层页面。

## 6. 外部通知渠道规划

研究上游通知模型后，HUIDI Channel Registry 预留：

- Feishu
- Lark
- DingTalk
- WeCom / 企业微信
- generic Webhook
- Email
- Telegram
- Bark

不直接支持“个人微信机器人”作为默认通道；需要时应走明确、可授权的企业微信 / Webhook 服务。

## 7. Local / Online 安全边界

### Community Local

- 事件和提醒：localStorage
- 渠道地址：localStorage（开发阶段）
- 不静默外发
- 不把 Token / Webhook 写进 GitHub

### HUIDI Online 正式发送层

后续必须：

- 登录和 tenant 隔离
- encrypted channel config
- test-send
- event type allowlist
- rate limit
- retry / failure state
- delivery audit
- mute / quiet hours
- per-user / per-team routing
- secret masking
- SSRF / private-network protection for generic Webhook

## 8. 去重原则

同一个确定性提醒必须使用稳定 key，例如：

```text
deal.followup:<dealId>:<date>
customer.followup:<customerId>:<date>
shipping.etd:<dealId>:<date>
mail.online-draft:<mailId>
online.import:<sourceLeadId>
```

重复扫描只更新原提醒，不生成多条垃圾通知。

## 9. 后续连接 Online 的顺序

1. Local Notification Center（已落地）
2. Online encrypted Channel Registry
3. Webhook / Feishu / DingTalk / WeCom test-send
4. Email / Telegram / Bark Provider
5. Quiet Hours / Routing Rules
6. Online reply / lead / trade-intelligence event ingress
7. Delivery Audit + Retry
8. Team notification permissions

这样 HUIDI 的通知会跟业务链一起增长，而不是后来变成一个难维护的“消息插件集合”。
