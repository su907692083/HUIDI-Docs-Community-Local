# HUIDI Docs Community Local V1.2.0 RC13 验证记录

- [x] 基线：RC12 原包，不从旧 RC6 / 旧 DOM 回拼。
- [x] 仅修复 Community Local 权限 / PDF 许可竞态与发布版本标识。
- [x] `npm run check`。
- [x] 全量 JS/CJS 语法检查。
- [x] HTML 本地引用检查。
- [x] local-only 网络 / 生产私有服务隔离检查。
- [x] SOURCE / WINDOWS `public` 运行树逐文件 SHA256 一致。
- [x] ZIP CRC / 重解压完整性。
- [x] Protected PDF core SHA256 与 RC12 保持一致。
- [x] 静态契约：local-only 下 `applyEditorAccessGate(true)` 不得锁住导出；`requestDocumentPdfPermit()` 必须直接允许本地 PDF；顶部 local export 触发前必须解除 canonical 按钮 disabled。
- [ ] Windows Edge / Chrome 实机点击链终验。

## Protected PDF core

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`

RC13 不改变 RC9 起建立的多页 PDF 所见即所得捕获与页数一致性契约。
