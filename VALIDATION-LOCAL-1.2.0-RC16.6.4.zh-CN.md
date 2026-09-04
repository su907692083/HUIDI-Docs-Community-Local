# VALIDATION — HUIDI Docs Community Local V1.2.0 RC16.6.4

## 状态

- Pagination Integrity Hotfix：PASS（源码与规则级）。
- RC16.6.2 Preview Runtime：PASS。
- RC16.6.3 Final I18n / Performance Closure：PASS。
- Windows 浏览器真实分页视觉 / PDF 落盘：仍需实机验收。

## 本轮新增门禁

- `PDF_PRODUCT_FLOW_SELECTOR` 覆盖：Quotation / PI / Sales Contract / Commercial Invoice / Packing List。
- `PDF_PRODUCT_TAIL_SELECTOR` 覆盖：报价汇总 / 申报总额 / 合同汇总 / Packing Summary / 通用 money table。
- 商品区与紧邻汇总采用 `splitProductSectionWithTail()` 语义分页。
- 最后一行商品与汇总保持邻接；容量不足时一起移动到下一页。
- 1 / 3 / 8 / 15 商品行容量模型矩阵：PASS。
- 商品行 loss / duplicate 检查：PASS。
- 新增 `semanticViolations`，孤儿汇总会使 pagination report FAIL。
- 正式 PDF 导出错误信息包含“业务块断裂”。

## 继续保留的门禁

- `npm run check`。
- JS/CJS syntax scan。
- HTML local references。
- Local CSP/network guard。
- RC13/RC15 PDF authority regression gates。
- RC16 multilingual gates。
- RC16.5 IndexedDB / save coordinator / canonical PDF executor gates。
- RC16.6 product layout / Feishu boundary gates。
- RC16.6.1 Windows launcher encoding / port/fallback gates。
- RC16.6.2 Preview Runtime matrix。
- RC16.6.3 I18n / Preview render-storm suppression / CI-PL readability gates。

## Protected PDF Core

以下文件本轮禁止修改：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`

最终 SHA256 应继续等于既有保护值。

## Windows 实机验收

至少分别在 Quotation / PI / Sales Contract / CI / Packing List 验证：

1. 1 个商品。
2. 3 个商品。
3. 8 个商品。
4. 15 个商品。
5. 商品表跨页时，最后商品行和金额/箱规汇总不能断开成孤儿块。
6. 页面不能出现底部裁切、重复商品、缺少商品。
7. 右侧 Preview 页数与真实导出 PDF 页数一致。
8. 实际 `.pdf` 文件成功落盘且文件大小 > 0。

在上述实机验收完成前，RC16.6.4 保持 **TEST CANDIDATE**。
