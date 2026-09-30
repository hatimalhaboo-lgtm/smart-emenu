# ==============================================================================
# Smart Restaurant Silent Print Bridge (Windows Native PowerShell Service)
# Dual Thermal Printer Support:
# 1. Cashier and Customer Invoices (IP: 192.168.1.100 or Windows USB Printer)
# 2. Kitchen and Prep Tickets (IP: 192.168.1.101)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$defaultCashierIp = "192.168.1.100"
$defaultKitchenIp = "192.168.1.101"
$defaultPort = 9100

$ports = @(8080, 9090)
$listener = $null
$activePort = $null

foreach ($p in $ports) {
    try {
        $tempListener = New-Object System.Net.HttpListener
        $tempListener.Prefixes.Add("http://127.0.0.1:$p/")
        $tempListener.Prefixes.Add("http://localhost:$p/")
        $tempListener.Start()
        $listener = $tempListener
        $activePort = $p
        break
    } catch {
        # Port unavailable, try next
    }
}

if (-not $activePort) {
    Write-Host "[ERROR] Failed to start Silent Print Bridge on ports 8080 or 9090." -ForegroundColor Red
    Write-Host "Please check if another service is using these ports or run as Administrator." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host "[OK] Silent Print Bridge is running on: http://127.0.0.1:$activePort/" -ForegroundColor Green
Write-Host "[OK] Printer 1: Cashier and Invoices -> IP: ${defaultCashierIp}:${defaultPort}" -ForegroundColor Cyan
Write-Host "[OK] Printer 2: Kitchen and Orders   -> IP: ${defaultKitchenIp}:${defaultPort}" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host "(You may minimize this window and keep it running in background)`n" -ForegroundColor Gray

function Send-CorsResponse($context, $jsonString, $statusCode = 200) {
    $res = $context.Response
    $res.StatusCode = $statusCode
    $res.ContentType = "application/json; charset=utf-8"
    $res.AddHeader("Access-Control-Allow-Origin", "*")
    $res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $res.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Access-Control-Request-Private-Network")
    $res.AddHeader("Access-Control-Allow-Private-Network", "true")
    
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
}

Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

function Convert-TextToRasterBytes($text, $width = 576) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    try {
        $lines = $text -split "\r?\n"
        $font = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Bold)
        $lineHeight = 32
        $padding = 20
        $calcHeight = [Math]::Max(100, ($lines.Count * $lineHeight) + ($padding * 2))

        $bmp = New-Object System.Drawing.Bitmap($width, $calcHeight)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.Clear([System.Drawing.Color]::White)
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
        $brush = [System.Drawing.Brushes]::Black
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Far
        $sf.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft

        $yPos = $padding
        foreach ($line in $lines) {
            if ($line -match "^[=\-—_\*]{4,}$") {
                $g.DrawLine([System.Drawing.Pens]::Black, 10, ($yPos + 10), ($width - 10), ($yPos + 10))
                $yPos += 20
                continue
            }
            $rect = New-Object System.Drawing.RectangleF(10, $yPos, ($width - 20), $lineHeight)
            $g.DrawString($line, $font, $brush, $rect, $sf)
            $yPos += $lineHeight
        }

        $actualHeight = $yPos + $padding
        $finalBmp = $bmp.Clone((New-Object System.Drawing.Rectangle(0, 0, $width, $actualHeight)), $bmp.PixelFormat)
        $g.Dispose()
        $bmp.Dispose()

        $wBytes = [int][Math]::Ceiling($width / 8.0)
        $xL = $wBytes -band 0xFF
        $xH = ($wBytes -shr 8) -band 0xFF
        $yL = $actualHeight -band 0xFF
        $yH = ($actualHeight -shr 8) -band 0xFF

        $bytes = New-Object System.Collections.Generic.List[byte]
        $bytes.AddRange([byte[]]@(0x1B, 0x40, 0x1C, 0x2E, 0x1D, 0x76, 0x30, 0x00, $xL, $xH, $yL, $yH))

        for ($y = 0; $y -lt $actualHeight; $y++) {
            for ($xb = 0; $xb -lt $wBytes; $xb++) {
                $b = 0
                for ($bit = 0; $bit -lt 8; $bit++) {
                    $x = $xb * 8 + $bit
                    if ($x -lt $width) {
                        $pixel = $finalBmp.GetPixel($x, $y)
                        if ($pixel.R -lt 140 -and $pixel.A -gt 100) {
                            $b = $b -bor (1 -shl (7 - $bit))
                        }
                    }
                }
                $bytes.Add([byte]$b)
            }
        }
        $bytes.AddRange([byte[]]@(0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00))
        $finalBmp.Dispose()
        $font.Dispose()
        return $bytes.ToArray()
    } catch {
        return $null
    }
}

