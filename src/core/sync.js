// ══════════════════════════════════════════════════════════════
// src/core/sync.js — Sync Engine (ES Module)
// Prompt 9 — ES Modules Refactor
// Pull/Push Firestore thuần — không chứa normalizeCC
// normalizeCC đã dời sang payroll.logic.js
// ══════════════════════════════════════════════════════════════

// ── Device Identity ──────────────────────────────────────────
export const DEVICE_ID = (() => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
    console.log('[Sync] 🆕 Device mới đăng ký:', id);
  }
  return id;
})();

// ── Record Stamping ──────────────────────────────────────────
export function stampNew(fields) {
  const now = Date.now();
  return {
    id:        crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId:  DEVICE_ID,
    ...fields,
  };
}

export function stampEdit(record) {
  return { ...record, updatedAt: Date.now(), deviceId: DEVICE_ID };
}

// ── Soft Delete ───────────────────────────────────────────────
export function softDeleteRecord(arr, id) {
  const now = Date.now();
  return arr.map(r =>
    String(r.id) === String(id)
      ? { ...r, deletedAt: now, updatedAt: now, deviceId: DEVICE_ID }
      : r
  );
}

// ── Conflict Resolution — tombstone priority, then LWW ──────
export function resolveConflict(local, cloud) {
  if (local.deletedAt && !cloud.deletedAt) return local;
  if (!local.deletedAt && cloud.deletedAt) return cloud;
  const lt = local.updatedAt || local.createdAt || local._ts || 0;
  const ct = cloud.updatedAt || cloud.createdAt || 0;
  if (lt !== ct) {
    console.log('[Sync] ⚔ Conflict id:', String(local.id).slice(0, 8),
      '| local:', lt, '| cloud:', ct, '| winner:', lt >= ct ? 'LOCAL' : 'CLOUD');
  }
  return lt >= ct ? local : cloud;
}

// ── Merge Algorithm ─────────────────────────────────────────
export function mergeDatasets(local, cloud) {
  const map = new Map();
  (local || []).forEach(r => map.set(String(r.id), r));
  (cloud || []).forEach(cloudR => {
    const key    = String(cloudR.id);
    const localR = map.get(key);
    map.set(key, localR ? resolveConflict(localR, cloudR) : cloudR);
  });
  return [...map.values()];
}

// ── Multi-year Helper ────────────────────────────────────────
export function getAllLocalYears() {
  const yrs = new Set();
  const addYr = (arr, field) =>
    (arr || []).forEach(r => { const d = r[field]; if (d && d.length >= 4) yrs.add(d.slice(0, 4)); });

  if (typeof load === 'function') {
    addYr(load('inv_v3', []), 'ngay');
    addYr(load('ung_v1', []), 'ngay');
    addYr(load('cc_v2',  []), 'fromDate');
    addYr(load('tb_v1',  []), 'ngay');
    addYr(load('thu_v1', []), 'ngay');
  }

  const activeYr = typeof activeYear !== 'undefined' ? activeYear : new Date().getFullYear();
  yrs.add(String(activeYr || new Date().getFullYear()));
  return [...yrs].filter(Boolean).sort();
}

// ── Timestamp sanitizer (for CC dedup) ──────────────────────
const _TS_EPOCH = 1577836800000; // 2020-01-01

export function safeTs(ts) {
  const n = typeof ts === 'number' ? ts : parseInt(ts) || 0;
  if (n < _TS_EPOCH) return 0;
  if (n > Date.now() + 86400000) return Date.now();
  return n;
}

// ── Merge key into _mem + IDB ────────────────────────────────
export function mergeKey(key, cloudExpanded) {
  if (!cloudExpanded || !cloudExpanded.length) return 0;
  if (typeof load !== 'function' || typeof _memSet !== 'function') return 0;
  const local  = load(key, []);
  const merged = mergeDatasets(local, cloudExpanded);
  _memSet(key, merged);
  return merged.length - local.length;
}

// ── Users merge (safe fallback) ──────────────────────────────
export function mergeUsersSafe(localUsers, cloudUsers) {
  if (typeof mergeUsers === 'function') return mergeUsers(localUsers, cloudUsers);
  const local = Array.isArray(localUsers) ? localUsers : [];
  const cloud = Array.isArray(cloudUsers) ? cloudUsers : [];
  const byId  = new Map();
  [...local, ...cloud].forEach((u, idx) => {
    if (!u) return;
    const id   = u.id || u.username || `legacy_${idx}`;
    const prev = byId.get(id);
    if (!prev || (Number(u.updatedAt) || 0) >= (Number(prev.updatedAt) || 0)) byId.set(id, u);
  });
  return [...byId.values()];
}

// ── Schedule push (lightweight debounce) ────────────────────
let _pushTimer = null;

export function schedulePush(delayMs = 2000) {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    if (typeof pushChanges === 'function' && typeof fbReady === 'function' && fbReady()) {
      pushChanges({ silent: true }).catch(e => console.warn('[Sync] schedulePush lỗi:', e));
    }
  }, delayMs);
}

