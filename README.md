# HUIDI Docs Community Local

**本地优先的外贸业务与单据工作台 · Source Available / 源码开放**

> **自己用免费。自己公司内部用免费。给别人收费提供 HUIDI，或围绕 HUIDI 赚钱，需要商业授权。**

## ⬇ Windows 用户直接下载

### [下载 HUIDI Docs Community Local v1.2.0 RC6 Windows 本地版](https://github.com/su907692083/HUIDI-Docs-Community-Local/releases/download/v1.2.0-rc6/HUIDI-Docs-Community-Local-V1.2.0-RC6-WINDOWS.zip)

普通 Windows 用户不需要配置数据库，也不需要部署服务器：

1. 下载上面的 `WINDOWS.zip`
2. 解压整个 ZIP
3. 双击 `START-HUIDI-LOCAL.cmd`
4. 浏览器会自动打开 `http://127.0.0.1:8765/`
5. 数据默认保存在当前电脑浏览器中，请定期在“备份 / 恢复”导出 JSON 备份

> 当前为 **v1.2.0 RC6 预发布候选版**。建议先用于测试和实际业务试用，重要数据请做好备份。

**[查看 v1.2.0 RC6 Release](https://github.com/su907692083/HUIDI-Docs-Community-Local/releases/tag/v1.2.0-rc6)** · **[下载源码包](https://github.com/su907692083/HUIDI-Docs-Community-Local/releases/download/v1.2.0-rc6/HUIDI-Docs-Community-Local-V1.2.0-RC6-SOURCE.zip)** · **[校验 SHA256](https://github.com/su907692083/HUIDI-Docs-Community-Local/releases/download/v1.2.0-rc6/HUIDI-Docs-Community-Local-V1.2.0-RC6-SHA256SUMS.txt)**

---

## 这是做什么的？

HUIDI Docs Community Local 是给外贸业务人员准备的本地业务与单据工作台。

它希望把原本散落在 Excel、聊天记录、文件夹和不同单据里的资料串成一条更完整的本地工作链：

**客户 / 询盘 → 商品 / 产品目录 → 报价单 → PI → 销售合同 → 收款 / 生产 → 商业发票 CI / 装箱单 → 出运 / 复盘**

如果你担心客户资料、商品资料和单据信息上传到第三方服务器，或者希望断网时仍然能继续制作资料，这个版本就是为这种使用方式准备的。

---

## 当前主要能力

- 客户资料与跟进
- 商品资料与商品图片
- 询盘 / 订单业务链
- 产品目录制作
- 报价单 Quotation
- 形式发票 Proforma Invoice / PI
- 销售合同 Sales Contract
- 商业发票 Commercial Invoice / CI
- 装箱单 Packing List
- 单据编辑、实时预览、本机草稿
- PDF / XLSX / CSV / 打印输出
- 品牌与收款资料
- 常用条款与模板
- 本地邮件草稿
- 回收站
- 本地备份 / 恢复
- Windows 一键本地启动
- 自有服务器静态部署参考

---

## 使用授权：先看这一段

### 免费使用

以下场景可以免费：

- 你自己在自己的电脑上使用
- 你部署到自己的 NAS、VPS、服务器或内网使用
- 你自己的公司内部员工使用
- 你修改代码适配自己公司的业务流程
- 你用 HUIDI 做自己公司的报价、PI、合同、CI、装箱单、产品目录，并正常开展自己的外贸业务

### 需要商业授权

以下场景需要取得 HUIDI 商业授权：

- 把 HUIDI 或修改版拿去卖
- 收费给其他公司安装、部署、维护、升级或定制
- SaaS、云平台、付费托管
- OEM / 白标
- 转售、二次打包收费分发
- 集成到收费软件或收费解决方案
- 以会员费、服务费、培训费、技术支持费等方式围绕 HUIDI 向第三方收费

**商业授权 / 开发合作：微信 `nuliqingxing8`**

完整规则请阅读：

- [`LICENSE`](./LICENSE)
- [`COMMERCIAL-LICENSE.md`](./COMMERCIAL-LICENSE.md)
- [`SOURCE-AVAILABLE-SCOPE.md`](./SOURCE-AVAILABLE-SCOPE.md)

> 本项目属于 **Source Available / 源码开放**，不是 OSI 定义下的 Open Source 软件。

---

## 本地版的数据放在哪里？

当前 Community Local 以本地优先方式运行。核心客户、商品、单据草稿等资料默认保存在当前电脑的浏览器存储中。

因此请特别注意：

- 换电脑前先备份
- 清浏览器缓存前先备份
- 重装浏览器前先备份
- 重要业务资料建议定期导出 JSON 备份

本地版不会因为“源码开放”就自动把你的客户和单据上传到 HUIDI 云端。

---

## 哪些能力可以离线？

核心本地业务链可以在本机运行，包括客户资料、商品资料、本地单据、草稿、部分 PDF / XLSX / CSV 输出、本地备份等。

以下能力在用户主动使用时可能需要联网：

- 网络图片
- 外部网页
- 邮箱相关操作
- 用户自行接入的外部服务

更详细说明请查看：

- [`OFFLINE-CAPABILITY-MATRIX.zh-CN.md`](./OFFLINE-CAPABILITY-MATRIX.zh-CN.md)
- [`NETWORK-POLICY.md`](./NETWORK-POLICY.md)
- [`BROWSER-COMPATIBILITY.zh-CN.md`](./BROWSER-COMPATIBILITY.zh-CN.md)

---

## 自己服务器怎么部署？

如果你不想只在一台电脑上使用，也可以把静态文件部署到自己的服务器、NAS、内网 Web Server 或自有 VPS。

请先阅读：

- [`SELF-HOSTING.md`](./SELF-HOSTING.md)

自己或自己公司内部部署仍然属于免费范围；**如果你收费帮第三方部署、托管、维护或定制，则需要商业授权。**

---

## 本地版明确不包含

Community Local 不包含 HUIDI 生产环境的私有服务，例如：

- HUIDI 生产 Supabase
- HUIDI AI Gateway
- 云 AI 自动识别
- 邮件发送网关
- 通知 / 飞书同步
- Founder OS Bridge
- HUIDI 管理后台
- 会员、计费、Token 调度和 HUIDI 云商业运营配置

这些能力不属于当前 Community Local 公共源码包。

---

## 浏览器建议

优先推荐：

- Microsoft Edge
- Google Chrome

其他 Chromium 内核浏览器多数情况下可以运行，但由于下载、打印、PDF、文件访问和安全策略存在差异，兼容性可能不同。

详细说明：[`BROWSER-COMPATIBILITY.zh-CN.md`](./BROWSER-COMPATIBILITY.zh-CN.md)

---

## 反馈问题

如果你在测试中发现问题，可以通过 GitHub **Issues** 提交：

- 使用的 Windows 版本
- 浏览器名称与版本
- 出问题的页面
- 操作步骤
- 截图
- 是否可以稳定复现

不要在公开 Issue 中上传真实客户隐私、订单机密、账号密码、API Key 或其他敏感资料。

---

## 当前版本

**HUIDI Docs Community Local v1.2.0 RC6**

- Release Candidate / 发布候选版
- Source Available / 源码开放
- 个人自用免费
- 自己公司内部使用免费
- 对第三方收费提供软件或相关服务需商业授权

[查看当前 Release](https://github.com/su907692083/HUIDI-Docs-Community-Local/releases/tag/v1.2.0-rc6)

---

## 关于历史 `flypigbox` 内部命名

为了避免一次性重命名破坏已经稳定的编辑器、浏览器存储键和内部运行链，Community Local 1.x 仍保留部分历史文件名、全局对象和 storage key。

这些属于内部兼容层；对外品牌统一为 **HUIDI**。

详见 [`LEGACY-COMPATIBILITY.md`](./LEGACY-COMPATIBILITY.md)。
