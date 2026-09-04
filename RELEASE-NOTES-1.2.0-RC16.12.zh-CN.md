# HUIDI Docs Community Local V1.2.0 RC16.12

主题：**Unified PDF Template Family / 统一 PDF 模板家族**

## 解决的问题

RC16.11 已经收住分页几何与切换稳定性，但同一个 PDF 样式在 QT、PI、销售合同、CI、装箱单中仍由不同 renderer 分支解释，导致“正式合同”在不同单据里出现不同的模块顺序、颜色、卡片和表头语言；品牌样式状态还携带 `documentType`，存在模板/单据相互污染风险。

## RC16.12 改动

- 建立统一 `renderPdfTemplateFamily()`：五类正式单据全部进入同一个 Template Family Shell。
- 五套样式统一为：Classic Business / Minimal Trade / Formal Contract / Brand Showcase / Customs Clean。
- 同一 styleId 共享 Hero、Metadata、Party Card、Section Header、Table、Summary、Signature 的设计 Token；文档类型只决定字段、列、业务模块和标签。
- 下线报价单专属 VIP 样式 CSS authority 与 25 套 style×document 分支布局。
- `FlypigBOXBranding` 不再持久化 `documentType`；style / brand 和 editor document state 完全解耦。
- `HUIDI:branding-updated` / `branding-ready` 只刷新 PDF，不允许切换单据 Profile。
- Workspace brand bridge 不再把 document type 写入 branding。
- Readiness banner 按当前单据显示“报价单 / 形式发票 / 销售合同 / 商业发票 / 装箱单”，不再统一写“报价单”。
- Packing List + Customs Clean 保持同一家族设计，同时对高密度 carton summary 使用更紧凑的语义行，避免最后商品行与 Packing Summary 被拆散。

## 验证

- 五套模板 × 五类单据核心设计 Token 一致性：25/25 PASS。
- 12 商品长字段：5 单据 × 5 模板 × 2 密度 × 3 方向 = 150/150 PASS。
- 20 商品压力：5 单据 × 5 模板 × 2 密度 × Auto = 50/50 PASS。
- 商品行不丢失、不重复；真实裁切 0；overflowPages 0；semanticViolations 0。
- RC16.11 分页几何 / 字体稳定 / 尾页均衡继续保留。
- Protected PDF Core 未修改。

状态：**TEST CANDIDATE — 仍需真实 Windows 视觉验收后再晋升公开 main。**
