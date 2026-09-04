# RC16.17 本地验证

- 单一 Toolbar Owner 静态门禁：PASS
- Local Bridge 不再拥有 toolbar MutationObserver：PASS
- 360ms late toolbar settle 已移除：PASS
- Editor Shell 锁定后不再批量 append 已有按钮：PASS
- 600ms 二次 header rebuild 已移除：PASS
- 单据切换路径不再调用 bulk `ensureCanonicalToolbar()`：PASS
- 收款资料 late control 使用固定槽位：PASS
- 桌面固定标题宽度 + nowrap 操作区：PASS
- RC16.10~RC16.16 retained gates：必须继续 PASS
- Protected PDF Core：保持历史 SHA
- 最终 Windows 实机仍需观察：刷新、QT/PI/SC/CI/PL 连续切换时顶部按钮顺序不得闪动或跳位。
