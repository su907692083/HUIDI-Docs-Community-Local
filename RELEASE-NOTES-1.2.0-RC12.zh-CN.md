# HUIDI Docs Community Local V1.2.0 RC12

RC12 是 RC11 之后的公开发布收口版本。目标不是继续增加业务功能，而是把已经稳定的 Community Local 候选版本整理成更适合 GitHub 公开维护、下载和反馈的版本。

## 本轮收口

- 统一公开版本标识到 `1.2.0 RC12`：Windows 启动器、公开配置、本地模式元数据、备份元数据与离线/映射说明不再残留 RC5 / RC9 的对外版本号。
- 保留 RC11 的“适合宽度 / 整页 / 手动缩放 / 左右字段定位 / 更多工作表”工作簿交互，不重新改写该链路。
- 保留 RC9 起建立的 WYSIWYG 多页 PDF 导出架构；两份受保护 PDF 核心文件内容不变。
- 增加 GitHub Actions 基础校验：push / pull request 自动运行 `npm run check`。
- 增加 GitHub Bug Report、PR 模板与公开反馈安全提示，降低社区反馈成本。
- README 改为面向普通 Windows 用户的下载与产品说明页，同时明确 Source Available 与商业授权边界。

## 仍然保持的边界

- 默认 local-only；不包含 HUIDI 生产 Supabase、AI Gateway、邮件网关、通知网关、Founder OS Bridge、管理后台、会员与计费配置。
- 历史 `flypigbox-*` 文件名、全局对象和浏览器 storage key 继续作为兼容层保留，不做破坏性全局重命名。
- Community Local 仍为 Source Available，不宣称为 OSI Open Source。

## Windows 验收重点

1. 双击 `START-HUIDI-LOCAL.cmd` 能正常打开 `http://127.0.0.1:8765/`。
2. 100% 浏览器缩放下，工作簿默认“适合宽度”，左侧字段可定位右侧单元格。
3. “整页”、`+ / -`、更多工作表菜单正常。
4. 两页及以上 PDF 与右侧 PDF 预览页数、内容一致。
5. 完整备份导出中的版本元数据为 `1.2.0-RC12`，旧备份仍可恢复。
