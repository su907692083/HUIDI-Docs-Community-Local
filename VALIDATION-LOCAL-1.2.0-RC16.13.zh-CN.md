# RC16.13 本地验证记录

## 施工阶段动态 Chromium

- 2 商品长字段：5 单据 × 5 模板 × 2 密度 × 3 方向 = 150/150 PASS。
- 12 商品长字段：150/150 PASS。
- 20 商品压力：5 单据 × 5 模板 × 2 密度 × Auto = 50/50 PASS。
- 检查：商品行不丢失/不重复、clipping、overflowPages、semanticViolations、qualityViolations、pageUtilization、firstProductPage、paginationStable、Template Family identity。

## RC16.13 质量门禁

- 非末页利用率 <34%：`sparse-nonfinal`，判定失败。
- 核心商品从后页开始，且此前存在明显可利用页面空间：`core-products-delayed`，判定失败。
- Summary 允许在确实过高时建立明确 continuation page，不允许为了 Summary 把本可容纳的商品行推出当前页。
- 商品续页均衡不得拆行、丢行、重复行或把 Total/Packing Summary 与业务流错误分离。

## 发布门禁

- `npm run check`
- `npm run check:layout`
- `npm run check:pagination`
- `npm run check:templates`
- `npm run check:composer`
- JS/CJS syntax scan
- HTML local reference scan
- SOURCE/WINDOWS public runtime SHA parity
- ZIP CRC + re-extract SHA
- Windows loopback HTTP smoke / port collision fallback
- Protected PDF Core SHA verification

## 边界

沙盒 Chromium 验证不替代真实 Windows 字体栅格、打印驱动和最终人工视觉验收。
