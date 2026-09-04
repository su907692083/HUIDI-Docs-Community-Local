# HUIDI Docs Community Local V1.2.0 RC16.3 验证记录

## 定位

RC16.3 是 RC16.2 的发布阻断修复候选，处理两个 P0：

1. Windows 实机“导出 → 正式 PDF”无反应；
2. 17 种单语 + 中英双语没有统一覆盖 PDF、字段/分栏和表格工作簿。

## 已完成静态/包级验证

- `npm run check`：PASS
- JavaScript / CJS 语法：PASS
- `editor.html` 内联脚本语法：PASS
- HTML 本地资源引用：PASS
- CSP / Local Network Guard：PASS
- 生产 Cloud / Admin / 凭据特征排除：PASS
- RC15 更多抽屉与资料管理能力：保留
- RC16 多语言选择器：保留 17 种单语 + 中英双语
- RC16.3 表格工作簿：使用与 PDF 相同的 `docLanguage` 和共享 `HUIDIDocI18n`
- RC16.3 表格模式字段/分栏：跟随当前客户文件语言，不再固定中文/三语言
- RC16.3 多语言技术词切分：仅按带空格的 ` / ` 分隔，避免把 `B/L` 拆坏
- RC16.3 晚期复合字段：使用语义级翻译覆盖，不再把“合同商品/箱数/收货方”等错误泛化成“商品明细/物流/买卖双方”
- RC16.3 PDF：新增 Community Local 独立本地执行器；不依赖历史 `#exportPdfBtn` 二次模拟点击
- 支持 File System Access API 时：真实用户点击后直接打开系统保存位置，再离线生成并写入 PDF
- 不支持 File System Access API 时：回退为 Blob 下载
- PDF 生成过程有明确准备/逐页捕获/保存/失败信息，不再静默无反馈

## Protected PDF Core

以下核心文件未修改：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js`
  - SHA256 `abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js`
  - SHA256 `570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583`

## 环境边界

当前自动化 Chromium 受组织策略限制，不能访问本机 `127.0.0.1`，因此不能把沙盒静态/HTTP 验证冒充 Windows 浏览器最终验收。

RC16.3 仍需 Windows Edge / Chrome 实机确认：

1. `导出 → 正式 PDF` 应立即出现系统“另存为”或明确 PDF 生成进度，最终产生真实 PDF 文件；
2. 西班牙语/法语/日语等切换后，五大单据的标题、固定字段和分栏同步；
3. 切换到表格工作簿后，语言下拉包含全部语言，字段、分栏、工作簿预览随 `docLanguage` 同步；
4. 阿拉伯语 PDF 的 RTL 仍需实机视觉核对；
5. 中文 / English / 中英双语切回后不得回归。
