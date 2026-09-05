# HUIDI Docs Online · Lead Workbench

当前阶段：**V0.1.4 UX Closure · Stage 2**

Community Local 商品页提供“用于 Online 开发客户”入口；商品进入 Product Brain 后，可继续 Campaign Brief、潜在客户搜索、透明评分、Buying Signals、背调、开发信、跟进，并通过 Business Bridge 回到同一个客户 / 询盘 / 商品 / Catalog / Quotation / PI / Contract / CI / Packing List 业务链。

本轮继续完成：

- Community Local：询盘 / 客户 / 商品 / 单据 / 邮件分页
- 客户 / 询盘 / 商品统一快速详情与“下一步”
- Catalog 常用设置 / 高级设置分层
- 邮件草稿显示 customerId + dealId 业务关联
- Online → Local：`huidi.business.bundle/v1`
- Local → Online：`huidi.local.business.status/v1`
- Local → Online 采用显式确认，不后台自动上传本机业务数据
- Online Lead 仍使用服务器分页
- 通知、Product Brain、五类正式单据继续使用既有 Owner

## 启动 Online 开发版

```bash
cd online/api
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.online_app:app --reload --host 0.0.0.0 --port 8080
```

打开：

`http://127.0.0.1:8080/`

`app.online_app:app` 在原 `app.main:app` 的 Lead Workbench 基础上增加 Local → Online 业务进度确认接口；Docker 也使用同一入口。

## 数据边界

Product Brain、Lead / Customer Memory、Runtime Context 三层分离。Community Local 仍是正式客户、商品、询盘和本机单据数据 Owner。

Local → Online 不会静默上传整个客户库、商品库或本机历史。只有用户在某条 Online 来源业务里主动点击“同步进度到 Online”，Online 再次确认后，才把当前 Deal 的阶段、下一步和必要关联 ID 写入对应 Lead 时间线。

获客 A/B/C/D 评分与本地成交阶段保持分离；订单推进不会反向篡改获客匹配分。

第三方项目仅按各自许可边界进行研究和重写，见 `THIRD-PARTY-NOTICES.md`。

## 仍未开放

- 自动批量冷邮件发送
- 后台静默 Local → Online 上传
- 公网 SaaS 多租户
- 生产级邮箱 OAuth / SMTP 治理
- 真实工商 / 海关背调 Provider
- 地图获客与 Trade Intelligence 正式 Provider

下一阶段优先：邮箱账户与发送治理 → 真实背调 Provider → Online Product Brain 服务器持久化 → 地图找客户 → 外贸情报。
