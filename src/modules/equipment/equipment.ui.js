// ══════════════════════════════════════════════════════════════
// src/modules/equipment/equipment.ui.js — Equipment UI
// Prompt 16 — Full port từ thietbi.js
// ══════════════════════════════════════════════════════════════

import { escapeHtml } from '../../utils/string.util.js';
import { today } from '../../utils/date.util.js';
import {
  TB_TINH_TRANG,
  TB_KHO_TONG,
  TB_STATUS_STYLE,
  isKhoTong,
  tbGetNames,
} from './equipment.logic.js';

// ── Pagination constants ─────────────────────────────────────
const TB_PG  = 10;
const KHO_PG = 7;

// ── Module state ─────────────────────────────────────────────
let tbPage  = 1;
let khoPage = 1;

// ══════════════════════════════════════════════════════════════
// HTML BUILDER HELPERS (exported — used by legacy code)
// ══════════════════════════════════════════════════════════════

// ── Build options tên thiết bị ───────────────────────────────
export function buildTbNameOpts(cats, selected) {
  const names = tbGetNames(cats);
  return '<option value="">-- Chọn --</option>' +
    names.map(n => `<option value="${escapeHtml(n)}" ${n === selected ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
}

// ── Build options tình trạng ─────────────────────────────────
export function buildTbTtOpts(selected) {
  return TB_TINH_TRANG.map(v =>
    `<option value="${v}" ${selected === v ? 'selected' : v === 'Đang hoạt động' && !selected ? 'selected' : ''}>${v}</option>`
  ).join('');
}

// ── Build row cho bảng nhập ──────────────────────────────────
export function buildTbEntryRowHtml(idx, data, cats) {
  const ttOpts  = buildTbTtOpts(data?.tinhtrang);
  const tenOpts = buildTbNameOpts(cats, data?.ten);

  return `
    <td class="row-num">${idx}</td>
    <td class="tb-name-col" style="padding:0">
      <select data-tb="ten"
        style="width:100%;border:none;background:transparent;padding:7px 10px;font-size:13px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink);cursor:pointer">
        ${tenOpts}
      </select>
    </td>
    <td style="padding:0">
      <input type="number" data-tb="soluong" class="np-num-input" min="0" step="1" inputmode="decimal"
        value="${data?.soluong || ''}" placeholder="0"
        style="width:100%;border:none;background:transparent;padding:7px 8px;text-align:center;font-size:13px;font-family:'IBM Plex Mono',monospace;outline:none;color:var(--ink)">
    </td>
    <td style="padding:0">
      <select data-tb="tinhtrang"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink);cursor:pointer">
        ${ttOpts}
      </select>
    </td>
    <td style="padding:0">
      <input class="cc-name-input" data-tb="ghichu"
        value="${escapeHtml(data?.ghichu || '')}" placeholder="—"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink)">
    </td>
    <td style="padding:3px 4px;text-align:center">
      <button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove();tbRenum()" title="Xóa dòng">✕</button>
    </td>`;
}

// ── Render row cho bảng danh sách ────────────────────────────
export function buildTbListRowHtml(r, resolveCtName) {
  const ttStyle = TB_STATUS_STYLE[r.tinhtrang] || '';
  const ttOpts  = TB_TINH_TRANG.map(v =>
    `<option value="${v}" ${r.tinhtrang === v ? 'selected' : ''}>${v}</option>`
  ).join('');
  const ctDisplay = resolveCtName(r);

  return `<tr data-tbid="${r.id}">
    <td class="tb-ct-col" title="${escapeHtml(ctDisplay)}">${escapeHtml(ctDisplay)}</td>
    <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${escapeHtml(r.ten)}</span></td>
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong || 0}</td>
    <td>
      <select onchange="tbUpdateField('${r.id}','tinhtrang',this.value)"
        class="tb-status" style="cursor:pointer;border:1px solid var(--line2);${ttStyle}">
        ${ttOpts}
      </select>
    </td>
    <td style="color:var(--ink2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.ghichu)}">${escapeHtml(r.ghichu || '—')}</td>
    <td style="padding:6px 4px">
      <button class="btn btn-sm" onclick="tbLuanChuyen('${r.id}')"
        style="background:#2563eb;color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit;white-space:nowrap">↩ Luân chuyển</button>
    </td>
  </tr>`;
}

// ── Render row cho bảng KHO TỔNG ─────────────────────────────
export function buildKhoRowHtml(r) {
  const ttStyle = TB_STATUS_STYLE[r.tinhtrang] || '';
  return `<tr data-tbid="${r.id}">
    <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${escapeHtml(r.ten)}</span></td>
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong || 0}</td>
    <td><span class="tb-status" style="${ttStyle}">${escapeHtml(r.tinhtrang || '')}</span></td>
    <td style="color:var(--ink2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.ghichu)}">${escapeHtml(r.ghichu || '—')}</td>
    <td style="font-size:10px;color:var(--ink3);white-space:nowrap">${r.ngay || ''}</td>
    <td style="padding:6px 4px;display:flex;gap:4px;flex-wrap:nowrap">
      <button class="btn btn-sm" onclick="tbLuanChuyen('${r.id}')"
        style="background:#2563eb;color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit;white-space:nowrap">↩ Luân chuyển</button>
      <button class="btn btn-danger btn-sm" onclick="tbDeleteRow('${r.id}')">✕</button>
    </td>
  </tr>`;
}

// ── Render thống kê vốn thiết bị ─────────────────────────────
export function buildTbStatsRowHtml(item) {
  return `<tr>
    <td style="font-weight:600">${escapeHtml(item.ct)}</td>
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;color:var(--gold)">${item.total}</td>
    <td style="text-align:center;color:var(--ink3);font-size:13px">${item.types.size} loại</td>
  </tr>`;
}

// ── Pagination HTML ──────────────────────────────────────────
export function buildTbPaginationHtml(total, curPage, pageSize, gotoFn) {
  const tp = Math.ceil(total / pageSize);
  let pag = `<span>${total} thiết bị</span>`;
  if (tp > 1) {
    pag += '<div class="page-btns">';
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      pag += `<button class="page-btn ${p === curPage ? 'active' : ''}" onclick="${gotoFn}(${p})">${p}</button>`;
    }
    pag += '</div>';
  }
  return pag;
}

// ── Build CT select cho form nhập ────────────────────────────
export function buildTbCtEntryOpts(allProjects, activeYear, ctInActiveYear, currentVal) {
  const projs = allProjects.filter(p =>
    activeYear === 0 || p.name === currentVal || ctInActiveYear(p.name)
  );
  return '<option value="">-- Chọn công trình --</option>' +
    `<option value="${TB_KHO_TONG}" data-pid="COMPANY"${currentVal === TB_KHO_TONG ? ' selected' : ''}>${TB_KHO_TONG}</option>` +
    projs.map(p => `<option value="${escapeHtml(p.name)}" data-pid="${p.id}"${p.name === currentVal ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
}

