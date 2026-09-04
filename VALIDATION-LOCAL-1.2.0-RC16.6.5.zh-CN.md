# VALIDATION — HUIDI Docs Community Local V1.2.0 RC16.6.5

## 状态

- Page Fit & Landscape Workspace Closure：PASS（源码、事件与规则级）。
- RC16.6.4 Pagination Integrity：PASS。
- RC16.6.3 Final I18n / Performance Closure：PASS。
- Windows 浏览器真实“优先一页”视觉 / 横版空间利用：仍需实机验收。

## 本轮新增门禁

- 编辑器必须加载 `huidi-page-fit-workspace-rc1665.css/js`。
- “优先一页”入口必须位于右侧 Preview toolbar；旧“常用报价条件”不得再注入该按钮。
- Quotation Quick Flow 的 one-page 状态不得继续依赖 `quickMode`。
- “优先一页”必须与 canonical `flypigbox_quotation_pdf_density_v1` 状态键共用，不创建第二套冲突状态。
- 一页优先必须具备可测的 Level 1 / Level 2 密度 CSS。
- 强化密度只允许用于 2 页且少量商品（<=6）的报价，禁止对长单据无限缩小。
- 横版工作区必须存在 orientation-aware split 策略和横竖版独立宽度记忆。
- 横版必须扩大可用工作区宽度并减少 preview / workbook 无效留白。

## 继续保留的门禁

- `npm run check`。
- JS/CJS syntax scan。
- HTML local references。
- Local CSP/network guard。
- RC16 multilingual gates。
- RC16.5 IndexedDB / save coordinator / canonical PDF executor gates。
- RC16.6 product layout / Feishu boundary gates。
- RC16.6.1 Windows launcher gates。
- RC16.6.2 Preview Runtime matrix。
- RC16.6.3 I18n / Performance gates。
- RC16.6.4 Pagination Integrity gates。

## Protected PDF Core

以下文件本轮禁止修改：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`

最终 SHA256 必须继续等于既有保护值。

## Windows 实机验收

1. Quotation 在“标准”模式记录页数。
2. 点击 Preview 顶部“优先一页”，少量内容时必须出现明确的版式变化；若能安全收为 1 页，应实际变为 1 页。
3. 内容较多无法安全单页时，应显示当前页数并保持可读，不得无限缩小。
4. “优先一页”入口不再出现在左侧常用报价条件。
5. 切换 A4 横版后，右侧预览区明显变宽、A4 横版缩放比例提高，左右无效空白减少。
6. 横版表格工作簿同样获得更合理的左右比例。
7. 拖动中间分隔条后，横版 / 竖版分别记忆自己的宽度；双击恢复当前方向推荐值。
8. 切回竖版时不能破坏 RC16.6.4 已通过的分页完整性。

完成实机验收前保持 **TEST CANDIDATE**。
