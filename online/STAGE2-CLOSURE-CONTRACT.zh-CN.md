# HUIDI Docs Online / Community Local · Stage 2 Closure Contract

本契约建立在 `UX-CLOSURE-CONTRACT.zh-CN.md` 之上，继续固定高频页面、Catalog、邮件和双向业务状态的边界。

## 1. Catalog：常用优先

产品目录制作默认进入“常用设置”。

常用层保留：

- 商品来源 / 商品资料库导入
- 公司 / 品牌资料
- 目录标题
- 目录用途预设
- 价格 / MOQ / 单位
- 封面
- 导出文件名
- PDF 预览 / 导出

高级层承接：

- 图文间距
- 图片 Fit 微调
- 临时主题色
- 字段 Mapping
- 技术 / 辅助设置
- 低频帮助内容

切换常用 / 高级只改变可见层级，不删除、重置或改写高级值。

Catalog PDF、分页、商品映射、图片和项目保存仍由原有 Owner 管理；`huidi-catalog-ux-closure-v1.js` 只拥有最终交互分层。

## 2. 客户 / 询盘 / 商品详情

快速详情与完整编辑必须分离。

快速详情顶部统一显示：

- 当前上下文
- 下一步
- 关键日期 / 阶段
- 业务关联

低频字段继续留在完整编辑中，不把快速详情做成第二份表单。

## 3. 邮件工作台

邮件草稿必须尽量保留并显示：

- `customer_id`
- `deal_id`
- `online_source_lead_id`（若来自 Online）
- 收件人
- Subject / Body
- 草稿是否已经人工确认

邮件列表应显示客户和关联询盘。点击邮件行先进入快速预览，“继续处理”再进入原邮件编辑器。

邮件不得新建第二套 Customer / Deal Owner。

## 4. Online → Local

继续使用：

`huidi.business.bundle/v1`

用户在 Online 主动发起，本机再次确认后写入 Community Local。

## 5. Local → Online

使用：

`huidi.local.business.status/v1`

标准流程：

`Local Online来源询盘 → 同步进度到 Online → 打开 Online 确认卡 → 用户确认 → 写入对应 Lead 时间线`

V0.1.4 只同步当前业务所需字段：

- Online Lead ID
- Customer ID / Name
- Deal ID / Title
- 当前 Stage
- Next Action / Date
- 必要业务摘要
- 可选文档引用

不得后台静默上传整个客户库、商品库、单据库或浏览器存储。

## 6. 评分与业务阶段分离

Online 的 A/B/C/D 和 `score` 是获客优先级。

Community Local 的 Stage / probability 是业务推进状态。

Local → Online 状态同步不得拿订单阶段覆盖获客评分，也不得把获客分直接当成交概率。

## 7. 当前邮件边界

Stage 2 只完成邮件草稿与业务链关联。

真实发送仍未开放，直到完成：

- Gmail / Outlook / SMTP 账户连接
- OAuth / Secret 加密
- 每日额度和发送间隔
- Bounce
- 退订
- 黑名单
- Reply-stop
- 审计日志

## 8. CI 不得回退

必须持续验证：

- Catalog UX Owner JS 语法
- Workspace Stage 2 JS 语法
- Local Status Sync UI JS 语法
- Local Status Python endpoint
- Local Status 回归测试
- Mail customer/deal linkage marker
- Local → Online schema marker
- Online → Local Business Bundle
- 原有 Product Brain / Pagination / Notification / Documents 契约
