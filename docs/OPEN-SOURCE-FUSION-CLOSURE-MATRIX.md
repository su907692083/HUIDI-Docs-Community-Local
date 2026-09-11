# HUIDI Open-Source Fusion Closure Matrix

> Status: CANONICAL AUDIT CONTRACT
>
> Baseline used to start this closure: `28567807710e8fcdf861a226f8526a7beb67f40a`
>
> This document is stricter than the older capability-absorption summary. A source project is not considered fully absorbed merely because HUIDI has a similarly named API or page.

## Latest closure checkpoint — P2/P3/P4 capability fusion

- Current construction checkpoint: `37a606cb31a3d66b9989b1824d8a3f4e54645ad3` on `online/v0.1-lead-workbench`.
- PR #2 remains **Draft / Open / Unmerged**; `main` remains locked at `30c3350f31864a7f15f52f5f1e11462f16bddcad`.
- P2 knowledge/AI is now a HUIDI-native layer rather than three embedded AI products:
  - `GET /api/knowledge/search` retrieves only existing Product / Lead / Customer / Deal / Intelligence facts with visible HUIDI citations and zero external network calls.
  - reusable AI context excludes structured formal/reference prices and also strips price-like fragments embedded in free text.
  - `POST /api/knowledge/suggest` uses the existing tenant-aware LLM provider only after cited HUIDI facts exist; no context means no model call, missing provider means explicit unavailable state, and uncited model output is rejected.
  - the fused development workbench exposes `HUIDI 知识引用` plus an explicit `基于引用给建议` control; the result is view/copy-only and does not write Lead / Customer / Deal / Document / Mail data or execute arbitrary tools.
- P3 automation/analytics now reuse existing owners instead of installing n8n/Superset runtimes:
  - `/api/automation/overview` projects existing `NotificationRoute + NotificationDelivery + build_notifications()` into trigger → condition → notification action → run/retry observability.
  - business automation is `notification_only`; outbound business mail, lead/deal conversion, formal document writes, formal-price changes and arbitrary code execution remain blocked.
  - automation destinations are HTTPS-only and reuse the shared SSRF/private-address guard; `system` backup-failure events are available as an explicit opt-in trigger rather than silently added to existing rules.
  - `/api/growth/funnel` now returns read-only foreign-trade operational analytics with Lead priorities, Deal stages, formal-document types and active pipeline grouped by currency; unlike currencies are never combined.
  - analytics drill back into the existing Lead / Communication / Customer-Deal / Document owners; no BI data copy or SQL console is introduced.
- P4 CRM/Product substitution evidence has started to close:
  - Customer/Deal quick details now receive a read-only unified activity timeline projected from existing LeadActivity, real incoming mail, mail delivery results, Deal updates and formal DocumentRef records; there is no second CRM activity table.
  - `huidi.product.non-price-facts/v1` projects reusable Product Brain technical/compliance/packaging/positioning facts into development context and Deal product selection while keeping Product Brain / Community Product authoritative.
  - product/reference price fields are omitted and price fragments embedded in reusable free text are isolated; the projection explicitly refuses to become a BOM owner.
- These P2/P3/P4 slices have dedicated contract tests and are entering exact-head CI/browser acceptance. They remain `PARTIAL` until the corresponding browser/large-data/runtime evidence is closed.
- Railway exact deployment is **not claimed** for this construction checkpoint. The protected staged patch `ad0f7d76-5733-4fae-b298-d407e24d79c0` remains outside this closure work.

## Previous closure checkpoint — P1 acquisition matrix

