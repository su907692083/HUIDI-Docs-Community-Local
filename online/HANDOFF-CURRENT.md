# HUIDI Online · 当前接管交接（新会话必读）

更新时间：2026-09-06

> 本文件是 Online 新会话接管入口。先核 PR #2 当前 head 和该 exact head 的 `Online V0.1 Check`，禁止从旧聊天、旧 SHA 或旧待办清单直接施工。

## 1. 正式边界与最近已验证绿线

- 仓库：`su907692083/HUIDI-Docs-Community-Local`
- 正式主线：`main`
- `main`：`765e8cfe82eb49aabb2f75abb1da0cfbe4c936eb`
- Community Local 正式发布：`v1.2.0-rc16.29 / RC16.29`
- Online 开发分支：`online/v0.1-lead-workbench`
- Online PR：`#2`
- PR 必须保持 **Draft / 未合并**，除非用户明确要求。
- Online 施工不得覆盖、回退或破坏 Community Local 正式主线。

本文件更新前最后一条完整验证绿线：

`c32ba07ada2c8e237f0659def5772e8b82320ac6`

对应 `Online V0.1 Check` run `33983408601`：**completed / success**。

该 run 已同时通过：
- 常规全业务 `validate` job。
- 真实 PostgreSQL 16 `postgres_schema` job。
- PostgreSQL 公司 #1 / #2 独立数据库 upgrade + check。
- 公司 #1 写入的 Lead 在公司 #2 查询为 0。
- 第三个空 PostgreSQL 公司库上两个独立 schema upgrade 进程并发抢锁，均成功完成，未出现重复建表 / 重复 revision。

本文件更新本身会产生新 head，因此新会话仍必须重新读取 PR 当前 head 与该 head 的最新 Check；只有 exact current head 的两个 job 均为 success 才可称新绿线。

## 2. 产品定位与主链

HUIDI Online = **外贸人的每日专属工作台 / Foreign Trade Daily Workbench**。

主链：

`今天 → 待跟进 → 客户待回复 → 找客户 → 地图找客户 → 客户背调 → 联系人 → 产品资料 → AI 开发信 → 真实邮箱 → 稍后发送 / 自动跟进 → 客户 / 询盘 → 商品 / 产品目录 → 报价 → PI → 合同 → CI / 装箱单 → 出运 → 下一步`

原则：
- 普通用户只看大白话，不堆 SMTP / OAuth / API / Provider / Queue / Tenant / Schema 等内部词。
- 未连接真实数据源时明确显示“未连接”，禁止演示数据冒充正式客户或业务数据。
- 联网结果必须回到 Lead / Customer / Deal / Product / Mail / Document / Next Action。
- 联网参考不会自动污染正式产品事实、价格、合同、装箱资料。
- Community Local 是本地 / 离线和成熟单据能力补充，不是 Online 联网能力上限。

## 3. 今天 / Daily Workbench

当前“今天”已经是行动清单：
- 按**当前公司的工作时区**划分今天。
- Lead 跟进到期 / 逾期进入“今天待推进”。
- Deal / 询盘 `next_action_at` 到期 / 逾期也进入“今天待推进”。
- 客户来信只有在**尚未处理**时进入“客户待回复”。
- 同一邮件线程后续已回复，则从待回复移除。
- 即使不是在线程页回复，只要客户来信后存在成功发信记录，也视为已处理。
- “待发送”只统计真实 `MailQueueItem`，不再统计旧 `MailDispatchPlan`。

公司工作时区由 `CompanySetting` 持久化在每家公司的独立业务库，老板 / 管理员可用“工作时间”选择中国大陆、日本、英国、美国东部等地区；普通业务员无需理解时区代码。

## 4. 找客户 / 产品 / 真实邮件

### 找客户 / 地图 / 背调 / 联系人

已完成：
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
- Gmail / Outlook / SMTP / 企业邮箱连接。
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
- 同一客户 + 同一草稿 + 同一发送邮箱重复调用旧入口，返回同一个 Queue ID。
- 旧入口不会再新增 `MailDispatchPlan` 记录。

## 5. Customer / Deal / 单据与联网业务参考

Online 已持续保存 Customer / Deal：客户、联系人、邮箱、国家、官网、阶段、概率、金额、币种、需求、下一步和单据关联共用同一业务 Owner。

Quotation / PI / Contract / CI / Packing List 沿同一笔业务进入成熟单据链。

联网资料进入单据前必须人工确认；确认后单独记录谁、何时、用于哪种单据，仍不会自动改写正式业务事实。

### Raw + HUIDI 标准字段双层结构

原始数据继续由 `OnlineIntelligenceRecord` 保存，便于：
- 审计真实数据商返回。
- 以后更换数据商。
- 修正标准化规则后重新 backfill。

新增 `OnlineIntelligenceProjection`，标准 schema：

`huidi.intelligence.normalized/v1`

`intelligence_normalizer.py` 当前只抽取数据商**实际返回过**的字段，不猜、不补、不制造默认值。

