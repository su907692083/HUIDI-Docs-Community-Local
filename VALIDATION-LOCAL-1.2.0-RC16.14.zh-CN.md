# RC16.14 本地验证记录

- 基线：RC16.13 SOURCE SHA256 `39f7f9387ca52adc7c0604760607868995c6dd1412f8fe607cbeddd4e90b0edb`
- 新增专项门禁：`tools/validate-clip-navigation-rc1614.cjs`
- Protected PDF Core：Formal Output Gate 与 PDF Flow Fix 均要求保持历史 SHA。
- Preview 稳定报告必须同时满足 `overflowPages=[]` 与 `clipBoundaryPages=[]`。
- Issue Navigator 必须覆盖 `fields.X`、`items.N.X`、`items.X`、Trade Factory selector 和普通 fieldId。
- 顶部检查、Preview“查看第一个问题”、Formal Gate“去补充/返回补充”必须进入统一 locator。
- JS/CJS syntax、HTML local refs、RC16.10–RC16.13 retained gates、RC16.14 gate 均为发布必检项。
- 当前容器 Chromium 被系统策略 `ERR_BLOCKED_BY_ADMINISTRATOR` 禁止自动访问 loopback/file 页面，因此不把 RC16.14 浏览器 GUI 自动复跑伪记为 PASS；Windows 实机视觉验收仍为最终候选发布前置条件。
