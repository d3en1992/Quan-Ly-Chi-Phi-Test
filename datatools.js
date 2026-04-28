// datatools.js — Quản lý dữ liệu: JSON backup/restore + Xóa năm + Reset toàn bộ
// Load order: sau nhapxuat.js

'use strict';

// ══════════════════════════════════════════════════════════════
// [1] MISC
// ══════════════════════════════════════════════════════════════

function openDeleteModal() {
  toast('Tính năng Xóa Dữ Liệu đã bị tắt.', 'error');
}

// ══════════════════════════════════════════════════════════════
// [2] DATA MANAGEMENT — Xóa theo năm / Reset toàn bộ
// ══════════════════════════════════════════════════════════════

// Confirm modal yêu cầu gõ "DELETE"
function _showDeleteConfirm(title, bodyHtml, onConfirm) {
  const existing = document.getElementById('_del-confirm-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_del-confirm-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:24px;max-width:420px;width:100%;
                box-shadow:0 8px 32px rgba(0,0,0,.28);font-family:inherit">
      <div style="font-size:15px;font-weight:700;color:#c0392b;margin-bottom:10px">${title}</div>
      <div style="font-size:13px;color:#333;line-height:1.65;margin-bottom:16px">${bodyHtml}</div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;color:#555;display:block;margin-bottom:6px">
          Gõ <strong>DELETE</strong> để xác nhận:
        </label>
        <input id="_del-inp" type="text" autocomplete="off" placeholder="DELETE"
          style="width:100%;box-sizing:border-box;padding:8px 12px;border:2px solid #e74c3c;
                 border-radius:6px;font-size:14px;font-family:monospace;letter-spacing:2px;outline:none">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_del-cancel" style="padding:8px 18px;border:1px solid #ccc;border-radius:6px;
          background:#f5f5f5;cursor:pointer;font-size:13px">Huỷ</button>
        <button id="_del-ok" style="padding:8px 18px;border:none;border-radius:6px;
          background:#e74c3c;color:#fff;cursor:pointer;font-size:13px;font-weight:700;opacity:.45" disabled>
          Xoá
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const inp    = overlay.querySelector('#_del-inp');
  const okBtn  = overlay.querySelector('#_del-ok');
  const canBtn = overlay.querySelector('#_del-cancel');

  inp.addEventListener('input', () => {
    const ok = inp.value.trim() === 'DELETE';
    okBtn.disabled = !ok;
    okBtn.style.opacity = ok ? '1' : '.45';
  });
  canBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  okBtn.addEventListener('click', () => {
    if (inp.value.trim() !== 'DELETE') return;
    overlay.remove();
    onConfirm();
  });
  setTimeout(() => inp.focus(), 60);
}

// Helper: cập nhật cats global + _mem + IDB
function _saveCatKey(catsKey, lsKey, arr) {
  if (typeof cats !== 'undefined' && cats) cats[catsKey] = arr;
  if (typeof _memSet === 'function') _memSet(lsKey, arr); // ghi _mem + IDB (hoặc LS nếu LS-only)
  else if (typeof _dbSave === 'function') _dbSave(lsKey, arr).catch(() => {}); // fallback
}

// ── Xóa dữ liệu theo năm ─────────────────────────────────────

function toolDeleteYear() {
  if (typeof isSyncing === 'function' && isSyncing()) {
    toast('⚠️ Đang đồng bộ dữ liệu, vui lòng chờ', 'error'); return;
  }
  const yr = (typeof activeYear !== 'undefined') ? String(activeYear) : '0';
  if (!yr || yr === '0') {
    toast('Chọn một năm cụ thể (không phải "Tất cả") rồi mới xóa.', 'error');
    return;
  }

  _showDeleteConfirm(
    `🗑 Xóa dữ liệu năm ${yr}`,
    `Thao tác sẽ <b>xóa vĩnh viễn</b> tất cả hóa đơn, tiền ứng, chấm công, thu tiền,
     hợp đồng của năm <b>${yr}</b>.<br><br>
     • App tự động backup trước khi xóa.<br>
     • Danh mục công trình không còn được dùng sẽ bị xóa theo.<br>
     • Thiết bị của công trình bị xóa sẽ chuyển về <b>KHO TỔNG</b>.`,
    () => _doDeleteYear(yr)
  );
}

async function _doDeleteYear(yr) {
  if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang xóa dữ liệu năm ' + yr + '...');
  try {
    // 1. Auto-backup
    if (typeof _snapshotNow === 'function') _snapshotNow('pre-delete-' + yr);

    const now     = Date.now();
    const devId   = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
    const softDel = r => ({ ...r, deletedAt: now, updatedAt: now, deviceId: devId });
    const matchYr = (r, field) => !r.deletedAt && r[field] && String(r[field]).startsWith(yr);

    // 2. Soft-delete records matching the year
    if (typeof invoices          !== 'undefined')
      invoices          = invoices.map(r => matchYr(r, 'ngay')     ? softDel(r) : r);
    if (typeof ungRecords        !== 'undefined')
      ungRecords        = ungRecords.map(r => matchYr(r, 'ngay')   ? softDel(r) : r);
    if (typeof ccData            !== 'undefined')
      ccData            = ccData.map(r => matchYr(r, 'fromDate')   ? softDel(r) : r);
    if (typeof thuRecords        !== 'undefined')
      thuRecords        = thuRecords.map(r => matchYr(r, 'ngay')   ? softDel(r) : r);
    if (typeof thauPhuContracts  !== 'undefined')
      thauPhuContracts  = thauPhuContracts.map(r => matchYr(r, 'ngay') ? softDel(r) : r);

    // hopDongData là object keyed by projectId (hoặc CT name nếu chưa migrate)
    if (typeof hopDongData !== 'undefined' && hopDongData && typeof hopDongData === 'object') {
      Object.keys(hopDongData).forEach(ct => {
        const hd = hopDongData[ct];
        if (hd && !hd.deletedAt && hd.ngay && String(hd.ngay).startsWith(yr))
          hopDongData[ct] = softDel(hd);
      });
    }

    // 3. Tính các CT còn được dùng sau khi xóa (toàn bộ năm)
    const _activeCTs = arr => (arr || []).filter(r => !r.deletedAt).map(r => r.congtrinh).filter(Boolean);
    const usedCT = new Set([
      ..._activeCTs(typeof invoices         !== 'undefined' ? invoices         : []),
      ..._activeCTs(typeof ungRecords       !== 'undefined' ? ungRecords       : []),
      ..._activeCTs(typeof ccData           !== 'undefined' ? ccData           : []),
      ..._activeCTs(typeof thuRecords       !== 'undefined' ? thuRecords       : []),
      ..._activeCTs(typeof thauPhuContracts !== 'undefined' ? thauPhuContracts : []),
      ...Object.keys(typeof hopDongData !== 'undefined' && hopDongData ? hopDongData : {})
          .filter(ct => !((hopDongData[ct] || {}).deletedAt)),
    ]);

    // 4. Chuyển thiết bị của CT bị xóa → KHO TỔNG
    let movedEq = 0;
    if (typeof tbData !== 'undefined') {
      tbData = tbData.map(r => {
        if (!r.deletedAt && r.ct && !usedCT.has(r.ct)) {
          movedEq++;
          return { ...r, ct: 'KHO TỔNG', projectId: null, updatedAt: now, deviceId: devId };
        }
        return r;
      });
    }
    if (movedEq) console.log(`[DeleteYear] ${movedEq} thiết bị → KHO TỔNG`);

    // 5. Dọn danh mục không còn được tham chiếu
    const _prune = (arr, usedSet) => (arr || []).filter(v => usedSet.has(v));
    const _catArr = key => (typeof cats !== 'undefined' && cats ? (cats[key] || []) : []);

    // cat_ct là derived data — KHÔNG prune trực tiếp; rebuild từ projects_v1
    if (typeof rebuildCatCTFromProjects === 'function') rebuildCatCTFromProjects();

    const usedNCC   = new Set((typeof invoices !== 'undefined' ? invoices : [])
                        .filter(r => !r.deletedAt).map(r => r.ncc).filter(Boolean));
    const usedNguoi = new Set((typeof invoices !== 'undefined' ? invoices : [])
                        .filter(r => !r.deletedAt).map(r => r.nguoi).filter(Boolean));
    const usedTP    = new Set([
      ...(typeof ungRecords !== 'undefined' ? ungRecords : [])
          .filter(r => !r.deletedAt && r.loai === 'thauphu').map(r => r.tp),
      ...(typeof thauPhuContracts !== 'undefined' ? thauPhuContracts : [])
          .filter(r => !r.deletedAt).map(r => r.thauphu),
    ].filter(Boolean));
    const usedCN    = new Set((typeof ungRecords !== 'undefined' ? ungRecords : [])
                        .filter(r => !r.deletedAt && r.loai === 'congnhan').map(r => r.tp)
                        .filter(Boolean));

    _saveCatKey('nhaCungCap', 'cat_ncc',   _prune(_catArr('nhaCungCap'), usedNCC));
    _saveCatKey('nguoiTH',    'cat_nguoi', _prune(_catArr('nguoiTH'),    usedNguoi));
    _saveCatKey('thauPhu',    'cat_tp',    _prune(_catArr('thauPhu'),    usedTP));
    _saveCatKey('congNhan',   'cat_cn',    _prune(_catArr('congNhan'),   usedCN));
    // Dọn tên thiết bị không còn bất kỳ record nào trong toàn bộ tbData (không giới hạn năm)
    const usedTbTen = new Set((typeof tbData !== 'undefined' ? tbData : [])
                        .filter(r => !r.deletedAt).map(r => r.ten).filter(Boolean));
    _saveCatKey('tbTen',      'cat_tbteb', _prune(_catArr('tbTen'),      usedTbTen));

    // 6. Ghi xuống localStorage + IDB + enqueue sync
    if (typeof save === 'function') {
      if (typeof clearInvoiceCache === 'function') clearInvoiceCache();
      if (typeof invoices          !== 'undefined') save('inv_v3',     invoices);
      if (typeof ungRecords        !== 'undefined') save('ung_v1',     ungRecords);
      if (typeof ccData            !== 'undefined') save('cc_v2',      ccData);
      if (typeof thuRecords        !== 'undefined') save('thu_v1',     thuRecords);
      if (typeof thauPhuContracts  !== 'undefined') save('thauphu_v1', thauPhuContracts);
      if (typeof tbData            !== 'undefined') save('tb_v1',      tbData);
    }
    if (typeof hopDongData !== 'undefined')
      _memSet('hopdong_v1', hopDongData); // ghi _mem + IDB

    // Push lên cloud qua nút 🔄 Sync (không auto push)
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    const eqMsg = movedEq ? ` · ${movedEq} thiết bị → KHO TỔNG` : '';
    toast(`✅ Đã xóa dữ liệu năm ${yr}${eqMsg}`, 'success');

    // 8. Refresh UI
    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();
    else if (typeof renderDanhMuc === 'function') renderDanhMuc();

  } catch (e) {
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    console.error('[DeleteYear] Lỗi:', e);
    toast('❌ Lỗi khi xóa dữ liệu: ' + (e.message || String(e)), 'error');
  }
}

// ── Reset toàn bộ dữ liệu ────────────────────────────────────

function toolResetAll() {
  // Bảo vệ offline — reset khi offline có thể mất cloud data vĩnh viễn
  if (!navigator.onLine) {
    toast('🔴 Không có mạng — không thể reset (cần online để xóa dữ liệu cloud)', 'error');
    return;
  }
  if (typeof isSyncing === 'function' && isSyncing()) {
    toast('⚠️ Đang đồng bộ dữ liệu, vui lòng chờ', 'error'); return;
  }
  _showDeleteConfirm(
    '⚠️ Reset toàn bộ dữ liệu',
    `Thao tác sẽ <b>xóa TOÀN BỘ</b> dữ liệu:<br>
     hóa đơn, chấm công, tiền ứng, thu tiền, hợp đồng, danh mục, thiết bị...<br><br>
     • App tự động backup trước khi reset.<br>
     • <b>Không thể hoàn tác</b> sau khi xác nhận.<br>
     • Cloud sẽ được đồng bộ trạng thái trống.`,
    _doResetAll
  );
}

async function _doResetAll() {
  if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang reset toàn bộ dữ liệu...');
  try {
    // 1. Auto-backup
    if (typeof _snapshotNow === 'function') _snapshotNow('pre-reset-all');

    // 2. Thu thập tất cả năm TRƯỚC KHI xóa
    const yearsToWipe = (typeof _getAllLocalYears === 'function')
      ? _getAllLocalYears()
      : [String(new Date().getFullYear())];

    // ── QUAN TRỌNG: soft-delete trước khi push Firebase ──────────
    // Vấn đề nếu push [] rỗng: mergeUnique(localData, []) = localData không đổi
    // → thiết bị khác (Chrome thường) F5 xong vẫn thấy đầy đủ dữ liệu
    // Fix: ghi soft-deleted records (deletedAt = now) lên Firebase trước
    // → mergeUnique thấy bản Firebase có updatedAt mới hơn → overwrite local deletedAt
    // → UI ẩn hết bản ghi → thiết bị khác thấy trống
    const now   = Date.now();
    const devId = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
    const _softDelArr = key => (typeof load === 'function' ? load(key, []) : []).map(r =>
      r.deletedAt ? r : { ...r, deletedAt: now, updatedAt: now, deviceId: devId }
    );

    // 3. Ghi soft-deleted vào _mem (tạm) để fbYearPayload/load() đọc được
    // Không ghi IDB vì step 8 sẽ clear IDB; chỉ cần _mem cho fbYearPayload đọc
    ['inv_v3','ung_v1','cc_v2','tb_v1','thu_v1','thauphu_v1'].forEach(k => {
      _mem[k] = _softDelArr(k);
    });

    // hopDongData là object, xử lý riêng
    const existingHd = (typeof load === 'function') ? load('hopdong_v1', {}) : {};
    const softHd = {};
    Object.keys(existingHd).forEach(ct => {
      const hd = existingHd[ct];
      softHd[ct] = (hd && hd.deletedAt)
        ? hd
        : { ...(hd || {}), deletedAt: now, updatedAt: now, deviceId: devId };
    });
    _mem['hopdong_v1'] = softHd; // tạm trong _mem để fbYearPayload/fbCatsPayload đọc được

    // Chuẩn bị cats/settings rỗng trước khi push lên cloud
    const _emptyArrKeys = ['cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb','projects_v1','thauphu_v1'];
    _emptyArrKeys.forEach(k => { _mem[k] = []; });
    _mem['hopdong_v1'] = softHd; // đã set ở trên
    if (typeof cats !== 'undefined' && cats) {
      cats.congTrinh  = [];
      cats.loaiChiPhi = [];
      cats.nhaCungCap = [];
      cats.nguoiTH    = [];
      cats.thauPhu    = [];
      cats.congNhan   = [];
      if ('tbTen' in cats) cats.tbTen = [];
    }
    if (typeof projects !== 'undefined') projects = [];
    if (typeof thauPhuContracts !== 'undefined') thauPhuContracts = [];

    // 4. Push soft-deleted lên Firebase TRƯỚC KHI xóa localStorage
    if (typeof fbReady === 'function' && fbReady() &&
        typeof fsSet === 'function' && typeof fbYearPayload === 'function') {
      if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang xóa dữ liệu trên Cloud...');
      try {
        // fbYearPayload(yr) đọc từ _mem → trả về soft-deleted records
        for (const yr of yearsToWipe) {
          await fsSet(fbDocYear(parseInt(yr)), fbYearPayload(parseInt(yr)));
        }
        if (typeof fbCatsPayload === 'function' && typeof fbDocCats === 'function') {
          // Xóa cats + projects + contracts trong _mem TRƯỚC khi gọi fbCatsPayload()
          // Cat string-array không có soft-delete → phải push [] để cloud xóa sạch
          // (nếu giữ old cats trong _mem, cloud sẽ giữ nguyên danh mục → hồi về sau pull)
          ['cat_ct','cat_loai','cat_ncc','cat_nguoi',
           'cat_tp','cat_cn','cat_tbteb'].forEach(k => { _mem[k] = []; });
          _mem['projects_v1']  = [];
          _mem['thauphu_v1']   = [];
          _mem['hopdong_v1']   = {};

          // FIX: cat_items_v1 là nguồn gốc khiến danh mục hồi sinh sau reset+sync.
          // Phải soft-delete từng item (isDeleted:true) trước khi push lên Firebase,
          // để thiết bị khác pull về thấy isDeleted=true và không rebuild lại mảng.
          // Sau push, xóa local về {} — F5 + pull sẽ nhận tombstones và vẫn cho kết quả rỗng.
          const _existCatItems = load('cat_items_v1', {});
          if (Object.keys(_existCatItems).length) {
            const _softCatItems = {};
            Object.entries(_existCatItems).forEach(([type, arr]) => {
              _softCatItems[type] = (arr || []).map(item =>
                item.isDeleted ? item : { ...item, isDeleted: true, updatedAt: now }
              );
            });
            _mem['cat_items_v1'] = _softCatItems; // fbCatsPayload() đọc _mem này
          } else {
            _mem['cat_items_v1'] = {};
          }

          await fsSet(fbDocCats(), fbCatsPayload());
        }
        console.log('[ResetAll] ✅ Firebase soft-wiped — years:', yearsToWipe.join(', '));
      } catch (e) {
        console.warn('[ResetAll] Firebase wipe lỗi (bỏ qua):', e);
      }
    }

    // Chặn pull trong 5 phút sau reset — lưu vào localStorage để sống qua F5
    // (biến _blockPullUntil trong bộ nhớ sẽ mất khi reload, cần persist LS)
    const _blockTs = Date.now() + 5 * 60 * 1000;
    _blockPullUntil = _blockTs;
    localStorage.setItem('_blockPullUntil', String(_blockTs));
    console.log('[ResetAll] Pull bị chặn 5 phút để tránh cloud ghi đè local trống');

    // 5. Xóa data globals
    if (typeof invoices          !== 'undefined') invoices          = [];
    if (typeof ungRecords        !== 'undefined') ungRecords        = [];
    if (typeof ccData            !== 'undefined') ccData            = [];
    if (typeof tbData            !== 'undefined') tbData            = [];
    if (typeof thuRecords        !== 'undefined') thuRecords        = [];
    if (typeof thauPhuContracts  !== 'undefined') thauPhuContracts  = [];
    if (typeof hopDongData       !== 'undefined') hopDongData       = {};
    if (typeof trash             !== 'undefined') trash             = [];

    // 6. Xóa cats
    if (typeof cats !== 'undefined' && cats) {
      cats.congTrinh  = [];
      cats.nhaCungCap = [];
      cats.nguoiTH    = [];
      cats.loaiChiPhi = [];
      cats.thauPhu    = [];
      cats.congNhan   = [];
      if ('tbTen' in cats) cats.tbTen = [];
    }

    // 7. Xóa _mem về trạng thái trống (IDB sẽ bị clear ở bước 8)
    ['inv_v3','ung_v1','cc_v2','tb_v1','thu_v1','thauphu_v1','trash_v1',
     'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
     'projects_v1']
      .forEach(k => { _mem[k] = []; });
    _mem['hopdong_v1']   = {};
    _mem['cat_items_v1'] = {}; // FIX: xóa local sau khi đã push tombstones lên cloud
    if (typeof projects !== 'undefined') projects = [];

    // Xóa LS-only keys — những key này không nằm trong IDB nên phải xóa tay
    // Nếu bỏ sót: danh mục công trình / role công nhân vẫn còn sau reset
    ['cat_ct_years', 'cat_cn_roles'].forEach(k => {
      localStorage.removeItem(k);
      delete _mem[k];
    });
    if (typeof cats !== 'undefined' && cats) {
      cats.congTrinhYears = {};
    }
    if (typeof cnRoles !== 'undefined') cnRoles = {};

    // 8. Xóa IDB tables
    if (typeof db !== 'undefined' && db) {
      try {
        await Promise.all([
          db.invoices   ? db.invoices.clear()   : Promise.resolve(),
          db.attendance ? db.attendance.clear() : Promise.resolve(),
          db.equipment  ? db.equipment.clear()  : Promise.resolve(),
          db.ung        ? db.ung.clear()        : Promise.resolve(),
          db.revenue    ? db.revenue.clear()    : Promise.resolve(),
          db.categories ? db.categories.clear() : Promise.resolve(),
          db.settings   ? db.settings.clear()   : Promise.resolve(),
        ]);
      } catch (e) { console.warn('[ResetAll] IDB clear lỗi:', e); }
    }

    // QUAN TRỌNG: Sau khi clear IDB, ghi lại [] cho tất cả cat keys.
    // Nếu không làm bước này, F5 sẽ thấy IDB rỗng → load() dùng DEFAULTS
    // → cat_tbteb hồi sinh TB_TEN_MAY, cat_ct hồi sinh DEFAULTS.congTrinh, v.v.
    if (typeof _dbSave === 'function') {
      try {
        await Promise.all([
          'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
          'projects_v1'
        ].map(k => _dbSave(k, [])));
        await _dbSave('hopdong_v1',   {});
        await _dbSave('cat_items_v1', {}); // FIX: ghi rỗng vào IDB; F5 load về {} không dùng defaults
      } catch (e) { console.warn('[ResetAll] Ghi IDB rỗng lỗi:', e); }
    }

    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    if (typeof _resetPending === 'function') _resetPending(); // badge về 0 sau reset
    toast('✅ Đã reset toàn bộ dữ liệu', 'success');

    // 9. Refresh UI
    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();
    else if (typeof renderDanhMuc === 'function') renderDanhMuc();

  } catch (e) {
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    console.error('[ResetAll] Lỗi:', e);
    toast('❌ Lỗi khi reset: ' + (e.message || String(e)), 'error');
  }
}

// ═════════════════════════════════════
// [4] DASHBOARD
// ═════════════════════════════════════

// Dashboard CT filter (dùng trong page-dashboard)
var selectedCT = '';

// ══════════════════════════════════════════════════════════════
// [MODULE: DASHBOARD] — KPI · Bar chart · Pie · Top5 · By CT
// Tìm nhanh: Ctrl+F → "MODULE: DASHBOARD"
// ══════════════════════════════════════════════════════════════

function renderDashboard() {
  const ay = typeof activeYears !== 'undefined' ? activeYears : new Set();
  const yr = ay.size === 0 ? 0 : (ay.size === 1 ? [...ay][0] : 0);
  const yrLabel = ay.size === 0 ? 'Tất cả năm'
                : ay.size === 1 ? `Năm ${[...ay][0]}`
                : 'Năm ' + [...ay].sort((a,b)=>a-b).join(', ');
  _dbPopulateCTFilter();

  // Tầng 1: tổng quan năm (không filter CT)
  const dataYear = getInvoicesCached().filter(i => inActiveYear(i.ngay));

  // Tầng 2: chi tiết theo CT (có filter)
  const dataDetail = getInvoicesCached().filter(i =>
    inActiveYear(i.ngay) &&
    (!selectedCT || resolveProjectName(i) === selectedCT)
  );

  if (!dataYear.length) {
    ['db-kpi-row','db-bar-chart','db-pie-chart','db-top5','db-ung-ct','db-tb-ct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="db-empty">Chưa có dữ liệu cho ' + yrLabel + '</div>';
    });
    return;
  }

  // Tổng quan năm — không bị filter CT
  _dbKPI(dataYear, yr);
  _dbBarChart(dataYear);
  _dbPieChart(dataYear);

  // Chi tiết theo CT — bị filter khi chọn CT
  _dbTop5(dataDetail);
  _dbUngByCT();
  _dbTBByCT();

  renderCtPage();   // Chi tiết từng CT (gộp từ tab cũ)
}

