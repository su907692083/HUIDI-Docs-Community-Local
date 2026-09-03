# HUIDI Docs Community Local V1.2.0 RC16.18

## 主题：Live Preview Snapshot Export

RC16.18 修复“右侧 PDF 预览正常，但点击导出后分页/内容位置发生变化”的 WYSIWYG 回归。

### 根因
RC16.17 为避免导出期间 Preview 重绘，将每一页克隆到离屏 `fp-pdf-capture-host` 后再调用 html2canvas。该离屏容器不是真实 `#piPaper`，导致大量 `#piPaper ...` 作用域 CSS（密度、横竖版、CI/PL 商品表、模板分页布局）在导出克隆上失效，导出阶段重新计算页面高度，造成 Preview 与最终 PDF 不一致。

### RC16.18
- PDF 导出直接捕获已经稳定分页的真实 `.pdf-page`，不再使用离屏 page clone 作为导出几何权威。
- 根据 Preview zoom 自动补偿截图倍率，保持可读分辨率但不改变实际布局。
- 导出期间冻结 Preview generation；任何新的 Preview render 请求延迟到导出结束后执行。
- 每页捕获前验证 generation、页数和 DOM 连接状态；若导出期间页面真的发生更新则停止本次导出，不生成“混合两次状态”的 PDF。
- 保留 RC16.16 advisory-only 输出策略与 RC16.17 Single Toolbar Owner。
- Protected PDF Flow Core / Formal Output Gate 不修改。

RC16.18 仍为 TEST CANDIDATE，需要 Windows 实机确认最终 PDF 与右侧 Preview 的逐页视觉一致性。
