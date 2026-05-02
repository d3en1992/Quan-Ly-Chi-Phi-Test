// ══════════════════════════════════════════════════════════════
// src/services/excel.svc.js — Excel Import/Export Service
// Prompt 18 — Full port from nhapxuat.js (2034 lines → ESM)
// All cross-module calls via window.* at call-time
// ══════════════════════════════════════════════════════════════

'use strict';

// ── Convenience accessors (all resolved at call-time) ────────
const _w = k => window[k];
const _cats    = () => window.cats    || {};
const _projs   = () => (typeof window.projects !== 'undefined') ? window.projects : [];
const _DEVICE  = () => window.DEVICE_ID || '';

// ══════════════════════════════════════════════════════════════
// [1] SHARED HELPERS
// ══════════════════════════════════════════════════════════════

function _normStr(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 /]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 25569 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

function _pNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const dots   = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g)  || []).length;
  if (dots   > 1) s = s.replace(/\./g, '');
  if (commas > 1) s = s.replace(/,/g, '');
  s = s.replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function _str(v) { return v ? String(v).trim() : ''; }
function _sheetRows(ws) { return window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); }

function _hasDiacritics(s) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(String(s || ''));
}

function _deduplicateCatNames(names) {
  const map = new Map();
  (names || []).forEach(name => {
    if (!name || !String(name).trim()) return;
    const t = String(name).trim(), n = _normStr(t);
    if (!n) return;
    const ex = map.get(n);
    if (!ex || (!_hasDiacritics(ex) && _hasDiacritics(t))) map.set(n, t);
  });
  return [...map.values()];
}

function _buildCanonMap(names) {
  const map = new Map();
  (names || []).forEach(name => {
    if (!name || !String(name).trim()) return;
    const t = String(name).trim(), n = _normStr(t);
    if (!n) return;
    const ex = map.get(n);
    if (!ex || (!_hasDiacritics(ex) && _hasDiacritics(t))) map.set(n, t);
  });
  return map;
}

function _dayOfWeek(dateStr) {
  if (!dateStr) return -1;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return -1;
  return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
}

function _isEmptyRow(row) {
  return !row || row.every(cell =>
    cell === null || cell === undefined || String(cell).trim() === ''
  );
}

function _formatCatName(type, name) {
  if (!name) return name;
  const t = String(name).trim();
  if (['ncc', 'nguoi', 'tp'].includes(type)) return t.toUpperCase();
  if (['loai', 'tb'].includes(type))
    return t.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  return t;
}

function _markDuplicateInBatch(records, keyFn) {
  const seen = new Set(), kept = [], duplicates = [];
  (records || []).forEach(r => {
    const k = keyFn(r);
    if (seen.has(k)) duplicates.push(r);
    else { seen.add(k); kept.push(r); }
  });
  return { kept, duplicates };
}

// ══════════════════════════════════════════════════════════════
// [2] CATALOG LOOKUP
// ══════════════════════════════════════════════════════════════

function _makeCatLookup() {
  const cats = _cats();
  const _set = arr => new Set((arr || []).filter(Boolean).map(v => _normStr(String(v))));
  const projMap = new Map();
  _projs().filter(p => !p.deletedAt && p.name).forEach(p => projMap.set(_normStr(p.name), p));
  const allDisplayNames = [
    ..._projs().filter(p => !p.deletedAt).map(p => p.name),
    ...(cats.loaiChiPhi || []), ...(cats.nhaCungCap || []), ...(cats.nguoiTH || []),
    ...(cats.thauPhu || []), ...(cats.congNhan || []), ...(cats.tbTen || []),
  ];
  const canonMap = _buildCanonMap(allDisplayNames);
  const canon = s => s ? (canonMap.get(_normStr(String(s))) || String(s).trim()) : s;
  return {
    loai: _set(cats.loaiChiPhi), ncc: _set(cats.nhaCungCap),
    nguoi: _set(cats.nguoiTH), tp: _set(cats.thauPhu),
    cn: _set(cats.congNhan), tb: _set(cats.tbTen),
    proj: projMap, canonMap, canon,
  };
}

function _makeCatLookupWithExtra(catsParsed, extraCTs) {
  const cats = _cats();
  const _set = arr => new Set((arr || []).filter(Boolean).map(v => _normStr(String(v))));
  const inc = catsParsed || {};
  const merged = {
    loai:  [...(cats.loaiChiPhi || []), ...(inc.loai  || [])],
    ncc:   [...(cats.nhaCungCap || []), ...(inc.ncc   || [])],
    nguoi: [...(cats.nguoiTH    || []), ...(inc.nguoi || [])],
    tp:    [...(cats.thauPhu    || []), ...(inc.tp    || [])],
    cn:    [...(cats.congNhan   || []), ...(inc.cn    || [])],
    tb:    [...(cats.tbTen      || []), ...(inc.tb    || [])],
  };
  const projMap = new Map();
  _projs().filter(p => !p.deletedAt && p.name).forEach(p => projMap.set(_normStr(p.name), p));
  [...(inc.ct || []), ...(extraCTs || [])].forEach(name => {
    if (!name) return;
    const t = String(name).trim(), n = _normStr(t);
    if (t && !projMap.has(n)) projMap.set(n, { id: '_prov_' + n, name: t, _provisional: true });
  });
  const allNames = [
    ..._projs().filter(p => !p.deletedAt).map(p => p.name),
    ...merged.loai, ...merged.ncc, ...merged.nguoi, ...merged.tp, ...merged.cn, ...merged.tb,
  ];
  const canonMap = _buildCanonMap(allNames);
  const canon = s => s ? (canonMap.get(_normStr(String(s))) || String(s).trim()) : s;
  return {
    loai: _set(merged.loai), ncc: _set(merged.ncc), nguoi: _set(merged.nguoi),
    tp: _set(merged.tp), cn: _set(merged.cn), tb: _set(merged.tb),
    proj: projMap, canonMap, canon,
  };
}

function _resolveProvisionalProjectIds(session, lookup) {
  const _fix = (r, ctField) => {
    if (!r.projectId || !String(r.projectId).startsWith('_prov_')) return;
    const name = r[ctField] || r.congtrinh || r.ct || '';
    const real  = name ? lookup.proj.get(_normStr(name)) : null;
    if (real && !real._provisional) { r.projectId = real.id; if ('ctPid' in r) r.ctPid = real.id; }
  };
  ['invQ','invD','ung','tb','thu','tp'].forEach(key => {
    if (session.sheets[key]) session.sheets[key].records.forEach(r => _fix(r, 'congtrinh'));
  });
  if (session.sheets.cc) session.sheets.cc.records.forEach(r => _fix(r, 'ct'));
}

function _mkErr(sheet, row, field, value, message) {
  return { sheet, row, field, value: String(value ?? ''), message };
}
function _fmtErr(e) {
  return `[Dòng ${e.row}, ${e.field}: "${e.value}"] ${e.message}`;
}

// ══════════════════════════════════════════════════════════════
// [3] SHEET PARSERS
// ══════════════════════════════════════════════════════════════

// Sheet 1: HoaDonNhanh
// Col: NGÀY(0) · CÔNG TRÌNH(1) · LOẠI CHI PHÍ(2) · NỘI DUNG(3)
//      SỐ TIỀN(4) · NGƯỜI THỰC HIỆN(5) · NHÀ CUNG CẤP(6) · SỐ HĐ(7) · ID(8)
function parseSheet1(rows, lookup) {
  const records = [], errors = [], now = Date.now(), dev = _DEVICE();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay       = _parseDate(row[0]);
    const ctRaw      = _str(row[1]);
    const loaiRaw    = _str(row[2]);
    const nd         = _str(row[3]);
    const tienRaw    = row[4];
    const nguoiRaw   = _str(row[5]);
    const nccRaw     = _str(row[6]);
    const soHD       = _str(row[7]);
    const existingId = _str(row[8]);
    const rowErrs = [];
    if (!ngay) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'ngay', row[0], 'Ngày không hợp lệ (cần YYYY-MM-DD)'));
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'congtrinh', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'congtrinh', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    if (!loaiRaw) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'loai', '', 'Loại chi phí không được để trống'));
    else if (!lookup.loai.has(_normStr(loaiRaw))) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'loai', loaiRaw, 'Loại chi phí không tồn tại trong danh mục'));
    const tien = _pNum(tienRaw);
    if (tien === null || tien <= 0) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'tien', tienRaw, 'Số tiền phải là số dương'));
    if (nguoiRaw && !lookup.nguoi.has(_normStr(nguoiRaw))) rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'nguoi', nguoiRaw, 'Người thực hiện không tồn tại trong danh mục'));
    if (nccRaw   && !lookup.ncc.has(_normStr(nccRaw)))     rowErrs.push(_mkErr('HoaDonNhanh', i+1, 'ncc',   nccRaw,   'Nhà cung cấp không tồn tại trong danh mục'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    records.push({
      id: existingId || crypto.randomUUID(), ngay,
      congtrinh: proj.name, projectId: proj.id,
      loai: lookup.canon(loaiRaw), nd, tien: Math.round(tien),
      nguoi: nguoiRaw ? lookup.canon(nguoiRaw) : '',
      ncc:   nccRaw   ? lookup.canon(nccRaw)   : '',
      soHD, source: 'excel_invQ',
      createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev,
    });
  }
  return { records, errors };
}

