// hoadon.js — Hoa Don Chi Phi (Invoice CRUD)
// Load order: 3

// ══════════════════════════════
//  ENTRY TABLE
// ══════════════════════════════
function initTable(n=10) {
  document.getElementById('entry-tbody').innerHTML='';
  for(let i=0;i<n;i++) addRow();
  calcSummary();
}

function addRows(n) { for(let i=0;i<n;i++) addRow(); }

// Rebuild tất cả dropdowns trong bảng nhập nhanh và form chi tiết
// Gọi khi danh mục hoặc công trình thay đổi (realtime, không reload)
function refreshEntryDropdowns() {
  // Helper nội bộ: dedup + sort (dùng _dedupCatArr nếu danhmuc.js đã load, fallback nếu chưa)
  const _dd = arr => typeof _dedupCatArr === 'function'
    ? _dedupCatArr(arr)
    : [...arr].filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi'));
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loaiSel  = tr.querySelector('[data-f="loai"]');
    const ctSel    = tr.querySelector('[data-f="ct"]');
    const nguoiSel = tr.querySelector('[data-f="nguoi"]');
    const nccSel   = tr.querySelector('[data-f="ncc"]');
    if(loaiSel) {
      const v = loaiSel.value;
      loaiSel.innerHTML = '<option value="">-- Chọn --</option>' +
        _dd(cats.loaiChiPhi).map(c=>`<option value="${x(c)}" ${c===v?'selected':''}>${x(c)}</option>`).join('');
    }
    if(ctSel) {
      const v = ctSel.value;
      ctSel.innerHTML = _buildProjOpts(v, '-- Chọn --');
    }
    if(nguoiSel) {
      const v = nguoiSel.value;
      nguoiSel.innerHTML = '<option value="">-- Chọn --</option>' +
        _dd(cats.nguoiTH).map(c=>`<option value="${x(c)}" ${c===v?'selected':''}>${x(c)}</option>`).join('');
    }
    if(nccSel) {
      const v = nccSel.value;
      nccSel.innerHTML = '<option value="">-- Chọn --</option>' +
        _dd(cats.nhaCungCap).map(c=>`<option value="${x(c)}" ${c===v?'selected':''}>${x(c)}</option>`).join('');
    }
  });
  if(typeof _initDetailFormSelects === 'function') _initDetailFormSelects();
}

function addRow(d={}) {
  const tbody = document.getElementById('entry-tbody');
  // PHẦN 6: copy loai/CT từ dòng trên nếu không có dữ liệu truyền vào
  if(!d.loai && !d.congtrinh) {
    const lastRow = tbody.querySelector('tr:last-child');
    if(lastRow) {
      const prevLoai = lastRow.querySelector('[data-f="loai"]')?.value || '';
      const prevCt   = lastRow.querySelector('[data-f="ct"]')?.value   || '';
      if(prevLoai || prevCt) d = { ...d, loai: prevLoai, congtrinh: prevCt };
    }
  }
  const num = tbody.children.length + 1;
  const ctDef = d.congtrinh || '';

  const tr = document.createElement('tr');

  // Dùng _dedupCatArr (từ danhmuc.js) để loại rỗng + trùng normalizeKey + sort tiếng Việt
  const _dd = arr => typeof _dedupCatArr === 'function'
    ? _dedupCatArr(arr)
    : [...arr].filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi'));
  const loaiOpts  = `<option value="">-- Chọn --</option>` + _dd(cats.loaiChiPhi).map(v=>`<option value="${x(v)}" ${v===(d.loai||'')?'selected':''}>${x(v)}</option>`).join('');
  const ctOpts    = _buildProjOpts(ctDef, '-- Chọn --');
  const nguoiOpts = `<option value="">-- Chọn --</option>` + _dd(cats.nguoiTH).map(v=>`<option value="${x(v)}" ${v===(d.nguoi||'')?'selected':''}>${x(v)}</option>`).join('');
  const nccOpts   = `<option value="">-- Chọn --</option>` + _dd(cats.nhaCungCap).map(v=>`<option value="${x(v)}" ${v===(d.ncc||'')?'selected':''}>${x(v)}</option>`).join('');

  tr.innerHTML = `
    <td class="row-num">${num}</td>
    <td><select class="cell-input" data-f="loai">${loaiOpts}</select></td>
    <td><select class="cell-input" data-f="ct">${ctOpts}</select></td>
    <td><input class="cell-input right tien-input" data-f="tien" data-raw="${d.tien||''}" placeholder="0" value="${d.tien?numFmt(d.tien):''}" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="nd" value="${x(d.nd||'')}" placeholder="Nội dung..."></td>
    <td><select class="cell-input" data-f="nguoi">${nguoiOpts}</select></td>
    <td><select class="cell-input" data-f="ncc">${nccOpts}</select></td>
    <td><button class="del-btn" onclick="delRow(this)">✕</button></td>
  `;

  // Thousand-separator logic for tien input
  const tienInput = tr.querySelector('[data-f="tien"]');
  tienInput.addEventListener('input', function() {
    const raw = this.value.replace(/[.,]/g,'');
    this.dataset.raw = raw;
    if(raw) this.value = numFmt(parseInt(raw,10)||0);
    calcSummary();
  });
  tienInput.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  tienInput.addEventListener('blur', function() {
    const raw = parseInt(this.dataset.raw||'0',10)||0;
    this.value = raw ? numFmt(raw) : '';
  });

  tr.querySelectorAll('input,select').forEach(el => {
    if(el.dataset.f!=='tien') {
      el.addEventListener('input', calcSummary);
      el.addEventListener('change', calcSummary);
    }
  });

  // PHẦN 5: Enter key → nhảy xuống dòng dưới (chỉ áp dụng cho input)
  const entryInputs = [...tr.querySelectorAll('input')];
  entryInputs.forEach(inp => {
    inp.addEventListener('keydown', function(e) {
      if(e.key !== 'Enter') return;
      e.preventDefault();
      const allRows = [...document.querySelectorAll('#entry-tbody tr')];
      const curIdx  = allRows.indexOf(tr);
      const colIdx  = entryInputs.indexOf(this);
      let targetRow;
      if(curIdx < allRows.length - 1) {
        targetRow = allRows[curIdx + 1];
      } else {
        addRows(1);
        targetRow = [...document.querySelectorAll('#entry-tbody tr')][curIdx + 1];
      }
      if(targetRow) {
        const targets = [...targetRow.querySelectorAll('input')];
        (targets[colIdx] || targets[0])?.focus();
      }
    });
  });

  tbody.appendChild(tr);

  // Orphaned CT: nếu ctDef không khớp với bất kỳ option nào → thêm option tạm
  if (ctDef) {
    const ctSel = tr.querySelector('[data-f="ct"]');
    if (ctSel && !ctSel.value) {
      const orphan = document.createElement('option');
      orphan.value = ctDef;
      orphan.textContent = ctDef + ' (*)';
      if (d.projectId) orphan.dataset.pid = d.projectId;
      ctSel.appendChild(orphan);
      ctSel.value = ctDef;
    }
  }
}

function delRow(btn) { btn.closest('tr').remove(); renumber(); calcSummary(); }

