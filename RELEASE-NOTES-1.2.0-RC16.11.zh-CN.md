# HUIDI Docs Community Local V1.2.0 RC16.11

## 发布定位

RC16.11 是 **Pagination Geometry & Template Distribution Stability** 修复版，基于 RC16.10 的“紧凑 / 标准”双密度模式继续收口 PDF 分页、模板切换、横竖版切换和尾页空间分布。

本轮不恢复“优先一页”，也不增加新的用户排版入口。用户仍只看到：**紧凑 / 标准**。

## 主要修复

- 修正 Preview 使用 CSS `zoom` 时 `getBoundingClientRect()` 显示坐标与 PDF `clientHeight` 逻辑坐标混用的问题。
- 模板 `min-height`、grid stretch、品牌展示两栏视觉外壳不再计入真实业务内容高度。
- 分页完成后等待 `document.fonts.ready` 与双 `requestAnimationFrame`，再基于最终几何做一次稳定验收。
- 若字体或模板迟到 reflow 真正进入页脚安全区，会把实际漂移转换为有上限的动态分页 guard；最多两次受控重分页，禁止无限 render loop。
- 品牌替换、i18n、费用表、正式输出清理、游客/通俗化文案等非分页 owner 不再在稳定分页后修改 `#piPaper`。
- 需要修改 PDF 的品牌、i18n、CI/PL 正式输出规范化统一在分页前完成。
- 尾页过空时，在最终稳定几何上重新做业务块级均衡，避免“上一页塞满、最后一页只剩一小段条款/物流”。
- 尾页均衡不会拆商品行，不会单独搬走 Total / Packing Summary；必要时移动“最后商品行 + Total/Summary + 后续条款/物流”的完整业务流。
- 保留 RC16.10 的 per-document `紧凑 / 标准` 状态与 Workbook/XLSX 行为。

## 动态验证

- 12 商品完整矩阵：**150 / 150 PASS**（QT / PI / SC / CI / PL 各 30 / 30）。
- 覆盖：5 种 PDF 模板 × 紧凑/标准 × 纵向/横向/自动。
- 20 商品压力矩阵：**50 / 50 PASS**。
- 真实 UI 连续切换：QT → PI → SC → CI → PL，切换模板、密度和纸张方向后回到同一状态，两轮分页签名一致。

## 兼容与边界

- RC16.10 的 `huidi-layout-policy-rc1610` 继续作为紧凑/标准密度 owner；RC16.11 不再新建第三套密度状态。
- RC16.9 的单一分页权威、品牌展示多页安全降级、Product + Total / Packing + Summary 语义绑定继续保留。
- 两份 Protected PDF Core 未修改。
- 仍需真实 Windows 视觉/PDF 保存验收后再考虑晋升公开稳定基线。
