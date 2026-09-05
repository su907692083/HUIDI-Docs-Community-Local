# HUIDI Online · 当前接管交接（新会话必读）

更新时间：2026-09-05

> 本文件是新会话接管入口。禁止只凭旧聊天记忆施工；先核对 Online 开发分支当前 head、PR #2 与最新 `Online V0.1 Check`。

## 1. 正式边界与当前绿线

- 仓库：`su907692083/HUIDI-Docs-Community-Local`
- 正式主线：`main`
- Community Local 正式发布：`v1.2.0-rc16.29` / RC16.29
- Online 开发分支：`online/v0.1-lead-workbench`
- Online Draft PR：`#2`
- PR 必须继续保持 Draft，除非用户明确要求合并。
- 禁止为了 Online 施工覆盖或回退 Community Local 正式主线。

本文件更新前已验证绿线：

`058e97d402ed171d4b1c533435014fec8b5a430f`

对应 `Online V0.1 Check`：completed / success。

该绿线已经包含：物理多公司隔离、公司账号控制面、分公司后台邮件任务、公司化退信/退订回传专项测试。

更新本文件后 GitHub head 会继续前进；新会话必须重新读取 PR 当前 head 与最新 Check，不要把上述 SHA 当作永远固定的最终 head。

## 2. 产品定位

HUIDI Online 定位为：

**Foreign Trade Daily Workbench / 外贸人的每日专属工作台**。

核心日常链：

`今天 → 待跟进 → 客户回复 → 找客户 → 地图找客户 → 客户背调 → 联系人 → 产品资料 → AI 开发信 → 真实邮件 → 自动跟进 → 客户 / 询盘 → 商品 / 产品目录 → Quotation → PI → Contract → CI / Packing List → 出运 → 下一步`

单据只是主链的一部分。

产品规则：
- 小白友好，普通页面禁止堆技术实现词。
- 一页式、表格、右侧详情、少跳页、少低频渲染。
- 联网能力必须回到 Customer / Lead / Product / Deal / Mail / Document / Next Action。
- 未连接真实数据源时明确显示“未连接”，禁止演示数据冒充正式结果。
- Community Local 是本地/离线、文件和成熟单据能力补充，不限制 Online 的真实联网能力。

## 3. 当前已经落地的业务能力

### Daily Workbench / 今天

首页读取真实业务数据库，已形成：
- 今天到期 / 逾期跟进
- 客户回复
- 今日已发送
- 发送失败
- 待发送
- 已转询盘
- 邮箱状态
- 最近业务变化
- 业务下一步提醒
- 自动跟进异常提醒

提醒中心只聚合需要行动的事项。

### 找客户 / 背调 / 联系人

已形成：
- 真实在线搜索接入位
- A/B/C/D 透明评分
- 域名去重
- 公开来源证据
- 联系人 / 业务邮箱发现
- 客户背调初筛
- Buying Signals / 下一步建议
- 地图找客户
- 地图结果进入同一 Lead 线索池

无真实搜索服务时，不生成假客户或假联系人。

### 产品资料

`huidi.product.brain/v1` 继续作为产品事实模型，并已服务器持久化。

事实边界：正式规格、MOQ、价格、交期、认证、包装、HS、原产国等可长期复用；临时网页搜索、客户信号和 AI 临时推断不能污染正式产品事实。

Local 商品可以显式交给 Online，并保留原商品关联。

### 真实邮件闭环

已形成：
- Gmail / Outlook / 其他企业邮箱连接
- 多发送邮箱
- 凭据加密保存
- 连接检查
- 真实发送
- 收件箱 / 已发送同步
- 同一客户邮件往来
- HUIDI 内直接回复
- 自动 Reply detection
- 客户回复后停止冷开发
- 每日发送量 / 最小发送间隔
- 退订 / 黑名单
- Bounce / unsubscribe / complaint 回写
- 发送审计 / Message-ID
- Queue / Retry

### 自动跟进

