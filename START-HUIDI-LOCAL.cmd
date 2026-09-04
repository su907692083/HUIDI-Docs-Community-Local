@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title HUIDI Docs Community Local

set "HUIDI_BASE_PORT=8765"
set "HUIDI_LOG_DIR=%~dp0logs"
set "HUIDI_LOG=%HUIDI_LOG_DIR%\launcher-last.log"
if not exist "%HUIDI_LOG_DIR%" mkdir "%HUIDI_LOG_DIR%" >nul 2>nul
>"%HUIDI_LOG%" echo [%date% %time%] HUIDI Docs Community Local 1.2.0 RC16.27 launcher

echo.
echo ======================================================
echo   HUIDI Docs Community Local 1.2.0 RC16.27
echo   Local-first startup - 127.0.0.1
echo ======================================================
echo.

echo [1/3] Checking Windows PowerShell...
where powershell.exe >nul 2>nul
if errorlevel 1 goto :node_fallback

echo [2/3] Starting local server with Windows PowerShell...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local-server.ps1" -Port %HUIDI_BASE_PORT% -Root "%~dp0public" 2>>"%HUIDI_LOG%"
set "HUIDI_RC=%ERRORLEVEL%"
if "%HUIDI_RC%"=="0" goto :end

echo.
echo [WARN] Windows PowerShell server exited with code %HUIDI_RC%.
echo [%date% %time%] PowerShell exit code %HUIDI_RC%>>"%HUIDI_LOG%"

echo Trying Node.js fallback...
:node_fallback
where node.exe >nul 2>nul
if errorlevel 1 goto :python_fallback
set "HUIDI_PORT=%HUIDI_BASE_PORT%"
node "%~dp0tools\local-server.cjs" 2>>"%HUIDI_LOG%"
set "HUIDI_RC=%ERRORLEVEL%"
if "%HUIDI_RC%"=="0" goto :end

echo.
echo [WARN] Node.js server exited with code %HUIDI_RC%.
echo [%date% %time%] Node exit code %HUIDI_RC%>>"%HUIDI_LOG%"

:python_fallback
where py.exe >nul 2>nul
if errorlevel 1 goto :failed

echo Trying Python static fallback on port 8775...
start "" "http://127.0.0.1:8775/"
py -m http.server 8775 --bind 127.0.0.1 --directory "%~dp0public" 2>>"%HUIDI_LOG%"
set "HUIDI_RC=%ERRORLEVEL%"
if "%HUIDI_RC%"=="0" goto :end

echo [%date% %time%] Python exit code %HUIDI_RC%>>"%HUIDI_LOG%"

:failed
echo.
echo ======================================================
echo   HUIDI failed to start.
echo ======================================================
echo.
echo The window will stay open so the error is not lost.
echo Diagnostic log:
echo   %HUIDI_LOG%
echo.
if exist "%HUIDI_LOG%" (
  echo ---------------- launcher-last.log ----------------
  type "%HUIDI_LOG%"
  echo ---------------------------------------------------
)
echo.
echo Please keep this window or send launcher-last.log for diagnosis.
pause

:end
endlocal
