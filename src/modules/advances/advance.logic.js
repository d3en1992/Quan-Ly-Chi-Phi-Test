// ══════════════════════════════════════════════════════════════
// src/modules/advances/advance.logic.js — Advance (Tiền Ứng) Logic
// Prompt 8 — ES Modules Refactor
// Bốc từ danhmuc.js: logic tiền ứng (ung_v1)
// ══════════════════════════════════════════════════════════════

import { today } from '../../utils/date.util.js';

// ── Normalize: cancelled=true → deletedAt ────────────────────
export function normalizeUngDeletedAt(ungRecords, saveFn) {
  let changed = false;
  const result = (ungRecords || []).map(r => {
    if (!r) return r;
    if (r.cancelled === true && !r.deletedAt) {
      changed = true;
      return { ...r, deletedAt: r.updatedAt || Date.now() };
    }
    if (Object.prototype.hasOwnProperty.call(r, 'cancelled')) {
      changed = true;
      const rec = { ...r };
      delete rec.cancelled;
      return rec;
    }
    return r;
  });
  if (changed) saveFn('ung_v1', result);
  return result;
}

// ── Normalize: gán projectId từ congtrinh ────────────────────
export function normalizeUngProjectIds(ungRecords, findPidByName, getNameById, saveFn) {
  let changed = false;
  ungRecords.forEach(r => {
    if (r.deletedAt) return;
    if (!r.projectId && r.congtrinh) {
      const pid = findPidByName(r.congtrinh);
      if (pid) { r.projectId = pid; changed = true; }
    }
    if (r.projectId) {
      const pName = getNameById(r.projectId);
      if (pName && pName !== r.congtrinh) {
        r.congtrinh = pName; changed = true;
      }
    }
  });
  if (changed) saveFn('ung_v1', ungRecords);
}

// ── Filter tiền ứng ──────────────────────────────────────────
export function filterUngRecords(ungRecords, opts) {
  const { query, filterTp, filterCt, filterMonth, inActiveYear, resolveProjectName } = opts;
  const q = (query || '').toLowerCase();

  return ungRecords.filter(r => {
    if (r.deletedAt) return false;
    if (r.loai === 'congnhan') return false;
    if (!inActiveYear(r.ngay)) return false;
    if (filterTp && r.tp !== filterTp) return false;
    if (filterCt && resolveProjectName(r) !== filterCt) return false;
    if (filterMonth && !r.ngay.startsWith(filterMonth)) return false;
    if (q) {
      const t = [r.ngay, r.tp, resolveProjectName(r), r.nd].join(' ').toLowerCase();
      if (!t.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
}

// ── Build filter data ────────────────────────────────────────
export function buildUngFilterData(ungRecords, allProjects, resolveProjectName) {
  const active = ungRecords.filter(r => !r.deletedAt);
  const tps    = [...new Set(active.map(i => i.tp))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
  const cts    = [...new Set(active.map(i => resolveProjectName(i)))].filter(Boolean);
  const sortedCts = allProjects.map(p => p.name).filter(name => cts.includes(name));
  const months = [...new Set(active.map(i => i.ngay.slice(0, 7)))].filter(Boolean).sort().reverse();
  return { tps, sortedCts, months };
}

// ── Validate row data trước khi save ─────────────────────────
export function validateUngRow(rowData) {
  const errors = [];
  if (!rowData.tp) errors.push('Thiếu tên TP/NCC');
  return { valid: errors.length === 0, errors };
}

// ── Tạo record tiền ứng mới ─────────────────────────────────
export function buildUngRecord(rowData, mkRecordFn) {
  return mkRecordFn({
    ngay: rowData.ngay || today(),
    loai: rowData.loai || 'thauphu',
    tp: rowData.tp,
    congtrinh: rowData.congtrinh || '',
    projectId: rowData.projectId || null,
    tien: rowData.tien || 0,
    nd: rowData.nd || ''
  });
}

// ── Options cho select thầu phụ / NCC ────────────────────────
export function getUngTpOptions(loai, cats) {
  if (loai === 'nhacungcap') return cats.nhaCungCap || [];
  return cats.thauPhu || [];
}

// ── Bridge tạm ──────────────────────────────────────────────
window._advanceLogic = {
  normalizeUngDeletedAt,
  normalizeUngProjectIds,
  filterUngRecords,
  buildUngFilterData,
  validateUngRow,
  buildUngRecord,
  getUngTpOptions,
};

console.log('[advance.logic] ES Module loaded ✅');