function renumber() {
  document.querySelectorAll('#entry-tbody tr').forEach((tr,i) => {
    tr.querySelector('.row-num').textContent = i+1;
  });
}

function calcSummary() {
  let cnt=0, total=0;
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai = tr.querySelector('[data-f="loai"]')?.value||'';
    const ct   = tr.querySelector('[data-f="ct"]')?.value||'';
    const tienRaw = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(loai||ct||tienRaw>0) { cnt++; total += tienRaw; }
  });
  document.getElementById('row-count').textContent = cnt;
  document.getElementById('entry-total').textContent = fmtM(total);
}

function clearTable() {
  if(!confirm('Xóa toàn bộ bảng nhập hiện tại?')) return;
  initTable(5);
}

function saveAllRows(skipDupCheck) {
  const date = document.getElementById('entry-date').value;
  if(!date) { toast('Vui lòng chọn ngày!','error'); return; }

  // Thu thập tất cả dòng hợp lệ
  const rows = [];
  let errRow = 0;
  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai   = (tr.querySelector('[data-f="loai"]')?.value||'').trim();
    const ctSel  = tr.querySelector('[data-f="ct"]');
    const ct     = (ctSel?.value||'').trim();
    const ctPid  = _readPidFromSel(ctSel);
    const tien   = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(!loai&&!ct&&!tien) return;
    if(!ct||!loai) { errRow++; tr.style.background='#fdecea'; return; }
    // Kiểm tra công trình đã quyết toán
    if (ctPid && ctPid !== 'COMPANY') {
      const proj = getProjectById(ctPid);
      if (proj && proj.status === 'closed') { errRow++; tr.style.background='#fdecea'; return; }
    }
    tr.style.background='';
    rows.push({
      tr,
      editId: tr.dataset.editId || null,
      payload: {
        ngay: date,
        congtrinh: ct, loai,
        projectId: ctPid || null,
        nguoi: (tr.querySelector('[data-f="nguoi"]')?.value||'').trim(),
        ncc:   (tr.querySelector('[data-f="ncc"]')?.value||'').trim(),
        nd:    (tr.querySelector('[data-f="nd"]')?.value||'').trim(),
        tien
      }
    });
  });

  if(errRow>0) { toast(`${errRow} dòng có lỗi (thiếu thông tin hoặc công trình đã quyết toán)!`,'error'); return; }
  if(!rows.length) { toast('Không có dòng hợp lệ!','error'); return; }

  // Kiểm tra trùng — chỉ cho dòng MỚI (không phải edit)
  if(!skipDupCheck) {
    const newRows = rows.filter(r => !r.editId);
    const dupRows = [];
    newRows.forEach(r => {
      // Chỉ so sánh với HĐ nhập tay (không ccKey) trong cùng ngày+CT
      const candidates = invoices.filter(i =>
        !i.ccKey &&
        i.ngay === r.payload.ngay &&
        i.congtrinh === r.payload.congtrinh &&
        (i.thanhtien||i.tien||0) === r.payload.tien
      );
      if(!candidates.length) return;

      // Fuzzy match nội dung ≥ 70%
      const nd = r.payload.nd.toLowerCase().trim();
      candidates.forEach(inv => {
        const sim = _strSimilarity(nd, (inv.nd||'').toLowerCase().trim());
        if(sim >= 0.7 || (nd === '' && (inv.nd||'') === '')) {
          dupRows.push({
            newRow: r,
            existing: inv,
            similarity: sim,
            isExact: sim >= 0.99
          });
        }
      });
    });

    if(dupRows.length > 0) {
      _showDupModal(dupRows, rows);
      return; // Dừng lại — chờ user quyết định
    }
  }

  // ── Thực sự lưu ────────────────────────────────────────────
  _doSaveRows(rows);
}

// ══════════════════════════════
// DUPLICATE CHECK
// ══════════════════════════════

// ── Fuzzy string similarity (Dice coefficient) ───────────────
// Trả về 0.0 → 1.0. Không cần thư viện ngoài.

// ── Hiển thị modal cảnh báo trùng ────────────────────────────
function _showDupModal(dupRows, allRows) {
  const overlay = document.getElementById('dup-modal-overlay');
  const body    = document.getElementById('dup-modal-body');
  const sub     = document.getElementById('dup-modal-subtitle');

  // Lưu allRows để forceSave dùng lại
  overlay._allRows = allRows;

  sub.textContent = `Tìm thấy ${dupRows.length} hóa đơn có thể bị trùng`;

  const numFmtLocal = n => n ? n.toLocaleString('vi-VN') + 'đ' : '0đ';
  body.innerHTML = dupRows.map(d => {
    const pct     = Math.round(d.similarity * 100);
    const badge   = d.isExact
      ? '<span class="dup-badge dup-badge-exact">Trùng hoàn toàn</span>'
      : `<span class="dup-badge dup-badge-fuzzy">Giống ${pct}%</span>`;
    const existTime = d.existing._ts
      ? new Date(d.existing._ts).toLocaleString('vi-VN')
      : d.existing.ngay || '';
    return `<div class="dup-item">
      <div style="font-size:11px;font-weight:700;color:#f57f17;margin-bottom:6px">
        HĐ MỚI ${badge}
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Ngày</span>
        <span class="dup-item-val">${d.newRow.payload.ngay}</span>
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Công trình</span>
        <span class="dup-item-val">${d.newRow.payload.congtrinh}</span>
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Số tiền</span>
        <span class="dup-item-val" style="color:var(--red);font-family:'IBM Plex Mono',monospace">
          ${numFmtLocal(d.newRow.payload.tien)}
        </span>
      </div>
      <div class="dup-item-row">
        <span class="dup-item-label">Nội dung</span>
        <span class="dup-item-val">${d.newRow.payload.nd||'(trống)'}</span>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ffe082;font-size:11px;color:#888">
        ↑ Trùng với HĐ đã lưu lúc ${existTime}:
        <span style="color:#555;font-weight:600">${d.existing.nd||'(trống)'}</span>
      </div>
    </div>`;
  }).join('');

  overlay.classList.add('open');
}

function closeDupModal() {
  document.getElementById('dup-modal-overlay').classList.remove('open');
}

function forceSaveAll() {
  closeDupModal();
  const overlay = document.getElementById('dup-modal-overlay');
  const allRows = overlay._allRows;
  if(allRows) _doSaveRows(allRows);
}

// ── Đảm bảo cả projectId lẫn congtrinh luôn nhất quán trước khi lưu ──
function _ensureInvRef(fields) {
  let { projectId, congtrinh } = fields;
  if (!projectId && congtrinh && typeof findProjectIdByName === 'function') {
    projectId = findProjectIdByName(congtrinh) || null;
    if (!projectId) console.warn('[invoice] Cannot resolve projectId for CT:', congtrinh);
  }
  if (projectId && typeof getProjectById === 'function') {
    const p = getProjectById(projectId);
    if (p && p.name) congtrinh = p.name;
  }
  return { ...fields, projectId: projectId || null, congtrinh: congtrinh || fields.congtrinh || '' };
}