// Sheet 2: HoaDonChiTiet — grouped by (ngay, ct, loai, ncc)
// Col: NGÀY(0) · CÔNG TRÌNH(1) · LOẠI(2) · NỘI DUNG/TÊN HÀNG(3) · ĐVT(4)
//      SỐ LƯỢNG(5) · ĐƠN GIÁ(6) · THÀNH TIỀN(7) · NGƯỜI TH(8) · NHÀ CC(9)
function parseSheet2(rows, lookup) {
  const groups = new Map(), errors = [], now = Date.now(), dev = _DEVICE();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay        = _parseDate(row[0]);
    const ctRaw       = _str(row[1]);
    const loaiRaw     = _str(row[2]);
    const nd          = _str(row[3]);
    const dvt         = _str(row[4]);
    const sl          = _pNum(row[5]) ?? 1;
    const donGia      = _pNum(row[6]) ?? 0;
    const thanhTien   = _pNum(row[7]);
    const nguoiRaw    = _str(row[8]);
    const nccRaw      = _str(row[9]);
    const computed    = thanhTien !== null ? Math.round(thanhTien) : Math.round(sl * donGia);
    const rowErrs = [];
    if (!ngay) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'ngay', row[0], 'Ngày không hợp lệ'));
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'congtrinh', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'congtrinh', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    if (!loaiRaw) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'loai', '', 'Loại chi phí không được để trống'));
    else if (!lookup.loai.has(_normStr(loaiRaw))) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'loai', loaiRaw, 'Loại chi phí không tồn tại trong danh mục'));
    if (nguoiRaw && !lookup.nguoi.has(_normStr(nguoiRaw))) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'nguoi', nguoiRaw, 'Người thực hiện không tồn tại trong danh mục'));
    if (nccRaw   && !lookup.ncc.has(_normStr(nccRaw)))     rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'ncc',   nccRaw,   'Nhà cung cấp không tồn tại trong danh mục'));
    if (computed <= 0) rowErrs.push(_mkErr('HoaDonChiTiet', i+1, 'thanhtien', row[7], 'Thành tiền phải là số dương'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    const groupKey = `${ngay}|${_normStr(ctRaw)}|${_normStr(loaiRaw)}|${_normStr(nccRaw)}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        header: {
          id: crypto.randomUUID(), ngay,
          congtrinh: proj.name, projectId: proj.id,
          loai: lookup.canon(loaiRaw),
          nguoi: nguoiRaw ? lookup.canon(nguoiRaw) : '',
          ncc:   nccRaw   ? lookup.canon(nccRaw)   : '',
          source: 'detail',
          createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev,
        },
        items: [],
      });
    }
    groups.get(groupKey).items.push({ ten: nd, dv: dvt, sl, dongia: Math.round(donGia), thanhtien: computed });
  }
  const records = [];
  const _buildND = window.buildNDFromItems;
  groups.forEach(({ header, items }) => {
    header.items     = items;
    header.thanhtien = items.reduce((s, it) => s + it.thanhtien, 0);
    header.tien      = header.thanhtien;
    header.nd        = _buildND ? _buildND(items) : items.map(it => it.ten).filter(Boolean).join(', ');
    records.push(header);
  });
  return { records, errors };
}

// Sheet 3: ChamCong — grouped by (fromDate, ct)
// Col: NGÀY ĐẦU TUẦN(0)·CÔNG TRÌNH(1)·TÊN CN(2)·VAI TRÒ(3)·LƯƠNG(4)·PHỤ CẤP(5)·HD MUA LẺ(6)·CN-T7(7-13)·GHI CHÚ(14)
function _addDays(iso, days) {
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function parseSheet3(rows, lookup) {
  const groups = new Map(), errors = [];
  const cnSet = new Set(lookup.cn);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const fromDate = _parseDate(row[0]);
    const ctRaw    = _str(row[1]);
    const nameRaw  = _str(row[2]);
    const role     = _str(row[3]);
    const luong    = _pNum(row[4])  ?? 0;
    const phucap   = _pNum(row[5])  ?? 0;
    const hdmuale  = _pNum(row[6])  ?? 0;
    const d        = [7,8,9,10,11,12,13].map(ci => _pNum(row[ci]) ?? 0);
    const nd       = _str(row[14]);
    const rowErrs = [];
    if (!fromDate) rowErrs.push(_mkErr('ChamCong', i+1, 'fromDate', row[0], 'Ngày đầu tuần không hợp lệ'));
    else if (_dayOfWeek(fromDate) !== 0) rowErrs.push(_mkErr('ChamCong', i+1, 'fromDate', fromDate, 'Ngày đầu tuần phải là Chủ nhật'));
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('ChamCong', i+1, 'ct', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('ChamCong', i+1, 'ct', ctRaw, 'Công trình không tồn tại trong danh mục')); }
    if (!nameRaw) rowErrs.push(_mkErr('ChamCong', i+1, 'name', '', 'Tên công nhân không được để trống'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    const canonName = lookup.canon(nameRaw);
    if (!cnSet.has(_normStr(canonName))) cnSet.add(_normStr(canonName));
    const groupKey = `${fromDate}|${_normStr(ctRaw)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { fromDate, ct: proj.name, projectId: proj.id, ctPid: proj.id, workers: [] });
    const grp = groups.get(groupKey);
    const existingW = grp.workers.find(w => _normStr(w.name) === _normStr(canonName));
    if (existingW) { if (existingW.role && role && existingW.role !== role) existingW.role = null; }
    else grp.workers.push({ name: canonName, role, luong: Math.round(luong), phucap: Math.round(phucap), hdmuale: Math.round(hdmuale), d, nd });
  }
  const newCNs = [];
  cnSet.forEach(norm => {
    if (!lookup.cn.has(norm)) {
      groups.forEach(g => g.workers.forEach(w => { if (_normStr(w.name) === norm && !newCNs.includes(w.name)) newCNs.push(w.name); }));
    }
  });
  const now = Date.now(), dev = _DEVICE();
  const records = [...groups.values()].map(g => ({
    id: crypto.randomUUID(), fromDate: g.fromDate, toDate: _addDays(g.fromDate, 6),
    ct: g.ct, projectId: g.projectId, ctPid: g.projectId, workers: g.workers,
    createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev,
  }));
  return { records, errors, newCNs };
}

