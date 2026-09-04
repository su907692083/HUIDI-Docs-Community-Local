# HUIDI Docs Community Local V1.2.0 RC16

## 定位

Multilingual Restoration & Release Closure。

本轮不扩展云端 AI，不修改 Protected PDF Core，不修改 RC11 工作簿核心。目标是恢复项目早期已经存在、但被后续三语言白名单隐藏的正式单据多语言固定字段能力。

## 恢复内容

- 正式 PDF 固定标题、字段名、表头支持 17 种单语 + 中英双语。
- 支持：中文、English、Español、Português (Brasil)、Deutsch、Français、Italiano、Русский、العربية、日本語、한국어、Türkçe、Nederlands、Polski、Tiếng Việt、Bahasa Indonesia、ไทย。
- Quotation / PI / Commercial Invoice / Sales Contract / Packing List 五类正式单据标题使用项目内既有历史词典。
- 客户常用语言、智能录入手动输出语言、一键准备单据语言入口同步扩展。
- 阿拉伯语保留既有 RTL 文档方向。

## 重要边界

RC16 恢复的是“固定单据本地化”，不是离线 AI 翻译器。

- 固定标题、固定字段名、固定表头：本地历史词典输出。
- 商品名、规格、备注、付款条款、物流说明等用户业务内容：未提供目标语言译文时保持原文。
- 导出前可以提示业务内容待人工核对，但不会冒充已完成翻译。

## 回归修复

- 移除 editor.html 的三语言白名单。
- 统一编辑器 LANG / LANGUAGE 状态恢复完整语言集合。
- 修复统一编辑器对西语、法语、日语等标题强制回写英文的问题。
- 修复旧 Pilot 以英文标题作为唯一单据类型判据的问题，改用 canonical document type。

## Protected Paths

以下 PDF 核心继续冻结：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`
