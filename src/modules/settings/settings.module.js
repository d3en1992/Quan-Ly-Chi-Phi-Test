// ══════════════════════════════════════════════════════════════
// src/modules/settings/settings.module.js — Settings + Delete
// Prompt 9 — ES Modules Refactor
// Prompt 16 — Full port từ danhmuc.js: renderSettings, item CRUD,
//             rebuildEntrySelects, renderCtPage
// ══════════════════════════════════════════════════════════════

import { escapeHtml } from '../../utils/string.util.js';

// ── Confirm modal "gõ DELETE" ────────────────────────────────
export function showDeleteConfirm(title, bodyHtml, onConfirm) {
  const existing = document.getElementById('_del-confirm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_del-confirm-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:24px;max-width:420px;width:100%;
                box-shadow:0 8px 32px rgba(0,0,0,.28);font-family:inherit">
      <div style="font-size:15px;font-weight:700;color:#c0392b;margin-bottom:10px">${title}</div>
      <div style="font-size:13px;color:#333;line-height:1.65;margin-bottom:16px">${bodyHtml}</div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#555;display:block;margin-bottom:6px">
          Gõ <strong>DELETE</strong> để xác nhận:
        </label>
        <input id="_del-inp" type="text" autocomplete="off" placeholder="DELETE"
          style="width:100%;box-sizing:border-box;padding:8px 12px;border:2px solid #e74c3c;
                 border-radius:6px;font-size:14px;font-family:monospace;letter-spacing:2px;outline:none">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_del-cancel" style="padding:8px 18px;border:1px solid #ccc;border-radius:6px;
          background:#f5f5f5;cursor:pointer;font-size:13px">Huỷ</button>
        <button id="_del-ok" style="padding:8px 18px;border:none;border-radius:6px;
          background:#e74c3c;color:#fff;cursor:pointer;font-size:13px;font-weight:700;opacity:.45" disabled>
          Xoá
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const inp    = overlay.querySelector('#_del-inp');
  const okBtn  = overlay.querySelector('#_del-ok');
  const canBtn = overlay.querySelector('#_del-cancel');

  inp.addEventListener('input', () => {
    const ok = inp.value.trim() === 'DELETE';
    okBtn.disabled   = !ok;
    okBtn.style.opacity = ok ? '1' : '.45';
  });
  canBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  okBtn.addEventListener('click', () => {
    if (inp.value.trim() !== 'DELETE') return;
    overlay.remove();
    onConfirm();
  });
  setTimeout(() => inp.focus(), 60);
}

// ── toolDeleteYear: guard + confirm + delegate ───────────────
export function toolDeleteYear() {
  if (typeof window.isSyncing === 'function' && window.isSyncing()) {
    if (typeof window.toast === 'function') window.toast('⚠️ Đang đồng bộ dữ liệu, vui lòng chờ', 'error');
    return;
  }
  const yr = (typeof window.activeYear !== 'undefined') ? String(window.activeYear) : '0';
  if (!yr || yr === '0') {
    if (typeof window.toast === 'function') window.toast('Chọn một năm cụ thể (không phải "Tất cả") rồi mới xóa.', 'error');
    return;
  }

  showDeleteConfirm(
    `🗑 Xóa dữ liệu năm ${yr}`,
    `Thao tác sẽ <b>xóa vĩnh viễn</b> tất cả hóa đơn, tiền ứng, chấm công, thu tiền,
     hợp đồng của năm <b>${yr}</b>.<br><br>
     • App tự động backup trước khi xóa.<br>
     • Danh mục công trình không còn được dùng sẽ bị xóa theo.<br>
     • Thiết bị của công trình bị xóa sẽ chuyển về <b>KHO TỔNG</b>.`,
    () => {
      if (typeof window._doDeleteYear === 'function') window._doDeleteYear(yr);
    }
  );
}

// ── toolResetAll: guard + confirm + delegate ─────────────────
export function toolResetAll() {
  if (!navigator.onLine) {
    if (typeof window.toast === 'function') window.toast('🔴 Không có mạng — không thể reset (cần online để xóa dữ liệu cloud)', 'error');
    return;
  }
  if (typeof window.isSyncing === 'function' && window.isSyncing()) {
    if (typeof window.toast === 'function') window.toast('⚠️ Đang đồng bộ dữ liệu, vui lòng chờ', 'error');
    return;
  }
  showDeleteConfirm(
    '⚠️ Reset toàn bộ dữ liệu',
    `Thao tác sẽ <b>xóa TOÀN BỘ</b> dữ liệu:<br>
     hóa đơn, chấm công, tiền ứng, thu tiền, hợp đồng, danh mục, thiết bị...<br><br>
     • App tự động backup trước khi reset.<br>
     • <b>Không thể hoàn tác</b> sau khi xác nhận.<br>
     • Cloud sẽ được đồng bộ trạng thái trống.`,
    () => {
      if (typeof window._doResetAll === 'function') window._doResetAll();
    }
  );
}

// ── JSON export / import wrappers ────────────────────────────
export function toolExportJSON() {
  if (typeof window.exportJSON === 'function') window.exportJSON();
}

export function toolImportJSON() {
  const el = document.getElementById('import-json-input');
  if (el) el.click();
}

// ══════════════════════════════════════════════════════════════
// CATEGORY NORMALIZATION HELPERS (pure)
// ══════════════════════════════════════════════════════════════

export function normalizeCatString(str, mode) {
  const s = (str || '').trim();
  if (!s) return '';
  if (mode === 'titlecase') {
    return s.split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return s.toUpperCase();
}

export function validateCatItem(catId, value) {
  const v = (value || '').trim();
  if (!v) return { valid: false, error: 'Tên không được để trống' };
  if (v.length > 100) return { valid: false, error: 'Tên quá dài (tối đa 100 ký tự)' };
  return { valid: true, value: v };
}

export function dedupCatArr(arr) {
  const seen = new Set();
  return (arr || []).filter(v => {
    const k = (v || '').toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function addToCatArr(arr, value) {
  const deduped = dedupCatArr([...(arr || []), value]);
  return deduped.sort((a, b) => a.localeCompare(b, 'vi'));
}

export function removeFromCatArr(arr, value) {
  return (arr || []).filter(v => v !== value);
}

export function renameCatItem(arr, oldVal, newVal) {
  return (arr || []).map(v => v === oldVal ? newVal : v);
}

export function buildCatListHtml(items, catId, onDeleteFn, onRenameFn) {
  if (!items || !items.length)
    return '<div style="color:var(--ink3);font-size:12px;padding:8px 0">Chưa có mục nào</div>';

  return items.map(item =>
    `<div class="cat-item-row" data-val="${item}" data-cat="${catId}"
          style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--line2)">
       <span style="flex:1;font-size:13px">${item}</span>
       ${onRenameFn ? `<button class="btn btn-sm btn-outline" onclick="${onRenameFn}('${catId}','${item.replace(/'/g,"\\'")}')">✏️</button>` : ''}
       <button class="btn btn-sm btn-danger" onclick="${onDeleteFn}('${catId}','${item.replace(/'/g,"\\'")}')">✕</button>
     </div>`
  ).join('');
}

// ══════════════════════════════════════════════════════════════
// LOCAL HELPERS (danhmuc.js logic)
// ══════════════════════════════════════════════════════════════

// Chuẩn hóa tên theo loại danh mục
// loaiChiPhi / tbTen → Title Case; còn lại → UPPERCASE
function normalizeName(catId, val) {
  val = (val || '').trim();
  if (!val) return val;
  if (catId === 'loaiChiPhi' || catId === 'tbTen') {
    return val.toLowerCase().split(/\s+/).filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return val.toUpperCase();
}

// Chuẩn hóa để so sánh trùng: bỏ dấu + lowercase + chuẩn khoảng trắng
function normalizeKey(val) {
  return (val || '').normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Dedup + sort mảng danh mục, dùng normalizeKey để phát hiện trùng dấu/hoa-thường
function _dedupCatArr(arr) {
  const seen = new Set();
  return (arr || [])
    .filter(v => v && v.trim())
    .filter(v => {
      const k = normalizeKey(v);
      return k && !seen.has(k) ? (seen.add(k), true) : false;
    })
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

// ── Kiểm tra item có phát sinh trong năm đang chọn không ─────
function _isDmItemUsedInYear(catId, item) {
  const nItem = normalizeKey(item);
  if (!nItem) return false;
  const CATS = window.CATS || [];
  const cats = window.cats || {};
  const ungRecords = window.ungRecords || [];
  const ccData = window.ccData || [];
  const tbData = window.tbData || [];
  const invs = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];
  const inAY = (d) => typeof window.inActiveYear === 'function' ? window.inActiveYear(d) : true;

  const cfg = CATS.find(c => c.id === catId);
  if (cfg && cfg.refField) {
    if (invs.some(i => inAY(i.ngay) && normalizeKey(i[cfg.refField] || '') === nItem)) return true;
  }
  if (catId === 'thauPhu' || catId === 'nhaCungCap') {
    if (ungRecords.some(r => !r.deletedAt && inAY(r.ngay)
        && (r.loai || 'thauphu') === 'thauphu'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'congNhan') {
    if (ccData.some(w => !w.deletedAt && inAY(w.fromDate)
        && (w.workers || []).some(wk => normalizeKey(wk.name) === nItem))) return true;
    if (ungRecords.some(r => !r.deletedAt && inAY(r.ngay)
        && r.loai === 'congnhan'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'tbTen') {
    if (tbData.some(t => !t.deletedAt && inAY(t.ngay) && normalizeKey(t.ten) === nItem)) return true;
  }
  return false;
}

// ── Kiểm tra item có phát sinh bất kỳ năm nào không ─────────
function _isDmItemUsedAnytime(catId, item) {
  const nItem = normalizeKey(item);
  if (!nItem) return false;
  const CATS = window.CATS || [];
  const cats = window.cats || {};
  const ungRecords = window.ungRecords || [];
  const ccData = window.ccData || [];
  const tbData = window.tbData || [];
  const invs = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];

  const cfg = CATS.find(c => c.id === catId);
  if (cfg && cfg.refField) {
    if (invs.some(i => normalizeKey(i[cfg.refField] || '') === nItem)) return true;
  }
  if (catId === 'thauPhu' || catId === 'nhaCungCap') {
    if (ungRecords.some(r => !r.deletedAt
        && (r.loai || 'thauphu') === 'thauphu'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'congNhan') {
    if (ccData.some(w => !w.deletedAt
        && (w.workers || []).some(wk => normalizeKey(wk.name) === nItem))) return true;
    if (ungRecords.some(r => !r.deletedAt && r.loai === 'congnhan'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'tbTen') {
    if (tbData.some(t => !t.deletedAt && normalizeKey(t.ten) === nItem)) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
// SETTINGS UI — ITEM RENDERERS
// ══════════════════════════════════════════════════════════════

function renderCTItem(item, idx) {
  const cats = window.cats || {};
  const inUse = isItemInUse('congTrinh', item);
  const yr = cats.congTrinhYears && cats.congTrinhYears[item];
  const yrBadge = yr
    ? `<span style="font-size:10px;color:#1565c0;padding:1px 5px;background:rgba(21,101,192,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">${yr}</span>`
    : '';
  return `<div class="settings-item" id="si-congTrinh-${idx}" style="${inUse ? 'background:rgba(26,122,69,0.04)' : ''}">
    <span class="s-name" id="sn-congTrinh-${idx}" ondblclick="startEdit('congTrinh',${idx})">${escapeHtml(item)}</span>
    ${yrBadge}
    ${inUse ? `<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">✓ đang dùng</span>` : ''}
    <input class="s-edit-input" id="se-congTrinh-${idx}" value="${escapeHtml(item)}"
      onblur="finishEdit('congTrinh',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('congTrinh',${idx});if(event.key==='Escape')cancelEdit('congTrinh',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('congTrinh',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse ? 'btn-outline' : 'btn-danger'} btn-sm btn-icon" onclick="delItem('congTrinh',${idx})"
      title="${inUse ? 'Đang được sử dụng — không thể xóa' : 'Xóa'}" ${inUse ? 'style="opacity:0.4;cursor:not-allowed"' : ''}>✕</button>
  </div>`;
}

function renderItem(catId, item, idx) {
  const inUse = isItemInUse(catId, item);
  return `<div class="settings-item" id="si-${catId}-${idx}" style="${inUse ? 'background:rgba(26,122,69,0.04)' : ''}">
    <span class="s-name" id="sn-${catId}-${idx}" ondblclick="startEdit('${catId}',${idx})">${escapeHtml(item)}</span>
    ${inUse ? `<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px">✓ đang dùng</span>` : ''}
    <input class="s-edit-input" id="se-${catId}-${idx}" value="${escapeHtml(item)}"
      onblur="finishEdit('${catId}',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('${catId}',${idx});if(event.key==='Escape')cancelEdit('${catId}',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('${catId}',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse ? 'btn-outline' : 'btn-danger'} btn-sm btn-icon" onclick="delItem('${catId}',${idx})"
      title="${inUse ? 'Đang được sử dụng — không thể xóa' : 'Xóa'}" ${inUse ? 'style="opacity:0.4;cursor:not-allowed"' : ''}>✕</button>
  </div>`;
}

function renderCNItem(name, idx) {
  const cnRoles = window.cnRoles || {};
  const ccData = window.ccData || [];
  const role = cnRoles[name] || '';
  const inUse = ccData.some(w => !w.deletedAt && w.workers && w.workers.some(wk => wk.name === name));
  return `<div class="settings-item" id="si-congNhan-${idx}" style="${inUse ? 'background:rgba(26,122,69,0.04)' : ''}">
    <span class="s-name" id="sn-congNhan-${idx}" ondblclick="startEdit('congNhan',${idx})">${escapeHtml(name)}</span>
    ${inUse ? `<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px">✓ đang dùng</span>` : ''}
    <input class="s-edit-input" id="se-congNhan-${idx}" value="${escapeHtml(name)}"
      onblur="finishEdit('congNhan',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('congNhan',${idx});if(event.key==='Escape')cancelEdit('congNhan',${idx})">
    <select onchange="updateCNRole(${idx},this.value)"
      style="margin:0 4px;padding:2px 6px;border:1px solid var(--line2);border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;min-width:44px"
      title="Vai trò (C=Cái, T=Thợ, P=Phụ)">
      <option value="" ${!role ? 'selected' : ''}>—</option>
      <option value="C" ${role === 'C' ? 'selected' : ''}>C</option>
      <option value="T" ${role === 'T' ? 'selected' : ''}>T</option>
      <option value="P" ${role === 'P' ? 'selected' : ''}>P</option>
    </select>
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('congNhan',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse ? 'btn-outline' : 'btn-danger'} btn-sm btn-icon" onclick="delItem('congNhan',${idx})"
      title="${inUse ? 'Đang được sử dụng — không thể xóa' : 'Xóa'}" ${inUse ? 'style="opacity:0.4;cursor:not-allowed"' : ''}>✕</button>
  </div>`;
}

function renderTbTenItem(item, idx) {
  const tbData = window.tbData || [];
  const inUse = tbData.some(t => t.ten === item);
  return `<div class="settings-item" id="si-tbTen-${idx}" style="${inUse ? 'background:rgba(26,122,69,0.04)' : ''}">
    <span class="s-name" id="sn-tbTen-${idx}" ondblclick="startEdit('tbTen',${idx})">${escapeHtml(item)}</span>
    ${inUse ? `<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">✓ đang dùng</span>` : ''}
    <input class="s-edit-input" id="se-tbTen-${idx}" value="${escapeHtml(item)}"
      onblur="finishEdit('tbTen',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('tbTen',${idx});if(event.key==='Escape')cancelEdit('tbTen',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('tbTen',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse ? 'btn-outline' : 'btn-danger'} btn-sm btn-icon" onclick="delItem('tbTen',${idx})"
      title="${inUse ? 'Thiết bị đang được sử dụng — không thể xóa' : 'Xóa'}" ${inUse ? 'style="opacity:0.4;cursor:not-allowed"' : ''}>✕</button>
  </div>`;
}

// ── Per-card search filter ────────────────────────────────────
function _dmFilterCard(catId) {
  const q = (document.getElementById('dm-search-' + catId)?.value || '').toLowerCase().trim();
  const list = document.getElementById('sl-' + catId);
  if (!list) return;
  list.querySelectorAll('.settings-item').forEach(el => {
    const nameEl = el.querySelector('.s-name');
    const text = (nameEl ? nameEl.textContent : el.textContent).toLowerCase();
    el.style.display = !q || text.includes(q) ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// SETTINGS: renderSettings — main card renderer
// ══════════════════════════════════════════════════════════════

function renderSettings() {
  _migrateCatNamesFormat();
  const grid = document.getElementById('dm-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const CATS = window.CATS || [];
  const cats = window.cats || {};
  const tbData = window.tbData || [];

  CATS.filter(cfg => cfg.id !== 'congTrinh').forEach(cfg => {
    // tbTen: bổ sung tên thiết bị có trong tbData mà thiếu trong cats.tbTen
    if (cfg.id === 'tbTen') {
      const haveKeys = new Set((cats.tbTen || []).map(n => normalizeKey(n)));
      const toAdd = [];
      tbData.filter(t => !t.deletedAt && t.ten).forEach(t => {
        const k = normalizeKey(t.ten);
        if (k && !haveKeys.has(k)) {
          haveKeys.add(k);
          toAdd.push(normalizeName('tbTen', t.ten));
        }
      });
      if (toAdd.length) {
        cats.tbTen = [...(cats.tbTen || []), ...toAdd];
        if (typeof window.saveCats === 'function') window.saveCats('tbTen');
      }
    }

    const fullList = cats[cfg.id] || [];
    const withIdxRaw = fullList.map((item, idx) => ({ item, idx }));

    // Dedup UI: gộp các entry cùng normalizeKey thành 1 dòng
    const dedupMap = new Map();
    withIdxRaw.forEach(entry => {
      const k = normalizeKey(entry.item);
      if (!k) return;
      const existing = dedupMap.get(k);
      if (!existing) { dedupMap.set(k, entry); return; }
      const canonical = normalizeName(cfg.id, entry.item);
      const currentIsCanonical = entry.item === canonical;
      const existingIsCanonical = existing.item === canonical;
      if (currentIsCanonical && !existingIsCanonical) dedupMap.set(k, entry);
    });

    // Lọc theo năm: tbTen luôn hiển thị 100%; các card khác lọc 3 trạng thái
    const allDeduped = [...dedupMap.values()];
    const filteredByYear = cfg.id === 'tbTen'
      ? allDeduped
      : allDeduped.filter(({ item }) => {
          const usedInYear = _isDmItemUsedInYear(cfg.id, item);
          if (usedInYear) return true;
          const usedAnytime = _isDmItemUsedAnytime(cfg.id, item);
          return !usedAnytime;
        });

    const filtered = filteredByYear.sort((a, b) => (a.item || '').localeCompare(b.item || '', 'vi'));
    const countLabel = `${filtered.length}`;
    const card = document.createElement('div');
    card.className = 'settings-card';
    card.innerHTML = `
      <div class="settings-card-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="settings-card-title">${cfg.title} <span style="font-size:11px;font-weight:400;color:var(--ink3)">(${countLabel})</span></div>
        <input type="search" id="dm-search-${cfg.id}" placeholder="🔍 Tìm..." autocomplete="off"
          style="flex:0 0 auto;width:140px;padding:4px 8px;border:1.5px solid var(--line2);border-radius:6px;font-family:inherit;font-size:12px;background:var(--paper);color:var(--ink);outline:none"
          oninput="_dmFilterCard('${cfg.id}')">
      </div>
      <div class="settings-list" id="sl-${cfg.id}">
        ${filtered.map(({ item, idx }) =>
          cfg.id === 'congNhan'  ? renderCNItem(item, idx) :
          cfg.id === 'congTrinh' ? renderCTItem(item, idx) :
          cfg.id === 'tbTen'     ? renderTbTenItem(item, idx) :
          renderItem(cfg.id, item, idx)
        ).join('')}
      </div>
      <div class="settings-add">
        <input type="text" id="sa-${cfg.id}" placeholder="Thêm mới..." onkeydown="if(event.key==='Enter')addItem('${cfg.id}')">
        <button class="btn btn-gold btn-sm" onclick="addItem('${cfg.id}')">+ Thêm</button>
      </div>`;
    grid.appendChild(card);
  });

  // Render panel sao lưu
  if (typeof window.renderBackupList === 'function') window.renderBackupList();
}

// ══════════════════════════════════════════════════════════════
// SETTINGS: ITEM CRUD
// ══════════════════════════════════════════════════════════════

function isItemInUse(catId, item) {
  const nk = normalizeKey;
  const nItem = nk(item);
  const cats = window.cats || {};
  const ungRecords = window.ungRecords || [];
  const ccData = window.ccData || [];
  const tbData = window.tbData || [];
  const CATS = window.CATS || [];
  const invs = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];

  if (catId === 'tbTen') return tbData.some(t => !t.deletedAt && nk(t.ten) === nItem);

  const cfg = CATS.find(c => c.id === catId);
  if (!cfg || !cfg.refField) {
    if (catId === 'congNhan') return ccData.some(w => !w.deletedAt && w.workers
      && w.workers.some(wk => nk(wk.name) === nItem));
    return false;
  }

  if (invs.some(i => nk(i[cfg.refField] || '') === nItem)) return true;
  if (catId === 'thauPhu') {
    if (ungRecords.some(r => !r.deletedAt && (r.loai || 'thauphu') === 'thauphu'
        && nk(r.tp || '') === nItem)) return true;
  }
  if (catId === 'nhaCungCap') {
    if (ungRecords.some(r => !r.deletedAt && (r.loai || 'thauphu') === 'thauphu'
        && nk(r.tp || '') === nItem)) return true;
  }
  if (catId === 'congNhan') {
    if (ungRecords.some(r => !r.deletedAt && r.loai === 'congnhan'
        && nk(r.tp || '') === nItem)) return true;
  }
  if (catId === 'congTrinh') {
    if (ungRecords.some(r => !r.deletedAt && nk(r.congtrinh || '') === nItem)) return true;
    if (ccData.some(w => !w.deletedAt && nk(w.ct || '') === nItem)) return true;
    if (tbData.some(r => !r.deletedAt && nk(r.ct || '') === nItem)) return true;
  }
  return false;
}

function startEdit(catId, idx) {
  document.getElementById(`sn-${catId}-${idx}`).classList.add('off');
  const e = document.getElementById(`se-${catId}-${idx}`);
  e.classList.add('on'); e.focus(); e.select();
}

function cancelEdit(catId, idx) {
  document.getElementById(`se-${catId}-${idx}`).classList.remove('on');
  document.getElementById(`sn-${catId}-${idx}`).classList.remove('off');
}

function finishEdit(catId, idx) {
  // congTrinh không được đổi tên qua danh mục — dùng Tab Công Trình
  if (catId === 'congTrinh') {
    cancelEdit(catId, idx);
    if (typeof window.toast === 'function') window.toast('💡 Đổi tên công trình tại Tab Công Trình → nhấn ✏️ trên project', 'info');
    return;
  }
  const cats = window.cats || {};
  const inp = document.getElementById(`se-${catId}-${idx}`);
  let newVal = normalizeName(catId, inp.value);
  if (!newVal) { cancelEdit(catId, idx); return; }
  inp.value = newVal;
  const old = cats[catId][idx];
  if (newVal === old) { cancelEdit(catId, idx); return; }
  const normNew = normalizeKey(newVal);
  const isDup = cats[catId].some((existing, i) => i !== idx && normalizeKey(existing) === normNew);
  if (isDup) {
    if (typeof window.toast === 'function') window.toast(`⚠️ "${newVal}" đã tồn tại trong danh mục!`, 'error');
    cancelEdit(catId, idx); return;
  }
  cats[catId][idx] = newVal;
  const normOld = normalizeKey(old);
  const CATS = window.CATS || [];
  const cfg = CATS.find(c => c.id === catId);

  const invoices = window.invoices || [];
  const ungRecords = window.ungRecords || [];
  const ccData = window.ccData || [];
  const tbData = window.tbData || [];
  const thauPhuContracts = window.thauPhuContracts || [];
  const thuRecords = window.thuRecords || [];
  const hopDongData = window.hopDongData || {};
  const cnRoles = window.cnRoles || {};

  if (cfg && cfg.refField) {
    invoices.forEach(inv => {
      if (normalizeKey(inv[cfg.refField] || '') === normOld) inv[cfg.refField] = newVal;
    });
    if (catId === 'nguoiTH' || catId === 'nhaCungCap' || catId === 'thauPhu') {
      ungRecords.forEach(r => {
        if ((r.loai || 'thauphu') === 'thauphu' && normalizeKey(r.tp || '') === normOld) r.tp = newVal;
      });
    }
    if (catId === 'congNhan') {
      ungRecords.forEach(r => {
        if (r.loai === 'congnhan' && normalizeKey(r.tp || '') === normOld) r.tp = newVal;
      });
    }
  }
  if (catId === 'tbTen') {
    tbData.forEach(t => { if (normalizeKey(t.ten || '') === normOld) t.ten = newVal; });
    if (typeof window.save === 'function') window.save('tb_v1', tbData);
    try { if (typeof window.tbRefreshNameDl === 'function') window.tbRefreshNameDl(); } catch(e) {}
    try { if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels(); } catch(e) {}
    try { if (typeof window.tbRenderList === 'function') window.tbRenderList(); } catch(e) {}
    try { if (typeof window.renderKhoTong === 'function') window.renderKhoTong(); } catch(e) {}
    try { if (typeof window.tbRenderThongKeVon === 'function') window.tbRenderThongKeVon(); } catch(e) {}
  }
  if (catId === 'thauPhu') {
    thauPhuContracts.forEach(r => { if (normalizeKey(r.thauphu || '') === normOld) r.thauphu = newVal; });
    if (typeof window.save === 'function') window.save('thauphu_v1', thauPhuContracts);
  }
  if (catId === 'nguoiTH') {
    thuRecords.forEach(r => { if (normalizeKey(r.nguoi || '') === normOld) r.nguoi = newVal; });
    if (typeof window.save === 'function') window.save('thu_v1', thuRecords);
    Object.values(hopDongData).forEach(hd => { if (normalizeKey(hd.nguoi || '') === normOld) hd.nguoi = newVal; });
    if (typeof window.save === 'function') window.save('hopdong_v1', hopDongData);
  }
  if (catId === 'congNhan') {
    ccData.forEach(week => {
      (week.workers || []).forEach(wk => { if (normalizeKey(wk.name || '') === normOld) wk.name = newVal; });
    });
    if (typeof window.save === 'function') window.save('cc_v2', ccData);
    const oldKey = Object.keys(cnRoles).find(k => normalizeKey(k) === normOld);
    if (oldKey !== undefined) {
      cnRoles[newVal] = cnRoles[oldKey];
      delete cnRoles[oldKey];
      if (typeof window.save === 'function') window.save('cat_cn_roles', cnRoles);
    }
  }
  if (typeof window.saveCats === 'function') window.saveCats(catId);
  if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
  if (typeof window.save === 'function') {
    window.save('inv_v3', invoices);
    window.save('ung_v1', ungRecords);
  }
  renderSettings();
  if (typeof window.updateTop === 'function') window.updateTop();
  try { if (typeof window.dtPopulateSels === 'function') window.dtPopulateSels(); } catch(e) {}
  if (typeof window.toast === 'function') window.toast('✅ Đã cập nhật "' + newVal + '"', 'success');
}

function addItem(catId) {
  if (catId === 'congTrinh') {
    const inp = document.getElementById(`sa-${catId}`);
    if (inp) inp.value = '';
    if (typeof window.toast === 'function') window.toast('💡 Thêm công trình tại Tab Công Trình (nút + Thêm CT mới)', 'info');
    return;
  }
  const cats = window.cats || {};
  const inp = document.getElementById(`sa-${catId}`);
  let val = normalizeName(catId, inp.value);
  if (!val) return;
  const normVal = normalizeKey(val);
  const isDup = (cats[catId] || []).some(existing => normalizeKey(existing) === normVal);
  if (isDup) {
    if (typeof window.toast === 'function') window.toast(`⚠️ "${val}" đã tồn tại trong danh mục!`, 'error');
    return;
  }
  cats[catId].push(val);
  if (typeof window.saveCats === 'function') window.saveCats(catId);
  if (inp) inp.value = '';
  renderSettings();
  if (typeof window.rebuildEntrySelects === 'function') window.rebuildEntrySelects();
  if (typeof window.rebuildUngSelects === 'function') window.rebuildUngSelects();
  if (catId === 'congTrinh') {
    try { if (typeof window.populateCCCtSel === 'function') window.populateCCCtSel(); } catch(e) {}
    try { if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels(); } catch(e) {}
  }
  if (catId === 'tbTen') {
    try { if (typeof window.tbRefreshNameDl === 'function') window.tbRefreshNameDl(); } catch(e) {}
    try { if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels(); } catch(e) {}
  }
  if (catId === 'nguoiTH' || catId === 'thauPhu' || catId === 'nhaCungCap') {
    try { if (typeof window.dtPopulateSels === 'function') window.dtPopulateSels(); } catch(e) {}
  }
  if (typeof window.toast === 'function') window.toast(`✅ Đã thêm "${val}"`, 'success');
}

function delItem(catId, idx) {
  if (catId === 'congTrinh') {
    if (typeof window.toast === 'function') window.toast('💡 Quản lý công trình tại Tab Công Trình — đổi trạng thái thành "Đã quyết toán" để ẩn', 'info');
    return;
  }
  const cats = window.cats || {};
  const item = cats[catId][idx];
  if (isItemInUse(catId, item)) {
    const msg = catId === 'tbTen'
      ? '⚠️ Thiết bị đang được sử dụng trong công trình — không thể xóa.'
      : '⚠️ Mục này đã có dữ liệu, không thể xóa.';
    if (typeof window.toast === 'function') window.toast(msg, 'error');
    return;
  }
  if (!confirm(`Xóa "${item}" khỏi danh mục?`)) return;
  const ungRecords = window.ungRecords || [];
  if (catId === 'thauPhu') {
    window.ungRecords = ungRecords.filter(r => !(r.loai === 'thauphu' && r.tp === item));
  }
  if (catId === 'nhaCungCap') {
    window.ungRecords = ungRecords.filter(r => !(r.loai === 'nhacungcap' && r.tp === item));
  }
  if (catId === 'congNhan') {
    window.ungRecords = ungRecords.filter(r => !(r.loai === 'congnhan' && r.tp === item));
  }
  cats[catId].splice(idx, 1);
  if (typeof window.saveCats === 'function') window.saveCats(catId);
  if (typeof window.save === 'function') window.save('ung_v1', window.ungRecords);
  renderSettings();
  if (typeof window.rebuildEntrySelects === 'function') window.rebuildEntrySelects();
  if (typeof window.rebuildUngSelects === 'function') window.rebuildUngSelects();
  if (catId === 'congTrinh') {
    try { if (typeof window.populateCCCtSel === 'function') window.populateCCCtSel(); } catch(e) {}
    try { if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels(); } catch(e) {}
  }
  if (typeof window.toast === 'function') window.toast(`Đã xóa "${item}"`);
}

// ── Cập nhật vai trò CN từ Danh mục ──────────────────────────
function updateCNRole(idx, role) {
  const cats = window.cats || {};
  const name = cats.congNhan[idx];
  if (!name) return;
  const cnRoles = window.cnRoles || {};
  cnRoles[name] = role;
  if (typeof window.save === 'function') window.save('cat_cn_roles', cnRoles);
  syncCNRoles(name, role);
  if (typeof window.toast === 'function') window.toast(`✅ Đã cập nhật vai trò "${name}" → ${role || '—'}`, 'success');
}

function syncCNRoles(name, role) {
  const ccData = window.ccData || [];
  const curYear = window.activeYear || new Date().getFullYear();
  const prevYear = curYear - 1;
  let changed = false;
  ccData.forEach(week => {
    const yr = parseInt((week.fromDate || '').slice(0, 4));
    if (yr !== curYear && yr !== prevYear) return;
    (week.workers || []).forEach(wk => {
      if (wk.name === name) { wk.role = role; changed = true; }
    });
  });
  if (changed) {
    if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();
    if (typeof window.save === 'function') window.save('cc_v2', ccData);
  }
}

// ══════════════════════════════════════════════════════════════
// REBUILD ENTRY SELECTS — dropdown refresh cho form nhập hóa đơn
// ══════════════════════════════════════════════════════════════

function rebuildEntrySelects() {
  const cats = window.cats || {};
  document.querySelectorAll('#entry-tbody [data-f="ct"]').forEach(sel => {
    if (sel.tagName === 'SELECT') {
      const cur = sel.value;
      if (typeof window._buildProjOpts === 'function') {
        sel.innerHTML = window._buildProjOpts(cur, '-- Chọn --');
      }
    }
  });
  document.querySelectorAll('#entry-tbody [data-f="loai"]').forEach(sel => {
    if (sel.tagName === 'SELECT') {
      const cur = sel.value;
      sel.innerHTML = `<option value="">-- Chọn --</option>` +
        _dedupCatArr(cats.loaiChiPhi || []).map(v => `<option value="${escapeHtml(v)}" ${v === cur ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
    }
  });
  const _nguoiCombo = _dedupCatArr([...(cats.nguoiTH || []), ...(cats.congNhan || []), ...(cats.thauPhu || [])]);
  document.querySelectorAll('#entry-tbody [data-f="nguoi"]').forEach(inp => {
    const dl = document.getElementById(inp.getAttribute('list'));
    if (dl) dl.innerHTML = _nguoiCombo.map(v => `<option value="${escapeHtml(v)}">`).join('');
  });
  document.querySelectorAll('#entry-tbody [data-f="ncc"]').forEach(inp => {
    const dl = document.getElementById(inp.getAttribute('list'));
    if (dl) dl.innerHTML = _dedupCatArr(cats.nhaCungCap || []).map(v => `<option value="${escapeHtml(v)}">`).join('');
  });
}

// ══════════════════════════════════════════════════════════════
// SCAN & MIGRATE — format normalization (idempotent)
// ══════════════════════════════════════════════════════════════

function scanAndFixAllDataFormats() {
  const cats = window.cats || {};
  const canonMap = new Map();
  const addArr = arr => (arr || []).forEach(name => {
    const k = normalizeKey(name);
    if (k && !canonMap.has(k)) canonMap.set(k, name);
  });
  addArr(cats.loaiChiPhi); addArr(cats.nhaCungCap); addArr(cats.nguoiTH);
  addArr(cats.thauPhu);    addArr(cats.congNhan);   addArr(cats.tbTen);
  if (!canonMap.size) return;

  const fix = v => { const c = canonMap.get(normalizeKey(v || '')); return (c && c !== v) ? c : v; };

  const invoices = window.invoices || [];
  const ungRecords = window.ungRecords || [];
  const ccData = window.ccData || [];
  const tbData = window.tbData || [];
  const thauPhuContracts = window.thauPhuContracts || [];
  const thuRecords = window.thuRecords || [];
  const hopDongData = window.hopDongData || {};
  const cnRoles = window.cnRoles || {};

  let inv = false, ung = false, cc = false, tb = false, tp = false, thu = false, hd = false, roles = false;

  invoices.forEach(r => {
    ['loai', 'ncc', 'nguoi'].forEach(f => {
      if (!r[f]) return;
      const fixed = fix(r[f]);
      if (fixed !== r[f]) { r[f] = fixed; inv = true; }
    });
  });
  ungRecords.forEach(r => {
    if (!r.tp) return;
    const fixed = fix(r.tp);
    if (fixed !== r.tp) { r.tp = fixed; ung = true; }
  });
  (ccData || []).forEach(week => {
    (week.workers || []).forEach(wk => {
      if (!wk.name) return;
      const fixed = fix(wk.name);
      if (fixed !== wk.name) { wk.name = fixed; cc = true; }
    });
  });
  tbData.forEach(t => {
    if (!t.ten) return;
    const fixed = fix(t.ten);
    if (fixed !== t.ten) { t.ten = fixed; tb = true; }
  });
  thauPhuContracts.forEach(r => {
    if (!r.thauphu) return;
    const fixed = fix(r.thauphu);
    if (fixed !== r.thauphu) { r.thauphu = fixed; tp = true; }
  });
  thuRecords.forEach(r => {
    if (!r.nguoi) return;
    const fixed = fix(r.nguoi);
    if (fixed !== r.nguoi) { r.nguoi = fixed; thu = true; }
  });
  Object.values(hopDongData).forEach(hd_ => {
    if (!hd_.nguoi) return;
    const fixed = fix(hd_.nguoi);
    if (fixed !== hd_.nguoi) { hd_.nguoi = fixed; hd = true; }
  });
  const fixedRoles = {};
  Object.entries(cnRoles).forEach(([k, v]) => {
    const fk = fix(k) || k;
    if (!Object.prototype.hasOwnProperty.call(fixedRoles, fk)) fixedRoles[fk] = v;
    if (fk !== k) roles = true;
  });
  if (roles) {
    Object.keys(cnRoles).forEach(k => delete cnRoles[k]);
    Object.assign(cnRoles, fixedRoles);
    if (typeof window.save === 'function') window.save('cat_cn_roles', cnRoles);
  }

  if (typeof window.save === 'function') {
    if (inv)  { if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache(); window.save('inv_v3', invoices); }
    if (ung)  window.save('ung_v1', ungRecords);
    if (cc)   window.save('cc_v2', ccData);
    if (tb)   window.save('tb_v1', tbData);
    if (tp)   window.save('thauphu_v1', thauPhuContracts);
    if (thu)  window.save('thu_v1', thuRecords);
    if (hd)   window.save('hopdong_v1', hopDongData);
  }

  const n = [inv, ung, cc, tb, tp, thu, hd, roles].filter(Boolean).length;
  if (n) console.log(`[DM] scanAndFixAllDataFormats: đã chuẩn hóa ${n} bảng dữ liệu`);
}

let _catNamesMigrated = false;
function _migrateCatNamesFormat() {
  if (_catNamesMigrated) return;
  _catNamesMigrated = true;
  const cats = window.cats || {};
  let changed = false;
  ['loaiChiPhi', 'tbTen', 'nhaCungCap', 'nguoiTH', 'thauPhu', 'congNhan'].forEach(catId => {
    if (!Array.isArray(cats[catId])) return;
    const seen = new Set();
    const deduped = cats[catId]
      .map(n => normalizeName(catId, n))
      .filter(n => {
        const k = normalizeKey(n);
        return k && !seen.has(k) ? (seen.add(k), true) : false;
      });
    if (JSON.stringify(deduped) !== JSON.stringify(cats[catId])) {
      cats[catId] = deduped;
      if (typeof window.saveCats === 'function') window.saveCats(catId);
      changed = true;
    }
  });
  if (changed) console.log('[DM] _migrateCatNamesFormat: chuẩn hóa + dedup cats xong');
  scanAndFixAllDataFormats();
}

// ══════════════════════════════════════════════════════════════
// CT PAGE — renderCtPage, showCtModal, closeModal
// ══════════════════════════════════════════════════════════════

function renderCtPage() {
  const grid = document.getElementById('ct-grid');
  if (!grid) return;
  const map = {};
  const invs = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];
  const inAY = (d) => typeof window.inActiveYear === 'function' ? window.inActiveYear(d) : true;
  const resolveName = (r) => typeof window.resolveProjectName === 'function' ? window.resolveProjectName(r) : (r.congtrinh || '');
  const fmtS = typeof window.fmtS === 'function' ? window.fmtS : (n) => n;

  invs.forEach(inv => {
    if (!inAY(inv.ngay)) return;
    const ctKey = resolveName(inv) || '(Không rõ)';
    if (!map[ctKey]) map[ctKey] = { total: 0, count: 0, byLoai: {} };
    map[ctKey].total += (inv.thanhtien || inv.tien || 0); map[ctKey].count++;
    map[ctKey].byLoai[inv.loai] = (map[ctKey].byLoai[inv.loai] || 0) + (inv.thanhtien || inv.tien || 0);
  });
  const sortBy = (document.getElementById('ct-sort')?.value) || 'value';
  const entries = Object.entries(map).sort((a, b) =>
    sortBy === 'name' ? a[0].localeCompare(b[0], 'vi') : b[1].total - a[1].total
  );
  if (!entries.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--ink3);font-size:14px">Chưa có dữ liệu</div>`;
    return;
  }
  grid.innerHTML = entries.map(([ct, d]) => {
    const rows = Object.entries(d.byLoai).sort((a, b) => b[1] - a[1]);
    return `<div class="ct-card" onclick="showCtModal(${JSON.stringify(ct)})">
      <div class="ct-card-head">
        <div><div class="ct-card-name">${escapeHtml(ct)}</div><div class="ct-card-count">${d.count} hóa đơn</div></div>
        <div class="ct-card-total">${fmtS(d.total)}</div>
      </div>
      <div class="ct-card-body">
        ${rows.slice(0, 6).map(([l, v]) => `<div class="ct-loai-row"><span class="ct-loai-name">${escapeHtml(l)}</span><span class="ct-loai-val">${fmtS(v)}</span></div>`).join('')}
        ${rows.length > 6 ? `<div style="font-size:11px;color:var(--ink3);text-align:right;padding-top:6px">+${rows.length - 6} loại khác...</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function showCtModal(ctName) {
  const invs = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];
  const inAY = (d) => typeof window.inActiveYear === 'function' ? window.inActiveYear(d) : true;
  const resolveName = (r) => typeof window.resolveProjectName === 'function' ? window.resolveProjectName(r) : (r.congtrinh || '');
  const fmtM = typeof window.fmtM === 'function' ? window.fmtM : (n) => n;
  const numFmt = typeof window.numFmt === 'function' ? window.numFmt : (n) => n;

  const invFiltered = invs.filter(i => resolveName(i) === ctName && inAY(i.ngay));
  document.getElementById('modal-title').textContent = '🏗️ ' + ctName;
  const byLoai = {};
  invFiltered.forEach(inv => { if (!byLoai[inv.loai]) byLoai[inv.loai] = []; byLoai[inv.loai].push(inv); });
  const total = invFiltered.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  let html = `<div style="display:flex;gap:12px;margin-bottom:18px">
    <div style="flex:1;background:var(--bg);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tổng HĐ</div><div style="font-size:22px;font-weight:700">${invFiltered.length}</div></div>
    <div style="flex:2;background:var(--green-bg);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tổng Chi Phí</div><div style="font-size:20px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--green)">${fmtM(total)}</div></div>
  </div>`;
  Object.entries(byLoai).forEach(([loai, invList]) => {
    const lt = invList.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
    html += `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:var(--gold-bg);border-radius:6px;margin-bottom:6px">
        <span class="tag tag-gold">${escapeHtml(loai)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${fmtM(lt)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${['Ngày','Người TH','Nội Dung','Thành Tiền'].map((h, i) => `<th style="padding:5px 8px;background:#f3f1ec;font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;text-align:${i === 3 ? 'right' : 'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${invList.map(i => `<tr style="border-bottom:1px solid var(--line)">
          <td style="padding:6px 8px;font-family:'IBM Plex Mono',monospace;color:var(--ink2)">${i.ngay}</td>
          <td style="padding:6px 8px;color:var(--ink2)">${escapeHtml(i.nguoi || '—')}</td>
          <td style="padding:6px 8px;color:var(--ink2)">${escapeHtml(i.nd || '—')}</td>
          <td style="padding:6px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)">${numFmt(i.thanhtien || i.tien || 0)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  });
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('ct-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('ct-modal').classList.remove('open');
}

// ══════════════════════════════════════════════════════════════
// INIT SETTINGS — expose all window bridges
// ══════════════════════════════════════════════════════════════

export function initSettings() {
  window.renderSettings      = renderSettings;
  window.renderCtPage        = renderCtPage;
  window.showCtModal         = showCtModal;
  window.closeModal          = closeModal;
  window.renderCTItem        = renderCTItem;
  window.renderItem          = renderItem;
  window.renderCNItem        = renderCNItem;
  window.renderTbTenItem     = renderTbTenItem;
  window._dmFilterCard       = _dmFilterCard;
  window.startEdit           = startEdit;
  window.cancelEdit          = cancelEdit;
  window.finishEdit          = finishEdit;
  window.addItem             = addItem;
  window.isItemInUse         = isItemInUse;
  window.delItem             = delItem;
  window.updateCNRole        = updateCNRole;
  window.syncCNRoles         = syncCNRoles;
  window.rebuildEntrySelects = rebuildEntrySelects;
  window._dedupCatArr        = _dedupCatArr;
  window._migrateCatNamesFormat = _migrateCatNamesFormat;
  window.scanAndFixAllDataFormats = scanAndFixAllDataFormats;
}

// ── Bridge tạm ──────────────────────────────────────────────
window._settingsModule = {
  showDeleteConfirm,
  toolDeleteYear,
  toolResetAll,
  toolExportJSON,
  toolImportJSON,
  normalizeCatString,
  validateCatItem,
  dedupCatArr,
  addToCatArr,
  removeFromCatArr,
  renameCatItem,
  buildCatListHtml,
  initSettings,
  renderSettings,
  isItemInUse,
  rebuildEntrySelects,
};

// Expose for HTML onclick handlers (needed before bootstrap completes)
window.toolDeleteYear = toolDeleteYear;
window.toolResetAll   = toolResetAll;
window.toolExportJSON = toolExportJSON;
window.toolImportJSON = toolImportJSON;

console.log('[settings.module] ES Module loaded ✅');
