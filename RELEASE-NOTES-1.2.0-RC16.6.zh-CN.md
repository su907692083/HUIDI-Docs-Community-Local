# HUIDI Docs Community Local V1.2.0 RC16.6

## 定位

RC16.6 是 RC16.5 之后的发布前精修版本，聚焦三件事：

1. 商品明细 PDF 的专业排版与分页利用率；
2. 目标语言正式预览的单语言纯净度；
3. 在“备份与迁移”中恢复可选的在线飞书云文档协作同步。

本版本不加入离线翻译，不修改 RC9/RC13 已稳定的 PDF 捕获 / jsPDF 核心。

## 主要更新

### 1. 商品明细 PDF

- 报价单 / PI / 销售合同商品表改用显式 colgroup。
- 缩窄序号、图片、数量、单位列，扩大“商品与规格”主列。
- 商品内容按“商品名称 → SKU / HS Code 元信息 → 规格说明”分层显示。
- 商品图片尺寸与表格行高收紧，减少无意义纵向占用。
- 分页复制表格时同步复制 colgroup，避免第 2 页列宽漂移。

### 2. 短表分页

- 移除“所有 ≤ 4 行表格都强制整块换页”的全局规则。
- 商品小表、签字区等真正原子块继续保护。
- Quotation Basis / Terms / Logistics / References 等普通短表允许按完整行填充当前页剩余空间。
- 目标：减少“第一页留大块空白、第二页只有 3–4 行内容”的情况。

### 3. 单语言正式输出收口

- 报价单的“单据编号”和“客户参考号”不再复用同一个 Quotation No. 译名。
- 日语报价单：`見積番号` 与 `顧客参照番号` 分开显示。
- 商品行旧的 `SKU / 货号` 在目标单语言模式中归一为 `SKU`。
- 补充信息、补充字段、附加费用、Excluded from total 等固定文案接入统一 i18n resolver。
- 继续允许 USD / PCS / SKU / HS Code / VAT / EORI / ETD / ETA / B/L / Incoterms® 等国际标准标识保留原形式。
- 用户自己填写的商品名、规格、备注、条款正文仍保持原文；RC16.6 不冒充机器翻译。

### 4. 飞书云文档协作同步（可选、在线）

“备份与迁移”新增独立的“在线迁移与协作 · 可选”区域：

- 配置飞书自建应用 App ID / App Secret；
- 测试连接；
- 主动同步业务协作快照；
- 打开已同步飞书文档。

安全边界：

- 浏览器只访问同源 `/api/feishu/*`；
- Node / PowerShell 本机 Companion Server 才访问 `open.feishu.cn`；
- App Secret 只写入 `config/feishu.local.json`；
- 真实配置文件已加入 `.gitignore`，不会进入 Source / Windows 发布包；
- 飞书只接收客户、商品、询盘/订单、本地单据的文字索引与协作摘要；
- 不同步商品图片、签名、公章、银行账号、完整 JSON Backup 或 App Secret；
- 完整 JSON Backup 仍是换电脑和灾难恢复的正式备份。

## 保护项

以下 PDF 核心文件未修改：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
  - SHA256 `abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`
  - SHA256 `570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583`

## 尚需 Windows 实机验收

- 3 个以上商品的报价单 / PI / 销售合同 PDF 视觉；
- 1 页 → 2 页分页时 Quotation Basis / Terms 是否正确利用剩余空间；
- 日本語 / 한국어 / Español 等目标语言正式预览是否还有系统固定双语残留；
- Windows Edge / Chrome 正式 PDF 实际落盘；
- 使用用户自己的飞书自建应用完成“测试连接 → 首次创建文档 → 再次追加快照”。
