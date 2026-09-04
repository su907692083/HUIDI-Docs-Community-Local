# HUIDI Docs Community Local V1.2.0 RC16.2

RC16.2 是 RC16.1 的 PDF 回归修复版。

## 根因

RC13 已经在真实 Windows 实机确认可以导出 PDF。对比 RC13 与 RC16.1 后确认：核心 `exportPdf()` 实现完全相同，回归来自 RC15 以后新增的“强制 Gate + continuation”外围链路，而不是 PDF 分页 / html2canvas / jsPDF 核心。

RC16.1 在 Gate 确认后直接调用 `FlypigBOXApp.exportPdf()`，仍未能在目标实机稳定保存文件。因此 RC16.2 不再继续给外围链路叠补丁，而是恢复 RC13 已证明可用的 canonical 导出事件路径。

## 修复

- 导出时先运行 Formal Output Gate 规则检查。
- 只有 blocker 才打开 Gate 并阻止输出。
- warning 为建议核对，不再强制增加第二个确认步骤。
- 可导出时通过 canonical `#exportPdfBtn` 派发原生 MouseEvent，进入既有导出监听器。
- 用户主动在 Gate 点击“确认并继续”时，同样通过 canonical MouseEvent 进入原生导出链；不依赖 disabled element 的 `.click()`，也不直接调用 `exportPdf()`。
- 保持 RC16 多语言、RC15 资料管理、RC11 工作簿与 PDF Protected Core 不变。

## 实机验收

1. 导出 → 正式 PDF：只有 warning 时应直接开始生成，不再弹第二次确认。
2. 存在 blocker 时应打开检查窗口且不能旁路。
3. 主动点击“检查”，在仅有 warning 的窗口中点击“确认并继续”，应立即进入 PDF 捕获和保存。
4. 两页以上 PDF 页数与右侧预览一致。
