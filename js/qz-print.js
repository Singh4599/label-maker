'use strict';

/* ═══════════════════════════════════════════════════════════════
   QZ TRAY INTEGRATION — 365 Spicery Label Studio
   Handles: Connection, Printer Discovery, TSPL Generation, Printing
   Fallback: Chrome window.print() if QZ not available
═══════════════════════════════════════════════════════════════ */

const QZP = {
  connected: false,
  frontPrinter: localStorage.getItem('frontPrinter') || '',
  backPrinter: localStorage.getItem('backPrinter') || '',
  gap: parseFloat(localStorage.getItem('labelGap') || '3'),
  printers: [],
  _retrying: false   // prevent multiple simultaneous retries
};

/* ─── Init on page load ─── */
window.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  // Only attempt QZ if the library actually loaded
  if (typeof qz !== 'undefined') {
    qzConnect();
  } else {
    setQZStatus('disconnected');
  }
});

/* ─── Connect to QZ Tray ─── */
async function qzConnect() {
  if (typeof qz === 'undefined') { setQZStatus('disconnected'); return; }
  if (QZP._retrying) return;         // prevent double-connect
  QZP._retrying = true;
  setQZStatus('connecting');
  try {
    // Free unsigned mode
    qz.security.setCertificatePromise((resolve, reject) => resolve());
    qz.security.setSignaturePromise((toSign) => {
      return (resolve, reject) => resolve();
    });

    // Disconnect first if already connected (prevents stale connection errors)
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }

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
    refreshPrinters();        // just refresh list
  } else if (!QZP._retrying) {
    qzConnect();              // retry ONLY if not already retrying
  }
}

function closePrinterSettings(e) {
  // Called from button (no e) OR from overlay click (e passed)
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
  if (gapEl) gapEl.value = QZP.gap;
}

