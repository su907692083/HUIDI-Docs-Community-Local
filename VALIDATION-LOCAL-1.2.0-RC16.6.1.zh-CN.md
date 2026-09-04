# HUIDI Docs Community Local V1.2.0 RC16.6.1 — Validation

## P0 启动器门禁

- Windows PowerShell 主脚本必须以 UTF-8 BOM (`EF BB BF`) 开头：PASS。
- `START-HUIDI-LOCAL.cmd` 使用 ASCII + CRLF：PASS。
- PowerShell 8765–8775 自动端口回退逻辑：已静态门禁。
- Node 端口冲突 smoke：首实例 8765、第二实例自动 8766：PASS。
- CMD PowerShell → Node → Python fallback：已静态门禁。
- 全部失败时 `pause` + `logs/launcher-last.log`：已静态门禁。

## 回归门禁

- `npm run check`：PASS。
- RC13 PDF authority：PASS。
- RC15 More/PDF regression authority：PASS。
- RC16 multilingual：PASS。
- RC16.5 stability/output-integrity：PASS。
- RC16.6 product PDF + Feishu collaboration：PASS。
- i18n fixed-term / Korean-Japanese regression / structured fields/selects：PASS。

## Windows 实机边界

当前容器不能运行 Windows PowerShell 5.1，因此不能把 Linux/Node smoke 冒充 Windows 双击最终验收。RC16.6.1 已针对 RC16.6 最有证据的 Windows PowerShell 编码根因修复，并加入不闪退诊断；最终仍需用户在真实 Windows 上双击 `START-HUIDI-LOCAL.cmd` 验证。