稳定标准字段已覆盖：
- 企业核验：企业名称、登记号、企业状态、国家、地址、官网、成立时间、行业、员工量、风险 / 信用。
- 贸易记录：记录数、最近贸易日期、金额、币种、HS、产品、来源地、目的地、供应商、买家。
- HS / 关税：HS、原产地、目的地、进口关税、VAT / 进口税、其他税费、生效日、描述。
- 汇率：基准币、目标币、汇率、金额、换算结果、日期。
- 船期 / 物流：起运地、目的地、承运人、航线 / 服务、船名、航次、ETD、ETA、运输天数、柜型、运费参考、币种。
- 市场情报：可复用的新闻标题 / 来源 / 日期 / 链接摘要。

未知供应商结构仍保留原始 JSON，但标准 `facts` 为空并明确显示“暂未识别出稳定业务字段”，禁止编造。

### Deal 标准业务参考

每笔询盘可读取：

`huidi.deal.intelligence/v1`

当前稳定聚合：
- `company`
- `pricing_reference`
- `trade_reference`
- `shipping_reference`
- `missing`
- `suggestions`
- `reference_ids`

询盘详情新增“大白话”**联网业务参考**卡，直接显示企业状态、HS / 关税、参考汇率、贸易记录、船期等。

规则：
- 默认只作核对 / 决策。
- 不自动改 `Deal.amount`。
- 不自动改客户需求。
- 不自动改产品资料。
- 不自动改合同条款。
- 不自动改装箱数量。
- 只有用户明确确认“带入单据参考”后，`online_business_reference` 与 `online_business_facts` 才进入 document handoff。

### 历史联网资料

新增：
- `GET /api/intelligence/{record_id}/normalized`
- `POST /api/intelligence/normalize/backfill`
- `GET /api/business/deals/{deal_id}/facts`

老板 / 管理员可以把历史 raw 记录重新生成当前标准 projection，而不改原始数据。

## 6. 正式外贸数据服务适配层

公司级数据服务连接继续保存：企业核验、贸易 / 海关、HS / 关税、船期 / 物流。

`ServiceAdapterSetting` 让真实业务查询不再假定所有数据商都是同一种 POST + Bearer 接口。当前支持：
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

注意：**稳定 HUIDI 标准字段与通用接入底座已完成，但具体商业数据商的供应商专用字段 profile 仍需在实际选定工商 / 海关 / 关税 / 船期服务后施工和现场验证。** 未配置时继续显示“未连接”。

## 7. 团队、多公司、审计与提醒

已完成真实多公司物理隔离：
- 公司 #1 保留历史 `DATABASE_URL`。
- 公司 #2+ 使用独立业务数据库。
- 登录请求先确定公司，再进入该公司的业务数据库。
- Lead、Customer、Deal、Product、Mail、Queue、Sequence、Intelligence、Reminder、Audit、Backup 等沿公司边界隔离。
- 后台邮件、自动跟进、提醒、自动备份按公司分别执行。

角色：老板、管理员、业务员、只读成员。

操作记录自动记录业务动作，不保存密码、邮件正文、授权内容或完整表单原文。

提醒已完成：
- HUIDI 站内提醒。
- 飞书 / 企业微信 / 钉钉 / 其他通知入口。
- 安静时段、去重、失败重试。
- 客户回复、逾期跟进、邮件异常、询盘业务、备份异常。
- 单人模式和默认公司也会自动运行外部提醒。

## 8. 数据保护与 PostgreSQL 生产底座

### SQLite

已完成：
- 公司独立业务备份。
- 手动恢复。
- 恢复前安全备份。
- 公司边界 / 完整性 / 安全密钥一致性保护。
- 自动备份，默认约 24 小时 / 公司。
- 自动备份失败进入提醒和上线检查。

### PostgreSQL

当前明确支持的生产服务器数据库路径为：

`PostgreSQL + psycopg`

`requirements.txt` 已正式包含 `psycopg[binary]`。

`.env.example` 只承诺 PostgreSQL，不再泛写 MySQL / 任意数据库。

多公司生产配置原则：
- 公司 #1 的 `DATABASE_URL` 指向独立 PostgreSQL 数据库，例如 `huidi_org_1`。
- 多公司模板变量 `HUIDI_TENANT_DATABASE_URL_TEMPLATE` 指向同一数据库服务，并在数据库名位置保留 `{organization_id}` 占位符，例如 `huidi_org_{organization_id}`。

每家公司继续使用物理独立数据库。

### Schema revision ledger

新增：

`huidi.online.schema/v1`

账本表：

`huidi_schema_migrations`

当前 latest revision：

`20260906_001_intelligence_projection`

当前已有 revision：
1. `20260905_000_online_v01_baseline`
2. `20260906_001_intelligence_projection`

`tenant_storage` 对每家公司数据库执行 forward revision，并提供 `tenant_schema_status()`。

上线检查新增“数据库结构版本”，只有当前 revision 与程序 latest 一致才判定 ready。

### 显式部署命令

从 `online/api` 执行：

