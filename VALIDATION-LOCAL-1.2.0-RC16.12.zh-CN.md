# RC16.12 本地验证记录

## 静态门禁

- `npm run check`
- `npm run check:layout`
- `npm run check:pagination`
- `npm run check:templates`
- JS/CJS syntax scan
- HTML local reference scan
- Protected PDF Core SHA verification

## 动态 Chromium

- Template Family state/token smoke：25/25 PASS。
- 12 商品长字段矩阵：150/150 PASS。
  - QT 30/30
  - PI 30/30
  - SC 30/30
  - CI 30/30
  - PL 30/30
- 20 商品压力矩阵：50/50 PASS。
- 真实 UI 连续切换：2 轮 × 5 状态 = 10/10 PASS；相同状态回访的页数、商品行、family、overflow/semantic/clipping 签名一致。
- 检查：pageCount stable、row count、clipping、overflowPages、semanticViolations、paginationStable、family identity、branding/document decoupling。

## 关键回归

- 同一 PDF style 切换 QT → PI → SC → CI → PL，style 不变化。
- 切换 PDF style，当前 documentType 不变化。
- Branding public state 不含 `documentType`。
- CI / PL readiness banner 不再显示“这张报价单”。
- Packing List Customs Clean landscape/standard 的 final row + Packing Summary 语义闭包 PASS。

## 边界

真实 Windows 的字体栅格、打印驱动和最终客户视觉仍需实机验收。本记录不把沙盒 Chromium 等同于 Windows 人工验收。
