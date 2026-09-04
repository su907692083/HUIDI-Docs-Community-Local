# HUIDI Docs Community Local V1.2.0 RC16.17

主题：**Single Toolbar Owner / 固定页头单一所有权**

RC16.17 专修编辑器顶部固定工具栏在刷新和切换 QT/PI/SC/CI/PL 时发生的按钮顺序跳动、二次重排和视觉闪动。

## 核心修复
- 新增 `HUIDIToolbarOwner`，顶部工具栏只允许一个排序权威。
- 固定槽位：导入资料 → PDF/表格 → 单据类型 → 保存 → 资料同步 → 检查 → 模板/样式 → 单据模式 → 收款资料（适用时）→ 字段设置 → 布局 → 导出 → 下一步 → 清空 → 更多 → 本地保存状态。
- 单据切换仅更新标题、显隐和 active 状态，不再移动已有 DOM 节点。
- 历史 Editor Shell 在 Toolbar Owner 锁定后只能补建缺失控件，不能重新 append 整组按钮。
- 移除 Editor Shell 启动后的第二次 600ms header rebuild。
- 移除 Local Bridge 的 late toolbar settle/observer 排序所有权。
- `收款资料`等后加载控件使用固定槽位插入，不再推挤其他按钮。
- 桌面端固定左侧标题宽度，右侧操作区 nowrap + 横向溢出，避免标题长度变化造成整体位移。

RC16.16 的 advisory-only 导出、RC16.15 首屏稳定、RC16.14 问题定位、RC16.13 Page Composer、RC16.12 Template Family 全部保留。
