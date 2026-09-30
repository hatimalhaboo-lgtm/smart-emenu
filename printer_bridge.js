/**
 * ==============================================================================
 * Smart Restaurant POS - Lightweight Node.js Thermal Print Bridge
 * وسيط الطباعة الصامتة المباشر لنظام المطاعم الذكي (Node.js Service)
 * يدعم طابعتين:
 * 1. طابعة الكاشير وفواتير الحساب (IP: 192.168.1.100 أو طابعة ويندوز USB)
 * 2. طابعة المطبخ وبونات التحضير (IP: 192.168.1.101)
 * ==============================================================================
 */

const http = require('http');
const net = require('net');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8080;
const DEFAULT_CASHIER_IP = '192.168.1.100';
const DEFAULT_KITCHEN_IP = '192.168.1.101';
const DEFAULT_PORT = 9100;

function sendCors(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network': 'true'
  });
  res.end(JSON.stringify(data));
}

function encodeToWindows1256(str) {
  const buf = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      buf.push(code);
    } else if (code >= 0x0621 && code <= 0x063A) {
      const cpMap = [
        0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA,
        0xCB, 0xCC, 0xCD, 0xCE, 0xCF, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4,
        0xD5, 0xD6, 0xD8, 0xD9, 0xDA, 0xE0
      ];
      buf.push(cpMap[code - 0x0621] || 0x3F);
      continue;
    }
    // Full Unicode → Windows-1256 mapping table
    const w1256map = {
      // Arabic punctuation & special
      0x060C: 0xA1, // ،  Arabic comma
      0x00AD: 0xAD, // soft hyphen
      0x061B: 0xBA, // ؛  Arabic semicolon
      0x061F: 0xBF, // ؟  Arabic question mark
      // Arabic letters (ء–ي)
      0x0621: 0xC1, // ء
      0x0622: 0xC2, // آ
      0x0623: 0xC3, // أ
      0x0624: 0xC4, // ؤ
      0x0625: 0xC5, // إ
      0x0626: 0xC6, // ئ
      0x0627: 0xC7, // ا
      0x0628: 0xC8, // ب
      0x0629: 0xC9, // ة
      0x062A: 0xCA, // ت
      0x062B: 0xCB, // ث
      0x062C: 0xCC, // ج
      0x062D: 0xCD, // ح
      0x062E: 0xCE, // خ
      0x062F: 0xCF, // د
      0x0630: 0xD0, // ذ
      0x0631: 0xD1, // ر
      0x0632: 0xD2, // ز
      0x0633: 0xD3, // س
      0x0634: 0xD4, // ش
      0x0635: 0xD5, // ص
      0x0636: 0xD6, // ض
      0x0637: 0xD8, // ط
      0x0638: 0xD9, // ظ
      0x0639: 0xDA, // ع
      0x063A: 0xDB, // غ
      0x0640: 0xDC, // ـ tatweel
      0x0641: 0xDD, // ف
      0x0642: 0xDE, // ق
      0x0643: 0xDF, // ك
      0x0644: 0xE0, // ل
      0x0645: 0xE1, // م
      0x0646: 0xE2, // ن
      0x0647: 0xE3, // ه
      0x0648: 0xE4, // و
      0x0649: 0xE5, // ى alef maqsura
      0x064A: 0xE6, // ي
      // Arabic diacritics (tashkeel)
      0x064B: 0xEC, // ً tanwin fath
      0x064C: 0xED, // ٌ tanwin damm
      0x064D: 0xEE, // ٍ tanwin kasr
      0x064E: 0xF0, // َ fatha
      0x064F: 0xF1, // ُ damma
      0x0650: 0xF2, // ِ kasra
      0x0651: 0xF3, // ّ shadda
      0x0652: 0xF4, // ْ sukun
      0x0670: 0xFC, // ٰ superscript alef
      0x0671: 0xFA, // ٱ alef wasla
      // Eastern Arabic-Indic digits ٠-٩
      0x0660: 0xB0, // ٠
      0x0661: 0xB1, // ١
      0x0662: 0xB2, // ٢
      0x0663: 0xB3, // ٣
      0x0664: 0xB4, // ٤
      0x0665: 0xB5, // ٥
      0x0666: 0xB6, // ٦
      0x0667: 0xB7, // ٧
      0x0668: 0xB8, // ٨
      0x0669: 0xB9, // ٩
    };

    const mapped = w1256map[code];
    if (mapped !== undefined) {
      buf.push(mapped);
    } else if (code <= 0xFF) {
      buf.push(code);
    } else {
      buf.push(0x20); // unmapped → space
    }
  }
  return Buffer.from(buf);
}

