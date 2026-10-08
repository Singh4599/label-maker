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
function balanceLines(text, numLines) {
  text = (text || '').trim();
  if (numLines === 1) return [text];
  const words = text.split(' ');
  if (words.length <= numLines) return words;
  
  let maxLen = text.length;
  for (let cpl = Math.ceil(maxLen / numLines); cpl <= maxLen; cpl++) {
    const lines = wrapText(text, cpl);
    if (lines.length <= numLines) return lines;
  }
  return wrapText(text, maxLen);
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
  const DW = 520, DH = 200;
  const n = tsplSafe((name || '').toUpperCase().trim());
  const isJain = n.includes('JAIN');
  const jainBlockH = isJain ? 36 : 0;
  const availH = DH - jainBlockH;

  // Split logic based on length
  // We force exactly the right number of lines by providing the maximum allowed chunks
  let lines = balanceLines(n, 1);
  if (n.length > 15 && n.length <= 26) {
    // If it can't balance to 2, wrapText will force it
    lines = balanceLines(n, 2);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')]; 
  } else if (n.length > 26) {
    lines = balanceLines(n, 3);
    if (lines.length < 3) {
      // Force 3 chunks if it accidentally compressed to 2
      const words = n.split(' ');
      if (words.length >= 3) {
        const third = Math.ceil(words.length / 3);
        lines = [
          words.slice(0, third).join(' '),
          words.slice(third, third * 2).join(' '),
          words.slice(third * 2).join(' ')
        ];
      }
    }
  }

  // Final canvas to build the ENTIRE TSPL image (including Jain)
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DW, DH);
  
  const SAFE_X = 32; // Increased to 32 dots (4mm) so it NEVER gets cut on edges
  const SAFE_Y = 24; // top and bottom margin for the main text block
  
  const usableW = DW - (SAFE_X * 2); 
  const usableH = availH - (SAFE_Y * 2);
  const numLines = lines.length;
  
  // Optional tiny gap between lines if there are multiple
  const gap = numLines > 1 ? 8 : 0;
  const totalGap = gap * (numLines - 1);
  const lineDestH = Math.floor((usableH - totalGap) / numLines);

  let currentY = SAFE_Y;

  for (let i = 0; i < numLines; i++) {
    const ln = lines[i];
    
    // Create a tiny canvas just for this single line
    const lCanvas = document.createElement('canvas');
    const lCtx = lCanvas.getContext('2d');
    const fontSize = 100;
    lCtx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
    
    const m = lCtx.measureText(ln);
    const left = m.actualBoundingBoxLeft || 0;
    const right = m.actualBoundingBoxRight || m.width;
    const w = left + right;
    
    const ascent = m.actualBoundingBoxAscent || 75;
    const descent = m.actualBoundingBoxDescent || 25;
    const h = ascent + descent;
    
    // Size it exactly to fit the text tightly
    lCanvas.width = w + 10;
    lCanvas.height = h + 10;
    
    lCtx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
    lCtx.fillStyle = 'white';
    lCtx.fillRect(0, 0, lCanvas.width, lCanvas.height);
    lCtx.fillStyle = 'black';
    lCtx.fillText(ln, left + 5, ascent + 5);

    // Draw this specific line stretched to the FULL width of the label!
    ctx.drawImage(lCanvas, 5, 5, w, h, SAFE_X, currentY, usableW, lineDestH);
    
    currentY += lineDestH + gap;
  }

  // Draw Jain text directly onto the canvas
  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    ctx.font = '900 24px "Arial Black", Arial, sans-serif';
    const m = ctx.measureText(sub);
    const sx = Math.max(SAFE_X, (DW - m.width) / 2);
    // Draw near the bottom edge
    ctx.fillStyle = 'black';
    ctx.fillText(sub, sx, DH - 10);
  }

  // --- VISUAL PREVIEW FOR TESTING WITHOUT PRINTER ---
  try {
    const prevId = 'debug-tspl-preview';
    const old = document.getElementById(prevId);
    if(old) old.remove();
    
    const preview = document.createElement('div');
    preview.id = prevId;
    preview.style.cssText = 'position:fixed; top:20px; right:20px; z-index:99999; border:3px solid #ff4757; background:#fff; padding:10px; border-radius:8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);';
    preview.innerHTML = '<div style="margin-bottom:8px; font-weight:bold; color:#ff4757; font-family:sans-serif;">Printer Bitmap Preview (TSC TSPL)</div>';
    
    const clone = document.createElement('canvas');
    clone.width = DW; clone.height = DH;
    clone.getContext('2d').drawImage(canvas, 0, 0);
    clone.style.width = '260px'; 
    clone.style.height = (DH/2) + 'px';
    clone.style.border = '1px dashed #333';
    
    preview.appendChild(clone);
    document.body.appendChild(preview);
    
    // Auto remove after 10 seconds
    setTimeout(() => { if(document.getElementById(prevId)) preview.remove(); }, 10000);
  } catch(e) {}
  // ---------------------------------------------------

  const imgData = ctx.getImageData(0, 0, DW, DH);
  const data = imgData.data;
  
  const widthBytes = Math.ceil(DW / 8); 
  const buffer = new Uint8Array(widthBytes * DH);
  
  for (let y = 0; y < DH; y++) {
    for (let x = 0; x < DW; x++) {
      const idx = (y * DW + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      if (gray < 128) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        buffer[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  let hexString = '';
  const hexMap = "0123456789ABCDEF";
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    hexString += hexMap[(b >> 4) & 0x0F] + hexMap[b & 0x0F];
  }

  const printData = [];
  printData.push({ type: 'raw', format: 'plain', data: `SET DARKNESS 12\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,4,${widthBytes},${DH},0,` });
  printData.push({ type: 'raw', format: 'hex', data: hexString });
  printData.push({ type: 'raw', format: 'plain', data: `\r\nPRINT ${copies},1\r\n` });
  
  return printData;
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
    const printData = Array.isArray(tspl) ? tspl : [{ type: 'raw', format: 'plain', data: tspl }];
    await qz.print(_rawConfig(QZP.frontPrinter), printData);
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
