@echo off
chcp 65001 >nul
cd /d "%~dp0"
title تثبيت خدمة الطباعة الصامتة في الخلفية تلقائياً
color 0A

echo ==============================================================
echo    تثبيت خدمة وسيط الطباعة الصامتة بنظام المطاعم الذكي
echo    Smart Restaurant Thermal Print Bridge - Auto Startup
echo ==============================================================
echo.
echo [1/3] جاري فحص ملفات الوسيط والمشغل الصامت...

if not exist "%~dp0printer_service_launcher.vbs" (
    echo [خطأ] لم يتم العثور على ملف المشغل الصامت printer_service_launcher.vbs
    pause
    exit /b 1
)

echo [2/3] جاري تسجيل الخدمة في بدء التشغيل التلقائي لويندوز (Windows Startup)...

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\SmartPrintBridge.lnk"
set "TARGET_PATH=%~dp0printer_service_launcher.vbs"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_PATH%\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Smart Restaurant Silent Print Bridge'; $s.Save()"

if %ERRORLEVEL% EQU 0 (
    echo   + تم إنشاء اختصار الإقلاع التلقائي بنجاح في مجلد بدء التشغيل:
    echo     %SHORTCUT_PATH%
) else (
    echo   [تحذير] تعذر إنشاء الاختصار في مجلد Startup.
)

echo [3/3] جاري تشغيل الخدمة الصامتة الآن في الخلفية...
wscript.exe "%TARGET_PATH%"

echo.
echo ==============================================================
echo  ✅ تم تثبيت وتشغيل خدمة الطباعة الصامتة بنجاح!
echo  - الخدمة تعمل الآن في الخلفية دون أي نوافذ مفتوحة (Port: 8080/9100).
echo  - ستعمل الخدمة تلقائياً مع كل عملية إعادة تشغيل للكومبيوتر.
echo ==============================================================
echo.
pause
