// ══════════════════════════════════════════════════════════════
// src/modules/invoices/invoice.logic.js — Invoice Business Logic
// Prompt 6 — Bốc từ hoadon.js + tienich.js
// Logic nghiệp vụ: buildInvoices, cache, save/delete, trash
// ══════════════════════════════════════════════════════════════

// ── buildInvoices — Tổng hợp invoice từ data gốc ───────────
// Trả về: manual invoices (source=quick/detail) + CC invoices (source=cc)
// Bốc từ tienich.js → buildInvoices()

/**
 * Build toàn bộ invoices (manual + CC-derived)
 * @param {Array} invRaw - inv_v3 data
 * @param {Array} ccRaw - cc_v2 data
 * @returns {Array} Combined invoices
 */
export function buildInvoices(invRaw, ccRaw) {
  // 1. Manual invoices
  const manual = (invRaw || [])
    .filter(inv => !inv.deletedAt)
    .map(inv => ({
      ...inv,
      source: (inv.source === 'quick' || inv.source === 'detail') ? inv.source : 'manual'
    }));

  // 2. CC-derived invoices — tính động, không lưu vào inv_v3
  const ccInvs = [];
  const _vi = ds => {
    const [, m, d] = ds.split('-').map(Number);
    return (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m;
  };
  const ccData = (ccRaw || []).filter(w => !w.deletedAt);
  ccData.forEach(week => {
    const { fromDate, ct, workers } = week;
    if (!fromDate || !ct || !workers || !workers.length) return;
    let toDate = week.toDate;
    if (!toDate) {
      const [y, m, d] = fromDate.split('-').map(Number);
      const sat = new Date(y, m - 1, d + 6);
      toDate = sat.getFullYear() + '-' + String(sat.getMonth() + 1).padStart(2, '0') + '-' + String(sat.getDate()).padStart(2, '0');
    }
    const pfx = 'cc|' + fromDate + '|' + ct + '|';
    // HĐ Mua Lẻ — 1 dòng mỗi CN có hdmuale > 0
    workers.forEach(wk => {
      if (!wk.hdmuale || wk.hdmuale <= 0) return;
      const key = pfx + wk.name + '|hdml';
      ccInvs.push({
        id: key, ccKey: key, source: 'cc',
        ngay: toDate, congtrinh: ct, projectId: week.projectId || null,
        loai: 'Hóa Đơn Lẻ', nguoi: wk.name, ncc: '',
        nd: wk.nd || ('HĐ mua lẻ – ' + wk.name + ' (' + _vi(fromDate) + '–' + _vi(toDate) + ')'),
        tien: wk.hdmuale, thanhtien: wk.hdmuale, _ts: 0
      });
    });
    // HĐ Nhân Công — 1 dòng mỗi tuần+CT
    const totalLuong = workers.reduce((s, wk) => {
      const tc = (wk.d || []).reduce((a, v) => a + (v || 0), 0);
      return s + tc * (wk.luong || 0) + (wk.phucap || 0);
    }, 0);
    if (totalLuong > 0) {
      const ncKey = pfx + 'nhanCong';
      const fw = (workers.find(w => w.name) || { name: '' }).name;
      ccInvs.push({
        id: ncKey, ccKey: ncKey, source: 'cc',
        ngay: toDate, congtrinh: ct, projectId: week.projectId || null,
        loai: 'Nhân Công', nguoi: fw, ncc: '',
        nd: 'Lương tuần ' + _vi(fromDate) + '–' + _vi(toDate),
        tien: totalLuong, thanhtien: totalLuong, _ts: 0
      });
    }
  });

  return [...manual, ...ccInvs];
}

// ── Invoice Cache ───────────────────────────────────────────
let _invoiceCache = null;

/**
 * Get cached invoices — build nếu chưa có
 * Cần truyền data lần đầu hoặc dùng global fallback
 */
export function getInvoicesCached(invRaw, ccRaw) {
  if (!_invoiceCache) {
    // Dùng params nếu có, fallback global load()
    const inv = invRaw || (typeof window.load === 'function' ? window.load('inv_v3', []) : []);
    const cc = ccRaw || (typeof window.load === 'function' ? window.load('cc_v2', []) : []);
    _invoiceCache = buildInvoices(inv, cc);
  }
  return _invoiceCache;
}

/** Clear cache — gọi sau mỗi mutation */
export function clearInvoiceCache() {
  _invoiceCache = null;
}

// ── CRUD Operations ─────────────────────────────────────────

/**
 * Đảm bảo projectId + congtrinh nhất quán
 */
export function ensureInvRef(fields, findPidFn, getProjFn) {
  let { projectId, congtrinh } = fields;
  if (!projectId && congtrinh && findPidFn) {
    projectId = findPidFn(congtrinh) || null;
  }
  if (projectId && getProjFn) {
    const p = getProjFn(projectId);
    if (p && p.name) congtrinh = p.name;
  }
  return { ...fields, projectId: projectId || null, congtrinh: congtrinh || fields.congtrinh || '' };
}

/**
 * Fuzzy string similarity (Dice coefficient)
 */
export function strSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const getBigrams = s => {
    const set = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      set.set(bg, (set.get(bg) || 0) + 1);
    }
    return set;
  };
  const aMap = getBigrams(a);
  const bMap = getBigrams(b);
  let intersection = 0;
  aMap.forEach((cnt, bg) => {
    if (bMap.has(bg)) intersection += Math.min(cnt, bMap.get(bg));
  });
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/**
 * Kiểm tra trùng HĐ (dùng trước khi save)
 * @returns {Array} dupRows - danh sách HĐ nghi trùng
 */
