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
   TSPL COMMAND GENERATORS
   TSC TE244 — 203 DPI — TSPL2 language
   IMPORTANT: ALL text must be ASCII only — no ₹, —, or Unicode
═══════════════════════════════════════════════════════════════ */

/* ─── Sanitize text for TSPL (ASCII only) ─── */
function tsplSafe(str) {
  return (str || '')
    .replace(/—/g, '-')           // em-dash → hyphen
    .replace(/₹/g, 'Rs.')         // rupee → Rs.
    .replace(/[^\x00-\x7F]/g, '') // strip any remaining non-ASCII
    .replace(/"/g, "'");          // double quotes break TSPL TEXT command
}

/* ─── Generate FRONT label TSPL ─── */
function buildFrontTSPL(name, copies) {
  const w = 65, h = 25, gap = QZP.gap;
  const W = w * 8; // 520 dots
  const safeName = tsplSafe(name.toUpperCase());

  // Font '4' at xm=3: charW=72 → max chars = floor(520/72) = 7
  // Font '4' at xm=2: charW=48 → max chars = floor(520/48) = 10
  // Font '3' at xm=2: charW=32 → max chars = floor(520/32) = 16
  let font, xm, ym, lines;

  const l7  = wrapText(safeName, 7);
  const l10 = wrapText(safeName, 10);
  const l16 = wrapText(safeName, 16);

  if (l7.length <= 1) {
    font = '4'; xm = 3; ym = 3; lines = l7;
  } else if (l10.length <= 2) {
    font = '4'; xm = 2; ym = 2; lines = l10;
  } else {
    font = '3'; xm = 2; ym = 2; lines = l16;
  }

  const totalLines = lines.length;
  const charW  = (font === '4' ? 24 : 16) * xm;
  const fontH  = font === '4' ? 32 : 24;
  const gap2   = font === '4' ? 8 : 6;
  const lineHeight = fontH * ym + gap2;
  const totalH = lineHeight * totalLines;
  const yStart = Math.max(4, Math.round((h * 8) / 2 - totalH / 2));

  let textCmds = '';
  lines.forEach((lineText, i) => {
    const yPos  = Math.max(4, yStart + i * lineHeight);
    const textW = lineText.length * charW;
    const xPos  = Math.max(4, Math.round((W - textW) / 2));
    textCmds += `TEXT ${xPos},${yPos},"${font}",0,${xm},${ym},"${lineText}"\r\n`;
  });

  return [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gap} mm,0 mm`,
    `DIRECTION 1`,
    `REFERENCE 0,0`,
    `OFFSET 0 mm`,
    `CLS`,
    textCmds.trim(),
    `PRINT ${copies},1`
  ].join('\r\n');
}

/* ─── Generate BACK label TSPL ─── */
function buildBackTSPL(p, v, bn, pd, bb, copies) {
  const w = 50, h = 90, gap = QZP.gap;
  const mrp = parseFloat(v.m) || 0;
  const pg = (mrp / (parseFloat(v.g) || 1)).toFixed(2);

  // Dot conversion: 203 DPI = 8 dots/mm
  const d = (mm) => Math.round(mm * 8);
  const W = d(w); // total label width in dots

  // Center-align helper
  const cx = (text, charPxW) => Math.max(0, Math.round((W - text.length * charPxW) / 2));

  // Sanitize all text
  const safeName = tsplSafe(p.n.toUpperCase());
  const safeCat  = tsplSafe(`Category - ${p.c || '-'}`);
  const safeIngr = tsplSafe(`(In Descending Order By Weight) ${p.i || '-'}`);
  const safeDetails = [
    tsplSafe(`NET WEIGHT : ${v.d} (${v.oz})`),
    tsplSafe(`BATCH NO : ${bn || '-'}`),
    tsplSafe(`DATE OF PACKING : ${pd}`),
    tsplSafe(`BEST BEFORE : ${bb}`)
  ];
  const safeMRP = tsplSafe(`MRP : Rs.${mrp}/-`);
  const safePG  = tsplSafe(`FOR 1g = Rs ${pg}`);

  // Ingredient lines (wrap to 44 chars for 50mm label)
  const ingrLines = wrapText(safeIngr, 44);
  // Nutrition text
  const nsText  = getNutritionShort(p);
  const nsLines = wrapText(nsText, 48);

  let y = d(1.5);
  let cmds = '';

  // Helper: add text command
  const txt = (text, yPos, font, xm, ym, xForce) => {
    const charPxW = (font === '4' ? 24 : font === '3' ? 16 : 8) * xm;
    const x = (xForce !== undefined) ? xForce : cx(text, charPxW);
    cmds += `TEXT ${Math.max(0, x)},${yPos},"${font}",0,${xm},${ym},"${text}"\r\n`;
  };
  // Helper: horizontal bar
  const hbar = (yPos) => { cmds += `BAR 0,${yPos},${W},3\r\n`; };

  // ── Product name (large, centered) ──
  const nameLines = wrapText(safeName, 20);
  const nameXm = nameLines.length > 1 ? 1 : 2;
  const nameYm = nameLines.length > 1 ? 1 : 2;
  const nameLH  = (32 * nameYm) + 6;
  nameLines.forEach((nl) => {
    txt(nl, y, '4', nameXm, nameYm);
    y += nameLH;
  });
  y += d(0.5);

  // ── Category ──
  txt(safeCat, y, '2', 1, 1);
  y += d(4);

  // ── Separator ──
  hbar(y); y += d(2.5);

  // ── Ingredients ──
  txt('INGREDIENTS :-', y, '2', 1, 1, d(1));
  y += d(3);
  ingrLines.forEach(il => {
    cmds += `TEXT ${d(1)},${y},"2",0,1,1,"${il}"\r\n`;
    y += d(3);
  });
  y += d(1);

  // ── Nutrition header ──
  txt('NUTRITIONAL INFORMATION', y, '2', 1, 1);
  y += d(4);
  txt('Approx. Composition per 100 g', y, '2', 1, 1);
  y += d(3.5);

  // ── Nutrition box ──
  const boxH = d(nsLines.length * 3 + 2.5);
  cmds += `BOX ${d(0.5)},${y},${W - d(0.5)},${y + boxH},3\r\n`;
  y += d(1);
  nsLines.forEach(nl => {
    cmds += `TEXT ${d(1.5)},${y},"2",0,1,1,"${nl}"\r\n`;
    y += d(3);
  });
  y += d(2);

  // ── Separator ──
  hbar(y); y += d(2.5);

  // ── Details (net weight, batch, dates) ──
  safeDetails.forEach(det => {
    cmds += `TEXT ${d(1)},${y},"2",0,1,1,"${det}"\r\n`;
    y += d(3.5);
  });

  // ── Separator ──
  hbar(y); y += d(2.5);

  // ── MRP (large) ──
  txt(safeMRP, y, '3', 1, 2);
  y += d(6);
  txt('(INCL. OF ALL TAXES)', y, '2', 1, 1);
  y += d(4);
  txt(safePG, y, '2', 1, 1);

  return [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gap} mm,0 mm`,
    `DIRECTION 1`,
    `REFERENCE 0,0`,
    `OFFSET 0 mm`,
    `CLS`,
    cmds.trim(),
    `PRINT ${copies},1`
  ].join('\r\n');
}

