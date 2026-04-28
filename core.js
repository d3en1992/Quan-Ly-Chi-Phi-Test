// lib.js — Storage / Firebase / Backup / Migration
// Load order: 1 (load TRUOC TAT CA file khac)


// ══════════════════════════════
//  DATA
// ══════════════════════════════
const DEFAULTS = {
  congTrinh: ["CÔNG TY - NHÀ","SC CT CÔ NHUNG - 191 THÀNH CÔNG, Q TÂN PHÚ","CT BỬU AN - 85/5 LÊ LAI, P12, Q TÂN BÌNH","CT A DŨNG - SUỐI CÁT, ĐỒNG NAI","CT BÁC CHỮ - 23/51A NGUYỄN HỮU TIẾN, Q TÂN PHÚ","CT BÁC ĐỆ - MỸ HẠNH NAM, ĐỨC HÒA, LONG AN","SC QUẬN 9","SC MINH CHÍNH - Q GÒ VẤP","SC CT LONG HẢI - VŨNG TÀU"],
  loaiChiPhi: ["Nhân Công","Thầu Phụ","Vật Liệu XD","Sắt Thép","Vật Tư Điện Nước","Đổ Bê Tông","Copha - VTP - Máy","Hóa Đơn Lẻ","Quyết Toán - Phát Sinh","Thiết Kế / Xin Phép","Chi Phí Khác"],
  nhaCungCap: ["Công ty VLXD Minh Phát","Cửa Hàng Sắt Thép Hùng","Điện Nước Phú Thịnh","Hóa Đơn Điện Lực"],
  nguoiTH: ["A Long","A Toán","A Dũng","Duy Sáng","HD Lẻ","Tình"],
  tbTen: ['Máy cắt cầm tay','Máy cắt bàn','Máy uốn sắt lớn','Bàn uốn sắt',
          'Thước nhôm','Chân Dàn 1.7m','Chân Dàn 1.5m',
          'Chéo lớn','Chéo nhỏ','Kít tăng giàn giáo','Cây chống tăng']
};

const CATS = [
  { id:'congTrinh',  title:'🏗️ Công Trình',           sk:'cat_ct',     refField:'congtrinh' },
  { id:'loaiChiPhi', title:'📂 Loại Chi Phí',          sk:'cat_loai',   refField:'loai' },
  { id:'nhaCungCap', title:'🏪 Nhà Cung Cấp',          sk:'cat_ncc',    refField:'ncc' },
  { id:'nguoiTH',    title:'👷 Người Thực Hiện',       sk:'cat_nguoi',  refField:'nguoi' },
  { id:'thauPhu',    title:'🤝 Thầu Phụ / TP',         sk:'cat_tp',     refField:'tp' },
  { id:'congNhan',   title:'🪖 Công Nhân',              sk:'cat_cn',     refField:null },
  { id:'tbTen',      title:'🛠 Máy / Thiết Bị Thi Công', sk:'cat_tbteb', refField:null }
];

// ══════════════════════════════════════════════════════════
//  JSONBIN.IO SYNC — lưu trữ đám mây, đồng bộ đa thiết bị
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// FIREBASE FIRESTORE CLOUD SYNC
// REST API — không cần backend, không cần cài gì thêm
// ══════════════════════════════════════════════════════════

