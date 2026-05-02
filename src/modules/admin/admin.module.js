// ══════════════════════════════════════════════════════════════
// src/modules/admin/admin.module.js — Admin & Data Tools
// Prompt 17 — Port từ datatools.js:
//   [5] Data Health Check  (scanDataIssues, fixDataIssues, toolDataHealth)
//   [6] Schema Migration   (dryRunMigration, normalizeProjectLinks,
//                           migrateIdsToUUID, toolUpgradeSchema)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  [5] DATA HEALTH CHECK
// ══════════════════════════════════════════════════════════════

const _DATE_NAME_RE         = /^\d{4}[-\/]\d{1,2}([-\/]\d{1,2})?$/;
const _PLACEHOLDER_CT_NAME  = 'DỮ LIỆU CẦN XỬ LÝ';

function _getCtText(r) {
  return (r.ct || r.congtrinh || '').trim();
}

function _isLegacyId(id) {
  if (typeof id !== 'string' && typeof id !== 'number') return false;
  const n = Number(id);
  return Number.isFinite(n) && n > 1e12;
}

// ── IDB-direct reader — đọc toàn bộ data bỏ qua activeYear ──
async function _readAllFromIDB() {
  const db = window.db;
  if (typeof db === 'undefined' || !db) {
    return {
      invoices:   Array.isArray(window.invoices)     ? [...window.invoices]     : [],
      attendance: Array.isArray(window.ccData)       ? [...window.ccData]       : [],
      equipment:  Array.isArray(window.tbData)       ? [...window.tbData]       : [],
      ung:        Array.isArray(window.ungRecords)   ? [...window.ungRecords]   : [],
      revenue:    Array.isArray(window.thuRecords)   ? [...window.thuRecords]   : [],
      trash:      Array.isArray(window.trash)        ? [...window.trash]        : [],
      projects:   Array.isArray(window.projects)     ? [...window.projects]     : [],
    };
  }

  const [inv, att, eq, un, rv] = await Promise.all([
    db.invoices   ? db.invoices.toArray()   : Promise.resolve([]),
    db.attendance ? db.attendance.toArray() : Promise.resolve([]),
    db.equipment  ? db.equipment.toArray()  : Promise.resolve([]),
    db.ung        ? db.ung.toArray()        : Promise.resolve([]),
    db.revenue    ? db.revenue.toArray()    : Promise.resolve([]),
  ]);

  let trashArr = [], projectsArr = [];
  if (db.settings) {
    const [trashRow, projRow] = await Promise.all([
      db.settings.get('trash').catch(() => null),
      db.settings.get('projects').catch(() => null),
    ]);
    trashArr    = (trashRow && Array.isArray(trashRow.data)) ? trashRow.data : [];
    projectsArr = (projRow  && Array.isArray(projRow.data))  ? projRow.data  : [];
  }

  return { invoices: inv, attendance: att, equipment: eq, ung: un, revenue: rv, trash: trashArr, projects: projectsArr };
}

/**
 * Quét toàn bộ dữ liệu từ IDB, trả về báo cáo lỗi.
 * @returns {Promise<{ dateNames, missingPid, legacyIds, ccDupes, total }>}
 */
