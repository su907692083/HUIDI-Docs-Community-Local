# HUIDI Docs Community Local V1.2.0 RC16.13

主题：**Unified PDF Page Composer / 统一 PDF 页面编排器**

## 解决的问题

RC16.12 已统一五套 PDF Template Family，但真实 Windows 截图仍出现少量商品被整体推到下一页、第一页/中间页大面积留白、Packing Summary 绑定过度导致额外开页等问题。这些场景可能没有 clipping，却仍属于不可接受的分页质量缺陷。

## RC16.13 改动

- 五类单据统一业务阅读顺序：Hero / Meta / Parties → 商品 → Total / Summary → 补充字段 / 合规 → 物流 / 付款 / 条款 → 签字。
- 取消 1–4 行商品表的整块搬页策略；商品按完整行利用当前页剩余空间。
- 最后商品行与 Summary 优先保持相邻，但 Summary 本身过高时允许明确的 Summary continuation page，商品行不再被无意义推走。
- 新增中间页 Page Composer，可安全回填下一页完整业务块或商品前导行。
- 新增商品续页行级均衡，减少约 30% 利用率的稀疏商品续页。
- 分页报告新增 `qualityViolations`、`pageUtilization`、`firstProductPage`。
- `sparse-nonfinal` 与 `core-products-delayed` 进入硬门禁：无裁切不再等于分页合格。
- 保留 RC16.12 Template Family、RC16.11 稳定几何/字体复检与 RC16.10 紧凑/标准布局策略。

## 已完成动态回归

施工阶段已完成：2 商品完整矩阵 150/150 PASS；12 商品完整矩阵 150/150 PASS；20 商品压力矩阵 50/50 PASS。检查商品行、裁切、overflow、semantic、页面利用率和核心商品首次出现页。

状态：**TEST CANDIDATE — 仍需真实 Windows 视觉验收后再晋升公开 main。**
