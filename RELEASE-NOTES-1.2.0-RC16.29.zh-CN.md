# HUIDI Docs Community Local V1.2.0 RC16.29

主题：**Catalog Connectivity Closure / Product Master Data Reuse / Local Image Continuity**

RC16.29 是一个 **产品目录连通收口版本**。它不是重新发明一套商品目录，而是把已经在商品资料库里录过的图片和外贸字段真正继续用起来。

如果你之前遇到过：

> 商品资料里明明上传了图片，进入产品目录以后却没有图；规格、包装或报关资料又要重新补。

这就是本轮重点解决的问题。

## 这次具体修了什么

### 1. 商品本机图片真正连通到产品目录

工作台上传的本机商品图片会以 `data:image/...` 形式保存在本机。旧 Catalog Studio 只把 `http/https` 当成可用图片，因此本机图片会在桥接时被过滤。

RC16.29 现在同时支持：

- `data:image/...` 本机商品图片；
- `http/https` 网络商品图片。

本机图片进入 Catalog 后直接视为可用，不再等待网络抓取。

### 2. 商品资料只建一次，目录继续复用

Catalog Studio 继续读取 canonical 商品主数据，并扩大可复用字段：商品名称、SKU / 型号、参考价格、规格、MOQ、HS Code、报关品名、原产国、供应商、包装类型、外箱尺寸、装箱数、N.W.、G.W.、CBM、Shipping Marks。

用户不应该为了制作一个产品目录，再维护第二套商品资料。

### 3. 删除产品目录页重复流程

旧 Catalog Closure 会额外注入一次“目录制作流程 → 返回工作台”，导致页面同时出现两套相同说明。

RC16.29 删除这套重复注入：

- 页面顶部只保留唯一的制作流程；
- Community Local 只保留一个明确的返回入口；
- 减少首屏重复文案和空间浪费。

### 4. 新增 Catalog Connectivity Gate

新增 `validate-catalog-connectivity-rc1629.cjs`，不只检查源码里有没有相关字符串，而是动态执行图片 URL helper，验证：

- `data:image` 不会再被过滤；
- `http/https` 不会回退；
- 目录桥接仍然从 canonical 商品数据读取资料。

## RC16.29 完整版本还包含什么？

如果你是第一次看到 HUIDI Docs，RC16.29 当前完整版本已经包含：

- 客户、询盘 / 订单、商品、单据工作台；
- Quotation、PI、Sales Contract、CI、Packing List 五类正式单据；
- 表格工作簿预览、客户版 Excel、数据版 Excel、CSV；
- 五套统一 PDF 风格；
- 自定义品牌主色、Logo、签名、公章；
- A4 横版 / 竖版、紧凑 / 标准排版；
- 18 种文档语言模式；
- 内部工厂执行；
- 内部核价、毛利率与建议售价；
- 内部 XLSX / PDF；
- 产品目录；
- 飞书 Sheets / Bitable 可选数据源；
- 邮件草稿；
- 本地 JSON 备份 / 恢复；
- 正式 PDF 输出检查与多页分页稳定层。

这些能力是 RC6 → RC16.29 多轮迭代累积下来的，不应全部理解为 RC16.29 单次新增。

完整能力说明：[`FEATURES-RC16.29.zh-CN.md`](./FEATURES-RC16.29.zh-CN.md)

## 保留的关键稳定层

- RC16.28 Table-first Workspace Interaction Closure；
- RC16.27 Single Shell Boot；
- 飞书资料与主数据能力；
- RC16.12 五套统一 Template Family；
- RC16.11+ PDF 几何与分页稳定层；
- Protected PDF Core / Formal Output Gate 不修改。

## 发布校验

RC16.29 正式候选包 SHA256：

- WINDOWS: `61ac9f99ba6fb7500b19662add6434008a0ac27343be6b69801f1df23a9fbe72`
- SOURCE: `94f1b4e88f25ba23a0749ad3a7dfc3744b3fdbb9b66dadb62c3a8ed6b2c83106`

详细包验证请以对应 RC16.29 `PACKAGE-VERIFY` 与 `SHA256SUMS` 为准。
