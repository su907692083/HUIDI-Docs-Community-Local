# HUIDI Docs Community Local · Translation Coverage Audit

Baseline: RC16.30 audit branch  
Scope: Quotation / PI / Sales Contract / Commercial Invoice / Packing List, all effective modes, editor + PDF + table/workbook output.

## Executive finding

The current product has a strong **fixed-label i18n layer** (17 single-language outputs + Chinese/English bilingual), but the **user-authored business-content translation layer is incomplete and partly unreachable in Community Local**.

The current translation system must be treated as three separate capabilities:

1. **Whole-document translation** — one action translates every currently relevant user-authored translatable value.
2. **Section translation** — translate only the current visible business section, such as Products, Delivery, Customs, Packing, Payment Terms, Quality/Risk.
3. **Single-field translation** — translate one eligible field without changing the rest of the document.

Only capability (1) has a legacy implementation today, and its Local entry is hidden. Capabilities (2) and (3) do not have general-purpose translation functions.

## Current language surface

The document language selector contains 18 choices:

- Chinese/English bilingual
- Chinese
- English
- Spanish
- Brazilian Portuguese
- German
- French
- Italian
- Russian
- Arabic
- Japanese
- Korean
- Turkish
- Dutch
- Polish
- Vietnamese
- Indonesian
- Thai

Fixed document titles, common headings, table headers, and many canonical labels use local i18n dictionaries.

### Confirmed bug fixed during this audit

The business-translation target-name map had no `zh: 'Chinese'`. Chinese output therefore sent `targetLanguage='zh'` while `targetName` fell back to `English`. RC16.30 audit now maps Chinese explicitly.

## P0 — Community Local translation entry is hidden

`community-local-mode.js/css` hides:

- `headerTranslateBtn`
- `translateAllBtn`

The legacy `translateAll()` implementation still exists.

Showing the button alone is **not** a valid fix: the legacy hosted translation path depends on Supabase auth + Edge Function, while Community Local intentionally blanks production Supabase configuration and blocks cross-origin browser API calls.

The current local HTTP server also has no same-origin translation endpoint.

**Required resolution:** provide a Local-safe translation owner/service first, then expose the buttons.

## P0 — Whole-document translation does not cover the current field system

`translateAll()` collects only five historical scopes:

- party
- products
- logistics
- payment
- terms

Newer structured sections are not first-class translation scopes:

- delivery
- paymentSchedule
- customs
- packing
- actualShipment
- qualityRisk

This means “translate whole document” is not actually whole-document coverage after the structured-field expansion.

## P0 — No general section translation

There is no general `translateSection()/translateScope()` implementation.

Target UX should provide one action in every visible translatable section header:

- Translate this section
- Show translated-count / missing-count
- Respect the current document language
- Never translate identifiers, numbers, bank numbers, product codes, or legal entity names unless explicitly opted in

## P0 — No general single-field translation

There is no general `translateField()` implementation or `data-translate-field` control.

The existing content library can store manually prepared language variants and write them into selected fields, but that is **not** arbitrary single-field AI translation.

Target UX: eligible text inputs/textareas receive a small “Translate” action beside the field label. One click translates only that field and writes the result into `translationVersions`, leaving the source text unchanged.

## Business-content coverage gaps by document/mode

### Quotation

**Quick quotation**
- Existing legacy coverage is relatively strong for product name/spec, remarks, delivery terms and standard business descriptions.
- Missing general section/single-field controls.
- Custom fields and custom logistics labels are not fully translated.

**Full quotation**
- Same gaps as quick quotation.
- Structured-field label localization still relies heavily on fallback/alias logic.

### Proforma Invoice (PI)

**Standard PI**
- Missing automated translation for `balanceDueCondition`.
- No section/single-field translation.

**Order-execution PI**
Additional missing business text:
- consigneeAddress
- notifyPartyAddress
- billToAddress
- shipToAddress
- mixedPackingNote
- partialShipmentPlan

Entity names, phone/email, order numbers, bank account numbers and dates should remain non-translatable by default.

### Commercial Invoice

Formal single-mode document.

