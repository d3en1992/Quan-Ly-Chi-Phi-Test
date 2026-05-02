// ══════════════════════════════════════════════════════════════
// src/modules/dashboard/dashboard.module.js — Dashboard Charts
// Prompt 9  — ES Modules Refactor (HTML builders)
// Prompt 17 — Full port renderDashboard + orchestration layer
// ══════════════════════════════════════════════════════════════

import { escapeHtml } from '../../utils/string.util.js';
import { fmtM, fmtS } from '../../utils/math.util.js';

const PIE_COLORS  = ['#f0b429','#1db954','#4a90d9','#e74c3c','#9b59b6','#e67e22','#aaa'];
const KEY_TYPES   = ['Nhân Công','Vật Liệu XD','Thầu Phụ','Sắt Thép','Đổ Bê Tông'];
const TB_KHO_TONG = 'KHO TỔNG';

// ── Dashboard CT filter state ────────────────────────────────
let selectedCT = '';

// ── Build label năm filter ───────────────────────────────────
export function buildYearLabel(activeYears) {
  const ay = activeYears instanceof Set ? activeYears : new Set();
  if (ay.size === 0) return 'Tất cả năm';
  if (ay.size === 1) return `Năm ${[...ay][0]}`;
  return 'Năm ' + [...ay].sort((a, b) => a - b).join(', ');
}

// ── KPI Cards HTML ───────────────────────────────────────────
export function buildKpiHtml(data, yr) {
  const total    = data.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  const months   = new Set(data.map(i => i.ngay?.slice(0, 7))).size;
  const avgMonth = months ? Math.round(total / months) : 0;
  const maxInv   = data.reduce(
    (mx, i) => (i.thanhtien || i.tien || 0) > (mx.thanhtien || mx.tien || 0) ? i : mx,
    data[0]
  );
  const ctSet = new Set(data.map(i =>
    (typeof window.resolveProjectName === 'function'
      ? window.resolveProjectName(i)
      : i.congtrinh || i.ct)
  ).filter(Boolean));

  return [
    { label: 'Tổng Chi Phí ' + yr, val: fmtM(total),      sub: data.length + ' hóa đơn',           cls: 'accent-gold'  },
    { label: 'TB / Tháng',          val: fmtM(avgMonth),   sub: months + ' tháng có phát sinh',      cls: 'accent-blue'  },
    { label: 'HĐ Lớn Nhất',         val: fmtM(maxInv.thanhtien || maxInv.tien || 0),
                                     sub: (maxInv.nd || maxInv.loai || '').slice(0, 30),               cls: 'accent-red'   },
    { label: 'Công Trình',          val: ctSet.size,        sub: 'đang theo dõi năm ' + yr,           cls: 'accent-green' },
  ].map(k => `<div class="db-kpi-card ${k.cls}">
    <div class="db-kpi-label">${k.label}</div>
    <div class="db-kpi-val">${k.val}</div>
    <div class="db-kpi-sub">${k.sub}</div>
  </div>`).join('');
}

