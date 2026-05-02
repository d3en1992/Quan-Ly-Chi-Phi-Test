// ══════════════════════════════════════════════════════════════
// src/modules/invoices/invoice.ui.js — Invoice UI Module
// Prompt 13 — Port từ hoadon.js (render + entry table + trash + filters)
//
// DELEGATE sang legacy hoadon.js (còn giữ nguyên):
//   saveAllRows, _doSaveRows, saveDetailInvoice, delInvoice,
//   trashClearAll, trashRestore (DOM), trashDeletePermanent,
//   editManualInvoice, openDetailEdit, openEntryEdit,
//   editCCInvoice, saveEditInvoice, forceSaveAll
// ══════════════════════════════════════════════════════════════

import { calcRowMoney } from './invoice.logic.js';

// ══════════════════════════════════════════════════════════════
//  UI HELPERS (đã có từ trước)
// ══════════════════════════════════════════════════════════════

export function setSelectFlexible(sel, val) {
  if (!sel) return;
  const target = (val == null ? '' : String(val)).trim();
  if (!target) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); return; }
  const targetLower = target.toLowerCase();
  let matched = null;
  for (const opt of sel.options) {
    if ((opt.value || '').trim().toLowerCase() === targetLower) { matched = opt; break; }
  }
  if (matched) {
    sel.value = matched.value;
  } else {
    const orphan = document.createElement('option');
    orphan.value = target;
    orphan.textContent = target + ' (*)';
    sel.appendChild(orphan);
    sel.value = target;
  }
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

export function resolveInvSource(inv) {
  if (inv.ccKey || inv.source === 'cc') return 'cc';
  if (inv.source === 'detail') return 'detail';
  if (inv.source === 'quick') return 'quick';
  return 'manual';
}

export function sourceBadge(source) {
  const map = {
    cc:     { label: 'CC', color: '#1565c0', bg: '#e3f2fd' },
    detail: { label: 'CT', color: '#6a1b9a', bg: '#f3e5f5' },
    quick:  { label: 'NH', color: '#1a7a45', bg: '#e8f5e9' },
    manual: { label: 'TT', color: '#6c6560', bg: '#eeece8' },
  };
  const m = map[source] || map.manual;
  return `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:${m.bg};color:${m.color}">${m.label}</span>`;
}

export function getRowData(tr) {
  return {
    ten:    (tr.querySelector('[data-f="ten"]')?.value    || '').trim(),
    dv:     (tr.querySelector('[data-f="dv"]')?.value     || '').trim(),
    sl:     parseFloat(tr.querySelector('[data-f="sl"]')?.value)   || 1,
    dongia: parseInt(tr.querySelector('[data-f="dongia"]')?.dataset?.raw || '0') || 0,
    ck:     (tr.querySelector('[data-f="ck"]')?.value     || '').trim(),
  };
}

export function getDetailRows() {
  return [...document.querySelectorAll('#detail-tbody tr')];
}

// ── Resolve invoice source (internal alias) ──────────────────
function _resolveInvSource(inv) {
  if (inv.source === 'detail') return 'detail';
  if (inv.source === 'quick' || inv.source === 'manual') return 'quick';
  if (inv.items && inv.items.length) return 'detail';
  return 'quick';
}

// ══════════════════════════════════════════════════════════════
//  ENTRY TABLE — Nhập nhanh
// ══════════════════════════════════════════════════════════════

