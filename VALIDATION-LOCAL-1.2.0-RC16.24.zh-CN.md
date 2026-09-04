# HUIDI Docs Community Local V1.2.0 RC16.24 专项门禁

- Feishu Data Workspace 资源与导航：PASS
- 客户 / 商品“从飞书导入”入口：PASS
- 保存字段映射：PASS
- 客户 / 商品主数据更新与来源追踪：PASS
- Node Companion Server `/api/feishu/source/list`：静态契约 PASS
- Node Companion Server `/api/feishu/source/inspect`：静态契约 PASS
- Windows PowerShell Companion Server 同等 API：静态契约 PASS
- Drive 文件夹列出 API 路径：PASS
- Sheets 工作表 + values 读取路径：PASS
- Bitable tables + records 读取路径：PASS
- `config/feishu.local.json` 不进入公开包：PASS
- RC16.10–RC16.23 retained gates：需随 `npm run check` 再跑
- Protected PDF Core：SHA 门禁保持

## 实机边界

真实飞书权限和真实业务表内容取决于用户自己的飞书自建应用、管理员权限配置和目标文件授权。最终应在 Windows + Edge/Chrome 使用真实飞书账号验证：

1. 配置 App ID / App Secret；
2. 粘贴真实 Sheets 链接并读取；
3. 粘贴真实 Bitable 链接并读取；
4. 检查自动字段映射；
5. 导入商品 / 客户并刷新后仍存在；
6. 再次读取同表时复用保存的映射；
7. 从导入后的客户 / 商品直接做报价；
8. 未授权文件显示明确权限错误，不泄露 Secret；
9. 断网后本地业务、历史单据和完整备份继续工作。
