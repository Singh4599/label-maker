'use strict';
// ═══════════════════════════════════════════════════════════════════════
// 365 Spicery — Label Print Records
// Firebase-only (real-time) · No IndexedDB · Date nav + Type tabs
// ═══════════════════════════════════════════════════════════════════════

let _recAll  = [];        // All records from Firestore (latest first)
let _recTab  = 'ALL';     // Active sticker-type tab
let _recDate = new Date(); // Active date (Date object) — default: today
let _fbReady = false;

// ── Constants ──
const STICKER_LABELS = {
  'db':       '365 Spicery',
  'dukan':    'Dukan Bai',
  'new32':    '32×25 Label',
  'parties':  'Parties',
  'internal': 'Internal',
  'yellow365':'Yellow 365',
  'manual':   'Manual',
  'excel':    'Excel Import',
};

// ── Helpers ──
const pad = n => String(n).padStart(2, '0');

function fmtDayStr(d) {
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`;
}
function todayStr() { return fmtDayStr(new Date()); }
function isSameDay(d1, d2) {
  return d1.getFullYear()===d2.getFullYear() &&
         d1.getMonth()===d2.getMonth() &&
         d1.getDate()===d2.getDate();
}
function navDateLabel(d) {
  const t = new Date();
  const y = new Date(Date.now()-86400000);
  const short = d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  if (isSameDay(d,t)) return `${short} &nbsp;·&nbsp; <strong>TODAY</strong>`;
  if (isSameDay(d,y)) return `${short} &nbsp;·&nbsp; YESTERDAY`;
  return short;
}
function escHtml(s) {
  if (!s) return '—';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function getStickerLabel(type) { return STICKER_LABELS[type] || type || 'Unknown'; }

// ── Sidebar badge ──
function updateBadge(count) {
  const b = document.getElementById('rec-sidebar-badge');
  if (b) { b.textContent = count; b.style.display = count > 0 ? '' : 'none'; }
}

// ── Cloud badge ──
function updateCloudBadge(connected) {
  const b = document.getElementById('rec-cloud-badge');
  if (!b) return;
  b.innerHTML = connected ? '🟢 Live Cloud' : '🔴 Offline';
  b.style.color = connected ? '#166534' : '#dc2626';
}

// ── Filtered records ──
function getFiltered() {
  const dateStr = fmtDayStr(_recDate);
  return _recAll.filter(r => {
    if (_recTab !== 'ALL' && r.stickerType !== _recTab) return false;
    if (r.date !== dateStr) return false;
    return true;
  });
}

// ── Unique sticker types from all records ──
function getTypes() {
  const seen = new Set();
  return _recAll.filter(r => {
    if (seen.has(r.stickerType)) return false;
    seen.add(r.stickerType); return true;
  }).map(r => r.stickerType);
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════
const DL_ICON = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 2v8M4 7l4 4 4-4"/><path d="M2 13h12"/></svg>`;

window.renderRecordsPanel = function() {
  const root = document.getElementById('rec-view-root');
  if (!root) return;

  // Clear placeholder inline styles
  root.removeAttribute('style');

  const filtered = getFiltered();
  const types    = getTypes();
  const isToday  = (fmtDayStr(_recDate) === todayStr());

  // Stats
  const copies  = filtered.reduce((s,r) => s+(r.copies||1), 0);
  const weightG = filtered.filter(r=>r.labelSide==='back').reduce((s,r) =>
    s + (r.totalWeightG || ((r.weightG||0)*(r.copies||1))), 0);
  const weightKg = weightG > 0 ? (weightG/1000).toFixed(1)+' kg' : null;

  // Header action button — context-aware
  const isAllTab = (_recTab === 'ALL');
  const headerBtn = isAllTab
    ? `<button class="rec-dl-all rec-dl-all-green" onclick="exportRecordsExcel()" title="Download all records as Excel">
        ${DL_ICON} Export All
       </button>`
    : `<button class="rec-dl-all rec-dl-all-red" onclick="exportRecordsExcel('${_recTab}')" title="Download ${getStickerLabel(_recTab)} records">
        ${DL_ICON} Download ${getStickerLabel(_recTab)}
       </button>`;

  root.innerHTML = `
    <div class="rec-pg">

      <!-- Header -->
      <div class="rec-hd">
        <div class="rec-hd-left">
          <div class="rec-eyebrow">Print Records</div>
          <div class="rec-hd-meta">🔴 Live · Saved only when QZ Tray confirms print</div>
        </div>
        <div class="rec-hd-right">
          ${headerBtn}
        </div>
      </div>

      <!-- Type filter tabs -->
      <div class="rec-tabs-row">
        <button class="rec-tab ${isAllTab?'rec-tab-active':''}" onclick="setRecTab('ALL')">All</button>
        ${types.map(t => `
          <div class="rec-tab-grp ${_recTab===t?'rec-tab-grp-active':''}">
            <button class="rec-tab-name" onclick="setRecTab('${t}')">${getStickerLabel(t)}</button>
            <button class="rec-tab-dl" onclick="exportRecordsExcel('${t}')" title="Download ${getStickerLabel(t)} Excel">${DL_ICON}</button>
          </div>
        `).join('')}
      </div>

      <!-- Date nav -->
      <div class="rec-date-nav">
        <button class="rec-date-arr" onclick="navDate(-1)">&#8249;</button>
        <div class="rec-date-center">
          <span class="rec-date-label">${navDateLabel(_recDate)}</span>
        </div>
        <button class="rec-date-arr" onclick="navDate(1)" ${isToday?'disabled':''}>&#8250;</button>
        ${!isToday ? `<button class="rec-date-today-btn" onclick="goToday()">Today</button>` : ''}
      </div>

      <!-- Stats bar -->
      <div class="rec-stats-bar">
        <span class="rec-stat-pill"><strong>${filtered.length}</strong> records</span>
        ${copies > 0 ? `<span class="rec-stat-sep">·</span><span class="rec-stat-pill"><strong>${copies}</strong> labels</span>` : ''}
        ${weightKg ? `<span class="rec-stat-sep">·</span><span class="rec-stat-pill"><strong>${weightKg}</strong></span>` : ''}
        <button class="rec-clear-all-btn" onclick="confirmClearAll()">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          Clear All
        </button>
      </div>

      <!-- Table -->
      <div class="rec-table-wrap">
        ${buildTableHTML(filtered)}
      </div>

    </div>
  `;
};




function buildTableHTML(filtered) {
  if (filtered.length === 0) {
    const noData = _recAll.length === 0;
    return `<div class="rec-empty">
      <div class="rec-empty-icon">${noData ? '📡' : '🔍'}</div>
      <div class="rec-empty-title">${noData ? 'No records yet' : 'No records for this date'}</div>
      <div class="rec-empty-sub">${noData
        ? 'Records appear automatically when QZ Tray sends a print job.'
        : 'Try navigating to a different date or switching sticker type.'
      }</div>
    </div>`;
  }

  const rows = filtered.map((r, i) => {

    const isFront = r.labelSide === 'front';
    const sizeCell = isFront
      ? '<span class="rec-badge-front">FRONT</span>'
      : `<span class="rec-badge-size">${escHtml(r.packSize||'—')}</span>`;
    const tw = r.totalWeightG || ((r.weightG||0)*(r.copies||1));
    const totalCell = isFront
      ? '<span class="td-muted">—</span>'
      : tw > 0 ? `<strong>${tw.toLocaleString('en-IN')}g</strong>` : '—';
    const docId = escHtml(String(r._docId || r.timestamp));

    return `<tr>
      <td class="td-sr" data-label="#">${filtered.length - i}</td>
      <td class="td-date col-time" data-label="Date">${escHtml(r.date)}</td>
      <td class="td-time col-time" data-label="Time">${escHtml(r.time)}</td>
      <td class="td-name" data-label="Product">${escHtml(r.productName)}</td>
      <td class="td-batch col-batch" data-label="Batch"><code>${escHtml(r.batchNo)}</code></td>
      <td class="td-size" data-label="Size">${sizeCell}</td>
      <td class="td-copies" data-label="Copies">${r.copies||1}</td>
      <td class="td-total" data-label="Weight">${totalCell}</td>
      <td class="td-del"><button class="rec-del-btn" onclick="deleteRecordById('${docId}')" title="Delete">✕</button></td>
    </tr>`;

  }).join('');

  return `<table class="rec-table">
    <thead>
      <tr>
        <th class="th-sr">#</th>
        <th>Date</th>
        <th class="col-time">Time</th>
        <th>Product Name</th>
        <th>Batch Code</th>
        <th>Size / Label</th>
        <th class="th-ctr">Copies</th>
        <th>Total Weight</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════════════════════
window.setRecTab = function(tab) {
  _recTab = tab;
  window.renderRecordsPanel();
};

window.navDate = function(dir) {
  const d = new Date(_recDate);
  d.setDate(d.getDate() + dir);
  // Don't go past today
  if (d > new Date()) return;
  _recDate = d;
  window.renderRecordsPanel();
};

window.goToday = function() {
  _recDate = new Date();
  window.renderRecordsPanel();
};

// ── Delete ──
window.deleteRecordById = function(docId) {
  if (!confirm('Delete this print record?')) return;
  if (window.LabelFirebase && window.LabelFirebase.delete) {
    window.LabelFirebase.delete(docId);
    // Optimistic local remove
    _recAll = _recAll.filter(r => String(r._docId || r.timestamp) !== String(docId));
    updateBadge(_recAll.length);
    window.renderRecordsPanel();
  }
};

window.confirmClearAll = function() {
  const count = _recAll.length;
  if (!count) return alert('No records to clear.');
  if (!confirm(`Delete ALL ${count} records? This cannot be undone!`)) return;
  // Delete from Firebase one by one
  if (window.LabelFirebase && window.LabelFirebase.delete) {
    let done = 0;
    _recAll.forEach(r => {
      const id = String(r._docId || r.timestamp);
      window.LabelFirebase.delete(id).finally(() => {
        done++;
        if (done >= _recAll.length) {
          _recAll = [];
          updateBadge(0);
          window.renderRecordsPanel();
        }
      });
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// TRACK PRINT — called from app.js ONLY when QZ done===true
// ═══════════════════════════════════════════════════════════════════════
window.trackPrint = async function(opts) {
  const now   = new Date();
  const ts    = now.getTime();
  const dateStr = fmtDayStr(now);
  const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

  const record = {
    timestamp:    ts,
    _docId:       String(ts),
    date:         dateStr,
    time:         timeStr,
    stickerType:  opts.stickerType || 'unknown',
    stickerLabel: getStickerLabel(opts.stickerType || 'unknown'),
    labelSide:    opts.labelSide || 'front',
    productName:  (opts.productName || '').toUpperCase(),
    packSize:     opts.packSize || '—',
    weightG:      parseFloat(opts.weightG) || 0,
    totalWeightG: (parseFloat(opts.weightG)||0) * (opts.copies||1),
    mrp:          opts.mrp || 0,
    batchNo:      opts.batchNo || '—',
    mfgDate:      opts.mfgDate || '—',
    bestBefore:   opts.bestBefore || '—',
    copies:       opts.copies || 1,
  };

  // Push to Firebase
  if (window.LabelFirebase && window.LabelFirebase.sync) {
    window.LabelFirebase.sync(record);
  }

  // Optimistic local add (Firebase listener will re-sync anyway)
  _recAll.unshift(record);
  updateBadge(_recAll.length);

  // Refresh if panel is open
  const panel = document.getElementById('records-panel');
  if (panel && panel.style.display !== 'none') {
    window.renderRecordsPanel();
  }
};

// ═══════════════════════════════════════════════════════════════════════
// EXPORT — Excel
// ═══════════════════════════════════════════════════════════════════════
window.exportRecordsExcel = function(typeFilter) {
  const src = (typeFilter && typeFilter !== 'ALL')
    ? _recAll.filter(r => r.stickerType === typeFilter)
    : _recAll;

  if (!src.length) { alert('No records to export!'); return; }
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded. Reload page.'); return; }

  const wb   = XLSX.utils.book_new();
  const hdrs = ['SR.NO.','DATE','TIME','PRODUCT NAME','BATCH CODE','SIZE / LABEL','COPIES','TOTAL WEIGHT (g)'];

  // Group by type → one sheet each
  const groups = {};
  src.forEach(r => {
    const k = r.stickerType || 'other';
    if (!groups[k]) groups[k] = { label: getStickerLabel(k), rows: [] };
    groups[k].rows.push(r);
  });

  Object.entries(groups).forEach(([, g]) => {
    const data = g.rows.map((r, i) => {
      const isFront = r.labelSide === 'front';
      const tw = r.totalWeightG || ((r.weightG||0)*(r.copies||1));
      return [
        g.rows.length - i,
        r.date, r.time, r.productName, r.batchNo,
        isFront ? 'FRONT' : (r.packSize||'—'),
        r.copies,
        isFront ? '' : tw,
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ...data]);
    ws['!cols'] = [{wch:6},{wch:13},{wch:8},{wch:36},{wch:14},{wch:10},{wch:7},{wch:16}];
    XLSX.utils.book_append_sheet(wb, ws, g.label.substring(0, 31));
  });

  XLSX.writeFile(wb, `365_LabelRecords_${todayStr().replace(/-/g,'.')}.xlsx`);
};

// ═══════════════════════════════════════════════════════════════════════
// EXPORT — CSV
// ═══════════════════════════════════════════════════════════════════════
window.exportRecordsCsv = function(typeFilter) {
  const src = (typeFilter && typeFilter !== 'ALL')
    ? _recAll.filter(r => r.stickerType === typeFilter)
    : _recAll;
  if (!src.length) { alert('No records to export!'); return; }

  const q    = s => `"${String(s||'').replace(/"/g,'""')}"`;
  const hdrs = ['SR.NO.','DATE','TIME','PRODUCT','BATCH','SIZE','COPIES','TOTAL(g)'];
  const rows = src.map((r,i) => {
    const isFront = r.labelSide==='front';
    const tw = r.totalWeightG||((r.weightG||0)*(r.copies||1));
    return [q(src.length-i),q(r.date),q(r.time),q(r.productName),q(r.batchNo),
            q(isFront?'FRONT':r.packSize),q(r.copies),q(isFront?'':tw)].join(',');
  });
  const content = '\uFEFF' + [hdrs.map(q).join(','), ...rows].join('\r\n');
  const a = Object.assign(document.createElement('a'),{
    href: URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'})),
    download: `365_Records_${todayStr().replace(/-/g,'.')}.csv`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ═══════════════════════════════════════════════════════════════════════
// INIT — Firebase real-time listener
// ═══════════════════════════════════════════════════════════════════════
function startFirebaseListener() {
  if (window.LabelFirebase && window.LabelFirebase.listen) {
    _fbReady = true;
    window.LabelFirebase.listen(records => {
      _recAll = records || [];
      updateBadge(_recAll.length);
      updateCloudBadge(true);

      // Refresh if panel open
      const panel = document.getElementById('records-panel');
      if (panel && panel.style.display !== 'none') {
        window.renderRecordsPanel();
      }
    });
  } else {
    setTimeout(startFirebaseListener, 600);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  _recDate = new Date(); // default: today
  startFirebaseListener();
});