// ── Build CT filter select ───────────────────────────────────
export function buildTbCtFilterOpts(allProjects, activeYear, ctInActiveYear, currentVal) {
  const projs = allProjects.filter(p =>
    activeYear === 0 || ctInActiveYear(p.name)
  );
  return `<option value="">Tất cả công trình</option>` +
    `<option value="${TB_KHO_TONG}"${currentVal === TB_KHO_TONG ? ' selected' : ''}>${TB_KHO_TONG}</option>` +
    projs.map(p => `<option value="${escapeHtml(p.name)}"${p.name === currentVal ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
}

// ══════════════════════════════════════════════════════════════
// NAME DATALIST & PRUNE
// ══════════════════════════════════════════════════════════════

function tbRefreshNameDl() {
  const dl = document.getElementById('tb-ten-dl');
  if (!dl) return;
  const names = tbGetNames(window.cats);
  dl.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');
}

// Intentionally disabled — danh mục tbTen là danh sách mẫu, không tự xóa
function pruneTbTen() { /* no-op */ }

// ══════════════════════════════════════════════════════════════
// POPULATE SELECTS
// ══════════════════════════════════════════════════════════════

function tbPopulateSels() {
  const sel = document.getElementById('tb-ct-sel');
  if (!sel) return;
  const cur = sel.value;
  const allProjs = (typeof window.getAllProjects === 'function' ? window.getAllProjects() : []);
  const activeYear = window.activeYear || 0;

  // Entry select: KHO TỔNG + projects trong năm đang chọn
  const entryProjs = allProjs.filter(p =>
    activeYear === 0 || p.name === cur ||
    (typeof window._ctInActiveYear === 'function' && window._ctInActiveYear(p.name))
  );
  sel.innerHTML = '<option value="">-- Chọn công trình --</option>' +
    `<option value="${TB_KHO_TONG}" data-pid="COMPANY"${cur === TB_KHO_TONG ? ' selected' : ''}>${TB_KHO_TONG}</option>` +
    entryProjs.map(p =>
      `<option value="${escapeHtml(p.name)}" data-pid="${p.id}"${p.name === cur ? ' selected' : ''}>${escapeHtml(p.name)}</option>`
    ).join('');

  // Filter select
  const fSel = document.getElementById('tb-filter-ct');
  if (fSel) {
    const fCur = fSel.value;
    const filterProjs = allProjs.filter(p =>
      activeYear === 0 ||
      (typeof window._ctInActiveYear === 'function' && window._ctInActiveYear(p.name))
    );
    fSel.innerHTML = `<option value="">Tất cả công trình</option>` +
      `<option value="${TB_KHO_TONG}"${fCur === TB_KHO_TONG ? ' selected' : ''}>${TB_KHO_TONG}</option>` +
      filterProjs.map(p =>
        `<option value="${escapeHtml(p.name)}"${p.name === fCur ? ' selected' : ''}>${escapeHtml(p.name)}</option>`
      ).join('');
  }

  // Bộ lọc tên KHO: chỉ lấy tên có trong cats.tbTen
  const tbData = window.tbData || [];
  const cats   = window.cats  || {};
  const validNames = new Set((cats.tbTen || []).map(n => n.toLowerCase()));

  const khoFSel = document.getElementById('kho-filter-ten');
  if (khoFSel) {
    const khoNames = [...new Set(
      tbData.filter(r => !r.deletedAt && isKhoTong(r) && r.ten && validNames.has(r.ten.toLowerCase()))
            .map(r => r.ten)
    )].sort((a, b) => a.localeCompare(b, 'vi'));
    const khoFCur = khoFSel.value;
    khoFSel.innerHTML = '<option value="">Tất cả thiết bị</option>' +
      khoNames.map(v => `<option value="${escapeHtml(v)}" ${v === khoFCur ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
  }

  // Bộ lọc tên Thống Kê: chỉ lấy từ cats.tbTen
  const tkFSel = document.getElementById('tk-filter-ten');
  if (tkFSel) {
    const tkNames = tbGetNames(cats);
    const tkFCur  = tkFSel.value;
    tkFSel.innerHTML = '<option value="">Tất cả thiết bị</option>' +
      tkNames.map(v => `<option value="${escapeHtml(v)}" ${v === tkFCur ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
  }
}

// ══════════════════════════════════════════════════════════════
// ENTRY TABLE
// ══════════════════════════════════════════════════════════════

function tbBuildRows(n = 5) {
  const tbody = document.getElementById('tb-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (let i = 0; i < n; i++) tbAddRow(null, i + 1);
}

function tbAddRows(n) {
  const tbody = document.getElementById('tb-tbody');
  if (!tbody) return;
  const cur = tbody.querySelectorAll('tr').length;
  for (let i = 0; i < n; i++) tbAddRow(null, cur + i + 1);
}

// Rebuild options tên thiết bị trong bảng nhập
function tbRefreshTenSel() {
  const cats  = window.cats || {};
  const names = tbGetNames(cats);
  document.querySelectorAll('#tb-tbody [data-tb="ten"]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- Chọn --</option>' +
      names.map(n => `<option value="${escapeHtml(n)}" ${n === cur ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
    sel.value = cur;
  });
}

function tbAddRow(data, num) {
  const tbody = document.getElementById('tb-tbody');
  if (!tbody) return;
  const idx = num || (tbody.querySelectorAll('tr').length + 1);
  const tr  = document.createElement('tr');

  const cats = window.cats || {};
  const ttOpts = TB_TINH_TRANG.map(v =>
    `<option value="${v}" ${data && data.tinhtrang === v ? 'selected' : v === 'Đang hoạt động' && !data ? 'selected' : ''}>${v}</option>`
  ).join('');

  const names   = tbGetNames(cats);
  const tenOpts = '<option value="">-- Chọn --</option>' +
    names.map(n => `<option value="${escapeHtml(n)}" ${data && data.ten === n ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');

  tr.innerHTML = `
    <td class="row-num">${idx}</td>
    <td class="tb-name-col" style="padding:0">
      <select data-tb="ten"
        style="width:100%;border:none;background:transparent;padding:7px 10px;font-size:13px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink);cursor:pointer">
        ${tenOpts}
      </select>
    </td>
    <td style="padding:0">
      <input type="number" data-tb="soluong" class="np-num-input" min="0" step="1" inputmode="decimal"
        value="${data?.soluong || ''}" placeholder="0"
        style="width:100%;border:none;background:transparent;padding:7px 8px;text-align:center;font-size:13px;font-family:'IBM Plex Mono',monospace;outline:none;color:var(--ink)">
    </td>
    <td style="padding:0">
      <select data-tb="tinhtrang"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink);cursor:pointer">
        ${ttOpts}
      </select>
    </td>
    <td style="padding:0">
      <input class="cc-name-input" data-tb="ghichu"
        value="${escapeHtml(data?.ghichu || '')}" placeholder="—"
        style="width:100%;border:none;background:transparent;padding:7px 8px;font-size:12px;font-family:'IBM Plex Sans',sans-serif;outline:none;color:var(--ink)">
    </td>
    <td style="padding:3px 4px;text-align:center">
      <button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove();tbRenum()" title="Xóa dòng">✕</button>
    </td>`;
  tbody.appendChild(tr);
}

function tbRenum() {
  document.querySelectorAll('#tb-tbody tr').forEach((tr, i) => {
    const numCell = tr.querySelector('.row-num');
    if (numCell) numCell.textContent = i + 1;
  });
}

function tbClearRows() {
  if (!confirm('Xóa bảng nhập?')) return;
  tbBuildRows();
}

// ══════════════════════════════════════════════════════════════
// SAVE
// ══════════════════════════════════════════════════════════════

function tbSave() {
  const saveBtn = document.getElementById('tb-save-btn');
  if (saveBtn && saveBtn.disabled) return;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Đang lưu...'; }

  const tbCtSel = document.getElementById('tb-ct-sel');
  if (!tbCtSel) { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; } return; }

  const ct    = tbCtSel.value.trim();
  const ctPid = (typeof window._readPidFromSel === 'function') ? window._readPidFromSel(tbCtSel) : null;

  if (!ct) {
    if (typeof window.toast === 'function') window.toast('Vui lòng chọn công trình!', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
    return;
  }
  if (typeof window._checkProjectClosed === 'function' && window._checkProjectClosed(ctPid, ct)) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
    return;
  }

  const rows = [];
  const ngay = today();
  document.querySelectorAll('#tb-tbody tr').forEach(tr => {
    const ten    = tr.querySelector('[data-tb="ten"]')?.value || '';
    const sl     = parseFloat(tr.querySelector('[data-tb="soluong"]')?.value) || 0;
    const tt     = tr.querySelector('[data-tb="tinhtrang"]')?.value || 'Đang hoạt động';
    const ghichu = tr.querySelector('[data-tb="ghichu"]')?.value?.trim() || '';
    if (ten) rows.push({ ten, soluong: sl, tinhtrang: tt, ghichu });
  });

  if (!rows.length) {
    if (typeof window.toast === 'function') window.toast('Không có dữ liệu để lưu!', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
    return;
  }

  const savePid = ct === TB_KHO_TONG ? 'COMPANY' : (ctPid || null);
  const tbData  = window.tbData;

  rows.forEach(row => {
    const exist = tbData.find(rec =>
      !rec.deletedAt && rec.ten === row.ten && rec.tinhtrang === row.tinhtrang &&
      (savePid ? (rec.projectId === savePid) : rec.ct === ct)
    );
    if (exist) {
      exist.soluong   = (exist.soluong || 0) + row.soluong;
      exist.ngay      = ngay;
      exist.updatedAt = Date.now();
      exist.deviceId  = window.DEVICE_ID;
      if (row.ghichu) exist.ghichu = row.ghichu;
      if (savePid) { exist.projectId = savePid; }
      if (savePid === 'COMPANY') { exist.ct = TB_KHO_TONG; }
      else {
        const n = (typeof window._getProjectNameById === 'function') ? window._getProjectNameById(savePid) : null;
        if (n) exist.ct = n;
      }
    } else {
      tbData.push(window.mkRecord({ ct, projectId: savePid, ...row, ngay }));
    }
  });

  window.save('tb_v1', window.tbData);
  tbPage = 1;
  const fSel = document.getElementById('tb-filter-ct');
  if (fSel) fSel.value = '';
  tbRefreshTenSel();
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  tbBuildRows();
  if (typeof window.toast === 'function') window.toast(`✅ Đã lưu ${rows.length} thiết bị vào ${ct}`, 'success');
  setTimeout(() => {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu thiết bị'; }
  }, 1500);
}

// ══════════════════════════════════════════════════════════════
// RENDER LIST (Công Trình — không gồm KHO TỔNG)
// ══════════════════════════════════════════════════════════════

function tbRenderList() {
  const fCt = document.getElementById('tb-filter-ct')?.value || '';
  const fTt = document.getElementById('tb-filter-tt')?.value || '';
  const fQ  = (document.getElementById('tb-search')?.value || '').toLowerCase().trim();

  const tbData     = window.tbData || [];
  const activeYear  = window.activeYear || 0;
  const activeYears = window.activeYears;

  let filtered = tbData.filter(r => {
    if (r.deletedAt) return false;
    if (isKhoTong(r) || r.ct === TB_KHO_TONG) return false;
    if (fCt && !(r.projectId === fCt || r.ct === fCt)) return false;
    if (fTt && r.tinhtrang !== fTt) return false;
    if (fQ && !(r.ten || '').toLowerCase().includes(fQ) &&
              !(r.nguoi || '').toLowerCase().includes(fQ) &&
              !(r.ghichu || '').toLowerCase().includes(fQ)) return false;
    if (activeYears ? activeYears.size > 0 : activeYear !== 0) {
      const ctActive = (typeof window._entityInYear === 'function' && window._entityInYear(r.ct, 'ct')) ||
                       (typeof window.inActiveYear === 'function' && window.inActiveYear(r.ngay));
      const isRunning = r.tinhtrang === 'Đang hoạt động';
      if (!ctActive && !isRunning) return false;
    }
    return true;
  });

  const allProjs = (typeof window.getAllProjects === 'function' ? window.getAllProjects() : []);
  const projOrder = allProjs.map(p => p.name);
  const getProjIdx = name => { const i = projOrder.indexOf(name); return i === -1 ? 999 : i; };

  filtered.sort((a, b) => {
    const ctA = (typeof window._resolveCtName === 'function') ? window._resolveCtName(a) : (a.ct || '');
    const ctB = (typeof window._resolveCtName === 'function') ? window._resolveCtName(b) : (b.ct || '');
    if (ctA !== ctB) return getProjIdx(ctA) - getProjIdx(ctB);
    return (a.ten || '').localeCompare(b.ten || '', 'vi');
  });

  const tbody = document.getElementById('tb-list-tbody');
  if (!tbody) return;
  const start = (tbPage - 1) * TB_PG;
  const paged = filtered.slice(start, start + TB_PG);

  if (!paged.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Chưa có thiết bị nào${fCt ? ' tại ' + fCt : ''}</td></tr>`;
    const pgEl = document.getElementById('tb-pagination');
    if (pgEl) pgEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = paged.map(r => {
    const ttStyle  = TB_STATUS_STYLE[r.tinhtrang] || '';
    const ttOpts   = TB_TINH_TRANG.map(v =>
      `<option value="${v}" ${r.tinhtrang === v ? 'selected' : ''}>${v}</option>`
    ).join('');
    const ctDisplay = (typeof window._resolveCtName === 'function') ? window._resolveCtName(r) : (r.ct || '');
    return `<tr data-tbid="${r.id}">
      <td class="tb-ct-col" title="${escapeHtml(ctDisplay)}">${escapeHtml(ctDisplay)}</td>
      <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${escapeHtml(r.ten)}</span></td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong || 0}</td>
      <td>
        <select onchange="tbUpdateField('${r.id}','tinhtrang',this.value)"
          class="tb-status" style="cursor:pointer;border:1px solid var(--line2);${ttStyle}">
          ${ttOpts}
        </select>
      </td>
      <td style="color:var(--ink2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.ghichu)}">${escapeHtml(r.ghichu || '—')}</td>
      <td style="padding:6px 4px">
        <button class="btn btn-sm" onclick="tbLuanChuyen('${r.id}')"
          style="background:#2563eb;color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit;white-space:nowrap">↩ Luân chuyển</button>
      </td>
    </tr>`;
  }).join('');

  const tp  = Math.ceil(filtered.length / TB_PG);
  let pag   = `<span>${filtered.length} thiết bị</span>`;
  if (tp > 1) {
    pag += '<div class="page-btns">';
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      pag += `<button class="page-btn ${p === tbPage ? 'active' : ''}" onclick="tbGoTo(${p})">${p}</button>`;
    }
    pag += '</div>';
  }
  const pgEl = document.getElementById('tb-pagination');
  if (pgEl) pgEl.innerHTML = pag;
}

function tbGoTo(p) { tbPage = p; tbRenderList(); }

// ══════════════════════════════════════════════════════════════
// INLINE UPDATE / SOFT-DELETE
// ══════════════════════════════════════════════════════════════

function tbUpdateField(id, field, val) {
  const tbData = window.tbData || [];
  const idx    = tbData.findIndex(r => r.id === id);
  if (idx < 0) return;
  tbData[idx][field]     = val;
  tbData[idx].updatedAt  = Date.now();
  tbData[idx].deviceId   = window.DEVICE_ID;
  window.save('tb_v1', window.tbData);
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  if (typeof window.toast === 'function') window.toast('✅ Đã cập nhật tình trạng', 'success');
}

function tbDeleteRow(id) {
  const tbData = window.tbData || [];
  const r = tbData.find(rec => rec.id === id);
  if (!r) return;
  if (!isKhoTong(r)) {
    if (typeof window.toast === 'function') window.toast('Không thể xóa thiết bị ở công trình!', 'error');
    return;
  }
  if (!confirm('Xóa thiết bị này khỏi Kho Tổng?')) return;
  window.tbData = window.softDeleteRecord(window.tbData, id);
  window.save('tb_v1', window.tbData);
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  if (typeof window.toast === 'function') window.toast('Đã xóa thiết bị khỏi Kho Tổng');
}

// ══════════════════════════════════════════════════════════════
// LUÂN CHUYỂN (transfer overlay)
// ══════════════════════════════════════════════════════════════

function tbLuanChuyen(id) {
  const tbData = window.tbData || [];
  const r = tbData.find(rec => rec.id === id);
  if (!r) return;

  let ov = document.getElementById('tb-edit-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tb-edit-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick = function(e) { if (e.target === this) this.remove(); };
    document.body.appendChild(ov);
  }

  const isKho = isKhoTong(r);
  const allProjs = (typeof window.getAllProjects === 'function' ? window.getAllProjects() : [])
    .filter(p => p.id !== 'COMPANY');

  const ctOpts = (isKho ? [] : [`<option value="${TB_KHO_TONG}">${TB_KHO_TONG}</option>`])
    .concat(allProjs.map(p =>
      `<option value="${escapeHtml(p.name)}" data-pid="${p.id}"${p.name === r.ct && !isKho ? ' selected' : ''}>${escapeHtml(p.name)}</option>`
    )).join('');

  const ttOpts   = TB_TINH_TRANG.map(v =>
    `<option value="${v}" ${r.tinhtrang === v ? 'selected' : ''}>${v}</option>`
  ).join('');
  const srcLabel = isKho ? 'KHO TỔNG' : escapeHtml(r.ct);
  const hintText = `Phần còn lại (SL cũ − X) giữ lại tại <b>${srcLabel}</b>.`;

  ov.innerHTML = `
  <div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,96vw);box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:'IBM Plex Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700">↩ Luân Chuyển Thiết Bị</h3>
      <button onclick="document.getElementById('tb-edit-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="display:grid;gap:10px">
      <div style="background:#f8f8f5;border-radius:8px;padding:10px;font-size:12px">
        <span style="color:#888">Từ:</span> <b>${srcLabel}</b> &nbsp;·&nbsp;
        <span style="color:#888">Tên:</span> <b>${escapeHtml(r.ten)}</b> &nbsp;·&nbsp;
        <span style="color:#888">SL hiện tại:</span> <b>${r.soluong || 0}</b>
      </div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Chuyển đến Công Trình</label>
        <select id="tb-ei-ct" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none">
          <option value="">-- Chọn --</option>${ctOpts}</select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Số Lượng chuyển <span style="font-weight:400;color:var(--ink3)">(tối đa ${r.soluong || 0})</span></label>
          <input id="tb-ei-sl" type="number" class="np-num-input" min="1" max="${r.soluong || 0}" value="${r.soluong || 0}" inputmode="decimal"
            style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
        <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Tình Trạng</label>
          <select id="tb-ei-tt" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none">${ttOpts}</select></div>
      </div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Ghi Chú</label>
        <input id="tb-ei-ghichu" type="text" value="${escapeHtml(r.ghichu || '')}"
          style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div style="background:#f0f7ff;border-radius:8px;padding:10px;font-size:12px;color:#1565c0">
        ℹ️ SL nhập = số lượng chuyển đi. ${hintText}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="document.getElementById('tb-edit-overlay').remove()"
        style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Hủy</button>
      <button onclick="tbSaveEdit('${r.id}')"
        style="flex:2;padding:10px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">↩ Xác Nhận Luân Chuyển</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
}

function tbSaveEdit(id) {
  const tbData = window.tbData || [];
  const idx = tbData.findIndex(rec => rec.id === id);
  if (idx < 0) return;
  const r = tbData[idx];

  const eiCtSel  = document.getElementById('tb-ei-ct');
  const newCT    = eiCtSel.value.trim();
  const newCtPid = eiCtSel.options[eiCtSel.selectedIndex]?.dataset?.pid || null;
  const newSL    = parseFloat(document.getElementById('tb-ei-sl').value) || 0;
  const newTT    = document.getElementById('tb-ei-tt').value;
  const newGhichu = document.getElementById('tb-ei-ghichu').value.trim();
  const oldSL    = r.soluong || 0;
  const ngay     = today();

  if (!newCT) {
    if (typeof window.toast === 'function') window.toast('Vui lòng chọn công trình!', 'error');
    return;
  }
  if (newSL <= 0 || newSL > oldSL) {
    if (typeof window.toast === 'function') window.toast(`Số lượng không hợp lý (phải từ 1 đến ${oldSL})!`, 'error');
    return;
  }

  const remaining = oldSL - newSL;
  const srcCt     = r.ct;
  const srcPid    = r.projectId;

  // Soft-delete record gốc
  window.tbData = window.softDeleteRecord(window.tbData, id);

  // Thêm/cộng dồn số lượng chuyển đi vào newCT
  const destPid   = newCT === TB_KHO_TONG ? 'COMPANY' : (newCtPid || null);
  const destExist = window.tbData.find(rec =>
    !rec.deletedAt && rec.ten === r.ten && rec.tinhtrang === newTT &&
    (destPid ? rec.projectId === destPid : rec.ct === newCT)
  );
  if (destExist) {
    destExist.soluong   = (destExist.soluong || 0) + newSL;
    destExist.updatedAt = Date.now();
    destExist.deviceId  = window.DEVICE_ID;
    if (newGhichu) destExist.ghichu = newGhichu;
    destExist.ngay = ngay;
  } else {
    window.tbData.push({
      id: window.uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: window.DEVICE_ID,
      ct: newCT, projectId: destPid,
      ten: r.ten, soluong: newSL, tinhtrang: newTT,
      ghichu: newGhichu, ngay,
    });
  }

  // Phần còn lại → giữ lại tại nguồn
  if (remaining > 0) {
    const srcExist = window.tbData.find(rec =>
      !rec.deletedAt && rec.ten === r.ten && rec.tinhtrang === r.tinhtrang &&
      (srcPid ? rec.projectId === srcPid : rec.ct === srcCt)
    );
    if (srcExist) {
      srcExist.soluong   = (srcExist.soluong || 0) + remaining;
      srcExist.updatedAt = Date.now();
      srcExist.deviceId  = window.DEVICE_ID;
      srcExist.ngay = ngay;
    } else {
      window.tbData.push({
        id: window.uuid(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: window.DEVICE_ID,
        ct: srcCt, projectId: srcCt === TB_KHO_TONG ? 'COMPANY' : (srcPid || null),
        ten: r.ten, soluong: remaining,
        tinhtrang: r.tinhtrang, ghichu: r.ghichu || '', ngay,
      });
    }
  }

  window.save('tb_v1', window.tbData);
  document.getElementById('tb-edit-overlay').remove();
  tbPopulateSels();
  tbRenderList();
  tbRenderThongKeVon();
  renderKhoTong();
  if (typeof window.toast === 'function') window.toast('✅ Đã cập nhật thiết bị!', 'success');
}

// ══════════════════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════════════════

function tbExportCSV() {
  const fCt    = document.getElementById('tb-filter-ct')?.value || '';
  const fTt    = document.getElementById('tb-filter-tt')?.value || '';
  const tbData = window.tbData || [];
  const data   = tbData.filter(r => {
    if (r.deletedAt) return false;
    if (fCt && r.ct !== fCt) return false;
    if (fTt && r.tinhtrang !== fTt) return false;
    return true;
  });
  const rows = [['Công Trình', 'Tên Thiết Bị', 'Số Lượng', 'Tình Trạng', 'Người TH', 'Ghi Chú', 'Cập Nhật']];
  data.forEach(r => {
    const ct = (typeof window._resolveCtName === 'function') ? window._resolveCtName(r) : (r.ct || '');
    rows.push([ct, r.ten, r.soluong || 0, r.tinhtrang || '', r.nguoi || '', r.ghichu || '', r.ngay || '']);
  });
  if (typeof window.dlCSV === 'function') window.dlCSV(rows, 'thiet_bi_' + today() + '.csv');
}

// ══════════════════════════════════════════════════════════════
// KHO TỔNG
// ══════════════════════════════════════════════════════════════

function renderKhoTong() {
  const tbody = document.getElementById('kho-list-tbody');
  if (!tbody) return;

  const fTen   = document.getElementById('kho-filter-ten')?.value || '';
  const fTt    = document.getElementById('kho-filter-tt')?.value  || '';
  const tbData = window.tbData || [];

  let filtered = tbData.filter(r => {
    if (r.deletedAt) return false;
    if (!isKhoTong(r)) return false;
    if (fTen && r.ten !== fTen) return false;
    if (fTt  && r.tinhtrang !== fTt) return false;
    return true;
  });

  filtered.sort((a, b) => (a.ten || '').localeCompare(b.ten, 'vi'));

  const start = (khoPage - 1) * KHO_PG;
  const paged = filtered.slice(start, start + KHO_PG);

  if (!paged.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Kho tổng trống</td></tr>';
    const pgEl = document.getElementById('kho-pagination');
    if (pgEl) pgEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = paged.map(r => {
    const ttStyle = TB_STATUS_STYLE[r.tinhtrang] || '';
    return `<tr data-tbid="${r.id}">
      <td class="tb-name-col"><span class="tb-name-cell" style="font-weight:600;font-size:13px">${escapeHtml(r.ten)}</span></td>
      <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:14px;color:var(--gold)">${r.soluong || 0}</td>
      <td><span class="tb-status" style="${ttStyle}">${escapeHtml(r.tinhtrang || '')}</span></td>
      <td style="color:var(--ink2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(r.ghichu)}">${escapeHtml(r.ghichu || '—')}</td>
      <td style="font-size:10px;color:var(--ink3);white-space:nowrap">${r.ngay || ''}</td>
      <td style="padding:6px 4px;display:flex;gap:4px;flex-wrap:nowrap">
        <button class="btn btn-sm" onclick="tbLuanChuyen('${r.id}')"
          style="background:#2563eb;color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit;white-space:nowrap">↩ Luân chuyển</button>
        <button class="btn btn-danger btn-sm" onclick="tbDeleteRow('${r.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  const tp  = Math.ceil(filtered.length / KHO_PG);
  let pag   = `<span>${filtered.length} thiết bị</span>`;
  if (tp > 1) {
    pag += '<div class="page-btns">';
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      pag += `<button class="page-btn ${p === khoPage ? 'active' : ''}" onclick="khoGoTo(${p})">${p}</button>`;
    }
    pag += '</div>';
  }
  const pgEl = document.getElementById('kho-pagination');
  if (pgEl) pgEl.innerHTML = pag;
}

