@echo off
setlocal EnableExtensions
set "URL=%~1"
if not defined URL set "URL=http://127.0.0.1:8080/"
>nul 2>nul ping 127.0.0.1 -n 4
start "" "%URL%"
exit /b 0