// Sheet 4: TienUng
// Col: NGÀY(0)·ĐỐI TƯỢNG(1)·TÊN(2)·CÔNG TRÌNH(3)·SỐ TIỀN(4)·NỘI DUNG(5)·ID(6)
function parseSheet4(rows, lookup) {
  const records = [], errors = [], now = Date.now(), dev = _DEVICE();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay       = _parseDate(row[0]);
    const doiTuong   = _str(row[1]);
    const tenRaw     = _str(row[2]);
    const ctRaw      = _str(row[3]);
    const tienRaw    = row[4];
    const nd         = _str(row[5]);
    const existingId = _str(row[6]);
    const rowErrs = [];
    if (!ngay) rowErrs.push(_mkErr('TienUng', i+1, 'ngay', row[0], 'Ngày không hợp lệ'));
    const dtNorm = _normStr(doiTuong);
    let loai = 'thauphu';
    if (dtNorm.includes('nha cung cap') || dtNorm.includes('nhacungcap')) loai = 'nhacungcap';
    else if (doiTuong && !dtNorm.includes('thau phu') && !dtNorm.includes('thauphu'))
      rowErrs.push(_mkErr('TienUng', i+1, 'loai', doiTuong, 'Đối tượng phải là "Thầu phụ" hoặc "Nhà cung cấp"'));
    if (!tenRaw) rowErrs.push(_mkErr('TienUng', i+1, 'tp', '', 'Tên đối tượng không được để trống'));
    else {
      const catSet = loai === 'nhacungcap' ? lookup.ncc : lookup.tp;
      const label  = loai === 'nhacungcap' ? 'Nhà cung cấp' : 'Thầu phụ';
      if (!catSet.has(_normStr(tenRaw))) rowErrs.push(_mkErr('TienUng', i+1, 'tp', tenRaw, `${label} không tồn tại trong danh mục`));
    }
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('TienUng', i+1, 'congtrinh', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('TienUng', i+1, 'congtrinh', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    const tien = _pNum(tienRaw);
    if (tien === null || tien <= 0) rowErrs.push(_mkErr('TienUng', i+1, 'tien', tienRaw, 'Số tiền phải là số dương'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    records.push({ id: existingId || crypto.randomUUID(), ngay, loai, tp: lookup.canon(tenRaw), congtrinh: proj.name, projectId: proj.id, tien: Math.round(tien), nd, createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev });
  }
  return { records, errors };
}

// Sheet 5: ThietBi
// Col: NGÀY(0)·CÔNG TRÌNH(1)·TÊN THIẾT BỊ(2)·SỐ LƯỢNG(3)·TÌNH TRẠNG(4)·GHI CHÚ(5)·ID(6)
function parseSheet5(rows, lookup) {
  const records = [], errors = [], now = Date.now(), dev = _DEVICE();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay       = _parseDate(row[0]);
    const ctRaw      = _str(row[1]);
    const tenRaw     = _str(row[2]);
    const tinhtrang  = _str(row[4]);
    const ghichu     = _str(row[5]);
    const existingId = _str(row[6]);
    const rowErrs = [];
    if (!ngay) rowErrs.push(_mkErr('ThietBi', i+1, 'ngay', row[0], 'Ngày không hợp lệ'));
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('ThietBi', i+1, 'ct', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('ThietBi', i+1, 'ct', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    if (!tenRaw) rowErrs.push(_mkErr('ThietBi', i+1, 'ten', '', 'Tên thiết bị không được để trống'));
    else if (!lookup.tb.has(_normStr(tenRaw))) rowErrs.push(_mkErr('ThietBi', i+1, 'ten', tenRaw, 'Thiết bị không tồn tại trong danh mục'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    records.push({ id: existingId || crypto.randomUUID(), ngay, ct: proj.name, projectId: proj.id, ten: lookup.canon(tenRaw), soluong: _pNum(row[3]) ?? 1, tinhtrang, ghichu, createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev });
  }
  return { records, errors };
}

// Sheet 6: DanhMuc
// Col: LOẠI DANH MỤC(0)·TÊN(1)·EXTRA(2)
const _DANHMUC_GROUP_MAP = {
  'cong trinh': 'ct', 'loai chi phi': 'loai', 'nha cung cap': 'ncc',
  'nguoi thuc hien': 'nguoi', 'thau phu': 'tp', 'thau phu / tp': 'tp', 'thau phu tp': 'tp',
  'cong nhan': 'cn', 'may thiet bi thi cong': 'tb', 'thiet bi thi cong': 'tb',
  'thiet bi': 'tb', 'may thiet bi': 'tb',
};
function parseSheet6(rows) {
  const result = { ct: [], loai: [], ncc: [], nguoi: [], tp: [], cn: [], tb: [], cnRoles: {} };
  const errors = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const groupRaw = _str(row[0]), nameRaw = _str(row[1]), extra = _str(row[2]);
    if (!groupRaw && !nameRaw) continue;
    if (!nameRaw) continue;
    const groupNorm = _normStr(groupRaw);
    let field = null;
    for (const [key, val] of Object.entries(_DANHMUC_GROUP_MAP)) {
      if (groupNorm === key || groupNorm.includes(key)) { field = val; break; }
    }
    if (!field) { errors.push(_mkErr('DanhMuc', i+1, 'loai', groupRaw, 'Loại danh mục không nhận dạng được')); continue; }
    const formattedName = _formatCatName(field, nameRaw);
    result[field].push(formattedName);
    if (field === 'cn' && extra) result.cnRoles[formattedName] = extra;
  }
  return { parsed: result, errors };
}

// Sheet 7: HopDongChinh
// Col: NGÀY(0)·CÔNG TRÌNH(1)·NGƯỜI TH(2)·GIÁ TRỊ HĐ CHÍNH(3)·GIÁ TRỊ HĐ PHỤ(4)·PHÁT SINH(5)·GHI CHÚ(6)
function parseSheet7(rows, lookup) {
  const records = [], errors = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay      = _parseDate(row[0]);
    const ctRaw     = _str(row[1]);
    const nguoiRaw  = _str(row[2]);
    const giaTri    = _pNum(row[3]) ?? 0;
    const giaTriphu = _pNum(row[4]) ?? 0;
    const phatSinh  = _pNum(row[5]) ?? 0;
    const ghichu    = _str(row[6]);
    const rowErrs = [];
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('HopDongChinh', i+1, 'congtrinh', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('HopDongChinh', i+1, 'congtrinh', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    if (nguoiRaw && !lookup.nguoi.has(_normStr(nguoiRaw))) rowErrs.push(_mkErr('HopDongChinh', i+1, 'nguoi', nguoiRaw, 'Người thực hiện không tồn tại trong danh mục'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    const _today = (typeof window.today === 'function') ? window.today() : new Date().toISOString().slice(0,10);
    records.push({ ct: proj.name, projectId: proj.id, ngay: ngay || _today, nguoi: nguoiRaw ? lookup.canon(nguoiRaw) : '', giaTri: Math.round(giaTri), giaTriphu: Math.round(giaTriphu), phatSinh: Math.round(phatSinh), ghichu });
  }
  return { records, errors };
}

// Sheet 8: ThuTien
// Col: NGÀY(0)·NGƯỜI TH(1)·CÔNG TRÌNH(2)·SỐ TIỀN(3)·NỘI DUNG(4)·ID(5)
function parseSheet8(rows, lookup) {
  const records = [], errors = [], now = Date.now(), dev = _DEVICE();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay       = _parseDate(row[0]);
    const nguoiRaw   = _str(row[1]);
    const ctRaw      = _str(row[2]);
    const tienRaw    = row[3];
    const nd         = _str(row[4]);
    const existingId = _str(row[5]);
    const rowErrs = [];
    if (!ngay) rowErrs.push(_mkErr('ThuTien', i+1, 'ngay', row[0], 'Ngày không hợp lệ'));
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('ThuTien', i+1, 'congtrinh', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('ThuTien', i+1, 'congtrinh', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    if (nguoiRaw && !lookup.nguoi.has(_normStr(nguoiRaw))) rowErrs.push(_mkErr('ThuTien', i+1, 'nguoi', nguoiRaw, 'Người thực hiện không tồn tại trong danh mục'));
    const tien = _pNum(tienRaw);
    if (tien === null || tien <= 0) rowErrs.push(_mkErr('ThuTien', i+1, 'tien', tienRaw, 'Số tiền phải là số dương'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    records.push({ id: existingId || crypto.randomUUID(), ngay, nguoi: nguoiRaw ? lookup.canon(nguoiRaw) : '', congtrinh: proj.name, projectId: proj.id, tien: Math.round(tien), nd, createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev });
  }
  return { records, errors };
}

// Sheet 9: HopDongThauPhu
// Col: NGÀY(0)·CÔNG TRÌNH(1)·TÊN THẦU PHỤ(2)·GIÁ TRỊ HĐ(3)·PHÁT SINH(4)·NỘI DUNG(5)·ID(6)
function parseSheet9(rows, lookup) {
  const records = [], errors = [], now = Date.now(), dev = _DEVICE();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (_isEmptyRow(row)) continue;
    const ngay       = _parseDate(row[0]);
    const ctRaw      = _str(row[1]);
    const tpRaw      = _str(row[2]);
    const giaTri     = _pNum(row[3]) ?? 0;
    const phatSinh   = _pNum(row[4]) ?? 0;
    const nd         = _str(row[5]);
    const existingId = _str(row[6]);
    const rowErrs = [];
    if (!ngay) rowErrs.push(_mkErr('HopDongThauPhu', i+1, 'ngay', row[0], 'Ngày không hợp lệ'));
    let proj = null;
    if (!ctRaw) rowErrs.push(_mkErr('HopDongThauPhu', i+1, 'congtrinh', '', 'Công trình không được để trống'));
    else { proj = lookup.proj.get(_normStr(ctRaw)); if (!proj) rowErrs.push(_mkErr('HopDongThauPhu', i+1, 'congtrinh', ctRaw, 'Không tồn tại trong danh mục công trình')); }
    if (!tpRaw) rowErrs.push(_mkErr('HopDongThauPhu', i+1, 'thauphu', '', 'Tên thầu phụ không được để trống'));
    else if (!lookup.tp.has(_normStr(tpRaw))) rowErrs.push(_mkErr('HopDongThauPhu', i+1, 'thauphu', tpRaw, 'Thầu phụ không tồn tại trong danh mục'));
    if (rowErrs.length) { errors.push(...rowErrs); continue; }
    records.push({ id: existingId || crypto.randomUUID(), ngay, congtrinh: proj.name, projectId: proj.id, thauphu: lookup.canon(tpRaw), giaTri: Math.round(giaTri), phatSinh: Math.round(phatSinh), nd, createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev });
  }
  return { records, errors };
}

// ══════════════════════════════════════════════════════════════
// [4] DUPLICATE DETECTION
// ══════════════════════════════════════════════════════════════

function _isDupInvQ(rec) {
  return (window.invoices || []).some(ex =>
    !ex.deletedAt && !ex.ccKey &&
    ex.ngay === rec.ngay &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.congtrinh) === _normStr(rec.congtrinh)) &&
    _normStr(ex.loai) === _normStr(rec.loai) && ex.tien === rec.tien && _normStr(ex.nd) === _normStr(rec.nd)
  );
}
function _isDupInvD(rec) {
  return (window.invoices || []).some(ex =>
    !ex.deletedAt && Array.isArray(ex.items) && ex.items.length > 0 &&
    ex.ngay === rec.ngay &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.congtrinh) === _normStr(rec.congtrinh)) &&
    _normStr(ex.loai) === _normStr(rec.loai) && _normStr(ex.ncc) === _normStr(rec.ncc) && ex.thanhtien === rec.thanhtien
  );
}
function _isDupUng(rec) {
  return (window.ungRecords || []).some(ex =>
    !ex.deletedAt && ex.ngay === rec.ngay &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.congtrinh) === _normStr(rec.congtrinh)) &&
    _normStr(ex.tp) === _normStr(rec.tp) && ex.tien === rec.tien
  );
}
function _isDupThu(rec) {
  return (window.thuRecords || []).some(ex =>
    !ex.deletedAt && ex.ngay === rec.ngay &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.congtrinh) === _normStr(rec.congtrinh)) &&
    ex.tien === rec.tien
  );
}
function _isDupTb(rec) {
  return (window.tbData || []).some(ex =>
    !ex.deletedAt && ex.ngay === rec.ngay &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.ct) === _normStr(rec.ct)) &&
    _normStr(ex.ten) === _normStr(rec.ten) && ex.soluong === rec.soluong
  );
}
function _isDupTp(rec) {
  return (window.thauPhuContracts || []).some(ex =>
    !ex.deletedAt &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.congtrinh) === _normStr(rec.congtrinh)) &&
    _normStr(ex.thauphu) === _normStr(rec.thauphu) && ex.giaTri === rec.giaTri
  );
}
function _isDupCC(rec) {
  return (window.ccData || []).some(ex =>
    !ex.deletedAt && ex.fromDate === rec.fromDate &&
    (ex.projectId && rec.projectId ? ex.projectId === rec.projectId : _normStr(ex.ct) === _normStr(rec.ct))
  );
}

// ══════════════════════════════════════════════════════════════
// [5] DETECT SHEET TYPE + PARSE WORKBOOK
// ══════════════════════════════════════════════════════════════

function _detectSheetType(name) {
  const n = _normStr(name);
  if (n.match(/^1[ _]/) || n.includes('hoa don nhanh')    || n.includes('hoadonnhanh'))      return 'invQ';
  if (n.match(/^2[ _]/) || n.includes('hoa don chi tiet') || n.includes('hoadonchitiet'))     return 'invD';
  if (n.match(/^3[ _]/) || n.includes('cham cong')        || n.includes('chamcong'))          return 'cc';
  if (n.match(/^4[ _]/) || n.includes('tien ung')         || n.includes('tienung'))           return 'ung';
  if (n.match(/^5[ _]/) || n.includes('thiet bi')         || n.includes('thietbi'))           return 'tb';
  if (n.match(/^6[ _]/) || n.includes('danh muc')         || n.includes('danhmuc'))           return 'cats';
  if (n.match(/^7[ _]/) || n.includes('hop dong chinh')   || n.includes('hopdongchinh') ||
      (n.includes('hop dong') && !n.includes('thau')))                                        return 'hd';
  if (n.match(/^8[ _]/) || n.includes('thu tien')         || n.includes('thutien'))           return 'thu';
  if (n.match(/^9[ _]/) || n.includes('thau phu')         || n.includes('thauphu'))           return 'tp';
  return null;
}

let _importSession = null;

