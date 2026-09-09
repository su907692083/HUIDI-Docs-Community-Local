# Human-operation closure R1 — 2026-09-09

## Exact continuity and scope
Source: construction d4e9eb619fbe351e695e08407ff246215916ddd8 (application predecessor 4e6b7372).
Deployed before this work: 9397c74e11e7f2db42aa9468459f814521b2a587.
Recovered previous unpromoted UX edits only where exact SHA256 and replacement counts matched. Missing work was reconstructed against that source, not an old release.

## User-facing changes
- Native HTML hidden state and critical inline tab styles prevent inactive panes from appearing if a fusion stylesheet fails.
- Content-derived asset revision and revalidation for bare dynamic modules prevent stale mixed CSS/JS.
- Searchable bilingual country/region choices (249 codes), common currency/unit choices and existing-product keyword reuse. Standard text editing and custom values remain available. No forced city/province hierarchy or price changes.
- One bounded popup supports pointer selection, ArrowUp/Down, Enter, Tab and Escape; native dialog portal and IME guard. No DOM polling or second persistence owner.
- Search keeps input and durable errors; source configuration can return to the originating task. Search results display the response for the actual query, not the unrelated first page of the pool.
- Market filtering by Chinese/English/code, bounded list scrolling, readable labels and actionable workspace summaries rather than raw API keys.
- Empty-mailbox connection action reaches the retained Mail Owner. Source configuration is labelled configured, never falsely authenticated.
- Existing editor startup stays measurable while hidden visually, preserving the native document pagination owner.

## Acceptance
Run all Python tests and exact-source GitHub workflows. The human-operation audit uses mouse clicks and key presses in an isolated tenant, writes screenshots and HUMAN-OPERATION-REPORT.json, and fails on uncaught exceptions or failed checks. It deliberately aborts two stylesheets to exercise graceful failure. Existing strict document-chain acceptance remains enabled; no test has been removed or relaxed to deploy.

## Not claims of completion
No external live provider account or real customer email is used. Third-party credentials, account permissions, quota, OAuth consent and deliverability need live validation. Feishu Online adapter remains a separately recorded gap. Global province/city cascade, every low-frequency dialog, all exports and full offline packaging are not certified by this pass. No measurable population-wide requirement coverage is claimed.

## Deployment constraints
Construction only; main stays 30c3350f31864a7f15f52f5f1e11462f16bddcad. PR2 remains draft/open/unmerged. Reuse Railway service 42012f6b-6697-478c-ba75-df3b815e6a45, retain /data volume, do not accept staged patch ad0f7d76-5733-4fae-b298-d407e24d79c0. Deploy only after all current-head required gates pass. Rollback to the previous deployment must not restore an old database or delete saved credentials.
