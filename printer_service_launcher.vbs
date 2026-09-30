' ==============================================================================
' Smart Restaurant POS - Silent Windows Service Launcher (Invisible Mode)
' مشغل خدمة وسيط الطباعة الصامتة في الخلفية بدون نوافذ
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' فحص توفر Node.js أو تشغيل الوسيط الأصيل عبر PowerShell
nodeExe = "node.exe"
bridgeJs = currentDir & "\printer_bridge.js"
bridgePs1 = currentDir & "\printer_bridge.ps1"

' إذا كان Node.js متاحاً يتم تشغيله في الخلفية تماماً (WindowStyle = 0)
On Error Resume Next
cmdNode = "cmd.exe /c cd /d """ & currentDir & """ && node printer_bridge.js"
returnCode = WshShell.Run(cmdNode, 0, False)

If Err.Number <> 0 Then
    ' تشغيل البديل عبر PowerShell في وضع الإخفاء التام
    cmdPs = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & bridgePs1 & """"
    WshShell.Run cmdPs, 0, False
End If
