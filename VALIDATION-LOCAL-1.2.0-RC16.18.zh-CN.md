# RC16.18 Local Validation

## Release gates
- package / manifest identity: RC16.18
- JS/CJS syntax: PASS required
- HTML local references: PASS required
- retained RC16.10–RC16.17 gates: PASS required
- RC16.18 live-preview snapshot export gate: PASS required
- Protected PDF Core hashes unchanged
- SOURCE/WINDOWS public runtime byte parity required
- ZIP CRC + re-extract SHA parity required
- Windows local HTTP smoke + port fallback required

## WYSIWYG export contract
Preview is the sole pagination/layout authority. Export may rasterize the visible pages, but may not create another layout owner, repaginate, or move content between pages.

The RC16.18 exporter captures live `.pdf-page` elements while Preview generation is frozen. If Preview changes during capture, export must abort rather than produce a PDF that differs from the Preview state approved by the user.

## Real-machine acceptance
On Windows Chrome/Edge, compare right-side Preview against the downloaded PDF for QT/PI/SC/CI/PL, especially CI/PL in landscape and multi-page cases. Confirm identical page count and that every module appears on the same page as in Preview.