function printToSingleIp(ip, port = DEFAULT_PORT, text = '', cut = true, beep = false, rasterBase64 = null) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3500);

    socket.connect(port, ip, () => {
      try {
        // Buzzer if kitchen printer
        if (beep) {
          socket.write(Buffer.from([0x1B, 0x42, 0x02, 0x02]));
        }

        if (rasterBase64 && typeof rasterBase64 === 'string') {
          // Send raw ESC/POS raster bit image directly (100% Arabic, 0% Chinese)
          const rasterBuf = Buffer.from(rasterBase64, 'base64');
          socket.write(rasterBuf);
        } else {
          // 1. ESC @ — Initialize / Reset printer
          socket.write(Buffer.from([0x1B, 0x40]));

          // 2. FS . — Cancel Chinese (GBK/Big5) character mode
          socket.write(Buffer.from([0x1C, 0x2E]));

          // 3. ESC t 22 — Select code page 22 (WPC1256 Arabic)
          socket.write(Buffer.from([0x1B, 0x74, 0x16]));

          // 4. Print encoded text (Windows-1256 single-byte)
          socket.write(encodeToWindows1256(text + "\r\n\r\n\r\n\r\n"));

          // 5. GS V 66 0 — Full paper cut
          if (cut) {
            socket.write(Buffer.from([0x1D, 0x56, 0x42, 0x00]));
          }
        }

        socket.end();
        resolve({ success: true, ip, port });
      } catch (err) {
        socket.destroy();
        resolve({ success: false, ip, error: err.message });
      }
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, ip, error: err.message });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, ip, error: 'انتهت مهلة الاتصال بالطابعة' });
    });
  });
}