// ── Cấu hình Firebase (điền vào sau khi tạo project) ──────
const FB_CONFIG = {
  apiKey:    '',           // Web API Key từ Project Settings
  projectId: '',           // Project ID từ Project Settings
};
const FS_BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${FB_CONFIG.projectId}/databases/(default)/documents/cpct_data`;

// ── Keys localStorage ──────────────────────────────────────
const FB_CFG_KEY   = 'fb_config';    // lưu apiKey + projectId
const FB_CACHE_KEY = 'fb_bins_cache';// cache map năm → docId

// ── Load config từ localStorage ───────────────────────────
(function() {
  const saved = _loadLS(FB_CFG_KEY);
  if (saved) { FB_CONFIG.apiKey = saved.apiKey||''; FB_CONFIG.projectId = saved.projectId||''; }
})();

function _loadLS(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}
function _saveLS(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ══════════════════════════════════════════════════════════════
// [MODULE: INDEXEDDB — Dexie offline-first layer]
// ══════════════════════════════════════════════════════════════

const db = new Dexie('qlct');
db.version(1).stores({
  invoices:   'id, updatedAt',
  attendance: 'id, updatedAt',
  equipment:  'id, updatedAt',
  ung:        'id, updatedAt',
  revenue:    'id, updatedAt',
  categories: 'id'
});
db.version(2).stores({
  settings: 'id'  // key-value store: projects, hopdong, thauphu, trash, cat_*, etc.
});

// Mapping: storage key → IDB table config
// Tất cả data nghiệp vụ đều nằm trong IDB — localStorage CHỈ cho config/device identity
const DB_KEY_MAP = {
  // ── Array tables (cloud-synced) ──────────────────────────────
  'inv_v3':       { table: 'invoices',   isArr: true  },
  'cc_v2':        { table: 'attendance', isArr: true  },
  'tb_v1':        { table: 'equipment',  isArr: true  },
  'ung_v1':       { table: 'ung',        isArr: true  },
  'thu_v1':       { table: 'revenue',    isArr: true  },
  // ── Category objects (categories table) ──────────────────────
  'cat_ct':       { table: 'categories', isArr: false, rowId: 'congTrinh'  },
  'cat_loai':     { table: 'categories', isArr: false, rowId: 'loaiChiPhi' },
  'cat_ncc':      { table: 'categories', isArr: false, rowId: 'nhaCungCap' },
  'cat_nguoi':    { table: 'categories', isArr: false, rowId: 'nguoiTH'    },
  'cat_tp':       { table: 'categories', isArr: false, rowId: 'thauPhu'    },
  'cat_cn':       { table: 'categories', isArr: false, rowId: 'congNhan'   },
  'cat_tbteb':    { table: 'categories', isArr: false, rowId: 'tbTen'      },
  // ── Settings objects (settings table) ────────────────────────
  'projects_v1':  { table: 'settings',   isArr: false, rowId: 'projects'    },
  'hopdong_v1':   { table: 'settings',   isArr: false, rowId: 'hopdong'     },
  'thauphu_v1':   { table: 'settings',   isArr: false, rowId: 'thauphu'     },
  'trash_v1':     { table: 'settings',   isArr: false, rowId: 'trash'       },
  'users_v1':     { table: 'settings',   isArr: false, rowId: 'users'       },
  'cat_ct_years': { table: 'settings',   isArr: false, rowId: 'cat_ct_years'},
  'cat_cn_roles': { table: 'settings',   isArr: false, rowId: 'cat_cn_roles'},
  'cat_items_v1': { table: 'settings',   isArr: false, rowId: 'catItems'     },
};

// ── In-memory runtime cache — nguồn đọc duy nhất sau khi dbInit() chạy xong ──
const _mem = {};

// Internal write: cập nhật _mem + IDB — KHÔNG trigger cloud sync
function _memSet(k, v) {
  _mem[k] = v;
  _dbSave(k, v).catch(e => console.warn('[IDB] _memSet lỗi:', k, e));
}

// Dedup array by id — keep record with highest updatedAt per id.
// Used after import and after sync to prevent phantom duplicates.
function dedupById(arr) {
  if (!Array.isArray(arr) || !arr.length) return arr || [];
  const map = new Map();
  arr.forEach(r => {
    const k = String(r.id ?? '');
    if (!k) return;
    const ex = map.get(k);
    if (!ex || (r.updatedAt || 0) >= (ex.updatedAt || 0)) map.set(k, r);
  });
  return [...map.values()];
}

// Merge two arrays by id, keeping the record with the latest updatedAt
function mergeUnique(oldArr, newArr) {
  const map = new Map();
  (oldArr || []).forEach(r => map.set(r.id, r));
  (newArr || []).forEach(r => {
    const existing = map.get(r.id);
    if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) {
      map.set(r.id, r);
    }
  });
  return [...map.values()];
}

// Write one localStorage key to IndexedDB (background, no throw).
// IMPORTANT: also deletes IDB records that are no longer in the array —
// this is what propagates delete operations to IndexedDB.
async function _dbSave(k, v) {
  const cfg = DB_KEY_MAP[k];
  if (!cfg) return;
  const now = Date.now();
  if (cfg.isArr) {
    const records = (Array.isArray(v) ? v : []).map(r => {
      if (!r.id) r.id = crypto.randomUUID();
      if (!r.updatedAt) r.updatedAt = now;
      return r;
    });
    const newIdSet = new Set(records.map(r => r.id));
    // Find IDB records that were removed from the array and delete them
    const existing = await db[cfg.table].toArray();
    const toDelete = existing.filter(r => !newIdSet.has(r.id)).map(r => r.id);
    if (toDelete.length) await db[cfg.table].bulkDelete(toDelete);
    if (records.length) await db[cfg.table].bulkPut(records);
  } else {
    await db[cfg.table].put({ id: cfg.rowId, data: v, updatedAt: now });
  }
}

// Async preflight: đọc toàn bộ data từ IDB vào _mem.
// IDB là nguồn sự thật duy nhất — không đọc/ghi localStorage cho data nghiệp vụ.
async function dbInit() {
  try {
    for (const [key, cfg] of Object.entries(DB_KEY_MAP)) {
      if (cfg.isArr) {
        _mem[key] = await db[cfg.table].toArray();
      } else {
        const rec = await db[cfg.table].get(cfg.rowId);
        _mem[key] = rec ? rec.data : null;
      }
    }
    console.log('[IDB] dbInit hoàn tất — IDB-primary mode');
  } catch(e) {
    console.warn('[IDB] dbInit lỗi:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// [MODULE: STORAGE v2] — DATA_VERSION · Migration · Backup · JSON IO
// Tìm nhanh: Ctrl+F → "MODULE: STORAGE"
// ══════════════════════════════════════════════════════════════

// ── Phiên bản schema hiện tại ─────────────────────────────────
// Tăng DATA_VERSION khi thay đổi cấu trúc data (thêm field bắt buộc,
// đổi tên key, v.v.). migrateData() sẽ tự nâng cấp data cũ lên mới.
const DATA_VERSION = 4;
const DATA_VERSION_KEY = 'app_data_version';

// ── Migration: nâng cấp data cũ lên version hiện tại ─────────
// Thêm case mới khi nâng DATA_VERSION lên
function migrateData() {
  const stored = parseInt(_loadLS(DATA_VERSION_KEY) || '0');
  if (stored >= DATA_VERSION) return; // Đã cập nhật, bỏ qua

  console.log('[Migration] Từ v' + stored + ' → v' + DATA_VERSION);

  // v0 → v1: inv không có field sl → set mặc định sl=1
  if (stored < 1) {
    const invs = _loadLS('inv_v3') || [];
    let changed = 0;
    invs.forEach(inv => {
      if (inv.sl === undefined || inv.sl === null) { inv.sl = 1; changed++; }
      if (inv.thanhtien === undefined) { inv.thanhtien = (inv.tien || 0) * (inv.sl || 1); changed++; }
    });
    if (changed) _saveLS('inv_v3', invs);
    console.log('[Migration v1] Chuẩn hoá sl/thanhtien:', changed, 'HĐ');
  }

  // v1 → v2: cc_v2 workers không có field phucap/hdmuale → set 0
  if (stored < 2) {
    const ccs = _loadLS('cc_v2') || [];
    let changed = 0;
    ccs.forEach(week => {
      (week.workers || []).forEach(wk => {
        if (wk.phucap === undefined) { wk.phucap = 0; changed++; }
        if (wk.hdmuale === undefined) { wk.hdmuale = 0; changed++; }
      });
    });
    if (changed) _saveLS('cc_v2', ccs);
    console.log('[Migration v2] Chuẩn hoá CC workers:', changed, 'worker');
  }

  // v2 → v3: đảm bảo mọi invoice có _ts (timestamp tạo)
  if (stored < 3) {
    const invs = _loadLS('inv_v3') || [];
    let changed = 0;
    invs.forEach(inv => {
      if (!inv._ts) { inv._ts = inv.id || Date.now(); changed++; }
    });
    if (changed) _saveLS('inv_v3', invs);
    console.log('[Migration v3] Thêm _ts cho', changed, 'HĐ');
  }

  // v3 → v4: hopdong_v1 key migration — handled in _migrateHopDongKeys()
  // (runs in _reloadGlobals after projects_v1 is loaded, not here)

  _saveLS(DATA_VERSION_KEY, DATA_VERSION);
  console.log('[Migration] Hoàn tất → v' + DATA_VERSION);
}

// ══════════════════════════════════════════════════════════════
// [MODULE: HOPDONG KEY MIGRATION] — tên CT → projectId
// ══════════════════════════════════════════════════════════════

/**
 * Chuyển hopdong_v1 key từ tên công trình (string) sang projectId (UUID).
 * - Chạy trong _reloadGlobals() SAU KHI projects_v1 đã load.
 * - Key đã là UUID → giữ nguyên.
 * - Key là tên CT → tìm project, chuyển sang project.id.
 * - Key không match project nào → giữ nguyên (fallback an toàn, không xóa data).
 * - Idempotent: chạy nhiều lần không gây trùng / mất data.
 */
function _migrateHopDongKeys() {
  if (typeof hopDongData === 'undefined' || !hopDongData) return;
  const projs = (typeof projects !== 'undefined') ? projects : load('projects_v1', []);
  if (!projs || !projs.length) return;

  // Build lookup: name → id (chỉ project chưa xóa)
  const nameToId = new Map();
  projs.forEach(p => { if (p.id && p.name && !p.deletedAt) nameToId.set(p.name, p.id); });
  if (!nameToId.size) return;

  let changed = false;
  const migrated = {};

  for (const [key, hd] of Object.entries(hopDongData)) {
    // Nếu key đã là UUID (36 ký tự, 5 phần ngăn gạch) → giữ nguyên
    if (key.length === 36 && key.split('-').length === 5) {
      migrated[key] = hd;
      continue;
    }
    // Key là tên CT → tìm projectId
    const pid = nameToId.get(key);
    if (pid) {
      // Nếu đích (pid) đã có record khác → merge: giữ bản updatedAt mới hơn
      if (migrated[pid]) {
        const existTs = migrated[pid].updatedAt || 0;
        const newTs   = hd.updatedAt || 0;
        if (newTs > existTs) migrated[pid] = { ...hd, projectId: pid };
      } else {
        migrated[pid] = { ...hd, projectId: pid };
      }
      changed = true;
    } else {
      // Không tìm thấy project → giữ key cũ (fallback, KHÔNG xóa data)
      migrated[key] = hd;
    }
  }

  if (changed) {
    hopDongData = migrated;
    _memSet('hopdong_v1', hopDongData); // ghi _mem + IDB, KHÔNG trigger sync
    console.log('[Migration v4] hopdong_v1: chuyển key tên CT → projectId');
  }
}

/**
 * Tra cứu hợp đồng backward-compat: tìm theo projectId trước, fallback tên CT.
 * Dùng ở mọi nơi cần đọc hopDongData[key] mà không biết key là UUID hay tên.
 * @param {string} projectIdOrName - projectId (UUID) hoặc tên CT
 * @returns {Object|null} hopDong entry hoặc null
 */
function _hdLookup(projectIdOrName) {
  if (!projectIdOrName || typeof hopDongData === 'undefined' || !hopDongData) return null;
  // 1. Tìm trực tiếp theo key
  const direct = hopDongData[projectIdOrName];
  if (direct && !direct.deletedAt) return direct;
  // 2. Nếu key là tên CT → tìm projectId → lookup
  const projs = (typeof projects !== 'undefined') ? projects : [];
  const p = projs.find(proj => proj.name === projectIdOrName && !proj.deletedAt);
  if (p && hopDongData[p.id] && !hopDongData[p.id].deletedAt) return hopDongData[p.id];
  // 3. Nếu key là projectId → tìm tên CT → lookup (trường hợp chưa migrate)
  const p2 = projs.find(proj => proj.id === projectIdOrName && !proj.deletedAt);
  if (p2 && hopDongData[p2.name] && !hopDongData[p2.name].deletedAt) return hopDongData[p2.name];
  return null;
}

/**
 * Trả về key chính xác trong hopDongData cho một project.
 * Ưu tiên projectId, fallback tên CT.
 * @param {Object} project - project object (cần .id và .name)
 * @returns {string|null} key tồn tại trong hopDongData hoặc null
 */
function _hdKeyOf(project) {
  if (!project || typeof hopDongData === 'undefined') return null;
  if (project.id && hopDongData[project.id]) return project.id;
  if (project.name && hopDongData[project.name]) return project.name;
  return null;
}

// ══════════════════════════════════════════════════════════════
// [GLOBAL HELPERS] — project lookup wrappers (safe pre-projects.js)
// ══════════════════════════════════════════════════════════════
// [ADDED]
function _getProjectById(id) {
  return typeof getProjectById === 'function' ? getProjectById(id) : null;
}
// [ADDED]
function _getProjectNameById(id) {
  if (!id) return '';
  if (id === 'COMPANY') return 'CÔNG TY';
  const p = _getProjectById(id);
  return p ? p.name : '';
}
// [ADDED]
function _getProjectIdByName(name) {
  return typeof findProjectIdByName === 'function' ? findProjectIdByName(name) : null;
}
// [ADDED] — resolve display name from ANY record that may have projectId and/or ct/congtrinh
function _resolveCtName(record) {
  if (!record) return '';
  if (record.projectId) {
    const n = _getProjectNameById(record.projectId);
    if (n) return n;
  }
  return record.ct || record.congtrinh || '';
}

// ══════════════════════════════════════════════════════════════
// [MODULE: BACKUP v2] — store-envelope format
// Để thêm data mới vào backup: chỉ cần thêm key vào BACKUP_KEYS.
// Import/restore code không cần sửa thêm bao giờ.
// ══════════════════════════════════════════════════════════════

// ── Danh sách keys được backup — nguồn sự thật duy nhất ──────
// Thêm key mới vào đây là đủ, không cần sửa bất kỳ nơi nào khác
const BACKUP_KEYS = [
  // ── IDB-backed (sync cloud) ──────────────────────────────
  'inv_v3',    // Hóa đơn / chi phí
  'ung_v1',    // Tiền ứng
  'cc_v2',     // Chấm công
  'tb_v1',     // Thiết bị
  'thu_v1',    // Thu tiền
  'cat_ct',    // Danh mục: Công trình
  'cat_loai',  // Danh mục: Loại chi phí
  'cat_ncc',   // Danh mục: Nhà cung cấp
  'cat_nguoi', // Danh mục: Người thực hiện
  'cat_tp',    // Danh mục: Thầu phụ
  'cat_cn',    // Danh mục: Công nhân
  'projects_v1',  // Dự án / công trình
  // ── LS-only (không sync cloud) ──────────────────────────
  'hopdong_v1',   // Hợp đồng chính
  'thauphu_v1',   // Hợp đồng thầu phụ
  'cat_tbteb',    // Danh mục: Tên thiết bị
  'cat_ct_years', // Năm theo công trình
  'cat_cn_roles', // Vai trò công nhân
  'cat_items_v1', // Danh mục per-item (soft-delete, cross-device sync)
];

const BACKUP_KEY  = 'backup_auto';
const BACKUP_MINS = 30;
let   _backupTimer = null;

// ── Backward-compat: chuyển file cũ {inv,ung,...} → store ────
function _legacySnapToStore(b) {
  const s = {};
  if (b.inv)  s['inv_v3']  = b.inv;
  if (b.ung)  s['ung_v1']  = b.ung;
  if (b.cc)   s['cc_v2']   = b.cc;
  if (b.tb)   s['tb_v1']   = b.tb;
  if (b.thu)  s['thu_v1']  = b.thu;
  if (b.cats) {
    if (b.cats.ct)    s['cat_ct']    = b.cats.ct;
    if (b.cats.loai)  s['cat_loai']  = b.cats.loai;
    if (b.cats.ncc)   s['cat_ncc']   = b.cats.ncc;
    if (b.cats.nguoi) s['cat_nguoi'] = b.cats.nguoi;
    if (b.cats.tp)    s['cat_tp']    = b.cats.tp;
    if (b.cats.cn)    s['cat_cn']    = b.cats.cn;
  }
  return s;
}

// ── Đếm số lượng record trong store để hiển thị ──────────────
function _countStore(store) {
  return {
    inv:   (store['inv_v3']     || []).length,
    ung:   (store['ung_v1']     || []).length,
    cc:    (store['cc_v2']      || []).length,
    tb:    (store['tb_v1']      || []).length,
    thu:   (store['thu_v1']     || []).length,
    hdong: Object.keys(store['hopdong_v1']  || {}).length,
    thphu: (store['thauphu_v1'] || []).length,
  };
}

// ── Ghi store vào _mem + IDB/LS, đảm bảo record array có id ──
function _restoreStore(store) {
  const now = Date.now();
  Object.entries(store).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      v = v.map(r => (r && typeof r === 'object' && !r.id)
        ? { ...r, id: crypto.randomUUID(), updatedAt: r.updatedAt || now }
        : r);
    }
    _memSet(k, v);
  });
}

// ── Xóa toàn bộ cache runtime — gọi sau mỗi lần data thay đổi ─
// Thêm cache mới vào đây khi cần (không sửa nơi khác)
function clearAllCache() {
  if (typeof clearInvoiceCache === 'function') clearInvoiceCache();
  // Thêm cache khác tại đây khi cần
}

// ── Selector đơn nhất cho UI — đọc từ _mem (single source of truth) ──────
// Dùng thay cho truy cập trực tiếp globals trong render functions.
function getState(key, def) {
  return load(key, def !== undefined ? def : []);
}

// ── Hàm thống nhất sau mọi thay đổi data lớn (pull/import/delete/restore) ─
// Thứ tự bắt buộc: reload globals → clear cache → render
// Không gọi sau mỗi save() thông thường (save đã clear cache riêng).
function afterDataChange() {
  if (typeof _reloadGlobals === 'function') _reloadGlobals();
  // _reloadGlobals() đã gọi clearAllCache() → clearInvoiceCache()
  if (typeof renderActiveTab === 'function') renderActiveTab();
}

// ── Reload tất cả global vars sau restore ─────────────────────
function _reloadGlobals() {
  invoices   = load('inv_v3', []);
  ungRecords = load('ung_v1', []);
  // cc_v2: fill projectId + dedup theo logical key (fromDate+projectId)
  // Luôn persist kết quả — _fillCCProjectId có thể đã thêm projectId mới vào records
  {
    const raw = load('cc_v2', []);
    if (typeof _dedupCC === 'function') {
      const deduped = _dedupCC(raw); // gọi normalizeCC nếu sync.js đã load (có fill+safeTs)
      ccData = deduped;
      _memSet('cc_v2', deduped);     // không tăng pending — đây là normalization, không phải user action
    } else {
      ccData = raw;
    }
  }
  tbData     = load('tb_v1',  []);
  cats.congTrinh      = load('cat_ct',       DEFAULTS.congTrinh);
  cats.congTrinhYears = load('cat_ct_years', {});
  cats.loaiChiPhi     = load('cat_loai',     DEFAULTS.loaiChiPhi);
  cats.nhaCungCap     = load('cat_ncc',      DEFAULTS.nhaCungCap);
  cats.nguoiTH        = load('cat_nguoi',    DEFAULTS.nguoiTH);
  cats.thauPhu        = load('cat_tp',       []);
  cats.congNhan       = load('cat_cn',       []);
  cats.tbTen          = load('cat_tbteb',    DEFAULTS.tbTen);
  // Module doanhtu.js (load sau core.js)
  if (typeof hopDongData      !== 'undefined') hopDongData      = load('hopdong_v1', {});
  if (typeof thuRecords       !== 'undefined') thuRecords       = load('thu_v1',     []);
  if (typeof thauPhuContracts !== 'undefined') thauPhuContracts = load('thauphu_v1', []);
  // Migration hopdong_v1: chuyển key tên CT → projectId (chạy sau khi projects đã load)
  _migrateHopDongKeys();
  // Module chamcong.js — cnRoles
  if (typeof cnRoles !== 'undefined') cnRoles = load('cat_cn_roles', {});
  // Module projects.js
  if (typeof projects !== 'undefined') projects = load('projects_v1', []);
  // Migration one-time: tạo cat_items_v1 từ string arrays nếu chưa có
  _migrateCatItemsIfNeeded();
  // Rebuild string arrays từ items (áp dụng soft-delete từ cloud sau pull)
  _rebuildCatArrsFromItems();
  // Xóa toàn bộ cache runtime — bắt buộc để render thấy data mới sau pull
  clearAllCache();
  // Rebuild cats.congTrinh từ projects — derived data, không tăng pending counter
  if (typeof rebuildCatCTFromProjects === 'function') rebuildCatCTFromProjects();
  // Đảm bảo mọi tên công nhân trong ccData đều có trong danh mục — quan trọng sau import
  if (typeof rebuildCCCategories === 'function') rebuildCCCategories();
}

// ── IDB Backup Helpers — lưu backup vào IndexedDB thay vì localStorage ──
const _BACKUP_MAX = 5; // Giữ tối đa 5 bản backup gần nhất

async function _getBackupStore() {
  let list = [];
  try {
    const rec = await db.settings.get(BACKUP_KEY);
    if (rec && Array.isArray(rec.data)) list = rec.data;
  } catch(e) { console.warn('[Backup] IDB read lỗi:', e); }
  if (!list.length) {
    const lsList = _loadLS(BACKUP_KEY);
    if (lsList && lsList.length) {
      list = lsList;
      await _setBackupStore(list);
      console.log('[Backup] Migrated', list.length, 'bản backup: LS → IDB');
    }
  }
  return list;
}

async function _setBackupStore(list) {
  try {
    await db.settings.put({ id: BACKUP_KEY, data: list, updatedAt: Date.now() });
  } catch(e) {
    console.warn('[Backup] IDB write lỗi, fallback LS:', e);
    try { _saveLS(BACKUP_KEY, list); } catch(_) {}
  }
}

async function _snapshotNow(label) {
  try {
    const store = {};
    for (const k of BACKUP_KEYS) {
      const v = load(k, null);
      if (v !== null) store[k] = v;
    }
    const snap = {
      app: 'cpct', ver: DATA_VERSION,
      _time: new Date().toISOString(), _label: label || 'auto', store,
    };
    const list = await _getBackupStore();
    list.unshift(snap);
    await _setBackupStore(list.slice(0, _BACKUP_MAX));
    return snap;
  } catch(e) { console.warn('[Backup] Lỗi:', e); return null; }
}

function autoBackup() {
  if (_backupTimer) clearInterval(_backupTimer);
  setTimeout(() => {
    _snapshotNow('auto');
    _backupTimer = setInterval(() => {
      _snapshotNow('auto');
      console.log('[Backup] Auto snapshot lúc', new Date().toLocaleTimeString('vi-VN'));
    }, BACKUP_MINS * 60 * 1000);
  }, 60 * 1000);
}

async function getBackupList() {
  const list = await _getBackupStore();
  return list.map((b, i) => {
    const store  = b.store || _legacySnapToStore(b);
    const counts = _countStore(store);
    return { index: i, label: b._label || 'auto', time: b._time || '', ver: b.ver || b._ver || 0, counts };
  });
}

async function restoreFromBackup(index) {
  const list = await _getBackupStore();
  const b    = list[index];
  if (!b) { toast('❌ Không tìm thấy bản backup này', 'error'); return; }
  const store = b.store || _legacySnapToStore(b);
  const c     = _countStore(store);
  const time  = b._time ? new Date(b._time).toLocaleString('vi-VN') : '(không rõ)';
  const ok    = confirm(
    'Khôi phục bản backup: ' + time + '\n' +
    c.inv + ' HĐ · ' + c.ung + ' tiền ứng · ' + c.cc + ' tuần CC\n\n' +
    '⚠️ Data hiện tại sẽ bị thay thế. Tiếp tục?'
  );
  if (!ok) return;
  await _snapshotNow('before-restore');
  _restoreStore(store);
  migrateData();
  _reloadGlobals();
  buildYearSelect(); _refreshAllTabs();
  rebuildEntrySelects(); rebuildUngSelects();
  renderSettings(); updateTop();
  toast('✅ Đã khôi phục bản backup lúc ' + time + '. Bấm 🔄 Sync để đồng bộ lên cloud.', 'success');
}

async function renderBackupList() {
  const wrap = document.getElementById('backup-list-wrap');
  if (!wrap) return;
  const badge = document.getElementById('data-version-badge');
  if (badge) badge.textContent = 'v' + DATA_VERSION;
  const statusLabel = document.getElementById('backup-status-label');
  const list = await _getBackupStore();
  if (!list.length) {
    wrap.innerHTML = '<div style="color:var(--ink3);font-size:13px;padding:8px 0">Chưa có bản sao lưu nào. App sẽ tự động tạo sau 1 phút.</div>';
    if (statusLabel) statusLabel.textContent = '';
    return;
  }
  if (statusLabel && list[0]?._time) {
    statusLabel.textContent = 'Backup gần nhất: ' + new Date(list[0]._time).toLocaleString('vi-VN');
  }
  const rows = list.map((b, i) => {
    const store  = b.store || _legacySnapToStore(b);
    const c      = _countStore(store);
    const time   = b._time ? new Date(b._time).toLocaleString('vi-VN') : '(không rõ)';
    const label  = b._label === 'auto' ? '🔄 Tự động' : b._label === 'manual' ? '📸 Thủ công' :
                   b._label === 'manual-export' ? '📤 Trước khi xuất' :
                   b._label === 'before-json-import' ? '🛡 Trước khi nhập JSON' :
                   b._label === 'before-restore' ? '🛡 Trước khi khôi phục' : b._label;
    const counts = c.inv + ' HĐ · ' + c.ung + ' tiền ứng · ' + c.cc + ' tuần CC · ' + c.tb + ' TB';
    const isNewest = i === 0;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
              background:${isNewest ? 'var(--paper)' : 'transparent'};
              border-radius:8px;border:1px solid ${isNewest ? 'var(--line2)' : 'transparent'};
              margin-bottom:6px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${label}</div>
        <div style="font-size:11px;color:var(--ink3);margin-top:2px">${time} &nbsp;·&nbsp; ${counts}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="restoreFromBackup(${i})" title="Khôi phục bản này">
        ↩ Khôi phục
      </button>
    </div>`;
  }).join('');
  wrap.innerHTML = rows;
}

