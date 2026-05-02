// tienich.js — Thin Bridge Stub
// All logic has been ported to ES Modules in src/utils/ and src/services/
// This file only initializes empty window globals that the ESM files will populate.

console.log('[tienich.js] Legacy script bypassed. Logic is now handled by ESM.');

// Empty window bridges to prevent "undefined is not a function" errors
// during the gap between synchronous script execution and ESM initialization.
window.toast = window.toast || function(){};
window.numFmt = window.numFmt || function(n){return n};
window.fmtM = window.fmtM || function(n){return n};
window.parseMoney = window.parseMoney || function(){return 0};
window.updateTop = window.updateTop || function(){};
window.normViStr = window.normViStr || function(s){return s};
window.x = window.x || function(s){return s};
window.ctInActiveYear = window.ctInActiveYear || function(){return true};
window.entityInYear = window.entityInYear || function(){return true};
window.buildInvoices = window.buildInvoices || function(){};
window.clearInvoiceCache = window.clearInvoiceCache || function(){};
window.getInvoicesCached = window.getInvoicesCached || function(){return []};
window.buildYearSelect = window.buildYearSelect || function(){};