function printToWindows(printerName, text = '', rasterBase64 = null) {
  return new Promise((resolve) => {
    const fs = require('fs');
    const os = require('os');

    let rawData;
    if (rasterBase64 && typeof rasterBase64 === 'string') {
      rawData = Buffer.from(rasterBase64, 'base64');
    } else {
      const initBuf  = Buffer.from([0x1B,0x40]);               // ESC @ reset
      const cnclBuf  = Buffer.from([0x1C,0x2E]);               // FS .  cancel Chinese
      const cpBuf    = Buffer.from([0x1B,0x74,0x16]);          // ESC t 22 WPC1256
      const textBuf  = encodeToWindows1256(text + "\r\n\r\n\r\n\r\n");
      const cutBuf   = Buffer.from([0x1D,0x56,0x42,0x00]);     // GS V cut
      rawData = Buffer.concat([initBuf, cnclBuf, cpBuf, textBuf, cutBuf]);
    }

    const tmpFile = os.tmpdir() + '\\prn_' + Date.now() + '.prn';

    fs.writeFile(tmpFile, rawData, (writeErr) => {
      if (writeErr) {
        resolve({ success: false, error: 'Cannot write temp file: ' + writeErr.message });
        return;
      }
      const safeName = (printerName || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const cmd = safeName
        ? `copy /b "${tmpFile}" "\\\\.\\${safeName}"`
        : `copy /b "${tmpFile}" prn`;

      exec(cmd, (err) => {
        fs.unlink(tmpFile, () => {});
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, printer: printerName || 'Default' });
        }
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendCors(res, 200, {});
  }

  const url = req.url.toLowerCase();

  // 1. Status Check
  if (url === '/status' || url === '/') {
    return sendCors(res, 200, {
      status: 'online',
      version: '3.0-dual',
      port: PORT,
      app: 'Smart Restaurant Dual Thermal Print Bridge',
      printers: {
        cashierIp: DEFAULT_CASHIER_IP,
        kitchenIp: DEFAULT_KITCHEN_IP,
        port: DEFAULT_PORT
      },
      time: new Date().toISOString()
    });
  }

  // 2. Installed Windows Printers
  if (url === '/printers') {
    const cmd = `powershell -Command "Get-Printer | Select-Object Name, PortName, Default | ConvertTo-Json"`;
    return exec(cmd, (err, stdout) => {
      if (err || !stdout) {
        return sendCors(res, 200, []);
      }
      try {
        const raw = JSON.parse(stdout);
        const list = Array.isArray(raw) ? raw : [raw];
        const formatted = list.map(p => ({
          name: p.Name,
          port: p.PortName,
          isDefault: p.Default
        }));
        return sendCors(res, 200, formatted);
      } catch (e) {
        return sendCors(res, 200, []);
      }
    });
  }

  // Parse Body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    let data = {};
    try { if (body) data = JSON.parse(body); } catch (e) {}

    // 3. Kitchen Print (الطابعة 2: المطبخ 192.168.1.101)
    if (url === '/print-kitchen') {
      const targetIp = data.ip || DEFAULT_KITCHEN_IP;
      const port = data.port || DEFAULT_PORT;
      const text = data.text || '';
      const rasterBase64 = data.rasterBase64 || data.rawBase64 || null;
      console.log(`[Kitchen Print] Sending to Kitchen IP: ${targetIp}:${port} (raster: ${!!rasterBase64})`);
      const result = await printToSingleIp(targetIp, port, text, true, true, rasterBase64);
      return sendCors(res, 200, result);
    }

    // 4. Cashier Print (الطابعة 1: الكاشير 192.168.1.100)
    if (url === '/print-cashier') {
      const { mode, printerName, text } = data;
      const targetIp = data.ip || DEFAULT_CASHIER_IP;
      const port = data.port || DEFAULT_PORT;
      const rasterBase64 = data.rasterBase64 || data.rawBase64 || null;

      if (mode === 'windows' && printerName) {
        console.log(`[Cashier Print] Sending to Windows Printer: ${printerName} (raster: ${!!rasterBase64})`);
        const result = await printToWindows(printerName, text || '', rasterBase64);
        return sendCors(res, 200, result);
      } else {
        console.log(`[Cashier Print] Sending to Cashier IP: ${targetIp}:${port} (raster: ${!!rasterBase64})`);
        const result = await printToSingleIp(targetIp, port, text || '', true, false, rasterBase64);
        return sendCors(res, 200, result);
      }
    }

    // 5. Dual Print (الكاشير 100 + المطبخ 101 معاً)
    if (url === '/print-dual') {
      const cashierIp = data.cashierIp || DEFAULT_CASHIER_IP;
      const kitchenIp = data.kitchenIp || DEFAULT_KITCHEN_IP;
      const port = data.port || DEFAULT_PORT;
      const cRaster = data.cashierRasterBase64 || data.rasterBase64 || null;
      const kRaster = data.kitchenRasterBase64 || null;
      
      const cashierTask = (data.cashierMode === 'windows' && data.cashierPrinterName)
        ? printToWindows(data.cashierPrinterName, data.cashierText || '', cRaster)
        : printToSingleIp(cashierIp, port, data.cashierText || '', true, false, cRaster);
        
      const kitchenTask = printToSingleIp(kitchenIp, port, data.kitchenText || '', true, true, kRaster);

      const [cRes, kRes] = await Promise.all([cashierTask, kitchenTask]);
      return sendCors(res, 200, {
        success: cRes.success || kRes.success,
        cashier: cRes,
        kitchen: kRes
      });
    }

    // 6. Test Print (تجربة طابعة الكاشير 100، أو طابعة المطبخ 101، أو كلاهما معاً)
    if (url === '/test-print') {
      const type = data.type || 'both'; // 'cashier', 'kitchen', 'both'
      const cashierIp = data.cashierIp || data.ip || DEFAULT_CASHIER_IP;
      const kitchenIp = data.kitchenIp || data.secondaryIp || DEFAULT_KITCHEN_IP;
      const port = data.port || DEFAULT_PORT;
      const printerName = data.printerName;
      const now = new Date().toLocaleString('ar-EG');

      if (type === 'cashier') {
        const sampleCashier = `\n==========================================\n     نظام إدارة وتشغيل المطاعم الذكي\n        SMART RESTAURANT SYSTEM\n==========================================\n    تجربة طابعة الكاشير  [ 100 OK ]\n------------------------------------------\nالهدف    : طابعة فواتير الكاشير والزبائن\nالوقت    : ${now}\nالمنفذ   : ${port}\nعنوان IP : ${data.mode === 'windows' ? (printerName || 'طابعة ويندوز') : cashierIp}\nالحالة   : متصل بالطباعة الصامتة المباشرة\n==========================================\n`;

        if (data.mode === 'windows' && printerName) {
          const resWin = await printToWindows(printerName, sampleCashier);
          return sendCors(res, 200, resWin);
        } else {
          const resIp = await printToSingleIp(cashierIp, port, sampleCashier, true, false);
          return sendCors(res, 200, resIp);
        }
      }

      if (type === 'kitchen') {
        const sampleKitchen = `\n==========================================\n     نظام إدارة وتشغيل المطاعم الذكي\n        SMART RESTAURANT SYSTEM\n==========================================\n    تجربة طابعة المطبخ  [ 101 OK ]\n------------------------------------------\nالهدف    : طابعة بونات تحضير المطبخ\nالوقت    : ${now}\nالمنفذ   : ${port}\nعنوان IP : ${kitchenIp}\nالحالة   : متصل بالطباعة الصامتة وتنبيه الصفارة\n==========================================\n`;
        const resK = await printToSingleIp(kitchenIp, port, sampleKitchen, true, true);
        return sendCors(res, 200, resK);
      }

      // Both (الكاشير 100 + المطبخ 101)
      const sampleBothCashier = `\n==========================================\n     نظام إدارة وتشغيل المطاعم الذكي\n==========================================\n   تجربة طابعة 1: الكاشير [ 100 OK ]\nالوقت: ${now}\n==========================================\n`;
      const sampleBothKitchen = `\n==========================================\n     نظام إدارة وتشغيل المطاعم الذكي\n==========================================\n   تجربة طابعة 2: المطبخ [ 101 OK ]\nالوقت: ${now}\n==========================================\n`;

      const tCashier = printToSingleIp(cashierIp, port, sampleBothCashier, true, false);
      const tKitchen = printToSingleIp(kitchenIp, port, sampleBothKitchen, true, true);

      const [r1, r2] = await Promise.all([tCashier, tKitchen]);
      return sendCors(res, 200, {
        success: r1.success || r2.success,
        cashier: r1,
        kitchen: r2
      });
    }

    // 7. General Station Print (Dynamic IP or USB Printer)
    if (url === '/print-station') {
      const { connectionType, ip, port, usbPrinterName, text, rasterBase64, cut, buzzer } = data;
      const targetPort = port || DEFAULT_PORT;
      const targetIp = ip || DEFAULT_CASHIER_IP;
      const needCut = (cut !== false);
      const needBuzzer = !!buzzer;

      if (connectionType === 'usb' && usbPrinterName) {
        console.log(`[Station Print] Sending to USB Printer: ${usbPrinterName} (raster: ${!!rasterBase64})`);
        const result = await printToWindows(usbPrinterName, text || '', rasterBase64);
        return sendCors(res, 200, result);
      } else {
        console.log(`[Station Print] Sending to IP: ${targetIp}:${targetPort} (raster: ${!!rasterBase64}, buzzer: ${needBuzzer})`);
        const result = await printToSingleIp(targetIp, targetPort, text || '', needCut, needBuzzer, rasterBase64);
        return sendCors(res, 200, result);
      }
    }

    return sendCors(res, 404, { error: 'Not Found' });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[OK] Smart Dual Print Bridge running on http://127.0.0.1:${PORT}/`);
  console.log(`[OK] Printer 1 (Cashier): ${DEFAULT_CASHIER_IP}:${DEFAULT_PORT}`);
  console.log(`[OK] Printer 2 (Kitchen): ${DEFAULT_KITCHEN_IP}:${DEFAULT_PORT}`);
});
