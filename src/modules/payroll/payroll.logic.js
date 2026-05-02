// ══════════════════════════════════════════════════════════════
// src/modules/payroll/payroll.logic.js — Payroll Business Logic
// Prompt 7 — Bốc từ chamcong.js
// Logic tính lương, dedup CC, clipboard, normalize
// ══════════════════════════════════════════════════════════════

// ── Constants ───────────────────────────────────────────────
export const CC_DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const CC_DATE_OFFSETS = [0, 1, 2, 3, 4, 5, 6];
export const CC_PG_HIST = 30;
export const CC_PG_TLT = 20;

// ── Date Helpers ────────────────────────────────────────────

export function isoFromParts(y, m, d) {
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
}

/** CN (Sunday) ISO cho tuần offset từ tuần hiện tại */
export function ccSundayISO(offset = 0) {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
  const jsDay = now.getDay();
  const sunD = new Date(y, mo, d - jsDay + offset * 7);
  return isoFromParts(sunD.getFullYear(), sunD.getMonth() + 1, sunD.getDate());
}

/** T7 (Saturday) ISO = CN + 6 */
export function ccSaturdayISO(sundayISO) {
  const [y, m, d] = sundayISO.split('-').map(Number);
  const sat = new Date(y, m - 1, d + 6);
  return isoFromParts(sat.getFullYear(), sat.getMonth() + 1, sat.getDate());
}

/** Snap bất kỳ ngày → CN của tuần chứa ngày đó */
export function snapToSunday(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay();
  const sun = new Date(y, m - 1, d - jsDay);
  return isoFromParts(sun.getFullYear(), sun.getMonth() + 1, sun.getDate());
}

export function viShort(ds) {
  if (!ds || typeof ds !== 'string') return '—';
  const parts = ds.split('-');
  if (parts.length !== 3) return '—';
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return '—';
  return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m;
}

export function weekLabel(sundayISO) {
  if (!sundayISO || typeof sundayISO !== 'string') return '—';
  const satISO = ccSaturdayISO(sundayISO);
  const y = sundayISO.split('-')[0];
  return viShort(sundayISO) + '–' + viShort(satISO) + '/' + y;
}

// ── Rounding ────────────────────────────────────────────────
export function round1(n) { return Math.round(n * 10) / 10; }

// ── Dedup CC ────────────────────────────────────────────────

const _TS_MIN = 1577836800000; // 2020-01-01

function _safeTs(ts) {
  const n = typeof ts === 'number' ? ts : 0;
  if (n < _TS_MIN) return 0;
  if (n > Date.now() + 86400000) return Date.now();
  return n;
}

/**
 * Dedup cc_v2 theo logical key (fromDate + projectId/ct)
 * Giữ bản updatedAt mới nhất. Hard rule: 1 tuần + 1 CT = 1 record.
 */
export function dedupCC(arr) {
  const records = arr || [];
  const byKey = new Map();
  records.forEach(r => {
    const key = (r.fromDate || r.from || '') + '__' + (r.projectId || r.ct || '');
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, r); return; }
    const prevTs = _safeTs(prev.updatedAt || prev.createdAt || 0);
    const rTs = _safeTs(r.updatedAt || r.createdAt || 0);
    if (rTs > prevTs) {
      byKey.set(key, r);
    } else if (rTs === prevTs && r.deletedAt && !prev.deletedAt) {
      byKey.set(key, r);
    }
  });
  return [...byKey.values()];
}

// ── Worker Calculations ─────────────────────────────────────

/**
 * Tính lương 1 worker
 * @returns {{ tc, totalLuong, thucLanh }}
 */
export function calcWorkerPay(worker) {
  const d = worker.d || [0, 0, 0, 0, 0, 0, 0];
  const tc = round1(d.reduce((s, v) => s + (Number(v) || 0), 0));
  const luong = Number(worker.luong) || 0;
  const phucap = Number(worker.phucap) || 0;
  const hdmuale = Number(worker.hdmuale) || 0;
  const loanAmount = Number(worker.loanAmount) || 0;
  const tru = Number(worker.tru) || 0;
  const totalLuong = tc * luong;
  const thucLanh = totalLuong + phucap + loanAmount + hdmuale - tru;
  return { tc, totalLuong, phucap, hdmuale, loanAmount, tru, thucLanh };
}

