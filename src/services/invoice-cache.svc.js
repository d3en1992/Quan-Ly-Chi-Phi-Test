// ══════════════════════════════════════════════════════════════
// src/services/invoice-cache.svc.js — Invoice Cache & Builder
// Prompt 11 — Ported from tienich.js
// buildInvoices(): tổng hợp manual invoices + CC-derived invoices
// getInvoicesCached(): cache wrapper
// clearInvoiceCache(): invalidate
// ══════════════════════════════════════════════════════════════

import { load } from '../core/db.js';

// ── Invoice cache ───────────────────────────────────────────
let _invoiceCache = null;

/**
 * Tổng hợp invoice từ data gốc (không lưu vào inv_v3).
 * Trả về: manual invoices (source='manual') + CC invoices (source='cc').
 * Tất cả module hiển thị chi phí phải dùng hàm này thay vì đọc invoices trực tiếp.
 */
export function buildInvoices() {
  const _invRaw = load('inv_v3', []);
  const _ccRaw  = load('cc_v2', []);

  // 1. Manual invoices — chỉ những HĐ nhập tay, chưa bị xóa mềm
  const manual = _invRaw
    .filter(inv => !inv.deletedAt)
    .map(inv => ({
      ...inv,
      source: (inv.source === 'quick' || inv.source === 'detail') ? inv.source : 'manual'
    }));

  // 2. CC-derived invoices — tính động từ _ccRaw
  const ccInvs = [];
  const _vi = ds => {
    const [, m, d] = ds.split('-').map(Number);
    return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m;
  };
  const _ccData = _ccRaw.filter(w => !w.deletedAt);
  _ccData.forEach(week => {
    const { fromDate, ct, workers } = week;
    if (!fromDate || !ct || !workers || !workers.length) return;
    let toDate = week.toDate;
    if (!toDate) {
      const [y, m, d] = fromDate.split('-').map(Number);
      const sat = new Date(y, m - 1, d + 6);
      toDate = sat.getFullYear() + '-' + String(sat.getMonth() + 1).padStart(2, '0') + '-' + String(sat.getDate()).padStart(2, '0');
    }
    const pfx = 'cc|' + fromDate + '|' + ct + '|';

    // HĐ Mua Lẻ — 1 dòng mỗi công nhân có hdmuale > 0
    workers.forEach(wk => {
      if (!wk.hdmuale || wk.hdmuale <= 0) return;
      const key = pfx + wk.name + '|hdml';
      ccInvs.push({
        id: key, ccKey: key, source: 'cc',
        ngay: toDate, congtrinh: ct, projectId: week.projectId || null, loai: 'Hóa Đơn Lẻ',
        nguoi: wk.name, ncc: '',
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
        ngay: toDate, congtrinh: ct, projectId: week.projectId || null, loai: 'Nhân Công',
        nguoi: fw, ncc: '',
        nd: 'Lương tuần ' + _vi(fromDate) + '–' + _vi(toDate),
        tien: totalLuong, thanhtien: totalLuong, _ts: 0
      });
    }
  });

  return [...manual, ...ccInvs];
}

/**
 * Cache wrapper — tránh gọi buildInvoices() nhiều lần mỗi render.
 */
export function getInvoicesCached() {
  if (!_invoiceCache) _invoiceCache = buildInvoices();
  return _invoiceCache;
}

/**
 * Xóa cache — gọi sau mỗi mutation liên quan đến invoices/ccData.
 */
export function clearInvoiceCache() {
  _invoiceCache = null;
}

// ── Window bridges ──────────────────────────────────────────
window.buildInvoices     = buildInvoices;
window.getInvoicesCached = getInvoicesCached;
window.clearInvoiceCache = clearInvoiceCache;

console.log('[invoice-cache.svc] ES Module loaded ✅');
