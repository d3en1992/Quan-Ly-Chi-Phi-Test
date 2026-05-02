// ══════════════════════════════════════════════════════════════
// src/utils/dom.util.js — DOM helpers, Toast, CSV, Numpad
// Trích xuất từ: tienich.js (Prompt 1 — ES Modules Refactor)
// ══════════════════════════════════════════════════════════════

import { numFmt } from './math.util.js';

// ── Toast notification ──────────────────────────────────────

/**
 * Hiển thị toast notification
 * @param {string} msg - Nội dung thông báo
 * @param {string} type - CSS class bổ sung ('error', 'success', ''...)
 */
export function toast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (type ? type : '');
  t.classList.add('show');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── CSV download ────────────────────────────────────────────

/**
 * Tải xuống file CSV từ mảng 2D
 * @param {Array[]} rows - Mảng 2D (mỗi phần tử là 1 dòng)
 * @param {string} name - Tên file (VD: "data.csv")
 */
export function dlCSV(rows, name) {
  const csv = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}

// ══════════════════════════════════════════════════════════════
//  NUMPAD OVERLAY — bàn phím số mobile
// ══════════════════════════════════════════════════════════════

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

let _npTarget = null;
let _npRaw = '0';
let _npOp = null;
let _npLeft = null;

/**
 * Mở Numpad overlay cho một input element
 * @param {HTMLInputElement} inputEl - Ô input cần nhập
 * @param {string} label - Nhãn hiển thị trên numpad
 */
export function openNumpad(inputEl, label) {
  _npTarget = inputEl;
  let startVal;
  if (inputEl.classList.contains('cc-day-input')) {
    startVal = String(parseFloat(inputEl.value) || 0);
  } else if (inputEl.classList.contains('np-num-input')) {
    startVal = String(parseFloat(inputEl.value) || 0);
  } else {
    startVal = String(inputEl.dataset.raw || inputEl.value || '0');
  }
  _npRaw = (startVal && startVal !== '0') ? startVal : '0';
  if (!_npRaw) _npRaw = '0';
  _npOp = null; _npLeft = null;
  document.getElementById('numpad-label').textContent = label || 'Nhập số tiền';
  _npRefresh();
  document.getElementById('numpad-overlay').classList.add('open');
  inputEl.blur();
  inputEl.setAttribute('readonly', '');
}

/**
 * Đóng Numpad overlay
 */
export function closeNumpad() {
  document.getElementById('numpad-overlay').classList.remove('open');
  if (_npTarget) _npTarget.removeAttribute('readonly');
  _npTarget = null;
}

function _npCalcResult() {
  const isDay = _npTarget && _npTarget.classList.contains('cc-day-input');
  if (isDay) return parseFloat(_npRaw) || 0;
  const right = parseInt(_npRaw) || 0;
  if (_npLeft !== null && _npOp) {
    if (_npOp === '+') return _npLeft + right;
    if (_npOp === '−') return Math.max(0, _npLeft - right);
    if (_npOp === '×') return _npLeft * right;
    if (_npOp === '÷') return right ? Math.round(_npLeft / right) : _npLeft;
  }
  return parseInt(_npRaw) || 0;
}

