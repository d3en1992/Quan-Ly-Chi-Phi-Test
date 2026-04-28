// doanhthu.js — Doanh Thu / Hop Dong / Dashboard
// Load order: 6

// ─── Biến toàn cục (main.js sẽ gán lại sau dbInit) ─────────────
let hopDongData      = load('hopdong_v1', {});
let thuRecords       = load('thu_v1', []);
let thauPhuContracts = load('thauphu_v1', []);

// [ADDED] — Normalize thuRecords to projectId at runtime
function _normalizeThuProjectIds() {
  let changed = false;
  thuRecords.forEach(r => {
    if (r.deletedAt) return;
    if (!r.projectId && r.congtrinh) {
      const pid = _getProjectIdByName(r.congtrinh);
      if (pid) { r.projectId = pid; changed = true; }
    }
    if (r.projectId) {
      const pName = _getProjectNameById(r.projectId);
      if (pName && pName !== r.congtrinh) {
        r.congtrinh = pName; changed = true;
      }
    }
  });
  if (changed) save('thu_v1', thuRecords);
}
_normalizeThuProjectIds();

// [ADDED] Migration & Globals cho tính năng Khối lượng + Đơn giá Hợp Đồng
let _hdcItems = [];
let _hdtpItems = [];

function calcHopDongValue(hd) {
  if (hd.items && hd.items.length) {
    return hd.items.reduce((sum, i) => sum + (parseFloat(i.sl) || 0) * (parseFloat(i.donGia) || 0), 0);
  }
  return (parseFloat(hd.sl) || 1) * (parseFloat(hd.donGia) || 0);
}

function _migrateHopDongSL() {
  let changed = false;
  Object.values(hopDongData).forEach(hd => {
    if (hd.sl === undefined) { hd.sl = 1; hd.donGia = hd.giaTri || 0; changed = true; }
  });
  if (changed) save('hopdong_v1', hopDongData);

  changed = false;
  thauPhuContracts.forEach(hd => {
    if (hd.sl === undefined) { hd.sl = 1; hd.donGia = hd.giaTri || 0; changed = true; }
  });
  if (changed) save('thauphu_v1', thauPhuContracts);
}
_migrateHopDongSL();

// [ADDED] Khởi tạo giao diện UI nhập chi tiết
function _initDoanhThuAddons() {
  ['hdc','hdtp'].forEach(prefix => {
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
        <input type="text" id="${prefix}-dongia" placeholder="0" oninput="fmtInputMoney(this); window.${prefix}CalcAuto()">
      </div>
    `;
    giaTriField.insertAdjacentHTML('beforebegin', uiHtml);
    
    const formGrid = giaTriField.parentElement;
    formGrid.insertAdjacentHTML('afterend', `
      <div style="margin-top: 10px; grid-column: 1 / -1;">
        <button type="button" class="btn btn-outline btn-sm" id="${prefix}-btn-chitiet" onclick="window.toggle${prefix}ChiTiet()">📊 Khối lượng chi tiết</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="copyKLCT(this)">📋 Copy</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="pasteKLCT(this)">📥 Paste</button>
        <div id="${prefix}-chitiet-wrap" style="display:none; margin-top: 10px; border: 1px solid var(--line); padding: 10px; border-radius: 6px; background: var(--bg)">
          <div style="overflow-x:auto;">
            <table class="entry-table" style="width:100%; min-width: 500px;">
              <thead>
                <tr>
                  <th style="text-align:left">Tên hạng mục</th>
                  <th style="width:70px;text-align:center">Đơn vị</th> <!-- [ADDED] column donVi -->
                  <th style="width:80px;text-align:center">Khối lượng</th>
                  <th style="width:140px;text-align:right">Đơn giá (đ)</th>
                  <th style="width:150px;text-align:right">Thành tiền (đ)</th>
                  <th style="width:40px"></th>
                </tr>
              </thead>
              <tbody id="${prefix}-chitiet-tbody"></tbody>
            </table>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.add${prefix}ChiTietRow()">+ Thêm dòng</button>
            <div style="font-weight:bold; font-size:13px"><span style="color:var(--ink3)">Tổng chi tiết: </span><span id="${prefix}-chitiet-tong" style="color:var(--gold)">0</span></div>
          </div>
        </div>
      </div>
    `);

    giaTriInput.setAttribute('readonly', 'true');
    giaTriInput.style.background = 'var(--paper)';
    giaTriInput.style.pointerEvents = 'none';
    
    const label = giaTriField.querySelector('label');
    if (label) label.innerHTML += ' <i style="font-weight:normal;color:var(--ink3)">(Tự động)</i>';
  });
}

function updateGlobalTotals(prefix, arr) {
  const grandTotal = calcHopDongValue({ items: arr });
  const tongEl = document.getElementById(`${prefix}-chitiet-tong`);
  if (tongEl) tongEl.textContent = grandTotal ? grandTotal.toLocaleString('vi-VN') : '0';
  
  const wrap = document.getElementById(`${prefix}-chitiet-wrap`);
  if (arr.length === 0) {
    if(wrap) wrap.style.display = 'none';
  } else {
    if(wrap) wrap.style.display = 'block';
  }
  if (prefix === 'hdc' && typeof hdcCalcAuto === 'function') hdcCalcAuto(); 
  else if (prefix === 'hdtp' && typeof hdtpCalcAuto === 'function') hdtpCalcAuto();
}

// Logic events cho bảng chi tiết
window.updateItem = function(prefix, idx, field, val) {
  const arr = prefix === 'hdc' ? _hdcItems : _hdtpItems;
  if (!arr[idx]) return;
  if (field === 'sl' || field === 'donGia') {
    arr[idx][field] = parseFloat(val) || 0;
    const row = document.querySelector(`#${prefix}-chitiet-tbody tr[data-idx="${idx}"]`);
    if (row) {
      const total = (arr[idx].sl || 0) * (arr[idx].donGia || 0);
      const totalTd = row.querySelector('.row-total');
      if (totalTd) totalTd.textContent = total ? total.toLocaleString('vi-VN') : '0';
    }
    updateGlobalTotals(prefix, arr);
  } else {
    arr[idx][field] = val;
  }
};

window.removeItem = function(prefix, idx) {
  const arr = prefix === 'hdc' ? _hdcItems : _hdtpItems;
  arr.splice(idx, 1);
  if (prefix === 'hdc') window.renderhdcChiTiet(); else window.renderhdtpChiTiet();
};

function bindItemsToTable(prefix, getItemsArr) {
  window[`render${prefix}ChiTiet`] = function() {
    const tbody = document.getElementById(`${prefix}-chitiet-tbody`);
    const arr = getItemsArr();
    if (!tbody) return;
    tbody.innerHTML = arr.map((it, i) => {
      const total = (it.sl || 0) * (it.donGia || 0);
      return `<tr data-idx="${i}">
        <td><input type="text" class="bare-input" style="width:100%" value="${x(it.name || '')}" oninput="updateItem('${prefix}', ${i}, 'name', this.value)"></td>
        <td><input type="text" class="bare-input" style="width:100%;text-align:center" placeholder="m2, m3, cái..." value="${x(it.donVi || '')}" oninput="updateItem('${prefix}', ${i}, 'donVi', this.value)"></td> <!-- [ADDED] column donVi -->
        <td><input type="number" class="bare-input" style="width:100%;text-align:center" value="${it.sl!=null ? it.sl : 1}" oninput="updateItem('${prefix}', ${i}, 'sl', this.value)"></td>
        <td><input type="text" class="bare-input" style="width:100%;text-align:right" value="${it.donGia ? parseInt(it.donGia).toLocaleString('vi-VN') : ''}" oninput="fmtInputMoney(this); updateItem('${prefix}', ${i}, 'donGia', this.dataset.raw||0)" data-raw="${it.donGia||0}"></td>
        <td class="row-total" style="text-align:right; font-weight:bold; color:var(--gold)">${total ? total.toLocaleString('vi-VN') : '0'}</td>
        <td style="text-align:center"><button type="button" class="btn btn-outline btn-sm" style="color:var(--red);border:none;padding:2px 6px" onclick="removeItem('${prefix}', ${i})">✕</button></td>
      </tr>`;
    }).join('');
    updateGlobalTotals(prefix, arr);
  };
  
  window[`add${prefix}ChiTietRow`] = function() {
    const arr = getItemsArr();
    arr.push({ name: '', donVi: '', sl: 1, donGia: 0 }); // [ADDED] column donVi
    window[`render${prefix}ChiTiet`]();
  };

  window[`toggle${prefix}ChiTiet`] = function() {
    const wrap = document.getElementById(`${prefix}-chitiet-wrap`);
    if (!wrap) return;
    const arr = getItemsArr();
    if (wrap.style.display === 'none') {
      wrap.style.display = 'block';
      if (arr.length === 0) arr.push({ name: '', donVi: '', sl: 1, donGia: 0 }); // [ADDED] column donVi
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
    const arr = getItemsArr();
    const isDetailed = arr && arr.length > 0;
    const slEl = document.getElementById(`${prefix}-sl`);
    const dgEl = document.getElementById(`${prefix}-dongia`);
    if (!slEl || !dgEl) return;
    
    if (isDetailed) {
      slEl.disabled = true;
      dgEl.disabled = true;
      slEl.style.opacity = '0.5';
      dgEl.style.opacity = '0.5';
    } else {
      slEl.disabled = false;
      dgEl.disabled = false;
      slEl.style.opacity = '1';
      dgEl.style.opacity = '1';
    }
    
    const hd = {
      sl: parseFloat(slEl.value) || 1,
      donGia: _readMoneyInput(`${prefix}-dongia`),
      items: arr
    };
    
    const val = calcHopDongValue(hd);
    const giaTriInput = document.getElementById(`${prefix}-giatri`);
    if (giaTriInput) {
      giaTriInput.dataset.raw = val || 0;
      giaTriInput.value = val ? val.toLocaleString('vi-VN') : '';
    }
    if (prefix === 'hdc') {
      if (typeof hdcUpdateTotal === 'function') hdcUpdateTotal();
    } else {
      if (typeof hdtpUpdateTotal === 'function') hdtpUpdateTotal();
    }
  };
}

bindItemsToTable('hdc', () => _hdcItems);
bindItemsToTable('hdtp', () => _hdtpItems);

// Pagination state cho tab Doanh Thu
let _hdcPage  = 0;
let _hdtpPage = 0;
let _thuPage  = 0;
const DT_PG   = 7;

// CT filter cho sub-tab THỐNG KÊ ('' = tất cả)
let _dtCtFilter = '';

// ── Match record với CT filter hiện tại (dùng projectId → fallback congtrinh) ─
function _dtMatchProjFilter(record) {
  if (!_dtCtFilter) return true;
  if (record.projectId) {
    const proj = getAllProjects().find(p => p.name === _dtCtFilter);
    if (proj) return record.projectId === proj.id;
  }
  return (record.congtrinh || '') === _dtCtFilter;
}

// ── Match hopDongData entry (keyed by projectId or ct name) ────────────────
function _dtMatchHDCFilter(keyId, hd) {
  if (!_dtCtFilter) return true;
  // keyId có thể là projectId (UUID) hoặc tên CT (legacy)
  if (keyId === _dtCtFilter) return true;
  // Tìm project tương ứng với filter
  const filterProj = getAllProjects().find(p => p.name === _dtCtFilter);
  if (filterProj) {
    // keyId là projectId → so trực tiếp
    if (keyId === filterProj.id) return true;
    // hd.projectId fallback
    if (hd.projectId && hd.projectId === filterProj.id) return true;
  }
  // keyId là tên CT (chưa migrate) → so tên
  const keyProj = getAllProjects().find(p => p.id === keyId);
  if (keyProj && keyProj.name === _dtCtFilter) return true;
  return false;
}

// ── Populate CT filter select trong THỐNG KÊ ──────────────────────────────
function dtPopulateCtFilter() {
  ['dt-ct-filter-sel', 'dt-cn-ct-filter-sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = _buildProjFilterOpts(_dtCtFilter, { includeCompany: false, placeholder: '-- Tất cả công trình --' });
  });
}

// ── Áp dụng CT filter và re-render tất cả bảng THỐNG KÊ ───────────────────
function dtSetCtFilter(val) {
  _dtCtFilter = val || '';
  _hdcPage = 0; _hdtpPage = 0; _thuPage = 0;
  renderHdcTable(0);
  renderHdtpTable(0);
  renderThuTable(0);
  renderCongNoThauPhu();
  renderCongNoNhaCungCap();
}

// ══════════════════════════════════════════════════════════════
// [MODULE: DOANH THU — Khai Báo · Thống Kê]
// Ctrl+F → "MODULE: DOANH THU"
// ══════════════════════════════════════════════════════════════

// ── Helper: format input tiền tệ khi gõ ──────────────────────
function fmtInputMoney(el) {
  const raw = el.value.replace(/[^0-9]/g, '');
  el.dataset.raw = raw;
  el.value = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
}

function _readMoneyInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = el.dataset.raw || el.value.replace(/[^0-9]/g, '');
  return parseInt(raw) || 0;
}