export function checkDuplicates(newPayloads, existingInvoices) {
  const dupRows = [];
  newPayloads.forEach(payload => {
    const candidates = existingInvoices.filter(i =>
      !i.ccKey && i.ngay === payload.ngay &&
      i.congtrinh === payload.congtrinh &&
      (i.thanhtien || i.tien || 0) === payload.tien
    );
    if (!candidates.length) return;
    const nd = (payload.nd || '').toLowerCase().trim();
    candidates.forEach(inv => {
      const sim = strSimilarity(nd, (inv.nd || '').toLowerCase().trim());
      if (sim >= 0.7 || (nd === '' && (inv.nd || '') === '')) {
        dupRows.push({
          payload, existing: inv,
          similarity: sim, isExact: sim >= 0.99
        });
      }
    });
  });
  return dupRows;
}

/**
 * Tính tiền từ SL × Đơn giá - CK
 */
export function calcRowMoney(sl, dongia, ck) {
  sl = parseFloat(sl) || 1;
  dongia = parseInt(dongia) || 0;
  let total = Math.round(sl * dongia);
  if (ck) {
    const ckStr = String(ck).trim();
    if (ckStr.endsWith('%')) {
      const pct = parseFloat(ckStr) || 0;
      total = Math.round(total * (1 - pct / 100));
    } else {
      const ckVal = parseInt(String(ck).replace(/[.,\s]/g, '')) || 0;
      total = total - ckVal;
    }
  }
  return total < 0 ? 0 : total;
}

// ── Trash Operations ────────────────────────────────────────

/**
 * Thêm invoice vào trash
 */
export function trashAdd(inv, trash) {
  const newTrash = [...trash];
  newTrash.unshift({ ...inv, _deletedAt: Date.now() });
  if (newTrash.length > 100) newTrash.length = 100;
  return newTrash;
}

/**
 * Khôi phục invoice từ trash
 */
export function trashRestore(id, trash) {
  const idx = trash.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return { trash, restored: null };
  const restored = { ...trash[idx] };
  delete restored._deletedAt;
  restored.deletedAt = null;
  const newTrash = trash.filter((_, i) => i !== idx);
  return { trash: newTrash, restored };
}

/**
 * Xóa vĩnh viễn từ trash
 */
export function trashDelete(id, trash) {
  return trash.filter(i => String(i.id) !== String(id));
}

// ── Filter helpers ──────────────────────────────────────────

/**
 * Filter invoices theo criteria
 */
