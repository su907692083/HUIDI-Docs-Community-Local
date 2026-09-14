$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Cmd = Join-Path $Root 'START-HUIDI-SERVER.cmd'
if (-not (Test-Path $Cmd)) {
    throw 'START-HUIDI-SERVER.cmd is missing.'
}
& cmd.exe /d /c ('"' + $Cmd + '"')
exit $LASTEXITCODE