function _npRefresh() {
  const txt = document.getElementById('numpad-text');
  if (!txt) return;
  const isDay = _npTarget && _npTarget.classList.contains('cc-day-input');
  if (isDay) {
    txt.textContent = _npRaw || '0';
    const saveBtn = document.getElementById('numpad-save-btn');
    if (saveBtn) saveBtn.textContent = 'Lưu  ' + (_npRaw || '0') + ' công';
    const keysEl = document.getElementById('numpad-keys');
    const dayKeysEl = document.getElementById('numpad-day-keys');
    const shortcutsEl2 = document.getElementById('numpad-shortcuts');
    if (keysEl) keysEl.style.display = 'none';
    if (dayKeysEl) dayKeysEl.style.display = 'grid';
    if (shortcutsEl2) shortcutsEl2.style.display = 'none';
  } else {
    const keysEl = document.getElementById('numpad-keys');
    const dayKeysEl = document.getElementById('numpad-day-keys');
    const shortcutsEl2 = document.getElementById('numpad-shortcuts');
    if (keysEl) keysEl.style.display = 'grid';
    if (dayKeysEl) dayKeysEl.style.display = 'none';
    if (shortcutsEl2) shortcutsEl2.style.display = 'flex';
    const raw = parseInt(_npRaw) || 0;
    if (_npLeft !== null && _npOp) {
      const leftFmt = numFmt(_npLeft);
      const rightStr = (_npRaw && _npRaw !== '0') ? numFmt(parseInt(_npRaw) || 0) : '?';
      txt.textContent = leftFmt + ' ' + _npOp + ' ' + rightStr;
    } else {
      txt.textContent = raw ? numFmt(raw) : '0';
    }
    const val = _npCalcResult();
    const saveBtn = document.getElementById('numpad-save-btn');
    if (saveBtn) saveBtn.textContent = val ? 'Lưu  ' + numFmt(val) : 'Lưu';
  }
}

/**
 * Xử lý nhấn phím trên Numpad
 * @param {string} k - Giá trị phím ('0'-'9', 'C', '⌫', '.', '000', '+', '−', '×', '÷')
 */
export function numpadKey(k) {
  const isDay = _npTarget && _npTarget.classList.contains('cc-day-input');
  if (k === 'C') {
    _npRaw = '0'; _npOp = null; _npLeft = null;
  } else if (k === '⌫') {
    _npRaw = _npRaw.length > 1 ? _npRaw.slice(0, -1) : '0';
  } else if (k === '.') {
    if (!_npRaw.includes('.')) _npRaw += '.';
  } else if (k === '000') {
    _npRaw = _npRaw === '0' ? '0' : _npRaw + '000';
  } else if (['÷', '×', '−', '+'].includes(k)) {
    if (!isDay) {
      if (_npLeft !== null && _npOp && _npRaw !== '0') {
        _npLeft = _npCalcResult(); _npRaw = '0';
      } else {
        _npLeft = parseInt(_npRaw) || 0; _npRaw = '0';
      }
      _npOp = k;
    }
  } else {
    if (isDay) {
      if (_npRaw === '0' && k !== '.') _npRaw = k;
      else _npRaw = _npRaw + k;
      if (_npRaw.length > 5) _npRaw = _npRaw.slice(0, 5);
    } else {
      _npRaw = _npRaw === '0' ? k : _npRaw + k;
      if (_npRaw.length > 12) _npRaw = _npRaw.slice(0, 12);
    }
  }
  _npRefresh();
}

/**
 * Shortcut cho ô ngày công — đặt giá trị rồi tự đóng
 */
export function _npSetDayVal(val) {
  _npRaw = String(val);
  _npOp = null; _npLeft = null;
  numpadDone();
}

/**
 * Thêm shortcut tiền (VD: +100k, +500k)
 */
export function numpadShortcut(amount) {
  const cur = _npCalcResult();
  _npRaw = String(cur + amount);
  _npOp = null; _npLeft = null;
  _npRefresh();
}

/**
 * Xác nhận và ghi giá trị numpad vào input target
 */
