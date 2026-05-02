// ══════════════════════════════════════════════════════════════
// src/services/excel.svc.js — Excel Import/Export Service
// Prompt 4 — Skeleton (nhapxuat.js 89KB sẽ bốc chi tiết ở prompt 8-9)
// ══════════════════════════════════════════════════════════════
//
// File nhapxuat.js (89KB) chứa logic export Excel rất phức tạp
// với nhiều sheet templates khác nhau (Hóa đơn, Chấm công, Tiền ứng...)
// Việc bốc toàn bộ cần các module UI đã sẵn sàng (Prompt 5-9).
//
// Hiện tại: export placeholder + bridge để app không vỡ.
// Sẽ bốc đầy đủ khi refactor nhapxuat.js ở giai đoạn 4.
// ══════════════════════════════════════════════════════════════

/**
 * Placeholder: Export toàn bộ data ra file Excel
 * Logic thực tế vẫn nằm trong nhapxuat.js (file cũ)
 */
export function exportExcelTemplate() {
  // Delegate về hàm global cũ nếu có
  if (typeof window.toolExportExcel === 'function') {
    return window.toolExportExcel();
  }
  console.warn('[excel.svc] exportExcelTemplate chưa sẵn sàng');
}

/**
 * Placeholder: Import data từ file Excel
 */
export function importExcelFile(file) {
  if (typeof window.toolImportExcel === 'function') {
    return window.toolImportExcel();
  }
  console.warn('[excel.svc] importExcelFile chưa sẵn sàng');
}

// ══════════════════════════════════════════════════════════════
// 🔌 BRIDGE TẠM
// ══════════════════════════════════════════════════════════════
window._excelSvc = { exportExcelTemplate, importExcelFile };