/**
 * Tính tổng nợ lũy kế trước tuần fromDate
 */
export function calcDebtBefore(workerName, fromDate, ccData) {
  if (!workerName || !fromDate) return 0;
  let debt = 0;
  (ccData || []).forEach(w => {
    if (w.deletedAt) return;
    if (w.fromDate >= fromDate) return;
    (w.workers || []).forEach(wk => {
      if (wk.name !== workerName) return;
      debt += (wk.loanAmount || 0) - (wk.tru || 0);
    });
  });
  return debt;
}

/**
 * Tổng hợp CC cho 1 tuần+CT (dùng cho history)
 */
export function summarizeWeek(week) {
  let tc = 0, totalLuong = 0, totalPC = 0, totalHD = 0, totalLoan = 0, totalTru = 0;
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const workers = week.workers || [];
  workers.forEach(wk => {
    const pay = calcWorkerPay(wk);
    tc += pay.tc;
    totalLuong += pay.totalLuong;
    totalPC += pay.phucap;
    totalHD += pay.hdmuale;
    totalLoan += pay.loanAmount;
    totalTru += pay.tru;
    (wk.d || []).forEach((v, i) => { dayTotals[i] += Number(v) || 0; });
  });
  const tongcong = totalLuong + totalPC + totalLoan + totalHD - totalTru;
  return { tc: round1(tc), totalLuong, totalPC, totalHD, totalLoan, totalTru, tongcong, dayTotals, workerCount: workers.length };
}

// ── Normalize All CC ────────────────────────────────────────

/**
 * Normalize ccData: gán projectId, sync ct name
 * @returns {boolean} changed
 */
export function normalizeAllCC(ccData, findPidFn, getNameFn) {
  let changed = false;
  (ccData || []).forEach(r => {
    if (r.deletedAt) return;
    if (!r.projectId && r.ct && findPidFn) {
      const pid = findPidFn(r.ct);
      if (pid) { r.projectId = pid; changed = true; }
    }
    if (r.projectId && r.ctPid !== r.projectId) {
      r.ctPid = r.projectId; changed = true;
    }
    if (r.projectId && getNameFn) {
      const currentName = getNameFn(r.projectId);
      if (currentName && currentName !== r.ct) {
        r.ct = currentName; changed = true;
      }
    }
  });
  return changed;
}

// ── All Worker Names ────────────────────────────────────────

/**
 * Lấy tất cả tên công nhân (từ ccData + danh mục)
 */
export function ccAllNames(ccData, congNhanCat) {
  const s = new Set();
  (ccData || []).filter(w => !w.deletedAt).forEach(w =>
    (w.workers || []).forEach(wk => { if (wk.name) s.add(wk.name); })
  );
  (congNhanCat || []).forEach(n => s.add(n));
  return [...s].sort((a, b) => a.localeCompare(b, 'vi'));
}

// ── Clipboard Logic ─────────────────────────────────────────

/**
 * Prepare workers data cho clipboard (copy tuần)
 * Copy: tên + lương + ngày công. Reset: phụ cấp/HĐ lẻ/vay/trừ/nội dung
 */
export function prepareCopyData(workers) {
  return (workers || [])
    .filter(w => w.name || (w.d || []).some(v => v > 0))
    .map(w => ({
      name: w.name,
      luong: w.luong || 0,
      d: [...(w.d || [0, 0, 0, 0, 0, 0, 0])],
      phucap: 0, hdmuale: 0, loanAmount: 0, nd: '', role: w.role || '', tru: 0
    }));
}

/**
 * Tạo stub workers khi không có data (tên + lương từ tuần cũ, xóa ngày)
 */
export function createWorkerStubs(workers) {
  return (workers || []).map(wk => ({
    name: wk.name, luong: wk.luong || 0,
    d: [0, 0, 0, 0, 0, 0, 0],
    phucap: 0, hdmuale: 0, loanAmount: 0, nd: '', role: wk.role || '', tru: 0
  }));
}

