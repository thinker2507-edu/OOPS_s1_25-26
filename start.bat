@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
set "RELAY_EXIT_CODE=%ERRORLEVEL%"
if not "%RELAY_EXIT_CODE%"=="0" (
    echo.
    echo Relay exited. Check the message above and README.md for setup instructions.
    pause
)
exit /b %RELAY_EXIT_CODE%
