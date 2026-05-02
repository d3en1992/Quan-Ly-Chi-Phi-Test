// ══════════════════════════════════════════════════════════════
// src/modules/nav/nav.ui.js — Navigation + Year Filter + Tab Rendering
// Ported from main.js (Prompt 12)
// ══════════════════════════════════════════════════════════════

// ── Year filter state ────────────────────────────────────────
let activeYears = new Set([new Date().getFullYear()]);
let activeYear  = new Date().getFullYear();

function _syncActiveYearCompat() {
  if (activeYears.size === 0)      activeYear = 0;
  else if (activeYears.size === 1) activeYear = [...activeYears][0];
  else                             activeYear = 0;
  // Sync to window for legacy reads
  window.activeYear  = activeYear;
  window.activeYears = activeYears;
}

export function setActiveYear(year) {
  if (year === 0) activeYears = new Set();
  else            activeYears = new Set([year]);
  _syncActiveYearCompat();
}

// ── Build year dropdown checkboxes ───────────────────────────
export function buildYearSelect() {
  const container = document.getElementById('year-list');
  if (!container) return;

  const years = new Set();
  const invoices   = window.invoices   || [];
  const ungRecords = window.ungRecords || [];
  const ccData     = window.ccData     || [];
  const tbData     = window.tbData     || [];

  invoices.forEach(i   => { if (i.ngay)     years.add(parseInt(i.ngay)); });
  ungRecords.forEach(u => { if (u.ngay)     years.add(parseInt(u.ngay)); });
  ccData.forEach(w     => { if (w.fromDate) years.add(parseInt(w.fromDate)); });
  tbData.forEach(t     => { if (t.ngay)     years.add(parseInt(t.ngay)); });
  years.add(new Date().getFullYear());

  const sorted = [...years].filter(y => y > 2000).sort((a, b) => b - a);

  container.innerHTML = sorted.map(yr => {
    const checked = activeYears.size === 0 || activeYears.has(yr) ? 'checked' : '';
    return `<label class="year-item">
      <input type="checkbox" ${checked} onchange="onYearToggle(${yr})">
      <span>${yr}</span>
    </label>`;
  }).join('');

  _updateYearBtn();
}

function _updateYearBtn() {
  const btn = document.getElementById('year-select-btn');
  if (!btn) return;
  if (activeYears.size === 0) {
    btn.textContent = 'Tất cả';
  } else if (activeYears.size === 1) {
    btn.textContent = 'Năm ' + [...activeYears][0];
  } else {
    btn.textContent = [...activeYears].sort((a, b) => a - b).join(', ');
  }
}

// ── Year dropdown toggle ─────────────────────────────────────
export function toggleYearDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('year-dropdown');
  if (!dd) return;
  const open = dd.classList.toggle('open');
  if (open) {
    setTimeout(() => document.addEventListener('click', _closeYearDropdown, { once: true }), 0);
  }
}

function _closeYearDropdown() {
  const dd = document.getElementById('year-dropdown');
  if (dd) dd.classList.remove('open');
}

// ── Year toggle / quick actions ──────────────────────────────
export function onYearToggle(year) {
  if (activeYears.has(year)) activeYears.delete(year);
  else                        activeYears.add(year);
  _syncActiveYearCompat();
  _updateYearBtn();
  onYearChange();
}

export function yearQuickAll() {
  activeYears = new Set();
  _syncActiveYearCompat();
  buildYearSelect();
  _closeYearDropdown();
  onYearChange();
}

export function yearQuickRecent() {
  const years = new Set();
  const invoices   = window.invoices   || [];
  const ungRecords = window.ungRecords || [];
  const ccData     = window.ccData     || [];
  invoices.forEach(i   => { if (i.ngay)     years.add(parseInt(i.ngay)); });
  ungRecords.forEach(u => { if (u.ngay)     years.add(parseInt(u.ngay)); });
  ccData.forEach(w     => { if (w.fromDate) years.add(parseInt(w.fromDate)); });
  years.add(new Date().getFullYear());
  const sorted = [...years].sort((a, b) => b - a);
  activeYears = new Set(sorted.slice(0, 2));
  _syncActiveYearCompat();
  buildYearSelect();
  _closeYearDropdown();
  onYearChange();
}

