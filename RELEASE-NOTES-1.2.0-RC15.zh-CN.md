# HUIDI Docs Community Local V1.2.0 RC15

## 定位

RC14 发布阻断回归修复版。只修 More 抽屉挂载与 Community Local PDF 入口确定性，不扩业务功能，不修改 Protected PDF Core 与 RC11 工作簿核心。

## 修复

- 修复 `•••` 抽屉正文被旧 `fp-v3341-hide-legacy` 逻辑重新隐藏的问题。
- More 资料管理中心增加 class / drawer 生命周期保护，抽屉创建、打开和旧脚本重跑后均自动恢复。
- 顶部导出入口改为 window capture 级本地路由，避免 toolbar DOM 重建后事件丢失。
- 正式 PDF 从顶部入口直接打开统一 Formal Output Gate；有阻断项时明确展示问题，无阻断项时可确认继续，不再静默无响应。
- canonical `#exportPdfBtn` 继续强制解除 legacy disabled / aria-disabled 状态。

## 冻结范围

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`
- RC11 工作簿 Fit width / Whole page / +/- / More sheet / 字段定位能力
