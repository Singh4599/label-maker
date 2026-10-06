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

/* ─── FRONT label TSPL (65x25mm) — max bold font, centered, no overflow ─── */
function buildFrontTSPL(name, copies) {
  const W = 65, H = 25;            // mm
  const n = tsplSafe(name.toUpperCase());

  // 4-tier font selection — biggest font that fits without overflow
  // Font4 base: 24x32px | Font3 base: 16x24px
  // Label: 520x200 dots (65mm x 25mm @ 8 dpi/mm)
  let font, xm, ym, lines;
  if (n.length <= 7) {
    // HUGE: Font4 xm=3 ym=3 → 72x96px/char, 1 line max
    font='4'; xm=3; ym=3; lines = wrapText(n, 7);
  } else {
    const tryAt10 = wrapText(n, 10);   // Font4 xm=2: 48px/char → 10 per line
    if (tryAt10.length === 1) {
      // Single line: use ym=3 (96px tall) — BIG
      font='4'; xm=2; ym=3; lines = tryAt10;
    } else if (tryAt10.length <= 2) {
      // 2 lines Font4 xm=2 ym=2 (64px): 2×72 = 144px ≤ 200px ✓
      font='4'; xm=2; ym=2; lines = tryAt10;
    } else {
      // 3+ lines at Font4 — too tall. Use Font3 xm=2
      const tryAt16 = wrapText(n, 16);  // Font3 xm=2: 32px/char → 16 per line
      if (tryAt16.length <= 2) {
        // 2 lines Font3 xm=2 ym=3 (72px): 2×80−8 = 152px ≤ 200px ✓  BIGGER than before!
        font='3'; xm=2; ym=3; lines = tryAt16;
      } else {
        // 3 lines Font3 xm=2 ym=2 (48px): 3×56−8 = 160px ≤ 200px ✓
        font='3'; xm=2; ym=2; lines = tryAt16.slice(0, 3);
      }
    }
  }

  const fontH    = (font==='4' ? 32 : 24) * ym;
  const lineStep = fontH + 8;
  const totalH   = lines.length * lineStep - 8;
  const yStart   = Math.max(12, Math.round((H*8 - totalH) / 2));
  let cmds = '';
  lines.forEach((ln, i) => {
    const charW = (font==='4' ? 24 : 16) * xm;
    const tW    = ln.length * charW;
    const x     = Math.max(4, Math.round((W*8 - tW) / 2));
    const y     = yStart + i * lineStep;
    cmds += `TEXT ${x},${y},"${font}",0,${xm},${ym},"${ln}"\r\n`;
  });
  return [
    `SET DARKNESS 12`,
    `DIRECTION 1`,
    `CLS`,
    cmds.trim(),
    `PRINT ${copies},1`,
    ``
  ].join('\r\n');
}

/* ─── BACK label TSPL (50x90mm) — full label fill + BarTender layout + nutrition ─── */
function buildBackTSPL(p, v, bn, pd, bb, copies) {
  const W = 50, H = 90;
  const dw = W*8, lm = 6, re = W*8 - lm;  // 400 dots wide, margins at 6 & 394
  const LABEL_H = H * 8;                    // 720 dots tall
  const mrp  = parseFloat(v.m) || 0;
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe(p.n.toUpperCase());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');

  // ── Pre-calculate to fill label dynamically ──
  const titleTry  = wrapText(name, 8);
  const tXm       = titleTry.length <= 3 ? 3 : 2;
  const tYm       = tXm;
  const titleLines = tXm === 3 ? titleTry : wrapText(name, 12);
  const numTL     = Math.min(titleLines.length, 3);
  const titleStep = (24 * tYm) + 8;           // e.g. 80 for tYm=3
  const ingrLines = wrapText(ingr, 40).slice(0, 5);
  const numIL     = ingrLines.length;

  // Compact height = all content with no extra spacing
  const compactH = (
    10 +                          // top margin
    numTL * titleStep + 6 +       // title lines + gap after title
    36 +                          // category box
    22 + numIL * 13 + 6 +        // ingredients header + lines + gap
    20 + 13 + 16 +               // nutrition header + 2 data lines
    7 + 22 + 22 + 22 + 26 +     // separator + 4 detail lines
    10 + 68 + 14 + 14            // MRP bar + text + 2 footer lines
  );

  // Distribute extra space evenly across 6 expandable gaps
  const extra = Math.max(0, LABEL_H - compactH - 8);  // 8px bottom margin
  const gp    = Math.floor(extra / 6);

  let y = 10, cmds = '';

  // ── TITLE ──
  titleLines.slice(0, 3).forEach(ln => {
    const tw = ln.length * 16 * tXm;          // font3 base=16px × xm
    cmds += `TEXT ${Math.max(lm, Math.round((dw - tw) / 2))},${y},"3",0,${tXm},${tYm},"${ln}"\r\n`;
    y += titleStep;
  });
  y += 6 + gp;                                // gap 1 (expandable)

  // ── CATEGORY BOX (2px visible border) ──
  cmds += `BOX ${lm},${y},${re},${y+28},2\r\n`;
  cmds += `TEXT ${lm+5},${y+7},"2",0,1,1,"Category: ${cat}"\r\n`;
  y += 36 + gp;                               // gap 2

  // ── INGREDIENTS ──
  cmds += `TEXT ${lm},${y},"2",0,1,1,"INGREDIENTS :-"\r\n`; y += 22;
  ingrLines.forEach(ln => { cmds += `TEXT ${lm},${y},"1",0,1,1,"${ln}"\r\n`; y += 13; });
  y += 6 + gp;                                // gap 3

  // ── NUTRITIONAL INFO ──
  cmds += `TEXT ${lm},${y},"2",0,1,1,"NUTRITIONAL INFO (per 100g):"\r\n`; y += 20;
  const nutri = getNutriLines(p);
  cmds += `TEXT ${lm},${y},"1",0,1,1,"${tsplSafe(nutri[0])}"\r\n`; y += 13;
  cmds += `TEXT ${lm},${y},"1",0,1,1,"${tsplSafe(nutri[1])}"\r\n`; y += 16 + gp;  // gap 4

  // ── DETAILS ──
  cmds += `BAR ${lm},${y},${re-lm},1\r\n`; y += 7;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"NET WEIGHT : ${nw}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"BATCH NO   : ${bno}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"DATE OF PKG: ${tsplSafe(pd)}"\r\n`; y += 22;
  cmds += `TEXT ${lm},${y},"2",0,1,1,"BEST BEFORE: ${tsplSafe(bb)}"\r\n`; y += 26 + gp;  // gap 5

  // ── MRP ──
  cmds += `BAR ${lm},${y},${re-lm},2\r\n`; y += 10 + gp;  // gap 6
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  // Font4 xm=1 ym=2: 24x64px/char. Max MRP "MRP : Rs.9999/-" = 15chars × 24 = 360px < 388px ✓
  cmds += `TEXT ${Math.max(lm, Math.round((dw - mrpTxt.length * 24) / 2))},${y},"4",0,1,2,"${mrpTxt}"\r\n`; y += 68;
  cmds += `TEXT ${lm},${y},"1",0,1,1,"(INCL. OF ALL TAXES)"\r\n`; y += 14;
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
