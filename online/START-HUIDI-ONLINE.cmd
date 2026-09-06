@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%CD%"
set "API=%ROOT%\api"
set "VENV=%API%\.venv"
set "VENV_PY=%VENV%\Scripts\python.exe"
set "URL=http://127.0.0.1:8080/"

if not exist "%API%\requirements.txt" goto :missing_package
cd /d "%API%"

echo ==========================================
echo  HUIDI Online - Foreign Trade Workbench
echo  %URL%
echo ==========================================
echo.

if exist "%VENV_PY%" goto :venv_ready

echo [1/5] Creating isolated Python environment...
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    py -3 -m venv "%VENV%"
) else (
    where python >nul 2>nul
    if not %ERRORLEVEL% EQU 0 goto :python_missing
    python -m venv "%VENV%"
)
if not exist "%VENV_PY%" goto :venv_failed

:venv_ready
if exist ".huidi-deps-ready" goto :deps_ready
echo [2/5] Installing HUIDI Online dependencies...
"%VENV_PY%" -m pip install --disable-pip-version-check -r requirements.txt
if not %ERRORLEVEL% EQU 0 goto :deps_failed
> ".huidi-deps-ready" echo ready

:deps_ready
echo [3/5] Preparing local security key...
if not exist ".huidi-secret" (
    "%VENV_PY%" -c "import secrets,pathlib; pathlib.Path('.huidi-secret').write_text(secrets.token_urlsafe(48), encoding='ascii')"
    if not %ERRORLEVEL% EQU 0 goto :secret_failed
)
set "HUIDI_SECRET_KEY="
set /p HUIDI_SECRET_KEY=<".huidi-secret"
if not defined HUIDI_SECRET_KEY goto :secret_failed
if not defined DATABASE_URL set "DATABASE_URL=sqlite:///./huidi-online.db"

echo [4/5] Checking HUIDI Online application...
"%VENV_PY%" -c "from app.daily_app import app; print('HUIDI Online application OK:', app.title)"
if not %ERRORLEVEL% EQU 0 goto :app_failed

echo [5/5] Starting HUIDI Online...
echo Browser will open automatically. Press Ctrl+C here to stop.
echo.
start "" /b cmd /c "timeout /t 3 /nobreak ^>nul ^& start "" "%URL%""
"%VENV_PY%" -m uvicorn app.daily_app:app --host 127.0.0.1 --port 8080
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" goto :server_failed
exit /b 0

:missing_package
echo.
echo [HUIDI Online] Incomplete package: api\requirements.txt is missing.
goto :fail

:python_missing
echo.
echo [HUIDI Online] Python 3 was not found.
echo Install Python 3.11 or 3.12 and enable Add Python to PATH.
goto :fail

:venv_failed
echo.
echo [HUIDI Online] Failed to create the Python environment.
goto :fail

:deps_failed
echo.
echo [HUIDI Online] Dependency installation failed. Check network access and Python.
goto :fail

:secret_failed
echo.
echo [HUIDI Online] Failed to create/read the local security key.
goto :fail

:app_failed
echo.
echo [HUIDI Online] Application import check failed. The package may be incomplete.
goto :fail

:server_failed
echo.
echo [HUIDI Online] Server exited with code %RC%.
goto :fail

:fail
echo.
pause
exit /b 1
