# HUIDI Docs Community Local V1.2.0 RC16.22 专项门禁

## 目标

只施工 Workspace R1：主页信息架构、导航分组、可钻取统计、管理页密度、非阻断详情 Drawer 与窗口一致性。单据编辑器/PDF 输出核心保持保护状态。

## 必须通过

- `npm run check`
- `npm run check:workspace-r1`
- Workspace R1 JS syntax
- Workspace HTML 本地依赖
- 五组导航 IA 存在
- 首页四组行动统计存在
- 业务/客户/商品/单据快速归类存在
- 业务/客户/商品/单据右侧详情 Drawer 存在
- Workspace R1 不引入 `MutationObserver`
- SOURCE/WINDOWS public runtime exact parity
- Protected PDF core SHA 保持 RC16.21
- ZIP CRC / re-extract tree parity

## Windows 实机建议验收

1. 首页统计点击后进入正确页面并只显示对应业务。
2. 客户/商品/业务/单据表格点击空白区域打开右侧详情，不影响行内按钮。
3. Drawer 打开后仍能查看左侧列表，Esc/× 可以关闭。
4. 新建/编辑客户与商品窗口头尾不抖动，保存按钮始终可到达。
5. 1366×768、1920×1080、Windows 125% 缩放下导航、表格与 Drawer 不互相遮挡。
6. 原报价→PI→合同→CI→装箱及 PDF/XLSX/CSV 导出回归不变。
