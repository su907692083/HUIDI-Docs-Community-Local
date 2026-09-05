# HUIDI Online · 当前接管交接（新会话必读）

更新时间：2026-09-06

> 本文件是 Online 新会话接管入口。先核 PR #2 当前 head 和该 head 的 `Online V0.1 Check`，禁止从旧聊天、旧 SHA 或旧待办清单直接施工。

## 1. 正式边界

- 仓库：`su907692083/HUIDI-Docs-Community-Local`
- 正式主线：`main`
- `main`：`765e8cfe82eb49aabb2f75abb1da0cfbe4c936eb`
- Community Local 正式发布：`v1.2.0-rc16.29 / RC16.29`
- Online 开发分支：`online/v0.1-lead-workbench`
- Online Draft PR：`#2`
- PR 必须保持 Draft、不得合并 main，除非用户明确要求。
- Online 施工不得覆盖、回退或破坏 Community Local 正式主线。

本文件重写前最后一条已完整验证的实现 head：

`810cb0a46c335c0bdaf6c14bb5a9dc0eb966f8c5`

对应 `Online V0.1 Check` run `33981732620`：completed / success。

之后又追加了 Owner 防回退测试和本交接文件，因此新会话仍必须读取 PR 的**实际当前 head**与该 head 的最新 Check；只有 exact current head 为 completed / success 才能称为新绿线。

## 2. 产品定位与主链

HUIDI Online = **外贸人的每日专属工作台 / Foreign Trade Daily Workbench**。

主链：

`今天 → 待跟进 → 客户待回复 → 找客户 → 地图找客户 → 客户背调 → 联系人 → 产品资料 → AI 开发信 → 真实邮箱 → 稍后发送 / 自动跟进 → 客户 / 询盘 → 报价 → PI → 合同 → CI / 装箱单 → 出运 → 下一步`

原则：
- 普通用户只看大白话，不堆 SMTP / OAuth / API / Provider / Queue / Tenant / Schema 等内部词。
- 未连接真实数据源时明确显示“未连接”，禁止演示数据冒充正式客户或正式业务数据。
- 联网结果必须回到 Lead / Customer / Deal / Product / Mail / Document / Next Action。
- 联网参考不会自动污染正式产品事实、价格、合同、装箱资料。
- Community Local 是本地/离线和成熟单据能力补充，不是 Online 联网能力上限。

## 3. 当前已完成能力

### 今天 / Daily Workbench

当前“今天”已经是行动清单，不再只是统计面板：
- 按**当前公司的工作时区**划分今天。
- Lead 跟进到期 / 逾期进入“今天待推进”。
- Deal / 询盘 `next_action_at` 到期 / 逾期也进入“今天待推进”。
- 客户来信只有在**尚未处理**时进入“客户待回复”。
- 同一邮件线程后续已回复，则从待回复移除。
- 即使不是在线程页回复，只要客户来信后存在成功发信记录，也视为已处理。
- “待发送”只统计真实 `MailQueueItem`，不再统计旧 `MailDispatchPlan`。

公司工作时区由 `CompanySetting` 持久化在每家公司的独立业务库，老板/管理员可用“工作时间”选择中国大陆、日本、英国、美国东部等地区；普通业务员无需理解时区代码。

### 找客户 / 地图 / 背调 / 联系人

已形成：
- 真实在线搜索接入位。
- 无真实搜索服务时不生成假客户 / 假联系人。
- A/B/C/D 透明 Lead 评分。
- 域名去重与公开证据。
- 地图找客户并进入同一 Lead 线索池。
- 客户背调初筛与公开联系人发现。

### 产品资料

`huidi.product.brain/v1` 已服务端持久化。

正式规格、MOQ、价格、交期、认证、包装、HS、原产国等属于长期产品事实；临时搜索、客户信号与 AI 推断不得自动改写正式事实。

### 真实邮件闭环

