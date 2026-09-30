@echo off
cd /d "%~dp0"
title Smart Restaurant Silent Print Bridge
color 0A

echo ==============================================================
echo    Smart Restaurant Silent Print Bridge (Cashier and Kitchen)
echo ==============================================================
echo  Starting Print Bridge on Port 8080 (or 9090)...
echo  Please keep this window open or minimized in taskbar.
echo ==============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; & '.\printer_bridge.ps1'"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] An error occurred while starting print bridge.
    pause
)