// ── Hàm lưu thực sự (dùng chung cho cả normal và force) ──────
function _doSaveRows(rows) {
  let saved = 0, updated = 0;
  rows.forEach(({tr, editId, payload}) => {
    const p = _ensureInvRef({
      ngay: payload.ngay, congtrinh: payload.congtrinh, loai: payload.loai,
      nguoi: payload.nguoi, ncc: payload.ncc, nd: payload.nd,
      tien: payload.tien, thanhtien: payload.tien,
      projectId: payload.projectId || null,
      source: 'quick'
    });
    if(editId) {
      const idx = invoices.findIndex(i => String(i.id) === String(editId));
      if(idx >= 0) { invoices[idx] = mkUpdate(invoices[idx], p); updated++; }
    } else {
      invoices.unshift(mkRecord(p));
      saved++;
    }
    tr.style.background = '#f0fff4';
  });

  clearInvoiceCache(); save('inv_v3', invoices);
  buildYearSelect(); updateTop();

  if(updated > 0 && saved === 0) toast(`✅ Đã cập nhật ${updated} hóa đơn!`, 'success');
  else if(saved > 0 && updated === 0) toast(`✅ Đã lưu ${saved} hóa đơn!`, 'success');
  else toast(`✅ Đã lưu ${saved} mới, cập nhật ${updated} hóa đơn!`, 'success');
  const _eBtn = document.getElementById('entry-save-btn');
  if (_eBtn) _eBtn.textContent = '💾 Lưu Hóa Đơn';

  // Tự động refresh sub-tab "HĐ/CP nhập trong ngày"
  renderTodayInvoices();
  // Tự động refresh sub-tab "Tất cả CP/HĐ" (luôn sync sau mỗi lần lưu)
  buildFilters(); filterAndRender();
}

// ══════════════════════════════
// INVOICE DETAIL
// ══════════════════════════════

function goInnerSub(btn, id) {
  document.querySelectorAll('#sub-nhap-hd .inner-sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sub-nhap-hd .inner-sub-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if(id === 'inr-hd-chitiet') {
    _initDetailFormSelects();
    const tbody = document.getElementById('detail-tbody');
    if(tbody && tbody.children.length === 0) {
      document.getElementById('detail-ngay').value = document.getElementById('entry-date')?.value || today();
      for(let i=0; i<5; i++) addDetailRow();
    }
  }
  renderTodayInvoices(); // cập nhật bảng theo ngày của subtab vừa chuyển
}

function _initDetailFormSelects() {
  const loaiSel = document.getElementById('detail-loai');
  if(!loaiSel) return;
  const loaiV = loaiSel.value;
  loaiSel.innerHTML = '<option value="">-- Chọn Loại --</option>' +
    [...cats.loaiChiPhi].sort((a,b)=>a.localeCompare(b,'vi')).map(v => `<option value="${x(v)}" ${v===loaiV?'selected':''}>${x(v)}</option>`).join('');

  const ctSel = document.getElementById('detail-ct');
  ctSel.innerHTML = _buildProjOpts(ctSel.value || '', '-- Chọn Công Trình --');

  const nccSel = document.getElementById('detail-ncc');
  if(nccSel) {
    const nccV = nccSel.value;
    nccSel.innerHTML = '<option value="">-- Chọn NCC --</option>' +
      [...cats.nhaCungCap].sort((a,b)=>a.localeCompare(b,'vi')).map(v => `<option value="${x(v)}" ${v===nccV?'selected':''}>${x(v)}</option>`).join('');
  }

  // Rebuild dropdown Người TH cố định (phía trên bảng)
  const detNguoiSel = document.getElementById('detail-nguoi');
  if(detNguoiSel) {
    const detNguoiV = detNguoiSel.value;
    detNguoiSel.innerHTML = '<option value="">-- Chọn Người TH --</option>' +
      ([...cats.nguoiTH]||[]).sort((a,b)=>a.localeCompare(b,'vi')).map(v=>`<option value="${x(v)}" ${v===detNguoiV?'selected':''}>${x(v)}</option>`).join('');
  }

  // PHẦN 3: Format #detail-footer-ck (số tiền → hàng nghìn, % → giữ nguyên)
  const footerCk = document.getElementById('detail-footer-ck');
  if(footerCk && !footerCk.dataset.fmtInit) {
    footerCk.dataset.fmtInit = '1';
    footerCk.addEventListener('focus', function() {
      const v = this.value.trim();
      if(v && !v.endsWith('%')) { const n = parseMoney(v); if(n) this.value = String(n); }
    });
    footerCk.addEventListener('blur', function() {
      const v = this.value.trim();
      if(v && !v.endsWith('%')) { const n = parseMoney(v); this.value = n ? numFmt(n) : v; }
    });
  }
}

function renderDetailRowHTML(d, num) {
  // Format CK for display: nếu là số (không có %) thì hiển thị hàng nghìn
  const ckRaw = d.ck || '';
  const ckFmt = (ckRaw && !ckRaw.endsWith('%'))
    ? (() => { const n = parseMoney(ckRaw); return n ? numFmt(n) : ckRaw; })()
    : ckRaw;
  return `
    <td class="row-num">${num}</td>
    <td><input class="cell-input" data-f="ten" value="${x(d.ten||'')}" placeholder="Tên hàng hóa, vật tư..."></td>
    <td style="padding:0"><input class="cell-input center" data-f="dv" value="${x(d.dv||'')}" placeholder="cái"
      style="width:100%;text-align:center;padding:7px 4px"></td>
    <td style="padding:0"><input data-f="sl" type="number" step="0.01" min="0"
      value="${d.sl||''}" placeholder="1"
      style="width:100%;text-align:center;border:none;background:transparent;padding:7px 4px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;-moz-appearance:textfield"
      inputmode="decimal"></td>
    <td><input class="cell-input right" data-f="dongia" data-raw="${d.dongia||''}"
      value="${d.dongia?numFmt(d.dongia):''}" placeholder="0" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="ck" value="${x(ckFmt)}" placeholder="vd: 5% hoặc 50000"></td>
    <td class="tt-cell" data-f="thtien"></td>
    <td><button class="del-btn" onclick="delDetailRow(this)">✕</button></td>
  `;
}

