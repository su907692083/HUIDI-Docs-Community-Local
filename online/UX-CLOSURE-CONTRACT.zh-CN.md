# HUIDI Docs Online / Community Local · UX Closure Contract V0.1.4

本文件固定当前开发线的高频交互与大数据量规则。后续新增获客、背调、邮件、情报、地图等能力时，不得绕开这些 Owner 再造第二套列表、第二套分页或第二套路由。

## 1. 列表与分页

高频数据表统一采用：

- 默认 50 行 / 页
- 可选 20 / 50 / 100 / 200
- 上一页 / 当前页 / 下一页
- 搜索或筛选变化后回到第一页
- 只渲染当前页，不把全部记录一次性写入 DOM
- 商品跨页勾选必须保持，不因翻页丢失

Community Local 首批分页 Owner：

- 询盘 / 订单
- 客户
- 商品
- 单据
- 邮件草稿

Online Lead Workbench 使用服务器分页：

- `/api/leads?paged=1&page=1&page_size=50`
- 保留旧 `/api/leads` 数组响应兼容既有调用
- 状态筛选切换时回第一页

## 2. 页面渲染

主工作台不应因用户在一个列表输入搜索词而重绘所有模块。

新增交互应优先：

`当前 View → 当前列表 → 当前分页`

而不是：

`任意输入 → renderAll() → 全站 DOM 重建`

旧 Owner 暂时保留兼容，`huidi-workspace-closure-v1.js` 负责接管高频表格的最终可见投影。

## 3. 快速详情

客户、商品、询盘采用统一右侧快速详情抽屉：

- 点击行即可查看
- 查看不等于编辑
- 完整编辑仍进入原编辑弹窗
- 快速详情优先显示“下一步”和业务关联，而不是重复展示整张表

### 询盘详情

优先显示：

- 客户
- 阶段
- 金额 / 概率
- 下一步与日期
- 关联商品
- 最近业务进度
- 继续业务

### 客户详情

优先显示：

- 联系人 / 邮箱 / 电话 / 国家
- 跟进日期
- 关联询盘数量与最近业务
- 做报价 / 编辑

### 商品详情

优先显示：

- 主图 / 名称 / SKU / 分类 / 规格
- 参考价格 / MOQ / HS Code
- 关联业务数量
- 做报价
- 用于 Online 开发客户
- 完整编辑

行内按钮应保持克制，低频操作进入 `•••` 或详情层。

## 4. 二级页面返回上下文

所有二级页面不能只提供泛化的“返回工作台”。

统一使用：

- `huidi_document_return_v1`：进入编辑器前保存来源
- `huidi_workspace_focus_v1`：返回列表后重新定位实体
- Workspace 路由统一采用 Hash

标准路由：

- `workspace.html#deals`
- `workspace.html#customers`
- `workspace.html#products`
- `workspace.html#mail`
- `workspace.html#documents`

禁止继续新增 `workspace.html?view=...`。

从询盘进入单据编辑器时，顶部返回入口应表现为：

`← 返回询盘 · 当前业务`

从单据中心进入时：

`← 返回单据中心`

Editor Return Owner 只拥有导航，不得接管保存、PDF、字段或单据链路。

## 5. 新建单据页

`document-start.html` 继续维持三步结构，但必须适配大量客户 / 商品：

1. 选单据类型
2. 搜索并选询盘 / 客户 / 品牌 / 条款
3. 搜索并选商品

要求：

- 可搜索询盘
- 可搜索客户
- 可搜索商品名称 / SKU / 型号 / 规格
- 关联询盘后优先展示本业务商品
- 跨搜索保留已勾选商品
- 进入 Editor 前写入返回上下文

## 6. Product Brain 交接

从商品快速详情进入 Online 时，应带 `productId` 直接定位当前商品。

Community Local 仍是正式商品主数据 Owner；Online Product Brain 不得静默上传整库商品。

## 7. Online Lead Workbench

线索列表继续保持表格优先：

- A/B/C/D
- 公司
- 国家
- 匹配分
- 匹配理由
- 联系人 / 邮箱
- 背调状态
- 开发状态

详细的 Buying Signals、Open Threads、背调、开发信、跟进、时间线放右侧详情，不拆成大量二级页面。

## 8. Next Action

各模块统一围绕“下一步”表达：

- 询盘：继续业务
- 通知：去处理
- Online：Next Best Action
- 单据：继续下一步
- 客户：下一次跟进

不得让用户在完成一个动作后重新判断“下一步去哪”。

## 9. 性能边界

后续性能施工遵守：

- 搜索只刷新当前列表
- 图片使用 `loading=lazy`
- 大量列表不一次性 DOM 展开
- Online 使用服务端分页
- Local 当前采用分页投影；数据规模继续上升时允许在不改变 UI 契约的前提下升级虚拟滚动 / IndexedDB 查询

## 10. CI 门禁

当前 Online V0.1 Check 必须继续覆盖：

- Python compile
- Lead Engine / pagination regression
- FastAPI import
- Online JS syntax
- Product Brain regression
- Workspace Closure JS syntax
- Notification Center regression
- Online → Local Bridge regression
- 二级页 inline JS syntax
- Editor Return syntax
- 命名业务 UX contract checks
- no tracked local secrets

### 不得回退

后续提交不得：

- 恢复 `workspace.html?view=` 路由
- 恢复全部线索一次性拉取作为 Online 默认路径
- 删除默认 50 行分页
- 让商品翻页后丢失勾选
- 把快速查看重新强制变成完整编辑
- 删除编辑器返回原业务上下文
- 为新模块复制第二份客户 / 商品 / 询盘 Owner