// ── Year change handler ──────────────────────────────────────
export function onYearChange() {
  _syncActiveYearCompat();

  if (activeYears.size === 0) { renderActiveTab(); return; }

  if (typeof window.fbReady !== 'function' || !window.fbReady()
      || typeof window.pullChanges !== 'function') {
    renderActiveTab(); return;
  }

  if (typeof window._pendingChanges !== 'undefined' && window._pendingChanges > 0
      && typeof window.isSyncing === 'function' && !window.isSyncing()
      && typeof window.pushChanges === 'function') {
    window.pushChanges({ silent: true });
  }

  const invoices   = window.invoices   || [];
  const ccData     = window.ccData     || [];
  const ungRecords = window.ungRecords || [];

  const missing = [...activeYears].filter(yr => {
    const ys = String(yr);
    return !invoices.some(i => i.ngay && i.ngay.startsWith(ys))
        && !ccData.some(w => w.fromDate && w.fromDate.startsWith(ys))
        && !ungRecords.some(u => u.ngay && u.ngay.startsWith(ys));
  });

  if (!missing.length) {
    renderActiveTab();
    if (typeof window._pendingChanges !== 'undefined' && window._pendingChanges > 0) {
      setTimeout(() => window.toast('⚠️ Còn ' + window._pendingChanges + ' thay đổi chưa đồng bộ — bấm 🔄 Sync', 'info'), 400);
    }
    return;
  }

  const yrsStr = missing.join(', ');
  if (typeof window.showSyncBanner === 'function') window.showSyncBanner('⏳ Đang tải dữ liệu năm ' + yrsStr + '...');
  let idx = 0;
  function pullNext() {
    if (idx >= missing.length) {
      if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
      buildYearSelect();
      renderActiveTab();
      if (typeof window.hideSyncBanner === 'function') window.hideSyncBanner();
      if (typeof window._pendingChanges !== 'undefined' && window._pendingChanges > 0) {
        window.toast('✅ Đã tải năm ' + yrsStr + '. ⚠️ Còn ' + window._pendingChanges + ' thay đổi chưa sync — bấm 🔄 Sync.', 'info');
      } else {
        window.toast('✅ Đã tải dữ liệu năm ' + yrsStr + ' từ Firebase', 'success');
      }
      return;
    }
    window.pullChanges(missing[idx++], pullNext, { silent: true });
  }
  pullNext();
}

// ══════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════

