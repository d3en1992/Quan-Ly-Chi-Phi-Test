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

// ── Stub wrappers (full logic in sync.js legacy) ─────────────
export function fbPushAll() {
  console.log('[fbPushAll] No-op — dùng manualSync()');
}

export function gsLoadAll(callback) {
  if (typeof window.pullChanges === 'function') {
    const yr = window.activeYear || new Date().getFullYear();
    window.pullChanges(yr, d => callback(d ? d : null));
    return;
  }
  console.warn('[gsLoadAll] sync.js chưa load — pull bị bỏ qua');
  if (callback) callback(null);
}

// ── Bridge tạm ──────────────────────────────────────────────
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
};

// Direct globals
window._getAllLocalYears = getAllLocalYears;
window.schedulePush     = schedulePush;
window._incPending      = incPending;
window._resetPending    = resetPending;
window._pendingChanges  = 0; // backwards compat reference
window._updateSyncBtnBadge = updateSyncBtnBadge;
window.compressInv = compressInv;
window.expandInv   = expandInv;
window.compressCC  = compressCC;
window.expandCC    = expandCC;
window.compressUng = compressUng;
window.expandUng   = expandUng;
window.compressTb  = compressTb;
window.expandTb    = expandTb;
window.fsWrap      = fsWrap;
window.fsUnwrap    = fsUnwrap;
window.fbDocYear   = fbDocYear;
window.fbDocCats   = fbDocCats;
window.fbYearPayload  = fbYearPayload;
window.fbCatsPayload  = fbCatsPayload;
window.fsUrl       = fsUrl;
window.fsGet       = fsGet;
window.fsSet       = fsSet;
window.fbReady     = fbReady;
window.estimateYearKb = estimateYearKb;
window.fbPushAll   = fbPushAll;
window.gsLoadAll   = gsLoadAll;
window.DEVICE_ID   = DEVICE_ID;
window.blockPullUntil = blockPullUntil;
window.isPullBlocked  = isPullBlocked;
window.softDeleteRecord = softDeleteRecord;
window.stampNew    = stampNew;
window.stampEdit   = stampEdit;
window.resolveConflict = resolveConflict;
window.mergeDatasets   = mergeDatasets;
window.mergeUsersSafe  = mergeUsersSafe;

console.log('[sync.js core] ES Module loaded ✅');
