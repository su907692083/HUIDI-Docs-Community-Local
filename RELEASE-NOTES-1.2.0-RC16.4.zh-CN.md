# HUIDI Docs Community Local V1.2.0 RC16.4

RC16.4 是多语言一致性回归修复版，针对 RC16.3 在 PDF 与表格工作簿中仍出现中英混排的问题。

## 本轮修复

- PDF 补充分栏、买卖方标题、报价条款、关联参考、自定义字段统一读取 `HUIDIDocI18n`。
- 结构化 Schema 的字段名与固定下拉值不再只支持中/英/中英三种语言。
- 表格工作簿标题、Status、Scenario 与后期结构化字段跟随当前单据语言。
- 五大单据标题由 canonical document-type + language 解析，不再依赖英文标题。
- 新增固定表面 harmonizer，仅处理已知固定标签，不翻译用户输入内容。
- 保持 B/L、AWB、CMR、ETD、ETA、ISO、VAT、EORI、币种等贸易技术标识。
- PDF 生成核心与 RC16.3 direct local exporter 未改动。

## 语言范围

中文、English、中英双语、Español、Português、Deutsch、Français、Italiano、Русский、العربية、日本語、한국어、Türkçe、Nederlands、Polski、Tiếng Việt、Bahasa Indonesia、ไทย。

> RC16.4 恢复的是固定单据结构本地化；用户自行填写的商品描述、备注、合同自由文本不会被伪造翻译。