已完成：
- Gmail / Outlook / 其他企业邮箱连接。
- SMTP 真实发送底层。
- 收件箱 / 已发送同步。
- 同客户邮件往来与 HUIDI 内直接回复。
- Reply detection / Reply-stop。
- 每日发送量、发送间隔、退订 / 黑名单。
- Bounce / unsubscribe / complaint 回写。
- Queue / Retry。
- 自动跟进序列，回复 / 退订 / 转询盘 / 归档后自动停止。

#### 旧 mail-plan 已退役为只读历史

`MailDispatchPlan` 仅保留历史读取，禁止再成为新待发送 Owner。

当前规则：
- 新 UI “稍后发送”只写真实 `MailQueueItem`。
- 首页待发送只认真实 Queue。
- 历史客户端继续调用 `/api/leads/{lead_id}/mail-plan` 时，也会兼容转入真实 Queue。
- 同一客户 + 同一草稿 + 同一发送邮箱重复调用旧入口，仍保持防重复语义，返回同一个 Queue ID。
- 旧入口不会再新增 `MailDispatchPlan` 记录。

### Customer / Deal / 单据

Online 已持续保存 Customer / Deal：客户、联系人、邮箱、国家、官网、阶段、概率、金额、币种、需求、下一步和单据关联共用同一业务 Owner。

Quotation / PI / Contract / CI / Packing List 沿同一笔业务进入成熟单据链。

联网资料进入单据前必须人工确认；确认后单独记录谁、何时、用于哪种单据，仍不会自动改写正式业务事实。

### 联网业务资料

`OnlineIntelligenceRecord` 已持久化。

企业核验、贸易记录、市场情报、HS / 关税、汇率、船期 / 物流可以挂回当前 Lead / Deal，并在客户 / 询盘中持续回看。

### 正式外贸数据服务适配层

公司级数据服务连接继续保存：企业核验、贸易 / 海关、HS / 关税、船期 / 物流。

本轮新增 `ServiceAdapterSetting`，真实业务查询不再假定所有数据商都是同一种 POST + Bearer 接口。当前支持：
- 常见授权。
- 请求头密钥。
- 查询参数密钥。
- 无授权 JSON。

业务员仍只使用“企业核验 / 贸易记录 / 关税 / 船期”等业务入口；老板 / 管理员在“数据服务”里选择接入方式并检查连接。

安全规则：
- 授权信息加密保存且不回显。
- 每家公司设置物理隔离。
- 默认只允许公网 http / https 数据服务。
- 默认拒绝 localhost、loopback、私网、link-local 等服务器本机 / 内网地址。
- 默认不自动跟随数据服务跳转。
- 企业确实需要可信内网服务时，部署方必须显式开启 `HUIDI_ALLOW_PRIVATE_SERVICE_ENDPOINTS=1`。

注意：**适配底座已完成，但具体商业数据商仍需实际采购 / 配置 / 现场验证。** 未配置时继续显示“未连接”，不能称为已经拥有正式海关、工商、关税或船期数据。

## 4. 团队、多公司与审计

已完成真实多公司物理隔离：
- 公司 #1 保留历史 `DATABASE_URL`。
- 公司 #2+ 使用独立业务数据库。
- 登录请求先确定公司，再进入该公司的业务数据库。
- Lead、Customer、Deal、Product、Mail、Queue、Sequence、Intelligence、Reminder、Audit、Backup 等沿公司边界隔离。
- 后台邮件、自动跟进、提醒、自动备份按公司分别执行。

角色：老板、管理员、业务员、只读成员。

操作记录自动记录业务动作，不保存密码、邮件正文、授权内容或完整表单原文。新增动作包括：
- 修改公司工作时间。
- 加入待发送。
- 修改 / 检查数据服务接入方式。
- 邮件、询盘、产品、成员、备份与单据参考确认等既有动作。

## 5. 提醒与数据保护

