// ══════════════════════════════════════════════════════════════
// src/services/category.svc.js — Category Service (Pure Logic)
// Prompt 4 — Bốc từ danhmuc.js + core.js
// Quản lý cat_items_v1 (per-item tracking với soft-delete)
// ══════════════════════════════════════════════════════════════

import { CATS, DEFAULTS } from '../core/config.js';

// ── cat_items_v1 migration ──────────────────────────────────

/**
 * Tạo cat_items_v1 từ string arrays nếu chưa có (migration 1 lần)
 * @param {Object} cats - cats state object
 * @param {Object} existingItems - load('cat_items_v1', {})
 * @returns {Object|null} items mới nếu cần migrate, null nếu đã có
 */
export function migrateCatItemsIfNeeded(cats, existingItems) {
  if (existingItems && Object.keys(existingItems).length) return null;
  const now = Date.now();
  const toItems = arr => (arr || []).map(name => ({
    id: crypto.randomUUID(), name, isDeleted: false, updatedAt: now
  }));
  return {
    loai:  toItems(cats.loaiChiPhi),
    ncc:   toItems(cats.nhaCungCap),
    nguoi: toItems(cats.nguoiTH),
    tp:    toItems(cats.thauPhu),
    cn:    toItems(cats.congNhan),
    tbteb: toItems(cats.tbTen),
  };
}

/**
 * Rebuild string arrays từ cat_items_v1 (áp dụng soft-delete)
 * @param {Object} catItems - cat_items_v1 data
 * @returns {Object} { loaiChiPhi, nhaCungCap, nguoiTH, thauPhu, congNhan, tbTen }
 */
export function rebuildCatArrsFromItems(catItems) {
  if (!catItems || !Object.keys(catItems).length) return null;
  const getActive = key => (catItems[key] || [])
    .filter(it => !it.isDeleted)
    .map(it => it.name);
  return {
    loaiChiPhi: getActive('loai'),
    nhaCungCap: getActive('ncc'),
    nguoiTH:    getActive('nguoi'),
    thauPhu:    getActive('tp'),
    congNhan:   getActive('cn'),
    tbTen:      getActive('tbteb'),
  };
}

/**
 * Thêm item vào danh mục
 * @param {Object} catItems - cat_items_v1 data
 * @param {string} catKey - key trong catItems (loai, ncc, nguoi, tp, cn, tbteb)
 * @param {string} name - tên item mới
 * @returns {{ items: Object, added: boolean }}
 */
