// ══════════════════════════════════════════════════════════════
// src/modules/revenue/revenue.ui.js — Revenue UI (Full Port)
// Prompt 15B — Ported from doanhthu.js (1660 lines)
// Bao gồm: HĐ Chính, HĐ Thầu Phụ, Thu Tiền, Công Nợ,
//          Lãi/Lỗ, KLCT, Sub-tab nav, Export image
// ══════════════════════════════════════════════════════════════

import { escapeHtml } from '../../utils/string.util.js';
import { today } from '../../utils/date.util.js';
import {
  calcHopDongValue,
  readMoneyInput,
  paginationHtml,
  fmtInputMoney,
  matchProjFilter,
  matchHDCFilter,
  resolveCtNameFromRecord,
  resolveCtNameFromKey,
  normalizeThuProjectIds,
  migrateHopDongSL,
  calcCongNoNCC,
  calcLaiLo,
} from './revenue.logic.js';

const DT_PG = 7;

// ══════════════════════════════════════════════════════════════
// MODULE STATE
// QUAN TRỌNG: dùng window.* để pasteKLCT và bindItemsToTable
// có thể sync (giống pattern ccHistPage trong payroll.ui.js)
// ══════════════════════════════════════════════════════════════
window._hdcItems  = window._hdcItems  || [];
window._hdtpItems = window._hdtpItems || [];

let _hdcPage    = 0;
let _hdtpPage   = 0;
let _thuPage    = 0;
let _dtCtFilter = '';

// ══════════════════════════════════════════════════════════════
// LOCAL HELPERS
// ══════════════════════════════════════════════════════════════

// Alias để giữ tên quen thuộc trong nội bộ file
const _readMoneyInput = (id) => readMoneyInput(id);

function _dtInYear(ngay) {
  if (!window.activeYears || window.activeYears.size === 0) return true;
  if (!ngay) return true; // record cũ không có ngày → hiển thị mọi năm
  return typeof window.inActiveYear === 'function' ? window.inActiveYear(ngay) : true;
}

// Hàm giải quyết tên CT dùng chung (nhận cả keyId string lẫn record object)
function _resolveCtName(recordOrKey) {
  const allProj = window.projects || [];
  if (recordOrKey && typeof recordOrKey === 'object') {
    return resolveCtNameFromRecord(recordOrKey, allProj);
  }
  return resolveCtNameFromKey(String(recordOrKey), allProj);
}

function _dtMatchProjFilter(record) {
  if (!_dtCtFilter) return true;
  return matchProjFilter(record, _dtCtFilter, window.projects || []);
}

function _dtMatchHDCFilter(keyId, hd) {
  return matchHDCFilter(keyId, hd, _dtCtFilter, window.projects || []);
}

function _dtAddCT(_name) { /* no-op: CT chỉ tạo từ tab Công Trình */ }
function _dtAddTP(_name) { /* no-op */ }

function _getAllProjects() {
  return typeof window.getAllProjects === 'function'
    ? window.getAllProjects()
    : (window.projects || []);
}

// ══════════════════════════════════════════════════════════════
// EXPORTS HIỆN CÓ (giữ từ Prompt 8)
// ══════════════════════════════════════════════════════════════

export function buildDtCtFilterOpts(currentVal, allProjects, opts = {}) {
  const { includeCompany = false, placeholder = '-- Tất cả công trình --' } = opts;
  const projs = allProjects.filter(p => includeCompany || p.id !== 'COMPANY');
  return `<option value="">${placeholder}</option>` +
    projs.map(p =>
      `<option value="${escapeHtml(p.name)}" ${p.name === currentVal ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
    ).join('');
}

export function buildDtCtEntryOpts(allProjects, activeYear, ctInActiveYear) {
  const projForYear = allProjects.filter(p =>
    p.id !== 'COMPANY' && (activeYear === 0 || ctInActiveYear(p.name))
  );
  return '<option value="">-- Chọn công trình --</option>' +
    projForYear.map(p =>
      `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`
    ).join('');
}

export function renderCongNoTableHtml(rows) {
  if (!rows || rows.length === 0) return { html: '', hasData: false };

  let totUng = 0, totHD = 0, totConlai = 0;

  const dataRows = rows.map(row => {
    const conlai      = (row.tongHD || 0) - (row.tongUng || 0);
    totUng    += row.tongUng || 0;
    totHD     += row.tongHD || 0;
    totConlai += conlai;
    const overdrawn   = (row.tongUng || 0) > (row.tongHD || 0) && (row.tongHD || 0) > 0;
    const conlaiStyle = overdrawn ? 'color:var(--red);font-weight:700' : (conlai === 0 ? 'color:var(--ink3)' : '');
    const countLabel  = row.count > 0
      ? `<span style="color:var(--ink3);font-size:11px;margin-left:3px">(${row.count})</span>`
      : '';
    return `<tr>
      <td style="font-weight:600;white-space:nowrap">${escapeHtml(row.name)}</td>
      <td style="white-space:nowrap">${escapeHtml(row.congtrinh || '—')}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">
        ${row.tongUng ? window.fmtS(row.tongUng) : '<span style="color:var(--ink3)">—</span>'}${countLabel}
      </td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">
        ${row.tongHD ? window.fmtS(row.tongHD) : '<span style="color:var(--ink3)">—</span>'}
      </td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;${conlaiStyle}">
        ${window.fmtS(conlai)}
      </td>
    </tr>`;
  }).join('');

  const footerConlaiStyle = totUng > totHD && totHD > 0 ? 'color:var(--red)' : '';
  const footerRow = `<tr style="border-top:2px solid var(--line);font-weight:700;background:var(--panel)">
    <td colspan="2" style="padding:8px 12px;color:var(--ink2)">Tổng cộng</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding:8px 10px">${window.fmtS(totUng)}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding:8px 10px">${window.fmtS(totHD)}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding:8px 10px;${footerConlaiStyle}">${window.fmtS(totConlai)}</td>
  </tr>`;

  return { html: dataRows + footerRow, hasData: true };
}

export function copyKLCT(btn) {
  try {
    const container = btn.closest('.section, .card, .block') || btn.parentElement;
    const tbody = container.querySelector('tbody');
    if (!tbody) { window.toast('Không tìm thấy bảng dữ liệu', 'error'); return; }

    const rows = tbody.querySelectorAll('tr');
    const data = [];
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length < 4) return;
      const row = {
        ten:       inputs[0]?.value || '',
        donvi:     inputs[1]?.value || '',
        khoiluong: inputs[2]?.value || '',
        dongia:    (inputs[3]?.dataset?.raw || inputs[3]?.value || '').toString().replace(/[^0-9]/g, '')
      };
      if (row.ten || row.khoiluong || row.dongia) data.push(row);
    });

    if (!data.length) { window.toast('Không có dữ liệu để copy', 'error'); return; }

    localStorage.setItem('klct_clipboard', JSON.stringify(data));
    const oldBg = btn.style.background;
    btn.style.background = '#e8f0fb';
    setTimeout(() => { btn.style.background = oldBg; }, 1000);
    window.toast('✅ Đã copy khối lượng chi tiết');
  } catch (e) {
    console.error(e);
    window.toast('❌ Copy thất bại', 'error');
  }
}

export function pasteKLCT(btn) {
  try {
    const raw = localStorage.getItem('klct_clipboard');
    if (!raw) { window.toast('Chưa có dữ liệu copy', 'error'); return; }
    const data = JSON.parse(raw);
    const container = btn.closest('.section, .card, .block') || btn.parentElement;
    const tbody = container.querySelector('tbody');
    if (!tbody) return;

    const prefix = tbody.id.split('-')[0]; // 'hdc' hoặc 'hdtp'
    const arr = prefix === 'hdc' ? window._hdcItems : window._hdtpItems;

    if (arr.length > 0 && !confirm('Bạn có muốn ghi đè dữ liệu chi tiết hiện có không?')) return;

    arr.length = 0;
    data.forEach(row => {
      arr.push({
        name:   row.ten       || '',
        donVi:  row.donvi     || '',
        sl:     parseFloat(row.khoiluong) || 0,
        donGia: parseFloat(row.dongia)    || 0
      });
    });

    if (window['render' + prefix + 'ChiTiet']) window['render' + prefix + 'ChiTiet']();
    if (window[prefix + 'CalcAuto'])           window[prefix + 'CalcAuto']();
    tbody.scrollIntoView({ behavior: 'smooth', block: 'end' });
    window.toast('📥 Đã dán khối lượng chi tiết');
  } catch (e) {
    console.error(e);
    window.toast('❌ Paste lỗi', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// KLCT SUBSYSTEM — Chi tiết khối lượng hợp đồng
// ══════════════════════════════════════════════════════════════

function updateGlobalTotals(prefix, arr) {
  const grandTotal = calcHopDongValue({ items: arr });
  const tongEl = document.getElementById(`${prefix}-chitiet-tong`);
  if (tongEl) tongEl.textContent = grandTotal ? grandTotal.toLocaleString('vi-VN') : '0';

  const wrap = document.getElementById(`${prefix}-chitiet-wrap`);
  if (arr.length === 0) {
    if (wrap) wrap.style.display = 'none';
  } else {
    if (wrap) wrap.style.display = 'block';
  }
  // Gọi CalcAuto để cập nhật giá trị hợp đồng tổng
  if (prefix === 'hdc' && typeof window.hdcCalcAuto === 'function') window.hdcCalcAuto();
  else if (prefix === 'hdtp' && typeof window.hdtpCalcAuto === 'function') window.hdtpCalcAuto();
}

window.updateItem = function(prefix, idx, field, val) {
  const arr = prefix === 'hdc' ? window._hdcItems : window._hdtpItems;
  if (!arr[idx]) return;
  if (field === 'sl' || field === 'donGia') {
    arr[idx][field] = parseFloat(val) || 0;
    const row = document.querySelector(`#${prefix}-chitiet-tbody tr[data-idx="${idx}"]`);
    if (row) {
      const total   = (arr[idx].sl || 0) * (arr[idx].donGia || 0);
      const totalTd = row.querySelector('.row-total');
      if (totalTd) totalTd.textContent = total ? total.toLocaleString('vi-VN') : '0';
    }
    updateGlobalTotals(prefix, arr);
  } else {
    arr[idx][field] = val;
  }
};

