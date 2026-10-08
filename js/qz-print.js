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
  return [
    `En:${p.e||0}kcal Pro:${p.p||0}g Carb:${p.cb||0}g`,
    `Fat:${p.tf||0}g Sat:${p.sf||0}g Na:${p.so||0}mg`
  ];
}
function getNutritionShort(p) { return getNutriLines(p).join(' | '); }

/* ─── FRONT label TSPL (65×25mm) ─── */
function buildFrontTSPL(name, copies) {
  const W = 65, H = 25;
  const DW  = W * 8;            // 520 dots
  const DH  = H * 8;            // 200 dots
  const n   = tsplSafe(name.toUpperCase());
  const isJain = n.includes('JAIN');
  const CW  = 0.62;             // char-width factor for ROMAN.TTF (measured)
  const P2D = 2.8;              // pt → dots
  const SAFE = 20;              // safe margin each side (10 dots ≈ 1.25mm)

  /* ── pick the LARGEST font that fits without any cutting ── */
  const tierPts = [48,44,40,36,32,28,24,20,18,16,14];
  let ptSize = 14, lines;

  for (const pt of tierPts) {
    const charDots  = pt * P2D * CW;
    const maxCPL    = Math.floor((DW - SAFE * 2) / charDots);   // safe chars per line
    const wrapped   = wrapText(n, maxCPL);
    const lineH     = Math.round(pt * P2D) + 6;
    const totalH    = wrapped.length * lineH;
    if (wrapped.length <= 3 && totalH <= DH - 10) {             // must fit in label height
      ptSize = pt; lines = wrapped; break;
    }
  }
  if (!lines) lines = wrapText(n, 20).slice(0, 3);

  const titleLineH  = Math.round(ptSize * P2D) + 6;
  const titleTotalH = lines.length * titleLineH;

  const subPt = 12;
  const jainBlockH = isJain ? (Math.round(subPt * P2D) + 12) : 0;

  /* ── vertical centering ── */
  const combinedH = titleTotalH + jainBlockH;
  const yStart    = Math.max(4, Math.round((DH - combinedH) / 2));

  let cmds = '', y = yStart;

  /* ── title lines (bold via 13-point star offsets) ── */
  lines.forEach(ln => {
    const tW = ln.length * (ptSize * P2D * CW);
    const x  = Math.max(SAFE, Math.round((DW - tW) / 2));
    const offsets = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2]];
    offsets.forEach(([dx,dy]) => {
      cmds += `TEXT ${x+dx},${y+dy},"ROMAN.TTF",0,${ptSize},${ptSize},"${ln}"\r\n`;
    });
    y += titleLineH;
  });

  /* ── jain subtitle ── */
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    y += 4;
    const subW = sub.length * (subPt * P2D * CW);
    const sx   = Math.max(SAFE, Math.round((DW - subW) / 2));
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

