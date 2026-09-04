# HUIDI Docs Community Local V1.2.0 RC16.29 Source Package

RC16.29 以 **RC16.28** 为唯一源码基线，定位为 **Catalog Connectivity Closure / Product Master Data Reuse / Local Image Continuity**。

本轮只收口产品目录连通，不重写工作台壳层，也不修改 PDF 核心：

- 工作台 canonical 商品库继续使用 `huidi_local_products_v1`；
- Catalog Studio 支持直接读取 `data:image/...` / `blob:` 本机图片来源；
- 本机图片进入目录后直接标记为 ready，避免再次经过网络 URL 识别链；
- 商品报关、原产国、包装、重量、CBM、唛头等主数据继续复用到目录商品信息；
- 删除旧 Catalog Closure 重复注入的“目录制作流程 / 返回工作台”块；
- 新增 `tools/validate-catalog-connectivity-rc1629.cjs`；
- RC16.28 Workspace R6、RC16.27 Single Shell、Feishu Data 与 Protected PDF Core 均保留。

运行入口：`START-HUIDI-LOCAL.cmd`。
验证入口：`npm run check` 或 `npm run check:catalog-connectivity`。
