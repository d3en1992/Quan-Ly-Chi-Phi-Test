// ══════════════════════════════════════════════════════════════
// src/core/migrate.js — Data Migration (One-time runners)
// Prompt 4 — Bốc từ projects.js + core.js
// Chạy lúc startup, idempotent (gọi nhiều lần an toàn)
// ══════════════════════════════════════════════════════════════

import { findProjectIdByName, getProjectById } from '../services/project.svc.js';

/**
 * Gán projectId cho records chưa có + sync name fields từ projectId
 * Bốc từ projects.js → migrateProjectLinks()
 *
 * @param {Object} data - { invoices, ccData, ungRecords, tbData, thuRecords, projects }
 * @returns {Object} changes - { inv, cc, ung, tb, thu } (số record đã sửa)
 */
export function migrateProjectLinks(data) {
  const { invoices, ccData, ungRecords, tbData, thuRecords, projects } = data;
  const changes = { inv: 0, cc: 0, ung: 0, tb: 0, thu: 0 };

  // Pass 1: Gán projectId cho records chưa có
  (invoices || []).forEach(rec => {
    if (rec.deletedAt || rec.projectId) return;
    const pid = findProjectIdByName(rec.congtrinh, projects);
    if (pid) { rec.projectId = pid; changes.inv++; }
  });
  (ccData || []).forEach(rec => {
    if (rec.deletedAt || rec.projectId) return;
    const pid = findProjectIdByName(rec.ct, projects);
    if (pid) { rec.projectId = pid; changes.cc++; }
  });
  (ungRecords || []).forEach(rec => {
    if (rec.deletedAt || rec.projectId) return;
    const pid = findProjectIdByName(rec.congtrinh, projects);
    if (pid) { rec.projectId = pid; changes.ung++; }
  });
  (tbData || []).forEach(rec => {
    if (rec.deletedAt || rec.projectId) return;
    const pid = findProjectIdByName(rec.ct, projects);
    if (pid) { rec.projectId = pid; changes.tb++; }
  });
  (thuRecords || []).forEach(rec => {
    if (rec.deletedAt || rec.projectId) return;
    const pid = findProjectIdByName(rec.congtrinh, projects);
    if (pid) { rec.projectId = pid; changes.thu++; }
  });

  // Pass 2: Sync name fields from projectId (handles renames)
  (invoices || []).forEach(rec => {
    if (rec.deletedAt || !rec.projectId) return;
    const p = getProjectById(rec.projectId, projects);
    if (p && p.name && p.name !== rec.congtrinh) { rec.congtrinh = p.name; changes.inv++; }
  });
  (ccData || []).forEach(rec => {
    if (rec.deletedAt || !rec.projectId) return;
    const p = getProjectById(rec.projectId, projects);
    if (p && p.name && p.name !== rec.ct) { rec.ct = p.name; changes.cc++; }
  });
  (ungRecords || []).forEach(rec => {
    if (rec.deletedAt || !rec.projectId) return;
    const p = getProjectById(rec.projectId, projects);
    if (p && p.name && p.name !== rec.congtrinh) { rec.congtrinh = p.name; changes.ung++; }
  });
  (tbData || []).forEach(rec => {
    if (rec.deletedAt || !rec.projectId) return;
    const p = getProjectById(rec.projectId, projects);
    if (p && p.name && p.name !== rec.ct) { rec.ct = p.name; changes.tb++; }
  });
  (thuRecords || []).forEach(rec => {
    if (rec.deletedAt || !rec.projectId) return;
    const p = getProjectById(rec.projectId, projects);
    if (p && p.name && p.name !== rec.congtrinh) { rec.congtrinh = p.name; changes.thu++; }
  });

  // Pass 3: Gán source cho invoices cũ
  (invoices || []).forEach(rec => {
    if (rec.deletedAt || rec.source) return;
    rec.source = (rec.items && rec.items.length) ? 'detail' : 'quick';
    changes.inv++;
  });

  const total = Object.values(changes).reduce((a, b) => a + b, 0);
  if (total > 0) console.log(`[migrate] migrateProjectLinks: ${total} records normalized`);
  return changes;
}

/**
 * Gộp projects trùng tên (accent-insensitive)
 * Bốc từ projects.js → deduplicateProjects()
 *
 * @param {Object} data - { projects, invoices, ccData, ungRecords, tbData, thuRecords }
 * @returns {{ mergeMap: Object, mergeCount: number }}
 */
export function deduplicateProjects(data) {
  const { projects, invoices, ccData, ungRecords, tbData, thuRecords } = data;
  const _norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  const byNorm = {};
  projects.filter(p => !p.deletedAt).forEach(p => {
    const key = _norm(p.name);
    if (!byNorm[key]) byNorm[key] = [];
    byNorm[key].push(p);
  });

  const mergeMap = {};
  Object.values(byNorm).forEach(group => {
    if (group.length <= 1) return;
    group.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const keeper = group[0];
    group.slice(1).forEach(dupe => {
      mergeMap[dupe.id] = keeper.id;
      dupe.deletedAt = Date.now();
      dupe._mergedInto = keeper.id;
    });
  });

  if (!Object.keys(mergeMap).length) return { mergeMap: {}, mergeCount: 0 };

  // Remap projectId trong records
  const remap = id => mergeMap[id] || id;
  (invoices || []).forEach(r => { if (r.projectId && mergeMap[r.projectId]) r.projectId = remap(r.projectId); });
  (ccData || []).forEach(r => { if (r.projectId && mergeMap[r.projectId]) r.projectId = remap(r.projectId); });
  (ungRecords || []).forEach(r => { if (r.projectId && mergeMap[r.projectId]) r.projectId = remap(r.projectId); });
  (tbData || []).forEach(r => { if (r.projectId && mergeMap[r.projectId]) r.projectId = remap(r.projectId); });
  (thuRecords || []).forEach(r => { if (r.projectId && mergeMap[r.projectId]) r.projectId = remap(r.projectId); });

  const mergeCount = Object.keys(mergeMap).length;
  console.log(`[migrate] deduplicateProjects: merged ${mergeCount} duplicates`);
  return { mergeMap, mergeCount };
}

