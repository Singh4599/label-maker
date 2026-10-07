'use strict';

/* ═══════════════════════════════════════════════════════════════
   QZ TRAY — 365 Spicery Label Studio
   MODE: Raw TSPL via altPrinting (direct to printer port)
   PRINTERS: Hardcoded — TSC TE244 (Copy 1) = Front, TSC TE244 = Back
   GAP: 3mm both (from Printing Defaults — matches BarTender)
═══════════════════════════════════════════════════════════════ */

const QZP = {
  connected: false,
  frontPrinter: 'TSC TE244 (Copy 1)',  // HARDCODED — never changes
  backPrinter:  'TSC TE244',           // HARDCODED — never changes
  printers: [],
  _retrying: false
};

/* ─── Init on page load ─── */
window.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  if (typeof qz !== 'undefined') qzConnect();
  else setQZStatus('disconnected');
});

/* ─── Auto-reconnect ─── */
async function _ensureConnected() {
  if (typeof qz === 'undefined') return false;
  if (!QZP.connected || !qz.websocket.isActive()) await qzConnect();
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
    console.warn('[QZ] Not connected:', err.message);
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
  } catch (e) { console.warn('[QZ] Printers:', e); }
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
  if (dot)      dot.style.background = s.color;
  if (txt)      txt.textContent = s.label;
  if (modalDot) modalDot.style.background = s.color;
  if (modalTxt) modalTxt.textContent = s.label;
  if (installTip) installTip.style.display = state === 'disconnected' ? 'block' : 'none';
}

/* ─── Modal Open/Close ─── */
function openPrinterSettings() {
  const modal = document.getElementById('printer-modal');
  if (modal) modal.classList.add('active');
  if (QZP.connected) refreshPrinters();
  else if (!QZP._retrying) qzConnect();
}
function closePrinterSettings(e) {
  if (e && e.target !== document.getElementById('printer-modal')) return;
  const modal = document.getElementById('printer-modal');
  if (modal) modal.classList.remove('active');
}

/* ─── Populate dropdowns (UI only, printers hardcoded in code) ─── */
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