export function numpadDone() {
  const val = _npCalcResult();
  if (_npTarget) {
    const el = _npTarget;
    el.dataset.raw = val;
    const isCC = el.classList.contains('cc-wage-input');
    const isNum = el.classList.contains('np-num-input');

    if (el.classList.contains('cc-day-input')) {
      const rawStr = _npRaw || '0';
      const dayVal = parseFloat(rawStr) || 0;
      el.value = dayVal || '';
      el.classList.toggle('has-val', dayVal >= 1);
      el.classList.toggle('half-val', dayVal > 0 && dayVal < 1);
      el.dataset.raw = dayVal;
      const tr2 = el.closest('tr');
      if (tr2) try { onCCDayKey(el); calcCCRow(tr2); updateCCSumRow && updateCCSumRow(); } catch (e) { }
    } else if (isCC) {
      el.dataset.raw = val;
      el.value = val ? numFmt(val) : '';
      const tr2 = el.closest('tr');
      if (tr2) try { calcCCRow(tr2); updateCCSumRow && updateCCSumRow(); } catch (e) { }
    } else if (isNum) {
      el.value = val || '';
    } else {
      el.value = val ? numFmt(val) : '';
      const tr = el.closest('tr');
      if (tr) {
        const slEl = tr.querySelector('[data-f="sl"]');
        const thEl = tr.querySelector('[data-f="thtien"]');
        if (slEl && thEl) {
          const sl = parseFloat(slEl.value) || 1;
          const th = val * sl;
          thEl.textContent = th ? numFmt(th) : '';
          thEl.dataset.raw = th;
        }
      }
    }
    try { calcSummary(); } catch (e) { }
    try { calcUngSummary(); } catch (e) { }
  }
  closeNumpad();
}

/**
 * Kiểm tra element có phải ô số cần numpad không
 */
export function isNumpadTarget(el) {
  return el.classList.contains('tien-input') ||
    el.classList.contains('cc-wage-input') ||
    el.classList.contains('cc-day-input') ||
    el.classList.contains('np-num-input');
}

/**
 * Tạo label cho numpad dựa trên context của input
 */
export function buildNumpadLabel(el) {
  const tr = el.closest('tr');
  const ccAttr = el.dataset.cc;
  if (ccAttr) {
    if (ccAttr.startsWith('d')) {
      const name = tr?.querySelector('[data-cc="name"]')?.value || '';
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const idx = parseInt(ccAttr.slice(1));
      return (days[idx] || ccAttr) + (name ? ' — ' + name : '');
    }
    const labels = { luong: 'Lương/Ngày', phucap: 'Phụ Cấp', hdml: 'HĐ Mua Lẻ', loan: 'Vay Mới', tru: 'Trừ Nợ' };
    const name = tr?.querySelector('[data-cc="name"]')?.value || '';
    return (labels[ccAttr] || 'Nhập số') + (name ? ' — ' + name : '');
  }
  const tbAttr = el.dataset.tb;
  if (tbAttr === 'soluong') {
    const ten = tr?.querySelector('[data-tb="ten"]')?.value || '';
    return 'Số Lượng' + (ten ? ' — ' + ten : '');
  }
  if (el.id === 'tb-ei-sl') return 'Số Lượng';
  if (tr) {
    const loai = tr.querySelector('[data-f="loai"]')?.value || tr.querySelector('[data-f="tp"]')?.value || '';
    const ct = tr.querySelector('[data-f="ct"]')?.value || '';
    return [loai, ct].filter(Boolean).join(' · ') || 'Nhập số tiền';
  }
  return 'Nhập số';
}

// ── Native mobile numeric keyboard ─────────────────────────

export const NATIVE_NUMERIC_SELECTOR = [
  'input.tien-input',
  'input.cc-day-input',
  'input.cc-wage-input',
  'input.np-num-input',
  'input[type="number"]',
  '#hd-giatri',
  '#hd-phatsinh',
  '#thu-tien'
].join(',');

/**
 * Gán inputmode="decimal" cho tất cả ô số trong root
 */
export function applyNativeNumericInputMode(root) {
  const host = (root && root.querySelectorAll) ? root : document;
  host.querySelectorAll(NATIVE_NUMERIC_SELECTOR).forEach(el => {
    el.setAttribute('inputmode', 'decimal');
  });
}

// ── Keyboard Navigation (Enter / Ctrl+Enter / Shift+Enter) ──

/**
 * Khởi tạo keyboard navigation cho bảng nhập liệu
 * Enter = sang ô kế / xuống dòng, Ctrl+Enter = lưu, Shift+Enter = thêm dòng
 */
