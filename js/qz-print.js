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

/* ═══════ HELPER: Balance words into N lines ═══════ */
function balanceLines(text, maxLines) {
  const words = (text || '').trim().split(' ').filter(Boolean);
  if (words.length <= maxLines) return words;
  let bestChunks = [text];
  let minMaxLen = text.length;
  for (let cpl = text.length; cpl >= Math.floor(text.length / maxLines); cpl--) {
    let lines = []; let cur = '';
    words.forEach(w => {
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= cpl) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length <= maxLines) {
      let maxLen = Math.max(...lines.map(l => l.length));
      if (maxLen < minMaxLen || bestChunks.length === 1) { minMaxLen = maxLen; bestChunks = lines; }
    }
  }
  return bestChunks;
}

/* ═══════ HELPER: TSPL Edge-to-Edge Line Scaler (DOT based) ═══════ */
function drawBox(x1, y1, x2, y2, t) {
  let b = '';
  b += `BAR ${x1},${y1},${x2-x1},${t}\r\n`;
  b += `BAR ${x1},${y2-t},${x2-x1},${t}\r\n`;
  b += `BAR ${x1},${y1},${t},${y2-y1}\r\n`;
  b += `BAR ${x2-t},${y1},${t},${y2-y1}\r\n`;
  return b;
}

function solveEdgeToEdge(name, maxLinesLimit, maxDH, dwSafe, CW, absoluteMaxDot = 100) {
  let bestConfig = null;
  let maxScore = -9999;

  for (let numLines = 1; numLines <= maxLinesLimit; numLines++) {
    const lines = balanceLines(name, numLines);
    if (lines.length > numLines) continue;

    let lineConfigs = [];
    let totalH = 0;
    
    for (const ln of lines) {
      let dot = Math.floor(dwSafe / (ln.length * CW));
      dot = Math.min(absoluteMaxDot, dot);
      let lh = dot + 6; // line spacing
      lineConfigs.push({ text: ln, dot: dot, lh: lh });
      totalH += lh;
    }

    if (totalH > maxDH) {
      const scale = maxDH / totalH;
      totalH = 0;
      lineConfigs.forEach(c => {
        c.dot = Math.max(12, Math.floor(c.dot * scale));
        c.lh = c.dot + 6;
        totalH += c.lh;
      });
    }

    const avgDot = lineConfigs.reduce((sum, c) => sum + c.dot, 0) / lineConfigs.length;
    const score = avgDot - (numLines * 4); // penalize too many lines
    
    if (score > maxScore) {
      maxScore = score;
      bestConfig = { lines: lineConfigs, totalH: totalH };
    }
  }
  return bestConfig || { lines: [{ text: name, dot: 20, lh: 26 }], totalH: 26 };
}

