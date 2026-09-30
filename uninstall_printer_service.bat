@echo off
chcp 65001 >nul
cd /d "%~dp0"
title إلغاء تثبيت وإيقاف خدمة الطباعة الصامتة
color 0C

echo ==============================================================
echo    إلغاء تثبيت وإيقاف خدمة وسيط الطباعة بنظام المطاعم
echo ==============================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\SmartPrintBridge.lnk"

if exist "%SHORTCUT_PATH%" (
    del /f /q "%SHORTCUT_PATH%" >nul 2>&1
    echo [+] تم حذف اختصار بدء التشغيل التلقائي بنجاح.
) else (
    echo [*] لم يتم العثور على اختصار في بدء التشغيل.
)

echo [*] جاري إنهاء عمليات وسيط الطباعة المفتوحة في الذاكرة...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Get-Process -Name node, powershell, wscript -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*printer_bridge*' } | Stop-Process -Force -ErrorAction SilentlyContinue"

echo.
echo ==============================================================
echo  ✅ تم إيقاف الخدمة وحذفها من بدء التشغيل بنجاح!
echo ==============================================================
echo.
pause
