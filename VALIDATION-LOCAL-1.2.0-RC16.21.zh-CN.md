# VALIDATION — HUIDI Docs Community Local V1.2.0 RC16.21

## Focus
1. 顶部“保存单据”与右侧“保存单据”必须进入同一个 Smart Save 完整流程。
2. 顶部“检查”不得调用 `FormalOutputGate.open()`；检查结果仅以建议形式进入右侧“单据辅助”。
3. 每条检查建议支持 HUIDI Issue Navigator 定位。
4. 检查不能禁用任何 PDF/XLSX/CSV/打印出口。
5. 顶部重复“清空”入口隐藏，高风险清空只保留在右侧高级区域。
6. 快速/完整模式切换使用单一事务，Preview 在事务期间延后提交。

## Static gates
- `npm run check`
- `npm run check:actions`
- RC16.10–RC16.20 retained validators
- JS syntax / HTML local refs / CSP guard

## Real Windows acceptance
- 顶部“保存单据”打开“修改保存名称与备注”。
- 右侧“单据辅助 → 保存单据”打开同一个窗口。
- 故意留空 HS Code 后点击顶部“检查”：右侧显示“建议补充/建议核对”，点击可定位 HS Code；仍可直接导出。
- 快速/完整连续快速点击，右侧 Preview 不应出现多套样式跳动、大面积空白或下移。
