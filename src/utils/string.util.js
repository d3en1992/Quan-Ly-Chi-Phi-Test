// ══════════════════════════════════════════════════════════════
// src/utils/string.util.js — Xử lý chuỗi & text
// Trích xuất từ: tienich.js (Prompt 1 — ES Modules Refactor)
// ══════════════════════════════════════════════════════════════

/**
 * Tính độ tương đồng giữa 2 chuỗi (Dice coefficient dùng bigram)
 * Dùng để fuzzy-match tên công trình, tên người...
 * @param {string} a
 * @param {string} b
 * @returns {number} 0.0 → 1.0 (1 = giống hoàn toàn)
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
 * Escape HTML entities — chống XSS khi nhúng text vào innerHTML
 * @param {string} s - Chuỗi cần escape
 * @returns {string} Chuỗi đã escape (& < > ")
 */
export function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tạo UUID v4 ngẫu nhiên
 * @returns {string} VD: "550e8400-e29b-41d4-a716-446655440000"
 */
export function uuid() {
  return crypto.randomUUID();
}

/**
 * Chuẩn hóa key: bỏ dấu tiếng Việt, lowercase, thay khoảng trắng bằng _
 * Dùng cho tạo key an toàn từ tên hiển thị
 * @param {string} s - Chuỗi gốc
 * @returns {string} Key đã chuẩn hóa
 */
export function normalizeKey(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Chuẩn hóa tên: trim, gộp khoảng trắng, capitalize
 * @param {string} s
 * @returns {string}
 */
export function normalizeName(s) {
  if (!s) return '';
  return String(s)
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize chuỗi tiếng Việt để so sánh / fuzzy match
 * Bỏ dấu, lowercase, collapse whitespace
 */
export function normViStr(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Window bridges ──────────────────────────────────────────
window.strSimilarity = strSimilarity;
window.escapeHtml    = escapeHtml;
window.x             = escapeHtml; // legacy alias
window.uuid          = uuid;
window.normalizeKey  = normalizeKey;
window.normalizeName = normalizeName;
window._normViStr    = normViStr;

console.log('[string.util] ES Module loaded ✅');
