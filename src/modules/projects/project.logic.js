// ══════════════════════════════════════════════════════════════
// src/modules/projects/project.logic.js — Project Business Logic
// Prompt 5 — Bốc từ projects.js (phần logic, không UI)
// Import services, KHÔNG truy cập DOM
// ══════════════════════════════════════════════════════════════

import {
  PROJECT_STATUS, PROJECT_COMPANY, _PROJ_FACTORS,
  isValidProject, projTypeByName,
  findProjectIdByName, getProjectById, resolveProjectName,
  isCompanyRecord, isProjectInYear,
  getProjectDays, getProjectFactor, getProjectWeight,
  getProjectAutoStartDate, getSortedProjects,
  ctInActiveYear, entityInYear, rebuildCatCTFromProjects,
} from '../../services/project.svc.js';

// Re-export service functions cho tiện
export {
  PROJECT_STATUS, PROJECT_COMPANY,
  isValidProject, projTypeByName,
  findProjectIdByName, getProjectById, resolveProjectName,
  isCompanyRecord, isProjectInYear,
  getProjectDays, getProjectFactor, getProjectWeight,
  getProjectAutoStartDate, getSortedProjects,
  ctInActiveYear, entityInYear, rebuildCatCTFromProjects,
};

// ── Constants ───────────────────────────────────────────────
const _VALID_STATUSES = new Set(['planning','active','completed','closed']);
const _PROJ_VALID_TYPES = new Set(['CT','SC','OTHER']);

export const PT_STATUS_META = {
  planning:  { label: 'Chuẩn bị thi công', color: '#1565c0', bg: '#e3f2fd' },
  active:    { label: 'Đang thi công',  color: '#1a7a45', bg: '#e8f5e9' },
  completed: { label: 'Hoàn thành',     color: '#c8870a', bg: '#fef3dc' },
  closed:    { label: 'Đã quyết toán',  color: '#6c6560', bg: '#eeece8' }
};

export const PT_GROUP_LABELS = {
  planning:  '📋 Chuẩn Bị Thi Công',
  active:    '🏗️ Đang Thi Công',
  completed: '✅ Hoàn Thành (Chưa QT)',
  closed:    '🔒 Đã Quyết Toán'
};

export const PT_ORDER = ['planning','active','completed','closed'];

// ══════════════════════════════════════════════════════════════
//  CRUD Operations
// ══════════════════════════════════════════════════════════════

/**
 * Tạo project mới (pure — trả về object, không save)
 */
export function createProjectData({ name, type = 'OTHER', status = 'active', startDate, endDate, closedDate, year, note = '' }, activeYear) {
  if (!name || !name.trim()) throw new Error('Tên công trình không được để trống');
  if (!PROJECT_STATUS[status]) throw new Error('Trạng thái không hợp lệ: ' + status);
  const nowMs = Date.now();
  const todayS = new Date().toISOString().slice(0, 10);
  const curYear = new Date().getFullYear();
  const _year = year || (activeYear > 0 ? activeYear : curYear);
  const sd = startDate || (activeYear === 0 ? todayS : _year < curYear ? `${_year}-01-01` : todayS);
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    type: _PROJ_VALID_TYPES.has(type) ? type : 'OTHER',
    status, startDate: sd,
    endDate: endDate || null,
    closedDate: closedDate || null,
    note: note || '',
    createdYear: _year,
    createdAt: nowMs, updatedAt: nowMs
  };
}

/**
 * Cập nhật project (pure — trả về updated object)
 */
export function updateProjectData(project, changes) {
  if (!project || project.id === 'COMPANY') return project;
  const { id, createdAt, updatedAt, ...safeChanges } = changes;
  return {
    ...project, ...safeChanges,
    id: project.id, createdAt: project.createdAt,
    updatedAt: Date.now()
  };
}

/**
 * Kiểm tra có thể xóa project
 */
export function canDeleteProject(projectId, invoices, ccData, tbData, ungRecords) {
  if (!projectId) return true;
  return !(
    (invoices || []).some(i => !i.deletedAt && i.projectId === projectId) ||
    (ccData || []).some(c => !c.deletedAt && c.projectId === projectId) ||
    (tbData || []).some(t => !t.deletedAt && t.projectId === projectId) ||
    (ungRecords || []).some(r => !r.deletedAt && r.projectId === projectId)
  );
}

/**
 * Xóa project không hợp lệ
 */
