# HUIDI Docs Community Local V1.2.0 RC16.27 专项门禁

## 自动门禁

1. `npm run check` 全部 PASS。
2. `npm run check:workspace-r5` PASS。
3. `workspace-r5.css/js` 必须在 R4 之后加载，成为最终 Workspace visual/composition owner。
4. HTML 第一帧必须包含 `workspace-preboot` 与 `workspace-booting`，且 R3/R4/R5 class 在静态 body 上已存在。
5. boot 期间真实 `.app` 必须 `visibility:hidden`，旧深色壳不得被绘制给用户。
6. R5 必须在最终组合后删除旧直接导航壳、去重 13 个导航入口，并写入 runtime audit marker。
7. 飞书入口必须显式清除 `hidden / aria-hidden`；Community Local 旧文本过滤规则不得再隐藏“飞书资料 / 飞书同步”。
8. 飞书配置 modal 必须禁止横向溢出，form-grid 与 footer 使用同一套容器几何。
9. R5 不允许新增 `MutationObserver`。
10. SOURCE / WINDOWS 公共运行树路径和 SHA 必须完全一致。
11. ZIP CRC、二次解压 missing / extra / SHA mismatch 均为 0。
12. Windows CMD CRLF；PowerShell UTF-8 BOM + CRLF。
13. 8765 正常启动；占用时自动回退到 8766。
14. `/`、Workspace、Document Start、Quotation Editor、Catalog Studio、Feishu Status 必须 HTTP 200。
15. 两份 Protected PDF Core SHA 必须保持既有值。

## Windows 实机重点

- 连续刷新 `workspace.html` 5 次：不得看到旧深色侧栏、旧 Community Local 卡片或旧 8 步布局先闪现再切换。
- 正常快速机器不应出现明显的加载页；慢机器最多看到短暂中性的 HUIDI 准备状态。
- 最终左侧只保留一套导航；飞书资料可见、可点击。
- 打开“配置飞书”：弹窗底部不得有横向滚动条，页面背景不得与弹窗同时滚动。
- 关闭弹窗后背景滚动恢复正常。
- 1366×768、1920×1080、Windows 125% 缩放继续人工验收。