export function goPage(btn, id) {
  if (typeof window.getCurrentUser === 'function' && !window.getCurrentUser()) {
    if (typeof window.toggleUserDropdown === 'function') window.toggleUserDropdown(true);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const pageEl = document.getElementById('page-' + id);
  if (pageEl) pageEl.classList.add('active');
  if (btn) btn.classList.add('active');

  if (typeof window._reloadGlobals === 'function') window._reloadGlobals();

  if (id === 'nhap')          { if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices(); }
  if (id === 'thongkecphd')   { if (typeof window.buildFilters === 'function') window.buildFilters(); if (typeof window.filterAndRender === 'function') window.filterAndRender(); }
  if (id === 'danhmuc')       { if (typeof window.renderSettings === 'function') window.renderSettings(); }
  if (id === 'dashboard')     { if (typeof window.renderDashboard === 'function') window.renderDashboard(); }
  if (id === 'doanhthu')      { if (typeof window.initDoanhThu === 'function') window.initDoanhThu(); }
  if (id === 'nhapung')       { if (typeof window.initUngTableIfEmpty === 'function') window.initUngTableIfEmpty(); if (typeof window.buildUngFilters === 'function') window.buildUngFilters(); if (typeof window.filterAndRenderUng === 'function') window.filterAndRenderUng(); }
  if (id === 'chamcong')      { if (typeof window.populateCCCtSel === 'function') window.populateCCCtSel(); if (typeof window.rebuildCCNameList === 'function') window.rebuildCCNameList(); if (typeof window.renderCCHistory === 'function') window.renderCCHistory(); if (typeof window.renderCCTLT === 'function') window.renderCCTLT(); }
  if (id === 'thietbi')       { if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels(); if (typeof window.tbBuildRows === 'function') window.tbBuildRows(5); if (typeof window.tbRenderList === 'function') window.tbRenderList(); if (typeof window.renderKhoTong === 'function') window.renderKhoTong(); }
  if (id === 'congtrinh')     { if (typeof window.renderProjectsPage === 'function') window.renderProjectsPage(); }

  if (typeof window.queueApplyRoleUI === 'function') window.queueApplyRoleUI();
}

export function goSubPage(btn, id) {
  document.querySelectorAll('#page-nhap .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-nhap .sub-nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'sub-hom-nay') { if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices(); }
  if (id === 'sub-tat-ca')  { if (typeof window.buildFilters === 'function') window.buildFilters(); if (typeof window.filterAndRender === 'function') window.filterAndRender(); }
  if (id === 'sub-da-xoa')  { if (typeof window.renderTrash === 'function') window.renderTrash(); }
}

// ── Tab detection + rendering ────────────────────────────────

export function getCurrentTab() {
  const active = document.querySelector('.page.active');
  return active ? active.id.replace('page-', '') : 'dashboard';
}

export function renderActiveTab() {
  if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
  if (typeof window.updateTop === 'function') window.updateTop();

  const tab = getCurrentTab();
  if (typeof window.getCurrentUser === 'function' && !window.getCurrentUser()) {
    if (typeof window.toggleUserDropdown === 'function') window.toggleUserDropdown(true);
    return;
  }
  switch (tab) {
    case 'nhap': {
      if (typeof window.rebuildEntrySelects === 'function') window.rebuildEntrySelects();
      if (typeof window.buildFilters === 'function') window.buildFilters();
      if (typeof window.refreshHoadonCtDropdowns === 'function') window.refreshHoadonCtDropdowns();
      const sub = document.querySelector('#page-nhap .sub-page.active');
      if (!sub || sub.id === 'sub-hom-nay') { if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices(); }
      else if (sub.id === 'sub-tat-ca')     { if (typeof window.buildFilters === 'function') window.buildFilters(); if (typeof window.filterAndRender === 'function') window.filterAndRender(); }
      else if (sub.id === 'sub-da-xoa')     { if (typeof window.renderTrash === 'function') window.renderTrash(); }
      else { if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices(); }
      break;
    }
    case 'nhapung':
      if (typeof window.rebuildUngSelects === 'function') window.rebuildUngSelects();
      if (typeof window.buildUngFilters === 'function') window.buildUngFilters();
      if (typeof window.filterAndRenderUng === 'function') window.filterAndRenderUng();
      break;
    case 'chamcong':
      if (typeof window.populateCCCtSel === 'function') window.populateCCCtSel();
      if (typeof window.rebuildCCNameList === 'function') window.rebuildCCNameList();
      if (typeof window.renderCCHistory === 'function') window.renderCCHistory();
      if (typeof window.renderCCTLT === 'function') window.renderCCTLT();
      break;
    case 'thietbi':
      if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels();
      if (typeof window.tbRenderList === 'function') window.tbRenderList();
      if (typeof window.renderKhoTong === 'function') window.renderKhoTong();
      break;
    case 'danhmuc':
      if (typeof window.renderSettings === 'function') window.renderSettings();
      break;
    case 'congtrinh':
      if (typeof window.renderProjectsPage === 'function') window.renderProjectsPage();
      break;
    case 'doanhthu':
      if (typeof window.dtPopulateSels === 'function') window.dtPopulateSels();
      if (typeof window.renderThuTable === 'function') window.renderThuTable();
      break;
    case 'dashboard':
    default:
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      break;
  }
  if (typeof window.queueApplyRoleUI === 'function') window.queueApplyRoleUI();
}

export function refreshAllTabs() {
  if (typeof window.buildFilters === 'function') window.buildFilters();
  if (typeof window.buildUngFilters === 'function') window.buildUngFilters();
  if (typeof window.buildCCHistFilters === 'function') window.buildCCHistFilters();
  if (typeof window.populateCCCtSel === 'function') window.populateCCCtSel();
  if (typeof window.tbPopulateSels === 'function') window.tbPopulateSels();
  if (typeof window.rebuildEntrySelects === 'function') window.rebuildEntrySelects();
  if (typeof window.rebuildUngSelects === 'function') window.rebuildUngSelects();
  if (typeof window.renderSettings === 'function') window.renderSettings();

  if (typeof window.filterAndRender === 'function') window.filterAndRender();
  if (typeof window.renderTrash === 'function') window.renderTrash();
  if (typeof window.filterAndRenderUng === 'function') window.filterAndRenderUng();
  if (typeof window.renderCtPage === 'function') window.renderCtPage();
  if (typeof window.renderCCHistory === 'function') window.renderCCHistory();
  if (typeof window.renderCCTLT === 'function') window.renderCCTLT();
  if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices();
  if (typeof window.tbRenderList === 'function') window.tbRenderList();
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  if (typeof window.renderProjectsPage === 'function') window.renderProjectsPage();

  if (typeof window.dtPopulateSels === 'function') window.dtPopulateSels();
  if (typeof window.renderThuTable === 'function') window.renderThuTable();
  if (typeof window.updateTop === 'function') window.updateTop();
}

// ── Topbar height sync ───────────────────────────────────────
export function syncTopbarHeight() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  function update() {
    const h = topbar.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--topbar-h', h + 'px');
  }
  update();
  if (window.ResizeObserver) {
    new ResizeObserver(update).observe(topbar);
  }
  window.addEventListener('resize', update);
}

// ── Utility ──────────────────────────────────────────────────
export function today() { return new Date().toISOString().split('T')[0]; }

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES
// ══════════════════════════════════════════════════════════════
window.activeYear         = activeYear;
window.activeYears        = activeYears;
window.setActiveYear      = setActiveYear;
window.buildYearSelect    = buildYearSelect;
window.toggleYearDropdown = toggleYearDropdown;
window.onYearToggle       = onYearToggle;
window.yearQuickAll       = yearQuickAll;
window.yearQuickRecent    = yearQuickRecent;
window.onYearChange       = onYearChange;

window.goPage             = goPage;
window.goSubPage          = goSubPage;
window.getCurrentTab      = getCurrentTab;
window.renderActiveTab    = renderActiveTab;
window._refreshAllTabs    = refreshAllTabs;

window.today              = today;

console.log('[nav.ui] ES Module loaded ✅');