// ── Pending changes counter (from core.js) ──────────────────
let _pendingChanges = 0;
const _SYNC_DATA_KEYS = new Set([
  'inv_v3','cc_v2','tb_v1','ung_v1','thu_v1',
  'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
  'projects_v1','hopdong_v1','thauphu_v1',
  'users_v1','cat_ct_years','cat_cn_roles','cat_items_v1',
]);

export function incPending() {
  _pendingChanges++;
  updateSyncBtnBadge();
}

export function resetPending() {
  _pendingChanges = 0;
  updateSyncBtnBadge();
}

export function getPendingCount() { return _pendingChanges; }

function updateSyncBtnBadge() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  let badge = btn.querySelector('.sync-badge');
  if (_pendingChanges > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sync-badge';
      btn.appendChild(badge);
    }
    badge.textContent = _pendingChanges > 99 ? '99+' : _pendingChanges;
    badge.style.display = '';
  } else if (badge) {
    badge.style.display = 'none';
  }
}

// ── Block pull helper ────────────────────────────────────────
export function blockPullUntil(ms) {
  localStorage.setItem('_blockPullUntil', String(ms));
}

export function isPullBlocked() {
  const until = parseInt(localStorage.getItem('_blockPullUntil') || '0');
  return until > Date.now();
}

// ══ NÉN / GIẢI NÉN (from core.js) ═══════════════════════════
export function compressInv(arr) {
  return arr.map(o=>{const r={};
    if(o.id!==undefined)r.i=o.id; if(o.ngay)r.d=o.ngay; if(o.congtrinh)r.c=o.congtrinh;
    if(o.projectId)r.pi=o.projectId; if(o.source)r.so=o.source;
    if(o.loai)r.l=o.loai; if(o.nguoi)r.n=o.nguoi; if(o.ncc)r.s=o.ncc; if(o.nd)r.t=o.nd;
    if(o.tien)r.p=o.tien; if(o.thanhtien&&o.thanhtien!==o.tien)r.q=o.thanhtien;
    if(o.sl&&o.sl!==1)r.k=o.sl; if(o.ccKey)r.x=o.ccKey;
    if(o.items&&o.items.length)r.it=o.items;
    if(o.footerCkStr)r.fck=o.footerCkStr;
    r.m=(o.updatedAt||o._ts)||undefined;
    if(o.createdAt)r.ca=o.createdAt; if(o.deletedAt)r.da=o.deletedAt;
    if(o.deviceId)r.dv=o.deviceId; return r;});
}
export function expandInv(arr) {
  return (arr||[]).map(o=>({id:o.i,ngay:o.d,congtrinh:o.c,projectId:o.pi||null,loai:o.l,nguoi:o.n||'',ncc:o.s||'',
    nd:o.t||'',tien:o.p||0,thanhtien:o.q||(o.p||0),sl:o.k||undefined,ccKey:o.x||undefined,
    source:o.so||undefined, items:o.it||undefined,footerCkStr:o.fck||undefined,
    updatedAt:o.m||undefined,_ts:o.m||undefined,
    createdAt:o.ca||undefined,deletedAt:o.da||null,deviceId:o.dv||undefined}));
}
export function compressCC(arr) {
  return (arr||[]).map(w=>({i:w.id,f:w.fromDate,e:w.toDate,c:w.ct,
    ...(w.projectId?{pi:w.projectId}:{}),
    a:w.updatedAt,ca:w.createdAt,da:w.deletedAt,dv:w.deviceId,
    w:w.workers.map(wk=>{const r={n:wk.name,d:wk.d,l:wk.luong};
      if(wk.phucap)r.p=wk.phucap; if(wk.hdmuale)r.h=wk.hdmuale; if(wk.nd)r.t=wk.nd;
      if(wk.tru)r.u=wk.tru; if(wk.loanAmount)r.lo=wk.loanAmount; return r;})}));
}
export function expandCC(arr) {
  return (arr||[]).map(w=>({id:w.i,fromDate:w.f,toDate:w.e,ct:w.c,projectId:w.pi||null,updatedAt:w.a,
    createdAt:w.ca||undefined,deletedAt:w.da||null,deviceId:w.dv||undefined,
    workers:(w.w||[]).map(wk=>({name:wk.n,d:wk.d,luong:wk.l||0,phucap:wk.p||0,hdmuale:wk.h||0,nd:wk.t||'',tru:wk.u||0,loanAmount:wk.lo||0}))}));
}
export function compressUng(arr) {
  return (arr||[]).map(o=>{const r={i:o.id,a:o.updatedAt,d:o.ngay,t:o.tp||o.ncc||'',c:o.congtrinh,p:o.tien||0,n:o.nd||''};
    if(o.projectId)r.pi=o.projectId;
    if(o.loai&&o.loai!=='thauphu')r.k=o.loai;
    if(o.createdAt)r.ca=o.createdAt; if(o.deletedAt)r.da=o.deletedAt;
    if(o.deviceId)r.dv=o.deviceId; return r;});
}
export function expandUng(arr) {
  return (arr||[]).map(o=>({id:o.i,updatedAt:o.a,ngay:o.d,tp:o.t,loai:o.k||'thauphu',congtrinh:o.c,projectId:o.pi||null,tien:o.p||0,nd:o.n||'',
    createdAt:o.ca||undefined,deletedAt:o.da||(o.cl?(o.a||Date.now()):null)||null,deviceId:o.dv||undefined}));
}
export function compressTb(arr) {
  return (arr||[]).map(o=>({i:o.id,c:o.ct,t:o.ten,s:o.soluong||0,r:o.tinhtrang,n:o.nguoi||'',g:o.ghichu||'',d:o.ngay||'',
    ...(o.projectId?{pi:o.projectId}:{}),
    m:o.updatedAt,ca:o.createdAt,da:o.deletedAt,dv:o.deviceId}));
}
export function expandTb(arr) {
  return (arr||[]).map(o=>({id:o.i,ct:o.c,ten:o.t,soluong:o.s||0,tinhtrang:o.r||'Đang hoạt động',nguoi:o.n||'',ghichu:o.g||'',ngay:o.d||'',
    projectId:o.pi||null,
    updatedAt:o.m||undefined,createdAt:o.ca||undefined,deletedAt:o.da||null,deviceId:o.dv||undefined}));
}

