@echo off
setlocal
cd /d "%~dp0"
call "%~dp0START-HUIDI-ONLINE.cmd"
exit /b %ERRORLEVEL%
