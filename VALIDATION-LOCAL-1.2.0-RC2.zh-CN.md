# HUIDI Docs Community Local V1.2.0 RC3 验证报告

## 当前状态

**发布级别：RC2（Release Candidate），不是 FINAL。**

原因：代码、依赖、文件树、静态资源、本地 HTTP 和语法门禁已完成；当前沙盒 Chromium 受 DBus / zygote 环境限制，无法负责任地宣称 Windows Edge/Chrome 的真实点击、下载和像素级视觉验收已经完成。

## 已完成的自动 / 沙盒门禁

- Source `npm run check`：通过。
- JavaScript 文件语法扫描：通过。
- `workspace.html` / `document-start.html` / `editor.html` / `index.html` / `catalog-studio/index.html` 内联脚本语法：通过。
- HTML 本地依赖扫描：缺失 0。
- 核心页面本地 HTTP：200。
- `html2canvas.min.js`：本地存在且可通过 HTTP 读取。
- `jspdf.umd.min.js`：本地存在且可通过 HTTP 读取。
- 生产 Supabase Project Ref：0。
- `workspace.huidios.com`：0。
- `api.huidios.com`：0。
- `bridge-workspace.huidios.com`：0。
- `flypigbox.xyz` / `app.flypigbox.xyz`：0。
- 外部 JS/CSS CDN：0。
- 用户可见 HTML 中旧 FlypigBOX 品牌：0。
- Admin / 生产商业后台：不进入 Community Local。

## RC2 重点修复

1. 工作台改为完整本地业务链：询盘/订单、客户、商品、产品目录、单据、品牌/收款、模板、邮件草稿、回收站、备份。
2. 商品支持本机图片与网络图片 URL；本机图片压缩后保存在浏览器本地。
3. 品牌支持 Logo、电子签名、公章、收款资料本地保存，并可向编辑器带入。
4. 单据编辑器显式加载本地 html2canvas + jsPDF。
5. 本地模式放开 PDF / 客户版 XLSX / 数据 XLSX / CSV 的线上会员门禁。
6. 编辑器加入本地导出工具条和“保存到本机”。
7. 单据自动镜像到本地单据中心，可重新打开继续编辑。
8. 报价 → PI / 合同 → CI → Packing List 支持链式继续制作。
9. 产品目录页修复本地版登录门禁误拦和历史内联 JS 换行语法错误。
10. 工作台采用 SVG 图标、CSS 层次/微交互、白天/夜间模式；不引入 WebGL / Three.js / 粒子或视频背景。
11. 每个导航标识“离线 / 外链需网 / 发送需网”，并加入浏览器兼容和本地存储说明。

## 必须由 Windows 实机完成的最终门禁

在最新版 Edge 和 Chrome 至少各测试一次：

1. 双击 `START-HUIDI-LOCAL.cmd` 能自动打开页面。
2. 新增客户，刷新页面后仍存在。
3. 新增商品：上传本机图片，刷新后图片仍存在。
4. 网络图片 URL：联网时能读取；断网时有明确边界，不影响本机图片商品。
5. 建立询盘/订单，并关联客户和多个商品。
6. 从业务进入产品目录并成功导出目录 PDF。
7. 从业务进入 Quotation，客户/商品/品牌信息自动带入。
8. 编辑器点击“保存到本机”，返回单据中心后能看到并重新打开草稿。
9. 导出 PDF 成功，文件能打开且版式正常。
10. 导出客户版 XLSX 成功，文件能打开。
11. 导出数据 XLSX 成功，文件能打开。
12. 导出 CSV 成功，中文不乱码。
13. Quotation → PI → Sales Contract → CI → Packing List 链式转换，上一张资料继续保留。
14. 关闭 Wi‑Fi，再测试客户、商品、本机图片、单据编辑、保存、PDF/XLSX/CSV、备份。
15. 导出完整 JSON 备份，清空/新浏览器环境后再导入恢复。

## 已知 RC 边界

- 本机图片目前存入浏览器存储。大量高分辨率商品图可能触及浏览器站点存储容量；代码已压缩图片并在写入失败时提示。正式大规模图库未来更适合迁移到 IndexedDB / 本地文件目录。
- 网络图片 URL 不是“真正离线图片”。图片站点若有防盗链、CORS 或需要登录，可能无法在目录/PDF中稳定使用；正式交付建议上传本机图片。
- 不承诺老旧 IE 内核或极端定制浏览器完全兼容；推荐最新版 Edge / Chrome。