已完成：
- HUIDI 站内提醒。
- 飞书 / 企业微信 / 钉钉 / 其他通知入口。
- 安静时段、去重、失败重试。
- 客户回复、逾期跟进、邮件异常、询盘业务、备份异常。
- 单人模式和默认公司也会自动运行外部提醒。

SQLite 部署已完成：
- 公司独立业务备份。
- 手动恢复。
- 恢复前安全备份。
- 公司边界校验、完整性校验、安全密钥一致性保护。
- 自动备份，默认约 24 小时 / 公司。
- 自动备份失败进入提醒和上线检查。

非 SQLite 生产数据库不得假装使用本地文件恢复，应使用数据库服务本身的生产级备份 / 恢复能力。

## 6. 上线检查

老板 / 管理员已有“上线检查”，以大白话检查：
- 服务器安全设置。
- 团队登录。
- 公司业务数据库。
- 手动 / 自动备份。
- 发送邮箱。
- 退信 / 退订保护。
- 找客户服务。
- 外贸数据服务。
- 外部提醒。
- AI 写信能力。

缺失项分“需要处理 / 按需开启”，避免把增强功能误判成整个系统不可用。

## 7. CI / 门禁

`.github/workflows/online-v01-check.yml` 当前负责：
- Python 编译。
- 全部 `test_*.py` 业务回归。
- Daily App 路由导入检查。
- Online 浏览器 JS 语法。
- Product Brain。
- Local Bridge / Catalog / Workspace / Notification Owner。
- 二级页面脚本。
- Secrets 不入库。

大量能力标记已从 workflow 主文件抽到 `online/api/tests/online_contracts.py`，避免 CI 文件继续膨胀和出现互相矛盾的合同。

`test_owner_consolidation.py` 额外锁定：
- Today 不得重新读取 `MailDispatchPlan`。
- 旧 mail-plan 不得重新写旧表。
- 客户待回复必须能被线程回复或成功直接发信清掉。
- 外贸数据真实业务查询必须经过统一可配置适配层。
- 公司工作时区必须继续作为 Today 的时间 Owner。

任何一轮只有 exact current head 的 `Online V0.1 Check = completed / success` 才可称新绿线。

## 8. 当前真正未完成 / 下一优先级

不要再把 Gmail、Outlook、Reply-stop、Queue、自动跟进、Product 持久化、团队权限、多公司隔离、操作审计、外部提醒、备份恢复、自动备份、公司时区、数据服务通用适配列为未完成。

下一优先级：
1. **选定并现场适配真实商业数据商**：企业工商 / 公司核验、贸易海关、HS / Tariff、Shipping / Schedule；根据实际供应商字段做响应标准化，而不是制造通用假数据。
2. 把数据商响应进一步标准化成 HUIDI 稳定字段模型，供应商切换时不影响 Customer / Deal / 单据。
3. 生产数据库迁移策略：SQLite → PostgreSQL 等正式环境时建立可重复 migration，而不是长期依赖 `create_all`。
4. PostgreSQL / 托管数据库正式备份与恢复演练。
5. 继续压缩旧兼容邮件代码；确认无人再使用历史 `/api/mail/plans` 后，可做正式迁移 / 归档，而不是立即删除历史表。
6. 继续精简首页与设置区，功能增长后不能重新变成 ERP 式复杂页面。
7. 使用真实 Gmail / Outlook 客户账号与真实商业数据账号做部署现场验收；当前自动测试不能替代真实第三方凭证验证。

## 9. 新会话接管顺序

1. 读取 PR #2 当前 head，确认 Draft / 未合并 / base main。
2. 查 exact head 的 `Online V0.1 Check`。
3. 若红灯，先看失败日志，只修实际失败点。
4. 读取本文件和相关 Owner，禁止从旧聊天猜文件结构。
5. 只在 Online 分支施工。
6. 施工后跑完整门禁。
7. 全绿才更新本文件并锁新基线。
8. 未经用户明确要求，禁止 merge main。
