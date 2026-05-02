// ══════════════════════════════════════════════════════════════
// src/modules/revenue/revenue.logic.js — Revenue Business Logic
// Prompt 8 — ES Modules Refactor
// Bốc từ doanhthu.js: Hợp đồng chính, thầu phụ, thu tiền, công nợ
// ══════════════════════════════════════════════════════════════

import { parseNumber } from '../../utils/math.util.js';
import { today } from '../../utils/date.util.js';

// ── Tính giá trị hợp đồng từ items hoặc sl*donGia ──────────
export function calcHopDongValue(hd) {
  if (hd.items && hd.items.length) {
    return hd.items.reduce((sum, i) => sum + (parseFloat(i.sl) || 0) * (parseFloat(i.donGia) || 0), 0);
  }
  return (parseFloat(hd.sl) || 1) * (parseFloat(hd.donGia) || 0);
}

// ── Migration: thêm sl/donGia cho hợp đồng cũ ──────────────
export function migrateHopDongSL(hopDongData, thauPhuContracts, saveFn) {
  let changed = false;
  Object.values(hopDongData).forEach(hd => {
    if (hd.sl === undefined) { hd.sl = 1; hd.donGia = hd.giaTri || 0; changed = true; }
  });
  if (changed) saveFn('hopdong_v1', hopDongData);

  changed = false;
  thauPhuContracts.forEach(hd => {
    if (hd.sl === undefined) { hd.sl = 1; hd.donGia = hd.giaTri || 0; changed = true; }
  });
  if (changed) saveFn('thauphu_v1', thauPhuContracts);
}

