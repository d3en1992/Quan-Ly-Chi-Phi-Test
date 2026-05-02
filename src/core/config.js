// ══════════════════════════════════════════════════════════════
// src/core/config.js — Constants & Configuration
// Prompt 3 — ES Modules Refactor
// Nguồn: core.js (DEFAULTS, CATS, DB_KEY_MAP, FB_CONFIG, BACKUP_KEYS)
// ══════════════════════════════════════════════════════════════

/** Phiên bản schema data hiện tại */
export const DATA_VERSION = 4;
export const DATA_VERSION_KEY = 'app_data_version';

/** Tên database IndexedDB */
export const DB_NAME = 'qlct';

/** Thời gian auto-sync (ms) */
export const SYNC_INTERVAL = 30_000;

/** Thời gian auto-backup (phút) */
export const BACKUP_MINS = 30;

/** Số bản backup tối đa */
export const BACKUP_MAX = 5;

// ── Firebase config ─────────────────────────────────────────
export const FB_CONFIG = {
  apiKey: '',
  projectId: '',
};
export const FB_CFG_KEY = 'fb_config';
export const FB_CACHE_KEY = 'fb_bins_cache';

export function FS_BASE() {
  return `https://firestore.googleapis.com/v1/projects/${FB_CONFIG.projectId}/databases/(default)/documents/cpct_data`;
}

// ── Danh mục mặc định ───────────────────────────────────────
export const DEFAULTS = {
  congTrinh: ["CÔNG TY - NHÀ","SC CT CÔ NHUNG - 191 THÀNH CÔNG, Q TÂN PHÚ","CT BỬU AN - 85/5 LÊ LAI, P12, Q TÂN BÌNH","CT A DŨNG - SUỐI CÁT, ĐỒNG NAI","CT BÁC CHỮ - 23/51A NGUYỄN HỮU TIẾN, Q TÂN PHÚ","CT BÁC ĐỆ - MỸ HẠNH NAM, ĐỨC HÒA, LONG AN","SC QUẬN 9","SC MINH CHÍNH - Q GÒ VẤP","SC CT LONG HẢI - VŨNG TÀU"],
  loaiChiPhi: ["Nhân Công","Thầu Phụ","Vật Liệu XD","Sắt Thép","Vật Tư Điện Nước","Đổ Bê Tông","Copha - VTP - Máy","Hóa Đơn Lẻ","Quyết Toán - Phát Sinh","Thiết Kế / Xin Phép","Chi Phí Khác"],
  nhaCungCap: ["Công ty VLXD Minh Phát","Cửa Hàng Sắt Thép Hùng","Điện Nước Phú Thịnh","Hóa Đơn Điện Lực"],
  nguoiTH: ["A Long","A Toán","A Dũng","Duy Sáng","HD Lẻ","Tình"],
  tbTen: ['Máy cắt cầm tay','Máy cắt bàn','Máy uốn sắt lớn','Bàn uốn sắt','Thước nhôm','Chân Dàn 1.7m','Chân Dàn 1.5m','Chéo lớn','Chéo nhỏ','Kít tăng giàn giáo','Cây chống tăng']
};

// ── Cấu hình danh mục (metadata) ────────────────────────────
export const CATS = [
  { id:'congTrinh',  title:'🏗️ Công Trình',           sk:'cat_ct',     refField:'congtrinh' },
  { id:'loaiChiPhi', title:'📂 Loại Chi Phí',          sk:'cat_loai',   refField:'loai' },
  { id:'nhaCungCap', title:'🏪 Nhà Cung Cấp',          sk:'cat_ncc',    refField:'ncc' },
  { id:'nguoiTH',    title:'👷 Người Thực Hiện',       sk:'cat_nguoi',  refField:'nguoi' },
  { id:'thauPhu',    title:'🤝 Thầu Phụ / TP',         sk:'cat_tp',     refField:'tp' },
  { id:'congNhan',   title:'🪖 Công Nhân',              sk:'cat_cn',     refField:null },
  { id:'tbTen',      title:'🛠 Máy / Thiết Bị Thi Công', sk:'cat_tbteb', refField:null }
];

