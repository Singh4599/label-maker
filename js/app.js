'use strict';

/* ─── State ─── */
const ST = {
  mode: 'db',
  db: { p: SPICERY_DB.p, v: SPICERY_DB.v },
  prod: null,
  vi: -1
};

/* ─── DOM Helpers ─── */
const $ = id => document.getElementById(id);
const gv = id => { const el = $(id); return el ? el.value.trim() : ''; };
const gn = id => { const el = $(id); return parseFloat(el ? el.value : 0) || 0; };

/* ─── Init ─── */
window.addEventListener('DOMContentLoaded', () => {
  setTodayDates();
  updateClock();
  setInterval(updateClock, 30000);
  attachSearchListeners();
  attachDateListeners();
  initExcelUpload();
  attachDragDrop();
  setMode('db');
  populateCategories();
  // Inject toast container
  const tc = document.createElement('div');
  tc.id = 'toast-container';
  document.body.appendChild(tc);

  // Clean up print-zone and dynamic styles after every print
  window.addEventListener('afterprint', function() {
    var pz = document.getElementById('print-zone');
    if (pz) pz.innerHTML = '';
    var ps = document.getElementById('dynamic-print-style');
    if (ps) ps.innerHTML = '';
  });
});

/* ─── Toast Notifications ─── */
function showToast(msg, type = 'success') {
  const tc = document.getElementById('toast-container');
  if (!tc) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span class="toast-msg">${msg}</span>`;
  tc.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast-show'));
  setTimeout(() => {
    t.classList.remove('toast-show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

/* ─── Mobile Sidebar Toggle ─── */
function toggleSidebar() {
  document.body.classList.toggle('sidebar-open');
}
function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

/* ─── Clock ─── */
function updateClock() {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
  const wd = now.toLocaleDateString('en-IN', { weekday:'short' }).toUpperCase();
  const t = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  const dd = $('dt-date'); if (dd) dd.textContent = `${d} • ${wd}`;
  const dt = $('dt-time'); if (dt) dt.textContent = t;
}

function setTodayDates() {
  const iso = new Date().toISOString().split('T')[0];
  ['pd','m-pd'].forEach(id => { const el = $(id); if (el && !el.value) el.value = iso; });
  calcBestBefore(); calcManualBestBefore();
}

/* ─── Mode Switch ─── */
function setMode(mode) {
  ST.mode = mode;
  closeSidebar();
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

  // All list-based modes use mode-db panel
  const isListMode = ['db', 'excel', 'dukan', 'new32', 'parties', 'yellow365'].includes(mode);
  const mDb = $('mode-db'); if (mDb) mDb.classList.toggle('active', isListMode);
  const mMnl = $('mode-manual'); if (mMnl) mMnl.classList.toggle('active', mode === 'manual');

  // Load the correct data into ST.db
  if (mode === 'db') {
    ST.db = { p: SPICERY_DB.p, v: SPICERY_DB.v };
  } else if (mode === 'dukan') {
    ST.db = typeof DUKAN_DB !== 'undefined' ? DUKAN_DB : { p: {}, v: {} };
  } else if (mode === 'new32') {
    ST.db = typeof NEW32_DB !== 'undefined' ? NEW32_DB : { p: {}, v: {} };
  } else if (mode === 'parties') {
    ST.db = { p: {}, v: {} };
  } else if (mode === 'yellow365') {
    ST.db = typeof PARTIES_DB !== 'undefined' ? PARTIES_DB : { p: {}, v: {} };
  }

  // Update UI texts and visibility based on mode
  const isNew32 = mode === 'new32';
  const isDukan = mode === 'dukan';
  const isYellow = mode === 'yellow365';

  // Front Labels and Buttons
  let frontSizeText = isDukan ? '80×25 MM' : '65×25 MM'; // new32 front is 65x25
  if (isYellow) frontSizeText = '104×152 MM';
  document.querySelectorAll('.preview-section')[0].querySelector('.preview-lbl-size').textContent = frontSizeText;
  document.querySelectorAll('.btn-print-f').forEach(btn => {
    btn.innerHTML = `🖨️ ${isYellow ? 'Print' : 'Front'} — ${frontSizeText}`;
  });

  // Back Labels and Buttons
  const backSizeText = isNew32 ? '32×25 MM' : '50×90 MM';
  const backSection = document.querySelectorAll('.preview-section')[1];
  if (backSection) {
    backSection.style.display = isYellow ? 'none' : ''; // Hide for yellow365 since it's a single label
    backSection.querySelector('.preview-lbl-size').textContent = backSizeText;
  }
  document.querySelectorAll('.btn-print-b').forEach(btn => {
    btn.style.display = isYellow ? 'none' : 'inline-block';
    btn.innerHTML = `🖨️ Back — ${backSizeText}`;
  });

  // Update step description
  const desc = $('step1-desc');
  if (desc) {
    if (mode === 'db') desc.textContent = 'Search from our 365 Spicery product library';
    else if (mode === 'dukan') desc.textContent = 'Search from Dukan Bai products';
    else if (mode === 'new32') desc.textContent = 'Search from 32x25 label products';
    else if (mode === 'parties') desc.textContent = 'Search from Parties data (Coming Soon)';
    else if (mode === 'yellow365') desc.textContent = 'Search from YELLOW 365 products (104x152 mm)';
    else desc.textContent = 'Search from products';
  }

  clearProduct();
  
  // Handle Category Wrapper Visibility
  const catWrap = $('cat-wrap');
  if (catWrap) {
    if (isDukan || isNew32 || mode === 'parties' || isYellow) {
      catWrap.style.display = 'none';
    } else {
      catWrap.style.display = 'block';
    }
  }

  populateCategories();
  render();
}

function showDrop(names) {
  const drop = $('drop'); if (!drop) return;
  drop.innerHTML = '';
  names.forEach(n => {
    const d = document.createElement('div');
    d.innerHTML = `${ST.db.p[n].icon || '🌿'} &nbsp;${n}`;
    d.addEventListener('mousedown', e => { e.preventDefault(); pickProduct(n); });
    drop.appendChild(d);
  });
  drop.style.display = names.length ? 'block' : 'none';
}

function showAllProducts() {
  const catFilter = ($('cat-sel') || {}).value || '';
  const all = Object.keys(ST.db.p)
    .filter(n => !catFilter || ST.db.p[n].c === catFilter)
    .sort();
  showDrop(all);
}

/* ─── Search / Autocomplete ─── */
function attachSearchListeners() {
  const si = $('si'), drop = $('drop'), clr = $('si-clear');
  if (!si) return;

  si.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    if (clr) clr.style.display = q ? 'block' : 'none';
    if (!q) { closeDrop(); return; }
    const catFilter = ($('cat-sel') || {}).value || '';
    const hits = Object.keys(ST.db.p)
      .filter(n => {
        const prod = ST.db.p[n];
        if (catFilter && prod.c !== catFilter) return false;
        return n.toLowerCase().includes(q);
      })
      .slice(0, 20);
    if (!hits.length) { closeDrop(); return; }
    showDrop(hits);
  });

  si.addEventListener('focus', function () {
    if (!this.value.trim()) showAllProducts();
  });

  si.addEventListener('blur', () => setTimeout(closeDrop, 150));

  si.addEventListener('keydown', function (e) {
    const its = [...drop.querySelectorAll('div')], hi = drop.querySelector('.hi');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nx = hi ? hi.nextElementSibling : its[0];
      if (nx) { if (hi) hi.classList.remove('hi'); nx.classList.add('hi'); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const pv = hi ? hi.previousElementSibling : its[its.length-1];
      if (pv) { if (hi) hi.classList.remove('hi'); pv.classList.add('hi'); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = hi || its[0]; if (target) pickProduct(target.textContent.trim().replace(/^[^\w\s]+\s*/,''));
    } else if (e.key === 'Escape') { closeDrop(); }
  });

  if (clr) clr.addEventListener('click', () => { si.value = ''; clr.style.display = 'none'; closeDrop(); clearProduct(); });
}

function closeDrop() { const d = $('drop'); if (d) d.style.display = 'none'; }

function pickProduct(rawName) {
  // Strip emoji prefix if any
  const name = rawName.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '').trim();
  const p = ST.db.p[name] || Object.values(ST.db.p).find(x => x.n === name);
  if (!p) return;
  ST.prod = p; ST.vi = -1;
  const si = $('si'); if (si) si.value = p.n;
  const clr = $('si-clear'); if (clr) clr.style.display = 'block';
  closeDrop();
  showProductCard(p);
  renderPackBtns();
  render();
}

function showProductCard(p) {
  const card = $('product-card'); if (!card) return;
  card.innerHTML = `
    <div class="product-icon">${p.icon || '🌿'}</div>
    <div class="product-info">
      <div class="product-name">${p.n}</div>
      <div class="product-cat">${p.c}</div>
      <div class="product-desc">${p.desc || ''}</div>
    </div>
    <button class="product-change" onclick="clearProduct()">⇄ Change</button>
  `;
  card.classList.add('show');
}

function clearProduct() {
  ST.prod = null; ST.vi = -1;
  const card = $('product-card');
  if (card) { card.innerHTML = ''; card.classList.remove('show'); }
  const si = $('si'); if (si) si.value = '';
  const clr = $('si-clear'); if (clr) clr.style.display = 'none';
  renderPackBtns();
  const mv = $('mrp-val'); if (mv) mv.textContent = '';
  const pg = $('per-g'); if (pg) pg.textContent = '';
  render();
}

/* ─── Pack Buttons ─── */
function renderPackBtns() {
  const wrap = $('pack-btns'); if (!wrap) return;
  if (!ST.prod || !ST.db.v[ST.prod.n]) {
    wrap.innerHTML = '<span style="font-size:12px;color:var(--muted);font-style:italic">Select a product first</span>';
    return;
  }
  wrap.innerHTML = ST.db.v[ST.prod.n].map((v, i) =>
    `<button class="pack-btn${ST.vi === i ? ' active' : ''}" onclick="selectVariant(${i})">${v.d}</button>`
  ).join('');
}

function selectVariant(idx) {
  if (!ST.prod) return;
  ST.vi = idx;
  document.querySelectorAll('.pack-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
  const v = ST.db.v[ST.prod.n][idx];
  const bnEl = $('bn'); if (bnEl && v.bn) bnEl.value = v.bn;
  const mrp = parseFloat(v.m) || 0, pg = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const mv = $('mrp-val'); if (mv) mv.textContent = `₹ ${mrp}`;
  const pgEl = $('per-g'); if (pgEl) pgEl.textContent = `(Incl. all taxes) · For 1g = ₹ ${pg}`;
  render();
}

/* ─── Dates ─── */
function attachDateListeners() {
  const pd = $('pd'), bbSel = $('bb-sel'), bb = $('bb');
  if (pd) pd.addEventListener('change', () => { calcBestBefore(); render(); });
  if (bbSel) bbSel.addEventListener('change', () => {
    const custom = bbSel.value === 'custom';
    if (bb) bb.classList.toggle('hidden', !custom);
    if (!custom) calcBestBefore();
    render();
  });
  if (bb) bb.addEventListener('change', render);
  if ($('bn')) $('bn').addEventListener('input', render);
}

function calcBestBefore() {
  const pd = $('pd'), bbSel = $('bb-sel'), bb = $('bb');
  if (!pd || !bbSel || !bb || bbSel.value === 'custom' || !pd.value) return;
  const d = new Date(pd.value);
  d.setMonth(d.getMonth() + parseInt(bbSel.value));
  d.setDate(d.getDate() - 1);  // -1 day: 07/10/26 + 12mo = 06/10/27
  bb.value = d.toISOString().split('T')[0];
}

function calcManualBestBefore() {
  const pd = $('m-pd'), bbSel = $('m-bb-sel'), bb = $('m-bb');
  if (!pd || !bbSel || !bb || bbSel.value === 'custom' || !pd.value) return;
  const d = new Date(pd.value);
  d.setMonth(d.getMonth() + parseInt(bbSel.value));
  d.setDate(d.getDate() - 1);  // -1 day
  bb.value = d.toISOString().split('T')[0];
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function getBBValue(selId, bbId) {
  const sel = $(selId), bb = $(bbId);
  if (!sel || !bb) return '—';
  if (sel.value === 'custom') return fmtDate(bb.value);
  const months = parseInt(sel.value);
  const dateStr = fmtDate(bb.value);
  return dateStr !== '—' ? `${dateStr} (${months} Months)` : `${months} Months`;
}

/* ─── Excel Upload ─── */
function initExcelUpload() {
  const ef = $('ef'); if (!ef) return;
  ef.addEventListener('change', function () {
    const f = this.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ps = wb.SheetNames.find(s => /product/i.test(s));
        const vs = wb.SheetNames.find(s => /variant/i.test(s));
        if (!ps || !vs) { showToast('Excel needs "Products" and "Variants" sheets', 'error'); return; }
        const pRows = XLSX.utils.sheet_to_json(wb.Sheets[ps]);
        const vRows = XLSX.utils.sheet_to_json(wb.Sheets[vs]);
        const newP = {}, newV = {};
        pRows.forEach(r => {
          const n = (r['Product Name'] || '').trim(); if (!n) return;
          newP[n] = { n, c: r['Category']||'', i: r['Ingredients']||'', icon: r['Icon']||'🌿', desc: r['Description']||'',
            e:r['Energy_kcal']||0, p:r['Protein_g']||0, cb:r['Carbohydrate_g']||0, ts:r['Total_Sugars_g']||0,
            as:r['Added_Sugars_g']||0, tf:r['Total_Fat_g']||0, sf:r['Saturated_Fat_g']||0, tr:r['Trans_Fat_g']||0,
            ch:r['Cholesterol_mg']||0, so:r['Sodium_mg']||0 };
          newV[n] = [];
        });
        vRows.forEach(r => {
          const n = (r['Product Name']||'').trim(); if (!newV[n]) return;
          newV[n].push({ d:r['Weight_Display']||'', g:parseFloat(r['Weight_g'])||0,
            oz:r['Weight_oz']||'', m:parseFloat(r['MRP'])||0, bn:r['Batch_No']||'' });
        });
        ST.db = { p: newP, v: newV };
        const count = Object.keys(newP).length;
        const badge = $('excel-badge');
        if (badge) { badge.innerHTML = `<span>✓ ${count} products loaded from Excel — ready to search</span>`; badge.style.display = 'flex'; }
        const si = $('si'); if (si) { si.disabled = false; si.placeholder = `Search ${count} products...`; }
        clearProduct();
        populateCategories();
        showToast(`✓ ${count} products loaded from Excel`, 'success');
      } catch (err) { showToast('Error reading Excel: ' + err.message, 'error'); }
    };
    r.readAsBinaryString(f);
  });
}

function attachDragDrop() {
  const area = $('excel-drop-area'); if (!area) return;
  area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = 'var(--red)'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', e => {
    e.preventDefault(); area.style.borderColor = '';
    const f = e.dataTransfer.files[0];
    if (f) {
      const dt = new DataTransfer(); dt.items.add(f);
      $('ef').files = dt.files;
      $('ef').dispatchEvent(new Event('change'));
    }
  });
}

/* ─── Preview Rendering ─── */
function render() {
  if (ST.mode === 'manual') { renderManual(); return; }
  renderFront(); renderBack();
}

function renderFront() {
  const fp = $('fp'); if (!fp) return;
  if (!ST.prod) { fp.innerHTML = '<span class="emptylbl">Select a product to preview</span>'; return; }
  if (ST.mode === 'yellow365') {
    if (ST.vi < 0) { fp.innerHTML = '<span class="emptylbl">Select product + pack size to preview</span>'; return; }
    const bn = gv('bn'), pd = fmtDate(gv('pd')), bb = getBBValue('bb-sel','bb');
    if (typeof generateYellowCanvas === 'function') {
      const c = generateYellowCanvas(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb);
      c.style.width = '100%';
      c.style.height = 'auto'; // allow it to scale naturally based on width
      c.style.objectFit = 'contain';
      fp.innerHTML = '';
      fp.appendChild(c);
    }
    return;
  }

  // Standard front label (html preview fallback if canvas is not used)
    const isJain = ST.prod.n.toUpperCase().includes('JAIN');
    const jainSub = isJain
      ? `<div style="font-family:'Arial Black',Arial,sans-serif;font-weight:900;font-size:0.55em;text-align:center;text-transform:uppercase;letter-spacing:0.5pt;margin-top:2px;line-height:1;">No Onion No Garlic</div>`
      : '';
    fp.innerHTML = `<div class="fl-wrap"><div class="fl-name" id="fl-name-el">${ST.prod.n.toUpperCase()}</div>${jainSub}</div>`;
    requestAnimationFrame(fitFrontName);
}

function renderBack() {
  const bp = $('bp'); if (!bp) return;
  if (!ST.prod || ST.vi < 0) { bp.innerHTML = '<span class="emptylbl">Select product + pack size to preview</span>'; return; }
  const bn = gv('bn'), pd = fmtDate(gv('pd')), bb = getBBValue('bb-sel','bb');

  if (ST.mode === 'new32') {
    if (typeof generateNew32Canvas === 'function') {
      const c = generateNew32Canvas(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb);
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.objectFit = 'contain';
      bp.innerHTML = '';
      bp.appendChild(c);
    }
    return;
  }

  bp.innerHTML = buildBackHTML(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb);
  requestAnimationFrame(() => { fitBackTitle(); setTimeout(() => renderBarcode(ST.prod), 30); });
}

/* Alias — HTML uses oninput="manualRender()" */
function manualRender() { renderManual(); }

function renderManual() {
  const fp = $('fp'), bp = $('bp');
  const mn = gv('m-name');
  if (!fp || !bp) return;
  if (!mn) {
    fp.innerHTML = '<span class="emptylbl">Enter product name to preview</span>';
    bp.innerHTML = '<span class="emptylbl">Fill in details to preview</span>';
    return;
  }
  
  if (typeof generateFrontCanvas === 'function') {
    const previewCanvas = generateFrontCanvas(mn);
    previewCanvas.style.width = '100%';
    previewCanvas.style.height = '100%';
    previewCanvas.style.objectFit = 'contain';
    previewCanvas.style.display = 'block';
    fp.innerHTML = '';
    fp.appendChild(previewCanvas);
  } else {
    fp.innerHTML = `<div class="fl-wrap"><div class="fl-name" id="fl-name-el">${mn.toUpperCase()}</div></div>`;
    requestAnimationFrame(fitFrontName);
  }
  const vg = gn('m-vg');
  if (vg > 0) {
    const p = {
      n: mn, c: gv('m-cat'), i: gv('m-ingr') || '—',
      e:gn('m-e'), p:gn('m-pr'), cb:gn('m-cb'), ts:gn('m-ts'), as:gn('m-as'),
      tf:gn('m-tf'), sf:gn('m-sf'), tr:gn('m-tr'), ch:gn('m-ch'), so:gn('m-so')
    };
    const vd = gv('m-vd') || vg + 'g';
    const voz = gv('m-voz') || (vg * 0.03527).toFixed(2) + 'oz';
    const v = { d: vd, g: vg, oz: voz, m: gn('m-mrp') };
    const bn = gv('m-bn'), pd = fmtDate(gv('m-pd')), bb = getBBValue('m-bb-sel','m-bb');
    
    if (typeof generateBackCanvas === 'function') {
      const bCanvas = generateBackCanvas(p, v, bn, pd, bb);
      bCanvas.style.width = '100%';
      bCanvas.style.height = '100%';
      bCanvas.style.objectFit = 'contain';
      bCanvas.style.display = 'block';
      bCanvas.style.boxShadow = '0 0 5px rgba(0,0,0,0.1)';
      bp.innerHTML = '';
      bp.appendChild(bCanvas);
    } else {
      bp.innerHTML = buildBackHTML(p, v, bn, pd, bb);
      requestAnimationFrame(() => { fitBackTitle(); renderBarcode(p); });
    }
  } else {
    bp.innerHTML = '<span class="emptylbl">Enter weight (g) to preview back label</span>';
  }
}

function buildBackHTML(p, v, bn, pd, bb) {
  const mrp = (parseFloat(v.m)||0) * 2;  // ×2: pricelist is wholesale 1kg, retail is 2×
  const pg = (mrp / (parseFloat(v.g) || 1)).toFixed(2);
  const ns = getNutrition(p);
  const isJain = p.n.toUpperCase().includes('JAIN');
  const isBlended = (p.c || '').toLowerCase().includes('blended');
  // Strip "(12 Months)" suffix from bb
  const bbClean = (bb || '—').replace(/\s*\(.*$/, '');

  const jainLine = isJain
    ? `<div style="font-family:'Arial Black',Arial,sans-serif;font-weight:900;font-size:0.72em;text-align:center;text-transform:uppercase;letter-spacing:0.5pt;margin-top:1px;">No Onion No Garlic</div>`
    : '';

  const isSeasoning = (p.c || '').toLowerCase().includes('seasoning');
  const catLine = isSeasoning ? `<div class="blcat">SEASONING</div>` : '';

  // Use p.sc from excel, or fallback to default text if blended
  let blendedBoxText = '';
  if (p.sc) {
    blendedBoxText = p.sc;
  } else if (isBlended) {
    blendedBoxText = 'Mixed Masala Powder, Spices content more than 85%, salt content more than 5%';
  }
  
  const blendedBox = blendedBoxText
    ? `<div style="border:0.8pt solid #000;padding:1mm 1.5mm;margin:1mm 0;font-size:0.52em;text-align:center;line-height:1.3;font-weight:600;">${blendedBoxText}</div>`
    : '';

  return `<div class="bl-wrap">
    <div class="bltit" id="bltit-el">${p.n.toUpperCase()}</div>
    ${jainLine}
    ${catLine}
    ${blendedBox}
    <hr class="blhr">
    <div class="blsec">INGREDIENTS :-</div>
    <div class="blingr">(In Descending Order By Weight) ${p.i || '—'}</div>
    <div class="blnt">NUTRITIONAL INFORMATION</div>
    <div class="blns">Approximate Composition per 100 g</div>
    <div class="blnb">${ns}</div>
    <div class="blsp"></div>
    <div class="blr">NET WEIGHT : ${v.d} (${v.oz})</div>
    <div class="blr">BATCH NO : ${bn || '—'}</div>
    <div class="blr">DATE OF PACKING : ${pd}</div>
    <div class="blr">BEST BEFORE : ${bbClean}</div>
    <div class="blmrp">MRP : ₹ ${mrp}/-</div>
    <div class="bltax">(INCL. OF ALL TAXES)</div>
    <div class="blper">FOR 1g = Rs ${pg}</div>
    <div class="bl-barcode-wrap"><svg id="bl-barcode-svg"></svg></div>
  </div>`;
}


/* ─── Utilities ─── */
function splitName(n) {
  const w = (n||'').trim().split(/\s+/), m = Math.ceil(w.length/2);
  return { a: w.slice(0,m).join(' '), b: w.slice(m).join(' ') };
}

/* ─── Barcode Renderer (JsBarcode) ─── */
function renderBarcode(p) {
  const svg = document.getElementById('bl-barcode-svg');
  if (!svg || typeof JsBarcode === 'undefined') return;
  // Use product barcode if available, else placeholder
  const code = (p && p.barcode) ? String(p.barcode) : '8905606000007';
  try {
    JsBarcode(svg, code, {
      format: 'CODE128',   // CODE128 accepts any string — no checksum requirement
      width: 1.4,
      height: 28,
      displayValue: true,
      fontSize: 7,
      margin: 1,
      textMargin: 1,
      font: 'Arial',
    });
  } catch(e) { console.warn('Barcode err:', e); }
}

/* Auto-scale front label name to fit container */
function fitFrontName() {
  const el = document.getElementById('fl-name-el');
  const wrap = el && el.closest('.fl-wrap');
  if (!el || !wrap) return;
  let fs = 35;
  el.style.fontSize = fs + 'px';
  el.style.lineHeight = '0.9';
  const mW = wrap.clientWidth  - 20;
  const mH = wrap.clientHeight - 10;
  while ((el.scrollWidth > mW || el.scrollHeight > mH) && fs > 9) {
    el.style.fontSize = (--fs) + 'px';
  }
}

/* Auto-scale back label title to fit container */
function fitBackTitle() {
  const el = document.getElementById('bltit-el');
  const wrap = el && el.closest('.bl-wrap');
  if (!el || !wrap) return;
  let fs = 28;
  el.style.fontSize = fs + 'px';
  el.style.lineHeight = '0.9';
  const mW = wrap.clientWidth  - 10;
  const mH = wrap.clientHeight * 0.20; // max ~20% of label height for title
  while ((el.scrollWidth > mW || el.scrollHeight > mH) && fs > 7) {
    el.style.fontSize = (--fs) + 'px';
  }
}

function getNutrition(p) {
  return [
    ['Energy',(p.e||'—')+'kcal'],['Protein',(p.p||'—')+'g'],
    ['Carbohydrate',(p.cb||'—')+'g'],['Total Sugars',(p.ts||'—')+'g'],
    ['Added Sugars',(p.as||'—')+'g'],['Total Fat',(p.tf||'—')+'g'],
    ['Saturated Fat',(p.sf||'—')+'g'],['Trans Fat',(p.tr||'—')+'g'],
    ['Cholesterol',(p.ch||'—')+'mg'],['Sodium',(p.so||'—')+'mg']
  ].map(x => `${x[0]} (${x[1]})`).join(', ');
}

function clearAll() {
  clearProduct();
  ['bn','pd','bb'].forEach(id => { const el=$(id); if(el) el.value=''; });
  setTodayDates();
}
/* ─── Category Filter ─── */
function populateCategories() {
  const sel = $('cat-sel'); if (!sel) return;
  const cats = [...new Set(
    Object.values(ST.db.p).map(p => p.c).filter(Boolean)
  )].sort();
  // Keep first option (All Categories)
  sel.innerHTML = '<option value="">All Categories</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

function filterByCategory() {
  const si = $('si');
  if (si) { si.value = ''; si.focus(); }
  showAllProducts();
}


/* ── Copies helper ── */
function getCopies() {
  const d = document.getElementById('print-copies');
  const m = document.getElementById('print-copies-m');
  // Use whichever is visible; if both visible, prefer desktop
  let el = d;
  if (d && !d.offsetParent && m && m.offsetParent) el = m;
  else if (m && !d) el = m;
  const n = parseInt(el && el.value, 10);
  return (n && n > 0) ? Math.min(n, 50) : 1;
}

// Keep both copies inputs in sync
document.addEventListener('input', function(e) {
  if (e.target.id === 'print-copies') {
    var m = document.getElementById('print-copies-m');
    if (m) m.value = e.target.value;
  } else if (e.target.id === 'print-copies-m') {
    var d = document.getElementById('print-copies');
    if (d) d.value = e.target.value;
  }
});

function pF() {
  let pname;
  if (ST.mode === 'manual') { pname = gv('m-name'); }
  else { if (!ST.prod) { showToast('Select a product first', 'error'); return; } pname = ST.prod.n; }
  if (!pname) { showToast('No product name entered', 'error'); return; }
  const name = pname.toUpperCase();
  const copies = getCopies();


  if (ST.mode === 'yellow365') {
    if (ST.vi < 0) { showToast('Select pack size first', 'error'); return; }
    const bn = gv('bn'), pd = fmtDate(gv('pd')), bb = getBBValue('bb-sel','bb');
    if (typeof qzPrintYellow === 'function') {
      qzPrintYellow(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb, copies).then(done => {
        if (!done) {
          showToast('Testing preview mode. QZ Tray is offline.', 'info');
          if (typeof buildYellowTSPL === 'function') buildYellowTSPL(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb, copies, false);
        }
      }).catch(() => {
        showToast('Testing preview mode. QZ Tray is offline.', 'info');
        if (typeof buildYellowTSPL === 'function') buildYellowTSPL(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb, copies, false);
      });
    }
    return;
  }

  // ── Try QZ Tray first (direct RAW print) ──
  if (typeof qzPrintFront === 'function') {
    qzPrintFront(name, copies).then(function(done) {
      if (!done) {
        showToast('Testing preview mode. QZ Tray is offline.', 'info');
        if (typeof buildFrontTSPL === 'function') buildFrontTSPL(name, copies);
      }
    }).catch(function() { 
      showToast('Testing preview mode. QZ Tray is offline.', 'info');
      if (typeof buildFrontTSPL === 'function') buildFrontTSPL(name, copies);
    });
    return;
  }
}


function pB() {
  let p, v, bn, pd, bb;
  if (ST.mode === 'manual') {
    const mn = gv('m-name'); if (!mn) { showToast('Enter product name', 'error'); return; }
    const vg = gn('m-vg'); if (!vg) { showToast('Enter weight in grams', 'error'); return; }
    p = {
      n: mn, c: gv('m-cat'), i: gv('m-ingr') || '—',
      e:gn('m-e'), p:gn('m-pr'), cb:gn('m-cb'), ts:gn('m-ts'), as:gn('m-as'),
      tf:gn('m-tf'), sf:gn('m-sf'), tr:gn('m-tr'), ch:gn('m-ch'), so:gn('m-so')
    };
    v = { d: gv('m-vd') || vg + 'g', g: vg, oz: gv('m-voz') || (vg*0.03527).toFixed(2)+'oz', m: gn('m-mrp') };
    bn = gv('m-bn'); pd = fmtDate(gv('m-pd')); bb = getBBValue('m-bb-sel','m-bb');
  } else {
    if (!ST.prod) { showToast('Select a product first', 'error'); return; }
    if (ST.vi < 0) { showToast('Select a pack size', 'error'); return; }
    p = ST.prod; v = ST.db.v[p.n][ST.vi];
    bn = gv('bn'); pd = fmtDate(gv('pd')); bb = getBBValue('bb-sel','bb');
  }
  const copies = getCopies();

  if (ST.mode === 'new32') {
    if (typeof qzPrintNew32 === 'function') {
      qzPrintNew32(p, v, bn, pd, bb, copies).then(function(done) {
        if (!done) {
          showToast('Testing preview mode. QZ Tray is offline.', 'info');
          if (typeof buildNew32TSPL === 'function') buildNew32TSPL(p, v, bn, pd, bb, copies);
        }
      }).catch(function() { 
        showToast('Testing preview mode. QZ Tray is offline.', 'info');
        if (typeof buildNew32TSPL === 'function') buildNew32TSPL(p, v, bn, pd, bb, copies);
      });
    }
    return;
  }

  // ── Try QZ Tray first (direct RAW print) ──
  if (typeof qzPrintBack === 'function') {
    qzPrintBack(p, v, bn, pd, bb, copies).then(function(done) {
      if (!done) {
        showToast('Testing preview mode. QZ Tray is offline.', 'info');
        if (typeof buildBackTSPL === 'function') buildBackTSPL(p, v, bn, pd, bb, copies);
      }
    }).catch(function() { 
      showToast('Testing preview mode. QZ Tray is offline.', 'info');
      if (typeof buildBackTSPL === 'function') buildBackTSPL(p, v, bn, pd, bb, copies);
    });
    return;
  }
}

