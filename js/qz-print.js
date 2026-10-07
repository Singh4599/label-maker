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
  const W = 65, H = 25;            // mm (520 × 200 dots at 8 dpi/mm)
  const n = tsplSafe(name.toUpperCase());
  const isJain = n.includes('JAIN');

  // Reserve height for Jain subtitle if needed (Font2 xm=1 ym=1 → ~20px)
  const jainReserve = isJain ? 26 : 0;
  const usableH = H * 8 - jainReserve;  // dots available for main name

  // 4-tier font selection — biggest font that fits without overflow
  let font, xm, ym, lines;
  if (n.length <= 7) {
    font='4'; xm=3; ym=3; lines = wrapText(n, 7);
  } else {
    const tryAt10 = wrapText(n, 10);
    if (tryAt10.length === 1) {
      font='4'; xm=2; ym=3; lines = tryAt10;
    } else if (tryAt10.length <= 2) {
      font='4'; xm=2; ym=2; lines = tryAt10;
    } else {
      const tryAt14 = wrapText(n, 14);
      if (tryAt14.length <= 2) {
        font='3'; xm=2; ym=3; lines = tryAt14;
      } else {
        font='3'; xm=2; ym=2; lines = tryAt14.slice(0, 3);
      }
    }
  }
  const fontH    = (font==='4' ? 32 : 24) * ym;
  const lineStep = fontH + 8;
  const totalH   = lines.length * lineStep - 8;
  // Center vertically within usable area
  const yStart   = Math.max(8, Math.round((usableH - totalH) / 2));
  let cmds = '';
  lines.forEach((ln, i) => {
    const charW = (font==='4' ? 24 : 18) * xm;
    const tW    = ln.length * charW;
    const x     = Math.max(4, Math.round((W*8 - tW) / 2));
    const y     = yStart + i * lineStep;
    // Max bold print (8 times around x,y) — simulates maximum stroke weight
    cmds += `TEXT ${x},${y},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x+1},${y},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x},${y+1},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x+1},${y+1},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x-1},${y},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x},${y-1},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x+2},${y},"${font}",0,${xm},${ym},"${ln}"\r\n`;
    cmds += `TEXT ${x},${y+2},"${font}",0,${xm},${ym},"${ln}"\r\n`;
  });

  // Jain subtitle: "NO ONION NO GARLIC" centered, Font2 xm=1 ym=1
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    const subW = sub.length * 12;  // Font2 ~12px/char
    const sx = Math.max(4, Math.round((W*8 - subW) / 2));
    const sy = H*8 - 22;           // 22 dots from bottom
    cmds += `TEXT ${sx},${sy},"2",0,1,1,"${sub}"\r\n`;
    cmds += `TEXT ${sx+1},${sy},"2",0,1,1,"${sub}"\r\n`;
    cmds += `TEXT ${sx},${sy+1},"2",0,1,1,"${sub}"\r\n`;
    cmds += `TEXT ${sx+1},${sy+1},"2",0,1,1,"${sub}"\r\n`;
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
  const mrp  = (parseFloat(v.m) || 0) * 2; // ×2: retail = 2× wholesale
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe(p.n.toUpperCase());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');
  const isJain = name.includes('JAIN');

  // ── Title: DYNAMIC FONT SCALING ──
  const availW = dw - 2 * lm;  // 388 usable dots
  const fontConfigs = [
    { font:'3', xm:3, ym:3, cw:66, maxL:2 },
    { font:'3', xm:2, ym:2, cw:44, maxL:3 },
    { font:'2', xm:2, ym:2, cw:30, maxL:3 },
    { font:'2', xm:1, ym:1, cw:16, maxL:3 },
  ];
  let tFont='2', tXm=1, tYm=1, tCharW=14, titleLines;
  for (const cfg of fontConfigs) {
    const maxCPL = Math.floor(availW / cfg.cw);
    const wrapped = wrapText(name, maxCPL);
    if (wrapped.length <= cfg.maxL && wrapped.every(ln => ln.length * cfg.cw <= availW)) {
      tFont=cfg.font; tXm=cfg.xm; tYm=cfg.ym; tCharW=cfg.cw;
      titleLines = wrapped.slice(0, cfg.maxL);
      break;
    }
  }
  if (!titleLines) titleLines = wrapText(name, 27).slice(0, 3);

  const numTL     = titleLines.length;
  const tFontH    = (tFont==='3' ? 24 : 20) * tYm;
  const titleStep = tFontH + 8;

  // Jain subtitle: "NO ONION NO GARLIC" (Font2 xm=1 ym=1 → 20px high)
  const jainH = isJain ? 28 : 0;

  // Category: wrap if text too long for 1 line in the box
  const catFull  = `Category: ${cat}`;
  const catLines = wrapText(catFull, 24);   // ~24 chars @ 14px = 336px ≤ 388px
  const catBoxH  = 16 + catLines.length * 20 + 6;  // dynamic box height

  const ingrLines = wrapText(ingr, 27).slice(0, 6);
  const numIL     = ingrLines.length;

  // Barcode height: 40-dot bar + ~18 human-readable = 58 total
  const barcodeH = 64;

  // Compact height: all content stacked
  const compactH = (
    24 +                              // top margin
    numTL * titleStep + 6 +           // title
    jainH +                           // jain subtitle (0 if not jain)
    catBoxH + 4 +                     // category box
    22 + numIL * 22 + 6 +            // ingredients
    20 + 22 + 22 +                   // nutrition
    7 + 22 + 22 + 22 + 26 +         // details
    10 + 68 + 14 + 14 +              // MRP
    barcodeH                          // barcode
  );

  // Distribute leftover across 6 gaps
  const extra = Math.max(0, LABEL_H - compactH - 8);
  const gp    = Math.floor(extra / 6);

  let y = 24, cmds = '';

  // ── TITLE (max bold print 8x) ──
  titleLines.forEach(ln => {
    const tw = ln.length * tCharW;
    const x  = Math.max(lm, Math.round((dw - tw) / 2));
    cmds += `TEXT ${x},${y},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x+1},${y},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x},${y+1},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x+1},${y+1},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x-1},${y},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x},${y-1},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x+2},${y},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    cmds += `TEXT ${x},${y+2},"${tFont}",0,${tXm},${tYm},"${ln}"\r\n`;
    y += titleStep;
  });

  // ── JAIN SUBTITLE ──
  if (isJain) {
    const sub  = 'NO ONION NO GARLIC';
    const subW = sub.length * 12;  // Font2 ~12px/char
    const sx   = Math.max(lm, Math.round((dw - subW) / 2));
    cmds += `TEXT ${sx},${y},"2",0,1,1,"${sub}"\r\n`;
    cmds += `TEXT ${sx+1},${y},"2",0,1,1,"${sub}"\r\n`;
    cmds += `TEXT ${sx},${y+1},"2",0,1,1,"${sub}"\r\n`;
    cmds += `TEXT ${sx+1},${y+1},"2",0,1,1,"${sub}"\r\n`;
    y += jainH;
  }

  y += 6 + gp;  // gap 1

  // ── CATEGORY BOX (dynamic height, wraps long text) ──
  cmds += `BOX ${lm},${y},${re},${y + catBoxH - 4},2\r\n`;
  let cy = y + 6;
  catLines.forEach(cl => {
    cmds += `TEXT ${lm+5},${cy},"2",0,1,1,"${cl}"\r\n`;
    cy += 20;
  });
  y += catBoxH + gp;  // gap 2

  // ── INGREDIENTS ──
  cmds += `TEXT ${lm},${y},"2",0,1,1,"INGREDIENTS :-"\r\n`; y += 22;
  ingrLines.forEach(ln => { cmds += `TEXT ${lm},${y},"2",0,1,1,"${ln}"\r\n`; y += 22; });
  y += 6 + gp;  // gap 3

  // ── NUTRITIONAL INFO ──
  cmds += `TEXT ${lm},${y},"2",0,1,1,"NUTRITIONAL INFO (per 100g):"\r\n`; y += 20;
  const nutri = getNutriLines(p);
  cmds += `TEXT ${lm},${y},"2",0,1,1,"${tsplSafe(nutri[0])}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"${tsplSafe(nutri[1])}"\r\n`; y += 22 + gp;  // gap 4

  // ── DETAILS ──
  cmds += `BAR ${lm},${y},${re-lm},1\r\n`; y += 7;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"NET WEIGHT : ${nw}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"BATCH NO   : ${bno}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"DATE OF PKG: ${tsplSafe(pd)}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"BEST BEFORE: ${tsplSafe(bb).replace(/\s*\(.*$/, '')}"\r\n`; y += 26 + gp;  // gap 5

  // ── MRP ──
  cmds += `BAR ${lm},${y},${re-lm},2\r\n`; y += 10 + gp;  // gap 6
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  cmds += `TEXT ${Math.max(lm, Math.round((dw - mrpTxt.length * 24) / 2))},${y},"4",0,1,2,"${mrpTxt}"\r\n`; y += 68;
  cmds += `TEXT ${lm},${y},"1",0,1,1,"(INCL. OF ALL TAXES)"\r\n`; y += 14;
  cmds += `TEXT ${lm},${y},"1",0,1,1,"FOR 1g = Rs.${pg}"\r\n`; y += 16;

  // ── BARCODE (CODE128) ──
  const bcode = (p.barcode) ? tsplSafe(String(p.barcode)) : '8905606000007';
  // TSPL BARCODE: x, y, type, height, readable, rotation, narrow, wide, data
  cmds += `BARCODE ${lm},${y},"CODE128",40,1,0,2,4,"${bcode}"\r\n`;

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