// ══════════════════════════════════════════════════════════════
// SIDE-EFFECT FUNCTIONS — đọc/ghi qua window.load / window.save
// (gọi window.* tại call-time, không capture ở module level)
// ══════════════════════════════════════════════════════════════

/**
 * saveCCWeek — lưu tuần chấm công vào cc_v2.
 * Đọc DOM của bảng #cc-tbody, gom workers, dedup và upsert.
 */
export function saveCCWeek() {
  const btn = document.getElementById('cc-save-btn');
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;

  const fromDate = document.getElementById('cc-from')?.value;
  const toDate   = document.getElementById('cc-to')?.value;
  const ccCtSel  = document.getElementById('cc-ct-sel');
  const ct       = (ccCtSel?.value || '').trim();
  const ctPid    = typeof window._readPidFromSel === 'function' ? window._readPidFromSel(ccCtSel) : null;
  const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';

  const _enableBtn = () => {
    if (btn) { btn.disabled = false; if (typeof window.updateCCSaveBtn === 'function') window.updateCCSaveBtn(); }
  };
  const _toast = typeof window.toast === 'function' ? window.toast : () => {};
  const _checkClosed = typeof window._checkProjectClosed === 'function' ? window._checkProjectClosed : () => false;

  if (!fromDate) { _toast('Chọn ngày bắt đầu tuần!', 'error'); _enableBtn(); return; }
  if (!ct)       { _toast('Chọn công trình!', 'error');        _enableBtn(); return; }
  if (_checkClosed(ctPid, ct)) { _enableBtn(); return; }

  // Kiểm tra tên trùng
  const names = [];
  let dupFound = false;
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row) [data-cc="name"]').forEach(el => {
    const n  = el.value.trim();
    const nL = n.toLowerCase();
    if (n && names.includes(nL)) { dupFound = true; el.style.boxShadow = 'inset 0 0 0 2px var(--red)'; }
    else if (n) names.push(nL);
  });
  if (dupFound) { _toast('⚠️ Còn tên trùng nhau! Sửa trước khi lưu.', 'error'); _enableBtn(); return; }

  const workers = [];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr => {
    const name       = (tr.querySelector('[data-cc="name"]')?.value?.trim()   || '');
    const luong      = parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw   || 0) || 0;
    const phucap     = parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw  || 0) || 0;
    const hdmuale    = parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw    || 0) || 0;
    const loanAmount = parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw    || 0) || 0;
    const tru        = parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw     || 0) || 0;
    const nd         = (tr.querySelector('[data-cc="nd"]')?.value?.trim()    || '');
    const role       = tr.querySelector('[data-cc="tp"]')?.value  || '';
    const d = [];
    for (let i = 0; i < 7; i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value || 0) || 0);
    if (name || d.some(v => v > 0)) workers.push({ name, luong, d, phucap, hdmuale, loanAmount, nd, role, tru });
  });
  if (!workers.length) { _toast('Chưa có công nhân nào!', 'error'); _enableBtn(); return; }

  let ccData = window.load('cc_v2', []);

  const matchKey = w => {
    if (w.deletedAt) return false;
    if (w.fromDate !== fromDate) return false;
    if (ctPid) return (w.projectId === ctPid || w.ctPid === ctPid);
    return w.ct === ct;
  };

  // Xóa các bản duplicate thừa (giữ bản mới nhất nếu nhiều)
  const dups = ccData.filter(w => matchKey(w));
  if (dups.length > 1) {
    dups.sort((a, b) => (b.updatedAt || b.id || 0) - (a.updatedAt || a.id || 0));
    ccData = ccData.filter(w => !matchKey(w));
    ccData.unshift(dups[0]);
  }

  const idx = ccData.findIndex(w => matchKey(w));
  if (idx >= 0) {
    ccData[idx].workers   = workers;
    ccData[idx].toDate    = toDate;
    ccData[idx].updatedAt = Date.now();
    if (ctPid) { ccData[idx].projectId = ctPid; ccData[idx].ctPid = ctPid; }
    if (ct)     ccData[idx].ct = ct;
  } else {
    ccData.unshift({
      id: crypto.randomUUID(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID,
      fromDate, toDate, ct, ctPid, projectId: ctPid || null, workers
    });
  }
  window.save('cc_v2', ccData);
  if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
  if (typeof window.updateTop === 'function') window.updateTop();

  if (typeof window.rebuildCCNameList === 'function') window.rebuildCCNameList();
  if (typeof window.populateCCCtSel  === 'function') window.populateCCCtSel();

  // Restore filter context
  const histWeekEl = document.getElementById('cc-hist-week'); if (histWeekEl) histWeekEl.value = fromDate;
  const tltWeekEl  = document.getElementById('cc-tlt-week');  if (tltWeekEl)  tltWeekEl.value  = fromDate;
  const histCtEl   = document.getElementById('cc-hist-ct');   if (histCtEl)   histCtEl.value   = ct;
  const tltCtEl    = document.getElementById('cc-tlt-ct');    if (tltCtEl)    tltCtEl.value    = ct;

  if (typeof window.renderCCHistory === 'function') window.renderCCHistory();
  setTimeout(() => { document.getElementById('cc-tlt-pagination')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 150);

  const totalLuong = workers.reduce((s, wk) => {
    const tc = round1(wk.d.reduce((a, v) => a + v, 0));
    return s + tc * (wk.luong || 0) + (wk.phucap || 0);
  }, 0);
  const hdCount = workers.filter(w => w.hdmuale > 0).length;
  const msg = `✅ Đã lưu ${viShort(fromDate)}–${viShort(toDate)} [${ct}]`
    + (hdCount ? ` · ${hdCount} HĐ lẻ` : '')
    + (totalLuong > 0 ? ' · Nhân công cập nhật' : '');
  _toast(msg, 'success');

  setTimeout(() => {
    if (btn) { btn.disabled = false; if (typeof window.updateCCSaveBtn === 'function') window.updateCCSaveBtn(); }
  }, 500);
}

/**
 * delCCWeekById — soft-delete 1 tuần CC theo id hoặc fromDate+ct.
 */
export function delCCWeekById(id, fromDate, ct) {
  const _toast    = typeof window.toast === 'function' ? window.toast : () => {};
  const _getPN    = typeof window._getProjectNameById === 'function' ? window._getProjectNameById : v => v;
  const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';

  const ctDisplay = _getPN(ct) || ct;
  if (!confirm(`Xóa toàn bộ chấm công tuần ${viShort(fromDate)} của công trình "${ctDisplay}"?`)) return;

  const now    = Date.now();
  let ccData   = window.load('cc_v2', []);
  let found    = false;

  ccData = ccData.map(r => {
    const matchId  = String(r.id) === String(id);
    const matchKey = r.fromDate === fromDate && (r.projectId === ct || r.ct === ct);
    if ((matchId || matchKey) && !r.deletedAt) {
      found = true;
      return { ...r, deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
    }
    return r;
  });

  if (!found) { _toast('Không tìm thấy dữ liệu để xóa', 'error'); return; }
  window.save('cc_v2', ccData);
  if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
  if (typeof window.updateTop === 'function') window.updateTop();
  if (typeof window.renderCCHistory === 'function') window.renderCCHistory();
  if (typeof window.renderCCTLT === 'function') window.renderCCTLT();
  _toast('Đã xóa tuần chấm công');
}

/**
 * delCCWorker — xóa 1 công nhân khỏi week record (không soft-delete nếu còn CN khác).
 */
export function delCCWorker(wid, name) {
  const _toast = typeof window.toast === 'function' ? window.toast : () => {};
  if (!confirm(`Xóa "${name}" khỏi tuần này?`)) return;

  const ccData = window.load('cc_v2', []);
  const w = ccData.find(r => r.id === wid);
  if (w) {
    w.workers = (w.workers || []).filter(wk => wk.name !== name);
    // Nếu không còn ai → soft-delete toàn week
    if (!w.workers.length) {
      const now = Date.now();
      const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';
      const idx = ccData.findIndex(r => r.id === wid);
      if (idx >= 0) ccData[idx] = { ...ccData[idx], deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
    }
  }
  if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
  window.save('cc_v2', ccData);
  if (typeof window.renderCCHistory === 'function') window.renderCCHistory();
  _toast('Đã xóa');
}

/**
 * delCCWeekHistory — alias: xóa theo fromDate+ct (không có id).
 */
export function delCCWeekHistory(fromDate, ct) {
  delCCWeekById('', fromDate, ct);
}

/**
 * loadCCWeekFromHistory — alias: tải tuần theo fromDate+ct.
 */
export function loadCCWeekFromHistory(fromDate, ct) {
  if (typeof window.loadCCWeekById === 'function') window.loadCCWeekById('', fromDate, ct);
}

/**
 * rebuildCCCategories — không tự động thêm danh mục từ ccData (theo thiết kế mới).
 * Hàm giữ nguyên để tương thích, không làm gì thêm.
 */
export function rebuildCCCategories() {
  return { cts: 0, names: 0, tps: 0 };
}

/**
 * updateTopFromCC — cập nhật topbar từ ccData hiện tại.
 */
export function updateTopFromCC() {
  const ccData   = window.load('cc_v2', []);
  const invoices = window.load('inv_v3', []);
  const inAY = typeof window.inActiveYear === 'function' ? window.inActiveYear : () => true;
  const fmtS = typeof window.fmtS === 'function' ? window.fmtS : n => String(n);

  let ccTotal = 0;
  ccData.forEach(w => {
    if (w.deletedAt) return;
    if (!inAY(w.fromDate)) return;
    (w.workers || []).forEach(wk => {
      const tc = (wk.d || []).reduce((s, v) => s + (Number(v) || 0), 0);
      ccTotal += tc * (wk.luong || 0) + (wk.phucap || 0) + (wk.hdmuale || 0);
    });
  });
  const manualTotal = invoices
    .filter(i => !i.deletedAt && inAY(i.ngay))
    .reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  const total = ccTotal + manualTotal;

  const topTotal = document.getElementById('top-total'); if (topTotal) topTotal.textContent = fmtS(total);
  const topM     = document.getElementById('top-total-mobile'); if (topM) topM.textContent = fmtS(total);
  const topH     = document.getElementById('top-total-header'); if (topH) topH.textContent = fmtS(total);
}

/**
 * normalizeAllChamCong — normalize ccData: gán projectId, sync ct name, lưu nếu thay đổi.
 * Side-effect version của normalizeAllCC từ payroll.logic.js.
 */
export function normalizeAllChamCong() {
  const ccData  = window.load('cc_v2', []);
  const findPid = typeof window.findProjectIdByName === 'function' ? window.findProjectIdByName : null;
  const getName = typeof window._getProjectNameById === 'function' ? window._getProjectNameById : null;
  const changed = normalizeAllCC(ccData, findPid, getName);
  if (changed) window.save('cc_v2', ccData);
}

/**
 * exportUngToImage — xuất phiếu tạm ứng (dùng html2canvas).
 * Đọc filteredUng từ window.filteredUng.
 */
export function exportUngToImage() {
  const _toast   = typeof window.toast === 'function' ? window.toast : () => {};
  const _x       = typeof window.x === 'function' ? window.x : s => String(s || '');
  const numFmt   = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const sumByFn  = typeof window.sumBy === 'function' ? window.sumBy : (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);
  const _rmTones = (str) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s_]/g, '').trim().replace(/\s+/g, '_');
  };

  const filteredUng = window.filteredUng || [];
  const checkedIds  = new Set(
    [...document.querySelectorAll('.ung-row-chk:checked')].map(el => el.dataset.id)
  );
  if (!checkedIds.size) { _toast('⚠️ Vui lòng tick chọn ít nhất 1 khoản ứng!', 'error'); return; }
  const rows = filteredUng.filter(r => checkedIds.has(String(r.id)));
  if (!rows.length) { _toast('⚠️ Không tìm thấy dữ liệu — thử lọc lại rồi tick chọn!', 'error'); return; }

  const ct       = rows[0]?.congtrinh || '(Chưa rõ CT)';
  const tongTien = sumByFn(rows, 'tien');

  const _setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  _setTxt('pul-ct-name',  ct);
  _setTxt('pul-ct-label', ct);
  _setTxt('pul-date',     new Date().toLocaleDateString('vi-VN'));

  const pulTbody = document.getElementById('pul-tbody');
  if (pulTbody) {
    pulTbody.innerHTML = rows.map((r, i) => `
      <tr style="${i % 2 === 1 ? 'background:#f9f7f4' : ''}">
        <td style="padding:8px 10px;white-space:nowrap">${r.ngay}</td>
        <td style="padding:8px 10px;font-weight:600">${_x(r.tp || '—')}</td>
        <td style="padding:8px 10px;color:#555">${_x(r.nd || '—')}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;color:#c8870a;white-space:nowrap">
          ${numFmt(r.tien || 0)} đ
        </td>
      </tr>`).join('');
  }
  _setTxt('pul-total-cell',  numFmt(tongTien) + ' đ');
  _setTxt('pul-grand-total', 'TỔNG TIỀN TẠM ỨNG: ' + numFmt(tongTien) + ' đồng');

  const safeCT = _rmTones(ct);
  const tpMap  = {};
  rows.forEach(r => { const key = r.tp || 'KhongRo'; tpMap[key] = (tpMap[key] || 0) + (r.tien || 0); });
  const workerParts = Object.entries(tpMap)
    .map(([tp, tien]) => _rmTones(tp) + '_' + Math.round(tien / 1000) + 'k').join('_');
  const fileName = 'Phieuung_' + safeCT + '_' + workerParts;

  const tpl = document.getElementById('phieu-ung-template');
  if (!tpl) { _toast('❌ Không tìm thấy template phiếu ứng!', 'error'); return; }
  tpl.style.display = 'block';
  _toast('⏳ Đang tạo phiếu tạm ứng...', 'info');

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
        const link = document.createElement('a');
        link.download = fileName + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        _toast('✅ Đã xuất phiếu tạm ứng ' + rows.length + ' dòng!', 'success');
      })
      .catch(err => {
        tpl.style.display = 'none';
        _toast('❌ Lỗi khi tạo ảnh: ' + err.message, 'error');
      });
  });
}

