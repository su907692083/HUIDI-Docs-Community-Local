# RC16.11 Validation

Validation date: 2026-09-03  
Status: TEST CANDIDATE

## Static / release gates

- `npm run check`: PASS
- RC16.10 compact/standard retained component gate: PASS
- RC16.11 pagination stability gate: PASS
- public JavaScript syntax scan: PASS
- HTML local references: PASS
- Community Local CSP / network guard: PASS
- Protected PDF Core SHA256: unchanged

## Dynamic Chromium matrix

### 12-product long-field matrix

- Quotation: 30 / 30 PASS
- Proforma Invoice: 30 / 30 PASS
- Sales Contract: 30 / 30 PASS
- Commercial Invoice: 30 / 30 PASS
- Packing List: 30 / 30 PASS
- Total: **150 / 150 PASS**

Matrix dimensions: 5 PDF styles × 3 paper orientation preferences × 2 density modes.

Acceptance conditions per case:

- pagination report valid
- overflowPages empty
- semanticViolations empty
- rendered product-row count equals source product-row count
- real DOM clipping detector = 0
- `fpPaginationStable = 1`

### 20-product pressure matrix

- QT / PI / SC / CI / PL: 10 cases each
- Total: **50 / 50 PASS**
- Focus: classic/brand/high-density layouts, long product descriptions, totals/summaries, terms/logistics tails.

### Real UI continuous-switch regression

Used actual `FlypigBOXApp.applyDocumentProfile()` switching path rather than raw-state test injection.

Sequence covers QT → PI → SC → CI → PL with PDF style, compact/standard and paper-orientation changes, then repeats the same states.

- Same-state page count: stable
- Same-state product rows: stable
- overflow / semantic violations / clipped nodes: none
- paginationStable: 1
- Result: PASS

## RC16.11-specific assertions

- PDF geometry converts display-space DOMRect values back to logical PDF coordinates under Preview zoom.
- Template shell `scrollHeight/offsetHeight` does not define business-content height.
- Visual grid/min-height wrappers do not force false page breaks.
- Late reflow uses bounded guard + at most two stability repagination passes.
- Final tail rebalance occurs on settled geometry.
- Brand/i18n/formal-output normalization is completed before pagination.
- Non-PDF MutationObservers ignore stable `#piPaper` content.
- `紧凑 / 标准` remain the only user-facing density modes.

## Real Windows acceptance still required

1. Repeatedly switch all five document types and all PDF styles; confirm Preview does not drift in page count or module placement.
2. Compare compact vs standard with 8–20 products and long text fields.
3. Inspect page boundaries around the final product row, Total/Packing Summary, Terms, Logistics and signatures.
4. Test portrait / landscape / auto after several template switches.
5. Export actual PDFs and compare them to Preview for clipping, blank tails, image proportions and summary adjacency.
6. Keep RC16.11 on release/test branch until real Windows acceptance passes.
