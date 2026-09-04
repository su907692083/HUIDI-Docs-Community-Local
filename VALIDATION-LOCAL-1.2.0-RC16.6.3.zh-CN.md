# VALIDATION — HUIDI Docs Community Local V1.2.0 RC16.6.3

## 已执行发布门禁

- `npm run check`：PASS。
- JS/CJS 语法、HTML 本地引用、Local CSP/网络隔离：PASS。
- RC16.6.2 Preview Runtime `productColgroup` 运行矩阵：PASS。
- RC16.6.3 Final I18n / Performance Closure：PASS。
- CI / PL 已知最终单据混语回归词条：Japanese / Korean 精确断言 PASS。
- 固定多语言术语 280 组、结构化字段 65 项、结构化下拉值 33 项：PASS。
- 输入 Preview 调度：主表单、PI 编号、资产调整、物流自定义行均不再按字符直接完整重绘；sync-core 不再作为第二个 per-key Preview owner。
- PDF i18n surface：不再监听整个 `#piPaper` MutationObserver，改由 canonical `HUIDI:preview-rendered` 驱动。
- SOURCE / WINDOWS `public`：必须逐文件 SHA 一致。
- ZIP CRC、重解压文件树和 SHA256：必须 PASS。
- Windows/Node 本地服务关键页面与 `/api/feishu/status`：必须 HTTP 200。

## 浏览器运行时边界

当前沙盒 Chromium 存在环境级运行故障：即使最简单的 `data:` 页面也无法正常完成 headless `--dump-dom` 并退出，因此本轮**不宣称沙盒浏览器视觉或真实交互 PASS**。

最终 Windows Edge / Chrome 仍需实机确认：

1. Quotation / PI / Sales Contract / Commercial Invoice / Packing List 均能生成右侧纸张；
2. Japanese / Korean（并建议再测 Spanish / Arabic）固定系统标签无错误 English/Chinese fallback；
3. 连续输入时 Preview 不再逐字符重建，打字/滚动/切语言明显更顺；
4. CI / PL 低内容量版式不再呈现“上半页微缩报表”；
5. 正式 PDF 真实落盘与飞书真实凭证联调。

在上述实机验收完成前，RC16.6.3 定位为 **TEST CANDIDATE**，不是公开 Release。
