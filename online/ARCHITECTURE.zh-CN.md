# HUIDI Docs Online V0.1 架构说明

## 产品定位

Online 版承担必须联网、适合多人协作或需要云端服务的能力；Community Local 继续承担本地优先的客户 / 商品 / 单据制作与导出。

## 主链

```text
市场关键词 / 国家 / 买家类型
        ↓
Search Provider
        ↓
Lead Candidate
        ↓
证据 + 域名去重 + 匹配评分
        ↓
公开联系人 / 业务邮箱
        ↓
开发信草稿
        ↓
人工确认
        ↓
跟进状态
        ↓
HUIDI Customer + Inquiry Bridge
        ↓
Quotation → PI → Contract → CI / Packing List
```

## V0.1 模块

### Lead Search

- Serper API
- 产品关键词
- 国家 / 地区
- importer / distributor / wholesaler 等买家类型
- 域名去重
- 匹配评分
- 搜索证据保留

### Contact Discovery

V0.1 只从公开搜索结果中发现公司域名下可见的业务邮箱，不尝试绕过登录、访问控制或付费数据库。

后续可扩展：

- Buyer / Procurement / Purchasing / Sourcing 角色识别
- 官方 Contact / Team / About 页面抽取
- 用户自带合法数据源
- 置信度和来源证据

### Writer

- OpenAI-compatible Chat Completions
- 多语言开发信
- 不虚构客户事实
- 无模型时提供普通模板降级
- 默认只生成草稿，不自动发送

### HUIDI Bridge

V0.1 `/convert` 接口输出：

- Customer payload
- Inquiry payload
- `next = quotation`

正式融合时应接入 HUIDI Online 的统一数据库和正式客户 / 询盘服务，不应长期保持双表。

## 数据原则

- 搜索结果必须保留来源 URL 和 snippet 作为证据。
- AI 不能把推测写成已验证事实。
- 一个公司以域名为主要去重键。
- 线索状态与正式客户状态分离。
- 只有人工确认的线索才能继续进入正式业务链。

## 生产版建议

前端：Next.js / React 或继续复用 HUIDI Web UI 组件。

API：FastAPI。

生产数据库：PostgreSQL / Supabase PostgreSQL。

异步任务：Redis + worker / Supabase Queue / 云队列。

密钥：服务器端 Secret Manager，不进入前端或仓库。

认证：Supabase Auth / 企业 SSO / HUIDI Auth。

邮件：用户自己的 Gmail / Outlook / SMTP / ESP，必须有发送审批、速率限制和退订能力。

## 与 smart-lead-agent 的融合边界

上游 `smart-lead-agent` 提供了很有价值的外贸获客思路：FindKP、Writer、MailManager、多搜索提供方、多 LLM 和数据库追踪。

HUIDI 不把它做成孤立 Agent，而是吸收这些模块职责后与 HUIDI 的“客户 → 询盘 → 单据”连接。

上游为 Apache-2.0；如未来直接复制或修改其具体源文件，将在相应源文件与 THIRD-PARTY-NOTICES 中保留必要许可证和修改说明。
