# HUIDI Docs Community Local V1.2.0 RC6 专项门禁

## 本轮目标

RC6 只收口授权体系，不重写 RC5 的单据编辑器固定页头、业务链、本地数据键和导出运行逻辑。

## 授权结果

- 当前许可：**HUIDI Community Source License 1.0**
- 模式：**Source Available / 源码开放**
- 个人自用：免费
- 自己公司内部使用：免费
- 自己控制的服务器 / NAS / VPS / 私有云 / 内网部署：免费
- 自己公司为内部流程修改代码：免费
- 外贸公司使用 HUIDI 开展自己的正常业务：免费
- 向第三方收费提供软件或围绕 HUIDI 收费获利：需要商业授权
- 商业授权微信：`nuliqingxing8`

需要商业授权的典型场景：收费部署、收费托管、维护、升级、定制、培训、SaaS、OEM、白标、转售、批量客户交付。

## AGPL / 对外定位收口

活动运行页面、README、package.json、RELEASE-MANIFEST、SOURCE、Terms、Editor 当前许可声明中：

- `AGPL-3.0-only`：0
- `GNU AFFERO GENERAL PUBLIC LICENSE`：0
- `LOCAL FIRST · OPEN SOURCE`：0
- 当前首页标识：`LOCAL FIRST · SOURCE AVAILABLE`

`LICENSE-MIGRATION-RC6.zh-CN.md` 中保留历史许可迁移说明，不属于当前许可声明。

## RC5 功能保护门禁

以下核心运行文件 RC5 → RC6 SHA256 保持一致：

- `public/huidi-local-editor-bridge-v120.js`
- `public/huidi-local-rc5.css`
- `public/flypigbox-quick-result.js`
- `public/flypigbox-v3-3-2-5-editor-shell-cleanup.js`
- `public/flypigbox-v3-3-5-0-sync-core.js`
- `public/community-local-mode.js`
- `tools/local-server.cjs`
- `tools/local-server.ps1`

因此 RC6 没有为了换授权体系重新改写 RC5 已收口的 canonical editor toolbar、本地路由桥接和服务器启动链。

## 自动检查

- `npm run check`：PASS
- JS 文件语法扫描：PASS
- HTML 本地依赖：PASS
- Local CSP / network guard：PASS
- 生产 Admin：未进入包
- 生产云残留门禁：PASS
- 核心页面内联 JavaScript：PASS
- Source / Windows `public`：219 / 219，missing 0，extra 0，SHA mismatch 0

## 本地 HTTP Smoke

使用包内 `tools/local-server.cjs`，监听 `127.0.0.1:18765` 验证：

- `/`：200
- `/workspace.html`：200
- `/document-start.html`：200
- `/editor.html?type=quotation&local=1&doc=quotation`：200
- `/catalog-studio/index.html`：200
- `/SOURCE.html`：200
- `/terms.html`：200
- `/refund-policy.html`：200
- `/assets/vendor/html2canvas.min.js`：200
- `/assets/vendor/jspdf.umd.min.js`：200

## 知识产权证据链提醒

已经做可信时间戳的 RC5 SOURCE ZIP 必须保持原样，不要覆盖或修改。RC6 是一个新的独立 ZIP；后续 FINAL 定版后应生成新的 FINAL ZIP，再对该 FINAL ZIP 单独申请时间戳。
