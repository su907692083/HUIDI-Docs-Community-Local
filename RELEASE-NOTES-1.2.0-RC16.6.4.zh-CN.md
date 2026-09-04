# HUIDI Docs Community Local V1.2.0 RC16.6.4

RC16.6.4 是 RC16.6.3 之上的 **Pagination Integrity Hotfix / 分页完整性热修候选**。

本轮不增加离线翻译，不修改启动器、IndexedDB、飞书接口、多语言核心或两份 Protected PDF Core。目标只处理真实 Windows 截图暴露出的业务块分页断裂：商品表已在上一页结束，但小计 / 合计金额或箱规汇总单独出现在下一页。

## 修复内容

1. **商品表与汇总建立语义关联**
   - Quotation：商品明细 + 报价金额汇总。
   - PI：商品明细 + 金额汇总。
   - Sales Contract：合同商品 + 金额汇总。
   - Commercial Invoice：申报商品 + 申报总额。
   - Packing List：装箱内容 + 箱数/重量/体积汇总。

2. **避免汇总成为孤儿块**
   - 分页器不再只按顶层 DOM block 独立分页。
   - 若最后一行商品与汇总无法同时留在当前页，最后一行商品会与汇总一起进入下一页。
   - 这样不会出现“第一页完整商品表、第二页一上来只有小计/合计”的视觉截断。

3. **完整行优先**
   - 商品行继续作为不可裁切的完整行处理。
   - 不为了塞满页面而把单个商品行切成上下两页。

4. **分页语义完整性报告**
   - 新增 `semanticViolations`。
   - 若分页后出现商品汇总孤儿块或极端情况下不得不降级，分页报告标记失败。
   - 正式 PDF 导出会显示“业务块断裂”并停止导出，避免生成结构已损坏的客户文件。

5. **发布门禁**
   - 增加 1 / 3 / 8 / 15 商品行容量模型矩阵。
   - 增加 Quotation / PI / Sales Contract / CI / PL 商品区和汇总 selector 检查。
   - 保留 RC16.6.2 Preview Runtime、RC16.6.3 I18n/Performance 门禁。

## 保留能力

- RC16.6 商品列宽、短条款分页、可选飞书同步。
- RC16.6.1 Windows PowerShell UTF-8 BOM、端口冲突、fallback 诊断。
- RC16.6.2 `productColgroup()` TDZ 热修与预览失败恢复。
- RC16.6.3 最终单据多语言、Preview 调度和 CI/PL 稀疏版式。
- RC16.5 IndexedDB、单一保存协调器、canonical PDF executor。

## 状态

**TEST CANDIDATE / NOT YET PUBLIC RELEASE**。

最终仍需要 Windows Edge / Chrome 实机确认 1、3、8、15 商品场景的分页观感与真实 PDF 文件落盘。
