// ══════════════════════════════════════════════════════════════
// src/modules/backup/backup.ui.js — Backup UI Helpers
// Prompt 9 — ES Modules Refactor
// Nút tải/khôi phục JSON (từ core.js + main.js)
// ══════════════════════════════════════════════════════════════

import {
  exportJSONData,
  downloadJSON,
  validateImportData,
  applyImportData,
  snapshotNow,
  getLastSnapshot,
} from './backup.logic.js';

// ── Export button handler ────────────────────────────────────
export function handleExportJSON() {
  try {
    const payload  = exportJSONData();
    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `qlct-backup-${dateStr}.json`;
    downloadJSON(payload, filename);
    if (typeof toast === 'function') toast('✅ Đã xuất file JSON', 'success');
  } catch (e) {
    console.error('[Backup] Export lỗi:', e);
    if (typeof toast === 'function') toast('❌ Lỗi xuất file: ' + (e.message || String(e)), 'error');
  }
}

// ── Import file handler ───────────────────────────────────────
export async function handleImportJSON(file) {
  if (!file) return;
  try {
    const text   = await file.text();
    const parsed = JSON.parse(text);
    const check  = validateImportData(parsed);
    if (!check.valid) {
      if (typeof toast === 'function') toast('❌ ' + check.error, 'error');
      return;
    }
    const result = await applyImportData(parsed);
    if (!result.ok) {
      if (typeof toast === 'function') toast('❌ ' + (result.error || 'Lỗi nhập dữ liệu'), 'error');
      return;
    }
    if (typeof toast === 'function')
      toast(`✅ Đã nhập ${result.count} key từ file JSON`, 'success');
    // Reload global state from _mem
    if (typeof _reloadGlobals === 'function') _reloadGlobals();
    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();
  } catch (e) {
    console.error('[Backup] Import lỗi:', e);
    if (typeof toast === 'function') toast('❌ Lỗi đọc file: ' + (e.message || String(e)), 'error');
  }
}

// ── Build backup status HTML ─────────────────────────────────
export function buildBackupStatusHtml() {
  const snap = getLastSnapshot();
  if (!snap) return '<span style="color:var(--ink3);font-size:12px">Chưa có backup</span>';

  const dt      = new Date(snap.ts);
  const dateStr = dt.toLocaleDateString('vi-VN');
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const tag     = snap.tag || 'auto';

  return `<span style="color:var(--ink3);font-size:12px">
    Backup gần nhất: <b>${dateStr} ${timeStr}</b> (${tag})
  </span>`;
}

// ── Build backup panel HTML ───────────────────────────────────
export function buildBackupPanelHtml() {
  return `<div class="backup-panel" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
    <button class="btn btn-outline btn-sm" onclick="handleExportJSON()">
      ⬇️ Xuất JSON
    </button>
    <label class="btn btn-outline btn-sm" style="cursor:pointer">
      ⬆️ Nhập JSON
      <input type="file" accept=".json" style="display:none"
             onchange="handleImportJSON(this.files[0]);this.value=''">
    </label>
    <button class="btn btn-sm" style="background:var(--ink3);color:#fff"
            onclick="window._backupLogic.snapshotNow('manual');if(typeof toast==='function')toast('✅ Đã tạo snapshot','success')">
      📸 Snapshot
    </button>
    <div id="backup-status" style="margin-left:8px">${buildBackupStatusHtml()}</div>
  </div>`;
}

// ── Init Backup UI ───────────────────────────────────────────
export function initBackupUI() {
  // Expose handlers for inline onclick
  window.handleExportJSON = handleExportJSON;
  window.handleImportJSON = handleImportJSON;
}

// ── Bridge tạm ──────────────────────────────────────────────
window._backupUI = {
  handleExportJSON,
  handleImportJSON,
  buildBackupStatusHtml,
  buildBackupPanelHtml,
  initBackupUI,
};

// Expose for HTML onclick handlers
window.handleExportJSON = handleExportJSON;
window.handleImportJSON = handleImportJSON;

console.log('[backup.ui] ES Module loaded ✅');
