# 历史兼容命名说明

Community Local 1.x 仍可能在源码中看到：
- `flypigbox-*.js / css`
- `window.FlypigBOX*`
- `flypigbox_*` localStorage / sessionStorage key

这些是历史运行链兼容标识，不是当前用户品牌，也不代表连接旧域名。当前公开品牌为 HUIDI / HUIDI Docs。

一次性批量重命名会影响浏览器草稿兼容、编辑器依赖顺序和历史模块调用，因此计划在后续大版本逐步迁移，而不是为了“字符串清零”牺牲稳定性。
