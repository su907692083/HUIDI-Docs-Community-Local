# Community Fullsite Closure R1 — candidate, not complete product sign-off

User scope (2026-09-09): all Community/Online first-level pages, nested tabs,
windows, buttons, pagination, consistent visuals and cross-owner continuity.
This supersedes the previous screenshot-only presentation scope, not the locked
main / protected Railway patch / human-confirmed price or sending boundaries.

## Source repairs
- Frozen LocalDB cloud read facade; shared storage owner unchanged.
- Unknown nav count fixed at its generating source, not only hidden afterward.
- Main fused tab owner now serializes singleton mounting, retains non-secret
  input state, adopts custom panes, retries failed dependency loads and exposes
  ARIA / keyboard tab controls.
- Potential customer pool uses server page 1/2/etc, size 20/50/100, filter reset,
  refresh/retry and stale-response guards, rather than truncating at 100.
- Mailbox settings is separate from inbox. Existing SMTP governance, mail
  pagination and thread modules are loaded explicitly. Mailbox window traps
  focus, supports Escape and restores the opening control.
- Mail pagination carries exact lead/thread identity. Thread return stays in
  the fused Community mail page, not the old standalone application.
- Sequence initial reads are paged and adopted, not followed by a second read
  after an unpaged scan. Only enabled, connected accounts are usable.
- Off-page selected leads use exact record reads in the existing development
  owner. Unsaved development text blocks switching to another customer.
- Capability detail is collapsed by default. Unknown FX status is not ready;
  null/empty/out-of-range map coordinates cannot become false (0,0) markers.
- Existing final CSS now provides readable labels/controls, bounded table
  scrolling, compact sidebar groups and progressive capability details.

## Evidence and limits
The baseline fullsite browser discovery covers 42 unique page/tab states plus
7 revisit transitions. It found a frozen-API exception, missing potential-pool
page 2 and a mailbox-manager dead action. Its successful discovery workflow did
NOT mean those findings passed acceptance.

R1 must pass the strengthened browser gate and existing business regressions
before production promotion. External provider/OAuth credentials and actual
outbound mail are not exercised against production. Feishu server endpoints,
full local offline export/restore, every advanced document control, all entry
points and large-data base search remain explicit audit work, not signed off.
No claim that every project engine or every button is complete.
