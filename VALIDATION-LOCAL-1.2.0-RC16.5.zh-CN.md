# RC16.5 Validation

## 自动门禁

- npm run check
- JS/CJS syntax
- HTML local references
- CSP / local network guard
- production cloud/admin exclusion
- IndexedDB documents/assets/migration contract
- single SaveCoordinator contract
- single PDF executor contract
- INTERNAL REVIEW customer-output exclusion
- 65 structured field multilingual coverage
- 33 structured select multilingual coverage
- Korean/Japanese screenshot regression terms
- protected PDF core SHA check

## Windows 实机仍需验收

1. 从 RC16.4 有历史单据的浏览器升级，确认旧单据可继续打开；
2. 使用多张本机图片反复保存，不出现 localStorage quota；
3. 故意触发保存失败时界面不得显示“保存完成”；
4. Quotation / PI / Contract / CI / PL 正式 PDF 实际落盘；
5. 正式 PDF 不含 INTERNAL REVIEW；
6. 韩语 / 日语 / 西语 PDF + 表格工作簿固定标签一致。