window.removeItem = function(prefix, idx) {
  const arr = prefix === 'hdc' ? window._hdcItems : window._hdtpItems;
  arr.splice(idx, 1);
  if (prefix === 'hdc') window.renderhdcChiTiet();
  else window.renderhdtpChiTiet();
};

function bindItemsToTable(prefix, getItemsArr) {
  window[`render${prefix}ChiTiet`] = function() {
    const tbody = document.getElementById(`${prefix}-chitiet-tbody`);
    const arr   = getItemsArr();
    if (!tbody) return;
    tbody.innerHTML = arr.map((it, i) => {
      const total = (it.sl || 0) * (it.donGia || 0);
      return `<tr data-idx="${i}">
        <td><input type="text" class="bare-input" style="width:100%" value="${escapeHtml(it.name || '')}" oninput="updateItem('${prefix}',${i},'name',this.value)"></td>
        <td><input type="text" class="bare-input" style="width:100%;text-align:center" placeholder="m2, m3, cái..." value="${escapeHtml(it.donVi || '')}" oninput="updateItem('${prefix}',${i},'donVi',this.value)"></td>
        <td><input type="number" class="bare-input" style="width:100%;text-align:center" value="${it.sl != null ? it.sl : 1}" oninput="updateItem('${prefix}',${i},'sl',this.value)"></td>
        <td><input type="text" class="bare-input" style="width:100%;text-align:right" value="${it.donGia ? parseInt(it.donGia).toLocaleString('vi-VN') : ''}" oninput="fmtInputMoney(this);updateItem('${prefix}',${i},'donGia',this.dataset.raw||0)" data-raw="${it.donGia || 0}"></td>
        <td class="row-total" style="text-align:right;font-weight:bold;color:var(--gold)">${total ? total.toLocaleString('vi-VN') : '0'}</td>
        <td style="text-align:center"><button type="button" class="btn btn-outline btn-sm" style="color:var(--red);border:none;padding:2px 6px" onclick="removeItem('${prefix}',${i})">✕</button></td>
      </tr>`;
    }).join('');
    updateGlobalTotals(prefix, arr);
  };

  window[`add${prefix}ChiTietRow`] = function() {
    const arr = getItemsArr();
    arr.push({ name: '', donVi: '', sl: 1, donGia: 0 });
    window[`render${prefix}ChiTiet`]();
  };

  window[`toggle${prefix}ChiTiet`] = function() {
    const wrap = document.getElementById(`${prefix}-chitiet-wrap`);
    if (!wrap) return;
    const arr = getItemsArr();
    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      if (arr.length === 0) arr.push({ name: '', donVi: '', sl: 1, donGia: 0 });
      window[`render${prefix}ChiTiet`]();
    } else {
      if (arr.length > 0 && confirm('Bạn có chắc muốn ẩn và xóa bảng chi tiết?')) {
        arr.length = 0;
        wrap.style.display = 'none';
        window[`render${prefix}ChiTiet`]();
      } else if (arr.length === 0) {
        wrap.style.display = 'none';
      }
    }
    if (prefix === 'hdc') window.hdcCalcAuto(); else window.hdtpCalcAuto();
  };

  window[`${prefix}CalcAuto`] = function() {
    const arr      = getItemsArr();
    const isDetailed = arr && arr.length > 0;
    const slEl     = document.getElementById(`${prefix}-sl`);
    const dgEl     = document.getElementById(`${prefix}-dongia`);
    if (!slEl || !dgEl) return;

    slEl.disabled    = isDetailed;
    dgEl.disabled    = isDetailed;
    slEl.style.opacity = isDetailed ? '0.5' : '1';
    dgEl.style.opacity = isDetailed ? '0.5' : '1';

    const hd  = { sl: parseFloat(slEl.value) || 1, donGia: _readMoneyInput(`${prefix}-dongia`), items: arr };
    const val = calcHopDongValue(hd);
    const giaTriInput = document.getElementById(`${prefix}-giatri`);
    if (giaTriInput) {
      giaTriInput.dataset.raw = val || 0;
      giaTriInput.value       = val ? val.toLocaleString('vi-VN') : '';
    }
    if (prefix === 'hdc') {
      if (typeof hdcUpdateTotal === 'function') hdcUpdateTotal();
    } else {
      if (typeof hdtpUpdateTotal === 'function') hdtpUpdateTotal();
    }
  };
}

function _initDoanhThuAddons() {
  ['hdc', 'hdtp'].forEach(prefix => {
    const giaTriInput = document.getElementById(`${prefix}-giatri`);
    if (!giaTriInput || document.getElementById(`${prefix}-sl`)) return;
    const giaTriField = giaTriInput.closest('.dt-field');
    if (!giaTriField) return;

    const uiHtml = `
      <div class="dt-field">
        <label>Khối Lượng</label>
        <input type="number" id="${prefix}-sl" value="1" placeholder="1" oninput="window.${prefix}CalcAuto()">
      </div>
      <div class="dt-field">
        <label>Đơn Giá (đ)</label>
        <input type="text" id="${prefix}-dongia" placeholder="0" oninput="fmtInputMoney(this);window.${prefix}CalcAuto()">
      </div>
    `;
    giaTriField.insertAdjacentHTML('beforebegin', uiHtml);

    const formGrid = giaTriField.parentElement;
    formGrid.insertAdjacentHTML('afterend', `
      <div style="margin-top:10px;grid-column:1/-1;">
        <button type="button" class="btn btn-outline btn-sm" id="${prefix}-btn-chitiet" onclick="window.toggle${prefix}ChiTiet()">📊 Khối lượng chi tiết</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="copyKLCT(this)">📋 Copy</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="pasteKLCT(this)">📥 Paste</button>
        <div id="${prefix}-chitiet-wrap" style="display:none;margin-top:10px;border:1px solid var(--line);padding:10px;border-radius:6px;background:var(--bg)">
          <div style="overflow-x:auto;">
            <table class="entry-table" style="width:100%;min-width:500px;">
              <thead>
                <tr>
                  <th style="text-align:left">Tên hạng mục</th>
                  <th style="width:70px;text-align:center">Đơn vị</th>
                  <th style="width:80px;text-align:center">Khối lượng</th>
                  <th style="width:140px;text-align:right">Đơn giá (đ)</th>
                  <th style="width:150px;text-align:right">Thành tiền (đ)</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody id="${prefix}-chitiet-tbody"></tbody>
            </table>
          </div>
          <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.add${prefix}ChiTietRow()">+ Thêm dòng</button>
            <div style="font-weight:bold;font-size:13px"><span style="color:var(--ink3)">Tổng chi tiết: </span><span id="${prefix}-chitiet-tong" style="color:var(--gold)">0</span></div>
          </div>
        </div>
      </div>
    `);

    giaTriInput.setAttribute('readonly', 'true');
    giaTriInput.style.background    = 'var(--paper)';
    giaTriInput.style.pointerEvents = 'none';
    const label = giaTriField.querySelector('label');
    if (label) label.innerHTML += ' <i style="font-weight:normal;color:var(--ink3)">(Tự động)</i>';
  });
}