function loadSavedSettings() {
  const gapEl = document.getElementById('label-gap');
  if (gapEl) gapEl.value = '3';
}
function savePrinterSettings() {
  closePrinterSettings();
  showToast('✓ Settings saved! Printers are hardcoded.', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   TSPL BUILDERS — TSC TE244 203 DPI
   GAP = 3mm (matches BarTender/Printing Defaults)
   altPrinting = true (direct to printer port, no driver interference)
═══════════════════════════════════════════════════════════════ */

function tsplSafe(str) {
  return (str || '')
    .replace(/—/g, '-').replace(/₹/g, 'Rs.').replace(/\u20B9/g, 'Rs.')
    .replace(/[^\x00-\x7F]/g, '').replace(/"/g, "'");
}
function htmlSafe(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function wrapText(text, maxChars) {
  text = (text || '').trim();
  if (!text) return ['-'];
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = []; let cur = '';
  words.forEach(w => {
    const t = cur ? cur + ' ' + w : w;
    // Never truncate a word — if it alone exceeds maxChars, put it on its own line anyway
    if (t.length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = t;
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];  // no truncation fallback
}
function getNutriLines(p) {
  // Font2 format: max ~28 chars × 12px = 336px ≤ 388px available ✓
  return [
    `En:${p.e||0}kcal Pro:${p.p||0}g Carb:${p.cb||0}g`,
    `Fat:${p.tf||0}g Sat:${p.sf||0}g Na:${p.so||0}mg`
  ];
}
function getNutritionShort(p) { return getNutriLines(p).join(' | '); }

/* ─── FRONT label TSPL (65x25mm) ─── */
function buildFrontTSPL(name, copies) {
  const W = 65, H = 25;
  const DW = W * 8; // 520 dots
  const n = tsplSafe(name.toUpperCase());
  const isJain = n.includes('JAIN');

  // TTF Size conversion: 1 point = 2.8 dots (at 203 DPI)
  const pt2dots = 2.8;

  // Prefer 1 line down to 20pt, before wrapping to 2 lines
  const tiers = [
    { pt: 40, maxL: 1 },
    { pt: 32, maxL: 1 },
    { pt: 28, maxL: 1 },
    { pt: 24, maxL: 1 },
    { pt: 20, maxL: 1 },
    { pt: 40, maxL: 2 },
    { pt: 32, maxL: 2 },
    { pt: 28, maxL: 2 },
    { pt: 24, maxL: 2 },
    { pt: 24, maxL: 3 },
    { pt: 20, maxL: 3 },
    { pt: 16, maxL: 3 }
  ];

  let ptSize = 16, lines;
  for (const t of tiers) {
    const charW = t.pt * pt2dots * 0.62; // safe width ratio 0.62
    const maxCPL = Math.floor((DW - 16) / charW);
    const wrapped = wrapText(n, maxCPL);
    const lineH = Math.round(t.pt * pt2dots) + 8;
    const totalH = wrapped.length * lineH;
    // Max height constraint: leave room if jain subtitle is present
    if (wrapped.length <= t.maxL && totalH <= 190) {
      ptSize = t.pt; lines = wrapped; break;
    }
  }
  if (!lines) lines = wrapText(n, 25).slice(0, 3);

  const titleLineH = Math.round(ptSize * pt2dots) + 8;
  const titleTotalH = lines.length * titleLineH;

  const subPt = 12;
  const subH = Math.round(subPt * pt2dots);
  const jainBlockH = isJain ? (subH + 12) : 0; // 12 dots gap + height

  // Center the ENTIRE block (title + subtitle) vertically
  const combinedH = titleTotalH + jainBlockH;
  const yStart = Math.max(4, Math.round((H * 8 - combinedH) / 2));

  let cmds = '';
  let y = yStart;
  
  lines.forEach((ln) => {
    const tW = ln.length * (ptSize * pt2dots * 0.62); 
    const x  = Math.max(4, Math.round((DW - tW) / 2));
    
    // 13-point bold for EXTREME thickness
    const offsets = [
      [0,0], [-1,0], [1,0], [0,-1], [0,1], [-1,-1], [1,-1], [-1,1], [1,1],
      [-2,0], [2,0], [0,-2], [0,2]
    ];
    offsets.forEach(off => {
      cmds += `TEXT ${x+off[0]},${y+off[1]},"ROMAN.TTF",0,${ptSize},${ptSize},"${ln}"\r\n`;
    });
    y += titleLineH;
  });

  // Jain subtitle — ROMAN.TTF centered, bold 4-point
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    y += 4; // slight extra gap between title and subtitle
    const subW = sub.length * (subPt * pt2dots * 0.62); 
    const sx   = Math.max(4, Math.round((DW - subW) / 2));
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
      cmds += `TEXT ${sx+dx},${y+dy},"ROMAN.TTF",0,${subPt},${subPt},"${sub}"\r\n`;
    });
  }

  return [
    `SET DARKNESS 12`,
    `DIRECTION 1`,
    `CLS`,
    cmds.trim(),
    `PRINT ${copies},1`,
    ``
  ].join('\r\n');
}

/* ─── BACK label TSPL (50x90mm) ─── */
function buildBackTSPL(p, v, bn, pd, bb, copies) {
  const W = 50, H = 90;
  const dw = W*8, lm = 6, re = W*8 - lm;  // 400 dots wide
  const LABEL_H = H * 8;                    // 720 dots tall
  const mrp  = (parseFloat(v.m) || 0) * 2; 
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe(p.n.toUpperCase());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');
  const isJain = name.includes('JAIN');

  // TTF Size conversion: 1 point = 2.8 dots (at 203 DPI)
  const pt2dots = 2.8;

  // Prefer 1 line down to 16pt before wrapping
  const ptOptions = [
    { pt: 28, maxL: 1 },
    { pt: 24, maxL: 1 },
    { pt: 20, maxL: 1 },
    { pt: 16, maxL: 1 },
    { pt: 28, maxL: 2 },
    { pt: 24, maxL: 2 },
    { pt: 20, maxL: 2 },
    { pt: 16, maxL: 2 },
    { pt: 16, maxL: 3 },
    { pt: 14, maxL: 3 },
    { pt: 12, maxL: 3 }
  ];

  let ptTitle = 12, titleLines;
  for (const t of ptOptions) {
    const maxCPL = Math.floor((dw - 12) / (t.pt * pt2dots * 0.62));
    const wrapped = wrapText(name, maxCPL);
    if (wrapped.length <= t.maxL) {
      ptTitle = t.pt; titleLines = wrapped; break;
    }
  }
  if (!titleLines) titleLines = wrapText(name, 25).slice(0, 3);

  const titleH = Math.round(ptTitle * pt2dots);
  const titleStep = titleH + 8;
  const numTL = titleLines.length;

  // Jain subtitle: 11pt
  const jainPt = 11;
  const jainH = isJain ? Math.round(jainPt * pt2dots) + 8 : 0;

  // Base font size for details: 8pt (~22 dots high, matches Font2)
  const basePt = 8;
  const baseH = Math.round(basePt * pt2dots);
  const baseStep = baseH + 6;

  // Category
  const catFull  = `Category: ${cat}`;
  const catLines = wrapText(catFull, 30);
  const catBoxH  = 12 + catLines.length * baseStep + 4;  

  const ingrLines = wrapText(ingr, 34).slice(0, 6);
  const numIL     = ingrLines.length;

  // Barcode height
  const barcodeH = 64;

  // Compact height: all content stacked
  const compactH = (
    20 +                              // top margin
    numTL * titleStep + 6 +           // title
    jainH +                           // jain subtitle
    catBoxH + 4 +                     // category box
    baseStep + numIL * baseStep + 6 + // ingredients
    baseStep + baseStep + baseStep +  // nutrition
    7 + baseStep*4 + 4 +              // details
    10 + Math.round(16 * pt2dots) + 12 + Math.round(7 * pt2dots)*2 + 6 +   // MRP
    barcodeH                          // barcode
  );

  const extra = Math.max(0, LABEL_H - compactH - 8);
  const gp    = Math.floor(extra / 6);

  let y = 20, cmds = '';

  // ── TITLE (ROMAN.TTF, 13x extreme bold grid) ──
  titleLines.forEach(ln => {
    const tW = ln.length * (ptTitle * pt2dots * 0.6);
    const x  = Math.max(lm, Math.round((dw - tW) / 2));
    const offsets = [[0,0], [-1,0], [1,0], [0,-1], [0,1], [-1,-1], [1,-1], [-1,1], [1,1], [-2,0], [2,0], [0,-2], [0,2]];
    offsets.forEach(off => {
      cmds += `TEXT ${x+off[0]},${y+off[1]},"ROMAN.TTF",0,${ptTitle},${ptTitle},"${ln}"\r\n`;
    });
    y += titleStep;
  });

  // ── JAIN SUBTITLE (ROMAN.TTF, bold 4-point) ──
  if (isJain) {
    const sub  = 'NO ONION NO GARLIC';
    const subW = sub.length * (jainPt * pt2dots * 0.55);
    const sx   = Math.max(lm, Math.round((dw - subW) / 2));
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
      cmds += `TEXT ${sx+dx},${y+dy},"ROMAN.TTF",0,${jainPt},${jainPt},"${sub}"\r\n`;
    });
    y += jainH;
  }

  y += 6 + gp;  // gap 1

  // ── CATEGORY BOX ──
  cmds += `BOX ${lm},${y},${re},${y + catBoxH - 4},2\r\n`;
  let cy = y + 6;
  catLines.forEach(cl => {
    cmds += `TEXT ${lm+5},${cy},"ROMAN.TTF",0,${basePt},${basePt},"${cl}"\r\n`;
    cy += baseStep;
  });
  y += catBoxH + gp;  // gap 2

  // ── INGREDIENTS ──
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${basePt},${basePt},"INGREDIENTS :-"\r\n`); 
  y += baseStep + 4;
  ingrLines.forEach(ln => { cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"${ln}"\r\n`; y += baseStep; });
  y += 6 + gp;  // gap 3

  // ── NUTRITIONAL INFO ──
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${basePt},${basePt},"NUTRITIONAL INFO (per 100g):"\r\n`); 
  y += baseStep + 4;
  const nutri = getNutriLines(p);
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"${tsplSafe(nutri[0])}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"${tsplSafe(nutri[1])}"\r\n`; y += baseStep + gp;  // gap 4

  // ── DETAILS ──
  cmds += `BAR ${lm},${y},${re-lm},1\r\n`; y += 7;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"NET WEIGHT : ${nw}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"BATCH NO   : ${bno}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"DATE OF PKG: ${tsplSafe(pd)}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"BEST BEFORE: ${tsplSafe(bb).replace(/\s*\(.*$/, '')}"\r\n`; y += baseStep + 4 + gp;  // gap 5

  // ── MRP ──
  cmds += `BAR ${lm},${y},${re-lm},2\r\n`; y += 10 + gp;  // gap 6
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  const mrpPt = 16;
  const mrpW = mrpTxt.length * (mrpPt * pt2dots * 0.6);
  const mrpX = Math.max(lm, Math.round((dw - mrpW) / 2));
  // Bold MRP
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
    cmds += `TEXT ${mrpX+dx},${y+dy},"ROMAN.TTF",0,${mrpPt},${mrpPt},"${mrpTxt}"\r\n`;
  });
  y += Math.round(mrpPt * pt2dots) + 12;
  
  const taxPt = 7;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${taxPt},${taxPt},"(INCL. OF ALL TAXES)"\r\n`; y += Math.round(taxPt * pt2dots) + 6;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${taxPt},${taxPt},"FOR 1g = Rs.${pg}"\r\n`; 

  // ── BARCODE (CODE128) ──
  const bcode = (p.barcode) ? tsplSafe(String(p.barcode)) : '8905606000007';
  const barcodeY = LABEL_H - 66; // fixed absolute bottom Y position
  cmds += `BARCODE ${lm},${barcodeY},"CODE128",40,1,0,2,4,"${bcode}"\r\n`;

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
   PRINT FUNCTIONS
   NO altPrinting = goes through TSC driver (Windows spooler)
   This is exactly how BarTender works — driver handles end-of-job
═══════════════════════════════════════════════════════════════ */

function _rawConfig(printer) {
  // NO altPrinting — TSC driver handles end-of-job signals properly
  return qz.configs.create(printer);
}

async function qzPrintFront(name, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  const tspl = buildFrontTSPL(name, copies);
  console.log('[FRONT TSPL]\n', tspl);
  try {
    setQZStatus('printing');
    await qz.print(_rawConfig(QZP.frontPrinter), [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Front!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

async function qzPrintBack(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  const tspl = buildBackTSPL(p, v, bn, pd, bb, copies);
  console.log('[BACK TSPL]\n', tspl);
  try {
    setQZStatus('printing');
    await qz.print(_rawConfig(QZP.backPrinter), [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Back!`, 'success');
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
  const tspl = [
    `SIZE 65 mm,25 mm`,
    `GAP 3 mm,0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `TEXT 68,76,"3",0,2,2,"TEST OK"`,
    `PRINT 1,1`,
    ``
  ].join('\r\n');
  try {
    await qz.print(_rawConfig(QZP.frontPrinter), [{ type: 'raw', format: 'plain', data: tspl }]);
    showToast('✓ Test print sent!', 'success');
  } catch (e) {
    showToast('Test print failed: ' + e.message, 'error');
  }
}
