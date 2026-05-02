// main.js — Thin Bridge Stub
// All logic has been ported to ES Modules:
//   - Auth + Session + Role UI → src/modules/auth/auth.module.js
//   - Navigation + Year filter → src/modules/nav/nav.ui.js
//   - Bootstrap + init() → src/app.js
// This file only initializes empty window globals that the ESM files will populate.

console.log('[main.js] Legacy script bypassed. Logic is now handled by ESM.');

// Year filter placeholders (populated by nav.ui.js)
window.activeYears = window.activeYears || new Set([new Date().getFullYear()]);
window.activeYear  = window.activeYear  || new Date().getFullYear();
window.setActiveYear      = window.setActiveYear      || function(){};
window.buildYearSelect    = window.buildYearSelect    || function(){};
window.toggleYearDropdown = window.toggleYearDropdown || function(){};
window.onYearToggle       = window.onYearToggle       || function(){};
window.yearQuickAll       = window.yearQuickAll       || function(){};
window.yearQuickRecent    = window.yearQuickRecent    || function(){};
window.onYearChange       = window.onYearChange       || function(){};

// Navigation placeholders (populated by nav.ui.js)
window.goPage          = window.goPage          || function(){};
window.goSubPage       = window.goSubPage       || function(){};
window.getCurrentTab   = window.getCurrentTab   || function(){ return 'dashboard'; };
window.renderActiveTab = window.renderActiveTab || function(){};
window._refreshAllTabs = window._refreshAllTabs || function(){};
window.today           = window.today           || function(){ return new Date().toISOString().split('T')[0]; };

// Auth UI placeholders (populated by auth.module.js)
window.currentUser          = null;
window.getCurrentUser       = window.getCurrentUser       || function(){ return null; };
window.setCurrentUser       = window.setCurrentUser       || function(){};
window.isAdmin              = window.isAdmin              || function(){ return false; };
window.isKetoan             = window.isKetoan             || function(){ return false; };
window.isGiamdoc            = window.isGiamdoc            || function(){ return false; };
window.canAccess            = window.canAccess            || function(){ return false; };
window.loadUsers            = window.loadUsers            || function(){ return []; };
window.saveUsers            = window.saveUsers            || function(){};
window.ensureDefaultUsers   = window.ensureDefaultUsers   || function(){};
window.getDeviceId          = window.getDeviceId          || function(){ return ''; };
window.mergeUsers           = window.mergeUsers           || function(){ return []; };
window.syncAuthUI           = window.syncAuthUI           || function(){};
window.toggleUserDropdown   = window.toggleUserDropdown   || function(){};
window.openAccountSettings  = window.openAccountSettings  || function(){};
window.closeAccountSettings = window.closeAccountSettings || function(){};
window.doLogin              = window.doLogin              || function(){};
window.logout               = window.logout               || function(){};
window.saveAccountSettings  = window.saveAccountSettings  || function(){};
window.updateUser           = window.updateUser           || function(){};
window.showCloudSetup       = window.showCloudSetup       || function(){};
window.forceLogout          = window.forceLogout          || function(){};
window.applyNavPermissions  = window.applyNavPermissions  || function(){};
window.applyRoleUI          = window.applyRoleUI          || function(){};
window.queueApplyRoleUI     = window.queueApplyRoleUI     || function(){};
window.startRoleObserver    = window.startRoleObserver    || function(){};
window.initAuth             = window.initAuth             || function(){};
window.afterSync            = window.afterSync            || function(){};
window.showLoginError       = window.showLoginError       || function(){};
window.clearLoginError      = window.clearLoginError      || function(){};
window.validateCurrentSession = window.validateCurrentSession || function(){ return null; };
