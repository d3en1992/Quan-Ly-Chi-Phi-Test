// ══════════════════════════════════════════════════════════════
// src/app.js — ES Modules Entry Point & App Bootstrap
// Prompt 12 — main.js ported into ES Modules
//
// Load order: Utils → Core → Services → Domain Modules → System Modules → bootstrap
// ══════════════════════════════════════════════════════════════

// ── Utils ────────────────────────────────────────────────────
import './utils/math.util.js';
import './utils/date.util.js';
import './utils/string.util.js';
import './utils/dom.util.js';

// ── Core ─────────────────────────────────────────────────────
import './core/config.js';
import './core/db.js';
import './core/schema.js';
import './core/store.js';
import './core/migrate.js';
import './core/sync.js';

// ── Services ─────────────────────────────────────────────────
import './services/project.svc.js';
import './services/category.svc.js';
import './services/excel.svc.js';
import './services/invoice-cache.svc.js';

// ── Domain Modules ───────────────────────────────────────────
import './modules/projects/project.logic.js';
import { initProjectUI }
  from './modules/projects/project.ui.js';
import './modules/cloud/cloud.ui.js';
import './modules/invoices/invoice.logic.js';
import './modules/invoices/invoice.ui.js';
import './modules/payroll/payroll.logic.js';
import './modules/payroll/payroll.ui.js';
import './modules/revenue/revenue.logic.js';
import './modules/revenue/revenue.ui.js';
import './modules/advances/advance.logic.js';
import { initAdvanceUI }
  from './modules/advances/advance.ui.js';
import './modules/equipment/equipment.logic.js';
import { initEquipmentUI }
  from './modules/equipment/equipment.ui.js';

// ── System Modules ───────────────────────────────────────────
import {
  ensureDefaultUsers, initAuth, trySyncUsersBeforeAuth,
  applyNavPermissions, queueApplyRoleUI, startRoleObserver,
  syncAuthUI, initClickOutsideHandler, initVisibilityHandler,
  wrapManualSync
} from './modules/auth/auth.module.js';

import {
  buildYearSelect, renderActiveTab, syncTopbarHeight, today
} from './modules/nav/nav.ui.js';

import { initDashboard }
  from './modules/dashboard/dashboard.module.js';
import { initSettings, toolDeleteYear, toolResetAll }
  from './modules/settings/settings.module.js';
import { initRevenueUI }
  from './modules/revenue/revenue.ui.js';
import { initAdmin }
  from './modules/admin/admin.module.js';

// ══════════════════════════════════════════════════════════════
// init() — Render UI after data is ready and auth passes
// (Ported from main.js init())
// ══════════════════════════════════════════════════════════════
function init() {
  const entryDate = document.getElementById('entry-date');
  const ungDate   = document.getElementById('ung-date');
  if (entryDate) entryDate.value = today();
  if (ungDate)   ungDate.value   = today();

  if (typeof window.initTable === 'function')    window.initTable(5);
  if (typeof window.initUngTable === 'function') window.initUngTable(4);
  if (typeof window.initCC === 'function')       window.initCC();
  if (typeof window.updateTop === 'function')    window.updateTop();
  if (typeof window.updateJbBtn === 'function')  window.updateJbBtn();

  if (typeof window.migrateData === 'function')  window.migrateData();

  buildYearSelect();
  if (typeof window.renderTrash === 'function')          window.renderTrash();
  if (typeof window.renderTodayInvoices === 'function')  window.renderTodayInvoices();
  applyNavPermissions();
  syncAuthUI();
  startRoleObserver();
  queueApplyRoleUI();

  syncTopbarHeight();

  // Load cloud data (nếu đã có Bin ID)
  if (typeof window.gsLoadAll === 'function') {
    window.gsLoadAll(function (data) {
      if (!data) return;
      if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
      buildYearSelect();
      if (typeof window.updateTop === 'function') window.updateTop();
      if (typeof window.rebuildEntrySelects === 'function') window.rebuildEntrySelects();
      if (typeof window.rebuildCCNameList === 'function')   window.rebuildCCNameList();
      if (typeof window.populateCCCtSel === 'function')     window.populateCCCtSel();
      if (typeof window.initTable === 'function')    window.initTable(5);
      if (typeof window.initUngTable === 'function') window.initUngTable(4);
      if (typeof window.initCC === 'function')       window.initCC();
      const built2 = (typeof window.rebuildCCCategories === 'function') ? window.rebuildCCCategories() : {};
      if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
      if (typeof window.updateTop === 'function') window.updateTop();
      if (typeof window.toast === 'function') window.toast(`✅ Đồng bộ xong! ${(built2 && built2.cts) || 0} CT mới`, 'success');
    });
  }
}

