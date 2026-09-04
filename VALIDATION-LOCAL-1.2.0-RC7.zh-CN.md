# HUIDI Docs Community Local V1.2.0 RC7 专项门禁

## 本轮问题来源

RC6 实机截图暴露出四类问题：单据类型 URL `type` / `doc` 不一致、导出校验重复、PI/合同收款资料入口过深，以及 PDF 离屏捕获存在 overflow 裁切风险。

## 已完成静态门禁

- `npm run check`：PASS
- 修改 JS `node --check`：PASS
- HTML 本地引用检查：PASS
- Community Local CSP / 本地网络守卫：PASS
- admin / production cloud surface 排除：PASS
- RC6 → RC7 改动限定在编辑器状态、输出门禁、PDF 捕获与版本说明，不修改本地数据 key。

## 关键断言

- `applyDocumentProfile()` 同时写入 URL `type` 与 `doc`。
- Local bridge 当前类型优先采用 `#documentType`，URL 不一致时以有效 `doc` 修复陈旧 `type`。
- “下一步”优先调用 `FlypigBOXDocumentLinkage.convertPayload()`。
- PDF / XLSX / CSV / print 的 Local 正式输出由 `FlypigBOXFormalOutputGate` 统一接管；旧 sync-core / TradeFactory 不再重复拦截。
- PI / 销售合同出现顶部“收款资料”直达入口；其它单据隐藏该入口。
- 收款资料完整性仅在 PI / 销售合同明确启用并已部分填写时成为正式输出阻断。
- PDF capture 使用 `scrollWidth / scrollHeight` 与 `overflow: visible`，避免 html2canvas 对最后行、右边缘和页尾静默裁切。

## 沙盒限制

当前容器的 Chromium 对本地运行页返回 `ERR_BLOCKED_BY_ADMINISTRATOR`，因此无法把沙盒浏览器结果冒充 Windows 实机视觉验收。正式公开替换 RC6 前，仍应在 Windows Edge / Chrome 用脱敏资料完成一次连续实机链：报价 → PI → 合同 → CI → PL → PDF/XLSX/CSV。
