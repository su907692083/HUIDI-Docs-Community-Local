# HUIDI Docs Community Local V1.2.0 RC5 专项门禁

## 本轮目标

RC5 只处理单据编辑器固定页头架构：恢复原来成熟的 `#fpLiteToolbar`，撤销 RC3/RC4 新建的 `#huidiLocalEditorBar`，并让原页头功能在 Community Local 继续可用。

## 代码级结果

- [PASS] `npm run check`
- [PASS] JS syntax scan
- [PASS] HTML local references
- [PASS] Community Local CSP / network guard
- [PASS] `#huidiLocalEditorBar` 不再创建；如果旧页面热刷新残留，会主动 remove
- [PASS] 本地桥接无 `MutationObserver`，没有恢复 RC3 的全 body 自触发链
- [PASS] `#fpLiteToolbar` 作为唯一 canonical editor header 恢复显示
- [PASS] 原 canonical toolbar 源文件保持 RC4 原 SHA：`flypigbox-quick-result.js`、`flypigbox-v3-3-2-5-editor-shell-cleanup.js`、`flypigbox-v3-3-5-0-sync-core.js`
- [PASS] 原页头：内部工具
- [PASS] 原页头：导入资料
- [PASS] 原页头：PDF 单据 / 表格工作簿
- [PASS] 原页头：单据类型
- [PASS] 原页头：保存单据
- [PASS] 原页头：模板 / 样式
- [PASS] 原页头：快速 / 完整模式
- [PASS] 原页头：字段设置
- [PASS] 原页头：布局
- [PASS] 原页头：导出
- [PASS] 原页头：清空
- [PASS] 原页头：更多
- [PASS] Community Local 隐藏账号 / 登录入口和旧内部版本号
- [PASS] 在原页头内新增“检查”
- [PASS] 在原页头内新增“下一步”业务链
- [PASS] 在原导出菜单补充数据版 XLSX 和打印 / 另存 PDF
- [PASS] 原“保存单据”同时写入本地单据中心镜像
- [PASS] `type=` / `doc=` 继续强制同值
- [PASS] 生产 Supabase / workspace / api / bridge 域名残留 0

## HTTP smoke

以下均返回 HTTP 200：

- `/`
- `/workspace.html`
- `/document-start.html`
- `/editor.html?type=quotation&local=1&doc=quotation`
- `/catalog-studio/index.html`
- `/flypigbox-quick-result.js`
- `/huidi-local-editor-bridge-v120.js`
- `/huidi-local-rc5.css`
- `/assets/vendor/html2canvas.min.js`
- `/assets/vendor/jspdf.umd.min.js`

## Windows / Source 公共运行树

- public 文件：219 / 219
- missing：0
- extra：0
- SHA mismatch：0

## 仍需 Windows 实机确认

容器 Chromium 仍受 DBus / zygote 环境限制，无法完成可靠的真实视觉点击截图。因此 RC5 仍需在 Windows Edge / Chrome 实测：

1. 报价、PI、销售合同、CI、装箱单的页头必须完全一致。
2. 页面只允许出现一个固定主工具栏。
3. 内部工具、导入、PDF/表格、单据类型、保存、模板、模式、字段、布局、导出、清空、更多全部可点。
4. 账号和旧版本号不显示。
5. 下一步转换链可用。
6. PDF / XLSX / CSV 真下载。