/* ─── FRONT label TSPL (65×25mm) ─── */
function buildFrontTSPL(name, copies) {
  const DW = 520, DH = 200;
  const n = tsplSafe(name.toUpperCase());
  const isJain = n.includes('JAIN');
  const CW = 0.50; // optimized width factor
  const SAFE = 20;

  const subDot = 20;
  const jainBlockH = isJain ? (subDot + 10) : 0;
  
  // Calculate edge-to-edge title
  const titleConfig = solveEdgeToEdge(n, 4, DH - 10 - jainBlockH, DW - SAFE * 2, CW, 90);

  const combinedH = titleConfig.totalH + jainBlockH;
  const yStart    = Math.max(4, Math.round((DH - combinedH) / 2));

  let cmds = '', y = yStart;

  titleConfig.lines.forEach(c => {
    const tW = c.text.length * (c.dot * CW);
    const x  = Math.max(SAFE, Math.round((DW - tW) / 2));
    const offsets = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2]];
    offsets.forEach(([dx,dy]) => {
      cmds += `TEXT ${x+dx},${y+dy},"ROMAN.TTF",0,${c.dot},${c.dot},"${c.text}"\r\n`;
    });
    y += c.lh;
  });

  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    y += 4;
    const subW = sub.length * (subDot * CW);
    const sx   = Math.max(SAFE, Math.round((DW - subW) / 2));
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) => {
      cmds += `TEXT ${sx+dx},${y+dy},"ROMAN.TTF",0,${subDot},${subDot},"${sub}"\r\n`;
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
  const dw = 400, DH = 720;
  const CW = 0.50; // Optimized width factor to allow wider lines and bigger text
  const SAFE = 10;                
  const lm = SAFE, re = dw - SAFE, usableW = re - lm;

  const mrp  = (parseFloat(v.m) || 0) * 2;
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe(p.n.toUpperCase());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');
  
  const isJain = name.includes('JAIN');
  const isBlended = (p.c || '').toLowerCase().includes('blended');

  function txtW(str, dot) { return str.length * dot * CW; }
  function centerX(str, dot) { return Math.max(lm, Math.round((dw - txtW(str, dot)) / 2)); }
  function maxCPL(dot) { return Math.floor(usableW / (dot * CW)); }

  const jainDot = 20;
  const jainH = isJain ? (jainDot + 2) : 0; // Reduced vertical gap

  // Title edge-to-edge calculation
  const titleConfig = solveEdgeToEdge(name, 4, 160 - jainH, usableW, CW, 80); // Increased max dot to 80

  const nutriStr = typeof getNutrition === 'function' ? getNutrition(p) : getNutriLines(p).join(', ');
  const catFull  = `Category - ${cat}`;
  const ingrFull = `(In Descending Order By Weight) ${ingr}`;

  let baseDot = 24; // starting large
  let compactH, catLines, ingrLines, nutriLines, baseStep, nBoxH, catH;
  const MRP_DOT = 28;
  const TAX_DOT = 18;
  const BARCODE_H = 62;     

  while (baseDot >= 10) {
    baseStep = baseDot + 2; // Crucial: reduce gap from 4 to 2 to save vertical space
    const cpl = maxCPL(baseDot);

    catLines   = wrapText(catFull, cpl);
    ingrLines  = wrapText(ingrFull, cpl).slice(0, 10);
    nutriLines = wrapText(nutriStr, cpl);

    catH = catLines.length * baseStep;
    const blendH = isBlended ? (3 * (Math.max(10, baseDot-2) + 2) + 12) : 0;
    nBoxH = 4 + nutriLines.length * baseStep + 4; // Reduced box padding

    compactH =
      12 +                                                 
      titleConfig.totalH +                                 
      jainH +                                              
      4 + catH + 2 + blendH + 4 +                          
      baseStep + 2 + ingrLines.length * baseStep + 2 +     
      baseStep + baseStep + 4 + nBoxH + 4 +                
      baseStep * 4 + 4 +                                   
      MRP_DOT + 4 +                       
      TAX_DOT * 2 + 8 +                   
      BARCODE_H;                                           

    if (compactH <= DH - 10) break;
    baseDot -= 1; // step down by 1 dot
  }

  const extra = Math.max(0, DH - compactH - 10);
  const gp = Math.min(Math.floor(extra / 8), 8);     
  let y = 12, cmds = '';

  /* ══ 1. TITLE ══ */
  titleConfig.lines.forEach(c => {
    const x = centerX(c.text, c.dot);
    [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2]]
      .forEach(([dx,dy]) => {
        cmds += `TEXT ${x+dx},${y+dy},"ROMAN.TTF",0,${c.dot},${c.dot},"${c.text}"\r\n`;
      });
    y += c.lh;
  });

  /* ══ 2. JAIN subtitle ══ */
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    const sx  = centerX(sub, jainDot);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
      cmds += `TEXT ${sx+dx},${y+dy},"ROMAN.TTF",0,${jainDot},${jainDot},"${sub}"\r\n`
    );
    y += jainDot + 2;
  }
  y += gp;

  /* ══ 3. CATEGORY ══ */
  const catDot = Math.min(baseDot + 2, 26);
  catLines.forEach(cl => {
    const cx = centerX(cl, catDot);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
      cmds += `TEXT ${cx+dx},${y+dy},"ROMAN.TTF",0,${catDot},${catDot},"${cl}"\r\n`
    );
    y += baseStep;
  });
  
  /* ══ 3.5 BLENDED SPICES BOX ══ */
  if (isBlended) {
    y += 4;
    const blendTxt = "Mixed Masala Powder, Spices content more than 85%, salt content more than 5%";
    const bDot = Math.max(10, baseDot - 2);
    const bCpl = maxCPL(bDot) - 4; 
    const blendLines = wrapText(blendTxt, bCpl);
    const bStep = bDot + 2;
    const boxTop = y;
    let by = y + 4;
    blendLines.forEach(ln => {
      const cx = centerX(ln, bDot);
      cmds += `TEXT ${cx},${by},"ROMAN.TTF",0,${bDot},${bDot},"${ln}"\r\n`;
      by += bStep;
    });
    cmds += drawBox(lm+8, boxTop, re-8, by+2, 2);
    y = by + 6;
  } else {
    y += 2;
  }

  cmds += `BAR ${lm},${y},${usableW},1\r\n`;
  y += 4 + gp;

  /* ══ 4. INGREDIENTS ══ */
  [[0,0],[1,0]].forEach(([dx,dy]) =>
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${baseDot},${baseDot},"INGREDIENTS :-"\r\n`
  );
  y += baseStep + 2;
  ingrLines.forEach(ln => {
    cmds += `TEXT ${lm},${y},"ROMAN.TTF",0,${baseDot},${baseDot},"${tsplSafe(ln)}"\r\n`;
    y += baseStep;
  });
  y += 2 + gp;

  /* ══ 5. NUTRITIONAL INFORMATION ══ */
  const nTitle1 = 'NUTRITIONAL INFORMATION';
  const nTitle2 = 'Approximate Composition per 100 g';
  const t1x = centerX(nTitle1, baseDot);
  const t2x = centerX(nTitle2, baseDot);
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
    cmds += `TEXT ${t1x+dx},${y+dy},"ROMAN.TTF",0,${baseDot},${baseDot},"${nTitle1}"\r\n`
  );
  y += baseStep;
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
    cmds += `TEXT ${t2x+dx},${y+dy},"ROMAN.TTF",0,${baseDot},${baseDot},"${nTitle2}"\r\n`
  );
  y += baseStep + 2;

  const boxBot = y + nBoxH;
  cmds += drawBox(lm, y, re, boxBot, 2);
  let ny = y + 4;
  nutriLines.forEach(ln => {
    cmds += `TEXT ${lm+4},${ny},"ROMAN.TTF",0,${baseDot},${baseDot},"${tsplSafe(ln)}"\r\n`;
    ny += baseStep;
  });
  y = boxBot + 4 + gp;

  /* ══ 6. DETAILS ══ */
  const detDot = baseDot;
  const detStep = baseStep;
  const details = [
    `NET WEIGHT : ${nw}`,
    `BATCH NO : ${bno}`,
    `DATE OF PACKING : ${tsplSafe(pd)}`,
    `BEST BEFORE : ${tsplSafe(bb).replace(/\s*\(.*$/, '')}`
  ];
  details.forEach(line => {
    [[0,0],[1,0]].forEach(([dx,dy]) =>
      cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${detDot},${detDot},"${line}"\r\n`
    );
    y += detStep;
  });
  y += gp;

  /* ══ 7. MRP ══ */
  const mrpTxt = `MRP : Rs.${mrp}/-`;
  [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy]) =>
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${MRP_DOT},${MRP_DOT},"${mrpTxt}"\r\n`
  );
  y += MRP_DOT + 4;

  [[0,0],[1,0]].forEach(([dx,dy]) => {
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${TAX_DOT},${TAX_DOT},"(INCL. OF ALL TAXES)"\r\n`;
  });
  y += TAX_DOT + 3;
  [[0,0],[1,0]].forEach(([dx,dy]) => {
    cmds += `TEXT ${lm+dx},${y+dy},"ROMAN.TTF",0,${TAX_DOT},${TAX_DOT},"FOR 1g = Rs.${pg}"\r\n`;
  });
  y += TAX_DOT + 6;

  /* ══ 8. BARCODE ══ */
  const bcode = (p.barcode) ? tsplSafe(String(p.barcode)) : '8905606000007';
  // Standard Code128 width for 13 digits with narrow=2 is ~286 dots
  const bcodeWidth = 286; 
  const bcodeX = Math.max(lm, Math.round((dw - bcodeWidth) / 2));
  cmds += `BARCODE ${bcodeX},${y},"128",40,2,0,2,2,"${bcode}"\r\n`;

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
