// ══════════════════════════════════════════════════════════════
// src/core/store.js — Centralized State Management
// Prompt 3 — ES Modules Refactor
// Thay thế các biến global: invoices, ccData, projects, cats...
// ══════════════════════════════════════════════════════════════

import { DEFAULTS, SYNC_DATA_KEYS, INV_CACHE_KEYS } from './config.js';
import { load, memSet, dbSave } from './db.js';
import { normalize } from './schema.js';

// ── Private state ───────────────────────────────────────────
const _state = {
  // Data arrays
  invoices: [],
  ccData: [],
  tbData: [],
  ungRecords: [],
  thuRecords: [],
  // Data objects
  hopDongData: {},
  thauPhuContracts: [],
  trash: [],
  // Categories
  cats: {
    congTrinh: [],
    congTrinhYears: {},
    loaiChiPhi: [],
    nhaCungCap: [],
    nguoiTH: [],
    thauPhu: [],
    congNhan: [],
    tbTen: [],
  },
  cnRoles: {},
  catItems: {},
  // Projects
  projects: [],
  // App state
  activeYear: null,
  activeYears: new Set(),
  currentUser: null,
  // Users
  users: [],
};

// ── Event subscribers ───────────────────────────────────────
const _subscribers = new Map(); // key → Set<callback>

/**
 * Đăng ký lắng nghe thay đổi state
 * @param {string} key - Tên state (VD: 'invoices', 'cats')
 * @param {Function} callback - Hàm được gọi khi state thay đổi
 * @returns {Function} Hàm unsubscribe
 */
export function subscribe(key, callback) {
  if (!_subscribers.has(key)) _subscribers.set(key, new Set());
  _subscribers.get(key).add(callback);
  return () => _subscribers.get(key)?.delete(callback);
}

function _notify(key) {
  const subs = _subscribers.get(key);
  if (subs) subs.forEach(cb => { try { cb(_state[key]); } catch(e) { console.warn('[store] subscriber error:', key, e); } });
}

// ══════════════════════════════════════════════════════════════
//  GETTERS — Đọc state (read-only copies khi cần)
// ══════════════════════════════════════════════════════════════

export function getInvoices()    { return _state.invoices; }
export function getCcData()      { return _state.ccData; }
export function getTbData()      { return _state.tbData; }
export function getUngRecords()  { return _state.ungRecords; }
export function getThuRecords()  { return _state.thuRecords; }
export function getHopDongData() { return _state.hopDongData; }
export function getThauPhuContracts() { return _state.thauPhuContracts; }
export function getTrash()       { return _state.trash; }
export function getProjects()    { return _state.projects; }
export function getCats()        { return _state.cats; }
export function getCnRoles()     { return _state.cnRoles; }
export function getCatItems()    { return _state.catItems; }
export function getUsers()       { return _state.users; }

export function getActiveYear()  { return _state.activeYear; }
export function getActiveYears() { return _state.activeYears; }
export function getCurrentUser() { return _state.currentUser; }

// ══════════════════════════════════════════════════════════════
//  SETTERS — Ghi state + persist + notify
// ══════════════════════════════════════════════════════════════

/** Set toàn bộ mảng invoices */
export function setInvoices(arr) {
  _state.invoices = arr;
  _notify('invoices');
}

/** Thêm 1 invoice — validate qua schema trước */
export function addInvoice(data) {
  const result = normalize('inv_v3', data);
  if (!result.valid) {
    console.warn('[store] addInvoice validation errors:', result.errors);
  }
  _state.invoices.push(result.data);
  _persistAndNotify('inv_v3', _state.invoices, 'invoices');
  return result;
}

export function setCcData(arr) {
  _state.ccData = arr;
  _notify('ccData');
}

export function setTbData(arr) {
  _state.tbData = arr;
  _notify('tbData');
}

export function setUngRecords(arr) {
  _state.ungRecords = arr;
  _notify('ungRecords');
}

export function setThuRecords(arr) {
  _state.thuRecords = arr;
  _notify('thuRecords');
}

