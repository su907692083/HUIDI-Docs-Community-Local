# HUIDI Docs Community Local V1.2.0 RC16.5

RC16.5 是稳定性与正式输出完整性收口版本，不加入离线翻译。

## P0 修复

1. **本地保存真实性**
   - 完整单据迁移至 IndexedDB；localStorage 仅保留轻量索引。
   - 大型 Data URL 图片、签名、印章进入 assets store。
   - 保存事务失败时明确显示失败，不再出现“浏览器报错但界面显示保存完成”。

2. **PDF 单一执行链**
   - 正式 PDF 只保留 canonical `FlypigBOXApp.exportPdf()` 作为最终执行器。
   - 移除 RC16.3 第二套 PDF renderer 的运行入口。
   - 导出不再先触发大镜像保存。

3. **客户输出与内部状态隔离**
   - 正式客户纸张不再显示 `INTERNAL REVIEW · 未完成`。
   - 内部检查状态只留在纸张外的检查区域。

4. **多语言金额区收口**
   - Subtotal / Total / 参考费用使用统一 `HUIDIDocI18n`。
   - PDF、结构化字段、表格工作簿继续使用同一语言状态。

## 兼容迁移

首次打开 RC16.5 时，会读取 RC16.4 及更早版本的 `flypigbox_workspace_document_mirror_v1`，逐条写入 IndexedDB 并回读校验。校验通过后才把 localStorage 中的大对象替换为轻量索引。

## 不在本版范围

- 离线机器翻译；
- 新单据类型；
- AI 云服务；
- PDF 分页算法重构；
- 工作簿核心重构。
