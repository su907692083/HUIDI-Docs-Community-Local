# HUIDI Docs Community Local V1.2.0 RC16.1

RC16.1 是 RC16 的 PDF 发布阻断热修版。Windows 实机发现：Formal Output Gate 可以正常完成检查并显示“正式 PDF 可以继续生成”，但点击“确认并继续”后没有进入最终 PDF 文件生成。

## 修复

- 根因：Formal Output Gate 的继续动作仍通过再次 `click()` canonical `#exportPdfBtn` 恢复导出；在历史兼容监听器较多的编辑器中，这次二次模拟点击仍可能被其他事件层吞掉。
- Community Local 现在暴露唯一的 `FlypigBOXApp.exportPdf()` 本地执行器，并由 RC16.1 continuation 层在 Formal Output Gate 确认后直接调用。
- 确认前重新执行 Formal Output Gate 规则校验；存在 blocker 时不会旁路。
- local-only PDF permit、RC16 多语言、RC15 资料管理抽屉和 RC11 工作簿均保留。
- 不修改分页算法、页面冻结、html2canvas、jsPDF 生成逻辑。
- 两份 Protected PDF Core 文件保持 RC16 SHA256 不变。

## 发布状态

RC16.1 仍是候选版。必须在真实 Windows Edge / Chrome 验证：

1. 导出 → 正式 PDF；
2. Gate 显示警告后点击“确认并继续”；
3. 页面立即进入“正在生成 PDF”状态并最终下载文件；
4. 两页以上单据页数与右侧预览一致。
