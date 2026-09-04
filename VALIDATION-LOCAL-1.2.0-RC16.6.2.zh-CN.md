# VALIDATION — HUIDI Docs Community Local V1.2.0 RC16.6.2

状态：**TEST CANDIDATE / Preview Runtime Hotfix**

## 自动门禁

- `npm run check`：必须 PASS。
- JS 语法、本地 HTML 引用、Local CSP/Network Guard：必须 PASS。
- `productColgroup(options={})` 运行时矩阵：
  - quotation image + money = 7 columns；
  - quotation no-image + money = 6 columns；
  - no-money image = 5 columns；
  - no-money no-image = 4 columns；
  - packing image = 5 columns；
  - packing no-image = 4 columns；
  - 所有宽度合计 = 100%。
- 禁止出现 `showImage=showImage` 一类 TDZ 自引用默认参数。
- `renderPreview()` 必须包含 ready/error 状态、上一份预览保留、首次错误卡和 retry 入口。
- Quotation / PI / Sales Contract 商品 renderer hooks 必须存在。
- SOURCE / WINDOWS `public/` 运行树必须逐文件 SHA 一致。
- Protected PDF Core SHA 必须与 RC16.6.1 一致。

## Windows 实机必测

1. 报价单：3 个商品 + 图片，右侧预览必须生成。
2. PI：3 个商品，右侧预览必须生成。
3. 销售合同：3 个商品，右侧预览必须生成。
4. 日本語 / 한국어 / English 切换后重新生成预览，不得空白。
5. 刻意触发可恢复异常时，不得只出现白板；应保留上一份预览或显示明确错误卡。
6. 双击 `START-HUIDI-LOCAL.cmd` 继续验证 RC16.6.1 启动器热修无回退。

## 未虚报项目

当前沙盒 Chromium 对本地页面的自动 dump-dom 运行不稳定，因此本记录不把真实浏览器视觉预览宣称为自动 PASS；最终发布仍以 Windows Edge / Chrome 实机为准。
