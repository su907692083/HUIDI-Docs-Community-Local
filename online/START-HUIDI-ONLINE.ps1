[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$Host.UI.RawUI.WindowTitle = 'HUIDI Online'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Api = Join-Path $Root 'api'
$Venv = Join-Path $Api '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
$Requirements = Join-Path $Api 'requirements.txt'
$ReqStamp = Join-Path $Api '.huidi-requirements.sha256'
$SecretFile = Join-Path $Api '.huidi-secret'
$Url = 'http://127.0.0.1:8080/'

function Fail([string]$Message) {
    Write-Host ''
    Write-Host ('[HUIDI Online] ' + $Message) -ForegroundColor Red
    Write-Host ''
    Read-Host '按 Enter 关闭'
    exit 1
}

if (-not (Test-Path $Api)) { Fail '缺少 online\api 目录，这不是完整的 HUIDI Online 包。' }
if (-not (Test-Path $Requirements)) { Fail '缺少 requirements.txt。' }

Set-Location $Api

Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ' HUIDI Online · 外贸工作台' -ForegroundColor Cyan
Write-Host ' http://127.0.0.1:8080/' -ForegroundColor DarkGray
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $Python)) {
    Write-Host '[1/4] 首次运行：创建独立 Python 环境…' -ForegroundColor Yellow
    $Py = Get-Command py -ErrorAction SilentlyContinue
    if ($Py) {
        & py -3 -m venv $Venv
    } else {
        $SystemPython = Get-Command python -ErrorAction SilentlyContinue
        if (-not $SystemPython) {
            Fail '没有检测到 Python 3。请先安装 Python 3.11/3.12，并勾选 Add Python to PATH。'
        }
        & python -m venv $Venv
    }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Python)) { Fail 'Python 虚拟环境创建失败。' }
}

$ReqHash = (Get-FileHash $Requirements -Algorithm SHA256).Hash
$InstalledHash = if (Test-Path $ReqStamp) { (Get-Content $ReqStamp -Raw).Trim() } else { '' }
if ($InstalledHash -ne $ReqHash) {
    Write-Host '[2/4] 安装 / 更新 HUIDI Online 依赖…' -ForegroundColor Yellow
    & $Python -m pip install --disable-pip-version-check -r $Requirements
    if ($LASTEXITCODE -ne 0) { Fail '依赖安装失败，请检查网络或 Python 环境。' }
    Set-Content -Path $ReqStamp -Value $ReqHash -Encoding ASCII -NoNewline
} else {
    Write-Host '[2/4] 运行依赖已就绪。' -ForegroundColor Green
}

if (-not (Test-Path $SecretFile)) {
    Write-Host '[3/4] 首次运行：生成本机安全密钥…' -ForegroundColor Yellow
    $SecretPathEscaped = $SecretFile.Replace("'", "''")
    & $Python -c "import secrets,pathlib; pathlib.Path(r'$SecretPathEscaped').write_text(secrets.token_urlsafe(48), encoding='utf-8')"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $SecretFile)) { Fail '本机安全密钥生成失败。' }
}
$env:HUIDI_SECRET_KEY = (Get-Content $SecretFile -Raw).Trim()
if (-not $env:HUIDI_SECRET_KEY) { Fail '本机安全密钥为空。' }
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'sqlite:///./huidi-online.db' }

try {
    $Existing = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($Existing.StatusCode -ge 200 -and $Existing.StatusCode -lt 500) {
        Write-Host '[4/4] HUIDI Online 已经在运行，正在打开浏览器…' -ForegroundColor Green
        Start-Process $Url
        exit 0
    }
} catch {}

Write-Host '[4/4] 启动 HUIDI Online…' -ForegroundColor Green
Write-Host '浏览器会自动打开。需要停止时，在本窗口按 Ctrl+C。' -ForegroundColor DarkGray
Write-Host ''

$BrowserJob = Start-Job -ArgumentList $Url -ScriptBlock {
    param($TargetUrl)
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Milliseconds 700
        try {
            $r = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
                Start-Process $TargetUrl
                return
            }
        } catch {}
    }
}

try {
    & $Python -m uvicorn app.daily_app:app --host 127.0.0.1 --port 8080
} finally {
    if ($BrowserJob) {
        Stop-Job $BrowserJob -ErrorAction SilentlyContinue
        Remove-Job $BrowserJob -Force -ErrorAction SilentlyContinue
    }
}