/**
 * Chuyển hopdong_v1 key từ tên CT → projectId
 * Bốc từ core.js → _migrateHopDongKeys()
 */
export function migrateHopDongKeys(hopDongData, projects) {
  if (!hopDongData || !projects || !projects.length) return { data: hopDongData, changed: false };

  const nameToId = new Map();
  projects.forEach(p => { if (p.id && p.name && !p.deletedAt) nameToId.set(p.name, p.id); });
  if (!nameToId.size) return { data: hopDongData, changed: false };

  let changed = false;
  const migrated = {};

  for (const [key, hd] of Object.entries(hopDongData)) {
    if (key.length === 36 && key.split('-').length === 5) {
      migrated[key] = hd;
      continue;
    }
    const pid = nameToId.get(key);
    if (pid) {
      if (migrated[pid]) {
        if ((hd.updatedAt || 0) > (migrated[pid].updatedAt || 0)) {
          migrated[pid] = { ...hd, projectId: pid };
        }
      } else {
        migrated[pid] = { ...hd, projectId: pid };
      }
      changed = true;
    } else {
      migrated[key] = hd;
    }
  }

  return { data: changed ? migrated : hopDongData, changed };
}

/**
 * Migration v0→v4: schema upgrades (từ core.js migrateData)
 */
export function migrateDataVersion(invoices, ccData) {
  let changed = false;

  // v0→v1: sl + thanhtien
  (invoices || []).forEach(inv => {
    if (inv.sl === undefined || inv.sl === null) { inv.sl = 1; changed = true; }
    if (inv.thanhtien === undefined) { inv.thanhtien = (inv.tien || 0) * (inv.sl || 1); changed = true; }
  });

  // v1→v2: workers phucap/hdmuale
  (ccData || []).forEach(week => {
    (week.workers || []).forEach(wk => {
      if (wk.phucap === undefined) { wk.phucap = 0; changed = true; }
      if (wk.hdmuale === undefined) { wk.hdmuale = 0; changed = true; }
    });
  });

  return changed;
}

/**
 * migrateData() — master migration runner (from core.js)
 * Nâng cấp schema data từ version cũ lên DATA_VERSION hiện tại.
 * Gọi 1 lần lúc startup, idempotent.
 */
export function migrateData() {
  const stored = parseInt(localStorage.getItem('app_data_version') || '0');
  if (stored >= 4) return; // DATA_VERSION = 4

  console.log('[Migration] Từ v' + stored + ' → v4');

  // v0 → v1: inv không có sl → set mặc định sl=1
  if (stored < 1) {
    const invs = window.load ? window.load('inv_v3', []) : [];
    let changed = 0;
    invs.forEach(inv => {
      if (inv.sl === undefined || inv.sl === null) { inv.sl = 1; changed++; }
      if (inv.thanhtien === undefined) { inv.thanhtien = (inv.tien || 0) * (inv.sl || 1); changed++; }
    });
    if (changed && typeof window._memSet === 'function') window._memSet('inv_v3', invs);
    console.log('[Migration v1] Chuẩn hoá sl/thanhtien:', changed, 'HĐ');
  }

  // v1 → v2: cc_v2 workers không có phucap/hdmuale → set 0
  if (stored < 2) {
    const ccs = window.load ? window.load('cc_v2', []) : [];
    let changed = 0;
    ccs.forEach(week => {
      (week.workers || []).forEach(wk => {
        if (wk.phucap === undefined) { wk.phucap = 0; changed++; }
        if (wk.hdmuale === undefined) { wk.hdmuale = 0; changed++; }
      });
    });
    if (changed && typeof window._memSet === 'function') window._memSet('cc_v2', ccs);
    console.log('[Migration v2] Chuẩn hoá CC workers:', changed, 'worker');
  }

  // v2 → v3: đảm bảo mọi invoice có _ts
  if (stored < 3) {
    const invs = window.load ? window.load('inv_v3', []) : [];
    let changed = 0;
    invs.forEach(inv => {
      if (!inv._ts) { inv._ts = inv.id || Date.now(); changed++; }
    });
    if (changed && typeof window._memSet === 'function') window._memSet('inv_v3', invs);
    console.log('[Migration v3] Thêm _ts cho', changed, 'HĐ');
  }

  // v3 → v4: hopdong_v1 key migration — handled in _reloadGlobals

  localStorage.setItem('app_data_version', '4');
  console.log('[Migration] Hoàn tất → v4');
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES — direct globals cho legacy scripts
// ══════════════════════════════════════════════════════════════
window._migrate = {
  migrateProjectLinks, deduplicateProjects,
  migrateHopDongKeys, migrateDataVersion, migrateData,
};
window.migrateData = migrateData;
