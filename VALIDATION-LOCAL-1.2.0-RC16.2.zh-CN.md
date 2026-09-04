# HUIDI Docs Community Local V1.2.0 RC16.2 验证记录

## 回归基准

- RC13：用户 Windows 实机确认 PDF 可导出。
- RC16.1：Formal Output Gate 正常，但确认后实机仍不能导出。
- 静态函数比对：RC13 与 RC16.1 的核心 `exportPdf()` SHA256 完全一致，因此本轮只修外围入口/继续链，不修改 PDF 核心。

## RC16.2 门禁

- local export 只有 blocker 才调用 Formal Output Gate。
- warnings 直接进入 canonical PDF event path。
- Gate continue 通过 synchronous `dispatchEvent(new MouseEvent('click'))` 触发 canonical 导出按钮。
- continuation 不允许直接调用 `FlypigBOXApp.exportPdf()`。
- canonical 按钮在派发前强制解除 `disabled / aria-disabled`。
- RC16 多语言门禁继续执行。
- Protected PDF Core SHA256 必须保持 RC16.1 不变。
- SOURCE / WINDOWS public tree 必须逐文件一致。
- ZIP CRC / 重解压 SHA / 最终 `npm run check` 必须通过。

## 仍需 Windows 实机

沙盒 Chromium 受本地地址访问策略限制，因此最终文件下载行为仍需普通 Windows Edge / Chrome 实机确认。
