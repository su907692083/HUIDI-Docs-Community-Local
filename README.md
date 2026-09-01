# HUIDI Docs Community Local v1.2.0 RC6

面向“客户资料不希望上传、希望自己电脑或自己服务器运行”的外贸用户准备的 **源码开放（Source Available）本地版**。

> **自己用免费。自己公司内部用免费。给别人收费提供 HUIDI，或围绕 HUIDI 赚钱，需要商业授权。**

这不是 OSI 开源许可证版本。当前授权详见 `LICENSE` 和 `COMMERCIAL-LICENSE.md`。

## 最简单的 Windows 使用方式

1. 解压整个 ZIP。
2. 双击 `START-HUIDI-LOCAL.cmd`。
3. 浏览器会打开 `http://127.0.0.1:8765/`。
4. 数据默认保存在当前电脑的浏览器存储中。
5. 在“备份 / 恢复”里定期导出 JSON 备份。

> 不建议直接双击 `public/index.html` 用 `file://` 运行。浏览器对本地文件权限限制较多，请使用附带的本地启动器。

## 可以免费做什么

- 个人在自己的电脑、NAS、VPS、服务器上使用；
- 自己公司部署在公司内网或自有服务器，员工内部使用；
- 修改代码适配自己公司的外贸流程；
- 外贸公司使用 HUIDI 做自己的报价、PI、合同、CI、装箱单和产品目录，并正常开展自己的业务。

## 哪些情况需要商业授权

- 把 HUIDI 或修改版拿去卖；
- 收费给其他公司安装、部署、维护、升级或定制；
- SaaS、云平台、付费托管；
- 白标 / OEM；
- 将 HUIDI 集成进收费软件或收费解决方案；
- 以会员费、服务费、培训费、技术支持费等方式围绕 HUIDI 对第三方收费。

商业授权微信：`nuliqingxing8`。

## 本地版包含

- 本地客户与跟进资料
- 本地商品资料、商品图片
- 询盘 / 订单业务链
- 报价单 Quotation
- 形式发票 Proforma Invoice / PI
- 销售合同 Sales Contract
- 商业发票 Commercial Invoice / CI
- 装箱单 Packing List
- 单据编辑、实时预览、本机草稿
- PDF / XLSX / CSV / 打印输出
- 产品目录制作
- 品牌与收款资料
- 常用条款与模板
- 本地邮件草稿
- 回收站
- 本地备份 / 恢复
- Windows 一键本地启动
- 自有服务器静态部署参考

## 本地版明确不包含

- HUIDI 生产 Supabase
- HUIDI AI Gateway
- 云 AI 自动识别
- 邮件发送网关
- 通知 / 飞书同步
- Founder OS Bridge
- HUIDI 管理后台
- 会员、计费、Token 调度和 HUIDI 云商业运营配置

## 网络策略

关键页面带有严格 CSP，并加载 `community-local-mode.js`。核心本地流程不依赖 HUIDI 生产服务。网络图片、外部网页、邮箱等只有在用户主动使用相应能力时才需要联网。

## 授权

- 当前许可：**HUIDI Community Source License 1.0**
- 模式：**Source Available / 源码开放**
- 免费范围：个人自用、自己公司内部使用
- 商业授权：对第三方收费提供软件或围绕软件收费获利

详见：

- `LICENSE`
- `COMMERCIAL-LICENSE.md`
- `LICENSE-MIGRATION-RC6.zh-CN.md`

## 关于历史 `flypigbox` 内部命名

为了避免一次性重命名破坏已经稳定的编辑器、浏览器存储键和内部运行链，Community Local 1.x 仍保留部分历史文件名、全局对象和 storage key。对外品牌统一为 HUIDI。详见 `LEGACY-COMPATIBILITY.md`。
