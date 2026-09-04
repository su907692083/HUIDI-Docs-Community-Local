# HUIDI Docs Community Local V1.2.0 RC16.1 验证记录

## 本轮发布阻断问题

RC16 Windows 实机：Formal Output Gate 正常显示，但“确认并继续”后未进入最终 PDF 生成。

## 代码修复门禁

- `FlypigBOXApp.exportPdf` 直接执行器已暴露。
- `huidi-local-pdf-continuation-rc161.js` 仅在 Community Local 启用。
- continuation 在执行前重新调用 `FlypigBOXFormalOutputGate.check('pdf')`；blocker 非空时不直接导出。
- continuation 使用 capture 层接管 Gate 的继续按钮，避免原有二次模拟点击路径。
- local PDF state 在直接执行期间临时批准并在结束后回收。
- Protected PDF Core 不改动。

## 仍需 Windows 实机验证

由于当前沙盒 Chromium 管理策略阻止访问 `127.0.0.1`，最终下载行为必须在普通 Windows Edge / Chrome 实机确认。
