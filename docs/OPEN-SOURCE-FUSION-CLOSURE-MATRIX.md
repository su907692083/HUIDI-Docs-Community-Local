# HUIDI Open-Source Fusion Closure Matrix

> Status: CANONICAL AUDIT CONTRACT
>
> Baseline used to start this closure: `28567807710e8fcdf861a226f8526a7beb67f40a`
>
> This document is stricter than the older capability-absorption summary. A source project is not considered fully absorbed merely because HUIDI has a similarly named API or page.

## 1. Closure rule

Every referenced project is evaluated on four independent layers:

1. **Capability** — the foreign-trade job worth keeping.
2. **Interaction** — the human-facing mechanism worth keeping: map, workbench, matrix, timeline, queue, workflow, knowledge search, dashboard, etc.
3. **Business continuity** — whether existing HUIDI Customer / Product / Deal / Document / Mail facts are reused without creating a parallel owner or asking the user to re-enter the same data.
4. **Runtime reality** — whether the current environment can actually execute the capability with real accounts/providers/permissions/quotas and without fake/demo production data.

Allowed final dispositions:

- `FULL PARITY` — all four layers are closed with browser/runtime evidence.
- `SUBSTITUTED` — HUIDI has an equivalent or better mechanism inside the authoritative existing owner; duplicating the source UI would make the product worse.
- `PARTIAL` — valuable capability is present but interaction, continuity, or runtime evidence is incomplete.
- `REJECTED DUPLICATION` — copying the project would create a second CRM / Product / Document / Mail / data owner.
- `CREDENTIAL-BOUND` — implementation path exists, but production validation depends on the user's real external account/API/OAuth/plan/quota.

`CREDENTIAL-BOUND` may accompany another disposition where the implementation itself is otherwise closed.

## 2. Authoritative HUIDI owner chain

Formal business facts remain owned by:

`Customer → Product → Deal → Document`

Online capability layers may contribute acquisition, market intelligence, contact discovery, due diligence, AI context, mail/follow-up, automation, analytics, team/permissions and provider adapters, but must not create a second formal CRM, Product, Deal, Document or Mail owner.

Price safety remains unchanged: Product/reference price never auto-writes Deal amount or formal document unit price.

## 3. Canonical source-project matrix

