// ══════════════════════════════════════════════════════════════
// src/core/db.js — Dexie IndexedDB Layer (Pure Persistence)
// Prompt 3 — ES Modules Refactor
// Nguồn: core.js (Dexie init, _dbSave, dbInit, _mem, load, save)
// ══════════════════════════════════════════════════════════════

import { DB_KEY_MAP, DB_NAME } from './config.js';

// ── Dexie instance ──────────────────────────────────────────
// Dùng global Dexie (CDN) vì app không dùng bundler
const db = new Dexie(DB_NAME);

db.version(1).stores({
  invoices:   'id, updatedAt',
  attendance: 'id, updatedAt',
  equipment:  'id, updatedAt',
  ung:        'id, updatedAt',
  revenue:    'id, updatedAt',
  categories: 'id'
});
db.version(2).stores({
  settings: 'id'
});

export { db };

// ── In-memory cache — nguồn đọc duy nhất sau dbInit() ──────
const _mem = {};

/**
 * Đọc giá trị từ memory cache
 * @param {string} key - Storage key (VD: 'inv_v3')
 * @param {*} def - Giá trị mặc định nếu chưa có
 * @returns {*}
 */
export function load(key, def) {
  const v = _mem[key];
  return (v !== undefined && v !== null) ? v : def;
}

/**
 * Ghi trực tiếp vào _mem + IDB (KHÔNG trigger sync)
 * Dùng cho internal operations: merge, migration, normalization
 */
export function memSet(key, value) {
  _mem[key] = value;
  dbSave(key, value).catch(e => console.warn('[IDB] memSet lỗi:', key, e));
}

/**
 * Ghi giá trị vào _mem + IDB
 * Trả về Promise (IDB write)
 */
export async function dbSave(key, value) {
  const cfg = DB_KEY_MAP[key];
  if (!cfg) return;
  const now = Date.now();
  if (cfg.isArr) {
    const records = (Array.isArray(value) ? value : []).map(r => {
      if (!r.id) r.id = crypto.randomUUID();
      if (!r.updatedAt) r.updatedAt = now;
      return r;
    });
    const newIdSet = new Set(records.map(r => r.id));
    const existing = await db[cfg.table].toArray();
    const toDelete = existing.filter(r => !newIdSet.has(r.id)).map(r => r.id);
    if (toDelete.length) await db[cfg.table].bulkDelete(toDelete);
    if (records.length) await db[cfg.table].bulkPut(records);
  } else {
    await db[cfg.table].put({ id: cfg.rowId, data: value, updatedAt: now });
  }
}

/**
 * Đọc 1 record từ IDB theo table + id
 */
export async function dbLoad(table, id) {
  return db[table].get(id);
}

/**
 * Xóa 1 record từ IDB
 */
export async function dbDelete(table, id) {
  return db[table].delete(id);
}

/**
 * Khởi tạo: đọc toàn bộ data từ IDB vào _mem
 * Phải gọi 1 lần khi app khởi động, trước khi dùng load()
 */
export async function dbInit() {
  try {
    for (const [key, cfg] of Object.entries(DB_KEY_MAP)) {
      if (cfg.isArr) {
        _mem[key] = await db[cfg.table].toArray();
      } else {
        const rec = await db[cfg.table].get(cfg.rowId);
        _mem[key] = rec ? rec.data : null;
      }
    }
    console.log('[db.js] dbInit hoàn tất — IDB-primary mode');
  } catch (e) {
    console.warn('[db.js] dbInit lỗi:', e);
  }
}

/**
 * Xóa toàn bộ data trong IDB (dùng cho import/reset)
 */
export async function dbClearAll() {
  await Promise.all(db.tables.map(t => t.clear()));
  Object.keys(_mem).forEach(k => delete _mem[k]);
}

/**
 * Dedup mảng theo id — giữ record có updatedAt cao nhất
 */
export function dedupById(arr) {
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

/**
 * Merge 2 mảng theo id — giữ record mới nhất (LWW)
 */
export function mergeUnique(oldArr, newArr) {
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

/** Export _mem cho debug */
export function getMem() { return _mem; }

// ── localStorage helpers (from core.js) ────────────────────
export function loadLS(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}

export function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('[LS] save error:', key, e); }
}

// ── save() — public API dùng bởi legacy (= memSet + sync) ──
/**
 * Ghi dữ liệu + trigger sync (thay thế save() global cũ trong core.js)
 * Legacy code gọi: save('inv_v3', invoices)
 */
export function save(key, value) {
  _mem[key] = value;
  dbSave(key, value).catch(e => console.warn('[IDB] save lỗi:', key, e));
  // Trigger sync via window bridges (set by store.js/sync.js)
  if (typeof window._incPending === 'function') window._incPending();
  if (typeof window.schedulePush === 'function') window.schedulePush();
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES — direct globals cho legacy scripts
// ══════════════════════════════════════════════════════════════
window._db      = { db, load, memSet, dbSave, dbInit, dbClearAll, dedupById, mergeUnique, getMem, save };
window.load     = load;
window.save     = save;
window._memSet  = memSet;
window._mem     = _mem;
window.dbInit   = dbInit;
window.dbSave   = dbSave;
window._loadLS  = loadLS;
window._saveLS  = saveLS;
window.dedupById    = dedupById;
window.mergeUnique  = mergeUnique;
