@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%CD%"
set "API=%ROOT%\api"
set "ENV_FILE=%ROOT%\.env.server"
set "DATA_DIR=%ROOT%\server-data"
set "BACKUP_DIR=%DATA_DIR%\backups"
set "VENV=%API%\.venv"
set "VENV_PY=%VENV%\Scripts\python.exe"
set "HOST=0.0.0.0"
set "PORT=8080"

if not exist "%API%\requirements.txt" goto :missing_package
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

if not exist "%ENV_FILE%" (
    copy /Y "%ROOT%\.env.example" "%ENV_FILE%" >nul
    echo.
    echo [HUIDI Server] Created: %ENV_FILE%
    echo Fill HUIDI_SECRET_KEY, HUIDI_OWNER_EMAIL and HUIDI_OWNER_PASSWORD,
    echo then run this launcher again. HUIDI_PUBLIC_BASE_URL is recommended
    echo after your HTTPS reverse proxy/domain is ready.
    echo.
    exit /b 2
)

cd /d "%API%"

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
if exist ".huidi-server-deps-ready" goto :deps_ready
echo [2/5] Installing HUIDI Online dependencies...
"%VENV_PY%" -m pip install --disable-pip-version-check -r requirements.txt
if not %ERRORLEVEL% EQU 0 goto :deps_failed
> ".huidi-server-deps-ready" echo ready

:deps_ready
for /f "usebackq delims=" %%U in (`"%VENV_PY%" -c "from pathlib import Path; print('sqlite:///' + (Path(r'%DATA_DIR%') / 'huidi-online.db').resolve().as_posix())"`) do set "DATABASE_URL=%%U"
if not defined DATABASE_URL goto :data_failed
set "HUIDI_BACKUP_DIR=%BACKUP_DIR%"
set "APP_ENV=production"
set "HUIDI_COMMUNITY_SURFACE=1"
set "HUIDI_TEAM_ACCESS=1"
set "HUIDI_SIGNUP_ENABLED=0"

echo [3/5] Checking server configuration file...
"%VENV_PY%" -c "from dotenv import dotenv_values; c=dotenv_values(r'%ENV_FILE%'); ok=bool((c.get('HUIDI_SECRET_KEY') or '').strip() and (c.get('HUIDI_OWNER_EMAIL') or '').strip() and len(c.get('HUIDI_OWNER_PASSWORD') or '') >= 8); raise SystemExit(0 if ok else 2)"
if not %ERRORLEVEL% EQU 0 goto :config_missing

echo [4/5] Checking HUIDI Online application...
"%VENV_PY%" -c "from app.daily_app import app; print('HUIDI Online application OK:', app.title)"
if not %ERRORLEVEL% EQU 0 goto :app_failed

echo [5/5] Starting HUIDI Online server...
echo Listen: %HOST%:%PORT%
echo Data:   %DATA_DIR%
echo Backup: %BACKUP_DIR%
echo Config: %ENV_FILE%
echo.
echo Put HTTPS/reverse proxy in front of port %PORT% for public access.
echo Press Ctrl+C here to stop.
echo.
"%VENV_PY%" -m uvicorn app.daily_app:app --host %HOST% --port %PORT% --env-file "%ENV_FILE%"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" goto :server_failed
exit /b 0

:missing_package
echo [HUIDI Server] Incomplete package: api\requirements.txt is missing.
goto :fail

:python_missing
echo [HUIDI Server] Python 3 was not found. Install Python 3.11 or 3.12 and enable PATH.
goto :fail

:venv_failed
echo [HUIDI Server] Failed to create Python environment.
goto :fail

:deps_failed
echo [HUIDI Server] Dependency installation failed. Check network access and Python.
goto :fail

:data_failed
echo [HUIDI Server] Failed to resolve persistent SQLite database path.
goto :fail

:config_missing
echo.
echo [HUIDI Server] Required server values are not ready in:
echo %ENV_FILE%
echo Fill HUIDI_SECRET_KEY, HUIDI_OWNER_EMAIL and HUIDI_OWNER_PASSWORD ^(8+ chars^).
goto :fail

:app_failed
echo [HUIDI Server] Application import check failed.
goto :fail

:server_failed
echo [HUIDI Server] Server exited with code %RC%.
goto :fail

:fail
echo.
pause
exit /b 1
