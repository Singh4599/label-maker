'use strict';

/* ═══════════════════════════════════════════════════════════════
   QZ TRAY INTEGRATION — 365 Spicery Label Studio
   MODE: Pixel Printing (HTML → TSC Driver handles everything)
   Fallback: Chrome window.print() if QZ not available
═══════════════════════════════════════════════════════════════ */

const QZP = {
  connected: false,
  // HARDCODED — Front: TSC TE244 (Copy 1), Back: TSC TE244
  frontPrinter: 'TSC TE244 (Copy 1)',
  backPrinter:  'TSC TE244',
  printers: [],
  _retrying: false
};

/* ─── Init on page load ─── */
window.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  if (typeof qz !== 'undefined') {
    qzConnect();
  } else {
    setQZStatus('disconnected');
  }
});

/* ─── Ensure connected + auto-reconnect if dropped ─── */
async function _ensureConnected() {
  if (typeof qz === 'undefined') return false;
  if (!QZP.connected || !qz.websocket.isActive()) {
    console.log('[QZ] Auto-reconnecting...');
    await qzConnect();
  }
  return QZP.connected;
}

/* ─── Connect to QZ Tray ─── */
async function qzConnect() {
  if (typeof qz === 'undefined') { setQZStatus('disconnected'); return; }
  if (QZP._retrying) return;
  QZP._retrying = true;
  setQZStatus('connecting');
  try {
    qz.security.setCertificatePromise((resolve) => resolve());
    qz.security.setSignaturePromise(() => (resolve) => resolve());
    if (qz.websocket.isActive()) await qz.websocket.disconnect();
    await qz.websocket.connect({ retries: 2, delay: 1 });
    QZP.connected = true;
    setQZStatus('connected');
    await refreshPrinters();
  } catch (err) {
    QZP.connected = false;
    setQZStatus('disconnected');
    console.warn('[QZ] Not connected — fallback to Chrome print:', err.message);
  } finally {
    QZP._retrying = false;
  }
}

/* ─── Refresh printer list ─── */
async function refreshPrinters() {
  if (!QZP.connected || typeof qz === 'undefined') return;
  try {
    const list = await qz.printers.find();
    QZP.printers = Array.isArray(list) ? list : [list];
    populatePrinterDropdowns(QZP.printers);
  } catch (e) {
    console.warn('[QZ] Could not fetch printers:', e);
  }
}

/* ─── Status indicator ─── */
function setQZStatus(state) {
  const dot = document.getElementById('qz-dot');
  const txt = document.getElementById('qz-status-text');
  const modalDot = document.getElementById('qz-modal-dot');
  const modalTxt = document.getElementById('qz-modal-status');
  const installTip = document.getElementById('qz-install-tip');

  const states = {
    connecting:   { color: '#f59e0b', label: 'Connecting...' },
    connected:    { color: '#22c55e', label: 'Printer Ready' },
    disconnected: { color: '#ef4444', label: 'QZ Not Running' },
    printing:     { color: '#3b82f6', label: 'Printing...' }
  };
  const s = states[state] || states.disconnected;

  if (dot)       dot.style.background = s.color;
  if (txt)       txt.textContent = s.label;
  if (modalDot)  modalDot.style.background = s.color;
  if (modalTxt)  modalTxt.textContent = s.label;
  if (installTip) {
    installTip.style.display = state === 'disconnected' ? 'block' : 'none';
  }
}

/* ─── Modal Open/Close ─── */
function openPrinterSettings() {
  const modal = document.getElementById('printer-modal');
  if (modal) modal.classList.add('active');
  if (QZP.connected) {
    refreshPrinters();
  } else if (!QZP._retrying) {
    qzConnect();
  }
}

function closePrinterSettings(e) {
  if (e && e.target !== document.getElementById('printer-modal')) return;
  const modal = document.getElementById('printer-modal');
  if (modal) modal.classList.remove('active');
}

/* ─── Populate dropdowns ─── */
function populatePrinterDropdowns(printers) {
  const fSel = document.getElementById('front-printer-sel');
  const bSel = document.getElementById('back-printer-sel');
  if (!fSel || !bSel) return;

  const makeOpts = (savedVal) => printers.map(p =>
    `<option value="${p}"${p === savedVal ? ' selected' : ''}>${p}</option>`
  ).join('');

  fSel.innerHTML = '<option value="">-- Select Printer --</option>' + makeOpts(QZP.frontPrinter);
  bSel.innerHTML = '<option value="">-- Select Printer --</option>' + makeOpts(QZP.backPrinter);
}