| # | Reference project | High-value capability / interaction to preserve | HUIDI target owner | Current disposition | Evidence already present | Remaining closure work |
|---:|---|---|---|---|---|---|
| 1 | `1099271/smart-lead-agent` | buyer discovery, contact enrichment, personalized outreach, batch lead workbench, direct next actions | Lead Workbench + Contact Search + Mail Owner | `PARTIAL` + `CREDENTIAL-BOUND` | real Lead owner, batch review, contact/mail routes, human review gates | prove source-level batch ergonomics and contact→outreach continuity with real provider credentials; no duplicate lead store |
| 2 | `Tommy-old/b2b-buyer-discovery` | multi-product × multi-market discovery, ranking, compact batch selection/result review | Acquisition Fusion + Product Brain + Lead Engine | `PARTIAL` + `CREDENTIAL-BOUND` | multi-product/market search path, ranking/lead reuse, real-provider gate | close compact matrix/batch UX and verify real provider result review at scale |
| 3 | `kakacells/Customer_background_check_version1.2` | evidence-oriented due diligence, visible evidence gaps, company/contact/digital/trade/fit review | Customer Intelligence + Lead Assessment | `PARTIAL` + `CREDENTIAL-BOUND` | six-dimensional evidence panel, unknowns shown as pending, no fake official/credit claims | validate real company/trade providers and ensure evidence navigation remains first-class from Lead/Customer |
| 4 | `uyoufu/UZonMail` | multi-mailbox, inbox/sent/queue, variables, sequences, tracking, thread continuity | Mail Owner V3 | `PARTIAL` + `CREDENTIAL-BOUND` | Inbox/Sent/Queue/Automatic Follow-up over one Mail owner; replies stop cold outreach | real Gmail/Outlook OAuth and SMTP/IMAP acceptance; scale/send-governance/opt-out behavior; thread continuity evidence |
| 5 | `chnjames/tradehot-skill` | actionable market/trade/tariff intelligence, changes/risks and next actions | Intelligence + Trade + Tariff/HS + Today | `PARTIAL` + `CREDENTIAL-BOUND` | market/trade/HS/FX/logistics owner routing and no-fake-data policy | production validation against real commercial/public providers; alert freshness and market-context reuse |
| 6 | `dongsheng123132/ai-tungke` | map acquisition and market discovery; interactive map must remain a first-class navigation surface | World Intelligence Map + Map Acquisition | `PARTIAL` | local country-level basemap, map-first route, DE/US/JP selection, zoom/drag, downstream market context | restore and harden per-country face hover/click without the prior load regression; finish source-level visual/interaction parity |
| 7 | `SuperGokou/caijiwaimao` | task-driven AI foreign-trade growth workflow rather than disconnected tools | Unified Workbench + Task Flow + Product Brain + Intelligence + Acquisition + Mail + Deal | `PARTIAL` | five-domain unified workbench and cross-owner task routing | close reusable strategy/context memory, task outcome review and low-input progression without exposing six duplicate Agent pages |
| 8 | `tshwangq/awesome-foreign-trade` | curated high-value foreign-trade resources and workflows | Capability Matrix + Data Sources | `SUBSTITUTED` | selective source/adaptor strategy already exists | keep as discovery/reference catalog only; do not count raw link volume as parity; add individual sources only when they shorten a real workflow |
| 9 | `CreatiBI/cli` | external data/agent access and source configuration | Service Adapters + Data Sources | `SUBSTITUTED` | one provider/service configuration plane; no duplicate console | expand adapters only when a real HUIDI workflow needs them; do not add a parallel data console |
| 10 | `howarliu1993/NPI-repo` | product/NPI master facts, technical/BOM context, product reuse | Community Product + Product Brain + Catalog + Document | `PARTIAL` target `SUBSTITUTED` | Product owner and Product Brain reuse into catalog/deal/document | define boundary with formal BOM/NPI owner; close technical-file/BOM fact projection only where needed by foreign-trade flow |
| 11 | `eicloud/eicloud.github.io` | CRM sales continuity: lead/customer/opportunity/quotation/sales chain | Community Customer/Product/Deal/Document + Online Lead/Intelligence | `SUBSTITUTED` | authoritative Customer→Deal→Document chain, native quotation/PI/contract/CI/packing flows | do not copy second CRM; future invoice/payment capability, if needed, must extend existing Deal/Document owners |
| 12 | `twentyhq/twenty` | modern CRM objects/views, flexible layouts, activity/workflow/agent concepts | Community Customer/Deal + Page Router + Team/Task layers | `PARTIAL` target `SUBSTITUTED` | single CRM owner chain, paged Customer/Deal pages, continuity into documents | audit views/activity timeline/custom-field ergonomics and determine which interaction patterns improve HUIDI without importing a second CRM runtime |
| 13 | `labring/FastGPT` | knowledge-base ingestion, chunking, hybrid retrieval/rerank, reusable KBs, application debugging/evaluation | HUIDI Knowledge / Product Brain / AI Context layer (no new formal business owner) | `PARTIAL` | Product Brain and business-context reuse exist | build or explicitly substitute a real document/knowledge ingestion + retrieval layer for product/customer/mail/document knowledge; add citations, retrieval diagnostics and browser acceptance |
| 14 | `langgenius/dify` | visual AI workflow, multi-model support, prompt/agent tools, RAG pipeline, LLMOps | AI Service Adapters + Task Flow + Knowledge layer | `PARTIAL` | task routing and provider/service adapters exist | decide simplified HUIDI workflow model; close model abstraction, tool/agent execution, knowledge retrieval and run observability without exposing a generic duplicate AI platform to ordinary users |
| 15 | `open-webui/open-webui` | unified multi-model chat, model/agent presets, knowledge/tool access, RBAC-aware AI workspace | HUIDI AI Workspace + Team/Permissions + Knowledge layer | `PARTIAL` | team/auth and AI-assisted business surfaces exist | create/substitute one business-context AI workspace that can query permitted HUIDI data and knowledge; prove tenant/RBAC isolation and tool approvals |
| 16 | `apache/superset` | interactive dashboards, drill-down/slice-and-dice, dataset exploration, broad visualizations | HUIDI Analytics / Today / Management views | `PARTIAL` | operational summaries and existing business data APIs exist | provide foreign-trade-specific drill-down analytics over existing owners; avoid exposing raw SQL/BI complexity to ordinary users; large-data/browser gates required |
| 17 | `n8n-io/n8n` | event/action workflow automation, integrations, AI steps, human approval and observability | HUIDI Automation + Task/Follow-up + Service Adapters | `PARTIAL` | mail sequences, reminders, task routing and provider adapters exist | define bounded event→condition→action automation over HUIDI owners; preserve human approval for outreach/formal writes; do not copy a generic node editor unless justified |
| 18 | `microsoft/playwright` | deterministic browser automation, multi-browser E2E, traces/screenshots; optionally agent-driven browser control | QA/CI infrastructure; product automation only if separately approved | `SUBSTITUTED` for QA | real Chromium/Playwright browser audits already gate multiple owner flows | expand failure traces/screenshots and cross-browser coverage; do not claim user-facing browser agent functionality merely because Playwright is used in CI |