export function filterInvoices(invoices, { query, ct, loai, ncc, month, activeYears, resolveName }) {
  return invoices.filter(inv => {
    // Year filter
    if (activeYears && activeYears.size > 0) {
      if (!inv.ngay) return false;
      const yr = parseInt(inv.ngay.slice(0, 4));
      if (!activeYears.has(yr)) return false;
    }
    // CT filter
    if (ct) {
      const name = resolveName ? resolveName(inv) : (inv.congtrinh || '');
      if (name !== ct) return false;
    }
    // Loai filter
    if (loai && inv.loai !== loai) return false;
    // NCC filter
    if (ncc && inv.ncc !== ncc) return false;
    // Month filter
    if (month && (!inv.ngay || !inv.ngay.startsWith(month))) return false;
    // Search query
    if (query) {
      const q = query.toLowerCase();
      const searchable = [inv.nd, inv.congtrinh, inv.loai, inv.nguoi, inv.ncc]
        .filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

// ══════════════════════════════════════════════════════════════
// SIDE-EFFECT CRUD — đọc/ghi qua window.load / window.save
// (gọi window.* tại call-time, không capture ở module level)
// ══════════════════════════════════════════════════════════════

/**
 * Đảm bảo cả projectId lẫn congtrinh nhất quán — phiên bản có side-effect,
 * dùng window.findProjectIdByName + window.getProjectById tại call-time.
 */
export function ensureInvRefLive(fields) {
  return ensureInvRef(
    fields,
    typeof window.findProjectIdByName === 'function' ? window.findProjectIdByName : null,
    typeof window.getProjectById === 'function' ? window.getProjectById : null
  );
}

/**
 * Hiển thị modal cảnh báo trùng.
 * @param {Array} dupRows - kết quả từ checkDuplicates (có thêm newRow, existing)
 * @param {Array} allRows - toàn bộ rows được truyền lại để forceSave dùng
 */
export function showDupModal(dupRows, allRows) {
  const overlay = document.getElementById('dup-modal-overlay');
  const body    = document.getElementById('dup-modal-body');
  const sub     = document.getElementById('dup-modal-subtitle');
  if (!overlay || !body || !sub) return;

  overlay._allRows = allRows;
  sub.textContent  = `Tìm thấy ${dupRows.length} hóa đơn có thể bị trùng`;

  const numFmtLocal = n => n ? n.toLocaleString('vi-VN') + 'đ' : '0đ';
  body.innerHTML = dupRows.map(d => {
    const pct   = Math.round(d.similarity * 100);
    const badge = d.isExact
      ? '<span class="dup-badge dup-badge-exact">Trùng hoàn toàn</span>'
      : `<span class="dup-badge dup-badge-fuzzy">Giống ${pct}%</span>`;
    const existTime = d.existing._ts
      ? new Date(d.existing._ts).toLocaleString('vi-VN')
      : d.existing.ngay || '';
    const payload = d.newRow?.payload || d.payload || {};
    return `<div class="dup-item">
      <div style="font-size:11px;font-weight:700;color:#f57f17;margin-bottom:6px">
        HĐ MỚI ${badge}
      </div>
      <div class="dup-item-row"><span class="dup-item-label">Ngày</span><span class="dup-item-val">${payload.ngay || ''}</span></div>
      <div class="dup-item-row"><span class="dup-item-label">Công trình</span><span class="dup-item-val">${payload.congtrinh || ''}</span></div>
      <div class="dup-item-row"><span class="dup-item-label">Số tiền</span>
        <span class="dup-item-val" style="color:var(--red);font-family:'IBM Plex Mono',monospace">${numFmtLocal(payload.tien)}</span>
      </div>
      <div class="dup-item-row"><span class="dup-item-label">Nội dung</span><span class="dup-item-val">${payload.nd || '(trống)'}</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ffe082;font-size:11px;color:#888">
        ↑ Trùng với HĐ đã lưu lúc ${existTime}:
        <span style="color:#555;font-weight:600">${d.existing.nd || '(trống)'}</span>
      </div>
    </div>`;
  }).join('');

  overlay.classList.add('open');
}

/**
 * Lưu thực sự một mảng rows vào inv_v3.
 * rows: [{tr, editId, payload}]
 */
export function doSaveRows(rows) {
  const invoices = window.load('inv_v3', []);
  const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';
  let saved = 0, updated = 0;
  rows.forEach(({ tr, editId, payload }) => {
    const p = ensureInvRefLive({
      ngay: payload.ngay, congtrinh: payload.congtrinh, loai: payload.loai,
      nguoi: payload.nguoi, ncc: payload.ncc, nd: payload.nd,
      tien: payload.tien, thanhtien: payload.tien,
      projectId: payload.projectId || null,
      source: 'quick'
    });
    if (editId) {
      const idx = invoices.findIndex(i => String(i.id) === String(editId));
      if (idx >= 0) {
        invoices[idx] = (typeof window.mkUpdate === 'function')
          ? window.mkUpdate(invoices[idx], p)
          : { ...invoices[idx], ...p, updatedAt: Date.now(), deviceId: DEVICE_ID };
        updated++;
      }
    } else {
      const rec = (typeof window.mkRecord === 'function')
        ? window.mkRecord(p)
        : { id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID, ...p };
      invoices.unshift(rec);
      saved++;
    }
    if (tr) tr.style.background = '#f0fff4';
  });

  clearInvoiceCache();
  window.save('inv_v3', invoices);
  if (typeof window.buildYearSelect === 'function') window.buildYearSelect();
  if (typeof window.updateTop === 'function') window.updateTop();

  if (updated > 0 && saved === 0)   if (typeof window.toast === 'function') window.toast(`✅ Đã cập nhật ${updated} hóa đơn!`, 'success');
  else if (saved > 0 && updated === 0) if (typeof window.toast === 'function') window.toast(`✅ Đã lưu ${saved} hóa đơn!`, 'success');
  else if (typeof window.toast === 'function') window.toast(`✅ Đã lưu ${saved} mới, cập nhật ${updated} hóa đơn!`, 'success');

  const eBtn = document.getElementById('entry-save-btn');
  if (eBtn) eBtn.textContent = '💾 Lưu Hóa Đơn';

  if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices();
  if (typeof window.buildFilters === 'function') window.buildFilters();
  if (typeof window.filterAndRender === 'function') window.filterAndRender();
}

/**
 * saveAllRows — đọc DOM bảng nhập nhanh, kiểm tra trùng, lưu.
 * @param {boolean} skipDupCheck
 */
export function saveAllRows(skipDupCheck) {
  const date = document.getElementById('entry-date')?.value;
  const todayFn = typeof window.today === 'function' ? window.today : () => new Date().toISOString().split('T')[0];
  if (!date) { if (typeof window.toast === 'function') window.toast('Vui lòng chọn ngày!', 'error'); return; }

  const rows    = [];
  let errRow    = 0;
  const invoices = window.load('inv_v3', []);
  const _readPid = typeof window._readPidFromSel === 'function' ? window._readPidFromSel : () => null;
  const _getProjById = typeof window.getProjectById === 'function' ? window.getProjectById : () => null;

  document.querySelectorAll('#entry-tbody tr').forEach(tr => {
    const loai  = (tr.querySelector('[data-f="loai"]')?.value || '').trim();
    const ctSel = tr.querySelector('[data-f="ct"]');
    const ct    = (ctSel?.value || '').trim();
    const ctPid = _readPid(ctSel);
    const tien  = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0', 10) || 0;
    if (!loai && !ct && !tien) return;
    if (!ct || !loai) { errRow++; tr.style.background = '#fdecea'; return; }
    if (ctPid && ctPid !== 'COMPANY') {
      const proj = _getProjById(ctPid);
      if (proj && proj.status === 'closed') { errRow++; tr.style.background = '#fdecea'; return; }
    }
    tr.style.background = '';
    rows.push({
      tr, editId: tr.dataset.editId || null,
      payload: {
        ngay: date, congtrinh: ct, loai,
        projectId: ctPid || null,
        nguoi: (tr.querySelector('[data-f="nguoi"]')?.value || '').trim(),
        ncc:   (tr.querySelector('[data-f="ncc"]')?.value   || '').trim(),
        nd:    (tr.querySelector('[data-f="nd"]')?.value    || '').trim(),
        tien
      }
    });
  });

  if (errRow > 0) { if (typeof window.toast === 'function') window.toast(`${errRow} dòng có lỗi (thiếu thông tin hoặc công trình đã quyết toán)!`, 'error'); return; }
  if (!rows.length) { if (typeof window.toast === 'function') window.toast('Không có dòng hợp lệ!', 'error'); return; }

  if (!skipDupCheck) {
    const newPayloads = rows.filter(r => !r.editId).map(r => r.payload);
    const dups = checkDuplicates(newPayloads, invoices);
    if (dups.length > 0) {
      // Map dup entries back to include newRow reference
      const dupRows = dups.map(d => ({
        ...d,
        newRow: rows.find(r => r.payload === d.payload) || { payload: d.payload }
      }));
      showDupModal(dupRows, rows);
      return;
    }
  }
  doSaveRows(rows);
}

/**
 * forceSaveAll — lưu bỏ qua kiểm tra trùng (gọi từ modal xác nhận).
 */
export function forceSaveAll() {
  if (typeof window.closeDupModal === 'function') window.closeDupModal();
  const overlay = document.getElementById('dup-modal-overlay');
  const allRows = overlay?._allRows;
  if (allRows) doSaveRows(allRows);
}

/**
 * saveDetailInvoice — lưu hóa đơn chi tiết từ form #inr-hd-chitiet.
 */
export function saveDetailInvoice() {
  const ngay = document.getElementById('detail-ngay')?.value;
  if (!ngay) { if (typeof window.toast === 'function') window.toast('Vui lòng chọn ngày!', 'error'); return; }
  const loai = document.getElementById('detail-loai')?.value;
  if (!loai) { if (typeof window.toast === 'function') window.toast('Vui lòng chọn loại chi phí!', 'error'); return; }
  const detCtSel = document.getElementById('detail-ct');
  const ct       = detCtSel?.value;
  const detCtPid = detCtSel?.selectedOptions?.[0]?.dataset?.pid || null;
  if (!ct) { if (typeof window.toast === 'function') window.toast('Vui lòng chọn công trình!', 'error'); return; }

  const detailNguoi = (document.getElementById('detail-nguoi')?.value || '').trim();
  const items = [];
  document.querySelectorAll('#detail-tbody tr').forEach(tr => {
    const ten    = (tr.querySelector('[data-f="ten"]')?.value    || '').trim();
    const dv     = (tr.querySelector('[data-f="dv"]')?.value     || '').trim();
    const sl     = parseFloat(tr.querySelector('[data-f="sl"]')?.value)    || 1;
    const dongia = parseInt(tr.querySelector('[data-f="dongia"]')?.dataset?.raw || '0') || 0;
    const ck     = (tr.querySelector('[data-f="ck"]')?.value     || '').trim();
    const thanhtien = parseInt(tr.dataset.tt || '0', 10) || 0;
    if (!ten && !dongia) return;
    items.push({ ten, dv, sl, dongia, ck, thanhtien });
  });
  if (!items.length) { if (typeof window.toast === 'function') window.toast('Chưa có dòng hàng hóa nào!', 'error'); return; }

  const tong        = parseInt(document.getElementById('detail-tong')?.dataset?.raw || '0') || 0;
  const nd          = (document.getElementById('detail-nd')?.value || '').trim();
  const ncc         = document.getElementById('detail-ncc')?.value || '';
  const footerCkStr = (document.getElementById('detail-footer-ck')?.value || '').trim();
  const container   = document.getElementById('inr-hd-chitiet');
  const editId      = container?.dataset?.editId;
  const DEVICE_ID   = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';

  const invFields = ensureInvRefLive({
    ngay, congtrinh: ct, loai, nguoi: detailNguoi, ncc, nd,
    tien: tong, thanhtien: tong, footerCkStr, items, source: 'detail',
    projectId: detCtPid || null
  });

  const invoices = window.load('inv_v3', []);
  if (editId) {
    const idx = invoices.findIndex(i => String(i.id) === String(editId));
    if (idx >= 0) {
      invoices[idx] = (typeof window.mkUpdate === 'function')
        ? window.mkUpdate(invoices[idx], invFields)
        : { ...invoices[idx], ...invFields, updatedAt: Date.now(), deviceId: DEVICE_ID };
      if (typeof window.toast === 'function') window.toast('✅ Đã cập nhật hóa đơn chi tiết!', 'success');
    } else {
      const rec = (typeof window.mkRecord === 'function')
        ? window.mkRecord(invFields)
        : { id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID, ...invFields };
      invoices.unshift(rec);
      if (typeof window.toast === 'function') window.toast('✅ Đã lưu hóa đơn chi tiết!', 'success');
    }
    if (container) container.dataset.editId = '';
  } else {
    const rec = (typeof window.mkRecord === 'function')
      ? window.mkRecord(invFields)
      : { id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null, deviceId: DEVICE_ID, ...invFields };
    invoices.unshift(rec);
    if (typeof window.toast === 'function') window.toast('✅ Đã lưu hóa đơn chi tiết!', 'success');
  }

  const saveBtn = document.getElementById('detail-save-btn');
  if (saveBtn) saveBtn.textContent = '💾 Lưu Hóa Đơn';

  clearInvoiceCache();
  window.save('inv_v3', invoices);
  if (typeof window.buildYearSelect === 'function') window.buildYearSelect();
  if (typeof window.updateTop === 'function') window.updateTop();
  if (typeof window.renderTodayInvoices === 'function') window.renderTodayInvoices();
  if (typeof window.buildFilters === 'function') window.buildFilters();
  if (typeof window.filterAndRender === 'function') window.filterAndRender();
  if (typeof window.clearDetailForm === 'function') window.clearDetailForm();
}

/**
 * delInvoice — soft-delete từ inv_v3 + thêm vào trash.
 */
export function delInvoice(id) {
  const invoices  = window.load('inv_v3', []);
  const inv       = invoices.find(i => String(i.id) === String(id));
  if (!inv) { if (typeof window.toast === 'function') window.toast('Không tìm thấy hóa đơn!', 'error'); return; }
  if (inv.ccKey || inv.source === 'cc') {
    if (typeof window.toast === 'function') window.toast('⚠️ Không thể xóa hóa đơn từ chấm công! Hãy chỉnh sửa tại tab Chấm Công.', 'error');
    return;
  }
  if (!confirm('Xóa hóa đơn này? (Có thể khôi phục từ Thùng Rác)')) return;

  const now       = Date.now();
  const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';
  const idx       = invoices.findIndex(i => String(i.id) === String(id));
  if (idx >= 0) {
    invoices[idx] = { ...invoices[idx], deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
  }
  clearInvoiceCache();
  window.save('inv_v3', invoices);
  trashAddLive({ ...inv });
  if (typeof window.updateTop === 'function') window.updateTop();
  if (typeof window.buildFilters === 'function') window.buildFilters();
  if (typeof window.filterAndRender === 'function') window.filterAndRender();
  if (typeof window.renderTrash === 'function') window.renderTrash();
  if (typeof window.toast === 'function') window.toast('Đã xóa (có thể khôi phục trong Thùng Rác)');
}

/**
 * trashAddLive — side-effect: thêm inv vào trash_v1, giới hạn 200.
 */
export function trashAddLive(inv) {
  const trash = window.load('trash_v1', []);
  inv._deletedAt = new Date().toISOString();
  trash.unshift(inv);
  if (trash.length > 200) trash.length = 200;
  window.save('trash_v1', trash);
}

/**
 * trashClearAll — xóa toàn bộ thùng rác (sau khi user confirm).
 */
export function trashClearAll() {
  const trash = window.load('trash_v1', []);
  if (!trash.length) return;
  if (!confirm(`Xóa vĩnh viễn ${trash.length} hóa đơn trong thùng rác?\nKhông thể khôi phục!`)) return;
  window.save('trash_v1', []);
  if (typeof window.renderTrash === 'function') window.renderTrash();
  if (typeof window.toast === 'function') window.toast('Đã xóa toàn bộ thùng rác', 'success');
}

/**
 * trashRestoreLive — khôi phục HĐ từ trash, xóa deletedAt trong inv_v3.
 */
export function trashRestoreLive(id) {
  const trash     = window.load('trash_v1', []);
  const invoices  = window.load('inv_v3', []);
  const idx       = trash.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return;
  const now       = Date.now();
  const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';

  const invIdx = invoices.findIndex(i => String(i.id) === String(id));
  if (invIdx >= 0) {
    invoices[invIdx] = { ...invoices[invIdx], deletedAt: null, updatedAt: now, deviceId: DEVICE_ID };
  } else {
    const inv = { ...trash[idx] };
    delete inv._deletedAt;
    inv.deletedAt = null;
    inv.updatedAt = now;
    inv.deviceId  = DEVICE_ID;
    invoices.unshift(inv);
  }
  trash.splice(idx, 1);
  clearInvoiceCache();
  window.save('inv_v3', invoices);
  window.save('trash_v1', trash);
  if (typeof window.updateTop === 'function') window.updateTop();
  if (typeof window.buildFilters === 'function') window.buildFilters();
  if (typeof window.filterAndRender === 'function') window.filterAndRender();
  if (typeof window.renderTrash === 'function') window.renderTrash();
  if (typeof window.toast === 'function') window.toast('✅ Đã khôi phục hóa đơn!', 'success');
}

/**
 * trashDeletePermanentLive — xóa vĩnh viễn 1 HĐ khỏi trash.
 */
export function trashDeletePermanentLive(id) {
  const trash = window.load('trash_v1', []);
  const newTrash = trash.filter(i => String(i.id) !== String(id));
  window.save('trash_v1', newTrash);
  if (typeof window.renderTrash === 'function') window.renderTrash();
  if (typeof window.toast === 'function') window.toast('Đã xóa vĩnh viễn', 'success');
}

/**
 * editManualInvoice — mở form chỉnh sửa HĐ nhập tay (phân biệt detail/quick).
 */
export function editManualInvoice(id) {
  const invoices = window.load('inv_v3', []);
  const inv = invoices.find(i => !i.deletedAt && !i.ccKey && String(i.id) === String(id));
  if (!inv) return;
  const src = inv.source === 'detail' || (inv.items && inv.items.length) ? 'detail' : 'quick';
  if (src === 'detail') {
    if (typeof window.openDetailEdit === 'function') window.openDetailEdit(inv);
  } else {
    if (typeof window.openEntryEdit === 'function') window.openEntryEdit(inv);
  }
}

/**
 * openDetailEdit — chuyển sang form chi tiết và nạp dữ liệu HĐ.
 * Yêu cầu: inv phải có items array.
 */
export function openDetailEdit(inv) {
  if (!Array.isArray(inv.items) || !inv.items.length) {
    if (typeof window.toast === 'function') window.toast('⚠️ Hóa đơn này không có dữ liệu chi tiết (items bị thiếu). Vui lòng kiểm tra lại.', 'error');
    return;
  }
  const navBtn = document.querySelector('.nav-btn[data-page="nhap"]');
  if (navBtn && typeof window.goPage === 'function') window.goPage(navBtn, 'nhap');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const _x = typeof window.x === 'function' ? window.x : s => String(s || '');
  const parseMoney  = typeof window.parseMoney === 'function' ? window.parseMoney : () => 0;
  const numFmtLocal = typeof window.numFmt === 'function' ? window.numFmt : n => n;
  const todayFn = typeof window.today === 'function' ? window.today : () => new Date().toISOString().split('T')[0];

  setTimeout(() => {
    const innerBtn = document.querySelector('.inner-sub-btn[onclick*="inr-hd-chitiet"]');
    if (innerBtn && typeof window.goInnerSub === 'function') window.goInnerSub(innerBtn, 'inr-hd-chitiet');

    const ngayEl = document.getElementById('detail-ngay');
    if (ngayEl) ngayEl.value = inv.ngay || todayFn();

    const loaiSel = document.getElementById('detail-loai');
    if (loaiSel) {
      const cats = window.cats || {};
      loaiSel.innerHTML = '<option value="">-- Chọn Loại --</option>' +
        (cats.loaiChiPhi || []).map(v => `<option value="${_x(v)}" ${v === (inv.loai || '') ? 'selected' : ''}>${_x(v)}</option>`).join('');
    }

    const dCtSel = document.getElementById('detail-ct');
    if (dCtSel && typeof window._buildProjOpts === 'function') {
      dCtSel.innerHTML = window._buildProjOpts(inv.congtrinh || '', '-- Chọn Công Trình --');
      dCtSel.value = inv.congtrinh || '';
      if (inv.congtrinh && !dCtSel.value) {
        const orphan = document.createElement('option');
        orphan.value = inv.congtrinh;
        orphan.textContent = inv.congtrinh + ' (*)';
        if (inv.projectId) orphan.dataset.pid = inv.projectId;
        dCtSel.appendChild(orphan);
        dCtSel.value = inv.congtrinh;
      }
    }

    if (typeof window.setSelectFlexible === 'function') {
      window.setSelectFlexible(document.getElementById('detail-ncc'),   inv.ncc);
      window.setSelectFlexible(document.getElementById('detail-nguoi'), inv.nguoi);
    }

    const tbody = document.getElementById('detail-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const itemList = Array.isArray(inv.items) ? inv.items : [];
      if (typeof window.addDetailRow === 'function') {
        itemList.forEach(item => window.addDetailRow(item));
        const needed = Math.max(0, 5 - itemList.length);
        for (let i = 0; i < needed; i++) window.addDetailRow();
      }
    }

    const ndEl = document.getElementById('detail-nd');
    if (ndEl) ndEl.value = inv.nd || '';

    const ckEl = document.getElementById('detail-footer-ck');
    if (ckEl) {
      const ckRaw = inv.footerCkStr || '';
      ckEl.value = (ckRaw && !ckRaw.endsWith('%'))
        ? (() => { const n = parseMoney(ckRaw); return n ? numFmtLocal(n) : ckRaw; })()
        : ckRaw;
    }
    if (typeof window.calcDetailTotals === 'function') window.calcDetailTotals();

    const container = document.getElementById('inr-hd-chitiet');
    if (container) container.dataset.editId = String(inv.id);
    const saveBtn = document.getElementById('detail-save-btn');
    if (saveBtn) saveBtn.textContent = '💾 Cập Nhật';
    if (typeof window.toast === 'function') window.toast('✏️ Chỉnh sửa hóa đơn chi tiết rồi nhấn 💾 Cập Nhật', 'success');
  }, 120);
}

/**
 * openEntryEdit — chuyển sang form nhập nhanh và nạp dữ liệu HĐ.
 */
export function openEntryEdit(inv) {
  const navBtn = document.querySelector('.nav-btn[data-page="nhap"]');
  if (navBtn && typeof window.goPage === 'function') window.goPage(navBtn, 'nhap');
  const subBtn = document.querySelector('.sub-nav-btn[onclick*="sub-nhap-hd"]');
  if (subBtn && !subBtn.classList.contains('active') && typeof window.goSubPage === 'function') {
    window.goSubPage(subBtn, 'sub-nhap-hd');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const todayFn = typeof window.today === 'function' ? window.today : () => new Date().toISOString().split('T')[0];

  setTimeout(() => {
    const innerBtn = document.querySelector('.inner-sub-btn[onclick*="inr-nhap-nhanh"]');
    if (innerBtn && typeof window.goInnerSub === 'function') window.goInnerSub(innerBtn, 'inr-nhap-nhanh');

    const dateEl = document.getElementById('entry-date');
    if (dateEl) dateEl.value = inv.ngay || todayFn();

    const tbody = document.getElementById('entry-tbody');
    if (tbody) tbody.innerHTML = '';

    if (typeof window.addRow === 'function') {
      window.addRow({ loai: inv.loai, congtrinh: inv.congtrinh,
        nguoi: inv.nguoi || '', ncc: inv.ncc || '', nd: inv.nd || '', tien: inv.tien || 0 });
    }
    const row = document.querySelector('#entry-tbody tr');
    if (row) {
      row.dataset.editId = String(inv.id);
      if (typeof window.setSelectFlexible === 'function') {
        window.setSelectFlexible(row.querySelector('[data-f="ncc"]'),   inv.ncc);
        window.setSelectFlexible(row.querySelector('[data-f="nguoi"]'), inv.nguoi);
        window.setSelectFlexible(row.querySelector('[data-f="loai"]'),  inv.loai);
      }
    }
    if (typeof window.calcSummary === 'function') window.calcSummary();
    const eBtn = document.getElementById('entry-save-btn');
    if (eBtn) eBtn.textContent = '💾 Cập nhật';
    if (typeof window.toast === 'function') window.toast('✏️ Chỉnh sửa rồi nhấn 💾 Cập nhật', 'success');
  }, 100);
}

/**
 * editCCInvoice — chuyển sang tab Chấm Công và tải đúng tuần+CT.
 */
export function editCCInvoice(ccKeyOrId) {
  const key   = String(ccKeyOrId);
  const parts = key.split('|');
  if (parts.length < 3 || parts[0] !== 'cc') return;
  const fromDate = parts[1], ct = parts[2];

  const navBtn = document.querySelector('.nav-btn[data-page="chamcong"]');
  if (navBtn && typeof window.goPage === 'function') window.goPage(navBtn, 'chamcong');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const snapFn  = typeof window.snapToSunday === 'function' ? window.snapToSunday : d => d;
  const satFn   = typeof window.ccSaturdayISO === 'function' ? window.ccSaturdayISO : d => d;
  const wkLabel = typeof window.weekLabel === 'function' ? window.weekLabel : () => '';
  const sunFn   = typeof window.ccSundayISO === 'function' ? window.ccSundayISO : () => fromDate;
  const viShortFn = typeof window.viShort === 'function' ? window.viShort : d => d;

  const sunISO = snapFn(fromDate);
  const satISO = satFn(sunISO);
  const fromEl = document.getElementById('cc-from');
  const toEl   = document.getElementById('cc-to');
  const lblEl  = document.getElementById('cc-week-label');
  if (fromEl) fromEl.value = sunISO;
  if (toEl)   toEl.value   = satISO;
  if (lblEl)  lblEl.textContent = 'Tuần: ' + wkLabel(sunISO);

  const thisSun = sunFn(0);
  const [ty, tm, td] = thisSun.split('-').map(Number);
  const [fy, fm, fd] = sunISO.split('-').map(Number);
  if (typeof window.ccOffset !== 'undefined') {
    window.ccOffset = Math.round((new Date(fy, fm - 1, fd) - new Date(ty, tm - 1, td)) / (7 * 86400000));
  }

  setTimeout(() => {
    const ctSel = document.getElementById('cc-ct-sel');
    if (ctSel) {
      if (![...ctSel.options].find(o => o.value === ct)) {
        const o = document.createElement('option');
        o.value = ct; o.textContent = ct;
        ctSel.appendChild(o);
      }
      ctSel.value = ct;
    }
    if (typeof window.loadCCWeekForm === 'function') window.loadCCWeekForm();
    else if (typeof window.ccGoToWeek === 'function') window.ccGoToWeek(window.ccOffset || 0);
    if (typeof window.toast === 'function') window.toast('✏️ Đang xem tuần ' + viShortFn(sunISO) + ' — ' + ct, 'success');
  }, 50);
}

/**
 * saveEditInvoice — lưu từ modal sửa nhanh (#edit-inv-overlay).
 */
export function saveEditInvoice(id) {
  const invoices = window.load('inv_v3', []);
  const idx = invoices.findIndex(i => String(i.id) === String(id));
  if (idx < 0) return;
  const DEVICE_ID = window.DEVICE_ID || localStorage.getItem('deviceId') || 'unknown';

  const tien   = parseInt(document.getElementById('ei-tien')?.value) || 0;
  const ctSel  = document.getElementById('ei-ct');
  const ctName = ctSel?.value || '';
  const ctPid  = ctSel?.selectedOptions?.[0]?.dataset?.pid || null;

  const changes = {
    ngay: document.getElementById('ei-ngay')?.value || '',
    loai: document.getElementById('ei-loai')?.value || '',
    congtrinh: ctName, projectId: ctPid || null,
    nguoi: (document.getElementById('ei-nguoi')?.value || '').trim(),
    nd:    (document.getElementById('ei-nd')?.value    || '').trim(),
    tien, thanhtien: tien
  };

  invoices[idx] = (typeof window.mkUpdate === 'function')
    ? window.mkUpdate(invoices[idx], changes)
    : { ...invoices[idx], ...changes, updatedAt: Date.now(), deviceId: DEVICE_ID };

  clearInvoiceCache();
  window.save('inv_v3', invoices);
  document.getElementById('edit-inv-overlay')?.remove();
  if (typeof window.buildFilters === 'function') window.buildFilters();
  if (typeof window.filterAndRender === 'function') window.filterAndRender();
  if (typeof window.updateTop === 'function') window.updateTop();
  if (typeof window.toast === 'function') window.toast('✅ Đã cập nhật hóa đơn!', 'success');
}

/**
 * showEditInvoiceModal — hiển thị modal sửa nhanh cho 1 HĐ.
 */
export function showEditInvoiceModal(inv) {
  const cats    = window.cats || {};
  const _x      = typeof window.x      === 'function' ? window.x      : s => String(s || '');
  const activeYear = window.activeYear || 0;
  const _ctInAY = typeof window._ctInActiveYear === 'function' ? window._ctInActiveYear : () => true;
  const getAllPr = typeof window.getAllProjects === 'function' ? window.getAllProjects : () => [];

  let ov = document.getElementById('edit-inv-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'edit-inv-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.onclick = function (e) { if (e.target === this) this.remove(); };
    document.body.appendChild(ov);
  }

  const _allProj = getAllPr().filter(p =>
    activeYear === 0 || p.id === 'COMPANY' || p.status !== 'closed' ||
    p.name === inv.congtrinh || _ctInAY(p.name)
  );
  const ctOpts   = _allProj.map(p => `<option value="${_x(p.name)}" data-pid="${p.id}" ${p.name === inv.congtrinh ? 'selected' : ''}>${_x(p.name)}</option>`).join('');
  const loaiOpts = (cats.loaiChiPhi || []).map(v => `<option value="${_x(v)}" ${v === inv.loai ? 'selected' : ''}>${_x(v)}</option>`).join('');

  ov.innerHTML = `<div style="background:#fff;border-radius:14px;padding:24px;width:min(480px,96vw);box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:'IBM Plex Sans',sans-serif" onclick="event.stopPropagation()">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700">✏️ Sửa Hóa Đơn</h3>
      <button onclick="document.getElementById('edit-inv-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>
    </div>
    <div style="display:grid;gap:10px">
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Ngày</label><input id="ei-ngay" type="date" value="${inv.ngay || ''}" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Loại Chi Phí</label><select id="ei-loai" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><option value="">-- Chọn --</option>${loaiOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Công Trình</label><select id="ei-ct" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><option value="">-- Chọn --</option>${ctOpts}</select></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Người TH</label><input id="ei-nguoi" type="text" value="${_x(inv.nguoi || '')}" list="ei-dl" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"><datalist id="ei-dl">${(cats.nguoiTH || []).map(v => `<option value="${_x(v)}">`).join('')}</datalist></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Nội Dung</label><input id="ei-nd" type="text" value="${_x(inv.nd || '')}" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
      <div><label style="font-size:12px;font-weight:600;color:#555;display:block;margin-bottom:3px">Số Tiền (đ)</label><input id="ei-tien" type="number" value="${inv.tien || 0}" inputmode="decimal" style="width:100%;padding:8px 10px;border:1.5px solid #ddd;border-radius:7px;font-family:inherit;font-size:13px;outline:none"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="document.getElementById('edit-inv-overlay').remove()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #ddd;background:#fff;font-family:inherit;font-size:13px;cursor:pointer">Hủy</button>
      <button onclick="saveEditInvoice('${inv.id}')" style="flex:2;padding:10px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">💾 Cập Nhật</button>
    </div>
  </div>`;
  ov.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════
// 🔌 BRIDGE TẠM
// ══════════════════════════════════════════════════════════════
// Override global functions cho backward compat
window._invoiceLogic = {
  buildInvoices, getInvoicesCached, clearInvoiceCache,
  ensureInvRef, ensureInvRefLive, strSimilarity, checkDuplicates,
  calcRowMoney,
  // Pure trash helpers
  trashAdd, trashRestore, trashDelete,
  // Side-effect versions
  trashAddLive, trashClearAll, trashRestoreLive, trashDeletePermanentLive,
  // Save / edit operations
  showDupModal, doSaveRows, saveAllRows, forceSaveAll,
  saveDetailInvoice, delInvoice,
  editManualInvoice, openDetailEdit, openEntryEdit, editCCInvoice,
  saveEditInvoice, showEditInvoiceModal,
  filterInvoices,
};

// Direct window bridges — gọi từ index.html onclick / legacy scripts
window.saveAllRows            = saveAllRows;
window.forceSaveAll           = forceSaveAll;
window.saveDetailInvoice      = saveDetailInvoice;
window.delInvoice             = delInvoice;
window.trashClearAll          = trashClearAll;
window.trashRestore           = trashRestoreLive;       // override legacy
window.trashDeletePermanent   = trashDeletePermanentLive;
window.editManualInvoice      = editManualInvoice;
window.openDetailEdit         = openDetailEdit;
window.openEntryEdit          = openEntryEdit;
window.editCCInvoice          = editCCInvoice;
window.saveEditInvoice        = saveEditInvoice;
window.showEditInvoiceModal   = showEditInvoiceModal;

console.log('[invoice.logic] ES Module loaded ✅');
