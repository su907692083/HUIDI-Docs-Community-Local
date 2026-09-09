# SOURCE-REUSE-R2 — configure once, reuse explicitly

Base: `5e1d5f80a5f90c2516ab5e7645b9dae5b721348a`, existing construction branch only.

## Application scope
- Keep the existing ten provider configurations; filter by task/name without remounting unsaved forms. Official key-based endpoint addresses stay predefined. Connection failures cannot remain labelled successful.
- Repair the legacy Feishu click capture that swallowed table read, folder browse and import actions. Keep the existing Community customer/product repositories and cloud synchronization; no second business owner.
- Add the missing online Feishu routes using the existing per-organization encrypted ServiceConnection store. No schema changes, plaintext credentials, global token cache, arbitrary outbound URLs or redirect-following.
- Application credential validation does not claim target-file access. Multiple tables require selection; explicit current-page import, pagination, remembered table/mapping, duplicate skip by default, failed reads clear stale previews. Import success requires server acknowledgement; imports exceeding the retained sync capacity are blocked before writing.
- Read operations use fixed official Feishu APIs. Read-only previews contain plain text, not a promise of full native attachment/formula fidelity. Wiki resolution and international Lark domains are not implemented. At most 52 columns and 100 table choices; over-limit inputs are explicitly refused, not silently discarded.
- Collaboration summary writes remain user-triggered, manager-only and allowlisted; they are not complete backups. A newly created document ID survives later append failure. Ambiguous write timeouts instruct checking the document before retry.

## Verification boundary
All external service responses in the new browser and unit audits are explicit isolated fixtures. Browser uses real page controls, actual app routes, encrypted tenant persistence and Community save/reload. No real API keys or customer messages are used. Live Feishu permissions, quotas and actual OAuth/SMTP/IMAP accounts still require owner-specific authorization; never declare them passed from fixture tests.

The source-reuse browser audit is not included in the production Docker image. Existing provider, keyboard, page, mail, product and document checks remain required. Any deployment requires a fresh construction ref check, green associated checks, exact deployed commit, health and the original /data volume. Do not merge main or accept the protected Railway staged patch.
