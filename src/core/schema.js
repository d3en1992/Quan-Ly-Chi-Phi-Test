// ══════════════════════════════════════════════════════════════
// src/core/schema.js — Schema Validator & Data Normalizer
// Prompt 2 — ES Modules Refactor
// Chuẩn hóa & kiểm tra dữ liệu đầu vào cho toàn bộ app
// Nguồn tham chiếu: PROJECT_ANALYTICS.md mục 7
// ══════════════════════════════════════════════════════════════

// ── Helpers nội bộ ──────────────────────────────────────────

/** Tạo UUID v4 */
function _uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Timestamp hiện tại (ms) */
function _now() { return Date.now(); }

/** Ép về số nguyên, default 0 */
function _int(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n);
}

/** Ép về số thực, default 0 */
function _float(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Ép về string, trim */
function _str(v) { return v == null ? '' : String(v).trim(); }

/** Kiểm tra chuỗi ngày hợp lệ YYYY-MM-DD */
function _isDateStr(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); }

/** Chuẩn hóa ngày: chấp nhận nhiều format → YYYY-MM-DD */
function _normalizeDate(v) {
  if (!v) return '';
  const s = _str(v);
  if (_isDateStr(s)) return s;
  // Thử DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // Thử parse Date
  const d = new Date(s);
  if (!isNaN(d)) {
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }
  return s; // trả nguyên nếu không parse được
}

// ══════════════════════════════════════════════════════════════
//  VALIDATORS — Mỗi hàm nhận raw data, trả { valid, data, errors }
// ══════════════════════════════════════════════════════════════

/**
 * Validate & normalize Invoice (inv_v3)
 * Required: id, ngay, congtrinh|projectId, loai, tien|thanhtien
 */
