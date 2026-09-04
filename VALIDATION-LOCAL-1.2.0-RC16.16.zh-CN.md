# RC16.16 Validation

- 输出完整性检查为 advisory-only，不阻止 PDF/XLSX/CSV/print。
- 新 `huidi-output-advisory-rc1616.js` 在 window capture 层成为本地输出单一入口。
- protected Formal Output Gate 保留原文件与规则检查能力，仅作为“检查/提醒”表面。
- PDF 捕获不再固定 scale=2，也不再使用同步 `canvas.toDataURL()` 作为页图编码路径。
- 同一次 PDF 导出具有 busy guard，重复点击不启动第二任务。
- Excel/CSV 空白或不完整资料允许导出，仅显示提醒。
- RC16.10–RC16.15 retained gates 必须继续通过。