function _doImportParse(wb, filename) {
  const session = { filename, sheets: {}, catsParsed: null, lookup: null };
  const detected = {};
  wb.SheetNames.forEach(name => { const t = _detectSheetType(name); if (t && !detected[t]) detected[t] = name; });
  const _fbOrder = ['invQ','invD','cc','ung','tb','cats','hd','thu','tp'];
  wb.SheetNames.forEach((name, idx) => { const t = _fbOrder[idx]; if (t && !detected[t]) detected[t] = name; });

  // BƯỚC 1: Parse DanhMuc trước
  let catsParsed = null;
  if (detected.cats) {
    const rows = _sheetRows(wb.Sheets[detected.cats]);
    const { parsed, errors } = parseSheet6(rows);
    catsParsed = parsed;
    session.catsParsed = parsed;
    const total = ['ct','loai','ncc','nguoi','tp','cn','tb'].reduce((s,k) => s + (parsed[k]||[]).length, 0);
    session.sheets.cats = { key: 'cats', label: 'Danh Mục', sheetName: detected.cats, records: [], errors, skipped: [], cats: parsed, catTotal: total };
  }

  // BƯỚC 2: Fallback CT — scan col[1] nếu không có DanhMuc
  const extraCTs = [];
  if (!catsParsed || !(catsParsed.ct && catsParsed.ct.length)) {
    ['invQ','invD','cc','ung','tb','hd','thu','tp'].filter(k => detected[k]).forEach(k => {
      const rows = _sheetRows(wb.Sheets[detected[k]]);
      for (let i = 1; i < rows.length; i++) { const v = _str(rows[i][1]); if (v && !extraCTs.includes(v)) extraCTs.push(v); }
    });
  }

  // BƯỚC 3: Build lookup
  const lookup = _makeCatLookupWithExtra(catsParsed, extraCTs);
  session.lookup = lookup;

  // BƯỚC 4: Parse các sheet còn lại
  const _parse = (key, label, parseFn, sheetName) => {
    if (!sheetName) return;
    const rows = _sheetRows(wb.Sheets[sheetName]);
    if (rows.length < 2) { session.sheets[key] = { key, label, sheetName, records: [], skipped: [], errors: [_mkErr(label, 0, '', '', 'Sheet trống hoặc chỉ có header')] }; return; }
    const result = parseFn(rows, lookup);
    session.sheets[key] = { key, label, sheetName, records: result.records || [], errors: result.errors || [], skipped: [], ...(result.newCNs ? { newCNs: result.newCNs } : {}) };
  };
  _parse('invQ', 'HĐ Nhanh',     (r,l) => parseSheet1(r,l), detected.invQ);
  _parse('invD', 'HĐ Chi Tiết',  (r,l) => parseSheet2(r,l), detected.invD);
  _parse('cc',   'Chấm Công',    (r,l) => parseSheet3(r,l), detected.cc);
  _parse('ung',  'Tiền Ứng',     (r,l) => parseSheet4(r,l), detected.ung);
  _parse('tb',   'Thiết Bị',     (r,l) => parseSheet5(r,l), detected.tb);
  _parse('hd',   'HĐ Chính',     (r,l) => parseSheet7(r,l), detected.hd);
  _parse('thu',  'Thu Tiền',     (r,l) => parseSheet8(r,l), detected.thu);
  _parse('tp',   'HĐ Thầu Phụ', (r,l) => parseSheet9(r,l), detected.tp);

  _markDuplicates(session);

  const hasValid = Object.values(session.sheets).some(s => s.records.length > 0 || (s.catTotal || 0) > 0);
  const totalErrors = Object.values(session.sheets).reduce((n,s) => n + s.errors.length, 0);
  if (!hasValid && totalErrors === 0) { if (window.toast) window.toast('⚠️ Không tìm thấy dữ liệu hợp lệ trong file!', 'error'); return; }

  _importSession = session;
  _showImportPreviewNew(session);
}

// ══════════════════════════════════════════════════════════════
// [6] DUPLICATE MARKING
// ══════════════════════════════════════════════════════════════

function _markDuplicates(session) {
  const sh = session.sheets;
  const _batchDedup = (key, keyFn) => {
    if (!sh[key]) return;
    const { kept, duplicates } = _markDuplicateInBatch(sh[key].records, keyFn);
    sh[key].skipped.push(...duplicates.map(r => ({ reason: 'Trùng trong file import', record: r })));
    sh[key].records = kept;
  };
  const _pid = (r, ctField) => r.projectId || _normStr(r[ctField] || '');
  _batchDedup('invQ', r => `${r.ngay}|${_pid(r,'congtrinh')}|${_normStr(r.loai)}|${r.tien}|${_normStr(r.nd)}`);
  _batchDedup('invD', r => `${r.ngay}|${_pid(r,'congtrinh')}|${_normStr(r.loai)}|${_normStr(r.ncc)}|${r.thanhtien}`);
  _batchDedup('ung',  r => `${r.ngay}|${_pid(r,'congtrinh')}|${_normStr(r.tp)}|${r.tien}`);
  _batchDedup('thu',  r => `${r.ngay}|${_pid(r,'congtrinh')}|${r.tien}`);
  _batchDedup('tb',   r => `${r.ngay}|${_pid(r,'ct')}|${_normStr(r.ten)}|${r.soluong}`);
  _batchDedup('tp',   r => `${_pid(r,'congtrinh')}|${_normStr(r.thauphu)}|${r.giaTri}`);
  _batchDedup('cc',   r => `${r.fromDate}|${_pid(r,'ct')}`);
  const _mark = (key, isDupFn) => {
    if (!sh[key]) return;
    const kept = [], dups = [];
    sh[key].records.forEach(r => { if (isDupFn(r)) dups.push(r); else kept.push(r); });
    sh[key].skipped.push(...dups.map(r => ({ reason: 'Trùng dữ liệu đã có trong DB', record: r })));
    sh[key].records = kept;
  };
  _mark('invQ', _isDupInvQ); _mark('invD', _isDupInvD);
  _mark('ung',  _isDupUng);  _mark('thu',  _isDupThu);
  _mark('tb',   _isDupTb);   _mark('tp',   _isDupTp);
  _mark('cc',   _isDupCC);
}

// ══════════════════════════════════════════════════════════════
// [7] IMPORT PREVIEW MODAL
// ══════════════════════════════════════════════════════════════

