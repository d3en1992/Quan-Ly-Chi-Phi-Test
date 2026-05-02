// ══════════════════════════════════════════════════════════════
// src/utils/math.util.js — Định dạng & Parse số / tiền tệ
// Trích xuất từ: tienich.js (Prompt 1 — ES Modules Refactor)
// ══════════════════════════════════════════════════════════════

/**
 * Định dạng số nguyên theo locale Việt Nam (phân cách nghìn bằng dấu chấm)
 * @param {number|string} n - Số cần format
 * @returns {string} VD: "1.000.000" hoặc "" nếu null/undefined
 */
export function numFmt(n) {
  if (!n && n !== 0) return '';
  return parseInt(n, 10).toLocaleString('vi-VN');
}

/**
 * Định dạng số tiền có đơn vị "đ"
 * @param {number|string} n - Số tiền
 * @returns {string} VD: "1.000.000 đ" hoặc "0 đ"
 */
export function fmtM(n) {
  if (!n) return '0 đ';
  return parseInt(n).toLocaleString('vi-VN') + ' đ';
}

/**
 * Định dạng số tiền rút gọn (tỷ/tr/k)
 * @param {number} n - Số tiền
 * @returns {string} VD: "1.5 tỷ", "200 tr", "500k", "0"
 */
export function fmtS(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(3).replace(/\.?0+$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return n.toLocaleString('vi-VN');
}

/**
 * Định dạng tiền tệ Việt Nam (có đ) — alias rõ nghĩa hơn fmtM
 * @param {number|string} v - Giá trị tiền
 * @returns {string} VD: "1.000.000 đ" hoặc "0 đ"
 */
export function formatMoney(v) {
  const n = parseNumber(v);
  if (!n) return '0 đ';
  return parseInt(n).toLocaleString('vi-VN') + ' đ';
}

/**
 * Chuyển đổi an toàn bất kỳ giá trị → số
 * @param {*} v - Giá trị cần parse
 * @returns {number} Số hoặc 0 nếu không hợp lệ
 */
export function parseNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Parse chuỗi tiền tệ đa dạng → số nguyên
 * Xử lý: "1.000.000", "1,000,000", "1tr", "1.5tr", "2tỷ", "500k"
 * @param {string|number|null} raw - Giá trị thô
 * @returns {number} Số nguyên (đã làm tròn)
 */
export function parseMoney(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Math.round(raw);
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return 0;

  // Đơn vị tỷ/tr/k
  const unitMap = [
    [/^([\d,.]+)tỷ$/, 1e9],
    [/^([\d,.]+)ty$/, 1e9],
    [/^([\d,.]+)b$/, 1e9],
    [/^([\d,.]+)tr$/, 1e6],
    [/^([\d,.]+)m$/, 1e6],
    [/^([\d,.]+)k$/, 1e3],
  ];
  for (const [rx, mult] of unitMap) {
    const m = s.match(rx);
    if (m) {
      const num = parseFloat(m[1].replace(/[,.]/g, s.includes(',') && s.includes('.')
        ? (s.indexOf(',') < s.indexOf('.') ? (v => v === ',' ? '' : '.') : (v => v === '.' ? '' : '.'))
        : (m[1].includes(',') ? (v => v === ',' ? '.' : '') : (v => v === '.' ? '' : ''))
      ));
      return Math.round(num * mult);
    }
  }

  // Dạng số thuần: xóa tất cả dấu phân cách nghìn
  let clean = s;
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastDot > -1 && lastComma > -1) {
    if (lastDot > lastComma) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastDot > -1) {
    const afterDot = clean.slice(lastDot + 1);
    if (afterDot.length === 3 && /^\d{3}$/.test(afterDot)) {
      clean = clean.replace(/\./g, '');
    }
  } else if (lastComma > -1) {
    const afterComma = clean.slice(lastComma + 1);
    if (afterComma.length === 3 && /^\d{3}$/.test(afterComma)) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(',', '.');
    }
  }

  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * Tính tổng giá trị số của một field trong mảng object
 * @param {Array} arr - Mảng object
 * @param {string} key - Tên field cần tổng
 * @returns {number}
 */
export function sumBy(arr, key) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((s, item) => s + parseNumber(item[key]), 0);
}

/**
 * Nhóm mảng object theo giá trị của key
 * @param {Array} arr - Mảng object
 * @param {string} key - Tên field để nhóm
 * @returns {Object} { keyValue: [items...] }
 */
export function groupBy(arr, key) {
  if (!Array.isArray(arr)) return {};
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

/**
 * Sắp xếp mảng object theo key (immutable — trả mảng mới)
 * @param {Array} arr - Mảng object
 * @param {string} key - Tên field để sắp
 * @param {'asc'|'desc'} order - Thứ tự, mặc định 'asc'
 * @returns {Array}
 */
export function sortBy(arr, key, order = 'asc') {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return order === 'asc' ? 1 : -1;
    if (vb == null) return order === 'asc' ? -1 : 1;
    if (typeof va === 'number' && typeof vb === 'number') {
      return order === 'asc' ? va - vb : vb - va;
    }
    const sa = String(va), sb = String(vb);
    return order === 'asc' ? sa.localeCompare(sb, 'vi') : sb.localeCompare(sa, 'vi');
  });
}

/**
 * Test cases cho parseMoney — chạy trong Console để verify
 */
export function _testParseMoney() {
  const cases = [
    ['1000000', 1000000],
    ['1.000.000', 1000000],
    ['1,000,000', 1000000],
    ['1.000', 1000],
    ['1,000', 1000],
    ['1500000', 1500000],
    ['1.5tr', 1500000],
    ['1,5tr', 1500000],
    ['2tr', 2000000],
    ['500k', 500000],
    ['1.5tỷ', 1500000000],
    ['2tỷ', 2000000000],
    ['630000', 630000],
    ['0', 0],
    ['', 0],
    [null, 0],
    [1000000, 1000000],
  ];
  let pass = 0, fail = 0;
  cases.forEach(([input, expected]) => {
    const got = parseMoney(input);
    const ok = got === expected;
    if (!ok) console.error(`❌ parseMoney(${JSON.stringify(input)}) = ${got}, expected ${expected}`);
    else pass++;
    if (!ok) fail++;
  });
  console.log(`parseMoney tests: ${pass}/${cases.length} passed${fail ? ', ' + fail + ' FAILED' : ' ✅'}`);
}

// ── Window bridges ──────────────────────────────────────────
window.numFmt      = numFmt;
window.fmtM        = fmtM;
window.fmtS        = fmtS;
window.formatMoney = formatMoney;
window.parseNumber = parseNumber;
window.parseMoney  = parseMoney;
window.sumBy       = sumBy;
window.groupBy     = groupBy;
window.sortBy      = sortBy;

console.log('[math.util] ES Module loaded ✅');
