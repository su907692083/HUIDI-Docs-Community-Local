# HUIDI Docs Community Local V1.2.0 RC16.6.3

RC16.6.3 是 RC16.6.2 之上的最终单据语言、CI/PL 版式与编辑性能收口候选。

## 本轮范围

- 正式客户单据固定字段统一走目标语言；修复 CI 的 Exporter/Buyer/Consignee 与声明正文、PL 的 Carton No./Dimensions 等英文残留。
- 仅保留 B/L、ETD、ETA、MOQ 等真正国际缩写为语言不变项；Invoice No.、Packing List No.、Carton No.、Dimensions 等普通字段恢复本地化。
- 输入预览改为 160ms burst 合并；sync-core 不再在每个按键后启动第二次 Preview。
- PDF i18n 后处理从整页 MutationObserver 改为 canonical `HUIDI:preview-rendered` 事件驱动；工作簿仅保留窄范围、节流后的 childList 观察。
- 低商品量 CI / PL 适度提高字号、区块间距和表格行高，减少“微缩后台表格”观感。
- 保留 RC16.6 商品列宽/分页/飞书、RC16.6.1 Windows 启动器、RC16.6.2 Preview Runtime 热修。

## 未加入

- 离线翻译引擎。
- 新单据类型或 AI 能力。
- PDF Protected Core 修改。
