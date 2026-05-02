// ══════════════════════════════════════════════════════════════
// src/modules/payroll/payroll.ui.js — Payroll UI Module
// Prompt 14 — Port từ chamcong.js (phần UI/DOM)
//
// DELEGATE sang legacy chamcong.js (còn giữ nguyên):
//   saveCCWeek, delCCWeekById, delCCWorker,
//   normalizeAllChamCong, rebuildCCCategories, updateTopFromCC,
//   exportUngToImage, loadCCWeekFromHistory, delCCWeekHistory
// ══════════════════════════════════════════════════════════════

import {
  CC_DAY_LABELS, CC_DATE_OFFSETS, CC_PG_HIST, CC_PG_TLT,
  ccSundayISO, ccSaturdayISO, snapToSunday,
  viShort, weekLabel, round1,
  calcDebtBefore,
  prepareCopyData, createWorkerStubs, ccAllNames,
} from './payroll.logic.js';

// ══════════════════════════════════════════════════════════════
//  MODULE STATE
//  ccData KHÔNG đặt ở đây — luôn đọc từ window.ccData || []
//
//  ccHistPage / ccTltPage đặt trên window vì index.html inline
//  handlers ghi trực tiếp: onchange="ccHistPage=1;renderCCHistory()"
// ══════════════════════════════════════════════════════════════
let ccOffset          = 0;
let ccClipboard       = null;
let _ccDebtColsHidden = true;

// Pagination state — phải là window globals để inline handlers tương thích
window.ccHistPage = window.ccHistPage || 1;
window.ccTltPage  = window.ccTltPage  || 1;

// ══════════════════════════════════════════════════════════════
//  ĐÃ CÓ TỪ TRƯỚC — giữ nguyên
// ══════════════════════════════════════════════════════════════

export function fmtK(v) {
  const k = Math.round((v || 0) / 1000);
  return k.toLocaleString('vi-VN') + ' k';
}

export function rebuildCCNameList(allNames) {
  let dl = document.getElementById('cc-name-dl');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'cc-name-dl';
    document.body.appendChild(dl);
  }
  const _x = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  dl.innerHTML = (allNames || []).map(n => `<option value="${_x(n)}">`).join('');
}

export function calcWeekOffset(sundayISO) {
  const thisSun = ccSundayISO(0);
  const [ty, tm, td] = thisSun.split('-').map(Number);
  const [fy, fm, fd] = sundayISO.split('-').map(Number);
  const diffMs = new Date(fy, fm - 1, fd) - new Date(ty, tm - 1, td);
  return Math.round(diffMs / (7 * 86400000));
}

export function calcCCTopTotal(ccData, invoices, activeYears) {
  const inYear = dateStr => {
    if (!activeYears || activeYears.size === 0) return true;
    if (!dateStr) return false;
    return activeYears.has(parseInt(dateStr.slice(0, 4)));
  };
  let ccTotal = 0;
  (ccData || []).forEach(w => {
    if (w.deletedAt || !inYear(w.fromDate)) return;
    (w.workers || []).forEach(wk => {
      const tc = (wk.d || []).reduce((s, v) => s + (Number(v) || 0), 0);
      ccTotal += tc * (wk.luong || 0) + (wk.phucap || 0) + (wk.hdmuale || 0);
    });
  });
  const manualTotal = (invoices || [])
    .filter(i => !i.deletedAt && inYear(i.ngay))
    .reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  return ccTotal + manualTotal;
}

export function initPayrollUI() {
  console.log('[payroll.ui] initPayrollUI called — module active');
}

// ══════════════════════════════════════════════════════════════
//  PURE HELPERS
// ══════════════════════════════════════════════════════════════

export function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function _fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

/** Wrapper quanh calcDebtBefore từ payroll.logic.js — dùng window.ccData */
function _calcDebtBefore(workerName, fromDate) {
  return calcDebtBefore(workerName, fromDate, window.ccData || []);
}

// ══════════════════════════════════════════════════════════════
//  DEBT COLUMNS UI
// ══════════════════════════════════════════════════════════════

function _applyCCDebtColsVisibility() {
  const table = document.getElementById('cc-thead-row')?.closest('table');
  if (!table) return;
  table.classList.toggle('debt-cols-hidden', _ccDebtColsHidden);
  document.querySelectorAll('.cc-debt-toggle-th').forEach(th => {
    th.textContent = _ccDebtColsHidden ? '▶' : '◀';
    th.title = _ccDebtColsHidden
      ? 'Mở rộng: HĐ Mua Lẻ / Nội Dung / Nợ Cũ / Vay Mới / Trừ Nợ'
      : 'Thu gọn';
  });
}

export function toggleCCDebtCols() {
  _ccDebtColsHidden = !_ccDebtColsHidden;
  _applyCCDebtColsVisibility();
}

// ══════════════════════════════════════════════════════════════
//  INPUT HANDLERS (gắn bởi buildCCRow, không cần window bridge)
// ══════════════════════════════════════════════════════════════

function onCCNameInput(inp) {
  const cats     = window.cats || {};
  const cnRoles  = window.cnRoles || {};
  const _toast   = typeof window.toast === 'function' ? window.toast : () => {};

  const name = inp.value.trim();
  if (!name) { inp.style.boxShadow = ''; inp.title = ''; return; }

  // Chống trùng tên
  const nameLower = name.toLowerCase();
  let count = 0;
  document.querySelectorAll('#cc-tbody [data-cc="name"]').forEach(el => {
    if (el.value.trim().toLowerCase() === nameLower) count++;
  });
  if (count > 1) {
    inp.style.boxShadow = 'inset 0 0 0 2px var(--red)';
    inp.title = '⚠️ Tên trùng! Vui lòng đổi tên để phân biệt.';
    _toast('⚠️ Tên "' + name + '" bị trùng – hãy đổi tên để tránh nhầm lẫn!', 'error');
  } else {
    inp.style.boxShadow = '';
    inp.title = '';
  }

  // Auto-fill T/P nếu thợ có trong danh mục
  const tr = inp.closest('tr');
  if (!tr) return;
  const tpInput   = tr.querySelector('[data-cc="tp"]');
  const tpDisplay = tr.querySelector('.cc-tp-display');
  if (!tpInput) return;
  const known = (cats.congNhan || []).find(n => n.toLowerCase() === nameLower);
  const role  = known ? (cnRoles[known] || '') : '';
  tpInput.value = role;
  if (tpDisplay) {
    tpDisplay.textContent = role || '—';
    tpDisplay.style.color = role ? 'var(--ink)' : 'var(--ink3)';
  }
}

function onCCDayKey(inp) {
  const n = parseFloat(inp.value.replace(',', '.')) || 0;
  inp.classList.toggle('has-val', n === 1);
  inp.classList.toggle('half-val', n > 0 && n < 1);
  calcCCRow(inp.closest('tr'));
}

function onCCWageKey(inp) {
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const raw = inp.value.replace(/\./g, '').replace(/,/g, '');
  inp.dataset.raw = raw;
  if (raw) inp.value = numFmt(parseInt(raw) || 0);
  calcCCRow(inp.closest('tr'));
}

function onCCMoneyKey(inp) {
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const raw = inp.value.replace(/\./g, '').replace(/,/g, '');
  inp.dataset.raw = raw;
  if (raw) inp.value = numFmt(parseInt(raw) || 0);
  calcCCRow(inp.closest('tr'));
}

// ══════════════════════════════════════════════════════════════
//  ROW/TABLE FUNCTIONS
// ══════════════════════════════════════════════════════════════

export function calcCCRow(tr) {
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  let tc = 0;
  for (let i = 0; i < 7; i++) tc += parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value || 0) || 0;
  tc = round1(tc);
  tr.querySelector('[data-cc="tc"]').textContent = tc || 0;

  const luong  = parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw || 0) || 0;
  const total  = tc * luong;
  const phucap = parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw || 0) || 0;
  const hdml   = parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw || 0) || 0;
  const loan   = parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw || 0) || 0;
  const tru    = parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw || 0) || 0;

  const totCell = tr.querySelector('[data-cc="total"]');
  totCell.textContent = total > 0 ? numFmt(total) : '—';
  totCell.style.color = total > 0 ? 'var(--green)' : 'var(--ink3)';

  // Nợ cũ
  const workerName = (tr.querySelector('[data-cc="name"]')?.value || '').trim();
  const fromDate   = document.getElementById('cc-from')?.value || '';
  const debtBefore = _calcDebtBefore(workerName, fromDate);
  const debtCell   = tr.querySelector('[data-cc="debtbefore"]');
  if (debtCell) {
    if (debtBefore === 0)      { debtCell.textContent = '—';                              debtCell.style.color = 'var(--ink3)'; }
    else if (debtBefore > 0)   { debtCell.textContent = numFmt(debtBefore) + ' nợ';      debtCell.style.color = 'var(--red)'; }
    else                       { debtCell.textContent = numFmt(-debtBefore) + ' dư';     debtCell.style.color = 'var(--green)'; }
  }

  const thucLanh = total + phucap + loan + hdml - tru;
  const tcCell   = tr.querySelector('[data-cc="tongcong"]');
  if (thucLanh > 0)      { tcCell.textContent = numFmt(thucLanh);                tcCell.style.color = 'var(--gold)'; }
  else if (thucLanh < 0) { tcCell.textContent = '(' + numFmt(-thucLanh) + ')';  tcCell.style.color = 'var(--red)'; }
  else                   { tcCell.textContent = '—';                             tcCell.style.color = 'var(--ink3)'; }
}

