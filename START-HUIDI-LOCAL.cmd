@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title HUIDI Docs Community Local

echo.
echo ======================================================
echo   HUIDI Docs Community Local 1.2.0 RC2
echo   Local-only startup - 127.0.0.1:8765
echo ======================================================
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 goto :fallback
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local-server.ps1" -Port 8765 -Root "%~dp0public"
goto :end

:fallback
where node.exe >nul 2>nul
if not errorlevel 1 (
  node "%~dp0tools\local-server.cjs"
  goto :end
)
where py.exe >nul 2>nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:8765/"
  py -m http.server 8765 --bind 127.0.0.1 --directory "%~dp0public"
  goto :end
)
echo [ERROR] Windows PowerShell, Node.js and Python were not found.
echo This package normally runs with Windows PowerShell and does not require Node.js.
pause
:end
endlocal