/**
 * initUngTable — khởi tạo bảng tiền ứng (UI init, gọi từ main / payroll bootstrap).
 * Đây là stub — UI thực tế quản lý bởi danhmuc.js / chamcong.js legacy.
 * Giữ để tránh "not a function" nếu ai gọi window.initUngTable(n).
 */
export function initUngTable(n) {
  // Không có logic cần port — bảng ứng được render bởi renderUng() trong danhmuc.js.
  console.log('[payroll.logic] initUngTable called (n=' + n + ') — delegated to renderUng()');
  if (typeof window.renderUng === 'function') window.renderUng();
}

// ══════════════════════════════════════════════════════════════
// 🔌 BRIDGE TẠM
// ══════════════════════════════════════════════════════════════
window._payrollLogic = {
  CC_DAY_LABELS, CC_DATE_OFFSETS, CC_PG_HIST, CC_PG_TLT,
  isoFromParts, ccSundayISO, ccSaturdayISO, snapToSunday,
  viShort, weekLabel, round1, dedupCC,
  calcWorkerPay, calcDebtBefore, summarizeWeek,
  normalizeAllCC, ccAllNames,
  prepareCopyData, createWorkerStubs,
  // Side-effect functions
  saveCCWeek, delCCWeekById, delCCWeekHistory, delCCWorker,
  loadCCWeekFromHistory, rebuildCCCategories,
  updateTopFromCC, normalizeAllChamCong, exportUngToImage, initUngTable,
};

// Direct window bridges
window.saveCCWeek             = saveCCWeek;
window.delCCWeekById          = delCCWeekById;
window.delCCWeekHistory       = delCCWeekHistory;
window.delCCWorker            = delCCWorker;
window.loadCCWeekFromHistory  = loadCCWeekFromHistory;
window.rebuildCCCategories    = rebuildCCCategories;
window.updateTopFromCC        = updateTopFromCC;
window.normalizeAllChamCong   = normalizeAllChamCong;
window.exportUngToImage       = exportUngToImage;
window.initUngTable           = initUngTable;

console.log('[payroll.logic] ES Module loaded ✅');
