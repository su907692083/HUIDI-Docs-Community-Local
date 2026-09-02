# HUIDI Docs Community Local V1.2.0 RC16.9 Validation

状态：TEST CANDIDATE validation record。

## 静态门禁

- `npm run check`
- `npm run check:layout`
- 全 public JS `node --check`
- HTML 本地资源引用完整性
- Community Local CSP / network guard
- RC16.9 单分页权威 / per-document layout policy gate

## 动态门禁

使用真实 headless Chromium + loopback HTTP 运行 Editor，构造长商品资料并检查：

- 五类单据全部可切换 `标准 / 优先一页`；
- 五种 PDF style；
- portrait / landscape / auto；
- `window.__fpLastPaginationReport.valid === true`；
- 商品行数量不丢失、不重复；
- `overflowPages` 为空；
- 无 clipped rows；
- Product + Total / Packing + Summary 不出现语义孤立；
- 标准→优先一页→标准后页数稳定；
- settled preview 不持续增加 render generation。

## Protected PDF core

以下核心保持 SHA 不变：

- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js` — `abb741448747b8161c9dfafff77a76f8cecd41771d436234424f3a43af275b36`
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js` — `570884ad3445361c60b0ef491544f54adce689b89f92ffd546803b619cb93583`

## Windows 验收仍需执行

本记录不等于真实 Windows 人工视觉验收。RC16.9 在用户实机通过连续切换和正式 PDF 文件导出前，不应晋升公开 main / stable release。
