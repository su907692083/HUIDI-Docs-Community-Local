# HUIDI Community × Online 外贸项目能力吸收矩阵

> 目的：把“参考过哪些项目、真正吸收了什么、还缺什么”变成可审计的工程契约。HUIDI 吸收的是成熟能力和交互方法，不复制第二套 CRM / 单据 / 邮件 owner，也不为了“看起来功能多”重复造页面。

## 统一 owner 规则

正式业务数据只允许落到这条链：

**Customer → Product → Deal → Document**

- Community：Customer / Product / Deal / Quotation / PI / Sales Contract / CI / Packing List / Editor 的正式 owner。
- Online：获客、地图、背调、联系人、Product Brain、行业策略、邮件、跟进、回复、市场情报、贸易/HS/汇率/物流、团队/权限/提醒/审计/备份能力。
- 客户回复先停止冷开发；只提取客户明确表达的事实；人工确认后再进入正式询盘。
- 参考价不是正式价；不得自动写入 Deal amount、正式报价或正式单据单价。
- 无真实外部数据来源时，不生成、保存或伪装 demo 潜客。
- 低频能力优先放入折叠菜单、抽屉、页内 pane 或下拉，不增加不必要整页跳转。

## 状态定义

- **已吸收**：能力已由当前 HUIDI owner 实现，并有实际代码/门禁。
- **已替代**：参考项目的目标已由 HUIDI 更成熟的现有 owner 覆盖，不再复制其页面/模块。
- **部分吸收**：核心方向已进入，但仍有高价值细节待补。
- **凭证受限**：代码路径存在，但真实能力依赖用户自己的 API/OAuth/额度/账号。
- **不应重复建设**：该能力会制造第二套 CRM/单据/数据 owner，因此明确不照搬。

## 项目能力矩阵

| 参考项目 | 有价值能力 | HUIDI 当前 owner | 状态 | 当前施工 / 剩余动作 |
|---|---|---|---|---|
| `1099271/smart-lead-agent` | 客户发现、关键联系人、个性化开发信、批量客户处理、发送与追踪 | Lead Workbench + Contact Search + Mail Owner + Follow-up | **已吸收 / 凭证受限** | 已有找客户、联系人、开发信、邮件、跟进；本轮补潜客勾选/批量状态/CSV。真实搜索/联系人依赖已连接 provider。 |
| `Tommy-old/b2b-buyer-discovery` | 多关键词 × 多市场、规则/AI 筛选、联系人、优先级、CSV、多语言外联 | Acquisition Fusion + Product Brain + Lead Engine + Mail Owner | **已吸收 / 部分吸收** | 本轮新增 Product Brain 复用、多产品 × 多市场顺序搜索、组合上限、真实数据门；WhatsApp/LinkedIn 一键联络仍按真实已核验联系方式再决定是否补。 |
| `kakacells/Customer_background_check_version1.2` | 客户背景调查、公开事实聚合、风险/可信度判断 | Customer Due Diligence / Lead Assessment | **已吸收** | 继续坚持证据可见、未知不猜；贸易/企业核验等外部事实受数据源凭证限制。 |
| `uyoufu/UZonMail` | 多邮箱、群发/队列、变量化内容、AI 文案、批量发送、状态跟踪 | Mail Owner V3 + Inbox/Sent/Queue + Sequence/Follow-up | **部分吸收 / 凭证受限** | Gmail/Outlook/SMTP、收件箱、已发送、队列、跟进已统一；不会另建 EDM 系统。高并发/大规模营销发送必须受发送治理、退订与额度约束。 |
| `chnjames/tradehot-skill` | 市场简报、政策/贸易变化、HS、关税、风险提醒 | Intelligence + Trade + Tariff/HS + Today Intelligence + Notifications | **已吸收 / 凭证受限** | 情报、贸易、HS/关税、提醒已经进入“查资料/今天的工作”；外部实时数据按实际 provider 能力返回。 |
| `tshwangq/awesome-foreign-trade` | 外贸工具/资源目录、方法与工作流参考 | HUIDI capability matrix / Data Sources | **选择性吸收** | 作为发现来源逐项评估，不把“资源链接数量”当成功能数量；只吸收能缩短真实业务链的能力。 |
| `dongsheng123132/ai-tungke` | 地图获客、企业搜索、AI Web Search、行业判断 | Map Acquisition + Acquisition Fusion + Industry Playbook | **部分吸收 / 凭证受限** | 地图找客户、Web 获客、行业策略已有；Google/地图等真实来源仍遵循 provider 凭证与额度，不复制另一个地图 CRM。 |
| `CreatiBI/cli` | 外部数据连接/Agent 数据访问 | Data Sources / Service Adapters | **已替代 / 可扩展** | HUIDI 统一由数据来源与服务适配层承接。除非明确需要 CreatiBI 本身，否则不增加一个平行数据控制台。 |
| `howarliu1993/NPI-repo` | 产品档案、物料/BOM、技术资料确认、产品主数据 | Community Product + Product Brain + Catalog + Document owner | **部分吸收 / 已替代** | 产品主数据、目录、询盘/单据复用已由 Community 承担；深制造 NPI/BOM 不直接塞进 Online CRM，若后续需要应连接正式产品/BOM owner。 |
| `eicloud/eicloud.github.io` | CRM：市场活动、线索、客户、商机、报价、销售、开票、回款、分析 | Community Customer/Product/Deal/Document + Online Lead/Intelligence | **核心已替代** | 线索→客户→商机→报价主链已由 HUIDI owner 覆盖；不复制第二套 CRM。开票/回款/财务统计若要做，必须作为 Community Deal/Document 的扩展，而不是新 CRM。 |
| `SuperGokou/caijiwaimao` | AI 外贸增长引擎、Agent 编队、知识中枢、手动→AI 全流程映射、指标复盘 | Unified Workbench + Product Brain + Intelligence + Acquisition + Mail + Deal | **部分吸收** | “增长引擎而不是工具集合”的方向已落到统一工作台；Product Brain/业务上下文承担部分长期知识。后续重点是复用事实和策略，不照搬 6 个独立 Agent 页面。 |

