# 本地网络策略 — Community Local V1.2

目标：HUIDI 本地版不要求把客户、商品、报价和合同资料交给 HUIDI 生产服务器。

默认行为：

- 关键页面 CSP 的 `connect-src` 限制为 `'self'`。
- 不依赖外部 JavaScript / CSS CDN。
- `community-local-mode.js` 拦截浏览器页面主动跨域 `fetch`、XHR、WebSocket、EventSource 与 sendBeacon。
- 生产 Supabase Project Ref、生产域名和生产 API 不进入本包。
- 浏览器里的 App Secret、生产 Token 和 HUIDI 私有云凭据均不作为 Community Local 能力。

## 用户主动联网的例外

本地优先不等于“所有网络能力都被删除”。只有用户主动使用时，以下功能会联网：

- 商品的网络图片 URL；
- 产品来源网页或视频链接；
- Gmail、Outlook、QQ 邮箱等外部网站；
- **可选飞书云文档协作同步（RC16.6.4）**。

飞书同步的浏览器页面仍只请求 `127.0.0.1` 同源 `/api/feishu/*`。真正连接 `open.feishu.cn` 的是本机 Companion Server，而且只在用户点击“测试连接 / 同步协作快照”时发生。用户自己的 App ID / App Secret 保存在软件目录的 `config/feishu.local.json`，该文件被 `.gitignore` 排除，不进入 `public`、浏览器 localStorage、完整 JSON 备份或公开发布源码。

飞书是**协作副本**，不是本地完整备份。完整恢复与换电脑迁移仍以“完整 JSON 备份”为准。

网络图片通过浏览器 `<img>` 直接读取，不通过 HUIDI API 中转。页面会明确标注“外链需网”。如希望完全断网，商品图片请使用“上传本机图片”，并不要启用飞书同步。

本策略不能替代操作系统安全、磁盘加密、浏览器扩展安全和物理访问控制。
