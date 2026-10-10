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

/* ─── FRONT label TSPL ─── */
function generateFrontCanvas(name) {
  let DW = 520, DH = 200; // default 65x25mm
  const currentMode = typeof ST !== 'undefined' ? ST.mode : null;
  if (currentMode === 'dukan') DW = 640; // 80x25mm

  const n = tsplSafe((name || '').toUpperCase().trim());
  const isJain = n.includes('JAIN');
  const jainBlockH = isJain ? 36 : 0;
  const availH = DH - jainBlockH;

  let lines = balanceLines(n, 1);
  if (n.length > 15 && n.length <= 26) {
    lines = balanceLines(n, 2);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')]; 
  } else if (n.length > 26) {
    lines = balanceLines(n, 3);
    if (lines.length < 3) {
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

  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DW, DH);
  
  let leftPad = 8, rightPad = 48; // Shifted further left and squeezed to prevent right cutoff for long names
  if (currentMode === 'dukan') { leftPad = 16; rightPad = 16; } // Equal and smaller margins for 80mm so text is BIGGER
  const SAFE_Y = 16; // reduced Y padding to make text taller
  
  const usableW = DW - (leftPad + rightPad); 
  const usableH = availH - (SAFE_Y * 2);
  const numLines = lines.length;
  
  const gap = numLines > 1 ? 8 : 0;
  const totalGap = gap * (numLines - 1);
  const lineDestH = Math.floor((usableH - totalGap) / numLines);

  let currentY = SAFE_Y;

  for (let i = 0; i < numLines; i++) {
    const ln = lines[i];
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
    
    lCanvas.width = w + 10;
    lCanvas.height = h + 10;
    
    lCtx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
    lCtx.fillStyle = 'white';
    lCtx.fillRect(0, 0, lCanvas.width, lCanvas.height);
    lCtx.fillStyle = 'black';
    lCtx.fillText(ln, left + 5, ascent + 5);

    ctx.drawImage(lCanvas, 5, 5, w, h, leftPad, currentY, usableW, lineDestH);
    currentY += lineDestH + gap;
  }

  if (isJain) {
    const sub = 'NO ONION NO GARLIC';
    ctx.font = '900 24px "Arial Black", Arial, sans-serif';
    const m = ctx.measureText(sub);
    const sx = Math.max(leftPad, (DW - m.width) / 2);
    ctx.fillStyle = 'black';
    ctx.fillText(sub, sx, DH - 10);
  }

  return canvas;
}

function buildFrontTSPL(name, copies, disablePopup) {
  const canvas = generateFrontCanvas(name);
  const DW = canvas.width;
  const DH = canvas.height;
  const ctx = canvas.getContext('2d');

  // --- VISUAL PREVIEW FOR TESTING WITHOUT PRINTER ---
  if (!disablePopup) {
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
  }
  // ---------------------------------------------------

  const imgData = ctx.getImageData(0, 0, DW, DH);
  const data = imgData.data;
  
  const widthBytes = Math.ceil(DW / 8); 
  const buffer = new Uint8Array(widthBytes * DH);
  buffer.fill(255); // initialize with WHITE
  
  for (let y = 0; y < DH; y++) {
    for (let x = 0; x < DW; x++) {
      const idx = (y * DW + x) * 4;
      if (data[idx+3] < 128) continue; // skip transparent
      const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      if (gray < 128) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        buffer[byteIdx] &= ~(1 << bitIdx); // clear bit to 0 (BLACK)
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
  printData.push({ type: 'raw', format: 'plain', data: `SET DARKNESS 12\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,${widthBytes},${DH},0,` });
  printData.push({ type: 'raw', format: 'hex', data: hexString });
  printData.push({ type: 'raw', format: 'plain', data: `\r\nPRINT ${copies},1\r\n` });
  
  return printData;
}


function generateBackCanvas(p, v, bn, pd, bb) {
  const DW = 400;
  // Use a tall virtual canvas to draw everything, then squish if it's too tall
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DW, 1200);
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';

  const leftPad = 24; // perfect middle ground between 8 and 36
  const rightPad = 24;
  const usableW = DW - (leftPad + rightPad);
  let y = 36; // Increased top margin so title doesn't get cut
  
  const mrp  = parseFloat(v.m) || 0;
  const pg   = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const name = tsplSafe((p.n || '').toUpperCase().trim());
  const cat  = tsplSafe(p.c || '-');
  const ingr = tsplSafe(p.i || '-');
  const nw   = tsplSafe(`${v.d} (${v.oz})`);
  const bno  = tsplSafe(bn || '-');
  const isJain = name.includes('JAIN');
  const isBlended = (p.c || '').toLowerCase().includes('blended');
  const isSeasoning = (p.c || '').toLowerCase().includes('seasoning');

  // 1. Title (stretched edge-to-edge)
  let lines = balanceLines(name, 1);
  if (name.length > 15 && name.length <= 26) {
    lines = balanceLines(name, 2);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')]; 
  } else if (name.length > 26) {
    lines = balanceLines(name, 3);
    if (lines.length < 3) {
      const words = name.split(' ');
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
  
  const titleLineH = 46;
  for (let ln of lines) {
    const lCanvas = document.createElement('canvas');
    const lCtx = lCanvas.getContext('2d');
    lCtx.font = `900 100px "Arial Black", Arial, sans-serif`;
    const m = lCtx.measureText(ln);
    const left = m.actualBoundingBoxLeft || 0;
    const right = m.actualBoundingBoxRight || m.width;
    const w = left + right;
    const ascent = m.actualBoundingBoxAscent || 75;
    const descent = m.actualBoundingBoxDescent || 25;
    const h = ascent + descent;
    
    lCanvas.width = w + 10; lCanvas.height = h + 10;
    lCtx.font = `900 100px "Arial Black", Arial, sans-serif`;
    lCtx.fillStyle = 'white'; lCtx.fillRect(0,0,lCanvas.width,lCanvas.height);
    lCtx.fillStyle = 'black'; lCtx.fillText(ln, left+5, ascent+5);
    ctx.drawImage(lCanvas, 5, 5, w, h, leftPad, y, usableW, titleLineH);
    y += titleLineH + 6;
  }
  y += 4;

  // Jain
  if (isJain) {
    ctx.font = '900 16px "Arial Black", Arial, sans-serif';
    const sub = 'NO ONION NO GARLIC';
    ctx.fillText(sub, (DW - ctx.measureText(sub).width)/2, y);
    y += 24;
  }

  // Category
  if (isSeasoning) {
    ctx.font = 'bold 20px Arial';
    const catTxt = 'SEASONING';
    ctx.fillText(catTxt, (DW - ctx.measureText(catTxt).width)/2, y);
    y += 30;
  }

  // Blended
  let blendedBoxText = '';
  if (p.sc) {
    blendedBoxText = p.sc;
  } else if (isBlended) {
    blendedBoxText = 'Mixed Masala Powder, Spices content more than 85%, salt content more than 5%';
  }

  if (blendedBoxText) {
    ctx.font = 'bold 14px Arial';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
    
    let bl1 = blendedBoxText;
    let bl2 = '';
    if (blendedBoxText.includes('Mixed Masala Powder')) {
       bl1 = 'Mixed Masala Powder, Spices content';
       bl2 = 'more than 85%, salt content more than 5%';
    }

    ctx.strokeRect(leftPad, y, usableW, 46);
    ctx.fillText(bl1, (DW - ctx.measureText(bl1).width)/2, y + 6);
    if (bl2) {
      ctx.fillText(bl2, (DW - ctx.measureText(bl2).width)/2, y + 24);
    }
    y += 56;
  }

  // HR
  ctx.fillRect(leftPad, y, usableW, 2);
  y += 12;

  // Ingredients
  ctx.font = 'bold 20px Arial';
  ctx.fillText('INGREDIENTS :-', leftPad, y);
  y += 26;
  ctx.font = '20px Arial';
  
  // Custom wrapping function for canvas pixel width
  function wrapTextCanvas(context, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = context.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  const ingrLines = wrapTextCanvas(ctx, `(In Descending Order By Weight) ${ingr}`, usableW);
  for(let ln of ingrLines) {
    ctx.fillText(ln, leftPad, y);
    y += 24;
  }
  y += 8;

  // Nutrition
  ctx.font = '900 20px "Arial Black", Arial, sans-serif';
  const n1 = 'NUTRITIONAL INFORMATION';
  ctx.fillText(n1, (DW - ctx.measureText(n1).width)/2, y);
  y += 24;
  ctx.font = 'italic 16px Arial';
  const n2 = 'Approximate Composition per 100 g';
  ctx.fillText(n2, (DW - ctx.measureText(n2).width)/2, y);
  y += 26;

  // Box
  ctx.font = 'bold 18px Arial';
  const fullNutriStr = `Energy (${p.e||0}kcal), Protein (${p.p||0}g), Carbohydrate (${p.cb||0}g), Total Sugars (—g), Added Sugars (—g), Total Fat (${p.tf||0}g), Saturated Fat (${p.sf||0}g), Trans Fat (—g), Cholesterol (—mg), Sodium (${p.so||0}mg)`;
  const nl = wrapTextCanvas(ctx, fullNutriStr, usableW - 16);
  const boxTop = y;
  y += 8;
  for(let ln of nl) {
    ctx.fillText(ln, leftPad + 8, y);
    y += 24;
  }
  ctx.lineWidth = 1.5;
  ctx.strokeRect(leftPad, boxTop, usableW, y - boxTop + 4);
  y += 24;

  // Details
  ctx.font = 'bold 20px Arial';
  const bbClean = (bb || '—').replace(/\s*\(.*$/, '');
  const details = [
    `NET WEIGHT : ${nw}`,
    `BATCH NO : ${bno}`,
    `DATE OF PACKING : ${pd}`,
    `BEST BEFORE : ${bbClean}`
  ];
  for(let ln of details) {
    ctx.fillText(ln, leftPad, y);
    y += 26;
  }
  y += 10;

  // MRP
  ctx.font = '900 28px "Arial Black", Arial, sans-serif';
  ctx.fillText(`MRP : ₹ ${mrp}/-`, leftPad, y);
  y += 34;
  ctx.font = 'bold 16px Arial';
  ctx.fillText(`(INCL. OF ALL TAXES)`, leftPad, y);
  y += 22;
  ctx.fillText(`FOR 1g = Rs ${pg}`, leftPad, y);
  y += 30;

  // Barcode
  if (typeof JsBarcode !== 'undefined') {
    const bcode = (p.barcode) ? String(p.barcode) : '8905606000007';
    const bcCanvas = document.createElement('canvas');
    JsBarcode(bcCanvas, bcode, {
      format: "CODE128",
      width: 2,
      height: 46,
      displayValue: true,
      fontSize: 18,
      margin: 0
    });
    const bcX = Math.max(leftPad, (DW - bcCanvas.width) / 2);
    ctx.drawImage(bcCanvas, bcX, y);
    y += bcCanvas.height;
  }

  y += 16; // bottom padding

  const DH_FINAL = 720; // 50x90mm
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = DW;
  finalCanvas.height = DH_FINAL;
  const fCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
  fCtx.fillStyle = 'white';
  fCtx.fillRect(0, 0, DW, DH_FINAL);

  const drawH = Math.min(y, DH_FINAL);
  // Just stretch exactly whatever we generated to fit exactly or pad at bottom
  // Actually, if y < DH_FINAL, we don't want to stretch it, just leave it top aligned.
  // Wait, if we want it to always fill the 90mm nicely, we could stretch it slightly?
  // No, stretching text vertically looks bad. Top-aligned is safer.
  // But wait! If y > DH_FINAL, we MUST squish it so nothing is cut off!
  // If y < DH_FINAL, we should just distribute some gap.
  // The simplest is: draw height = drawH. (Squishes if > 720, exact pixel mapping if < 720).
  // This is BarTender's exact "Scale to fit" logic.
  fCtx.drawImage(canvas, 0, 0, DW, y, 0, 0, DW, drawH);

  return finalCanvas;
}

function buildBackTSPL(p, v, bn, pd, bb, copies, disablePopup) {
  const canvas = generateBackCanvas(p, v, bn, pd, bb);
  const DW = canvas.width;
  const DH = canvas.height;
  const ctx = canvas.getContext('2d');

  // --- VISUAL PREVIEW FOR TESTING WITHOUT PRINTER ---
  if (!disablePopup) {
    try {
      const prevId = 'debug-tspl-preview-back';
      const old = document.getElementById(prevId);
      if(old) old.remove();
      
      const preview = document.createElement('div');
      preview.id = prevId;
      preview.style.cssText = 'position:fixed; top:20px; left:20px; z-index:99999; border:3px solid #ff4757; background:#fff; padding:10px; border-radius:8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);';
      preview.innerHTML = '<div style="margin-bottom:8px; font-weight:bold; color:#ff4757; font-family:sans-serif;">Back Bitmap Preview</div>';
      
      const clone = document.createElement('canvas');
      clone.width = DW; clone.height = DH;
      clone.getContext('2d').drawImage(canvas, 0, 0);
      // scale to fit screen nicely
      clone.style.width = '200px'; 
      clone.style.height = (DH/2) + 'px';
      clone.style.border = '1px dashed #333';
      
      preview.appendChild(clone);
      document.body.appendChild(preview);
      setTimeout(() => { if(document.getElementById(prevId)) preview.remove(); }, 10000);
    } catch(e) {}
  }
  // ---------------------------------------------------

  const imgData = ctx.getImageData(0, 0, DW, DH);
  const data = imgData.data;
  
  const widthBytes = Math.ceil(DW / 8); 
  const buffer = new Uint8Array(widthBytes * DH);
  buffer.fill(255); // initialize with WHITE
  
  for (let cy = 0; cy < DH; cy++) {
    for (let cx = 0; cx < DW; cx++) {
      const idx = (cy * DW + cx) * 4;
      if (data[idx+3] < 128) continue; // skip transparent
      const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      if (gray < 128) {
        const byteIdx = cy * widthBytes + Math.floor(cx / 8);
        const bitIdx = 7 - (cx % 8);
        buffer[byteIdx] &= ~(1 << bitIdx); // clear bit to 0 (BLACK)
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



/* ═══════════════════════════════════════════════════════════════
   PRINT FUNCTIONS
   NO altPrinting = goes through TSC driver (Windows spooler)
   This is exactly how BarTender works — driver handles end-of-job
═══════════════════════════════════════════════════════════════ */

function _rawConfig(printer) {
  // NO altPrinting — TSC driver handles end-of-job signals properly
  return qz.configs.create(printer);
}

/* ─── NEW 32x25 LABEL (2-UP FORMAT) ─── */
function generateNew32Canvas(p, v, bn, pd, bb, count = 2) {
  // Total width of the roll is 32 + 4 + 32 = 68mm.
  // 68mm * 8 = 544 dots.
  const DW = 544, DH = 200;
  const canvas = document.createElement('canvas');
  canvas.width = DW; canvas.height = DH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DW, DH);
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';

  // Left offset = 0, Right offset = 288 (32mm + 4mm = 36mm = 288 dots)
  const offsets = count === 1 ? [0] : [0, 288];

  // Barcode value is same for both
  let bcCanvas = null;
  try {
    bcCanvas = document.createElement('canvas');
    // Use CODE128 to completely bypass EAN13 checksum exceptions
    let bcVal = p.barcode ? String(p.barcode) : '8905606000007'; 
    JsBarcode(bcCanvas, bcVal, { format: 'CODE128', width: 2, height: 18, displayValue: true, fontSize: 22, fontOptions: "bold", margin: 0 });
  } catch(e) { console.error('Barcode error', e); }

  offsets.forEach(startX => {
    const w32 = 256; // 32mm = 256 dots
    const leftX = startX + 16; // 2mm padding from left
    let y = 2; // Shift up

    ctx.textAlign = 'left'; // User requested left alignment
    ctx.textBaseline = 'top';

    // 100g ( 3.5oz )
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText(`${v.d} ( ${v.oz} )`, leftX, y);
    y += 26;

    // KCP100 (Batch)
    ctx.fillText(bn || '—', leftX, y);
    y += 26;
    
    // 02/10/2026 (Date of Packing)
    ctx.fillText(pd || '—', leftX, y);
    y += 26;

    // EXPIRY DATE: 01/10/2027
    const bbClean = (bb || '—').replace(/\s*\(.*$/, ''); // strip (12 Months)
    ctx.font = '16px Arial, sans-serif'; // Not bold, slightly smaller
    ctx.fillText(`EXPIRY DATE: ${bbClean}`, leftX, y);
    y += 18;

    // ₹160. (1.60/g)
    ctx.font = 'bold 28px Arial, sans-serif';
    const mrp = parseFloat(v.m) || 0;
    const pg = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
    ctx.fillText(`₹${mrp}. (${pg}/g)`, leftX, y);
    y += 26;

    // (INC. OF ALL TAXES)
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('(INC. OF ALL TAXES)', leftX, y);
    y += 14;

    if (bcCanvas) {
      const bcW = 210; // width of barcode
      ctx.drawImage(bcCanvas, leftX, y, bcW, bcCanvas.height);
    }
  });

  return canvas;
}

function canvasToTSPL_PrintData(canvas, copies) {
  const DW = canvas.width;
  const DH = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, DW, DH);
  const data = imgData.data;
  
  const widthBytes = Math.ceil(DW / 8); 
  const buffer = new Uint8Array(widthBytes * DH);
  buffer.fill(255); // initialize with WHITE
  
  for (let y = 0; y < DH; y++) {
    for (let x = 0; x < DW; x++) {
      const idx = (y * DW + x) * 4;
      if (data[idx+3] < 128) continue; // skip transparent
      const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      if (gray < 128) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        buffer[byteIdx] &= ~(1 << bitIdx); // clear bit to 0 (BLACK)
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
  printData.push({ type: 'raw', format: 'plain', data: `SET DARKNESS 12\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,${widthBytes},${DH},0,` });
  printData.push({ type: 'raw', format: 'hex', data: hexString });
  printData.push({ type: 'raw', format: 'plain', data: `\r\nPRINT ${copies},1\r\n` });
  
  return printData;
}

function buildNew32TSPL(p, v, bn, pd, bb, copies = 1, disablePopup = false) {
  let allPrintData = [];
  
  const fullPrints = Math.floor(copies / 2);
  const remainder = copies % 2;

  let canvasToShow = null;

  if (fullPrints > 0) {
    const c2 = generateNew32Canvas(p, v, bn, pd, bb, 2);
    if (!canvasToShow) canvasToShow = c2;
    allPrintData = allPrintData.concat(canvasToTSPL_PrintData(c2, fullPrints)); 
  }
  
  if (remainder === 1) {
    const c1 = generateNew32Canvas(p, v, bn, pd, bb, 1);
    if (!canvasToShow) canvasToShow = c1;
    allPrintData = allPrintData.concat(canvasToTSPL_PrintData(c1, 1));
  }

  // Fallback visual preview popup
  if (!disablePopup && canvasToShow) {
    try {
      const prevId = 'debug-tspl-preview-32';
      const old = document.getElementById(prevId);
      if(old) old.remove();
      const preview = document.createElement('div');
      preview.id = prevId;
      preview.style.cssText = 'position:fixed; top:20px; right:20px; z-index:99999; border:3px solid #ff4757; background:#fff; padding:10px; border-radius:8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);';
      preview.innerHTML = '<div style="margin-bottom:8px; font-weight:bold; color:#ff4757; font-family:sans-serif;">Printer Bitmap Preview (32x25)</div>';
      const clone = document.createElement('canvas');
      clone.width = canvasToShow.width; clone.height = canvasToShow.height;
      clone.getContext('2d').drawImage(canvasToShow, 0, 0);
      clone.style.width = '260px'; 
      clone.style.border = '1px dashed #333';
      preview.appendChild(clone);
      document.body.appendChild(preview);
      setTimeout(() => { if(document.getElementById(prevId)) preview.remove(); }, 10000);
    } catch(e) {}
  }

  return allPrintData;
}

async function qzPrintNew32(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  const printData = buildNew32TSPL(p, v, bn, pd, bb, copies, true);
  try {
    setQZStatus('printing');
    await qz.print(_rawConfig(QZP.frontPrinter), printData); // Uses front printer TE244 Copy 1
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Printer!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

async function qzPrintFront(name, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  const tspl = buildFrontTSPL(name, copies, true); // true = disable popup here
  console.log('[FRONT TSPL]\n', tspl);
  try {
    const printData = Array.isArray(tspl) ? tspl : [{ type: 'raw', format: 'plain', data: tspl }];
    let printerToUse = QZP.frontPrinter;
    const currentMode = typeof ST !== 'undefined' ? ST.mode : null;
    if (currentMode === 'dukan') printerToUse = 'TSC TA210'; // hardcoded per user req
    await qz.print(_rawConfig(printerToUse), printData);
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
  const tspl = buildBackTSPL(p, v, bn, pd, bb, copies, true); // true = disable popup here
  console.log('[BACK TSPL]\n', tspl);
  try {
    setQZStatus('printing');
    const printData = Array.isArray(tspl) ? tspl : [{ type: 'raw', format: 'plain', data: tspl }];
    await qz.print(_rawConfig(QZP.backPrinter), printData);
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

// ─────────────────────────────────────────────────────────
// PARTIES MODE (YELLOW 365) - 104.1 x 152.4 mm (4x6)
// ─────────────────────────────────────────────────────────

function generateYellowCanvas(p, v, bn, pd, bb) {
  const DW = 832;
  const DH = 1218; // 4" x 6"
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, DW, DH);
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';

  const leftPad = 48;
  const rightPad = 48;
  const usableW = DW - (leftPad + rightPad);
  let y = 350; // Increased top margin to prevent overlapping the pre-printed logo
  
  function drawLine(label, value, isBold = false) {
    if (!value && label !== 'NON-RETAIL CONTAINER – NOT FOR DIRECT SALE TO CONSUMER') return; 
    ctx.font = 'bold 26px Arial, sans-serif';
    const labelW = ctx.measureText(label).width;
    ctx.fillText(label, leftPad, y);
    
    if (value) {
      ctx.font = isBold ? 'bold 26px Arial, sans-serif' : '26px Arial, sans-serif';
      const maxW = usableW - labelW - 10;
      const words = value.split(' ');
      let line = '';
      let firstLine = true;
      for (let i = 0; i < words.length; i++) {
        let testLine = line + words[i] + ' ';
        if (ctx.measureText(testLine).width > (firstLine ? maxW : usableW) && i > 0) {
          ctx.fillText(line, firstLine ? leftPad + labelW + 10 : leftPad, y);
          y += 34;
          line = words[i] + ' ';
          firstLine = false;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, firstLine ? leftPad + labelW + 10 : leftPad, y);
    }
    y += 48; 
  }

  // Calculate Expiry Date (1 year from PD)
  let edStr = '';
  if (pd && pd.includes('/')) {
    const parts = pd.split('/');
    if (parts.length === 3) {
      const edYear = parseInt(parts[2], 10) + 1;
      let edDay = parseInt(parts[0], 10) - 1;
      let edMonth = parseInt(parts[1], 10);
      let yearAdj = edYear;
      if (edDay === 0) {
        edMonth -= 1;
        if (edMonth === 0) {
          edMonth = 12;
          yearAdj -= 1;
        }
        const daysInMonth = new Date(yearAdj, edMonth, 0).getDate();
        edDay = daysInMonth;
      }
      edStr = `${String(edDay).padStart(2,'0')}/${String(edMonth).padStart(2,'0')}/${yearAdj}`;
    }
  }

  const batchCode = bn || v.bn || p.b || '';

  drawLine('Product Name -', p.n.toUpperCase(), true);
  y += 8;
  
  if (p.i) {
    drawLine("Ingredient's -", p.i);
    y += 8;
  }
  
  drawLine('Net Quantity -', v.d.toUpperCase(), true);
  y += 8;
  
  drawLine('Batch No -', batchCode, true);
  y += 8;
  
  drawLine('Date of Manufacturing -', pd, true);
  y += 8;
  
  if (edStr) {
    drawLine('Expiry Date -', edStr, true);
    y += 8;
  }
  
  const mrp = parseFloat(v.m) || 10000;
  drawLine('MRP -', `₹ ${mrp.toFixed(2)}`);
  y += 8;

  drawLine('Storage Instructions -', 'Store in a cool, dry, and hygienic place & Keep away from moisture and direct sunlight.');
  y += 8;

  drawLine('Allergen Information -', 'Processed in a facility that also contains Milk, Sesame and Mustard.');
  y += 24;

  ctx.font = 'bold 22px Arial, sans-serif';
  const nrText = 'NON-RETAIL CONTAINER – NOT FOR DIRECT SALE TO CONSUMER';
  const nrW = ctx.measureText(nrText).width;
  ctx.fillText(nrText, (DW - nrW)/2, 880); // Hardcoded Y to push it down near the pre-printed text
  
  return canvas;
}

function buildYellowTSPL(p, v, bn, pd, bb, copies, disablePopup) {
  const canvas = generateYellowCanvas(p, v, bn, pd, bb);
  const DW = canvas.width;
  const DH = canvas.height;
  const ctx = canvas.getContext('2d');

  if (!disablePopup) {
    try {
      const prevId = 'debug-tspl-preview-yellow';
      const old = document.getElementById(prevId);
      if(old) old.remove();
      
      const preview = document.createElement('div');
      preview.id = prevId;
      preview.style.cssText = 'position:fixed; top:20px; left:20px; z-index:99999; border:3px solid #ff4757; background:#fff; padding:10px; border-radius:8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;';
      preview.innerHTML = '<div style="margin-bottom:8px; font-weight:bold; color:#ff4757; font-family:sans-serif;">Yellow 365 Preview</div>';
      
      const clone = document.createElement('canvas');
      clone.width = DW; clone.height = DH;
      clone.getContext('2d').drawImage(canvas, 0, 0);
      clone.style.width = '300px'; 
      clone.style.height = 'auto';
      clone.style.border = '1px dashed #333';
      
      preview.appendChild(clone);
      document.body.appendChild(preview);
      setTimeout(() => { if(document.getElementById(prevId)) preview.remove(); }, 10000);
    } catch(e) {}
  }

  const imgData = ctx.getImageData(0, 0, DW, DH);
  const data = imgData.data;
  
  const widthBytes = Math.ceil(DW / 8); 
  const buffer = new Uint8Array(widthBytes * DH);
  buffer.fill(255); 
  
  for (let cy = 0; cy < DH; cy++) {
    for (let cx = 0; cx < DW; cx++) {
      const idx = (cy * DW + cx) * 4;
      if (data[idx+3] < 128) continue; 
      const gray = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      if (gray < 128) {
        const byteIdx = cy * widthBytes + Math.floor(cx / 8);
        const bitIdx = 7 - (cx % 8);
        buffer[byteIdx] &= ~(1 << bitIdx); 
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
  printData.push({ type: 'raw', format: 'plain', data: `SIZE 104.1 mm, 152.4 mm\r\nGAP 3 mm, 0 mm\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,${widthBytes},${DH},0,` });
  printData.push({ type: 'raw', format: 'hex', data: hexString });
  printData.push({ type: 'raw', format: 'plain', data: `\r\nPRINT ${copies},1\r\n` });
  
  return printData;
}

async function qzPrintYellow(p, v, bn, pd, bb, copies) {
  if (typeof qz === 'undefined') return false;
  if (!await _ensureConnected()) return false;
  const printData = buildYellowTSPL(p, v, bn, pd, bb, copies, true);
  try {
    const printerName = 'TSC TA210';
    console.log('[YELLOW 365] Sending to printer:', printerName);
    setQZStatus('printing');
    await qz.print(_rawConfig(printerName), printData); 
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to ${printerName}!`, 'success');
    return true;
  } catch (err) {
    QZP.connected = qz.websocket.isActive();
    setQZStatus(QZP.connected ? 'connected' : 'disconnected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}
