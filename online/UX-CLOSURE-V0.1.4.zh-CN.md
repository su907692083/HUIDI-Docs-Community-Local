# HUIDI Docs Online V0.1.4 · UX Closure Contract

本文件锁定 V0.1.4 的“全局交互收口”基线。目标不是增加新模块，而是让现有客户、商品、询盘、邮件、单据、Online 获客和二级页面在数据量变大以后仍然顺手。

## 1. 列表与分页

Community Local 高频列表统一分页：

- 询盘 / 订单
- 客户
- 商品
- 单据
- 邮件草稿

默认每页 50 条，可切换 20 / 50 / 100 / 200。

分页状态保存在：

`huidi_workspace_page_state_v1`

搜索、筛选改变后回到第 1 页。商品勾选状态可以跨页保留。

### 性能边界

V0.1.4 已把高频搜索输入改为只重绘当前列表，并用分页后的 DOM 行替换高频表格结果。

但现有 Workspace 的旧 `renderAll()` Owner 仍然保留：导航切换和部分 Local Bus 数据更新时仍可能先执行一次旧的全局 render，再由 Closure Owner 接管当前表格。V0.1.4 **不是完整虚拟列表重构**，后续若数据达到数万级，再考虑逐步拆除旧全局 render Owner 或引入虚拟滚动。

## 2. 快速详情

询盘、客户、商品采用：

`表格列表 → 点击行 → 右侧快速详情 → 需要修改时才打开完整编辑`

目的：查看资料不再等同于进入编辑模式。

### 询盘快速详情

显示：

- 当前阶段
- 客户
- 预计金额
- 成交概率
- 下一步 / 日期
- 关联商品
- 最近业务事件

主动作：`继续业务`

### 客户快速详情

显示：

- 联系人
- Email / 电话
- 国家 / 币种
- 跟进日期
- 关联询盘

主动作：`做报价`

### 商品快速详情

显示：

- 参考价 / MOQ
- 规格 / 单位 / HS Code / 原产国
- 包装 / 箱规 / 数量 / 毛重
- 关联业务

主动作：`做报价`

可直接进入：`用于 Online 开发客户`

## 3. 二级页面返回上下文

统一使用 Hash 作为 Workspace 页面导航契约：

- `workspace.html#deals`
- `workspace.html#customers`
- `workspace.html#products`
- `workspace.html#mail`
- `workspace.html#documents`

不再使用 `workspace.html?view=...` 作为新的跨页入口。

实体焦点使用：

`huidi_workspace_focus_v1`

从某条询盘 / 客户 / 商品进入二级页面后，返回 Workspace 时尽量重新打开原实体的快速详情。

## 4. 新建单据

`document-start.html` 保持三步结构：

1. 单据类型
2. 业务资料
3. 商品

但选择器升级为适合大量数据：

- 搜索询盘 / 订单
- 搜索客户
- 商品搜索
- `本业务商品 / 全部商品`
- 询盘选中后自动带入客户与关联商品
- 商品跨搜索保留已勾选状态
- 一次最多只渲染当前匹配前 100 个商品，提示继续搜索缩小范围

进入编辑器前写入：

`huidi_document_return_v1`

## 5. 单据编辑器返回

编辑器本体不做大规模重写。

新增轻量导航 Owner：

`public/huidi-editor-return-v1.js`

如果来源是询盘：

`← 返回询盘 · 当前业务`

并回写 `huidi_workspace_focus_v1`，回到 `#deals` 后继续原业务。

如果没有业务上下文：

`← 返回单据中心`

该 Owner 只负责导航，不拥有：

- 单据字段
- 保存
- PDF
- XLSX / CSV
- Document Linkage
- 编辑器状态

## 6. Online 线索分页

Online Lead Workbench 使用真正的服务器分页。

新前端请求：

`GET /api/leads?paged=1&page=1&page_size=50`

支持：

- status
- page
- page_size
- q
- country

服务端使用 SQL `offset / limit` 和 `count`。

为了兼容既有桥接和测试：

`paged=false`

仍然返回旧的数组结构。

## 7. 下一步动作原则

V0.1.4 不新增另一套 Workflow，而是让现有页面继续围绕同一概念：

**当前这条业务下一步做什么？**

- 询盘：继续业务
- 通知：去处理
- 单据：继续下一步 / 返回原询盘
- Online：Next Best Action
- 客户：跟进日期

后续新功能不得为同一业务再创建独立“待办系统”。

## 8. 暂未宣称完成的深层重构

V0.1.4 不把以下事项冒充为已完成：

- Workspace 旧 `renderAll()` 已彻底删除：**未完成**
- 数万行虚拟滚动：**未完成**
- Catalog Studio 常用 / 高级设置彻底重排：**待下一轮低风险收口**
- Local ↔ Online 自动双向同步：**未完成，仍坚持显式同步**
- Online 公共 SaaS 生产部署：**未完成**

这些边界用于避免后续版本重复施工或过度承诺。
