// ══════════════════════════════════════════════════════════════
// src/modules/invoices/invoice.logic.js — Invoice Business Logic
// Prompt 6 — Bốc từ hoadon.js + tienich.js
// Logic nghiệp vụ: buildInvoices, cache, save/delete, trash
// ══════════════════════════════════════════════════════════════

// ── buildInvoices — Tổng hợp invoice từ data gốc ───────────
// Trả về: manual invoices (source=quick/detail) + CC invoices (source=cc)
// Bốc từ tienich.js → buildInvoices()

/**
 * Build toàn bộ invoices (manual + CC-derived)
 * @param {Array} invRaw - inv_v3 data
 * @param {Array} ccRaw - cc_v2 data
 * @returns {Array} Combined invoices
 */
export function buildInvoices(invRaw, ccRaw) {
  // 1. Manual invoices
  const manual = (invRaw || [])
    .filter(inv => !inv.deletedAt)
    .map(inv => ({
      ...inv,
      source: (inv.source === 'quick' || inv.source === 'detail') ? inv.source : 'manual'
    }));

  // 2. CC-derived invoices — tính động, không lưu vào inv_v3
  const ccInvs = [];
  const _vi = ds => {
    const [, m, d] = ds.split('-').map(Number);
    return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m;
  };
  const ccData = (ccRaw || []).filter(w => !w.deletedAt);
  ccData.forEach(week => {
    const { fromDate, ct, workers } = week;
    if (!fromDate || !ct || !workers || !workers.length) return;
    let toDate = week.toDate;
    if (!toDate) {
      const [y, m, d] = fromDate.split('-').map(Number);
      const sat = new Date(y, m - 1, d + 6);
      toDate = sat.getFullYear() + '-' + String(sat.getMonth() + 1).padStart(2, '0') + '-' + String(sat.getDate()).padStart(2, '0');
    }
    const pfx = 'cc|' + fromDate + '|' + ct + '|';
    // HĐ Mua Lẻ — 1 dòng mỗi CN có hdmuale > 0
    workers.forEach(wk => {
      if (!wk.hdmuale || wk.hdmuale <= 0) return;
      const key = pfx + wk.name + '|hdml';
      ccInvs.push({
        id: key, ccKey: key, source: 'cc',
        ngay: toDate, congtrinh: ct, projectId: week.projectId || null,
        loai: 'Hóa Đơn Lẻ', nguoi: wk.name, ncc: '',
        nd: wk.nd || ('HĐ mua lẻ – ' + wk.name + ' (' + _vi(fromDate) + '–' + _vi(toDate) + ')'),
        tien: wk.hdmuale, thanhtien: wk.hdmuale, _ts: 0
      });
    });
    // HĐ Nhân Công — 1 dòng mỗi tuần+CT
    const totalLuong = workers.reduce((s, wk) => {
      const tc = (wk.d || []).reduce((a, v) => a + (v || 0), 0);
      return s + tc * (wk.luong || 0) + (wk.phucap || 0);
    }, 0);
    if (totalLuong > 0) {
      const ncKey = pfx + 'nhanCong';
      const fw = (workers.find(w => w.name) || { name: '' }).name;
      ccInvs.push({
        id: ncKey, ccKey: ncKey, source: 'cc',
        ngay: toDate, congtrinh: ct, projectId: week.projectId || null,
        loai: 'Nhân Công', nguoi: fw, ncc: '',
        nd: 'Lương tuần ' + _vi(fromDate) + '–' + _vi(toDate),
        tien: totalLuong, thanhtien: totalLuong, _ts: 0
      });
    }
  });

  return [...manual, ...ccInvs];
}

// ── Invoice Cache ───────────────────────────────────────────
let _invoiceCache = null;

/**
 * Get cached invoices — build nếu chưa có
 * Cần truyền data lần đầu hoặc dùng global fallback
 */
export function getInvoicesCached(invRaw, ccRaw) {
  if (!_invoiceCache) {
    // Dùng params nếu có, fallback global load()
    const inv = invRaw || (typeof window.load === 'function' ? window.load('inv_v3', []) : []);
    const cc = ccRaw || (typeof window.load === 'function' ? window.load('cc_v2', []) : []);
    _invoiceCache = buildInvoices(inv, cc);
  }
  return _invoiceCache;
}

/** Clear cache — gọi sau mỗi mutation */
export function clearInvoiceCache() {
  _invoiceCache = null;
}

// ── CRUD Operations ─────────────────────────────────────────

/**
 * Đảm bảo projectId + congtrinh nhất quán
 */