已形成服务器端自动跟进：
- 一套计划最多 8 步
- 内容与间隔先人工确认
- 给客户启用时再次确认
- 到时间后复用真实发送治理
- 回复 / 退订 / 抑制 / 转询盘 / 归档后自动停止
- 连续异常自动暂停并进入提醒中心
- 可暂停 / 继续 / 停止

禁止把它改成无审核批量群发器。

### 客户 / 询盘 / 单据

Online 已持续保存 Customer / Deal，同一业务对象保存客户、联系人、邮箱、国家、官网、询盘阶段、概率、金额、币种、需求、下一步、日期和单据关联。

Quotation / PI / Contract / CI / Packing List 继续沿同一业务对象进入成熟单据链，不能再建第二套客户资料。

### 联网业务资料

`OnlineIntelligenceRecord` 已持久化。

企业核验、贸易记录、市场情报、关税、汇率、船期 / 物流查询可挂回当前 Lead / Deal，保存查询类型、条件、结果、时间和业务关联。

客户详情已有“联网资料”回看区；从客户详情进入外贸工具时会自动带当前客户上下文。

## 4. 团队与多公司强隔离 —— 已完成底座

这一层已经从“单家公司成员权限”升级为真实多公司数据边界。

### 控制面

共享控制面只保存：
- Organization / 公司工作区
- TeamMember / 成员
- TeamSession / 登录会话
- 角色与公司归属

角色仍为：老板、管理员、业务员、只读成员。

旧版本已有团队成员会自动归入公司 #1，不要求重建账号。

### 业务数据物理隔离

不是靠前端公司下拉框，也不是要求每个 API 手工记住 `WHERE organization_id`。

当前规则：
- 公司 #1 继续使用原 `DATABASE_URL`，历史客户 / 邮件 / 产品 / 询盘数据不迁走、不消失。
- 公司 #2+ 使用独立业务数据库。
- SQLite 部署自动为每家公司创建独立数据库文件。
- PostgreSQL / MySQL 等生产数据库必须配置 `HUIDI_TENANT_DATABASE_URL_TEMPLATE`，并包含 `{organization_id}`，为每家公司提供独立数据库。
- 每个登录请求先从控制面确认成员属于哪家公司，再把整个业务请求路由到该公司的数据库。
- 因此即使不同公司出现相同 Lead ID / Deal ID，也不在同一业务库中。

已经覆盖的业务域包括原有所有通过 `SessionLocal / get_db` 的主链：Lead、客户、询盘、产品资料、邮件账户与消息、待发送、自动跟进、联网资料、提醒、单据业务关联等。

### 后台任务也按公司隔离

公司 #1 延续原后台邮件 Worker；公司 #2+ 由租户任务协调器分别进入各自数据库执行：
- Queue
- Retry
- 自动跟进
- Gmail / Outlook 收取与回复同步

禁止以后把后台 Worker 改成只跑默认数据库。

### 外部退信 / 退订回传

团队模式下外部 Provider 没有用户登录 Cookie，因此已增加公司化回传路由：
- 必须提供 `X-HUIDI-Mail-Event-Key`
- 必须提供 `X-HUIDI-Organization-ID`
- 先校验公司存在且启用
- 然后只进入该公司的独立业务库

专项 HTTP 回归已经验证：无用户 Cookie 时，带正确密钥 + 公司编号可以把 unsubscribe 写进目标公司的抑制名单与 Lead 时间线；缺公司编号会拒绝。

### 管理界面

普通业务员只看到：`当前公司 · 自己 · 角色`。

公司老板 / 管理员只管理本公司成员。

只有公司 #1 的平台 Owner 可以：
- 查看公司工作区
- 新建公司工作区
- 同时建立对方公司 Owner
- 停用 / 启用公司工作区

普通用户页面不显示数据库、租户、Schema 等技术词。

## 5. 多公司隔离回归证据

当前自动测试已经验证：
- 公司 #1 的数据库地址保持历史 `DATABASE_URL`。
- 公司 A 写入 Lead 后，公司 B 的数据库初始为空。
- 公司 B 写入自己的 Lead 后看不到公司 A 的记录。
- 再切回公司 A 仍只看到 A 的记录。
- 多公司改造后原邮件、产品、业务、Local Bridge、Notification 等业务回归继续通过。
- 公司化退订 / 退信 HTTP 回传专项测试通过。