// ── Normalize thu records: gán projectId từ congtrinh ────────
export function normalizeThuProjectIds(thuRecords, findPidByName, getNameById, saveFn) {
  let changed = false;
  thuRecords.forEach(r => {
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
  if (changed) saveFn('thu_v1', thuRecords);
}

// ── Filter helpers ───────────────────────────────────────────
export function matchProjFilter(record, ctFilter, allProjects) {
  if (!ctFilter) return true;
  if (record.projectId) {
    const proj = allProjects.find(p => p.name === ctFilter);
    if (proj) return record.projectId === proj.id;
  }
  return (record.congtrinh || '') === ctFilter;
}

export function matchHDCFilter(keyId, hd, ctFilter, allProjects) {
  if (!ctFilter) return true;
  if (keyId === ctFilter) return true;
  const filterProj = allProjects.find(p => p.name === ctFilter);
  if (filterProj) {
    if (keyId === filterProj.id) return true;
    if (hd.projectId && hd.projectId === filterProj.id) return true;
  }
  const keyProj = allProjects.find(p => p.id === keyId);
  if (keyProj && keyProj.name === ctFilter) return true;
  return false;
}

// ── Tính công nợ thầu phụ ────────────────────────────────────
export function calcCongNoThauPhu(ungRecords, thauPhuContracts, opts) {
  const { inActiveYear, matchFilter, resolveCtName } = opts;
  const map = {};

  ungRecords
    .filter(r => r.loai === 'thauphu' && !r.deletedAt && inActiveYear(r.ngay) && matchFilter(r))
    .forEach(r => {
      const ctDisplay = resolveCtName(r);
      const key = (r.tp || '') + '|||' + ctDisplay;
      if (!map[key]) map[key] = { thauphu: r.tp || '', congtrinh: ctDisplay, tongUng: 0, count: 0, tongHD: 0 };
      map[key].tongUng += (r.tien || 0);
      map[key].count++;
    });

  thauPhuContracts
    .filter(r => !r.deletedAt && matchFilter(r))
    .forEach(r => {
      const ctDisplay = resolveCtName(r);
      const key = (r.thauphu || '') + '|||' + ctDisplay;
      if (!map[key]) map[key] = { thauphu: r.thauphu || '', congtrinh: ctDisplay, tongUng: 0, count: 0, tongHD: 0 };
      map[key].tongHD += (r.giaTri || 0) + (r.phatSinh || 0);
    });

  return Object.values(map)
    .map(r => ({ ...r, name: r.thauphu }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.congtrinh.localeCompare(b.congtrinh, 'vi'));
}

// ── Tính công nợ NCC ─────────────────────────────────────────
export function calcCongNoNCC(ungRecords, invoicesCached, nccList, opts) {
  const { inActiveYear, selProjId, getProjectById, resolveProjectName } = opts;
  const rows = [];

  const nccFromUng = new Set(
    ungRecords
      .filter(r => r.loai === 'nhacungcap' && !r.deletedAt && inActiveYear(r.ngay))
      .map(r => (r.tp || '').trim())
      .filter(Boolean)
  );

  nccList.filter(ncc => nccFromUng.has(ncc)).forEach(ncc => {
    let tongUng = 0, tongTien = 0;
    const ctSet = new Set();

    ungRecords
      .filter(r => r.loai === 'nhacungcap' && (r.tp || '') === ncc && !r.deletedAt && inActiveYear(r.ngay) && (!selProjId || r.projectId === selProjId))
      .forEach(r => { tongUng += (r.tien || 0); });

    invoicesCached
      .filter(inv => !inv.deletedAt && inActiveYear(inv.ngay) && (inv.ncc || '') === ncc && (!selProjId || inv.projectId === selProjId))
      .forEach(inv => {
        const proj = inv.projectId ? getProjectById(inv.projectId) : null;
        if (proj && proj.status === 'closed') return;
        tongTien += (inv.thanhtien || inv.tien || 0);
      });

    ungRecords
      .filter(r => r.loai === 'nhacungcap' && (r.tp || '') === ncc && !r.deletedAt && inActiveYear(r.ngay) && (!selProjId || r.projectId === selProjId))
      .forEach(r => {
        const proj = r.projectId ? getProjectById(r.projectId) : null;
        if (proj && proj.status === 'closed') return;
        const ctName = resolveProjectName(r) || '';
        if (ctName) ctSet.add(ctName);
      });

    if (tongUng === 0 && tongTien === 0 && ctSet.size === 0) return;

    rows.push({
      name: ncc,
      congtrinh: Array.from(ctSet).join(', '),
      tongUng,
      tongHD: tongTien,
      conPhaiTT: tongTien - tongUng,
      count: 0
    });
  });

  rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return rows;
}

// ── Tính bảng lãi/lỗ ─────────────────────────────────────────
export function calcLaiLo(invoicesCached, thuRecords, hopDongData, projects, opts) {
  const { inActiveYear, resolveProjectName, dtInYear } = opts;

  const tongChi = {};
  invoicesCached.filter(i => inActiveYear(i.ngay)).forEach(i => {
    const ct = resolveProjectName(i) || '(Không rõ)';
    tongChi[ct] = (tongChi[ct] || 0) + (i.thanhtien || i.tien || 0);
  });

  const daThu = {};
  thuRecords.filter(r => !r.deletedAt && inActiveYear(r.ngay)).forEach(r => {
    const ct = resolveProjectName(r) || '';
    daThu[ct] = (daThu[ct] || 0) + (r.tien || 0);
  });

  const hdByCT = {};
  Object.entries(hopDongData).filter(([, v]) => !v.deletedAt && dtInYear(v.ngay)).forEach(([keyId, hd]) => {
    const p = projects.find(proj => proj.id === keyId);
    const ctName = p ? p.name : keyId;
    hdByCT[ctName] = {
      giaTri:    hd.giaTri    || 0,
      giaTriphu: hd.giaTriphu || 0,
      phatSinh:  hd.phatSinh  || 0,
    };
  });

  const allCts = [...new Set([
    ...Object.keys(tongChi),
    ...Object.keys(hdByCT)
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));

  return allCts.map(ct => {
    const hd       = hdByCT[ct] || {};
    const giaTri   = hd.giaTri    || 0;
    const giaTriphu= hd.giaTriphu || 0;
    const phatSinh = hd.phatSinh  || 0;
    const tongDTct = giaTri + giaTriphu + phatSinh;
    const chi      = tongChi[ct] || 0;
    const thu      = daThu[ct]   || 0;
    return { ct, giaTri, giaTriphu, phatSinh, tongDT: tongDTct, chi, thu, conPhaiThu: tongDTct - thu, laiLo: tongDTct - chi };
  });
}

// ── Resolve tên CT (dùng chung) ──────────────────────────────
export function resolveCtNameFromRecord(record, projects) {
  if (record.projectId) {
    const p = projects.find(proj => proj.id === record.projectId);
    if (p) return p.name;
  }
  return record.congtrinh || record.ct || '';
}

export function resolveCtNameFromKey(keyId, projects) {
  const p = projects.find(proj => proj.id === keyId);
  return p ? p.name : keyId;
}

// ── Format input tiền tệ ─────────────────────────────────────
export function fmtInputMoney(el) {
  const raw = el.value.replace(/[^0-9]/g, '');
  el.dataset.raw = raw;
  el.value = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
}

export function readMoneyInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = el.dataset.raw || el.value.replace(/[^0-9]/g, '');
  return parseInt(raw) || 0;
}

// ── Pagination helper ────────────────────────────────────────
export function paginationHtml(total, curPage, pageSize, onClickFn) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return '';
  const btns = [];
  if (curPage > 0)
    btns.push(`<button class="sub-nav-btn" onclick="${onClickFn}(${curPage - 1})">‹</button>`);
  for (let i = 0; i < pages; i++) {
    btns.push(`<button class="sub-nav-btn ${i === curPage ? 'active' : ''}" onclick="${onClickFn}(${i})">${i + 1}</button>`);
  }
  if (curPage < pages - 1)
    btns.push(`<button class="sub-nav-btn" onclick="${onClickFn}(${curPage + 1})">›</button>`);
  return btns.join('');
}

// ── Bridge tạm ──────────────────────────────────────────────
window._revenueLogic = {
  calcHopDongValue,
  migrateHopDongSL,
  normalizeThuProjectIds,
  matchProjFilter,
  matchHDCFilter,
  calcCongNoThauPhu,
  calcCongNoNCC,
  calcLaiLo,
  resolveCtNameFromRecord,
  resolveCtNameFromKey,
  fmtInputMoney,
  readMoneyInput,
  paginationHtml,
};

// Gán fmtInputMoney lên window (dùng bởi oninput inline)
window.fmtInputMoney = fmtInputMoney;

console.log('[revenue.logic] ES Module loaded ✅');