// ══ FIRESTORE HELPERS (from core.js) ═════════════════════════
export function fsWrap(obj) {
  return { fields: { data: { stringValue: JSON.stringify(obj) } } };
}
export function fsUnwrap(doc) {
  if (!doc || !doc.fields || !doc.fields.data) return null;
  try { return JSON.parse(doc.fields.data.stringValue); } catch { return null; }
}
export function fbDocYear(yr) { return `y${yr}`; }
export function fbDocCats() { return 'cats'; }

export function fsUrl(docId) {
  const base = typeof window.FS_BASE === 'function' ? window.FS_BASE() : '';
  const key = window.FB_CONFIG ? window.FB_CONFIG.apiKey : '';
  return `${base}/${docId}?key=${key}`;
}
export function fsGet(docId) {
  return fetch(fsUrl(docId)).then(r=>r.json());
}
export function fsSet(docId, payload) {
  return fetch(fsUrl(docId).split('?')[0] + '?key=' + (window.FB_CONFIG ? window.FB_CONFIG.apiKey : ''), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fsWrap(payload))
  }).then(r=>r.json());
}

export function fbReady() {
  const cfg = window.FB_CONFIG;
  return !!(cfg && cfg.apiKey && cfg.projectId);
}

export function estimateYearKb(yr) {
  const ys = String(yr || window.activeYear || new Date().getFullYear());
  const _load = window.load || ((k, d) => d);
  const data = {
    i: compressInv(_load('inv_v3',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    u: compressUng(_load('ung_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    c: compressCC(_load('cc_v2',[]).filter(x=>x.fromDate&&x.fromDate.startsWith(ys))),
  };
  return Math.round(JSON.stringify(data).length/1024*10)/10;
}

export function fbYearPayload(yr) {
  const _load = window.load || ((k, d) => d);
  const y = yr || window.activeYear || new Date().getFullYear();
  const ys = String(y);
  return { v:3, yr:y,
    i: compressInv(_load('inv_v3',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    u: compressUng(_load('ung_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    c: compressCC(_load('cc_v2',[]).filter(x=>x.fromDate&&x.fromDate.startsWith(ys))),
    t: compressTb(_load('tb_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys))),
    thu: _load('thu_v1',[]).filter(x=>x.ngay&&x.ngay.startsWith(ys)) };
}

export function fbCatsPayload() {
  const _load = window.load || ((k, d) => d);
  const _DEFAULTS = window.DEFAULTS || {};
  return { v:3,
    cats:{loai:_load('cat_loai',_DEFAULTS.loaiChiPhi||[]),
      ncc:_load('cat_ncc',_DEFAULTS.nhaCungCap||[]),nguoi:_load('cat_nguoi',_DEFAULTS.nguoiTH||[])},
    users: _load('users_v1', []),
    catItems: _load('cat_items_v1', {}),
    cnRoles:  _load('cat_cn_roles', {}),
    ctYears:  _load('cat_ct_years', {}),
    hopDong:  _load('hopdong_v1',  {}),
    thauPhu:  _load('thauphu_v1',  []),
    projects: _load('projects_v1', []),
  };
}

// ══════════════════════════════════════════════════════════════
// SYNC ENGINE — Push / Pull / Auto-sync
// Ported from sync.js legacy. All cross-module calls via window.*
// ══════════════════════════════════════════════════════════════

const LAST_SYNC_KEY = 'lastSyncAt';

// ── Sync state flags ────────────────────────────────────────
let _syncPushing = false;
let _syncPulling = false;
export function isSyncing() { return _syncPushing || _syncPulling; }

// ── Pending queue (localStorage) ────────────────────────────
const _PENDING_QUEUE_KEY = 'syncPending';

export function enqueueChange(recordId, type) {
  const _ls = window._loadLS;
  const _ss = window._saveLS;
  if (!_ls || !_ss) return;
  const q   = _ls(_PENDING_QUEUE_KEY) || [];
  const idx = q.findIndex(c => String(c.id) === String(recordId));
  const entry = { id: String(recordId), type, ts: Date.now() };
  if (idx >= 0) q[idx] = entry; else q.push(entry);
  if (q.length > 500) q.splice(0, q.length - 500);
  _ss(_PENDING_QUEUE_KEY, q);
}

export function _clearQueue() {
  if (window._saveLS) window._saveLS(_PENDING_QUEUE_KEY, []);
}

// ── Schedule push (full debounce version, overrides simple one) ─
export function cancelScheduledPush() {
  clearTimeout(_pushTimer);
  _pushTimer = null;
}

// Full 30s debounce — pull→push pipeline (replaces the 2s stub above)
// Exported as a new symbol; window.schedulePush is overridden in bridge below
function _schedulePushFull() {
  if (!fbReady()) return;
  if ((window._pendingChanges || 0) <= 0) return;
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    if (isSyncing()) {
      // đang sync → lùi 15s
      _pushTimer = setTimeout(_schedulePushFull, 15_000);
      return;
    }
    pullChanges(null, () => {
      if ((window._pendingChanges || 0) > 0) pushChanges({ silent: true });
    }, { silent: true });
  }, 30_000);
}

// ── CC dedup for sync (private — not exported) ───────────────
// Distinct from payroll normalizeCC; handles sync-specific dedup by (fromDate, projectId)
const _TS_EPOCH_SYNC = 1577836800000; // 2020-01-01
function _syncSafeTs(ts) {
  const n = typeof ts === 'number' ? ts : parseInt(ts) || 0;
  if (n < _TS_EPOCH_SYNC) return 0;
  if (n > Date.now() + 86400000) return Date.now();
  return n;
}
function _syncDeduplicateCC(records) {
  const projs = window.projects || [];
  const nameMap = new Map();
  projs.forEach(p => { if (p.id && p.name && !p.deletedAt) nameMap.set(p.name, p.id); });
  const filled = records.map(r => {
    if (r.projectId || !r.ct) return r;
    const pid = nameMap.get(r.ct);
    return pid ? { ...r, projectId: pid } : r;
  });
  const byKey = new Map();
  filled.forEach(r => {
    const key  = `${r.fromDate || r.from || ''}__${r.projectId || r.ct || ''}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, r); return; }
    const rTs   = _syncSafeTs(r.updatedAt   || r.createdAt || 0);
    const prevTs = _syncSafeTs(prev.updatedAt || prev.createdAt || 0);
    if (rTs > prevTs) byKey.set(key, r);
    else if (rTs === prevTs && r.deletedAt && !prev.deletedAt) byKey.set(key, r);
  });
  return [...byKey.values()];
}

// ── Internal helpers (all window.* at call-time) ─────────────
const _wLoad    = (k, d) => (window.load    || (() => d))(k, d);
const _wMemSet  = (k, v) => { if (typeof window._memSet === 'function') window._memSet(k, v); };
const _wSyncDot = s => { if (typeof window._setSyncDot  === 'function') window._setSyncDot(s); };
const _wSyncState = s => { if (typeof window._setSyncState === 'function') window._setSyncState(s); };
const _wEnsureDot = () => { if (typeof window._ensureSyncDot === 'function') window._ensureSyncDot(); };
const _wBanner    = (m, d) => { if (typeof window.showSyncBanner === 'function') window.showSyncBanner(m, d); };
const _wHideBanner = () => { if (typeof window.hideSyncBanner === 'function') window.hideSyncBanner(); };

// ══════════════════════════════════════════════════════════════
// PUSH — pull-then-merge-then-push, tất cả năm
// opts.silent   = true  → chạy ngầm, không banner
// opts.skipPull = true  → bỏ qua fetch+merge cloud (sau import JSON)
// ══════════════════════════════════════════════════════════════
export async function pushChanges(opts = {}) {
  const silent   = opts?.silent   ?? false;
  const skipPull = opts?.skipPull ?? false;
  if (!fbReady()) { console.log('[Sync] Push bỏ qua — Firebase chưa cấu hình'); return; }
  if (_syncPushing) { console.log('[Sync] Push bỏ qua — đang sync'); return; }
  _syncPushing = true;
  _wEnsureDot(); _wSyncDot('syncing');
  _wSyncState('syncing');
  if (!silent) _wBanner('⏳ Đang đẩy (push)...');

  const years = getAllLocalYears();
  console.log('[Sync] ▲ Push bắt đầu — năm:', years.join(', '), '| device:', DEVICE_ID.slice(0, 8));

  try {
    let ok = 0, fail = 0;

    for (const yr of years) {
      const yrInt = parseInt(yr);

      // Step 1: Fetch cloud để merge trước khi ghi
      if (!skipPull) try {
        const cloudDoc  = await fsGet(fbDocYear(yrInt));
        const cloudData = fsUnwrap(cloudDoc);
        if (cloudData) {
          if (cloudData.i) mergeKey('inv_v3', expandInv(cloudData.i));
          if (cloudData.u) mergeKey('ung_v1', expandUng(cloudData.u));
          if (cloudData.c) {
            const cloudCC    = expandCC(cloudData.c);
            const localCC    = _wLoad('cc_v2', []);
            const normalized = _syncDeduplicateCC([...localCC, ...cloudCC]);
            _wMemSet('cc_v2', normalized);
          }
          if (cloudData.t)   mergeKey('tb_v1',  expandTb(cloudData.t));
          if (cloudData.thu) mergeKey('thu_v1', cloudData.thu);
          console.log(`[Sync] ↓ Merged cloud year ${yr}`);
        }
      } catch (e) {
        console.warn(`[Sync] Không fetch được cloud year ${yr}:`, e.message || e);
      }

      // Step 2: Push merged local lên cloud
      try {
        const payload = fbYearPayload(yrInt);
        const kb      = Math.round(JSON.stringify(payload).length / 1024 * 10) / 10;
        const res     = await fsSet(fbDocYear(yrInt), payload);
        if (res && res.fields) {
          console.log(`[Sync] ▲ Year ${yr} OK (~${kb}kb)`);
          ok++;
        } else {
          const err = res?.error?.message || JSON.stringify(res?.error) || '?';
          console.warn(`[Sync] ✗ Year ${yr} lỗi:`, err);
          fail++;
        }
      } catch (e) {
        console.warn(`[Sync] ✗ Year ${yr} exception:`, e.message || e);
        fail++;
      }
    }

    // Cats
    try {
      const catsDoc  = await fsGet(fbDocCats());
      const catsData = fsUnwrap(catsDoc);
      if (catsData?.users) {
        const mergedUsers = mergeUsersSafe(_wLoad('users_v1', []), catsData.users);
        _wMemSet('users_v1', mergedUsers);
      }
    } catch (e) {
      console.warn('[Sync] Users pre-push merge lỗi:', e.message || e);
    }
    fsSet(fbDocCats(), fbCatsPayload()).catch(e => console.warn('[Sync] Cats push lỗi:', e));

    if (fail === 0) {
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      _clearQueue();
      _wSyncDot('');
      if (typeof window.resetPending === 'function') window.resetPending();
      else if (typeof window._resetPending === 'function') window._resetPending();
      if (!silent) {
        _wSyncState('success');
        const hhmm = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        _wBanner(`✅ Đã đồng bộ lúc ${hhmm}`, 3000);
      } else {
        if (typeof window.updateJbBtn === 'function') window.updateJbBtn();
      }
      console.log(`[Sync] ▲ Push xong — ${ok} năm | device: ${DEVICE_ID.slice(0, 8)}`);
    } else {
      _wSyncDot('error'); _wSyncState('error');
      _wBanner('⚠️ Sync lỗi', 4000);
    }
  } catch (e) {
    console.warn('[Sync] ▲ Push lỗi toàn bộ:', e);
    _wSyncDot('offline'); _wSyncState('error');
    _wBanner('⚠️ Mất kết nối internet', 3000);
  } finally {
    _syncPushing = false;
  }
}

// ══════════════════════════════════════════════════════════════
// PULL — merge cloud vào local, tất cả năm
// opts.silent = true → chạy ngầm (auto-sync)
// ══════════════════════════════════════════════════════════════
export async function pullChanges(yr, callback, opts = {}) {
  const silent = opts?.silent ?? false;
  if (!fbReady()) {
    console.log('[Sync] Pull bỏ qua — Firebase chưa cấu hình');
    if (callback) callback(null);
    return;
  }
  if (_syncPulling) {
    console.log('[Sync] Pull bỏ qua — đang pull');
    if (callback) callback(null);
    return;
  }
  _syncPulling = true;

  // Block pull sau reset
  {
    const _lsBlock  = parseInt(localStorage.getItem('_blockPullUntil') || '0');
    const _blockEnd = _lsBlock;
    if (Date.now() < _blockEnd) {
      const remain = Math.round((_blockEnd - Date.now()) / 1000);
      console.log(`[Sync] Pull bị chặn sau reset — còn ${remain}s`);
      _syncPulling = false;
      if (callback) callback(null);
      return;
    }
    if (_lsBlock && Date.now() >= _lsBlock) localStorage.removeItem('_blockPullUntil');
  }

  let _catsChanged = false;
  const years = yr ? [String(yr)] : getAllLocalYears();
  console.log('[Sync] ▼ Pull bắt đầu — năm:', years.join(', '), '| device:', DEVICE_ID.slice(0, 8));
  if (!silent) _wBanner('⬇ Đang tải (pull)...');

  try {
    // ── Cats ──────────────────────────────────────────────────
    try {
      const catsDoc  = await fsGet(fbDocCats());
      const catsData = fsUnwrap(catsDoc);
      if (catsData?.cats) {
        const ct = catsData.cats;
        const hasPending = (window._pendingChanges || 0) > 0;
        if (!hasPending) {
          const _over = (key, arr) => { if (arr) _wMemSet(key, arr.slice()); };
          if (ct.loai)  _over('cat_loai',  ct.loai);
          if (ct.ncc)   _over('cat_ncc',   ct.ncc);
          if (ct.nguoi) _over('cat_nguoi', ct.nguoi);
        } else {
          console.log('[Sync] Cats pull bỏ qua — còn pending changes');
        }
      }
      if (catsData?.hopDong && typeof catsData.hopDong === 'object') {
        const localHd  = _wLoad('hopdong_v1', {});
        const cloudHd  = catsData.hopDong;
        const mergedHd = { ...cloudHd };
        Object.entries(localHd).forEach(([ct, local]) => {
          const cloud = mergedHd[ct];
          if (!cloud || (local.updatedAt || 0) >= (cloud.updatedAt || 0)) mergedHd[ct] = local;
        });
        _wMemSet('hopdong_v1', mergedHd);
        if (typeof window.hopDongData !== 'undefined') window.hopDongData = mergedHd;
      }
      if (catsData?.thauPhu && Array.isArray(catsData.thauPhu)) {
        const local  = _wLoad('thauphu_v1', []);
        const merged = mergeDatasets(local, catsData.thauPhu);
        _wMemSet('thauphu_v1', merged);
        if (typeof window.thauPhuContracts !== 'undefined') window.thauPhuContracts = merged;
      }
      if (catsData?.users && Array.isArray(catsData.users)) {
        const mergedUsers = mergeUsersSafe(_wLoad('users_v1', []), catsData.users);
        _wMemSet('users_v1', mergedUsers);
        console.log('[Sync] ▼ users_v1 merged');
      }
      if (catsData?.catItems && typeof catsData.catItems === 'object') {
        const localItems = _wLoad('cat_items_v1', {});
        const cloudItems = catsData.catItems;
        const merged = {};
        const _normKey = s => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
          .replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,' ').trim();
        const nowMs = Date.now();
        const allTypes = new Set([...Object.keys(localItems), ...Object.keys(cloudItems)]);
        allTypes.forEach(type => {
          const byId = new Map();
          (localItems[type] || []).forEach(item => byId.set(item.id, item));
          (cloudItems[type] || []).forEach(cloudItem => {
            const localItem = byId.get(cloudItem.id);
            if (!localItem || (cloudItem.updatedAt || 0) >= (localItem.updatedAt || 0)) {
              byId.set(cloudItem.id, cloudItem);
            }
          });
          const byNorm = new Map();
          [...byId.values()]
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .forEach(item => {
              if (item.isDeleted) return;
              const norm = _normKey(item.name);
              if (byNorm.has(norm)) {
                byId.set(item.id, { ...item, isDeleted: true, updatedAt: nowMs });
              } else {
                byNorm.set(norm, item.id);
              }
            });
          merged[type] = [...byId.values()];
        });
        _wMemSet('cat_items_v1', merged);
        const nameArr = items => {
          const seen = new Set();
          return (items || []).filter(i => !i.isDeleted).map(i => i.name)
            .filter(n => { const k = _normKey(n); return seen.has(k) ? false : (seen.add(k), true); });
        };
        if (merged.loai)  _wMemSet('cat_loai',  nameArr(merged.loai));
        if (merged.ncc)   _wMemSet('cat_ncc',   nameArr(merged.ncc));
        if (merged.nguoi) _wMemSet('cat_nguoi', nameArr(merged.nguoi));
        if (merged.tp)    _wMemSet('cat_tp',    nameArr(merged.tp));
        if (merged.cn)    _wMemSet('cat_cn',    nameArr(merged.cn));
        if (merged.tbteb) _wMemSet('cat_tbteb', nameArr(merged.tbteb));
        console.log('[Sync] ▼ catItems merged — soft-deletes applied');
      }
      if (catsData?.projects && Array.isArray(catsData.projects)) {
        const local  = _wLoad('projects_v1', []);
        const merged = mergeDatasets(local, catsData.projects);
        _wMemSet('projects_v1', merged);
        if (typeof window.projects !== 'undefined') window.projects = merged;
        if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
      }
      if (catsData?.cnRoles && typeof catsData.cnRoles === 'object') {
        const hasPendingRoles = (window._pendingChanges || 0) > 0;
        if (!hasPendingRoles) {
          const localRoles  = _wLoad('cat_cn_roles', {});
          const cloudRoles  = catsData.cnRoles;
          const mergedRoles = { ...cloudRoles };
          Object.keys(cloudRoles).forEach(k => { if (!(k in localRoles)) mergedRoles[k] = cloudRoles[k]; });
          Object.assign(mergedRoles, localRoles);
          _wMemSet('cat_cn_roles', mergedRoles);
          if (typeof window.cnRoles !== 'undefined') window.cnRoles = mergedRoles;
          _catsChanged = true;
        }
      }
      if (catsData?.ctYears && typeof catsData.ctYears === 'object') {
        const localYears  = _wLoad('cat_ct_years', {});
        const mergedYears = { ...localYears };
        Object.entries(catsData.ctYears).forEach(([ct, yr2]) => {
          if (!(ct in mergedYears)) mergedYears[ct] = yr2;
        });
        _wMemSet('cat_ct_years', mergedYears);
        if (window.cats) window.cats.congTrinhYears = mergedYears;
        _catsChanged = true;
      }
    } catch (e) {
      console.warn('[Sync] Cats pull lỗi:', e.message || e);
    }

    // ── Year data ──────────────────────────────────────────────
    let totalNew = 0, totalConflicts = 0;

    for (const yrStr of years) {
      try {
        const doc  = await fsGet(fbDocYear(parseInt(yrStr)));
        const data = fsUnwrap(doc);
        if (!data) { console.log(`[Sync] ▼ Year ${yrStr} chưa có trên cloud`); continue; }

        const mergeAndCount = (key, cloudExpanded) => {
          const local     = _wLoad(key, []);
          const merged    = mergeDatasets(local, cloudExpanded);
          const newRecs   = merged.filter(m => !local.find(l => String(l.id) === String(m.id))).length;
          const conflicts = cloudExpanded.filter(cr => {
            const lr = local.find(l => String(l.id) === String(cr.id));
            return lr && (lr.updatedAt || lr._ts || 0) !== (cr.updatedAt || 0);
          }).length;
          totalNew       += newRecs;
          totalConflicts += conflicts;
          _wMemSet(key, merged);
          if (newRecs || conflicts)
            console.log(`[Sync] ▼ ${key} year ${yrStr}: +${newRecs} mới, ${conflicts} conflict`);
        };

        if (data.i)   mergeAndCount('inv_v3', expandInv(data.i));
        if (data.u)   mergeAndCount('ung_v1', expandUng(data.u));
        if (data.c) {
          const cloudCC   = expandCC(data.c);
          const localCC   = _wLoad('cc_v2', []);
          const normalized = _syncDeduplicateCC([...localCC, ...cloudCC]);
          const newRecs    = normalized.filter(n => !localCC.find(l => String(l.id) === String(n.id))).length;
          const dupsRemoved = (localCC.length + cloudCC.length) - normalized.length;
          totalNew         += newRecs;
          _wMemSet('cc_v2', normalized);
          if (typeof window.ccData !== 'undefined') window.ccData = normalized;
          console.log(`[Sync] ▼ cc_v2 year ${yrStr}: +${newRecs} mới${dupsRemoved > 0 ? `, xóa ${dupsRemoved} bản trùng` : ''}`);
        }
        if (data.t)   mergeAndCount('tb_v1',  expandTb(data.t));
        if (data.thu) {
          mergeAndCount('thu_v1', data.thu);
          if (typeof window.thuRecords !== 'undefined') window.thuRecords = _wLoad('thu_v1', []);
        }
      } catch (e) {
        console.warn(`[Sync] Pull year ${yrStr} lỗi:`, e.message || e);
      }
    }

    if (!silent) _wHideBanner();
    console.log(`[Sync] ▼ Pull xong — ${totalNew} record mới, ${totalConflicts} conflicts${_catsChanged ? ', cats changed' : ''}`);
    if (callback) callback({ newRecords: totalNew, conflicts: totalConflicts, catsChanged: _catsChanged });
    if (typeof window.afterSync === 'function') window.afterSync();
  } catch (e) {
    console.warn('[Sync] ▼ Pull lỗi toàn bộ:', e);
    if (!silent) _wHideBanner();
    if (callback) callback(null);
  } finally {
    _syncPulling = false;
  }
}

// ══════════════════════════════════════════════════════════════
// AUTO SYNC — Pull mỗi 5 phút + visibilitychange
// ══════════════════════════════════════════════════════════════
export function startAutoSync() {
  if (!fbReady()) return;

  // Pull định kỳ 5 phút
  setInterval(() => {
    if (isSyncing()) return;
    pullChanges(null, result => {
      if (result && (result.newRecords > 0 || result.catsChanged)) {
        if (typeof window.afterDataChange === 'function') window.afterDataChange();
        else {
          if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
          if (typeof window.renderActiveTab === 'function') window.renderActiveTab();
        }
      }
    }, { silent: true });
  }, 5 * 60 * 1000);

  // visibilitychange: ẩn → push ngay; hiện → pull ngầm
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(_pushTimer);
      _pushTimer = null;
      if (fbReady() && !isSyncing() && (window._pendingChanges || 0) > 0) {
        pushChanges({ silent: true });
      }
    } else {
      if (fbReady() && !isSyncing()) {
        setTimeout(() => {
          if (isSyncing()) return;
          pullChanges(null, result => {
            if (result && (result.newRecords > 0 || result.catsChanged)) {
              if (typeof window.afterDataChange === 'function') window.afterDataChange();
              else {
                if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
                if (typeof window.renderActiveTab === 'function') window.renderActiveTab();
              }
            }
          }, { silent: true });
        }, 1500);
      }
    }
  });
  console.log('[Sync] Auto-sync: pull 5 phút + debounce 30s + visibilitychange flush');
}

// ══════════════════════════════════════════════════════════════
// MANUAL SYNC — nút 🔄 Sync: pull → push → reload → refresh UI
// ══════════════════════════════════════════════════════════════
export async function manualSync() {
  if (!navigator.onLine) {
    if (typeof window.toast === 'function') window.toast('🔴 Không có mạng — không thể sync', 'error');
    return;
  }
  if (!fbReady()) {
    if (typeof window.toast === 'function') window.toast('Chưa kết nối Firebase', 'error');
    return;
  }
  if (isSyncing()) {
    if (typeof window.toast === 'function') window.toast('Đang sync, vui lòng chờ...', 'info');
    return;
  }
  const _sBtns = ['sync-btn', 'jb-btn'].map(id => document.getElementById(id)).filter(Boolean);
  _sBtns.forEach(b => { b.disabled = true; b.style.opacity = '.6'; });
  try {
    await new Promise(resolve => pullChanges(null, resolve));
    if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
    else if (typeof window.clearAllCache === 'function') window.clearAllCache();
    await pushChanges({ silent: false });
    if (typeof window.afterDataChange === 'function') window.afterDataChange();
    else if (typeof window.renderActiveTab === 'function') window.renderActiveTab();
    else if (typeof window._refreshAllTabs === 'function') window._refreshAllTabs();
  } finally {
    _sBtns.forEach(b => { b.disabled = false; b.style.opacity = ''; });
  }
}

// processQueue — no-op (sync theo batch qua manualSync)
export function processQueue() { /* no-op */ }

// ── Real fbPushAll (compat alias → manualSync) ───────────────
export function fbPushAll() {
  manualSync().catch(e => console.warn('[fbPushAll] lỗi:', e));
}

// gsLoadAll — pull all years then callback
export function gsLoadAll(callback) {
  if (!fbReady()) {
    console.warn('[gsLoadAll] Firebase chưa cấu hình');
    if (callback) callback(null);
    return;
  }
  pullChanges(null, result => {
    if (callback) callback(result ? result : null);
  }, { silent: true });
}

// ══════════════════════════════════════════════════════════════
// BRIDGES — expose all functions to window
// ══════════════════════════════════════════════════════════════
window._syncCore = {
  DEVICE_ID, stampNew, stampEdit, softDeleteRecord,
  resolveConflict, mergeDatasets, getAllLocalYears, safeTs,
  mergeKey, mergeUsersSafe, schedulePush,
  compressInv, expandInv, compressCC, expandCC,
  compressUng, expandUng, compressTb, expandTb,
  fsWrap, fsUnwrap, fbDocYear, fbDocCats,
  fbYearPayload, fbCatsPayload, fsUrl, fsGet, fsSet,
  fbReady, estimateYearKb, fbPushAll, gsLoadAll,
  incPending, resetPending, getPendingCount,
  isSyncing, enqueueChange, _clearQueue,
  pushChanges, pullChanges, startAutoSync, manualSync, processQueue,
  cancelScheduledPush,
};

// Direct globals (primitives — load-time safe)
window.DEVICE_ID          = DEVICE_ID;
window.stampNew           = stampNew;
window.stampEdit          = stampEdit;
window.softDeleteRecord   = softDeleteRecord;
window.resolveConflict    = resolveConflict;
window.mergeDatasets      = mergeDatasets;
window.mergeUsersSafe     = mergeUsersSafe;
window._getAllLocalYears  = getAllLocalYears;
window.getAllLocalYears   = getAllLocalYears;
window.blockPullUntil    = blockPullUntil;
window.isPullBlocked     = isPullBlocked;
window._incPending       = incPending;
window._resetPending     = resetPending;
window.getPendingCount   = getPendingCount;
window._updateSyncBtnBadge = updateSyncBtnBadge;
window.compressInv = compressInv; window.expandInv   = expandInv;
window.compressCC  = compressCC;  window.expandCC    = expandCC;
window.compressUng = compressUng; window.expandUng   = expandUng;
window.compressTb  = compressTb;  window.expandTb    = expandTb;
window.fsWrap      = fsWrap;      window.fsUnwrap    = fsUnwrap;
window.fbDocYear   = fbDocYear;   window.fbDocCats   = fbDocCats;
window.fbYearPayload  = fbYearPayload;
window.fbCatsPayload  = fbCatsPayload;
window.fsUrl       = fsUrl; window.fsGet = fsGet; window.fsSet = fsSet;
window.fbReady     = fbReady;
window.estimateYearKb = estimateYearKb;
window.fbPushAll      = fbPushAll;
window.gsLoadAll      = gsLoadAll;

// Sync engine (registered after all ESM modules load — bootstrap calls startAutoSync)
window.isSyncing          = isSyncing;
window.enqueueChange      = enqueueChange;
window._clearQueue        = _clearQueue;
window.cancelScheduledPush = cancelScheduledPush;
window.pushChanges        = pushChanges;
window.pullChanges        = pullChanges;
window.startAutoSync      = startAutoSync;
window.manualSync         = manualSync;
window.processQueue       = processQueue;
// Override schedulePush with full 30s version
window.schedulePush       = _schedulePushFull;
window._pendingChanges    = 0; // backwards compat reference

console.log('[sync.js core] ES Module loaded ✅ — pushChanges/pullChanges/startAutoSync active');
