# HUIDI Docs Community Local V1.2.0 RC16.26

## 主题

**Workspace Runtime Composition Repair + Management Density**

RC16.26 直接针对 RC16.25 Windows 实机截图收口，不增加新的业务模块，不修改 Protected PDF Core。

## P0：飞书资料入口恢复

RC16.24 的飞书 Sheets / Bitable 数据工作区并未被删除；RC16.25 的实际问题是旧 Workspace R1 导航 owner 重建侧栏时没有认识后来加入的 `feishu`，导致按钮先被摘除，R2 后续无法再次挂回。RC16.26 不回写旧 R1 文件，而是在所有旧层之后新增 `workspace-r4` 最终组合 owner：

- 如果完整组合后缺少飞书入口，则重建飞书按钮并挂回“经营资料”；
- 恢复按钮拥有明确的 Feishu view 切换行为；
- 运行时检查 Home / Deals / Customers / Products / Documents / Catalog / Brands / Templates / Mail / Feishu / Backup / Recycle / Help 共 13 个入口和目标 view 是否同时存在；
- 新门禁用 R1 → R2 → R4 组合模型复现 RC16.25 的丢失条件，并验证 R4 最终恢复。

## 管理密度

- 单据中心去掉每行重复的完整单据血缘文本，保留来源单号作为短提示；主表集中显示类型、单号、客户、金额、更新时间与下一步。
- 条款模板改为横向紧凑管理列表，减少一张卡片只占页面左侧小区域的问题。
- 邮件草稿空状态降低高度，避免零数据时出现大面积无意义白屏。
- 产品目录无商品时只保留一个开始面板；有商品后采用“商品内容优先、制作顺序次要”的布局。
- 普通资料管理页隐藏重复业务流程线，仅首页和询盘/订单页保留。
- 本地备份提醒只有真正达到提醒条件时常驻显示。

## 商品建档

- 图片区域继续缩小。
- HS Code 从快速报价基础区移到“报关与供应资料”。
- 报关 / 包装 / 来源三个高级区改为单开手风琴，避免全部展开后再次形成超长表单。
- 外箱尺寸增加 长 / 宽 / 高 三格输入 UI，并同步到原 `carton_size` 字段，继续兼容既有数据与 CBM 自动计算。

## 保留与保护

- RC16.10–RC16.25 retained gates 继续执行。
- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js` 不修改。
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js` 不修改。
- 不引入 MutationObserver。
- Community 包继续不包含真实 `config/feishu.local.json`。