function Print-ToSingleIp($ip, $port = 9100, $text = "", $cut = $true, $beep = $false, $rasterBase64 = $null) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $conn = $client.ConnectAsync($ip, $port)
        if (-not $conn.Wait(3500)) {
            $client.Close()
            return @{ success = $false; ip = $ip; port = $port; error = "Timeout connecting to IP printer (${ip}:${port})" }
        }

        $stream = $client.GetStream()
        $stream.WriteTimeout = 3500

        # Kitchen buzzer alert
        if ($beep) {
            $buzzer = [byte[]]@(0x1B, 0x42, 0x02, 0x02)
            $stream.Write($buzzer, 0, $buzzer.Length)
        }

        # 1. Raster base64 from client
        if (-not [string]::IsNullOrWhiteSpace($rasterBase64)) {
            $rBytes = [System.Convert]::FromBase64String($rasterBase64)
            $stream.Write($rBytes, 0, $rBytes.Length)
        } else {
            # 2. Local text-to-raster conversion
            $rBytes = Convert-TextToRasterBytes $text 576
            if ($rBytes -and $rBytes.Length -gt 0) {
                $stream.Write($rBytes, 0, $rBytes.Length)
            } else {
                # 3. Raw ESC/POS text fallback
                $init = [byte[]]@(0x1B, 0x40, 0x1C, 0x2E, 0x1B, 0x74, 0x16)
                $stream.Write($init, 0, $init.Length)
                $enc = [System.Text.Encoding]::GetEncoding("windows-1256")
                if (-not $enc) { $enc = [System.Text.Encoding]::UTF8 }
                $lines = $text + "`r`n`r`n`r`n`r`n"
                $tBytes = $enc.GetBytes($lines)
                $stream.Write($tBytes, 0, $tBytes.Length)
                if ($cut) {
                    $cutCmd = [byte[]]@(0x1D, 0x56, 0x42, 0x00)
                    $stream.Write($cutCmd, 0, $cutCmd.Length)
                }
            }
        }

        $stream.Flush()
        $stream.Close()
        $client.Close()
        return @{ success = $true; ip = $ip; port = $port }
    } catch {
        if ($client) { $client.Close() }
        return @{ success = $false; ip = $ip; port = $port; error = $_.Exception.Message }
    }
}

