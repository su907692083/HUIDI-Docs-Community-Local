# 本地网络策略 — Community Local V1.2

目标：HUIDI 本地版不要求把客户、商品、报价和合同资料交给 HUIDI 生产服务器。

默认行为：

- 关键页面 CSP 的 `connect-src` 限制为 `'self'`。
- 不依赖外部 JavaScript / CSS CDN。
- `community-local-mode.js` 拦截跨域 `fetch`、XHR、WebSocket、EventSource 与 sendBeacon。
- 生产 Supabase Project Ref、生产域名和生产 API 不进入本包。

## 用户主动联网的例外

本地优先不等于“浏览器被物理断网”。如果用户主动使用以下能力，浏览器会访问对应外部地址：

- 商品的网络图片 URL；
- 产品来源网页或视频链接；
- Gmail、Outlook、QQ 邮箱等外部网站。

网络图片通过浏览器 `<img>` 直接读取，不通过 HUIDI API 中转。页面会明确标注“外链需网”。如希望完全断网，商品图片请使用“上传本机图片”。

本策略不能替代操作系统安全、磁盘加密、浏览器扩展安全和物理访问控制。