export function delCCRow(btn) {
  btn.closest('tr').remove();
  renumberCC();
  updateCCSumRow();
}

function renumberCC() {
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach((tr, i) => {
    const el = tr.querySelector('.row-num');
    if (el) el.textContent = i + 1;
  });
}

export function buildCCRow(w, num) {
  const cats    = window.cats    || {};
  const cnRoles = window.cnRoles || {};
  const _x      = typeof window.x       === 'function' ? window.x       : s => String(s || '');
  const numFmt  = typeof window.numFmt  === 'function' ? window.numFmt  : n => n;
  const _toast  = typeof window.toast   === 'function' ? window.toast   : () => {};
  const _acShow = typeof window._acShow === 'function' ? window._acShow : null;
  const _nKey   = typeof window.normalizeKey === 'function' ? window.normalizeKey : s => s.toLowerCase();

  const ds         = w ? w.d          : [0, 0, 0, 0, 0, 0, 0];
  const luong      = w ? (w.luong      || 0) : 0;
  const phucap     = w ? (w.phucap     || 0) : 0;
  const hdml       = w ? (w.hdmuale    || 0) : 0;
  const loanAmount = w ? (w.loanAmount || 0) : 0;
  const tru        = w ? (w.tru        || 0) : 0;
  const role       = w?.role || (w?.name ? cnRoles[w.name] || '' : '');

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num col-num">${num}</td>
    <td class="cc-sticky-name col-name" style="padding:0">
      <input class="cc-name-input" data-cc="name"
        value="${_x(w ? w.name || '' : '')}" placeholder="Tên..." autocomplete="off">
    </td>
    <td class="col-tp" style="padding:4px 2px;text-align:center">
      <input type="hidden" data-cc="tp" value="${_x(role)}">
      <span class="cc-tp-display" style="display:inline-block;min-width:22px;font-size:12px;font-weight:700;color:${role ? 'var(--ink)' : 'var(--ink3)'}">${role || '—'}</span>
    </td>
    ${ds.map((v, i) => `<td class="col-day" style="padding:0"><input class="cc-day-input ${v === 1 ? 'has-val' : v > 0 && v < 1 ? 'half-val' : ''}"
      data-cc="d${i}" value="${v || ''}" placeholder="·" autocomplete="off" inputmode="decimal"></td>`).join('')}
    <td class="cc-tc-cell col-tc" data-cc="tc">0</td>
    <td class="col-luong" style="padding:0"><input class="cc-wage-input" data-cc="luong" data-raw="${luong || ''}" inputmode="decimal"
      value="${luong ? numFmt(luong) : ''}" placeholder="0"></td>
    <td class="cc-total-cell col-total-luong" data-cc="total">—</td>
    <td class="col-phucap" style="padding:0"><input class="cc-wage-input" data-cc="phucap" data-raw="${phucap || ''}" inputmode="decimal"
      value="${phucap ? numFmt(phucap) : ''}" placeholder="0"></td>
    <td class="cc-debt-col col-hdml" style="padding:0"><input class="cc-wage-input" data-cc="hdml" data-raw="${hdml || ''}" inputmode="decimal"
      value="${hdml ? numFmt(hdml) : ''}" placeholder="0"></td>
    <td class="cc-debt-col col-nd" style="padding:0"><input class="cc-name-input" data-cc="nd"
      value="${_x(w ? w.nd || '' : '')}" placeholder="Nội dung..."
      style="font-size:11px"></td>
    <td class="cc-debt-col col-debtbefore" data-cc="debtbefore" style="text-align:right;font-size:11px;padding:4px 6px;white-space:nowrap">—</td>
    <td class="cc-debt-col col-loan" style="padding:0"><input class="cc-wage-input" data-cc="loan" data-raw="${loanAmount || ''}" inputmode="decimal"
      value="${loanAmount ? numFmt(loanAmount) : ''}" placeholder="0" style="color:var(--gold)"></td>
    <td class="cc-debt-col col-tru" style="padding:0"><input class="cc-wage-input" data-cc="tru" data-raw="${tru || ''}" inputmode="decimal"
      value="${tru ? numFmt(tru) : ''}" placeholder="0" style="color:var(--red)"></td>
    <td class="cc-total-cell col-total" data-cc="tongcong" style="color:var(--gold);font-size:13px">—</td>
    <td class="col-del"><button class="del-btn" onclick="delCCRow(this)">✕</button></td>
  `;

  tr.querySelectorAll('[data-cc^="d"]').forEach(el =>
    el.addEventListener('input', () => { onCCDayKey(el); updateCCSumRow(); })
  );
  tr.querySelector('[data-cc="luong"]').addEventListener('input', function () { onCCWageKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="phucap"]').addEventListener('input', function () { onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="loan"]').addEventListener('input', function () { onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="hdml"]').addEventListener('input', function () { onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="tru"]').addEventListener('input', function () { onCCMoneyKey(this); updateCCSumRow(); });

  const nameInp = tr.querySelector('[data-cc="name"]');
  nameInp.addEventListener('input', function () {
    if (_acShow) _acShow(this, cats.congNhan || [], v => {
      this.value = v;
      onCCNameInput(this);
      updateCCSumRow();
    });
    onCCNameInput(this);
    updateCCSumRow();
  });
  nameInp.addEventListener('focus', function () {
    if (_acShow && (cats.congNhan || []).length)
      _acShow(this, cats.congNhan, v => { this.value = v; onCCNameInput(this); updateCCSumRow(); });
  });
  nameInp.addEventListener('blur', function () {
    const v = this.value.trim();
    if (!v) return;
    const canonical = (cats.congNhan || []).find(n => _nKey(n) === _nKey(v));
    if (!canonical) {
      this.style.boxShadow = 'inset 0 0 0 2px var(--red)';
      _toast('⚠️ "' + v + '" không có trong danh mục công nhân!', 'error');
      this.value = '';
      this.style.boxShadow = '';
      updateCCSumRow();
    } else {
      this.style.boxShadow = '';
      this.value = canonical;
    }
  });
  tr.querySelector('[data-cc="nd"]').addEventListener('input', updateCCSumRow);

  calcCCRow(tr);
  return tr;
}

function addCCRow(w) {
  const tbody = document.getElementById('cc-tbody');
  const num   = tbody.querySelectorAll('tr:not(.cc-sum-row)').length + 1;
  tbody.appendChild(buildCCRow(w, num));
}

export function addCCWorker() {
  const tbody  = document.getElementById('cc-tbody');
  const sumRow = tbody.querySelector('.cc-sum-row');
  const num    = tbody.querySelectorAll('tr:not(.cc-sum-row)').length + 1;
  const nr     = buildCCRow(null, num);
  tbody.insertBefore(nr, sumRow || null);
  renumberCC();
  updateCCSumRow();
  nr.querySelector('.cc-name-input')?.focus();
}

export function updateCCSumRow() {
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const fmtM   = typeof window.fmtM   === 'function' ? window.fmtM   : n => n;

  const rows   = document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)');
  const dayT   = new Array(7).fill(0);
  let tc = 0, totalLuong = 0, totalPC = 0, totalHD = 0, totalLoan = 0, totalTru = 0, totalTC = 0;

  rows.forEach(tr => {
    for (let i = 0; i < 7; i++) dayT[i] += parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value || 0) || 0;
    const t   = parseFloat(tr.querySelector('[data-cc="tc"]')?.textContent || 0) || 0;
    tc       += t;
    const l   = parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw || 0) || 0;
    const pc  = parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw || 0) || 0;
    const hd  = parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw || 0) || 0;
    const ln  = parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw || 0) || 0;
    const tru = parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw || 0) || 0;
    totalLuong += t * l; totalPC += pc; totalHD += hd; totalLoan += ln; totalTru += tru;
    totalTC += t * l + pc + ln + hd - tru;
  });

  let sumRow = document.querySelector('#cc-tbody .cc-sum-row');
  if (!sumRow) {
    sumRow = document.createElement('tr');
    sumRow.className = 'cc-sum-row';
    document.getElementById('cc-tbody').appendChild(sumRow);
  }
  const mono = "font-family:'IBM Plex Mono',monospace;font-weight:700";
  sumRow.innerHTML = `
    <td class="row-num col-num" style="font-size:10px;font-weight:700;color:var(--ink2)">∑</td>
    <td class="cc-sticky-name col-name" style="padding:7px 10px;font-size:10px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px">TỔNG</td>
    <td class="col-tp"></td>
    ${dayT.map(v => `<td class="col-day" style="text-align:center;${mono};font-size:12px;color:var(--ink2);padding:6px 4px">${round1(v) || ''}</td>`).join('')}
    <td class="col-tc" style="text-align:center;${mono};font-size:14px;color:var(--gold);padding:6px 8px">${round1(tc)}</td>
    <td class="col-luong"></td>
    <td class="col-total-luong" style="text-align:right;${mono};font-size:13px;color:var(--green);padding:6px 8px;white-space:nowrap">${totalLuong > 0 ? numFmt(totalLuong) : '—'}</td>
    <td class="col-phucap" style="text-align:right;${mono};font-size:12px;color:var(--blue);padding:6px 8px;white-space:nowrap">${totalPC > 0 ? numFmt(totalPC) : '—'}</td>
    <td class="cc-debt-col col-hdml" style="text-align:right;${mono};font-size:12px;color:var(--ink2);padding:6px 8px;white-space:nowrap">${totalHD > 0 ? numFmt(totalHD) : '—'}</td>
    <td class="cc-debt-col col-nd"></td>
    <td class="cc-debt-col col-debtbefore"></td>
    <td class="cc-debt-col col-loan" style="text-align:right;${mono};font-size:12px;color:var(--gold);padding:6px 8px;white-space:nowrap">${totalLoan > 0 ? numFmt(totalLoan) : '—'}</td>
    <td class="cc-debt-col col-tru" style="text-align:right;${mono};font-size:12px;color:var(--red);padding:6px 8px;white-space:nowrap">${totalTru > 0 ? numFmt(totalTru) : '—'}</td>
    <td class="col-total" style="text-align:right;${mono};font-size:14px;color:var(--gold);padding:6px 8px;white-space:nowrap;background:#fff8e8">${totalTC > 0 ? numFmt(totalTC) : totalTC < 0 ? '(' + numFmt(-totalTC) + ')' : '—'}</td>
    <td class="col-del"></td>
  `;

  const sumTC     = document.getElementById('cc-sum-tc');
  const sumLuong  = document.getElementById('cc-sum-luong');
  const sumTongCC = document.getElementById('cc-sum-tongcong');
  if (sumTC)     sumTC.textContent     = round1(tc);
  if (sumLuong)  sumLuong.textContent  = fmtM(totalLuong);
  if (sumTongCC) sumTongCC.textContent = fmtM(totalTC);
}

export function buildCCTable(workers) {
  const fromStr = document.getElementById('cc-from').value;
  const thead   = document.getElementById('cc-thead-row');
  const dates   = CC_DATE_OFFSETS.map(off => {
    if (!fromStr) return '';
    const d = new Date(fromStr + 'T00:00:00');
    d.setDate(d.getDate() + off);
    return d.getDate() + '/' + (d.getMonth() + 1);
  });
  const BG      = 'background:#eeece7;color:var(--ink)';
  const BG_DEBT = 'background:#fff8e0;color:var(--ink)';

  thead.innerHTML = `
    <th class="col-num">#</th>
    <th class="cc-sticky-name col-name">Tên Công Nhân</th>
    <th class="col-tp" style="text-align:center">T/P</th>
    ${CC_DAY_LABELS.map((l, i) => `<th class="cc-day-header col-day">${l}<br><span style="font-size:9px;font-weight:400;color:var(--ink2)">${dates[i]}</span></th>`).join('')}
    <th class="col-tc" style="text-align:center;${BG}">TC</th>
    <th class="col-luong" style="text-align:right;${BG}">Lương/Ngày</th>
    <th class="col-total-luong" style="text-align:right;${BG}">Tổng Lương</th>
    <th class="col-phucap" style="text-align:right;${BG}">
      <span style="display:inline-flex;align-items:center;gap:4px;justify-content:flex-end">
        Phụ Cấp
        <span class="cc-debt-toggle-th" onclick="toggleCCDebtCols()" title="Mở rộng: HĐ Mua Lẻ / Nội Dung / Nợ Cũ / Vay Mới / Trừ Nợ" style="cursor:pointer;font-size:10px;user-select:none;color:var(--ink2);padding:0 2px">▶</span>
      </span>
    </th>
    <th class="cc-debt-col col-hdml" style="text-align:right;${BG}">HĐ Mua Lẻ</th>
    <th class="cc-debt-col col-nd" style="${BG}">Nội Dung</th>
    <th class="cc-debt-col col-debtbefore" style="text-align:right;${BG_DEBT}" title="Nợ tồn đọng trước tuần này">Nợ Cũ</th>
    <th class="cc-debt-col col-loan" style="text-align:right;${BG_DEBT}">Vay Mới (+)</th>
    <th class="cc-debt-col col-tru" style="text-align:right;${BG_DEBT};color:var(--red)">Trừ Nợ (-)</th>
    <th class="col-total" style="text-align:right;background:#c8870a;color:#fff;font-weight:700">Thực Lãnh</th>
    <th class="col-del" style="${BG}"></th>
  `;

  const tbody   = document.getElementById('cc-tbody');
  tbody.innerHTML = '';
  const minRows = Math.max((workers || []).length, 8);
  for (let i = 0; i < minRows; i++) addCCRow((workers || [])[i] || null);
  updateCCSumRow();
  _applyCCDebtColsVisibility();
}

export function clearCCWeek() {
  if (!confirm('Xóa bảng nhập tuần này?')) return;
  buildCCTable([]);
}

// ══════════════════════════════════════════════════════════════
//  WEEK NAVIGATION
// ══════════════════════════════════════════════════════════════

export function updateCCSaveBtn() {
  const btn = document.getElementById('cc-save-btn');
  if (!btn) return;
  const fromDate = document.getElementById('cc-from')?.value;
  const ccCtSel  = document.getElementById('cc-ct-sel');
  const ct       = (ccCtSel?.value || '').trim();
  const ctPid    = typeof window._readPidFromSel === 'function' ? window._readPidFromSel(ccCtSel) : null;
  const ccData   = window.ccData || [];
  const isEdit   = !!(fromDate && ct && ccData.some(r =>
    !r.deletedAt && r.fromDate === fromDate && (r.ctPid === ctPid || r.ct === ct)
  ));
  btn.textContent = isEdit ? '💾 Cập nhật tuần này' : '💾 Lưu tuần này';
}

export function populateCCCtSel() {
  const sel = document.getElementById('cc-ct-sel');
  if (!sel) return;
  const cur = sel.value;
  const _bpo = typeof window._buildProjOpts === 'function'
    ? window._buildProjOpts : v => `<option value="">(chưa có CT)</option>`;
  sel.innerHTML = _bpo(cur);
  updateCCSaveBtn();
}

function loadCCWeekForm() {
  const ccData  = window.ccData || [];
  const f       = document.getElementById('cc-from').value;
  const ccCtSel = document.getElementById('cc-ct-sel');
  const ct      = (ccCtSel.value || '').trim();
  const ctPid   = typeof window._readPidFromSel === 'function' ? window._readPidFromSel(ccCtSel) : null;

  const _matchCT = w => ctPid
    ? (w.projectId === ctPid || w.ctPid === ctPid)
    : w.ct === ct;

  const rec = ccData.find(w => !w.deletedAt && w.fromDate === f && _matchCT(w));
  if (rec) {
    buildCCTable(rec.workers);
  } else if (ct) {
    const prev = ccData
      .filter(w => !w.deletedAt && _matchCT(w) && w.fromDate < f)
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate))[0];
    if (prev) {
      buildCCTable(createWorkerStubs(prev.workers));
    } else {
      buildCCTable([]);
    }
  } else {
    buildCCTable([]);
  }
  updateCCSaveBtn();
}

export function ccGoToWeek(off) {
  ccOffset = off;
  const sunISO = ccSundayISO(off);
  const satISO = ccSaturdayISO(sunISO);
  const fromEl  = document.getElementById('cc-from');
  const toEl    = document.getElementById('cc-to');
  const labelEl = document.getElementById('cc-week-label');
  if (fromEl)  fromEl.value  = sunISO;
  if (toEl)    toEl.value    = satISO;
  if (labelEl) labelEl.textContent = 'Tuần: ' + weekLabel(sunISO);
  loadCCWeekForm();
}

export function ccPrevWeek() { ccGoToWeek(ccOffset - 1); }
export function ccNextWeek() { ccGoToWeek(ccOffset + 1); }

export function onCCFromChange() {
  const raw = document.getElementById('cc-from').value;
  if (!raw) return;
  const sunISO = snapToSunday(raw);
  const satISO = ccSaturdayISO(sunISO);
  const fromEl  = document.getElementById('cc-from');
  const toEl    = document.getElementById('cc-to');
  const labelEl = document.getElementById('cc-week-label');
  if (fromEl)  fromEl.value  = sunISO;
  if (toEl)    toEl.value    = satISO;
  if (labelEl) labelEl.textContent = 'Tuần: ' + weekLabel(sunISO);
  // Tính lại offset
  const thisSun = ccSundayISO(0);
  const [ty, tm, td] = thisSun.split('-').map(Number);
  const [fy, fm, fd] = sunISO.split('-').map(Number);
  const diffMs = new Date(fy, fm - 1, fd) - new Date(ty, tm - 1, td);
  ccOffset = Math.round(diffMs / (7 * 86400000));
  loadCCWeekForm();
}

export function onCCCtSelChange() {
  loadCCWeekForm();
}

export function initCC() {
  ccOffset = 0;
  ccGoToWeek(0);
  populateCCCtSel();
  // Rebuild name list using ccData + cats
  const names = ccAllNames(window.ccData || [], (window.cats || {}).congNhan || []);
  rebuildCCNameList(names);
  // Event delegation for TLT checkbox sum
  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('cc-tlt-chk')) updateTLTSelectedSum();
  });
}

// ══════════════════════════════════════════════════════════════
//  COPY / PASTE TUẦN
// ══════════════════════════════════════════════════════════════

export function copyCCWeek() {
  const _toast = typeof window.toast === 'function' ? window.toast : () => {};
  const workers = [];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr => {
    const name  = tr.querySelector('[data-cc="name"]')?.value?.trim() || '';
    const luong = parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw || 0) || 0;
    const d     = [];
    for (let i = 0; i < 7; i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value || 0) || 0);
    const roleCopy = tr.querySelector('[data-cc="tp"]')?.value || '';
    if (name || luong > 0 || d.some(v => v > 0))
      workers.push({ name, luong, d, phucap: 0, hdmuale: 0, loanAmount: 0, nd: '', role: roleCopy, tru: 0 });
  });
  if (!workers.length) { _toast('Bảng trống, chưa có gì để copy!', 'error'); return; }
  ccClipboard = prepareCopyData(workers);
  const pasteBtn = document.getElementById('cc-paste-btn');
  if (pasteBtn) pasteBtn.style.display = '';
  const tc = workers.reduce((s, w) => s + w.d.reduce((a, v) => a + v, 0), 0);
  _toast('📋 Đã copy ' + workers.length + ' công nhân (' + tc + ' công) — nhấn Dán để áp dụng!', 'success');
}

export function pasteCCWeek() {
  const _toast = typeof window.toast === 'function' ? window.toast : () => {};
  if (!ccClipboard || !ccClipboard.length) { _toast('Chưa copy tuần nào!', 'error'); return; }
  buildCCTable(ccClipboard.map(w => ({ ...w })));
  _toast('📌 Đã dán ' + ccClipboard.length + ' công nhân đầy đủ ngày công!', 'success');
}

// ══════════════════════════════════════════════════════════════
//  HISTORY — Lịch sử chấm công tuần
// ══════════════════════════════════════════════════════════════

function buildCCHistFilters() {
  const ccData      = window.ccData || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function' ? window.inActiveYear : () => true;
  const _getPN      = typeof window._getProjectNameById === 'function' ? window._getProjectNameById : id => id;
  const _x          = typeof window.x === 'function' ? window.x : s => String(s || '');

  const yearCC = ccData.filter(w => !w.deletedAt && inActiveYearFn(w.fromDate));

  const ctMap = new Map();
  yearCC.forEach(w => {
    const pid         = w.projectId || w.ctPid || null;
    const displayName = pid ? (_getPN(pid) || w.ct || pid) : (w.ct || '');
    if (displayName) ctMap.set(pid || w.ct, displayName);
  });
  const allCts   = [...ctMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const allWeeks = [...new Set(yearCC.map(w => w.fromDate))].sort().reverse();

  const ctSel = document.getElementById('cc-hist-ct');
  if (ctSel) {
    const cv = ctSel.value;
    ctSel.innerHTML = '<option value="">Tất cả CT</option>' +
      allCts.map(([val, name]) => `<option ${val === cv ? 'selected' : ''} value="${_x(val)}">${_x(name)}</option>`).join('');
  }

  const wkSel = document.getElementById('cc-hist-week');
  if (wkSel) {
    const wv = wkSel.value;
    wkSel.innerHTML = '<option value="">Tất cả tuần</option>' +
      allWeeks.map(w => `<option ${w === wv ? 'selected' : ''} value="${w}">${weekLabel(w)}</option>`).join('');
  }

  const tltSel = document.getElementById('cc-tlt-week');
  if (tltSel) {
    const tv = tltSel.value;
    tltSel.innerHTML = '<option value="">Tất cả tuần</option>' +
      allWeeks.map(w => `<option ${w === tv ? 'selected' : ''} value="${w}">${weekLabel(w)}</option>`).join('');
  }

  const tltCtSel = document.getElementById('cc-tlt-ct');
  if (tltCtSel) {
    const tcv = tltCtSel.value;
    tltCtSel.innerHTML = '<option value="">Tất cả CT</option>' +
      allCts.map(([val, name]) => `<option ${val === tcv ? 'selected' : ''} value="${_x(val)}">${_x(name)}</option>`).join('');
  }
}

export function renderCCHistory() {
  buildCCHistFilters();
  const ccData      = window.ccData || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function' ? window.inActiveYear : () => true;
  const _resolveCT  = typeof window._resolveCtName === 'function' ? window._resolveCtName : w => w.ct || '';
  const _x          = typeof window.x      === 'function' ? window.x      : s => String(s || '');
  const numFmt      = typeof window.numFmt  === 'function' ? window.numFmt  : n => n;
  const fmtS        = typeof window.fmtS    === 'function' ? window.fmtS    : n => n;

  const fCt = document.getElementById('cc-hist-ct')?.value  || '';
  const fWk = document.getElementById('cc-hist-week')?.value || '';
  const fQ  = (document.getElementById('cc-hist-search')?.value || '').toLowerCase().trim();

  const _fMatch = w => {
    if (!fCt) return true;
    if (w.projectId && w.projectId === fCt) return true;
    if (w.ctPid    && w.ctPid     === fCt) return true;
    if (w.ct === fCt) return true;
    return false;
  };

  const map = {};
  ccData.forEach(w => {
    if (w.deletedAt) return;
    if (!inActiveYearFn(w.fromDate)) return;
    if (!_fMatch(w)) return;
    if (fWk && w.fromDate !== fWk) return;
    const gKey      = w.fromDate + '|' + (w.projectId || w.ct);
    const ctDisplay = _resolveCT(w);
    if (!map[gKey]) {
      map[gKey] = {
        id: w.id, fromDate: w.fromDate, toDate: w.toDate, ct: ctDisplay,
        projectId: w.projectId || null,
        d: [0,0,0,0,0,0,0], tc: 0, tl: 0, pc: 0, hd: 0, tongcong: 0,
        luongList: [], names: [], ndList: []
      };
    }
    (w.workers || []).forEach(wk => {
      const tc   = round1(wk.d.reduce((s, v) => s + v, 0));
      const luong = Number(wk.luong) || 0;
      const tl   = tc * luong;
      const pc   = wk.phucap  || 0;
      const hd   = wk.hdmuale || 0;
      wk.d.forEach((v, i) => { map[gKey].d[i] += Number(v) || 0; });
      map[gKey].tc += tc; map[gKey].tl += tl; map[gKey].pc += pc; map[gKey].hd += hd;
      if (luong > 0) map[gKey].luongList.push(luong);
      if (wk.name) map[gKey].names.push(wk.name);
      if (wk.nd)   map[gKey].ndList.push(wk.nd);
    });
    map[gKey].tongcong = map[gKey].tl + map[gKey].pc + map[gKey].hd;
  });
  Object.values(map).forEach(r => { r.tc = round1(r.tc); r.d = r.d.map(v => round1(v)); });

  let rows = Object.values(map).map(r => {
    const avgLuong = r.luongList.length
      ? Math.round(r.luongList.reduce((s, v) => s + v, 0) / r.luongList.length) : 0;
    const nd      = [...new Set(r.ndList.map(v => (v || '').trim()).filter(Boolean))].join(' | ');
    const workers = [...new Set(r.names.map(v => (v || '').trim()).filter(Boolean))];
    return { ...r, avgLuong, nd, workers };
  });

  if (fQ) {
    rows = rows.filter(r =>
      (r.ct || '').toLowerCase().includes(fQ) ||
      r.workers.some(n => n.toLowerCase().includes(fQ))
    );
  }
  rows.sort((a, b) => b.fromDate.localeCompare(a.fromDate) || (a.ct || '').localeCompare(b.ct || '', 'vi'));

  const tbody    = document.getElementById('cc-hist-tbody');
  const totalTL  = rows.reduce((s, r) => s + r.tl, 0);
  const totalTC2 = rows.reduce((s, r) => s + r.tongcong, 0);

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="17">Chưa có dữ liệu chấm công</td></tr>`;
    document.getElementById('cc-hist-pagination').innerHTML = '';
    return;
  }

  const ccHistPage = window.ccHistPage || 1;
  const start = (ccHistPage - 1) * CC_PG_HIST;
  const paged = rows.slice(start, start + CC_PG_HIST);

  tbody.innerHTML = paged.map(r => `<tr>
    <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2);white-space:nowrap">${viShort(r.fromDate)}<br><span style="color:var(--ink3)">${viShort(r.toDate)}</span></td>
    <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_x(r.ct || '—')}</td>
    ${r.d.map(v => `<td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;${v === 1 ? 'color:var(--green)' : v > 0 ? 'color:var(--blue)' : 'color:var(--line2)'}">${v || '·'}</td>`).join('')}
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${r.tc}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2)">${r.avgLuong ? numFmt(r.avgLuong) : '—'}</td>
    <td class="amount-td">${r.tl ? numFmt(r.tl) : '—'}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--blue)">${r.pc ? numFmt(r.pc) : '—'}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink2)">${r.hd ? numFmt(r.hd) : '—'}</td>
    <td style="color:var(--ink2);font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_x(r.nd || '—')}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:13px;color:var(--gold)">${r.tongcong ? numFmt(r.tongcong) : '—'}</td>
    <td>
      <button class="btn btn-outline btn-sm" onclick="loadCCWeekById('${r.id}','${r.fromDate}','${_x(r.ct)}')" title="Tải tuần này" style="min-width:44px;min-height:36px;padding:6px 10px">↩ Tải</button>
      <button class="btn btn-danger btn-sm" onclick="delCCWeekById('${r.id}','${r.fromDate}','${_x(r.ct)}')" title="Xóa tuần" style="min-width:44px;min-height:36px;padding:6px 10px">✕ Xóa</button>
    </td>
  </tr>`).join('');

  const tp  = Math.ceil(rows.length / CC_PG_HIST);
  let pag   = `<span>${rows.length} dòng · Tổng lương: <strong style="color:var(--green);font-family:'IBM Plex Mono',monospace">${fmtS(totalTL)}</strong> · Tổng cộng: <strong style="color:var(--gold);font-family:'IBM Plex Mono',monospace">${fmtS(totalTC2)}</strong></span>`;
  if (tp > 1) {
    pag += '<div class="page-btns">';
    for (let p = 1; p <= Math.min(tp, 10); p++)
      pag += `<button class="page-btn ${p === (window.ccHistPage || 1) ? 'active' : ''}" onclick="ccHistGoTo(${p})">${p}</button>`;
    if (tp > 10) pag += `<span style="padding:4px 6px;color:var(--ink3)">...${tp}</span>`;
    pag += '</div>';
  }
  document.getElementById('cc-hist-pagination').innerHTML = pag;
  renderCCTLT();
}

export function ccHistGoTo(p) { window.ccHistPage = p; renderCCHistory(); }

export function loadCCWeekById(id, fromDate, ct) {
  const ccData    = window.ccData || [];
  const _toast    = typeof window.toast === 'function' ? window.toast : () => {};
  const _getPN    = typeof window._getProjectNameById === 'function' ? window._getProjectNameById : v => v;
  const _resolveCT = typeof window._resolveCtName === 'function' ? window._resolveCtName : w => w.ct || '';

  const rec = ccData.find(w => !w.deletedAt && String(w.id) === String(id))
           || ccData.find(w => !w.deletedAt && w.fromDate === fromDate && (w.projectId === ct || w.ct === ct));
  if (!rec) { _toast('Không tìm thấy dữ liệu tuần này', 'error'); return; }

  const thisSun = ccSundayISO(0);
  const [ty, tm, td] = thisSun.split('-').map(Number);
  const [fy, fm, fd] = rec.fromDate.split('-').map(Number);
  const diffMs = new Date(fy, fm - 1, fd) - new Date(ty, tm - 1, td);
  ccOffset = Math.round(diffMs / (7 * 86400000));

  const satISO     = ccSaturdayISO(rec.fromDate);
  const ctDisplay  = _resolveCT(rec);

  const fromEl   = document.getElementById('cc-from');
  const toEl     = document.getElementById('cc-to');
  const labelEl  = document.getElementById('cc-week-label');
  const ctSelEl  = document.getElementById('cc-ct-sel');
  if (fromEl)  fromEl.value  = rec.fromDate;
  if (toEl)    toEl.value    = satISO;
  if (labelEl) labelEl.textContent = 'Tuần: ' + weekLabel(rec.fromDate);
  if (ctSelEl) ctSelEl.value = ctDisplay;

  buildCCTable(rec.workers);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  _toast('Đã tải tuần ' + viShort(rec.fromDate) + ' – ' + ctDisplay);
}

// ══════════════════════════════════════════════════════════════
//  TLT — Tổng Lương Tuần (per worker)
// ══════════════════════════════════════════════════════════════

export function renderCCTLT() {
  buildCCHistFilters();
  const ccData      = window.ccData || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function' ? window.inActiveYear : () => true;
  const _resolveCT  = typeof window._resolveCtName === 'function' ? window._resolveCtName : w => w.ct || '';
  const cnRoles     = window.cnRoles || {};
  const _x          = typeof window.x      === 'function' ? window.x      : s => String(s || '');
  const numFmt      = typeof window.numFmt  === 'function' ? window.numFmt  : n => n;
  const fmtS        = typeof window.fmtS    === 'function' ? window.fmtS    : n => n;

  const fWk  = document.getElementById('cc-tlt-week')?.value  || '';
  const fCt2 = document.getElementById('cc-tlt-ct')?.value    || '';

  const _fMatch2 = w => {
    if (!fCt2) return true;
    if (w.projectId && w.projectId === fCt2) return true;
    if (w.ctPid    && w.ctPid     === fCt2) return true;
    if (w.ct === fCt2) return true;
    return false;
  };

  const map = {};
  ccData.forEach(w => {
    if (w.deletedAt) return;
    if (!inActiveYearFn(w.fromDate)) return;
    if (!_fMatch2(w)) return;
    if (fWk && w.fromDate !== fWk) return;
    const ctDisplay = _resolveCT(w);
    (w.workers || []).forEach(wk => {
      const key = fWk ? w.fromDate + '|' + wk.name : wk.name;
      if (!map[key]) map[key] = {
        fromDate: w.fromDate, toDate: w.toDate, name: wk.name,
        d: [0,0,0,0,0,0,0], tc: 0, tl: 0, pc: 0, hdml: 0, loan: 0, tru: 0,
        cts: [], luongList: []
      };
      (wk.d || []).forEach((v, i) => { map[key].d[i] += v; });
      const tc = round1((wk.d || []).reduce((s, v) => s + v, 0));
      map[key].tc   += tc;
      map[key].tl   += tc * (wk.luong || 0);
      map[key].pc   += (wk.phucap    || 0);
      map[key].hdml += (wk.hdmuale   || 0);
      map[key].loan += (wk.loanAmount || 0);
      map[key].tru  += (wk.tru       || 0);
      if (!map[key].cts.includes(ctDisplay)) map[key].cts.push(ctDisplay);
      map[key].luongList.push(wk.luong || 0);
      if (!fWk) {
        if (w.fromDate < map[key].fromDate) map[key].fromDate = w.fromDate;
        if (w.toDate   > map[key].toDate)   map[key].toDate   = w.toDate;
      }
    });
  });
  Object.values(map).forEach(r => { r.tc = round1(r.tc); r.d = r.d.map(v => round1(v)); });

  const rows = Object.values(map).sort((a, b) =>
    fWk
      ? b.fromDate.localeCompare(a.fromDate) || a.name.localeCompare(b.name, 'vi')
      : a.name.localeCompare(b.name, 'vi')
  );

  const tbody     = document.getElementById('cc-tlt-tbody');
  const tableWrap = document.getElementById('cc-tlt-table-wrap');
  const cardsEl   = document.getElementById('cc-tlt-cards');
  const isMobile  = window.innerWidth < 768;
  const mono      = "font-family:'IBM Plex Mono',monospace";
  const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  if (!rows.length) {
    if (isMobile && tableWrap && cardsEl) {
      tableWrap.style.display = 'none';
      cardsEl.style.display = 'block';
      cardsEl.innerHTML = '<p style="text-align:center;color:var(--ink3);padding:20px">Chưa có dữ liệu</p>';
    } else if (tbody) {
      if (tableWrap) tableWrap.style.display = '';
      if (cardsEl)   cardsEl.style.display = 'none';
      tbody.innerHTML = `<tr class="empty-row"><td colspan="17">Chưa có dữ liệu</td></tr>`;
    }
    const paginEl = document.getElementById('cc-tlt-pagination');
    if (paginEl) paginEl.innerHTML = '';
    return;
  }

  const ccTltPage    = window.ccTltPage || 1;
  const grandTCLuong = rows.reduce((s, r) => s + r.tl + r.pc, 0);
  const start        = (ccTltPage - 1) * CC_PG_TLT;
  const paged        = rows.slice(start, start + CC_PG_TLT);

  if (isMobile && tableWrap && cardsEl) {
    tableWrap.style.display = 'none';
    cardsEl.style.display   = 'block';
    cardsEl.innerHTML = paged.map(r => {
      const tcLuong   = r.tl + r.pc;
      const noCon_    = _calcDebtBefore(r.name, r.fromDate);
      const daysHtml  = r.d.map((v, i) => v > 0
        ? `<span class="tlt-day-badge${v >= 1 ? ' tlt-day-full' : ' tlt-day-half'}">${DAY_LABELS[i]}: ${v}</span>` : ''
      ).filter(Boolean).join('');
      const ctsHtml   = r.cts.length ? `<div class="tlt-card-cts">${r.cts.map(c => _x(c)).join(' · ')}</div>` : '';
      const periodHtml = fWk ? `${viShort(r.fromDate)} – ${viShort(r.toDate)}` : 'Tổng nhiều tuần';
      return `<div class="tlt-card"
        data-name="${_x(r.name)}" data-from="${r.fromDate}" data-to="${r.toDate}"
        data-tc="${r.tc}" data-tl="${r.tl}" data-pc="${r.pc}" data-hdml="${r.hdml}"
        data-loan="${r.loan}" data-tru="${r.tru}" data-no-con="${noCon_}"
        data-cts="${r.cts.join('|')}">
        <div class="tlt-card-header">
          <label class="tlt-card-label">
            <input type="checkbox" class="cc-tlt-chk">
            <span class="tlt-card-name">${_x(r.name || '—')}</span>
          </label>
          <span class="tlt-card-amount">${tcLuong ? numFmt(tcLuong) + ' đ' : '—'}</span>
        </div>
        <div class="tlt-card-meta">${periodHtml} &nbsp;·&nbsp; <strong>${r.tc}</strong> công</div>
        ${daysHtml ? `<div class="tlt-card-days">${daysHtml}</div>` : ''}
        ${ctsHtml}
      </div>`;
    }).join('');
  } else {
    if (tableWrap) tableWrap.style.display = '';
    if (cardsEl)   cardsEl.style.display   = 'none';
    if (tbody) tbody.innerHTML = paged.map(r => {
      const tcLuong    = r.tl + r.pc;
      const thucLanh_  = r.tl + r.pc + r.loan + r.hdml - r.tru;
      const luongTB    = r.tc > 0 ? Math.round(tcLuong / r.tc) : 0;
      const noCon_     = _calcDebtBefore(r.name, r.fromDate);
      const ctDisplay_ = r.cts.length <= 1
        ? _x(r.cts[0] || '—')
        : _x(r.cts[0]) + ` <span class="tlt-ct-more" title="${r.cts.map(c => _x(c)).join(', ')}">+${r.cts.length - 1}</span>`;
      return `<tr
        data-name="${_x(r.name)}" data-from="${r.fromDate}" data-to="${r.toDate}"
        data-tc="${r.tc}" data-tl="${r.tl}" data-pc="${r.pc}" data-hdml="${r.hdml}"
        data-loan="${r.loan}" data-tru="${r.tru}" data-no-con="${noCon_}"
        data-cts="${r.cts.join('|')}">
        <td style="text-align:center;padding:4px"><input type="checkbox" class="cc-tlt-chk" style="width:15px;height:15px;cursor:pointer"></td>
        <td style="${mono};font-size:10px;color:var(--ink2);white-space:nowrap">${fWk ? viShort(r.fromDate) : 'Tổng'}<br><span style="color:var(--ink3)">${fWk ? viShort(r.toDate) : r.tc + ' công'}</span></td>
        <td style="font-weight:700;font-size:13px">${_x(r.name || '—')}</td>
        <td style="text-align:center;font-size:12px;font-weight:700;color:var(--ink2)">${cnRoles[r.name] || '—'}</td>
        ${r.d.map(v => `<td style="text-align:center;${mono};font-weight:600;font-size:12px;${v === 1 ? 'color:var(--green)' : v > 0 ? 'color:var(--blue)' : 'color:var(--line2)'}">${v || '·'}</td>`).join('')}
        <td style="text-align:center;${mono};font-weight:700;color:var(--gold)">${r.tc}</td>
        <td style="text-align:right;${mono};font-weight:700;font-size:13px;color:var(--green)">${tcLuong ? numFmt(tcLuong) : '—'}</td>
        <td style="text-align:right;${mono};font-size:12px;color:var(--ink2)">${luongTB ? numFmt(luongTB) : '—'}</td>
        <td style="text-align:right;${mono};font-size:12px;color:var(--red)">${r.tru ? numFmt(r.tru) : '—'}</td>
        <td style="text-align:right;${mono};font-weight:700;color:var(--green);background:#f1f8f4">${thucLanh_ > 0 ? numFmt(thucLanh_) : thucLanh_ < 0 ? '(' + numFmt(-thucLanh_) + ')' : '—'}</td>
        <td class="project-col" style="font-size:11px;color:var(--ink2)">${ctDisplay_}</td>
      </tr>`;
    }).join('');
  }

  const tp  = Math.ceil(rows.length / CC_PG_TLT);
  let pag   = `<span>${rows.length} công nhân · Tổng TC Lương: <strong style="color:var(--green);${mono}">${fmtS(grandTCLuong)}</strong></span><span id="cc-tlt-selected-sum" style="margin-left:14px;color:var(--gold);font-weight:700;${mono}"></span>`;
  if (tp > 1) {
    pag += '<div class="page-btns">';
    for (let p = 1; p <= Math.min(tp, 10); p++)
      pag += `<button class="page-btn ${p === (window.ccTltPage || 1) ? 'active' : ''}" onclick="ccTltGoTo(${p})">${p}</button>`;
    pag += '</div>';
  }
  const paginEl = document.getElementById('cc-tlt-pagination');
  if (paginEl) paginEl.innerHTML = pag;
}

function updateTLTSelectedSum() {
  const sumEl = document.getElementById('cc-tlt-selected-sum');
  if (!sumEl) return;
  const chks = [...document.querySelectorAll('#cc-tlt-tbody .cc-tlt-chk:checked, #cc-tlt-cards .cc-tlt-chk:checked')];
  if (!chks.length) { sumEl.textContent = ''; return; }
  let total = 0;
  chks.forEach(chk => {
    const container = chk.closest('tr') || chk.closest('.tlt-card');
    if (!container) return;
    const tl   = +(container.dataset.tl   || 0);
    const pc   = +(container.dataset.pc   || 0);
    const hdml = +(container.dataset.hdml || 0);
    const loan = +(container.dataset.loan || 0);
    const tru  = +(container.dataset.tru  || 0);
    total += tl + pc + loan + hdml - tru;
  });
  sumEl.textContent = chks.length + 'cn: ' + fmtK(total);
}

export function ccTltGoTo(p) { window.ccTltPage = p; renderCCTLT(); }

// ══════════════════════════════════════════════════════════════
//  CSV EXPORTS
// ══════════════════════════════════════════════════════════════

export function exportCCWeekCSV() {
  const _dlCSV  = typeof window.dlCSV  === 'function' ? window.dlCSV  : () => {};
  const _today  = typeof window.today  === 'function' ? window.today  : () => new Date().toISOString().split('T')[0];

  const f    = document.getElementById('cc-from')?.value || '';
  const ct   = document.getElementById('cc-ct-sel')?.value || '?';
  const rows = [['CT','Từ','Đến','Tên','CN','T2','T3','T4','T5','T6','T7','TC','Lương/N','Tổng Lương','Phụ Cấp','Vay Mới','HĐ Mua Lẻ','Trừ Nợ','Nội Dung','Thực Lãnh']];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr => {
    const name = tr.querySelector('[data-cc="name"]')?.value?.trim() || '';
    if (!name) return;
    const d = []; for (let i = 0; i < 7; i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value || 0) || 0);
    const tc  = round1(d.reduce((s, v) => s + v, 0));
    const l   = parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw   || 0) || 0;
    const pc  = parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw  || 0) || 0;
    const ln  = parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw    || 0) || 0;
    const hd  = parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw    || 0) || 0;
    const tru = parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw     || 0) || 0;
    const nd  = tr.querySelector('[data-cc="nd"]')?.value?.trim() || '';
    rows.push([ct, f, document.getElementById('cc-to')?.value || '', name, ...d, tc, l, tc * l, pc, ln, hd, tru, nd, tc * l + pc + ln + hd - tru]);
  });
  _dlCSV(rows, 'chamcong_' + f + '.csv');
}

export function exportCCTLTCSV() {
  const _dlCSV    = typeof window.dlCSV  === 'function' ? window.dlCSV  : () => {};
  const _today    = typeof window.today  === 'function' ? window.today  : () => new Date().toISOString().split('T')[0];
  const ccData    = window.ccData || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function' ? window.inActiveYear : () => true;
  const _resolveCT = typeof window._resolveCtName === 'function' ? window._resolveCtName : w => w.ct || '';

  const fWk  = document.getElementById('cc-tlt-week')?.value  || '';
  const fCt2 = document.getElementById('cc-tlt-ct')?.value    || '';
  const map  = {};

  ccData.forEach(w => {
    if (w.deletedAt) return;
    if (!inActiveYearFn(w.fromDate)) return;
    if (fCt2 && !(w.projectId === fCt2 || w.ctPid === fCt2 || w.ct === fCt2)) return;
    if (fWk && w.fromDate !== fWk) return;
    const ctDisplay = _resolveCT(w);
    (w.workers || []).forEach(wk => {
      const key = fWk ? w.fromDate + '|' + wk.name : wk.name;
      if (!map[key]) map[key] = { fromDate: w.fromDate, toDate: w.toDate, name: wk.name,
        d: [0,0,0,0,0,0,0], tc: 0, tl: 0, pc: 0, hdml: 0, loan: 0, tru: 0, cts: [] };
      (wk.d || []).forEach((v, i) => { map[key].d[i] += v; });
      const tc = round1((wk.d || []).reduce((s, v) => s + v, 0));
      map[key].tc += tc; map[key].tl += tc * (wk.luong || 0);
      map[key].pc += (wk.phucap || 0); map[key].hdml += (wk.hdmuale || 0);
      map[key].loan += (wk.loanAmount || 0); map[key].tru += (wk.tru || 0);
      if (!map[key].cts.includes(ctDisplay)) map[key].cts.push(ctDisplay);
      if (!fWk) {
        if (w.fromDate < map[key].fromDate) map[key].fromDate = w.fromDate;
        if (w.toDate   > map[key].toDate)   map[key].toDate   = w.toDate;
      }
    });
  });
  Object.values(map).forEach(r => { r.tc = round1(r.tc); r.d = r.d.map(v => round1(v)); });

  const csvRows = [['Tuần','Tên CN','CN','T2','T3','T4','T5','T6','T7','TC','TC Lương','Lương TB/Ngày','Vay Mới','Trừ Nợ','Thực Lãnh','Công Trình']];
  Object.values(map)
    .sort((a, b) => fWk
      ? b.fromDate.localeCompare(a.fromDate) || a.name.localeCompare(b.name, 'vi')
      : a.name.localeCompare(b.name, 'vi'))
    .forEach(r => {
      const tcL        = r.tl + r.pc + r.hdml;
      const ltb        = r.tc > 0 ? Math.round(tcL / r.tc) : 0;
      const thucLanh_  = r.tl + r.pc + r.loan + r.hdml - r.tru;
      const periodStr  = fWk ? viShort(r.fromDate) + '–' + viShort(r.toDate) : 'Tổng';
      csvRows.push([periodStr, r.name, ...r.d, r.tc, tcL, ltb, r.loan, r.tru, thucLanh_, r.cts.join(', ')]);
    });
  _dlCSV(csvRows, 'tong_luong_tuan_' + _today() + '.csv');
}

export function exportCCHistCSV() {
  const _dlCSV    = typeof window.dlCSV  === 'function' ? window.dlCSV  : () => {};
  const _today    = typeof window.today  === 'function' ? window.today  : () => new Date().toISOString().split('T')[0];
  const ccData    = window.ccData || [];
  const inActiveYearFn = typeof window.inActiveYear === 'function' ? window.inActiveYear : () => true;
  const _resolveCT = typeof window._resolveCtName === 'function' ? window._resolveCtName : w => w.ct || '';

  const fCt = document.getElementById('cc-hist-ct')?.value   || '';
  const fWk = document.getElementById('cc-hist-week')?.value || '';
  const fQ  = (document.getElementById('cc-hist-search')?.value || '').toLowerCase().trim();
  const rows = [['CT','Từ','Đến','CN','T2','T3','T4','T5','T6','T7','TC','Lương/Ngày TB','Tổng Lương','Phụ Cấp','HĐ Mua Lẻ','Nội Dung','Tổng Cộng']];
  const map  = {};

  ccData.forEach(w => {
    if (w.deletedAt) return;
    if (!inActiveYearFn(w.fromDate)) return;
    if (fCt && !(w.projectId === fCt || w.ctPid === fCt || w.ct === fCt)) return;
    if (fWk && w.fromDate !== fWk) return;
    const ctDisplay = _resolveCT(w);
    const key = w.fromDate + '|' + (w.projectId || w.ct);
    if (!map[key]) map[key] = { fromDate: w.fromDate, toDate: w.toDate, ct: ctDisplay,
      d: [0,0,0,0,0,0,0], tc: 0, tl: 0, pc: 0, hd: 0, luongList: [], names: [], ndList: [] };
    (w.workers || []).forEach(wk => {
      const tc    = round1((wk.d || []).reduce((s, v) => s + v, 0));
      const luong = Number(wk.luong) || 0;
      (wk.d || []).forEach((v, i) => { map[key].d[i] += Number(v) || 0; });
      map[key].tc += tc; map[key].tl += tc * luong;
      map[key].pc += (wk.phucap || 0); map[key].hd += (wk.hdmuale || 0);
      if (luong > 0) map[key].luongList.push(luong);
      if (wk.name) map[key].names.push(wk.name);
      if (wk.nd)   map[key].ndList.push(wk.nd);
    });
  });
  Object.values(map).forEach(r => { r.tc = round1(r.tc); r.d = r.d.map(v => round1(v)); });

  Object.values(map)
    .map(r => {
      const avgLuong = r.luongList.length ? Math.round(r.luongList.reduce((s, v) => s + v, 0) / r.luongList.length) : 0;
      const workers  = [...new Set(r.names.map(v => (v || '').trim()).filter(Boolean))];
      const nd       = [...new Set(r.ndList.map(v => (v || '').trim()).filter(Boolean))].join(' | ');
      return { ...r, avgLuong, workers, nd, tong: r.tl + r.pc + r.hd };
    })
    .filter(r => !fQ || (r.ct || '').toLowerCase().includes(fQ) || r.workers.some(n => n.toLowerCase().includes(fQ)))
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate) || (a.ct || '').localeCompare(b.ct || '', 'vi'))
    .forEach(r => {
      rows.push([r.ct, viShort(r.fromDate) + '–' + viShort(r.toDate), r.toDate, ...r.d, r.tc, r.avgLuong, r.tl, r.pc, r.hd, r.nd, r.tong]);
    });

  const label = fWk ? viShort(fWk) : 'all';
  _dlCSV(rows, 'lich_su_cham_cong_' + label + '_' + _today() + '.csv');
}

// ══════════════════════════════════════════════════════════════
//  PHIẾU LƯƠNG — html2canvas
// ══════════════════════════════════════════════════════════════

export function xuatPhieuLuong() {
  const _x      = typeof window.x       === 'function' ? window.x       : s => String(s || '');
  const numFmt  = typeof window.numFmt  === 'function' ? window.numFmt  : n => n;
  const _toast  = typeof window.toast   === 'function' ? window.toast   : () => {};

  const rows = [];
  document.querySelectorAll('.cc-tlt-chk:checked').forEach(chk => {
    const container = chk.closest('[data-name]');
    if (!container) return;
    const name     = container.dataset.name  || '(Chưa đặt tên)';
    const fromDate = container.dataset.from  || '';
    const toDate   = container.dataset.to    || '';
    const tc       = parseFloat(container.dataset.tc)    || 0;
    const tl       = parseInt(container.dataset.tl)      || 0;
    const pc       = parseInt(container.dataset.pc)      || 0;
    const hdml     = parseInt(container.dataset.hdml)    || 0;
    const loan     = parseInt(container.dataset.loan)    || 0;
    const tru      = parseInt(container.dataset.tru)     || 0;
    const noCon    = parseInt(container.dataset.noCon)   || 0;
    const cts      = (container.dataset.cts || '').split('|').filter(Boolean);
    const tongCong = tl + pc;
    const luongTB  = tc > 0 ? Math.round(tl / tc) : 0;
    rows.push({ name, fromDate, toDate, tc, tl, pc, hdml, loan, cts, tongCong, luongTB, tru, noCon });
  });

  if (!rows.length) {
    _toast('⚠️ Tick chọn ít nhất 1 công nhân trong bảng Tổng Lương Tuần!', 'error');
    return;
  }

  const allFrom = rows.map(r => r.fromDate).filter(Boolean).sort();
  const allTo   = rows.map(r => r.toDate).filter(Boolean).sort();
  const fromDt  = allFrom[0] || '';
  const toDt    = allTo[allTo.length - 1] || '';
  const period  = fromDt && toDt ? _fmtDate(fromDt) + ' — ' + _fmtDate(toDt) : '(Chưa rõ)';

  const allCts          = [...new Set(rows.flatMap(r => r.cts))];
  const ctLabel         = allCts.join(', ') || '(Nhiều công trình)';
  const today_          = new Date().toLocaleDateString('vi-VN');
  const tongThanhToan   = rows.reduce((s, r) => s + r.tongCong, 0);
  const tongTru_        = rows.reduce((s, r) => s + r.tru,      0);
  const tongLoan_       = rows.reduce((s, r) => s + r.loan,     0);
  const tongHDML_       = rows.reduce((s, r) => s + r.hdml,     0);
  const tongThucLanh_   = tongThanhToan + tongHDML_ + tongLoan_ - tongTru_;
  const _seenCNNames    = new Set();
  let tongNoCon_ = 0;
  rows.forEach(r => { if (!_seenCNNames.has(r.name)) { _seenCNNames.add(r.name); tongNoCon_ += r.noCon; } });
  const tongNoHienTai_  = tongNoCon_ + tongLoan_ - tongTru_;

  // Đổ vào template
  const _setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  _setTxt('pl-ct-name',  ctLabel);
  _setTxt('pl-ct-label', ctLabel);
  _setTxt('pl-period',   period);
  _setTxt('pl-date',     today_);

  const plTbody = document.getElementById('pl-tbody');
  if (plTbody) {
    plTbody.innerHTML = rows.map(r => `
      <tr>
        <td>${_x(r.name)}</td>
        <td>${r.tc}</td>
        <td>${r.luongTB ? numFmt(r.luongTB) + ' đ' : '—'}</td>
        <td>${r.pc ? numFmt(r.pc) + ' đ' : '—'}</td>
        <td style="font-weight:700;color:#c8870a">${numFmt(r.tongCong)} đ</td>
      </tr>`).join('');
  }
  _setTxt('pl-total-cell', numFmt(tongThanhToan) + ' đ');
  _setTxt('pl-sum-hdml',   tongHDML_ ? numFmt(tongHDML_) + ' đ' : '—');
  _setTxt('pl-sum-thuclanh', numFmt(tongThanhToan + tongHDML_) + ' đ');
  _setTxt('pl-sum-tru',   tongTru_  ? numFmt(tongTru_)  + ' đ' : '—');
  _setTxt('pl-sum-loan',  tongLoan_ ? numFmt(tongLoan_) + ' đ' : '—');

  const _noConEl = document.getElementById('pl-sum-nocon');
  if (_noConEl) {
    const _noConStr   = tongNoHienTai_ > 0 ? numFmt(tongNoHienTai_) + ' (nợ)'
                      : tongNoHienTai_ < 0 ? numFmt(-tongNoHienTai_) + ' (dư)' : '0 đ';
    const _noConColor = tongNoHienTai_ > 0 ? '#c0392b' : tongNoHienTai_ < 0 ? '#1a6e3a' : '#555';
    _noConEl.textContent = _noConStr;
    _noConEl.style.color = _noConColor;
  }
  _setTxt('pl-grand-total', 'THỰC LÃNH: ' + numFmt(Math.max(0, tongThucLanh_)) + ' đồng');

  const tpl = document.getElementById('phieu-luong-template');
  if (!tpl) { _toast('❌ Không tìm thấy template phiếu lương!', 'error'); return; }
  tpl.style.display = 'block';

  // Tên file
  const _now     = new Date();
  const _dd      = String(_now.getDate()).padStart(2, '0');
  const _mm      = String(_now.getMonth() + 1).padStart(2, '0');
  const _yy      = String(_now.getFullYear()).slice(-2);
  const _datePart = _dd + _mm + _yy;
  const _wParts  = rows.map(r => removeVietnameseTones(r.name) + '_' + r.tc + 'c').join('_');
  const _ctList  = allCts.slice(0, 3).map(ct => removeVietnameseTones(ct).slice(0, 3));
  const _ctPart  = _ctList.join('_') + (allCts.length > 3 ? '_etc' : '');
  const fileName = 'Phieuluong_' + _datePart + '_' + _wParts + (_ctPart ? '_' + _ctPart : '');

  _toast('⏳ Đang tạo phiếu lương...', 'info');

  // Dùng window.html2canvas (loaded via script tag)
  const _h2c = window.html2canvas;
  if (typeof _h2c !== 'function') {
    tpl.style.display = 'none';
    _toast('❌ html2canvas chưa được load!', 'error');
    return;
  }

  document.fonts.ready.then(() => {
    _h2c(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 760 })
      .then(canvas => {
        tpl.style.display = 'none';
        const link    = document.createElement('a');
        link.download = fileName + '.png';
        link.href     = canvas.toDataURL('image/png');
        link.click();
        _toast('✅ Đã xuất phiếu lương ' + rows.length + ' người!', 'success');
      })
      .catch(err => {
        tpl.style.display = 'none';
        console.error('html2canvas error:', err);
        _toast('❌ Lỗi khi tạo ảnh: ' + err.message, 'error');
      });
  });
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES
// Gán trực tiếp — không override các delegated legacy globals
// ══════════════════════════════════════════════════════════════
window._payrollUI = {
  initPayrollUI, fmtK, rebuildCCNameList,
  calcWeekOffset, calcCCTopTotal,
  // Mới thêm:
  removeVietnameseTones, toggleCCDebtCols,
  calcCCRow, delCCRow, buildCCRow, addCCWorker,
  updateCCSumRow, buildCCTable, clearCCWeek,
  updateCCSaveBtn, populateCCCtSel,
  ccGoToWeek, ccPrevWeek, ccNextWeek,
  onCCFromChange, onCCCtSelChange, initCC,
  copyCCWeek, pasteCCWeek,
  renderCCHistory, ccHistGoTo, loadCCWeekById,
  renderCCTLT, ccTltGoTo,
  exportCCWeekCSV, exportCCTLTCSV, exportCCHistCSV,
  xuatPhieuLuong,
};

// Direct window globals — called from index.html onclick / legacy scripts
window.initCC             = initCC;
window.buildCCTable       = buildCCTable;
window.addCCWorker        = addCCWorker;
window.delCCRow           = delCCRow;
window.toggleCCDebtCols   = toggleCCDebtCols;
window.ccPrevWeek         = ccPrevWeek;
window.ccNextWeek         = ccNextWeek;
window.onCCFromChange     = onCCFromChange;
window.onCCCtSelChange    = onCCCtSelChange;
window.copyCCWeek         = copyCCWeek;
window.pasteCCWeek        = pasteCCWeek;
window.clearCCWeek        = clearCCWeek;
window.populateCCCtSel    = populateCCCtSel;
window.renderCCHistory    = renderCCHistory;
window.renderCCTLT        = renderCCTLT;
window.ccHistGoTo         = ccHistGoTo;
window.ccTltGoTo          = ccTltGoTo;
window.loadCCWeekById     = loadCCWeekById;
window.exportCCWeekCSV    = exportCCWeekCSV;
window.exportCCTLTCSV     = exportCCTLTCSV;
window.exportCCHistCSV    = exportCCHistCSV;
window.xuatPhieuLuong     = xuatPhieuLuong;

// rebuildCCNameList: wrapper tương thích (gọi không tham số như legacy)
window.rebuildCCNameList = () => {
  const names = ccAllNames(window.ccData || [], (window.cats || {}).congNhan || []);
  rebuildCCNameList(names);
};

// Các delegated legacy globals — CHỈ set nếu legacy chưa cung cấp
// (chamcong.js load trước ESM nên các globals này đã tồn tại từ legacy)
// window.saveCCWeek        → giữ nguyên legacy
// window.delCCWeekById     → giữ nguyên legacy
// window.delCCWorker       → giữ nguyên legacy
// window.normalizeAllChamCong → giữ nguyên legacy
// window.rebuildCCCategories  → giữ nguyên legacy
// window.updateTopFromCC   → giữ nguyên legacy
// window.exportUngToImage  → giữ nguyên legacy

console.log('[payroll.ui] ES Module loaded ✅');