function addDetailRow(d={}) {
  const tbody = document.getElementById('detail-tbody');
  const num = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = renderDetailRowHTML(d, num);

  const dongiaInp = tr.querySelector('[data-f="dongia"]');
  dongiaInp.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  dongiaInp.addEventListener('blur', function() {
    const raw = parseInt(this.dataset.raw||'0',10)||0;
    this.value = raw ? numFmt(raw) : '';
  });
  dongiaInp.addEventListener('input', function() {
    const raw = this.value.replace(/[.,\s]/g,'');
    this.dataset.raw = raw;
    if(raw) this.value = numFmt(parseInt(raw,10)||0);
    calcDetailRow(tr); calcDetailTotals();
  });
  tr.querySelector('[data-f="sl"]').addEventListener('input', function() {
    calcDetailRow(tr); calcDetailTotals();
  });
  const ckInp = tr.querySelector('[data-f="ck"]');
  ckInp.addEventListener('focus', function() {
    const v = this.value.trim();
    if (v && !v.endsWith('%')) {
      const n = parseMoney(v);
      if (n) this.value = String(n);
    }
  });
  ckInp.addEventListener('blur', function() {
    const v = this.value.trim();
    if (v && !v.endsWith('%')) {
      const n = parseMoney(v);
      this.value = n ? numFmt(n) : v;
    }
  });
  ckInp.addEventListener('input', function() {
    calcDetailRow(tr); calcDetailTotals();
  });
  tr.querySelector('[data-f="ten"]').addEventListener('input', generateDetailNd);

  // Enter key: nhảy đến cùng cột trong dòng tiếp theo; tạo dòng mới nếu ở dòng cuối
  tr.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const allRows = getDetailRows();
      const curIdx = allRows.indexOf(tr);
      const inputs = [...tr.querySelectorAll('input')];
      const colIdx = inputs.indexOf(this);
      let targetRow;
      if (curIdx < allRows.length - 1) {
        targetRow = allRows[curIdx + 1];
      } else {
        addDetailRow();
        targetRow = getDetailRows()[curIdx + 1];
      }
      if (targetRow) {
        const targetInputs = [...targetRow.querySelectorAll('input')];
        const target = targetInputs[colIdx] || targetInputs[0];
        if (target) target.focus();
      }
    });
  });

  tbody.appendChild(tr);
  if(d.dongia || d.sl || d.ck) calcDetailRow(tr);
}

function delDetailRow(btn) {
  btn.closest('tr').remove();
  document.querySelectorAll('#detail-tbody tr').forEach((tr,i) => {
    tr.querySelector('.row-num').textContent = i+1;
  });
  calcDetailTotals();
  generateDetailNd();
}

function calcDetailRow(tr) {
  const {sl, dongia, ck} = getRowData(tr);
  const tt = calcRowMoney(sl, dongia, ck);
  tr.dataset.tt = tt;
  const ttEl = tr.querySelector('[data-f="thtien"]');
  if(ttEl) {
    ttEl.textContent = tt ? numFmt(tt) : '';
    ttEl.className = 'tt-cell' + (!tt ? ' empty' : '');
  }
}

function calcDetailTotals() {
  let tc = 0;
  getDetailRows().forEach(tr => {
    tc += parseInt(tr.dataset.tt||'0', 10) || 0;
  });
  const tcEl = document.getElementById('detail-tc');
  if(tcEl) tcEl.textContent = numFmt(tc);

  // Dùng calcRowMoney(sl=1, dongia=tc, ck) để tái dùng logic CK
  const ckStr = (document.getElementById('detail-footer-ck')?.value||'').trim();
  const tong = calcRowMoney(1, tc, ckStr);

  const tongEl = document.getElementById('detail-tong');
  if(tongEl) { tongEl.textContent = numFmt(tong); tongEl.dataset.raw = tong; }
  const saveEl = document.getElementById('detail-tong-save');
  if(saveEl) saveEl.textContent = fmtM(tong);
}

function generateDetailNd() {
  const items = [];
  document.querySelectorAll('#detail-tbody tr [data-f="ten"]').forEach(inp => {
    const v = inp.value.trim();
    if(v) items.push({ ten: v });
  });
  const ndEl = document.getElementById('detail-nd');
  if(ndEl) ndEl.value = buildNDFromItems(items);
}

function saveDetailInvoice() {
  const ngay = document.getElementById('detail-ngay').value;
  if(!ngay) { toast('Vui lòng chọn ngày!','error'); return; }
  const loai = document.getElementById('detail-loai').value;
  if(!loai) { toast('Vui lòng chọn loại chi phí!','error'); return; }
  const _detCtSel = document.getElementById('detail-ct');
  const ct = _detCtSel.value;
  const _detCtPid = _detCtSel.selectedOptions[0]?.dataset?.pid || null;
  if(!ct) { toast('Vui lòng chọn công trình!','error'); return; }

  const detailNguoi = (document.getElementById('detail-nguoi')?.value||'').trim();
  const items = [];
  document.querySelectorAll('#detail-tbody tr').forEach(tr => {
    const {ten, dv, sl, dongia, ck} = getRowData(tr);
    const thanhtien = parseInt(tr.dataset.tt||'0', 10) || 0;
    if(!ten && !dongia) return;
    items.push({ten, dv, sl, dongia, ck, thanhtien});
  });
  if(!items.length) { toast('Chưa có dòng hàng hóa nào!','error'); return; }

  const tong = parseInt(document.getElementById('detail-tong').dataset.raw||'0') || 0;
  const nd = document.getElementById('detail-nd').value.trim();
  const ncc = document.getElementById('detail-ncc')?.value || '';
  const footerCkStr = (document.getElementById('detail-footer-ck')?.value||'').trim();
  const container = document.getElementById('inr-hd-chitiet');
  const editId = container.dataset.editId;

  const invFields = _ensureInvRef({ ngay, congtrinh: ct, loai, nguoi: detailNguoi, ncc, nd, tien: tong, thanhtien: tong, footerCkStr, items, source: 'detail', projectId: _detCtPid || null });

  if(editId) {
    const idx = invoices.findIndex(i => String(i.id) === String(editId));
    if(idx >= 0) {
      invoices[idx] = mkUpdate(invoices[idx], invFields);
      toast('✅ Đã cập nhật hóa đơn chi tiết!','success');
    } else {
      invoices.unshift(mkRecord(invFields));
      toast('✅ Đã lưu hóa đơn chi tiết!','success');
    }
    container.dataset.editId = '';
  } else {
    invoices.unshift(mkRecord(invFields));
    toast('✅ Đã lưu hóa đơn chi tiết!','success');
  }
  const saveBtn = document.getElementById('detail-save-btn');
  if(saveBtn) saveBtn.textContent = '💾 Lưu Hóa Đơn';

  clearInvoiceCache(); save('inv_v3', invoices);
  buildYearSelect(); updateTop();
  renderTodayInvoices();
  buildFilters(); filterAndRender();
  clearDetailForm();
}

function clearDetailForm() {
  document.getElementById('detail-tbody').innerHTML = '';
  for(let i=0; i<5; i++) addDetailRow();
  const ckEl = document.getElementById('detail-footer-ck');
  if(ckEl) ckEl.value = '';
  const ndEl = document.getElementById('detail-nd');
  if(ndEl) ndEl.value = '';
  const nccEl = document.getElementById('detail-ncc');
  if(nccEl) nccEl.value = '';
  const nguoiEl = document.getElementById('detail-nguoi');
  if(nguoiEl) nguoiEl.value = '';
  const container = document.getElementById('inr-hd-chitiet');
  if(container) container.dataset.editId = '';
  const saveBtn = document.getElementById('detail-save-btn');
  if(saveBtn) saveBtn.textContent = '💾 Lưu Hóa Đơn';
  calcDetailTotals();
}