function _showImportPreviewNew(session) {
  let ov = document.getElementById('import-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'import-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e) { if (e.target === this) ov.style.display = 'none'; };
    document.body.appendChild(ov);
  }
  const sh    = session.sheets;
  const ORDER = ['invQ','invD','cc','ung','tb','cats','hd','thu','tp'];
  const _mkRow = key => {
    const s = sh[key];
    if (!s) return '';
    const isCats        = key === 'cats';
    const validCount    = isCats ? (s.catTotal || 0) : s.records.length;
    const dbDupCount    = s.skipped.filter(sk => sk.reason === 'Trùng dữ liệu đã có trong DB').length;
    const batchDupCount = s.skipped.filter(sk => sk.reason === 'Trùng trong file import').length;
    const errCount      = s.errors.length;
    const canImport     = validCount > 0;
    let icon, iconColor;
    if (validCount === 0 && errCount > 0 && s.skipped.length === 0) { icon = '❌'; iconColor = '#c0392b'; }
    else if (errCount > 0 || s.skipped.length > 0) { icon = '⚠️'; iconColor = '#e67e22'; }
    else { icon = '✔'; iconColor = '#1a7a45'; }
    let countTxt;
    if (isCats) {
      const c = s.cats, parts = [];
      if ((c.ct    ||[]).length) parts.push(`${c.ct.length} CT`);
      if ((c.loai  ||[]).length) parts.push(`${c.loai.length} Loại`);
      if ((c.ncc   ||[]).length) parts.push(`${c.ncc.length} NCC`);
      if ((c.nguoi ||[]).length) parts.push(`${c.nguoi.length} Người`);
      if ((c.tp    ||[]).length) parts.push(`${c.tp.length} TP`);
      if ((c.cn    ||[]).length) parts.push(`${c.cn.length} CN`);
      if ((c.tb    ||[]).length) parts.push(`${c.tb.length} Thiết Bị`);
      countTxt = parts.join(', ') || '0 mục';
    } else if (key === 'cc') {
      const cnN = s.records.reduce((n, w) => n + (w.workers||[]).length, 0);
      countTxt = `${s.records.length} tuần · ${cnN} CN`;
      if (dbDupCount)    countTxt += ` · ⚠️ ${dbDupCount} tuần trùng DB`;
      if (batchDupCount) countTxt += ` · ⛔ ${batchDupCount} tuần trùng file`;
    } else {
      countTxt = `${validCount} bản ghi`;
      if (dbDupCount)    countTxt += ` · ⚠️ ${dbDupCount} trùng DB`;
      if (batchDupCount) countTxt += ` · ⛔ ${batchDupCount} trùng file`;
    }
    const errSample = s.errors.slice(0, 4);
    const errHtml = errSample.length
      ? `<div style="padding:2px 10px 6px 46px;font-size:11px;color:#c0392b;line-height:1.7">${errSample.map(e => `• ${_fmtErr(e)}`).join('<br>')}${s.errors.length > 4 ? `<br>• …và ${s.errors.length-4} lỗi khác (xem log)` : ''}</div>` : '';
    return `<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:#f8f9fb;cursor:${canImport?'pointer':'default'}">
      <input type="checkbox" id="imp-cb-${key}" ${canImport?'checked':'disabled'} style="width:15px;height:15px;accent-color:#1a7a45;cursor:${canImport?'pointer':'default'}">
      <span style="font-size:14px;min-width:22px;color:${iconColor}">${icon}</span>
      <span style="font-size:12.5px;flex:1"><strong>${s.label}</strong>: ${countTxt}</span>
    </label>${errHtml}`;
  };
  const sheetsHtml   = ORDER.map(_mkRow).join('');
  const hasAnything  = ORDER.some(k => sh[k] && (sh[k].records.length > 0 || (sh[k].catTotal || 0) > 0));
  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:540px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.18);max-height:92vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="font-size:16px;font-weight:800;margin:0">📥 Xem Trước Import</h3>
      <button onclick="document.getElementById('import-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="background:#f0f4ff;border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#333">
      📄 <strong>${session.filename}</strong>
    </div>
    ${hasAnything ? `<div style="margin-bottom:8px"><label style="display:flex;align-items:center;gap:8px;padding:5px 10px;font-size:12.5px;font-weight:700;cursor:pointer;color:#1a1814">
      <input type="checkbox" id="imp-cb-all" checked onchange="_toggleAllImportSheets(this.checked)" style="width:15px;height:15px;accent-color:#1a1814">
      Chọn tất cả</label></div>` : ''}
    <div style="border-top:1px solid #eee;padding-top:8px;margin-bottom:10px">${sheetsHtml}</div>
    <div style="background:#f0f9f4;border-radius:8px;padding:9px 14px;margin-bottom:14px;font-size:11.5px;color:#1a3c2a;line-height:1.7">
      ✔ Chỉ insert bản ghi MỚI · Bản trùng tự bỏ qua · Lỗi validate bị loại trước import
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('import-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Huỷ</button>
      ${hasAnything
        ? `<button onclick="_applyImport()" style="flex:2;padding:11px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">✅ Import Các Sheet Đã Chọn</button>`
        : `<button disabled style="flex:2;padding:11px;border-radius:8px;border:none;background:#ccc;color:#666;font-family:inherit;font-size:13px;font-weight:700;cursor:not-allowed">Không có dữ liệu hợp lệ</button>`}
    </div>
  </div>`;
  ov.style.display = 'flex';
}

function _toggleAllImportSheets(checked) {
  ['invQ','invD','cc','ung','tb','cats','hd','thu','tp'].forEach(key => {
    const cb = document.getElementById('imp-cb-' + key);
    if (cb && !cb.disabled) cb.checked = checked;
  });
}

// ══════════════════════════════════════════════════════════════
// [8] APPLY IMPORT
// ══════════════════════════════════════════════════════════════

function _applyImport() {
  const session = _importSession;
  if (!session) return;
  document.getElementById('import-modal-overlay').style.display = 'none';

  const ORDER    = ['invQ','invD','cc','ung','tb','cats','hd','thu','tp'];
  const selected = new Set(ORDER.filter(k => { const cb = document.getElementById('imp-cb-' + k); return cb && cb.checked; }));
  if (!selected.size) { if (window.toast) window.toast('⚠️ Không có sheet nào được chọn', 'error'); return; }

  const sh = session.sheets, logLines = {};
  const _log = (key, line) => { if (!logLines[key]) logLines[key] = []; logLines[key].push(line); };
  let totalAdded = 0;

  // 1. DanhMuc trước
  if (selected.has('cats') && session.catsParsed) {
    const c = session.catsParsed, now = Date.now(), dev = _DEVICE();
    const _mergeCatArr = (key, incoming, catId, assign) => {
      if (!incoming || !incoming.length) return 0;
      const current  = (window.load || (() => []))(key, []);
      const combined = _deduplicateCatNames([...current, ...incoming]);
      const added    = combined.filter(v => !current.some(c2 => _normStr(c2) === _normStr(v)));
      if (!added.length) return 0;
      if (window.save) window.save(key, combined);
      if (assign) assign(combined);
      if (catId && typeof window._syncCatItems === 'function') window._syncCatItems(catId, combined);
      return added.length;
    };
    let catAdded = 0;
    catAdded += _mergeCatArr('cat_loai',  c.loai,  'loaiChiPhi', v => { if (window.cats) window.cats.loaiChiPhi = v; });
    catAdded += _mergeCatArr('cat_ncc',   c.ncc,   'nhaCungCap', v => { if (window.cats) window.cats.nhaCungCap = v; });
    catAdded += _mergeCatArr('cat_nguoi', c.nguoi, 'nguoiTH',    v => { if (window.cats) window.cats.nguoiTH    = v; });
    catAdded += _mergeCatArr('cat_tp',    c.tp,    'thauPhu',    v => { if (window.cats) window.cats.thauPhu    = v; });
    catAdded += _mergeCatArr('cat_cn',    c.cn,    'congNhan',   v => { if (window.cats) window.cats.congNhan   = v; });
    catAdded += _mergeCatArr('cat_tbteb', c.tb,    'tbTen',      v => { if (window.cats && typeof window.cats.tbTen !== 'undefined') window.cats.tbTen = v; });
    if (c.cnRoles && Object.keys(c.cnRoles).length) {
      const merged = Object.assign({}, (typeof window.cnRoles !== 'undefined' ? window.cnRoles : {}), c.cnRoles);
      if (window.save) window.save('cat_cn_roles', merged);
      if (typeof window.cnRoles !== 'undefined') window.cnRoles = merged;
    }
    let projCreated = 0;
    if (typeof window.projects !== 'undefined' && c.ct && c.ct.length) {
      const existNorm = new Set(window.projects.map(p => _normStr(p.name)));
      c.ct.forEach(name => {
        const t = String(name || '').trim();
        if (!t || t.length < 2) return;
        if (existNorm.has(_normStr(t))) return;
        window.projects.push({ id: crypto.randomUUID(), name: t, status: 'active', startDate: null, endDate: null, note: '', createdAt: now, updatedAt: now, deletedAt: null, deviceId: dev });
        existNorm.add(_normStr(t));
        projCreated++;
      });
      if (projCreated > 0) {
        if (window.save) window.save('projects_v1', window.projects);
        if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
      }
    }
    _log('cats', `✔ Danh mục: +${catAdded} mục mới, +${projCreated} công trình mới`);
    sh.cats.errors.forEach(e => _log('cats', `❌ ${_fmtErr(e)}`));
    totalAdded += catAdded + projCreated;
    const newLookup = _makeCatLookup();
    Object.assign(session.lookup, newLookup);
    _resolveProvisionalProjectIds(session, session.lookup);
  }

  // 1b. Fallback: auto-create projects từ provisional records
  if (!selected.has('cats')) {
    const now2 = Date.now(), dev2 = _DEVICE();
    const allRecs = ['invQ','invD','ung','tb','thu','tp','cc'].flatMap(key => (sh[key] || {}).records || []);
    const existNorm = new Set((typeof window.projects !== 'undefined' ? window.projects : []).map(p => _normStr(p.name)));
    let autoCreated = 0;
    allRecs.forEach(r => {
      if (!r.projectId || !String(r.projectId).startsWith('_prov_')) return;
      const name = (r.congtrinh || r.ct || '').trim();
      if (!name || existNorm.has(_normStr(name))) return;
      if (typeof window.projects !== 'undefined') {
        window.projects.push({ id: crypto.randomUUID(), name, status: 'active', startDate: null, endDate: null, note: '', createdAt: now2, updatedAt: now2, deletedAt: null, deviceId: dev2 });
        existNorm.add(_normStr(name));
        autoCreated++;
      }
    });
    if (autoCreated > 0) {
      if (window.save) window.save('projects_v1', window.projects);
      if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
      const fbLookup = _makeCatLookup();
      Object.assign(session.lookup, fbLookup);
      _resolveProvisionalProjectIds(session, session.lookup);
    }
  }

  // 2. Merge record arrays
  const _applyNow = Date.now(), _applyDev = _DEVICE();
  const _importArr = (key, dbKey, recs, assign) => {
    if (!selected.has(key) || !sh[key] || !recs.length) return;
    const stamped = recs.map(r => ({ ...r, updatedAt: _applyNow, deviceId: _applyDev || r.deviceId }));
    const _load = window.load || (() => []);
    const _save = window.save;
    const merged = (typeof window.mergeUnique === 'function') ? window.mergeUnique(_load(dbKey, []), stamped) : [..._load(dbKey, []), ...stamped];
    if (_save) _save(dbKey, merged);
    if (assign) assign(merged);
    stamped.forEach(r => {
      let d = r.ngay || r.fromDate || '';
      if (d && d.split('-').length === 3) d = d.split('-').reverse().join('-');
      _log(key, `✔ ${d}${d&&(r.congtrinh||r.ct)?' · ':''}${r.congtrinh||r.ct||''}`);
    });
    sh[key].skipped.forEach(sk => {
      const r = sk.record, prefix = sk.reason === 'Trùng trong file import' ? '⛔' : '⚠️';
      let d = r.ngay || r.fromDate || '';
      if (d && d.split('-').length === 3) d = d.split('-').reverse().join('-');
      _log(key, `${prefix} Bỏ qua (${sk.reason}): ${d} · ${r.congtrinh||r.ct||''}`);
    });
    sh[key].errors.slice(0, 30).forEach(e => _log(key, `❌ ${_fmtErr(e)}`));
    totalAdded += recs.length;
  };
  const _recs = key => (selected.has(key) && sh[key]) ? sh[key].records : [];
  _importArr('invQ', 'inv_v3',     _recs('invQ'), v => { window.invoices        = v; });
  _importArr('invD', 'inv_v3',     _recs('invD'), v => { window.invoices        = v; });
  _importArr('ung',  'ung_v1',     _recs('ung'),  v => { window.ungRecords      = v; });
  _importArr('tb',   'tb_v1',      _recs('tb'),   v => { window.tbData          = v; });
  _importArr('thu',  'thu_v1',     _recs('thu'),  v => { window.thuRecords      = v; });
  _importArr('tp',   'thauphu_v1', _recs('tp'),   v => { window.thauPhuContracts = v; });

  // CC
  if (selected.has('cc') && sh.cc && sh.cc.records.length) {
    const ccRecs = sh.cc.records.map(r => {
      const pid = r.projectId || (typeof window.findProjectIdByName === 'function' ? window.findProjectIdByName(r.ct || r.congtrinh) : null) || null;
      return { ...r, projectId: pid, ctPid: pid };
    });
    const newCNs = sh.cc.newCNs || [];
    if (newCNs.length) {
      const _load = window.load || (() => []);
      const current  = _load('cat_cn', []);
      const combined = _deduplicateCatNames([...current, ...newCNs]);
      const added    = combined.filter(v => !current.some(c2 => _normStr(c2) === _normStr(v)));
      if (added.length) {
        if (window.save) window.save('cat_cn', combined);
        if (window.cats) window.cats.congNhan = combined;
        if (typeof window._syncCatItems === 'function') window._syncCatItems('congNhan', combined);
        _log('cc', `ℹ️ Tự thêm ${added.length} CN mới vào danh mục: ${added.join(', ')}`);
      }
    }
    const stampedCC = ccRecs.map(r => ({ ...r, updatedAt: _applyNow, deviceId: _applyDev || r.deviceId }));
    const _load = window.load || (() => []);
    const merged = (typeof window.mergeUnique === 'function') ? window.mergeUnique(_load('cc_v2', []), stampedCC) : [..._load('cc_v2', []), ...stampedCC];
    if (window.save) window.save('cc_v2', merged);
    window.ccData = merged;
    if (typeof window.normalizeAllChamCong === 'function') window.normalizeAllChamCong();
    if (typeof window.rebuildCCCategories  === 'function') window.rebuildCCCategories();
    ccRecs.forEach(w => {
      let d = w.fromDate || '';
      if (d && d.split('-').length === 3) d = d.split('-').reverse().join('-');
      _log('cc', `✔ Tuần ${d} · ${w.ct} · ${(w.workers||[]).length} CN`);
    });
    sh.cc.skipped.forEach(sk => {
      const prefix = sk.reason === 'Trùng trong file import' ? '⛔' : '⚠️';
      let d = sk.record.fromDate || '';
      if (d && d.split('-').length === 3) d = d.split('-').reverse().join('-');
      _log('cc', `${prefix} Bỏ qua (${sk.reason}): Tuần ${d} · ${sk.record.ct}`);
    });
    sh.cc.errors.slice(0, 30).forEach(e => _log('cc', `❌ ${_fmtErr(e)}`));
    totalAdded += ccRecs.length;
  }

  // HopDong
  if (selected.has('hd') && sh.hd && sh.hd.records.length) {
    const now3 = Date.now();
    const _load = window.load || (() => ({}));
    const existing = _load('hopdong_v1', {});
    sh.hd.records.forEach(row => {
      const _today = (typeof window.today === 'function') ? window.today() : new Date().toISOString().slice(0,10);
      if (!existing[row.ct] || existing[row.ct].deletedAt) {
        existing[row.ct] = { projectId: row.projectId || null, giaTri: row.giaTri||0, giaTriphu: row.giaTriphu||0, phatSinh: row.phatSinh||0, ghichu: row.ghichu||'', nguoi: row.nguoi||'', ngay: row.ngay||_today, createdAt: now3, updatedAt: now3, deletedAt: null };
        _log('hd', `✔ Tạo HĐ: ${row.ct}`);
      } else {
        const cur = existing[row.ct];
        existing[row.ct] = { ...cur, giaTri: row.giaTri||cur.giaTri||0, giaTriphu: row.giaTriphu||cur.giaTriphu||0, phatSinh: row.phatSinh||cur.phatSinh||0, ghichu: row.ghichu||cur.ghichu||'', nguoi: row.nguoi||cur.nguoi||'', updatedAt: now3 };
        _log('hd', `✔ Cập nhật HĐ: ${row.ct}`);
      }
    });
    if (window.save) window.save('hopdong_v1', existing);
    window.hopDongData = (window.load || (() => ({})))('hopdong_v1', {});
    sh.hd.errors.slice(0, 30).forEach(e => _log('hd', `❌ ${_fmtErr(e)}`));
    totalAdded += sh.hd.records.length;
  }

  // 3. Cập nhật year filter
  const importYrs = new Set();
  [..._recs('invQ'), ..._recs('invD')].forEach(r => { if (r.ngay) importYrs.add(r.ngay.slice(0,4)); });
  _recs('ung').forEach(r => { if (r.ngay) importYrs.add(r.ngay.slice(0,4)); });
  _recs('cc') .forEach(r => { if (r.fromDate) importYrs.add(r.fromDate.slice(0,4)); });
  _recs('thu').forEach(r => { if (r.ngay) importYrs.add(r.ngay.slice(0,4)); });
  if (importYrs.size > 0 && typeof window.activeYears !== 'undefined' && window.activeYears.size > 0) {
    const activeYrStrs = [...window.activeYears].map(String);
    if (!activeYrStrs.some(y => [...importYrs].includes(y))) {
      window.activeYears = new Set();
      if (typeof window._syncActiveYearCompat === 'function') window._syncActiveYearCompat();
    }
  }

  // 4. Refresh UI
  const _call = fn => { if (typeof window[fn] === 'function') window[fn](); };
  _call('buildYearSelect'); _call('rebuildEntrySelects'); _call('rebuildUngSelects');
  _call('buildFilters'); _call('filterAndRender'); _call('renderTrash');
  _call('renderCCHistory'); _call('renderCCTLT'); _call('buildUngFilters');
  _call('filterAndRenderUng'); _call('renderCtPage'); _call('renderProjectsPage');
  _call('renderSettings'); _call('updateTop'); _call('dtPopulateSels'); _call('renderLaiLo');
  _call('renderCongNoThauPhu');

  // 5. Force push: import là nguồn sự thật
  if (typeof window.blockPullUntil === 'function') window.blockPullUntil(Date.now() + 15000);
  else localStorage.setItem('_blockPullUntil', String(Date.now() + 15000));
  if (typeof window.cancelScheduledPush === 'function') window.cancelScheduledPush();
  if (typeof window._clearQueue        === 'function') window._clearQueue();
  if (window.fbReady && window.fbReady() && typeof window.pushChanges === 'function') {
    console.log('[Import] ✔ stamped updatedAt=' + _applyNow + ' · force push skipPull');
    window.pushChanges({ silent: true, skipPull: true });
  }

  // 6. Toast + log
  const totalSkipped = ORDER.reduce((n,k) => n + (sh[k] ? sh[k].skipped.length : 0), 0);
  const totalErrors  = ORDER.reduce((n,k) => n + (sh[k] ? sh[k].errors.length  : 0), 0);
  if (window.toast) window.toast(`✅ Thêm ${totalAdded} · Bỏ qua ${totalSkipped} trùng · ${totalErrors} lỗi — đang tải log...`, 'success');
  setTimeout(() => _generateImportLog(session, logLines, selected), 800);
}

// ══════════════════════════════════════════════════════════════
// [9] IMPORT LOG GENERATOR
// ══════════════════════════════════════════════════════════════

function _generateImportLog(session, logLines, selected) {
  const sh    = session.sheets;
  const ORDER = ['invQ','invD','cc','ung','tb','cats','hd','thu','tp'];
  const LABELS = { invQ:'1_HoaDonNhanh', invD:'2_HoaDonChiTiet', cc:'3_ChamCong', ung:'4_TienUng', tb:'5_ThietBi', cats:'6_DanhMuc', hd:'7_HopDongChinh', thu:'8_ThuTien', tp:'9_HopDongThauPhu' };
  const now = new Date();
  const ts  = now.toISOString().replace('T',' ').slice(0,19);
  const fts = now.toISOString().replace(/[-:]/g,'').replace('T','_').slice(0,15);
  let totalOk = 0, totalSkip = 0, totalErr = 0;
  const lines = [`=== IMPORT LOG — ${ts} — ${session.filename} ===`, ''];
  ORDER.forEach(key => {
    if (!sh[key] || !selected.has(key)) return;
    const s     = sh[key];
    const label = LABELS[key] || key;
    const ok    = (key === 'cats') ? (s.catTotal || 0) : s.records.length;
    const skip  = s.skipped.length, err = s.errors.length;
    totalOk += ok; totalSkip += skip; totalErr += err;
    lines.push(`--- ${label} ---`);
    lines.push(`✔ Thêm: ${ok} | ⚠️ Bỏ qua: ${skip} | ❌ Lỗi: ${err}`);
    (logLines[key] || []).forEach(l => lines.push('  ' + l));
    lines.push('');
  });
  lines.push(`=== TỔNG: +${totalOk} thêm · ${totalSkip} bỏ qua · ${totalErr} lỗi ===`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `import_log_${fts}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// [10] IMPORT MODAL + FILE HANDLER
// ══════════════════════════════════════════════════════════════

export function openImportModal() {
  document.getElementById('import-file-input').click();
}

export function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = window.XLSX.read(ev.target.result, { type: 'array' });
      _doImportParse(wb, file.name);
    } catch (err) {
      if (window.toast) window.toast('❌ Không đọc được file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════
// [11] EXPORT MODAL
// ══════════════════════════════════════════════════════════════

export function openExportModal() {
  let ov = document.getElementById('export-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'export-modal-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center';
    ov.onclick = function(e) { if (e.target === this) ov.style.display = 'none'; };
    document.body.appendChild(ov);
  }
  const inv  = window.invoices          || [];
  const ung  = window.ungRecords        || [];
  const cc   = window.ccData            || [];
  const tb   = window.tbData            || [];
  const thu  = window.thuRecords        || [];
  const tp   = window.thauPhuContracts  || [];
  const hd   = window.hopDongData       || {};
  const invCount  = inv.filter(i => !i.deletedAt && !i.ccKey).length;
  const ungCount  = ung.filter(u => !u.deletedAt).length;
  const ccWks     = cc.filter(w  => !w.deletedAt).length;
  const cnCount   = cc.filter(w  => !w.deletedAt).reduce((s,w) => s + (w.workers||[]).length, 0);
  const tbCount   = tb.filter(t  => !t.deletedAt).length;
  const thuCount  = thu.filter(r => !r.deletedAt).length;
  const tpCount   = tp.filter(r  => !r.deletedAt).length;
  const hdCount   = Object.values(hd).filter(v => !v.deletedAt).length;
  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:460px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:800;margin:0">📤 Xuất Toàn Bộ Dữ Liệu Ra Excel</h3>
      <button onclick="document.getElementById('export-modal-overlay').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="background:#f0f9f4;border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:12.5px;color:#1a3c2a;line-height:2">
      <strong>Dữ liệu sẽ xuất (tất cả năm):</strong><br>
      🧾 ${invCount} hóa đơn &nbsp;·&nbsp; 💸 ${ungCount} tiền ứng &nbsp;·&nbsp; 👷 ${cnCount} CN (${ccWks} tuần)<br>
      🔧 ${tbCount} thiết bị &nbsp;·&nbsp; 💰 ${thuCount} lần thu &nbsp;·&nbsp; 🤝 ${tpCount} HĐ thầu phụ &nbsp;·&nbsp; 📋 ${hdCount} HĐ chính
    </div>
    <div style="background:#f0f4ff;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:11.5px;color:#444;line-height:1.8">
      <strong>10 sheets:</strong> 1_HoaDonNhanh · 2_HoaDonChiTiet · 3_ChamCong · 4_TienUng · 5_ThietBi ·
      6_DanhMuc · 7_HopDongChinh · 8_ThuTien · 9_HopDongThauPhu · 10_HuongDan<br>
      <span style="color:#888">Ngày: yyyy-mm-dd · Số: không ký hiệu tiền · Có thể chỉnh sửa → import lại</span>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="document.getElementById('export-modal-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Huỷ</button>
      <button onclick="exportExcel()" style="flex:2;padding:11px;border-radius:8px;border:none;background:#1a7a45;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">📥 Tải export_full_data.xlsx</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════
// [12] SHEET BUILDERS
// ══════════════════════════════════════════════════════════════

function _buildSheet(headers, rows) {
  const XLSX = window.XLSX;
  const nCols = headers.length;
  const aoa   = [headers.map(h => h.label), ...rows];
  const ws    = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']   = headers.map(h => ({ wch: h.w || 14 }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!rows']   = [{ hpt: 22 }];
  const S_H = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1A1A2E' } }, alignment: { horizontal: 'center', vertical: 'center' } };
  const S_D = { alignment: { vertical: 'top', wrapText: false } };
  const S_N = { numFmt: '#,##0', alignment: { horizontal: 'right', vertical: 'top' } };
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < nCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = r === 0 ? S_H : (headers[c] && headers[c].num ? S_N : S_D);
    }
  }
  return ws;
}

