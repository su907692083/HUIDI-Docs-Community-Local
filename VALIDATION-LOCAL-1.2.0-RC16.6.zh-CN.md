# HUIDI Docs Community Local V1.2.0 RC16.6 — Validation

## 静态与包体门禁

- `npm run check`：PASS
- 全 public JavaScript 语法：PASS
- HTML 本地资源引用：PASS
- Community Local CSP / same-origin guard：PASS
- 生产 Supabase / HUIDI 私有 Cloud / Admin：未带入
- Source / Windows `public` 运行树：要求逐文件 SHA256 完全一致
- ZIP CRC：要求 PASS
- ZIP 重解压文件树：要求 0 missing / 0 extra / 0 SHA mismatch

## RC16.6 专项门禁

### 商品 / 分页

- `productColgroup()` 存在并用于报价单 / PI / 销售合同商品表。
- 报价商品表有图 / 有金额列宽契约：`[5,9,40,8,8,14,16]`。
- 分页克隆会复制 `colgroup`。
- 全局 `if(rows.length<=4)` 短表整块换页规则已删除。
- Terms / Logistics 普通短表允许按完整 row 拆页。

### 多语言纯净度

- 报价单第二参考字段使用 `Customer Reference`，不再重复 `Quotation No.`。
- `Supplementary Info` / `Additional Field` / `SKU` / 附加费用 / `Excluded from total` 已进入 canonical fixed-term i18n。
- 客户 PDF 不再主动生成 `<b>SKU / 货号</b>`。
- 现有 RC16.4/RC16.5 的 17 种单语 + 中英双语语言源继续保留。

### 飞书

- 浏览器桥仅调用：
  - `GET /api/feishu/status`
  - `POST /api/feishu/config`
  - `POST /api/feishu/test`
  - `POST /api/feishu/sync`
- Node 与 PowerShell 本机服务器同时实现四个 API。
- 浏览器 runtime 不直接包含 `open.feishu.cn` 请求。
- `config/feishu.local.json` 不得进入发布包。
- `config/feishu.local.example.json` 必须存在。
- App Secret 不通过 status API 返回浏览器。
- 本机 Node smoke：未配置时 `/api/feishu/status` 返回 `configured:false`。
- 配置接口 smoke 使用虚拟凭证验证：status 只返回 App ID / mask，不返回 Secret。
- 真实飞书云端写入：因无用户凭证，不在沙盒宣称 PASS，需 Windows 实机自行验收。

## Protected PDF Core

- `flypigbox-v3-3-2-3-pdf-flow-fix.js`
  - `abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36`
- `flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`
  - `570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583`

## 浏览器验收边界

当前沙盒 Chromium 对 `127.0.0.1` 仍会返回管理员策略阻断，因此不能把沙盒截图冒充 Windows Edge/Chrome 最终验收。RC16.6 仍需真实 Windows 浏览器确认 PDF 视觉、PDF 实际落盘与飞书真实写入。
