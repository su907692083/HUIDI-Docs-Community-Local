# Fullsite R2 — native list owner and continuity

Source baseline: 7c1ab9044228f5aa1d5f94f2514f53a113e163ee. R1 changes retained.

The existing Community list owner now owns page slicing for customer, product, deal, document, draft mail, brand, terms and recycle lists. Native legacy renderers delegate to it instead of replacing page 2 after an unrelated click. Existing summary predicates run before slicing. All pagers remain inside their owning view.

Document list retains the native Quote → PI → Contract → CI → Packing actions and six-column schema. No new document/price owner is introduced. Global search opens the actual page of an exact record. The detail drawer closes with Escape, returns focus, and yields to native edit dialogs without a second overlay. Existing secondary product/customer/deal actions are restored. Permanent deletion requires confirmation and cancelling preserves the item; mail deletion goes through recycle. Metadata/document history is no longer silently truncated at 500 entries. This is not a claim of unlimited browser storage.

Real browser acceptance is mandatory: 105 leads, 55 additional rows in each core collection, page 2 retention, late-page summary matches, shared pane drafts, dialogs, native PI navigation. External acquisition/mail/Feishu/data providers remain environment-bound; no fake service or credentials are supplied. Other unexercised button paths remain explicitly unverified in the coverage inventory.