export function buildHoaDonNhanh() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'CÔNG TRÌNH', w: 32 }, { label: 'LOẠI CHI PHÍ', w: 22 },
    { label: 'NỘI DUNG', w: 36 }, { label: 'SỐ TIỀN', w: 15, num: true },
    { label: 'NGƯỜI THỰC HIỆN', w: 22 }, { label: 'NHÀ CUNG CẤP', w: 24 },
    { label: 'SỐ HĐ', w: 16 }, { label: 'ID', w: 36 },
  ];
  const rows = (window.invoices || [])
    .filter(i => !i.deletedAt && !i.ccKey && i.source !== 'detail' && !(Array.isArray(i.items) && i.items.length))
    .map(i => [i.ngay||'', i.congtrinh||'', i.loai||'', i.nd||'', i.tien||0, i.nguoi||'', i.ncc||'', i.soHD||'', i.id||'']);
  return _buildSheet(hdrs, rows);
}

export function buildHoaDonChiTiet() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'CÔNG TRÌNH', w: 32 }, { label: 'LOẠI CHI PHÍ', w: 22 },
    { label: 'NGƯỜI THỰC HIỆN', w: 22 }, { label: 'NHÀ CUNG CẤP', w: 24 }, { label: 'SỐ HĐ', w: 16 },
    { label: 'TÊN HÀNG HÓA', w: 36 }, { label: 'ĐVT', w: 10 },
    { label: 'SỐ LƯỢNG', w: 10, num: true }, { label: 'ĐƠN GIÁ', w: 14, num: true },
    { label: 'THÀNH TIỀN', w: 15, num: true }, { label: 'ID HÓA ĐƠN', w: 36 },
  ];
  const rows = [];
  (window.invoices || []).filter(i => !i.deletedAt && !i.ccKey && (i.source === 'detail' || (Array.isArray(i.items) && i.items.length)))
    .forEach(i => {
      const _resolveName = window.resolveProjectName;
      (Array.isArray(i.items) ? i.items : []).forEach(it => {
        const sl = it.sl != null ? it.sl : (it.soluong != null ? it.soluong : 1);
        const dg = it.dongia || 0, tt = it.thanhtien != null ? it.thanhtien : ((sl * dg) || 0);
        rows.push([i.ngay||'', _resolveName ? _resolveName(i) : (i.congtrinh||''), i.loai||'', i.nguoi||'', i.ncc||'', i.soHD||'', it.ten||'', it.dv||it.dvt||'', sl, dg, tt, i.id||'']);
      });
    });
  return _buildSheet(hdrs, rows);
}

