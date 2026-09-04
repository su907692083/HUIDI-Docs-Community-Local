# HUIDI Docs Community Local V1.2.0 RC16.25 专项门禁

## 自动门禁

- `npm run check`：PASS（最终封包前重新执行）。
- JS/CJS syntax scan：PASS。
- HTML 本地依赖：PASS。
- RC16.10–RC16.24 retained gates：必须继续 PASS。
- RC16.25 Workspace R3 gate：必须 PASS。
- 新视觉层仅由 `body.workspace-r3` 持有，不进入 editor / PDF runtime。
- RC16.25 JS 禁止 `MutationObserver`，避免重现 body-wide observer 无响应问题。
- Protected PDF Flow Core / Formal Output Gate SHA 必须保持历史锁定值。

## 本轮交互门禁

1. 左侧只保留一个 `＋ 新建`，不再同时平铺四个新增按钮。
2. 非首页不重复显示全局顶部新增操作。
3. 客户/商品页只突出一个主动作，导入/导出/低频操作进入 `•••`。
4. 新增客户首屏仅显示常用字段，高级客户/税务/收货资料按需展开。
5. 新增商品首屏仅显示报价常用字段，包装/报关/来源按需展开。
6. 已有高级字段的客户/商品再次编辑时对应分组自动展开。
7. 飞书协作快照不再占据备份页面主区域，移动到飞书资料。
8. CSV 空状态按钮不得被压成逐字竖排。

## Windows 实机边界

沙盒可验证静态、启动与 HTTP 行为，但最终视觉仍需 Windows Edge/Chrome 复验：

- 1366×768、1920×1080、Windows 125% 缩放；
- 首页首屏密度与左侧导航；
- 新建/编辑客户渐进式表单；
- 新建/编辑商品渐进式表单；
- `•••` 菜单不被裁切、不与 Drawer/Modal 叠层；
- 飞书资料页与备份页语义清晰；
- 夜间模式可读性。
