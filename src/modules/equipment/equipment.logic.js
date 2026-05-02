// ══════════════════════════════════════════════════════════════
// src/modules/equipment/equipment.logic.js — Equipment Logic
// Prompt 8 — ES Modules Refactor
// Bốc từ thietbi.js: logic kho tổng ↔ công trình
// ══════════════════════════════════════════════════════════════

import { today } from '../../utils/date.util.js';

// ── Constants ────────────────────────────────────────────────
export const TB_TINH_TRANG = ['Đang hoạt động', 'Cần bảo trì', 'Cần sửa chữa'];
export const TB_TEN_MAY = [
  'Máy cắt cầm tay', 'Máy cắt bàn', 'Máy uốn sắt lớn', 'Bàn uốn sắt',
  'Thước nhôm', 'Chân Dàn 1.7m', 'Chân Dàn 1.5m',
  'Chéo lớn', 'Chéo nhỏ', 'Kít tăng giàn giáo', 'Cây chống tăng'
];
export const TB_KHO_TONG = 'KHO TỔNG';
export const TB_STATUS_STYLE = {
  'Đang hoạt động': 'background:#e6f4ec;color:#1a7a45;',
  'Cần bảo trì':  'background:#fef3dc;color:#c8870a;',
  'Cần sửa chữa':   'background:#fdecea;color:#c0392b;'
};

// ── Helper: kiểm tra record thuộc KHO TỔNG ──────────────────
export function isKhoTong(r) {
  return r.projectId === 'COMPANY';
}

// ── Migration: fix projectId/ct cho KHO TỔNG + dedup ─────────
export function migrateTbData(tbData, saveFn) {
  let changed = false;

  tbData.forEach(r => {
    if (r.deletedAt) return;
    if (r.ct === TB_KHO_TONG && r.projectId !== 'COMPANY') {
      r.projectId = 'COMPANY';
      changed = true;
    }
    if (r.projectId === 'COMPANY' && r.ct !== TB_KHO_TONG) {
      r.ct = TB_KHO_TONG;
      changed = true;
    }
  });

  const dedup = new Map();
  tbData.forEach(r => {
    if (r.deletedAt) return;
    const key = (r.projectId || r.ct || '') + '||' + (r.ten || '') + '||' + (r.tinhtrang || '');
    if (dedup.has(key)) {
      const primary = dedup.get(key);
      primary.soluong = (primary.soluong || 0) + (r.soluong || 0);
      if ((r.updatedAt || 0) > (primary.updatedAt || 0)) {
        primary.updatedAt = r.updatedAt;
        primary.ngay = r.ngay || primary.ngay;
      }
      if (r.ghichu && !primary.ghichu) primary.ghichu = r.ghichu;
      r.deletedAt = Date.now();
      r.updatedAt = Date.now();
      changed = true;
    } else {
      dedup.set(key, r);
    }
  });

  if (changed) {
    saveFn('tb_v1', tbData);
    console.log('[TB Migration] Đã chuẩn hóa dữ liệu thiết bị (KHO TỔNG projectId + dedup)');
  }
}

// ── Normalize: gán projectId từ ct ───────────────────────────
export function normalizeTbProjectIds(tbData, findPidByName, getNameById, saveFn) {
  let changed = false;
  tbData.forEach(r => {
    if (r.deletedAt) return;
    if (r.ct === TB_KHO_TONG || r.projectId === 'COMPANY') {
      if (r.projectId !== 'COMPANY') { r.projectId = 'COMPANY'; changed = true; }
      if (r.ct !== TB_KHO_TONG) { r.ct = TB_KHO_TONG; changed = true; }
      return;
    }
    if (!r.projectId && r.ct) {
      const pid = findPidByName(r.ct);
      if (pid) { r.projectId = pid; changed = true; }
    }
    if (r.projectId) {
      const pName = getNameById(r.projectId);
      if (pName && pName !== r.ct) {
        r.ct = pName; changed = true;
      }
    }
  });
  if (changed) saveFn('tb_v1', tbData);
}