export function validateInvoice(raw) {
  const errors = [];
  const d = { ...raw };

  // ── Auto-fill ──
  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  // ── Normalize types ──
  d.ngay = _normalizeDate(d.ngay);
  d.congtrinh = _str(d.congtrinh);
  d.projectId = d.projectId || null;
  d.loai = _str(d.loai);
  d.nguoi = _str(d.nguoi);
  d.ncc = _str(d.ncc);
  d.nd = _str(d.nd);
  d.tien = _int(d.tien);
  d.thanhtien = _int(d.thanhtien) || d.tien;
  d.sl = d.sl != null ? _float(d.sl) : undefined;
  d.soHD = d.soHD != null ? _str(d.soHD) : undefined;
  d.source = d.source || 'manual';
  d.deviceId = d.deviceId || undefined;

  // items array giữ nguyên
  if (d.items && !Array.isArray(d.items)) d.items = [];
  // footerCkStr giữ nguyên nếu có
  if (d.footerCkStr != null) d.footerCkStr = _str(d.footerCkStr);

  // ── Validate required ──
  if (!d.ngay) errors.push('Thiếu ngày (ngay)');
  if (!d.congtrinh && !d.projectId) errors.push('Thiếu công trình (congtrinh hoặc projectId)');
  if (!d.loai) errors.push('Thiếu loại chi phí (loai)');

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Attendance (cc_v2)
 * Required: id, fromDate, ct|projectId, workers[]
 */
export function validateAttendance(raw) {
  const errors = [];
  const d = { ...raw };

  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  d.fromDate = _normalizeDate(d.fromDate);
  d.toDate = _normalizeDate(d.toDate);
  d.ct = _str(d.ct);
  d.projectId = d.projectId || null;
  d.ctPid = d.ctPid || undefined;
  d.deviceId = d.deviceId || undefined;

  // Normalize workers
  if (!Array.isArray(d.workers)) {
    d.workers = [];
    errors.push('Thiếu danh sách công nhân (workers)');
  } else {
    d.workers = d.workers.map(wk => ({
      name: _str(wk.name),
      luong: _int(wk.luong),
      d: Array.isArray(wk.d) ? wk.d.map(v => _float(v)) : [0,0,0,0,0,0,0],
      phucap: _int(wk.phucap || 0),
      hdmuale: _int(wk.hdmuale || 0),
      nd: _str(wk.nd),
      role: wk.role || undefined,
      tru: wk.tru != null ? _int(wk.tru) : undefined,
    }));
  }

  // Auto-calc toDate nếu thiếu
  if (d.fromDate && !d.toDate) {
    const [y,m,dd] = d.fromDate.split('-').map(Number);
    const sat = new Date(y, m-1, dd+6);
    d.toDate = sat.getFullYear() + '-' +
      String(sat.getMonth()+1).padStart(2,'0') + '-' +
      String(sat.getDate()).padStart(2,'0');
  }

  if (!d.fromDate) errors.push('Thiếu ngày bắt đầu (fromDate)');
  if (!d.ct && !d.projectId) errors.push('Thiếu công trình (ct hoặc projectId)');

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Equipment (tb_v1)
 * Required: id, ct|projectId, ten
 */
export function validateEquipment(raw) {
  const errors = [];
  const d = { ...raw };

  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  d.ct = _str(d.ct);
  d.projectId = d.projectId || null;
  d.ten = _str(d.ten);
  d.soluong = _int(d.soluong) || 1;
  d.tinhtrang = _str(d.tinhtrang) || 'Đang hoạt động';
  d.ghichu = _str(d.ghichu);
  d.ngay = _normalizeDate(d.ngay);
  d.nguoi = d.nguoi != null ? _str(d.nguoi) : undefined;
  d.deviceId = d.deviceId || undefined;

  if (!d.ten) errors.push('Thiếu tên thiết bị (ten)');

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Advance / Tiền ứng (ung_v1)
 * Required: id, ngay, loai, tp, congtrinh|projectId, tien
 */
export function validateAdvance(raw) {
  const errors = [];
  const d = { ...raw };

  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  d.ngay = _normalizeDate(d.ngay);
  d.loai = _str(d.loai); // thauphu | nhacungcap | congnhan
  d.tp = _str(d.tp);
  d.congtrinh = _str(d.congtrinh);
  d.projectId = d.projectId || null;
  d.tien = _int(d.tien);
  d.nd = _str(d.nd);
  d.deviceId = d.deviceId || undefined;

  // Validate loai
  const validLoai = ['thauphu', 'nhacungcap', 'congnhan'];
  if (!d.loai) errors.push('Thiếu loại ứng (loai)');
  else if (!validLoai.includes(d.loai)) errors.push(`Loại ứng không hợp lệ: "${d.loai}". Phải là: ${validLoai.join(', ')}`);
  if (!d.tp) errors.push('Thiếu đối tượng nhận (tp)');
  if (!d.tien) errors.push('Thiếu số tiền (tien)');

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Revenue / Thu tiền (thu_v1)
 * Required: id, ngay, congtrinh|projectId, tien
 */
export function validateRevenue(raw) {
  const errors = [];
  const d = { ...raw };

  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  d.ngay = _normalizeDate(d.ngay);
  d.congtrinh = _str(d.congtrinh);
  d.projectId = d.projectId || null;
  d.tien = _int(d.tien);
  d.nguoi = _str(d.nguoi);
  d.nd = _str(d.nd);
  d.deviceId = d.deviceId || undefined;

  if (!d.ngay) errors.push('Thiếu ngày (ngay)');
  if (!d.congtrinh && !d.projectId) errors.push('Thiếu công trình');
  if (!d.tien) errors.push('Thiếu số tiền (tien)');

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Project (projects_v1)
 * Required: id, name
 */
export function validateProject(raw) {
  const errors = [];
  const d = { ...raw };

  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  d.name = _str(d.name);
  d.type = d.type || 'congtrinh'; // congtrinh | company | other
  d.status = d.status || 'active'; // active | closed
  d.startDate = d.startDate ? _normalizeDate(d.startDate) : undefined;
  d.endDate = d.endDate ? _normalizeDate(d.endDate) : undefined;
  d.closedDate = d.closedDate ? _normalizeDate(d.closedDate) : undefined;
  d.note = d.note != null ? _str(d.note) : undefined;
  d.createdYear = d.createdYear || new Date().getFullYear();

  if (!d.name) errors.push('Thiếu tên công trình (name)');

  // Validate type
  const validTypes = ['congtrinh', 'company', 'other'];
  if (!validTypes.includes(d.type)) {
    errors.push(`Type không hợp lệ: "${d.type}". Phải là: ${validTypes.join(', ')}`);
  }

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Contract (hopdong_v1)
 * Lưu ý: hopdong_v1 là Object map { projectKey: contractData }
 * Hàm này validate từng contract entry
 */
export function validateContract(raw) {
  const errors = [];
  const d = { ...raw };

  d.giaTri = _int(d.giaTri);
  d.giaTriphu = d.giaTriphu != null ? _int(d.giaTriphu) : undefined;
  d.phatSinh = d.phatSinh != null ? _int(d.phatSinh) : undefined;
  d.nguoi = d.nguoi != null ? _str(d.nguoi) : undefined;
  d.ngay = d.ngay ? _normalizeDate(d.ngay) : undefined;
  d.projectId = d.projectId || undefined;
  d.sl = d.sl != null ? _float(d.sl) : undefined;
  d.donGia = d.donGia != null ? _int(d.donGia) : undefined;
  d.ghichu = d.ghichu != null ? _str(d.ghichu) : undefined;
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  if (d.items && !Array.isArray(d.items)) d.items = [];

  return { valid: errors.length === 0, data: d, errors };
}

/**
 * Validate & normalize Subcontract (thauphu_v1)
 * Required: id, congtrinh|projectId, thauphu
 */
export function validateSubcontract(raw) {
  const errors = [];
  const d = { ...raw };

  d.id = _str(d.id) || _uuid();
  d.createdAt = d.createdAt || _now();
  d.updatedAt = d.updatedAt || _now();
  d.deletedAt = d.deletedAt || null;

  d.ngay = _normalizeDate(d.ngay);
  d.congtrinh = _str(d.congtrinh);
  d.projectId = d.projectId || null;
  d.thauphu = _str(d.thauphu);
  d.giaTri = d.giaTri != null ? _int(d.giaTri) : undefined;
  d.phatSinh = d.phatSinh != null ? _int(d.phatSinh) : undefined;
  d.nd = d.nd != null ? _str(d.nd) : undefined;
  d.sl = d.sl != null ? _float(d.sl) : undefined;
  d.donGia = d.donGia != null ? _int(d.donGia) : undefined;
  d.deviceId = d.deviceId || undefined;

  if (d.items && !Array.isArray(d.items)) d.items = [];

  if (!d.thauphu) errors.push('Thiếu tên thầu phụ (thauphu)');
  if (!d.congtrinh && !d.projectId) errors.push('Thiếu công trình');

  return { valid: errors.length === 0, data: d, errors };
}

// ══════════════════════════════════════════════════════════════
//  ENTRY POINT — normalize(type, rawData)
// ══════════════════════════════════════════════════════════════

/** Map tên dataset → validator */
const VALIDATOR_MAP = {
  'inv_v3':       validateInvoice,
  'invoice':      validateInvoice,
  'cc_v2':        validateAttendance,
  'attendance':   validateAttendance,
  'tb_v1':        validateEquipment,
  'equipment':    validateEquipment,
  'ung_v1':       validateAdvance,
  'advance':      validateAdvance,
  'thu_v1':       validateRevenue,
  'revenue':      validateRevenue,
  'projects_v1':  validateProject,
  'project':      validateProject,
  'hopdong_v1':   validateContract,
  'contract':     validateContract,
  'thauphu_v1':   validateSubcontract,
  'subcontract':  validateSubcontract,
};

/**
 * Entry point chung — nhận tên loại dữ liệu + data thô
 * @param {string} type - Tên dataset (VD: 'inv_v3', 'invoice', 'cc_v2'...)
 * @param {Object} rawData - Dữ liệu thô cần validate
 * @returns {{ valid: boolean, data: Object, errors: string[] }}
 */
export function normalize(type, rawData) {
  const validator = VALIDATOR_MAP[type];
  if (!validator) {
    return { valid: false, data: rawData, errors: [`Không tìm thấy validator cho type: "${type}"`] };
  }
  return validator(rawData);
}

/**
 * Validate một mảng records cùng loại — trả mảng đã clean + log lỗi
 * @param {string} type - Tên dataset
 * @param {Array} records - Mảng dữ liệu thô
 * @returns {{ cleaned: Array, errorCount: number, errorLog: Array }}
 */
export function normalizeArray(type, records) {
  if (!Array.isArray(records)) return { cleaned: [], errorCount: 0, errorLog: [] };
  const cleaned = [];
  const errorLog = [];
  let errorCount = 0;

  records.forEach((rec, idx) => {
    const result = normalize(type, rec);
    if (result.valid) {
      cleaned.push(result.data);
    } else {
      errorCount++;
      errorLog.push({ index: idx, id: rec.id, errors: result.errors });
      // Vẫn push data đã clean (best-effort) nhưng đánh dấu
      cleaned.push(result.data);
    }
  });

  return { cleaned, errorCount, errorLog };
}

// ── Export helpers cho test ──
export { _uuid, _now, _int, _float, _str, _normalizeDate, _isDateStr };

// ══════════════════════════════════════════════════════════════
// 🔌 BRIDGE TẠM — giữ tương thích với code cũ
//    Sẽ gỡ bỏ ở Prompt 10
// ══════════════════════════════════════════════════════════════
window._schema = {
  normalize, normalizeArray,
  validateInvoice, validateAttendance, validateEquipment,
  validateAdvance, validateRevenue, validateProject,
  validateContract, validateSubcontract,
};
