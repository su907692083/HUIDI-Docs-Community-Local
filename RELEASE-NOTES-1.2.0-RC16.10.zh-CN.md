# HUIDI Docs Community Local V1.2.0 RC16.10

## Compact / Standard Density Simplification

本版本基于 RC16.9 稳定分页基线，收口预览区排版入口。

- 删除用户界面的“内容适配”“优先一页”“标准分页”等概念。
- 预览工具栏只保留两个排版密度选项：**紧凑 / 标准**。
- 紧凑模式仅减少非必要留白、表格 padding、模块间距和部分字号/签字区占用，不再表示“强制一页”。
- 内容多时始终交由 RC16.9 的单一分页权威正常安全分页。
- 五类单据 QT / PI / SC / CI / PL 各自保存紧凑/标准偏好。
- Workbook 预览同步紧凑/标准；XLSX 不再因紧凑模式设置 fitToHeight=1。
- 紧凑模式中的产品图片继续使用 contain，禁止裁切和比例失真。
- 继续保留 RC16.9 的品牌展示多页安全降级、Product+Total / Packing+Summary 语义绑定和横向分页修复。

状态：TEST CANDIDATE，仍需 Windows 实机视觉验收。
