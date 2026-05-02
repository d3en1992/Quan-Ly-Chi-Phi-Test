// ══════════════════════════════════════════════════════════════
// src/modules/advances/advance.ui.js — Advance (Tiền Ứng) UI
// Prompt 8 — ES Modules Refactor
// Prompt 16 — Full port từ danhmuc.js: entry table + list + filter
// ══════════════════════════════════════════════════════════════

import { escapeHtml } from '../../utils/string.util.js';
import { today } from '../../utils/date.util.js';
import { buildUngFilterData } from './advance.logic.js';

const UNG_TP_PG = 10;

// ══════════════════════════════════════════════════════════════
// MODULE STATE
// ══════════════════════════════════════════════════════════════
let filteredUng   = [];
let ungPage       = 1;
let ungTpPage     = 1;
let _editingUngId = null;

// ── Render filter selects ────────────────────────────────────
export function renderUngFilterSelects(filterData, currentTp, currentCt, currentMonth) {
  const { tps, sortedCts, months } = filterData;

  const tpHtml = '<option value="">Tất cả TP/NCC</option>' +
    tps.map(v => `<option ${v === currentTp ? 'selected' : ''} value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

  const ctHtml = '<option value="">Tất cả công trình</option>' +
    sortedCts.map(v => `<option ${v === currentCt ? 'selected' : ''} value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

  const monthHtml = '<option value="">Tất cả tháng</option>' +
    months.map(m => `<option ${m === currentMonth ? 'selected' : ''} value="${m}">${m}</option>`).join('');

  return { tpHtml, ctHtml, monthHtml };
}

// ── Render section HTML (TP hoặc NCC) ────────────────────────
export function renderUngSectionHtml(pagedRecs, allRecs, opts) {
  const { title, accentColor, curPage, pageSize, gotoFn, nameColLabel, editingId, resolveProjectName, numFmt, fmtS, sumBy } = opts;

  if (!allRecs.length) return '';
  const mono = "font-family:'IBM Plex Mono',monospace";
  const sumSec = sumBy(allRecs, 'tien');
  const tp = Math.ceil(allRecs.length / pageSize);

  let pagHtml = '';
  if (tp > 1) {
    const btns = [];
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      btns.push(`<button class="page-btn ${p === curPage ? 'active' : ''}" onclick="${gotoFn}(${p})">${p}</button>`);
    }
    pagHtml = `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--line);background:#f3f1ec;font-size:12px;color:var(--ink2)">
      <span>${allRecs.length} dòng · <span style="${mono};font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span></span>
      <div class="page-btns">${btns.join('')}</div>
    </div>`;
  }

  return `<div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--bg);border-radius:6px;margin-bottom:8px;border-left:3px solid ${accentColor}">
      <span style="font-weight:700;font-size:12px;color:var(--ink2)">${title}</span>
      <span style="${mono};font-size:12px;font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="records-table">
        <thead><tr>
          <th style="width:32px;text-align:center">
            <input type="checkbox" class="ung-section-chk-all" title="Chọn tất cả"
              onchange="this.closest('table').querySelectorAll('.ung-row-chk').forEach(c=>c.checked=this.checked)">
          </th>
          <th>Ngày</th><th>${nameColLabel}</th><th>Công Trình</th><th>Nội Dung</th>
          <th style="text-align:right">Số Tiền Ứng</th><th></th>
        </tr></thead>
        <tbody>${pagedRecs.map(r => `<tr data-ung-id="${r.id}" class="${editingId === r.id ? 'editing-row' : ''}">
          <td style="text-align:center;padding:4px">
            <input type="checkbox" class="ung-row-chk" data-id="${r.id}" style="width:15px;height:15px;cursor:pointer">
          </td>
          <td style="${mono};font-size:11px;color:var(--ink2)">${r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—'}</td>
          <td style="font-weight:600;font-size:12px">${escapeHtml(r.tp)}</td>
          <td style="color:var(--ink2)">${escapeHtml(resolveProjectName(r) || '—')}</td>
          <td style="color:var(--ink2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.nd)}">${escapeHtml(r.nd || '—')}</td>
          <td class="amount-td" style="color:var(--blue)">${numFmt(r.tien || 0)}</td>
          <td style="white-space:nowrap;display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn-outline btn-sm" onclick="editUngRecord('${r.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="delUngRecord('${r.id}')">✕</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    ${pagHtml}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// ENTRY TABLE
// ══════════════════════════════════════════════════════════════

function initUngTable(n = 4) {
  const tbody = document.getElementById('ung-tbody');
  if (tbody) tbody.innerHTML = '';
  for (let i = 0; i < n; i++) addUngRow();
  calcUngSummary();
}

function initUngTableIfEmpty() {
  const tbody = document.getElementById('ung-tbody');
  if (tbody && tbody.children.length === 0) initUngTable(4);
}

function addUngRows(n) {
  for (let i = 0; i < n; i++) addUngRow();
}

function clearUngRows() {
  const tbody = document.getElementById('ung-tbody');
  if (tbody) tbody.innerHTML = '';
  calcUngSummary();
}

function resetUngForm() {
  _editingUngId = null;
  initUngTable(4);
  const ungDate = document.getElementById('ung-date');
  if (ungDate) ungDate.value = today();
  const btn = document.getElementById('ung-save-btn');
  if (btn) btn.textContent = '💾 Lưu tất cả';
  calcUngSummary();
  document.querySelectorAll('.editing-row').forEach(tr => tr.classList.remove('editing-row'));
}

function onUngLoaiChange(sel) {
  const tr = sel.closest('tr');
  const tpInp = tr.querySelector('[data-f="tp"]');
  if (!tpInp) return;
  const loai = sel.value;
  tpInp.value = '';
  tpInp.placeholder = loai === 'nhacungcap'
    ? 'Chọn nhà cung cấp...'
    : 'Chọn thầu phụ...';
  calcUngSummary();
}

function _ungTpOptions(loai) {
  const cats = window.cats || {};
  if (loai === 'nhacungcap') return cats.nhaCungCap || [];
  return cats.thauPhu || [];
}

function addUngRow(d = {}) {
  const tbody = document.getElementById('ung-tbody');
  if (!tbody) return;
  const num = tbody.children.length + 1;
  const ctOpts = typeof window._buildProjOpts === 'function'
    ? window._buildProjOpts(d.congtrinh || '', '-- Chọn --')
    : `<option value="">-- Chọn --</option>`;
  const dLoai = d.loai || 'thauphu';
  const tpPlaceholder = dLoai === 'nhacungcap' ? 'Chọn nhà cung cấp...' : 'Chọn thầu phụ...';
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : (n) => n;

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${num}</td>
    <td style="padding:0">
      <select class="cell-input" data-f="loai" style="width:100%;border:none;background:transparent;padding:7px 6px;font-size:12px;font-weight:600;outline:none;color:var(--ink);cursor:pointer" onchange="onUngLoaiChange(this)">
        <option value="thauphu" ${dLoai === 'thauphu' ? 'selected' : ''}>Thầu phụ</option>
        <option value="nhacungcap" ${dLoai === 'nhacungcap' ? 'selected' : ''}>Nhà cung cấp</option>
      </select>
    </td>
    <td>
      <input class="cell-input" data-f="tp" value="${escapeHtml(d.tp || '')}" placeholder="${tpPlaceholder}" autocomplete="off">
    </td>
    <td><select class="cell-input" data-f="ct">${ctOpts}</select></td>
    <td><input class="cell-input right tien-input" data-f="tien" data-raw="${d.tien || ''}" placeholder="0" value="${d.tien ? numFmt(d.tien) : ''}" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="nd" value="${escapeHtml(d.nd || '')}" placeholder="Nội dung..."></td>
    <td><button class="del-btn" onclick="delUngRow(this)">✕</button></td>
  `;

  const tienInput = tr.querySelector('[data-f="tien"]');
  tienInput.addEventListener('input', function() {
    const raw = this.value.replace(/[.,]/g, '');
    this.dataset.raw = raw;
    if (raw) this.value = numFmt(parseInt(raw, 10) || 0);
    calcUngSummary();
  });
  tienInput.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  tienInput.addEventListener('blur', function() {
    const raw = parseInt(this.dataset.raw || '0', 10) || 0;
    this.value = raw ? numFmt(raw) : '';
  });

  const tpInp = tr.querySelector('[data-f="tp"]');
  const _tpAC = () => {
    const loai = tr.querySelector('[data-f="loai"]')?.value || 'thauphu';
    if (typeof window._acShow === 'function') {
      window._acShow(tpInp, _ungTpOptions(loai), v => { tpInp.value = v; calcUngSummary(); });
    }
  };
  tpInp.addEventListener('input', _tpAC);
  tpInp.addEventListener('focus', _tpAC);
  tpInp.addEventListener('blur', function() {
    const v = this.value.trim();
    if (!v) return;
    const loai = tr.querySelector('[data-f="loai"]')?.value || 'thauphu';
    const opts = _ungTpOptions(loai);
    const normalizeKey = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
    const canonical = opts.find(o => normalizeKey(o) === normalizeKey(v));
    if (!canonical) {
      if (typeof window.toast === 'function') window.toast('⚠️ "' + v + '" không có trong danh mục!', 'error');
      this.value = ''; calcUngSummary();
    } else {
      this.value = canonical;
    }
  });

  tr.querySelectorAll('input,select').forEach(el => {
    if (el.dataset.f !== 'tien' && el.dataset.f !== 'tp') {
      el.addEventListener('input', calcUngSummary);
      el.addEventListener('change', calcUngSummary);
    }
  });
  tbody.appendChild(tr);
}

function delUngRow(btn) {
  btn.closest('tr').remove();
  renumberUng();
  calcUngSummary();
}

function renumberUng() {
  document.querySelectorAll('#ung-tbody tr').forEach((tr, i) => {
    const numCell = tr.querySelector('.row-num');
    if (numCell) numCell.textContent = i + 1;
  });
}

function calcUngSummary() {
  let cnt = 0, total = 0;
  const fmtM = typeof window.fmtM === 'function' ? window.fmtM : (n) => n;
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp   = tr.querySelector('[data-f="tp"]')?.value || '';
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0', 10) || 0;
    if (tp || tien > 0) { cnt++; total += tien; }
  });
  const rowCount = document.getElementById('ung-row-count');
  const entryTotal = document.getElementById('ung-entry-total');
  if (rowCount)   rowCount.textContent = cnt;
  if (entryTotal) entryTotal.textContent = fmtM(total);
}

function clearUngTable() {
  if (!confirm('Xóa toàn bộ bảng nhập tiền ứng?')) return;
  initUngTable(4);
}

function saveAllUngRows() {
  const dateEl = document.getElementById('ung-date');
  const date = dateEl ? dateEl.value : '';
  if (!date) { if (typeof window.toast === 'function') window.toast('Vui lòng chọn ngày!', 'error'); return; }

  let errRow = 0;
  const rowsData = [];
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp   = (tr.querySelector('[data-f="tp"]')?.value || '').trim();
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0', 10) || 0;
    if (!tp && !tien) return;
    if (!tp) { errRow++; tr.style.background = '#fdecea'; return; }
    const ctSel  = tr.querySelector('[data-f="ct"]');
    const ct     = (ctSel?.value || '').trim();
    const ctPid  = typeof window._readPidFromSel === 'function' ? window._readPidFromSel(ctSel) : (ctSel?.options[ctSel.selectedIndex]?.dataset?.pid || null);
    if (ctPid && ctPid !== 'COMPANY') {
      const proj = typeof window.getProjectById === 'function' ? window.getProjectById(ctPid) : null;
      if (proj && proj.status === 'closed') { errRow++; tr.style.background = '#fdecea'; return; }
    }
    tr.style.background = '';
    rowsData.push({
      ngay: date,
      loai: (tr.querySelector('[data-f="loai"]')?.value || 'thauphu'),
      tp, congtrinh: ct,
      projectId: ctPid || null,
      tien,
      nd: (tr.querySelector('[data-f="nd"]')?.value || '').trim()
    });
  });

  if (errRow > 0) { if (typeof window.toast === 'function') window.toast(`${errRow} dòng có lỗi (thiếu TP/NCC hoặc CT đã quyết toán)!`, 'error'); return; }
  if (rowsData.length === 0) { if (typeof window.toast === 'function') window.toast('Không có dòng hợp lệ!', 'error'); return; }

  const ungRecords = window.ungRecords || [];
  let saved = 0;

  if (_editingUngId != null) {
    const idx = ungRecords.findIndex(r => String(r.id) === String(_editingUngId));
    if (idx < 0) { if (typeof window.toast === 'function') window.toast('Không tìm thấy bản ghi đang sửa!', 'error'); return; }
    const rec = rowsData[0];
    ungRecords[idx] = {
      ...ungRecords[idx],
      ...rec,
      updatedAt: Date.now(),
      deviceId: window.DEVICE_ID || ''
    };
    saved = 1;
  } else {
    const mkRecord = window.mkRecord || ((f) => ({ ...f, id: String(Date.now()), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: window.DEVICE_ID || '' }));
    rowsData.forEach(rec => { ungRecords.unshift(mkRecord(rec)); saved++; });
  }

  window.ungRecords = ungRecords;
  if (typeof window.save === 'function') window.save('ung_v1', ungRecords);
  if (typeof window.toast === 'function') window.toast(`✅ Đã ${_editingUngId ? 'cập nhật' : 'lưu'} ${saved} tiền ứng!`, 'success');
  _editingUngId = null;
  resetUngForm();
  buildUngFilters();
  filterAndRenderUng();
}

function editUngRecord(id) {
  const ungRecords = window.ungRecords || [];
  const rec = ungRecords.find(r => String(r.id) === String(id) && !r.deletedAt);
  if (!rec) return;

  _editingUngId = id;
  const ungDate = document.getElementById('ung-date');
  if (ungDate) ungDate.value = rec.ngay || '';

  clearUngRows();
  const resolveName = typeof window.resolveProjectName === 'function' ? window.resolveProjectName : (r) => r.congtrinh || '';
  addUngRow({
    loai:       rec.loai,
    tp:         rec.tp,
    congtrinh:  rec.projectId ? resolveName(rec) : rec.congtrinh,
    projectId:  rec.projectId,
    tien:       rec.tien,
    nd:         rec.nd
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const btn = document.getElementById('ung-save-btn');
  if (btn) btn.textContent = '💾 Cập Nhật';

  document.querySelectorAll('.editing-row').forEach(tr => tr.classList.remove('editing-row'));
  const row = document.querySelector(`[data-ung-id="${id}"]`);
  if (row) { row.classList.add('editing-row'); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

// ══════════════════════════════════════════════════════════════
// ALL PAGE — FILTER + RENDER
// ══════════════════════════════════════════════════════════════

function buildUngFilters() {
  const ungRecords = window.ungRecords || [];
  const resolveName = typeof window.resolveProjectName === 'function' ? window.resolveProjectName : (r) => r.congtrinh || '';
  const active = ungRecords.filter(r => !r.deletedAt);
  const tps = [...new Set(active.map(i => i.tp))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
  const cts = [...new Set(active.map(i => resolveName(i)))].filter(Boolean);
  const sortedCts = (typeof window.getAllProjects === 'function' ? window.getAllProjects() : [])
    .map(p => p.name).filter(name => cts.includes(name));
  const months = [...new Set(active.map(i => (i.ngay || '').slice(0, 7)))].filter(Boolean).sort().reverse();

  const tpSel = document.getElementById('uf-tp');
  const ctSel = document.getElementById('uf-ct');
  const mSel  = document.getElementById('uf-month');
  if (!tpSel || !ctSel || !mSel) return;

  const tv = tpSel.value;
  tpSel.innerHTML = '<option value="">Tất cả TP/NCC</option>' +
    tps.map(v => `<option ${v === tv ? 'selected' : ''} value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  const cv = ctSel.value;
  ctSel.innerHTML = '<option value="">Tất cả công trình</option>' +
    sortedCts.map(v => `<option ${v === cv ? 'selected' : ''} value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  const mv = mSel.value;
  mSel.innerHTML = '<option value="">Tất cả tháng</option>' +
    months.map(m => `<option ${m === mv ? 'selected' : ''} value="${m}">${m}</option>`).join('');
}

function filterAndRenderUng() {
  ungPage = 1; ungTpPage = 1;
  const ungRecords = window.ungRecords || [];
  const q      = (document.getElementById('ung-search')?.value || '').toLowerCase();
  const fTp    = document.getElementById('uf-tp')?.value || '';
  const fCt    = document.getElementById('uf-ct')?.value || '';
  const fMonth = document.getElementById('uf-month')?.value || '';
  const inAY = (d) => typeof window.inActiveYear === 'function' ? window.inActiveYear(d) : true;
  const resolveName = typeof window.resolveProjectName === 'function' ? window.resolveProjectName : (r) => r.congtrinh || '';

  filteredUng = ungRecords.filter(r => {
    if (r.deletedAt) return false;
    if (r.loai === 'congnhan') return false;
    if (!inAY(r.ngay)) return false;
    if (fTp && r.tp !== fTp) return false;
    if (fCt && resolveName(r) !== fCt) return false;
    if (fMonth && !(r.ngay || '').startsWith(fMonth)) return false;
    if (q) {
      const t = [r.ngay, r.tp, resolveName(r), r.nd].join(' ').toLowerCase();
      if (!t.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));

  renderUngTable();
}

function _ungSectionHTMLInternal(pagedRecs, allRecs, title, accentColor, curPage, pgSize, gotoFn, nameColLabel) {
  if (!allRecs.length) return '';
  const mono = "font-family:'IBM Plex Mono',monospace";
  const fmtS = typeof window.fmtS === 'function' ? window.fmtS : (n) => n;
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : (n) => n;
  const sumBy = typeof window.sumBy === 'function' ? window.sumBy : (arr, key) => arr.reduce((s, r) => s + (r[key] || 0), 0);
  const resolveName = typeof window.resolveProjectName === 'function' ? window.resolveProjectName : (r) => r.congtrinh || '';
  const sumSec = sumBy(allRecs, 'tien');
  const tp = Math.ceil(allRecs.length / pgSize);
  let pagHtml = '';
  if (tp > 1) {
    const btns = [];
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      btns.push(`<button class="page-btn ${p === curPage ? 'active' : ''}" onclick="${gotoFn}(${p})">${p}</button>`);
    }
    pagHtml = `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--line);background:#f3f1ec;font-size:12px;color:var(--ink2)">
      <span>${allRecs.length} dòng · <span style="${mono};font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span></span>
      <div class="page-btns">${btns.join('')}</div>
    </div>`;
  }
  return `<div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--bg);border-radius:6px;margin-bottom:8px;border-left:3px solid ${accentColor}">
      <span style="font-weight:700;font-size:12px;color:var(--ink2)">${title}</span>
      <span style="${mono};font-size:12px;font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="records-table">
        <thead><tr>
          <th style="width:32px;text-align:center">
            <input type="checkbox" class="ung-section-chk-all" title="Chọn tất cả"
              onchange="this.closest('table').querySelectorAll('.ung-row-chk').forEach(c=>c.checked=this.checked)">
          </th>
          <th>Ngày</th><th>${nameColLabel}</th><th>Công Trình</th><th>Nội Dung</th>
          <th style="text-align:right">Số Tiền Ứng</th><th></th>
        </tr></thead>
        <tbody>${pagedRecs.map(r => `<tr data-ung-id="${r.id}" class="${_editingUngId === r.id ? 'editing-row' : ''}">
          <td style="text-align:center;padding:4px">
            <input type="checkbox" class="ung-row-chk" data-id="${r.id}" style="width:15px;height:15px;cursor:pointer">
          </td>
          <td style="${mono};font-size:11px;color:var(--ink2)">${r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—'}</td>
          <td style="font-weight:600;font-size:12px">${escapeHtml(r.tp)}</td>
          <td style="color:var(--ink2)">${escapeHtml(resolveName(r) || '—')}</td>
          <td style="color:var(--ink2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.nd)}">${escapeHtml(r.nd || '—')}</td>
          <td class="amount-td" style="color:var(--blue)">${numFmt(r.tien || 0)}</td>
          <td style="white-space:nowrap;display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn-outline btn-sm" onclick="editUngRecord('${r.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="delUngRecord('${r.id}')">✕</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    ${pagHtml}
  </div>`;
}

function renderUngTable() {
  const container = document.getElementById('ung-all-sections');
  if (!container) return;
  const allTp  = filteredUng.filter(r => r.loai === 'thauphu');
  const allNcc = filteredUng.filter(r => r.loai === 'nhacungcap');
  const fmtS   = typeof window.fmtS === 'function' ? window.fmtS : (n) => n;
  const sumBy  = typeof window.sumBy === 'function' ? window.sumBy : (arr, key) => arr.reduce((s, r) => s + (r[key] || 0), 0);
  const sumTien = sumBy(filteredUng, 'tien');
  const mono = "font-family:'IBM Plex Mono',monospace";

  if (!allTp.length && !allNcc.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink3);font-size:14px">Không có dữ liệu tiền ứng nào</div>`;
    const pg = document.getElementById('ung-pagination');
    if (pg) pg.innerHTML = '';
    return;
  }

  const tpPaged  = allTp.slice((ungTpPage - 1) * UNG_TP_PG, ungTpPage * UNG_TP_PG);
  const nccPaged = allNcc.slice((ungTpPage - 1) * UNG_TP_PG, ungTpPage * UNG_TP_PG);

  container.innerHTML =
    _ungSectionHTMLInternal(tpPaged,  allTp,  'Thầu Phụ',      'var(--gold)',  ungTpPage, UNG_TP_PG, 'goUngTpTo', 'Thầu phụ') +
    _ungSectionHTMLInternal(nccPaged, allNcc, 'Nhà Cung Cấp',  'var(--green)', ungTpPage, UNG_TP_PG, 'goUngTpTo', 'Nhà cung cấp');

  const pg = document.getElementById('ung-pagination');
  if (pg) pg.innerHTML =
    `<span>${filteredUng.length} bản ghi · Tổng tiền ứng: <strong style="color:var(--blue);${mono}">${fmtS(sumTien)}</strong></span>`;
}

function goUngTo(p)   { ungPage   = p; renderUngTable(); }
function goUngTpTo(p) { ungTpPage = p; renderUngTable(); }

function delUngRecord(id) {
  const ungRecords = window.ungRecords || [];
  const idx = ungRecords.findIndex(r => String(r.id) === String(id));
  if (idx < 0) return;
  if (!confirm('Xóa bản ghi tiền ứng này?')) return;
  const now = Date.now();
  ungRecords[idx] = { ...ungRecords[idx], deletedAt: now, updatedAt: now, deviceId: window.DEVICE_ID || '' };
  window.ungRecords = ungRecords;
  if (typeof window.save === 'function') window.save('ung_v1', ungRecords);
  buildUngFilters();
  filterAndRenderUng();
  if (typeof window._refreshAllTabs === 'function') window._refreshAllTabs();
  if (typeof window.toast === 'function') window.toast('Đã xóa bản ghi tiền ứng');
}

function rebuildUngSelects() {
  document.querySelectorAll('#ung-tbody [data-f="ct"]').forEach(sel => {
    if (sel.tagName === 'SELECT') {
      const cur = sel.value;
      if (typeof window._buildProjOpts === 'function') {
        sel.innerHTML = window._buildProjOpts(cur, '-- Chọn --');
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// INIT ADVANCE UI — expose window bridges
// ══════════════════════════════════════════════════════════════

export function initAdvanceUI() {
  window.initUngTable       = initUngTable;
  window.initUngTableIfEmpty= initUngTableIfEmpty;
  window.addUngRows         = addUngRows;
  window.clearUngRows       = clearUngRows;
  window.resetUngForm       = resetUngForm;
  window.onUngLoaiChange    = onUngLoaiChange;
  window.addUngRow          = addUngRow;
  window.delUngRow          = delUngRow;
  window.renumberUng        = renumberUng;
  window.calcUngSummary     = calcUngSummary;
  window.clearUngTable      = clearUngTable;
  window.saveAllUngRows     = saveAllUngRows;
  window.editUngRecord      = editUngRecord;
  window.buildUngFilters    = buildUngFilters;
  window.filterAndRenderUng = filterAndRenderUng;
  window.renderUngTable     = renderUngTable;
  window.goUngTo            = goUngTo;
  window.goUngTpTo          = goUngTpTo;
  window.delUngRecord       = delUngRecord;
  window.rebuildUngSelects  = rebuildUngSelects;
}

// ── Bridge tạm ──────────────────────────────────────────────
window._advanceUI = {
  renderUngFilterSelects,
  renderUngSectionHtml,
  initAdvanceUI,
  UNG_TP_PG,
};

console.log('[advance.ui] ES Module loaded ✅');
