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
  printers: []
};

/* ─── Init on page load ─── */
window.addEventListener('DOMContentLoaded', () => {
  qzConnect();
  loadSavedSettings();
});

/* ─── Connect to QZ Tray ─── */
async function qzConnect() {
  setQZStatus('connecting');
  try {
    // Use unsigned cert for local connection (free QZ Tray)
    qz.security.setCertificatePromise(() => Promise.resolve(''));
    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise(() => Promise.resolve(''));

    await qz.websocket.connect({ retries: 3, delay: 1 });
    QZP.connected = true;
    setQZStatus('connected');
    await refreshPrinters();
  } catch (err) {
    QZP.connected = false;
    setQZStatus('disconnected');
    console.warn('[QZ] Not connected:', err.message);
  }
}

/* ─── Refresh printer list ─── */
async function refreshPrinters() {
  if (!QZP.connected) return;
  try {
    QZP.printers = await qz.printers.find();
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

  if (dot) { dot.style.background = s.color; }
  if (txt) { txt.textContent = s.label; }
  if (modalDot) { modalDot.style.background = s.color; }
  if (modalTxt) { modalTxt.textContent = s.label; }
  if (installTip) {
    installTip.style.display = state === 'disconnected' ? 'block' : 'none';
  }
}

/* ─── Modal Open/Close ─── */
function openPrinterSettings() {
  const modal = document.getElementById('printer-modal');
  if (modal) modal.classList.add('active');
  if (QZP.connected) {
    refreshPrinters();
  } else {
    qzConnect(); // retry
  }
}

function closePrinterSettings(e) {
  if (e && e.target !== document.getElementById('printer-modal')) return;
  document.getElementById('printer-modal').classList.remove('active');
}

/* ─── Populate dropdowns ─── */
function populatePrinterDropdowns(printers) {
  const fSel = document.getElementById('front-printer-sel');
  const bSel = document.getElementById('back-printer-sel');
  if (!fSel || !bSel) return;

  const opts = printers.map(p =>
    `<option value="${p}"${p === QZP.frontPrinter ? ' selected' : ''}>${p}</option>`
  ).join('');

  fSel.innerHTML = '<option value="">-- Select Printer --</option>' + opts;
  bSel.innerHTML = '<option value="">-- Select Printer --</option>' +
    printers.map(p =>
      `<option value="${p}"${p === QZP.backPrinter ? ' selected' : ''}>${p}</option>`
    ).join('');
}

/* ─── Load saved settings into modal ─── */
function loadSavedSettings() {
  const gapEl = document.getElementById('label-gap');
  if (gapEl) gapEl.value = QZP.gap;
}

/* ─── Save printer settings ─── */
function savePrinterSettings() {
  const fp = document.getElementById('front-printer-sel').value;
  const bp = document.getElementById('back-printer-sel').value;
  const gp = parseFloat(document.getElementById('label-gap').value) || 3;

  QZP.frontPrinter = fp;
  QZP.backPrinter = bp;
  QZP.gap = gp;

  localStorage.setItem('frontPrinter', fp);
  localStorage.setItem('backPrinter', bp);
  localStorage.setItem('labelGap', gp);

  document.getElementById('printer-modal').classList.remove('active');
  showToast('✓ Printer settings saved!', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   TSPL COMMAND GENERATORS
   TSC TE244 uses TSPL (Thermal Standard Printer Language)
═══════════════════════════════════════════════════════════════ */

/* ─── Generate FRONT label TSPL ─── */
function buildFrontTSPL(name, copies) {
  const w = 65, h = 24, gap = QZP.gap;
  const lines = wrapText(name.toUpperCase(), 30); // wrap long names
  const totalLines = lines.length;

  // Calculate font and Y positions
  // TSPL TEXT: TEXT x,y,"font",rotation,xmul,ymul,"text"
  // Font "3" = 16x24pt, "4" = 24x32pt. We use x/y multipliers for scaling
  let yStart, font, xm, ym;
  if (totalLines === 1) {
    font = '4'; xm = 3; ym = 3;
    yStart = Math.round((h * 11.8 / 2) - (32 * 3 / 2)); // vertically center
  } else if (totalLines === 2) {
    font = '4'; xm = 2; ym = 2;
    yStart = Math.round((h * 11.8) / 2 - (32 * 2 * totalLines / 2));
  } else {
    font = '3'; xm = 2; ym = 2;
    yStart = Math.round((h * 11.8) / 2 - (24 * 2 * totalLines / 2));
  }

  let textCmds = '';
  const lineHeight = (font === '4' ? 32 : 24) * ym + 8;
  lines.forEach((line, i) => {
    const yPos = Math.max(4, yStart + i * lineHeight);
    // Center-align: calc x offset
    const textW = line.length * (font === '4' ? 24 : 16) * xm;
    const xPos = Math.max(4, Math.round((w * 11.8 - textW) / 2));
    textCmds += `TEXT ${xPos},${yPos},"${font}",0,${xm},${ym},"${line}"\n`;
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
  ].join('\n');
}

/* ─── Generate BACK label TSPL ─── */
function buildBackTSPL(p, v, bn, pd, bb, copies) {
  const w = 47.5, h = 89, gap = QZP.gap;
  const mrp = parseFloat(v.m) || 0;
  const pg = (mrp / (parseFloat(v.g) || 1)).toFixed(2);

  // TSPL dots = mm * 8 (203 DPI = 8 dots/mm)
  // All x,y in dots
  const d = (mm) => Math.round(mm * 8);
  const W = d(w); // total width in dots

  // Helper: centered text x
  const cx = (text, charW) => Math.max(0, Math.round((W - text.length * charW) / 2));

  // Wrap ingredients to fit label width
  const ingrLines = wrapText(`(In Descending Order By Weight) ${p.i || '—'}`, 48);
  const nsText = getNutritionShort(p);
  const nsLines = wrapText(nsText, 52);

  let y = d(1.5); // start Y
  const lh = (mm) => d(mm); // line height helper

  let cmds = '';
  const line = (text, yPos, font, xm, ym, xOverride) => {
    const charW = (font === '3' ? 16 : (font === '2' ? 8 : 16)) * xm;
    const x = xOverride !== undefined ? xOverride : cx(text, charW);
    cmds += `TEXT ${Math.max(0,x)},${yPos},"${font}",0,${xm},${ym},"${text}"\n`;
  };
  const hline = (y) => { cmds += `BAR 0,${y},${W},3\n`; };

  // Product name — large, centered
  const nameLines = wrapText(p.n.toUpperCase(), 22);
  const nameFont = nameLines.length > 1 ? '4' : '4';
  const nameXm = nameLines.length > 1 ? 1 : 2;
  const nameYm = nameLines.length > 1 ? 1 : 2;
  nameLines.forEach((nl) => {
    line(nl, y, nameFont, nameXm, nameYm);
    y += lh(nameLines.length > 1 ? 5 : 6);
  });

  // Category
  line(`Category - ${p.c || '—'}`, y, '2', 1, 1);
  y += lh(3.5);

  hline(y); y += lh(2);

  // Ingredients
  cmds += `TEXT ${d(1)},${y},"2",0,1,1,"INGREDIENTS :-"\n`;
  y += lh(3);
  ingrLines.forEach(il => {
    cmds += `TEXT ${d(1)},${y},"2",0,1,1,"${il}"\n`;
    y += lh(3);
  });

  y += lh(0.5);

  // Nutritional header
  line('NUTRITIONAL INFORMATION', y, '2', 1, 1);
  y += lh(3.5);
  line('Approximate Composition per 100 g', y, '2', 1, 1);
  y += lh(3);

  // Nutrition box
  cmds += `BOX ${d(0.5)},${y},${W - d(0.5)},${y + d(nsLines.length * 3 + 2)},3\n`;
  y += lh(1);
  nsLines.forEach(nl => {
    cmds += `TEXT ${d(1.5)},${y},"2",0,1,1,"${nl}"\n`;
    y += lh(3);
  });
  y += lh(1.5);

  hline(y); y += lh(2);

  // Details
  const details = [
    `NET WEIGHT : ${v.d} (${v.oz})`,
    `BATCH NO : ${bn || '—'}`,
    `DATE OF PACKING : ${pd}`,
    `BEST BEFORE : ${bb}`
  ];
  details.forEach(det => {
    cmds += `TEXT ${d(1)},${y},"2",0,1,1,"${det}"\n`;
    y += lh(3.5);
  });

  hline(y); y += lh(2);

  // MRP
  line(`MRP : Rs.${mrp}/-`, y, '3', 1, 2);
  y += lh(5.5);
  line('(INCL. OF ALL TAXES)', y, '2', 1, 1);
  y += lh(3.5);
  line(`FOR 1g = Rs ${pg}`, y, '2', 1, 1);

  return [
    `SIZE ${w} mm,${h} mm`,
    `GAP ${gap} mm,0 mm`,
    `DIRECTION 1`,
    `REFERENCE 0,0`,
    `OFFSET 0 mm`,
    `CLS`,
    cmds.trim(),
    `PRINT ${copies},1`
  ].join('\n');
}

/* ─── Wrap text into lines ─── */
function wrapText(text, maxChars) {
  text = (text || '').trim();
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  });
  if (cur) lines.push(cur.trim());
  return lines.length ? lines : [text.substring(0, maxChars)];
}

/* ─── Short nutrition string for TSPL (compact) ─── */
function getNutritionShort(p) {
  return [
    `Energy:${p.e||0}kcal`, `Protein:${p.p||0}g`,
    `Carbs:${p.cb||0}g`, `Sugars:${p.ts||0}g`,
    `Fat:${p.tf||0}g`, `Sat.Fat:${p.sf||0}g`,
    `Trans Fat:${p.tr||0}g`, `Cholesterol:${p.ch||0}mg`,
    `Sodium:${p.so||0}mg`
  ].join(', ');
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PRINT FUNCTIONS — Called by pF() and pB() in app.js
   These OVERRIDE the Chrome print with QZ RAW print
   Falls back to Chrome print if QZ not connected
═══════════════════════════════════════════════════════════════ */

/* ─── Print Front via QZ or fallback ─── */
async function qzPrintFront(name, copies) {
  if (!QZP.connected || !QZP.frontPrinter) return false; // use fallback

  const tspl = buildFrontTSPL(name, copies);
  console.log('[TSPL FRONT]\n', tspl); // debug

  try {
    setQZStatus('printing');
    const config = qz.configs.create(QZP.frontPrinter);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Front Printer!`, 'success');
    return true;
  } catch (err) {
    setQZStatus('connected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

/* ─── Print Back via QZ or fallback ─── */
async function qzPrintBack(p, v, bn, pd, bb, copies) {
  if (!QZP.connected || !QZP.backPrinter) return false; // use fallback

  const tspl = buildBackTSPL(p, v, bn, pd, bb, copies);
  console.log('[TSPL BACK]\n', tspl); // debug

  try {
    setQZStatus('printing');
    const config = qz.configs.create(QZP.backPrinter);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    setQZStatus('connected');
    showToast(`✓ ${copies} label(s) sent to Back Printer!`, 'success');
    return true;
  } catch (err) {
    setQZStatus('connected');
    showToast('Print error: ' + err.message, 'error');
    return false;
  }
}

/* ─── Test print ─── */
async function testPrint() {
  if (!QZP.connected) {
    showToast('QZ Tray not connected!', 'error'); return;
  }
  const printer = QZP.frontPrinter || QZP.backPrinter;
  if (!printer) {
    showToast('Select a printer first!', 'error'); return;
  }
  const tspl = [
    `SIZE 65 mm,25 mm`,
    `GAP ${QZP.gap} mm,0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `TEXT 40,20,"4",0,1,1,"TEST PRINT"`,
    `TEXT 40,70,"2",0,1,1,"365 Spicery Label Studio"`,
    `PRINT 1,1`
  ].join('\n');
  try {
    const config = qz.configs.create(printer);
    await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }]);
    showToast('✓ Test print sent!', 'success');
  } catch (e) {
    showToast('Test print failed: ' + e.message, 'error');
  }
}
