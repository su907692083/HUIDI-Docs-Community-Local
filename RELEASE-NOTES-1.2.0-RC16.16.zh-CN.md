# HUIDI Docs Community Local V1.2.0 RC16.16

主题：**Advisory Export + Responsive Export Pipeline**

## 目标

- 所有客户输出都允许用户随时导出：PDF、客户版 Excel、数据版 Excel、CSV、打印/另存 PDF。
- 必填项、HS Code、贸易术语、收款资料、翻译、Readiness 等只做提醒与定位，不再成为导出阻断条件。
- 保留“检查 / 去补充 / 定位修改”，但用户始终可以选择“仍然导出当前版本”。
- 修复 PDF 导出期间 Chrome 转圈/页面无响应：单一导出 owner、防重复任务、自适应画布倍率、分页间主动 yield、异步 JPEG Blob/Uint8Array，移除高成本同步 Base64 编码。

## 保留能力

RC16.10–RC16.15 的紧凑/标准、统一模板、Page Composer、Clip-aware pagination、Issue Navigator 和 First Paint/Runtime Stability 均继续保留。
