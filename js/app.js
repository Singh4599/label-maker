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

  // DB and Excel both use mode-db panel
  $('mode-db').classList.toggle('active', mode === 'db' || mode === 'excel');
  $('mode-manual').classList.toggle('active', mode === 'manual');

  // Excel strip visibility
  const strip = $('excel-strip');
  if (strip) strip.style.display = mode === 'excel' ? 'block' : 'none';

  // Update step description for excel mode
  const desc = $('step1-desc');
  if (desc) {
    desc.textContent = mode === 'excel'
      ? 'Search from your uploaded Excel product data'
      : 'Search from our 365 Spicery product library';
  }

  // Reset if switching from manual
  if (mode !== 'manual') {
    // Keep ST.db as is (loaded DB or Excel), but don't clear product selection
  }

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
  bb.value = d.toISOString().split('T')[0];
}

function calcManualBestBefore() {
  const pd = $('m-pd'), bbSel = $('m-bb-sel'), bb = $('m-bb');
  if (!pd || !bbSel || !bb || bbSel.value === 'custom' || !pd.value) return;
  const d = new Date(pd.value);
  d.setMonth(d.getMonth() + parseInt(bbSel.value));
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
  fp.innerHTML = `<div class="fl-wrap"><div class="fl-name" id="fl-name-el">${ST.prod.n.toUpperCase()}</div></div>`;
  requestAnimationFrame(fitFrontName);
}

function renderBack() {
  const bp = $('bp'); if (!bp) return;
  if (!ST.prod || ST.vi < 0) { bp.innerHTML = '<span class="emptylbl">Select product + pack size to preview</span>'; return; }
  const bn = gv('bn'), pd = fmtDate(gv('pd')), bb = getBBValue('bb-sel','bb');
  bp.innerHTML = buildBackHTML(ST.prod, ST.db.v[ST.prod.n][ST.vi], bn, pd, bb);
  requestAnimationFrame(fitBackTitle);
}

function renderManual() {
  const fp = $('fp'), bp = $('bp');
  const mn = gv('m-name');
  if (!fp || !bp) return;
  if (!mn) {
    fp.innerHTML = '<span class="emptylbl">Enter product name to preview</span>';
    bp.innerHTML = '<span class="emptylbl">Fill in details to preview</span>';
    return;
  }
  fp.innerHTML = `<div class="fl-wrap"><div class="fl-name" id="fl-name-el">${mn.toUpperCase()}</div></div>`;
  requestAnimationFrame(fitFrontName);
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
    bp.innerHTML = buildBackHTML(p, v, bn, pd, bb);
    requestAnimationFrame(fitBackTitle);
  } else {
    bp.innerHTML = '<span class="emptylbl">Enter weight (g) to preview back label</span>';
  }
}

function buildBackHTML(p, v, bn, pd, bb) {
  const mrp = parseFloat(v.m)||0, pg = (mrp/(parseFloat(v.g)||1)).toFixed(2);
  const ns = getNutrition(p);
  return `<div class="bl-wrap">
    <div class="bltit" id="bltit-el">${p.n.toUpperCase()}</div>
    <div class="blcat">Category - ${p.c || '—'}</div>
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
    <div class="blr">BEST BEFORE : ${bb}</div>
    <div class="blmrp">MRP : ₹ ${mrp}/-</div>
    <div class="bltax">(INCL. OF ALL TAXES)</div>
    <div class="blper">FOR 1g = Rs ${pg}</div>
  </div>`;
}

