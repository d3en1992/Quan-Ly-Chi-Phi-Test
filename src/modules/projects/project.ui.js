// ══════════════════════════════════════════════════════════════
// src/modules/projects/project.ui.js — Project UI Module
// Prompt 17 — Full port từ projects.js (phần UI/DOM)
// ══════════════════════════════════════════════════════════════

import { escapeHtml } from '../../utils/string.util.js';
import { fmtM, fmtS } from '../../utils/math.util.js';

const x = escapeHtml;

// ── UI Constants ──────────────────────────────────────────────
const _PT_STATUS_META = {
  planning:  { label: 'Chuẩn bị thi công', color: '#1565c0', bg: '#e3f2fd' },
  active:    { label: 'Đang thi công',      color: '#1a7a45', bg: '#e8f5e9' },
  completed: { label: 'Hoàn thành',         color: '#c8870a', bg: '#fef3dc' },
  closed:    { label: 'Đã quyết toán',      color: '#6c6560', bg: '#eeece8' }
};
const _PT_GROUP_LABELS = {
  planning:  '📋 Chuẩn Bị Thi Công',
  active:    '🏗️ Đang Thi Công',
  completed: '✅ Hoàn Thành (Chưa QT)',
  closed:    '🔒 Đã Quyết Toán'
};
const _PT_ORDER = ['planning', 'active', 'completed', 'closed'];
const _PROJECT_STATUS_LABELS = {
  planning:  'Chuẩn bị thi công',
  active:    'Đang thi công',
  completed: 'Đã hoàn thành (chưa quyết toán)',
  closed:    'Đã quyết toán'
};

// ── Filter state ──────────────────────────────────────────────
let _ctSearch  = '';
let _ctFStatus = '';
let _ctFType   = '';
let _ctFLaiLo  = '';

// ── Private helpers ───────────────────────────────────────────
function _isKetoan() {
  return typeof window.isKetoan === 'function' && window.isKetoan();
}

function _fmtProjDate(iso) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function _ptStatusBadge(status) {
  const m = _PT_STATUS_META[status] || { label: status, color: '#6c6560', bg: '#eeece8' };
  return `<span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${m.bg};color:${m.color};white-space:nowrap">${m.label}</span>`;
}

function _ptStatBox(label, value, color, bg) {
  return `<div style="background:${bg};border-radius:10px;padding:14px 16px">
    <div style="font-size:10px;color:var(--ink3);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${label}</div>
    <div style="font-size:26px;font-weight:700;color:${color};font-family:'IBM Plex Mono',monospace">${value}</div>
  </div>`;
}

function _projTypeByName(name) {
  if (!name) return 'OTHER';
  const n = name.trim().toUpperCase();
  if (n.startsWith('CT')) return 'CT';
  if (n.startsWith('SC')) return 'SC';
  return 'OTHER';
}

function _ptDuration(p) {
  if (!p.startDate) return '';
  const start = new Date(p.startDate);
  const end   = (p.endDate && p.status === 'closed') ? new Date(p.endDate) : new Date();
  const weeks = Math.floor((end - start) / (7 * 24 * 3600 * 1000));
  if (weeks <= 0) return '';
  if (weeks < 9) return `${weeks} tuần`;
  return `${Math.round(weeks / 4.33)} tháng`;
}

function _ptDurationDays(p, invList) {
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

function _buildInvoiceMap() {
  const getInvoicesCached = window.getInvoicesCached;
  const inActiveYear      = window.inActiveYear;
  if (!getInvoicesCached) return { byId: {}, byName: {}, all: [] };
  const all    = getInvoicesCached().filter(inv => inActiveYear ? inActiveYear(inv.ngay) : true);
  const byId   = {};
  const byName = {};
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

function _ctGetCosts(project) {
  const getInvoicesCached = window.getInvoicesCached;
  const inActiveYear      = window.inActiveYear;
  if (!getInvoicesCached) return { total: 0, count: 0, invs: [] };
  const matched = getInvoicesCached().filter(inv => {
    if (!inActiveYear(inv.ngay)) return false;
    if (inv.projectId) return inv.projectId === project.id;
    return inv.congtrinh === project.name;
  });
  return {
    total: matched.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0),
    count: matched.length,
    invs:  matched
  };
}

function _ctGetCostsFromMap(project, invMap) {
  const matched = (invMap.byId[project.id] || []).concat(invMap.byName[project.name] || []);
  return {
    total: matched.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0),
    count: matched.length,
    invs:  matched
  };
}

// ── Navigation ────────────────────────────────────────────────
function _goTabWithCT(tabId, ctName) {
  const _pageId = { hoadon: 'nhap', ung: 'nhapung' }[tabId] || tabId;
  const navBtn  = document.querySelector(`[data-page="${_pageId}"]`);
  if (navBtn && typeof window.goPage === 'function') window.goPage(navBtn, _pageId);
  if (typeof window.closeModal === 'function') window.closeModal();

  setTimeout(() => {
    if (tabId === 'hoadon') {
      const subBtn = document.querySelector('#page-nhap .sub-nav-btn[onclick*="sub-tat-ca"]');
      if (subBtn && typeof window.goSubPage === 'function') window.goSubPage(subBtn, 'sub-tat-ca');
      const sel = document.getElementById('f-ct');
      if (sel) { sel.value = ctName; if (typeof window.filterAndRender === 'function') window.filterAndRender(); }
    } else if (tabId === 'ung') {
      const sel = document.getElementById('uf-ct');
      if (sel) { sel.value = ctName; if (typeof window.filterAndRenderUng === 'function') window.filterAndRenderUng(); }
    } else if (tabId === 'doanhthu') {
      window._dtCtFilter = ctName;
      const subBtn = document.getElementById('dt-sub-thongke-btn');
      if (subBtn && typeof window.dtGoSub === 'function') window.dtGoSub(subBtn, 'dt-sub-thongke');
    } else if (tabId === 'thietbi') {
      const sel = document.getElementById('tb-filter-ct');
      if (sel) {
        sel.value = ctName;
        if (typeof window.tbGoTo === 'function') window.tbGoTo(1);
        else if (typeof window.tbRenderList === 'function') window.tbRenderList();
      }
    }
  }, 150);
}

// ══════════════════════════════════════════════════════════════
//  TỔNG QUAN — renderCTOverview + filters
// ══════════════════════════════════════════════════════════════
function renderProjectsPage() { renderCTOverview(); }