export function buildChamCong() {
  const hdrs = [
    { label: 'NGÀY ĐẦU TUẦN', w: 14 }, { label: 'CÔNG TRÌNH', w: 32 }, { label: 'TÊN CN', w: 22 },
    { label: 'VAI TRÒ', w: 16 }, { label: 'LƯƠNG NGÀY', w: 13, num: true }, { label: 'PHỤ CẤP', w: 12, num: true },
    { label: 'HD MUA LẺ', w: 12, num: true }, { label: 'CN', w: 6, num: true }, { label: 'T2', w: 6, num: true },
    { label: 'T3', w: 6, num: true }, { label: 'T4', w: 6, num: true }, { label: 'T5', w: 6, num: true },
    { label: 'T6', w: 6, num: true }, { label: 'T7', w: 6, num: true }, { label: 'GHI CHÚ', w: 28 },
  ];
  const rows = [];
  (window.ccData || []).filter(w => !w.deletedAt).forEach(week => {
    (week.workers || []).forEach(wk => {
      const d = wk.d || [0,0,0,0,0,0,0];
      rows.push([week.fromDate||'', week.ct||'', wk.name||'', wk.role||'', wk.luong||0, wk.phucap||0, wk.hdmuale||0, d[0]||0, d[1]||0, d[2]||0, d[3]||0, d[4]||0, d[5]||0, d[6]||0, wk.nd||'']);
    });
  });
  return _buildSheet(hdrs, rows);
}

export function buildTienUng() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'ĐỐI TƯỢNG', w: 14 }, { label: 'TÊN', w: 26 },
    { label: 'CÔNG TRÌNH', w: 32 }, { label: 'SỐ TIỀN', w: 15, num: true }, { label: 'NỘI DUNG', w: 36 }, { label: 'ID', w: 36 },
  ];
  const _ungLoaiLabel = loai => loai === 'nhacungcap' ? 'Nhà cung cấp' : 'Thầu phụ';
  const _resolveName  = window.resolveProjectName;
  const rows = (window.ungRecords || []).filter(u => !u.deletedAt && u.loai !== 'congnhan')
    .map(u => [u.ngay||'', _ungLoaiLabel(u.loai||'thauphu'), u.tp||'', _resolveName ? _resolveName(u) : (u.congtrinh||''), u.tien||0, u.nd||'', u.id||'']);
  return _buildSheet(hdrs, rows);
}

export function buildThietBi() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'CÔNG TRÌNH', w: 32 }, { label: 'TÊN THIẾT BỊ', w: 26 },
    { label: 'SỐ LƯỢNG', w: 10, num: true }, { label: 'TÌNH TRẠNG', w: 22 }, { label: 'GHI CHÚ', w: 32 }, { label: 'ID', w: 36 },
  ];
  const rows = (window.tbData || []).filter(t => !t.deletedAt)
    .map(t => [t.ngay||'', t.ct||'', t.ten||'', t.soluong != null ? t.soluong : 1, t.tinhtrang||'', t.ghichu||'', t.id||'']);
  return _buildSheet(hdrs, rows);
}

export function buildDanhMuc() {
  const hdrs = [{ label: 'LOẠI DANH MỤC', w: 28 }, { label: 'TÊN', w: 44 }, { label: 'EXTRA', w: 20 }];
  const cats = _cats();
  const cnRolesObj = (typeof window.cnRoles !== 'undefined' && window.cnRoles) ? window.cnRoles : {};
  const groups = [
    ['Công Trình',              cats.congTrinh  || [], null],
    ['Loại Chi Phí',            cats.loaiChiPhi || [], null],
    ['Nhà Cung Cấp',            cats.nhaCungCap || [], null],
    ['Người Thực Hiện',         cats.nguoiTH    || [], null],
    ['Thầu Phụ / TP',           cats.thauPhu    || [], null],
    ['Công Nhân',               cats.congNhan   || [], 'role'],
    ['Máy / Thiết Bị Thi Công', cats.tbTen      || [], null],
  ];
  const rows = [];
  groups.forEach(([groupName, items, extraType]) => {
    items.forEach(item => {
      const extra = extraType === 'role' ? (cnRolesObj[item] || '') : '';
      rows.push([groupName, item, extra]);
    });
  });
  return _buildSheet(hdrs, rows);
}

export function buildHopDongChinh() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'CÔNG TRÌNH', w: 36 }, { label: 'NGƯỜI THỰC HIỆN', w: 22 },
    { label: 'GIÁ TRỊ HĐ CHÍNH', w: 22, num: true }, { label: 'GIÁ TRỊ HĐ PHỤ', w: 20, num: true },
    { label: 'PHÁT SINH', w: 15, num: true }, { label: 'GHI CHÚ', w: 32 },
  ];
  const expProjs = _projs();
  const rows = Object.entries(window.hopDongData || {}).filter(([, v]) => !v.deletedAt).map(([keyId, hd]) => {
    const p = expProjs.find(proj => proj.id === keyId);
    const ctName = p ? p.name : keyId;
    return [hd.ngay||'', ctName, hd.nguoi||'', hd.giaTri||0, hd.giaTriphu||0, hd.phatSinh||0, hd.nd||''];
  });
  return _buildSheet(hdrs, rows);
}

export function buildThuTien() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'NGƯỜI THỰC HIỆN', w: 22 }, { label: 'CÔNG TRÌNH', w: 32 },
    { label: 'SỐ TIỀN', w: 15, num: true }, { label: 'NỘI DUNG', w: 36 }, { label: 'ID', w: 36 },
  ];
  const rows = (window.thuRecords || []).filter(r => !r.deletedAt)
    .map(r => [r.ngay||'', r.nguoi||'', r.congtrinh||'', r.tien||0, r.nd||'', r.id||'']);
  return _buildSheet(hdrs, rows);
}