export function initKeyboardNav() {
  function isNumericInput(el) {
    return !!(
      el &&
      el.tagName === 'INPUT' &&
      !el.readOnly &&
      !el.disabled &&
      el.matches(NATIVE_NUMERIC_SELECTOR)
    );
  }
  function firstNumericInRow(tr) {
    if (!tr) return null;
    const inputs = Array.from(tr.querySelectorAll('input'));
    return inputs.find(isNumericInput) || null;
  }
  function nextNumericInSameRow(inputEl) {
    const tr = inputEl.closest('tr');
    const td = inputEl.closest('td,th');
    if (!tr || !td) return null;
    const cells = Array.from(tr.children).filter(c => c.matches && c.matches('td,th'));
    const idx = cells.findIndex(c => c === td || c.contains(inputEl));
    if (idx < 0) return null;
    for (let i = idx + 1; i < cells.length; i++) {
      const cand = Array.from(cells[i].querySelectorAll('input')).find(isNumericInput);
      if (cand) return cand;
    }
    return null;
  }
  function firstNumericInNextRows(inputEl) {
    let tr = inputEl.closest('tr');
    while (tr && tr.nextElementSibling) {
      tr = tr.nextElementSibling;
      const cand = firstNumericInRow(tr);
      if (cand) return cand;
    }
    return null;
  }
  function focusCell(el) {
    if (!el) return;
    el.focus();
    if (el.select) el.select();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const active = document.activeElement;
    if (!isNumericInput(active)) return;
    if (e.ctrlKey || e.metaKey) {
      if (active.closest('#entry-tbody')) {
        e.preventDefault();
        saveAllRows();
      } else if (active.closest('#ung-tbody')) {
        e.preventDefault();
        saveAllUngRows();
      }
      return;
    }
    if (e.shiftKey) {
      if (active.closest('#entry-tbody')) {
        e.preventDefault();
        addRows(1);
        setTimeout(() => {
          const last = document.querySelector('#entry-tbody tr:last-child');
          focusCell(firstNumericInRow(last));
        }, 50);
      } else if (active.closest('#ung-tbody')) {
        e.preventDefault();
        addUngRows(1);
        setTimeout(() => {
          const last = document.querySelector('#ung-tbody tr:last-child');
          focusCell(firstNumericInRow(last));
        }, 50);
      }
      return;
    }
    const tr = active.closest('tr');
    const td = active.closest('td,th');
    if (!tr || !td) return;
    e.preventDefault();
    const right = nextNumericInSameRow(active);
    if (right) { focusCell(right); return; }
    const down = firstNumericInNextRows(active);
    if (down) focusCell(down);
  });
}

// ── updateTop — render tổng CP ở topbar (from tienich.js) ──

/**
 * Cập nhật tổng chi phí hiển thị ở topbar
 */
export function updateTop() {
  if (typeof window.getInvoicesCached !== 'function') return;
  const invs = window.getInvoicesCached();
  const total = invs
    .filter(i => !i.deletedAt && (typeof window.inActiveYear === 'function' ? window.inActiveYear(i.ngay) : true))
    .reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  const txt = numFmt(total) + 'đ';
  ['top-total', 'top-total-mobile', 'top-total-header'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  });
}

// ── Sync UI helpers (from core.js) ──────────────────────────

/**
 * Cập nhật nút Cloud / Sync trên topbar
 */
export function updateJbBtn() {
  const btn = document.getElementById('jb-btn');
  if (!btn) return;
  const cfg = (typeof window._loadLS === 'function')
    ? window._loadLS('fb_config')
    : JSON.parse(localStorage.getItem('fb_config') || 'null');
  const connected = !!(cfg && cfg.projectId && cfg.apiKey);
  btn.classList.toggle('connected', connected);
  const full = btn.querySelector('.cloud-full');
  if (full) full.textContent = connected ? '☁️ ' + cfg.projectId.slice(0, 12) : '☁️ Cloud';
}

