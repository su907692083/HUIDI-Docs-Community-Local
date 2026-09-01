# Community Local 1.1.0 RC1 门禁报告

## 已通过

- `npm run check`：PASS
- JSON / 配置解析：PASS
- JavaScript `node --check`：PASS
- HTML 本地静态依赖：缺失 0
- 核心页面 CSP：`connect-src 'self'`
- Local network guard：fetch / XHR / WebSocket / EventSource / sendBeacon 均有跨域阻断
- 生产 Supabase Project Ref：0
- `workspace.huidios.com / api.huidios.com / bridge-workspace.huidios.com`：0
- 旧 `flypigbox.xyz` 公开域名：0
- OpenAI / Gemini / DeepSeek / 百炼直接在线 API endpoint：0（本地运行代码，第三方 vendor 源码注释不计）
- 外部 CDN 脚本 / 样式依赖：0
- Admin / AI Gateway / Notification / Founder OS / service runtime：不在 Community Local 运行包
- 用户可见旧 FlypigBOX 品牌：0（历史兼容文件名 / localStorage key 仍保留）
- Windows 一键启动：PowerShell loopback-only 设计，绑定 `127.0.0.1`
- Node 本地 HTTP 冒烟：`/`、workspace、document-start、editor、catalog、privacy、SOURCE、Excel 模板全部 HTTP 200

## 自动浏览器验收说明

当前容器 Chromium 仍受 DBus / zygote 环境限制，20 秒内未能稳定完成 Headless screenshot，因此本报告**不声称**已经完成像素级视觉验收、真实 Windows PowerShell 启动验收或真实断网人工交互验收。

正式公开前建议用 Windows 做最后 8 项：

1. 双击 `START-HUIDI-LOCAL.cmd`，无需管理员权限正常打开。
2. 关闭 Wi‑Fi 后刷新工作台仍能打开。
3. 新建报价单、PI、CI、PL、销售合同。
4. 保存草稿，关闭 / 重开后能恢复。
5. 导出 PDF。
6. 导出表格 / 读取 `.xlsx`。
7. 产品目录导入 Excel 并导出 PDF。
8. DevTools Network 确认没有外部业务请求。