- Construction HEAD: `b50b659885182a7923ff6292789d76a489c6c5f1`.
- Product implementation commit: `60bbee66a09afac1699e25c1bda6c144b66f68ff` (`feat: add multi-market acquisition review matrix`).
- Browser/safety gate commits: `2279fd8e53489977fdf2d3046f2a679064b63d68` and `b50b659885182a7923ff6292789d76a489c6c5f1`.
- Exact-head PR workflows: **16 / 16 SUCCESS**, including Open Source Interaction Parity #51, World Market Interactive Parity #95, Provider Configuration Audit #165, Community Fullsite Audit #225 and the existing owner/browser/large-data regressions.
- Proven interaction: current fused Find Customer surface → multi-product × multi-market combinations → real-result matrix → cross-combination ranking using the existing Lead `score / priority / reason` → explicit buyer checkbox selection → existing human batch-development review queue.
- Proven unavailable-provider behavior: when real acquisition providers are absent, the browser gate observes an explicit failed combination row and **zero fabricated buyers**.
- Browser evidence for the matrix uses isolated records written through the real existing Lead owner; it does not claim Serper/Tavily/Hunter production credentials were tested.
- No new Customer / Deal / Mail persistence owner, no automatic contact lookup, no sequence enrollment, no queue/send action and no formal-price write were introduced.
- Railway deployment is **PENDING**, because the ordinary redeploy and staged-patch acceptance paths cannot prove deployment of the exact construction SHA without risking the protected staged patch.

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
| 1 | `1099271/smart-lead-agent` | buyer discovery, contact enrichment, personalized outreach, batch lead workbench, direct next actions | Lead Workbench + Contact Search + Mail Owner | `PARTIAL` + `CREDENTIAL-BOUND` | real Lead owner; multi-market batch matrix; cross-combination buyer selection; existing human review queue; buyer priority/score/reason visible in market review; contact/mail routes and human approval gates; browser proves no-provider/no-fake behavior | close per-buyer real contact enrichment → outreach continuity with live provider evidence; preserve explicit approval before any outbound action |
| 2 | `Tommy-old/b2b-buyer-discovery` | multi-product × multi-market discovery, ranking, compact batch selection/result review | Acquisition Fusion + Product Brain + Lead Engine | `PARTIAL` + `CREDENTIAL-BOUND` | compact product×market matrix, exact Lead score/priority/reason reuse, cross-combination dedupe/ranking, explicit max-8 buyer review selection and handoff to existing batch owner | validate real Serper/Tavily result review and larger real-provider result sets; exact construction deployment remains separate |
| 3 | `kakacells/Customer_background_check_version1.2` | evidence-oriented due diligence, visible evidence gaps, company/contact/digital/trade/fit review | Customer Intelligence + Lead Assessment | `PARTIAL` + `CREDENTIAL-BOUND` | six-dimensional evidence panel, unknowns shown as pending, no fake official/credit claims, Customer/Deal → source Lead evidence continuity | validate real company/trade providers and keep evidence navigation browser-proven from Lead/Customer/Deal |
| 4 | `uyoufu/UZonMail` | multi-mailbox, inbox/sent/queue, variables, sequences, tracking, thread continuity | Mail Owner V3 | `PARTIAL` + `CREDENTIAL-BOUND` | Inbox/Sent/Queue/Automatic Follow-up over one Mail owner; replies stop cold outreach; activity timeline now projects real replies and delivery results into CRM context | real Gmail/Outlook OAuth and SMTP/IMAP acceptance; scale/send-governance/opt-out and long-thread browser evidence |
| 5 | `chnjames/tradehot-skill` | actionable market/trade/tariff intelligence, changes/risks and next actions | Intelligence + Trade + Tariff/HS + Today | `PARTIAL` + `CREDENTIAL-BOUND` | market/trade/HS/FX/logistics routing; cached-only Today brief splits 客户可聊 / 市场机会 / 政策关税 / 物流交付 / 风险提醒 with `network_requests=0` | production validation against real public/commercial providers; freshness/alert browser evidence and market-context reuse |
| 6 | `dongsheng123132/ai-tungke` | map acquisition and market discovery; interactive map must remain a first-class navigation surface | World Intelligence Map + Map Acquisition | `PARTIAL` | local Natural Earth country basemap; full 177-country face layer; all countries hoverable; market-backed countries route through the existing Market owner; non-market countries remain view-only and do not fabricate business; zoom/drag/search/context handoff exist | close exact-head Chrome stability/interaction gate for the full-face implementation and deployment evidence without regressing load/concurrency |
| 7 | `SuperGokou/caijiwaimao` | task-driven AI foreign-trade growth workflow rather than disconnected tools | Unified Workbench + Task Flow + Product Brain + Intelligence + Acquisition + Mail + Deal | `PARTIAL` | five-domain unified workbench; single next-action open-box guidance; knowledge retrieval and business-context AI suggestions; cross-owner task routing | close reusable task outcome review and broader low-input progression without exposing duplicate generic Agent pages |
| 8 | `tshwangq/awesome-foreign-trade` | curated high-value foreign-trade resources and workflows | Capability Matrix + Data Sources | `SUBSTITUTED` | selective source/adaptor strategy already exists | keep as discovery/reference catalog only; add individual sources only when they shorten a real workflow |
| 9 | `CreatiBI/cli` | external data/agent access and source configuration | Service Adapters + Data Sources | `SUBSTITUTED` | one provider/service configuration plane; no duplicate console | expand adapters only when a real HUIDI workflow needs them; do not add a parallel data console |
| 10 | `howarliu1993/NPI-repo` | product/NPI master facts, technical/BOM context, product reuse | Community Product + Product Brain + Catalog + Document | `PARTIAL` target `SUBSTITUTED` | `huidi.product.non-price-facts/v1` projects identity, spec/material/dimensions, MOQ/lead time, certifications, HS/origin, packaging/carton/weight and permitted positioning facts; development context and Deal product selection reuse the same projection; embedded price text is isolated | browser-prove product→development→Deal continuity at scale; keep BOM/manufacturing ownership outside this Online workbench unless an explicit cross-project contract is approved; technical-file attachments/versioning remain open |
| 11 | `eicloud/eicloud.github.io` | CRM sales continuity: lead/customer/opportunity/quotation/sales chain | Community Customer/Product/Deal/Document + Online Lead/Intelligence | `SUBSTITUTED` | authoritative Customer→Deal→Document chain, native quotation/PI/contract/CI/packing flows, unified read-only Customer/Deal activity timeline | do not copy second CRM; future invoice/payment capability, if needed, must extend existing Deal/Document owners |
| 12 | `twentyhq/twenty` | modern CRM objects/views, flexible layouts, activity/workflow/agent concepts | Community Customer/Deal + Page Router + Team/Task layers | `PARTIAL` target `SUBSTITUTED` | single CRM owner chain; paged Customer/Deal pages; Customer/Deal quick drawer now projects LeadActivity + incoming mail + delivery results + Deal + DocumentRef into one chronological timeline with no activity table | browser/large-data timeline acceptance; evaluate only genuinely useful custom-field/view ergonomics instead of importing Twenty runtime or a second CRM schema |
| 13 | `labring/FastGPT` | knowledge-base ingestion, chunking, hybrid retrieval/rerank, reusable KBs, application debugging/evaluation | HUIDI Knowledge / Product Brain / AI Context layer | `PARTIAL` | authoritative lexical retrieval across Product/Lead/Customer/Deal/Intelligence; visible citations; zero external network retrieval; fused development `HUIDI 知识引用`; price isolation and contract gates | add real file/document ingestion only where business files require it; hybrid/vector retrieval/rerank and retrieval diagnostics remain open; browser/tenant acceptance required |
| 14 | `langgenius/dify` | visual AI workflow, multi-model support, prompt/agent tools, RAG pipeline, LLMOps | AI Service Adapters + Task Flow + Knowledge layer | `PARTIAL` | existing tenant LLM provider abstraction reused; citation-grounded `/api/knowledge/suggest`; no-context/no-provider explicit states; uncited model output rejected; no business writes/arbitrary tools | close bounded multi-step AI workflow/tool approval and run observability where a real HUIDI task needs it; do not expose a generic node canvas to ordinary users |
| 15 | `open-webui/open-webui` | unified multi-model chat, model/agent presets, knowledge/tool access, RBAC-aware AI workspace | HUIDI AI Workspace + Team/Permissions + Knowledge layer | `PARTIAL` | fused development workbench now has a business-context cited AI panel; tenant-aware provider and Team/Auth layers exist; suggestions are view/copy-only | prove tenant/RBAC isolation in browser; decide whether persistent AI sessions/model presets actually improve business flow; tools must stay permissioned and human-approved |
| 16 | `apache/superset` | interactive dashboards, drill-down/slice-and-dice, dataset exploration, broad visualizations | HUIDI Analytics / Today / Management views | `PARTIAL` target `SUBSTITUTED` | existing `/api/growth/funnel` enhanced with Lead priority, Deal stage, formal-document type and active pipeline-by-currency slices; clicks drill back to authoritative owners; no analytics table/SQL console; unlike currencies are not mixed | exact-head large-data/browser acceptance; add filters/time windows only when demanded by real management decisions rather than recreating generic BI complexity |
| 17 | `n8n-io/n8n` | event/action workflow automation, integrations, AI steps, human approval and observability | HUIDI Automation + Task/Follow-up + Service Adapters | `PARTIAL` target `SUBSTITUTED` | `/api/automation/overview` projects existing business events → conditions → `notification_only` actions → persistent delivery/retry results; owner/admin configuration; HTTPS-only + SSRF-safe destinations; system backup failures are opt-in triggers; high-risk business actions explicitly blocked | browser/runtime acceptance of rule/run observability; if higher-risk actions are ever added they must introduce explicit approval states rather than generic arbitrary node execution |
| 18 | `microsoft/playwright` | deterministic browser automation, multi-browser E2E, traces/screenshots; optionally agent-driven browser control | QA/CI infrastructure; product automation only if separately approved | `SUBSTITUTED` for QA | real Chromium/Playwright browser audits already gate multiple owner flows | expand failure traces/screenshots and cross-browser coverage; do not claim user-facing browser agent functionality merely because Playwright is used in CI |