/* ─── Wrap text into lines (ASCII safe) ─── */
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
      // If single word > maxChars, hard-split it
      cur = w.length > maxChars ? w.substring(0, maxChars) : w;
    } else {
      cur = test;
    }
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [text.substring(0, maxChars)];
}

/* ─── Short nutrition string for TSPL (ASCII, compact) ─── */
function getNutritionShort(p) {
  return [
    `Energy:${p.e||0}kcal`, `Protein:${p.p||0}g`,
    `Carbs:${p.cb||0}g`,    `Sugars:${p.ts||0}g`,
    `Fat:${p.tf||0}g`,      `Sat.Fat:${p.sf||0}g`,
    `Trans Fat:${p.tr||0}g`,`Cholesterol:${p.ch||0}mg`,
    `Sodium:${p.so||0}mg`
  ].join(', ');
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PRINT FUNCTIONS
   Called by pF() and pB() in app.js
   Returns true if QZ print succeeded, false = use Chrome fallback
═══════════════════════════════════════════════════════════════ */

/* ─── Print Front via QZ ─── */
async function qzPrintFront(name, copies) {
  if (typeof qz === 'undefined' || !QZP.connected || !QZP.frontPrinter) return false;

  const tspl = buildFrontTSPL(name, copies);
  console.log('[TSPL FRONT]\n', tspl);

  try {
    setQZStatus('printing');
    const config = qz.configs.create(QZP.frontPrinter);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Front Printer!`, 'success');
    return true;
  } catch (err) {
    setQZStatus('connected');
    showToast('QZ Print error: ' + err.message + ' — switching to Chrome print', 'error');
    return false;
  }
}

/* ─── Print Back via QZ ─── */
async function qzPrintBack(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined' || !QZP.connected || !QZP.backPrinter) return false;

  const tspl = buildBackTSPL(p, v, bn, pd, bb, copies);
  console.log('[TSPL BACK]\n', tspl);

  try {
    setQZStatus('printing');
    const config = qz.configs.create(QZP.backPrinter);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Back Printer!`, 'success');
    return true;
  } catch (err) {
    setQZStatus('connected');
    showToast('QZ Print error: ' + err.message + ' — switching to Chrome print', 'error');
    return false;
  }
}

/* ─── Test print (front printer, 65x25mm) ─── */
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
    `GAP ${QZP.gap} mm,0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `TEXT 20,30,"4",0,1,2,"TEST PRINT"`,
    `TEXT 20,100,"2",0,1,1,"365 Spicery Label Studio"`,
    `TEXT 20,130,"2",0,1,1,"Printer: ${tsplSafe(printer)}"`,
    `PRINT 1,1`
  ].join('\r\n');
  try {
    const config = qz.configs.create(printer);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    showToast('✓ Test print sent!', 'success');
  } catch (e) {
    showToast('Test print failed: ' + e.message, 'error');
  }
}
