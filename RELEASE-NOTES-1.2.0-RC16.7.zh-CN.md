# HUIDI Docs Community Local V1.2.0 RC16.7

RC16.7 是 RC16.6.5 之上的 **Unified Local Core & Workbench Linkage / 本地主数据与业务工作台关联收口候选**。

## 本轮范围

本轮不加入离线翻译，不扩展新的单据类型，也不修改两份 Protected PDF Core。重点是减少工作台、编辑器、Catalog Studio 与单据链之间的重复数据 owner。

## 主要变化

- 新增 `public/huidi-local-core-rc167.js`，提供统一 Customer / Product / Deal / Brand / Template / Mail Repository、Document Context、Business Event 与跨标签页 Local Bus。
- 新建单据统一清除旧 `huidi_local_doc_id_v1`、打开单据暂存与 chain state，避免从第二入口新建时错误复用旧 Document ID。
- 编辑器 Local 客户库改用 `huidi_local_customers_v1`；旧 `flypigbox_b2b_customers_v1` 只作为兼容迁移源。
- 工作台客户字段扩充：Website / Country Code / Registration No. / Tax ID / VAT / EORI / Bill To / Ship To / Consignee / Notify Party / Destination Port。
- 工作台商品字段扩充：Customs Description / Country of Origin / Package Type / Carton Size / Qty per Carton / N.W. / G.W. / CBM / Dimensions / Shipping Marks。
- Catalog Studio 本地保存与读取改接统一 ProductRepository。
- 编辑器新增“资料同步”：
  - **从工作台更新当前单据**：显式读取最新主数据到当前草稿；
  - **同步补充资料回工作台**：显式把当前关联客户与商品的补充信息回写主数据。
  - 已保存的历史单据仍保持 Snapshot，不会因主数据变化而静默改写。
- Local 模式停用旧 `flypigbox_b2b_autosave_v1` 全局 Autosave owner，当前单据继续由 `HUIDILocalSaveCoordinator` + Document ID 保存。
- 移除“打开什么单据就自动改变业务阶段”的逻辑。创建/保存/打开 PI、合同、CI、PL 不再等价于 PI 已确认、订单已确认或已出运。
- 新增显式 Business Event Service；只有 `pi.confirmed`、`contract.confirmed`、`shipment.departed` 等明确业务事件才推进阶段。
- DocumentRecord 与 localStorage 轻量索引补充：deal/customer/product/brand/template/linkage/source/status/amount/currency/date/customer PO/internal order/ETD/ETA。
- 首张独立单据也生成稳定 linkage group；后续“下一步”继续沿用同一关联链。
- 工作台单据中心开始按 linkage group / deal 显示 QT → PI → Sales Contract → CI / PL 关系和来源单号。
- 新增 `BroadcastChannel('huidi-local-bus-v1')`；工作台、编辑器与 Catalog Studio 可跨标签页感知 Customer/Product/Deal/Document 等变化。

## 数据边界

RC16.7 是“统一 owner 的第一阶段”。完整 Documents/Assets 继续使用 IndexedDB；客户、商品、业务、品牌与模板当前仍主要保存在 canonical localStorage repository。它们尚未全部迁移到 HUIDI Local DB v2，因此本轮不宣称“所有业务数据已进入 IndexedDB”。

飞书仍是**可选在线协作快照**，HUIDI Local 仍是 Source of Truth；本轮没有加入飞书双向 merge/conflict model。

## 验收重点

1. 从工作台、新建单据页分别新建单据，不得复用上一张单据 ID。
2. 工作台客户中心与编辑器客户库显示同一客户；编辑器保存客户后工作台能看到。
3. Catalog Studio 保存商品后，工作台商品资料能看到；编辑器“资料同步”可显式拉取。
4. 修改工作台主数据后，已打开/已保存历史单据不得自动被覆盖，只提示可手动同步。
5. 打开 PI / 合同 / CI / PL 不得自动改变业务阶段。
6. QT → PI → 合同 → CI / PL 后，单据中心应显示同一业务链与来源关系。
7. 多标签页打开工作台 / 编辑器 / Catalog Studio 时，保存主数据后其他页面能收到更新提示/刷新。
