# HUIDI Docs Online · Lead Workbench

> 在线版实验分支：把“开发客户”接到 HUIDI 已有的客户、询盘、报价、PI、合同、CI、装箱单业务链。

当前阶段：**V0.1 Foundation / Lead Workbench**

## 为什么单独做 Online

Community Local 继续保持本地优先、离线可用、低学习成本；Online 专门承接必须联网或更适合云端的能力：

- 搜索潜在客户公司
- 发现公司官网与公开业务邮箱
- 采购 / Buyer / Sourcing / Procurement 关键联系人线索
- AI 生成开发信草稿
- 开发记录与跟进状态
- 团队共享线索
- 把合格线索一键转成 HUIDI 客户 / 询盘
- 后续继续报价 → PI → 合同 → CI / Packing List

## V0.1 已落地的骨架

- FastAPI 在线 API
- HUIDI 风格的 Table-first“开发客户”页面
- Serper 搜索提供方接口
- 目标国家 / 产品关键词 / 买家类型组合搜索
- 公司域名去重和基础匹配评分
- 公开业务邮箱与采购角色线索搜索
- 开发信草稿生成接口（支持 OpenAI-compatible LLM，也有无 AI 降级模板）
- SQLite 本地开发存储，`DATABASE_URL` 预留给后续 PostgreSQL
- 线索状态：new / qualified / contacted / replied / converted
- “转为询盘”桥接 payload，字段向 HUIDI 客户 / 询盘模型靠拢
- Docker 启动骨架

## 外贸工作流

```text
目标市场 / 产品关键词
        ↓
搜索潜在公司
        ↓
公司官网 + 匹配理由 + 来源证据
        ↓
采购 / Buyer / Sourcing / Procurement 联系线索
        ↓
生成开发信草稿
        ↓
人工确认后发送 / 跟进
        ↓
客户回复
        ↓
转 HUIDI 客户 + 询盘
        ↓
Quotation → PI → Contract → CI / Packing List
```

## 与 smart-lead-agent 的关系

本项目研究了 `1099271/smart-lead-agent` 的 FindKP、Writer、MailManager、搜索提供方和多 LLM 设计。

V0.1 **不是简单复制原仓库**，而是把相同类别的能力重新组织成 HUIDI 的外贸业务流，并从第一天加入：

- HUIDI 客户 / 询盘桥接
- 线索证据保留
- 线索评分
- 人工确认门
- 不默认自动批量群发
- Online 与 Community Local 分离

第三方归属见 `THIRD-PARTY-NOTICES.md`。

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

## 最低配置

只看 UI / 保存线索：不需要外部 API。

要真实搜索潜在客户：

```env
SERPER_API_KEY=...
```

要 AI 开发信：

```env
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

也可以指向兼容 OpenAI Chat Completions 的中转站或模型服务。

## 在线公开前必须完成

V0.1 目前是开发骨架，不应直接作为公开 SaaS 上线。正式 Online 版还需要：

1. 登录 / 注册
2. 租户隔离与权限
3. PostgreSQL / Supabase 等生产数据库
4. API Key 加密存储
5. 队列 / 并发 / 配额
6. 邮箱账号连接与发送审批
7. 退订、频率控制、黑名单与合规策略
8. 审计日志
9. 团队共享与协作
10. Community Local ↔ Online 数据同步策略

## 产品原则

**不是“抓越多邮箱越好”。**

HUIDI Online 的目标是：让外贸人更快找到“值得联系的客户”，看清来源与匹配理由，生成有上下文的开发信，然后把真正产生回复的线索继续推进成询盘和单据。