export function buildHopDongThauPhu() {
  const hdrs = [
    { label: 'NGÀY', w: 13 }, { label: 'CÔNG TRÌNH', w: 32 }, { label: 'TÊN THẦU PHỤ', w: 26 },
    { label: 'GIÁ TRỊ HĐ', w: 18, num: true }, { label: 'PHÁT SINH', w: 15, num: true },
    { label: 'NỘI DUNG', w: 36 }, { label: 'ID', w: 36 },
  ];
  const rows = (window.thauPhuContracts || []).filter(r => !r.deletedAt)
    .map(r => [r.ngay||'', r.congtrinh||'', r.thauphu||'', r.giaTri||0, r.phatSinh||0, r.nd||'', r.id||'']);
  return _buildSheet(hdrs, rows);
}

export function buildHuongDan() {
  const hdrs = [{ label: 'HƯỚNG DẪN SỬ DỤNG FILE EXCEL', w: 90 }];
  const rows = [
    ['File export_full_data.xlsx chứa toàn bộ dữ liệu ứng dụng Quản Lý Công Trình.'], [''],
    ['━━━ CẤU TRÚC FILE ━━━'],
    ['1_HoaDonNhanh   — Hóa đơn nhập nhanh (1 dòng = 1 hóa đơn)'],
    ['2_HoaDonChiTiet — Hóa đơn chi tiết theo hàng hóa/vật tư (1 dòng = 1 mặt hàng)'],
    ['3_ChamCong       — Chấm công theo tuần (1 dòng = 1 công nhân/tuần)'],
    ['4_TienUng        — Tiền ứng (1 dòng = 1 khoản ứng)'],
    ['5_ThietBi        — Thiết bị thi công (1 dòng = 1 thiết bị)'],
    ['6_DanhMuc        — Danh mục toàn bộ (Công Trình, Loại Chi Phí, Nhà CC, Người TH, ...)'],
    ['7_HopDongChinh  — Hợp đồng chính theo công trình'],
    ['8_ThuTien        — Lịch sử thu tiền'],
    ['9_HopDongThauPhu — Hợp đồng thầu phụ'], [''],
    ['━━━ QUY TẮC IMPORT LẠI ━━━'],
    ['• Không xóa hoặc đổi tên dòng header (hàng đầu tiên của mỗi sheet)'],
    ['• Ngày theo định dạng yyyy-mm-dd (ví dụ: 2025-03-15)'],
    ['• Số tiền nhập dạng số nguyên, không có dấu chấm/phẩy/ký hiệu (ví dụ: 1500000)'],
    ['• Sheet 4_TienUng: cột ĐỐI TƯỢNG = "Thầu phụ" hoặc "Nhà cung cấp"'],
    ['• Sheet 6_DanhMuc: cột LOẠI DANH MỤC phải khớp chính xác tên nhóm'],
    ['• Sheet 6_DanhMuc: cột EXTRA dùng cho VAI TRÒ của Công Nhân (C=Chính, T=Thợ, P=Phụ)'],
    ['• Sheet 3_ChamCong: VAI TRÒ = C (chính), T (thợ), P (phụ) — để trống nếu không có'],
    ['• Có thể thêm dòng mới, chỉnh sửa dữ liệu, sau đó import lại file qua nút Nhập Excel'],
  ];
  return _buildSheet(hdrs, rows);
}

// ── exportExcel: tổng hợp 10 sheets ─────────────────────────
export function exportExcel() {
  document.getElementById('export-modal-overlay').style.display = 'none';
  const XLSX = window.XLSX;
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildHoaDonNhanh(),    '1_HoaDonNhanh');
  XLSX.utils.book_append_sheet(wb, buildHoaDonChiTiet(),  '2_HoaDonChiTiet');
  XLSX.utils.book_append_sheet(wb, buildChamCong(),       '3_ChamCong');
  XLSX.utils.book_append_sheet(wb, buildTienUng(),        '4_TienUng');
  XLSX.utils.book_append_sheet(wb, buildThietBi(),        '5_ThietBi');
  XLSX.utils.book_append_sheet(wb, buildDanhMuc(),        '6_DanhMuc');
  XLSX.utils.book_append_sheet(wb, buildHopDongChinh(),   '7_HopDongChinh');
  XLSX.utils.book_append_sheet(wb, buildThuTien(),        '8_ThuTien');
  XLSX.utils.book_append_sheet(wb, buildHopDongThauPhu(), '9_HopDongThauPhu');
  XLSX.utils.book_append_sheet(wb, buildHuongDan(),       '10_HuongDan');
  XLSX.writeFile(wb, 'export_full_data.xlsx');
  const inv    = window.invoices         || [];
  const ung    = window.ungRecords       || [];
  const cc     = window.ccData           || [];
  const thu    = window.thuRecords       || [];
  const tp     = window.thauPhuContracts || [];
  const invCount  = inv.filter(i => !i.deletedAt && !i.ccKey && i.source !== 'detail' && !(Array.isArray(i.items) && i.items.length)).length;
  const invDCount = inv.filter(i => !i.deletedAt && !i.ccKey && (i.source === 'detail' || (Array.isArray(i.items) && i.items.length))).length;
  const ungCount  = ung.filter(u => !u.deletedAt && u.loai !== 'congnhan').length;
  const cnCount   = cc.filter(w  => !w.deletedAt).reduce((s,w) => s + (w.workers||[]).length, 0);
  const thuCount  = thu.filter(r => !r.deletedAt).length;
  const tpCount   = tp.filter(r  => !r.deletedAt).length;
  if (window.toast) window.toast(`✅ Đã xuất ${invCount} HĐ nhanh · ${invDCount} HĐ chi tiết · ${ungCount} ứng · ${cnCount} CN · ${thuCount} thu · ${tpCount} HĐTP → export_full_data.xlsx`, 'success');
}

export function _doExport() { exportExcel(); }

// ══════════════════════════════════════════════════════════════
// [13] CSV EXPORTS
// ══════════════════════════════════════════════════════════════

export function exportEntryCSV() {
  const rows = [['Loại Chi Phí','Công Trình','Người TH','Nhà Cung Cấp','Nội Dung','Số Tiền']];
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai = tr.querySelector('[data-f="loai"]')?.value || '';
    const ct   = tr.querySelector('[data-f="ct"]')?.value   || '';
    if (!loai && !ct) return;
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0', 10) || 0;
    rows.push([loai, ct, tr.querySelector('[data-f="nguoi"]')?.value||'', tr.querySelector('[data-f="ncc"]')?.value||'', tr.querySelector('[data-f="nd"]')?.value||'', tien]);
  });
  const _today = (typeof window.today === 'function') ? window.today() : new Date().toISOString().slice(0,10);
  if (typeof window.dlCSV === 'function') window.dlCSV(rows, 'nhap_' + _today + '.csv');
}

export function exportAllCSV() {
  const _today = (typeof window.today === 'function') ? window.today() : new Date().toISOString().slice(0,10);
  const _resolveName = window.resolveProjectName;
  const src = (typeof window.filteredInvs !== 'undefined') ? window.filteredInvs
    : (typeof window.getInvoicesCached === 'function') ? window.getInvoicesCached().filter(i => !i.deletedAt) : [];
  const rows = [['Ngày','Công Trình','Loại Chi Phí','Người TH','Nhà Cung Cấp','Nội Dung','Số Tiền']];
  src.filter(i => !i.deletedAt).forEach(i =>
    rows.push([i.ngay, _resolveName ? _resolveName(i) : (i.congtrinh||''), i.loai, i.nguoi||'', i.ncc||'', i.nd||'', i.thanhtien||i.tien||0])
  );
  if (typeof window.dlCSV === 'function') window.dlCSV(rows, 'thong_ke_cphd_' + _today + '.csv');
}

// ══════════════════════════════════════════════════════════════
// [14] PUBLIC WRAPPERS — Excel tools
// ══════════════════════════════════════════════════════════════

export function toolImportExcel() { document.getElementById('import-file-input').click(); }
export function toolExportExcel() { openExportModal(); }

// ── Init — registers all window bridges ──────────────────────
export function initExcelService() {
  window.openImportModal          = openImportModal;
  window.handleImportFile         = handleImportFile;
  window.openExportModal          = openExportModal;
  window.exportExcel              = exportExcel;
  window._doExport                = _doExport;
  window.exportEntryCSV           = exportEntryCSV;
  window.exportAllCSV             = exportAllCSV;
  window.toolImportExcel          = toolImportExcel;
  window.toolExportExcel          = toolExportExcel;
  window._toggleAllImportSheets   = _toggleAllImportSheets;
  window._applyImport             = _applyImport;
  window._generateImportLog       = _generateImportLog;
  window._showImportPreviewNew    = _showImportPreviewNew;
  window._doImportParse           = _doImportParse;
  window._detectSheetType         = _detectSheetType;
  // Sheet builders (for external access)
  window.buildHoaDonNhanh    = buildHoaDonNhanh;
  window.buildHoaDonChiTiet  = buildHoaDonChiTiet;
  window.buildChamCong       = buildChamCong;
  window.buildTienUng        = buildTienUng;
  window.buildThietBi        = buildThietBi;
  window.buildDanhMuc        = buildDanhMuc;
  window.buildHopDongChinh   = buildHopDongChinh;
  window.buildThuTien        = buildThuTien;
  window.buildHopDongThauPhu = buildHopDongThauPhu;
  window.buildHuongDan       = buildHuongDan;
  // Parser helpers (for nhapxuat.js thin bridge compatibility)
  window._normStr            = _normStr;
  window._parseDate          = _parseDate;
  window._pNum               = _pNum;
  window._buildSheet         = _buildSheet;
  window._mkErr              = _mkErr;
  window._fmtErr             = _fmtErr;
}

// Auto-init (side-effect import)
initExcelService();

window._excelSvc = {
  initExcelService, openImportModal, handleImportFile,
  openExportModal, exportExcel, _doExport, exportEntryCSV, exportAllCSV,
  toolImportExcel, toolExportExcel, _toggleAllImportSheets, _applyImport,
};

console.log('[excel.svc.js] ES Module loaded ✅ — full import/export active');