## 4. What is already genuinely fused

The strongest current integration is the business continuity chain, not raw feature count:

`World Market / Acquisition → Lead → Evidence / Contact → Development → Mail / Follow-up → Customer → Inquiry / Deal → Quote / PI / Contract / CI / Packing List`

The following additional capability layers now sit on top of that same chain without taking ownership away from it:

`Product/CRM facts → cited Knowledge Retrieval → human-triggered grounded AI suggestion`

`Business events → safe notification conditions → durable delivery/retry observability`

`Authoritative operational data → foreign-trade analysis slices → drill-back to existing owners`

`Lead/Mail/Deal/Document events → read-only Customer/Deal activity timeline`

These capabilities reuse existing HUIDI owners rather than opening independent source-project databases or iframe applications.

The following safety properties are mandatory:

- no fake/demo production lead, trade, tariff, shipping or company-result path;
- no second Customer / Product / Deal / Document / Mail persistence owner;
- reply facts are explicit-only and human-confirmed before formal use;
- product/reference price never becomes formal price automatically;
- reusable knowledge/product projections isolate embedded price fragments;
- multi-product formal documents remain with the existing Document owner;
- external-provider unavailability is shown as unavailability, not fabricated success;
- AI suggestions are citation-grounded and view/copy-only unless a future explicitly approved workflow adds a bounded action;
- business automation currently executes notifications only; arbitrary code and high-risk business mutations remain blocked.