export function setHopDongData(obj) {
  _state.hopDongData = obj;
  _notify('hopDongData');
}

export function setThauPhuContracts(arr) {
  _state.thauPhuContracts = arr;
  _notify('thauPhuContracts');
}

export function setTrash(arr) {
  _state.trash = arr;
  _notify('trash');
}

export function setProjects(arr) {
  _state.projects = arr;
  _notify('projects');
}

export function setCats(cats) {
  Object.assign(_state.cats, cats);
  _notify('cats');
}

export function setCnRoles(obj) {
  _state.cnRoles = obj;
  _notify('cnRoles');
}

export function setCatItems(obj) {
  _state.catItems = obj;
  _notify('catItems');
}

export function setUsers(arr) {
  _state.users = arr;
  _notify('users');
}

// ── App state setters ───────────────────────────────────────

export function setActiveYear(year) {
  _state.activeYear = year;
  _notify('activeYear');
}

export function setActiveYears(yearsSet) {
  _state.activeYears = yearsSet instanceof Set ? yearsSet : new Set(yearsSet);
  _notify('activeYears');
}

export function setCurrentUser(user) {
  _state.currentUser = user;
  _notify('currentUser');
}

// ══════════════════════════════════════════════════════════════
//  PERSISTENCE — ghi xuống IDB + trigger sync
// ══════════════════════════════════════════════════════════════

function _persistAndNotify(dbKey, value, stateKey) {
  // Ghi _mem + IDB
  memSet(dbKey, value);
  // Invalidate invoice cache nếu cần
  if (INV_CACHE_KEYS.has(dbKey)) {
    if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
  }
  // Trigger sync
  if (SYNC_DATA_KEYS.has(dbKey)) {
    if (typeof window._incPending === 'function') window._incPending();
    if (typeof window.schedulePush === 'function') window.schedulePush();
  }
  _notify(stateKey);
}

/**
 * Persist & sync — wrapper cho save() cũ
 * Modules gọi hàm này thay vì save() global
 */
export function persist(dbKey, value) {
  memSet(dbKey, value);
  if (INV_CACHE_KEYS.has(dbKey)) {
    if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
  }
  if (SYNC_DATA_KEYS.has(dbKey)) {
    if (typeof window._incPending === 'function') window._incPending();
    if (typeof window.schedulePush === 'function') window.schedulePush();
  }
}

// ══════════════════════════════════════════════════════════════
//  RELOAD — Đồng bộ _state từ _mem (sau dbInit, pull, import)
// ══════════════════════════════════════════════════════════════

/**
 * Reload toàn bộ state từ _mem (IDB cache)
 * Gọi sau dbInit(), pullChanges(), importJSON()
 */
export function reloadFromMem() {
  _state.invoices          = load('inv_v3', []);
  _state.ccData            = load('cc_v2', []);
  _state.tbData            = load('tb_v1', []);
  _state.ungRecords        = load('ung_v1', []);
  _state.thuRecords        = load('thu_v1', []);
  _state.hopDongData       = load('hopdong_v1', {});
  _state.thauPhuContracts  = load('thauphu_v1', []);
  _state.trash             = load('trash_v1', []);
  _state.projects          = load('projects_v1', []);
  _state.users             = load('users_v1', []);

  // Categories
  _state.cats.congTrinh      = load('cat_ct', DEFAULTS.congTrinh);
  _state.cats.congTrinhYears = load('cat_ct_years', {});
  _state.cats.loaiChiPhi     = load('cat_loai', DEFAULTS.loaiChiPhi);
  _state.cats.nhaCungCap     = load('cat_ncc', DEFAULTS.nhaCungCap);
  _state.cats.nguoiTH        = load('cat_nguoi', DEFAULTS.nguoiTH);
  _state.cats.thauPhu        = load('cat_tp', []);
  _state.cats.congNhan       = load('cat_cn', []);
  _state.cats.tbTen          = load('cat_tbteb', DEFAULTS.tbTen);

  _state.cnRoles  = load('cat_cn_roles', {});
  _state.catItems = load('cat_items_v1', {});
}