// ── Populate CT filter dropdown (Dashboard) ────────────────────
function _dbPopulateCTFilter() {
  const sel = document.getElementById('db-filter-ct');
  if (!sel) return;
  sel.innerHTML = _buildProjFilterOpts(selectedCT, { includeCompany: false, placeholder: '-- Tất cả công trình --' });
}

// ── KPI Cards ─────────────────────────────────────────────────
function _dbKPI(data, yr) {
  const total   = data.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);
  const months  = new Set(data.map(i => i.ngay?.slice(0,7))).size;
  const avgMonth= months ? Math.round(total / months) : 0;
  const maxInv  = data.reduce((mx, i) => (i.thanhtien||i.tien||0) > (mx.thanhtien||mx.tien||0) ? i : mx, data[0]);
  const ctSet   = new Set(data.map(i => resolveProjectName(i)).filter(Boolean));

  const cards = [
    { label:'Tổng Chi Phí ' + yr,  val: fmtM(total),      sub: data.length + ' hóa đơn',         cls:'accent-gold'  },
    { label:'TB / Tháng',           val: fmtM(avgMonth),   sub: months + ' tháng có phát sinh',    cls:'accent-blue'  },
    { label:'HĐ Lớn Nhất',          val: fmtM(maxInv.thanhtien||maxInv.tien||0),
                                    sub: (maxInv.nd||maxInv.loai||'').slice(0,30),                  cls:'accent-red'   },
    { label:'Công Trình',           val: ctSet.size,       sub: 'đang theo dõi năm ' + yr,         cls:'accent-green' },
  ];

  document.getElementById('db-kpi-row').innerHTML = cards.map(k =>
    `<div class="db-kpi-card ${k.cls}">
       <div class="db-kpi-label">${k.label}</div>
       <div class="db-kpi-val">${k.val}</div>
       <div class="db-kpi-sub">${k.sub}</div>
     </div>`
  ).join('');
}