## 4. What is already genuinely fused

The strongest current integration is the business continuity chain, not raw feature count:

`World Market / Acquisition → Lead → Evidence / Contact → Development → Mail / Follow-up → Customer → Inquiry / Deal → Quote / PI / Contract / CI / Packing List`

These capabilities reuse existing HUIDI owners rather than opening independent source-project databases or iframe applications.

The following safety properties are already mandatory:

- no fake/demo production lead, trade, tariff, shipping or company-result path;
- no second Customer / Product / Deal / Document / Mail persistence owner;
- reply facts are explicit-only and human-confirmed before formal use;
- product/reference price never becomes formal price automatically;
- multi-product formal documents remain with the existing Document owner;
- external-provider unavailability is shown as unavailability, not fabricated success.

## 5. Current closure priorities

### P0 — Runtime stability

Keep `28567807710e8fcdf861a226f8526a7beb67f40a` as the current live safety baseline while closure work proceeds. Community static assets must remain outside the Team Access DB-session pool; a source-parity feature is not acceptable if it makes the workbench fail to load.

### P1 — Map / acquisition / lead / due-diligence / mail chain

Close projects 1–7 first because they directly affect daily foreign-trade acquisition and follow-up. `ai-tungke` per-country face interaction must be reintroduced only after a load/concurrency gate proves it does not regress P0.

### P2 — Knowledge and AI workspace

Treat FastGPT + Dify + Open WebUI as one HUIDI capability layer, not three new top-level applications:

- document/knowledge ingestion;
- retrieval with visible citations/evidence;
- business-context-aware AI chat/agent;
- model/provider abstraction;
- bounded tools and human approvals;
- tenant/RBAC isolation;
- run/retrieval diagnostics.

### P3 — Automation and analytics

Treat n8n + Superset as capability sources:

- bounded event/condition/action automation over existing HUIDI owners;
- human approval before outbound/formal actions;
- foreign-trade dashboards and drill-downs over authoritative data;
- no generic node-editor or SQL-console complexity in the ordinary workflow unless a real expert-mode need is proven.

### P4 — CRM / Product substitution evidence

Close Twenty / eicloud / NPI by proving where HUIDI is intentionally better integrated, and only add missing interaction patterns that improve the existing authoritative Customer/Product/Deal/Document owners.

### P5 — QA evidence

Playwright remains a QA capability source. Closure requires browser evidence for the other projects; unit tests alone are insufficient.

## 6. Declaration rule

Do **not** state that “all referenced open-source projects are completely integrated / fully adapted” until every row above has a final disposition with concrete browser/runtime evidence and no unresolved `PARTIAL` status.

A future closure report must include, for each row:

- exact HUIDI files/routes/owners;
- exact source-project capability being preserved or substituted;
- interaction screenshot/browser evidence;
- data-owner continuity evidence;
- real-provider/account evidence where applicable;
- remaining environment limitation, if any;
- final disposition.
