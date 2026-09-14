# HUIDI Online 公网账号与数据隔离契约

## 目标

公网 Online 必须先登录再进入业务工作台。用户登录后只能处理自己所在工作区的客户、潜在客户、联系人、邮件、产品、询盘、跟进、单据和设置。

## 账号与工作区

- 邮箱自助注册：创建新的 Organization + Owner。
- 手机号首次验证码登录：创建新的独立个人 Organization + Owner。
- 微信 / 飞书首次登录：创建新的独立个人 Organization + Owner。
- 公开注册永远不自动加入历史 / 平台 Organization #1。
- 团队成员由当前 Organization 的老板 / 管理员添加，继续使用现有 TeamMember 角色体系。

## 数据隔离

控制面只保存 Organization、TeamMember、Session 和认证身份等账号元数据。

业务数据继续使用现有 tenant_storage：

- organization #1 使用历史主业务库；
- SQLite 模式下 organization #2+ 各自使用独立数据库文件；
- PostgreSQL 多公司部署使用 HUIDI_TENANT_DATABASE_URL_TEMPLATE 为每个 organization 提供独立数据库。

所有业务 API 在 HUIDI_TEAM_ACCESS=1 时必须经过登录中间件。未登录用户不能读取 / 写入客户、线索、邮件、产品、询盘或单据 API。

## 登录方式

- 邮箱 + 密码：内置。
- 忘记密码：一次性 Token，30 分钟失效；重置后撤销该账号所有旧 Session。
- 手机号：6 位 OTP，10 分钟失效，60 秒内禁止重复发送，最多 5 次错误尝试；需要真实 SMS Provider。
- 微信扫码：微信开放平台 Web OAuth；需要 AppID / AppSecret / 回调地址。
- 飞书登录：飞书 Web OAuth；需要 AppID / AppSecret / 回调地址。

## 防误合并

外部 OAuth 不允许仅因为“邮箱看起来相同”就自动并入现有 HUIDI 账号或团队。

同一外部身份只有在 provider + subject 已经绑定时才返回原账号。首次身份一律建立独立工作区。未来如增加“绑定登录方式”，必须要求用户已经登录当前账号并显式确认。

## 公网安全

- Session 使用 HttpOnly Cookie。
- production 模式 Cookie 使用 Secure。
- 业务 API 默认不是公开接口。
- API Docs / OpenAPI 在登录门禁启用时不再对匿名用户公开。
- 公共 auth/status 不返回成员数、公司数等其他账号信息。
- 密码使用 PBKDF2-SHA256。
- 密码重置 Token 和 OTP 不明文入库。
- 忘记密码响应不透露某个邮箱是否存在。

## 外部能力边界

代码完成不等于第三方平台已开通：

- 认证邮件需要 HUIDI_AUTH_SMTP_*。
- 手机 OTP 需要 HUIDI_SMS_WEBHOOK_* 或 Twilio 配置。
- 微信需要 HUIDI_WECHAT_*。
- 飞书需要 HUIDI_FEISHU_*。

未配置时 UI 显示为未启用，不允许用假验证码 / 假 OAuth 冒充可用。
