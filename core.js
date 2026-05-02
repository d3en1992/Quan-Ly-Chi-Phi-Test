// core.js — Thin Bridge Stub
// All logic has been ported to ES Modules in src/core/
// This file only initializes empty window globals that the ESM files will populate.

console.log('[core.js] Legacy script bypassed. Logic is now handled by ESM.');

// IDB & Storage placeholders
window.dbInit = window.dbInit || async function(){};
window.save = window.save || function(){};
window.load = window.load || function(k, d){return d};
window._memSet = window._memSet || function(){};
window.clearAllCache = window.clearAllCache || function(){};
window.afterDataChange = window.afterDataChange || function(){};

// Firebase & Sync placeholders
window.fbReady = window.fbReady || function(){return false};
window.schedulePush = window.schedulePush || function(){};
window.updateJbBtn = window.updateJbBtn || function(){};
window.showSyncBanner = window.showSyncBanner || function(){};
window.hideSyncBanner = window.hideSyncBanner || function(){};

// State globals (these will be populated by dbInit in the ESM)
window.invoices = window.invoices || [];
window.ccData = window.ccData || [];
window.tbData = window.tbData || [];
window.ungRecords = window.ungRecords || [];
window.thuRecords = window.thuRecords || [];
window.hopDongData = window.hopDongData || {};
window.thauPhuContracts = window.thauPhuContracts || [];
window.projects = window.projects || [];
window.trash = window.trash || [];

window.cats = window.cats || {
  congTrinh: [],
  congTrinhYears: {},
  loaiChiPhi: [],
  nhaCungCap: [],
  nguoiTH: [],
  thauPhu: [],
  congNhan: [],
  tbTen: []
};

window.curPage = 1;
window.PG = 20;
window.filteredInvs = [];