// ── DB Key Map: storage key → IDB table config ──────────────
export const DB_KEY_MAP = {
  // Array tables (cloud-synced)
  'inv_v3':       { table: 'invoices',   isArr: true  },
  'cc_v2':        { table: 'attendance', isArr: true  },
  'tb_v1':        { table: 'equipment',  isArr: true  },
  'ung_v1':       { table: 'ung',        isArr: true  },
  'thu_v1':       { table: 'revenue',    isArr: true  },
  // Category objects (categories table)
  'cat_ct':       { table: 'categories', isArr: false, rowId: 'congTrinh'  },
  'cat_loai':     { table: 'categories', isArr: false, rowId: 'loaiChiPhi' },
  'cat_ncc':      { table: 'categories', isArr: false, rowId: 'nhaCungCap' },
  'cat_nguoi':    { table: 'categories', isArr: false, rowId: 'nguoiTH'    },
  'cat_tp':       { table: 'categories', isArr: false, rowId: 'thauPhu'    },
  'cat_cn':       { table: 'categories', isArr: false, rowId: 'congNhan'   },
  'cat_tbteb':    { table: 'categories', isArr: false, rowId: 'tbTen'      },
  // Settings objects (settings table)
  'projects_v1':  { table: 'settings',   isArr: false, rowId: 'projects'    },
  'hopdong_v1':   { table: 'settings',   isArr: false, rowId: 'hopdong'     },
  'thauphu_v1':   { table: 'settings',   isArr: false, rowId: 'thauphu'     },
  'trash_v1':     { table: 'settings',   isArr: false, rowId: 'trash'       },
  'users_v1':     { table: 'settings',   isArr: false, rowId: 'users'       },
  'cat_ct_years': { table: 'settings',   isArr: false, rowId: 'cat_ct_years'},
  'cat_cn_roles': { table: 'settings',   isArr: false, rowId: 'cat_cn_roles'},
  'cat_items_v1': { table: 'settings',   isArr: false, rowId: 'catItems'     },
};

/** Danh sách keys cần backup */
export const BACKUP_KEYS = [
  'inv_v3','ung_v1','cc_v2','tb_v1','thu_v1',
  'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn',
  'projects_v1','hopdong_v1','thauphu_v1','cat_tbteb',
  'cat_ct_years','cat_cn_roles','cat_items_v1',
];

/** Dataset keys cần trigger sync khi save */
export const SYNC_DATA_KEYS = new Set([
  'inv_v3','cc_v2','tb_v1','ung_v1','thu_v1',
  'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
  'projects_v1','hopdong_v1','thauphu_v1',
  'users_v1','cat_ct_years','cat_cn_roles','cat_items_v1',
]);

/** Keys mà khi thay đổi sẽ invalidate invoice cache */
export const INV_CACHE_KEYS = new Set(['inv_v3','cc_v2','projects_v1','hopdong_v1','thauphu_v1','cat_items_v1']);

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES — direct globals cho legacy scripts
// ══════════════════════════════════════════════════════════════
window._CONFIG  = { DATA_VERSION, DEFAULTS, CATS, DB_KEY_MAP, BACKUP_KEYS, FB_CONFIG };
window.DEFAULTS = DEFAULTS;
window.CATS     = CATS;
window.DB_KEY_MAP   = DB_KEY_MAP;
window.BACKUP_KEYS  = BACKUP_KEYS;
window.FB_CONFIG    = FB_CONFIG;
window.FB_CFG_KEY   = FB_CFG_KEY;
window.FB_CACHE_KEY = FB_CACHE_KEY;
window.FS_BASE      = FS_BASE;
window.DATA_VERSION = DATA_VERSION;
window.SYNC_DATA_KEYS = SYNC_DATA_KEYS;
window.INV_CACHE_KEYS = INV_CACHE_KEYS;
window.BACKUP_MINS    = BACKUP_MINS;
window.BACKUP_MAX     = BACKUP_MAX;
