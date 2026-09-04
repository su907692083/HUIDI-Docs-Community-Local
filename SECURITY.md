# Security

不要在 Issue、截图或日志中提交真实客户资料、银行信息、API Key、密码或生产数据库凭据。

Community Local 默认不包含 HUIDI 生产密钥。发现安全问题时，请先使用项目维护者提供的私密安全渠道，而不是公开披露可直接利用的细节。


## RC16.6.4 可选飞书协作同步

- 真实 App Secret 只允许写入本机/自托管服务端私有 `config/feishu.local.json`。
- `config/feishu.local.json` 已加入 `.gitignore`，不得提交到 GitHub、Issue、日志或公开发布包。
- 浏览器页面只调用同源 `/api/feishu/*`，不持有 App Secret，也不直接请求飞书开放平台。
- 飞书协作快照不是灾难恢复备份；换电脑 / 清缓存仍使用完整 JSON 备份。