/** Đảm bảo sync-dot tồn tại trên nút sync */
export function ensureSyncDot() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  let dot = btn.querySelector('.sync-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'sync-dot';
    btn.appendChild(dot);
  }
  return dot;
}

/** Set trạng thái sync dot */
export function setSyncDot(state) {
  const dot = ensureSyncDot();
  if (!dot) return;
  dot.classList.remove('idle', 'syncing', 'error', 'pending');
  if (state) dot.classList.add(state);
}

/** Set trạng thái sync toàn diện */
export function setSyncState(state) {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  btn.classList.remove('syncing', 'error', 'success');
  if (state) btn.classList.add(state);
  setSyncDot(state);
}

/** Hiện sync banner */
export function showSyncBanner(msg, type) {
  let banner = document.getElementById('sync-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'sync-banner';
    banner.className = 'sync-banner';
    document.body.prepend(banner);
  }
  banner.textContent = msg || '';
  banner.className = 'sync-banner ' + (type || '');
  banner.classList.add('show');
  clearTimeout(banner._to);
  if (type !== 'syncing') {
    banner._to = setTimeout(() => banner.classList.remove('show'), 4000);
  }
}

/** Ẩn sync banner */
export function hideSyncBanner() {
  const banner = document.getElementById('sync-banner');
  if (banner) banner.classList.remove('show');
}

// ── Miscellaneous UI helpers (ported from core.js) ────────────

export function buildNDFromItems(items) {
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

// ── Autocomplete Helpers ──────────────────────────────────────

let _acCurrentInput = null;

export function acHide() {
  const dd = document.getElementById('_global-ac');
  if (dd) dd.style.display = 'none';
  _acCurrentInput = null;
}

export function acShow(inp, options, onSelect) {
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
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#_global-ac')) acHide();
    }, true);
  }
  const normFn = window._normViStr || ((s) => (s||'').toLowerCase());
  const q = normFn(inp.value);
  const filtered = options.filter(o => normFn(o).includes(q)).slice(0, 40);
  if (!filtered.length) { acHide(); return; }
  dd.innerHTML = filtered.map(o => {
    const safeO = o.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="_ac-item" style="padding:6px 12px;cursor:pointer;font-size:13px;white-space:nowrap;border-bottom:1px solid var(--line,#e8e6e0)">${safeO}</div>`;
  }).join('');
  dd.querySelectorAll('._ac-item').forEach((el, i) => {
    el.addEventListener('mousedown', e => { e.preventDefault(); onSelect(filtered[i]); acHide(); });
  });
  const r = inp.getBoundingClientRect();
  dd.style.left = r.left + 'px';
  dd.style.top  = (r.bottom + 2) + 'px';
  dd.style.minWidth = Math.max(180, r.width) + 'px';
  dd.style.display = 'block';
  _acCurrentInput = inp;
}

// ── Window bridges ──────────────────────────────────────────
window.toast             = toast;
window.dlCSV             = dlCSV;
window.openNumpad        = openNumpad;
window.closeNumpad       = closeNumpad;
window.numpadKey         = numpadKey;
window.numpadDone        = numpadDone;
window.numpadShortcut    = numpadShortcut;
window._npSetDayVal      = _npSetDayVal;
window.isNumpadTarget    = isNumpadTarget;
window.buildNumpadLabel  = buildNumpadLabel;
window.initKeyboardNav   = initKeyboardNav;
window.applyNativeNumericInputMode = applyNativeNumericInputMode;
window.updateTop         = updateTop;
window.updateJbBtn       = updateJbBtn;
window._ensureSyncDot    = ensureSyncDot;
window._setSyncDot       = setSyncDot;
window._setSyncState     = setSyncState;
window.showSyncBanner    = showSyncBanner;
window.hideSyncBanner    = hideSyncBanner;
window.buildNDFromItems  = buildNDFromItems;
window._acHide           = acHide;
window._acShow           = acShow;
window._acCurrentInput   = null;

console.log('[dom.util] ES Module loaded ✅');
