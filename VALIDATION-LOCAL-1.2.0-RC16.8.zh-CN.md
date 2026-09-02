# RC16.8 本地验证记录

目标：验证全单据 Unified Document Layout Policy。

自动门禁要求：
- editor.html 仅加载 RC16.8 layout policy，不再激活 RC16.6.5 quotation-only controller。
- QT / PI / SC / CI / PL 五类类型均属于 supportedTypes。
- 控件不再存在 `box.hidden=!quotation` 或 `type()==='quotation'&&enabled()` 的显示门禁。
- `#piPaper` 使用通用 `huidi-document-one-page` 类。
- Workbook Preview 将 layout policy 写入渲染 signature，并监听 `HUIDI:layout-policy-changed`。
- XLSX pageSetup 在优先一页且工作表 <= 48 行时使用 fitToHeight=1，长表仍为 0。
- JavaScript 语法检查、ZIP CRC、HTTP loopback smoke、运行树一致性必须通过。

真实 Windows 验收仍为发布 GitHub Public Release 前置条件。
