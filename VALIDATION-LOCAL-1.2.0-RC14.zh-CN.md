# HUIDI Docs Community Local V1.2.0 RC14 验证记录

## 范围

RC13 → RC14 开源发布前 UX 收口：顶部高频入口、低频 More 抽屉、默认卖方资料与个人资料模板管理。

## 自动门禁

- `npm run check`
- JavaScript / CJS 语法
- HTML 本地资源引用
- CSP / local-only 网络边界
- 生产 Admin / Cloud 私有能力排除
- Community Local PDF 权限最终控制权
- RC14 More 抽屉单一高频入口约束
- RC14 默认卖方可编辑管理器存在性
- RC14 个人模板管理能力存在性
- SOURCE / WINDOWS public runtime tree 一致性
- ZIP CRC 与解压后树哈希一致性
- Windows 本地服务器关键页面 HTTP 200
- Protected PDF Core SHA256 不变

## Windows 实机终验

1. 顶部“导出 → 正式 PDF”可正常进入导出链。
2. `•••` 打开后默认只看到低频的“资料管理 / 单据辅助 / 高级”，不再重复顶部字段、布局等高频按钮。
3. 默认卖方资料可编辑、保存、填充空白、覆盖套用、删除。
4. 个人资料模板可新建、搜索、筛选、编辑、更新、复制、删除、套用。
5. 工作簿“适合宽度 / 整页 / +/- / 更多工作表 / 左字段定位”保持正常。
6. 2+ 页 PDF 页数与右侧预览一致。
