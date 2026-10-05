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
  gap:      parseFloat(localStorage.getItem('labelGap')  || '3'),
  frontGap: parseFloat(localStorage.getItem('frontGap')  || '2'),
  backGap:  parseFloat(localStorage.getItem('backGap')   || '3'),
  printers: [],
  _retrying: false,
  _setupDone: { front: false, back: false }  // setup sent this session?
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

/* ─── Send SIZE+GAP setup to printer (no print, just stores calibration) ─── */
async function _setupPrinter(printer, widthMM, heightMM, gapMM) {
  if (!printer || typeof qz === 'undefined') return;
  try {
    const setup = [
      `SIZE ${widthMM} mm,${heightMM} mm`,
      `GAP ${gapMM} mm,0 mm`,
      `SET DARKNESS 12`,
      `DIRECTION 1`,
      ``
    ].join('\r\n');
    await qz.print(qz.configs.create(printer), [{ type: 'raw', format: 'plain', data: setup }]);
    console.log(`[QZ] Setup done: ${printer} ${widthMM}x${heightMM}mm gap=${gapMM}mm`);
  } catch(e) { console.warn('[QZ] Setup warn:', e.message); }
}

/* ─── Ensure connected + setup, auto-reconnect if dropped ─── */
async function _ensureConnected() {
  if (typeof qz === 'undefined') return false;
  const active = qz.websocket.isActive();
  if (!QZP.connected || !active) {
    console.log('[QZ] Auto-reconnecting...');
    QZP._setupDone = { front: false, back: false };
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
    // Setup both printers on connect (stores calibration in printer — no paper wasted)
    if (QZP.frontPrinter && !QZP._setupDone.front) {
      await _setupPrinter(QZP.frontPrinter, 65, 25, QZP.frontGap);
      QZP._setupDone.front = true;
    }
    if (QZP.backPrinter && !QZP._setupDone.back) {
      await _setupPrinter(QZP.backPrinter, 50, 90, QZP.backGap);
      QZP._setupDone.back = true;
    }
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
  localStorage.setItem('frontGap',     gp); // sync front gap to main gap
  localStorage.setItem('backGap',      gp); // sync back gap to main gap
  QZP.frontGap = gp;
  QZP.backGap  = gp;
  // Reset setup flags so new printers get configured on next print
  QZP._setupDone = { front: false, back: false };

  closePrinterSettings();
  showToast('✓ Printer settings saved!', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   TSPL LABEL BUILDERS
   TSC TE244 — 203 DPI — TSPL2
   Printer: Generic/Text Only (RAW passthrough)
   FORMFEED at end = no post-print error (Bartender does same)
═══════════════════════════════════════════════════════════════ */

/* ─── Sanitize for TSPL (ASCII only, no double quotes) ─── */
function tsplSafe(str) {
  return (str || '')
    .replace(/—/g, '-').replace(/₹/g, 'Rs.').replace(/\u20B9/g, 'Rs.')
    .replace(/[^\x00-\x7F]/g, '').replace(/"/g, "'");
}

/* ─── Sanitize for HTML (Chrome fallback) ─── */
function htmlSafe(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    const t = cur ? cur + ' ' + w : w;
    if (t.length > maxChars) { if (cur) lines.push(cur); cur = w.length > maxChars ? w.substring(0, maxChars) : w; }
    else cur = t;
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [text.substring(0, maxChars)];
}

/* ─── Nutrition — returns 2 short lines for TSPL ─── */
function getNutriLines(p) {
  return [
    `En:${p.e||0}kcal Prot:${p.p||0}g Carbs:${p.cb||0}g Sug:${p.ts||0}g`,
    `Fat:${p.tf||0}g SatFat:${p.sf||0}g Trans:${p.tr||0}g Chol:${p.ch||0}mg Na:${p.so||0}mg`
  ];
}
function getNutritionShort(p) { return getNutriLines(p).join(' | '); }

/* ─── Build FRONT label TSPL (65x25mm) ─── */
function buildFrontTSPL(name, copies) {
  const W = 65, H = 25;
  const gap = parseFloat(localStorage.getItem('frontGap') || '2'); // front labels usually 2mm gap
  const n = tsplSafe(name.toUpperCase());
  let font, xm, ym, maxCh;
  if (n.length <= 7)       { font='4'; xm=3; ym=3; maxCh=7;  }
  else if (n.length <= 10) { font='4'; xm=2; ym=2; maxCh=10; }
  else                     { font='3'; xm=2; ym=2; maxCh=16; }
  const lines    = wrapText(n, maxCh);
  const fontH    = (font === '4' ? 32 : 24) * ym;
  const lineStep = fontH + 8;
  const totalH   = lines.length * lineStep - 8;
  const yStart   = Math.max(4, Math.round((H * 8 - totalH) / 2));
  let textCmds = '';
  lines.forEach((ln, i) => {
    const charW = (font === '4' ? 24 : 16) * xm;
    const tW    = ln.length * charW;
    const x     = Math.max(4, Math.round((W * 8 - tW) / 2));
    const y     = yStart + i * lineStep;
    textCmds   += `TEXT ${x},${y},"${font}",0,${xm},${ym},"${ln}"\r\n`;
  });
  return [
    `SET DARKNESS 12`,
    `DIRECTION 1`,
    `CLS`,
    textCmds.trim(),
    `PRINT ${copies},1`,
    ``
  ].join('\r\n');
}

/* ─── Build BACK label TSPL (50x90mm) — matches Bartender layout ─── */
function buildBackTSPL(p, v, bn, pd, bb, copies) {
  const W = 50, H = 90, gap = QZP.gap || 3;
  const dw = W * 8, lm = 6, re = W * 8 - lm;
  const mrp  = parseFloat(v.m) || 0;
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe(p.n.toUpperCase());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');
  let y = 6, cmds = '';

  // Product Name (font3 xm2 ym2 = 32px wide, 48px tall, max 11 chars/line)
  wrapText(name, 11).slice(0, 2).forEach(ln => {
    const tw = ln.length * 32;
    cmds += `TEXT ${Math.max(lm, Math.round((dw - tw) / 2))},${y},"3",0,2,2,"${ln}"\r\n`;
    y += 52;
  });

  // Category box
  cmds += `BOX ${lm},${y},${re},${y+26},1\r\n`;
  cmds += `TEXT ${lm+4},${y+6},"1",0,1,1,"Category: ${cat}"\r\n`;
  y += 32;

  // Ingredients
  cmds += `TEXT ${lm},${y},"2",0,1,1,"INGREDIENTS :-"\r\n`; y += 22;
  wrapText(ingr, 42).slice(0, 5).forEach(ln => {
    cmds += `TEXT ${lm},${y},"1",0,1,1,"${ln}"\r\n`; y += 14;
  });
  y += 6;

  // Details
  cmds += `BAR ${lm},${y},${re - lm},1\r\n`; y += 5;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"NET WEIGHT : ${nw}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"BATCH NO : ${bno}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"DATE OF PACKING : ${tsplSafe(pd)}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"BEST BEFORE : ${tsplSafe(bb)}"\r\n`; y += 26;

  // MRP
  cmds += `BAR ${lm},${y},${re - lm},2\r\n`; y += 8;
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  cmds += `TEXT ${Math.max(lm, Math.round((dw - mrpTxt.length * 16) / 2))},${y},"3",0,1,2,"${mrpTxt}"\r\n`; y += 52;
  cmds += `TEXT ${lm},${y},"1",0,1,1,"(INCL. OF ALL TAXES)"\r\n`; y += 15;
  cmds += `TEXT ${lm},${y},"1",0,1,1,"FOR 1g = Rs.${pg}"\r\n`;

  return [
    `SET DARKNESS 12`,
    `DIRECTION 1`,
    `CLS`,
    cmds.trim(),
    `PRINT ${copies},1`,
    ``
  ].join('\r\n');
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PRINT FUNCTIONS — Raw TSPL via Generic/Text Only driver
   FORMFEED = printer advances cleanly to next label (no error)
═══════════════════════════════════════════════════════════════ */

function _qzRawConfig(printerName) {
  return qz.configs.create(printerName);
}

/* ─── Print Front via QZ (TSPL RAW, auto-reconnect) ─── */
async function qzPrintFront(name, copies) {
  if (typeof qz === 'undefined') return false;

  // Auto-reconnect if dropped (re-sends setup to printer)
  if (!await _ensureConnected()) {
    console.warn('[QZ] Could not connect — falling back to Chrome print');
    return false;
  }
  if (!QZP.frontPrinter) { console.warn('[QZ] No front printer selected'); return false; }

  // Re-setup if not done this session (handles power-cycle case)
  if (!QZP._setupDone.front) {
    await _setupPrinter(QZP.frontPrinter, 65, 25, QZP.frontGap);
    QZP._setupDone.front = true;
    await new Promise(r => setTimeout(r, 300)); // let printer process setup
  }

  const tspl = buildFrontTSPL(name, copies);
  console.log('[FRONT TSPL]\n', tspl);
  try {
    setQZStatus('printing');
    await qz.print(_qzRawConfig(QZP.frontPrinter), [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Front Printer!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    QZP._setupDone.front = false; // re-setup on next attempt
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

/* ─── Print Back via QZ (TSPL RAW, auto-reconnect) ─── */
async function qzPrintBack(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined') return false;

  if (!await _ensureConnected()) return false;
  if (!QZP.backPrinter) return false;

  if (!QZP._setupDone.back) {
    await _setupPrinter(QZP.backPrinter, 50, 90, QZP.backGap);
    QZP._setupDone.back = true;
    await new Promise(r => setTimeout(r, 300));
  }

  const tspl = buildBackTSPL(p, v, bn, pd, bb, copies);
  console.log('[BACK TSPL]\n', tspl);
  try {
    setQZStatus('printing');
    await qz.print(_qzRawConfig(QZP.backPrinter), [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Back Printer!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    QZP._setupDone.back = false; // re-setup on next attempt
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
  const tspl = [
    `SIZE 65 mm,25 mm`,
    `GAP ${QZP.gap || 3} mm,0 mm`,
    `SET DARKNESS 12`,
    `DIRECTION 1`,
    `CLS`,
    `TEXT 10,60,"4",0,2,2,"TEST PRINT"`,
    `TEXT 10,140,"2",0,1,1,"365 Spicery Label Studio"`,
    `PRINT 1,1`,
    `FORMFEED`,
    ``
  ].join('\r\n');
  try {
    const config = _qzRawConfig(printer);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    showToast('✓ Test print sent!', 'success');
  } catch (e) {
    showToast('Test print failed: ' + e.message, 'error');
  }
}