// ── Bar Chart theo tháng (SVG) — luôn hiện đủ T1→T12 ─────────
function _dbBarChart(data) {
  const byMonth = {};
  data.forEach(i => {
    const m = i.ngay?.slice(0,7);
    if (!m) return;
    byMonth[m] = (byMonth[m] || 0) + (i.thanhtien || i.tien || 0);
  });

  const _ay = typeof activeYears !== 'undefined' ? activeYears : new Set();
  const _singleYr = _ay.size === 1 ? [..._ay][0] : 0;
  const yr = _singleYr || new Date().getFullYear();
  const months12 = Array.from({length: 12}, (_, k) =>
    `${yr}-${String(k + 1).padStart(2, '0')}`
  );

  let vals;
  if (_ay.size !== 1) {
    // "Tất cả" hoặc multi-year → gộp theo số tháng (T1–T12)
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
  const H      = 160;
  const colW   = 40;
  const gap    = 5;
  const svgW   = 12 * (colW + gap);

  const bars = months12.map((m, i) => {
    const v   = vals[i];
    const h   = Math.round((v / maxVal) * H);
    const cx  = i * (colW + gap);
    const y   = H - h;
    const amt = v >= 1e9 ? (v/1e9).toFixed(1)+'tỷ'
              : v >= 1e6 ? Math.round(v/1e6)+'tr' : (v ? fmtS(v) : '');
    return `
      <g>
        <rect x="${cx}" y="${y}" width="${colW}" height="${Math.max(h, 2)}"
              rx="3" fill="${v ? 'var(--gold)' : 'var(--line)'}" opacity="${v ? '.85' : '.35'}">
          <title>T${i+1}: ${fmtM(v)}</title>
        </rect>
        <text x="${cx + colW/2}" y="${y - 4}" text-anchor="middle"
              font-size="9" fill="var(--ink2)">${h > 14 ? amt : ''}</text>
        <text x="${cx + colW/2}" y="${H + 14}" text-anchor="middle"
              font-size="9" fill="var(--ink3)">T${i+1}</text>
      </g>`;
  }).join('');

  document.getElementById('db-bar-chart').innerHTML =
    `<svg viewBox="0 -10 ${svgW} ${H + 28}" width="100%" class="db-pie-svg"
          style="min-width:${Math.min(svgW,300)}px;max-width:100%">
       ${bars}
       <line x1="0" y1="${H}" x2="${svgW}" y2="${H}" stroke="var(--line)" stroke-width="1"/>
     </svg>`;
}

// ── Pie Chart tỷ trọng (SVG) ─────────────────────────────────
function _dbPieChart(data) {
  const COLORS = ['#f0b429','#1db954','#4a90d9','#e74c3c','#9b59b6','#e67e22','#aaa'];
  const KEY_TYPES = ['Nhân Công','Vật Liệu XD','Thầu Phụ','Sắt Thép','Đổ Bê Tông'];

  const byType = {};
  data.forEach(i => {
    const k = KEY_TYPES.includes(i.loai) ? i.loai : 'Khác';
    byType[k] = (byType[k] || 0) + (i.thanhtien || i.tien || 0);
  });

  const total   = Object.values(byType).reduce((s,v) => s+v, 0);
  const entries = Object.entries(byType)
    .sort((a,b) => b[1]-a[1])
    .map(([name, val], i) => ({ name, val, pct: val/total, color: COLORS[i % COLORS.length] }));

  const R = 70, CX = 80, CY = 80;
  let startAngle = -Math.PI / 2;
  const slices = entries.map(e => {
    const angle = e.pct * Math.PI * 2;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    startAngle += angle;
    const x2 = CX + R * Math.cos(startAngle);
    const y2 = CY + R * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    return `<path d="M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)}
              A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z"
              fill="${e.color}" stroke="#fff" stroke-width="2">
              <title>${e.name}: ${Math.round(e.pct*100)}%</title>
            </path>`;
  }).join('');

  const legend = entries.map(e =>
    `<div class="db-legend-row">
       <div class="db-legend-dot" style="background:${e.color}"></div>
       <span style="flex:1;color:var(--ink2)">${e.name}</span>
       <span class="db-legend-pct" style="color:${e.color}">${Math.round(e.pct*100)}%</span>
     </div>`
  ).join('');

  document.getElementById('db-pie-chart').innerHTML =
    `<svg viewBox="0 0 160 160" width="140" height="140" class="db-pie-svg">${slices}</svg>
     <div class="db-legend">${legend}</div>`;
}

// ── Top 5 hóa đơn lớn nhất ────────────────────────────────────
function _dbTop5(data) {
  const top5 = [...data]
    .sort((a,b) => (b.thanhtien||b.tien||0) - (a.thanhtien||a.tien||0))
    .slice(0, 5);
  const max  = top5[0] ? (top5[0].thanhtien||top5[0].tien||0) : 1;

  document.getElementById('db-top5').innerHTML = top5.map((inv, i) => {
    const amt = inv.thanhtien || inv.tien || 0;
    const pct = Math.round(amt / max * 100);
    return `<div class="db-rank-row">
      <div class="db-rank-num ${i===0?'top1':''}">${i===0?'🥇':i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${inv.nd || inv.loai || '—'}
        </div>
        <div style="font-size:10px;color:var(--ink3)">${inv.ngay} · ${resolveProjectName(inv)||'—'}</div>
        <div class="db-rank-bar-bg" style="margin-top:4px">
          <div class="db-rank-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="db-rank-amt">${fmtM(amt)}</div>
    </div>`;
  }).join('');
}

// ── Chi phí theo Công Trình ────────────────────────────────────
function _dbByCT(data) {
  const byCT = {};
  data.forEach(i => {
    const k = resolveProjectName(i) || '(Không rõ)';
    byCT[k] = (byCT[k] || 0) + (i.thanhtien || i.tien || 0);
  });
  const sorted = Object.entries(byCT).sort((a,b) => b[1]-a[1]);
  const max    = sorted[0]?.[1] || 1;

  document.getElementById('db-by-ct').innerHTML = sorted.map(([ct, amt], i) => {
    const pct = Math.round(amt / max * 100);
    return `<div class="db-rank-row">
      <div class="db-rank-num ${i===0?'top1':''}">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
             title="${ct}">${ct}</div>
        <div class="db-rank-bar-bg" style="margin-top:4px">
          <div class="db-rank-bar-fill" style="width:${pct}%;background:${i===0?'var(--green)':'var(--gold)'}"></div>
        </div>
      </div>
      <div class="db-rank-amt">${fmtM(amt)}</div>
    </div>`;
  }).join('');
}

// ── Tổng Tiền Ứng theo Công Trình ─────────────────────────────
function _dbUngByCT() {
  const wrap = document.getElementById('db-ung-ct');
  if (!wrap) return;

  const filtered = ungRecords.filter(r =>
    !r.deletedAt &&
    inActiveYear(r.ngay) &&
    (!selectedCT || resolveProjectName(r) === selectedCT)
  );

  if (!filtered.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có tiền ứng</div>';
    return;
  }

  if (!selectedCT) {
    const byCT = {};
    filtered.forEach(r => {
      const k = resolveProjectName(r) || '(Không rõ)';
      byCT[k] = (byCT[k] || 0) + (r.tien || 0);
    });
    const sorted = Object.entries(byCT).sort((a,b) => b[1]-a[1]);
    const max = sorted[0][1] || 1;
    wrap.innerHTML = sorted.map(([ct, amt], i) => {
      const pct = Math.round(amt / max * 100);
      return `<div class="db-rank-row">
        <div class="db-rank-num ${i===0?'top1':''}">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
               title="${x(ct)}">${x(ct)}</div>
          <div class="db-rank-bar-bg" style="margin-top:4px">
            <div class="db-rank-bar-fill" style="width:${pct}%;background:#4a90d9"></div>
          </div>
        </div>
        <div class="db-rank-amt">${fmtM(amt)}</div>
      </div>`;
    }).join('');
  } else {
    const rows = [...filtered]
      .sort((a,b) => b.ngay.localeCompare(a.ngay))
      .map(r => `<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:7px 8px;white-space:nowrap;color:var(--ink3);font-size:12px">${r.ngay}</td>
        <td style="padding:7px 8px;font-weight:600">${x(r.tp)||'—'}</td>
        <td style="padding:7px 8px;color:var(--ink2);font-size:12px">${x(r.nd)||'—'}</td>
        <td style="padding:7px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;color:#4a90d9;white-space:nowrap">${fmtM(r.tien||0)}</td>
      </tr>`).join('');
    const total = sumBy(filtered, 'tien');
    wrap.innerHTML = `<div style="overflow-x:auto">
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
}

// ── Thiết Bị theo Công Trình ───────────────────────────────────
function _dbTBByCT() {
  const wrap = document.getElementById('db-tb-ct');
  if (!wrap) return;

  // Chỉ thiết bị chưa xóa, không phải KHO TỔNG
  const allTB = tbData.filter(t => !t.deletedAt && t.ct !== TB_KHO_TONG);
  // Thiết bị trong KHO TỔNG (chưa xóa)
  const khoTB = tbData.filter(t => !t.deletedAt && t.ct === TB_KHO_TONG);

  if (!allTB.length && !khoTB.length) {
    wrap.innerHTML = '<div class="db-empty">Chưa có thiết bị</div>';
    return;
  }

  if (!selectedCT) {
    // Tổng KHO TỔNG
    const khoTotal = khoTB.reduce((s, t) => s + (t.soluong||0), 0);
    const khoHd = khoTB.filter(t=>t.tinhtrang==='Đang hoạt động').reduce((s,t)=>s+(t.soluong||0),0);
    const khoLau = khoTB.filter(t=>t.tinhtrang==='Cần bảo trì').reduce((s,t)=>s+(t.soluong||0),0);
    const khoSC = khoTB.filter(t=>t.tinhtrang==='Cần sửa chữa').reduce((s,t)=>s+(t.soluong||0),0);

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
      const ct = _resolveCtName(t) || '(Không rõ)'; // [MODIFIED] resolve from projectId
      if (!byCT[ct]) byCT[ct] = { total: 0, dangHD: 0, hdLau: 0, canSC: 0 };
      const sl = t.soluong || 0;
      byCT[ct].total  += sl;
      if (t.tinhtrang === 'Đang hoạt động') byCT[ct].dangHD += sl;
      else if (t.tinhtrang === 'Cần bảo trì') byCT[ct].hdLau += sl;
      else if (t.tinhtrang === 'Cần sửa chữa') byCT[ct].canSC += sl;
    });

    const sorted = Object.entries(byCT).sort((a,b) => a[0].localeCompare(b[0],'vi'));
    const ctRows = sorted.map(([ct, s]) =>
      `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="font-weight:700;color:var(--ink);margin-bottom:6px">${x(ct)}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
          <span style="color:var(--ink3)">Tổng: <b style="color:var(--ink)">${s.total}</b></span>
          <span style="color:var(--green)">Đang hoạt động: <b>${s.dangHD}</b></span>
          <span style="color:var(--gold)">Cần bảo trì: <b>${s.hdLau}</b></span>
          <span style="color:var(--red)">Cần sửa chữa: <b>${s.canSC}</b></span>
        </div>
      </div>`
    ).join('');

    wrap.innerHTML = khoRow + (ctRows || '<div class="db-empty">Chưa có thiết bị tại công trình</div>');
  } else {
    const filtered = allTB
      .filter(t => t.ct === selectedCT)
      .sort((a,b) => (a.ten||'').localeCompare(b.ten,'vi'));

    if (!filtered.length) {
      wrap.innerHTML = '<div class="db-empty">Chưa có thiết bị cho ' + x(selectedCT) + '</div>';
      return;
    }

    const rows = filtered.map(t => {
      const ttColor = t.tinhtrang === 'Đang hoạt động' ? 'var(--green)'
                    : t.tinhtrang === 'Cần bảo trì'  ? 'var(--gold)'
                    : t.tinhtrang === 'Cần sửa chữa'   ? 'var(--red)'
                    : 'var(--ink3)';
      return `<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:7px 8px;font-weight:600">${x(t.ten)}</td>
        <td style="padding:7px 8px;text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${t.soluong||0}</td>
        <td style="padding:7px 8px;color:${ttColor}">${x(t.tinhtrang)||'—'}</td>
        <td style="padding:7px 8px;color:var(--ink3);font-size:12px">${x(t.ct)||'—'}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `<div style="overflow-x:auto">
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
}

// ══════════════════════════════════════════════════════════════
// [3] PUBLIC WRAPPERS — JSON & backup (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════

function toolExportJSON() { exportJSON(); }
function toolImportJSON() { document.getElementById('import-json-input').click(); }

// ══════════════════════════════════════════════════════════════
// [5] DATA HEALTH CHECK — Kiểm tra & dọn dẹp dữ liệu
// ══════════════════════════════════════════════════════════════

// Regex nhận diện tên công trình là ngày tháng (dữ liệu rác)
const _DATE_NAME_RE = /^\d{4}[-\/]\d{1,2}([-\/]\d{1,2})?$/;

// Tên công trình giữ chỗ cho dữ liệu rác cần xử lý thủ công
const _PLACEHOLDER_CT_NAME = 'DỮ LIỆU CẦN XỬ LÝ';

// Lấy tên CT từ record (ưu tiên ct, rồi congtrinh)
function _getCtText(r) {
  return (r.ct || r.congtrinh || '').trim();
}

// Kiểm tra ID có phải timestamp cũ (số nguyên > 10^12 → timestamp ms)
function _isLegacyId(id) {
  if (typeof id !== 'string' && typeof id !== 'number') return false;
  const n = Number(id);
  return Number.isFinite(n) && n > 1e12;
}

// ── IDB-DIRECT READERS — đọc thẳng từ kho lưu trữ, không qua _mem ─
// Lý do: _mem có thể bị filter theo activeYear; migration cần TOÀN BỘ data.

async function _readAllFromIDB() {
  if (typeof db === 'undefined' || !db) {
    // Fallback: dùng globals nếu DB chưa init (testing)
    return {
      invoices:   (typeof invoices     !== 'undefined') ? [...invoices]     : [],
      attendance: (typeof ccData       !== 'undefined') ? [...ccData]       : [],
      equipment:  (typeof tbData       !== 'undefined') ? [...tbData]       : [],
      ung:        (typeof ungRecords   !== 'undefined') ? [...ungRecords]   : [],
      revenue:    (typeof thuRecords   !== 'undefined') ? [...thuRecords]   : [],
      trash:      (typeof trash        !== 'undefined') ? [...trash]        : [],
      projects:   (typeof projects     !== 'undefined') ? [...projects]     : [],
    };
  }

  // Đọc song song toàn bộ — không filter năm
  const [inv, att, eq, un, rv] = await Promise.all([
    db.invoices   ? db.invoices.toArray()   : Promise.resolve([]),
    db.attendance ? db.attendance.toArray() : Promise.resolve([]),
    db.equipment  ? db.equipment.toArray()  : Promise.resolve([]),
    db.ung        ? db.ung.toArray()        : Promise.resolve([]),
    db.revenue    ? db.revenue.toArray()    : Promise.resolve([]),
  ]);

  // Trash + projects nằm trong settings (rowId)
  let trashArr = [], projectsArr = [];
  if (db.settings) {
    const [trashRow, projRow] = await Promise.all([
      db.settings.get('trash').catch(() => null),
      db.settings.get('projects').catch(() => null),
    ]);
    trashArr    = (trashRow && Array.isArray(trashRow.data)) ? trashRow.data : [];
    projectsArr = (projRow  && Array.isArray(projRow.data))  ? projRow.data  : [];
  }

  return {
    invoices: inv, attendance: att, equipment: eq,
    ung: un, revenue: rv,
    trash: trashArr, projects: projectsArr,
  };
}

/**
 * Quét toàn bộ dữ liệu TRỰC TIẾP TỪ IDB, trả về báo cáo lỗi.
 * Async vì đọc IDB là bất đồng bộ.
 * @returns {Promise<{ dateNames, missingPid, legacyIds, ccDupes, total }>}
 */
async function scanDataIssues() {
  const all = await _readAllFromIDB();
  const inv = all.invoices.filter(r => !r.deletedAt);
  const cc  = all.attendance.filter(r => !r.deletedAt);
  const ung = all.ung.filter(r => !r.deletedAt);
  const tb  = all.equipment.filter(r => !r.deletedAt);
  const thu = all.revenue.filter(r => !r.deletedAt);

  // Lỗi 1: Tên CT là ngày tháng
  const dateNames = [];
  const _checkDateName = (arr, src) => arr.forEach(r => {
    const ct = _getCtText(r);
    if (ct && _DATE_NAME_RE.test(ct)) dateNames.push({ id: r.id, src, ct });
  });
  _checkDateName(inv, 'inv'); _checkDateName(cc,  'cc');
  _checkDateName(ung, 'ung'); _checkDateName(tb,  'tb');
  _checkDateName(thu, 'thu');

  // Lỗi 2: Có tên CT nhưng thiếu projectId
  const missingPid = [];
  const _checkMissingPid = (arr, src) => arr.forEach(r => {
    const ct = _getCtText(r);
    if (ct && !r.projectId && !_DATE_NAME_RE.test(ct)) missingPid.push({ id: r.id, src, ct });
  });
  _checkMissingPid(inv, 'inv'); _checkMissingPid(cc,  'cc');
  _checkMissingPid(ung, 'ung'); _checkMissingPid(tb,  'tb');
  _checkMissingPid(thu, 'thu');

  // Lỗi 3: ID dạng số cũ (legacy timestamp)
  const legacyIds = [];
  const _checkLegacy = (arr, src) => arr.forEach(r => {
    if (_isLegacyId(r.id)) legacyIds.push({ id: r.id, src });
  });
  _checkLegacy(inv, 'inv'); _checkLegacy(cc,  'cc');
  _checkLegacy(ung, 'ung'); _checkLegacy(tb,  'tb');
  _checkLegacy(thu, 'thu');

  // Lỗi 4: Chấm công trùng lặp (cùng fromDate + projectId/CT)
  const ccDupes = [];
  const ccSeen  = new Map(); // key → [records]
  cc.forEach(r => {
    const pid = r.projectId || _getCtText(r) || '__unknown__';
    const key = (r.fromDate || '') + '|' + pid;
    if (!ccSeen.has(key)) ccSeen.set(key, []);
    ccSeen.get(key).push(r);
  });
  ccSeen.forEach((recs, key) => {
    if (recs.length > 1) {
      // Giữ bản mới nhất, còn lại là trùng
      const sorted = [...recs].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      sorted.slice(1).forEach(r => ccDupes.push({ id: r.id, src: 'cc', key }));
    }
  });

  return {
    dateNames,
    missingPid,
    legacyIds,
    ccDupes,
    total: dateNames.length + missingPid.length + legacyIds.length + ccDupes.length,
  };
}

/**
 * Thực thi dọn dẹp dựa trên báo cáo từ scanDataIssues().
 * Backup tự động trước khi sửa. Không xóa deletedAt.
 */
async function fixDataIssues(report) {
  // 1. Backup trước khi sửa
  if (typeof _snapshotNow === 'function') await _snapshotNow('pre-health-fix');

  const now   = Date.now();
  const devId = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';

  // Tập ID cần xóa (cc dupes) và ID cần sửa
  const dateNameIds  = new Set(report.dateNames.map(e => String(e.id)));
  const missingPids  = new Set(report.missingPid.map(e => String(e.id)));
  const ccDupeIds    = new Set(report.ccDupes.map(e => String(e.id)));

  // Bản đồ id → tên CT (cho bước gán projectId)
  const idToCtMap = {};
  [...report.dateNames, ...report.missingPid].forEach(e => { idToCtMap[String(e.id)] = e.ct; });

  // Đảm bảo tồn tại công trình giữ chỗ nếu có dateNames
  let placeholderPid = null;
  if (report.dateNames.length > 0 && typeof projects !== 'undefined') {
    const existing = projects.find(p => !p.deletedAt && p.name === _PLACEHOLDER_CT_NAME);
    if (existing) {
      placeholderPid = existing.id;
    } else if (typeof mkRecord === 'function' && typeof save === 'function') {
      const ph = mkRecord({
        name:      _PLACEHOLDER_CT_NAME,
        status:    'active',
        startDate: null,
        endDate:   null,
        note:      'Dữ liệu nhập sai tên công trình — cần phân loại thủ công',
      });
      projects.push(ph);
      save('projects_v1', projects);
      if (typeof rebuildCatCTFromProjects === 'function') rebuildCatCTFromProjects();
      placeholderPid = ph.id;
    }
  }

  // Helper sửa một record
  const _fixRecord = r => {
    const sid = String(r.id);
    let updated = { ...r };

    // Sửa tên CT là ngày → gán placeholder
    if (dateNameIds.has(sid)) {
      if (updated.ct !== undefined)         updated.ct         = _PLACEHOLDER_CT_NAME;
      if (updated.congtrinh !== undefined)  updated.congtrinh  = _PLACEHOLDER_CT_NAME;
      updated.projectId = placeholderPid;
      updated.updatedAt = now;
      updated.deviceId  = devId;
    }

    // Gán projectId dựa theo tên CT
    if (missingPids.has(sid)) {
      const ctName = idToCtMap[sid] || _getCtText(r);
      const pid = typeof findProjectIdByName === 'function' ? findProjectIdByName(ctName) : null;
      if (pid) {
        updated.projectId = pid;
        updated.updatedAt = now;
        updated.deviceId  = devId;
      }
    }

    return updated;
  };

  // Áp dụng sửa đổi + xóa cc dupes (soft-delete)
  const _processArr = arr => arr.map(r => {
    const sid = String(r.id);
    if (ccDupeIds.has(sid) && !r.deletedAt) {
      return { ...r, deletedAt: now, updatedAt: now, deviceId: devId };
    }
    if (dateNameIds.has(sid) || missingPids.has(sid)) {
      return _fixRecord(r);
    }
    return r;
  });

  // Đọc TOÀN BỘ data từ IDB để fix đúng cả các bản ghi cross-year
  const all = await _readAllFromIDB();
  let stats = { fixed: 0, dupeRemoved: 0 };

  // Helper: ghi xuống IDB + đồng bộ _mem + globals
  const _persist = async (memKey, glob, arr) => {
    if (typeof _dbSave === 'function') await _dbSave(memKey, arr);
    if (typeof _mem !== 'undefined') _mem[memKey] = arr;
    if (typeof window[glob] !== 'undefined') window[glob] = arr;
  };

  // inv_v3
  {
    const before = all.invoices;
    const after  = _processArr(before);
    stats.fixed += after.filter((r, i) => r !== before[i]).length;
    if (typeof clearInvoiceCache === 'function') clearInvoiceCache();
    await _persist('inv_v3', 'invoices', after);
  }
  // cc_v2
  {
    const before = all.attendance;
    const after  = _processArr(before);
    stats.dupeRemoved += after.filter((r, i) => r !== before[i] && r.deletedAt).length;
    stats.fixed       += after.filter((r, i) => r !== before[i] && !r.deletedAt).length;
    await _persist('cc_v2', 'ccData', after);
  }
  // ung_v1
  {
    const before = all.ung;
    const after  = _processArr(before);
    stats.fixed += after.filter((r, i) => r !== before[i]).length;
    await _persist('ung_v1', 'ungRecords', after);
  }
  // tb_v1
  {
    const before = all.equipment;
    const after  = _processArr(before);
    stats.fixed += after.filter((r, i) => r !== before[i]).length;
    await _persist('tb_v1', 'tbData', after);
  }
  // thu_v1
  {
    const before = all.revenue;
    const after  = _processArr(before);
    stats.fixed += after.filter((r, i) => r !== before[i]).length;
    await _persist('thu_v1', 'thuRecords', after);
  }

  // Trigger sync sau khi đã ghi tất cả
  if (typeof _incPending === 'function' && typeof schedulePush === 'function') {
    _incPending(); schedulePush();
  }

  return stats;
}

// ── UI: Mở modal Kiểm tra sức khỏe dữ liệu ───────────────────

function toolDataHealth() {
  const existing = document.getElementById('_dh-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_dh-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,24,20,.55);z-index:9000;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px;'
    + 'backdrop-filter:blur(2px)';

  overlay.innerHTML = `
    <div style="background:var(--paper,#fff);border-radius:12px;width:100%;max-width:560px;
                max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 20px 60px rgba(0,0,0,.22);font-family:inherit">
      <div style="padding:16px 20px;border-bottom:1px solid var(--line,#e8e4da);
                  background:#f3f1ec;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:15px;font-weight:700">🩺 Kiểm Tra Sức Khỏe Dữ Liệu</div>
        <button onclick="document.getElementById('_dh-modal-overlay').remove()"
          style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--ink2,#888);
                 padding:2px 6px;border-radius:4px;line-height:1">✕</button>
      </div>
      <div id="_dh-body" style="overflow-y:auto;padding:20px;flex:1">
        <p style="color:var(--ink2,#666);font-size:13px;margin:0 0 16px">
          Quét tất cả bảng dữ liệu để phát hiện bản ghi lỗi, thiếu liên kết công trình
          hoặc chấm công trùng lặp.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button id="_dh-btn-scan" onclick="_dhRunScan()"
            style="background:var(--ink,#1a1814);color:#fff;border:none;border-radius:6px;
                   padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            🔍 Bắt đầu kiểm tra
          </button>
        </div>
        <div id="_dh-result" style="margin-top:20px"></div>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function _dhRunScan() {
  const btn = document.getElementById('_dh-btn-scan');
  const res = document.getElementById('_dh-result');
  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang đọc Database...'; }
  if (res) res.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;
                background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;
                color:#075985;font-size:13px">
      <span style="font-size:18px">⌛</span>
      <span>Đang đọc Database — quét tất cả các năm, có thể mất vài giây với hàng ngàn bản ghi...</span>
    </div>`;

  // defer 1 frame để browser render loading state
  await new Promise(r => setTimeout(r, 30));

  try {
    const report = await scanDataIssues();
    window._dhLastReport = report;
    _dhRenderReport(report);
  } catch (e) {
    if (res) res.innerHTML = `<div style="color:#c0392b;font-size:13px">❌ Lỗi khi quét: ${e.message}</div>`;
    console.error('[DataHealth] scan lỗi:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Quét lại'; }
  }
}

function _dhRenderReport(r) {
  const res = document.getElementById('_dh-result');
  if (!res) return;

  const _srcLabel = s => ({ inv:'Hóa đơn', cc:'Chấm công', ung:'Tiền ứng', tb:'Thiết bị', thu:'Thu tiền' }[s] || s);

  const _section = (icon, title, color, items, renderRow) => {
    if (!items.length) return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;
                  background:#f0fdf4;border:1px solid #bbf7d0;margin-bottom:10px">
        <span style="font-size:16px">✅</span>
        <span style="font-size:13px;color:#166534;font-weight:600">${title}: Không có lỗi</span>
      </div>`;
    return `
      <div style="border:1px solid ${color}33;border-radius:8px;overflow:hidden;margin-bottom:12px">
        <div style="background:${color}18;padding:10px 14px;display:flex;align-items:center;gap:8px;
                    border-bottom:1px solid ${color}33">
          <span style="font-size:16px">${icon}</span>
          <span style="font-size:13px;font-weight:700;color:${color}">${title}</span>
          <span style="margin-left:auto;background:${color};color:#fff;font-size:11px;font-weight:700;
                       padding:2px 8px;border-radius:10px">${items.length}</span>
        </div>
        <div style="padding:8px 14px;max-height:140px;overflow-y:auto">
          ${items.map(renderRow).join('')}
        </div>
      </div>`;
  };

  const html = `
    ${_section('📅','Tên CT là ngày tháng (dữ liệu rác)','#c0392b', r.dateNames, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         <b style="color:var(--ink)">${_srcLabel(e.src)}</b> — CT: <code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">${e.ct}</code>
       </div>`)}
    ${_section('🔗','Thiếu liên kết ProjectId','#e67e22', r.missingPid, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         <b style="color:var(--ink)">${_srcLabel(e.src)}</b> — <span style="color:#c0392b">${e.ct}</span>
       </div>`)}
    ${_section('🔢','ID dạng số cũ (Legacy)','#7f8c8d', r.legacyIds, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         <b style="color:var(--ink)">${_srcLabel(e.src)}</b> — id: <code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">${e.id}</code>
       </div>`)}
    ${_section('♊','Chấm công trùng lặp (cùng tuần + CT)','#8e44ad', r.ccDupes, e =>
      `<div style="font-size:12px;color:var(--ink2,#666);padding:3px 0;border-bottom:1px solid var(--line,#eee)">
         Tuần: <code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">${(e.key||'').split('|')[0]}</code>
       </div>`)}

    ${r.total === 0
      ? `<div style="text-align:center;padding:20px;font-size:14px;color:#166534;font-weight:700">
           🎉 Dữ liệu sạch — không phát hiện vấn đề nào!
         </div>`
      : `<div style="margin-top:4px;padding:12px 14px;background:#fff8e1;border:1px solid #ffc107;
                     border-radius:8px;font-size:12px;color:#856404;line-height:1.6">
           ⚠ Ghi chú:<br>
           • <b>Tên CT là ngày</b> → sẽ gán vào công trình giữ chỗ "<b>${_PLACEHOLDER_CT_NAME}</b>"<br>
           • <b>Thiếu ProjectId</b> → tự động tìm khớp tên (có thể không tìm được nếu CT đã xóa)<br>
           • <b>Legacy ID</b> → chỉ ghi nhận, không tự sửa (cần migrate riêng)<br>
           • <b>CC trùng</b> → xóa mềm bản cũ hơn, giữ bản mới nhất<br>
           • App sẽ <b>tự backup</b> trước khi dọn dẹp
         </div>
         <div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end">
           <button onclick="document.getElementById('_dh-modal-overlay').remove()"
             style="padding:8px 16px;border:1px solid var(--line2,#ccc);border-radius:6px;
                    background:var(--bg,#f5f5f5);cursor:pointer;font-size:13px;font-family:inherit">
             Huỷ
           </button>
           <button onclick="_dhRunFix()"
             style="padding:8px 18px;border:none;border-radius:6px;background:#c0392b;color:#fff;
                    cursor:pointer;font-size:13px;font-weight:700;font-family:inherit">
             🧹 Bắt đầu dọn dẹp (${r.total - r.legacyIds.length} lỗi có thể sửa)
           </button>
         </div>`
    }`;

  res.innerHTML = html;
}

async function _dhRunFix() {
  const report = window._dhLastReport;
  if (!report) { toast('Chạy quét trước khi dọn dẹp', 'error'); return; }

  // Chỉ sửa lỗi có thể tự động fix (không sửa legacyIds)
  const fixable = {
    ...report,
    legacyIds: [], // bỏ qua legacy IDs
    total: report.dateNames.length + report.missingPid.length + report.ccDupes.length,
  };

  if (fixable.total === 0) {
    toast('Không có lỗi nào có thể tự động sửa', 'error');
    return;
  }

  const res = document.getElementById('_dh-result');
  if (res) res.innerHTML += `<div style="margin-top:12px;color:var(--ink2,#888);font-size:13px">⏳ Đang dọn dẹp và backup...</div>`;

  try {
    const stats = await fixDataIssues(fixable);
    const overlay = document.getElementById('_dh-modal-overlay');
    if (overlay) overlay.remove();

    const msg = `✅ Dọn dẹp hoàn tất — ${stats.fixed} bản ghi sửa, ${stats.dupeRemoved} CC trùng đã xóa`;
    toast(msg, 'success');

    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();
    delete window._dhLastReport;
  } catch (e) {
    toast('❌ Lỗi khi dọn dẹp: ' + (e.message || String(e)), 'error');
    console.error('[DataHealth] fixDataIssues lỗi:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// [6] SCHEMA MIGRATION — Chuẩn hóa ProjectId & UUID
// ══════════════════════════════════════════════════════════════

const _UNASSIGNED_PID = 'UNASSIGNED';
const _MIGRATION_BACKUP_KEY = 'backup_before_migration';

// Phát hiện ID dạng cũ (timestamp ms hoặc chuỗi số nguyên)
function _isLegacyRecordId(id) {
  if (id === null || id === undefined || id === '') return true;
  // UUID v4 chuẩn: 8-4-4-4-12
  if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
  // Số hoặc chuỗi số → legacy
  const n = Number(id);
  if (Number.isFinite(n) && String(n) === String(id).trim()) return true;
  // Chuỗi không phải UUID, kiểm tra có chỉ-số không
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return true;
  return false;
}

// Tạo UUID an toàn (fallback nếu crypto.randomUUID không có)
function _genUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Lấy tên CT chuẩn từ projects để đồng bộ trường hiển thị
function _getCanonicalProjectName(pid) {
  if (!pid || pid === _UNASSIGNED_PID) return null;
  if (pid === 'COMPANY') return 'CÔNG TY';
  if (typeof projects === 'undefined') return null;
  const p = projects.find(x => x.id === pid && !x.deletedAt);
  return p ? p.name : null;
}

/**
 * Quét DRY-RUN TRỰC TIẾP TỪ IDB — không sửa gì, chỉ đếm số bản ghi sẽ thay đổi.
 * Async vì đọc IDB bất đồng bộ. Quét tất cả năm (không lọc activeYear).
 * @returns {Promise<{ perTable, totals }>}
 */
async function dryRunMigration() {
  const all = await _readAllFromIDB();

  // QUAN TRỌNG: dùng projects từ IDB (full list, không phải _mem có thể stale)
  // để findProjectIdByName tra cứu chính xác.
  const projectsFromIDB = all.projects || [];

  // Helper findProjectIdByName phiên bản dùng projects truyền vào (tránh đụng global)
  const _findPidLocal = (name) => {
    if (!name) return null;
    const n = name.trim();
    if (!n) return null;
    if (n === 'CÔNG TY' || n === 'KHO TỔNG') return 'COMPANY';
    const exact = projectsFromIDB.find(p => !p.deletedAt && p.name === n);
    if (exact) return exact.id;
    const _norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const nNorm = _norm(n);
    const fuzzy = projectsFromIDB.find(p => !p.deletedAt && _norm(p.name) === nNorm);
    return fuzzy ? fuzzy.id : null;
  };

  const _getCanonicalLocal = (pid) => {
    if (!pid || pid === _UNASSIGNED_PID) return null;
    if (pid === 'COMPANY') return 'CÔNG TY';
    const p = projectsFromIDB.find(x => x.id === pid && !x.deletedAt);
    return p ? p.name : null;
  };

  const tables = [
    { key: 'inv_v3', src: all.invoices,   ctField: 'congtrinh' },
    { key: 'cc_v2',  src: all.attendance, ctField: 'congtrinh' },
    { key: 'ung_v1', src: all.ung,        ctField: 'congtrinh' },
    { key: 'tb_v1',  src: all.equipment,  ctField: 'ct'        },
    { key: 'thu_v1', src: all.revenue,    ctField: 'congtrinh' },
  ];

  const perTable = {};
  let totalIdMigrate = 0, totalPidLinked = 0, totalPidUnassigned = 0, totalNameSynced = 0;

  tables.forEach(t => {
    const arr = Array.isArray(t.src) ? t.src : [];
    let idCount = 0, pidLinked = 0, pidUnassigned = 0, nameSynced = 0;

    arr.forEach(r => {
      if (_isLegacyRecordId(r.id)) idCount++;

      // ProjectId logic — dùng helper LOCAL đọc từ projects IDB
      if (!r.projectId) {
        const ctName = (r[t.ctField] || r.ct || r.congtrinh || '').trim();
        if (ctName) {
          const pid = _findPidLocal(ctName);
          if (pid) pidLinked++;
          else pidUnassigned++;
        }
      } else {
        // Đã có projectId — kiểm tra tên hiển thị có lệch không
        const canonical = _getCanonicalLocal(r.projectId);
        const cur = (r[t.ctField] || '').trim();
        if (canonical && cur && canonical !== cur) nameSynced++;
      }
    });

    perTable[t.key] = { total: arr.length, idCount, pidLinked, pidUnassigned, nameSynced };
    totalIdMigrate     += idCount;
    totalPidLinked     += pidLinked;
    totalPidUnassigned += pidUnassigned;
    totalNameSynced    += nameSynced;
  });

  return {
    perTable,
    totals: { totalIdMigrate, totalPidLinked, totalPidUnassigned, totalNameSynced },
  };
}

/**
 * Chuẩn hóa projectId trên tất cả bảng nghiệp vụ.
 * - Nếu có ct/congtrinh → tìm projectId qua findProjectIdByName (accent-insensitive)
 * - Tìm thấy: gán projectId + đồng bộ tên CT về tên chuẩn
 * - Không tìm thấy: gán projectId = "UNASSIGNED"
 * @param {boolean} commit — true để ghi vào _mem; false chỉ trả về snapshot
 * @returns { changedByTable, snapshots }
 */
function normalizeProjectLinks(commit) {
  const tables = [
    { key: 'inv_v3', glob: 'invoices',   ctField: 'congtrinh' },
    { key: 'cc_v2',  glob: 'ccData',     ctField: 'congtrinh' },
    { key: 'ung_v1', glob: 'ungRecords', ctField: 'congtrinh' },
    { key: 'tb_v1',  glob: 'tbData',     ctField: 'ct'        },
    { key: 'thu_v1', glob: 'thuRecords', ctField: 'congtrinh' },
  ];

  const now    = Date.now();
  const devId  = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
  const result = { changedByTable: {}, snapshots: {} };

  tables.forEach(t => {
    const arr = (typeof window[t.glob] !== 'undefined' && Array.isArray(window[t.glob]))
      ? window[t.glob] : null;
    if (!arr) { result.changedByTable[t.key] = 0; return; }

    let changed = 0;
    const newArr = arr.map(r => {
      let mutated = false;
      let next = r;

      if (!r.projectId) {
        const ctName = (r[t.ctField] || r.ct || r.congtrinh || '').trim();
        if (ctName) {
          const pid = (typeof findProjectIdByName === 'function')
            ? findProjectIdByName(ctName) : null;
          next = { ...next, projectId: pid || _UNASSIGNED_PID };
          mutated = true;
        }
      }

      // Đồng bộ tên hiển thị về tên chuẩn (chỉ khi có pid hợp lệ)
      if (next.projectId && next.projectId !== _UNASSIGNED_PID) {
        const canonical = _getCanonicalProjectName(next.projectId);
        if (canonical) {
          const cur = (next[t.ctField] || '').trim();
          if (cur && cur !== canonical) {
            next = { ...next, [t.ctField]: canonical };
            mutated = true;
          }
        }
      }

      if (mutated) {
        next.updatedAt = now;
        next.deviceId  = devId;
        changed++;
      }
      return next;
    });

    result.changedByTable[t.key] = changed;
    result.snapshots[t.key]      = newArr;

    if (commit) {
      window[t.glob] = newArr;
    }
  });

  return result;
}

/**
 * Chuyển toàn bộ ID dạng số/timestamp sang UUID v4.
 * Giữ nguyên createdAt và updatedAt gốc.
 * @param {boolean} commit
 * @returns { changedByTable, snapshots }
 */
function migrateIdsToUUID(commit) {
  const tables = [
    { key: 'inv_v3', glob: 'invoices'   },
    { key: 'cc_v2',  glob: 'ccData'     },
    { key: 'ung_v1', glob: 'ungRecords' },
    { key: 'tb_v1',  glob: 'tbData'     },
    { key: 'thu_v1', glob: 'thuRecords' },
    { key: 'trash_v1', glob: 'trash'    },
  ];

  const result = { changedByTable: {}, snapshots: {} };

  tables.forEach(t => {
    const arr = (typeof window[t.glob] !== 'undefined' && Array.isArray(window[t.glob]))
      ? window[t.glob] : null;
    if (!arr) { result.changedByTable[t.key] = 0; return; }

    let changed = 0;
    const newArr = arr.map(r => {
      if (_isLegacyRecordId(r.id)) {
        changed++;
        // Quan trọng: GIỮ NGUYÊN createdAt và updatedAt
        return { ...r, id: _genUUID() };
      }
      return r;
    });

    result.changedByTable[t.key] = changed;
    result.snapshots[t.key]      = newArr;

    if (commit) {
      window[t.glob] = newArr;
    }
  });

  return result;
}

// Backup snapshot vào IDB key dự phòng
async function _backupBeforeMigration() {
  const snap = {
    version:    (typeof DATA_VERSION !== 'undefined') ? DATA_VERSION : 0,
    backedAt:   Date.now(),
    deviceId:   (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '',
    inv_v3:     (typeof invoices     !== 'undefined') ? invoices     : [],
    cc_v2:      (typeof ccData       !== 'undefined') ? ccData       : [],
    ung_v1:     (typeof ungRecords   !== 'undefined') ? ungRecords   : [],
    tb_v1:      (typeof tbData       !== 'undefined') ? tbData       : [],
    thu_v1:     (typeof thuRecords   !== 'undefined') ? thuRecords   : [],
    trash_v1:   (typeof trash        !== 'undefined') ? trash        : [],
    projects_v1:(typeof projects     !== 'undefined') ? projects     : [],
  };

  // Lưu vào IDB qua settings table (backup_before_migration)
  if (typeof db !== 'undefined' && db && db.settings) {
    await db.settings.put({ id: _MIGRATION_BACKUP_KEY, data: snap });
    console.log('[Migration] ✅ Backup lưu vào IDB key:', _MIGRATION_BACKUP_KEY);
  } else {
    // Fallback: localStorage
    try {
      localStorage.setItem(_MIGRATION_BACKUP_KEY, JSON.stringify(snap));
      console.log('[Migration] ✅ Backup lưu vào localStorage (IDB không sẵn)');
    } catch (e) {
      console.warn('[Migration] Backup LS lỗi (có thể tràn quota):', e);
      throw new Error('Không backup được — hủy migration để an toàn');
    }
  }
  return snap;
}

/**
 * Orchestrator: chạy đầy đủ quy trình nâng cấp schema.
 * 1. Backup snapshot
 * 2. Run normalizeProjectLinks (commit)
 * 3. Run migrateIdsToUUID (commit)
 * 4. save() tất cả bảng → IDB + sync
 * 5. pushChanges() → cloud
 */
async function _runFullMigration() {
  if (typeof showSyncBanner === 'function') showSyncBanner('⌛ Đang đọc Database (toàn bộ năm)...');
  try {
    // Bước 1: Backup
    if (typeof _snapshotNow === 'function') await _snapshotNow('pre-schema-migration');
    await _backupBeforeMigration();

    // Bước 2: Đọc TOÀN BỘ data trực tiếp từ IDB (không qua _mem)
    const all = await _readAllFromIDB();
    const projectsFromIDB = all.projects || [];

    // Helper local — dùng projects từ IDB
    const _findPidLocal = (name) => {
      if (!name) return null;
      const n = name.trim();
      if (!n) return null;
      if (n === 'CÔNG TY' || n === 'KHO TỔNG') return 'COMPANY';
      const exact = projectsFromIDB.find(p => !p.deletedAt && p.name === n);
      if (exact) return exact.id;
      const _norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
      const nNorm = _norm(n);
      const fuzzy = projectsFromIDB.find(p => !p.deletedAt && _norm(p.name) === nNorm);
      return fuzzy ? fuzzy.id : null;
    };
    const _getCanonicalLocal = (pid) => {
      if (!pid || pid === _UNASSIGNED_PID) return null;
      if (pid === 'COMPANY') return 'CÔNG TY';
      const p = projectsFromIDB.find(x => x.id === pid && !x.deletedAt);
      return p ? p.name : null;
    };

    if (typeof showSyncBanner === 'function') showSyncBanner('⏳ Đang chuẩn hóa cấu trúc...');

    const now    = Date.now();
    const devId  = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';
    let r1 = { changedByTable: {} };
    let r2 = { changedByTable: {} };

    // Bước 3: Áp dụng normalizeProjectLinks + migrateIdsToUUID lên dữ liệu IDB-loaded
    const tables = [
      { key: 'inv_v3',   memKey: 'inv_v3',   glob: 'invoices',   src: all.invoices,   ctField: 'congtrinh' },
      { key: 'cc_v2',    memKey: 'cc_v2',    glob: 'ccData',     src: all.attendance, ctField: 'congtrinh' },
      { key: 'ung_v1',   memKey: 'ung_v1',   glob: 'ungRecords', src: all.ung,        ctField: 'congtrinh' },
      { key: 'tb_v1',    memKey: 'tb_v1',    glob: 'tbData',     src: all.equipment,  ctField: 'ct'        },
      { key: 'thu_v1',   memKey: 'thu_v1',   glob: 'thuRecords', src: all.revenue,    ctField: 'congtrinh' },
      { key: 'trash_v1', memKey: 'trash_v1', glob: 'trash',      src: all.trash,      ctField: 'congtrinh', skipPid: true },
    ];

    for (const t of tables) {
      const arr = Array.isArray(t.src) ? t.src : [];
      let pidChanged = 0;
      let idChanged  = 0;

      const finalArr = arr.map(orig => {
        let next = orig;
        let pidOrNameMutated = false;

        // (A) Normalize projectId — bỏ qua trash
        if (!t.skipPid) {
          if (!next.projectId) {
            const ctName = (next[t.ctField] || next.ct || next.congtrinh || '').trim();
            if (ctName) {
              const pid = _findPidLocal(ctName);
              next = { ...next, projectId: pid || _UNASSIGNED_PID };
              pidOrNameMutated = true;
            }
          }
          if (next.projectId && next.projectId !== _UNASSIGNED_PID) {
            const canonical = _getCanonicalLocal(next.projectId);
            if (canonical) {
              const cur = (next[t.ctField] || '').trim();
              if (cur && cur !== canonical) {
                next = { ...next, [t.ctField]: canonical };
                pidOrNameMutated = true;
              }
            }
          }
          if (pidOrNameMutated) {
            pidChanged++;
            // Bump updatedAt + deviceId vì có thay đổi nội dung
            next = { ...next, updatedAt: now, deviceId: devId };
          }
        }

        // (B) UUID migration — GIỮ NGUYÊN createdAt/updatedAt
        if (_isLegacyRecordId(next.id)) {
          next = { ...next, id: _genUUID() };
          idChanged++;
        }

        return next;
      });

      r1.changedByTable[t.key] = pidChanged;
      r2.changedByTable[t.key] = idChanged;

      // Bước 4: Ghi xuống IDB qua _dbSave + update _mem + globals
      if (typeof _dbSave === 'function') {
        await _dbSave(t.memKey, finalArr);
      }
      if (typeof _mem !== 'undefined') _mem[t.memKey] = finalArr;
      if (typeof window[t.glob] !== 'undefined') window[t.glob] = finalArr;
    }

    console.log('[Migration] normalizeProjectLinks:', r1.changedByTable);
    console.log('[Migration] migrateIdsToUUID:', r2.changedByTable);

    if (typeof clearInvoiceCache === 'function') clearInvoiceCache();

    // Bước 5: Đẩy lên cloud — dùng pushChanges() có sẵn
    if (typeof pushChanges === 'function' && typeof fbReady === 'function' && fbReady()) {
      try { await pushChanges(); } catch (e) { console.warn('[Migration] push lỗi (bỏ qua):', e); }
    } else if (typeof _incPending === 'function' && typeof schedulePush === 'function') {
      _incPending(); schedulePush();
    }

    if (typeof hideSyncBanner === 'function') hideSyncBanner();

    const totalChanged =
      Object.values(r1.changedByTable).reduce((s, n) => s + n, 0) +
      Object.values(r2.changedByTable).reduce((s, n) => s + n, 0);

    toast(`✅ Nâng cấp hoàn tất — ${totalChanged} bản ghi đã chuẩn hóa (toàn bộ năm)`, 'success');
    if (typeof _refreshAllTabs === 'function') _refreshAllTabs();

    return { r1, r2 };
  } catch (e) {
    if (typeof hideSyncBanner === 'function') hideSyncBanner();
    console.error('[Migration] LỖI:', e);
    toast('❌ Migration lỗi: ' + (e.message || String(e)) + ' — backup vẫn an toàn', 'error');
    throw e;
  }
}

// ── UI: Modal Nâng cấp hệ thống dữ liệu ──────────────────────

function toolUpgradeSchema() {
  const existing = document.getElementById('_mig-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_mig-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,24,20,.55);z-index:9000;'
    + 'display:flex;align-items:center;justify-content:center;padding:16px;'
    + 'backdrop-filter:blur(2px)';

  overlay.innerHTML = `
    <div style="background:var(--paper,#fff);border-radius:12px;width:100%;max-width:600px;
                max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 20px 60px rgba(0,0,0,.22);font-family:inherit">
      <div style="padding:16px 20px;border-bottom:1px solid var(--line,#e8e4da);
                  background:#f3f1ec;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:15px;font-weight:700">⚙️ Nâng Cấp Cấu Trúc Dữ Liệu</div>
        <button onclick="document.getElementById('_mig-modal-overlay').remove()"
          style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--ink2,#888);
                 padding:2px 6px;border-radius:4px;line-height:1">✕</button>
      </div>
      <div id="_mig-body" style="overflow-y:auto;padding:20px;flex:1">
        <div style="background:#fff8e1;border:1px solid #ffc107;border-radius:8px;padding:12px 14px;
                    font-size:12px;color:#856404;line-height:1.7;margin-bottom:14px">
          <b>🔄 Quy trình nâng cấp:</b><br>
          ① Backup toàn bộ dữ liệu vào IDB key <code>${_MIGRATION_BACKUP_KEY}</code><br>
          ② Chuẩn hóa <b>projectId</b> (gán UUID dự án + đồng bộ tên CT hiển thị)<br>
          ③ Chuyển <b>id</b> bản ghi: số/timestamp → UUID v4 (giữ <code>createdAt</code>/<code>updatedAt</code>)<br>
          ④ Lưu IDB + đẩy lên Cloud (nếu có)<br>
          <b style="color:#7f1d1d">⚠ Bấm "Dry Run" trước để xem có bao nhiêu bản ghi sẽ thay đổi.</b>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button id="_mig-btn-dry" onclick="_migDryRun()"
            style="background:var(--ink,#1a1814);color:#fff;border:none;border-radius:6px;
                   padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            🧪 Dry Run (Xem trước)
          </button>
        </div>
        <div id="_mig-result" style="margin-top:18px"></div>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function _migDryRun() {
  const btn = document.getElementById('_mig-btn-dry');
  const res = document.getElementById('_mig-result');
  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang đọc Database...'; }
  if (res) res.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;
                background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;
                color:#075985;font-size:13px">
      <span style="font-size:18px">⌛</span>
      <span>Đang đọc Database — quét toàn bộ kho lưu trữ (tất cả các năm), có thể mất vài giây...</span>
    </div>`;

  // defer 1 frame để browser render loading state
  await new Promise(r => setTimeout(r, 30));

  try {
    const dr = await dryRunMigration();
    window._migLastDry = dr;
    _migRenderDry(dr);
  } catch (e) {
    if (res) res.innerHTML = `<div style="color:#c0392b;font-size:13px">❌ Lỗi: ${e.message}</div>`;
    console.error('[Migration] dryRun lỗi:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🧪 Quét lại'; }
  }
}

function _migRenderDry(dr) {
  const res = document.getElementById('_mig-result');
  if (!res) return;

  const labels = { inv_v3:'Hóa đơn', cc_v2:'Chấm công', ung_v1:'Tiền ứng', tb_v1:'Thiết bị', thu_v1:'Thu tiền' };
  const rows = Object.entries(dr.perTable).map(([k, s]) => `
    <tr style="border-bottom:1px solid var(--line,#eee)">
      <td style="padding:8px 10px;font-weight:600">${labels[k] || k}</td>
      <td style="padding:8px 10px;text-align:center;color:var(--ink3,#888)">${s.total}</td>
      <td style="padding:8px 10px;text-align:center;color:#c0392b;font-weight:700">${s.idCount || ''}</td>
      <td style="padding:8px 10px;text-align:center;color:#1a7a45;font-weight:700">${s.pidLinked || ''}</td>
      <td style="padding:8px 10px;text-align:center;color:#e67e22;font-weight:700">${s.pidUnassigned || ''}</td>
      <td style="padding:8px 10px;text-align:center;color:#4a90d9;font-weight:700">${s.nameSynced || ''}</td>
    </tr>`).join('');

  const t = dr.totals;
  const totalAll = t.totalIdMigrate + t.totalPidLinked + t.totalPidUnassigned + t.totalNameSynced;

  res.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px">📊 Kết quả Dry Run</div>
    <div style="overflow-x:auto;border:1px solid var(--line,#e8e4da);border-radius:8px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f3f1ec;font-size:11px;color:var(--ink2,#666)">
            <th style="padding:8px 10px;text-align:left;font-weight:600">Bảng</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600">Tổng</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="ID số → UUID">→UUID</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="Gán projectId tự khớp">PID gán</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="Không tìm được CT → UNASSIGNED">UNASSIGN</th>
            <th style="padding:8px 10px;text-align:center;font-weight:600" title="Đồng bộ tên CT về chuẩn">Tên đồng bộ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;
                border-radius:8px;font-size:12px;color:#075985;line-height:1.6">
      <b>Tổng cộng:</b> ${t.totalIdMigrate} ID sẽ chuyển UUID ·
      ${t.totalPidLinked} PID sẽ gán · ${t.totalPidUnassigned} UNASSIGNED ·
      ${t.totalNameSynced} tên CT đồng bộ
    </div>

    ${totalAll === 0
      ? `<div style="margin-top:14px;text-align:center;padding:14px;color:#166534;font-weight:700">
           ✅ Schema đã chuẩn — không cần migration
         </div>`
      : `<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end">
           <button onclick="document.getElementById('_mig-modal-overlay').remove()"
             style="padding:8px 16px;border:1px solid var(--line2,#ccc);border-radius:6px;
                    background:var(--bg,#f5f5f5);cursor:pointer;font-size:13px;font-family:inherit">
             Huỷ
           </button>
           <button onclick="_migCommit()"
             style="padding:8px 18px;border:none;border-radius:6px;background:#1a7a45;color:#fff;
                    cursor:pointer;font-size:13px;font-weight:700;font-family:inherit">
             ⚙️ Xác nhận nâng cấp (${totalAll} bản ghi)
           </button>
         </div>`
    }`;
}

async function _migCommit() {
  const dr = window._migLastDry;
  if (!dr) { toast('Chạy Dry Run trước', 'error'); return; }

  const res = document.getElementById('_mig-result');
  if (res) res.innerHTML += `<div style="margin-top:12px;color:var(--ink2,#888);font-size:13px">⏳ Đang nâng cấp... (backup → chuẩn hóa → push)</div>`;

  try {
    await _runFullMigration();
    const overlay = document.getElementById('_mig-modal-overlay');
    if (overlay) overlay.remove();
    delete window._migLastDry;
  } catch (e) {
    // toast đã hiện trong _runFullMigration
  }
}
