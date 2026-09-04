# HUIDI Docs Community Local V1.2.0 RC16.6.2

## 定位

RC16.6.2 是 RC16.6.1 之上的 Preview Runtime P0 热修。范围仅限右侧正式预览运行时可靠性，不扩展飞书、PDF 导出、多语言、存储或业务能力。

## 修复

- 修复 `productColgroup()` 默认参数变量遮蔽：RC16.6 中 `showImage=showImage` 会在真实商品预览路径触发 TDZ `ReferenceError`，导致 Quotation / PI / Sales Contract 右侧预览空白。
- 改为 `productColgroup(options={})`，显式计算 `includeImage` / `includeMoney`，保留 RC16.6 的商品列宽比例。
- `renderPreview()` 增加运行时恢复：
  - 新预览生成成功后才标记 ready；
  - 发生异常时保留上一份可用预览；
  - 首次预览失败时显示明确错误和“重新生成预览”，不再静默白板；
  - 错误同时写入状态栏与 console，便于实机定位。
- 新增 `validate-preview-runtime-rc1662.cjs`：实际执行商品 `colgroup` 组合矩阵，并检查 Quotation / PI / Sales Contract 商品渲染钩子与预览失败恢复契约。

## 保留

- RC16.6 商品明细列宽、短 Terms/Logistics/References 分页策略、多语言纯净度与可选飞书协作同步保留。
- RC16.6.1 Windows PowerShell 5.1 / UTF-8 BOM / 端口碰撞 / fallback / no-flash 启动器热修保留。
- RC16.5 IndexedDB、本地保存协调器、canonical PDF 单执行器与 INTERNAL REVIEW 隔离保留。
- 两份 Protected PDF Core 未修改。

## 实机验收边界

自动门禁可验证源码、运行时 helper、文件树和本地 HTTP；受当前沙盒 Chromium 环境限制，最终 Windows Edge / Chrome 的真实右侧预览仍需实机确认。重点测试：Quotation / PI / Sales Contract 各含 3 个商品，English / 日本語 / 한국어 至少各一次。
