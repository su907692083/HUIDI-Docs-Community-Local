# HUIDI Docs Community Local V1.2.0 RC16.20

## 主题：Toolbar Interaction Stability

RC16.20 修复 RC16.19 顶部固定工具栏的交互回归：导出/下一步/资料同步等下拉菜单在工具栏滚动裁剪上下文中只露出残影，随后继续点击顶部控件会出现交互失效/假性卡死。

### 根因
RC16.19 为修复页头垂直裁剪，把操作轨设为 `overflow-x:auto + overflow-y:hidden`，而下拉菜单本身是操作轨中的绝对定位子元素，因此展开内容被父容器裁掉。RC16.19 还在窗口/visualViewport/单据切换时持续写入 inline 高度，增加了交互期间的布局反馈。

### RC16.20
- 操作轨不再作为滚动裁剪容器，改为确定性 flex-wrap；空间不足时换行而不是切掉菜单。
- 页头高度完全由 CSS 内容自然撑开，不在点击/缩放过程中反复写 inline min-height。
- `导出 / 资料同步 / 下一步` 统一只允许一个菜单展开，切换单据或窗口失焦时自动关闭。
- 保留 RC16.17 Single Toolbar Owner 的固定顺序和旧 Editor Shell 兼容锁。
- 保留 RC16.18 Live Preview Snapshot Export，不修改 Protected PDF Core。
