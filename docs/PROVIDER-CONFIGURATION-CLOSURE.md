# Provider Configuration Closure — candidate, 2026-09-09

Exact construction base: `52ba347059e2b0777371c70b8be57db7a83944e3`.
Deployed application before this change: `9397c74e11e7f2db42aa9468459f814521b2a587`.

## Scope and ownership
Existing ServiceConnection encrypted storage and tenant databases only; no migration/new provider table. Existing MailboxAccount/OAuth/SMTP owners retained. No global environment mutation, automatic mail sends, formal-price changes or main merge. Existing unpromoted document diagnostic WIP is not discarded; this candidate adds equivalent failure evidence capture without weakening acceptance.

## Implemented
- Six built-in configuration rows: Serper, Tavily, Hunter, Gmail application, Outlook application and compatible draft generation.
- Existing four generic adapters (company/trade/tariff/shipping) use their actual configured method and credentials for connection testing too.
- Request-time credentials resolve from current company first, platform environment second; a disabled company override never silently uses platform keys.
- Blank credentials preserve encrypted stored credentials; changing an LLM endpoint or SMTP destination requires a fresh secret. No decrypted credentials returned in status, templates or errors.
- JSON / KEY=value / single key paste applies only allowed fields and requires explicit save. Save, API check and OAuth consent are different states.
- Fixed official API bases, same-site OAuth callback copy, synchronous popup reservation, existing mailbox and RSS settings navigation.
- SMTP is explicitly sending only; existing Gmail/Outlook HTTPS OAuth supports receiving. No fictional IMAP support is added.

## Validation limits
392 Python regressions passed locally (includes 16 new behavioral tests, with upstream HTTP mocked). This does NOT validate real customer credentials, mailbox consent, provider quota, delivery, or an arbitrary commercial data vendor's schema.
Browser configuration acceptance must pass in GitHub CI before promotion/deployment. The inherited strict fullsite native-document readiness gate failed at the base and remains required, not ignored.
`TYML` was not identified as a provider name and must be clarified by the user; no silent substitution.
Feishu's missing Online endpoint and universal offline/provider onboarding are not fixed by this candidate.

## Installation / rollback
Application source candidate only. Preserve current database, HUIDI_SECRET_KEY, /data volume and all existing records. No fresh production install or historic-candidate replay.
Do not deploy until exact-head required gates pass. Rollback application to prior deployed commit through the existing deployment procedure; do not roll back user data or restore older databases. Newly saved built-in settings remain in ServiceConnection when rolling back, but older runtime will ignore them. Never clear these settings or rotate HUIDI_SECRET_KEY as part of rollback.
