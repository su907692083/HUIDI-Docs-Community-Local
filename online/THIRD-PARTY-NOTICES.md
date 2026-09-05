# Third-Party Notices — HUIDI Docs Online

HUIDI Docs Online studies multiple foreign-trade open-source projects. This file records the upstream relationship and the boundary used by HUIDI.

## 1. smart-lead-agent

- Project: `1099271/smart-lead-agent`
- Repository: https://github.com/1099271/smart-lead-agent
- Upstream license: Apache License 2.0
- Studied areas: FindKP, Writer, MailManager, search providers, FastAPI / SQLAlchemy architecture, multi-LLM routing.

HUIDI reorganizes these capability categories around its own customer → inquiry → document workflow. If upstream source is copied or modified directly later, the relevant Apache-2.0 attribution, license text and modification notices must be retained with those files.

## 2. b2b-buyer-discovery

- Project: `Tommy-old/b2b-buyer-discovery`
- Repository: https://github.com/Tommy-old/b2b-buyer-discovery
- Upstream license: MIT
- Studied areas: multi-market buyer discovery, rule + AI lead scoring, contact extraction, outreach-draft workflow, export model.

HUIDI V0.1.1 implements its own scoring model and API structure. The upstream MIT project is an important design reference; direct reuse, if introduced later, must keep the MIT copyright and permission notice.

## 3. UZonMail

- Project: `uyoufu/UZonMail`
- Repository: https://github.com/uyoufu/UZonMail
- Upstream license: Apache License 2.0
- Studied areas: multiple sender accounts, OAuth2, templates and variables, delivery limits, retry, open tracking, unsubscribe, permissions and server deployment.

HUIDI has not copied UZonMail into V0.1.1. The project is being used as a reference for the future mailbox / delivery-governance layer. Any future direct source reuse must retain Apache-2.0 notices and modification information.

## 4. Customer_background_check_version1.2

- Project: `kakacells/Customer_background_check_version1.2`
- Repository: https://github.com/kakacells/Customer_background_check_version1.2
- Repository README states: MIT License
- GitHub repository metadata / root contents reviewed during V0.1.1 did not expose a separate root `LICENSE` file.
- Studied areas: verification dimensions, confidence model, fallback strategy, company/person/digital/trade checks and risk-control presentation.

**HUIDI treats this project as design research only for now.** V0.1.1 does not copy its Skill text, templates or scripts. HUIDI's `LeadAssessment` logic is independently implemented and deliberately marks unavailable official registry / customs data as `unverified`.

## 5. tradehot-skill

- Project: `chnjames/tradehot-skill`
- Repository: https://github.com/chnjames/tradehot-skill
- GitHub repository metadata reviewed during V0.1.1 reports no recognized repository license.
- Studied areas: trade daily/weekly briefs, platform policy, market research, HS / tariff, logistics, FX, risk and trade calendar information architecture.

**Design reference only.** HUIDI does not copy its Skill, source data, report templates or scripts. Any HUIDI Trade Intelligence module will be independently implemented unless a clear compatible license is confirmed.

## 6. ai-tungke

- Project: `dongsheng123132/ai-tungke`
- Repository: https://github.com/dongsheng123132/ai-tungke
- GitHub repository metadata reviewed during V0.1.1 reports no recognized repository license.
- Studied areas: map-oriented lead discovery, region traversal, industrial-cluster discovery, online verification and customer-evaluation product concepts.

**Design reference only.** HUIDI does not copy its React pages or other source. A future map discovery provider will be implemented independently behind HUIDI's own provider interface.

## 7. awesome-foreign-trade

- Project: `tshwangq/awesome-foreign-trade`
- Repository: https://github.com/tshwangq/awesome-foreign-trade
- Upstream license: GNU GPL v3
- Studied areas: B2B platforms, social channels, messaging tools, HS / shipping / email verification / customs / FX / tax-resource navigation.

HUIDI does not import the upstream README or create a derivative copy of the GPL resource list. A future HUIDI toolbox may provide independently curated outbound links and original descriptions.

## 8. caijiwaimao

- Project: `SuperGokou/caijiwaimao`
- Repository: https://github.com/SuperGokou/caijiwaimao
- The reviewed repository is primarily a static internal product blueprint / animated demo (`index.html`, `demo.html`, CSS and browser JS), not a production lead-generation backend.
- Its README labels the material `Internal · Confidential · 仅供核心团队使用` rather than granting an open-source software license.
- Studied areas: Product Brain as a durable fact source, campaign/ICP setup, Hunter / Profiler / Writer / Outreach / Closer role separation, customer and decision-maker memory structure, buying signals, open threads, append-only timeline, and the discipline separating persistent Brain facts from temporary Agent memory.

**Research reference only. HUIDI does not copy the upstream HTML, CSS, demo screens, internal text, prompts or other source.** HUIDI V0.1.3 independently implements its own `Product Brain` fact-source layer, campaign brief and Local → Online product handoff around HUIDI's existing product/customer/inquiry/document data contracts.

---

## HUIDI integration policy

1. **Apache-2.0 / MIT:** compatible components may be adapted when useful, with required notices retained.
2. **GPL-3.0:** do not casually mix source into HUIDI's Online codebase; evaluate derivative-work obligations before any direct reuse.
3. **No clear license / README-only / confidential notice:** treat as research reference and independently reimplement.
4. Preserve source URLs and evidence for externally sourced business data.
5. Keep durable product/customer facts separate from temporary search or model context.
6. Never present upstream work as HUIDI original work.
