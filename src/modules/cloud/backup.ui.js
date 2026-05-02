// src/modules/cloud/backup.ui.js
// Backup Logic and UI (ported from core.js)

export function _legacySnapToStore(b) {
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

export function _countStore(store) {
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

export function _restoreStore(store) {
  const now = Date.now();
  Object.entries(store).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      v = v.map(r => (r && typeof r === 'object' && !r.id)
        ? { ...r, id: crypto.randomUUID(), updatedAt: r.updatedAt || now }
        : r);
    }
    if (window._memSet) window._memSet(k, v);
  });
}

const _BACKUP_MAX = 5;

export async function _getBackupStore() {
  let list = [];
  try {
    if (window._db && window._db.db) {
      const rec = await window._db.db.settings.get('backup_auto');
      if (rec && Array.isArray(rec.data)) list = rec.data;
    }
  } catch(e) { console.warn('[Backup] IDB read lỗi:', e); }
  if (!list.length && window._loadLS) {
    const lsList = window._loadLS('backup_auto');
    if (lsList && lsList.length) {
      list = lsList;
      await _setBackupStore(list);
      console.log('[Backup] Migrated', list.length, 'bản backup: LS → IDB');
    }
  }
  return list;
}

export async function _setBackupStore(list) {
  try {
    if (window._db && window._db.db) {
      await window._db.db.settings.put({ id: 'backup_auto', data: list, updatedAt: Date.now() });
    }
  } catch(e) {
    console.warn('[Backup] IDB write lỗi, fallback LS:', e);
    try { if (window._saveLS) window._saveLS('backup_auto', list); } catch(_) {}
  }
}

export async function _snapshotNow(label) {
  try {
    const store = {};
    const keys = window.BACKUP_KEYS || [];
    for (const k of keys) {
      const v = window.load ? window.load(k, null) : null;
      if (v !== null) store[k] = v;
    }
    const snap = {
      app: 'cpct', ver: window.DATA_VERSION || 4,
      _time: new Date().toISOString(), _label: label || 'auto', store,
    };
    const list = await _getBackupStore();
    list.unshift(snap);
    await _setBackupStore(list.slice(0, _BACKUP_MAX));
    return snap;
  } catch(e) { console.warn('[Backup] Lỗi:', e); return null; }
}

let _backupTimer = null;
export function autoBackup() {
  if (_backupTimer) clearInterval(_backupTimer);
  const mins = window.BACKUP_MINS || 30;
  setTimeout(() => {
    _snapshotNow('auto');
    _backupTimer = setInterval(() => {
      _snapshotNow('auto');
      console.log('[Backup] Auto snapshot lúc', new Date().toLocaleTimeString('vi-VN'));
    }, mins * 60 * 1000);
  }, 60 * 1000);
}

export async function getBackupList() {
  const list = await _getBackupStore();
  return list.map((b, i) => {
    const store  = b.store || _legacySnapToStore(b);
    const counts = _countStore(store);
    return { index: i, label: b._label || 'auto', time: b._time || '', ver: b.ver || b._ver || 0, counts };
  });
}

export async function restoreFromBackup(index) {
  const list = await _getBackupStore();
  const b    = list[index];
  if (!b) { window.toast('❌ Không tìm thấy bản backup này', 'error'); return; }
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
  if (window.migrateData) window.migrateData();
  if (window._reloadGlobals) window._reloadGlobals();
  if (window.buildYearSelect) window.buildYearSelect(); 
  if (window._refreshAllTabs) window._refreshAllTabs();
  if (window.rebuildEntrySelects) window.rebuildEntrySelects(); 
  if (window.rebuildUngSelects) window.rebuildUngSelects();
  if (window.renderSettings) window.renderSettings(); 
  if (window.updateTop) window.updateTop();
  window.toast('✅ Đã khôi phục bản backup lúc ' + time + '. Bấm 🔄 Sync để đồng bộ lên cloud.', 'success');
}