// ── Chuẩn hóa tên thiết bị ──────────────────────────────────
export function normalizeTbName(name) {
  return (name || '').trim().toLowerCase()
    .split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Dynamic name list: từ cats.tbTen ─────────────────────────
export function tbGetNames(cats) {
  const catList = (cats && cats.tbTen && cats.tbTen.length) ? cats.tbTen : TB_TEN_MAY;
  return [...catList].sort((a, b) => a.localeCompare(b, 'vi'));
}

// ── Chuẩn hóa cats.tbTen (dedup, normalize) ─────────────────
export function tbSyncNamesToCats(cats, saveCatsFn) {
  if (!cats || !cats.tbTen) return;
  const before = JSON.stringify(cats.tbTen);
  cats.tbTen = cats.tbTen
    .map(n => normalizeTbName(n))
    .filter(Boolean);
  const seen = new Set();
  cats.tbTen = cats.tbTen.filter(n => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  if (JSON.stringify(cats.tbTen) !== before) {
    try { saveCatsFn('tbTen'); } catch (e) {}
  }
}

// ── Filter thiết bị (bảng công trình, không gồm KHO TỔNG) ───
export function filterTbList(tbData, opts) {
  const { filterCt, filterTt, query, activeYear, activeYears, ctInActiveYear, entityInYear, inActiveYear } = opts;
  const fQ = (query || '').toLowerCase().trim();

  return tbData.filter(r => {
    if (r.deletedAt) return false;
    if (isKhoTong(r) || r.ct === TB_KHO_TONG) return false;
    if (filterCt && !(r.projectId === filterCt || r.ct === filterCt)) return false;
    if (filterTt && r.tinhtrang !== filterTt) return false;
    if (fQ && !(r.ten || '').toLowerCase().includes(fQ) && !(r.nguoi || '').toLowerCase().includes(fQ) && !(r.ghichu || '').toLowerCase().includes(fQ)) return false;
    if (activeYears ? activeYears.size > 0 : activeYear !== 0) {
      const ctActive = entityInYear(r.ct, 'ct') || inActiveYear(r.ngay);
      const isRunning = r.tinhtrang === 'Đang hoạt động';
      if (!ctActive && !isRunning) return false;
    }
    return true;
  });
}

// ── Filter KHO TỔNG ─────────────────────────────────────────
export function filterKhoTong(tbData, opts) {
  const { filterTen, filterTt } = opts;
  return tbData.filter(r => {
    if (r.deletedAt) return false;
    if (!isKhoTong(r)) return false;
    if (filterTen && r.ten !== filterTen) return false;
    if (filterTt && r.tinhtrang !== filterTt) return false;
    return true;
  }).sort((a, b) => (a.ten || '').localeCompare(b.ten, 'vi'));
}

// ── Thống kê vốn thiết bị theo CT ───────────────────────────
export function calcTbStats(tbData, resolveCtName) {
  const map = {};
  tbData.forEach(r => {
    if (r.deletedAt || !r.ct || isKhoTong(r)) return;
    const gKey = r.projectId || r.ct;
    const ctDisplay = resolveCtName(r);
    if (!map[gKey]) map[gKey] = { ct: ctDisplay, total: 0, types: new Set() };
    map[gKey].total += (r.soluong || 0);
    if (r.ten) map[gKey].types.add(r.ten);
  });
  return Object.values(map).sort((a, b) => a.ct.localeCompare(b.ct, 'vi'));
}

// ── Luân chuyển: tính kết quả ────────────────────────────────
export function calcTransferResult(sourceRecord, newCT, newCtPid, newSL, newTT, newGhichu, tbData) {
  const oldSL = sourceRecord.soluong || 0;
  if (newSL <= 0 || newSL > oldSL) return { valid: false, error: `Số lượng không hợp lý (phải từ 1 đến ${oldSL})!` };
  if (!newCT) return { valid: false, error: 'Vui lòng chọn công trình!' };

  const remaining = oldSL - newSL;
  return { valid: true, remaining, newSL, oldSL };
}

// ── Bridge tạm ──────────────────────────────────────────────
window._equipmentLogic = {
  TB_TINH_TRANG,
  TB_TEN_MAY,
  TB_KHO_TONG,
  TB_STATUS_STYLE,
  isKhoTong,
  migrateTbData,
  normalizeTbProjectIds,
  normalizeTbName,
  tbGetNames,
  tbSyncNamesToCats,
  filterTbList,
  filterKhoTong,
  calcTbStats,
  calcTransferResult,
};

console.log('[equipment.logic] ES Module loaded ✅');