/* ─── BACK label TSPL (50×90mm) ─── */
function buildBackTSPL(p, v, bn, pd, bb, copies) {
  const W = 50, H = 90;
  const dw   = W * 8;            // 400 dots
  const DH   = H * 8;            // 720 dots
  const CW   = 0.62;             // char-width factor for ROMAN.TTF
  const P2D  = 2.8;              // pt → dots
  const SAFE = 8;                // safe margin each side
  const lm   = SAFE;
  const re   = dw - SAFE;
  const usableW = re - lm;       // printable width between margins

  const mrp  = (parseFloat(v.m) || 0) * 2;
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe(p.n.toUpperCase());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');
  const isJain = name.includes('JAIN');

  /* ═══════ HELPER: calculate text width in dots ═══════ */
  function txtW(str, pt) { return str.length * pt * P2D * CW; }
  function centerX(str, pt) { return Math.max(lm, Math.round((dw - txtW(str, pt)) / 2)); }
  function maxCPL(pt) { return Math.floor(usableW / (pt * P2D * CW)); }

  /* ── Title: pick largest font that fits ── */
  const titlePts = [30,28,26,24,22,20,18,16,14,12,10];
  let ptTitle = 10, titleLines;

  for (const pt of titlePts) {
    const cpl     = maxCPL(pt);
    const wrapped = wrapText(name, cpl);
    if (wrapped.length <= 3) {
      // verify every line actually fits within usableW
      const allFit = wrapped.every(ln => txtW(ln, pt) <= usableW);
      if (allFit) { ptTitle = pt; titleLines = wrapped; break; }
    }
  }
  if (!titleLines) titleLines = wrapText(name, maxCPL(10)).slice(0, 4);

  const titleLineH  = Math.round(ptTitle * P2D) + 6;
  const titleTotalH = titleLines.length * titleLineH;

  const jainPt = 9;
  const jainH  = isJain ? (Math.round(jainPt * P2D) + 6) : 0;

  const nutriStr = typeof getNutrition === 'function' ? getNutrition(p) : getNutriLines(p).join(', ');
  const catFull  = `Category - ${cat}`;
  const ingrFull = `(In Descending Order By Weight) ${ingr}`;

  /* ══════════ AUTO-FIT: scale body font to fit everything in DH ══════════ */
  let basePt = 9;
  let compactH, catLines, ingrLines, nutriLines, baseStep, nBoxH, catH;
  const MRP_PT = 12;
  const TAX_PT = 6;
  const BARCODE_H = 62;     // barcode height + number below

  while (basePt >= 4) {
    baseStep = Math.round(basePt * P2D) + 3;
    const cpl = maxCPL(basePt);

    catLines   = wrapText(catFull, cpl);
    ingrLines  = wrapText(ingrFull, cpl).slice(0, 10);
    nutriLines = wrapText(nutriStr, cpl);

    catH   = catLines.length * baseStep;
    nBoxH  = 8 + nutriLines.length * baseStep + 8;       // box padding

    compactH =
      12 +                                                 // top margin
      titleTotalH +                                        // title
      jainH +                                              // jain line
      4 + catH + 6 +                                       // category + line below
      baseStep + 2 + ingrLines.length * baseStep + 4 +     // INGREDIENTS header + lines
      baseStep + baseStep + 4 + nBoxH + 4 +                // NUTRI headers + box
      baseStep * 4 + 4 +                                   // 4 detail rows
      Math.round(MRP_PT * P2D) + 4 +                       // MRP
      Math.round(TAX_PT * P2D) * 2 + 8 +                   // tax lines
      BARCODE_H;                                            // barcode at bottom

    if (compactH <= DH - 8) break;
    basePt -= 0.5;
  }

  /* gap to distribute remaining space evenly across sections */
  const extra = Math.max(0, DH - compactH - 8);
  const gp    = Math.min(Math.floor(extra / 8), 8);     // cap gap so nothing floats
  let y = 12, cmds = '';

  /* ══ 1. TITLE (center-aligned, bold, consistent size) ══ */
  titleLines.forEach(ln => {
    const x = centerX(ln, ptTitle);
    [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2]]
      .forEach(([dx,dy]) => {
        cmds += `TEXT ${x+dx},${y+dy},"ROMAN.TTF",0,${ptTitle},${ptTitle},"${ln}"\r\n`;
      });
    y += titleLineH;
  });

  /* ══ 2. JAIN subtitle ══ */
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    const sx  = centerX(sub, jainPt);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
      cmds += `TEXT ${sx+dx},${y+dy},"ROMAN.TTF",0,${jainPt},${jainPt},"${sub}"\r\n`
    );
    y += Math.round(jainPt * P2D) + 6;
  }
  y += gp;

  /* ══ 3. CATEGORY (center-aligned, slightly bolder) ══ */
  const catPt = Math.min(basePt + 1, 10);   // slightly bigger than body
  catLines.forEach(cl => {
    const cx = centerX(cl, catPt);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
      cmds += `TEXT ${cx+dx},${y+dy},"ROMAN.TTF",0,${catPt},${catPt},"${cl}"\r\n`
    );
    y += baseStep;
  });
  y += 2;
  cmds += `BAR ${lm},${y},${usableW},1\r\n`;
  y += 4 + gp;

  /* ══ 4. INGREDIENTS ══ */
  [[0,0],[1,0]].forEach(([dx,dy]) =>
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${basePt},${basePt},"INGREDIENTS :-"\r\n`
  );
  y += baseStep + 2;
  ingrLines.forEach(ln => {
    cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${basePt},${basePt},"${tsplSafe(ln)}"\r\n`;
    y += baseStep;
  });
  y += 2 + gp;

  /* ══ 5. NUTRITIONAL INFORMATION ══ */
  const nTitle1 = 'NUTRITIONAL INFORMATION';
  const nTitle2 = 'Approximate Composition per 100 g';
  const t1x = centerX(nTitle1, basePt);
  const t2x = centerX(nTitle2, basePt);
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
    cmds += `TEXT ${t1x+dx},${y+dy},"ROMAN.TTF",0,${basePt},${basePt},"${nTitle1}"\r\n`
  );
  y += baseStep;
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
    cmds += `TEXT ${t2x+dx},${y+dy},"ROMAN.TTF",0,${basePt},${basePt},"${nTitle2}"\r\n`
  );
  y += baseStep + 2;

  /* nutrition box */
  const boxBot = y + nBoxH;
  cmds += `BOX ${lm},${y},${re},${boxBot},2\r\n`;
  let ny = y + 5;
  nutriLines.forEach(ln => {
    cmds += `TEXT ${lm+4},${ny},"ROMAN.TTF",0,${basePt},${basePt},"${tsplSafe(ln)}"\r\n`;
    ny += baseStep;
  });
  y = boxBot + 4 + gp;

  /* ══ 6. DETAILS (bold via double-print) ══ */
  const detPt = basePt;
  const detStep = baseStep;
  const details = [
    `NET WEIGHT : ${nw}`,
    `BATCH NO : ${bno}`,
    `DATE OF PACKING : ${tsplSafe(pd)}`,
    `BEST BEFORE : ${tsplSafe(bb).replace(/\s*\(.*$/, '')}`
  ];
  details.forEach(line => {
    [[0,0],[1,0]].forEach(([dx,dy]) =>
      cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${detPt},${detPt},"${line}"\r\n`
    );
    y += detStep;
  });
  y += gp;

  /* ══ 7. MRP (bigger, bold, left-aligned with details) ══ */
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${MRP_PT},${MRP_PT},"${mrpTxt}"\r\n`
  );
  y += Math.round(MRP_PT * P2D) + 4;

  [[0,0],[1,0]].forEach(([dx,dy]) => {
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${TAX_PT},${TAX_PT},"(INCL. OF ALL TAXES)"\r\n`;
  });
  y += Math.round(TAX_PT * P2D) + 3;
  [[0,0],[1,0]].forEach(([dx,dy]) => {
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${TAX_PT},${TAX_PT},"FOR 1g = Rs.${pg}"\r\n`;
  });
  y += Math.round(TAX_PT * P2D) + 6;

  /* ══ 8. BARCODE — placed AFTER all text, guaranteed no overlap ══ */
  const bcode   = (p.barcode) ? tsplSafe(String(p.barcode)) : '8905606000007';
  const bcodeX  = Math.max(lm, Math.round((dw - 200) / 2));    // center barcode (≈200 dots wide)
  cmds += `BARCODE ${bcodeX},${y},"128",40,1,0,2,2,"${bcode}"\r\n`;

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