// ── Export toàn bộ data ra file JSON (snapshot từ _mem) ──────
function exportJSON() {
  const snap = {
    meta: { version: DATA_VERSION, exportedAt: Date.now() },
    data: { ..._mem },
  };
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');
  a.href     = url;
  a.download = 'cpct_snapshot_' + ts + '.json';
  a.click();
  URL.revokeObjectURL(url);
  const c = _countStore(snap.data);
  toast('✅ Đã xuất snapshot (' + c.inv + ' HĐ, ' + c.ung + ' tiền ứng, ' + c.cc + ' tuần CC)', 'success');
}

// ── Import JSON — hard reset toàn hệ thống ───────────────────
function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const json = JSON.parse(e.target.result);
      if (!json || typeof json !== 'object') {
        toast('❌ File JSON không hợp lệ', 'error'); return;
      }
      // Hỗ trợ format mới {meta, data} và format cũ {store, ...}
      const data = json.data || json.store || null;
      if (!data || !Object.keys(data).length) {
        toast('❌ File JSON không hợp lệ hoặc không phải snapshot của app này', 'error'); return;
      }
      const c    = _countStore(data);
      const ts   = json.meta?.exportedAt
        ? new Date(json.meta.exportedAt).toLocaleString('vi-VN')
        : (json._time ? new Date(json._time).toLocaleString('vi-VN') : '(không rõ)');

      // Modal xác nhận thay vì confirm() để UX tốt hơn
      _showImportJSONConfirm({ data, c, ts });
    } catch(err) {
      toast('❌ Lỗi đọc file JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ── Hiển thị modal xác nhận import JSON ───────────────────────
function _showImportJSONConfirm({ data, c, ts }) {
  let ov = document.getElementById('import-json-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'import-json-overlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;align-items:center;justify-content:center';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:420px;width:94vw;background:#fff;border-radius:14px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 16px 56px rgba(0,0,0,.25)">
    <div style="font-size:28px;text-align:center;margin-bottom:10px">⚠️</div>
    <h3 style="font-size:16px;font-weight:800;margin:0 0 12px;text-align:center;color:#c0392b">KHÔI PHỤC TOÀN BỘ DỮ LIỆU</h3>
    <div style="background:#fff3cd;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.8;margin-bottom:16px">
      📅 Snapshot lúc: <b>${ts}</b><br>
      📊 Nội dung: ${c.inv} HĐ · ${c.ung} tiền ứng · ${c.cc} tuần CC · ${c.tb} thiết bị
    </div>
    <div style="background:#f8d7da;border-radius:8px;padding:12px 14px;font-size:13px;color:#721c24;line-height:1.8;margin-bottom:20px">
      • Xóa toàn bộ dữ liệu hiện tại<br>
      • Ghi đè tất cả thiết bị<br>
      • Không thể hoàn tác
    </div>
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('import-json-overlay').style.display='none'" style="flex:1;padding:11px;border-radius:8px;border:1.5px solid #ccc;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Hủy</button>
      <button onclick="importJSONFull(window._pendingImportData)" style="flex:2;padding:11px;border-radius:8px;border:none;background:#c0392b;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">Khôi phục</button>
    </div>
  </div>`;
  window._pendingImportData = data;
  ov.style.display = 'flex';
}

// ── Hard reset: xóa DB, ghi clean data, push cloud, reload ──
async function importJSONFull(data) {
  const ov = document.getElementById('import-json-overlay');
  if (ov) ov.style.display = 'none';

  if (!data || !Object.keys(data).length) { toast('❌ Dữ liệu không hợp lệ', 'error'); return; }

  // Block any concurrent sync
  try { _syncPulling = true; } catch(_) {}
  try { _syncPushing = true; } catch(_) {}

  try {
    if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang khôi phục snapshot...');

    // Step 1: Clear ALL local data (IDB + _mem)
    await Promise.all(db.tables.map(t => t.clear()));
    Object.keys(_mem).forEach(k => delete _mem[k]);

    // Step 2: Sanitize — ensure every record has id + updatedAt, then dedup
    const now = Date.now();
    const clean = {};
    for (const key of Object.keys(data)) {
      let val = data[key];
      if (Array.isArray(val)) {
        // Fill missing id / updatedAt — preserve original values
        val = val.map(r => ({
          ...r,
          id:        r.id        || crypto.randomUUID(),
          updatedAt: r.updatedAt || now,
        }));
        // Remove duplicate ids — keep record with highest updatedAt
        val = dedupById(val);
        // cc_v2: also dedup by business key (fromDate+ct) — prevents week duplicates
        if (key === 'cc_v2' && typeof _dedupCC === 'function') val = _dedupCC(val);
      }
      clean[key] = val;
    }

    // Step 3: Write to _mem + IDB — await ALL writes before any further action
    const writes = [];
    for (const [key, val] of Object.entries(clean)) {
      _mem[key] = val;
      writes.push(_dbSave(key, val));
    }
    await Promise.all(writes);

    // Step 4: Block pull for 2 h after reload — prevent cloud from overwriting fresh import
    localStorage.setItem('_blockPullUntil', String(Date.now() + 2 * 60 * 60 * 1000));

    // Step 5: Push to cloud — skip inner pull so we overwrite cloud cleanly
    if (typeof fbReady === 'function' && fbReady()) {
      try {
        _syncPulling = false;
        _syncPushing = false;
        await pushChanges({ silent: true, skipPull: true });
      } catch(e) {
        console.warn('[Import] Push cloud lỗi (sẽ sync lại sau reload):', e);
      }
    }

    // Step 6: Reload — dbInit reads fresh IDB, _reloadGlobals rebuilds everything
    location.reload();

  } catch(e) {
    console.error('[Import] Lỗi:', e);
    toast('❌ Lỗi khôi phục: ' + (e.message || String(e)), 'error');
    try { _syncPulling = false; } catch(_) {}
    try { _syncPushing = false; } catch(_) {}
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
  }
}


function fbReady() { return FB_CONFIG.apiKey && FB_CONFIG.projectId; }

// ══ NÉN / GIẢI NÉN ═══════════════════════════════════════
// inv: id→i ngay→d congtrinh→c loai→l nguoi→n ncc→s nd→t tien→p thanhtien→q sl→k ccKey→x source→so
//      updatedAt→m createdAt→ca deletedAt→da deviceId→dv projectId→pi
// cc:  id→i fromDate→f toDate→e ct→c updatedAt→a createdAt→ca deletedAt→da deviceId→dv projectId→pi
// ung: id→i updatedAt→a ngay→d tp→t congtrinh→c tien→p nd→n loai→k
//      createdAt→ca deletedAt→da deviceId→dv projectId→pi
// tb:  id→i ct→c ten→t soluong→s tinhtrang→r nguoi→n ghichu→g ngay→d
//      updatedAt→m createdAt→ca deletedAt→da deviceId→dv projectId→pi
function compressInv(arr) {
  return arr.map(o=>{const r={};
    if(o.id!==undefined)r.i=o.id; if(o.ngay)r.d=o.ngay; if(o.congtrinh)r.c=o.congtrinh;
    if(o.projectId)r.pi=o.projectId;
    if(o.source)r.so=o.source;
    if(o.loai)r.l=o.loai; if(o.nguoi)r.n=o.nguoi; if(o.ncc)r.s=o.ncc; if(o.nd)r.t=o.nd;
    if(o.tien)r.p=o.tien; if(o.thanhtien&&o.thanhtien!==o.tien)r.q=o.thanhtien;
    if(o.sl&&o.sl!==1)r.k=o.sl; if(o.ccKey)r.x=o.ccKey;
    if(o.items&&o.items.length)r.it=o.items;
    if(o.footerCkStr)r.fck=o.footerCkStr;
    // Metadata: dùng updatedAt, fallback sang _ts cho record cũ
    r.m=(o.updatedAt||o._ts)||undefined;
    if(o.createdAt)r.ca=o.createdAt; if(o.deletedAt)r.da=o.deletedAt;
    if(o.deviceId)r.dv=o.deviceId; return r;});
}
function expandInv(arr) {
  return (arr||[]).map(o=>({id:o.i,ngay:o.d,congtrinh:o.c,projectId:o.pi||null,loai:o.l,nguoi:o.n||'',ncc:o.s||'',
    nd:o.t||'',tien:o.p||0,thanhtien:o.q||(o.p||0),sl:o.k||undefined,ccKey:o.x||undefined,
    source:o.so||undefined,
    items:o.it||undefined,footerCkStr:o.fck||undefined,
    updatedAt:o.m||undefined,_ts:o.m||undefined,
    createdAt:o.ca||undefined,deletedAt:o.da||null,deviceId:o.dv||undefined}));
}
function compressCC(arr) {
  return (arr||[]).map(w=>({i:w.id,f:w.fromDate,e:w.toDate,c:w.ct,
    ...(w.projectId?{pi:w.projectId}:{}),
    a:w.updatedAt,ca:w.createdAt,da:w.deletedAt,dv:w.deviceId,
    w:w.workers.map(wk=>{const r={n:wk.name,d:wk.d,l:wk.luong};
      if(wk.phucap)r.p=wk.phucap; if(wk.hdmuale)r.h=wk.hdmuale; if(wk.nd)r.t=wk.nd;
      if(wk.tru)r.u=wk.tru; if(wk.loanAmount)r.lo=wk.loanAmount; return r;})}));
}
function expandCC(arr) {
  return (arr||[]).map(w=>({id:w.i,fromDate:w.f,toDate:w.e,ct:w.c,projectId:w.pi||null,updatedAt:w.a,
    createdAt:w.ca||undefined,deletedAt:w.da||null,deviceId:w.dv||undefined,
    workers:(w.w||[]).map(wk=>({name:wk.n,d:wk.d,luong:wk.l||0,phucap:wk.p||0,hdmuale:wk.h||0,nd:wk.t||'',tru:wk.u||0,loanAmount:wk.lo||0}))}));
}
function compressUng(arr) {
  return (arr||[]).map(o=>{const r={i:o.id,a:o.updatedAt,d:o.ngay,t:o.tp||o.ncc||'',c:o.congtrinh,p:o.tien||0,n:o.nd||''};
    if(o.projectId)r.pi=o.projectId;
    if(o.loai&&o.loai!=='thauphu')r.k=o.loai;
    if(o.createdAt)r.ca=o.createdAt; if(o.deletedAt)r.da=o.deletedAt;
    if(o.deviceId)r.dv=o.deviceId; return r;});
}
function expandUng(arr) {
  return (arr||[]).map(o=>({id:o.i,updatedAt:o.a,ngay:o.d,tp:o.t,loai:o.k||'thauphu',congtrinh:o.c,projectId:o.pi||null,tien:o.p||0,nd:o.n||'',
    createdAt:o.ca||undefined,deletedAt:o.da||(o.cl?(o.a||Date.now()):null)||null,deviceId:o.dv||undefined}));
}
function compressTb(arr) {
  return (arr||[]).map(o=>({i:o.id,c:o.ct,t:o.ten,s:o.soluong||0,r:o.tinhtrang,n:o.nguoi||'',g:o.ghichu||'',d:o.ngay||'',
    ...(o.projectId?{pi:o.projectId}:{}),
    m:o.updatedAt,ca:o.createdAt,da:o.deletedAt,dv:o.deviceId}));
}
function expandTb(arr) {
  return (arr||[]).map(o=>({id:o.i,ct:o.c,ten:o.t,soluong:o.s||0,tinhtrang:o.r||'Đang hoạt động',nguoi:o.n||'',ghichu:o.g||'',ngay:o.d||'',
    projectId:o.pi||null,
    updatedAt:o.m||undefined,createdAt:o.ca||undefined,deletedAt:o.da||null,deviceId:o.dv||undefined}));
}

function load(k, def) {
  // Đọc từ _mem (đã được dbInit() populate từ IDB).
  // Trả về def nếu key chưa có (trước dbInit hoặc chưa lưu lần nào).
  const v = _mem[k];
  return (v !== undefined && v !== null) ? v : def;
}
// Keys khi thay đổi sẽ làm invoice cache (buildInvoices) stale
const _INV_CACHE_KEYS = new Set(['inv_v3','cc_v2','projects_v1','hopdong_v1','thauphu_v1','cat_items_v1']);

function save(k, v) {
  _mem[k] = v;
  // Chỉ ghi local (IDB). Sync lên cloud ngầm qua schedulePush() debounce 30s.
  _dbSave(k, v).catch(e => console.warn('[IDB] save lỗi:', k, e));
  // Xóa invoice cache ngay sau mỗi mutation liên quan — list + edit luôn dùng data mới nhất
  if (_INV_CACHE_KEYS.has(k) && typeof clearInvoiceCache === 'function') clearInvoiceCache();
  // Cập nhật badge pending + lên lịch push ngầm
  if (_SYNC_DATA_KEYS.has(k)) {
    _incPending();
    if (typeof schedulePush === 'function') schedulePush();
  }
}

// ══ RECORD FACTORY — chuẩn hóa đường ghi ══════════════════
// Dùng trong tất cả module khi tạo/cập nhật record nghiệp vụ.
// Đảm bảo id, createdAt, updatedAt, deletedAt, deviceId luôn đúng chuẩn.

/**
 * Tạo record mới với metadata đầy đủ.
 * @param {Object} fields  Các field nghiệp vụ (ngay, congtrinh, projectId, ...)
 * @returns {Object}       Record hoàn chỉnh sẵn sàng push vào mảng và save()
 */
function mkRecord(fields) {
  const now = Date.now();
  const devId = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
  return {
    id:        crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId:  devId,
    ...fields,
  };
}

/**
 * Tạo bản cập nhật record hiện có — bảo toàn id + createdAt, ghi mới updatedAt + deviceId.
 * @param {Object} existing  Record gốc
 * @param {Object} changes   Các field cần thay đổi
 * @returns {Object}         Record đã cập nhật
 */
function mkUpdate(existing, changes) {
  const devId = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
  return {
    ...existing,
    ...changes,
    id:        existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    deviceId:  devId,
  };
}

// Tạo nội dung (nd) từ items[] — dedup tên, dùng chung toàn app
function buildNDFromItems(items) {
  if (!items || !items.length) return '';
  const seen = new Set();
  const unique = [];
  items.forEach(it => {
    const t = (it.ten || '').trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(t); }
  });
  return unique.join(', ');
}

// softDeleteRecord() định nghĩa trong sync.js (load sau core.js)

// ══ AUTOCOMPLETE DÙNG CHUNG ════════════════════════════════
/** Chuẩn hóa chuỗi tiếng Việt: bỏ dấu + lowercase (dùng để so sánh contains). */
function _normViStr(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

let _acCurrentInput = null;
/** Ẩn dropdown autocomplete đang mở. */
function _acHide() {
  const dd = document.getElementById('_global-ac');
  if (dd) dd.style.display = 'none';
  _acCurrentInput = null;
}
/**
 * Hiện dropdown autocomplete gần inp, lọc theo contains không dấu.
 * @param {HTMLInputElement} inp - input đang focus
 * @param {string[]} options - danh sách gợi ý
 * @param {function} onSelect - callback(value) khi chọn
 */
function _acShow(inp, options, onSelect) {
  let dd = document.getElementById('_global-ac');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = '_global-ac';
    dd.style.cssText = [
      'position:fixed;z-index:9999',
      'background:var(--paper,#fff)',
      'border:1.5px solid var(--line2,#d1cfc9)',
      'border-radius:8px',
      'box-shadow:0 4px 16px rgba(0,0,0,.14)',
      'max-height:220px;overflow-y:auto;display:none'
    ].join(';');
    document.body.appendChild(dd);
    // Đóng dropdown khi click ra ngoài (dùng capture để bắt trước focus)
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#_global-ac')) _acHide();
    }, true);
  }
  const q = _normViStr(inp.value);
  const filtered = options.filter(o => _normViStr(o).includes(q)).slice(0, 40);
  if (!filtered.length) { _acHide(); return; }
  dd.innerHTML = filtered.map(o =>
    `<div class="_ac-item" style="padding:6px 12px;cursor:pointer;font-size:13px;white-space:nowrap;border-bottom:1px solid var(--line,#e8e6e0)">${x(o)}</div>`
  ).join('');
  dd.querySelectorAll('._ac-item').forEach((el, i) => {
    el.addEventListener('mousedown', e => { e.preventDefault(); onSelect(filtered[i]); _acHide(); });
  });
  const r = inp.getBoundingClientRect();
  dd.style.left = r.left + 'px';
  dd.style.top  = (r.bottom + 2) + 'px';
  dd.style.minWidth = Math.max(180, r.width) + 'px';
  dd.style.display = 'block';
  _acCurrentInput = inp;
}

// ══ FIRESTORE DOCUMENT FORMAT ═════════════════════════════
// Firestore lưu dạng {fields: {key: {stringValue/integerValue/...}}}
// Ta dùng 1 field "data" chứa toàn bộ JSON nén dạng stringValue

function fsWrap(obj) {
  // Wrap object thành Firestore document format
  return { fields: { data: { stringValue: JSON.stringify(obj) } } };
}
function fsUnwrap(doc) {
  // Unwrap Firestore document về plain object
  if (!doc || !doc.fields || !doc.fields.data) return null;
  try { return JSON.parse(doc.fields.data.stringValue); } catch { return null; }
}

// ── Doc ID helpers ─────────────────────────────────────────
function fbDocYear(yr)  { return `y${yr}`; }
function fbDocCats()    { return 'cats'; }

// ── Build payload cho từng loại ───────────────────────────
function fbYearPayload(yr) {
  const y = yr || activeYear || new Date().getFullYear();
  const ys = String(y);
  return { v:3, yr:y,
    i: compressInv(load('inv_v3',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    u: compressUng(load('ung_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    c: compressCC(load('cc_v2',[]).filter(x=>x.fromDate&&x.fromDate.startsWith(ys))),
    t: compressTb(load('tb_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    thu: load('thu_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys)) };
}
function fbCatsPayload() {
  // cat_ct là derived data — rebuild từ projects_v1 — không push lên cloud
  return { v:3,
    cats:{loai:load('cat_loai',DEFAULTS.loaiChiPhi),
      ncc:load('cat_ncc',DEFAULTS.nhaCungCap),nguoi:load('cat_nguoi',DEFAULTS.nguoiTH)},
    users: load('users_v1', []),
    // catItems: per-item tracking với isDeleted/updatedAt — source of truth cho danh mục
    catItems: load('cat_items_v1', {}),
    cnRoles:  load('cat_cn_roles', {}),  // vai trò công nhân { name: 'C'|'T'|'P' }
    ctYears:  load('cat_ct_years', {}),  // năm theo công trình { ctName: year }
    hopDong:  load('hopdong_v1',  {}),  // hợp đồng xuyên suốt, không theo năm
    thauPhu:  load('thauphu_v1',  []),  // HĐ thầu phụ xuyên suốt, không theo năm
    projects: load('projects_v1', []),  // danh sách dự án — source of truth cho công trình
  };
}

// ── Firebase REST helpers ──────────────────────────────────
function fsUrl(docId) {
  return `${FS_BASE()}/${docId}?key=${FB_CONFIG.apiKey}`;
}
function fsGet(docId) {
  return fetch(fsUrl(docId)).then(r=>r.json());
}
function fsSet(docId, payload) {
  // PATCH = upsert (tạo hoặc cập nhật)
  return fetch(`${FS_BASE()}/${docId}?key=${FB_CONFIG.apiKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fsWrap(payload))
  }).then(r=>r.json());
}

// ── Estimate size ──────────────────────────────────────────
function estimateYearKb(yr) {
  const ys = String(yr || activeYear || new Date().getFullYear());
  const data = {
    i: compressInv(load('inv_v3',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    u: compressUng(load('ung_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    c: compressCC(load('cc_v2',[]).filter(x=>x.fromDate&&x.fromDate.startsWith(ys))),
  };
  return Math.round(JSON.stringify(data).length/1024*10)/10;
}

// ══ PUSH LÊN CLOUD ════════════════════════════════════════
// Key lưu thời điểm sync thành công cuối cùng (ms timestamp)
const LAST_SYNC_KEY = 'lastSyncAt';

// fbPushAll / gsLoadAll — thin wrappers, toàn bộ logic nằm trong sync.js
// Không gọi Firebase trực tiếp ở đây nữa.

// fbPushAll — đã vô hiệu hoá (sync theo batch qua manualSync)
// Giữ stub để không break code cũ gọi fbPushAll()
function fbPushAll() {
  console.log('[fbPushAll] No-op — dùng manualSync() để sync thủ công');
}

function jbPushAll() { /* no-op */ }

function gsLoadAll(callback) {
  if (typeof pullChanges === 'function') {
    const yr = activeYear || new Date().getFullYear();
    pullChanges(yr, d => callback(d ? d : null));
    return;
  }
  console.warn('[gsLoadAll] sync.js chưa load — pull bị bỏ qua');
  if (callback) callback(null);
}

// ══ CẬP NHẬT NÚT CLOUD ════════════════════════════════════
function updateJbBtn() {
  const btn = document.getElementById('jb-btn');
  if (!btn) return;
  if (fbReady()) {
    btn.textContent = '✅ Cloud';
    btn.style.background = 'rgba(26,122,69,0.4)';
    btn.style.borderColor = 'rgba(26,200,100,0.5)';
    _ensureSyncDot();
  } else {
    btn.textContent = '☁️ Cloud';
    btn.style.background = 'rgba(255,255,255,0.12)';
    btn.style.borderColor = 'rgba(255,255,255,0.25)';
    const dot = document.getElementById('sync-dot');
    if (dot) dot.className = 'hidden';
  }
}

// VI: Sync status dot
function _ensureSyncDot() {
  const btn = document.getElementById('jb-btn');
  if (!btn || document.getElementById('sync-dot')) return;
  const dot = document.createElement('span');
  dot.id = 'sync-dot';
  btn.style.position = 'relative';
  btn.appendChild(dot);
}
function _setSyncDot(status) {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  dot.className = status || '';
}

// ══ MODAL CẤU HÌNH ════════════════════════════════════════
function openBinModal() { renderBinModal(); }
function closeBinModal() {
  const ov = document.getElementById('bin-modal-overlay');
  if(ov) ov.style.display='none';
}

function renderBinModal() {
  const yr = activeYear || new Date().getFullYear();
  const ov = document.getElementById('bin-modal-overlay') || _createModalOverlay();
  const isConnected = fbReady();
  const yearKb = isConnected ? estimateYearKb(yr) : 0;

  const statusColor = yearKb < 200 ? '#1a7a45' : yearKb < 500 ? '#e67e00' : '#c0392b';
  const statusBg    = yearKb < 200 ? '#d4edda'  : yearKb < 500 ? '#fff3cd' : '#f8d7da';
  const statusLabel = yearKb < 200 ? '✅ OK'    : yearKb < 500 ? '⚠️ Khá lớn' : '🔴 Lớn';

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:460px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.18)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:17px;font-weight:800;margin:0">🔥 Kết Nối Firebase</h3>
      <button onclick="closeBinModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1">✕</button>
    </div>

    ${isConnected ? `
    <div style="background:#f0fff4;border:1px solid #b2dfdb;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#1a7a45;margin-bottom:4px">✅ ĐÃ KẾT NỐI</div>
      <div style="font-size:11px;color:#555">Project: <strong>${FB_CONFIG.projectId}</strong></div>
      <div style="font-size:11px;color:#888;margin-top:2px">API Key: ${FB_CONFIG.apiKey.substring(0,8)}••••••••</div>
    </div>
    <div style="background:#f5f4f0;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px">
      📊 Dữ liệu năm ${yr}: <strong style="color:${statusColor}">${yearKb}kb</strong>
      <span style="margin-left:6px;background:${statusBg};color:${statusColor};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700">${statusLabel}</span>
      <div style="font-size:10px;color:#aaa;margin-top:2px">Firebase free: 1GB storage · 50K reads/ngày · 20K writes/ngày</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button onclick="manualSync();closeBinModal();" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #1565c0;background:transparent;color:#1565c0;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">🔄 Sync</button>
      <button onclick="fbDisconnect()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #c0392b;background:transparent;color:#c0392b;font-family:inherit;font-size:13px;cursor:pointer">⛔ Ngắt</button>
    </div>
    ` : `
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#856404">
      Nhập <strong>Project ID</strong> và <strong>Web API Key</strong> từ Firebase Console để kết nối.
    </div>
    `}

    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:700;color:#555;display:block;margin-bottom:4px">PROJECT ID</label>
      <input id="fb-proj-input" type="text" value="${FB_CONFIG.projectId}"
        placeholder="your-project-id"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none">
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:700;color:#555;display:block;margin-bottom:4px">WEB API KEY</label>
      <input id="fb-key-input" type="text" value="${FB_CONFIG.apiKey}"
        placeholder="AIzaSy..."
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none">
    </div>
    <button onclick="fbSaveConfig()" style="width:100%;padding:12px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">
      💾 ${isConnected ? 'Cập Nhật Kết Nối' : 'Kết Nối Firebase'}
    </button>
    <div style="font-size:11px;color:#aaa;text-align:center;line-height:1.6">
      Firebase free tier: 1GB · Không giới hạn size/file · Google hỗ trợ lâu dài
    </div>
  </div>`;
  ov.style.display = 'flex';
}

function _createModalOverlay() {
  let ov = document.getElementById('bin-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bin-modal-overlay';
    ov.onclick = function(e) { if(e.target===this) closeBinModal(); };
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
    document.body.appendChild(ov);
  }
  return ov;
}

function fbSaveConfig() {
  const proj = (document.getElementById('fb-proj-input')?.value||'').trim();
  const key  = (document.getElementById('fb-key-input')?.value||'').trim();
  if (!proj || !key) { toast('Vui lòng nhập đủ Project ID và API Key!', 'error'); return; }
  FB_CONFIG.projectId = proj;
  FB_CONFIG.apiKey    = key;
  _saveLS(FB_CFG_KEY, { projectId: proj, apiKey: key });
  closeBinModal();
  toast('✅ Đã lưu cấu hình Firebase! Đang tải dữ liệu...', 'success');
  updateJbBtn();
  reloadFromCloud();
}

function fbDisconnect() {
  if (!confirm('Ngắt kết nối Firebase? Dữ liệu local vẫn còn.')) return;
  FB_CONFIG.projectId = '';
  FB_CONFIG.apiKey    = '';
  localStorage.removeItem(FB_CFG_KEY);
  closeBinModal();
  updateJbBtn();
  toast('Đã ngắt kết nối Firebase');
}

// Alias các hàm cũ để không break code khác
function jbSaveId()     { fbSaveConfig(); }
function jbDisconnect() { fbDisconnect(); }
function copyBinId()    { navigator.clipboard.writeText(FB_CONFIG.projectId).then(()=>toast('✅ Đã copy Project ID')).catch(()=>{}); }
function linkBinId()    { fbSaveConfig(); }
function resetBin()     { fbDisconnect(); }
function createNewBin() { openBinModal(); }

function reloadFromCloud() {
  showSyncBanner('⏳ Đang tải dữ liệu...');
  gsLoadAll(function(data) {
    if (!data) { hideSyncBanner(); toast('⚠️ Không tải được dữ liệu từ cloud', 'error'); return; }
    invoices   = load('inv_v3', []);
    ungRecords = load('ung_v1', []);
    ccData     = load('cc_v2', []);
    tbData     = load('tb_v1', []);
    if (typeof projects !== 'undefined') projects = load('projects_v1', []);
    cats.congTrinh      = load('cat_ct',       DEFAULTS.congTrinh);
    cats.congTrinhYears = load('cat_ct_years', {});
    cats.loaiChiPhi     = load('cat_loai',     DEFAULTS.loaiChiPhi);
    cats.nhaCungCap     = load('cat_ncc',      DEFAULTS.nhaCungCap);
    cats.nguoiTH        = load('cat_nguoi',    DEFAULTS.nguoiTH);
    cats.tbTen          = load('cat_tbteb',    DEFAULTS.tbTen);
    // Rebuild cats.congTrinh từ projects — đảm bảo single source of truth
    if (typeof rebuildCatCTFromProjects === 'function') rebuildCatCTFromProjects();
    buildYearSelect();
    rebuildEntrySelects(); rebuildUngSelects();
    buildFilters(); filterAndRender(); renderTrash();
    renderCCHistory(); renderCCTLT();
    buildUngFilters(); filterAndRenderUng();
    renderCtPage(); updateTop(); renderSettings();
    toast('✅ Đã tải dữ liệu từ Firebase!', 'success');
  });
}

function syncNow() {
  closeBinModal();
  reloadFromCloud();
}

function buildYearSelect() {
  const years = new Set();
  years.add(new Date().getFullYear());
  invoices.forEach(i=>{ if(i.ngay) years.add(parseInt(i.ngay.slice(0,4))); });
  ungRecords.forEach(u=>{ if(u.ngay) years.add(parseInt(u.ngay.slice(0,4))); });
  ccData.forEach(w=>{ if(w.fromDate) years.add(parseInt(w.fromDate.slice(0,4))); });
  _renderYearSelect(years);

  // Nếu Firebase ready → fetch danh sách doc để biết có năm nào
  if(fbReady()) {
    fetch(`${FS_BASE()}?key=${FB_CONFIG.apiKey}&pageSize=20`)
      .then(r=>r.json()).then(data=>{
        if(data.documents) {
          data.documents.forEach(doc=>{
            const seg = doc.name.split('/').pop();
            if(seg && seg.startsWith('y')) {
              const yr = parseInt(seg.slice(1));
              if(!isNaN(yr) && yr > 2000 && yr < 2100) years.add(yr);
            }
          });
          _renderYearSelect(years);
        }
      }).catch(()=>{});
  }
}

function _renderYearSelect(years) {
  const list = document.getElementById('year-list');
  if (!list) return;
  const sorted = [...years].sort((a,b)=>b-a);
  const ay = typeof activeYears !== 'undefined' ? activeYears : new Set();
  list.innerHTML = sorted.map(y =>
    `<label class="year-item">
      <input type="checkbox" value="${y}" ${ay.has(y)?'checked':''}
             onclick="event.stopPropagation();onYearToggle(${y})">
      <span>${y}</span>
    </label>`
  ).join('');
  _updateYearBtn();
}

// Cập nhật text trên nút toggle
function _updateYearBtn() {
  const btn = document.getElementById('year-select-btn');
  if (!btn) return;
  const ay = typeof activeYears !== 'undefined' ? activeYears : new Set();
  if (ay.size === 0) btn.textContent = 'Tất cả';
  else btn.textContent = [...ay].sort((a,b)=>a-b).join(', ');
}

function saveCats(catId) {
  const cfg = CATS.find(c=>c.id===catId);
  if (cfg) {
    save(cfg.sk, cats[catId]); // ghi _mem + IDB + trigger sync
    if (catId === 'congTrinh') {
      save('cat_ct_years', cats.congTrinhYears || {});
    }
    // Đồng bộ sang cat_items_v1 để track soft-delete per-item
    _syncCatItems(catId, cats[catId]);
  }
  // Realtime: refresh tất cả dropdowns nhập liệu
  if (typeof refreshEntryDropdowns === 'function') refreshEntryDropdowns();
}

// ══════════════════════════════════════════════════════════════════
// [MODULE: CAT ITEMS v1] — per-item tracking, soft-delete, cross-device sync
// Mục đích: thay thế string-array override bằng merge per-item có updatedAt
// Backward compat: cats.loaiChiPhi v.v. vẫn là string[] cho toàn bộ UI
// ══════════════════════════════════════════════════════════════════

// Helper: chuẩn hóa key để so sánh trùng trong cat_items_v1
// (bỏ dấu TV, lowercase, trim khoảng trắng thừa)
function _catNormKey(s) {
  return (s || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Dọn dẹp duplicate trong cat_items_v1 (gọi lúc startup & sau pull)
// Giữ bản có updatedAt cao nhất, mark bản còn lại isDeleted=true
function _dedupCatItemsNow() {
  const allItems = load('cat_items_v1', {});
  if (!allItems || !Object.keys(allItems).length) return false;
  let changed = false;
  const now = Date.now();
  Object.keys(allItems).forEach(type => {
    const byNorm = new Map(); // normKey → item (winner)
    (allItems[type] || []).forEach(item => {
      if (item.isDeleted) return;
      const norm = _catNormKey(item.name);
      if (!byNorm.has(norm)) { byNorm.set(norm, item); return; }
      // Duplicate: giữ bản mới hơn, delete bản cũ hơn
      const winner = byNorm.get(norm);
      if ((item.updatedAt || 0) > (winner.updatedAt || 0)) {
        winner.isDeleted = true; winner.updatedAt = now;
        byNorm.set(norm, item);
      } else {
        item.isDeleted = true; item.updatedAt = now;
      }
      changed = true;
    });
  });
  if (changed) {
    _memSet('cat_items_v1', allItems);
    console.log('[Cats] _dedupCatItemsNow: cleaned up duplicate items');
  }
  return changed;
}

// Mapping: catId (dùng trong code) → type key trong cat_items_v1
const _CATITEM_TYPE_MAP = {
  loaiChiPhi: 'loai',
  nhaCungCap: 'ncc',
  nguoiTH:    'nguoi',
  thauPhu:    'tp',
  congNhan:   'cn',
  tbTen:      'tbteb',
  // congTrinh không có ở đây — được quản lý bởi projects_v1
};

/**
 * Đồng bộ string array → cat_items_v1 sau mỗi lần user thay đổi danh mục.
 * Tự detect thêm mới (add) và xóa (isDeleted=true).
 * Gọi từ saveCats() — không tăng pending (saveCats đã tăng qua save(cfg.sk)).
 */
function _syncCatItems(catId, nameArr) {
  const type = _CATITEM_TYPE_MAP[catId];
  if (!type) return; // congTrinh → bỏ qua
  const allItems = load('cat_items_v1', {});
  const typeItems = (allItems[type] || []).slice();
  const now = Date.now();

  // Dedup nameArr trước (phòng khi array đã bị rác từ trước)
  const seenNorm = new Set();
  const dedupedNames = (nameArr || []).filter(Boolean).filter(name => {
    const k = _catNormKey(name);
    return seenNorm.has(k) ? false : (seenNorm.add(k), true);
  });
  // Dùng normalized key để so sánh — tránh tạo UUID mới khi chỉ khác case/dấu
  const nameSetNorm = new Set(dedupedNames.map(_catNormKey));

  // Soft-delete: item active nhưng không còn trong nameArr (normalized)
  typeItems.forEach(item => {
    const norm = _catNormKey(item.name);
    if (!item.isDeleted && !nameSetNorm.has(norm)) {
      item.isDeleted = true;
      item.updatedAt = now;
    }
    // Khôi phục nếu tên xuất hiện lại
    if (item.isDeleted && nameSetNorm.has(norm)) {
      item.isDeleted = false;
      item.updatedAt = now;
    }
  });

  // Thêm mới: tên chưa có trong items (normalized) — tránh tạo UUID trùng
  const existingNorm = new Set(typeItems.map(i => _catNormKey(i.name)));
  dedupedNames.forEach(name => {
    const k = _catNormKey(name);
    if (!existingNorm.has(k)) {
      typeItems.push({ id: crypto.randomUUID(), name, isDeleted: false, updatedAt: now });
      existingNorm.add(k); // tránh thêm 2 lần trong cùng 1 loop
    }
  });

  allItems[type] = typeItems;
  _memSet('cat_items_v1', allItems);
}

/**
 * Rebuild string arrays từ cat_items_v1 (filter !isDeleted).
 * Gọi sau pull (để áp dụng soft-delete từ cloud) và sau _reloadGlobals().
 */
function _rebuildCatArrsFromItems() {
  // Dọn rác duplicate trước khi rebuild (fix dữ liệu xấu đã tồn tại)
  _dedupCatItemsNow();
  const allItems = load('cat_items_v1', {});
  if (!allItems || !Object.keys(allItems).length) return;
  // Dedup output: phòng trường hợp cat_items_v1 vẫn còn rác sau dedup
  const nameArr = (items) => {
    const seen = new Set();
    return (items || []).filter(i => !i.isDeleted).map(i => i.name)
      .filter(name => { const k = _catNormKey(name); return seen.has(k) ? false : (seen.add(k), true); });
  };
  if (allItems.loai)  { cats.loaiChiPhi = nameArr(allItems.loai);  _memSet('cat_loai',  cats.loaiChiPhi); }
  if (allItems.ncc)   { cats.nhaCungCap = nameArr(allItems.ncc);   _memSet('cat_ncc',   cats.nhaCungCap); }
  if (allItems.nguoi) { cats.nguoiTH    = nameArr(allItems.nguoi); _memSet('cat_nguoi', cats.nguoiTH); }
  if (allItems.tp)    { cats.thauPhu    = nameArr(allItems.tp);    _memSet('cat_tp',    cats.thauPhu); }
  if (allItems.cn)    { cats.congNhan   = nameArr(allItems.cn);    _memSet('cat_cn',    cats.congNhan); }
  if (allItems.tbteb) { cats.tbTen      = nameArr(allItems.tbteb); _memSet('cat_tbteb', cats.tbTen); }
}

/**
 * Migration một lần: tạo cat_items_v1 từ string arrays hiện có.
 * Idempotent — gọi bao nhiêu lần cũng an toàn.
 */
function _migrateCatItemsIfNeeded() {
  const existing = load('cat_items_v1', {});
  if (existing && Object.keys(existing).length) return; // đã migrate rồi
  const now = Date.now();
  const toItems = (arr) => (arr || []).map(name => ({
    id: crypto.randomUUID(), name, isDeleted: false, updatedAt: now
  }));
  const allItems = {
    loai:  toItems(cats.loaiChiPhi),
    ncc:   toItems(cats.nhaCungCap),
    nguoi: toItems(cats.nguoiTH),
    tp:    toItems(cats.thauPhu),
    cn:    toItems(cats.congNhan),
    tbteb: toItems(cats.tbTen),
  };
  _memSet('cat_items_v1', allItems); // ghi IDB, không tăng pending (reset ở startup)
  console.log('[Cats] Migrated string arrays → cat_items_v1');
}


// Debounce: chống spam banner (mỗi 3s tối đa 1 lần, trừ lỗi luôn hiện)
let lastSyncUI = 0;
function showSyncBanner(msg, autohideMs=0) {
  const isError = msg.startsWith('⚠️');
  if (!isError && Date.now() - lastSyncUI < 3000) return;
  if (!isError) lastSyncUI = Date.now();
  let b = document.getElementById('sync-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sync-banner';
    b.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:9999;background:#1a73e8;color:#fff;border-radius:20px;padding:6px 18px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none;transition:opacity .3s';
    document.body.appendChild(b);
  }
  b.textContent = msg; b.style.opacity='1'; b.style.display='block';
  if (autohideMs) setTimeout(hideSyncBanner, autohideMs);
}
function hideSyncBanner() {
  const b = document.getElementById('sync-banner');
  if (b) { b.style.opacity='0'; setTimeout(()=>b.style.display='none', 300); }
}

// Cập nhật trạng thái sync trên cả #jb-btn lẫn #sync-btn
// state: 'syncing' | 'success' | 'error' | ''
function _setSyncState(state) {
  // ── jb-btn (Cloud button) ────────────────────────────────────
  const jbBtn = document.getElementById('jb-btn');
  if (jbBtn) {
    if (state === 'syncing') {
      jbBtn.textContent = '⏳ Đang sync...';
    } else if (state === 'success') {
      const hhmm = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      jbBtn.textContent = `✅ Đã sync ${hhmm}`;
      setTimeout(() => { if (jbBtn.textContent.includes('Đã sync')) updateJbBtn(); }, 10000);
    } else if (state === 'error') {
      jbBtn.textContent = '⚠️ Sync lỗi';
      setTimeout(() => updateJbBtn(), 8000);
    }
  }
  // ── sync-btn (compact status badge) ─────────────────────────
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    if (state === 'syncing') {
      syncBtn.textContent = '⏳';
      syncBtn.title = 'Đang đồng bộ...';
      syncBtn.dataset.state = 'syncing';
    } else if (state === 'success') {
      // Badge sẽ tự cập nhật qua _resetPending() → _updateSyncBtnBadge()
      _updateSyncBtnBadge();
    } else if (state === 'error') {
      syncBtn.textContent = '⚠️';
      syncBtn.title = 'Sync lỗi — nhấn để thử lại';
      syncBtn.dataset.state = 'error';
      setTimeout(() => _updateSyncBtnBadge(), 8000);
    }
  }
}

// ══ PENDING CHANGES COUNTER ════════════════════════════════
// Đếm số lần save() thực sự thay đổi data kể từ lần push cuối.
// Hiện trên nút 🔄 Sync để user biết còn bao nhiêu thay đổi chưa cloud.

let _pendingChanges = 0;

// Timestamp cho đến khi pull bị chặn (set sau reset để tránh cloud hồi dữ liệu)
let _blockPullUntil = 0;

// Keys kích hoạt pending counter — gồm cả cat để xóa danh mục không bị sống lại sau pull
const _SYNC_DATA_KEYS = new Set([
  'inv_v3','cc_v2','ung_v1','tb_v1','thu_v1',
  'thauphu_v1','hopdong_v1','projects_v1','trash_v1','users_v1',
  // Cat string-array keys: pending guard tránh pull ghi đè danh mục đã xóa local
  'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
  // Roles & years: cần pending guard giống cat arrays
  'cat_cn_roles',  // vai trò công nhân — save() từ updateCNRole() và rebuildCCCategories()
  'cat_ct_years',  // năm theo công trình — save() từ saveCats('congTrinh')
]);

function _incPending() {
  _pendingChanges++;
  _updateSyncBtnBadge();
}

// Gọi sau push thành công, hoặc sau startup để reset bộ đếm
function _resetPending() {
  _pendingChanges = 0;
  _updateSyncBtnBadge();
}

function _updateSyncBtnBadge() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  if (_pendingChanges > 0) {
    btn.textContent = `☁️ ${_pendingChanges}`;
    btn.title = `${_pendingChanges} thay đổi chưa đồng bộ — nhấn để sync ngay`;
    btn.dataset.state = 'pending';
  } else {
    const lastTs = parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0');
    if (lastTs > 0) {
      const hhmm = new Date(lastTs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      btn.textContent = `✅ ${hhmm}`;
      btn.title = `Đã đồng bộ lúc ${hhmm} — nhấn để sync ngay`;
      btn.dataset.state = 'synced';
    } else {
      btn.textContent = '☁️';
      btn.title = 'Đồng bộ dữ liệu';
      btn.dataset.state = '';
    }
  }
}

let cats = {
  congTrinh:      load('cat_ct',       DEFAULTS.congTrinh),
  congTrinhYears: load('cat_ct_years', {}),  // { "tên CT": năm tạo }
  loaiChiPhi:     load('cat_loai',     DEFAULTS.loaiChiPhi),
  nhaCungCap:     load('cat_ncc',      DEFAULTS.nhaCungCap),
  nguoiTH:        load('cat_nguoi',    DEFAULTS.nguoiTH),
  thauPhu:        load('cat_tp',       []),
  congNhan:       load('cat_cn',       []),
  tbTen:          load('cat_tbteb',    DEFAULTS.tbTen)  // Danh mục tên máy/thiết bị
};
let cnRoles = load('cat_cn_roles', {}); // { "Tên CN": "C/T/P" }

let invoices = load('inv_v3', []);
let filteredInvs = [];
let curPage = 1;
const PG = 20;