// ── Helper: kiểm tra record có thuộc năm đang chọn không ──────
function _dtInYear(ngay) {
  if (!activeYears || activeYears.size === 0) return true;
  if (!ngay) return true; // record cũ không có ngày → hiển thị trong mọi năm
  return inActiveYear(ngay);
}

// ── Helper: render HTML phân trang ────────────────────────────
function _dtPaginationHtml(total, curPage, onClickFn) {
  const pages = Math.ceil(total / DT_PG);
  if (pages <= 1) return '';
  const btns = [];
  if (curPage > 0)
    btns.push(`<button class="sub-nav-btn" onclick="${onClickFn}(${curPage - 1})">‹</button>`);
  for (let i = 0; i < pages; i++) {
    btns.push(`<button class="sub-nav-btn ${i === curPage ? 'active' : ''}" onclick="${onClickFn}(${i})">${i + 1}</button>`);
  }
  if (curPage < pages - 1)
    btns.push(`<button class="sub-nav-btn" onclick="${onClickFn}(${curPage + 1})">›</button>`);
  return btns.join('');
}

// ── Sub-tab navigation trong page-doanhthu ────────────────────
function dtGoSub(btn, id) {
  document.querySelectorAll('#page-doanhthu .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-doanhthu .sub-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
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

// Đảm bảo sub-tab Công Nợ tồn tại (button + page) và di chuyển bảng cũ sang đó
function dtEnsureCongNoSubtab() {
  const page = document.getElementById('page-doanhthu');
  const subNav = page ? page.querySelector('.sub-nav') : null;
  if (!page || !subNav) return;

  // Tạo nút sub-tab nếu chưa có
  if (!document.getElementById('dt-sub-congno-btn')) {
    const btn = document.createElement('button');
    btn.className = 'sub-nav-btn';
    btn.id = 'dt-sub-congno-btn';
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
    cnPage.id = 'dt-sub-congno';
    page.appendChild(cnPage);
  }

  // Filter CT (re-use component)
  if (!document.getElementById('dt-cn-filter-row')) {
    const filterRow = document.createElement('div');
    filterRow.id = 'dt-cn-filter-row';
    filterRow.style = 'margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    filterRow.innerHTML = `
      <label style="font-size:12px;font-weight:600;color:var(--ink3)">Lọc Công Trình:</label>
      <select id="dt-cn-ct-filter-sel" class="filter-sel" style="min-width:220px;max-width:340px"
        onchange="dtSetCtFilter(this.value)">
        <option value="">-- Tất cả công trình --</option>
      </select>`;
    cnPage.appendChild(filterRow);
  }

  // Di chuyển bảng Công Nợ Thầu Phụ từ sub-tab Thống Kê sang đây
  const congnoTbody = document.getElementById('congno-tbody');
  const congnoWrap = congnoTbody ? congnoTbody.closest('.records-wrap') : null;
  const congnoHeader = congnoWrap ? congnoWrap.previousElementSibling : null;
  if (congnoWrap && congnoHeader && congnoHeader.parentElement?.id === 'dt-sub-thongke') {
    cnPage.appendChild(congnoHeader);
    cnPage.appendChild(congnoWrap);
  }

  // Thêm bảng Công Nợ Nhà Cung Cấp (nếu chưa có)
  if (!document.getElementById('congno-ncc-tbody')) {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<div class="section-title"><span class="dot"></span>🟠 Công Nợ Nhà Cung Cấp</div>`;

    const wrap = document.createElement('div');
    wrap.className = 'records-wrap';
    wrap.style = 'margin-bottom:24px';
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

// ── Populate selects trong tab Doanh Thu ─────────────────────
function dtPopulateSels() {
  // CT select: lấy từ projects lọc theo năm — không dùng cats.congTrinh, không có COMPANY
  const projForYear = (typeof getAllProjects === 'function' ? getAllProjects() : [])
    .filter(p => activeYear === 0 || _ctInActiveYear(p.name));
  const ctOpts = '<option value="">-- Chọn công trình --</option>' +
    projForYear.map(p => `<option value="${x(p.name)}">${x(p.name)}</option>`).join('');
  ['hdc-ct-input','thu-ct-input','hdtp-ct-input'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || sel.tagName !== 'SELECT') return;
    const cur = sel.value;
    sel.innerHTML = ctOpts;
    if (cur) sel.value = cur;
  });

  // Thầu phụ select
  const allTp = [...new Set([...cats.thauPhu].filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));
  const tpSel = document.getElementById('hdtp-thauphu');
  if (tpSel && tpSel.tagName === 'SELECT') {
    const cur = tpSel.value;
    tpSel.innerHTML = '<option value="">-- Chọn thầu phụ --</option>' +
      allTp.map(v => `<option value="${x(v)}">${x(v)}</option>`).join('');
    if (cur) tpSel.value = cur;
  }

  // Người TH select (thu form + hdc form)
  const allNguoi = [...new Set([...cats.nguoiTH].filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));
  const nguoiOpts = '<option value="">-- Chọn --</option>' +
    allNguoi.map(v => `<option value="${x(v)}">${x(v)}</option>`).join('');
  ['thu-nguoi','hdc-nguoi'].forEach(id => {
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

// ── Tab Doanh Thu KHÔNG tạo công trình — chỉ tab CÔNG TRÌNH mới được quản lý ──
// _dtAddCT đã bị vô hiệu hóa; nếu user cần thêm CT, phải qua tab CÔNG TRÌNH.
function _dtAddCT(_name) { /* no-op intentional */ }

// ── Thêm thầu phụ mới vào danh mục nếu chưa có ───────────────
function _dtAddTP(_name) { /* no-op intentional */ }

// ══ PHẦN 1: HỢP ĐỒNG CHÍNH ════════════════════════════════════

// ── Cập nhật hiển thị Tổng HĐ Chính khi nhập ─────────────────
function hdcUpdateTotal() {
  const tong = _readMoneyInput('hdc-giatri') + _readMoneyInput('hdc-giatriphu') + _readMoneyInput('hdc-phatsinh');
  const el = document.getElementById('hdc-tong-label');
  if (el) el.textContent = tong ? 'Tổng: ' + fmtM(tong) : '';
}

// ── Lưu / Cập nhật Hợp Đồng Chính ────────────────────────────
function saveHopDongChinh() {
  const ctInput = document.getElementById('hdc-ct-input');
  const ct = ctInput?.value.trim();
  if (!ct) { toast('Vui lòng chọn Công Trình!', 'error'); return; }

  // Chỉ cho phép CT đã tồn tại trong danh sách
  const _projExists = (typeof getAllProjects === 'function') &&
    getAllProjects().some(p => p.id !== 'COMPANY' && p.name === ct);
  if (!_projExists) {
    toast('Chỉ được tạo công trình tại tab Công Trình', 'error');
    return;
  }

  const ngay      = document.getElementById('hdc-ngay')?.value || today();
  const nguoi     = document.getElementById('hdc-nguoi')?.value || '';
  const slEl      = document.getElementById('hdc-sl'); // [ADDED]
  const sl        = slEl && slEl.value !== '' ? parseFloat(slEl.value) : 1; // [ADDED]
  const donGia    = _readMoneyInput('hdc-dongia'); // [ADDED]
  const giaTri    = calcHopDongValue({ sl, donGia, items: _hdcItems }); // [UPDATED]
  const giaTriphu = _readMoneyInput('hdc-giatriphu');
  const phatSinh  = _readMoneyInput('hdc-phatsinh');
  const editId    = document.getElementById('hdc-edit-id')?.value || '';

  _dtAddCT(ct);
  const now = Date.now();
  const _hdcProj = projects.find(p => p.name === ct) || null;
  const _hdcPid  = _hdcProj ? _hdcProj.id : null;

  // Xác định key lưu: ưu tiên projectId, fallback tên CT
  const _hdSaveKey = _hdcPid || ct;

  if (editId) {
    const existing = hopDongData[editId] || {};
    if (editId !== _hdSaveKey) {
      // Đổi CT hoặc key cũ khác key mới: tạo mới + xóa mềm cũ
      hopDongData[_hdSaveKey] = {
        giaTri, giaTriphu, phatSinh, nguoi,
        projectId: _hdcPid, sl, donGia, items: [..._hdcItems], // [UPDATED]
        ngay:      ngay || existing.ngay || today(),
        createdAt: existing.createdAt || now,
        updatedAt: now,
        deletedAt: null
      };
      hopDongData[editId] = { ...existing, deletedAt: now, updatedAt: now };
    } else {
      hopDongData[editId] = { ...existing, giaTri, giaTriphu, phatSinh, nguoi, ngay, projectId: _hdcPid, sl, donGia, items: [..._hdcItems], updatedAt: now }; // [UPDATED]
    }
    toast('✅ Đã cập nhật hợp đồng: ' + ct, 'success');
  } else {
    hopDongData[_hdSaveKey] = {
      giaTri, giaTriphu, phatSinh, nguoi,
      projectId: _hdcPid, sl, donGia, items: [..._hdcItems], // [UPDATED]
      ngay, createdAt: now, updatedAt: now, deletedAt: null
    };
    toast('✅ Đã lưu hợp đồng: ' + ct, 'success');
  }

  save('hopdong_v1', hopDongData);
  _hdcResetForm();
  renderHdcTable(0);
  renderDashboard();
}

function _hdcResetForm() {
  // [ADDED]
  _hdcItems = [];
  const slEl = document.getElementById('hdc-sl');
  const dgEl = document.getElementById('hdc-dongia');
  if(slEl) { slEl.value = '1'; slEl.disabled = false; slEl.style.opacity = '1'; }
  if(dgEl) { dgEl.value = ''; dgEl.dataset.raw = ''; dgEl.disabled = false; dgEl.style.opacity = '1'; }
  if(typeof window.renderhdcChiTiet === 'function') window.renderhdcChiTiet();

  ['hdc-giatri','hdc-giatriphu','hdc-phatsinh'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const ctSel = document.getElementById('hdc-ct-input');
  if (ctSel) ctSel.value = '';
  const nguoiSel = document.getElementById('hdc-nguoi');
  if (nguoiSel) nguoiSel.value = '';
  const ngayEl = document.getElementById('hdc-ngay');
  if (ngayEl) ngayEl.value = today();
  const editEl = document.getElementById('hdc-edit-id');
  if (editEl) editEl.value = '';
  const btn = document.getElementById('hdc-save-btn');
  if (btn) btn.textContent = '💾 Lưu';
  const tong = document.getElementById('hdc-tong-label');
  if (tong) tong.textContent = '';
}

// ── Sửa Hợp Đồng Chính ───────────────────────────────────────
function editHopDongChinh(keyId) {
  const hd = hopDongData[keyId];
  if (!hd) return;

  // Resolve keyId → tên CT để hiển thị trên form
  const projs = (typeof projects !== 'undefined') ? projects : [];
  const p = projs.find(proj => proj.id === keyId);
  const ctName = p ? p.name : keyId;

  // Chuyển sang sub KHAI BÁO
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctSel = document.getElementById('hdc-ct-input');
  if (ctSel) ctSel.value = ctName;
  const ngayEl = document.getElementById('hdc-ngay');
  if (ngayEl) ngayEl.value = hd.ngay || '';
  const nguoiSel = document.getElementById('hdc-nguoi');
  if (nguoiSel) nguoiSel.value = hd.nguoi || '';

  function _setMoney(elemId, val) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.dataset.raw = val || 0;
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
  }
  
  // [ADDED] Load sl, donGia, items
  _hdcItems = Array.isArray(hd.items) ? [...hd.items] : [];
  const slEl = document.getElementById('hdc-sl');
  if (slEl) slEl.value = hd.sl !== undefined ? hd.sl : 1;
  const dG = hd.donGia !== undefined ? hd.donGia : (hd.giaTri || 0);
  _setMoney('hdc-dongia', dG);
  if(typeof window.renderhdcChiTiet === 'function') window.renderhdcChiTiet();
  if(typeof window.hdcCalcAuto === 'function') window.hdcCalcAuto();

  _setMoney('hdc-giatri',    hd.giaTri    || 0);
  _setMoney('hdc-giatriphu', hd.giaTriphu || 0);
  _setMoney('hdc-phatsinh',  hd.phatSinh  || 0);

  const editEl = document.getElementById('hdc-edit-id');
  if (editEl) editEl.value = keyId;
  const btn = document.getElementById('hdc-save-btn');
  if (btn) btn.textContent = '✏️ Cập nhật';

  hdcUpdateTotal();
  document.getElementById('hdc-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Xóa mềm Hợp Đồng Chính ───────────────────────────────────
function delHopDongChinh(keyId) {
  // Resolve tên CT để hiển thị
  const projs = (typeof projects !== 'undefined') ? projects : [];
  const p = projs.find(proj => proj.id === keyId);
  const ctName = p ? p.name : keyId;
  if (!confirm('Xóa hợp đồng của ' + ctName + '?')) return;
  const now = Date.now();
  hopDongData[keyId] = { ...(hopDongData[keyId] || {}), deletedAt: now, updatedAt: now };
  save('hopdong_v1', hopDongData);
  renderHdcTable(_hdcPage);
  renderDashboard();
  toast('Đã xóa hợp đồng: ' + ctName, 'success');
}

// ── Render bảng Hợp Đồng Chính ────────────────────────────────
function renderHdcTable(page) {
  page = page || 0;
  _hdcPage = page;
  const tbody  = document.getElementById('hdc-tbody');
  const empty  = document.getElementById('hdc-empty');
  const pgWrap = document.getElementById('hdc-pagination');
  if (!tbody) return;

  // Resolve keyId → tên CT cho sắp xếp và hiển thị
  const _allProjs = (typeof projects !== 'undefined') ? projects : [];
  const _resolveCtName = (keyId) => {
    const p = _allProjs.find(proj => proj.id === keyId);
    return p ? p.name : keyId;
  };
  const entries = Object.entries(hopDongData)
    .filter(([keyId, v]) => !v.deletedAt && _dtInYear(v.ngay) && _dtMatchHDCFilter(keyId, v))
    .sort((a, b) => _resolveCtName(a[0]).localeCompare(_resolveCtName(b[0]), 'vi'));

  if (!entries.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = entries.length;
  const slice = entries.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(([keyId, hd]) => {
    const ctName = _resolveCtName(keyId);
    const tong = (hd.giaTri || 0) + (hd.giaTriphu || 0) + (hd.phatSinh || 0);
    return `<tr>
      <td style="text-align:center;padding:4px 6px"><input type="checkbox" class="hdc-row-chk" data-id="${x(keyId)}"></td>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${hd.ngay ? (hd.ngay.split('-').length === 3 ? hd.ngay.split('-').reverse().join('-') : hd.ngay) : '—'}</td>
      <td style="font-weight:600;white-space:nowrap">${x(ctName)}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.giaTri ? fmtS(hd.giaTri) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.giaTriphu ? fmtS(hd.giaTriphu) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${hd.phatSinh ? fmtS(hd.phatSinh) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold);white-space:nowrap">${tong ? fmtS(tong) : '—'}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editHopDongChinh(this.dataset.ct)" data-ct="${x(keyId)}">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red)" title="Xóa"
          onclick="delHopDongChinh(this.dataset.ct)" data-ct="${x(keyId)}">✕</button>
      </td>
    </tr>`;
  }).join('');

  if (pgWrap) pgWrap.innerHTML = _dtPaginationHtml(total, page, 'renderHdcTable');
}

// ══ PHẦN 2: GHI NHẬN THU TIỀN ═════════════════════════════════

// ── Lưu / Cập nhật bản ghi thu tiền ─────────────────────────
function saveThuRecord() {
  const ct    = document.getElementById('thu-ct-input')?.value.trim();
  const ngay  = document.getElementById('thu-ngay')?.value;
  const tien  = _readMoneyInput('thu-tien');
  const nguoi = (document.getElementById('thu-nguoi')?.value || '').trim().toUpperCase();
  const nd    = document.getElementById('thu-nd')?.value.trim() || '';
  const editId = document.getElementById('thu-edit-id')?.value || '';

  if (!ct)   { toast('Vui lòng nhập Công Trình!', 'error'); return; }
  if (!ngay) { toast('Vui lòng chọn Ngày!', 'error'); return; }
  if (!tien) { toast('Vui lòng nhập Số Tiền!', 'error'); return; }

  // Chỉ cho phép CT đã tồn tại
  const _thuProjExists = (typeof getAllProjects === 'function') &&
    getAllProjects().some(p => p.id !== 'COMPANY' && p.name === ct);
  if (!_thuProjExists) {
    toast('Chỉ được tạo công trình tại tab Công Trình', 'error');
    return;
  }

  _dtAddCT(ct);
  const now = Date.now();
  const _thuProj = projects.find(p => p.name === ct) || null;
  const _thuPid  = _thuProj ? _thuProj.id : null;

  if (editId) {
    // Cập nhật record hiện có
    const idx = thuRecords.findIndex(r => String(r.id) === String(editId));
    if (idx >= 0) {
      thuRecords[idx] = mkUpdate(thuRecords[idx], { ngay, congtrinh: ct, projectId: _thuPid, tien, nguoi, nd });
    }
    save('thu_v1', thuRecords);
    _thuResetForm();
    renderThuTable(_thuPage);
    renderDashboard();
    toast('✅ Đã cập nhật thu tiền: ' + fmtM(tien) + ' — ' + ct, 'success');
  } else {
    // Tạo mới
    thuRecords.unshift(mkRecord({ ngay, congtrinh: ct, projectId: _thuPid, tien, nguoi, nd }));
    save('thu_v1', thuRecords);

    // Reset form nhẹ: chỉ xóa tiền, người, nội dung — giữ ct và ngày
    const tienEl = document.getElementById('thu-tien');
    if (tienEl) { tienEl.value = ''; tienEl.dataset.raw = ''; }
    const nguoiEl = document.getElementById('thu-nguoi');
    if (nguoiEl) nguoiEl.value = '';
    const ndEl = document.getElementById('thu-nd');
    if (ndEl) ndEl.value = '';

    renderThuTable(0);
    renderDashboard();
    toast('✅ Đã ghi nhận thu ' + fmtM(tien) + ' từ ' + ct, 'success');
  }
}

// ── Sửa bản ghi thu tiền (tải vào form KHAI BÁO) ─────────────
function editThuRecord(id) {
  const r = thuRecords.find(r => String(r.id) === String(id));
  if (!r) return;

  // Chuyển sang sub KHAI BÁO
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  // Điền dữ liệu vào form
  const ctSel = document.getElementById('thu-ct-input');
  if (ctSel) ctSel.value = resolveProjectName(r) || r.congtrinh || ''; // [MODIFIED]
  const ngayEl = document.getElementById('thu-ngay');
  if (ngayEl) ngayEl.value = r.ngay || '';
  const nguoiSel = document.getElementById('thu-nguoi');
  if (nguoiSel) nguoiSel.value = r.nguoi || '';
  const ndEl = document.getElementById('thu-nd');
  if (ndEl) ndEl.value = r.nd || '';

  // Điền tiền
  const tienEl = document.getElementById('thu-tien');
  if (tienEl) {
    tienEl.dataset.raw = r.tien || 0;
    tienEl.value = r.tien ? parseInt(r.tien).toLocaleString('vi-VN') : '';
  }

  // Đặt edit id + đổi nút
  const editEl = document.getElementById('thu-edit-id');
  if (editEl) editEl.value = id;
  const saveBtn = document.getElementById('thu-save-btn');
  if (saveBtn) saveBtn.textContent = '✏️ Cập nhật';
  const cancelBtn = document.getElementById('thu-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = '';

  document.getElementById('thu-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Hủy chỉnh sửa thu tiền ───────────────────────────────────
function _thuCancelEdit() {
  _thuResetForm();
  toast('Đã hủy chỉnh sửa', '');
}

// ── Reset toàn bộ form thu tiền ───────────────────────────────
function _thuResetForm() {
  ['thu-tien','thu-nd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const ctSel = document.getElementById('thu-ct-input');
  if (ctSel) ctSel.value = '';
  const nguoiSel = document.getElementById('thu-nguoi');
  if (nguoiSel) nguoiSel.value = '';
  const ngayEl = document.getElementById('thu-ngay');
  if (ngayEl) ngayEl.value = today();
  const editEl = document.getElementById('thu-edit-id');
  if (editEl) editEl.value = '';
  const saveBtn = document.getElementById('thu-save-btn');
  if (saveBtn) saveBtn.textContent = '+ Ghi nhận Thu';
  const cancelBtn = document.getElementById('thu-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// ── Xóa mềm bản ghi thu tiền ─────────────────────────────────
function delThuRecord(id) {
  if (!confirm('Xóa bản ghi thu tiền này?')) return;
  const idx = thuRecords.findIndex(r => String(r.id) === String(id));
  if (idx < 0) return;
  const now = Date.now();
  thuRecords[idx] = { ...thuRecords[idx], deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
  save('thu_v1', thuRecords);
  renderThuTable(_thuPage);
  renderDashboard();
  toast('Đã xóa bản ghi thu tiền', 'success');
}

// ── Render bảng lịch sử thu ───────────────────────────────────
function renderThuTable(page) {
  if (page === undefined) page = _thuPage;
  _thuPage = page;
  const tbody  = document.getElementById('thu-tbody');
  const empty  = document.getElementById('thu-empty');
  const badge  = document.getElementById('thu-count-badge');
  const pgWrap = document.getElementById('thu-pagination');
  if (!tbody) return;

  const filtered = thuRecords
    .filter(r => !r.deletedAt && inActiveYear(r.ngay) && _dtMatchProjFilter(r))
    .sort((a, b) => b.ngay.localeCompare(a.ngay));

  if (badge) badge.textContent = filtered.length ? `(${filtered.length} đợt)` : '';

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = filtered.length;
  const slice = filtered.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(r => `
    <tr>
      <td style="text-align:center;padding:4px 6px"><input type="checkbox" class="thu-row-chk" data-id="${r.id}"></td>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—'}</td>
      <td style="font-weight:600;white-space:nowrap">${x(_resolveCtName(r))}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green);white-space:nowrap">${fmtM(r.tien)}</td>
      <td style="color:var(--ink2)">${x(r.nguoi || '—')}</td>
      <td style="color:var(--ink3);font-size:12px">${x(r.nd || '—')}</td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--blue)" title="Sửa"
          onclick="editThuRecord('${r.id}')">✏️</button>
      </td>
      <td style="text-align:center;padding:4px 6px">
        <button class="btn btn-outline btn-sm" style="color:var(--red);padding:2px 8px" title="Xóa"
          onclick="delThuRecord('${r.id}')">✕</button>
      </td>
    </tr>`).join('');

  if (pgWrap) pgWrap.innerHTML = _dtPaginationHtml(total, page, 'renderThuTable');
}

// ══ PHẦN 3: HỢP ĐỒNG THẦU PHỤ ════════════════════════════════

// ── Cập nhật hiển thị Tổng HĐ Thầu Phụ khi nhập ─────────────
function hdtpUpdateTotal() {
  const tong = _readMoneyInput('hdtp-giatri') + _readMoneyInput('hdtp-phatsinh');
  const el = document.getElementById('hdtp-tong-label');
  if (el) el.textContent = tong ? 'Tổng: ' + fmtM(tong) : '';
}

// ── Lưu / Cập nhật Hợp Đồng Thầu Phụ ────────────────────────
function saveHopDongThauPhu() {
  const ct = document.getElementById('hdtp-ct-input')?.value.trim();
  const tp = (document.getElementById('hdtp-thauphu')?.value || '').trim();
  if (!ct) { toast('Vui lòng chọn Công Trình!', 'error'); return; }
  if (!tp) { toast('Vui lòng chọn Thầu Phụ!', 'error'); return; }

  // Chỉ cho phép CT đã tồn tại
  const _hdtpProjExists = (typeof getAllProjects === 'function') &&
    getAllProjects().some(p => p.id !== 'COMPANY' && p.name === ct);
  if (!_hdtpProjExists) {
    toast('Chỉ được tạo công trình tại tab Công Trình', 'error');
    return;
  }

  const ngay     = document.getElementById('hdtp-ngay')?.value || today();
  const slEl     = document.getElementById('hdtp-sl'); // [ADDED]
  const sl       = slEl && slEl.value !== '' ? parseFloat(slEl.value) : 1; // [ADDED]
  const donGia   = _readMoneyInput('hdtp-dongia'); // [ADDED]
  const giaTri   = calcHopDongValue({ sl, donGia, items: _hdtpItems }); // [UPDATED]
  const phatSinh = _readMoneyInput('hdtp-phatsinh');
  const nd       = document.getElementById('hdtp-nd')?.value.trim() || '';
  const editId   = document.getElementById('hdtp-edit-id')?.value || '';

  _dtAddCT(ct);
  _dtAddTP(tp);
  const now = Date.now();
  const _hdtpProj = projects.find(p => p.name === ct) || null;
  const _hdtpPid  = _hdtpProj ? _hdtpProj.id : null;

  if (editId) {
    const idx = thauPhuContracts.findIndex(r => r.id === editId);
    if (idx >= 0) {
      thauPhuContracts[idx] = mkUpdate(thauPhuContracts[idx], { ngay, congtrinh: ct, projectId: _hdtpPid, thauphu: tp, giaTri, phatSinh, nd, sl, donGia, items: [..._hdtpItems] }); // [UPDATED]
    }
    toast('✅ Đã cập nhật HĐ thầu phụ', 'success');
  } else {
    thauPhuContracts.unshift(mkRecord({ ngay, congtrinh: ct, projectId: _hdtpPid, thauphu: tp, giaTri, phatSinh, nd, sl, donGia, items: [..._hdtpItems] })); // [UPDATED]
    toast('✅ Đã lưu HĐ thầu phụ: ' + tp + ' — ' + ct, 'success');
  }

  save('thauphu_v1', thauPhuContracts);
  _hdtpResetForm();
  renderHdtpTable(0);
}

function _hdtpResetForm() {
  // [ADDED]
  _hdtpItems = [];
  const slEl = document.getElementById('hdtp-sl');
  const dgEl = document.getElementById('hdtp-dongia');
  if(slEl) { slEl.value = '1'; slEl.disabled = false; slEl.style.opacity = '1'; }
  if(dgEl) { dgEl.value = ''; dgEl.dataset.raw = ''; dgEl.disabled = false; dgEl.style.opacity = '1'; }
  if(typeof window.renderhdtpChiTiet === 'function') window.renderhdtpChiTiet();

  ['hdtp-giatri','hdtp-phatsinh','hdtp-nd'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    if (el.dataset) el.dataset.raw = '';
  });
  const ctSel = document.getElementById('hdtp-ct-input');
  if (ctSel) ctSel.value = '';
  const tpSel = document.getElementById('hdtp-thauphu');
  if (tpSel) tpSel.value = '';
  const ngayEl = document.getElementById('hdtp-ngay');
  if (ngayEl) ngayEl.value = today();
  const editEl = document.getElementById('hdtp-edit-id');
  if (editEl) editEl.value = '';
  const btn = document.getElementById('hdtp-save-btn');
  if (btn) btn.textContent = '💾 Lưu';
  const tong = document.getElementById('hdtp-tong-label');
  if (tong) tong.textContent = '';
}

// ── Sửa Hợp Đồng Thầu Phụ ────────────────────────────────────
function editHopDongThauPhu(id) {
  const r = thauPhuContracts.find(r => r.id === id);
  if (!r) return;

  // Chuyển sang sub KHAI BÁO
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  if (kbBtn) dtGoSub(kbBtn, 'dt-sub-khaibao');

  const ctSel = document.getElementById('hdtp-ct-input');
  if (ctSel) ctSel.value = r.congtrinh || '';
  const tpSel = document.getElementById('hdtp-thauphu');
  if (tpSel) tpSel.value = r.thauphu || '';
  const ngayEl = document.getElementById('hdtp-ngay');
  if (ngayEl) ngayEl.value = r.ngay || '';
  const ndInput = document.getElementById('hdtp-nd');
  if (ndInput) ndInput.value = r.nd || '';

  function _setMoney(elemId, val) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.dataset.raw = val || 0;
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
  }
  
  // [ADDED] Load sl, donGia, items
  _hdtpItems = Array.isArray(r.items) ? [...r.items] : [];
  const slEl = document.getElementById('hdtp-sl');
  if (slEl) slEl.value = r.sl !== undefined ? r.sl : 1;
  const dG = r.donGia !== undefined ? r.donGia : (r.giaTri || 0);
  _setMoney('hdtp-dongia', dG);
  if(typeof window.renderhdtpChiTiet === 'function') window.renderhdtpChiTiet();
  if(typeof window.hdtpCalcAuto === 'function') window.hdtpCalcAuto();

  _setMoney('hdtp-giatri',   r.giaTri   || 0);
  _setMoney('hdtp-phatsinh', r.phatSinh || 0);

  const editEl = document.getElementById('hdtp-edit-id');
  if (editEl) editEl.value = id;
  const btn = document.getElementById('hdtp-save-btn');
  if (btn) btn.textContent = '✏️ Cập nhật';

  hdtpUpdateTotal();
  document.getElementById('hdtp-ct-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Xóa mềm Hợp Đồng Thầu Phụ ────────────────────────────────
function delHopDongThauPhu(id) {
  if (!confirm('Xóa hợp đồng thầu phụ này?')) return;
  const idx = thauPhuContracts.findIndex(r => r.id === id);
  if (idx < 0) return;
  const now = Date.now();
  thauPhuContracts[idx] = { ...thauPhuContracts[idx], deletedAt: now, updatedAt: now };
  save('thauphu_v1', thauPhuContracts);
  renderHdtpTable(_hdtpPage);
  toast('Đã xóa hợp đồng thầu phụ', 'success');
}

// ── Render bảng Hợp Đồng Thầu Phụ ────────────────────────────
function renderHdtpTable(page) {
  page = page || 0;
  _hdtpPage = page;
  const tbody  = document.getElementById('hdtp-tbody');
  const empty  = document.getElementById('hdtp-empty');
  const pgWrap = document.getElementById('hdtp-pagination');
  if (!tbody) return;

  const filtered = thauPhuContracts
    .filter(r => !r.deletedAt && _dtInYear(r.ngay) && _dtMatchProjFilter(r))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    if (pgWrap) pgWrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const total = filtered.length;
  const slice = filtered.slice(page * DT_PG, (page + 1) * DT_PG);

  tbody.innerHTML = slice.map(r => {
    const tong = (r.giaTri || 0) + (r.phatSinh || 0);
    return `<tr>
      <td style="text-align:center;padding:4px 6px"><input type="checkbox" class="hdtp-row-chk" data-id="${r.id}"></td>
      <td style="white-space:nowrap;color:var(--ink3);font-size:12px">${r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—'}</td>
      <td style="font-weight:600;white-space:nowrap">${x(_resolveCtName(r))}</td>
      <td style="white-space:nowrap">${x(r.thauphu)}</td>
      <td style="color:var(--ink3);font-size:12px;min-width:90px">${x(r.nd || '—')}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${r.giaTri ? fmtS(r.giaTri) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">${r.phatSinh ? fmtS(r.phatSinh) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold);white-space:nowrap">${tong ? fmtS(tong) : '—'}</td>
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

  if (pgWrap) pgWrap.innerHTML = _dtPaginationHtml(total, page, 'renderHdtpTable');
}

// ══ BẢNG CÔNG NỢ THẦU PHỤ ════════════════════════════════════

// ── Render bảng Công Nợ Thầu Phụ ─────────────────────────────
function renderCongNoThauPhu() {
  const tbody = document.getElementById('congno-tbody');
  const empty = document.getElementById('congno-empty');
  if (!tbody) return;

  // Gom nhóm theo key (thauphu ||| congtrinh)
  const map = {}; // key → { thauphu, congtrinh, tongUng, count, tongHD }

  // Nguồn 1: tiền ứng thầu phụ (ungRecords loai='thauphu')
  ungRecords
    .filter(r =>
      r.loai === 'thauphu' &&
      !r.deletedAt &&
      inActiveYear(r.ngay) &&
      _dtMatchProjFilter(r)
    )
    .forEach(r => {
      const ctDisplay = _resolveCtName(r);
      const key = (r.tp || '') + '|||' + ctDisplay;
      if (!map[key]) map[key] = { thauphu: r.tp || '', congtrinh: ctDisplay, tongUng: 0, count: 0, tongHD: 0 };
      map[key].tongUng += (r.tien || 0);
      map[key].count++;
    });

  // Nguồn 2: hợp đồng thầu phụ (thauPhuContracts)
  thauPhuContracts
    .filter(r => !r.deletedAt && _dtInYear(r.ngay) && _dtMatchProjFilter(r))
    .forEach(r => {
      const ctDisplay = _resolveCtName(r);
      const key = (r.thauphu || '') + '|||' + ctDisplay;
      if (!map[key]) map[key] = { thauphu: r.thauphu || '', congtrinh: ctDisplay, tongUng: 0, count: 0, tongHD: 0 };
      map[key].tongHD += (r.giaTri || 0) + (r.phatSinh || 0);
    });

  const rows = Object.values(map)
    .map(r => ({ ...r, name: r.thauphu }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.congtrinh.localeCompare(b.congtrinh, 'vi'));

  _renderCongNoTable(rows, tbody, empty);
}

function _renderCongNoTable(rows, tbody, empty) {
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  let totUng = 0, totHD = 0, totConlai = 0;

  const dataRows = rows.map(row => {
    const conlai = (row.tongHD || 0) - (row.tongUng || 0);
    totUng    += row.tongUng || 0;
    totHD     += row.tongHD || 0;
    totConlai += conlai;
    const overdrawn    = (row.tongUng || 0) > (row.tongHD || 0) && (row.tongHD || 0) > 0;
    const conlaiStyle  = overdrawn
      ? 'color:var(--red);font-weight:700'
      : (conlai === 0 ? 'color:var(--ink3)' : '');
    const countLabel   = row.count > 0
      ? `<span style="color:var(--ink3);font-size:11px;margin-left:3px">(${row.count})</span>`
      : '';
    return `<tr>
      <td style="font-weight:600;white-space:nowrap">${x(row.name)}</td>
      <td style="white-space:nowrap">${x(row.congtrinh || '—')}</td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">
        ${row.tongUng ? fmtS(row.tongUng) : '<span style="color:var(--ink3)">—</span>'}${countLabel}
      </td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap">
        ${row.tongHD ? fmtS(row.tongHD) : '<span style="color:var(--ink3)">—</span>'}
      </td>
      <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;${conlaiStyle}">
        ${fmtS(conlai)}
      </td>
    </tr>`;
  }).join('');

  const footerConlaiStyle = totUng > totHD && totHD > 0 ? 'color:var(--red)' : '';
  const footerRow = `<tr style="border-top:2px solid var(--line);font-weight:700;background:var(--panel)">
    <td colspan="2" style="padding:8px 12px;color:var(--ink2)">Tổng cộng</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding:8px 10px">${fmtS(totUng)}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding:8px 10px">${fmtS(totHD)}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;white-space:nowrap;padding:8px 10px;${footerConlaiStyle}">${fmtS(totConlai)}</td>
  </tr>`;

  tbody.innerHTML = dataRows + footerRow;
}

// ── Render bảng Công Nợ Nhà Cung Cấp ─────────────────────────
function renderCongNoNhaCungCap() {
  const tbody = document.getElementById('congno-ncc-tbody');
  const empty = document.getElementById('congno-ncc-empty');
  if (!tbody) return;

  const selProjId = (() => {
    if (!_dtCtFilter) return null;
    const p = getAllProjects().find(prj => prj.name === _dtCtFilter);
    return p ? p.id : null;
  })();

  const nccFromUng = new Set(
    ungRecords
      .filter(r =>
        r.loai === 'nhacungcap' &&
        !r.deletedAt &&
        inActiveYear(r.ngay)
      )
      .map(r => (r.tp || '').trim())
      .filter(Boolean)
  );

  const nccList = (typeof cats !== 'undefined' && cats.nhaCungCap) ? cats.nhaCungCap : [];
  const rows = [];
  let totUng = 0, totTien = 0, totCon = 0;

  nccList
    .filter(ncc => nccFromUng.has(ncc))
    .forEach(ncc => {
    let tongUng = 0, tongTien = 0;
    const ctSet = new Set();

    ungRecords
      .filter(r =>
        r.loai === 'nhacungcap' &&
        (r.tp || '') === ncc &&
        !r.deletedAt &&
        inActiveYear(r.ngay) &&
        (!selProjId || r.projectId === selProjId)
      )
      .forEach(r => { tongUng += (r.tien || 0); });

    getInvoicesCached()
      .filter(inv =>
        !inv.deletedAt &&
        inActiveYear(inv.ngay) &&
        (inv.ncc || '') === ncc &&
        (!selProjId || inv.projectId === selProjId)
      )
      .forEach(inv => {
        const proj = inv.projectId ? getProjectById(inv.projectId) : null;
        if (proj && proj.status === 'closed') return;
        const amt = inv.thanhtien || inv.tien || 0;
        tongTien += amt;
      });

    ungRecords
      .filter(r =>
        r.loai === 'nhacungcap' &&
        (r.tp || '') === ncc &&
        !r.deletedAt &&
        inActiveYear(r.ngay) &&
        (!selProjId || r.projectId === selProjId)
      )
      .forEach(r => {
        const proj = r.projectId ? getProjectById(r.projectId) : null;
        if (proj && proj.status === 'closed') return;
        const ctName = resolveProjectName(r) || ''; // [MODIFIED]
        if (ctName) ctSet.add(ctName);
      });

    if (tongUng === 0 && tongTien === 0 && ctSet.size === 0) return;

    const conPhaiTT = tongTien - tongUng;
    totUng += tongUng; totTien += tongTien; totCon += conPhaiTT;
    rows.push({
      name: ncc,
      congtrinh: Array.from(ctSet).join(', '),
      tongUng,
      tongHD: tongTien,
      conPhaiTT,
      count: 0
    });
    });

  rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  _renderCongNoTable(rows, tbody, empty);
}

// ══ BẢNG LÃI/LỖ (Dashboard) ═══════════════════════════════════

// ── Render bảng Lãi/Lỗ trong Dashboard ───────────────────────
function renderLaiLo() {
  const wrap = document.getElementById('db-lailo-wrap');
  if (!wrap) return;

  // Tổng chi theo CT trong năm đang chọn
  const tongChi = {};
  getInvoicesCached().filter(i => inActiveYear(i.ngay)).forEach(i => {
    const ct = resolveProjectName(i) || '(Không rõ)';
    tongChi[ct] = (tongChi[ct] || 0) + (i.thanhtien || i.tien || 0);
  });

  // Tổng đã thu theo CT trong năm đang chọn
  const daThu = {};
  thuRecords.filter(r => !r.deletedAt && inActiveYear(r.ngay)).forEach(r => {
    const ct = resolveProjectName(r) || '';
    daThu[ct] = (daThu[ct] || 0) + (r.tien || 0);
  });

  // Hợp đồng theo CT (từ hopDongData — bỏ qua soft-deleted, lọc theo năm)
  // Key có thể là projectId (UUID) hoặc tên CT (legacy) → resolve sang tên cho hiển thị
  const hdByCT = {};
  const _llProjs = (typeof projects !== 'undefined') ? projects : [];
  Object.entries(hopDongData).filter(([, v]) => !v.deletedAt && _dtInYear(v.ngay)).forEach(([keyId, hd]) => {
    const p = _llProjs.find(proj => proj.id === keyId);
    const ctName = p ? p.name : keyId;
    hdByCT[ctName] = {
      giaTri:    hd.giaTri    || 0,
      giaTriphu: hd.giaTriphu || 0,
      phatSinh:  hd.phatSinh  || 0,
    };
  });

  // Gộp tất cả CT
  const allCts = [...new Set([
    ...Object.keys(tongChi),
    ...Object.keys(hdByCT)
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));

  if (!allCts.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có dữ liệu</div>';
    return;
  }

  let tongHD = 0, tongHDPhu = 0, tongPS = 0, tongDT = 0, tongChi_ = 0, tongThu = 0;

  const rows = allCts.map(ct => {
    const hd       = hdByCT[ct] || {};
    const giaTri   = hd.giaTri    || 0;
    const giaTriphu= hd.giaTriphu || 0;
    const phatSinh = hd.phatSinh  || 0;
    const tongDTct = giaTri + giaTriphu + phatSinh;
    const chi      = tongChi[ct] || 0;
    const thu      = daThu[ct]   || 0;
    const conPhaiThu = tongDTct - thu;
    const laiLo    = tongDTct - chi;
    const llClass  = laiLo > 0 ? 'll-pos' : laiLo < 0 ? 'll-neg' : 'll-zero';
    const llPrefix = laiLo > 0 ? '+' : '';

    tongHD    += giaTri;
    tongHDPhu += giaTriphu;
    tongPS    += phatSinh;
    tongDT    += tongDTct;
    tongChi_  += chi;
    tongThu   += thu;

    return `<tr>
      <td>${x(ct)}</td>
      <td>${giaTri    ? fmtS(giaTri)    : '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${giaTriphu ? fmtS(giaTriphu) : '<span style="color:var(--ink3)">—</span>'}</td>
      <td>${phatSinh  ? fmtS(phatSinh)  : '<span style="color:var(--ink3)">—</span>'}</td>
      <td style="font-weight:600">${tongDTct ? fmtS(tongDTct) : '—'}</td>
      <td style="color:var(--red)">${fmtS(chi)}</td>
      <td style="color:var(--green)">${thu ? fmtS(thu) : '—'}</td>
      <td>${tongDTct ? fmtS(conPhaiThu) : '—'}</td>
      <td class="${llClass}">${tongDTct ? llPrefix + fmtS(laiLo) : '—'}</td>
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
            <td>${fmtS(tongHD)}</td>
            <td>${fmtS(tongHDPhu)}</td>
            <td>${fmtS(tongPS)}</td>
            <td style="font-weight:700">${fmtS(tongDT)}</td>
            <td style="color:var(--red);font-weight:700">${fmtS(tongChi_)}</td>
            <td style="color:var(--green);font-weight:700">${fmtS(tongThu)}</td>
            <td>${fmtS(tongDT - tongThu)}</td>
            <td class="${tongLLClass}">${tongDT ? (tongLaiLo >= 0 ? '+' : '') + fmtS(tongLaiLo) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── Init tab Doanh Thu khi mở ─────────────────────────────────
function initDoanhThu() {
  // Reload dữ liệu mới nhất từ _mem (đã được dbInit() populate từ IDB)
  hopDongData      = load('hopdong_v1', {});
  thauPhuContracts = load('thauphu_v1', []);

  _initDoanhThuAddons(); // [ADDED]


  dtEnsureCongNoSubtab();
  dtPopulateSels();
  dtPopulateCtFilter();

  // Set ngày mặc định = hôm nay nếu chưa có
  const ngayEl = document.getElementById('thu-ngay');
  if (ngayEl && !ngayEl.value) ngayEl.value = today();
  const hdcNgayEl = document.getElementById('hdc-ngay');
  if (hdcNgayEl && !hdcNgayEl.value) hdcNgayEl.value = today();
  const hdtpNgayEl = document.getElementById('hdtp-ngay');
  if (hdtpNgayEl && !hdtpNgayEl.value) hdtpNgayEl.value = today();

  // Đảm bảo KHAI BÁO là sub-tab active mặc định
  const kbBtn = document.getElementById('dt-sub-khaibao-btn');
  const kbPage = document.getElementById('dt-sub-khaibao');
  const tkBtn  = document.getElementById('dt-sub-thongke-btn');
  const tkPage = document.getElementById('dt-sub-thongke');
  const cnBtn  = document.getElementById('dt-sub-congno-btn');
  const cnPage = document.getElementById('dt-sub-congno');
  document.querySelectorAll('#page-doanhthu .sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-doanhthu .sub-nav-btn').forEach(b => b.classList.remove('active'));
  if (kbBtn && kbPage) { kbPage.classList.add('active'); kbBtn.classList.add('active'); }
  if (tkPage) tkPage.classList.remove('active');
  if (tkBtn) tkBtn.classList.remove('active');
  if (cnPage) cnPage.classList.remove('active');
  if (cnBtn) cnBtn.classList.remove('active');

  // Reset edit state
  _hdcResetForm();
  _hdtpResetForm();
}

// Cấp ra global theo yêu cầu
window.initDoanhThu = initDoanhThu;
window.dtGoSub = dtGoSub;

// ── Backward compat: hàm cũ được giữ lại để tránh crash ──────
function saveHopDong()        { saveHopDongChinh(); }
function hdLoadCT()           { /* deprecated */ }
function renderHopDongList()  { renderHdcTable(_hdcPage); }
function delHopDong(ct)       { delHopDongChinh(ct); }

// [ADDED COPY KLCT]
function copyKLCT(btn) {
  try {
    const container = btn.closest('.section, .card, .block') || btn.parentElement; 
    const tbody = container.querySelector('tbody');
    if (!tbody) { toast('Không tìm thấy bảng dữ liệu', 'error'); return; }
    
    const rows = tbody.querySelectorAll('tr');
    const data = [];

    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length < 4) return;

      const row = {
        ten: inputs[0]?.value || '',
        donvi: inputs[1]?.value || '',
        khoiluong: inputs[2]?.value || '',
        dongia: (inputs[3]?.dataset?.raw || inputs[3]?.value || '').toString().replace(/[^0-9]/g, '')
      };

      if (row.ten || row.khoiluong || row.dongia) {
        data.push(row);
      }
    });

    if (!data.length) {
      toast('Không có dữ liệu để copy', 'error');
      return;
    }

    localStorage.setItem('klct_clipboard', JSON.stringify(data));
    
    // Highlight button
    const oldBg = btn.style.background;
    btn.style.background = '#e8f0fb';
    setTimeout(() => { btn.style.background = oldBg; }, 1000);

    toast('✅ Đã copy khối lượng chi tiết');
  } catch (e) {
    console.error(e);
    toast('❌ Copy thất bại', 'error');
  }
}

function pasteKLCT(btn) {
  try {
    const raw = localStorage.getItem('klct_clipboard');
    if (!raw) {
      toast('Chưa có dữ liệu copy', 'error');
      return;
    }
    const data = JSON.parse(raw);
    const container = btn.closest('.section, .card, .block') || btn.parentElement;
    const tbody = container.querySelector('tbody');
    if (!tbody) return;

    // Detect prefix from tbody ID
    const prefix = tbody.id.split('-')[0]; // hdc or hdtp
    const arr = prefix === 'hdc' ? _hdcItems : _hdtpItems;

    if (arr.length > 0 && !confirm('Bạn có muốn ghi đè dữ liệu chi tiết hiện có không?')) {
      return;
    }

    arr.length = 0;
    data.forEach(row => {
      arr.push({
        name: row.ten || '',
        donVi: row.donvi || '',
        sl: parseFloat(row.khoiluong) || 0,
        donGia: parseFloat(row.dongia) || 0
      });
    });

    if (window['render' + prefix + 'ChiTiet']) window['render' + prefix + 'ChiTiet']();
    if (window[prefix + 'CalcAuto'] ) window[prefix + 'CalcAuto']();

    // Auto scroll down to the table
    tbody.scrollIntoView({ behavior: 'smooth', block: 'end' });

    toast('📥 Đã dán khối lượng chi tiết');
  } catch (e) {
    console.error(e);
    toast('❌ Paste lỗi', 'error');
  }
}

function exportHdcToImage() {
  const checked = [...document.querySelectorAll('.hdc-row-chk:checked')];
  if (!checked.length) { toast('⚠️ Vui lòng tick chọn ít nhất 1 hợp đồng!', 'error'); return; }
  if (checked.length > 1) { toast('⚠️ Chỉ chọn 1 hợp đồng để xuất phiếu!', 'error'); return; }

  const keyId = checked[0].dataset.id;
  const hd = hopDongData[keyId];
  if (!hd) return;

  const ctName = projects.find(p => p.id === keyId)?.name || keyId;
  const total = (hd.giaTri || 0) + (hd.giaTriphu || 0) + (hd.phatSinh || 0);

  document.getElementById('phdc-ct-name').textContent = ctName;
  document.getElementById('phdc-ct-label').textContent = ctName;
  document.getElementById('phdc-date').textContent = hd.ngay || today();
  document.getElementById('phdc-nguoi').textContent = hd.nguoi || '—';
  document.getElementById('phdc-giatri').textContent = numFmt(hd.giaTri || 0) + ' đ';
  document.getElementById('phdc-phatsinh').textContent = numFmt((hd.giaTriphu || 0) + (hd.phatSinh || 0)) + ' đ';
  document.getElementById('phdc-tong').textContent = numFmt(total) + ' đ';

  const items = Array.isArray(hd.items) ? hd.items : [];
  let totalDetail = 0;
  document.getElementById('phdc-tbody').innerHTML = items.map(it => {
    const st = (it.sl || 0) * (it.donGia || 0);
    totalDetail += st;
    return `<tr>
      <td style="padding:8px 10px; border:1px solid #1a1814;">${x(it.name)}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:center;">${x(it.donVi || '—')}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:center;">${it.sl || 0}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:right;">${numFmt(it.donGia || 0)}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:right; font-weight:700;">${numFmt(st)}</td>
    </tr>`;
  }).join('');
  document.getElementById('phdc-total-detail').textContent = numFmt(totalDetail) + ' đ';

  const tpl = document.getElementById('hdchinh-template');
  tpl.style.display = 'block';
  toast('⏳ Đang tạo phiếu HĐ Công ty...', 'info');

  html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 800 }).then(canvas => {
    tpl.style.display = 'none';
    const link = document.createElement('a');
    link.download = 'HDChinh_' + removeVietnameseTones(ctName) + '_' + today() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('✅ Đã xuất phiếu HĐ Công ty!', 'success');
  }).catch(err => { tpl.style.display = 'none'; toast('❌ Lỗi: ' + err.message, 'error'); });
}

function exportHdtpToImage() {
  const checked = [...document.querySelectorAll('.hdtp-row-chk:checked')];
  if (!checked.length) { toast('⚠️ Vui lòng tick chọn ít nhất 1 HĐ thầu phụ!', 'error'); return; }
  if (checked.length > 1) { toast('⚠️ Chỉ chọn 1 HĐ thầu phụ để xuất phiếu!', 'error'); return; }

  const id = checked[0].dataset.id;
  const r = thauPhuContracts.find(c => c.id === id);
  if (!r) return;

  const ctName = _resolveCtName(r);
  const total = (r.giaTri || 0) + (r.phatSinh || 0);

  document.getElementById('phdtp-ct-name').textContent = ctName;
  document.getElementById('phdtp-ct-label').textContent = ctName;
  document.getElementById('phdtp-date').textContent = r.ngay || today();
  document.getElementById('phdtp-thauphu').textContent = r.thauphu || '—';
  document.getElementById('phdtp-nd').textContent = r.nd || '—';
  document.getElementById('phdtp-giatri').textContent = numFmt(r.giaTri || 0) + ' đ';
  document.getElementById('phdtp-phatsinh').textContent = numFmt(r.phatSinh || 0) + ' đ';
  document.getElementById('phdtp-tong').textContent = numFmt(total) + ' đ';

  const items = Array.isArray(r.items) ? r.items : [];
  let totalDetail = 0;
  document.getElementById('phdtp-tbody').innerHTML = items.map(it => {
    const st = (it.sl || 0) * (it.donGia || 0);
    totalDetail += st;
    return `<tr>
      <td style="padding:8px 10px; border:1px solid #1a1814;">${x(it.name)}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:center;">${x(it.donVi || '—')}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:center;">${it.sl || 0}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:right;">${numFmt(it.donGia || 0)}</td>
      <td style="padding:8px 10px; border:1px solid #1a1814; text-align:right; font-weight:700;">${numFmt(st)}</td>
    </tr>`;
  }).join('');
  document.getElementById('phdtp-total-detail').textContent = numFmt(totalDetail) + ' đ';

  const tpl = document.getElementById('hdthauphu-template');
  tpl.style.display = 'block';
  toast('⏳ Đang tạo phiếu HĐ Thầu phụ...', 'info');

  html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 800 }).then(canvas => {
    tpl.style.display = 'none';
    const link = document.createElement('a');
    link.download = 'HDThauPhu_' + removeVietnameseTones(ctName) + '_' + removeVietnameseTones(r.thauphu||'') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('✅ Đã xuất phiếu HĐ Thầu phụ!', 'success');
  }).catch(err => { tpl.style.display = 'none'; toast('❌ Lỗi: ' + err.message, 'error'); });
}

function exportThuToImage() {
  const checked = [...document.querySelectorAll('.thu-row-chk:checked')];
  if (!checked.length) { toast('⚠️ Vui lòng tick chọn ít nhất 1 lần thu tiền!', 'error'); return; }
  if (checked.length > 1) { toast('⚠️ Hiện tại chỉ hỗ trợ xuất phiếu thu cho từng đợt lẻ!', 'error'); return; }

  const id = checked[0].dataset.id;
  const r = thuRecords.find(t => t.id === id);
  if (!r) return;

  const ctName = _resolveCtName(r);

  document.getElementById('ppt-ct-name').textContent = ctName;
  document.getElementById('ppt-ct-label').textContent = ctName;
  document.getElementById('ppt-date').textContent = r.ngay || today();
  document.getElementById('ppt-nguoi').textContent = r.nguoi || '—';
  document.getElementById('ppt-tien').textContent = numFmt(r.tien || 0) + ' đ';
  document.getElementById('ppt-nd').textContent = r.nd || '—';

  const tpl = document.getElementById('phieuthu-template');
  tpl.style.display = 'block';
  toast('⏳ Đang tạo phiếu thu tiền...', 'info');

  html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 680 }).then(canvas => {
    tpl.style.display = 'none';
    const link = document.createElement('a');
    link.download = 'PhieuThu_' + removeVietnameseTones(ctName) + '_' + r.ngay + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('✅ Đã xuất phiếu thu tiền!', 'success');
  }).catch(err => { tpl.style.display = 'none'; toast('❌ Lỗi: ' + err.message, 'error'); });
}
