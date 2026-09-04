# HUIDI Docs Community Local V1.2.0 RC16.14

主题：**Clip-Aware Pagination + Issue Navigator**

## 本轮修复

1. Preview 与正式 PDF 导出共用节点跨页边界检测：`clippedPdfNodes()` 不再只在导出阶段生效。
2. 分页报告新增 `clipBoundaryPages` / `clipBoundaryNodes`；任何完整业务节点跨入页脚安全区都会令分页无效。
3. 字体/模板稳定后发现 clip-boundary 时，转换为受控 pagination guard，最多两次重分页，避免无限循环。
4. 新增 `HUIDIIssueNavigator` 统一定位链：顶部检查、Preview readiness、正式输出“去补充”共用同一定位协议。
5. Trade Factory 的 `fieldId` / `selector` 在 Rule Pack 合并时保留，并转换为 canonical `fields.X` / `items.N.X` path。
6. 定位商品字段时自动切回表单、展开商品更多字段、开启必要的显示开关、滚动、聚焦并高亮。
7. “返回补充”运行时改为“返回并定位第一项”；关闭按钮仍只关闭窗口。
8. Protected Formal Output Gate 保持 RC16.13 原 SHA；新导航通过外层事件接管实现。

## 边界

RC16.14 继续标记为 TEST CANDIDATE。最终 Windows 实机仍需重点确认横向/紧凑/多语言组合的个别行裁切，以及各种“去补充”按钮的实际滚动定位体验。
