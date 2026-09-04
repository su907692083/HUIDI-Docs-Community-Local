# HUIDI Docs Community Local V1.2.0 RC16 验证记录

## 本轮范围

RC15 → RC16：恢复历史多语言固定单据输出链，不引入云端翻译依赖。

## 已验证

- `npm run check` 通过；
- 外部 JS/CJS 语法检查通过；
- `editor.html` 63 个内联 script 语法逐块通过；
- HTML 本地资源引用通过；
- CSP / local-only 网络守卫通过；
- 生产 Admin / Cloud / 生产域名与凭据特征排除通过；
- 17 个单语言代码 + 中英双语均进入 editor 正式输出白名单；
- 五大正式单据标题对 17 个单语言均存在历史词典值；
- 当前 PDF 渲染实际调用的 121 个 `docLabel()` 固定标签，在 17 个单语言下均能解析到非空值；
- 后期新增复合标题优先复用项目既有 canonical 多语言核心词典；B/L、ETD、ETA、Container No. 等国际通用技术标识保留标准缩写；
- 阿拉伯语既有 RTL 逻辑保留；
- 旧 Pilot 不再以英文标题作为唯一单据类型判据；
- RC13 local-only PDF 权限修复保留；
- RC15 More 抽屉 / Formal Output Gate 入口修复保留；
- Protected PDF Core SHA256 未变化。

## 明确边界

RC16 的多语言是“固定单据本地化”，不是离线 AI 翻译器。商品名称、规格、备注、付款条款、物流说明等用户业务内容未提供目标语言译文时保持原文，并由导出前核对提示人工确认。

## Protected PDF Core

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
  - SHA256 `abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`
  - SHA256 `570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583`

## 仍需 Windows 实机验收

沙盒 Chromium 受组织策略限制，无法访问 `127.0.0.1` 页面，因此不宣称完成真实 GUI 验收。实机重点验证：

1. 选择 Español / Français / 日本語 等后，右侧五大单据标题与固定字段立即切换；
2. 选择 العربية 后，右侧预览启用 RTL；
3. 切换回中文 / English / 中英双语不丢状态；
4. 导出 → 正式 PDF 仍可用；
5. `•••` 抽屉仍正常显示资料管理区；
6. 2+ 页 PDF 与工作簿 Fit width / Whole page / +/- / More sheets 无回归。