function renderCTOverview() {
  const wrap = document.getElementById('ct-overview-wrap');
  if (!wrap) return;

  const activeYear    = window.activeYear || 0;
  const validProjects = typeof window.getAllProjects === 'function'
    ? window.getAllProjects() : [];
  const allProjects   = window.projects || validProjects;

  const _projInYear = (p) => {
    if (!activeYear || activeYear === 0) return true;
    const yearStart = activeYear + '-01-01';
    const yearEnd   = activeYear + '-12-31';
    const sd = p.startDate || '';
    const ed = p.endDate   || '';
    if (!sd) return false;
    if (sd > yearEnd) return false;
    if (ed && ed < yearStart) return false;
    return true;
  };

  const yearProjects = validProjects.filter(_projInYear);
  const counts = { planning: 0, active: 0, completed: 0, closed: 0 };
  yearProjects.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
  const _ctCount   = yearProjects.filter(p => _projTypeByName(p.name) === 'CT').length;
  const yearLabel  = activeYear === 0 ? 'Tất cả năm' : `Năm ${activeYear}`;
  const invMap     = _buildInvoiceMap();

  const totalCost  = invMap.all
    .filter(i => i.projectId !== 'COMPANY' && i.congtrinh !== 'CÔNG TY')
    .reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  const thuRecords = window.thuRecords || [];
  const inAY       = window.inActiveYear;
  const totalThu   = thuRecords.filter(r => !r.deletedAt && (inAY ? inAY(r.ngay) : true))
    .reduce((s, r) => s + (r.tien || 0), 0);
  const totalLL    = totalThu - totalCost;
  const llClr      = totalLL > 0 ? '#16a34a' : totalLL < 0 ? '#dc2626' : 'var(--ink3)';
  const llPfx      = totalLL > 0 ? '+' : '';

  const kpiCount = (lbl, val, color, bg) =>
    `<div style="background:${bg};border-radius:10px;padding:12px 14px;flex:1;min-width:90px;text-align:center">
       <div style="font-size:10px;color:${color};font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;opacity:.8">${lbl}</div>
       <div style="font-size:26px;font-weight:700;color:${color};font-family:'IBM Plex Mono',monospace">${val}</div>
     </div>`;
  const kpiMoney = (lbl, val, color, bg) =>
    `<div style="background:${bg};border-radius:10px;padding:12px 16px;flex:1;min-width:130px">
       <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">${lbl}</div>
       <div style="font-size:18px;font-weight:700;color:${color};font-family:'IBM Plex Mono',monospace;line-height:1.2">${val}</div>
       <div style="font-size:10px;color:var(--ink3);margin-top:2px">${x(yearLabel)}</div>
     </div>`;

  const selS = 'padding:7px 10px;border:1.5px solid var(--line2);border-radius:7px;font-family:inherit;font-size:12px;background:var(--paper);color:var(--ink);outline:none';
  const inpS = 'flex:1;min-width:160px;padding:8px 12px;border:1.5px solid var(--line2);border-radius:7px;font-family:inherit;font-size:13px;background:var(--paper);color:var(--ink);outline:none';

  wrap.innerHTML = `
    <div class="section-header" style="margin-top:8px">
      <div class="section-title"><span class="dot"></span>Tổng Quan Công Trình</div>
      <button class="btn btn-primary btn-sm" onclick="openCTCreateModal()">+ Thêm Công Trình</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <div style="background:var(--bg);border-radius:10px;padding:12px 14px;flex:1;min-width:90px;text-align:center">
        <div style="font-size:10px;color:var(--ink);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;opacity:.8">Tổng</div>
        <div style="font-family:'IBM Plex Mono',monospace;white-space:nowrap">
          <span id="ct-kpi-total" style="font-size:26px;font-weight:700;color:var(--ink)">${yearProjects.length}</span>
          <span id="ct-kpi-split" style="font-size:13px;font-weight:500;color:var(--ink3);margin-left:5px">(${_ctCount}/${yearProjects.length - _ctCount})</span>
        </div>
      </div>
      ${kpiCount('Chuẩn bị',   counts.planning,  '#1565c0', '#e3f2fd')}
      ${kpiCount('Thi công',   counts.active,    '#1a7a45', '#e8f5e9')}
      ${kpiCount('Hoàn thành', counts.completed, '#c8870a', '#fef3dc')}
      ${kpiCount('Quyết toán', counts.closed,    '#6c6560', '#eeece8')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
      ${kpiMoney('Tổng Chi Phí', fmtM(totalCost), '#dc2626', 'rgba(220,38,38,.07)')}
      ${!_isKetoan() ? kpiMoney('Tổng Đã Thu', fmtM(totalThu), '#16a34a', 'rgba(22,163,74,.07)') : ''}
      ${!_isKetoan() ? kpiMoney('Lãi / Lỗ',
          (totalThu || totalCost) ? llPfx + fmtM(totalLL) : '—',
          llClr, 'rgba(0,0,0,.03)') : ''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <input id="ct-search" type="search" placeholder="🔍  Tìm công trình..." style="${inpS}"
        oninput="_ctApply()" value="${x(_ctSearch)}">
      <select id="ct-f-status" style="${selS}" onchange="_ctApply()">
        <option value="">Tất cả trạng thái</option>
        <option value="planning">Chuẩn bị thi công</option>
        <option value="active">Đang thi công</option>
        <option value="completed">Hoàn thành</option>
        <option value="closed">Đã quyết toán</option>
        <option value="no_cost">Không có chi phí</option>
      </select>
      <select id="ct-f-type" style="${selS}" onchange="_ctApply()">
        <option value="">Tất cả loại</option>
        <option value="CT">Công trình (CT)</option>
        <option value="SC">Sửa chữa (SC)</option>
        <option value="OTHER">Khác</option>
      </select>
      <select id="ct-f-lailo" style="${selS}; display: ${_isKetoan() ? 'none' : ''};" onchange="_ctApply()">
        <option value="">Tất cả</option>
        <option value="lai">Có lãi</option>
        <option value="lo">Đang lỗ</option>
        <option value="khongdu">Chưa đủ dữ liệu</option>
      </select>
    </div>
    <div class="section-title" style="margin-bottom:10px">
      <span class="dot"></span>Công trình (<span id="ct-grid-count">…</span>)
    </div>
    <div id="ct-grid-wrap"></div>
  `;

  const elStatus = document.getElementById('ct-f-status');
  const elType   = document.getElementById('ct-f-type');
  const elLaiLo  = document.getElementById('ct-f-lailo');
  if (elStatus) elStatus.value = _ctFStatus;
  if (elType)   elType.value   = _ctFType;
  if (elLaiLo)  elLaiLo.value  = _ctFLaiLo;

  _ctRenderGrid();
}