```text
python -m app.schema_cli check --all
python -m app.schema_cli upgrade --all
python -m app.schema_cli check --all
```

也支持：
- `--organization <id>`
- `--include-disabled`

命令不会输出数据库 URL / 密码。

### PostgreSQL 并发升级锁

`schema_migrations.py` 使用 PostgreSQL `pg_advisory_lock` 对 HUIDI schema writer 串行化。

显式 `schema_cli upgrade` 与 `tenant_storage.ensure_tenant_schema()` 均通过统一 `upgrade_schema()` Owner，使**兼容 create_all + forward revision** 在同一个锁区间内执行。

CI 已实际验证：第三个空 PostgreSQL 公司库中同时启动两个独立 upgrade 进程，二者均成功且 revision 无重复。

### 仍需明确的数据库边界

当前还**不能**声称完整 Alembic / 完整历史 migration 已完成。

V0.1 为兼容历史 SQLite 安装，仍保留 SQLAlchemy `Base.metadata.create_all()` 作为 compatibility floor；forward revision、显式部署命令和 PostgreSQL 锁已经建立，但未来需要逐步把所有历史表结构转换成独立 migration，最终才能完全退役 runtime create_all。

PostgreSQL 生产备份 / PITR / 恢复也必须由实际数据库服务进行并现场演练，不能拿 SQLite 文件备份冒充。

## 9. 上线检查

老板 / 管理员已有“上线检查”，以大白话检查：
- 服务器安全设置。
- 团队登录。
- 公司业务数据库。
- **数据库结构版本**。
- 手动 / 自动备份。
- 发送邮箱。
- 退信 / 退订保护。
- 找客户服务。
- 外贸数据服务。
- 外部提醒。
- AI 写信能力。

缺失项分“需要处理 / 按需开启”，避免把增强功能误判成整个系统不可用。

## 10. CI / 门禁

`.github/workflows/online-v01-check.yml` 当前有两条 job。

### validate

负责：
- Python 编译。
- 全部 `test_*.py` 业务回归。
- Daily App 路由导入检查。
- Online 浏览器 JS 语法。
- Product Brain。
- Local Bridge / Catalog / Workspace / Notification Owner。
- 二级页面脚本。
- Online → Local bridge。
- 命名能力合同。
- Secrets 不入库。

### postgres_schema

使用真实 PostgreSQL 16 容器：
- 创建 `huidi_org_1 / 2 / 3`。
- 公司 #1 / #2 schema `upgrade → check`。
- 公司 #1 写入 Lead 后，公司 #2 查询必须为 0。
- 公司 #1 / #2 必须达到 latest revision。
- 公司 #3 两个独立 upgrade 进程并发执行，验证 PostgreSQL advisory lock。

只有 exact current head 的**两个 job 都 success** 才可称新绿线。

能力合同包括：
- `online/api/tests/online_contracts.py`
- `test_owner_consolidation.py`
- `test_normalized_intelligence_contract.py`
- `test_intelligence_normalization.py`
- `test_schema_migrations.py`
- `test_schema_cli.py`

## 11. 当前真正未完成 / 下一优先级

不要再把以下内容列为未完成：Gmail、Outlook、Reply-stop、Queue、自动跟进、Product 持久化、团队权限、多公司隔离、操作审计、外部提醒、SQLite 备份恢复、自动备份、公司时区、数据服务通用适配、HUIDI 标准联网字段、Deal 联网参考、PostgreSQL 驱动、schema revision ledger、schema CLI、PostgreSQL CI 或 PostgreSQL 并发 migration lock。

下一优先级：
1. **选定并适配真实商业数据商**：企业工商 / 公司核验、贸易海关、HS / Tariff、Shipping / Schedule；在稳定 HUIDI schema 下面增加供应商专用 mapping profile。
2. 使用真实 Gmail / Outlook 与真实商业数据账号做部署现场验收；自动测试不能替代第三方真实凭证。
3. 为 PostgreSQL / 托管数据库建立正式 backup / PITR / restore runbook，并在实际部署环境做恢复演练。
4. 逐步把历史 `create_all` 覆盖的结构迁成正式 revision / migration，最终移除 runtime create_all；当前不能虚称完整 Alembic 已完成。
5. 继续压缩旧兼容邮件代码；确认无人再使用历史 `/api/mail/plans` 后，再正式归档历史表。
6. 继续精简首页与设置区，功能增长后不能重新变成 ERP 式复杂页面。

## 12. 新会话接管顺序

1. 读取 PR #2 当前 head，确认 Draft / 未合并 / base main。
2. 查 exact head 的 `Online V0.1 Check`，确认 `validate` 和 `postgres_schema` 两条 job。
3. 若红灯，先看失败日志，只修实际失败点。
4. 读取本文件和相关 Owner，禁止从旧聊天猜文件结构。
5. 只在 Online 分支施工。
6. 施工后跑完整门禁。
7. 两条 job 全绿才更新本文件并锁新基线。
8. 未经用户明确要求，禁止 merge main。