// Helper: gán value cho <select> một cách linh hoạt
//   • So khớp trim + case-insensitive với options hiện có
//   • Nếu không khớp (orphaned): thêm option tạm "value (*)" để vẫn hiển thị
//   • Phát sự kiện 'change' để các listener cập nhật giao diện
function _setSelectFlexible(sel, val) {
  if (!sel) return;
  const target = (val == null ? '' : String(val)).trim();
  if (!target) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); return; }
  const targetLower = target.toLowerCase();
  let matched = null;
  for (const opt of sel.options) {
    if ((opt.value || '').trim().toLowerCase() === targetLower) { matched = opt; break; }
  }
  if (matched) {
    sel.value = matched.value;
  } else {
    // Orphan: NCC/Người trong HĐ không còn trong danh mục → thêm option tạm
    const orphan = document.createElement('option');
    orphan.value = target;
    orphan.textContent = target + ' (*)';
    sel.appendChild(orphan);
    sel.value = target;
  }
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function openDetailEdit(inv) {
  // Guard: tránh silent-fail khi items bị mất (vd: Firebase sync cũ chưa preserve items)
  if (!Array.isArray(inv.items) || !inv.items.length) {
    toast('⚠️ Hóa đơn này không có dữ liệu chi tiết (items bị thiếu). Vui lòng kiểm tra lại.', 'error');
    return;
  }
  // 1. Chuyển sang tab NHẬP CHI PHÍ (trước đây thiếu — user kẹt ở tab Thống kê)
  const navBtn = document.querySelector('.nav-btn[data-page="nhap"]');
  if (navBtn) goPage(navBtn, 'nhap');
  window.scrollTo({top:0, behavior:'smooth'});
  // Dùng một setTimeout duy nhất — loại bỏ double-timeout gây race condition trên mobile
  setTimeout(() => {
    const innerBtn = document.querySelector('.inner-sub-btn[onclick*="inr-hd-chitiet"]');
    if(innerBtn) goInnerSub(innerBtn, 'inr-hd-chitiet');

    // Set ngày TRƯỚC renderTodayInvoices (goInnerSub gọi renderTodayInvoices nên ngày phải có sẵn)
    document.getElementById('detail-ngay').value = inv.ngay || today();

    // Rebuild selects với giá trị cụ thể của HĐ đang sửa
    const loaiSel = document.getElementById('detail-loai');
    if(loaiSel) {
      loaiSel.innerHTML = '<option value="">-- Chọn Loại --</option>' +
        cats.loaiChiPhi.map(v => `<option value="${x(v)}" ${v===(inv.loai||'')?'selected':''}>${x(v)}</option>`).join('');
    }

    const _dCtSel = document.getElementById('detail-ct');
    if (_dCtSel) {
      _dCtSel.innerHTML = _buildProjOpts(inv.congtrinh || '', '-- Chọn Công Trình --');
      _dCtSel.value = inv.congtrinh || '';
      // Orphaned CT: project đã xóa nhưng HĐ vẫn còn tham chiếu → thêm option tạm
      if (inv.congtrinh && !_dCtSel.value) {
        const orphan = document.createElement('option');
        orphan.value = inv.congtrinh;
        orphan.textContent = inv.congtrinh + ' (*)';
        if (inv.projectId) orphan.dataset.pid = inv.projectId;
        _dCtSel.appendChild(orphan);
        _dCtSel.value = inv.congtrinh;
      }
    }

    // FIX: NCC/Người TH so khớp linh hoạt (trim + case-insensitive + orphan fallback)
    _setSelectFlexible(document.getElementById('detail-ncc'),   inv.ncc);
    _setSelectFlexible(document.getElementById('detail-nguoi'), inv.nguoi);

    // Load items — xóa sạch rồi render lại toàn bộ
    const tbody = document.getElementById('detail-tbody');
    tbody.innerHTML = '';
    const itemList = Array.isArray(inv.items) ? inv.items : [];
    itemList.forEach(item => addDetailRow(item));
    const needed = Math.max(0, 5 - itemList.length);
    for(let i=0; i<needed; i++) addDetailRow();

    document.getElementById('detail-nd').value = inv.nd || '';

    const ckEl2 = document.getElementById('detail-footer-ck');
    if(ckEl2) {
      const ckRaw = inv.footerCkStr || '';
      ckEl2.value = (ckRaw && !ckRaw.endsWith('%'))
        ? (() => { const n = parseMoney(ckRaw); return n ? numFmt(n) : ckRaw; })()
        : ckRaw;
    }
    calcDetailTotals();
    document.getElementById('inr-hd-chitiet').dataset.editId = String(inv.id);
    const saveBtn2 = document.getElementById('detail-save-btn');
    if(saveBtn2) saveBtn2.textContent = '💾 Cập Nhật';
    toast('✏️ Chỉnh sửa hóa đơn chi tiết rồi nhấn 💾 Cập Nhật','success');
  }, 120);
}

// ══════════════════════════════
// INVOICE LIST
// ══════════════════════════════

// Toggle giữa "Tất cả HĐ" và "🗑 Đã xóa" trong sub-tat-ca
function switchTatCaView(val) {
  const activeWrap = document.getElementById('active-inv-wrap');
  const trashWrap  = document.getElementById('inline-trash-wrap');
  const isTrash = val === 'trash';
  if(activeWrap) activeWrap.style.display = isTrash ? 'none' : '';
  if(trashWrap)  trashWrap.style.display  = isTrash ? ''     : 'none';
  // Ẩn/hiện search + filters theo chế độ
  const filterIds = ['tc-search-box','f-ct','f-loai','f-ncc','f-month'];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = isTrash ? 'none' : '';
  });
  const exportBtn = document.getElementById('btn-export-csv');
  if(exportBtn) exportBtn.style.display = isTrash ? 'none' : '';
  if(isTrash) renderTrash();
  else { buildFilters(); filterAndRender(); }
}

