# HUIDI Docs Community Local V1.2.0 RC5

## 本轮定位

RC5 专门修复单据编辑器页头架构。停止使用 RC3/RC4 重新创建的深蓝 Local Header，恢复线上版本长期使用的 `#fpLiteToolbar` 作为唯一 canonical editor header。

## 恢复的原页头能力

- 内部工具
- 导入资料
- PDF 单据 / 表格工作簿切换
- 单据类型切换
- 保存单据
- 模板 / 样式
- 快速 / 完整单据模式
- 字段设置
- 布局
- 导出
- 清空
- 更多操作

## Community Local 本地适配

- 移除账号 / 登录和旧内部版本号展示。
- 在原页头内加入“检查”。
- 在原页头内加入“下一步”，用于报价 → PI → 销售合同 → CI → 装箱单。
- 在原导出菜单补充数据版 XLSX 与打印 / 另存 PDF。
- 原“保存单据”同时镜像写入本地单据中心。
- 左侧说明显示本地自动保存状态，不再另造第二个固定页头。

## 结构门禁

单据编辑器只允许存在一套主固定页头：`#fpLiteToolbar`。`#huidiLocalEditorBar` 不再创建。