/* ─── Save printer settings ─── */
function savePrinterSettings() {
  const fpEl = document.getElementById('front-printer-sel');
  const bpEl = document.getElementById('back-printer-sel');
  const gpEl = document.getElementById('label-gap');

  if (!fpEl || !bpEl || !gpEl) {
    showToast('Settings elements not found', 'error'); return;
  }

  const fp = fpEl.value || '';
  const bp = bpEl.value || '';
  const gp = Math.max(0, Math.min(10, parseFloat(gpEl.value) || 3));

  QZP.frontPrinter = fp;
  QZP.backPrinter  = bp;
  QZP.gap          = gp;

  localStorage.setItem('frontPrinter', fp);
  localStorage.setItem('backPrinter',  bp);
  localStorage.setItem('labelGap',     gp);

  closePrinterSettings();
  showToast('✓ Printer settings saved!', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   HTML LABEL BUILDERS
   Rendered by QZ Tray → Sent as pixel job to TSC driver
   Driver handles gap detection & calibration (same as Bartender)
   Sizes: Front = 65×25mm, Back = 50×90mm
═══════════════════════════════════════════════════════════════ */

/* ─── Sanitize text for HTML display ─── */
function htmlSafe(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Word-wrap helper ─── */
function wrapText(text, maxChars) {
  text = (text || '').trim();
  if (!text) return ['-'];
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (test.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.substring(0, maxChars) : w;
    } else { cur = test; }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [text.substring(0, maxChars)];
}

/* ─── Nutrition string ─── */
function getNutritionShort(p) {
  return [
    `Energy: ${p.e||0} kcal`, `Protein: ${p.p||0}g`,
    `Carbs: ${p.cb||0}g`,    `Sugars: ${p.ts||0}g`,
    `Fat: ${p.tf||0}g`,      `Sat. Fat: ${p.sf||0}g`,
    `Trans Fat: ${p.tr||0}g`,`Cholesterol: ${p.ch||0}mg`,
    `Sodium: ${p.so||0}mg`
  ].join(' | ');
}

/* ─── Build FRONT label HTML (65×25mm) ─── */
function buildFrontHTML(name) {
  const n = htmlSafe(name.toUpperCase());
  const fontSize = n.length <= 8 ? '18pt' : n.length <= 14 ? '13pt' : '9pt';
  return `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:65mm;height:25mm;display:flex;align-items:center;
         justify-content:center;background:#fff;overflow:hidden;padding:1mm;}
    .name{font-family:"Arial Black",Arial,sans-serif;font-size:${fontSize};
          font-weight:900;text-align:center;line-height:1.15;
          text-transform:uppercase;word-break:break-word;}
  </style></head><body><div class="name">${n}</div></body></html>`;
}

/* ─── Build BACK label HTML (50×90mm) ─── */
function buildBackHTML(p, v, bn, pd, bb) {
  const mrp    = parseFloat(v.m) || 0;
  const pg     = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name   = htmlSafe(p.n.toUpperCase());
  const cat    = htmlSafe(p.c || '-');
  const ingr   = htmlSafe(p.i || '-');
  const nw     = htmlSafe(`${v.d} (${v.oz})`);
  const batch  = htmlSafe(bn || '-');
  const nutri  = htmlSafe(getNutritionShort(p));

  return `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:50mm;height:90mm;background:#fff;overflow:hidden;
         font-family:Arial,sans-serif;font-size:5.5pt;padding:0.8mm;}
    .name{font-family:"Arial Black",Arial,sans-serif;font-size:9.5pt;
          font-weight:900;text-align:center;text-transform:uppercase;
          margin-bottom:0.4mm;line-height:1.1;}
    .cat{font-size:5pt;text-align:center;margin-bottom:0.8mm;}
    hr{border:none;border-top:0.5pt solid #000;margin:0.5mm 0;}
    .hdr{font-weight:700;font-size:6pt;}
    .ingr{font-size:5pt;margin-bottom:0.8mm;line-height:1.3;}
    .nutr-box{border:0.5pt solid #000;padding:0.5mm;
              font-size:5pt;margin:0.5mm 0;line-height:1.4;}
    .det{font-size:5.2pt;line-height:1.5;}
    .mrp{font-family:"Arial Black",Arial,sans-serif;font-size:9pt;
         font-weight:900;text-align:center;margin-top:0.5mm;}
    .tax{font-size:4.5pt;text-align:center;}
    .pg{font-size:5pt;text-align:center;}
  </style></head><body>
    <div class="name">${name}</div>
    <div class="cat">Category - ${cat}</div>
    <hr>
    <div class="hdr">INGREDIENTS :-</div>
    <div class="ingr">(In Descending Order By Weight) ${ingr}</div>
    <div class="hdr">NUTRITIONAL INFORMATION</div>
    <div style="font-size:4.8pt;margin-bottom:0.3mm;">Approx. Composition per 100g</div>
    <div class="nutr-box">${nutri}</div>
    <hr>
    <div class="det">
      NET WEIGHT : ${nw}<br>
      BATCH NO : ${batch}<br>
      DATE OF PACKING : ${htmlSafe(pd)}<br>
      BEST BEFORE : ${htmlSafe(bb)}
    </div>
    <hr>
    <div class="mrp">MRP : &#8377;${mrp}/-</div>
    <div class="tax">(INCL. OF ALL TAXES)</div>
    <div class="pg">FOR 1g = &#8377; ${pg}</div>
  </body></html>`;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PRINT FUNCTIONS — pixel/HTML mode via TSC driver
   Use original TSC printers (NOT Generic RAW) — driver manages gap
═══════════════════════════════════════════════════════════════ */

function _qzPixelConfig(printerName, widthMM, heightMM) {
  return qz.configs.create(printerName, {
    size     : { width: widthMM / 25.4, height: heightMM / 25.4 }, // inches
    units    : 'in',
    margins  : 0,
    colorType: 'blackwhite',
    copies   : 1  // always 1 — we loop for multiple copies
  });
}

/* ─── Print Front via QZ (pixel/HTML) ─── */
async function qzPrintFront(name, copies) {
  console.log('[QZ DEBUG] qz defined:', typeof qz !== 'undefined', '| connected:', QZP.connected, '| frontPrinter:', QZP.frontPrinter);
  if (typeof qz === 'undefined' || !QZP.connected || !QZP.frontPrinter) {
    console.warn('[QZ] Returning false — check debug above');
    return false;
  }
  const html   = buildFrontHTML(name);
  const config = _qzPixelConfig(QZP.frontPrinter, 65, 25);
  console.log('[FRONT HTML]\n', html);
  try {
    setQZStatus('printing');
    // Send each copy as a separate job — prevents multi-copy gap detection error
    for (let i = 0; i < copies; i++) {
      await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
      if (i < copies - 1) await new Promise(r => setTimeout(r, 800)); // brief pause between copies
    }
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Front Printer!`, 'success');
    return true;
  } catch (err) {
    setQZStatus('connected');
    showToast('QZ Print error: ' + err.message + ' — switching to Chrome print', 'error');
    return false;
  }
}

/* ─── Print Back via QZ (pixel/HTML) ─── */
async function qzPrintBack(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined' || !QZP.connected || !QZP.backPrinter) return false;
  const html   = buildBackHTML(p, v, bn, pd, bb);
  const config = _qzPixelConfig(QZP.backPrinter, 50, 90);
  console.log('[BACK HTML]\n', html);
  try {
    setQZStatus('printing');
    for (let i = 0; i < copies; i++) {
      await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
      if (i < copies - 1) await new Promise(r => setTimeout(r, 1200)); // longer pause for back label
    }
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Back Printer!`, 'success');
    return true;
  } catch (err) {
    setQZStatus('connected');
    showToast('QZ Print error: ' + err.message + ' — switching to Chrome print', 'error');
    return false;
  }
}

/* ─── Test print (front printer, 65×25mm, HTML mode) ─── */
async function testPrint() {
  if (typeof qz === 'undefined' || !QZP.connected) {
    showToast('QZ Tray not connected!', 'error'); return;
  }
  const printer = QZP.frontPrinter || QZP.backPrinter;
  if (!printer) {
    showToast('Select a printer first and save!', 'error'); return;
  }
  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:65mm;height:25mm;display:flex;flex-direction:column;
         align-items:center;justify-content:center;background:#fff;
         font-family:Arial,sans-serif;padding:1mm;}
    h1{font-size:14pt;font-weight:900;}
    p{font-size:6pt;margin-top:1mm;}
  </style></head><body>
    <h1>TEST PRINT</h1>
    <p>365 Spicery Label Studio</p>
    <p>${htmlSafe(printer)}</p>
  </body></html>`;
  try {
    const config = _qzPixelConfig(printer, 65, 25, 1);
    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    showToast('✓ Test print sent!', 'success');
  } catch (e) {
    showToast('Test print failed: ' + e.message, 'error');
  }
}

/* ─── Calibrate printer (one-time, on label roll change) ─── */
async function calibratePrinter() {
  if (typeof qz === 'undefined' || !QZP.connected) {
    showToast('QZ Tray not connected!', 'error'); return;
  }
  const printer = QZP.frontPrinter || QZP.backPrinter;
  if (!printer) {
    showToast('Select a printer first and save!', 'error'); return;
  }
  try {
    const config = qz.configs.create(printer);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: 'GAPDETECT\r\n' }]);
    showToast('✓ Printer calibrated! Gap sensor set.', 'success');
  } catch (e) {
    showToast('Calibration failed: ' + e.message, 'error');
  }
}