function buildFilters() {
  const allInvs = getInvoicesCached();
  const yearInvs = allInvs.filter(i=>inActiveYear(i.ngay));

  // CT dropdown — luôn hiển thị đầy đủ
  const cts = [...new Set(yearInvs.map(i => resolveProjectName(i)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'vi'));
  const ctSel=document.getElementById('f-ct'); if(!ctSel) return;
  const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả công trình</option>'+cts.map(c=>`<option ${c===cv?'selected':''} value="${x(c)}">${x(c)}</option>`).join('');

  // Lọc theo CT đang chọn để build Loại CP và NCC động
  const relevantInvs = cv ? yearInvs.filter(i => resolveProjectName(i) === cv) : yearInvs;

  // Loại CP dropdown — chỉ hiển thị loại có trong CT đang chọn
  const loais = [...new Set(relevantInvs.map(i=>i.loai))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi'));
  const lSel=document.getElementById('f-loai'); const lv=lSel.value;
  lSel.innerHTML='<option value="">Tất cả loại</option>'+loais.map(l=>`<option ${l===lv?'selected':''} value="${x(l)}">${x(l)}</option>`).join('');

  // NCC dropdown — chỉ hiển thị NCC có trong CT đang chọn
  const nccSel=document.getElementById('f-ncc');
  if(nccSel) {
    const nccs=[...new Set(relevantInvs.map(i=>i.ncc))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi'));
    const nv=nccSel.value;
    nccSel.innerHTML='<option value="">Tất cả NCC</option>'+nccs.map(n=>`<option ${n===nv?'selected':''} value="${x(n)}">${x(n)}</option>`).join('');
  }

  // Tháng dropdown — luôn hiển thị đầy đủ
  const months=[...new Set(yearInvs.map(i=>i.ngay?.slice(0,7)))].filter(Boolean).sort().reverse();
  const mSel=document.getElementById('f-month'); const mv=mSel.value;
  mSel.innerHTML='<option value="">Tất cả tháng</option>'+months.map(m=>`<option ${m===mv?'selected':''} value="${m}">${m}</option>`).join('');
}

function filterAndRender() {
  if (!window._dataReady) return; // chặn render trước khi dbInit() hoàn tất
  curPage=1;
  const q=document.getElementById('search')?.value.toLowerCase()||'';
  const fCt=document.getElementById('f-ct')?.value||'';
  const fLoai=document.getElementById('f-loai')?.value||'';
  const fNcc=document.getElementById('f-ncc')?.value||'';
  const fMonth=document.getElementById('f-month')?.value||'';
  filteredInvs = getInvoicesCached().filter(inv => {
    if(!inActiveYear(inv.ngay)) return false;
    if(fCt && resolveProjectName(inv)!==fCt) return false;
    if(fLoai && inv.loai!==fLoai) return false;
    if(fNcc && (inv.ncc||'')!==fNcc) return false;
    if(fMonth && !inv.ngay.startsWith(fMonth)) return false;
    if(q) { const t=[inv.ngay,resolveProjectName(inv),inv.loai,inv.nguoi,inv.ncc,inv.nd,String(inv.thanhtien||inv.tien||0)].join(' ').toLowerCase(); if(!t.includes(q)) return false; }
    return true;
  });
  // Sort: Newest → Oldest based on ngay
  filteredInvs.sort((a, b) => {
    return (b.ngay || '').localeCompare(a.ngay || '');
  });
  renderTable();
}

function renderTable() {
  const tbody=document.getElementById('all-tbody');
  const start=(curPage-1)*PG;
  const paged=filteredInvs.slice(start,start+PG);
  const sumTT=filteredInvs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  if(!paged.length) {
    tbody.innerHTML=`<tr class="empty-row"><td colspan="10">Không có hóa đơn nào</td></tr>`;
    document.getElementById('pagination').innerHTML=''; return;
  }
  tbody.innerHTML = paged.map(inv=>{
    const isCC     = inv.source === 'cc' || (!inv.source && !!inv.ccKey);
    const isManual = !isCC;
    const src      = isCC ? 'cc' : _resolveInvSource(inv);
    const rowClass = src === 'quick' ? 'inv-row-quick' : src === 'detail' ? 'inv-row-detail' : '';
    const actionBtn = isManual
      ? `<span style="white-space:nowrap;display:inline-flex;gap:3px">
          <button class="btn btn-outline btn-sm" onclick="editManualInvoice('${inv.id}')" title="Sửa hóa đơn">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="delInvoice('${inv.id}')" title="Xóa hóa đơn">✕</button>
        </span>`
      : isCC
        ? `<button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 7px" onclick="editCCInvoice('${inv.ccKey||inv.id}')" title="Chỉnh sửa tại tab Chấm Công">↩ CC</button>`
        : `<span style="color:var(--ink3);font-size:11px;padding:0 6px">—</span>`;
    const displayDate = inv.ngay ? (inv.ngay.split('-').length === 3 ? inv.ngay.split('-').reverse().join('-') : inv.ngay) : '—';
    return `<tr class="${rowClass}">
    <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2)">${displayDate}</td>
    <td style="font-weight:600;font-size:12px;max-width:220px">${x(resolveProjectName(inv))}</td>
    <td><span class="tag tag-gold">${x(inv.loai)}</span></td>
    <td class="hide-mobile" style="color:var(--ink2)">${x(inv.nguoi||'—')}</td>
    <td class="hide-mobile" style="color:var(--ink2)">${x(inv.ncc||'—')}</td>
    <td style="color:var(--ink2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(inv.nd)}">${x(inv.nd||'—')}</td>
    <td class="amount-td" title="Đơn giá: ${numFmt(inv.tien||0)}${inv.sl&&inv.sl!==1?' × '+inv.sl:''}">${numFmt(inv.thanhtien||inv.tien||0)}</td>
    <td style="white-space:nowrap">${actionBtn}</td>
  </tr>`;}).join('');

  const tp=Math.ceil(filteredInvs.length/PG);
  let pag=`<span>${filteredInvs.length} hóa đơn · Tổng: <strong style="color:var(--gold);font-family:'IBM Plex Mono',monospace">${fmtS(sumTT)}</strong></span>`;
  if(tp>1) {
    pag+='<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===curPage?'active':''}" onclick="goTo(${p})">${p}</button>`;
    if(tp>10) pag+=`<span style="padding:4px 6px;color:var(--ink3)">...${tp}</span>`;
    pag+='</div>';
  }
  document.getElementById('pagination').innerHTML=pag;
}

function goTo(p) { curPage=p; renderTable(); }

function delInvoice(id) {
  const inv=invoices.find(i=>String(i.id)===String(id));
  if(!inv) { toast('Không tìm thấy hóa đơn!','error'); return; }
  // Chỉ cho xóa manual invoice — CC invoices phải xóa từ tab Chấm Công
  if(inv.ccKey || inv.source==='cc') {
    toast('⚠️ Không thể xóa hóa đơn từ chấm công! Hãy chỉnh sửa tại tab Chấm Công.','error');
    return;
  }
  if(!confirm('Xóa hóa đơn này? (Có thể khôi phục từ Thùng Rác)')) return;
  // Soft delete: giữ record trong invoices với deletedAt (tránh resurrection khi sync)
  const now = Date.now();
  const idx = invoices.findIndex(i => String(i.id) === String(id));
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
  }
  clearInvoiceCache(); save('inv_v3', invoices);
  trashAdd({...inv}); // giữ trong trash để UI "Thùng Rác" vẫn hoạt động
  updateTop(); buildFilters(); filterAndRender(); renderTrash();
  toast('Đã xóa (có thể khôi phục trong Thùng Rác)');
}
function editCCInvoice(ccKeyOrId) {
  // ccKey format: 'cc|fromDate|ct|...'
  const key = String(ccKeyOrId);
  const parts = key.split('|');
  if (parts.length < 3 || parts[0] !== 'cc') return;
  const fromDate=parts[1], ct=parts[2];

  // 1. Chuyển tab — dùng goPage chuẩn
  const navBtn=document.querySelector('.nav-btn[data-page="chamcong"]');
  goPage(navBtn,'chamcong');
  window.scrollTo({top:0,behavior:'smooth'});

  // 2. Set tuần đúng (snap về CN của tuần đó)
  const sunISO=snapToSunday(fromDate);
  const satISO=ccSaturdayISO(sunISO);
  document.getElementById('cc-from').value=sunISO;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(sunISO);
  // Tính lại offset
  const thisSun=ccSundayISO(0);
  const [ty,tm,td]=thisSun.split('-').map(Number);
  const [fy,fm,fd]=sunISO.split('-').map(Number);
  ccOffset=Math.round((new Date(fy,fm-1,fd)-new Date(ty,tm-1,td))/(7*86400000));

  // 3. Set công trình và load bảng (sau khi goPage đã populate select)
  setTimeout(()=>{
    const ctSel=document.getElementById('cc-ct-sel');
    if(ctSel){
      if(![...ctSel.options].find(o=>o.value===ct)){
        const o=document.createElement('option');o.value=ct;o.textContent=ct;ctSel.appendChild(o);
      }
      ctSel.value=ct;
    }
    loadCCWeekForm();
    toast('✏️ Đang xem tuần '+viShort(sunISO)+' — '+ct,'success');
  },50);
}
// Điều hướng đến form Nhập nhanh và nạp dữ liệu HĐ để chỉnh sửa
function openEntryEdit(inv) {
  // 1. Chuyển sang page Nhập
  const navBtn = document.querySelector('.nav-btn[data-page="nhap"]');
  if (navBtn) goPage(navBtn, 'nhap');
  // 2. Chuyển về sub-tab sub-nhap-hd
  const subBtn = document.querySelector('.sub-nav-btn[onclick*="sub-nhap-hd"]');
  if (subBtn && !subBtn.classList.contains('active')) {
    goSubPage(subBtn, 'sub-nhap-hd');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    // 3. Chuyển về inner tab Nhập nhanh
    const innerBtn = document.querySelector('.inner-sub-btn[onclick*="inr-nhap-nhanh"]');
    if (innerBtn) goInnerSub(innerBtn, 'inr-nhap-nhanh');
    // 4. Nạp dữ liệu vào form
    document.getElementById('entry-date').value = inv.ngay || today();
    document.getElementById('entry-tbody').innerHTML = '';
    addRow({ loai: inv.loai, congtrinh: inv.congtrinh,
             nguoi: inv.nguoi || '', ncc: inv.ncc || '', nd: inv.nd || '', tien: inv.tien || 0 });
    const row = document.querySelector('#entry-tbody tr');
    if (row) {
      row.dataset.editId = String(inv.id);
      // FIX: gán NCC/Người TH linh hoạt (phòng trường hợp giá trị trong HĐ
      // có whitespace/case khác với danh mục → option không được selected)
      _setSelectFlexible(row.querySelector('[data-f="ncc"]'),   inv.ncc);
      _setSelectFlexible(row.querySelector('[data-f="nguoi"]'), inv.nguoi);
      _setSelectFlexible(row.querySelector('[data-f="loai"]'),  inv.loai);
    }
    calcSummary();
    const _eBtn = document.getElementById('entry-save-btn');
    if (_eBtn) _eBtn.textContent = '💾 Cập nhật';
    toast('✏️ Chỉnh sửa rồi nhấn 💾 Cập nhật', 'success');
  }, 100);
}

// Xác định loại hóa đơn chuẩn: dùng field source, fallback cho dữ liệu cũ
function _resolveInvSource(inv) {
  if (inv.source === 'detail') return 'detail';
  if (inv.source === 'quick' || inv.source === 'manual') return 'quick';
  // Backward compat: dữ liệu cũ không có source → suy từ items
  if (inv.items && inv.items.length) return 'detail';
  return 'quick';
}

function editManualInvoice(id) {
  // Đọc từ inv_v3 gốc — KHÔNG dùng getInvoicesCached() vì cache trộn manual+CC.
  // CC-derived invoice (ccKey) không có items → nếu find nhầm sẽ mở form rỗng.
  const inv = getState('inv_v3', []).find(i => !i.deletedAt && !i.ccKey && String(i.id) === String(id));
  if (!inv) return;
  if (_resolveInvSource(inv) === 'detail') { openDetailEdit(inv); return; }
  openEntryEdit(inv);
}
function showEditInvoiceModal(inv) {
  let ov=document.getElementById('edit-inv-overlay');
  if(!ov){ov=document.createElement('div');ov.id='edit-inv-overlay';ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';ov.onclick=function(e){if(e.target===this)this.remove();};document.body.appendChild(ov);}
  const _allProj=(typeof getAllProjects==='function'?getAllProjects():[]).filter(p=>
    activeYear===0||p.id==='COMPANY'||p.status!=='closed'||p.name===inv.congtrinh||
    (typeof _ctInActiveYear==='function'&&_ctInActiveYear(p.name)));
  const ctOpts=_allProj.map(p=>`<option value="${x(p.name)}" data-pid="${p.id}" ${p.name===inv.congtrinh?'selected':''}>${x(p.name)}</option>`).join('');
  const loaiOpts=cats.loaiChiPhi.map(v=>`<option value="${x(v)}" ${v===inv.loai?'selected':''}>${x(v)}</option>`).join('');
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,96vw);box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:'IBM Plex Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700">✏️ Sửa Hóa Đơn</h3>
      <button onclick="document.getElementById('edit-inv-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Ngày</label><input id="ei-ngay" type="date" value="${inv.ngay}" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Loại Chi Phí</label><select id="ei-loai" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><option value="">-- Chọn --</option>${loaiOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Công Trình</label><select id="ei-ct" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><option value="">-- Chọn --</option>${ctOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Người TH</label><input id="ei-nguoi" type="text" value="${x(inv.nguoi||'')}" list="ei-dl" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><datalist id="ei-dl">${cats.nguoiTH.map(v=>`<option value="${x(v)}">`).join('')}</datalist></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Nội Dung</label><input id="ei-nd" type="text" value="${x(inv.nd||'')}" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Số Tiền (đ)</label><input id="ei-tien" type="number" value="${inv.tien||0}" inputmode="decimal" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="document.getElementById('edit-inv-overlay').remove()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Hủy</button>
      <button onclick="saveEditInvoice('${inv.id}')" style="flex:2;padding:10px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">💾 Cập Nhật</button>
    </div>
  </div>`;
  ov.style.display='flex';
}
function saveEditInvoice(id) {
  const idx=invoices.findIndex(i=>String(i.id)===String(id));
  if(idx<0) return;
  const tien=parseInt(document.getElementById('ei-tien').value)||0;
  const ctSel=document.getElementById('ei-ct');
  const ctName=ctSel.value;
  const ctPid=ctSel.selectedOptions[0]?.dataset?.pid||null;
  invoices[idx]=mkUpdate(invoices[idx],{ngay:document.getElementById('ei-ngay').value,loai:document.getElementById('ei-loai').value,congtrinh:ctName,projectId:ctPid||null,nguoi:document.getElementById('ei-nguoi').value.trim(),nd:document.getElementById('ei-nd').value.trim(),tien,thanhtien:tien});
  clearInvoiceCache(); save('inv_v3',invoices);
  document.getElementById('edit-inv-overlay').remove();
  buildFilters(); filterAndRender(); updateTop();
  toast('✅ Đã cập nhật hóa đơn!','success');
}

// ══════════════════════════════════════════════════════════════════
// TRASH SYSTEM
// ══════════════════════════════════════════════════════════════════
let trash = load('trash_v1', []);

function trashAdd(inv) {
  inv._deletedAt = new Date().toISOString();
  trash.unshift(inv);
  // Giữ tối đa 200 HĐ trong thùng rác
  if(trash.length>200) trash=trash.slice(0,200);
  save('trash_v1', trash);
}

function trashRestore(id) {
  const idx=trash.findIndex(i=>String(i.id)===String(id));
  if(idx<0) return;
  const now = Date.now();
  // Xóa deletedAt trên record đang có trong invoices (soft-delete tombstone)
  const invIdx = invoices.findIndex(i => String(i.id) === String(id));
  if (invIdx >= 0) {
    invoices[invIdx] = { ...invoices[invIdx], deletedAt: null, updatedAt: now, deviceId: DEVICE_ID };
  } else {
    // Fallback: record chưa có trong invoices (import cũ) — thêm mới
    const inv = { ...trash[idx] };
    delete inv._deletedAt;
    inv.deletedAt = null;
    inv.updatedAt = now;
    inv.deviceId = DEVICE_ID;
    invoices.unshift(inv);
  }
  trash.splice(idx, 1);
  clearInvoiceCache(); save('inv_v3', invoices);
  save('trash_v1', trash);
  updateTop(); buildFilters(); filterAndRender(); renderTrash();
  toast('✅ Đã khôi phục hóa đơn!', 'success');
}

function trashDeletePermanent(id) {
  trash=trash.filter(i=>String(i.id)!==String(id));
  save('trash_v1', trash);
  renderTrash();
  toast('Đã xóa vĩnh viễn','success');
}

function trashClearAll() {
  if(!trash.length) return;
  if(!confirm(`Xóa vĩnh viễn ${trash.length} hóa đơn trong thùng rác?\nKhông thể khôi phục!`)) return;
  trash=[];
  save('trash_v1', trash);
  renderTrash();
  toast('Đã xóa toàn bộ thùng rác','success');
}

function renderTrash() {
  const wrap=document.getElementById('trash-wrap');
  const empty=document.getElementById('trash-empty');
  const tbody=document.getElementById('trash-tbody');
  if(!wrap||!tbody||!empty) return;
  if(!trash.length) {
    wrap.style.display='none'; empty.style.display='';
    return;
  }
  wrap.style.display=''; empty.style.display='none';
  tbody.innerHTML=trash.slice(0,100).map(inv=>`<tr>
    <td style="font-size:11px;color:var(--ink2);white-space:nowrap;font-family:'IBM Plex Mono',monospace">${inv.ngay||''}</td>
    <td style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.congtrinh||'—')}</td>
    <td><span class="tag tag-gold">${x(inv.loai||'—')}</span></td>
    <td style="color:var(--ink2);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.nd||'—')}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)">${numFmt(inv.tien||0)}</td>
    <td style="white-space:nowrap;display:flex;gap:4px;padding:5px 4px">
      <button class="btn btn-outline btn-sm" onclick="trashRestore('${inv.id}')" title="Khôi phục">↩ Khôi phục</button>
      <button class="btn btn-danger btn-sm" onclick="trashDeletePermanent('${inv.id}')" title="Xóa vĩnh viễn">✕</button>
    </td>
  </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════════