// ══════════════════════════════════════════════════════════════
// HỢP ĐỒNG CHÍNH
// ══════════════════════════════════════════════════════════════

function hdcUpdateTotal() {
  const tong = _readMoneyInput('hdc-giatri') + _readMoneyInput('hdc-giatriphu') + _readMoneyInput('hdc-phatsinh');
  const el   = document.getElementById('hdc-tong-label');
  if (el) el.textContent = tong ? 'Tổng: ' + window.fmtM(tong) : '';
}

function _hdcResetForm() {
  window._hdcItems = [];
  const slEl = document.getElementById('hdc-sl');
  const dgEl = document.getElementById('hdc-dongia');
  if (slEl) { slEl.value = '1'; slEl.disabled = false; slEl.style.opacity = '1'; }
  if (dgEl) { dgEl.value = ''; dgEl.dataset.raw = ''; dgEl.disabled = false; dgEl.style.opacity = '1'; }
  if (typeof window.renderhdcChiTiet === 'function') window.renderhdcChiTiet();

  ['hdc-giatri', 'hdc-giatriphu', 'hdc-phatsinh'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const ctSel    = document.getElementById('hdc-ct-input');  if (ctSel)    ctSel.value    = '';
  const nguoiSel = document.getElementById('hdc-nguoi');     if (nguoiSel) nguoiSel.value = '';
  const ngayEl   = document.getElementById('hdc-ngay');      if (ngayEl)   ngayEl.value   = today();
  const editEl   = document.getElementById('hdc-edit-id');   if (editEl)   editEl.value   = '';
  const btn      = document.getElementById('hdc-save-btn');  if (btn)      btn.textContent = '💾 Lưu';
  const tong     = document.getElementById('hdc-tong-label');if (tong)     tong.textContent = '';
}

function saveHopDongChinh() {
  const ctInput = document.getElementById('hdc-ct-input');
  const ct      = ctInput?.value.trim();
  if (!ct) { window.toast('Vui lòng chọn Công Trình!', 'error'); return; }

  const projExists = _getAllProjects().some(p => p.id !== 'COMPANY' && p.name === ct);
  if (!projExists) { window.toast('Chỉ được tạo công trình tại tab Công Trình', 'error'); return; }

  const ngay      = document.getElementById('hdc-ngay')?.value      || today();
  const nguoi     = document.getElementById('hdc-nguoi')?.value      || '';
  const slEl      = document.getElementById('hdc-sl');
  const sl        = slEl && slEl.value !== '' ? parseFloat(slEl.value) : 1;
  const donGia    = _readMoneyInput('hdc-dongia');
  const giaTri    = calcHopDongValue({ sl, donGia, items: window._hdcItems });
  const giaTriphu = _readMoneyInput('hdc-giatriphu');
  const phatSinh  = _readMoneyInput('hdc-phatsinh');
  const editId    = document.getElementById('hdc-edit-id')?.value    || '';

  _dtAddCT(ct);
  const now      = Date.now();
  const hdcProj  = (window.projects || []).find(p => p.name === ct) || null;
  const hdcPid   = hdcProj ? hdcProj.id : null;
  const saveKey  = hdcPid || ct;
  const hdData   = window.hopDongData || {};

  if (editId) {
    const existing = hdData[editId] || {};
    if (editId !== saveKey) {
      hdData[saveKey] = { giaTri, giaTriphu, phatSinh, nguoi, projectId: hdcPid, sl, donGia, items: [...window._hdcItems], ngay: ngay || existing.ngay || today(), createdAt: existing.createdAt || now, updatedAt: now, deletedAt: null };
      hdData[editId]  = { ...existing, deletedAt: now, updatedAt: now };
    } else {
      hdData[editId] = { ...existing, giaTri, giaTriphu, phatSinh, nguoi, ngay, projectId: hdcPid, sl, donGia, items: [...window._hdcItems], updatedAt: now };
    }
    window.toast('✅ Đã cập nhật hợp đồng: ' + ct, 'success');
  } else {
    hdData[saveKey] = { giaTri, giaTriphu, phatSinh, nguoi, projectId: hdcPid, sl, donGia, items: [...window._hdcItems], ngay, createdAt: now, updatedAt: now, deletedAt: null };
    window.toast('✅ Đã lưu hợp đồng: ' + ct, 'success');
  }

  window.save('hopdong_v1', hdData);
  _hdcResetForm();
  renderHdcTable(0);
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
}

function editHopDongChinh(keyId) {
  const hd = (window.hopDongData || {})[keyId];
  if (!hd) return;

  const p      = (window.projects || []).find(proj => proj.id === keyId);
  const ctName = p ? p.name : keyId;

  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctSel    = document.getElementById('hdc-ct-input');  if (ctSel)    ctSel.value    = ctName;
  const ngayEl   = document.getElementById('hdc-ngay');      if (ngayEl)   ngayEl.value   = hd.ngay || '';
  const nguoiSel = document.getElementById('hdc-nguoi');     if (nguoiSel) nguoiSel.value = hd.nguoi || '';

  function _setMoney(elemId, val) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.dataset.raw = val || 0;
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
  }

  window._hdcItems = Array.isArray(hd.items) ? [...hd.items] : [];
  const slEl = document.getElementById('hdc-sl');
  if (slEl) slEl.value = hd.sl !== undefined ? hd.sl : 1;
  _setMoney('hdc-dongia', hd.donGia !== undefined ? hd.donGia : (hd.giaTri || 0));
  if (typeof window.renderhdcChiTiet === 'function') window.renderhdcChiTiet();
  if (typeof window.hdcCalcAuto === 'function')      window.hdcCalcAuto();

  _setMoney('hdc-giatri',    hd.giaTri    || 0);
  _setMoney('hdc-giatriphu', hd.giaTriphu || 0);
  _setMoney('hdc-phatsinh',  hd.phatSinh  || 0);

  const editEl = document.getElementById('hdc-edit-id');  if (editEl) editEl.value = keyId;
  const btn    = document.getElementById('hdc-save-btn'); if (btn)    btn.textContent = '✏️ Cập nhật';

  hdcUpdateTotal();
  document.getElementById('hdc-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function delHopDongChinh(keyId) {
  const p      = (window.projects || []).find(proj => proj.id === keyId);
  const ctName = p ? p.name : keyId;
  if (!confirm('Xóa hợp đồng của ' + ctName + '?')) return;
  const now   = Date.now();
  const hdData = window.hopDongData || {};
  hdData[keyId] = { ...(hdData[keyId] || {}), deletedAt: now, updatedAt: now };
  window.save('hopdong_v1', hdData);
  renderHdcTable(_hdcPage);
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  window.toast('Đã xóa hợp đồng: ' + ctName, 'success');
}

function renderHdcTable(page) {
  page     = page || 0;
  _hdcPage = page;
  const tbody  = document.getElementById('hdc-tbody');
  const empty  = document.getElementById('hdc-empty');
  const pgWrap = document.getElementById('hdc-pagination');
  if (!tbody) return;

  const allProjs = window.projects || [];
  const entries  = Object.entries(window.hopDongData || {})
    .filter(([keyId, v]) => !v.deletedAt && _dtInYear(v.ngay) && _dtMatchHDCFilter(keyId, v))
    .sort((a, b) => _resolveCtName(a[0]).localeCompare(_resolveCtName(b[0]), 'vi'));

  if (!entries.length) {
    tbody.innerHTML = '';
    if (empty)  empty.style.display  = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = entries.length;
  const slice = entries.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(([keyId, hd]) => {
    const ctName = _resolveCtName(keyId);
    const tong   = (hd.giaTri || 0) + (hd.giaTriphu || 0) + (hd.phatSinh || 0);
    const ngayFmt = hd.ngay ? (hd.ngay.split('-').length === 3 ? hd.ngay.split('-').reverse().join('-') : hd.ngay) : '—';
    return `<tr>
      <td style="text-align:center;padding:4px 6px"><input type="checkbox" class="hdc-row-chk" data-id="${escapeHtml(keyId)}"></td>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${ngayFmt}</td>
      <td style="font-weight:600;white-space:nowrap">${escapeHtml(ctName)}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.giaTri    ? window.fmtS(hd.giaTri)    : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.giaTriphu ? window.fmtS(hd.giaTriphu) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.phatSinh  ? window.fmtS(hd.phatSinh)  : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold);white-space:nowrap">${tong ? window.fmtS(tong) : '—'}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editHopDongChinh(this.dataset.ct)" data-ct="${escapeHtml(keyId)}">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red)" title="Xóa"
          onclick="delHopDongChinh(this.dataset.ct)" data-ct="${escapeHtml(keyId)}">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (pgWrap) pgWrap.innerHTML = paginationHtml(total, page, DT_PG, 'renderHdcTable');
}

// ══════════════════════════════════════════════════════════════
// GHI NHẬN THU TIỀN
// ══════════════════════════════════════════════════════════════

function _thuResetForm() {
  ['thu-tien', 'thu-nd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const ctSel    = document.getElementById('thu-ct-input');  if (ctSel)    ctSel.value    = '';
  const nguoiSel = document.getElementById('thu-nguoi');     if (nguoiSel) nguoiSel.value = '';
  const ngayEl   = document.getElementById('thu-ngay');      if (ngayEl)   ngayEl.value   = today();
  const editEl   = document.getElementById('thu-edit-id');   if (editEl)   editEl.value   = '';
  const saveBtn  = document.getElementById('thu-save-btn');  if (saveBtn)  saveBtn.textContent = '+ Ghi nhận Thu';
  const cancelBtn= document.getElementById('thu-cancel-btn');if (cancelBtn)cancelBtn.style.display = 'none';
}

function _thuCancelEdit() {
  _thuResetForm();
  window.toast('Đã hủy chỉnh sửa', '');
}

function saveThuRecord() {
  const ct    = document.getElementById('thu-ct-input')?.value.trim();
  const ngay  = document.getElementById('thu-ngay')?.value;
  const tien  = _readMoneyInput('thu-tien');
  const nguoi = (document.getElementById('thu-nguoi')?.value || '').trim().toUpperCase();
  const nd    = document.getElementById('thu-nd')?.value.trim()     || '';
  const editId= document.getElementById('thu-edit-id')?.value       || '';

  if (!ct)   { window.toast('Vui lòng nhập Công Trình!', 'error'); return; }
  if (!ngay) { window.toast('Vui lòng chọn Ngày!', 'error');        return; }
  if (!tien) { window.toast('Vui lòng nhập Số Tiền!', 'error');     return; }

  const projExists = _getAllProjects().some(p => p.id !== 'COMPANY' && p.name === ct);
  if (!projExists) { window.toast('Chỉ được tạo công trình tại tab Công Trình', 'error'); return; }

  _dtAddCT(ct);
  const now     = Date.now();
  const thuProj = (window.projects || []).find(p => p.name === ct) || null;
  const thuPid  = thuProj ? thuProj.id : null;
  const recs    = window.thuRecords || [];

  if (editId) {
    const idx = recs.findIndex(r => String(r.id) === String(editId));
    if (idx >= 0) {
      recs[idx] = window.mkUpdate(recs[idx], { ngay, congtrinh: ct, projectId: thuPid, tien, nguoi, nd });
    }
    window.save('thu_v1', recs);
    _thuResetForm();
    renderThuTable(_thuPage);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    window.toast('✅ Đã cập nhật thu tiền: ' + window.fmtM(tien) + ' — ' + ct, 'success');
  } else {
    recs.unshift(window.mkRecord({ ngay, congtrinh: ct, projectId: thuPid, tien, nguoi, nd }));
    window.save('thu_v1', recs);
    // Reset nhẹ: giữ ct và ngày, xóa tiền/người/nội dung
    const tienEl = document.getElementById('thu-tien');
    if (tienEl) { tienEl.value = ''; tienEl.dataset.raw = ''; }
    const nguoiEl = document.getElementById('thu-nguoi'); if (nguoiEl) nguoiEl.value = '';
    const ndEl    = document.getElementById('thu-nd');    if (ndEl)    ndEl.value    = '';
    renderThuTable(0);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    window.toast('✅ Đã ghi nhận thu ' + window.fmtM(tien) + ' từ ' + ct, 'success');
  }
}

function editThuRecord(id) {
  const recs = window.thuRecords || [];
  const r    = recs.find(r => String(r.id) === String(id));
  if (!r) return;

  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctSel    = document.getElementById('thu-ct-input');
  if (ctSel) ctSel.value = (typeof window.resolveProjectName === 'function' ? window.resolveProjectName(r) : _resolveCtName(r)) || r.congtrinh || '';
  const ngayEl   = document.getElementById('thu-ngay');    if (ngayEl)   ngayEl.value   = r.ngay   || '';
  const nguoiSel = document.getElementById('thu-nguoi');   if (nguoiSel) nguoiSel.value = r.nguoi  || '';
  const ndEl     = document.getElementById('thu-nd');      if (ndEl)     ndEl.value     = r.nd     || '';

  const tienEl = document.getElementById('thu-tien');
  if (tienEl) { tienEl.dataset.raw = r.tien || 0; tienEl.value = r.tien ? parseInt(r.tien).toLocaleString('vi-VN') : ''; }

  const editEl   = document.getElementById('thu-edit-id');  if (editEl)   editEl.value      = id;
  const saveBtn  = document.getElementById('thu-save-btn'); if (saveBtn)  saveBtn.textContent = '✏️ Cập nhật';
  const cancelBtn= document.getElementById('thu-cancel-btn');if (cancelBtn) cancelBtn.style.display = '';

  document.getElementById('thu-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function delThuRecord(id) {
  if (!confirm('Xóa bản ghi thu tiền này?')) return;
  const recs = window.thuRecords || [];
  const idx  = recs.findIndex(r => String(r.id) === String(id));
  if (idx < 0) return;
  const now = Date.now();
  recs[idx] = { ...recs[idx], deletedAt: now, updatedAt: now, deviceId: window.DEVICE_ID };
  window.save('thu_v1', recs);
  renderThuTable(_thuPage);
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  window.toast('Đã xóa bản ghi thu tiền', 'success');
}

function renderThuTable(page) {
  if (page === undefined) page = _thuPage;
  _thuPage     = page;
  const tbody  = document.getElementById('thu-tbody');
  const empty  = document.getElementById('thu-empty');
  const badge  = document.getElementById('thu-count-badge');
  const pgWrap = document.getElementById('thu-pagination');
  if (!tbody) return;

  const filtered = (window.thuRecords || [])
    .filter(r => !r.deletedAt && window.inActiveYear(r.ngay) && _dtMatchProjFilter(r))
    .sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));

  if (badge) badge.textContent = filtered.length ? `(${filtered.length} đợt)` : '';

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty)  empty.style.display  = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = filtered.length;
  const slice = filtered.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(r => {
    const ngayFmt = r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—';
    return `<tr>
      <td style="text-align:center;padding:4px 6px"><input type="checkbox" class="thu-row-chk" data-id="${r.id}"></td>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${ngayFmt}</td>
      <td style="font-weight:600;white-space:nowrap">${escapeHtml(_resolveCtName(r))}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green);white-space:nowrap">${window.fmtM(r.tien)}</td>
      <td style="color:var(--ink2)">${escapeHtml(r.nguoi || '—')}</td>
      <td style="color:var(--ink3);font-size:12px">${escapeHtml(r.nd || '—')}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editThuRecord('${r.id}')">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red);padding:2px 8px" title="Xóa"
          onclick="delThuRecord('${r.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (pgWrap) pgWrap.innerHTML = paginationHtml(total, page, DT_PG, 'renderThuTable');
}

// ══════════════════════════════════════════════════════════════
// HỢP ĐỒNG THẦU PHỤ
// ══════════════════════════════════════════════════════════════

function hdtpUpdateTotal() {
  const tong = _readMoneyInput('hdtp-giatri') + _readMoneyInput('hdtp-phatsinh');
  const el   = document.getElementById('hdtp-tong-label');
  if (el) el.textContent = tong ? 'Tổng: ' + window.fmtM(tong) : '';
}

function _hdtpResetForm() {
  window._hdtpItems = [];
  const slEl = document.getElementById('hdtp-sl');
  const dgEl = document.getElementById('hdtp-dongia');
  if (slEl) { slEl.value = '1'; slEl.disabled = false; slEl.style.opacity = '1'; }
  if (dgEl) { dgEl.value = ''; dgEl.dataset.raw = ''; dgEl.disabled = false; dgEl.style.opacity = '1'; }
  if (typeof window.renderhdtpChiTiet === 'function') window.renderhdtpChiTiet();

  ['hdtp-giatri', 'hdtp-phatsinh', 'hdtp-nd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const ctSel  = document.getElementById('hdtp-ct-input');  if (ctSel)  ctSel.value  = '';
  const tpSel  = document.getElementById('hdtp-thauphu');   if (tpSel)  tpSel.value  = '';
  const ngayEl = document.getElementById('hdtp-ngay');      if (ngayEl) ngayEl.value = today();
  const editEl = document.getElementById('hdtp-edit-id');   if (editEl) editEl.value = '';
  const btn    = document.getElementById('hdtp-save-btn');  if (btn)    btn.textContent = '💾 Lưu';
  const tong   = document.getElementById('hdtp-tong-label');if (tong)   tong.textContent = '';
}

function saveHopDongThauPhu() {
  const ct = document.getElementById('hdtp-ct-input')?.value.trim();
  const tp = (document.getElementById('hdtp-thauphu')?.value || '').trim();
  if (!ct) { window.toast('Vui lòng chọn Công Trình!', 'error'); return; }
  if (!tp) { window.toast('Vui lòng chọn Thầu Phụ!',  'error'); return; }

  const projExists = _getAllProjects().some(p => p.id !== 'COMPANY' && p.name === ct);
  if (!projExists) { window.toast('Chỉ được tạo công trình tại tab Công Trình', 'error'); return; }

  const ngay     = document.getElementById('hdtp-ngay')?.value || today();
  const slEl     = document.getElementById('hdtp-sl');
  const sl       = slEl && slEl.value !== '' ? parseFloat(slEl.value) : 1;
  const donGia   = _readMoneyInput('hdtp-dongia');
  const giaTri   = calcHopDongValue({ sl, donGia, items: window._hdtpItems });
  const phatSinh = _readMoneyInput('hdtp-phatsinh');
  const nd       = document.getElementById('hdtp-nd')?.value.trim() || '';
  const editId   = document.getElementById('hdtp-edit-id')?.value   || '';

  _dtAddCT(ct);
  _dtAddTP(tp);
  const now      = Date.now();
  const hdtpProj = (window.projects || []).find(p => p.name === ct) || null;
  const hdtpPid  = hdtpProj ? hdtpProj.id : null;
  const recs     = window.thauPhuContracts || [];

  if (editId) {
    const idx = recs.findIndex(r => r.id === editId);
    if (idx >= 0) {
      recs[idx] = window.mkUpdate(recs[idx], { ngay, congtrinh: ct, projectId: hdtpPid, thauphu: tp, giaTri, phatSinh, nd, sl, donGia, items: [...window._hdtpItems] });
    }
    window.toast('✅ Đã cập nhật HĐ thầu phụ', 'success');
  } else {
    recs.unshift(window.mkRecord({ ngay, congtrinh: ct, projectId: hdtpPid, thauphu: tp, giaTri, phatSinh, nd, sl, donGia, items: [...window._hdtpItems] }));
    window.toast('✅ Đã lưu HĐ thầu phụ: ' + tp + ' — ' + ct, 'success');
  }

  window.save('thauphu_v1', recs);
  _hdtpResetForm();
  renderHdtpTable(0);
}

function editHopDongThauPhu(id) {
  const recs = window.thauPhuContracts || [];
  const r    = recs.find(r => r.id === id);
  if (!r) return;

  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctSel  = document.getElementById('hdtp-ct-input');  if (ctSel)  ctSel.value  = r.congtrinh || '';
  const tpSel  = document.getElementById('hdtp-thauphu');   if (tpSel)  tpSel.value  = r.thauphu  || '';
  const ngayEl = document.getElementById('hdtp-ngay');      if (ngayEl) ngayEl.value = r.ngay     || '';
  const ndEl   = document.getElementById('hdtp-nd');        if (ndEl)   ndEl.value   = r.nd       || '';

  function _setMoney(elemId, val) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.dataset.raw = val || 0;
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
  }

  window._hdtpItems = Array.isArray(r.items) ? [...r.items] : [];
  const slEl = document.getElementById('hdtp-sl');
  if (slEl) slEl.value = r.sl !== undefined ? r.sl : 1;
  _setMoney('hdtp-dongia',  r.donGia !== undefined ? r.donGia : (r.giaTri || 0));
  if (typeof window.renderhdtpChiTiet === 'function') window.renderhdtpChiTiet();
  if (typeof window.hdtpCalcAuto === 'function')      window.hdtpCalcAuto();

  _setMoney('hdtp-giatri',   r.giaTri   || 0);
  _setMoney('hdtp-phatsinh', r.phatSinh || 0);

  const editEl = document.getElementById('hdtp-edit-id');  if (editEl) editEl.value      = id;
  const btn    = document.getElementById('hdtp-save-btn'); if (btn)    btn.textContent = '✏️ Cập nhật';

  hdtpUpdateTotal();
  document.getElementById('hdtp-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function delHopDongThauPhu(id) {
  if (!confirm('Xóa hợp đồng thầu phụ này?')) return;
  const recs = window.thauPhuContracts || [];
  const idx  = recs.findIndex(r => r.id === id);
  if (idx < 0) return;
  const now = Date.now();
  recs[idx] = { ...recs[idx], deletedAt: now, updatedAt: now };
  window.save('thauphu_v1', recs);
  renderHdtpTable(_hdtpPage);
  window.toast('Đã xóa hợp đồng thầu phụ', 'success');
}

function renderHdtpTable(page) {
  page      = page || 0;
  _hdtpPage = page;
  const tbody  = document.getElementById('hdtp-tbody');
  const empty  = document.getElementById('hdtp-empty');
  const pgWrap = document.getElementById('hdtp-pagination');
  if (!tbody) return;

  const filtered = (window.thauPhuContracts || [])
    .filter(r => !r.deletedAt && _dtMatchProjFilter(r) && _dtInYear(r.ngay))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty)  empty.style.display  = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = filtered.length;
  const slice = filtered.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(r => {
    const tong    = (r.giaTri || 0) + (r.phatSinh || 0);
    const ngayFmt = r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—';
    return `<tr>
      <td style="text-align:center;padding:4px 6px"><input type="checkbox" class="hdtp-row-chk" data-id="${r.id}"></td>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${ngayFmt}</td>
      <td style="font-weight:600;white-space:nowrap">${escapeHtml(_resolveCtName(r))}</td>
      <td style="white-space:nowrap">${escapeHtml(r.thauphu || '')}</td>
      <td style="color:var(--ink3);font-size:12px;min-width:90px">${escapeHtml(r.nd || '—')}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${r.giaTri    ? window.fmtS(r.giaTri)    : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${r.phatSinh  ? window.fmtS(r.phatSinh)  : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold);white-space:nowrap">${tong ? window.fmtS(tong) : '—'}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editHopDongThauPhu('${r.id}')">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red)" title="Xóa"
          onclick="delHopDongThauPhu('${r.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (pgWrap) pgWrap.innerHTML = paginationHtml(total, page, DT_PG, 'renderHdtpTable');
}

// ══════════════════════════════════════════════════════════════
// CÔNG NỢ
// ══════════════════════════════════════════════════════════════

function renderCongNoThauPhu() {
  const tbody = document.getElementById('congno-tbody');
  const empty = document.getElementById('congno-empty');
  if (!tbody) return;

  const map = {};

  (window.ungRecords || [])
    .filter(r => r.loai === 'thauphu' && !r.deletedAt && _dtInYear(r.ngay) && _dtMatchProjFilter(r))
    .forEach(r => {
      const ctDisplay = _resolveCtName(r);
      const key = (r.tp || '') + '|||' + ctDisplay;
      if (!map[key]) map[key] = { thauphu: r.tp || '', congtrinh: ctDisplay, tongUng: 0, count: 0, tongHD: 0 };
      map[key].tongUng += (r.tien || 0);
      map[key].count++;
    });

  (window.thauPhuContracts || [])
    .filter(r => !r.deletedAt && _dtMatchProjFilter(r) && _dtInYear(r.ngay))
    .forEach(r => {
      const ctDisplay = _resolveCtName(r);
      const key = (r.thauphu || '') + '|||' + ctDisplay;
      if (!map[key]) map[key] = { thauphu: r.thauphu || '', congtrinh: ctDisplay, tongUng: 0, count: 0, tongHD: 0 };
      map[key].tongHD += (r.giaTri || 0) + (r.phatSinh || 0);
    });

  const rows = Object.values(map)
    .map(r => ({ ...r, name: r.thauphu }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.congtrinh.localeCompare(b.congtrinh, 'vi'));

  const { html, hasData } = renderCongNoTableHtml(rows);
  if (!hasData) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
  } else {
    tbody.innerHTML = html;
    if (empty) empty.style.display = 'none';
  }
}

function renderCongNoNhaCungCap() {
  const tbody = document.getElementById('congno-ncc-tbody');
  const empty = document.getElementById('congno-ncc-empty');
  if (!tbody) return;

  const selProjId = (() => {
    if (!_dtCtFilter) return null;
    const p = _getAllProjects().find(prj => prj.name === _dtCtFilter);
    return p ? p.id : null;
  })();

  const nccList = (window.cats && window.cats.nhaCungCap) ? window.cats.nhaCungCap : [];
  const invoicesCached = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];

  const rows = calcCongNoNCC(
    window.ungRecords || [],
    invoicesCached,
    nccList,
    {
      inActiveYear:       (d)  => _dtInYear(d),
      selProjId,
      getProjectById:     (id) => typeof window.getProjectById === 'function' ? window.getProjectById(id) : null,
      resolveProjectName: (r)  => typeof window.resolveProjectName === 'function' ? window.resolveProjectName(r) : _resolveCtName(r),
    }
  );

  const { html, hasData } = renderCongNoTableHtml(rows);
  if (!hasData) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
  } else {
    tbody.innerHTML = html;
    if (empty) empty.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════
// LÃI / LỖ (Dashboard)
// ══════════════════════════════════════════════════════════════

function renderLaiLo() {
  const wrap = document.getElementById('db-lailo-wrap');
  if (!wrap) return;

  const allProjs = window.projects || [];
  const invoicesCached = typeof window.getInvoicesCached === 'function' ? window.getInvoicesCached() : [];

  const data = calcLaiLo(
    invoicesCached,
    window.thuRecords  || [],
    window.hopDongData || {},
    allProjs,
    {
      inActiveYear:     (d) => typeof window.inActiveYear === 'function' ? window.inActiveYear(d) : true,
      resolveProjectName:(r)=> typeof window.resolveProjectName === 'function' ? window.resolveProjectName(r) : _resolveCtName(r),
      dtInYear:         (d) => _dtInYear(d),
    }
  );

  if (!data.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có dữ liệu</div>';
    return;
  }

  let tongHD = 0, tongHDPhu = 0, tongPS = 0, tongDT = 0, tongChi_ = 0, tongThu = 0;

  const rows = data.map(row => {
    const { ct, giaTri, giaTriphu, phatSinh, tongDT: tongDTct, chi, thu, conPhaiThu, laiLo } = row;
    const llClass  = laiLo > 0 ? 'll-pos' : laiLo < 0 ? 'll-neg' : 'll-zero';
    const llPrefix = laiLo > 0 ? '+' : '';

    tongHD    += giaTri;
    tongHDPhu += giaTriphu;
    tongPS    += phatSinh;
    tongDT    += tongDTct;
    tongChi_  += chi;
    tongThu   += thu;

    return `<tr>
      <td>${escapeHtml(ct)}</td>
      <td>${giaTri    ? window.fmtS(giaTri)    : '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${giaTriphu ? window.fmtS(giaTriphu) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${phatSinh  ? window.fmtS(phatSinh)  : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="font-weight:600">${tongDTct ? window.fmtS(tongDTct) : '—'}</td>
      <td style="color:var(--red)">${window.fmtS(chi)}</td>
      <td style="color:var(--green)">${thu ? window.fmtS(thu) : '—'}</td>
      <td>${tongDTct ? window.fmtS(conPhaiThu) : '—'}</td>
      <td class="${llClass}">${tongDTct ? llPrefix + window.fmtS(laiLo) : '—'}</td>
    </tr>`;
  }).join('');

  const tongLaiLo  = tongDT - tongChi_;
  const tongLLClass = tongLaiLo > 0 ? 'll-pos' : tongLaiLo < 0 ? 'll-neg' : 'll-zero';

  wrap.innerHTML = `
    <div style="overflow-x:auto">
      <table class="ll-table">
        <thead>
          <tr>
            <th style="text-align:left;min-width:140px">Công Trình</th>
            <th>HĐ Chính</th>
            <th>HĐ Phụ</th>
            <th>Phát Sinh</th>
            <th>Tổng DT</th>
            <th>Tổng Chi</th>
            <th>Đã Thu</th>
            <th>Còn Phải Thu</th>
            <th>Lãi / Lỗ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td style="text-align:left">TỔNG CỘNG</td>
            <td>${window.fmtS(tongHD)}</td>
            <td>${window.fmtS(tongHDPhu)}</td>
            <td>${window.fmtS(tongPS)}</td>
            <td style="font-weight:700">${window.fmtS(tongDT)}</td>
            <td style="color:var(--red);font-weight:700">${window.fmtS(tongChi_)}</td>
            <td style="color:var(--green);font-weight:700">${window.fmtS(tongThu)}</td>
            <td>${window.fmtS(tongDT - tongThu)}</td>
            <td class="${tongLLClass}">${tongDT ? (tongLaiLo >= 0 ? '+' : '') + window.fmtS(tongLaiLo) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// SUB-TAB NAVIGATION
// ══════════════════════════════════════════════════════════════

function dtPopulateCtFilter() {
  ['dt-ct-filter-sel', 'dt-cn-ct-filter-sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const fn = window._buildProjFilterOpts || window.buildProjFilterOpts;
    if (typeof fn === 'function') {
      sel.innerHTML = fn(_dtCtFilter, { includeCompany: false, placeholder: '-- Tất cả công trình --' });
    } else {
      // Fallback: build options manually
      sel.innerHTML = buildDtCtFilterOpts(_dtCtFilter, _getAllProjects(), { includeCompany: false });
    }
  });
}

function dtSetCtFilter(val) {
  _dtCtFilter = val || '';
  _hdcPage = 0; _hdtpPage = 0; _thuPage = 0;
  renderHdcTable(0);
  renderHdtpTable(0);
  renderThuTable(0);
  renderCongNoThauPhu();
  renderCongNoNhaCungCap();
}

function dtPopulateSels() {
  const ctInYear   = window._ctInActiveYear || window.ctInActiveYear;
  const actYear    = window.activeYear || 0;
  const projForYear = _getAllProjects()
    .filter(p => actYear === 0 || (typeof ctInYear === 'function' && ctInYear(p.name)));
  const ctOpts = '<option value="">-- Chọn công trình --</option>' +
    projForYear.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');

  ['hdc-ct-input', 'thu-ct-input', 'hdtp-ct-input'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    const cur = sel.value;
    sel.innerHTML = ctOpts;
    if (cur) sel.value = cur;
  });

  // Thầu phụ select
  const allTp  = [...new Set([...(window.cats?.thauPhu || [])].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const tpSel  = document.getElementById('hdtp-thauphu');
  if (tpSel && tpSel.tagName === 'SELECT') {
    const cur = tpSel.value;
    tpSel.innerHTML = '<option value="">-- Chọn thầu phụ --</option>' +
      allTp.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (cur) tpSel.value = cur;
  }

  // Người TH select
  const allNguoi   = [...new Set([...(window.cats?.nguoiTH || [])].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const nguoiOpts  = '<option value="">-- Chọn --</option>' +
    allNguoi.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  ['thu-nguoi', 'hdc-nguoi'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    const cur = sel.value;
    sel.innerHTML = nguoiOpts;
    if (cur) sel.value = cur;
  });

  // Refresh bảng THỐNG KÊ khi năm thay đổi
  renderHdcTable(_hdcPage);
  renderHdtpTable(_hdtpPage);
  renderCongNoThauPhu();
  renderCongNoNhaCungCap();
}

function dtGoSub(btn, id) {
  document.querySelectorAll('#page-doanhthu .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-doanhthu .sub-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  btn.classList.add('active');

  if (id === 'dt-sub-thongke') {
    _hdcPage = 0; _hdtpPage = 0; _thuPage = 0;
    dtPopulateCtFilter();
    renderHdcTable(0);
    renderHdtpTable(0);
    renderThuTable(0);
    renderCongNoThauPhu();
    renderCongNoNhaCungCap();
  } else if (id === 'dt-sub-congno') {
    dtPopulateCtFilter();
    renderCongNoThauPhu();
    renderCongNoNhaCungCap();
  }
}

function dtEnsureCongNoSubtab() {
  const page   = document.getElementById('page-doanhthu');
  const subNav = page ? page.querySelector('.sub-nav') : null;
  if (!page || !subNav) return;

  // Tạo nút sub-tab nếu chưa có
  if (!document.getElementById('dt-sub-congno-btn')) {
    const btn = document.createElement('button');
    btn.className = 'sub-nav-btn';
    btn.id        = 'dt-sub-congno-btn';
    btn.innerHTML = '💳 CÔNG NỢ';
    btn.setAttribute('onclick', "dtGoSub(this,'dt-sub-congno')");
    const tkBtn = document.getElementById('dt-sub-thongke-btn');
    if (tkBtn) tkBtn.insertAdjacentElement('afterend', btn);
    else subNav.appendChild(btn);
  }

  // Tạo trang sub-tab nếu chưa có
  let cnPage = document.getElementById('dt-sub-congno');
  if (!cnPage) {
    cnPage = document.createElement('div');
    cnPage.className = 'sub-page';
    cnPage.id        = 'dt-sub-congno';
    page.appendChild(cnPage);
  }

  // Filter CT row
  if (!document.getElementById('dt-cn-filter-row')) {
    const filterRow = document.createElement('div');
    filterRow.id    = 'dt-cn-filter-row';
    filterRow.style = 'margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    filterRow.innerHTML = `
      <label style="font-size:12px;font-weight:600;color:var(--ink3)">Lọc Công Trình:</label>
      <select id="dt-cn-ct-filter-sel" class="filter-sel" style="min-width:220px;max-width:340px"
        onchange="dtSetCtFilter(this.value)">
        <option value="">-- Tất cả công trình --</option>
      </select>`;
    cnPage.appendChild(filterRow);
  }

  // Di chuyển bảng Công Nợ Thầu Phụ từ THỐNG KÊ sang đây
  const congnoTbody = document.getElementById('congno-tbody');
  const congnoWrap  = congnoTbody ? congnoTbody.closest('.records-wrap') : null;
  const congnoHeader= congnoWrap  ? congnoWrap.previousElementSibling : null;
  if (congnoWrap && congnoHeader && congnoHeader.parentElement?.id === 'dt-sub-thongke') {
    cnPage.appendChild(congnoHeader);
    cnPage.appendChild(congnoWrap);
  }

  // Thêm bảng Công Nợ NCC nếu chưa có
  if (!document.getElementById('congno-ncc-tbody')) {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<div class="section-title"><span class="dot"></span>🟠 Công Nợ Nhà Cung Cấp</div>`;

    const wrap     = document.createElement('div');
    wrap.className = 'records-wrap';
    wrap.style     = 'margin-bottom:24px';
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="thu-table">
          <thead>
            <tr style="font-size:11px;color:var(--ink3);border-bottom:2px solid var(--line)">
              <th style="text-align:left;padding:8px 12px;font-weight:700">Nhà Cung Cấp</th>
              <th style="text-align:left;padding:8px 10px;font-weight:700">Công Trình</th>
              <th style="text-align:right;padding:8px 10px;font-weight:700">Tổng Đã Ứng</th>
              <th style="text-align:right;padding:8px 10px;font-weight:700">Tổng Số Tiền</th>
              <th style="text-align:right;padding:8px 10px;font-weight:700">Còn Phải TT</th>
            </tr>
          </thead>
          <tbody id="congno-ncc-tbody"></tbody>
        </table>
      </div>
      <div id="congno-ncc-empty" style="text-align:center;padding:32px;color:var(--ink3);font-size:13px;display:none">Chưa có dữ liệu công nợ nhà cung cấp</div>
    `;
    cnPage.appendChild(header);
    cnPage.appendChild(wrap);
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORT IMAGE (html2canvas)
// ══════════════════════════════════════════════════════════════

function exportHdcToImage() {
  const checked = [...document.querySelectorAll('.hdc-row-chk:checked')];
  if (!checked.length)  { window.toast('⚠️ Vui lòng tick chọn ít nhất 1 hợp đồng!', 'error'); return; }
  if (checked.length > 1){ window.toast('⚠️ Chỉ chọn 1 hợp đồng để xuất phiếu!',   'error'); return; }

  const keyId = checked[0].dataset.id;
  const hd    = (window.hopDongData || {})[keyId];
  if (!hd) return;

  const ctName = (window.projects || []).find(p => p.id === keyId)?.name || keyId;
  const total  = (hd.giaTri || 0) + (hd.giaTriphu || 0) + (hd.phatSinh || 0);

  document.getElementById('phdc-ct-name').textContent  = ctName;
  document.getElementById('phdc-ct-label').textContent = ctName;
  document.getElementById('phdc-date').textContent     = hd.ngay || today();
  document.getElementById('phdc-nguoi').textContent    = hd.nguoi || '—';
  document.getElementById('phdc-giatri').textContent   = window.numFmt(hd.giaTri || 0) + ' đ';
  document.getElementById('phdc-phatsinh').textContent = window.numFmt((hd.giaTriphu || 0) + (hd.phatSinh || 0)) + ' đ';
  document.getElementById('phdc-tong').textContent     = window.numFmt(total) + ' đ';

  const items = Array.isArray(hd.items) ? hd.items : [];
  let totalDetail = 0;
  document.getElementById('phdc-tbody').innerHTML = items.map(it => {
    const st = (it.sl || 0) * (it.donGia || 0);
    totalDetail += st;
    return `<tr>
      <td style="padding:8px 10px;border:1px solid #1a1814;">${escapeHtml(it.name || '')}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:center;">${escapeHtml(it.donVi || '—')}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:center;">${it.sl || 0}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:right;">${window.numFmt(it.donGia || 0)}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:right;font-weight:700;">${window.numFmt(st)}</td>
    </tr>`;
  }).join('');
  document.getElementById('phdc-total-detail').textContent = window.numFmt(totalDetail) + ' đ';

  const tpl = document.getElementById('hdchinh-template');
  tpl.style.display = 'block';
  window.toast('⏳ Đang tạo phiếu HĐ Công ty...', 'info');

  html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 800 }).then(canvas => {
    tpl.style.display = 'none';
    const link    = document.createElement('a');
    const safeName = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(ctName) : ctName;
    link.download = 'HDChinh_' + safeName + '_' + today() + '.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
    window.toast('✅ Đã xuất phiếu HĐ Công ty!', 'success');
  }).catch(err => { tpl.style.display = 'none'; window.toast('❌ Lỗi: ' + err.message, 'error'); });
}

function exportHdtpToImage() {
  const checked = [...document.querySelectorAll('.hdtp-row-chk:checked')];
  if (!checked.length)  { window.toast('⚠️ Vui lòng tick chọn ít nhất 1 HĐ thầu phụ!',         'error'); return; }
  if (checked.length > 1){ window.toast('⚠️ Chỉ chọn 1 HĐ thầu phụ để xuất phiếu!',            'error'); return; }

  const id   = checked[0].dataset.id;
  const r    = (window.thauPhuContracts || []).find(c => c.id === id);
  if (!r) return;

  const ctName = _resolveCtName(r);
  const total  = (r.giaTri || 0) + (r.phatSinh || 0);

  document.getElementById('phdtp-ct-name').textContent  = ctName;
  document.getElementById('phdtp-ct-label').textContent = ctName;
  document.getElementById('phdtp-date').textContent     = r.ngay    || today();
  document.getElementById('phdtp-thauphu').textContent  = r.thauphu || '—';
  document.getElementById('phdtp-nd').textContent       = r.nd      || '—';
  document.getElementById('phdtp-giatri').textContent   = window.numFmt(r.giaTri   || 0) + ' đ';
  document.getElementById('phdtp-phatsinh').textContent = window.numFmt(r.phatSinh || 0) + ' đ';
  document.getElementById('phdtp-tong').textContent     = window.numFmt(total) + ' đ';

  const items = Array.isArray(r.items) ? r.items : [];
  let totalDetail = 0;
  document.getElementById('phdtp-tbody').innerHTML = items.map(it => {
    const st = (it.sl || 0) * (it.donGia || 0);
    totalDetail += st;
    return `<tr>
      <td style="padding:8px 10px;border:1px solid #1a1814;">${escapeHtml(it.name || '')}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:center;">${escapeHtml(it.donVi || '—')}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:center;">${it.sl || 0}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:right;">${window.numFmt(it.donGia || 0)}</td>
      <td style="padding:8px 10px;border:1px solid #1a1814;text-align:right;font-weight:700;">${window.numFmt(st)}</td>
    </tr>`;
  }).join('');
  document.getElementById('phdtp-total-detail').textContent = window.numFmt(totalDetail) + ' đ';

  const tpl = document.getElementById('hdthauphu-template');
  tpl.style.display = 'block';
  window.toast('⏳ Đang tạo phiếu HĐ Thầu phụ...', 'info');

  html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 800 }).then(canvas => {
    tpl.style.display = 'none';
    const link     = document.createElement('a');
    const safeCT   = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(ctName)      : ctName;
    const safeTP   = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(r.thauphu || '') : (r.thauphu || '');
    link.download  = 'HDThauPhu_' + safeCT + '_' + safeTP + '.png';
    link.href      = canvas.toDataURL('image/png');
    link.click();
    window.toast('✅ Đã xuất phiếu HĐ Thầu phụ!', 'success');
  }).catch(err => { tpl.style.display = 'none'; window.toast('❌ Lỗi: ' + err.message, 'error'); });
}

function exportThuToImage() {
  const checked = [...document.querySelectorAll('.thu-row-chk:checked')];
  if (!checked.length)  { window.toast('⚠️ Vui lòng tick chọn ít nhất 1 lần thu tiền!',                'error'); return; }
  if (checked.length > 1){ window.toast('⚠️ Hiện tại chỉ hỗ trợ xuất phiếu thu cho từng đợt lẻ!', 'error'); return; }

  const id  = checked[0].dataset.id;
  const r   = (window.thuRecords || []).find(t => t.id === id);
  if (!r) return;

  const ctName = _resolveCtName(r);

  document.getElementById('ppt-ct-name').textContent  = ctName;
  document.getElementById('ppt-ct-label').textContent = ctName;
  document.getElementById('ppt-date').textContent     = r.ngay  || today();
  document.getElementById('ppt-nguoi').textContent    = r.nguoi || '—';
  document.getElementById('ppt-tien').textContent     = window.numFmt(r.tien || 0) + ' đ';
  document.getElementById('ppt-nd').textContent       = r.nd    || '—';

  const tpl = document.getElementById('phieuthu-template');
  tpl.style.display = 'block';
  window.toast('⏳ Đang tạo phiếu thu tiền...', 'info');

  html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 680 }).then(canvas => {
    tpl.style.display = 'none';
    const link    = document.createElement('a');
    const safeName = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(ctName) : ctName;
    link.download = 'PhieuThu_' + safeName + '_' + (r.ngay || today()) + '.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
    window.toast('✅ Đã xuất phiếu thu tiền!', 'success');
  }).catch(err => { tpl.style.display = 'none'; window.toast('❌ Lỗi: ' + err.message, 'error'); });
}

// ══════════════════════════════════════════════════════════════
// INIT — Điểm khởi động chính của tab Doanh Thu
// ══════════════════════════════════════════════════════════════

function initDoanhThu() {
  // Chạy migrations nhẹ sau khi data đã ready
  if (window.thuRecords) {
    normalizeThuProjectIds(
      window.thuRecords,
      (name) => { const p = (window.projects||[]).find(q => q.name === name); return p ? p.id : null; },
      (id)   => { const p = (window.projects||[]).find(q => q.id   === id);   return p ? p.name : null; },
      window.save
    );
  }
  if (window.hopDongData || window.thauPhuContracts) {
    migrateHopDongSL(window.hopDongData || {}, window.thauPhuContracts || [], window.save);
  }

  // Khởi tạo KLCT items subsystem
  window._hdcItems  = window._hdcItems  || [];
  window._hdtpItems = window._hdtpItems || [];
  bindItemsToTable('hdc',  () => window._hdcItems);
  bindItemsToTable('hdtp', () => window._hdtpItems);

  _initDoanhThuAddons();
  dtEnsureCongNoSubtab();
  dtPopulateSels();
  dtPopulateCtFilter();

  // Set ngày mặc định
  const ngayEl     = document.getElementById('thu-ngay');     if (ngayEl     && !ngayEl.value)     ngayEl.value     = today();
  const hdcNgayEl  = document.getElementById('hdc-ngay');     if (hdcNgayEl  && !hdcNgayEl.value)  hdcNgayEl.value  = today();
  const hdtpNgayEl = document.getElementById('hdtp-ngay');    if (hdtpNgayEl && !hdtpNgayEl.value) hdtpNgayEl.value = today();

  // Đảm bảo KHAI BÁO là sub-tab active mặc định
  document.querySelectorAll('#page-doanhthu .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-doanhthu .sub-nav-btn').forEach(b => b.classList.remove('active'));
  const kbBtn  = document.getElementById('dt-sub-khaibao-btn');
  const kbPage = document.getElementById('dt-sub-khaibao');
  if (kbBtn && kbPage) { kbPage.classList.add('active'); kbBtn.classList.add('active'); }

  _hdcResetForm();
  _hdtpResetForm();
}

// ══════════════════════════════════════════════════════════════
// BACKWARD COMPAT ALIASES
// ══════════════════════════════════════════════════════════════
function saveHopDong()       { saveHopDongChinh(); }
function hdLoadCT()          { /* deprecated */ }
function renderHopDongList() { renderHdcTable(_hdcPage); }
function delHopDong(ct)      { delHopDongChinh(ct); }

// ══════════════════════════════════════════════════════════════
// WINDOW BRIDGES — Tất cả handlers cần truy cập từ HTML/onclick
// ══════════════════════════════════════════════════════════════
export function initRevenueUI() {
  // copyKLCT / pasteKLCT
  window.copyKLCT  = copyKLCT;
  window.pasteKLCT = pasteKLCT;

  // Module state arrays (đảm bảo đồng bộ sau reload)
  window._hdcItems  = window._hdcItems  || [];
  window._hdtpItems = window._hdtpItems || [];

  // HĐ Chính
  window.saveHopDongChinh  = saveHopDongChinh;
  window.editHopDongChinh  = editHopDongChinh;
  window.delHopDongChinh   = delHopDongChinh;
  window.renderHdcTable    = renderHdcTable;
  window.hdcUpdateTotal    = hdcUpdateTotal;

  // Thu tiền
  window.saveThuRecord     = saveThuRecord;
  window.editThuRecord     = editThuRecord;
  window.delThuRecord      = delThuRecord;
  window._thuCancelEdit    = _thuCancelEdit;
  window.renderThuTable    = renderThuTable;

  // HĐ Thầu Phụ
  window.saveHopDongThauPhu = saveHopDongThauPhu;
  window.editHopDongThauPhu = editHopDongThauPhu;
  window.delHopDongThauPhu  = delHopDongThauPhu;
  window.renderHdtpTable    = renderHdtpTable;
  window.hdtpUpdateTotal    = hdtpUpdateTotal;

  // Công nợ
  window.renderCongNoThauPhu    = renderCongNoThauPhu;
  window.renderCongNoNhaCungCap = renderCongNoNhaCungCap;

  // Lãi/Lỗ
  window.renderLaiLo = renderLaiLo;

  // Sub-tab
  window.dtGoSub          = dtGoSub;
  window.dtSetCtFilter    = dtSetCtFilter;
  window.dtPopulateSels   = dtPopulateSels;
  window.initDoanhThu     = initDoanhThu;

  // Export image
  window.exportHdcToImage  = exportHdcToImage;
  window.exportHdtpToImage = exportHdtpToImage;
  window.exportThuToImage  = exportThuToImage;

  // Backward compat
  window.saveHopDong       = saveHopDong;
  window.renderHopDongList = renderHopDongList;
  window.delHopDong        = delHopDong;

  console.log('[revenue.ui] initRevenueUI ✅ — all window bridges active');
}

// ── Bridge tạm ──────────────────────────────────────────────
window._revenueUI = {
  buildDtCtFilterOpts,
  buildDtCtEntryOpts,
  renderCongNoTableHtml,
  copyKLCT,
  pasteKLCT,
  initRevenueUI,
  initDoanhThu,
  DT_PG,
};

console.log('[revenue.ui] ES Module loaded ✅');