/* ─── Load saved settings into modal ─── */
function loadSavedSettings() {
  const gapEl = document.getElementById('label-gap');
  if (gapEl) gapEl.value = localStorage.getItem('labelGap') || '3';
}

/* ─── Save printer settings ─── */
function savePrinterSettings() {
  const fpEl = document.getElementById('front-printer-sel');
  const bpEl = document.getElementById('back-printer-sel');
  const gpEl = document.getElementById('label-gap');

  if (!fpEl || !bpEl || !gpEl) {
    showToast('Settings elements not found', 'error'); return;
  }

  QZP.frontPrinter = fpEl.value || '';
  QZP.backPrinter  = bpEl.value || '';

  localStorage.setItem('frontPrinter', QZP.frontPrinter);
  localStorage.setItem('backPrinter',  QZP.backPrinter);
  localStorage.setItem('labelGap',     gpEl.value);

  closePrinterSettings();
  showToast('✓ Printer settings saved!', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   HTML LABEL BUILDERS (Pixel Mode — TSC driver handles printing)
   No more TSPL. Labels are HTML rendered by QZ as images.
   TSC driver handles: gap detection, calibration, tear-off.
═══════════════════════════════════════════════════════════════ */

/* ─── Sanitize for HTML ─── */
function htmlSafe(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Build FRONT label HTML (65mm x 25mm) ─── */
function buildFrontHTML(name) {
  const n = htmlSafe((name || '').toUpperCase());
  // Adjust font size based on name length
  let fontSize = '28pt';
  if (n.length > 14)      fontSize = '14pt';
  else if (n.length > 10) fontSize = '18pt';
  else if (n.length > 7)  fontSize = '22pt';

  return `<html><head><style>
    @page { size: 65mm 25mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 65mm; height: 25mm;
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: bold;
      font-size: ${fontSize};
      text-align: center;
      overflow: hidden;
      padding: 1mm 2mm;
      word-wrap: break-word;
    }
  </style></head><body>${n}</body></html>`;
}

/* ─── Build BACK label HTML (50mm x 90mm) ─── */
function buildBackHTML(p, v, bn, pd, bb) {
  const name = htmlSafe((p.n || '').toUpperCase());
  const cat  = htmlSafe(p.c || '-');
  const ingr = htmlSafe(p.i || '-');
  const nw   = htmlSafe(`${v.d} (${v.oz})`);
  const bno  = htmlSafe(bn || '-');
  const pkd  = htmlSafe(pd || '-');
  const exp  = htmlSafe(bb || '-');
  const mrp  = parseFloat(v.m) || 0;
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);

  return `<html><head><style>
    @page { size: 50mm 90mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 50mm; height: 90mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7pt;
      padding: 2mm 2mm 1mm 2mm;
      overflow: hidden;
    }
    .title {
      font-size: 14pt; font-weight: bold;
      text-align: center;
      margin-bottom: 2mm;
      word-wrap: break-word;
    }
    .cat-box {
      border: 0.5pt solid #000;
      padding: 1mm 2mm;
      font-size: 7pt;
      margin-bottom: 1.5mm;
    }
    .section-label { font-weight: bold; font-size: 8pt; margin-bottom: 0.5mm; }
    .ingredients { font-size: 6.5pt; margin-bottom: 2mm; word-wrap: break-word; }
    .details { border-top: 0.5pt solid #000; padding-top: 1mm; }
    .detail-row { font-size: 8pt; font-weight: bold; margin-bottom: 0.5mm; }
    .mrp-section {
      border-top: 1pt solid #000;
      margin-top: 1.5mm;
      padding-top: 1mm;
      text-align: center;
    }
    .mrp-value { font-size: 14pt; font-weight: bold; }
    .mrp-sub { font-size: 6pt; }
  </style></head><body>
    <div class="title">${name}</div>
    <div class="cat-box">Category: ${cat}</div>
    <div class="section-label">INGREDIENTS :-</div>
    <div class="ingredients">${ingr}</div>
    <div class="details">
      <div class="detail-row">NET WT: ${nw}</div>
      <div class="detail-row">BATCH: ${bno}</div>
      <div class="detail-row">PKD: ${pkd}</div>
      <div class="detail-row">EXP: ${exp}</div>
    </div>
    <div class="mrp-section">
      <div class="mrp-value">MRP : Rs.${mrp}/-</div>
      <div class="mrp-sub">(INCL. OF ALL TAXES)</div>
      <div class="mrp-sub">FOR 1g = Rs.${pg}</div>
    </div>
  </body></html>`;
}

/* ═══════════════════════════════════════════════════════════════
   PIXEL PRINT FUNCTIONS — HTML rendered through TSC driver
   Driver handles: gap, size, calibration, tear-off positioning
═══════════════════════════════════════════════════════════════ */

/* ─── Create pixel config for a printer ─── */
function _pixelConfig(printerName, widthMM, heightMM) {
  // Convert mm to inches (QZ uses inches for pixel mode)
  const w = widthMM / 25.4;
  const h = heightMM / 25.4;
  return qz.configs.create(printerName, {
    units: 'in',
    size: { width: w, height: h },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    colorType: 'blackwhite',
    interpolation: 'nearest-neighbor',
    rasterize: true,
    scaleContent: true
  });
}

/* ─── Print Front via QZ (Pixel HTML, auto-reconnect) ─── */
async function qzPrintFront(name, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  if (!QZP.frontPrinter) return false;

  const html = buildFrontHTML(name);
  console.log('[FRONT HTML] Generated');
  try {
    setQZStatus('printing');
    const config = _pixelConfig(QZP.frontPrinter, 65, 25);
    // Print each copy as a separate job for reliability
    for (let i = 0; i < copies; i++) {
      await qz.print(config, [{ type: 'pixel', format: 'html', data: html }]);
    }
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Front Printer!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

/* ─── Print Back via QZ (Pixel HTML, auto-reconnect) ─── */
async function qzPrintBack(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  if (!QZP.backPrinter) return false;

  const html = buildBackHTML(p, v, bn, pd, bb);
  console.log('[BACK HTML] Generated');
  try {
    setQZStatus('printing');
    const config = _pixelConfig(QZP.backPrinter, 50, 90);
    for (let i = 0; i < copies; i++) {
      await qz.print(config, [{ type: 'pixel', format: 'html', data: html }]);
    }
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Back Printer!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

/* ─── Test print ─── */
async function testPrint() {
  if (typeof qz === 'undefined' || !QZP.connected) {
    showToast('QZ Tray not connected!', 'error'); return;
  }
  const printer = QZP.frontPrinter || QZP.backPrinter;
  if (!printer) {
    showToast('Select a printer first and save!', 'error'); return;
  }
  const html = `<html><head><style>
    @page { size: 65mm 25mm; margin: 0; }
    body { width:65mm; height:25mm; display:flex; align-items:center; justify-content:center;
           font-family:Arial; font-weight:bold; font-size:20pt; text-align:center; }
  </style></head><body>TEST PRINT<br><span style="font-size:10pt">365 Spicery Label Studio</span></body></html>`;
  try {
    const config = _pixelConfig(printer, 65, 25);
    await qz.print(config, [{ type: 'pixel', format: 'html', data: html }]);
    showToast('✓ Test print sent!', 'success');
  } catch (e) {
    showToast('Test print failed: ' + e.message, 'error');
  }
}

/* ─── Legacy helpers (kept for Chrome fallback compatibility) ─── */
function tsplSafe(str) {
  return (str || '').replace(/—/g, '-').replace(/₹/g, 'Rs.').replace(/\u20B9/g, 'Rs.')
    .replace(/[^\x00-\x7F]/g, '').replace(/"/g, "'");
}
function wrapText(text, maxChars) {
  text = (text || '').trim();
  if (!text) return ['-'];
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const t = cur ? cur + ' ' + w : w;
    if (t.length > maxChars) { if (cur) lines.push(cur); cur = w.length > maxChars ? w.substring(0, maxChars) : w; }
    else cur = t;
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [text.substring(0, maxChars)];
}
function getNutriLines(p) {
  return [
    `En:${p.e||0}kcal Prot:${p.p||0}g Carbs:${p.cb||0}g Sug:${p.ts||0}g`,
    `Fat:${p.tf||0}g SatFat:${p.sf||0}g Trans:${p.tr||0}g Chol:${p.ch||0}mg Na:${p.so||0}mg`
  ];
}
function getNutritionShort(p) { return getNutriLines(p).join(' | '); }