// ── Bar Chart SVG ────────────────────────────────────────────
export function buildBarChartHtml(data, activeYears) {
  const byMonth = {};
  data.forEach(i => {
    const m = i.ngay?.slice(0, 7);
    if (!m) return;
    byMonth[m] = (byMonth[m] || 0) + (i.thanhtien || i.tien || 0);
  });

  const ay       = activeYears instanceof Set ? activeYears : new Set();
  const singleYr = ay.size === 1 ? [...ay][0] : 0;
  const yr       = singleYr || new Date().getFullYear();
  const months12 = Array.from({ length: 12 }, (_, k) =>
    `${yr}-${String(k + 1).padStart(2, '0')}`
  );

  let vals;
  if (ay.size !== 1) {
    const byNum = {};
    Object.entries(byMonth).forEach(([m, v]) => {
      const num = m.slice(5);
      byNum[num] = (byNum[num] || 0) + v;
    });
    vals = months12.map((_, i) => byNum[String(i + 1).padStart(2, '0')] || 0);
  } else {
    vals = months12.map(m => byMonth[m] || 0);
  }

  const maxVal = Math.max(...vals, 1);
  const H = 160, colW = 40, gap = 5;
  const svgW = 12 * (colW + gap);

  const bars = months12.map((m, i) => {
    const v  = vals[i];
    const h  = Math.round((v / maxVal) * H);
    const cx = i * (colW + gap);
    const y  = H - h;
    const amt = v >= 1e9 ? (v / 1e9).toFixed(1) + 'tỷ'
              : v >= 1e6 ? Math.round(v / 1e6) + 'tr'
              : v ? fmtS(v) : '';
    return `<g>
      <rect x="${cx}" y="${y}" width="${colW}" height="${Math.max(h, 2)}"
            rx="3" fill="${v ? 'var(--gold)' : 'var(--line)'}" opacity="${v ? '.85' : '.35'}">
        <title>T${i + 1}: ${fmtM(v)}</title>
      </rect>
      <text x="${cx + colW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="var(--ink2)">${h > 14 ? amt : ''}</text>
      <text x="${cx + colW / 2}" y="${H + 14}" text-anchor="middle" font-size="9" fill="var(--ink3)">T${i + 1}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 -10 ${svgW} ${H + 28}" width="100%" class="db-pie-svg"
               style="min-width:${Math.min(svgW, 300)}px;max-width:100%">
    ${bars}
    <line x1="0" y1="${H}" x2="${svgW}" y2="${H}" stroke="var(--line)" stroke-width="1"/>
  </svg>`;
}

// ── Pie Chart SVG ────────────────────────────────────────────
export function buildPieChartHtml(data) {
  const byType = {};
  data.forEach(i => {
    const k = KEY_TYPES.includes(i.loai) ? i.loai : 'Khác';
    byType[k] = (byType[k] || 0) + (i.thanhtien || i.tien || 0);
  });

  const total   = Object.values(byType).reduce((s, v) => s + v, 0);
  const entries = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val], i) => ({ name, val, pct: val / total, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const R = 70, CX = 80, CY = 80;
  let startAngle = -Math.PI / 2;
  const slices = entries.map(e => {
    const angle = e.pct * Math.PI * 2;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    startAngle += angle;
    const x2    = CX + R * Math.cos(startAngle);
    const y2    = CY + R * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    return `<path d="M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)}
              A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z"
              fill="${e.color}" stroke="#fff" stroke-width="2">
              <title>${e.name}: ${Math.round(e.pct * 100)}%</title>
            </path>`;
  }).join('');

  const legend = entries.map(e =>
    `<div class="db-legend-row">
       <div class="db-legend-dot" style="background:${e.color}"></div>
       <span style="flex:1;color:var(--ink2)">${e.name}</span>
       <span class="db-legend-pct" style="color:${e.color}">${Math.round(e.pct * 100)}%</span>
     </div>`
  ).join('');

  return `<svg viewBox="0 0 160 160" width="140" height="140" class="db-pie-svg">${slices}</svg>
           <div class="db-legend">${legend}</div>`;
}

// ── Top 5 hóa đơn lớn nhất ──────────────────────────────────
export function buildTop5Html(data, resolveName) {
  const top5 = [...data]
    .sort((a, b) => (b.thanhtien || b.tien || 0) - (a.thanhtien || a.tien || 0))
    .slice(0, 5);
  const max = top5[0] ? (top5[0].thanhtien || top5[0].tien || 0) : 1;

  return top5.map((inv, i) => {
    const amt = inv.thanhtien || inv.tien || 0;
    const pct = Math.round(amt / max * 100);
    return `<div class="db-rank-row">
      <div class="db-rank-num ${i === 0 ? 'top1' : ''}">${i === 0 ? '🥇' : i + 1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(inv.nd || inv.loai || '—')}
        </div>
        <div style="font-size:10px;color:var(--ink3)">${inv.ngay} · ${escapeHtml(resolveName(inv) || '—')}</div>
        <div class="db-rank-bar-bg" style="margin-top:4px">
          <div class="db-rank-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="db-rank-amt">${fmtM(amt)}</div>
    </div>`;
  }).join('');
}

// ── Chi phí theo Công Trình ──────────────────────────────────
export function buildByCTHtml(data, resolveName) {
  const byCT = {};
  data.forEach(i => {
    const k = resolveName(i) || '(Không rõ)';
    byCT[k] = (byCT[k] || 0) + (i.thanhtien || i.tien || 0);
  });
  const sorted = Object.entries(byCT).sort((a, b) => b[1] - a[1]);
  const max    = sorted[0]?.[1] || 1;

  return sorted.map(([ct, amt], i) => {
    const pct = Math.round(amt / max * 100);
    return `<div class="db-rank-row">
      <div class="db-rank-num ${i === 0 ? 'top1' : ''}">${i + 1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
             title="${escapeHtml(ct)}">${escapeHtml(ct)}</div>
        <div class="db-rank-bar-bg" style="margin-top:4px">
          <div class="db-rank-bar-fill" style="width:${pct}%;background:${i === 0 ? 'var(--green)' : 'var(--gold)'}"></div>
        </div>
      </div>
      <div class="db-rank-amt">${fmtM(amt)}</div>
    </div>`;
  }).join('');
}

// ── Tiền Ứng theo CT (aggregate view) ────────────────────────
export function buildUngByCTHtml(ungRecords, selectedCTVal, resolveName) {
  const inAY = window.inActiveYear;
  const filtered = ungRecords.filter(r =>
    !r.deletedAt &&
    (inAY ? inAY(r.ngay) : true) &&
    (!selectedCTVal || resolveName(r) === selectedCTVal)
  );

  if (!filtered.length) return '<div class="db-empty">Chưa có tiền ứng</div>';

  if (!selectedCTVal) {
    const byCT = {};
    filtered.forEach(r => {
      const k = resolveName(r) || '(Không rõ)';
      byCT[k] = (byCT[k] || 0) + (r.tien || 0);
    });
    const sorted = Object.entries(byCT).sort((a, b) => b[1] - a[1]);
    const max    = sorted[0][1] || 1;
    return sorted.map(([ct, amt], i) => {
      const pct = Math.round(amt / max * 100);
      return `<div class="db-rank-row">
        <div class="db-rank-num ${i === 0 ? 'top1' : ''}">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
               title="${escapeHtml(ct)}">${escapeHtml(ct)}</div>
          <div class="db-rank-bar-bg" style="margin-top:4px">
            <div class="db-rank-bar-fill" style="width:${pct}%;background:#4a90d9"></div>
          </div>
        </div>
        <div class="db-rank-amt">${fmtM(amt)}</div>
      </div>`;
    }).join('');
  }

  const rows = [...filtered]
    .sort((a, b) => b.ngay.localeCompare(a.ngay))
    .map(r => `<tr style="border-bottom:1px solid var(--line)">
      <td style="padding:7px 8px;white-space:nowrap;color:var(--ink3);font-size:12px">${r.ngay}</td>
      <td style="padding:7px 8px;font-weight:600">${escapeHtml(r.tp || '—')}</td>
      <td style="padding:7px 8px;color:var(--ink2);font-size:12px">${escapeHtml(r.nd || '—')}</td>
      <td style="padding:7px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:#4a90d9;white-space:nowrap">${fmtM(r.tien || 0)}</td>
    </tr>`).join('');
  const total = filtered.reduce((s, r) => s + (r.tien || 0), 0);

  return `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="font-size:11px;color:var(--ink3);border-bottom:2px solid var(--line)">
          <th style="text-align:left;padding:6px 8px;font-weight:600">Ngày</th>
          <th style="text-align:left;padding:6px 8px;font-weight:600">Thầu Phụ / NCC</th>
          <th style="text-align:left;padding:6px 8px;font-weight:600">Nội Dung</th>
          <th style="text-align:right;padding:6px 8px;font-weight:600">Số Tiền</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="font-weight:700;border-top:2px solid var(--line)">
          <td colspan="3" style="padding:7px 8px;color:var(--ink3)">Tổng cộng (${filtered.length} lần)</td>
          <td style="padding:7px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;color:#4a90d9">${fmtM(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

// ── Thiết Bị theo CT ─────────────────────────────────────────
export function buildTBByCTHtml(tbData, selectedCTVal, resolveName) {
  const allTB = tbData.filter(t => !t.deletedAt && t.ct !== TB_KHO_TONG);
  const khoTB = tbData.filter(t => !t.deletedAt && t.ct === TB_KHO_TONG);

  if (!allTB.length && !khoTB.length) return '<div class="db-empty">Chưa có thiết bị</div>';

  if (!selectedCTVal) {
    const khoTotal = khoTB.reduce((s, t) => s + (t.soluong || 0), 0);
    const khoHd    = khoTB.filter(t => t.tinhtrang === 'Đang hoạt động').reduce((s, t) => s + (t.soluong || 0), 0);
    const khoLau   = khoTB.filter(t => t.tinhtrang === 'Cần bảo trì').reduce((s, t) => s + (t.soluong || 0), 0);
    const khoSC    = khoTB.filter(t => t.tinhtrang === 'Cần sửa chữa').reduce((s, t) => s + (t.soluong || 0), 0);

    const khoRow = khoTotal > 0
      ? `<div style="padding:10px 0;border-bottom:2px solid var(--gold);margin-bottom:4px">
           <div style="font-weight:800;color:var(--gold);margin-bottom:6px;font-size:13px">🏪 KHO TỔNG</div>
           <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
             <span style="color:var(--ink3)">Tổng: <b style="color:var(--ink);font-size:14px">${khoTotal}</b></span>
             <span style="color:var(--green)">Đang hoạt động: <b>${khoHd}</b></span>
             <span style="color:var(--gold)">Cần bảo trì: <b>${khoLau}</b></span>
             <span style="color:var(--red)">Cần sửa chữa: <b>${khoSC}</b></span>
           </div>
         </div>`
      : '';

    const byCT = {};
    allTB.forEach(t => {
      const ct = resolveName(t) || '(Không rõ)';
      if (!byCT[ct]) byCT[ct] = { total: 0, dangHD: 0, hdLau: 0, canSC: 0 };
      const sl = t.soluong || 0;
      byCT[ct].total  += sl;
      if (t.tinhtrang === 'Đang hoạt động') byCT[ct].dangHD += sl;
      else if (t.tinhtrang === 'Cần bảo trì') byCT[ct].hdLau += sl;
      else if (t.tinhtrang === 'Cần sửa chữa') byCT[ct].canSC += sl;
    });

    const ctRows = Object.entries(byCT)
      .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
      .map(([ct, s]) => `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="font-weight:700;color:var(--ink);margin-bottom:6px">${escapeHtml(ct)}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
          <span style="color:var(--ink3)">Tổng: <b style="color:var(--ink)">${s.total}</b></span>
          <span style="color:var(--green)">Đang hoạt động: <b>${s.dangHD}</b></span>
          <span style="color:var(--gold)">Cần bảo trì: <b>${s.hdLau}</b></span>
          <span style="color:var(--red)">Cần sửa chữa: <b>${s.canSC}</b></span>
        </div>
      </div>`).join('');

    return khoRow + (ctRows || '<div class="db-empty">Chưa có thiết bị tại công trình</div>');
  }

  const filtered = allTB
    .filter(t => t.ct === selectedCTVal)
    .sort((a, b) => (a.ten || '').localeCompare(b.ten, 'vi'));

  if (!filtered.length)
    return '<div class="db-empty">Chưa có thiết bị cho ' + escapeHtml(selectedCTVal) + '</div>';

  const rows = filtered.map(t => {
    const ttColor = t.tinhtrang === 'Đang hoạt động' ? 'var(--green)'
                  : t.tinhtrang === 'Cần bảo trì'    ? 'var(--gold)'
                  : t.tinhtrang === 'Cần sửa chữa'   ? 'var(--red)'
                  : 'var(--ink3)';
    return `<tr style="border-bottom:1px solid var(--line)">
      <td style="padding:7px 8px;font-weight:600">${escapeHtml(t.ten)}</td>
      <td style="padding:7px 8px;text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${t.soluong || 0}</td>
      <td style="padding:7px 8px;color:${ttColor}">${escapeHtml(t.tinhtrang || '—')}</td>
      <td style="padding:7px 8px;color:var(--ink3);font-size:12px">${escapeHtml(t.ct || '—')}</td>
    </tr>`;
  }).join('');

  return `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="font-size:11px;color:var(--ink3);border-bottom:2px solid var(--line)">
          <th style="text-align:left;padding:6px 8px;font-weight:600">Tên Thiết Bị</th>
          <th style="text-align:center;padding:6px 8px;font-weight:600">SL</th>
          <th style="text-align:left;padding:6px 8px;font-weight:600">Tình Trạng</th>
          <th style="text-align:left;padding:6px 8px;font-weight:600">Công Trình</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── Empty state helper ───────────────────────────────────────
export function buildEmptyState(yrLabel) {
  return '<div class="db-empty">Chưa có dữ liệu cho ' + yrLabel + '</div>';
}

// ══════════════════════════════════════════════════════════════
//  ORCHESTRATION LAYER — Prompt 17
//  Các hàm này ghi trực tiếp vào DOM (giống datatools.js gốc)
// ══════════════════════════════════════════════════════════════

function _resolveName(r) {
  if (typeof window.resolveProjectName === 'function') return window.resolveProjectName(r);
  return r.congtrinh || r.ct || '';
}

// ── Populate CT filter dropdown ──────────────────────────────
function _dbPopulateCTFilter() {
  const sel = document.getElementById('db-filter-ct');
  if (!sel) return;
  if (typeof window._buildProjFilterOpts === 'function') {
    sel.innerHTML = window._buildProjFilterOpts(selectedCT, { includeCompany: false, placeholder: '-- Tất cả công trình --' });
  }
}

// ── KPI Cards → #db-kpi-row ──────────────────────────────────
function _dbKPI(data, yr) {
  const el = document.getElementById('db-kpi-row');
  if (!el) return;
  el.innerHTML = buildKpiHtml(data, yr);
}

// ── Bar Chart → #db-bar-chart ────────────────────────────────
function _dbBarChart(data) {
  const el = document.getElementById('db-bar-chart');
  if (!el) return;
  const ay = (typeof window.activeYears !== 'undefined') ? window.activeYears : new Set();
  el.innerHTML = buildBarChartHtml(data, ay);
}

// ── Pie Chart → #db-pie-chart ────────────────────────────────
function _dbPieChart(data) {
  const el = document.getElementById('db-pie-chart');
  if (!el) return;
  el.innerHTML = buildPieChartHtml(data);
}

// ── Top 5 → #db-top5 ────────────────────────────────────────
function _dbTop5(data) {
  const el = document.getElementById('db-top5');
  if (!el) return;
  el.innerHTML = buildTop5Html(data, _resolveName);
}

// ── Chi phí theo CT → #db-by-ct ─────────────────────────────
function _dbByCT(data) {
  const el = document.getElementById('db-by-ct');
  if (!el) return;
  el.innerHTML = buildByCTHtml(data, _resolveName);
}

// ── Tiền ứng theo CT → #db-ung-ct ───────────────────────────
function _dbUngByCT() {
  const wrap = document.getElementById('db-ung-ct');
  if (!wrap) return;
  const ungRecords = window.ungRecords || [];
  wrap.innerHTML = buildUngByCTHtml(ungRecords, selectedCT, _resolveName);
}

// ── Thiết bị theo CT → #db-tb-ct ────────────────────────────
function _dbTBByCT() {
  const wrap = document.getElementById('db-tb-ct');
  if (!wrap) return;
  const tbData = window.tbData || [];
  // buildTBByCTHtml sử dụng t.ct trực tiếp (không qua resolveProjectName)
  // vì tbData dùng trường 'ct' thay vì 'congtrinh'
  wrap.innerHTML = buildTBByCTHtml(tbData, selectedCT, r => r.ct || '');
}

// ── renderDashboard (orchestrator) ──────────────────────────
function renderDashboard() {
  const ay = (typeof window.activeYears !== 'undefined') ? window.activeYears : new Set();
  const yr = ay.size === 0 ? 0 : (ay.size === 1 ? [...ay][0] : 0);
  const yrLabel = ay.size === 0    ? 'Tất cả năm'
                : ay.size === 1    ? `Năm ${[...ay][0]}`
                : 'Năm ' + [...ay].sort((a,b)=>a-b).join(', ');

  _dbPopulateCTFilter();

  const getInvoicesCached = window.getInvoicesCached;
  const inActiveYear      = window.inActiveYear;
  if (!getInvoicesCached) return;

  const dataYear   = getInvoicesCached().filter(i => inActiveYear ? inActiveYear(i.ngay) : true);
  const dataDetail = getInvoicesCached().filter(i =>
    (inActiveYear ? inActiveYear(i.ngay) : true) &&
    (!selectedCT || _resolveName(i) === selectedCT)
  );

  if (!dataYear.length) {
    ['db-kpi-row','db-bar-chart','db-pie-chart','db-top5','db-by-ct','db-ung-ct','db-tb-ct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = buildEmptyState(yrLabel);
    });
    return;
  }

  _dbKPI(dataYear, yr || yrLabel);
  _dbBarChart(dataYear);
  _dbPieChart(dataYear);
  _dbTop5(dataDetail);
  _dbByCT(dataDetail);
  _dbUngByCT();
  _dbTBByCT();

  if (typeof window.renderCtPage === 'function') window.renderCtPage();
}

// ── CT filter change handler (gọi từ HTML onchange) ─────────
function _dbOnCTChange(val) {
  selectedCT = val || '';
  renderDashboard();
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
export function initDashboard() {
  window.renderDashboard      = renderDashboard;
  window._dbPopulateCTFilter  = _dbPopulateCTFilter;
  window._dbKPI               = _dbKPI;
  window._dbBarChart          = _dbBarChart;
  window._dbPieChart          = _dbPieChart;
  window._dbTop5              = _dbTop5;
  window._dbByCT              = _dbByCT;
  window._dbUngByCT           = _dbUngByCT;
  window._dbTBByCT            = _dbTBByCT;
  window._dbOnCTChange        = _dbOnCTChange;
  // Getter/setter cho selectedCT (inline HTML cần đọc/ghi)
  Object.defineProperty(window, 'selectedCT', {
    get: () => selectedCT,
    set: (v) => { selectedCT = v || ''; },
    configurable: true,
  });
  console.log('[dashboard.module] ✅ Orchestration layer ready — 9 bridges active');
}

// ── Bridge tạm ──────────────────────────────────────────────
window._dashboardModule = {
  buildYearLabel, buildKpiHtml, buildBarChartHtml, buildPieChartHtml,
  buildTop5Html, buildByCTHtml, buildUngByCTHtml, buildTBByCTHtml,
  buildEmptyState, initDashboard, renderDashboard,
};

console.log('[dashboard.module] ES Module loaded ✅');
