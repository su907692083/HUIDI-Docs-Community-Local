# Self-hosting / 自托管

HUIDI Docs Community Local 默认目标是本机运行、数据由使用者自己掌握。

## Windows 本机
双击 `START-HUIDI-LOCAL.cmd`。启动器优先使用 Windows PowerShell，并只监听 loopback 地址。

## 自有服务器或 NAS
核心页面位于 `public/`，可由 Nginx、Caddy、Apache 或 NAS Web 服务托管。若需要飞书 Sheets / Bitable 读取能力，还需要同时运行本包的本地 Companion Server（`tools/local-server.cjs`）或提供等效的同源 `/api/feishu/*` 服务。请自行配置 HTTPS、访问控制和备份。

## 授权边界
个人和自己组织内部使用按当前 LICENSE 执行；向第三方收费部署、SaaS、OEM/白标等需取得商业授权。
