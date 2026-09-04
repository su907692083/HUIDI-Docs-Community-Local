# HUIDI Docs Community Local V1.2.0 RC16.9

## 主题

Pagination Stability & Unified Layout Closure / 分页稳定性与统一版式收口。

## 本轮修复

- 将 `标准 / 优先一页` 从 RC16.8 的全局状态改为 **按单据类型独立保存**，QT、PI、SC、CI、PL 互不污染。
- 收口 Preview 重建链：一次版式变化只触发一次主 Preview 重建，旧报价单兼容模块不再拥有分页/密度状态。
- `editor.html` 成为 Community Local 的 **唯一分页权威**；旧后处理分页器在 RC16.9 下只做验证，不再二次拆页。
- 修复品牌展示（brand_showcase）中两栏布局嵌套商品表被当成顶层表格拆分导致的商品重复、2 页膨胀到 4-6 页、内容切割问题。
- 当品牌展示长内容超过单页容量时，自动退化为安全线性多页结构；少量内容仍保留两栏展示。
- 重新绑定 Product Flow + Total / Packing Summary，禁止金额或装箱汇总被其他模块插开后孤立到下一页。
- 修复横向 A4 下预览裁切检查与分页器使用不同安全余量导致的假溢出。
- 修复销售合同优先一页签字区域反向增高问题。
- `优先一页` 只压缩内容间距/字体/单元格密度，不再修改物理 PDF 页面宽高与页边距；放不下时继续安全分页。
- Workbook / XLSX 延续 RC16.8 的统一 layout policy，同一单据读取自己的标准/优先一页状态。

## 回归重点

RC16.9 专项动态回归覆盖：

- QT / PI / SC / CI / PL；
- 标准 / 优先一页；
- portrait / landscape / auto；
- classic_business / brand_showcase / minimal_trade / formal_contract / customs_clean；
- 多商品压力分页；
- 行数守恒、分页报告、裁切节点、Product + Total / Packing + Summary 语义完整性；
- 切换后页数稳定，不允许重复 render 导致页数漂移。

## 发布状态

RC16.9 仍为 Windows TEST CANDIDATE。真实 Windows 需要重点验收：连续切换单据类型、标准/优先一页、PDF 风格、横竖版后，页面不能错乱、不能出现 2→6 页异常膨胀、不能出现分页切割或重复商品行。