export function cleanupInvalidProjects(projects, badNames) {
  const badSet = new Set((badNames || []).map(n => (n || '').trim()));
  return projects.filter(p =>
    p.deletedAt || (isValidProject(p) && !badSet.has((p.name || '').trim()))
  );
}

// ══════════════════════════════════════════════════════════════
//  KPI & Cost Calculations
// ══════════════════════════════════════════════════════════════

/**
 * Build invoice map cho batch lookup (1 lần cho toàn bộ grid)
 */
export function buildInvoiceMap(invoices, activeYears) {
  const inYear = dateStr => {
    if (!activeYears || activeYears.size === 0) return true;
    if (!dateStr) return false;
    return activeYears.has(parseInt(dateStr.split('-')[0]));
  };
  const all = (invoices || []).filter(inv => inYear(inv.ngay));
  const byId = {}, byName = {};
  for (const inv of all) {
    if (inv.projectId) {
      if (!byId[inv.projectId]) byId[inv.projectId] = [];
      byId[inv.projectId].push(inv);
    } else if (inv.congtrinh) {
      if (!byName[inv.congtrinh]) byName[inv.congtrinh] = [];
      byName[inv.congtrinh].push(inv);
    }
  }
  return { byId, byName, all };
}

/**
 * Lấy chi phí từ invoice map đã build
 */
export function getCostsFromMap(project, invMap) {
  const matched = (invMap.byId[project.id] || []).concat(invMap.byName[project.name] || []);
  return {
    total: matched.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0),
    count: matched.length,
    invs: matched
  };
}

/**
 * Tổng chi phí CÔNG TY trong năm
 */
export function getCompanyCost(invoices, activeYears) {
  const inYear = dateStr => {
    if (!activeYears || activeYears.size === 0) return true;
    if (!dateStr) return false;
    return activeYears.has(parseInt(dateStr.split('-')[0]));
  };
  return (invoices || [])
    .filter(i => !i.deletedAt && inYear(i.ngay) && i.projectId === 'COMPANY')
    .reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
}

/**
 * Phân bổ chi phí chung theo trọng số
 */
export function allocateCompanyCost(projects, invoices, activeYear, activeYears) {
  const projs = getSortedProjects(projects).filter(p => p.startDate && getProjectDays(p, activeYear) > 0);
  const totalCost = getCompanyCost(invoices, activeYears);
  const totalWeight = projs.reduce((s, p) => s + getProjectWeight(p, activeYear), 0);
  return projs.map(p => {
    const weight = getProjectWeight(p, activeYear);
    const pct = totalWeight > 0 ? weight / totalWeight : 0;
    return { p, weight: Math.round(weight), pct, allocated: totalCost * pct };
  });
}

/**
 * Tính thời gian thi công (text)
 */
export function getDurationText(p) {
  if (!p.startDate) return '';
  const start = new Date(p.startDate);
  const end = (p.endDate && p.status === 'closed') ? new Date(p.endDate) : new Date();
  const weeks = Math.floor((end - start) / (7 * 24 * 3600 * 1000));
  if (weeks <= 0) return '';
  if (weeks < 9) return `${weeks} tuần`;
  return `${Math.round(weeks / 4.33)} tháng`;
}

/**
 * Tính số ngày thi công (số)
 */
export function getDurationDays(p, invList) {
  const sd = p.startDate || (() => {
    const first = (invList || [])
      .filter(i => i.source === 'cc' && i.ngay)
      .sort((a, b) => a.ngay.localeCompare(b.ngay))[0];
    return first ? first.ngay : null;
  })();
  if (!sd) return 0;
  const endMs = (p.endDate && p.status === 'closed')
    ? new Date(p.endDate).getTime() : Date.now();
  return Math.max(0, Math.floor((endMs - new Date(sd).getTime()) / 86400000));
}

/**
 * Format YYYY-MM-DD → DD-MM-YYYY
 */
export function fmtProjDate(iso) {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// ══════════════════════════════════════════════════════════════
// 🔌 BRIDGE TẠM
// ══════════════════════════════════════════════════════════════
window._projectLogic = {
  PT_STATUS_META, PT_GROUP_LABELS, PT_ORDER,
  createProjectData, updateProjectData, canDeleteProject,
  cleanupInvalidProjects, buildInvoiceMap, getCostsFromMap,
  getCompanyCost, allocateCompanyCost, getDurationText,
  getDurationDays, fmtProjDate,
};