export function initTable(n = 10) {
  const tbody = document.getElementById('entry-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (let i = 0; i < n; i++) addRow();
  calcSummary();
}

export function addRows(n) {
  for (let i = 0; i < n; i++) addRow();
}

export function addRow(d = {}) {
  const tbody = document.getElementById('entry-tbody');
  if (!tbody) return;

  // Copy loai/CT từ dòng trên nếu không có dữ liệu
  if (!d.loai && !d.congtrinh) {
    const lastRow = tbody.querySelector('tr:last-child');
    if (lastRow) {
      const prevLoai = lastRow.querySelector('[data-f="loai"]')?.value || '';
      const prevCt   = lastRow.querySelector('[data-f="ct"]')?.value   || '';
      if (prevLoai || prevCt) d = { ...d, loai: prevLoai, congtrinh: prevCt };
    }
  }

  const cats = window.cats || {};
  const num  = tbody.children.length + 1;
  const ctDef = d.congtrinh || '';

  const _dd = arr => typeof window._dedupCatArr === 'function'
    ? window._dedupCatArr(arr)
    : [...(arr || [])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));

  const _x = typeof window.x === 'function' ? window.x : s => s;
  const _bpo = typeof window._buildProjOpts === 'function'
    ? (v, ph) => window._buildProjOpts(v, ph)
    : (v, ph) => `<option value="">${ph || '-- Chọn --'}</option>`;

  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;

  const loaiOpts  = `<option value="">-- Chọn --</option>` +
    _dd(cats.loaiChiPhi || []).map(v => `<option value="${_x(v)}" ${v === (d.loai || '') ? 'selected' : ''}>${_x(v)}</option>`).join('');
  const ctOpts    = _bpo(ctDef, '-- Chọn --');
  const nguoiOpts = `<option value="">-- Chọn --</option>` +
    _dd(cats.nguoiTH || []).map(v => `<option value="${_x(v)}" ${v === (d.nguoi || '') ? 'selected' : ''}>${_x(v)}</option>`).join('');
  const nccOpts   = `<option value="">-- Chọn --</option>` +
    _dd(cats.nhaCungCap || []).map(v => `<option value="${_x(v)}" ${v === (d.ncc || '') ? 'selected' : ''}>${_x(v)}</option>`).join('');

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${num}</td>
    <td><select class="cell-input" data-f="loai">${loaiOpts}</select></td>
    <td><select class="cell-input" data-f="ct">${ctOpts}</select></td>
    <td><input class="cell-input right tien-input" data-f="tien" data-raw="${d.tien || ''}" placeholder="0" value="${d.tien ? numFmtLocal(d.tien) : ''}" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="nd" value="${_x(d.nd || '')}" placeholder="Nội dung..."></td>
    <td><select class="cell-input" data-f="nguoi">${nguoiOpts}</select></td>
    <td><select class="cell-input" data-f="ncc">${nccOpts}</select></td>
    <td><button class="del-btn" onclick="delRow(this)">✕</button></td>
  `;

  // Tien input formatting
  const tienInput = tr.querySelector('[data-f="tien"]');
  tienInput.addEventListener('input', function () {
    const raw = this.value.replace(/[.,]/g, '');
    this.dataset.raw = raw;
    if (raw) this.value = numFmtLocal(parseInt(raw, 10) || 0);
    calcSummary();
  });
  tienInput.addEventListener('focus', function () { this.value = this.dataset.raw || ''; });
  tienInput.addEventListener('blur', function () {
    const raw = parseInt(this.dataset.raw || '0', 10) || 0;
    this.value = raw ? numFmtLocal(raw) : '';
  });

  tr.querySelectorAll('input,select').forEach(el => {
    if (el.dataset.f !== 'tien') {
      el.addEventListener('input', calcSummary);
      el.addEventListener('change', calcSummary);
    }
  });

  // Enter key → next row
  const entryInputs = [...tr.querySelectorAll('input')];
  entryInputs.forEach(inp => {
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const allRows = [...document.querySelectorAll('#entry-tbody tr')];
      const curIdx  = allRows.indexOf(tr);
      const colIdx  = entryInputs.indexOf(this);
      let targetRow;
      if (curIdx < allRows.length - 1) {
        targetRow = allRows[curIdx + 1];
      } else {
        addRows(1);
        targetRow = [...document.querySelectorAll('#entry-tbody tr')][curIdx + 1];
      }
      if (targetRow) {
        const targets = [...targetRow.querySelectorAll('input')];
        (targets[colIdx] || targets[0])?.focus();
      }
    });
  });

  tbody.appendChild(tr);

  // Orphaned CT
  if (ctDef) {
    const ctSel = tr.querySelector('[data-f="ct"]');
    if (ctSel && !ctSel.value) {
      const orphan = document.createElement('option');
      orphan.value = ctDef;
      orphan.textContent = ctDef + ' (*)';
      if (d.projectId) orphan.dataset.pid = d.projectId;
      ctSel.appendChild(orphan);
      ctSel.value = ctDef;
    }
  }
}

export function delRow(btn) {
  btn.closest('tr').remove();
  renumber();
  calcSummary();
}

function renumber() {
  document.querySelectorAll('#entry-tbody tr').forEach((tr, i) => {
    const el = tr.querySelector('.row-num');
    if (el) el.textContent = i + 1;
  });
}

export function calcSummary() {
  let cnt = 0, total = 0;
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai    = tr.querySelector('[data-f="loai"]')?.value || '';
    const ct      = tr.querySelector('[data-f="ct"]')?.value   || '';
    const tienRaw = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0', 10) || 0;
    if (loai || ct || tienRaw > 0) { cnt++; total += tienRaw; }
  });
  const rowCountEl  = document.getElementById('row-count');
  const entryTotEl  = document.getElementById('entry-total');
  if (rowCountEl) rowCountEl.textContent = cnt;
  if (entryTotEl) entryTotEl.textContent = typeof window.fmtM === 'function' ? window.fmtM(total) : total;
}

export function clearTable() {
  if (!confirm('Xóa toàn bộ bảng nhập hiện tại?')) return;
  initTable(5);
}

// Rebuild tất cả dropdowns trong bảng nhập nhanh và detail form
export function refreshEntryDropdowns() {
  const cats = window.cats || {};
  const _dd  = arr => typeof window._dedupCatArr === 'function'
    ? window._dedupCatArr(arr)
    : [...(arr || [])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
  const _x   = typeof window.x === 'function' ? window.x : s => s;
  const _bpo = typeof window._buildProjOpts === 'function'
    ? (v, ph) => window._buildProjOpts(v, ph)
    : (v, ph) => `<option value="">${ph || '-- Chọn --'}</option>`;

  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loaiSel  = tr.querySelector('[data-f="loai"]');
    const ctSel    = tr.querySelector('[data-f="ct"]');
    const nguoiSel = tr.querySelector('[data-f="nguoi"]');
    const nccSel   = tr.querySelector('[data-f="ncc"]');
    if (loaiSel) {
      const v = loaiSel.value;
      loaiSel.innerHTML = '<option value="">-- Chọn --</option>' +
        _dd(cats.loaiChiPhi || []).map(c => `<option value="${_x(c)}" ${c === v ? 'selected' : ''}>${_x(c)}</option>`).join('');
    }
    if (ctSel) { ctSel.innerHTML = _bpo(ctSel.value, '-- Chọn --'); }
    if (nguoiSel) {
      const v = nguoiSel.value;
      nguoiSel.innerHTML = '<option value="">-- Chọn --</option>' +
        _dd(cats.nguoiTH || []).map(c => `<option value="${_x(c)}" ${c === v ? 'selected' : ''}>${_x(c)}</option>`).join('');
    }
    if (nccSel) {
      const v = nccSel.value;
      nccSel.innerHTML = '<option value="">-- Chọn --</option>' +
        _dd(cats.nhaCungCap || []).map(c => `<option value="${_x(c)}" ${c === v ? 'selected' : ''}>${_x(c)}</option>`).join('');
    }
  });

  // Nạp trực tiếp cho các select trong form chi tiết
  const detLoai  = document.getElementById('detail-loai');
  const detCt    = document.getElementById('detail-ct');
  const detNcc   = document.getElementById('detail-ncc');
  const detNguoi = document.getElementById('detail-nguoi');
  if (detLoai) {
    const v = detLoai.value;
    detLoai.innerHTML = '<option value="">-- Chọn --</option>' +
      _dd(cats.loaiChiPhi || []).map(c => `<option value="${_x(c)}" ${c === v ? 'selected' : ''}>${_x(c)}</option>`).join('');
  }
  if (detCt) { detCt.innerHTML = _bpo(detCt.value, '-- Chọn Công Trình --'); }
  if (detNcc) {
    const v = detNcc.value;
    detNcc.innerHTML = '<option value="">-- Chọn --</option>' +
      _dd(cats.nhaCungCap || []).map(c => `<option value="${_x(c)}" ${c === v ? 'selected' : ''}>${_x(c)}</option>`).join('');
  }
  if (detNguoi) {
    const v = detNguoi.value;
    detNguoi.innerHTML = '<option value="">-- Chọn --</option>' +
      _dd(cats.nguoiTH || []).map(c => `<option value="${_x(c)}" ${c === v ? 'selected' : ''}>${_x(c)}</option>`).join('');
  }
}

// Rebuild CT dropdowns only (called after project changes)
export function refreshHoadonCtDropdowns() {
  const _bpo = typeof window._buildProjOpts === 'function'
    ? (v, ph) => window._buildProjOpts(v, ph)
    : (v, ph) => `<option value="">${ph || '-- Chọn --'}</option>`;

  document.querySelectorAll('#entry-tbody [data-f="ct"]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = _bpo(cur, '-- Chọn --');
    sel.value = cur;
  });
  const detCtSel = document.getElementById('detail-ct');
  if (detCtSel) {
    const cur = detCtSel.value;
    detCtSel.innerHTML = _bpo(cur, '-- Chọn Công Trình --');
    detCtSel.value = cur;
  }
}

// ══════════════════════════════════════════════════════════════
//  INVOICE DETAIL — Chi tiết hóa đơn
// ══════════════════════════════════════════════════════════════

export function renderDetailRowHTML(d, num) {
  const _x = typeof window.x === 'function' ? window.x : s => s;
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const parseMoney  = typeof window.parseMoney === 'function' ? window.parseMoney : () => 0;

  const ckRaw = d.ck || '';
  const ckFmt = (ckRaw && !ckRaw.endsWith('%'))
    ? (() => { const n = parseMoney(ckRaw); return n ? numFmtLocal(n) : ckRaw; })()
    : ckRaw;

  return `
    <td class="row-num">${num}</td>
    <td><input class="cell-input" data-f="ten" value="${_x(d.ten || '')}" placeholder="Tên hàng hóa, vật tư..."></td>
    <td style="padding:0"><input class="cell-input center" data-f="dv" value="${_x(d.dv || '')}" placeholder="cái"
      style="width:100%;text-align:center;padding:7px 4px"></td>
    <td style="padding:0"><input data-f="sl" type="number" step="0.01" min="0"
      value="${d.sl || ''}" placeholder="1"
      style="width:100%;text-align:center;border:none;background:transparent;padding:7px 4px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;-moz-appearance:textfield"
      inputmode="decimal"></td>
    <td><input class="cell-input right" data-f="dongia" data-raw="${d.dongia || ''}"
      value="${d.dongia ? numFmtLocal(d.dongia) : ''}" placeholder="0" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="ck" value="${_x(ckFmt)}" placeholder="vd: 5% hoặc 50000"></td>
    <td class="tt-cell" data-f="thtien"></td>
    <td><button class="del-btn" onclick="delDetailRow(this)">✕</button></td>
  `;
}

export function addDetailRow(d = {}) {
  const tbody = document.getElementById('detail-tbody');
  if (!tbody) return;
  const num  = tbody.children.length + 1;
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const parseMoney  = typeof window.parseMoney === 'function' ? window.parseMoney : () => 0;
  const tr = document.createElement('tr');
  tr.innerHTML = renderDetailRowHTML(d, num);

  const dongiaInp = tr.querySelector('[data-f="dongia"]');
  dongiaInp.addEventListener('focus', function () { this.value = this.dataset.raw || ''; });
  dongiaInp.addEventListener('blur', function () {
    const raw = parseInt(this.dataset.raw || '0', 10) || 0;
    this.value = raw ? numFmtLocal(raw) : '';
  });
  dongiaInp.addEventListener('input', function () {
    const raw = this.value.replace(/[.,\s]/g, '');
    this.dataset.raw = raw;
    if (raw) this.value = numFmtLocal(parseInt(raw, 10) || 0);
    calcDetailRow(tr);
    calcDetailTotals();
  });

  tr.querySelector('[data-f="sl"]').addEventListener('input', function () {
    calcDetailRow(tr);
    calcDetailTotals();
  });

  const ckInp = tr.querySelector('[data-f="ck"]');
  ckInp.addEventListener('focus', function () {
    const v = this.value.trim();
    if (v && !v.endsWith('%')) { const n = parseMoney(v); if (n) this.value = String(n); }
  });
  ckInp.addEventListener('blur', function () {
    const v = this.value.trim();
    if (v && !v.endsWith('%')) { const n = parseMoney(v); this.value = n ? numFmtLocal(n) : v; }
  });
  ckInp.addEventListener('input', function () {
    calcDetailRow(tr);
    calcDetailTotals();
  });

  tr.querySelector('[data-f="ten"]').addEventListener('input', generateDetailNd);

  // Enter key → next row
  tr.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const allRows = getDetailRows();
      const curIdx  = allRows.indexOf(tr);
      const inputs  = [...tr.querySelectorAll('input')];
      const colIdx  = inputs.indexOf(this);
      let targetRow;
      if (curIdx < allRows.length - 1) {
        targetRow = allRows[curIdx + 1];
      } else {
        addDetailRow();
        targetRow = getDetailRows()[curIdx + 1];
      }
      if (targetRow) {
        const targetInputs = [...targetRow.querySelectorAll('input')];
        const target = targetInputs[colIdx] || targetInputs[0];
        if (target) target.focus();
      }
    });
  });

  tbody.appendChild(tr);
  if (d.dongia || d.sl || d.ck) calcDetailRow(tr);
}

export function delDetailRow(btn) {
  btn.closest('tr').remove();
  document.querySelectorAll('#detail-tbody tr').forEach((tr, i) => {
    const el = tr.querySelector('.row-num');
    if (el) el.textContent = i + 1;
  });
  calcDetailTotals();
  generateDetailNd();
}

export function calcDetailRow(tr) {
  const { sl, dongia, ck } = getRowData(tr);
  const tt   = calcRowMoney(sl, dongia, ck);
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  tr.dataset.tt = tt;
  const ttEl = tr.querySelector('[data-f="thtien"]');
  if (ttEl) {
    ttEl.textContent = tt ? numFmtLocal(tt) : '';
    ttEl.className   = 'tt-cell' + (!tt ? ' empty' : '');
  }
}

export function calcDetailTotals() {
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const fmtMLocal   = typeof window.fmtM   === 'function' ? window.fmtM   : n => n;

  let tc = 0;
  getDetailRows().forEach(tr => { tc += parseInt(tr.dataset.tt || '0', 10) || 0; });

  const tcEl = document.getElementById('detail-tc');
  if (tcEl) tcEl.textContent = numFmtLocal(tc);

  const ckStr = (document.getElementById('detail-footer-ck')?.value || '').trim();
  const tong  = calcRowMoney(1, tc, ckStr);

  const tongEl = document.getElementById('detail-tong');
  if (tongEl) { tongEl.textContent = numFmtLocal(tong); tongEl.dataset.raw = tong; }

  const saveEl = document.getElementById('detail-tong-save');
  if (saveEl) saveEl.textContent = fmtMLocal(tong);
}

export function generateDetailNd() {
  const items = [];
  document.querySelectorAll('#detail-tbody tr [data-f="ten"]').forEach(inp => {
    const v = inp.value.trim();
    if (v) items.push({ ten: v });
  });
  const ndEl = document.getElementById('detail-nd');
  if (ndEl && typeof window.buildNDFromItems === 'function') {
    ndEl.value = window.buildNDFromItems(items);
  }
}

export function clearDetailForm() {
  const tbody = document.getElementById('detail-tbody');
  if (tbody) tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) addDetailRow();
  const ckEl    = document.getElementById('detail-footer-ck');  if (ckEl)    ckEl.value    = '';
  const ndEl    = document.getElementById('detail-nd');          if (ndEl)    ndEl.value    = '';
  const nccEl   = document.getElementById('detail-ncc');         if (nccEl)   nccEl.value   = '';
  const nguoiEl = document.getElementById('detail-nguoi');       if (nguoiEl) nguoiEl.value = '';
  const container = document.getElementById('inr-hd-chitiet');
  if (container) container.dataset.editId = '';
  const saveBtn = document.getElementById('detail-save-btn');
  if (saveBtn) saveBtn.textContent = '💾 Lưu Hóa Đơn';
  calcDetailTotals();
}

// ══════════════════════════════════════════════════════════════
//  INNER SUB NAVIGATION
// ══════════════════════════════════════════════════════════════

export function goInnerSub(btn, id) {
  document.querySelectorAll('#sub-nhap-hd .inner-sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sub-nhap-hd .inner-sub-btn').forEach(b => b.classList.remove('active'));
  const pageEl = document.getElementById(id);
  if (pageEl) pageEl.classList.add('active');
  if (btn) btn.classList.add('active');

  if (id === 'inr-hd-chitiet') {
    if (typeof window._initDetailFormSelects === 'function') window._initDetailFormSelects();
    const tbody = document.getElementById('detail-tbody');
    if (tbody && tbody.children.length === 0) {
      const dateEl = document.getElementById('detail-ngay');
      if (dateEl) dateEl.value = document.getElementById('entry-date')?.value || (typeof window.today === 'function' ? window.today() : '');
      for (let i = 0; i < 5; i++) addDetailRow();
    }
  }
  if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices();
}

// ══════════════════════════════════════════════════════════════
//  TODAY INVOICES
// ══════════════════════════════════════════════════════════════

export function renderTodayInvoices() {
  if (!window._dataReady) return;
  const _x = typeof window.x === 'function' ? window.x : s => s;
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const fmtSLocal   = typeof window.fmtS   === 'function' ? window.fmtS   : n => n;
  const todayFn     = typeof window.today  === 'function' ? window.today  : () => new Date().toISOString().split('T')[0];

  const activeInner = document.querySelector('#sub-nhap-hd .inner-sub-page.active');
  const date = (activeInner?.id === 'inr-hd-chitiet')
    ? (document.getElementById('detail-ngay')?.value || todayFn())
    : (document.getElementById('entry-date')?.value  || todayFn());

  const dateEl = document.getElementById('today-inv-date');
  if (dateEl) {
    const dp = date.split('-');
    dateEl.textContent = dp.length === 3 ? `${dp[2]}-${dp[1]}-${dp[0]}` : date;
  }

  const tbody  = document.getElementById('today-inv-tbody');
  const footer = document.getElementById('today-inv-footer');
  if (!tbody) return;

  const invoices = window.invoices || [];
  const todayInvs = invoices.filter(i => i.ngay === date && !i.ccKey && !i.deletedAt);

  if (!todayInvs.length) {
    const displayDate = date.split('-').length === 3 ? date.split('-').reverse().join('-') : date;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Chưa có hóa đơn nào vào ngày ${displayDate}</td></tr>`;
    if (footer) footer.innerHTML = '';
    return;
  }

  const mono = "font-family:'IBM Plex Mono',monospace";
  tbody.innerHTML = todayInvs.map(inv => `<tr>
    <td><span class="tag tag-gold">${_x(inv.loai || '—')}</span></td>
    <td style="font-size:12px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_x(inv.congtrinh || '—')}</td>
    <td style="text-align:right;${mono};font-weight:700;color:var(--green)">${inv.tien ? numFmtLocal(inv.tien) : '—'}</td>
    <td style="color:var(--ink2);font-size:11px">${_x(inv.nguoi || '—')}</td>
    <td style="color:var(--ink2);font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_x(inv.nd || '—')}</td>
    <td style="color:var(--ink2);font-size:11px;white-space:nowrap">${_x(inv.ncc || '—')}</td>
  </tr>`).join('');

  const total = todayInvs.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  if (footer) footer.innerHTML = `<span>${todayInvs.length} hóa đơn</span><span>Tổng: <strong style="color:var(--gold);${mono}">${fmtSLocal(total)}</strong></span>`;
}