Missing business-text coverage includes:
- customsDescription
- finalUse
- customsDeclarationNote
- consigneeAddress
- notifyPartyAddress
- billToAddress
- shipToAddress
- mixedPackingNote

Do not automatically translate:
- registration/VAT/EORI numbers
- license/certificate numbers
- manufacturer legal name
- final-user legal name
- HS/code identifiers
- money/numeric declaration values

### Packing List

Formal single-mode document.

Missing business-text coverage includes:
- consigneeAddress
- notifyPartyAddress
- billToAddress
- shipToAddress
- mixedPackingNote
- custom logistics field labels

Carton numbers, pallet numbers, tracking numbers, B/L, container/seal numbers, quantities, dimensions and dates should not be machine-translated.

### Sales Contract

**Sales confirmation**
Missing business-text coverage includes:
- balanceDueCondition
- qualityStandard
- warrantyPeriod
- contractClauses

**Full sales contract**
Additional missing text:
- consigneeAddress
- notifyPartyAddress
- billToAddress
- shipToAddress
- mixedPackingNote
- governingLaw
- disputeResolution
- attachmentList
- partialShipmentPlan

Person names/signatories remain non-translatable by default.

## Fixed-label dictionary coverage risk

There are 65 structured-field labels in `flypigbox-document-schema.js`.

A direct exact-phrase cross-check against `huidi-doc-i18n-rc164.js` shows 59 labels without their own direct 18-language phrase entry. Some can still resolve through canonical label aliases or core-key fallback, so this is **not equivalent to 59 visible failures**, but it means full multilingual coverage is not mechanically guaranteed.

Recommended end state:

- Every structured field has one canonical i18n key.
- Every canonical key has 17 single-language translations.
- CI checks that every visible structured field resolves in every supported output language.

## Output consistency gap

### PDF
Legacy translated fields use `translationVersions` through `translatedDisplay()`.

### Table / workbook / Excel
Fixed labels are localized, but business values generally remain raw. `translationVersions` is only used in limited paths such as structured fee label/note handling.

Therefore a document can currently have translated PDF business content while the table/workbook representation still shows source text.

**Required end state:** editor preview, PDF, print, table view, XLSX/CSV and any document mirror must resolve business text through the same translation resolver.

## Translation safety policy

### Translate automatically by default
- product name / customer-facing description
- product specification prose
- package description
- shipping marks / descriptive marks
- remarks
- payment terms prose
- delivery-time prose
- customs description
- end-use description
- customs declaration notes
- mixed-packing notes
- quality standards in prose
- warranty wording
- governing-law wording
- dispute-resolution wording
- attachment descriptions
- partial-shipment plan
- customer-facing address text when enabled
- custom field labels/values when marked translatable

### Do not translate automatically
- company/legal entity names
- person names
- SKU/model/product code
- HS code
- PO/quotation/PI/contract/invoice/packing-list numbers
- VAT/EORI/registration/license/certificate numbers
- bank beneficiary/account/SWIFT
- currency/amount/percent/quantity/weight/CBM/dimensions
- container/seal/B/L/AWB/tracking identifiers
- email/phone/URLs
- Incoterms abbreviations and other internationally standardized codes

## Required architecture before exposing Local translation

Introduce one canonical translation owner with:

- `translateDocument()`
- `translateSection(sectionKey)`
- `translateField(fieldKey)`
- `resolveValue(fieldKey, source, language)`
- `invalidateField(fieldKey)`
- shared `translationVersions` storage

Provider routing must be explicit:

1. Community Local: same-origin local translation service or explicitly configured local/BYO provider.
2. Online edition: hosted translation service.
3. No provider: keep manual variants available and show a clear “translation service not configured” state; never show a button that silently fails.

## Acceptance criteria

- 5 document types covered.
- Quick/default, detailed/B2B and formal single modes covered.
- 18 language choices retained.
- Full-document translation count equals all visible eligible fields.
- Section translation only touches that section.
- Single-field translation only changes that field's translation variant.
- Source text never overwritten by machine translation.
- Editing source invalidates only that field's stale translation.
- PDF / print / table / XLSX use the same translation resolver.
- Non-translatable identifiers never enter translation payload.
- Community Local never sends content remotely without an explicit configured provider and user action.
