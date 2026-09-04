# RC16.10 Validation

- UI：仅显示 `紧凑 / 标准` 两个排版密度按钮。
- 五类单据均使用同一 density policy；偏好按单据独立保存。
- 紧凑模式不修改 PDF 物理页宽、高、页边距，也不触发 force-one-page。
- Workbook 与 PDF Preview 使用同一 compact/standard 状态。
- XLSX `fitToHeight` 固定为 0，紧凑不等于强制一页。
- RC16.9 单分页权威和多页安全回退继续保留。
- 静态语法、package/manifest、runtime parity、ZIP CRC 和 Windows loopback smoke 在封包前重新执行。

状态：TEST CANDIDATE。