//  BẢNG HÓA ĐƠN ĐÃ NHẬP TRONG NGÀY
// ══════════════════════════════════════════════════════════════════
function renderTodayInvoices() {
  if (!window._dataReady) return; // chặn render trước khi dbInit() hoàn tất
  // Lấy ngày từ subtab đang active
  const activeInner = document.querySelector('#sub-nhap-hd .inner-sub-page.active');
  const date = (activeInner?.id === 'inr-hd-chitiet')
    ? (document.getElementById('detail-ngay')?.value || today())
    : (document.getElementById('entry-date')?.value || today());

  const dateEl = document.getElementById('today-inv-date');
  if(dateEl) {
    const _dp = date.split('-');
    dateEl.textContent = _dp.length === 3 ? `${_dp[2]}-${_dp[1]}-${_dp[0]}` : date;
  }

  const tbody = document.getElementById('today-inv-tbody');
  const footer = document.getElementById('today-inv-footer');
  if(!tbody) return;

  const todayInvs = invoices.filter(i => i.ngay === date && !i.ccKey && !i.deletedAt);
  if(!todayInvs.length) {
    const displayDate = date.split('-').length === 3 ? date.split('-').reverse().join('-') : date;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Chưa có hóa đơn nào vào ngày ${displayDate}</td></tr>`;
    if(footer) footer.innerHTML = '';
    return;
  }

  const mono = "font-family:'IBM Plex Mono',monospace";
  tbody.innerHTML = todayInvs.map(inv => {
    return `<tr>
      <td><span class="tag tag-gold">${x(inv.loai||'—')}</span></td>
      <td style="font-size:12px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.congtrinh||'—')}</td>
      <td style="text-align:right;${mono};font-weight:700;color:var(--green)">${inv.tien?numFmt(inv.tien):'—'}</td>
      <td style="color:var(--ink2);font-size:11px">${x(inv.nguoi||'—')}</td>
      <td style="color:var(--ink2);font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(inv.nd||'—')}</td>
      <td style="color:var(--ink2);font-size:11px;white-space:nowrap">${x(inv.ncc||'—')}</td>
    </tr>`;
  }).join('');

  const total = todayInvs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  if(footer) footer.innerHTML = `<span>${todayInvs.length} hóa đơn</span><span>Tổng: <strong style="color:var(--gold);${mono}">${fmtS(total)}</strong></span>`;
}

/** Cập nhật tất cả dropdown CT trong tab Hóa Đơn (nhập nhanh + chi tiết) ngay lập tức. */
function refreshHoadonCtDropdowns() {
  document.querySelectorAll('#entry-tbody [data-f="ct"]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = _buildProjOpts(cur, '-- Chọn --');
    sel.value = cur;
  });
  const detCtSel = document.getElementById('detail-ct');
  if (detCtSel) {
    const cur = detCtSel.value;
    detCtSel.innerHTML = _buildProjOpts(cur, '-- Chọn Công Trình --');
    detCtSel.value = cur;
  }
}

function editTodayInv(id) {
  // Dùng cùng nguồn với list — bỏ qua CC-derived invoices
  const inv = getInvoicesCached().find(i => String(i.id) === String(id));
  if (!inv || inv.ccKey) return;
  if (inv.items && inv.items.length) { openDetailEdit(inv); return; }
  openEntryEdit(inv);
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

// Tính thành tiền một dòng: sl × dongia áp chiết khấu ck
// ck = "" → không CK | "5%" → giảm 5% | "50000" → giảm tiền cố định
function calcRowMoney(sl, dongia, ck) {
  const base = sl * dongia;
  if (!ck) return Math.round(base);
  if (ck.endsWith('%')) return Math.round(base * (1 - (parseFloat(ck) || 0) / 100));
  return Math.round(base - parseMoney(ck));
}

// Trả về tất cả <tr> trong bảng hóa đơn chi tiết
function getDetailRows() {
  return [...document.querySelectorAll('#detail-tbody tr')];
}

// Đọc dữ liệu một dòng trong #detail-tbody
function getRowData(tr) {
  return {
    ten:    (tr.querySelector('[data-f="ten"]')?.value    || '').trim(),
    dv:     (tr.querySelector('[data-f="dv"]')?.value     || '').trim(),
    sl:     parseFloat(tr.querySelector('[data-f="sl"]')?.value)  || 1,
    dongia: parseInt(tr.querySelector('[data-f="dongia"]')?.dataset.raw || '0', 10) || 0,
    ck:     (tr.querySelector('[data-f="ck"]')?.value     || '').trim(),
  };
}
// ══════════════════════════════════════════════════════════════
