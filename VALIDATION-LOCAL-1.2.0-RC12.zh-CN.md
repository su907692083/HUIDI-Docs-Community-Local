# HUIDI Docs Community Local V1.2.0 RC12 验证记录

## 发布收口门禁

- [x] 从 RC11 原包建立 RC12，未从旧 RC6 / 旧 DOM 回拼。
- [x] RC11 Windows / Source 原始 SHA256 已独立复核。
- [x] `npm run check`。
- [x] JavaScript 语法与 HTML 本地引用检查。
- [x] local CSP / network guard。
- [x] admin / production cloud surface 排除。
- [x] SOURCE / WINDOWS `public` 运行树逐文件一致。
- [x] Node 本地 loopback server 启动与关键路由 HTTP 200。
- [x] RC12 公开版本号一致性检查。
- [x] GitHub Actions / Issue / PR 模板静态检查。
- [x] ZIP 完整性与 SHA256。

## Protected PDF Core

RC12 不修改：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`

## 仍需真实 Windows 人工验收

静态和本地 HTTP 门禁不能替代真实 Edge / Chrome 的视觉交互验收。公开发布后仍建议使用脱敏业务资料复核：工作簿 100% 缩放、字段定位、更多工作表、两页以上 PDF。
