# HUIDI Docs Community Local V1.2.0 RC16.6.1 — Release Notes

## 定位

RC16.6.1 是 RC16.6 的 Windows 启动器 P0 热修版。业务编辑器、PDF 商品布局、多语言、IndexedDB、本地备份和飞书协作能力不扩展；只修复 Windows 双击启动时红字黑窗一闪而过的问题。

## 修复

- `tools/local-server.ps1` 改为 UTF-8 BOM + CRLF，确保 Windows PowerShell 5.1 在中文 Windows 上按 UTF-8 正确解析非 ASCII 文本。
- PowerShell 本地服务器改用更保守的 Windows PowerShell 5.1 兼容语法。
- 8765 被旧版本/其他程序占用时，PowerShell 自动尝试 8766–8775，不再直接红字退出。
- Node fallback 同样支持 8765–8775 自动端口回退，并在 Windows 上自动打开实际监听地址。
- `START-HUIDI-LOCAL.cmd` 增加 PowerShell → Node → Python fallback。
- 所有启动路径失败时窗口保持打开，并输出 `logs/launcher-last.log`，不再闪退丢失错误。
- Python 仅作为最后静态 fallback；该路径不提供飞书本机 API，但可保证本地静态工作台仍能打开。

## 未改动

- RC16.6 商品 PDF 列宽和分页逻辑。
- RC16.6 单语言正式预览收口。
- RC16.6 飞书浏览器桥与 API 语义。
- RC16.5 IndexedDB / Save Coordinator。
- Protected PDF Core。
