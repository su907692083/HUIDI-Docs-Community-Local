$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Cmd = Join-Path $Root 'START-HUIDI-ONLINE.cmd'
if (-not (Test-Path $Cmd)) { throw 'START-HUIDI-ONLINE.cmd is missing.' }
& cmd.exe /d /c ('"' + $Cmd + '"')
exit $LASTEXITCODE
