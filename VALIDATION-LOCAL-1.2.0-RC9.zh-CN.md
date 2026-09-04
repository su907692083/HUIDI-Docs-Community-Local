# HUIDI Docs Community Local V1.2.0 RC9 验证记录

- [x] JavaScript 语法检查
- [x] 本地 HTML 资源引用检查
- [x] Community Local / 生产后台隔离检查
- [x] RC8 → RC9 运行文件最小差异审计
- [x] PDF 导出路径不再调用导出时 `renderPreview()`
- [x] PDF 导出路径不再修改 live `#piPaper` 高度 / overflow / `pdf-exporting`
- [x] PDF 捕获对象为完整 `.pdf-page`
- [x] 预览页数 / 捕获页数 / jsPDF 页数三重门禁静态审计
- [x] SOURCE / WINDOWS public 运行树一致性检查
- [x] ZIP 完整性检查
- [x] 沙盒 Chromium 独立 WYSIWYG 捕获夹具：2 页预览 → 2 个 Canvas → 2 页 jsPDF / pdfinfo：PASS

## 实机门禁

说明：构建环境的 Chromium 对本地 URL 导航受管理员策略限制，因此独立捕获夹具通过不等同于完整应用实机通过。

正式替换公开 RC6 Release 前仍需在 Windows Edge / Chrome 实机验证：

- 右侧 2 页 → 下载 2 页；
- 每页内容与预览逐页一致；
- 第二页不丢失、不截断；
- 内部工具 / 更多工具 / 字段 / 布局 / 收款资料仍可正常打开和关闭。
