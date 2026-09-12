# Self-hosting / 自托管

HUIDI Docs Community Local 默认目标是本机运行、数据由使用者自己掌握。HUIDI Online 也可以部署到自己的 Windows/Linux 服务器，不要求 Railway。

## Community Local：Windows 本机

双击 `START-HUIDI-LOCAL.cmd`。启动器优先使用 Windows PowerShell，并只监听 loopback 地址。

## HUIDI Online：Windows 服务器

用于已有 Windows 云服务器、办公室服务器或 NAS 上的 Windows 虚拟机：

1. 保持完整仓库目录，不要只复制 `public/`。
2. 进入 `online/`，首次双击 `START-HUIDI-SERVER.cmd`。
3. 第一次运行会生成 `online/.env.server` 后安全退出；编辑该文件，至少填写：
   - `HUIDI_SECRET_KEY`（长期稳定的随机值）
   - `HUIDI_OWNER_EMAIL`
   - `HUIDI_OWNER_PASSWORD`（至少 8 位）
   - 配好域名/HTTPS 后建议填写 `HUIDI_PUBLIC_BASE_URL=https://你的域名`
4. 再次运行 `START-HUIDI-SERVER.cmd`。
5. 服务监听 `0.0.0.0:8080`，请使用 Nginx/Caddy/Windows 反向代理把 HTTPS 域名转发到 `127.0.0.1:8080`；不要直接把 8080 当作公网 HTTPS 服务。

服务器启动器会强制这些安全/持久化边界：

- `APP_ENV=production`
- `HUIDI_TEAM_ACCESS=1`
- `HUIDI_SIGNUP_ENABLED=0`
- `HUIDI_COMMUNITY_SURFACE=1`
- 主 SQLite：`online/server-data/huidi-online.db`
- 多公司 SQLite：自动位于同一个 `server-data` 数据树
- 业务备份：`online/server-data/backups/`
- `HUIDI_SECRET_KEY`：保存在 gitignored 的 `online/.env.server`，升级/迁移时必须保留

因此升级源码时不要删除 `online/server-data/`。

## HUIDI Online：Docker Compose

仓库根目录提供 `docker-compose.online.yml`。先建立仅本机保存、不会提交 Git 的配置：

```bash
cp online/.env.example online/.env.server
```

至少设置 `HUIDI_SECRET_KEY`、`HUIDI_OWNER_EMAIL` 与 `HUIDI_OWNER_PASSWORD`；`HUIDI_SECRET_KEY` 必须使用长期稳定的随机值，不能每次重建容器都变化。然后运行：

```bash
docker compose -f docker-compose.online.yml up -d --build
```

Compose 默认：

- 容器端口：`8080`
- 主数据库：`/data/huidi-online.db`
- 备份：`/data/backups`
- 宿主持久化目录：`.huidi-online-data/`
- 健康检查：`GET /api/health`
- 团队登录：开启
- 公共注册：关闭
- 当前融合工作台：开启

生产公网访问仍建议由 Nginx/Caddy/Cloudflare Tunnel 等 HTTPS 入口反代到本机 8080。

## 数据与密钥

以下内容是运行数据或凭据，不属于源码，已经在 `.gitignore` 中排除：

- `online/.env`
- `online/.env.server`
- Online SQLite 与 tenant 数据库
- `online/server-data/`
- `.huidi-online-data/`
- 本地生成的 HUIDI secret/dependency marker

服务器迁移或灾备至少应同时保存：

1. 数据目录；
2. `.env.server`；
3. 稳定的 `HUIDI_SECRET_KEY`（保存在 `.env.server` 中）；
4. 对应源码 Commit/Tree 与 SHA256。

## Community Local 静态托管

仅 Community Local 的 `public/` 可以由 Nginx、Caddy、Apache 或 NAS Web 服务静态托管。HUIDI Online 带 FastAPI、数据库、登录、邮件和联网 Provider，不能只上传 `public/` 代替服务端。

## 授权边界

个人和自己组织内部使用按当前 LICENSE 执行；向第三方收费部署、SaaS、OEM/白标等需取得商业授权。
