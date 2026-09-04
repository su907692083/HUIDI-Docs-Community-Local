# HUIDI Docs Community Local V1.2.0 RC16.26 专项门禁

## 必须通过

1. `npm run check` 全部 PASS。
2. `npm run check:workspace-r4` PASS。
3. R1 → R2 组合模型必须能复现 Feishu 入口被旧 owner 丢失的历史条件；R4 组合后 13 个导航入口必须全部存在。
4. `workspace-r4` 不允许引入 `MutationObserver`。
5. SOURCE / WINDOWS `public/` 运行树路径与 SHA 完全一致。
6. ZIP CRC、二次解压 missing / extra / SHA mismatch 均为 0。
7. Windows launcher CRLF；PowerShell UTF-8 BOM + CRLF。
8. 8765 正常启动，端口冲突时自动回退到 8766。
9. Feishu status 与主要页面 HTTP 200。
10. 两份 Protected PDF Core SHA 保持既有值。

## Windows 实机重点

- “更多工具 → 经营资料 → 飞书资料”必须可见、可点击并进入真实飞书资料页。
- 首页/询盘之外不再显示重复流程线。
- 条款模板、邮件空状态、产品目录与单据中心首屏空间利用正常。
- 新增/编辑商品时三个高级区单开；长宽高输入可回写箱规并计算 CBM。
- 1366×768、1920×1080、Windows 125% 缩放继续人工验收。
