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

  // Subtitle slightly bigger: 20 dots high
  const jainReserve = isJain ? 36 : 0;
  const usableH = H * 8 - jainReserve;

  let hDots, lines;
  const options = [56, 48, 40, 32, 28, 24, 20];
  for (const h of options) {
    const maxCPL = Math.floor((DW - 16) / (h * 0.65)); // 0.65 is very safe width ratio
    const wrapped = wrapText(n, maxCPL);
    const totalH  = wrapped.length * (h + 8);
    if (wrapped.length <= 3 && totalH <= usableH - 8) {
      hDots = h; lines = wrapped; break;
    }
  }
  if (!hDots) { hDots = 20; lines = wrapText(n, 30).slice(0, 3); }

  const lineStep = hDots + 8;
  const totalH   = lines.length * lineStep;
  const yStart   = Math.max(8, Math.round((usableH - totalH) / 2));

  let cmds = '';
  lines.forEach((ln, i) => {
    const tW = ln.length * (hDots * 0.6); // typical ROMAN.TTF width ratio ~0.6
    const x  = Math.max(4, Math.round((DW - tW) / 2));
    const y  = yStart + i * lineStep;
    
    // 13-point star pattern for EXTREME thickness
    const offsets = [
      [0,0], [-1,0], [1,0], [0,-1], [0,1], [-1,-1], [1,-1], [-1,1], [1,1],
      [-2,0], [2,0], [0,-2], [0,2]
    ];
    offsets.forEach(off => {
      cmds += `TEXT ${x+off[0]},${y+off[1]},"ROMAN.TTF",0,${hDots},${hDots},"${ln}"\r\n`;
    });
  });

  // Jain subtitle — ROMAN.TTF centered, slightly bigger (20 dots), bolded
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    const subH = 20;
    const subW = sub.length * (subH * 0.6);
    const sx   = Math.max(4, Math.round((DW - subW) / 2));
    const sy   = H*8 - 36;
    // Bold 4-point pattern
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
      cmds += `TEXT ${sx+dx},${sy+dy},"ROMAN.TTF",0,${subH},${subH},"${sub}"\r\n`;
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

  // Title: ROMAN.TTF dynamic dot size
  const options = [48, 40, 32, 28, 24, 20];
  let hTitle = 20, titleLines;
  for (const h of options) {
    const maxCPL = Math.floor((dw - 12) / (h * 0.65)); // 0.65 is very safe ratio
    const wrapped = wrapText(name, maxCPL);
    if (wrapped.length <= 3) {
      hTitle = h; titleLines = wrapped; break;
    }
  }
  if (!titleLines) titleLines = wrapText(name, 35).slice(0, 3);

  const titleStep = hTitle + 8;
  const numTL = titleLines.length;

  // Jain subtitle: ROMAN.TTF 20 dots (one line)
  const jainSubH = 20;
  const jainH = isJain ? (jainSubH + 8) : 0;

  // Base font size for details: ROMAN.TTF 18 dots (~12-14pt equivalent)
  const baseH = 18;
  const baseStep = baseH + 6;

  // Category: wrap if text too long for 1 line in the box
  const catFull  = `Category: ${cat}`;
  const catLines = wrapText(catFull, 32);
  const catBoxH  = 12 + catLines.length * baseStep + 6;  

  const ingrLines = wrapText(ingr, 38).slice(0, 6);
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
    7 + baseStep + baseStep + baseStep + baseStep + 4 + // details
    10 + 44 + baseStep + baseStep +   // MRP
    barcodeH                          // barcode
  );

  const extra = Math.max(0, LABEL_H - compactH - 8);
  const gp    = Math.floor(extra / 6);

  let y = 20, cmds = '';

  // ── TITLE (ROMAN.TTF, 3x3 grid) ──
  titleLines.forEach(ln => {
    const tW = ln.length * (hTitle * 0.6);
    const x  = Math.max(lm, Math.round((dw - tW) / 2));
    for (let dx = 0; dx <= 2; dx++) {
      for (let dy = 0; dy <= 2; dy++) {
        cmds += `TEXT ${x+dx},${y+dy},"ROMAN.TTF",0,${hTitle},${hTitle},"${ln}"\r\n`;
      }
    }
    y += titleStep;
  });

  // ── JAIN SUBTITLE (ROMAN.TTF, bold 4-point) ──
  if (isJain) {
    const sub  = 'NO ONION NO GARLIC';
    const subW = sub.length * (jainSubH * 0.6);
    const sx   = Math.max(lm, Math.round((dw - subW) / 2));
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
      cmds += `TEXT ${sx+dx},${y+dy},"ROMAN.TTF",0,${jainSubH},${jainSubH},"${sub}"\r\n`;
    });
    y += jainH;
  }

  y += 6 + gp;  // gap 1

  // ── CATEGORY BOX ──
  cmds += `BOX ${lm},${y},${re},${y + catBoxH - 4},2\r\n`;
  let cy = y + 6;
  catLines.forEach(cl => {
    cmds += `TEXT ${lm+5},${cy},"ROMAN.TTF",0,${baseH},${baseH},"${cl}"\r\n`;
    cy += baseStep;
  });
  y += catBoxH + gp;  // gap 2

  // ── INGREDIENTS ──
  // Use bold 4-point for headings
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${baseH},${baseH},"INGREDIENTS :-"\r\n`); 
  y += baseStep + 4;
  ingrLines.forEach(ln => { cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"${ln}"\r\n`; y += baseStep; });
  y += 6 + gp;  // gap 3

  // ── NUTRITIONAL INFO ──
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${baseH},${baseH},"NUTRITIONAL INFO (per 100g):"\r\n`); 
  y += baseStep + 4;
  const nutri = getNutriLines(p);
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"${tsplSafe(nutri[0])}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"${tsplSafe(nutri[1])}"\r\n`; y += baseStep + gp;  // gap 4

  // ── DETAILS ──
  cmds += `BAR ${lm},${y},${re-lm},1\r\n`; y += 7;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"NET WEIGHT : ${nw}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"BATCH NO   : ${bno}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"DATE OF PKG: ${tsplSafe(pd)}"\r\n`; y += baseStep;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseH},${baseH},"BEST BEFORE: ${tsplSafe(bb).replace(/\s*\(.*$/, '')}"\r\n`; y += baseStep + 4 + gp;  // gap 5

  // ── MRP ──
  cmds += `BAR ${lm},${y},${re-lm},2\r\n`; y += 10 + gp;  // gap 6
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  const mrpH = 36;
  const mrpW = mrpTxt.length * (mrpH * 0.6);
  const mrpX = Math.max(lm, Math.round((dw - mrpW) / 2));
  // Bold MRP
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
    cmds += `TEXT ${mrpX+dx},${y+dy},"ROMAN.TTF",0,${mrpH},${mrpH},"${mrpTxt}"\r\n`;
  });
  y += 44;
  
  const taxH = 14;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${taxH},${taxH},"(INCL. OF ALL TAXES)"\r\n`; y += taxH + 6;
  cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${taxH},${taxH},"FOR 1g = Rs.${pg}"\r\n`; 

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