// ══════════════════════════════════════════════════════════════
//  TRASH
// ══════════════════════════════════════════════════════════════

export function renderTrash() {
  const wrap   = document.getElementById('trash-wrap');
  const empty  = document.getElementById('trash-empty');
  const tbody  = document.getElementById('trash-tbody');
  if (!wrap || !tbody || !empty) return;

  const _x = typeof window.x === 'function' ? window.x : s => s;
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const trash = window.trash || [];

  if (!trash.length) {
    wrap.style.display  = 'none';
    empty.style.display = '';
    return;
  }
  wrap.style.display  = '';
  empty.style.display = 'none';

  tbody.innerHTML = trash.slice(0, 100).map(inv => `<tr>
    <td style="font-size:11px;color:var(--ink2);white-space:nowrap;font-family:'IBM Plex Mono',monospace">${inv.ngay || ''}</td>
    <td style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_x(inv.congtrinh || '—')}</td>
    <td><span class="tag tag-gold">${_x(inv.loai || '—')}</span></td>
    <td style="color:var(--ink2);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_x(inv.nd || '—')}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)">${numFmtLocal(inv.tien || 0)}</td>
    <td style="white-space:nowrap;display:flex;gap:4px;padding:5px 4px">
      <button class="btn btn-outline btn-sm" onclick="trashRestore('${inv.id}')" title="Khôi phục">↩ Khôi phục</button>
      <button class="btn btn-danger btn-sm" onclick="trashDeletePermanent('${inv.id}')" title="Xóa vĩnh viễn">✕</button>
    </td>
  </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  FILTER & LIST — Tất cả hóa đơn
// ══════════════════════════════════════════════════════════════

export function buildFilters() {
  const getInvCached = typeof window.getInvoicesCached === 'function'
    ? window.getInvoicesCached : () => window.invoices || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function'
    ? window.inActiveYear : () => true;
  const resolveProjName = typeof window.resolveProjectName === 'function'
    ? window.resolveProjectName : inv => inv.congtrinh || '';
  const _x = typeof window.x === 'function' ? window.x : s => s;

  const allInvs  = getInvCached();
  const yearInvs = allInvs.filter(i => inActiveYearFn(i.ngay));

  // CT dropdown
  const cts   = [...new Set(yearInvs.map(i => resolveProjName(i)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'vi'));
  const ctSel = document.getElementById('f-ct');
  if (!ctSel) return;
  const cv = ctSel.value;
  ctSel.innerHTML = '<option value="">Tất cả công trình</option>' +
    cts.map(c => `<option ${c === cv ? 'selected' : ''} value="${_x(c)}">${_x(c)}</option>`).join('');

  const relevantInvs = cv ? yearInvs.filter(i => resolveProjName(i) === cv) : yearInvs;

  // Loai dropdown
  const loais = [...new Set(relevantInvs.map(i => i.loai))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
  const lSel  = document.getElementById('f-loai');
  if (lSel) {
    const lv = lSel.value;
    lSel.innerHTML = '<option value="">Tất cả loại</option>' +
      loais.map(l => `<option ${l === lv ? 'selected' : ''} value="${_x(l)}">${_x(l)}</option>`).join('');
  }

  // NCC dropdown
  const nccSel = document.getElementById('f-ncc');
  if (nccSel) {
    const nccs = [...new Set(relevantInvs.map(i => i.ncc))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
    const nv   = nccSel.value;
    nccSel.innerHTML = '<option value="">Tất cả NCC</option>' +
      nccs.map(n => `<option ${n === nv ? 'selected' : ''} value="${_x(n)}">${_x(n)}</option>`).join('');
  }

  // Month dropdown
  const months = [...new Set(yearInvs.map(i => i.ngay?.slice(0, 7)))].filter(Boolean).sort().reverse();
  const mSel   = document.getElementById('f-month');
  if (mSel) {
    const mv = mSel.value;
    mSel.innerHTML = '<option value="">Tất cả tháng</option>' +
      months.map(m => `<option ${m === mv ? 'selected' : ''} value="${m}">${m}</option>`).join('');
  }
}

export function filterAndRender() {
  if (!window._dataReady) return;

  const getInvCached = typeof window.getInvoicesCached === 'function'
    ? window.getInvoicesCached : () => window.invoices || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function'
    ? window.inActiveYear : () => true;
  const resolveProjName = typeof window.resolveProjectName === 'function'
    ? window.resolveProjectName : inv => inv.congtrinh || '';

  window.curPage = 1;
  const q      = document.getElementById('search')?.value.toLowerCase()   || '';
  const fCt    = document.getElementById('f-ct')?.value                   || '';
  const fLoai  = document.getElementById('f-loai')?.value                 || '';
  const fNcc   = document.getElementById('f-ncc')?.value                  || '';
  const fMonth = document.getElementById('f-month')?.value                || '';

  window.filteredInvs = getInvCached().filter(inv => {
    if (!inActiveYearFn(inv.ngay)) return false;
    if (fCt    && resolveProjName(inv) !== fCt)       return false;
    if (fLoai  && inv.loai !== fLoai)                  return false;
    if (fNcc   && (inv.ncc || '') !== fNcc)            return false;
    if (fMonth && !inv.ngay.startsWith(fMonth))        return false;
    if (q) {
      const t = [inv.ngay, resolveProjName(inv), inv.loai, inv.nguoi, inv.ncc, inv.nd,
        String(inv.thanhtien || inv.tien || 0)].join(' ').toLowerCase();
      if (!t.includes(q)) return false;
    }
    return true;
  });

  window.filteredInvs.sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
  renderTable();
}

export function renderTable() {
  const tbody  = document.getElementById('all-tbody');
  if (!tbody) return;

  const filteredInvs = window.filteredInvs || [];
  const curPage      = window.curPage || 1;
  const PG           = window.PG || 20;
  const _x = typeof window.x === 'function' ? window.x : s => s;
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const fmtSLocal   = typeof window.fmtS   === 'function' ? window.fmtS   : n => n;
  const resolveProjName = typeof window.resolveProjectName === 'function'
    ? window.resolveProjectName : inv => inv.congtrinh || '';

  const start = (curPage - 1) * PG;
  const paged = filteredInvs.slice(start, start + PG);
  const sumTT = filteredInvs.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);

  if (!paged.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">Không có hóa đơn nào</td></tr>`;
    const paginEl = document.getElementById('pagination');
    if (paginEl) paginEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = paged.map(inv => {
    const isCC     = inv.source === 'cc' || (!inv.source && !!inv.ccKey);
    const isManual = !isCC;
    const src      = isCC ? 'cc' : _resolveInvSource(inv);
    const rowClass = src === 'quick' ? 'inv-row-quick' : src === 'detail' ? 'inv-row-detail' : '';
    const actionBtn = isManual
      ? `<span style="white-space:nowrap;display:inline-flex;gap:3px">
          <button class="btn btn-outline btn-sm" onclick="editManualInvoice('${inv.id}')" title="Sửa hóa đơn">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="delInvoice('${inv.id}')" title="Xóa hóa đơn">✕</button>
        </span>`
      : isCC
        ? `<button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 7px" onclick="editCCInvoice('${inv.ccKey || inv.id}')" title="Chỉnh sửa tại tab Chấm Công">↩ CC</button>`
        : `<span style="color:var(--ink3);font-size:11px;padding:0 6px">—</span>`;
    const displayDate = inv.ngay
      ? (inv.ngay.split('-').length === 3 ? inv.ngay.split('-').reverse().join('-') : inv.ngay)
      : '—';
    return `<tr class="${rowClass}">
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2)">${displayDate}</td>
      <td style="font-weight:600;font-size:12px;max-width:220px">${_x(resolveProjName(inv))}</td>
      <td><span class="tag tag-gold">${_x(inv.loai)}</span></td>
      <td class="hide-mobile" style="color:var(--ink2)">${_x(inv.nguoi || '—')}</td>
      <td class="hide-mobile" style="color:var(--ink2)">${_x(inv.ncc || '—')}</td>
      <td style="color:var(--ink2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_x(inv.nd)}">${_x(inv.nd || '—')}</td>
      <td class="amount-td" title="Đơn giá: ${numFmtLocal(inv.tien || 0)}${inv.sl && inv.sl !== 1 ? ' × ' + inv.sl : ''}">${numFmtLocal(inv.thanhtien || inv.tien || 0)}</td>
      <td style="white-space:nowrap">${actionBtn}</td>
    </tr>`;
  }).join('');

  const tp  = Math.ceil(filteredInvs.length / PG);
  let pag   = `<span>${filteredInvs.length} hóa đơn · Tổng: <strong style="color:var(--gold);font-family:'IBM Plex Mono',monospace">${fmtSLocal(sumTT)}</strong></span>`;
  if (tp > 1) {
    pag += '<div class="page-btns">';
    for (let p = 1; p <= Math.min(tp, 10); p++)
      pag += `<button class="page-btn ${p === curPage ? 'active' : ''}" onclick="goTo(${p})">${p}</button>`;
    if (tp > 10) pag += `<span style="padding:4px 6px;color:var(--ink3)">...${tp}</span>`;
    pag += '</div>';
  }
  const paginEl = document.getElementById('pagination');
  if (paginEl) paginEl.innerHTML = pag;
}

export function goTo(p) {
  window.curPage = p;
  renderTable();
}

// Toggle giữa "Tất cả HĐ" và "🗑 Đã xóa"
export function switchTatCaView(val) {
  const activeWrap = document.getElementById('active-inv-wrap');
  const trashWrap  = document.getElementById('inline-trash-wrap');
  const isTrash    = val === 'trash';
  if (activeWrap) activeWrap.style.display = isTrash ? 'none' : '';
  if (trashWrap)  trashWrap.style.display  = isTrash ? ''     : 'none';

  const filterIds = ['tc-search-box', 'f-ct', 'f-loai', 'f-ncc', 'f-month'];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isTrash ? 'none' : '';
  });
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) exportBtn.style.display = isTrash ? 'none' : '';

  if (isTrash) renderTrash();
  else { buildFilters(); filterAndRender(); }
}

