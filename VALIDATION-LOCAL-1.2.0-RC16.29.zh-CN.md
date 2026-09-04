# HUIDI Docs Community Local V1.2.0 RC16.29 验证说明

## Catalog Connectivity Gate

验证项：

- Catalog Studio 接受 `data:image/...` 与 `blob:` 本机图片。
- 工作台本机商品图片直接进入目录 preview image。
- http/https 图片能力不回退。
- 商品报关、原产国、包装、重量、CBM、唛头字段桥接存在。
- canonical 商品键仍为 `huidi_local_products_v1`。
- 旧“目录制作流程 / 返回工作台”重复注入已移除。
- RC16.10–RC16.28 retained gates 继续执行。

运行：

```bash
npm run check:catalog-connectivity
npm run check
```