## 5. Current closure priorities

### P0 — Runtime stability

Do not promote any source-parity feature if it regresses page load, browser responsiveness, tenant isolation or existing Customer/Product/Deal/Document/Mail owners. Railway exact deployment remains a separate evidence boundary from GitHub construction and CI.

### P1 — Map / acquisition / lead / due-diligence / mail chain

The acquisition matrix and 177-country map interactions now exist on the construction branch. Remaining work is primarily exact-head browser stability, real-provider validation and safe exact-deployment evidence; do not reintroduce automatic enrichment/outbound actions to chase nominal source parity.

### P2 — Knowledge and AI workspace

FastGPT + Dify + Open WebUI are intentionally treated as one HUIDI capability layer. Retrieval + citations + one business-context AI suggestion surface now exist. Remaining closure is document/file ingestion where needed, retrieval diagnostics/hybrid search where justified, tenant/RBAC browser proof and bounded multi-step tool approvals.

### P3 — Automation and analytics

n8n + Superset are intentionally substituted by HUIDI-native projections over authoritative data. Current automation is safe `notification_only`; current analytics are read-only and drill back to existing owners. Remaining closure is browser/large-data evidence and any future explicitly approved human-approval state for higher-risk actions.

### P4 — CRM / Product substitution evidence

Twenty / eicloud / NPI are being closed by strengthening the existing Customer/Product/Deal/Document chain: unified activity timeline plus non-price technical/compliance/packaging fact projection are now present. Remaining work is browser/large-data evidence, selected custom-field/view ergonomics and technical-file attachments/versioning where they shorten a real foreign-trade workflow.

### P5 — QA evidence

Playwright remains a QA capability source. Closure requires exact-head browser evidence for the other projects; unit/contract tests alone are insufficient. Prefer screenshots/traces on failures and targeted multi-browser coverage for high-risk interaction paths rather than multiplying shallow smoke suites.

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
