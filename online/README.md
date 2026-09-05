# HUIDI Docs Online · Lead Workbench

> 在线版实验分支：把“开发客户”直接接到 HUIDI 已有的客户、询盘、报价、PI、合同、CI、装箱单业务链。

当前阶段：**V0.1.1 Lead Qualification / Due Diligence / Outreach Review**

## 为什么单独做 Online

Community Local 继续保持本地优先、离线可用、低学习成本；Online 专门承接必须联网或更适合云端的能力：

- 搜索潜在客户公司
- 发现公司官网与公开业务邮箱
- 采购 / Buyer / Sourcing / Procurement 关键联系人线索
- 透明买家评分与优先级
- 客户背调初筛与证据缺口
- AI 生成开发信草稿
- 人工确认 / 退回修改
- 跟进时间和开发记录
- 把合格线索一键转成 HUIDI 客户 / 询盘
- 后续继续报价 → PI → 合同 → CI / Packing List

## V0.1.1 已经做通的主链

```text
产品 / 市场 / 客户类型
        ↓
搜索潜在公司
        ↓
透明买家评分 A/B/C/D
        ↓
公司官网 + 匹配理由 + 来源证据
        ↓
客户背调初筛
        ↓
采购 / Buyer / Sourcing / Procurement 联系线索
        ↓
AI 开发信草稿
        ↓
人工确认 / 退回修改
        ↓
安排下一次跟进
        ↓
客户回复 / 真实机会
        ↓
转 HUIDI 客户 + 询盘
        ↓
Quotation → PI → Contract → CI / Packing List
```

## 透明买家评分

HUIDI 不把一个“AI 评分”当黑盒结论。搜索结果会按这些维度拆分：

- 产品匹配
- 买家角色信号
- 目标市场
- 采购 / 进口信号
- 独立官网
- 可联系性
- 商业主体信号
- 供应端 / 目录站扣分

最终只用于**跟进优先级**：

- A：优先查看
- B：值得进一步核实
- C：保留候选
- D：低优先级 / 可能噪音

评分不是信用分，也不代表真实采购能力已经被验证。

## 客户背调初筛

V0.1.1 增加了证据型背调层，当前会根据 HUIDI 已经真正掌握的数据判断：

- 基础资料完整度
- 公司存在信号
- 联系人资料
- 数字资产 / 官网证据
- 业务匹配度

**工商注册、官方公司状态、海关采购历史当前没有接入时，系统明确显示“未验证”，不会把“没查到”错误算成高风险。**

这层定位是销售资格判断，不是征信报告、法律尽调或官方海关核验。

## 开发信与跟进

- 支持 OpenAI-compatible LLM
- 未配置 LLM 时有普通开发信模板降级
- 多语言草稿入口
- 草稿必须人工确认
- 可标记“需要修改”并留下原因
- 可安排下一次跟进时间
- 每条线索保留开发活动时间线

V0.1.1 **不自动批量发送冷邮件**。正式发送能力会在邮箱连接、频率控制、退订、黑名单、Bounce、回复停止、审计等门禁完成后开放。

## 当前技术骨架

- FastAPI
- SQLAlchemy
- SQLite（开发环境）
- `DATABASE_URL` 可切 PostgreSQL
- Serper 搜索 Provider
- OpenAI-compatible LLM Provider
- Table-first HUIDI Lead Workbench
- 独立 `LeadAssessment` 背调记录
- 独立 `LeadActivity` 开发活动记录
- Docker 启动骨架
- GitHub Actions Online 专项门禁

## 本地启动 Online 原型

```bash
cd online/api
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy ..\.env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

打开：

`http://127.0.0.1:8080/`

只看 UI / 保存线索 / 演示流程不需要外部 API。

真实搜索：

```env
SERPER_API_KEY=...
```

AI 开发信：

```env
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

也可以指向兼容 OpenAI Chat Completions 的中转站或模型服务。

## 本轮参考的外贸开源项目

我们研究了多个项目，但没有把它们整仓拼进 HUIDI：

- `1099271/smart-lead-agent`：FindKP / Writer / MailManager、多搜索、多 LLM 工作流
- `Tommy-old/b2b-buyer-discovery`：买家搜索、规则 + AI 评分、联系方式、开发信
- `kakacells/Customer_background_check_version1.2`：背调维度、置信度、降级验证方法
- `uyoufu/UZonMail`：邮箱、多账号、模板、追踪、退订、发送治理
- `chnjames/tradehot-skill`：外贸情报、HS、关税、风险、贸易日历
- `dongsheng123132/ai-tungke`：地图获客、区域遍历、产业集群方法
- `tshwangq/awesome-foreign-trade`：外贸资源导航与工具箱思路

第三方归属与许可边界见 `THIRD-PARTY-NOTICES.md`。

## 下一阶段优先级

1. **邮件账户层**：Gmail / Outlook / SMTP 账号连接、发送审批、配额、退订、黑名单、Bounce、回复停止。
2. **真实背调 Provider**：公司注册、官方商业信息、可选海关 / 贸易数据，证据与来源分层。
3. **地图找客户**：Google Maps 等 Provider、区域 / 城市搜索、去重后进入同一个线索池。
4. **外贸情报**：市场、HS、关税、物流、风险、贸易日历，能反向关联客户和报价。
5. **Online ↔ Community Local**：正式同步合同和冲突策略。

## 在线公开前必须完成

V0.1.1 仍是开发候选，不应直接作为公开 SaaS 上线。正式 Online 版还需要：

1. 登录 / 注册
2. 租户隔离与权限
3. PostgreSQL / Supabase 等生产数据库
4. API Key 加密存储
5. 队列 / 并发 / 配额
6. 邮箱账号连接与发送审批
7. 退订、频率控制、黑名单、Bounce 与邮件合规策略
8. 审计日志
9. 团队共享与协作
10. Community Local ↔ Online 数据同步策略

## 产品原则

**不是“抓越多邮箱越好”，也不是“发得越多越好”。**

HUIDI Online 的目标是：让外贸人更快找到**值得联系的客户**，看清来源与匹配理由，先核实、再联系，把真正产生回复的线索继续推进成询盘和单据。