// ── Duplicate modal ──────────────────────────────────────────
export function closeDupModal() {
  const el = document.getElementById('dup-modal-overlay');
  if (el) el.classList.remove('open');
}

// ── Edit today invoice ───────────────────────────────────────
export function editTodayInv(id) {
  const getInvCached = typeof window.getInvoicesCached === 'function'
    ? window.getInvoicesCached : () => [];
  const inv = getInvCached().find(i => String(i.id) === String(id));
  if (!inv || inv.ccKey) return;
  if (inv.items && inv.items.length) {
    if (typeof window.openDetailEdit === 'function') window.openDetailEdit(inv);
    return;
  }
  if (typeof window.openEntryEdit === 'function') window.openEntryEdit(inv);
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════

export function initInvoiceModule() {
  // Render initial today invoices when called after data ready
  renderTodayInvoices();
  console.log('[invoice.ui] initInvoiceModule ✅');
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES
// Chỉ bridge các hàm mà index.html onclick gọi trực tiếp,
// hoặc các hàm mà legacy scripts gọi (buildFilters, filterAndRender…)
// ══════════════════════════════════════════════════════════════
window._invoiceUI = {
  initInvoiceModule, initTable, addRow, addRows, delRow,
  calcSummary, clearTable, refreshEntryDropdowns, refreshHoadonCtDropdowns,
  renderDetailRowHTML, addDetailRow, delDetailRow, calcDetailRow,
  calcDetailTotals, generateDetailNd, clearDetailForm,
  goInnerSub, renderTodayInvoices, renderTrash,
  buildFilters, filterAndRender, renderTable, goTo,
  switchTatCaView, closeDupModal, editTodayInv,
  setSelectFlexible, resolveInvSource, sourceBadge, getRowData, getDetailRows,
};

// Direct window globals — called from index.html onclick / other modules
window.initTable              = initTable;
window.addRows                = addRows;
window.addRow                 = addRow;
window.delRow                 = delRow;
window.calcSummary            = calcSummary;
window.clearTable             = clearTable;
window.refreshEntryDropdowns  = refreshEntryDropdowns;
window.refreshHoadonCtDropdowns = refreshHoadonCtDropdowns;

window.addDetailRow           = addDetailRow;
window.delDetailRow           = delDetailRow;
window.calcDetailRow          = calcDetailRow;
window.calcDetailTotals       = calcDetailTotals;
window.generateDetailNd       = generateDetailNd;
window.clearDetailForm        = clearDetailForm;

window.goInnerSub             = goInnerSub;
window.renderTodayInvoices    = renderTodayInvoices;
window.renderTrash            = renderTrash;
window.buildFilters           = buildFilters;
window.filterAndRender        = filterAndRender;
window.renderTable            = renderTable;
window.goTo                   = goTo;
window.switchTatCaView        = switchTatCaView;
window.closeDupModal          = closeDupModal;
window.editTodayInv           = editTodayInv;

// ── rebuildEntrySelects alias (gọi bởi danhmuc.js / nav.ui.js) ──
window.rebuildEntrySelects = refreshEntryDropdowns;

console.log('[invoice.ui] ES Module loaded ✅');
