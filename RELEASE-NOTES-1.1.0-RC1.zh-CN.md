# HUIDI Docs Community Local 1.1.0 RC1

这是面向“C：电脑本地运行、尽量不联网”需求整理的首个本地开源候选版。

## 本轮重点

- 默认 Local-only，不连接 HUIDI 生产 Supabase、AI Gateway、邮件、通知、Founder OS 或商业后台。
- 关键页面 CSP 为 `connect-src 'self'`，并增加 fetch / XHR / WebSocket / EventSource / sendBeacon 跨域阻断。
- Windows 一键启动优先使用系统 PowerShell，只监听 `127.0.0.1:8765`；普通用户不再要求安装 Node.js。
- 本地工作台提供客户、商品、本地单据记录、JSON 备份 / 恢复。
- 本地新建单据支持报价单、PI、商业发票、装箱单、销售合同。
- 单据编辑、浏览器本地草稿、模板、PDF、表格输出继续保留。
- 产品目录改为本地解锁，品牌页头 / Logo / 主题 / 页脚不再依赖会员状态。
- Excel 读取优先使用包内本地组件；移除在线 CDN 回退。旧 `.xls` 请先另存为 `.xlsx` / CSV。
- 产品目录 PDF 使用包内 html2canvas / jsPDF，不从 CDN 加载。
- 清除生产域名、生产 Project Ref、生产 API 地址和凭据标识。
- 移除旧 Community 叠加脚本、旧 PATCH manifest 和若干云端专属资产。

## 源码开放版不包含

- HUIDI 生产 Supabase / 生产数据
- 托管 AI 与模型路由
- 邮件 Gateway
- 通知 / 飞书协同
- Founder OS Bridge
- 商业管理后台、会员计费、授权体系

## 数据安全边界

“本地运行”代表本包默认不主动把业务数据发送到 HUIDI 生产服务，不代表电脑本身自动安全或自动备份。客户、商品、报价、银行信息、合同等敏感资料仍需要使用者自行做好系统权限、磁盘加密、杀毒和离线备份。

## 已知限制

- 本版没有在线 AI；自动翻译等在线能力不作为离线承诺。
- 老式 `.xls` 不在纯本地读取范围内，请另存为 `.xlsx` / CSV。
- 当前自动环境的 Chromium 因 DBus / zygote 限制无法完成像素级浏览器验收，因此正式公开前仍需要在真实 Windows 电脑完成一次断网冒烟。