function Print-ToWindows($printerName, $text = "", $rasterBase64 = $null) {
    try {
        $rBytes = $null
        if (-not [string]::IsNullOrWhiteSpace($rasterBase64)) {
            $rBytes = [System.Convert]::FromBase64String($rasterBase64)
        } elseif (-not [string]::IsNullOrWhiteSpace($text)) {
            $rBytes = Convert-TextToRasterBytes $text 576
        }

        if ($rBytes -and $rBytes.Length -gt 0) {
            $tmpFile = [System.IO.Path]::GetTempFileName() + ".prn"
            [System.IO.File]::WriteAllBytes($tmpFile, $rBytes)
            $pTarget = if ([string]::IsNullOrWhiteSpace($printerName)) { "prn" } else { "\\.\$printerName" }
            $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c copy /b `"$tmpFile`" `"$pTarget`"" -WindowStyle Hidden -PassThru -Wait
            Remove-Item $tmpFile -ErrorAction SilentlyContinue
            return @{ success = ($proc.ExitCode -eq 0); printer = (if ($printerName) { $printerName } else { "Default" }) }
        }

        if ([string]::IsNullOrWhiteSpace($printerName)) {
            $text | Out-Printer
        } else {
            $text | Out-Printer -Name $printerName
        }
        return @{ success = $true; printer = (if ($printerName) { $printerName } else { "Default" }) }
    } catch {
        return @{ success = $false; printer = $printerName; error = $_.Exception.Message }
    }
}

while ($listener.IsListening) {
    try {
        $cxt = $listener.GetContext()
        $req = $cxt.Request
        $path = $req.RawUrl.ToLower()

        if ($req.HttpMethod -eq "OPTIONS") {
            Send-CorsResponse $cxt "{}" 200
            continue
        }

        # 1. Health status
        if ($path -eq "/status" -or $path -eq "/") {
            $st = @{
                status = "online"
                version = "3.1-dual"
                port = $activePort
                app = "Smart Restaurant Dual Thermal Print Bridge"
                printers = @{
                    cashierIp = $defaultCashierIp
                    kitchenIp = $defaultKitchenIp
                    port = $defaultPort
                }
                time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            }
            Send-CorsResponse $cxt ($st | ConvertTo-Json -Depth 3)
            continue
        }

        # 2. Get installed Windows printers
        if ($path -eq "/printers") {
            $pList = @()
            try {
                $pList = Get-Printer | ForEach-Object {
                    @{
                        name = $_.Name
                        port = $_.PortName
                        isDefault = $_.Default
                        status = $_.PrinterStatus.ToString()
                    }
                }
            } catch {
                $pList = @()
            }
            Send-CorsResponse $cxt ($pList | ConvertTo-Json)
            continue
        }

        # Read JSON body
        $body = ""
        if ($req.HasEntityBody) {
            $rd = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
            $body = $rd.ReadToEnd()
            $rd.Close()
        }
        $data = @{}
        if (-not [string]::IsNullOrWhiteSpace($body)) {
            try { $data = $body | ConvertFrom-Json } catch {}
        }

        # 3. Print Kitchen Docket (IP 192.168.1.101)
        if ($path -eq "/print-kitchen") {
            $targetIp = if ($data.ip) { $data.ip } else { $defaultKitchenIp }
            $port = if ($data.port) { [int]$data.port } else { $defaultPort }
            $text = $data.text
            $rasterBase64 = if ($data.rasterBase64) { $data.rasterBase64 } elseif ($data.rawBase64) { $data.rawBase64 } else { $null }

            Write-Host "[Kitchen Print] Sending ticket to IP: ${targetIp}:${port}" -ForegroundColor Yellow
            $res = Print-ToSingleIp $targetIp $port $text $true $true $rasterBase64
            Send-CorsResponse $cxt ($res | ConvertTo-Json -Depth 3)
            continue
        }

        # 4. Print Cashier Receipt (IP 192.168.1.100 or Windows Printer)
        if ($path -eq "/print-cashier") {
            $printerName = $data.printerName
            $mode = $data.mode
            $targetIp = if ($data.ip) { $data.ip } else { $defaultCashierIp }
            $port = if ($data.port) { [int]$data.port } else { $defaultPort }
            $text = $data.text
            $rasterBase64 = if ($data.rasterBase64) { $data.rasterBase64 } elseif ($data.rawBase64) { $data.rawBase64 } else { $null }

            if ($mode -eq "windows" -and -not [string]::IsNullOrWhiteSpace($printerName)) {
                Write-Host "[Cashier Print] Sending receipt to Windows printer: $printerName" -ForegroundColor Cyan
                $res = Print-ToWindows $printerName $text $rasterBase64
            } else {
                Write-Host "[Cashier Print] Sending receipt to Network IP: ${targetIp}:${port}" -ForegroundColor Cyan
                $res = Print-ToSingleIp $targetIp $port $text $true $false $rasterBase64
            }
            Send-CorsResponse $cxt ($res | ConvertTo-Json -Depth 3)
            continue
        }

        # 5. Dual Print (Cashier + Kitchen simultaneously)
        if ($path -eq "/print-dual") {
            $cashierIp = if ($data.cashierIp) { $data.cashierIp } else { $defaultCashierIp }
            $kitchenIp = if ($data.kitchenIp) { $data.kitchenIp } else { $defaultKitchenIp }
            $port = if ($data.port) { [int]$data.port } else { $defaultPort }
            $cRaster = if ($data.cashierRasterBase64) { $data.cashierRasterBase64 } elseif ($data.rasterBase64) { $data.rasterBase64 } else { $null }
            $kRaster = if ($data.kitchenRasterBase64) { $data.kitchenRasterBase64 } else { $null }

            Write-Host "[Dual Print] Dispatching to Cashier ($cashierIp) and Kitchen ($kitchenIp)..." -ForegroundColor Green
            $cRes = if ($data.cashierMode -eq "windows" -and $data.cashierPrinterName) {
                Print-ToWindows $data.cashierPrinterName $data.cashierText $cRaster
            } else {
                Print-ToSingleIp $cashierIp $port $data.cashierText $true $false $cRaster
            }
            $kRes = Print-ToSingleIp $kitchenIp $port $data.kitchenText $true $true $kRaster

            $res = @{
                success = ($cRes.success -or $kRes.success)
                cashier = $cRes
                kitchen = $kRes
            }
            Send-CorsResponse $cxt ($res | ConvertTo-Json -Depth 3)
            continue
        }

        # 6. Test Print
        if ($path -eq "/test-print") {
            $type = if ($data.type) { $data.type } else { "both" }
            $cashierIp = if ($data.cashierIp) { $data.cashierIp } elseif ($data.ip) { $data.ip } else { $defaultCashierIp }
            $kitchenIp = if ($data.kitchenIp) { $data.kitchenIp } elseif ($data.secondaryIp) { $data.secondaryIp } else { $defaultKitchenIp }
            $port = if ($data.port) { [int]$data.port } else { $defaultPort }
            $printerName = $data.printerName
            $now = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

            $sampleCashier = "==========================================`r`n" +
                "     SMART RESTAURANT SYSTEM`r`n" +
                "   TEST PRINT - CASHIER [ 100 OK ]`r`n" +
                "==========================================`r`n" +
                "Target : Cashier Receipt Printer`r`n" +
                "Time   : $now`r`n" +
                "Port   : $port`r`n" +
                "Status : Direct Silent Printing Online`r`n" +
                "=========================================="

            $sampleKitchen = "==========================================`r`n" +
                "     SMART RESTAURANT SYSTEM`r`n" +
                "   TEST PRINT - KITCHEN [ 101 OK ]`r`n" +
                "==========================================`r`n" +
                "Target : Kitchen Order Prep Printer`r`n" +
                "Time   : $now`r`n" +
                "Port   : $port`r`n" +
                "Alert  : Buzzer and Paper Cut Activated`r`n" +
                "=========================================="

            if ($type -eq "cashier") {
                Write-Host "[Test] Testing Printer 1 (Cashier): $cashierIp" -ForegroundColor Magenta
                if ($data.mode -eq "windows" -and -not [string]::IsNullOrWhiteSpace($printerName)) {
                    $res = Print-ToWindows $printerName $sampleCashier
                } else {
                    $res = Print-ToSingleIp $cashierIp $port $sampleCashier $true $false
                }
                Send-CorsResponse $cxt ($res | ConvertTo-Json -Depth 3)
                continue
            }

            if ($type -eq "kitchen") {
                Write-Host "[Test] Testing Printer 2 (Kitchen): $kitchenIp" -ForegroundColor Magenta
                $res = Print-ToSingleIp $kitchenIp $port $sampleKitchen $true $true
                Send-CorsResponse $cxt ($res | ConvertTo-Json -Depth 3)
                continue
            }

            Write-Host "[Test] Testing both: Cashier ($cashierIp) + Kitchen ($kitchenIp)" -ForegroundColor Magenta
            $cRes = Print-ToSingleIp $cashierIp $port $sampleCashier $true $false
            $kRes = Print-ToSingleIp $kitchenIp $port $sampleKitchen $true $true

            $res = @{
                success = ($cRes.success -or $kRes.success)
                cashier = $cRes
                kitchen = $kRes
            }
            Send-CorsResponse $cxt ($res | ConvertTo-Json -Depth 3)
            continue
        }

        Send-CorsResponse $cxt '{"error":"Not Found"}' 404

    } catch {
        Write-Host "[Exception] $($_.Exception.Message)" -ForegroundColor Red
        Start-Sleep -Milliseconds 200
    }
}
