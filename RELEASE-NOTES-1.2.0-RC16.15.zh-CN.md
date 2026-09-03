# HUIDI Docs Community Local V1.2.0 RC16.15

主题：**First Paint + Runtime Stabilization**

本候选版针对 RC16.14 Windows 实机出现的页面无响应、固定页头启动闪烁、Preview 先显示中间红色状态后再进入正式预览进行收口。

## 核心修复

- 首屏增加原子显示门：正式工具栏与稳定分页 Preview 准备完成后再一次性显示。
- 首屏等待期间只显示中性“正在准备单据…”状态，避免旧页头、临时 Readiness 和半成品 Preview 闪烁。
- Issue Navigator 不再观察整个 `document.body` subtree；只观察正式检查 dialog 的小范围 DOM。
- 本地工具栏移除 0/180/520/1100/2200ms 五次重排，改为一次稳定提交 + 一次受控 late settle。
- 后续工具栏只有检测到真实顶层控件新增/删除时才重新校正。
- Layout Policy 移除 250/900ms 重复启动同步，改为 double-rAF 一次 settled sync。
- 保留 RC16.14 Clip-Aware Pagination、Issue Navigator、RC16.13 Page Composer、RC16.12 Template Family、RC16.10 紧凑/标准。

## 验收边界

当前容器 Chromium 对本地页面受运行策略影响，不能把真实 Windows 首屏视觉自动化虚报为 PASS。最终候选仍需 Windows 实机确认：打开编辑器时工具栏只出现一次、Preview 不先闪红色中间态、连续操作不会触发“页面无响应”。
