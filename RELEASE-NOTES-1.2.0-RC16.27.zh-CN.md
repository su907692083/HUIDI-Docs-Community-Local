# HUIDI Docs Community Local V1.2.0 RC16.27

## 主题

**Single Shell Boot + Old-UI Flash Removal + Feishu Modal Overflow Closure**

RC16.27 直接针对 RC16.26 Windows 实机暴露的两个运行时问题：刷新/加载时先出现旧 Workspace，以及飞书配置弹窗产生横向滚动。它不新增业务模块，不修改 Protected PDF Core。

## P0：刷新不再闪旧 UI

根因不是浏览器缓存。`workspace.html` 的静态首屏仍是早期深色 Workspace，R1/R2/R3/R4 需要等 `DOMContentLoaded` 后才完成新版组合，所以浏览器第一帧必然有机会画出旧 UI。

RC16.27 改为：

- HTML 第一帧就带有最终 Workspace R1–R5 class；
- 新增 `workspace-preboot / workspace-booting` 首屏 guard；
- 真实 `.app` 在旧 owner 完成组合前不可见；
- R5 在 R1 → R2 → Feishu → R3 → R4 全部完成后做最终清理和审计，再通过双 `requestAnimationFrame` 一次性显示页面；
- 如果正常组合足够快，轻量启动占位在 120ms 延迟出现前就被移除，避免产生新的明显加载闪屏；
- 2.2 秒安全兜底仅用于脚本异常时避免永久空白，而且即使兜底触发，第一帧也已使用新版浅色 Workspace class，不会退回旧深色壳。

## P0：单壳层组合

R5 最终 owner 会：

- 删除残留的直接 `.nav-section-title / nav.nav` 旧导航壳；
- 只保留最终 `.workspace-r2-nav` 导航组；
- 去重 13 个导航入口；
- 确保飞书资料入口存在、唯一、没有 `hidden / aria-hidden`；
- 将最终审计写入 `data-workspace-r5-audit`，同时记录 missing / duplicates / legacy 数量。

## 飞书边界修正

早期 `community-local-mode.js` 的文本过滤器曾把“飞书资料 / 飞书同步”视作应隐藏的在线生产能力。RC16.24 以后飞书已经是通过本机 same-origin companion server 主动调用的允许数据源，因此 RC16.27 从旧过滤规则中移除这两个词；生产云、AI 网关、会员等仍继续隐藏/阻断。

## 飞书配置弹窗

横向滚动的实际根因是：R3 通用 sticky footer 使用 `margin-left/right:-16px` 来抵消表单容器 padding，但飞书配置弹窗的 `.form-grid` 是 modal 直接子节点，没有同样的 16px 内边距，footer 因而真实撑宽了 32px。

RC16.27：

- 飞书配置表单统一补齐 16px 内容内边距；
- footer 取消负边距；
- modal 强制 `overflow-x:hidden`；
- 小屏自动单列；
- 弹窗打开时锁定背景页面滚动，避免页面滚动条与 modal 滚动条竞争；
- 保留 sticky header/footer 与 Apple-like 视觉层。

## 保留与保护

- RC16.10–RC16.26 retained gates 继续执行；
- RC16.24 Sheets / Bitable / 字段映射 / 主数据复用继续保留；
- RC16.26 飞书入口恢复、单据中心与管理密度继续保留；
- `public/flypigbox-v3-3-2-3-pdf-flow-fix.js` 不修改；
- `public/flypigbox-v3-3-6-24-r1-3a-18-formal-output-gate.js` 不修改；
- R5 不新增 `MutationObserver`；
- Community 包继续不包含真实 `config/feishu.local.json`。
