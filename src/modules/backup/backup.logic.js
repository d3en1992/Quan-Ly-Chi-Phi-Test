// ══════════════════════════════════════════════════════════════
// src/modules/backup/backup.logic.js — Backup Logic
// Prompt 9 — ES Modules Refactor
// Auto-backup, exportJSON, importJSON (từ main.js + core.js)
// ══════════════════════════════════════════════════════════════

const BACKUP_LS_KEY    = 'backup_auto';
const BACKUP_INTERVAL  = 30 * 60 * 1000; // 30 phút

// ── Snapshot to localStorage ─────────────────────────────────
export function snapshotNow(tag) {
  try {
    const keys = [
      'inv_v3','ung_v1','cc_v2','tb_v1','thu_v1',
      'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
      'projects_v1','hopdong_v1','thauphu_v1','trash_v1'
    ];
    const snapshot = {};
    keys.forEach(k => {
      const val = typeof window.load === 'function' ? window.load(k, null) : null;
      if (val !== null) snapshot[k] = val;
    });
    const entry = {
      ts:      Date.now(),
      tag:     tag || 'auto',
      version: typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : 2,
      data:    snapshot
    };
    localStorage.setItem(BACKUP_LS_KEY, JSON.stringify(entry));
    console.log(`[Backup] Snapshot: ${tag || 'auto'} (${Object.keys(snapshot).length} keys)`);
    return entry;
  } catch (e) {
    console.warn('[Backup] Snapshot lỗi:', e);
    return null;
  }
}

// ── Auto-backup every 30 min ─────────────────────────────────
let _backupTimer = null;

export function startAutoBackup() {
  if (_backupTimer) return;
  snapshotNow('auto-startup');
  _backupTimer = setInterval(() => snapshotNow('auto'), BACKUP_INTERVAL);
  console.log('[Backup] Auto-backup bắt đầu (30 phút/lần)');
}

export function stopAutoBackup() {
  clearInterval(_backupTimer);
  _backupTimer = null;
}

export function isAutoBackupRunning() { return !!_backupTimer; }

// ── Get last snapshot ────────────────────────────────────────
export function getLastSnapshot() {
  try {
    const raw = localStorage.getItem(BACKUP_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Export JSON ──────────────────────────────────────────────
export function exportJSONData() {
  const keys = [
    'inv_v3','ung_v1','cc_v2','tb_v1','thu_v1',
    'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
    'projects_v1','hopdong_v1','thauphu_v1','trash_v1'
  ];
  const out = { version: 2, exportedAt: Date.now(), data: {} };
  keys.forEach(k => {
    const val = typeof window.load === 'function' ? window.load(k, null) : null;
    if (val !== null) out.data[k] = val;
  });
  return out;
}

export function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename || `backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import JSON validation ───────────────────────────────────
export function validateImportData(parsed) {
  if (!parsed || typeof parsed !== 'object') return { valid: false, error: 'File JSON không hợp lệ' };
  if (!parsed.data || typeof parsed.data !== 'object')
    return { valid: false, error: 'File không có trường "data"' };
  const keys = Object.keys(parsed.data);
  if (!keys.length) return { valid: false, error: 'File không chứa dữ liệu' };
  const validKeys = new Set([
    'inv_v3','ung_v1','cc_v2','tb_v1','thu_v1',
    'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
    'projects_v1','hopdong_v1','thauphu_v1','trash_v1','users_v1'
  ]);
  const found = keys.filter(k => validKeys.has(k));
  if (!found.length) return { valid: false, error: 'File không chứa key dữ liệu nào đã biết' };
  return { valid: true, keys: found };
}

// ── Apply imported data to store ─────────────────────────────
export async function applyImportData(importedData) {
  if (!importedData || !importedData.data) return { ok: false, error: 'Dữ liệu trống' };
  const { data } = importedData;
  let count = 0;
  for (const [k, v] of Object.entries(data)) {
    if (typeof window._memSet === 'function') {
      window._memSet(k, v);
      count++;
    } else if (typeof window.save === 'function') {
      window.save(k, v);
      count++;
    }
  }
  return { ok: true, count };
}

// ── Bridge tạm ──────────────────────────────────────────────
window._backupLogic = {
  snapshotNow,
  startAutoBackup,
  stopAutoBackup,
  isAutoBackupRunning,
  getLastSnapshot,
  exportJSONData,
  downloadJSON,
  validateImportData,
  applyImportData,
  BACKUP_LS_KEY,
  BACKUP_INTERVAL,
};

// Expose snapshotNow for datatools.js (calls _snapshotNow)
window._snapshotNow = snapshotNow;

console.log('[backup.logic] ES Module loaded ✅');
