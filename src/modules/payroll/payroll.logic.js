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
// 🔌 BRIDGE TẠM
// ══════════════════════════════════════════════════════════════
window._payrollLogic = {
  CC_DAY_LABELS, CC_DATE_OFFSETS, CC_PG_HIST, CC_PG_TLT,
  isoFromParts, ccSundayISO, ccSaturdayISO, snapToSunday,
  viShort, weekLabel, round1, dedupCC,
  calcWorkerPay, calcDebtBefore, summarizeWeek,
  normalizeAllCC, ccAllNames,
  prepareCopyData, createWorkerStubs,
};
