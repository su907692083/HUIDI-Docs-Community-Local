# VALIDATION — HUIDI Docs Community Local V1.2.0 RC16.7

## 自动门禁

- `npm run check`
- 所有 public JavaScript 语法检查
- HTML 本地资源引用 / CSP / Local-only network guard
- RC16.7 Unified Local Core / Workbench Linkage validator
- Legacy Customer → canonical CustomerRepository runtime migration smoke
- DocumentContextService stale Document ID reset smoke
- 保存/关联 DocumentRecord 不得静默改变 Deal Stage
- 显式 Business Event 才允许推进 Deal Stage
- DocumentRecord / index lineage metadata contract
- Workbench / Editor / Document Start / Catalog Studio 统一 Core 加载
- Protected PDF Core SHA256 unchanged
- RC16.6.5 page fit / RC16.6.4 pagination / RC16.6.x i18n, preview and closure validators continue passing

## Windows 实机仍需验收

本轮自动门禁不能替代真实浏览器业务交互验收。发布前仍需在 Windows Edge/Chrome 验证：

1. 多入口新建单据不复用旧 Document ID；
2. 客户、商品在 Workbench ↔ Editor ↔ Catalog Studio 之间正确关联；
3. “资料同步”只在用户明确操作时覆盖当前草稿或回写主数据；
4. 已保存历史单据保持 Snapshot；
5. 打开单据不推进业务阶段；
6. QT → PI → SC → CI/PL 单据链在工作台可追溯；
7. 多标签页数据变化提示与刷新正常；
8. RC16.6.5 页面适配、PDF 导出、多语言、分页、Windows 启动器与飞书可选协作链无回归。

状态：**TEST CANDIDATE**，Windows 实机链路通过前不建议发布到 GitHub。

## 本次封包前已完成结果

- Source 工作树文件：335
- Windows 工作树文件：316
- SOURCE / WINDOWS `public`：235 / 235，逐文件 SHA256 一致
- `npm run check`：PASS
- RC16.7 Unified Local Core runtime smoke：PASS
- editor 内联脚本：7 blocks / 0 syntax failures
- document-start 内联脚本：1 block / 0 syntax failures
- Catalog Studio 内联脚本：2 blocks / 0 syntax failures
- Windows 本地 Companion Server（独立 8770 端口）关键页面与 `/api/feishu/status`：HTTP 200
- 8765 被占用时 Node launcher 自动切换到 8766：已观察到 fallback 正常
- `config/feishu.local.json`：未进入发布工作树
- Protected PDF Core：
  - `flypigbox-v3-3-2-3-pdf-flow-fix.js` = `abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36`
  - `flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js` = `570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583`