function _ctApply() {
  _ctSearch  = document.getElementById('ct-search')?.value   || '';
  _ctFStatus = document.getElementById('ct-f-status')?.value || '';
  _ctFType   = document.getElementById('ct-f-type')?.value   || '';
  _ctFLaiLo  = document.getElementById('ct-f-lailo')?.value  || '';
  _ctRenderGrid();
}

function _ctRenderGrid() {
  const gridWrap = document.getElementById('ct-grid-wrap');
  if (!gridWrap) return;

  const q      = _ctSearch.toLowerCase().trim();
  const invMap = _buildInvoiceMap();
  const allProjects = typeof window.getAllProjects === 'function' ? window.getAllProjects() : [];
  const inAY   = window.inActiveYear;

  if (_ctFStatus === 'no_cost') {
    const invSet = new Set(
      (window.getInvoicesCached ? window.getInvoicesCached() : [])
        .map(i => typeof window.resolveProjectName === 'function' ? window.resolveProjectName(i) : (i.congtrinh || i.ct))
        .filter(Boolean)
    );
    let noCostList = allProjects.filter(p => !invSet.has(p.name));
    if (q)        noCostList = noCostList.filter(p => p.name.toLowerCase().includes(q));
    if (_ctFType) noCostList = noCostList.filter(p => _projTypeByName(p.name) === _ctFType);

    const countEl = document.getElementById('ct-grid-count');
    if (countEl) countEl.textContent = noCostList.length;
    const kpiTotalEl = document.getElementById('ct-kpi-total');
    if (kpiTotalEl) kpiTotalEl.textContent = noCostList.length;
    const ctCount = noCostList.filter(p => _projTypeByName(p.name) === 'CT').length;
    const kpiSplitEl = document.getElementById('ct-kpi-split');
    if (kpiSplitEl) kpiSplitEl.textContent = `(${ctCount}/${noCostList.length - ctCount})`;

    if (!noCostList.length) {
      gridWrap.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--ink3);font-size:14px">Không có công trình nào thiếu chi phí.</div>`;
      return;
    }
    gridWrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
      ${noCostList.map(p => {
        const dim     = p.status === 'closed' ? 'opacity:.72;' : '';
        const _pt     = _projTypeByName(p.name);
        const typeTag = (_pt !== 'OTHER') ? `<span style="font-size:10px;color:var(--ink3);margin-left:4px">[${_pt}]</span>` : '';
        return `<div class="ct-card" onclick="openCTDetail('${p.id}')" style="cursor:pointer;${dim}">
          <div class="ct-card-head" style="align-items:flex-start">
            <div style="flex:1;min-width:0">
              <div class="ct-card-name" style="margin-bottom:5px">${x(p.name)}${typeTag}</div>
              <div style="margin-bottom:4px">${_ptStatusBadge(p.status)}</div>
              <div class="ct-card-count"><span class="ghost">Chưa phát sinh</span></div>
            </div>
            <div class="ct-card-total" style="margin-left:8px;color:var(--ink3)">—</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
    return;
  }

  const thuRecords    = window.thuRecords    || [];
  const ungRecords    = window.ungRecords    || [];

  let withData = allProjects.map(p => {
    const c     = _ctGetCostsFromMap(p, invMap);
    const thu   = thuRecords.filter(r => {
      if (r.deletedAt || !(inAY ? inAY(r.ngay) : true)) return false;
      return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
    }).reduce((s, r) => s + (r.tien || 0), 0);
    const ungTp = ungRecords.filter(r => {
      if (r.deletedAt || r.loai !== 'thauphu' || !(inAY ? inAY(r.ngay) : true)) return false;
      return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
    }).reduce((s, r) => s + (r.tien || 0), 0);
    const laiLo = thu - (c.total + ungTp);
    const days  = _ptDurationDays(p, c.invs);
    return { p, c, laiLo, days, thu, ungTp };
  }).filter(({ c }) => c.count > 0);

  withData.sort((a, b) => {
    const statusOrder = { planning: 1, active: 2, completed: 3, closed: 4 };
    const getPrefixOrder = (name) => {
      const n = (name || '').trim().toUpperCase();
      if (n.startsWith('CT')) return 1;
      if (n.startsWith('SC')) return 2;
      return 3;
    };
    const s1 = statusOrder[a.p.status] || 99, s2 = statusOrder[b.p.status] || 99;
    if (s1 !== s2) return s1 - s2;
    const p1 = getPrefixOrder(a.p.name), p2 = getPrefixOrder(b.p.name);
    if (p1 !== p2) return p1 - p2;
    return (a.p.name || '').localeCompare(b.p.name || '', 'vi');
  });

  if (q)           withData = withData.filter(({ p }) => p.name.toLowerCase().includes(q));
  if (_ctFStatus)  withData = withData.filter(({ p }) => p.status === _ctFStatus);
  if (_ctFType)    withData = withData.filter(({ p }) => _projTypeByName(p.name) === _ctFType);
  if (_ctFLaiLo === 'lai')     withData = withData.filter(({ laiLo, c, thu }) => (c.total || thu) && laiLo > 0);
  if (_ctFLaiLo === 'lo')      withData = withData.filter(({ laiLo, c, thu }) => (c.total || thu) && laiLo < 0);
  if (_ctFLaiLo === 'khongdu') withData = withData.filter(({ c, thu }) => !c.total && !thu);

  const countEl = document.getElementById('ct-grid-count');
  if (countEl) countEl.textContent = withData.length;
  const kpiTotalEl = document.getElementById('ct-kpi-total');
  if (kpiTotalEl) kpiTotalEl.textContent = withData.length;
  const ctCount2 = withData.filter(({ p }) => _projTypeByName(p.name) === 'CT').length;
  const kpiSplitEl = document.getElementById('ct-kpi-split');
  if (kpiSplitEl) kpiSplitEl.textContent = `(${ctCount2}/${withData.length - ctCount2})`;

  if (!withData.length) {
    gridWrap.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--ink3);font-size:14px">
      Không tìm thấy công trình nào.
      ${!_ctSearch && !_ctFStatus && !_ctFType
        ? `<button class="btn btn-outline btn-sm" onclick="openCTCreateModal()" style="margin-left:8px">+ Thêm ngay</button>`
        : ''}
    </div>`;
    return;
  }

  const companyCosts = _ctGetCostsFromMap({ id: 'COMPANY', name: 'CÔNG TY' }, invMap);
  const companyCard  = `<div class="ct-card" onclick="openCTDetail('COMPANY')" style="cursor:pointer;border:2px solid var(--line2)">
    <div class="ct-card-head" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div class="ct-card-name" style="margin-bottom:5px">🏢 CÔNG TY</div>
        <div style="margin-bottom:4px"><span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:#e3f2fd;color:#1565c0;white-space:nowrap">Chi phí chung</span></div>
        <div class="ct-card-count">${companyCosts.count} hóa đơn</div>
      </div>
      <div class="ct-card-total" style="margin-left:8px">${fmtS(companyCosts.total)}</div>
    </div>
  </div>`;

  gridWrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
    ${companyCard}
    ${withData.map(({ p, c, days }) => {
      const dim      = p.status === 'closed' ? 'opacity:.72;' : '';
      const durLabel = days > 0 ? `${days} ngày` : '';
      const _pt      = _projTypeByName(p.name);
      const typeTag  = (_pt !== 'OTHER') ? `<span style="font-size:10px;color:var(--ink3);margin-left:4px">[${_pt}]</span>` : '';
      const countLine = c.count > 0
        ? `<span>${c.count} hóa đơn</span>${durLabel ? `<span style="color:var(--ink3)">·</span><span>${durLabel}</span>` : ''}`
        : `<span class="ghost">Chưa phát sinh</span>`;
      return `<div class="ct-card" onclick="openCTDetail('${p.id}')" style="cursor:pointer;${dim}">
        <div class="ct-card-head" style="align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div class="ct-card-name" style="margin-bottom:5px">${x(p.name)}${typeTag}</div>
            <div style="margin-bottom:4px">${_ptStatusBadge(p.status)}</div>
            <div class="ct-card-count" style="display:flex;gap:6px;flex-wrap:wrap">${countLine}</div>
          </div>
          <div class="ct-card-total" style="margin-left:8px">${fmtS(c.total)}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  DETAIL MODAL
// ══════════════════════════════════════════════════════════════
function openCTDetail(id) {
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (!p) return;
  const c          = _ctGetCosts(p);
  const activeYear = window.activeYear || 0;
  const yearLabel  = activeYear === 0 ? 'Tất cả năm' : `Năm ${activeYear}`;
  const isCompany  = id === 'COMPANY';
  const isClosed   = p.status === 'closed';
  const inAY       = window.inActiveYear;
  const inAYFn     = inAY || (() => true);

  const byLoai = {};
  c.invs.forEach(inv => { (byLoai[inv.loai] = byLoai[inv.loai] || []).push(inv); });
  const loaiRows = Object.entries(byLoai)
    .sort((a, b) => b[1].reduce((s,i)=>s+(i.thanhtien||i.tien||0),0) -
                    a[1].reduce((s,i)=>s+(i.thanhtien||i.tien||0),0));

  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.innerHTML = `🏗️ ${x(p.name)} ${_ptStatusBadge(p.status)}`;

  const matCost  = c.invs.filter(i => i.source !== 'cc').reduce((s,i) => s+(i.thanhtien||i.tien||0), 0);
  const labCost  = c.invs.filter(i => i.source === 'cc').reduce((s,i) => s+(i.thanhtien||i.tien||0), 0);

  const ungRecords = window.ungRecords || [];
  const ungTpCost  = ungRecords.filter(r => {
    if (r.deletedAt || r.loai !== 'thauphu' || !inAYFn(r.ngay)) return false;
    return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
  }).reduce((s,r) => s+(r.tien||0), 0);
  const ungNccCost = ungRecords.filter(r => {
    if (r.deletedAt || r.loai !== 'nhacungcap' || !inAYFn(r.ngay)) return false;
    return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
  }).reduce((s,r) => s+(r.tien||0), 0);
  const nccNamesInUng = new Set(ungRecords.filter(r => {
    if (r.deletedAt || r.loai !== 'nhacungcap') return false;
    return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
  }).map(r => (r.tp||'').trim()).filter(Boolean));
  const tongHopDongNCC = c.invs.filter(i => i.ncc && nccNamesInUng.has(i.ncc.trim()))
    .reduce((s,i) => s+(i.thanhtien||i.tien||0), 0);
  const tongChiCongTrinh = c.total + ungTpCost + ungNccCost - tongHopDongNCC;

  const hopDongData = window.hopDongData || {};
  const hdct = (typeof window._hdLookup === 'function')
    ? (window._hdLookup(p.id) || window._hdLookup(p.name))
    : (hopDongData[p.name] && !hopDongData[p.name].deletedAt ? hopDongData[p.name] : null);
  const tongGiaTriHD = hdct ? ((hdct.giaTri||0)+(hdct.giaTriphu||0)+(hdct.phatSinh||0)) : 0;

  const thuRecords = window.thuRecords || [];
  const tongThu    = thuRecords.filter(r => {
    if (r.deletedAt || !inAYFn(r.ngay)) return false;
    return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
  }).reduce((s,r) => s+(r.tien||0), 0);
  const soDotThu   = thuRecords.filter(r => {
    if (r.deletedAt || !inAYFn(r.ngay)) return false;
    return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
  }).length;

  const thauPhuContracts = window.thauPhuContracts || [];
  const tongHDTP = thauPhuContracts.filter(r => {
    if (r.deletedAt) return false;
    return r.projectId ? r.projectId === p.id : r.congtrinh === p.name;
  }).reduce((s,r) => s+(r.giaTri||0)+(r.phatSinh||0), 0);

  const laiLo   = tongThu - tongChiCongTrinh;
  const chiPhiCongTy = (window.getInvoicesCached ? window.getInvoicesCached() : []).filter(inv => {
    if (!inAYFn(inv.ngay)) return false;
    return inv.projectId === 'COMPANY' || inv.congtrinh === 'CÔNG TY';
  }).reduce((s,i) => s+(i.thanhtien||i.tien||0), 0);

  const llColor  = laiLo > 0 ? 'var(--green)' : laiLo < 0 ? 'var(--red)' : 'var(--ink3)';
  const llPrefix = laiLo > 0 ? '+' : '';
  const conPhaiThu = tongGiaTriHD - tongThu;

  const _ctStartDate = p.startDate || (() => {
    const firstCC = c.invs.filter(i => i.source === 'cc' && i.ngay)
      .sort((a,b) => a.ngay.localeCompare(b.ngay))[0];
    return firstCC ? firstCC.ngay : null;
  })();
  const _ctEndMs   = (p.endDate && p.status === 'closed') ? new Date(p.endDate).getTime() : Date.now();
  const durationDays = _ctStartDate
    ? Math.max(0, Math.floor((_ctEndMs - new Date(_ctStartDate).getTime()) / 86400000)) : 0;
  const _durLabel  = durationDays > 0 ? `${durationDays} ngày` : '';
  const _sd        = _ctStartDate;

  const allocate   = typeof window.allocateCompanyCost === 'function' ? window.allocateCompanyCost() : [];
  const _allocEntry = (!isCompany && p.startDate && allocate.length)
    ? allocate.find(a => a.p && a.p.id === p.id) : null;
  const _chiPhiChungFixed = _allocEntry ? _allocEntry.allocated : 0;

  const CG = '#16a34a', CR = '#dc2626', CA = '#d97706', CB = '#1e40af';
  const BG = 'rgba(22,163,74,.09)', BR = 'rgba(220,38,38,.09)';
  const BA = 'rgba(217,119,6,.09)', BB = 'rgba(30,64,175,.07)';
  const _bxBase = 'border-radius:8px;padding:11px 14px';
  const _bx  = `border:1.5px solid var(--line2);${_bxBase};background:var(--paper)`;
  const _bxG = `border:1.5px solid ${CG};${_bxBase};background:${BG}`;
  const _bxR = `border:1.5px solid ${CR};${_bxBase};background:${BR}`;
  const _bxA = `border:1.5px solid ${CA};${_bxBase};background:${BA}`;

  const _lb  = t =>
    `<div style="font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">${t}</div>`;
  const _vl  = (v, color = 'var(--ink)') =>
    `<div style="font-size:17px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:${color};line-height:1.3">${v}</div>`;
  const _xct = tab =>
    `<button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 8px;flex-shrink:0;align-self:flex-end"
       onclick="_goTabWithCT('${tab}','${x(p.name)}')">Xem chi tiết</button>`;
  const _box = (bxStyle, label, valHtml, color = 'var(--ink)', btn = '') =>
    `<div style="${bxStyle}">
       ${_lb(label)}
       <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px">
         ${_vl(valHtml, color)}${btn}
       </div>
     </div>`;
  const _tag = t =>
    `<span style="border:1.5px solid var(--line2);border-radius:6px;padding:4px 10px;font-size:11px;white-space:nowrap">${t}</span>`;

  let html = `<style>
    @media(max-width:640px){
      .ctd-grid{grid-template-columns:1fr!important}
      .ctd-hdr{grid-template-columns:1fr!important}
      .ctd-note-blk{display:none!important}
      .ctd-note-inline{display:inline!important}
      .ctd-btns .btn{flex:1;justify-content:center}
    }
  </style>`;

  html += `
  <div class="ctd-hdr" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div style="${_bx};padding:10px 14px">
      <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:4px">${x(p.name)}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${_ptStatusBadge(p.status)}
        <span class="ctd-note-inline" style="display:none;font-size:11px;color:var(--ink3)">${p.note ? '· ' + x(p.note) : ''}</span>
      </div>
    </div>
    <div class="ctd-note-blk" style="${_bx};padding:10px 14px">
      ${_lb('Địa Chỉ / Ghi Chú')}
      <div style="font-size:12px;color:var(--ink2);line-height:1.5">${p.note ? x(p.note) : ''}</div>
    </div>
  </div>`;

  html += `
  <div class="ctd-grid" style="display:grid;grid-template-columns:${!isCompany && _isKetoan() ? '1fr' : '1fr 1fr'};gap:10px;margin-bottom:10px">
    ${_box(_bxR, 'Tổng Chi Công Trình', _chiPhiChungFixed > 0
        ? fmtS(tongChiCongTrinh) + `<span style="font-size:12px;color:var(--ink3);font-weight:400"> / ${fmtS(tongChiCongTrinh + _chiPhiChungFixed)}</span>`
        : fmtS(tongChiCongTrinh), CR)}
    ${!isCompany
      ? (_isKetoan() ? '' : _box(
          laiLo >= 0 ? _bxG : _bxR,
          'Lãi / Lỗ Hiện Tại',
          (tongThu || tongGiaTriHD) ? llPrefix + fmtS(laiLo) : '—',
          laiLo >= 0 ? CG : CR
        ))
      : `<div style="${_bx}">${_lb('Tổng Hóa Đơn')}${_vl(c.count + ' HĐ')}</div>`}
  </div>`;

  if (!isCompany) {
    html += `
  <div class="ctd-btns" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
    ${_sd ? _tag('Ngày bắt đầu: <strong>' + _fmtProjDate(_sd) + '</strong>') : ''}
    ${_durLabel ? _tag('⏱ <strong>' + _durLabel + '</strong>') : ''}
    <button class="btn btn-outline btn-sm" onclick="openCTEditModal('${p.id}')">✏️ Sửa</button>
    ${p.status !== 'completed' && !isClosed
      ? `<button class="btn btn-outline btn-sm" onclick="quickCompleteCT('${p.id}')">✅ Hoàn Thành</button>` : ''}
    ${!isClosed
      ? `<button class="btn btn-outline btn-sm" onclick="quickCloseCT('${p.id}')">📊 Quyết Toán</button>` : ''}
    <button class="btn btn-danger btn-sm" style="margin-left:auto"
      onclick="confirmDeleteCT('${p.id}')">🗑 Xóa</button>
  </div>`;
  }

  if (!isCompany && !_isKetoan()) {
    const thuLabel = 'Tổng Tiền Đã Thu' + (soDotThu ? ` (${soDotThu} Đợt)` : '');
    html += `
  <div class="ctd-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    ${_box(_bxA, 'Tổng Giá Trị Hợp Đồng Chính',
        tongGiaTriHD ? fmtS(tongGiaTriHD) : '—', CA, _xct('doanhthu'))}
    ${_box(_bxG, thuLabel,
        tongThu ? fmtS(tongThu) : '—', CG, _xct('doanhthu'))}
  </div>`;
  }

  if (!isCompany) {
    html += `
  <div class="ctd-grid" style="display:grid;grid-template-columns:${_isKetoan() ? '1fr' : '1fr 1fr'};gap:10px;margin-bottom:10px">
    ${_isKetoan() ? '' : _box(_bxA, 'Tổng Giá Trị Hợp Đồng Thầu Phụ',
        tongHDTP ? fmtS(tongHDTP) : '—', CA, _xct('doanhthu'))}
    ${_box(_bxA, 'Tổng Giá Trị Thầu Phụ Ứng',
        ungTpCost ? fmtS(ungTpCost) : '—', CA, _xct('ung'))}
  </div>`;
  }

  if (!isCompany) {
    const cpChungHtml = (chiPhiCongTy > 0)
      ? fmtS(chiPhiCongTy) + (_allocEntry ? `<span style="font-size:11px;color:var(--ink3);font-weight:400"> / ${fmtS(_chiPhiChungFixed)}</span>` : '')
      : '—';
    html += `
  <div class="ctd-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    ${_box(_bx,  'Chi Phí Chung / Chia Tỉ Trọng', cpChungHtml)}
    ${_box(_bxA, 'Tổng Giá Trị Nhà Cung Cấp Ứng',
        ungNccCost ? fmtS(ungNccCost) : '—', CA, _xct('ung'))}
  </div>`;
  }

  html += `
  <div style="${_bxR};margin-bottom:10px">
    ${_lb('Tổng Chi Phí Công Trình')}
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:10px">
      ${_vl(fmtS(c.total), CR)}
      ${_xct('hoadon')}
    </div>`;

  if (!c.invs.length) {
    html += `<div style="font-size:12px;color:var(--ink3);padding:2px 0">Không có hóa đơn nào trong ${x(yearLabel.toLowerCase())}</div>`;
  } else {
    loaiRows.forEach(([loai, invList]) => {
      const lt = invList.reduce((s,i) => s+(i.thanhtien||i.tien||0), 0);
      html += `
    <div style="display:flex;justify-content:space-between;align-items:baseline;
                padding:5px 0;border-top:1px solid rgba(220,38,38,.15);font-size:12px">
      <span style="color:var(--ink2)">${x(loai)}<span style="color:var(--ink3)"> (${invList.length} hóa đơn)</span></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${CR}">${fmtS(lt)}</span>
    </div>`;
    });
  }
  html += `</div>`;

  if (!isCompany && (p.endDate || p.closedDate)) {
    html += `
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
    ${p.endDate    ? _tag('📅 Ngày hoàn thành: <strong>' + _fmtProjDate(p.endDate)    + '</strong>') : ''}
    ${p.closedDate ? _tag('📊 Ngày quyết toán: <strong>' + _fmtProjDate(p.closedDate) + '</strong>') : ''}
  </div>`;
  }

  const bodyEl = document.getElementById('modal-body');
  if (bodyEl) bodyEl.innerHTML = html;
  const modalEl = document.getElementById('ct-modal');
  if (modalEl) modalEl.classList.add('open');
}

// ══════════════════════════════════════════════════════════════
//  MODAL TẠO MỚI
// ══════════════════════════════════════════════════════════════
function openCTCreateModal() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const _curY    = new Date().getFullYear();
  const activeYear = window.activeYear || 0;
  const _defSD   = (activeYear > 0 && activeYear < _curY) ? `${activeYear}-01-01` : todayStr;
  const inpStyle = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--line2);border-radius:8px;font-family:inherit;font-size:13px;outline:none';
  const lblStyle = 'font-size:11px;font-weight:700;color:var(--ink3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px';
  const titleEl  = document.getElementById('modal-title');
  const bodyEl   = document.getElementById('modal-body');
  if (titleEl) titleEl.textContent = '+ Thêm Công Trình Mới';
  if (bodyEl)  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="${lblStyle}">Tên Công Trình *</label>
        <input id="ct-new-name" type="text" placeholder="VD: CT Anh Bình - 123 Lê Lai..." autocomplete="off"
          style="${inpStyle};font-size:14px">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label style="${lblStyle}">Trạng Thái</label>
          <select id="ct-new-status" style="${inpStyle};background:var(--paper);color:var(--ink)"
            onchange="document.getElementById('ct-new-closeddate-wrap').style.display=this.value==='closed'?'':'none'">
            <option value="planning">Chuẩn bị thi công</option>
            <option value="active" selected>Đang thi công</option>
            <option value="completed">Hoàn thành (chưa QT)</option>
            <option value="closed">Đã quyết toán</option>
          </select>
        </div>
        <div>
          <label style="${lblStyle}">Ngày Bắt Đầu</label>
          <input id="ct-new-startdate" type="date" value="${_defSD}"
            style="${inpStyle};font-family:'IBM Plex Mono',monospace">
        </div>
      </div>
      <div>
        <label style="${lblStyle}">Ngày Kết Thúc <span style="font-weight:400;text-transform:none">(tùy chọn)</span></label>
        <input id="ct-new-enddate" type="date" style="${inpStyle};font-family:'IBM Plex Mono',monospace">
      </div>
      <div id="ct-new-closeddate-wrap" style="display:none">
        <label style="${lblStyle}">Ngày Quyết Toán</label>
        <input id="ct-new-closeddate" type="date" style="${inpStyle};font-family:'IBM Plex Mono',monospace">
      </div>
      <div>
        <label style="${lblStyle}">Ghi Chú</label>
        <input id="ct-new-note" type="text" placeholder="Địa chỉ, mô tả..." autocomplete="off" style="${inpStyle}">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-primary" style="flex:1" onclick="saveCTCreate()">💾 Lưu Công Trình</button>
        <button class="btn btn-outline" onclick="closeModal()">Hủy</button>
      </div>
    </div>`;
  const modalEl = document.getElementById('ct-modal');
  if (modalEl) modalEl.classList.add('open');
  setTimeout(() => document.getElementById('ct-new-name')?.focus(), 80);
}

function saveCTCreate() {
  const name       = (document.getElementById('ct-new-name')?.value || '').trim();
  const status     = document.getElementById('ct-new-status')?.value || 'active';
  const startDate  = document.getElementById('ct-new-startdate')?.value || '';
  const endDate    = document.getElementById('ct-new-enddate')?.value || '';
  const closedDate = document.getElementById('ct-new-closeddate')?.value || '';
  const note       = (document.getElementById('ct-new-note')?.value || '').trim();
  if (!name) {
    if (typeof window.toast === 'function') window.toast('Vui lòng nhập tên công trình!', 'error');
    document.getElementById('ct-new-name')?.focus();
    return;
  }
  try {
    if (typeof window.createProject === 'function')
      window.createProject({ name, status, startDate, endDate: endDate || null, closedDate: closedDate || null, note });
    if (typeof window.closeModal === 'function') window.closeModal();
    if (typeof window.toast === 'function') window.toast('✅ Đã thêm: ' + name, 'success');
    renderProjectsPage();
    if (typeof window.refreshHoadonCtDropdowns === 'function') window.refreshHoadonCtDropdowns();
    if (typeof window.rebuildUngSelects        === 'function') window.rebuildUngSelects();
    if (typeof window.populateCCCtSel          === 'function') window.populateCCCtSel();
  } catch(e) {
    if (typeof window.toast === 'function') window.toast('❌ ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  MODAL CHỈNH SỬA
// ══════════════════════════════════════════════════════════════
function openCTEditModal(id) {
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (!p || id === 'COMPANY') return;
  const _autoSd = typeof window.getProjectAutoStartDate === 'function' ? window.getProjectAutoStartDate(p.id) : null;
  const sd = p.startDateUserEdited
    ? (p.startDate || new Date().toISOString().slice(0, 10))
    : (_autoSd || p.startDate || (p.year ? `${p.year}-01-01` : new Date().toISOString().slice(0, 10)));
  const sdHint = !p.startDateUserEdited && _autoSd
    ? ' <span style="font-size:10px;color:var(--ink3);font-weight:400">(tự động từ chấm công)</span>' : '';
  const ed  = p.endDate    || '';
  const cld = p.closedDate || '';
  const inpStyle = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--line2);border-radius:8px;font-family:inherit;font-size:13px;outline:none';
  const lblStyle = 'font-size:11px;font-weight:700;color:var(--ink3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px';
  const titleEl  = document.getElementById('modal-title');
  const bodyEl   = document.getElementById('modal-body');
  if (titleEl) titleEl.textContent = '✏️ Sửa Công Trình';
  if (bodyEl)  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="${lblStyle}">Tên Công Trình *</label>
        <input id="ct-edit-name" type="text" value="${x(p.name)}" autocomplete="off"
          style="${inpStyle};font-size:14px">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label style="${lblStyle}">Trạng Thái</label>
          <select id="ct-edit-status" style="${inpStyle};background:var(--paper);color:var(--ink)"
            onchange="document.getElementById('ct-edit-closeddate-wrap').style.display=this.value==='closed'?'':'none'">
            ${Object.entries(_PROJECT_STATUS_LABELS).map(([v,l]) => `<option value="${v}"${p.status===v?' selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="${lblStyle}">Ngày Bắt Đầu${sdHint}</label>
          <input id="ct-edit-startdate" type="date" value="${sd}"
            style="${inpStyle};font-family:'IBM Plex Mono',monospace">
        </div>
      </div>
      <div>
        <label style="${lblStyle}">Ngày Kết Thúc <span style="font-weight:400;text-transform:none">(tùy chọn)</span></label>
        <input id="ct-edit-enddate" type="date" value="${ed}"
          style="${inpStyle};font-family:'IBM Plex Mono',monospace">
      </div>
      <div id="ct-edit-closeddate-wrap" style="${p.status==='closed'?'':'display:none'}">
        <label style="${lblStyle}">Ngày Quyết Toán</label>
        <input id="ct-edit-closeddate" type="date" value="${cld}"
          style="${inpStyle};font-family:'IBM Plex Mono',monospace">
      </div>
      <div>
        <label style="${lblStyle}">Ghi Chú</label>
        <input id="ct-edit-note" type="text" value="${x(p.note||'')}" autocomplete="off" style="${inpStyle}">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-primary" style="flex:1" onclick="saveCTEdit('${p.id}')">💾 Lưu Thay Đổi</button>
        <button class="btn btn-outline" onclick="openCTDetail('${p.id}')">Hủy</button>
      </div>
    </div>`;
  const modalEl = document.getElementById('ct-modal');
  if (modalEl) modalEl.classList.add('open');
}

function saveCTEdit(id) {
  const name       = (document.getElementById('ct-edit-name')?.value || '').trim();
  const status     = document.getElementById('ct-edit-status')?.value;
  const startDate  = document.getElementById('ct-edit-startdate')?.value || '';
  const endDate    = document.getElementById('ct-edit-enddate')?.value || '';
  const closedDate = document.getElementById('ct-edit-closeddate')?.value || '';
  const note       = (document.getElementById('ct-edit-note')?.value || '').trim();
  if (!name) {
    if (typeof window.toast === 'function') window.toast('Vui lòng nhập tên công trình!', 'error');
    document.getElementById('ct-edit-name')?.focus();
    return;
  }
  if (status === 'completed' && !endDate) {
    if (typeof window.toast === 'function') window.toast('❌ Vui lòng nhập Ngày Kết Thúc khi đánh dấu Đã Hoàn Thành!', 'error');
    document.getElementById('ct-edit-enddate')?.focus();
    return;
  }
  if (status === 'closed' && !closedDate) {
    if (typeof window.toast === 'function') window.toast('❌ Vui lòng nhập Ngày Quyết Toán!', 'error');
    document.getElementById('ct-edit-closeddate')?.focus();
    return;
  }
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  const _autoSd = typeof window.getProjectAutoStartDate === 'function' ? window.getProjectAutoStartDate(id) : null;
  const expectedSd = p?.startDateUserEdited ? p.startDate : (_autoSd || p?.startDate);
  const startDateUserEdited = startDate !== expectedSd ? true : (p?.startDateUserEdited || false);

  if (typeof window.updateProject === 'function')
    window.updateProject(id, { name, status, startDate, startDateUserEdited, endDate: endDate || null, closedDate: closedDate || null, note });
  if (typeof window.closeModal === 'function') window.closeModal();
  if (typeof window.toast === 'function') window.toast('✅ Đã cập nhật công trình', 'success');
  renderProjectsPage();
  if (typeof window.refreshHoadonCtDropdowns === 'function') window.refreshHoadonCtDropdowns();
  if (typeof window.rebuildUngSelects        === 'function') window.rebuildUngSelects();
  if (typeof window.populateCCCtSel          === 'function') window.populateCCCtSel();
}

// ── Quyết toán nhanh ─────────────────────────────────────────
function quickCloseCT(id) {
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (!p) return;
  const inpStyle  = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--line2);border-radius:8px;font-family:inherit;font-size:13px;outline:none';
  const lblStyle  = 'font-size:11px;font-weight:700;color:var(--ink3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px';
  const todayStr  = new Date().toISOString().slice(0, 10);
  const titleEl   = document.getElementById('modal-title');
  const bodyEl    = document.getElementById('modal-body');
  if (titleEl) titleEl.textContent = '🔒 Quyết Toán Công Trình';
  if (bodyEl)  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="color:var(--ink2);font-size:13px">Đánh dấu <strong>${x(p.name)}</strong> là <strong>Đã Quyết Toán</strong>?</div>
      <div>
        <label style="${lblStyle}">Ngày Quyết Toán</label>
        <input id="ct-close-date" type="date" value="${todayStr}" style="${inpStyle};font-family:'IBM Plex Mono',monospace">
      </div>
      <div style="font-size:12px;color:var(--ink3);background:var(--bg);border-radius:6px;padding:8px 10px">
        ⚠️ Sau khi quyết toán, không thể thêm mới dữ liệu vào công trình này.
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1" onclick="confirmQuickClose('${p.id}')">🔒 Xác Nhận</button>
        <button class="btn btn-outline" onclick="openCTDetail('${p.id}')">Hủy</button>
      </div>
    </div>`;
  const modalEl = document.getElementById('ct-modal');
  if (modalEl) modalEl.classList.add('open');
}

function confirmQuickClose(id) {
  const closedDate = document.getElementById('ct-close-date')?.value || new Date().toISOString().slice(0, 10);
  if (typeof window.updateProject === 'function') window.updateProject(id, { status: 'closed', closedDate });
  if (typeof window.closeModal === 'function') window.closeModal();
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (typeof window.toast === 'function') window.toast('🔒 Đã quyết toán: ' + (p?.name || ''), 'success');
  renderProjectsPage();
}

// ── Hoàn thành ────────────────────────────────────────────────
function quickCompleteCT(id) {
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (!p) return;
  const inpStyle = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid var(--line2);border-radius:8px;font-family:inherit;font-size:13px;outline:none';
  const lblStyle = 'font-size:11px;font-weight:700;color:var(--ink3);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px';
  const todayStr = new Date().toISOString().slice(0, 10);
  const titleEl  = document.getElementById('modal-title');
  const bodyEl   = document.getElementById('modal-body');
  if (titleEl) titleEl.textContent = '✅ Hoàn Thành Công Trình';
  if (bodyEl)  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="color:var(--ink2);font-size:13px">Đánh dấu <strong>${x(p.name)}</strong> là <strong>Đã Hoàn Thành</strong>?</div>
      <div>
        <label style="${lblStyle}">Ngày Hoàn Thành</label>
        <input id="ct-complete-date" type="date" value="${todayStr}" style="${inpStyle};font-family:'IBM Plex Mono',monospace">
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1" onclick="confirmQuickComplete('${p.id}')">✅ Xác Nhận</button>
        <button class="btn btn-outline" onclick="openCTDetail('${p.id}')">Hủy</button>
      </div>
    </div>`;
  const modalEl = document.getElementById('ct-modal');
  if (modalEl) modalEl.classList.add('open');
}

function confirmQuickComplete(id) {
  const completedDate = document.getElementById('ct-complete-date')?.value || new Date().toISOString().slice(0, 10);
  if (typeof window.updateProject === 'function')
    window.updateProject(id, { status: 'completed', endDate: completedDate, completedDate });
  if (typeof window.closeModal === 'function') window.closeModal();
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (typeof window.toast === 'function') window.toast('✅ Đã hoàn thành: ' + (p?.name || ''), 'success');
  renderProjectsPage();
}

// ── Xóa công trình ────────────────────────────────────────────
function confirmDeleteCT(id) {
  const p = typeof window.getProjectById === 'function' ? window.getProjectById(id) : null;
  if (!p) return;
  if (typeof window.canDeleteProject === 'function' && !window.canDeleteProject(id)) {
    if (typeof window.toast === 'function') window.toast('❌ Công trình còn dữ liệu. Vui lòng xóa dữ liệu trước!', 'error');
    return;
  }
  if (!confirm(`Xóa công trình "${p.name}"?`)) return;
  const projs = window.projects;
  if (!Array.isArray(projs)) return;
  const idx = projs.findIndex(pr => pr.id === id);
  if (idx < 0) return;
  projs[idx] = { ...projs[idx], deletedAt: Date.now(), updatedAt: Date.now() };
  if (typeof window.save === 'function') window.save('projects_v1', projs);
  if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
  if (typeof window.closeModal === 'function') window.closeModal();
  if (typeof window.toast === 'function') window.toast('🗑 Đã xóa: ' + p.name);
  renderProjectsPage();
}

// ══════════════════════════════════════════════════════════════
//  EXPORTED HELPERS (backward compat)
// ══════════════════════════════════════════════════════════════
export function buildProjOpts(selectedName, placeholder, opts) {
  if (typeof window._buildProjOpts === 'function')
    return window._buildProjOpts(selectedName, placeholder, opts);
  return `<option value="">${placeholder || '-- Chọn công trình --'}</option>`;
}

export function buildProjFilterOpts(currentVal, opts) {
  if (typeof window._buildProjFilterOpts === 'function')
    return window._buildProjFilterOpts(currentVal, opts);
  return '<option value="">-- Tất cả công trình --</option>';
}

export function readPidFromSel(sel) {
  return sel?.selectedOptions?.[0]?.dataset?.pid || null;
}

export function checkProjectClosed(pid, ctName, projects) {
  if (!pid || pid === 'COMPANY') return false;
  const proj = (projects || window.projects || []).find(p => p.id === pid && !p.deletedAt);
  if (proj && proj.status === 'closed') {
    if (typeof window.toast === 'function')
      window.toast(`🔒 Công trình "${ctName}" đã quyết toán — không thể thêm dữ liệu mới!`, 'error');
    return true;
  }
  return false;
}

export function statusBadge(status) { return _ptStatusBadge(status); }
export function statBox(label, value, color, bg) { return _ptStatBox(label, value, color, bg); }

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
export function initProjectUI() {
  window.renderProjectsPage   = renderProjectsPage;
  window.renderCTOverview     = renderCTOverview;
  window._ctApply             = _ctApply;
  window._ctRenderGrid        = _ctRenderGrid;
  window.openCTDetail         = openCTDetail;
  window.openCTCreateModal    = openCTCreateModal;
  window.saveCTCreate         = saveCTCreate;
  window.openCTEditModal      = openCTEditModal;
  window.saveCTEdit           = saveCTEdit;
  window.quickCloseCT         = quickCloseCT;
  window.confirmQuickClose    = confirmQuickClose;
  window.quickCompleteCT      = quickCompleteCT;
  window.confirmQuickComplete = confirmQuickComplete;
  window.confirmDeleteCT      = confirmDeleteCT;
  window._goTabWithCT         = _goTabWithCT;
  window._fmtProjDate         = _fmtProjDate;
  window._ptStatusBadge       = _ptStatusBadge;
  window._ptStatBox           = _ptStatBox;
  console.log('[project.ui] ✅ Module ready — 15 window bridges active');
}

// ── Bridge tạm ───────────────────────────────────────────────
window._projectUI = {
  initProjectUI, buildProjOpts, buildProjFilterOpts,
  readPidFromSel, checkProjectClosed, statusBadge, statBox,
};