async function scanDataIssues() {
  const all = await _readAllFromIDB();
  const inv = all.invoices.filter(r => !r.deletedAt);
  const cc  = all.attendance.filter(r => !r.deletedAt);
  const ung = all.ung.filter(r => !r.deletedAt);
  const tb  = all.equipment.filter(r => !r.deletedAt);
  const thu = all.revenue.filter(r => !r.deletedAt);

  const dateNames = [];
  const _checkDateName = (arr, src) => arr.forEach(r => {
    const ct = _getCtText(r);
    if (ct && _DATE_NAME_RE.test(ct)) dateNames.push({ id: r.id, src, ct });
  });
  _checkDateName(inv, 'inv'); _checkDateName(cc,  'cc');
  _checkDateName(ung, 'ung'); _checkDateName(tb,  'tb');
  _checkDateName(thu, 'thu');

  const missingPid = [];
  const _checkMissingPid = (arr, src) => arr.forEach(r => {
    const ct = _getCtText(r);
    if (ct && !r.projectId && !_DATE_NAME_RE.test(ct)) missingPid.push({ id: r.id, src, ct });
  });
  _checkMissingPid(inv, 'inv'); _checkMissingPid(cc,  'cc');
  _checkMissingPid(ung, 'ung'); _checkMissingPid(tb,  'tb');
  _checkMissingPid(thu, 'thu');

  const legacyIds = [];
  const _checkLegacy = (arr, src) => arr.forEach(r => {
    if (_isLegacyId(r.id)) legacyIds.push({ id: r.id, src });
  });
  _checkLegacy(inv, 'inv'); _checkLegacy(cc,  'cc');
  _checkLegacy(ung, 'ung'); _checkLegacy(tb,  'tb');
  _checkLegacy(thu, 'thu');

  const ccDupes = [];
  const ccSeen  = new Map();
  cc.forEach(r => {
    const pid = r.projectId || _getCtText(r) || '__unknown__';
    const key = (r.fromDate || '') + '|' + pid;
    if (!ccSeen.has(key)) ccSeen.set(key, []);
    ccSeen.get(key).push(r);
  });
  ccSeen.forEach((recs) => {
    if (recs.length > 1) {
      const sorted = [...recs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      sorted.slice(1).forEach(r => ccDupes.push({ id: r.id, src: 'cc', key: (r.fromDate||'') + '|' + (r.projectId||_getCtText(r)||'') }));
    }
  });

  return { dateNames, missingPid, legacyIds, ccDupes,
    total: dateNames.length + missingPid.length + legacyIds.length + ccDupes.length };
}

/**
 * Thực thi dọn dẹp dựa trên báo cáo từ scanDataIssues().
 * Backup trước khi sửa. Không xóa hard, chỉ soft-delete CC dupes.
 */
async function fixDataIssues(report) {
  if (typeof window._snapshotNow === 'function') await window._snapshotNow('pre-health-fix');

  const now   = Date.now();
  const devId = (typeof window.DEVICE_ID !== 'undefined') ? window.DEVICE_ID : '';

  const dateNameIds = new Set(report.dateNames.map(e => String(e.id)));
  const missingPids = new Set(report.missingPid.map(e => String(e.id)));
  const ccDupeIds   = new Set(report.ccDupes.map(e => String(e.id)));
  const idToCtMap   = {};
  [...report.dateNames, ...report.missingPid].forEach(e => { idToCtMap[String(e.id)] = e.ct; });

  let placeholderPid = null;
  if (report.dateNames.length > 0 && Array.isArray(window.projects)) {
    const existing = window.projects.find(p => !p.deletedAt && p.name === _PLACEHOLDER_CT_NAME);
    if (existing) {
      placeholderPid = existing.id;
    } else if (typeof window.mkRecord === 'function' && typeof window.save === 'function') {
      const ph = window.mkRecord({
        name: _PLACEHOLDER_CT_NAME, status: 'active',
        startDate: null, endDate: null,
        note: 'Dữ liệu nhập sai tên công trình — cần phân loại thủ công',
      });
      window.projects.push(ph);
      window.save('projects_v1', window.projects);
      if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
      placeholderPid = ph.id;
    }
  }

  const _fixRecord = r => {
    const sid = String(r.id);
    let updated = { ...r };
    if (dateNameIds.has(sid)) {
      if (updated.ct !== undefined)        updated.ct        = _PLACEHOLDER_CT_NAME;
      if (updated.congtrinh !== undefined) updated.congtrinh = _PLACEHOLDER_CT_NAME;
      updated.projectId = placeholderPid;
      updated.updatedAt = now;
      updated.deviceId  = devId;
    }
    if (missingPids.has(sid)) {
      const ctName = idToCtMap[sid] || _getCtText(r);
      const pid = typeof window.findProjectIdByName === 'function' ? window.findProjectIdByName(ctName) : null;
      if (pid) { updated.projectId = pid; updated.updatedAt = now; updated.deviceId = devId; }
    }
    return updated;
  };

  const _processArr = arr => arr.map(r => {
    const sid = String(r.id);
    if (ccDupeIds.has(sid) && !r.deletedAt)
      return { ...r, deletedAt: now, updatedAt: now, deviceId: devId };
    if (dateNameIds.has(sid) || missingPids.has(sid))
      return _fixRecord(r);
    return r;
  });

  const all  = await _readAllFromIDB();
  let stats  = { fixed: 0, dupeRemoved: 0 };

  const _persist = async (memKey, glob, arr) => {
    if (typeof window._dbSave === 'function') await window._dbSave(memKey, arr);
    if (typeof window._mem !== 'undefined') window._mem[memKey] = arr;
    if (typeof window[glob] !== 'undefined') window[glob] = arr;
  };

  { const before = all.invoices;   const after = _processArr(before); stats.fixed += after.filter((r,i) => r !== before[i]).length; if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache(); await _persist('inv_v3', 'invoices', after); }
  { const before = all.attendance; const after = _processArr(before); stats.dupeRemoved += after.filter((r,i) => r !== before[i] && r.deletedAt).length; stats.fixed += after.filter((r,i) => r !== before[i] && !r.deletedAt).length; await _persist('cc_v2', 'ccData', after); }
  { const before = all.ung;        const after = _processArr(before); stats.fixed += after.filter((r,i) => r !== before[i]).length; await _persist('ung_v1', 'ungRecords', after); }
  { const before = all.equipment;  const after = _processArr(before); stats.fixed += after.filter((r,i) => r !== before[i]).length; await _persist('tb_v1', 'tbData', after); }
  { const before = all.revenue;    const after = _processArr(before); stats.fixed += after.filter((r,i) => r !== before[i]).length; await _persist('thu_v1', 'thuRecords', after); }

  if (typeof window._incPending === 'function' && typeof window.schedulePush === 'function') {
    window._incPending(); window.schedulePush();
  }
  return stats;
}

// ── UI: toolDataHealth ───────────────────────────────────────
function toolDataHealth() {
  const existing = document.getElementById('_dh-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_dh-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,24,20,.55);z-index:9000;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';

  overlay.innerHTML = `
    <div style="background:var(--paper,#fff);border-radius:12px;width:100%;max-width:560px;
                max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 20px 60px rgba(0,0,0,.22);font-family:inherit">
      <div style="padding:16px 20px;border-bottom:1px solid var(--line,#e8e4da);
                  background:#f3f1ec;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:15px;font-weight:700">🩺 Kiểm Tra Sức Khỏe Dữ Liệu</div>
        <button onclick="document.getElementById('_dh-modal-overlay').remove()"
          style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--ink2,#888);
                 padding:2px 6px;border-radius:4px;line-height:1">✕</button>
      </div>
      <div id="_dh-body" style="overflow-y:auto;padding:20px;flex:1">
        <p style="color:var(--ink2,#666);font-size:13px;margin:0 0 16px">
          Quét tất cả bảng dữ liệu để phát hiện bản ghi lỗi, thiếu liên kết công trình
          hoặc chấm công trùng lặp.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button id="_dh-btn-scan" onclick="_dhRunScan()"
            style="background:var(--ink,#1a1814);color:#fff;border:none;border-radius:6px;
                   padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            🔍 Bắt đầu kiểm tra
          </button>
        </div>
        <div id="_dh-result" style="margin-top:20px"></div>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function _dhRunScan() {
  const btn = document.getElementById('_dh-btn-scan');
  const res = document.getElementById('_dh-result');
  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang đọc Database...'; }
  if (res) res.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;
                background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;color:#075985;font-size:13px">
      <span style="font-size:18px">⌛</span>
      <span>Đang đọc Database — quét tất cả các năm, có thể mất vài giây...</span>
    </div>`;
  await new Promise(r => setTimeout(r, 30));
  try {
    const report = await scanDataIssues();
    window._dhLastReport = report;
    _dhRenderReport(report);
  } catch (e) {
    if (res) res.innerHTML = `<div style="color:#c0392b;font-size:13px">❌ Lỗi khi quét: ${e.message}</div>`;
    console.error('[DataHealth] scan lỗi:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Quét lại'; }
  }
}

function _dhRenderReport(r) {
  const res = document.getElementById('_dh-result');
  if (!res) return;

  const _srcLabel = s => ({ inv:'Hóa đơn', cc:'Chấm công', ung:'Tiền ứng', tb:'Thiết bị', thu:'Thu tiền' }[s] || s);
  const _section = (icon, title, color, items, renderRow) => {
    if (!items.length) return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;
                  background:#f0fdf4;border:1px solid #bbf7d0;margin-bottom:10px">
        <span style="font-size:16px">✅</span>
        <span style="font-size:13px;color:#166534;font-weight:600">${title}: Không có lỗi</span>
      </div>`;
    return `
      <div style="border:1px solid ${color}33;border-radius:8px;overflow:hidden;margin-bottom:12px">
        <div style="background:${color}18;padding:10px 14px;display:flex;align-items:center;gap:8px;
                    border-bottom:1px solid ${color}33">
          <span style="font-size:16px">${icon}</span>
          <span style="font-size:13px;font-weight:700;color:${color}">${title}</span>
          <span style="margin-left:auto;background:${color};color:#fff;font-size:11px;font-weight:700;
                       padding:2px 8px;border-radius:10px">${items.length}</span>
        </div>
        <div style="padding:8px 14px;max-height:140px;overflow-y:auto">
          ${items.map(renderRow).join('')}
        </div>
      </div>`;
  };

  const html = `
    ${_section('📅','Tên CT là ngày tháng (dữ liệu rác)','#c0392b', r.dateNames, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         <b style="color:var(--ink)">${_srcLabel(e.src)}</b> — CT: <code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">${e.ct}</code>
       </div>`)}
    ${_section('🔗','Thiếu liên kết ProjectId','#e67e22', r.missingPid, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         <b style="color:var(--ink)">${_srcLabel(e.src)}</b> — <span style="color:#c0392b">${e.ct}</span>
       </div>`)}
    ${_section('🔢','ID dạng số cũ (Legacy)','#7f8c8d', r.legacyIds, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         <b style="color:var(--ink)">${_srcLabel(e.src)}</b> — id: <code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">${e.id}</code>
       </div>`)}
    ${_section('♊','Chấm công trùng lặp (cùng tuần + CT)','#8e44ad', r.ccDupes, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         Tuần: <code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">${(e.key||'').split('|')[0]}</code>
       </div>`)}
    ${r.total === 0
      ? `<div style="text-align:center;padding:20px;font-size:14px;color:#166534;font-weight:700">
           🎉 Dữ liệu sạch — không phát hiện vấn đề nào!
         </div>`
      : `<div style="margin-top:4px;padding:12px 14px;background:#fff8e1;border:1px solid #ffc107;
                     border-radius:8px;font-size:12px;color:#856404;line-height:1.6">
           ⚠ Ghi chú:<br>
           • <b>Tên CT là ngày</b> → sẽ gán vào công trình giữ chỗ "<b>${_PLACEHOLDER_CT_NAME}</b>"<br>
           • <b>Thiếu ProjectId</b> → tự động tìm khớp tên (có thể không tìm được nếu CT đã xóa)<br>
           • <b>Legacy ID</b> → chỉ ghi nhận, không tự sửa (cần migrate riêng)<br>
           • <b>CC trùng</b> → xóa mềm bản cũ hơn, giữ bản mới nhất<br>
           • App sẽ <b>tự backup</b> trước khi dọn dẹp
         </div>
         <div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end">
           <button onclick="document.getElementById('_dh-modal-overlay').remove()"
             style="padding:8px 16px;border:1px solid var(--line2,#ccc);border-radius:6px;
                    background:var(--bg,#f5f5f5);cursor:pointer;font-size:13px;font-family:inherit">Huỷ</button>
           <button onclick="_dhRunFix()"
             style="padding:8px 18px;border:none;border-radius:6px;background:#c0392b;color:#fff;
                    cursor:pointer;font-size:13px;font-weight:700;font-family:inherit">
             🧹 Bắt đầu dọn dẹp (${r.total - r.legacyIds.length} lỗi có thể sửa)
           </button>
         </div>`
    }`;
  res.innerHTML = html;
}

async function _dhRunFix() {
  const report = window._dhLastReport;
  if (!report) { if (typeof window.toast === 'function') window.toast('Chạy quét trước khi dọn dẹp', 'error'); return; }

  const fixable = {
    ...report, legacyIds: [],
    total: report.dateNames.length + report.missingPid.length + report.ccDupes.length,
  };
  if (fixable.total === 0) {
    if (typeof window.toast === 'function') window.toast('Không có lỗi nào có thể tự động sửa', 'error');
    return;
  }

  const res = document.getElementById('_dh-result');
  if (res) res.innerHTML += `<div style="margin-top:12px;color:var(--ink2,#888);font-size:13px">⏳ Đang dọn dẹp và backup...</div>`;

  try {
    const stats = await fixDataIssues(fixable);
    const overlay = document.getElementById('_dh-modal-overlay');
    if (overlay) overlay.remove();
    const msg = `✅ Dọn dẹp hoàn tất — ${stats.fixed} bản ghi sửa, ${stats.dupeRemoved} CC trùng đã xóa`;
    if (typeof window.toast === 'function') window.toast(msg, 'success');
    if (typeof window._refreshAllTabs === 'function') window._refreshAllTabs();
    delete window._dhLastReport;
  } catch (e) {
    if (typeof window.toast === 'function') window.toast('❌ Lỗi khi dọn dẹp: ' + (e.message || String(e)), 'error');
    console.error('[DataHealth] fixDataIssues lỗi:', e);
  }
}

// ══════════════════════════════════════════════════════════════
//  [6] SCHEMA MIGRATION
// ══════════════════════════════════════════════════════════════

const _UNASSIGNED_PID       = 'UNASSIGNED';
const _MIGRATION_BACKUP_KEY = 'backup_before_migration';

function _isLegacyRecordId(id) {
  if (id === null || id === undefined || id === '') return true;
  if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
  const n = Number(id);
  if (Number.isFinite(n) && String(n) === String(id).trim()) return true;
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return true;
  return false;
}

function _genUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function _getCanonicalProjectName(pid) {
  if (!pid || pid === _UNASSIGNED_PID) return null;
  if (pid === 'COMPANY') return 'CÔNG TY';
  const projs = window.projects;
  if (!Array.isArray(projs)) return null;
  const p = projs.find(x => x.id === pid && !x.deletedAt);
  return p ? p.name : null;
}

/**
 * Dry-run migration — đọc từ IDB, đếm bản ghi sẽ thay đổi (không ghi gì).
 * @returns {Promise<{ perTable, totals }>}
 */
async function dryRunMigration() {
  const all = await _readAllFromIDB();
  const projectsFromIDB = all.projects || [];

  const _norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
  const _findPidLocal = (name) => {
    if (!name) return null;
    const n = name.trim();
    if (!n) return null;
    if (n === 'CÔNG TY' || n === 'KHO TỔNG') return 'COMPANY';
    const exact = projectsFromIDB.find(p => !p.deletedAt && p.name === n);
    if (exact) return exact.id;
    const nNorm = _norm(n);
    const fuzzy = projectsFromIDB.find(p => !p.deletedAt && _norm(p.name) === nNorm);
    return fuzzy ? fuzzy.id : null;
  };
  const _getCanonicalLocal = (pid) => {
    if (!pid || pid === _UNASSIGNED_PID) return null;
    if (pid === 'COMPANY') return 'CÔNG TY';
    const p = projectsFromIDB.find(x => x.id === pid && !x.deletedAt);
    return p ? p.name : null;
  };

  const tables = [
    { key: 'inv_v3', src: all.invoices,   ctField: 'congtrinh' },
    { key: 'cc_v2',  src: all.attendance, ctField: 'congtrinh' },
    { key: 'ung_v1', src: all.ung,        ctField: 'congtrinh' },
    { key: 'tb_v1',  src: all.equipment,  ctField: 'ct'        },
    { key: 'thu_v1', src: all.revenue,    ctField: 'congtrinh' },
  ];

  const perTable = {};
  let totalIdMigrate = 0, totalPidLinked = 0, totalPidUnassigned = 0, totalNameSynced = 0;

  tables.forEach(t => {
    const arr = Array.isArray(t.src) ? t.src : [];
    let idCount = 0, pidLinked = 0, pidUnassigned = 0, nameSynced = 0;
    arr.forEach(r => {
      if (_isLegacyRecordId(r.id)) idCount++;
      if (!r.projectId) {
        const ctName = (r[t.ctField] || r.ct || r.congtrinh || '').trim();
        if (ctName) { if (_findPidLocal(ctName)) pidLinked++; else pidUnassigned++; }
      } else {
        const canonical = _getCanonicalLocal(r.projectId);
        const cur = (r[t.ctField] || '').trim();
        if (canonical && cur && canonical !== cur) nameSynced++;
      }
    });
    perTable[t.key] = { total: arr.length, idCount, pidLinked, pidUnassigned, nameSynced };
    totalIdMigrate += idCount; totalPidLinked += pidLinked;
    totalPidUnassigned += pidUnassigned; totalNameSynced += nameSynced;
  });

  return { perTable, totals: { totalIdMigrate, totalPidLinked, totalPidUnassigned, totalNameSynced } };
}

/**
 * Chuẩn hóa projectId trên tất cả bảng (dùng globals, không đọc IDB).
 */
function normalizeProjectLinks(commit) {
  const tables = [
    { key: 'inv_v3', glob: 'invoices',   ctField: 'congtrinh' },
    { key: 'cc_v2',  glob: 'ccData',     ctField: 'congtrinh' },
    { key: 'ung_v1', glob: 'ungRecords', ctField: 'congtrinh' },
    { key: 'tb_v1',  glob: 'tbData',     ctField: 'ct'        },
    { key: 'thu_v1', glob: 'thuRecords', ctField: 'congtrinh' },
  ];
  const now   = Date.now();
  const devId = (typeof window.DEVICE_ID !== 'undefined') ? window.DEVICE_ID : '';
  const result = { changedByTable: {}, snapshots: {} };

  tables.forEach(t => {
    const arr = (Array.isArray(window[t.glob])) ? window[t.glob] : null;
    if (!arr) { result.changedByTable[t.key] = 0; return; }
    let changed = 0;
    const newArr = arr.map(r => {
      let mutated = false, next = r;
      if (!r.projectId) {
        const ctName = (r[t.ctField] || r.ct || r.congtrinh || '').trim();
        if (ctName) {
          const pid = typeof window.findProjectIdByName === 'function' ? window.findProjectIdByName(ctName) : null;
          next = { ...next, projectId: pid || _UNASSIGNED_PID };
          mutated = true;
        }
      }
      if (next.projectId && next.projectId !== _UNASSIGNED_PID) {
        const canonical = _getCanonicalProjectName(next.projectId);
        if (canonical) {
          const cur = (next[t.ctField] || '').trim();
          if (cur && cur !== canonical) { next = { ...next, [t.ctField]: canonical }; mutated = true; }
        }
      }
      if (mutated) { next = { ...next, updatedAt: now, deviceId: devId }; changed++; }
      return next;
    });
    result.changedByTable[t.key] = changed;
    result.snapshots[t.key]      = newArr;
    if (commit) window[t.glob]   = newArr;
  });
  return result;
}

/**
 * Chuyển id dạng số → UUID v4 (giữ nguyên createdAt/updatedAt).
 */
function migrateIdsToUUID(commit) {
  const tables = [
    { key: 'inv_v3',   glob: 'invoices'   },
    { key: 'cc_v2',    glob: 'ccData'     },
    { key: 'ung_v1',   glob: 'ungRecords' },
    { key: 'tb_v1',    glob: 'tbData'     },
    { key: 'thu_v1',   glob: 'thuRecords' },
    { key: 'trash_v1', glob: 'trash'      },
  ];
  const result = { changedByTable: {}, snapshots: {} };
  tables.forEach(t => {
    const arr = Array.isArray(window[t.glob]) ? window[t.glob] : null;
    if (!arr) { result.changedByTable[t.key] = 0; return; }
    let changed = 0;
    const newArr = arr.map(r => {
      if (_isLegacyRecordId(r.id)) { changed++; return { ...r, id: _genUUID() }; }
      return r;
    });
    result.changedByTable[t.key] = changed;
    result.snapshots[t.key]      = newArr;
    if (commit) window[t.glob]   = newArr;
  });
  return result;
}

async function _backupBeforeMigration() {
  const snap = {
    version:     (typeof window.DATA_VERSION !== 'undefined') ? window.DATA_VERSION : 0,
    backedAt:    Date.now(),
    deviceId:    (typeof window.DEVICE_ID !== 'undefined') ? window.DEVICE_ID : '',
    inv_v3:      Array.isArray(window.invoices)     ? window.invoices     : [],
    cc_v2:       Array.isArray(window.ccData)       ? window.ccData       : [],
    ung_v1:      Array.isArray(window.ungRecords)   ? window.ungRecords   : [],
    tb_v1:       Array.isArray(window.tbData)       ? window.tbData       : [],
    thu_v1:      Array.isArray(window.thuRecords)   ? window.thuRecords   : [],
    trash_v1:    Array.isArray(window.trash)        ? window.trash        : [],
    projects_v1: Array.isArray(window.projects)     ? window.projects     : [],
  };
  const db = window.db;
  if (typeof db !== 'undefined' && db && db.settings) {
    await db.settings.put({ id: _MIGRATION_BACKUP_KEY, data: snap });
    console.log('[Migration] ✅ Backup vào IDB key:', _MIGRATION_BACKUP_KEY);
  } else {
    try {
      localStorage.setItem(_MIGRATION_BACKUP_KEY, JSON.stringify(snap));
      console.log('[Migration] ✅ Backup vào localStorage');
    } catch (e) {
      console.warn('[Migration] Backup LS lỗi:', e);
      throw new Error('Không backup được — hủy migration để an toàn');
    }
  }
  return snap;
}

async function _runFullMigration() {
  if (typeof window.showSyncBanner === 'function') window.showSyncBanner('⌛ Đang đọc Database (toàn bộ năm)...');
  try {
    if (typeof window._snapshotNow === 'function') await window._snapshotNow('pre-schema-migration');
    await _backupBeforeMigration();

    const all = await _readAllFromIDB();
    const projectsFromIDB = all.projects || [];

    const _norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
    const _findPidLocal = (name) => {
      if (!name) return null;
      const n = name.trim();
      if (!n) return null;
      if (n === 'CÔNG TY' || n === 'KHO TỔNG') return 'COMPANY';
      const exact = projectsFromIDB.find(p => !p.deletedAt && p.name === n);
      if (exact) return exact.id;
      const nNorm = _norm(n);
      const fuzzy = projectsFromIDB.find(p => !p.deletedAt && _norm(p.name) === nNorm);
      return fuzzy ? fuzzy.id : null;
    };
    const _getCanonicalLocal = (pid) => {
      if (!pid || pid === _UNASSIGNED_PID) return null;
      if (pid === 'COMPANY') return 'CÔNG TY';
      const p = projectsFromIDB.find(x => x.id === pid && !x.deletedAt);
      return p ? p.name : null;
    };

    if (typeof window.showSyncBanner === 'function') window.showSyncBanner('⏳ Đang chuẩn hóa cấu trúc...');
    const now = Date.now();
    const devId = (typeof window.DEVICE_ID !== 'undefined') ? window.DEVICE_ID : '';
    let r1 = { changedByTable: {} }, r2 = { changedByTable: {} };

    const tables = [
      { key: 'inv_v3',   memKey: 'inv_v3',   glob: 'invoices',   src: all.invoices,   ctField: 'congtrinh' },
      { key: 'cc_v2',    memKey: 'cc_v2',    glob: 'ccData',     src: all.attendance, ctField: 'congtrinh' },
      { key: 'ung_v1',   memKey: 'ung_v1',   glob: 'ungRecords', src: all.ung,        ctField: 'congtrinh' },
      { key: 'tb_v1',    memKey: 'tb_v1',    glob: 'tbData',     src: all.equipment,  ctField: 'ct'        },
      { key: 'thu_v1',   memKey: 'thu_v1',   glob: 'thuRecords', src: all.revenue,    ctField: 'congtrinh' },
      { key: 'trash_v1', memKey: 'trash_v1', glob: 'trash',      src: all.trash,      ctField: 'congtrinh', skipPid: true },
    ];

    for (const t of tables) {
      const arr = Array.isArray(t.src) ? t.src : [];
      let pidChanged = 0, idChanged = 0;

      const finalArr = arr.map(orig => {
        let next = orig, pidOrNameMutated = false;
        if (!t.skipPid) {
          if (!next.projectId) {
            const ctName = (next[t.ctField] || next.ct || next.congtrinh || '').trim();
            if (ctName) { next = { ...next, projectId: _findPidLocal(ctName) || _UNASSIGNED_PID }; pidOrNameMutated = true; }
          }
          if (next.projectId && next.projectId !== _UNASSIGNED_PID) {
            const canonical = _getCanonicalLocal(next.projectId);
            if (canonical) {
              const cur = (next[t.ctField] || '').trim();
              if (cur && cur !== canonical) { next = { ...next, [t.ctField]: canonical }; pidOrNameMutated = true; }
            }
          }
          if (pidOrNameMutated) { pidChanged++; next = { ...next, updatedAt: now, deviceId: devId }; }
        }
        if (_isLegacyRecordId(next.id)) { next = { ...next, id: _genUUID() }; idChanged++; }
        return next;
      });

      r1.changedByTable[t.key] = pidChanged;
      r2.changedByTable[t.key] = idChanged;

      if (typeof window._dbSave === 'function') await window._dbSave(t.memKey, finalArr);
      if (typeof window._mem !== 'undefined') window._mem[t.memKey] = finalArr;
      if (typeof window[t.glob] !== 'undefined') window[t.glob] = finalArr;
    }

    console.log('[Migration] normalizeProjectLinks:', r1.changedByTable);
    console.log('[Migration] migrateIdsToUUID:',      r2.changedByTable);

    if (typeof window.clearInvoiceCache === 'function') window.clearInvoiceCache();

    if (typeof window.pushChanges === 'function' && typeof window.fbReady === 'function' && window.fbReady()) {
      try { await window.pushChanges(); } catch (e) { console.warn('[Migration] push lỗi (bỏ qua):', e); }
    } else if (typeof window._incPending === 'function' && typeof window.schedulePush === 'function') {
      window._incPending(); window.schedulePush();
    }

    if (typeof window.hideSyncBanner === 'function') window.hideSyncBanner();

    const totalChanged =
      Object.values(r1.changedByTable).reduce((s, n) => s + n, 0) +
      Object.values(r2.changedByTable).reduce((s, n) => s + n, 0);
    if (typeof window.toast === 'function')
      window.toast(`✅ Nâng cấp hoàn tất — ${totalChanged} bản ghi đã chuẩn hóa (toàn bộ năm)`, 'success');
    if (typeof window._refreshAllTabs === 'function') window._refreshAllTabs();
    return { r1, r2 };
  } catch (e) {
    if (typeof window.hideSyncBanner === 'function') window.hideSyncBanner();
    console.error('[Migration] LỖI:', e);
    if (typeof window.toast === 'function')
      window.toast('❌ Migration lỗi: ' + (e.message || String(e)) + ' — backup vẫn an toàn', 'error');
    throw e;
  }
}

// ── UI: toolUpgradeSchema ────────────────────────────────────
function toolUpgradeSchema() {
  const existing = document.getElementById('_mig-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_mig-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,24,20,.55);z-index:9000;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';

  overlay.innerHTML = `
    <div style="background:var(--paper,#fff);border-radius:12px;width:100%;max-width:600px;
                max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 20px 60px rgba(0,0,0,.22);font-family:inherit">
      <div style="padding:16px 20px;border-bottom:1px solid var(--line,#e8e4da);
                  background:#f3f1ec;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:15px;font-weight:700">⚙️ Nâng Cấp Cấu Trúc Dữ Liệu</div>
        <button onclick="document.getElementById('_mig-modal-overlay').remove()"
          style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--ink2,#888);
                 padding:2px 6px;border-radius:4px;line-height:1">✕</button>
      </div>
      <div id="_mig-body" style="overflow-y:auto;padding:20px;flex:1">
        <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:8px;padding:12px 14px;
                    font-size:12px;color:#856404;line-height:1.7;margin-bottom:14px">
          <b>🔄 Quy trình nâng cấp:</b><br>
          ① Backup toàn bộ dữ liệu vào IDB key <code>${_MIGRATION_BACKUP_KEY}</code><br>
          ② Chuẩn hóa <b>projectId</b> (gán UUID dự án + đồng bộ tên CT hiển thị)<br>
          ③ Chuyển <b>id</b> bản ghi: số/timestamp → UUID v4 (giữ <code>createdAt</code>/<code>updatedAt</code>)<br>
          ④ Lưu IDB + đẩy lên Cloud (nếu có)<br>
          <b style="color:#7f1d1d">⚠ Bấm "Dry Run" trước để xem có bao nhiêu bản ghi sẽ thay đổi.</b>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button id="_mig-btn-dry" onclick="_migDryRun()"
            style="background:var(--ink,#1a1814);color:#fff;border:none;border-radius:6px;
                   padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            🧪 Dry Run (Xem trước)
          </button>
        </div>
        <div id="_mig-result" style="margin-top:18px"></div>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function _migDryRun() {
  const btn = document.getElementById('_mig-btn-dry');
  const res = document.getElementById('_mig-result');
  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang đọc Database...'; }
  if (res) res.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;
                background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;color:#075985;font-size:13px">
      <span style="font-size:18px">⌛</span>
      <span>Đang đọc Database — quét toàn bộ kho lưu trữ (tất cả các năm)...</span>
    </div>`;
  await new Promise(r => setTimeout(r, 30));
  try {
    const dr = await dryRunMigration();
    window._migLastDry = dr;
    _migRenderDry(dr);
  } catch (e) {
    if (res) res.innerHTML = `<div style="color:#c0392b;font-size:13px">❌ Lỗi: ${e.message}</div>`;
    console.error('[Migration] dryRun lỗi:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🧪 Quét lại'; }
  }
}

function _migRenderDry(dr) {
  const res = document.getElementById('_mig-result');
  if (!res) return;
  const labels = { inv_v3:'Hóa đơn', cc_v2:'Chấm công', ung_v1:'Tiền ứng', tb_v1:'Thiết bị', thu_v1:'Thu tiền' };
  const rows = Object.entries(dr.perTable).map(([k, s]) => `
    <tr style="border-bottom:1px solid var(--line,#eee)">
      <td style="padding:8px 10px;font-weight:600">${labels[k] || k}</td>
      <td style="padding:8px 10px;text-align:center;color:var(--ink3,#888)">${s.total}</td>
      <td style="padding:8px 10px;text-align:center;color:#c0392b;font-weight:700">${s.idCount || ''}</td>
      <td style="padding:8px 10px;text-align:center;color:#1a7a45;font-weight:700">${s.pidLinked || ''}</td>
      <td style="padding:8px 10px;text-align:center;color:#e67e22;font-weight:700">${s.pidUnassigned || ''}</td>
      <td style="padding:8px 10px;text-align:center;color:#4a90d9;font-weight:700">${s.nameSynced || ''}</td>
    </tr>`).join('');
  const t = dr.totals;
  const totalAll = t.totalIdMigrate + t.totalPidLinked + t.totalPidUnassigned + t.totalNameSynced;

  res.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">📊 Kết quả Dry Run</div>
    <div style="overflow-x:auto;border:1px solid var(--line,#e8e4da);border-radius:8px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f3f1ec;font-size:11px;color:var(--ink2,#666)">
            <th style="padding:8px 10px;text-align:left;font-weight:600">Bảng</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600">Tổng</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="ID số → UUID">→UUID</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="Gán projectId">PID gán</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="Không tìm CT">UNASSIGN</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="Đồng bộ tên CT">Tên đồng bộ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;
                border-radius:8px;font-size:12px;color:#075985;line-height:1.6">
      <b>Tổng cộng:</b> ${t.totalIdMigrate} ID sẽ chuyển UUID ·
      ${t.totalPidLinked} PID sẽ gán · ${t.totalPidUnassigned} UNASSIGNED ·
      ${t.totalNameSynced} tên CT đồng bộ
    </div>
    ${totalAll === 0
      ? `<div style="margin-top:14px;text-align:center;padding:14px;color:#166534;font-weight:700">
           ✅ Schema đã chuẩn — không cần migration
         </div>`
      : `<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end">
           <button onclick="document.getElementById('_mig-modal-overlay').remove()"
             style="padding:8px 16px;border:1px solid var(--line2,#ccc);border-radius:6px;
                    background:var(--bg,#f5f5f5);cursor:pointer;font-size:13px;font-family:inherit">Huỷ</button>
           <button onclick="_migCommit()"
             style="padding:8px 18px;border:none;border-radius:6px;background:#1a7a45;color:#fff;
                    cursor:pointer;font-size:13px;font-weight:700;font-family:inherit">
             ⚙️ Xác nhận nâng cấp (${totalAll} bản ghi)
           </button>
         </div>`
    }`;
}

async function _migCommit() {
  const dr = window._migLastDry;
  if (!dr) { if (typeof window.toast === 'function') window.toast('Chạy Dry Run trước', 'error'); return; }
  const res = document.getElementById('_mig-result');
  if (res) res.innerHTML += `<div style="margin-top:12px;color:var(--ink2,#888);font-size:13px">⏳ Đang nâng cấp... (backup → chuẩn hóa → push)</div>`;
  try {
    await _runFullMigration();
    const overlay = document.getElementById('_mig-modal-overlay');
    if (overlay) overlay.remove();
    delete window._migLastDry;
  } catch (_) { /* toast đã hiện trong _runFullMigration */ }
}

// ── Stub: openDeleteModal ─────────────────────────────────────
function openDeleteModal() {
  if (typeof window.toast === 'function') window.toast('Tính năng này đang phát triển', 'info');
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
export function initAdmin() {
  // Misc
  window.openDeleteModal   = openDeleteModal;

  console.log('[admin.module] ✅ Module ready');
}