CI 必须继续保留多公司物理隔离合同，禁止以后为了简化代码退回所有公司共用一个业务库。

## 6. Community Local 互通

Online → Local：`huidi.business.bundle/v1`

Local → Online：`huidi.local.business.status/v1`

原则：
- Online 机会进入 Local 时复用 Customer / Deal / Product / Mail / Document Owner。
- Lead A/B/C/D 评分不能替代 Deal 成交概率。
- 搜索关键词不能自动创造正式商品。
- Local → Online 继续显式确认，禁止偷偷上传整套本机数据库。
- PR #2 不能破坏 RC16.29 正式主线。

## 7. 当前真实数据服务状态

代码已有统一真实连接位：
- 在线搜索 / 地图 / 市场动态
- 企业核验
- 贸易 / 海关数据
- HS / Tariff
- FX
- Shipping / Schedule

其中：
- 汇率已有真实在线读取路径。
- 搜索 / 地图 / 市场动态配置真实搜索服务后工作。
- 企业核验 / 贸易数据 / 关税 / 船期物流仍需要部署时选定并配置实际商业数据服务。

未配置的数据服务必须明确显示“未连接”。

## 8. 用户界面语言

优先使用：
- 产品资料
- 连接 Gmail / Outlook / 其他邮箱
- 收件箱 / 已发送 / 邮件往来
- 稍后发送
- 自动跟进
- 企业核验
- 贸易记录
- 汇率
- 船期 / 物流
- 团队 / 公司 / 业务员 / 只读成员

普通页面不要堆 SMTP / OAuth / Provider / Agent / Prompt / Thread / Queue / Retry / 数据库 / 租户 / Schema 等内部实现词。

## 9. 当前仍未完成 / 下一施工优先级

多公司物理隔离底座已经完成，不要再把它列成未完成。

下一优先级：
1. **团队审计日志**：谁改了客户、谁发了邮件、谁改了 Deal 阶段、谁改了成员 / 公司设置。
2. 正式接入企业核验商业数据服务。
3. 正式接入贸易 / 海关数据服务。
4. 正式接入 HS / Tariff 数据服务。
5. 正式接入 Shipping / Schedule 数据服务。
6. 把联网资料进一步投影到 Deal / Quotation / 出运判断，而不只用于回看。
7. 生产级外部通知路由、成员路由、安静时段与失败重试。
8. 正式部署 Secret 管理、备份、数据库迁移与恢复验证。
9. 多公司备份 / 恢复 / 停用公司后的数据保全与导出流程。
10. 持续精简首页与高频路径，避免功能增长后重新变复杂。

## 10. 每轮施工门禁

每次施工必须：
1. 核当前 head，禁止从旧聊天猜基线。
2. 只改 Online 分支，除非用户明确要求动 main。
3. Python 编译。
4. 全部业务回归。
5. 浏览器 JS 语法检查。
6. 邮件真实发送 / Reply-stop / Queue / Retry / 自动跟进回归。
7. Product / Business / Intelligence / Team 回归。
8. **多公司物理隔离回归。**
9. **公司化后台邮件任务与 Provider 回传不能退化。**
10. Local Bridge / Catalog / Notification Owner 回归。
11. Secrets 不入库。
12. `Online V0.1 Check` 全绿后才能称为新绿线。
13. PR #2 保持 Draft，除非用户明确要求合并。

## 11. 新会话接管顺序

新会话先只读：
1. PR #2 metadata / 当前 head / changed files。
2. 最新 `Online V0.1 Check`。
3. 本文件。
4. `online/README.md`。
5. `online/DAILY-WORKBENCH-CONTRACT.zh-CN.md`。
6. `online/STAGE2-CLOSURE-CONTRACT.zh-CN.md`。
7. `online/UX-CLOSURE-CONTRACT.zh-CN.md`。
8. 对照代码确认文档没有漂移。

然后汇报当前基线、已完成、未完成、CI 状态和下一优先级。用户说“开始施工”后再修改代码。
