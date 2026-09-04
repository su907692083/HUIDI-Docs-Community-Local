# HUIDI Docs Community Local V1.2.0 RC13

RC13 是 RC12 的发布阻断热修版。RC12 在 Windows 实机验收时发现：顶部“导出 → 正式 PDF”可点击，但底层 canonical `exportPdfBtn` 可能被旧会员运行时晚到刷新重新设为 disabled，导致程序调用 `.click()` 被浏览器静默忽略，表现为“点击无反应”。

## 本轮修复

- Community Local 的 `applyEditorAccessGate()` 在 local-only 模式下强制保持解锁，旧会员刷新不能再次禁用本地保存/导出控件。
- `requestDocumentPdfPermit()` 在 local-only 模式下直接返回本地许可，不再依赖可能被旧运行时重新赋值的 `FlypigBOXMember.requestPdfExport`。
- 顶部本地导出桥在触发 canonical PDF 按钮前再次确保按钮 enabled，并移除 `aria-disabled`。
- 更新 Local bridge / RC11 compatibility layer 的 cache-buster 到 RC13，避免浏览器继续使用旧缓存。
- 不修改 RC9 多页 WYSIWYG PDF 捕获架构，不修改正式输出规则核心。

## 发布建议

RC13 仍按 Pre-release 候选发布。Windows 实机需重点复测：顶部“导出 → 正式 PDF”、底部 canonical“导出 PDF”、两页以上 PDF、打印 / 另存 PDF。