// ══════════════════════════════════════════════════════════════
// Bootstrap — Replaces the IIFE at the bottom of main.js
// dbInit → load globals → migrations → auth → init → auto-sync
// ══════════════════════════════════════════════════════════════
window._dataReady = false;

async function bootstrap() {
  // Load Firebase config from localStorage trước khi init bất cứ thứ gì
  const fbConfig = window._loadLS ? window._loadLS('fb_config') : JSON.parse(localStorage.getItem('fb_config') || 'null');
  if (fbConfig && window.FB_CONFIG) {
    window.FB_CONFIG.projectId = fbConfig.projectId;
    window.FB_CONFIG.apiKey = fbConfig.apiKey;
  }

  // 1. Init IndexedDB
  await window.dbInit();

  // 2. Reload globals from _mem (populated by dbInit)
  if (typeof window._reloadGlobals === 'function') window._reloadGlobals();

  // 3. Run migrations
  if (typeof window._migrateProjectDates === 'function') window._migrateProjectDates();

  // Legacy CC invoice cleanup
  const invoices = window.invoices || [];
  const legacyCCCount = invoices.filter(i => i.ccKey).length;
  if (legacyCCCount > 0) {
    window.invoices = invoices.filter(i => !i.ccKey);
    if (typeof window.save === 'function') window.save('inv_v3', window.invoices);
    console.log(`[Migration] Đã xóa ${legacyCCCount} HĐ CC cũ khỏi inv_v3`);
  }

  // Cleanup invalid projects
  if (typeof window.cleanupInvalidProjects === 'function') {
    const cats = window.cats || {};
    window.cleanupInvalidProjects([
      ...(cats.loaiChiPhi  || []),
      ...(cats.congNhan    || []),
      ...(cats.thauPhu     || []),
      ...(cats.nhaCungCap  || []),
      ...(cats.nguoiTH     || []),
    ]);
  }

  // Assign projectId to old records
  if (typeof window.migrateProjectLinks === 'function') window.migrateProjectLinks();

  // Normalize CC data
  if (typeof window.normalizeAllChamCong === 'function') window.normalizeAllChamCong();

  // 4. Data ready
  window._dataReady = true;

  // 5. Auth
  await trySyncUsersBeforeAuth();
  ensureDefaultUsers();

  // Init auth event handlers
  initClickOutsideHandler();
  initVisibilityHandler();
  wrapManualSync();

  if (!initAuth()) return;

  // 6. Init UI
  init();

  // Init ES module subsystems
  initDashboard();
  initSettings();
  initRevenueUI();
  initAdvanceUI();
  initEquipmentUI();
  initProjectUI();
  initAdmin();
  if (!window.toolDeleteYear) window.toolDeleteYear = toolDeleteYear;
  if (!window.toolResetAll)   window.toolResetAll   = toolResetAll;

  // Reset pending counter
  if (typeof window._resetPending === 'function') window._resetPending();

  applyNavPermissions();
  if (typeof window.renderProjectsPage === 'function') window.renderProjectsPage();
  queueApplyRoleUI();

  // Warn on unload if unsaved changes
  window.addEventListener('beforeunload', function (e) {
    if (typeof window._pendingChanges !== 'undefined' && window._pendingChanges > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Start auto-sync
  if (typeof window.startAutoSync === 'function') window.startAutoSync();

  window._esModulesReady = true;
  console.log('[app.js] ✅ Bootstrap complete — all ES Modules active');
}

// ── Run bootstrap when DOM is ready ──────────────────────────
function runBootstrap() {
  bootstrap().catch(e => {
    console.error('[app.js] ❌ Bootstrap failed:', e);
    window._bootstrapError = e.message;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runBootstrap);
} else {
  runBootstrap();
}
