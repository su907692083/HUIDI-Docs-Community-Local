# HUIDI Docs Community Local V1.2.0 RC3 验证报告

日期：2026-09-01

## 本轮依据
本轮依据 Windows 实机 RC2 截图进行视觉/交互收口，重点修复：编辑器重复工具层、产品目录本地 XLSX 误报、重复流程条、页面空状态、业务链展示和横向溢出风险。

## 自动门禁
- Source `npm run check`：PASS
- JS 文件语法扫描：PASS
- 关键 HTML 内联脚本语法：PASS
- HTML 本地资源引用：PASS
- CSP：`connect-src 'self'`：PASS
- 生产 Supabase Project Ref：0
- `workspace.huidios.com` / `api.huidios.com` / `bridge-workspace.huidios.com`：0
- `flypigbox.xyz` / `app.flypigbox.xyz`：0
- 外部 JS/CSS CDN 标签：0
- Admin / 生产后台：未进入 Community Local
- 用户可见 HTML 中 FlypigBOX 品牌：0
- `Trial Preview` 文案：0

## RC3 收口内容
- 编辑器：Community Local 只显示一套本地顶栏；旧在线工具条、登录、版本号、旧流程条、侧边内部导航在本地模式隐藏。
- 编辑器：顶栏统一为返回 / 当前单据 / 保存 / 检查 / 导出 / 设置 / 下一步。
- 编辑器：本地版强制关闭 Trial 水印。
- 产品目录：使用包内 `flypigbox-xlsx-lite.js` 读取 `.xlsx`，不再把 `window.XLSX` 缺失误判为需要联网。
- 产品目录：清除裸露 `>` 字符；隐藏旧跨模块重复流程条；只保留一套本地流程。
- Workspace：业务主链拆为 8 步，首页/询盘页完整显示；资料管理页不再重复占据大面积空间。
- Workspace：品牌、模板、邮件、回收站、单据中心新增可执行空状态。
- 单据中心：增加 报价→PI→合同→CI→装箱单 的下一步快捷动作。
- 产品目录中心：增加最近商品入口和本地制作顺序。
- 响应式：增加横向溢出限制及 1100/900/820px 分级收口。

## 当前无法在沙盒完成的实机项
容器内 Chromium 受管理员网络/沙盒策略限制，无法完成可靠的真实浏览器视觉截图和下载点击验收。因此以下项目仍必须在 Windows + Edge/Chrome 上复验后才能升 FINAL：
1. PDF 真下载。
2. 客户版 XLSX 真下载。
3. 数据 XLSX 真下载。
4. CSV 真下载。
5. 断 Wi-Fi 后上传并读取 XLSX 产品表。
6. 产品目录 PDF 真下载。
7. 报价 → PI → 合同 → CI → 装箱单连续带入。
8. 1366×768 / 1920×1080、Windows 125% 显示缩放实机观感。

结论：RC3 可进入 Windows 实机验收；尚不标记 FINAL。