export function ensureInvRef(fields, findPidFn, getProjFn) {
  let { projectId, congtrinh } = fields;
  if (!projectId && congtrinh && findPidFn) {
    projectId = findPidFn(congtrinh) || null;
  }
  if (projectId && getProjFn) {
    const p = getProjFn(projectId);
    if (p && p.name) congtrinh = p.name;
  }
  return { ...fields, projectId: projectId || null, congtrinh: congtrinh || fields.congtrinh || '' };
}

/**
 * Fuzzy string similarity (Dice coefficient)
 */
export function strSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const getBigrams = s => {
    const set = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set.set(bg, (set.get(bg) || 0) + 1);
    }
    return set;
  };
  const aMap = getBigrams(a);
  const bMap = getBigrams(b);
  let intersection = 0;
  aMap.forEach((cnt, bg) => {
    if (bMap.has(bg)) intersection += Math.min(cnt, bMap.get(bg));
  });
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/**
 * Kiểm tra trùng HĐ (dùng trước khi save)
 * @returns {Array} dupRows - danh sách HĐ nghi trùng
 */
export function checkDuplicates(newPayloads, existingInvoices) {
  const dupRows = [];
  newPayloads.forEach(payload => {
    const candidates = existingInvoices.filter(i =>
      !i.ccKey && i.ngay === payload.ngay &&
      i.congtrinh === payload.congtrinh &&
      (i.thanhtien || i.tien || 0) === payload.tien
    );
    if (!candidates.length) return;
    const nd = (payload.nd || '').toLowerCase().trim();
    candidates.forEach(inv => {
      const sim = strSimilarity(nd, (inv.nd || '').toLowerCase().trim());
      if (sim >= 0.7 || (nd === '' && (inv.nd || '') === '')) {
        dupRows.push({
          payload, existing: inv,
          similarity: sim, isExact: sim >= 0.99
        });
      }
    });
  });
  return dupRows;
}

/**
 * Tính tiền từ SL × Đơn giá - CK
 */
export function calcRowMoney(sl, dongia, ck) {
  sl = parseFloat(sl) || 1;
  dongia = parseInt(dongia) || 0;
  let total = Math.round(sl * dongia);
  if (ck) {
    const ckStr = String(ck).trim();
    if (ckStr.endsWith('%')) {
      const pct = parseFloat(ckStr) || 0;
      total = Math.round(total * (1 - pct / 100));
    } else {
      const ckVal = parseInt(String(ck).replace(/[.,\s]/g, '')) || 0;
      total = total - ckVal;
    }
  }
  return total < 0 ? 0 : total;
}

// ── Trash Operations ────────────────────────────────────────

/**
 * Thêm invoice vào trash
 */
export function trashAdd(inv, trash) {
  const newTrash = [...trash];
  newTrash.unshift({ ...inv, _deletedAt: Date.now() });
  if (newTrash.length > 100) newTrash.length = 100;
  return newTrash;
}

/**
 * Khôi phục invoice từ trash
 */
export function trashRestore(id, trash) {
  const idx = trash.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return { trash, restored: null };
  const restored = { ...trash[idx] };
  delete restored._deletedAt;
  restored.deletedAt = null;
  const newTrash = trash.filter((_, i) => i !== idx);
  return { trash: newTrash, restored };
}

/**
 * Xóa vĩnh viễn từ trash
 */
export function trashDelete(id, trash) {
  return trash.filter(i => String(i.id) !== String(id));
}

// ── Filter helpers ──────────────────────────────────────────

/**
 * Filter invoices theo criteria
 */
export function filterInvoices(invoices, { query, ct, loai, ncc, month, activeYears, resolveName }) {
  return invoices.filter(inv => {
    // Year filter
    if (activeYears && activeYears.size > 0) {
      if (!inv.ngay) return false;
      const yr = parseInt(inv.ngay.slice(0, 4));
      if (!activeYears.has(yr)) return false;
    }
    // CT filter
    if (ct) {
      const name = resolveName ? resolveName(inv) : (inv.congtrinh || '');
      if (name !== ct) return false;
    }
    // Loai filter
    if (loai && inv.loai !== loai) return false;
    // NCC filter
    if (ncc && inv.ncc !== ncc) return false;
    // Month filter
    if (month && (!inv.ngay || !inv.ngay.startsWith(month))) return false;
    // Search query
    if (query) {
      const q = query.toLowerCase();
      const searchable = [inv.nd, inv.congtrinh, inv.loai, inv.nguoi, inv.ncc]
        .filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

// ══════════════════════════════════════════════════════════════
// 🔌 BRIDGE TẠM
// ══════════════════════════════════════════════════════════════
// Override global functions cho backward compat
window._invoiceLogic = {
  buildInvoices, getInvoicesCached, clearInvoiceCache,
  ensureInvRef, strSimilarity, checkDuplicates,
  calcRowMoney, trashAdd, trashRestore, trashDelete,
  filterInvoices,
};
