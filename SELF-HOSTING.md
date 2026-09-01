# Self-hosting / 自托管

Community Local 1.1.0 的默认目标是 **本机运行、数据由使用者自己掌握**。

## Windows 本机

双击 `START-HUIDI-LOCAL.cmd`。启动器优先使用 Windows 自带 PowerShell，在 `127.0.0.1:8765` 提供本机静态服务，不要求 Node.js，也不会监听局域网地址。

## 自有服务器或 NAS

`public/` 是完整静态运行目录。你可以使用 Nginx、Caddy、Apache、NAS Web Station 等静态服务器托管它。请自行配置 HTTPS、访问控制、备份和内网权限。

## Cloudflare（可选）

`deploy/cloudflare/wrangler.example.jsonc` 仅作为静态资产部署示例，不包含 HUIDI 的生产域名、数据库、AI Gateway 或商业后台。

## 不属于本地源码开放包的能力

生产 Supabase、HUIDI 云同步、托管 AI、邮件网关、通知协同、Founder OS、商业管理后台和商业授权体系不在 Community Local 中。

## 自托管授权边界

- 自己个人的服务器：免费。
- 自己公司的服务器 / 内网：免费。
- 给其他客户部署并收费：需要商业授权。
- 对外 SaaS / 托管 / OEM / 白标：需要商业授权。

商业授权微信：`nuliqingxing8`。完整条款以 `LICENSE` 为准。
