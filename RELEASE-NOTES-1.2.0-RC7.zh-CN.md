# HUIDI Docs Community Local V1.2.0 RC7

RC7 是针对 RC6 实机使用中暴露的编辑器状态与正式输出问题的收口版本。

## 本轮修复

- 单据类型改为唯一状态链：`type`、`doc`、编辑器字段、顶部下拉与 PDF 预览保持一致。
- 修复“报价单标题 + PI/CI 预览”以及切换单据后跳回其它单据类型的问题。
- “下一步”优先使用正式 Document Linkage 转换器，CI 自动移除收款资料，PL 自动移除金额/价格/收款字段。
- Community Local 正式导出统一到一套 Formal Output Gate；移除本地版重复的旧 alert/confirm 阻断。
- PI / 销售合同顶部直接提供“收款资料”入口；其它单据不再因隐藏的收款字段形成死路。
- 收款资料只有在 PI / 销售合同明确启用且已填写部分账户资料时才做完整性阻断。
- PDF 离屏捕获改为读取完整 scrollWidth / scrollHeight，并在捕获宿主解除 overflow 裁切，防止页面最后一行、右边缘或底部被静默截断。
- 浏览器标题跟随当前单据类型显示 HUIDI。

## RC7 验证重点

1. 报价单 → PI → 销售合同 → CI → PL 连续切换，URL 的 `type` 与 `doc` 始终一致。
2. PI / 合同能直接找到“收款资料”；CI / PL 不因收款资料阻断。
3. PDF / 客户 Excel / 数据 Excel / CSV 只出现同一套正式检查。
4. 多页 PDF 的表格末行、右侧列、页尾内容完整，不应出现裁切。

当前仍为 Release Candidate，请先使用脱敏业务资料完成实机验证后再替换公开 RC6 Release。
