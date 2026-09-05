# HUIDI Online · Foreign Trade Daily Workbench

当前阶段：**Daily Workbench Baseline · Real SMTP · Business Bridge**

HUIDI Online 不再定位成“获客附属页”或“单据联网版”。它的目标是成为外贸业务员每天打开的主工作台：

**今天该跟谁 → 找新客户 → 查客户 → 写/发邮件 → 看回复 → 转询盘 → 做报价 → 推订单 → 做目录/单据 → 看提醒 → 继续下一步。**

Community Local 保留为本地优先 / 离线补充工作模式；Online 承接联网获客、真实邮箱、团队协作、在线数据 Provider、通知与后续情报能力。

## 当前已经形成的主链

`Product / Product Brain → Lead Search → A/B/C/D Scoring → Buying Signals → Due-Diligence → Contact → AI Draft → Human Review → Real SMTP → Follow-up / Reply → Customer / Inquiry → Catalog → Quotation → PI → Contract → CI / Packing List`

并支持：

`Online → Community Local`：`huidi.business.bundle/v1`

`Community Local → Online`：`huidi.local.business.status/v1`

## Daily Workbench

Online 首页已经使用真实数据库汇总：

- 今日已发送邮件
- 待处理线索
- 客户回复
- 已转询盘
- 已配置 / 已连接邮箱
- 待跟进事项
- 最近业务活动

用户进入系统后先处理“今天”，找客户只是工作台的一部分。

## 真实 SMTP

SMTP 已开放，不再停留在 review-only。

支持：

- 多发送邮箱
- SMTP Host / Port
- STARTTLS / SSL/TLS / Plain
- 用户名 + SMTP 密码 / 应用专用密码
- `HUIDI_SECRET_KEY` 加密保存 SMTP 凭据
- SMTP 连接测试
- 真实单封发送
- 人工确认门
- 每邮箱每日额度
- 最小发送间隔
- 退订 / 黑名单
- 客户已回复 / 已转正式业务后停止冷开发
- 成功 / 失败发送日志
- Message-ID
- Lead Timeline 回写
- 发送成功后 Lead 自动进入 `contacted`

真实 SMTP 发送不是无治理群发器：发送能力完整开放，但所有发送继续经过业务规则和审计。

## 启动 Online

```bash
cd online/api
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

复制 `online/.env.example` 后至少配置 `HUIDI_SECRET_KEY`。示例文件保持空值，请自行生成并长期保存一个稳定的长随机字符串：

```env
HUIDI_SECRET_KEY=
```

然后启动：

```bash
uvicorn app.daily_app:app --reload --host 0.0.0.0 --port 8080
```

打开：

`http://127.0.0.1:8080/`

Docker 也使用 `app.daily_app:app`。

## 已经接通的业务能力

- Product Brain
- Campaign / ICP
- 潜在客户搜索
- 透明评分
- Buying Signals
- 客户背调初筛
- 联系人 / 业务邮箱
- AI 开发信
- 人工确认
- 真实 SMTP
- 邮件治理
- 跟进时间线
- 客户 / 询盘桥接
- 产品目录
- Quotation
- Proforma Invoice
- Sales Contract
- Commercial Invoice
- Packing List
- Community Local 双向业务状态桥
- 全局通知 / 下一步动作

## 产品原则

1. **Online 是主产品，不是 Local 的附属插件。**
2. **单据工作台只是业务推进的一部分。**
3. 高频任务必须在一页完成或一跳到达。
4. 每个模块都要回到真实 `Customer / Deal / Product / Lead` 上下文，不做孤立工具。
5. 可以自动化，但不能丢掉证据、来源、状态和审计。
6. 能真实调用的联网能力就接真实 Provider，不用装饰性 Demo 冒充完成。
7. 复杂配置隐藏到设置层，业务员日常界面只看到“下一步”。

## 后续继续施工

下一层会继续把联网能力做实，而不是阉割：

- Gmail / Outlook OAuth2
- 收件箱 / 回复识别 / Thread
- 自动 Reply-stop
- 发送序列与队列
- Bounce / Unsubscribe 自动回写
- 真实工商 / 海关 /贸易数据 Provider
- 地图获客
- Trade Intelligence
- HS Code / 关税
- 汇率
- 船期 / 物流
- 团队账号 / 权限 / 协作
- Online Product Brain 服务器持久化

第三方项目继续只按各自许可证允许的范围融合，边界见 `THIRD-PARTY-NOTICES.md`。
