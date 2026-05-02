// ══════════════════════════════════════════════════════════════
// src/utils/date.util.js — Xử lý ngày tháng
// Trích xuất từ: tienich.js (Prompt 1 — ES Modules Refactor)
// ══════════════════════════════════════════════════════════════

/**
 * Lấy ngày hiện tại dạng ISO "YYYY-MM-DD"
 * @returns {string} VD: "2026-04-30"
 */
export function today() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Chuyển ISO "YYYY-MM-DD" hoặc Date → "DD/MM/YYYY" (định dạng VN)
 * @param {string|Date} d - Ngày cần format
 * @returns {string} VD: "30/04/2026" hoặc "" nếu null
 */
export function formatDate(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + dt.getFullYear();
}

/**
 * Alias rõ nghĩa hơn — cùng chức năng formatDate
 * @param {string|Date} d
 * @returns {string}
 */
export function formatViDate(d) {
  return formatDate(d);
}

/**
 * Tính ngày Chủ nhật đầu tuần (ISO Monday-based → Sunday start)
 * Dùng cho module chấm công: tuần bắt đầu từ Chủ nhật
 * @param {Date|string} date - Ngày bất kỳ trong tuần
 * @returns {string} ISO "YYYY-MM-DD" của Chủ nhật đầu tuần
 */
export function ccSundayISO(date) {
  const d = (date instanceof Date) ? new Date(date) : new Date(date);
  if (isNaN(d)) return '';
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Kiểm tra dateStr có thuộc năm đang chọn (activeYears) không
 * ⚠️ Hiện tại đọc global `activeYears` (window) — sẽ chuyển sang store.js ở Prompt 3
 * @param {string} dateStr - Chuỗi ngày "YYYY-MM-DD"
 * @returns {boolean}
 */
export function inActiveYear(dateStr) {
  if (!dateStr) return false;
  // Đọc từ global tạm thời — Prompt 3 sẽ import từ store.js
  const _activeYears = window.activeYears;
  if (!_activeYears || _activeYears.size === 0) return true; // "Tất cả năm"
  const year = parseInt(dateStr.slice(0, 4));
  return _activeYears.has(year);
}

// ── Year-based filtering (ported from tienich.js) ───────────

/**
 * Kiểm tra công trình có thuộc năm đang chọn không.
 * Logic: 1) cats.congTrinhYears; 2) data fallback (name-based)
 */
export function ctInActiveYear(name) {
  const _activeYears = window.activeYears;
  if (!_activeYears || _activeYears.size === 0) return true;
  if (!name) return false;
  const cats = window.cats;
  const yr = cats && cats.congTrinhYears && cats.congTrinhYears[name];
  if (yr && _activeYears.has(yr)) return true;
  return entityInYear(name, 'ct');
}

/**
 * Tầng 2 — lọc mềm cho entity (CT, CN, TB).
 * Trả về true nếu entity có BẤT KỲ phát sinh nào trong năm đang chọn.
 */
export function entityInYear(name, type) {
  const _activeYears = window.activeYears;
  if (!_activeYears || _activeYears.size === 0) return true;
  if (!name) return false;
  const invoices   = window.invoices   || [];
  const ccData     = window.ccData     || [];
  const ungRecords = window.ungRecords || [];
  const tbData     = window.tbData     || [];
  if (type === 'ct') {
    return invoices.some(i  => !i.deletedAt  && inActiveYear(i.ngay)    && i.congtrinh === name)
        || ccData.some(w    => !w.deletedAt  && inActiveYear(w.fromDate) && w.ct        === name)
        || ungRecords.some(r => !r.deletedAt && inActiveYear(r.ngay)     && r.congtrinh === name);
  }
  if (type === 'cn') {
    return ccData.some(w => !w.deletedAt && inActiveYear(w.fromDate)
        && (w.workers || []).some(wk => wk.name === name));
  }
  if (type === 'tb') {
    return tbData.some(r => r.ten === name && (
      r.tinhtrang === 'Đang hoạt động'
      || entityInYear(r.ct, 'ct')
    ));
  }
  return true;
}

// ── Window bridges ──────────────────────────────────────────
window.inActiveYear    = inActiveYear;
window._ctInActiveYear = ctInActiveYear;
window._entityInYear   = entityInYear;
window.formatDate      = formatDate;

console.log('[date.util] ES Module loaded ✅');