export function addCatItem(catItems, catKey, name) {
  const items = { ...catItems };
  if (!items[catKey]) items[catKey] = [];
  const trimmed = (name || '').trim();
  if (!trimmed) return { items, added: false };
  // Kiểm tra trùng (case-insensitive)
  const exists = items[catKey].some(it =>
    !it.isDeleted && it.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return { items, added: false };
  items[catKey] = [...items[catKey], {
    id: crypto.randomUUID(),
    name: trimmed,
    isDeleted: false,
    updatedAt: Date.now()
  }];
  return { items, added: true };
}

/**
 * Soft-delete item khỏi danh mục
 */
export function deleteCatItem(catItems, catKey, itemId) {
  const items = { ...catItems };
  if (!items[catKey]) return items;
  items[catKey] = items[catKey].map(it =>
    it.id === itemId ? { ...it, isDeleted: true, updatedAt: Date.now() } : it
  );
  return items;
}

/**
 * Rename item trong danh mục
 */
export function renameCatItem(catItems, catKey, itemId, newName) {
  const items = { ...catItems };
  if (!items[catKey]) return { items, oldName: null };
  let oldName = null;
  items[catKey] = items[catKey].map(it => {
    if (it.id === itemId) {
      oldName = it.name;
      return { ...it, name: newName.trim(), updatedAt: Date.now() };
    }
    return it;
  });
  return { items, oldName };
}

/**
 * Dedup mảng string (case-insensitive, giữ lần đầu)
 */
export function dedupCatArr(arr) {
  if (!Array.isArray(arr)) return arr;
  const seen = new Set();
  return arr.filter(item => {
    const key = (item || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Map catId (CATS config) → catItems key
 */
export function catIdToItemKey(catId) {
  const map = {
    loaiChiPhi: 'loai', nhaCungCap: 'ncc', nguoiTH: 'nguoi',
    thauPhu: 'tp', congNhan: 'cn', tbTen: 'tbteb'
  };
  return map[catId] || null;
}

/**
 * Map catId → cats property key
 */
export function catIdToCatsKey(catId) {
  return catId; // congTrinh, loaiChiPhi, etc. — trùng tên
}

/**
 * Chuẩn hóa key để so sánh trùng trong cat_items_v1
 */
export function catNormKey(s) {
  return (s || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dọn dẹp duplicate trong cat_items_v1
 */
export function dedupCatItemsNow(allItems, now = Date.now()) {
  if (!allItems || !Object.keys(allItems).length) return { items: allItems, changed: false };
  let changed = false;
  const newItems = { ...allItems };
  Object.keys(newItems).forEach(type => {
    const byNorm = new Map();
    const typeList = (newItems[type] || []).slice();
    typeList.forEach((item, idx) => {
      if (item.isDeleted) return;
      const norm = catNormKey(item.name);
      if (!byNorm.has(norm)) { byNorm.set(norm, { item, idx }); return; }
      const winnerData = byNorm.get(norm);
      if ((item.updatedAt || 0) > (winnerData.item.updatedAt || 0)) {
        winnerData.item = { ...winnerData.item, isDeleted: true, updatedAt: now };
        typeList[winnerData.idx] = winnerData.item;
        byNorm.set(norm, { item, idx });
      } else {
        typeList[idx] = { ...item, isDeleted: true, updatedAt: now };
      }
      changed = true;
    });
    newItems[type] = typeList;
  });
  return { items: newItems, changed };
}

/**
 * Đồng bộ string array → cat_items_v1 sau mỗi lần user thay đổi danh mục
 */
export function syncCatItems(catId, nameArr, allItems, now = Date.now()) {
  const type = catIdToItemKey(catId);
  if (!type) return allItems; // congTrinh → bỏ qua
  const newItems = { ...allItems };
  const typeItems = (newItems[type] || []).slice();

  const seenNorm = new Set();
  const dedupedNames = (nameArr || []).filter(Boolean).filter(name => {
    const k = catNormKey(name);
    return seenNorm.has(k) ? false : (seenNorm.add(k), true);
  });
  const nameSetNorm = new Set(dedupedNames.map(catNormKey));

  // Soft-delete
  const existingNorm = new Set();
  for (let i = 0; i < typeItems.length; i++) {
    const item = typeItems[i];
    const norm = catNormKey(item.name);
    existingNorm.add(norm);
    if (!item.isDeleted && !nameSetNorm.has(norm)) {
      typeItems[i] = { ...item, isDeleted: true, updatedAt: now };
    }
    if (item.isDeleted && nameSetNorm.has(norm)) {
      typeItems[i] = { ...item, isDeleted: false, updatedAt: now };
    }
  }

  // Thêm mới
  dedupedNames.forEach(name => {
    const k = catNormKey(name);
    if (!existingNorm.has(k)) {
      typeItems.push({ id: crypto.randomUUID(), name, isDeleted: false, updatedAt: now });
      existingNorm.add(k);
    }
  });

  newItems[type] = typeItems;
  return newItems;
}

/**
 * Lưu danh mục (ported from core.js saveCats)
 */
export function saveCats(catId) {
  const cfg = window.CATS.find(c => c.id === catId);
  if (cfg) {
    window.save(cfg.sk, window.cats[catId]); // trigger IDB save + sync
    if (catId === 'congTrinh') {
      window.save('cat_ct_years', window.cats.congTrinhYears || {});
    }
    // Update cat_items_v1
    const allItems = window.load('cat_items_v1', {});
    const updated = syncCatItems(catId, window.cats[catId], allItems);
    window._memSet('cat_items_v1', updated);
  }
  if (typeof window.refreshEntryDropdowns === 'function') window.refreshEntryDropdowns();
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES — direct globals cho legacy scripts
// ══════════════════════════════════════════════════════════════
window._categorySvc = {
  migrateCatItemsIfNeeded, rebuildCatArrsFromItems,
  addCatItem, deleteCatItem, renameCatItem,
  dedupCatArr, catIdToItemKey,
  catNormKey, dedupCatItemsNow, syncCatItems, saveCats,
};

// Direct globals
window.saveCats = saveCats;
window._catNormKey = catNormKey;
window._dedupCatItemsNow = function() {
  const allItems = window.load('cat_items_v1', {});
  const { items, changed } = dedupCatItemsNow(allItems);
  if (changed) {
    window._memSet('cat_items_v1', items);
    console.log('[Cats] _dedupCatItemsNow: cleaned up duplicate items');
  }
  return changed;
};
window._syncCatItems = function(catId, nameArr) {
  const allItems = window.load('cat_items_v1', {});
  const updated = syncCatItems(catId, nameArr, allItems);
  window._memSet('cat_items_v1', updated);
};