/** Trả state object cho debug */
export function getState() { return _state; }

// ══════════════════════════════════════════════════════════════
// RECORD FACTORY — tạo/cập nhật record chuẩn hóa
// ══════════════════════════════════════════════════════════════

/**
 * Tạo record mới với metadata đầy đủ
 * @param {Object} fields - Các field nghiệp vụ
 * @returns {Object} Record hoàn chỉnh
 */
export function mkRecord(fields) {
  const now = Date.now();
  const devId = (typeof window.DEVICE_ID !== 'undefined') ? window.DEVICE_ID : '';
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: devId,
    ...fields,
  };
}

/**
 * Cập nhật record — bảo toàn id + createdAt
 */
export function mkUpdate(existing, changes) {
  const devId = (typeof window.DEVICE_ID !== 'undefined') ? window.DEVICE_ID : '';
  return {
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    deviceId: devId,
  };
}

// ══════════════════════════════════════════════════════════════
//  _reloadGlobals — Đồng bộ globals từ _mem (from core.js)
// ══════════════════════════════════════════════════════════════

/**
 * Reload window globals từ _mem (gọi sau dbInit, pull, import)
 * Đây là bridge — legacy scripts đọc trực tiếp window.invoices etc.
 */
export function reloadGlobals() {
  // Reload store state
  reloadFromMem();

  // Sync lên window globals cho legacy scripts
  window.invoices    = _state.invoices;
  window.ccData      = _state.ccData;
  window.tbData      = _state.tbData;
  window.ungRecords  = _state.ungRecords;
  window.thuRecords  = _state.thuRecords;
  window.hopDongData = _state.hopDongData;
  window.thauPhuContracts = _state.thauPhuContracts;
  window.trash       = _state.trash;
  window.projects    = _state.projects;
  window.users       = _state.users;

  // Categories
  window.cats = _state.cats;
  window.cnRoles  = _state.cnRoles;
  window.catItems = _state.catItems;

  // Clear derived caches
  if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
}

/**
 * afterDataChange — gọi sau bất kỳ mutation nào
 * Refresh UI + clear caches
 */
export function afterDataChange() {
  reloadGlobals();
  if (typeof window.updateTop === 'function') window.updateTop();
}

/**
 * clearAllCache — xóa mọi cache
 */
export function clearAllCache() {
  if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES — direct globals cho legacy scripts
// ══════════════════════════════════════════════════════════════
window._store = {
  getState, getInvoices, getCcData, getTbData, getUngRecords,
  getThuRecords, getHopDongData, getProjects, getCats, getUsers,
  getActiveYear, getActiveYears, getCurrentUser,
  setInvoices, setCcData, setTbData, setUngRecords, setThuRecords,
  setHopDongData, setProjects, setCats, setUsers,
  setActiveYear, setActiveYears, setCurrentUser,
  addInvoice, persist, reloadFromMem, subscribe,
  mkRecord, mkUpdate,
};

// Direct globals
window._reloadGlobals  = reloadGlobals;
window.afterDataChange = afterDataChange;
window.clearAllCache   = clearAllCache;
window.mkRecord        = mkRecord;
window.mkUpdate        = mkUpdate;
window.reloadFromMem   = reloadFromMem;

// Initialize global vars with empty defaults (will be populated after dbInit)
window.invoices    = _state.invoices;
window.ccData      = _state.ccData;
window.tbData      = _state.tbData;
window.ungRecords  = _state.ungRecords;
window.thuRecords  = _state.thuRecords;
window.hopDongData = _state.hopDongData;
window.thauPhuContracts = _state.thauPhuContracts;
window.trash       = _state.trash;
window.projects    = _state.projects;
window.users       = _state.users;
window.cats = _state.cats;
window.cnRoles  = _state.cnRoles;
window.catItems = _state.catItems;

// Pagination state
window.filteredInvs = [];
window.curPage = 1;
window.PG = 20;