export async function renderBackupList() {
  const wrap = document.getElementById('backup-list-wrap');
  if (!wrap) return;
  const badge = document.getElementById('data-version-badge');
  if (badge) badge.textContent = 'v' + (window.DATA_VERSION || 4);
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

export function exportJSON() {
  const snap = {
    meta: { version: window.DATA_VERSION || 4, exportedAt: Date.now() },
    data: { ...window._mem },
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
  window.toast('✅ Đã xuất snapshot (' + c.inv + ' HĐ, ' + c.ung + ' tiền ứng, ' + c.cc + ' tuần CC)', 'success');
}

export function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const json = JSON.parse(e.target.result);
      if (!json || typeof json !== 'object') {
        window.toast('❌ File JSON không hợp lệ', 'error'); return;
      }
      const data = json.data || json.store || null;
      if (!data || !Object.keys(data).length) {
        window.toast('❌ File JSON không hợp lệ hoặc không phải snapshot của app này', 'error'); return;
      }
      const c    = _countStore(data);
      const ts   = json.meta?.exportedAt
        ? new Date(json.meta.exportedAt).toLocaleString('vi-VN')
        : (json._time ? new Date(json._time).toLocaleString('vi-VN') : '(không rõ)');

      _showImportJSONConfirm({ data, c, ts });
    } catch(err) {
      window.toast('❌ Lỗi đọc file JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

export function _showImportJSONConfirm({ data, c, ts }) {
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

export async function importJSONFull(data) {
  const ov = document.getElementById('import-json-overlay');
  if (ov) ov.style.display = 'none';

  if (!data || !Object.keys(data).length) { window.toast('❌ Dữ liệu không hợp lệ', 'error'); return; }

  try { window._syncPulling = true; } catch(_) {}
  try { window._syncPushing = true; } catch(_) {}

  try {
    if (typeof window.showSyncBanner === 'function') window.showSyncBanner('⏳ Đang khôi phục snapshot...');

    if (window._db && window._db.db) {
      await Promise.all(window._db.db.tables.map(t => t.clear()));
    }
    if (window._mem) Object.keys(window._mem).forEach(k => delete window._mem[k]);

    const now = Date.now();
    const clean = {};
    for (const key of Object.keys(data)) {
      let val = data[key];
      if (Array.isArray(val)) {
        val = val.map(r => ({
          ...r,
          id:        r.id        || crypto.randomUUID(),
          updatedAt: r.updatedAt || now,
        }));
        if (window.dedupById) val = window.dedupById(val);
        if (key === 'cc_v2' && typeof window._dedupCC === 'function') val = window._dedupCC(val);
      }
      clean[key] = val;
    }

    const writes = [];
    for (const [key, val] of Object.entries(clean)) {
      if (window._mem) window._mem[key] = val;
      if (window.dbSave) writes.push(window.dbSave(key, val));
    }
    await Promise.all(writes);

    localStorage.setItem('_blockPullUntil', String(Date.now() + 2 * 60 * 60 * 1000));

    if (typeof window.fbReady === 'function' && window.fbReady()) {
      try {
        window._syncPulling = false;
        window._syncPushing = false;
        if (window.pushChanges) await window.pushChanges({ silent: true, skipPull: true });
      } catch(e) {
        console.warn('[Import] Push cloud lỗi:', e);
      }
    }

    location.reload();

  } catch(e) {
    console.error('[Import] Lỗi:', e);
    window.toast('❌ Lỗi khôi phục: ' + (e.message || String(e)), 'error');
    try { window._syncPulling = false; } catch(_) {}
    try { window._syncPushing = false; } catch(_) {}
    if (typeof window.hideSyncBanner === 'function') window.hideSyncBanner();
  }
}

// Window bridges
window._legacySnapToStore = _legacySnapToStore;
window._countStore = _countStore;
window._restoreStore = _restoreStore;
window._getBackupStore = _getBackupStore;
window._setBackupStore = _setBackupStore;
window._snapshotNow = _snapshotNow;
window.autoBackup = autoBackup;
window.getBackupList = getBackupList;
window.restoreFromBackup = restoreFromBackup;
window.renderBackupList = renderBackupList;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window._showImportJSONConfirm = _showImportJSONConfirm;
window.importJSONFull = importJSONFull;