/* ─── Utilities ─── */
function splitName(n) {
  const w = (n||'').trim().split(/\s+/), m = Math.ceil(w.length/2);
  return { a: w.slice(0,m).join(' '), b: w.slice(m).join(' ') };
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


function getCopies() {
  const el = document.getElementById('print-copies') || document.getElementById('print-copies-m');
  const n = parseInt(el && el.value, 10);
  return (n && n > 0) ? Math.min(n, 50) : 1;
}

function pF() {
  let pname;
  if (ST.mode === 'manual') { pname = gv('m-name'); }
  else { if (!ST.prod) { showToast('Select a product first', 'error'); return; } pname = ST.prod.n; }
  if (!pname) { showToast('No product name entered', 'error'); return; }
  const name = pname.toUpperCase();
  const copies = getCopies();

  /* ── FRONT LABEL: 61.5mm × 25mm (TSC TE244)
   * Each copy is a separate page. Chrome copies = 1 always.
   * Printer gets N pages, each = 1 label. No blank pages. */
  const css = [
    '@page{size:61.5mm 25mm;margin:0}',
    '*{margin:0;padding:0;box-sizing:border-box}',
    'html,body{width:61.5mm;margin:0;padding:0;overflow:hidden;background:#fff}',
    '.w{width:61.5mm;height:25mm;display:flex;align-items:center;justify-content:center;padding:1mm 2mm;overflow:hidden;page-break-after:always}',
    '.w:last-child{page-break-after:avoid}',
    '.n{font-family:"Arial Black","Arial Bold",Arial,sans-serif;font-weight:900;font-size:23pt;',
      'text-align:center;line-height:0.9;text-transform:uppercase;color:#000;',
      'letter-spacing:-0.5pt;width:100%;word-break:break-word}'
  ].join('');

  /* Build N identical label divs */
  let pages = '';
  for (let c = 0; c < copies; c++) {
    pages += '<div class="w"><div class="n" id="pn'+c+'">'+name+'</div></div>';
  }

  /* Scaler: shrink font on ALL copies, then print */
  const headScript = '<scr'+'ipt>'+
    'window.onload=function(){'+
      'var els=document.querySelectorAll(".n");'+
      'for(var j=0;j<els.length;j++){'+
        'var el=els[j],w=el.parentElement,'+
            'mW=w.offsetWidth-4,mH=w.offsetHeight-2,'+
            'fs=23,i=0;'+
        'el.style.fontSize=fs+"pt";'+
        'while((el.scrollWidth>mW||el.scrollHeight>mH)&&fs>4&&i++<120){'+
          'el.style.fontSize=(fs-=0.5)+"pt";'+
        '}'+
      '}'+
      'setTimeout(function(){window.print();},500);'+
    '};'+
  '<\/scr'+'ipt>';

  const win = window.open('', 'fp_'+Date.now(), 'width=250,height=120');
  win.document.open();
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+'</style>'+headScript+'</head>'+
    '<body>'+pages+'</body></html>'
  );
  win.document.close();
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
  const mrp = parseFloat(v.m)||0, pg = (mrp/(parseFloat(v.g)||1)).toFixed(2);
  const ns = getNutrition(p);

  /* ── BACK LABEL: 47.5mm × 90mm (TSC TE244)
   * Each copy is a separate page. Chrome copies = 1 always. */
  const css = [
    '@page{size:47.5mm 90mm;margin:0}',
    '*{margin:0;padding:0;box-sizing:border-box}',
    'html,body{width:47.5mm;margin:0;padding:0;overflow:hidden;background:#fff;font-family:Arial,sans-serif}',
    '.L{width:47.5mm;height:90mm;padding:2mm 2.5mm 1.5mm 2.5mm;display:flex;flex-direction:column;',
      'justify-content:space-between;color:#000;font-size:9pt;box-sizing:border-box;overflow:hidden;page-break-after:always}',
    '.L:last-child{page-break-after:avoid}',
    '.ti{font-family:"Arial Black",Arial,sans-serif;font-weight:900;font-size:1.45em;',
      'text-align:center;line-height:0.92;text-transform:uppercase;word-break:break-word}',
    '.ca{font-size:0.6em;text-align:center;font-weight:600}',
    'hr{border:none;border-top:0.5pt solid #666;margin:0}',
    '.se{font-size:0.72em;font-weight:700}',
    '.in{font-size:0.54em;line-height:1.25}',
    '.nt{font-size:0.68em;font-weight:900;text-align:center;font-family:"Arial Black",Arial,sans-serif;text-transform:uppercase}',
    '.ns{font-size:0.5em;text-align:center;font-style:italic;font-weight:600}',
    '.nb{border:0.7pt solid #000;padding:0.5mm 1mm;font-size:0.48em;line-height:1.3}',
    '.r{font-size:0.68em;font-weight:700;line-height:1.35}',
    '.mrp{font-size:1.05em;font-weight:900;font-family:"Arial Black",Arial,sans-serif}',
    '.tx{font-size:0.46em;font-weight:600}',
    '.pg{font-size:0.56em;font-weight:700}'
  ].join('');

  /* Build N identical back-label pages */
  const copies = getCopies();
  const oneLabel =
    '<div class="ti">'+p.n.toUpperCase()+'</div>'+
    '<div class="ca">Category - '+(p.c||'—')+'</div>'+
    '<hr>'+
    '<div class="se">INGREDIENTS :-</div>'+
    '<div class="in">(In Descending Order By Weight) '+(p.i||'—')+'</div>'+
    '<div class="nt">NUTRITIONAL INFORMATION</div>'+
    '<div class="ns">Approximate Composition per 100 g</div>'+
    '<div class="nb">'+ns+'</div>'+
    '<div class="r">NET WEIGHT : '+v.d+' ('+v.oz+')</div>'+
    '<div class="r">BATCH NO : '+(bn||'—')+'</div>'+
    '<div class="r">DATE OF PACKING : '+pd+'</div>'+
    '<div class="r">BEST BEFORE : '+bb+'</div>'+
    '<div class="mrp">MRP : ₹ '+mrp+'/-</div>'+
    '<div class="tx">(INCL. OF ALL TAXES)</div>'+
    '<div class="pg">FOR 1g = Rs '+pg+'</div>';

  let pages = '';
  for (let c = 0; c < copies; c++) {
    pages += '<div class="L">'+oneLabel+'</div>';
  }

  /* Scaler: adjust font on ALL .L copies so content fills 90mm height */
  const headScript2 = '<scr'+'ipt>'+
    'window.onload=function(){'+
      'var Ls=document.querySelectorAll(".L");'+
      'for(var j=0;j<Ls.length;j++){'+
        'var L=Ls[j],bH=L.offsetHeight,fs=9,i=0;'+
        'while(L.scrollHeight<=bH && fs<22 && i++<130){'+
          'fs+=0.2; L.style.fontSize=fs+"pt";'+
        '}'+
        'while(L.scrollHeight>bH && fs>4 && i++<200){'+
          'fs-=0.2; L.style.fontSize=fs+"pt";'+
        '}'+
      '}'+
      'setTimeout(function(){window.print();},600);'+
    '};'+
  '<\/scr'+'ipt>';

  const win2 = window.open('', 'bp_'+Date.now(), 'width=200,height=380');
  win2.document.open();
  win2.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+'</style>'+headScript2+'</head>'+
    '<body>'+pages+'</body></html>'
  );
  win2.document.close();
}

function openPrint(css, body) {
  const w = window.open('', '_blank', 'width=520,height=640');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${body}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 700);
}
