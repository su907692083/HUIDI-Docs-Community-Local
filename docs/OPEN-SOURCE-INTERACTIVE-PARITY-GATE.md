# HUIDI Open-Source Interactive Parity Gate

## Purpose

HUIDI does not count an external project's capability as "absorbed" merely because an API, backend function or text summary exists. If the reference project contains a high-value interaction model that materially improves foreign-trade work, HUIDI must either preserve that interaction or provide an equivalent/better interaction inside the existing HUIDI owner.

This gate supplements `ONLINE-FOREIGN-TRADE-CAPABILITY-ABSORPTION.zh-CN.md`.

## Acceptance rule

For each referenced project, track all four layers separately:

1. **Capability** — what business job it solves.
2. **Interaction** — map, table, workflow, canvas, queue, timeline, batch picker or other human-facing mechanism.
3. **Business continuity** — whether Customer / Product / Deal / Document / Mail facts are reused instead of retyped.
4. **Runtime reality** — whether the connected provider/account actually returns real data in the current environment.

A project is not `fully absorbed` when only layer 1 exists.

## Current high-value projects

| Reference | Capability | Interaction that must not be flattened | Current HUIDI owner | Gate status |
|---|---|---|---|---|
| `1099271/smart-lead-agent` | buyer discovery, contacts, outreach, batch work | batch lead workbench + direct next actions | Lead Workbench / Mail | partial parity |
| `Tommy-old/b2b-buyer-discovery` | multi-product × multi-market buyer discovery | compact matrix/batch selection, ranking and result review | Acquisition Fusion / Lead Engine | partial parity |
| `kakacells/Customer_background_check_version1.2` | customer due diligence | evidence-oriented customer review, not raw JSON | Customer Intelligence / Lead Assessment | partial parity |
| `uyoufu/UZonMail` | mailbox, queue, sequences, tracking | inbox/sent/queue/thread continuity | Mail Owner V3 | partial parity / credential-bound |
| `chnjames/tradehot-skill` | market/trade/tariff intelligence | market context and actionable next steps | Intelligence / Trade / Tariff | partial parity / provider-bound |
| `dongsheng123132/ai-tungke` | map acquisition and market discovery | **interactive map as a first-class navigation surface** | World Intelligence Map / Map Acquisition | **active parity work** |
| `SuperGokou/caijiwaimao` | AI foreign-trade growth workflow | task-driven growth workflow, not six disconnected tool pages | Unified Workbench / Task Flow | partial parity |
| `tshwangq/awesome-foreign-trade` | curated foreign-trade resources | only high-value workflows are absorbed; link volume is not parity | Capability Matrix / Data Sources | selective |
| `CreatiBI/cli` | data/agent access | integrated source configuration, no duplicate console | Service Adapters | substituted |
| `howarliu1993/NPI-repo` | product/NPI master data | product facts must stay with Product/BOM owner | Community Product / Product Brain | partial/substituted |
| `eicloud/eicloud.github.io` | CRM sales chain | unified customer→deal→document continuity, not second CRM UI | Community business owners | substituted |

If the historical source list identifies another project as the original world-map source, add that exact project here before claiming complete parity. Do not guess its identity.

## World-map parity contract

The global map is a business navigation layer, not decorative visualization and not a text-only country list.

Required behavior:

- `全球互动地图` is the first market-intelligence entry.
- Entering the Market task without a deep-link tab opens the map first.
- Clicking/focusing a country shows that country's market summary and the user's real business counts.
- Country detail keeps real market news, potential customers, verified contacts, formal customers and inquiries in one context where available.
- From the same country context, the user can continue to:
  - find local buyers;
  - open customer intelligence;
  - inspect trade records;
  - inspect HS/tariff information;
  - inspect FX;
  - inspect shipping/logistics;
  - inspect market dynamics.
- Current product and market context should be reused when those downstream owners expose matching fields.
- The map and text/list fallback may coexist, but fallback must not replace the first-class map interaction during normal operation.
- No fake lead, fake trade, fake tariff or fake shipping data may be created when a provider is unavailable.

## Full-absorption declaration gate

Do not say "all referenced open-source projects are fully absorbed" until every project in the source list has one of these explicit dispositions:

- `FULL PARITY` — capability + valuable interaction + continuity + runtime gate complete;
- `SUBSTITUTED` — HUIDI has an equivalent/better interaction in the existing owner, with evidence;
- `PARTIAL` — remaining interaction or runtime gaps are listed;
- `REJECTED DUPLICATION` — copying it would create a second CRM/Document/Mail/Product owner;
- `CREDENTIAL-BOUND` — code path is complete but real external authorization/plan/quota remains environment-specific.

The acceptance report must show browser evidence for interaction parity, not only unit tests or backend route coverage.