## 本轮已经落地的新增收口

### 1. 找客户：真实数据门

`/api/leads/search` 统一先经过 Acquisition Provider Fusion：

- Serper / Tavily 至少有一个真实来源才执行公司搜索；
- 没有真实 provider 时返回 `live_acquisition_provider_required`；
- `items=[]`；
- 不进入旧 demo fallback；
- 不把模拟客户写进正式潜客库。

### 2. 找客户：多产品 × 多市场

同一找客户页面内提供折叠式批量搜索：

- 自动读取 Product Brain 现有产品，减少重复输入；
- 产品/关键词最多 4 个；
- 市场最多 4 个；
- 搜索组合最多 12 组；
- 逐组顺序调用现有 `/api/leads/search`，不使用 `Promise.all` 并发轰炸 provider；
- 每组限制结果量；
- 完成后复用现有 Lead Workbench 刷新；
- 不自动发邮件，不创建第二套客户库。

### 3. 潜客列表：勾选与批量处理

- 当前页复选框；
- 当前页全选；
- 批量标记已筛选 / 已联系 / 新客户 / 归档；
- 导出选中客户 CSV；
- 批量动作不会发送邮件或修改正式询盘；
- 复用现有 `PATCH /api/leads/{id}` owner。

### 4. 页面融合

- “邮件跟进 / 查资料 / 管理”等低频组可折叠；
- 旧 Local Bridge 普通用户入口隐藏，但暂保留兼容 DOM，避免破坏成熟桥接代码；
- 客户详情继续使用页内快捷导航；
- 不增加 iframe；
- 不增加第二个路由 owner；
- workflow closure 保持 `MutationObserver` 零使用。

## 下一阶段优先级

1. **联系人复用**：把同一 Customer / Lead 的已核验联系人做成可选择项，而不是反复输入姓名、职位、邮箱。
2. **市场/关键词偏好复用**：把常用市场、Product Brain 产品和上次成功获客组合保存为租户级轻量偏好；不保存外部秘密或密钥。
3. **外联变量收口**：从 Customer + Contact + Product Brain + Industry Playbook 自动形成变量上下文；用户只补真正缺失的字段。
4. **回复→询盘事实确认**：继续强化“勾选明确事实 → 人工确认 → Inquiry”，未知字段不猜。
5. **外部项目继续审计**：新参考项目先进入本矩阵，再决定吸收、替代或拒绝重复建设。

## 明确不做

- 不把所有参考项目的 UI 原样拼进 HUIDI；
- 不把每个项目变成一个顶级导航；
- 不为“功能数量”制造重复字段；
- 不在没有真实 provider 时落库假客户；
- 不绕过邮件发送治理做无上限并发群发；
- 不让 Product Brain 参考价格成为正式报价价格；
- 不让 Online 产生第二套 Customer / Deal / Document 正式 owner。