function khoGoTo(p) { khoPage = p; renderKhoTong(); }

// ══════════════════════════════════════════════════════════════
// THỐNG KÊ THIẾT BỊ THEO CÔNG TRÌNH
// ══════════════════════════════════════════════════════════════

function tbRenderThongKeVon() {
  const tbody = document.getElementById('tb-vonke-tbody');
  if (!tbody) return;

  const tbData = window.tbData || [];
  const map    = {};

  tbData.forEach(r => {
    if (r.deletedAt || !r.ct || isKhoTong(r)) return;
    const gKey      = r.projectId || r.ct;
    const ctDisplay = (typeof window._resolveCtName === 'function') ? window._resolveCtName(r) : (r.ct || '');
    if (!map[gKey]) map[gKey] = { ct: ctDisplay, total: 0, types: new Set() };
    map[gKey].total += (r.soluong || 0);
    if (r.ten) map[gKey].types.add(r.ten);
  });

  const items = Object.values(map).sort((a, b) => a.ct.localeCompare(b.ct, 'vi'));
  const pgEl  = document.getElementById('tk-pagination');

  if (!items.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Chưa có thiết bị tại công trình nào</td></tr>';
    if (pgEl) pgEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = items.map(item => `<tr>
    <td style="font-weight:600">${escapeHtml(item.ct)}</td>
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;color:var(--gold)">${item.total}</td>
    <td style="text-align:center;color:var(--ink3);font-size:13px">${item.types.size} loại</td>
  </tr>`).join('');

  if (pgEl) pgEl.innerHTML = `<span>${items.length} công trình</span>`;
}

// ══════════════════════════════════════════════════════════════
// FILTER KHO (realtime DOM text filter)
// ══════════════════════════════════════════════════════════════

function filterKhoTable() {
  const query = (document.getElementById('kho-search')?.value || '').toLowerCase().trim();
  const rows  = document.querySelectorAll('#kho-list-tbody tr');
  rows.forEach(row => {
    if (row.classList.contains('empty-row')) return;
    const nameCell = row.querySelector('.tb-name-col');
    if (!nameCell) return;
    row.style.display = nameCell.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// INIT — wire all window bridges
// ══════════════════════════════════════════════════════════════

export function initEquipmentUI() {
  // HTML builders (also exported, but bridge for legacy inline handlers)
  window.buildTbNameOpts      = buildTbNameOpts;
  window.buildTbTtOpts        = buildTbTtOpts;
  window.buildTbEntryRowHtml  = buildTbEntryRowHtml;
  window.buildTbListRowHtml   = buildTbListRowHtml;
  window.buildKhoRowHtml      = buildKhoRowHtml;
  window.buildTbStatsRowHtml  = buildTbStatsRowHtml;
  window.buildTbPaginationHtml = buildTbPaginationHtml;
  window.buildTbCtEntryOpts   = buildTbCtEntryOpts;
  window.buildTbCtFilterOpts  = buildTbCtFilterOpts;

  // Operational functions
  window.tbRefreshNameDl    = tbRefreshNameDl;
  window.pruneTbTen         = pruneTbTen;
  window.tbPopulateSels     = tbPopulateSels;
  window.tbBuildRows        = tbBuildRows;
  window.tbAddRows          = tbAddRows;
  window.tbRefreshTenSel    = tbRefreshTenSel;
  window.tbAddRow           = tbAddRow;
  window.tbRenum            = tbRenum;
  window.tbClearRows        = tbClearRows;
  window.tbSave             = tbSave;
  window.tbRenderList       = tbRenderList;
  window.tbGoTo             = tbGoTo;
  window.tbUpdateField      = tbUpdateField;
  window.tbDeleteRow        = tbDeleteRow;
  window.tbLuanChuyen       = tbLuanChuyen;
  window.tbSaveEdit         = tbSaveEdit;
  window.tbExportCSV        = tbExportCSV;
  window.renderKhoTong      = renderKhoTong;
  window.khoGoTo            = khoGoTo;
  window.tbRenderThongKeVon = tbRenderThongKeVon;
  window.filterKhoTable     = filterKhoTable;

  // Alias bridges: legacy names used by index.html / other modules
  window.saveTBRecord  = tbSave;
  window.delTBRecord   = tbDeleteRow;
  window.editTBRecord  = tbLuanChuyen;
  window.saveEditTB    = tbSaveEdit;

  console.log('[equipment.ui] ✅ initEquipmentUI complete');
}

console.log('[equipment.ui] ES Module loaded ✅');
