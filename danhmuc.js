// danhmuc.js — CT Page / Settings / Danh Mục / Tiền Ứng
// Load order: 4 (after hoadon.js)

// ══════════════════════════════
//  CT PAGE
// ══════════════════════════════
function renderCtPage() {
  const grid=document.getElementById('ct-grid');
  const map={};
  getInvoicesCached().forEach(inv=>{
    if(!inActiveYear(inv.ngay)) return;
    const ctKey = resolveProjectName(inv) || '(Không rõ)';
    if(!map[ctKey]) map[ctKey]={total:0,count:0,byLoai:{}};
    map[ctKey].total+=(inv.thanhtien||inv.tien||0); map[ctKey].count++;
    map[ctKey].byLoai[inv.loai]=(map[ctKey].byLoai[inv.loai]||0)+(inv.thanhtien||inv.tien||0);
  });
  const sortBy=(document.getElementById('ct-sort')?.value)||'value';
  const entries=Object.entries(map).sort((a,b)=>
    sortBy==='name' ? a[0].localeCompare(b[0],'vi') : b[1].total-a[1].total
  );
  if(!entries.length){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--ink3);font-size:14px">Chưa có dữ liệu</div>`;return;}
  grid.innerHTML=entries.map(([ct,d])=>{
    const rows=Object.entries(d.byLoai).sort((a,b)=>b[1]-a[1]);
    return `<div class="ct-card" onclick="showCtModal(${JSON.stringify(ct)})">
      <div class="ct-card-head">
        <div><div class="ct-card-name">${x(ct)}</div><div class="ct-card-count">${d.count} hóa đơn</div></div>
        <div class="ct-card-total">${fmtS(d.total)}</div>
      </div>
      <div class="ct-card-body">
        ${rows.slice(0,6).map(([l,v])=>`<div class="ct-loai-row"><span class="ct-loai-name">${x(l)}</span><span class="ct-loai-val">${fmtS(v)}</span></div>`).join('')}
        ${rows.length>6?`<div style="font-size:11px;color:var(--ink3);text-align:right;padding-top:6px">+${rows.length-6} loại khác...</div>`:''}
      </div>
    </div>`;
  }).join('');
}

function showCtModal(ctName) {
  const invs=getInvoicesCached().filter(i=>resolveProjectName(i)===ctName && inActiveYear(i.ngay));
  document.getElementById('modal-title').textContent='🏗️ '+ctName;
  const byLoai={};
  invs.forEach(inv=>{ if(!byLoai[inv.loai])byLoai[inv.loai]=[]; byLoai[inv.loai].push(inv); });
  const total=invs.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  let html=`<div style="display:flex;gap:12px;margin-bottom:18px">
    <div style="flex:1;background:var(--bg);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tổng HĐ</div><div style="font-size:22px;font-weight:700">${invs.length}</div></div>
    <div style="flex:2;background:var(--green-bg);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tổng Chi Phí</div><div style="font-size:20px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--green)">${fmtM(total)}</div></div>
  </div>`;
  Object.entries(byLoai).forEach(([loai,invList])=>{
    const lt=invList.reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
    html+=`<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:var(--gold-bg);border-radius:6px;margin-bottom:6px">
        <span class="tag tag-gold">${x(loai)}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${fmtM(lt)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>${['Ngày','Người TH','Nội Dung','Thành Tiền'].map((h,i)=>`<th style="padding:5px 8px;background:#f3f1ec;font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;text-align:${i===3?'right':'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${invList.map(i=>`<tr style="border-bottom:1px solid var(--line)">
          <td style="padding:6px 8px;font-family:'IBM Plex Mono',monospace;color:var(--ink2)">${i.ngay}</td>
          <td style="padding:6px 8px;color:var(--ink2)">${x(i.nguoi||'—')}</td>
          <td style="padding:6px 8px;color:var(--ink2)">${x(i.nd||'—')}</td>
          <td style="padding:6px 8px;text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--green)">${numFmt(i.thanhtien||i.tien||0)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  });
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('ct-modal').classList.add('open');
}
function closeModal(){ document.getElementById('ct-modal').classList.remove('open'); }
document.getElementById('ct-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget)closeModal(); });

// ══════════════════════════════
//  DANH MỤC — NORMALIZE + DEDUP
// ══════════════════════════════

// Chuẩn hóa tên theo loại danh mục
// loaiChiPhi / tbTen → Title Case; còn lại → UPPERCASE
function normalizeName(catId, val) {
  val = (val || '').trim();
  if (!val) return val;
  if (catId === 'loaiChiPhi' || catId === 'tbTen') {
    return val.toLowerCase().split(/\s+/).filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return val.toUpperCase();
}

// Chuẩn hóa để so sánh trùng: bỏ dấu tiếng Việt + lowercase + chuẩn khoảng trắng
function normalizeKey(val) {
  return (val || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // bỏ dấu kết hợp Unicode
    .replace(/[đĐ]/g, 'd')             // đ/Đ → d
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Kiểm tra item có phát sinh trong năm đang chọn không
// LƯU Ý: cả 2 vế trong .some() đều bọc qua normalizeKey() để map "Hóa Đơn Lẻ" ↔ "HÓA ĐƠN LẺ"
function _isDmItemUsedInYear(catId, item) {
  const nItem = normalizeKey(item);
  if (!nItem) return false;
  const invs = getInvoicesCached();
  const cfg = CATS.find(c => c.id === catId);
  if (cfg && cfg.refField) {
    if (invs.some(i => inActiveYear(i.ngay)
        && normalizeKey(i[cfg.refField] || '') === nItem)) return true;
  }
  if (catId === 'thauPhu' || catId === 'nhaCungCap') {
    if (ungRecords.some(r => !r.deletedAt && inActiveYear(r.ngay)
        && (r.loai || 'thauphu') === 'thauphu'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'congNhan') {
    if (ccData.some(w => !w.deletedAt && inActiveYear(w.fromDate)
        && (w.workers || []).some(wk => normalizeKey(wk.name) === nItem))) return true;
    if (ungRecords.some(r => !r.deletedAt && inActiveYear(r.ngay)
        && r.loai === 'congnhan'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'tbTen') {
    if (typeof tbData !== 'undefined'
        && tbData.some(t => !t.deletedAt && inActiveYear(t.ngay)
            && normalizeKey(t.ten) === nItem)) return true;
  }
  return false;
}

// Kiểm tra item có phát sinh bất kỳ năm nào không
// LƯU Ý: cả 2 vế đều bọc normalizeKey() để khớp được mọi dạng hoa/thường/dấu
function _isDmItemUsedAnytime(catId, item) {
  const nItem = normalizeKey(item);
  if (!nItem) return false;
  const invs = getInvoicesCached();
  const cfg = CATS.find(c => c.id === catId);
  if (cfg && cfg.refField) {
    if (invs.some(i => normalizeKey(i[cfg.refField] || '') === nItem)) return true;
  }
  if (catId === 'thauPhu' || catId === 'nhaCungCap') {
    if (ungRecords.some(r => !r.deletedAt
        && (r.loai || 'thauphu') === 'thauphu'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'congNhan') {
    if (ccData.some(w => !w.deletedAt
        && (w.workers || []).some(wk => normalizeKey(wk.name) === nItem))) return true;
    if (ungRecords.some(r => !r.deletedAt && r.loai === 'congnhan'
        && normalizeKey(r.tp || '') === nItem)) return true;
  }
  if (catId === 'tbTen') {
    if (typeof tbData !== 'undefined'
        && tbData.some(t => !t.deletedAt && normalizeKey(t.ten) === nItem)) return true;
  }
  return false;
}

// Quét và sửa toàn bộ data cũ: chuẩn hóa tên trong mọi record cho khớp với cats
// Mỗi bảng: nếu normalizeKey(giá trị) khớp cats nhưng cách viết khác → thay bằng tên chuẩn
function scanAndFixAllDataFormats() {
  // Xây canonical map: normalizeKey → tên chuẩn (từ cats)
  const canonMap = new Map();
  const addArr = arr => (arr||[]).forEach(name => {
    const k = normalizeKey(name);
    if (k && !canonMap.has(k)) canonMap.set(k, name);
  });
  addArr(cats.loaiChiPhi); addArr(cats.nhaCungCap); addArr(cats.nguoiTH);
  addArr(cats.thauPhu);    addArr(cats.congNhan);   addArr(cats.tbTen);
  if (!canonMap.size) return;

  // Tra cứu tên chuẩn; trả về nguyên gốc nếu không có trong danh mục
  const fix = v => { const c = canonMap.get(normalizeKey(v||'')); return (c&&c!==v) ? c : v; };

  let inv=false, ung=false, cc=false, tb=false, tp=false, thu=false, hd=false, roles=false;

  // invoices: loai, ncc, nguoi
  invoices.forEach(r => {
    ['loai','ncc','nguoi'].forEach(f => {
      if (!r[f]) return;
      const fixed = fix(r[f]);
      if (fixed !== r[f]) { r[f]=fixed; inv=true; }
    });
  });

  // ungRecords: tp
  ungRecords.forEach(r => {
    if (!r.tp) return;
    const fixed = fix(r.tp);
    if (fixed !== r.tp) { r.tp=fixed; ung=true; }
  });

  // ccData: worker.name
  (ccData||[]).forEach(week => {
    (week.workers||[]).forEach(wk => {
      if (!wk.name) return;
      const fixed = fix(wk.name);
      if (fixed !== wk.name) { wk.name=fixed; cc=true; }
    });
  });

  // tbData: ten
  if (typeof tbData!=='undefined') tbData.forEach(t => {
    if (!t.ten) return;
    const fixed = fix(t.ten);
    if (fixed !== t.ten) { t.ten=fixed; tb=true; }
  });

  // thauPhuContracts: thauphu
  if (typeof thauPhuContracts!=='undefined') thauPhuContracts.forEach(r => {
    if (!r.thauphu) return;
    const fixed = fix(r.thauphu);
    if (fixed !== r.thauphu) { r.thauphu=fixed; tp=true; }
  });

  // thuRecords: nguoi
  if (typeof thuRecords!=='undefined') thuRecords.forEach(r => {
    if (!r.nguoi) return;
    const fixed = fix(r.nguoi);
    if (fixed !== r.nguoi) { r.nguoi=fixed; thu=true; }
  });

  // hopDongData: nguoi
  if (typeof hopDongData!=='undefined') Object.values(hopDongData).forEach(hd_ => {
    if (!hd_.nguoi) return;
    const fixed = fix(hd_.nguoi);
    if (fixed !== hd_.nguoi) { hd_.nguoi=fixed; hd=true; }
  });

  // cnRoles: rename keys sai hoa/thường
  if (typeof cnRoles!=='undefined') {
    const fixed = {};
    Object.entries(cnRoles).forEach(([k,v]) => {
      const fk = fix(k) || k;
      if (!fixed.hasOwnProperty(fk)) fixed[fk]=v;
      if (fk!==k) roles=true;
    });
    if (roles) {
      Object.keys(cnRoles).forEach(k => delete cnRoles[k]);
      Object.assign(cnRoles, fixed);
      save('cat_cn_roles', cnRoles);
    }
  }

  // Lưu các bảng đã thay đổi
  if (inv)  { clearInvoiceCache(); save('inv_v3', invoices); }
  if (ung)  save('ung_v1', ungRecords);
  if (cc)   save('cc_v2',  ccData);
  if (tb)   save('tb_v1',  tbData);
  if (tp)   save('thauphu_v1',  thauPhuContracts);
  if (thu)  save('thu_v1', thuRecords);
  if (hd)   save('hopdong_v1',  hopDongData);

  const n = [inv,ung,cc,tb,tp,thu,hd,roles].filter(Boolean).length;
  if (n) console.log(`[DM] scanAndFixAllDataFormats: đã chuẩn hóa ${n} bảng dữ liệu`);
}

// Chuẩn hóa dữ liệu hiện có: loaiChiPhi + tbTen → Title Case
// Idempotent: chỉ save khi thực sự có thay đổi
let _catNamesMigrated = false;
function _migrateCatNamesFormat() {
  if (_catNamesMigrated) return;
  _catNamesMigrated = true;
  let changed = false;
  // Bước 1: chuẩn hóa + dedup mảng cats (Title Case / UPPERCASE + loại bỏ bản trùng)
  ['loaiChiPhi', 'tbTen', 'nhaCungCap', 'nguoiTH', 'thauPhu', 'congNhan'].forEach(catId => {
    if (!Array.isArray(cats[catId])) return;
    // normalize từng phần tử, sau đó dedup bằng normalizeKey (bắt "COPHA" vs "Copha")
    const seen = new Set();
    const deduped = cats[catId]
      .map(n => normalizeName(catId, n))
      .filter(n => {
        const k = normalizeKey(n);
        return k && !seen.has(k) ? (seen.add(k), true) : false;
      });
    if (JSON.stringify(deduped) !== JSON.stringify(cats[catId])) {
      cats[catId] = deduped;
      saveCats(catId);
      changed = true;
    }
  });
  if (changed) console.log('[DM] _migrateCatNamesFormat: chuẩn hóa + dedup cats xong');
  // Bước 2: quét và sửa tất cả data cũ trong DB
  scanAndFixAllDataFormats();
}

// ══════════════════════════════
//  SETTINGS
// ══════════════════════════════
function renderSettings() {
  _migrateCatNamesFormat(); // đảm bảo data luôn đúng format trước khi render
  const grid=document.getElementById('dm-grid');
  grid.innerHTML='';
  // congTrinh đã có module riêng (Tab Công Trình) — không hiển thị card tại đây nữa
  CATS.filter(cfg => cfg.id !== 'congTrinh').forEach(cfg=>{
    // ── tbTen: bổ sung tên thiết bị có trong tbData mà thiếu trong cats.tbTen ──
    // Đảm bảo danh sách hiển thị đầy đủ thiết bị thực tế đang tồn tại,
    // không bị rớt do pruneTbTen cũ hay sync chưa kịp.
    if (cfg.id === 'tbTen' && typeof tbData !== 'undefined') {
      const haveKeys = new Set((cats.tbTen || []).map(n => normalizeKey(n)));
      const toAdd = [];
      tbData.filter(t => !t.deletedAt && t.ten).forEach(t => {
        const k = normalizeKey(t.ten);
        if (k && !haveKeys.has(k)) {
          haveKeys.add(k);
          toAdd.push(normalizeName('tbTen', t.ten));
        }
      });
      if (toAdd.length) {
        cats.tbTen = [...(cats.tbTen || []), ...toAdd];
        saveCats('tbTen');
      }
    }

    const fullList = cats[cfg.id];
    const withIdxRaw = fullList.map((item, idx) => ({item, idx}));

    // ── Dedup UI: gộp các entry cùng normalizeKey thành 1 dòng ──
    // VD: "Hóa Đơn Lẻ" + "HÓA ĐƠN LẺ" → giữ 1 dòng (ưu tiên bản đúng format chuẩn)
    const dedupMap = new Map();
    withIdxRaw.forEach(entry => {
      const k = normalizeKey(entry.item);
      if (!k) return;
      const existing = dedupMap.get(k);
      if (!existing) { dedupMap.set(k, entry); return; }
      // Có duplicate → ưu tiên bản đã đúng format chuẩn (normalizeName)
      const canonical = normalizeName(cfg.id, entry.item);
      const currentIsCanonical = entry.item === canonical;
      const existingIsCanonical = existing.item === canonical;
      if (currentIsCanonical && !existingIsCanonical) dedupMap.set(k, entry);
    });

    // Lọc theo năm: tbTen luôn hiển thị 100%; các card khác lọc 3 trạng thái
    const allDeduped = [...dedupMap.values()];
    const filteredByYear = cfg.id === 'tbTen'
      ? allDeduped
      : allDeduped.filter(({item}) => {
          const usedInYear = _isDmItemUsedInYear(cfg.id, item);
          if (usedInYear) return true;          // Có phát sinh năm đang chọn → hiện
          const usedAnytime = _isDmItemUsedAnytime(cfg.id, item);
          return !usedAnytime;                  // Chưa từng dùng → hiện; dùng năm khác → ẩn
        });

    const filtered = filteredByYear
      .sort((a, b) => (a.item || '').localeCompare(b.item || '', 'vi'));
    const countLabel = `${filtered.length}`;
    const card=document.createElement('div');
    card.className='settings-card';
    card.innerHTML=`
      <div class="settings-card-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="settings-card-title">${cfg.title} <span style="font-size:11px;font-weight:400;color:var(--ink3)">(${countLabel})</span></div>
        <input type="search" id="dm-search-${cfg.id}" placeholder="🔍 Tìm..." autocomplete="off"
          style="flex:0 0 auto;width:140px;padding:4px 8px;border:1.5px solid var(--line2);border-radius:6px;font-family:inherit;font-size:12px;background:var(--paper);color:var(--ink);outline:none"
          oninput="_dmFilterCard('${cfg.id}')">
      </div>
      <div class="settings-list" id="sl-${cfg.id}">
        ${filtered.map(({item,idx})=>
          cfg.id==='congNhan'  ? renderCNItem(item,idx) :
          cfg.id==='congTrinh' ? renderCTItem(item,idx) :
          cfg.id==='tbTen'     ? renderTbTenItem(item,idx) :
          renderItem(cfg.id,item,idx)
        ).join('')}
      </div>
      <div class="settings-add">
        <input type="text" id="sa-${cfg.id}" placeholder="Thêm mới..." onkeydown="if(event.key==='Enter')addItem('${cfg.id}')">
        <button class="btn btn-gold btn-sm" onclick="addItem('${cfg.id}')">+ Thêm</button>
      </div>`;
    grid.appendChild(card);
  });
  // Render panel sao lưu
  renderBackupList();
}

// ── Per-card search filter ────────────────────────────────────────
function _dmFilterCard(catId) {
  const q = (document.getElementById('dm-search-' + catId)?.value || '').toLowerCase().trim();
  const list = document.getElementById('sl-' + catId);
  if (!list) return;
  list.querySelectorAll('.settings-item').forEach(el => {
    const nameEl = el.querySelector('.s-name');
    const text = (nameEl ? nameEl.textContent : el.textContent).toLowerCase();
    el.style.display = !q || text.includes(q) ? '' : 'none';
  });
}

// ── Render item Công Trình với badge năm ──────────────────────────
function renderCTItem(item, idx) {
  const inUse = isItemInUse('congTrinh', item);
  const yr = cats.congTrinhYears && cats.congTrinhYears[item];
  const yrBadge = yr
    ? `<span style="font-size:10px;color:#1565c0;padding:1px 5px;background:rgba(21,101,192,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">${yr}</span>`
    : '';
  return `<div class="settings-item" id="si-congTrinh-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-congTrinh-${idx}" ondblclick="startEdit('congTrinh',${idx})">${x(item)}</span>
    ${yrBadge}
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-congTrinh-${idx}" value="${x(item)}"
      onblur="finishEdit('congTrinh',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('congTrinh',${idx});if(event.key==='Escape')cancelEdit('congTrinh',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('congTrinh',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('congTrinh',${idx})"
      title="${inUse?'Đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

function renderItem(catId,item,idx) {
  const inUse = isItemInUse(catId, item);
  return `<div class="settings-item" id="si-${catId}-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-${catId}-${idx}" ondblclick="startEdit('${catId}',${idx})">${x(item)}</span>
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-${catId}-${idx}" value="${x(item)}"
      onblur="finishEdit('${catId}',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('${catId}',${idx});if(event.key==='Escape')cancelEdit('${catId}',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('${catId}',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('${catId}',${idx})"
      title="${inUse?'Đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

// ── Render item Công Nhân với cột T/P ────────────────────────────
function renderCNItem(name, idx) {
  const role = cnRoles[name] || '';
  // Chỉ tính record chưa bị xóa mềm
  const inUse = ccData.some(w => !w.deletedAt && w.workers && w.workers.some(wk => wk.name === name));
  return `<div class="settings-item" id="si-congNhan-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-congNhan-${idx}" ondblclick="startEdit('congNhan',${idx})">${x(name)}</span>
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-congNhan-${idx}" value="${x(name)}"
      onblur="finishEdit('congNhan',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('congNhan',${idx});if(event.key==='Escape')cancelEdit('congNhan',${idx})">
    <select onchange="updateCNRole(${idx},this.value)"
      style="margin:0 4px;padding:2px 6px;border:1px solid var(--line2);border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;min-width:44px"
      title="Vai trò (C=Cái, T=Thợ, P=Phụ)">
      <option value="" ${!role?'selected':''}>—</option>
      <option value="C" ${role==='C'?'selected':''}>C</option>
      <option value="T" ${role==='T'?'selected':''}>T</option>
      <option value="P" ${role==='P'?'selected':''}>P</option>
    </select>
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('congNhan',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('congNhan',${idx})"
      title="${inUse?'Đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

// ── Cập nhật vai trò CN từ Danh mục ──────────────────────────────
function updateCNRole(idx, role) {
  const name = cats.congNhan[idx];
  if (!name) return;
  cnRoles[name] = role;
  save('cat_cn_roles', cnRoles);
  syncCNRoles(name, role);
  toast(`✅ Đã cập nhật vai trò "${name}" → ${role||'—'}`, 'success');
}

// ── Render item Thiết Bị (tbTen) ──────────────────────────────────
function renderTbTenItem(item, idx) {
  const inUse = typeof tbData !== 'undefined' && tbData.some(t => t.ten === item);
  return `<div class="settings-item" id="si-tbTen-${idx}" style="${inUse?'background:rgba(26,122,69,0.04)':''}">
    <span class="s-name" id="sn-tbTen-${idx}" ondblclick="startEdit('tbTen',${idx})">${x(item)}</span>
    ${inUse?`<span title="Đang được sử dụng" style="font-size:10px;color:#1a7a45;padding:2px 5px;background:rgba(26,122,69,0.1);border-radius:3px;margin-right:2px;flex-shrink:0">✓ đang dùng</span>`:''}
    <input class="s-edit-input" id="se-tbTen-${idx}" value="${x(item)}"
      onblur="finishEdit('tbTen',${idx})"
      onkeydown="if(event.key==='Enter')finishEdit('tbTen',${idx});if(event.key==='Escape')cancelEdit('tbTen',${idx})">
    <button class="btn btn-outline btn-sm btn-icon" onclick="startEdit('tbTen',${idx})" title="Sửa tên">✏️</button>
    <button class="btn ${inUse?'btn-outline':'btn-danger'} btn-sm btn-icon" onclick="delItem('tbTen',${idx})"
      title="${inUse?'Thiết bị đang được sử dụng — không thể xóa':'Xóa'}" ${inUse?'style="opacity:0.4;cursor:not-allowed"':''}>✕</button>
  </div>`;
}

// ── Đồng bộ vai trò vào ccData (năm hiện tại + năm trước) ────────
function syncCNRoles(name, role) {
  const curYear = activeYear || new Date().getFullYear();
  const prevYear = curYear - 1;
  let changed = false;
  ccData.forEach(week => {
    const yr = parseInt((week.fromDate || '').slice(0, 4));
    if (yr !== curYear && yr !== prevYear) return;
    (week.workers || []).forEach(wk => {
      if (wk.name === name) { wk.role = role; changed = true; }
    });
  });
  if (changed) { clearInvoiceCache(); save('cc_v2', ccData); }
}

function startEdit(catId,idx) {
  document.getElementById(`sn-${catId}-${idx}`).classList.add('off');
  const e=document.getElementById(`se-${catId}-${idx}`); e.classList.add('on'); e.focus(); e.select();
}
function cancelEdit(catId,idx) {
  document.getElementById(`se-${catId}-${idx}`).classList.remove('on');
  document.getElementById(`sn-${catId}-${idx}`).classList.remove('off');
}
function finishEdit(catId,idx) {
  // congTrinh không được đổi tên qua danh mục — dùng Tab Công Trình để đổi tên project
  if (catId === 'congTrinh') {
    cancelEdit(catId, idx);
    toast('💡 Đổi tên công trình tại Tab Công Trình → nhấn ✏️ trên project', 'info');
    return;
  }
  const inp=document.getElementById(`se-${catId}-${idx}`);
  let newVal=normalizeName(catId, inp.value);
  if(!newVal){cancelEdit(catId,idx);return;}
  inp.value = newVal; // cập nhật input để hiển thị tên đã chuẩn hóa
  const old=cats[catId][idx];
  if(newVal===old){cancelEdit(catId,idx);return;} // không thay đổi thực sự
  // Chống trùng: so sánh sau khi bỏ dấu + lowercase
  const normNew = normalizeKey(newVal);
  const isDup = cats[catId].some((existing, i) => i !== idx && normalizeKey(existing) === normNew);
  if(isDup){toast(`⚠️ "${newVal}" đã tồn tại trong danh mục!`,'error');cancelEdit(catId,idx);return;}
  cats[catId][idx]=newVal;
  // normalizeKey(old) dùng để so sánh — bắt được cả trường hợp cũ sai hoa/thường
  const normOld = normalizeKey(old);
  const cfg=CATS.find(c=>c.id===catId);
  if(cfg&&cfg.refField) {
    // invoices: fix refField (loai, ncc, nguoi...)
    invoices.forEach(inv=>{
      if(normalizeKey(inv[cfg.refField]||'')===normOld) inv[cfg.refField]=newVal;
    });
    // ungRecords.tp: nguoiTH / nhaCungCap / thauPhu → loai thauphu; congNhan → loai congnhan
    if(catId==='nguoiTH'||catId==='nhaCungCap'||catId==='thauPhu') {
      ungRecords.forEach(r=>{
        if((r.loai||'thauphu')==='thauphu' && normalizeKey(r.tp||'')===normOld) r.tp=newVal;
      });
    }
    if(catId==='congNhan') {
      ungRecords.forEach(r=>{
        if(r.loai==='congnhan' && normalizeKey(r.tp||'')===normOld) r.tp=newVal;
      });
    }
  }
  // tbTen → tbData.ten
  if(catId==='tbTen' && typeof tbData!=='undefined') {
    tbData.forEach(t=>{ if(normalizeKey(t.ten||'')===normOld) t.ten=newVal; });
    save('tb_v1',tbData);
    try{ tbRefreshNameDl(); tbPopulateSels(); tbRenderList(); renderKhoTong(); tbRenderThongKeVon(); }catch(e){}
  }
  // thauPhu → thauPhuContracts.thauphu
  if(catId==='thauPhu' && typeof thauPhuContracts!=='undefined') {
    thauPhuContracts.forEach(r=>{ if(normalizeKey(r.thauphu||'')===normOld) r.thauphu=newVal; });
    save('thauphu_v1',thauPhuContracts);
  }
  // nguoiTH → thuRecords.nguoi + hopDongData[].nguoi
  if(catId==='nguoiTH') {
    if(typeof thuRecords!=='undefined') {
      thuRecords.forEach(r=>{ if(normalizeKey(r.nguoi||'')===normOld) r.nguoi=newVal; });
      save('thu_v1',thuRecords);
    }
    if(typeof hopDongData!=='undefined') {
      Object.values(hopDongData).forEach(hd=>{ if(normalizeKey(hd.nguoi||'')===normOld) hd.nguoi=newVal; });
      save('hopdong_v1',hopDongData);
    }
  }
  // congNhan → ccData workers + cnRoles key
  if(catId==='congNhan') {
    if(typeof ccData!=='undefined') {
      ccData.forEach(week=>{
        (week.workers||[]).forEach(wk=>{ if(normalizeKey(wk.name||'')===normOld) wk.name=newVal; });
      });
      save('cc_v2',ccData);
    }
    if(typeof cnRoles!=='undefined') {
      // tìm key cũ bằng normalizeKey (đề phòng key cũ sai hoa/thường)
      const oldKey=Object.keys(cnRoles).find(k=>normalizeKey(k)===normOld);
      if(oldKey!==undefined) {
        cnRoles[newVal]=cnRoles[oldKey];
        delete cnRoles[oldKey];
        save('cat_cn_roles',cnRoles);
      }
    }
  }
  saveCats(catId); clearInvoiceCache(); save('inv_v3',invoices); save('ung_v1',ungRecords);
  renderSettings(); updateTop();
  try { dtPopulateSels(); } catch(e) {}
  toast('✅ Đã cập nhật "'+newVal+'"','success');
}
function addItem(catId) {
  // congTrinh không được thêm trực tiếp — phải tạo qua Tab Công Trình (projects_v1)
  if (catId === 'congTrinh') {
    const inp = document.getElementById(`sa-${catId}`);
    if (inp) inp.value = '';
    toast('💡 Thêm công trình tại Tab Công Trình (nút + Thêm CT mới)', 'info');
    return;
  }
  const inp=document.getElementById(`sa-${catId}`);
  let val=normalizeName(catId, inp.value);
  if(!val) return;
  // Chống trùng: so sánh sau khi bỏ dấu + lowercase (áp dụng đồng nhất cho tất cả catId)
  const normVal = normalizeKey(val);
  const isDup = cats[catId].some(existing => normalizeKey(existing) === normVal);
  if(isDup){toast(`⚠️ "${val}" đã tồn tại trong danh mục!`,'error');return;}
  cats[catId].push(val);
  // Gán năm cho công trình mới (để lọc theo năm)
  if (catId === 'congTrinh') {
    cats.congTrinhYears[val] = activeYear || new Date().getFullYear();
  }
  saveCats(catId); inp.value='';
  renderSettings(); rebuildEntrySelects(); rebuildUngSelects();
  if (catId === 'congTrinh') {
    try { populateCCCtSel(); } catch(e) {}
    try { tbPopulateSels(); } catch(e) {}
  }
  if (catId === 'tbTen') {
    try { tbRefreshNameDl(); tbPopulateSels(); } catch(e) {}
  }
  // Realtime sync vào các dropdown Doanh Thu
  if (catId === 'nguoiTH' || catId === 'thauPhu' || catId === 'nhaCungCap') {
    try { dtPopulateSels(); } catch(e) {}
  }
  toast(`✅ Đã thêm "${val}"`,'success');
}
function isItemInUse(catId, item) {
  const nk = normalizeKey; // alias ngắn
  const nItem = nk(item);
  // tbTen — kiểm tra trong tbData, so sánh normalized
  if (catId === 'tbTen') return typeof tbData !== 'undefined'
    && tbData.some(t => !t.deletedAt && nk(t.ten) === nItem);
  const cfg = CATS.find(c=>c.id===catId);
  if (!cfg || !cfg.refField) {
    if (catId === 'congNhan') return ccData.some(w => !w.deletedAt && w.workers
      && w.workers.some(wk => nk(wk.name) === nItem));
    return false;
  }
  // Kiểm tra trong invoices (so sánh normalized)
  if (getInvoicesCached().some(i => nk(i[cfg.refField]||'') === nItem)) return true;
  // Kiểm tra trong ungRecords
  if (catId === 'thauPhu') {
    if (ungRecords.some(r => !r.deletedAt && (r.loai||'thauphu') === 'thauphu'
        && nk(r.tp||'') === nItem)) return true;
  }
  if (catId === 'nhaCungCap') {
    if (ungRecords.some(r => !r.deletedAt && (r.loai||'thauphu') === 'thauphu'
        && nk(r.tp||'') === nItem)) return true;
  }
  if (catId === 'congNhan') {
    if (ungRecords.some(r => !r.deletedAt && r.loai === 'congnhan'
        && nk(r.tp||'') === nItem)) return true;
  }
  // Kiểm tra congTrinh trong ung + cc + thietbi
  if (catId === 'congTrinh') {
    if (ungRecords.some(r => !r.deletedAt && nk(r.congtrinh||'') === nItem)) return true;
    if (ccData.some(w => !w.deletedAt && nk(w.ct||'') === nItem)) return true;
    if (typeof tbData !== 'undefined' && tbData.some(r => !r.deletedAt && nk(r.ct||'') === nItem)) return true;
  }
  return false;
}

function delItem(catId,idx) {
  // congTrinh không được xóa qua danh mục — phải xóa/kết thúc qua Tab Công Trình
  if (catId === 'congTrinh') {
    toast('💡 Quản lý công trình tại Tab Công Trình — đổi trạng thái thành "Đã quyết toán" để ẩn', 'info');
    return;
  }
  const item=cats[catId][idx];
  if(isItemInUse(catId, item)) {
    const msg = catId === 'tbTen'
      ? '⚠️ Thiết bị đang được sử dụng trong công trình — không thể xóa.'
      : '⚠️ Mục này đã có dữ liệu, không thể xóa.';
    toast(msg, 'error');
    return;
  }
  if(!confirm(`Xóa "${item}" khỏi danh mục?`)) return;
  if (catId === 'thauPhu') {
    ungRecords = ungRecords.filter(r => !(r.loai === 'thauphu' && r.tp === item));
  }
  if (catId === 'nhaCungCap') {
    ungRecords = ungRecords.filter(r => !(r.loai === 'nhacungcap' && r.tp === item));
  }
  if (catId === 'congNhan') {
    ungRecords = ungRecords.filter(r => !(r.loai === 'congnhan' && r.tp === item));
  }
  cats[catId].splice(idx,1);
  // Xóa year entry nếu có
  if (catId === 'congTrinh' && cats.congTrinhYears) {
    delete cats.congTrinhYears[item];
  }
  saveCats(catId);
  save('ung_v1', ungRecords);
  renderSettings(); rebuildEntrySelects(); rebuildUngSelects();
  if (catId === 'congTrinh') {
    try { populateCCCtSel(); } catch(e) {}
    try { tbPopulateSels(); } catch(e) {}
  }
  toast(`Đã xóa "${item}"`);
}

// Dedup + sort mảng danh mục trước khi render dropdown
// Loại bỏ phần tử rỗng, dedup bằng normalizeKey, sắp xếp tiếng Việt
function _dedupCatArr(arr) {
  const seen = new Set();
  return (arr || [])
    .filter(v => v && v.trim())
    .filter(v => { const k = normalizeKey(v); return k && !seen.has(k) ? (seen.add(k), true) : false; })
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

function rebuildEntrySelects() {
  document.querySelectorAll('#entry-tbody [data-f="ct"]').forEach(sel=>{
    if(sel.tagName==='SELECT'){
      const cur=sel.value;
      sel.innerHTML = _buildProjOpts(cur, '-- Chọn --');
    }
  });
  document.querySelectorAll('#entry-tbody [data-f="loai"]').forEach(sel=>{
    if(sel.tagName==='SELECT'){
      const cur=sel.value;
      sel.innerHTML=`<option value="">-- Chọn --</option>`+
        _dedupCatArr(cats.loaiChiPhi).map(v=>`<option value="${x(v)}" ${v===cur?'selected':''}>${x(v)}</option>`).join('');
    }
  });
  // nguoi combo: nguoiTH + congNhan + thauPhu — dedup bằng normalizeKey
  const _nguoiCombo = _dedupCatArr([...cats.nguoiTH, ...cats.congNhan, ...cats.thauPhu]);
  document.querySelectorAll('#entry-tbody [data-f="nguoi"]').forEach(inp=>{
    const dl=document.getElementById(inp.getAttribute('list'));
    if(dl) dl.innerHTML=_nguoiCombo.map(v=>`<option value="${x(v)}">`).join('');
  });
  document.querySelectorAll('#entry-tbody [data-f="ncc"]').forEach(inp=>{
    const dl=document.getElementById(inp.getAttribute('list'));
    if(dl) dl.innerHTML=_dedupCatArr(cats.nhaCungCap).map(v=>`<option value="${x(v)}">`).join('');
  });
}

// ══════════════════════════════
//  TIỀN ỨNG - ENTRY TABLE
// ══════════════════════════════
let ungRecords = load('ung_v1', []);
let filteredUng = [];
let ungPage = 1;
const UNG_TP_PG = 10;
let ungTpPage = 1;
let _editingUngId = null;

// Chuẩn hóa dữ liệu cũ: cancelled=true -> deletedAt
function _normalizeUngDeletedAt() {
  let changed = false;
  ungRecords = (ungRecords || []).map(r => {
    if (!r) return r;
    if (r.cancelled === true && !r.deletedAt) {
      changed = true;
      return { ...r, deletedAt: r.updatedAt || Date.now() };
    }
    if (Object.prototype.hasOwnProperty.call(r, 'cancelled')) {
      changed = true;
      const rec = { ...r };
      delete rec.cancelled;
      return rec;
    }
    return r;
  });
  if (changed) save('ung_v1', ungRecords);
}
_normalizeUngDeletedAt();

function _normalizeUngProjectIds() {
  let changed = false;
  ungRecords.forEach(r => {
    if (r.deletedAt) return;
    if (!r.projectId && r.congtrinh) {
      const pid = _getProjectIdByName(r.congtrinh);
      if (pid) { r.projectId = pid; changed = true; }
    }
    // Sync name from project if needed
    if (r.projectId) {
      const pName = _getProjectNameById(r.projectId);
      if (pName && pName !== r.congtrinh) {
        r.congtrinh = pName;
        changed = true;
      }
    }
  });
  if (changed) save('ung_v1', ungRecords);
}
_normalizeUngProjectIds();

// Cleanup dữ liệu sai: loại tên NCC/CN nằm nhầm trong danh mục thầu phụ
cats.thauPhu = (cats.thauPhu || []).filter(name =>
  ungRecords.some(r => r.loai === 'thauphu' && r.tp === name)
  || !ungRecords.some(r => r.tp === name)
);

function initUngTable(n=4) {
  document.getElementById('ung-tbody').innerHTML='';
  for(let i=0;i<n;i++) addUngRow();
  calcUngSummary();
}

function initUngTableIfEmpty() {
  if(document.getElementById('ung-tbody').children.length===0) initUngTable(4);
}

function addUngRows(n) { for(let i=0;i<n;i++) addUngRow(); }

function clearUngRows() {
  const tbody = document.getElementById('ung-tbody');
  if (tbody) tbody.innerHTML = '';
  calcUngSummary();
}

function resetUngForm() {
  _editingUngId = null;
  initUngTable(4);
  document.getElementById('ung-date').value = today();
  const btn = document.getElementById('ung-save-btn');
  if (btn) btn.textContent = '💾 Lưu tất cả';
  calcUngSummary();
  document.querySelectorAll('.editing-row').forEach(tr => tr.classList.remove('editing-row'));
}

function onUngLoaiChange(sel) {
  const tr = sel.closest('tr');
  const tpInp = tr.querySelector('[data-f="tp"]');
  if (!tpInp) return;
  const loai = sel.value;
  tpInp.value = '';
  tpInp.placeholder = loai === 'nhacungcap'
    ? 'Chọn nhà cung cấp...'
    : 'Chọn thầu phụ...';
  calcUngSummary();
}

function _ungTpOptions(loai) {
  if (loai === 'nhacungcap') return cats.nhaCungCap;
  return cats.thauPhu;
}

function addUngRow(d={}) {
  const tbody = document.getElementById('ung-tbody');
  const num = tbody.children.length + 1;
  const ctOpts = _buildProjOpts(d.congtrinh||'', '-- Chọn --');
  const dLoai = d.loai || 'thauphu';
  const tpPlaceholder = dLoai === 'nhacungcap'
    ? 'Chọn nhà cung cấp...'
    : 'Chọn thầu phụ...';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${num}</td>
    <td style="padding:0">
      <select class="cell-input" data-f="loai" style="width:100%;border:none;background:transparent;padding:7px 6px;font-size:12px;font-weight:600;outline:none;color:var(--ink);cursor:pointer" onchange="onUngLoaiChange(this)">
        <option value="thauphu" ${dLoai==='thauphu'?'selected':''}>Thầu phụ</option>
        <option value="nhacungcap" ${dLoai==='nhacungcap'?'selected':''}>Nhà cung cấp</option>
      </select>
    </td>
    <td>
      <input class="cell-input" data-f="tp" value="${x(d.tp||'')}" placeholder="${tpPlaceholder}" autocomplete="off">
    </td>
    <td><select class="cell-input" data-f="ct">${ctOpts}</select></td>
    <td><input class="cell-input right tien-input" data-f="tien" data-raw="${d.tien||''}" placeholder="0" value="${d.tien?numFmt(d.tien):''}" inputmode="decimal"></td>
    <td><input class="cell-input" data-f="nd" value="${x(d.nd||'')}" placeholder="Nội dung..."></td>
    <td><button class="del-btn" onclick="delUngRow(this)">✕</button></td>
  `;

  const tienInput = tr.querySelector('[data-f="tien"]');
  tienInput.addEventListener('input', function() {
    const raw = this.value.replace(/[.,]/g,'');
    this.dataset.raw = raw;
    if(raw) this.value = numFmt(parseInt(raw,10)||0);
    calcUngSummary();
  });
  tienInput.addEventListener('focus', function() { this.value = this.dataset.raw || ''; });
  tienInput.addEventListener('blur',  function() {
    const raw = parseInt(this.dataset.raw||'0',10)||0;
    this.value = raw ? numFmt(raw) : '';
  });

  // Autocomplete cho ô Thầu Phụ / Công Nhân
  const tpInp = tr.querySelector('[data-f="tp"]');
  const _tpAC = () => {
    const loai = tr.querySelector('[data-f="loai"]')?.value || 'thauphu';
    _acShow(tpInp, _ungTpOptions(loai), v => { tpInp.value = v; calcUngSummary(); });
  };
  tpInp.addEventListener('input',  _tpAC);
  tpInp.addEventListener('focus',  _tpAC);
  tpInp.addEventListener('blur', function() {
    const v = this.value.trim();
    if (!v) return;
    const loai = tr.querySelector('[data-f="loai"]')?.value || 'thauphu';
    const opts = _ungTpOptions(loai);
    // Tìm tên chuẩn trong danh mục (so sánh normalized) thay vì ép toUpperCase mù quáng
    const canonical = opts.find(o => normalizeKey(o) === normalizeKey(v));
    if (!canonical) {
      toast('⚠️ "' + v + '" không có trong danh mục!', 'error');
      this.value = '';
      calcUngSummary();
    } else {
      this.value = canonical; // điền đúng tên chuẩn từ danh mục
    }
  });

  tr.querySelectorAll('input,select').forEach(el => {
    if(el.dataset.f!=='tien' && el.dataset.f!=='tp') { el.addEventListener('input', calcUngSummary); el.addEventListener('change', calcUngSummary); }
  });
  tbody.appendChild(tr);
}

function delUngRow(btn) { btn.closest('tr').remove(); renumberUng(); calcUngSummary(); }

function renumberUng() {
  document.querySelectorAll('#ung-tbody tr').forEach((tr,i) => { tr.querySelector('.row-num').textContent = i+1; });
}

function calcUngSummary() {
  let cnt=0, total=0;
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp  = tr.querySelector('[data-f="tp"]')?.value||'';
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(tp||tien>0) { cnt++; total+=tien; }
  });
  document.getElementById('ung-row-count').textContent=cnt;
  document.getElementById('ung-entry-total').textContent=fmtM(total);
}

function clearUngTable() {
  if(!confirm('Xóa toàn bộ bảng nhập tiền ứng?')) return;
  initUngTable(4);
}

function saveAllUngRows() {
  const date = document.getElementById('ung-date').value;
  if(!date) { toast('Vui lòng chọn ngày!','error'); return; }
  let saved=0, errRow=0;
  const rowsData=[];
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp = (tr.querySelector('[data-f="tp"]')?.value||'').trim();
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0;
    if(!tp&&!tien) return;
    if(!tp) { errRow++; tr.style.background='#fdecea'; return; }
    const ctSel = tr.querySelector('[data-f="ct"]');
    const ct    = (ctSel?.value||'').trim();
    const ctPid = _readPidFromSel(ctSel);
    // Kiểm tra công trình đã quyết toán
    if (ctPid && ctPid !== 'COMPANY') {
      const proj = getProjectById(ctPid);
      if (proj && proj.status === 'closed') { errRow++; tr.style.background='#fdecea'; return; }
    }
    tr.style.background='';
    rowsData.push({
      ngay: date,
      loai: (tr.querySelector('[data-f="loai"]')?.value||'thauphu'),
      tp, congtrinh: ct,
      projectId: ctPid || null,
      tien,
      nd: (tr.querySelector('[data-f="nd"]')?.value||'').trim()
    });
  });
  if(errRow>0) { toast(`${errRow} dòng có lỗi (thiếu TP/NCC hoặc CT đã quyết toán)!`,'error'); return; }
  if(rowsData.length===0) { toast('Không có dòng hợp lệ!','error'); return; }

  if (_editingUngId != null) {
    const idx = ungRecords.findIndex(r => String(r.id) === String(_editingUngId));
    if (idx < 0) { toast('Không tìm thấy bản ghi đang sửa!','error'); return; }
    const rec = rowsData[0]; // khi sửa chỉ xử lý 1 dòng
    ungRecords[idx] = {
      ...ungRecords[idx],
      ...rec,
      updatedAt: Date.now(),
      deviceId: DEVICE_ID
    };
    saved = 1;
  } else {
    rowsData.forEach(rec => {
      ungRecords.unshift(mkRecord(rec));
      saved++;
    });
  }

  save('ung_v1', ungRecords);
  toast(`✅ Đã ${_editingUngId ? 'cập nhật' : 'lưu'} ${saved} tiền ứng!`,'success');
  _editingUngId = null;
  resetUngForm();
  buildUngFilters();
  filterAndRenderUng();
}

function editUngRecord(id) {
  const rec = ungRecords.find(r => String(r.id) === String(id) && !r.deletedAt);
  if (!rec) return;

  _editingUngId = id;

  // Set ngày
  document.getElementById('ung-date').value = rec.ngay || '';

  // Clear bảng nhập
  clearUngRows();

  // Add 1 dòng với data
  addUngRow({
    loai: rec.loai,
    tp: rec.tp,
    congtrinh: rec.projectId ? resolveProjectName(rec) : rec.congtrinh,
    projectId: rec.projectId,
    tien: rec.tien,
    nd: rec.nd
  });

  // Scroll lên form
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Đổi nút
  const btn = document.getElementById('ung-save-btn');
  if (btn) btn.textContent = '💾 Cập Nhật';

  // Highlight dòng đang edit (optional bonus)
  document.querySelectorAll('.editing-row').forEach(tr => tr.classList.remove('editing-row'));
  const row = document.querySelector(`[data-ung-id="${id}"]`);
  if (row) row.classList.add('editing-row'), row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ══════════════════════════════
//  TIỀN ỨNG - ALL PAGE
// ══════════════════════════════
function buildUngFilters() {
  const active = ungRecords.filter(r => !r.deletedAt);
  const tps    = [...new Set(active.map(i=>i.tp))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi'));
  const cts    = [...new Set(active.map(i=>resolveProjectName(i)))].filter(Boolean); // Sort will be handle by project order if needed, but for filters alphabetic is usually fine.
  // Actually, projects in filters should also follow the project sort rule if we want "single source of truth".
  const sortedCts = getAllProjects().map(p => p.name).filter(name => cts.includes(name));
  const months = [...new Set(active.map(i=>i.ngay.slice(0,7)))].filter(Boolean).sort().reverse();

  const tpSel=document.getElementById('uf-tp'); const tv=tpSel.value;
  tpSel.innerHTML='<option value="">Tất cả TP/NCC</option>'+tps.map(v=>`<option ${v===tv?'selected':''} value="${x(v)}">${x(v)}</option>`).join('');
  const ctSel=document.getElementById('uf-ct'); const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả công trình</option>'+sortedCts.map(v=>`<option ${v===cv?'selected':''} value="${x(v)}">${x(v)}</option>`).join('');
  const mSel=document.getElementById('uf-month'); const mv=mSel.value;
  mSel.innerHTML='<option value="">Tất cả tháng</option>'+months.map(m=>`<option ${m===mv?'selected':''} value="${m}">${m}</option>`).join('');
}

function filterAndRenderUng() {
  ungPage=1; ungTpPage=1;
  const q=document.getElementById('ung-search').value.toLowerCase();
  const fTp=document.getElementById('uf-tp').value;
  const fCt=document.getElementById('uf-ct').value;
  const fMonth=document.getElementById('uf-month').value;
  filteredUng = ungRecords.filter(r => {
    if(r.deletedAt) return false;
    if(r.loai === 'congnhan') return false;
    if(!inActiveYear(r.ngay)) return false;
    if(fTp && r.tp!==fTp) return false;
    if(fCt && resolveProjectName(r)!==fCt) return false;
    if(fMonth && !r.ngay.startsWith(fMonth)) return false;
    if(q) { const t=[r.ngay,r.tp,resolveProjectName(r),r.nd].join(' ').toLowerCase(); if(!t.includes(q)) return false; }
    return true;
  });

  // [FIXED] Sort by date DESC — newest on top
  filteredUng.sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));

  renderUngTable();
}

function _ungSectionHTML(pagedRecs, allRecs, title, accentColor, curPage, pgSize, gotoFn, nameColLabel) {
  if (!allRecs.length) return '';
  const mono = "font-family:'IBM Plex Mono',monospace";
  const sumSec = sumBy(allRecs, 'tien');
  const tp = Math.ceil(allRecs.length / pgSize);
  let pagHtml = '';
  if (tp > 1) {
    const btns = [];
    for (let p = 1; p <= Math.min(tp, 10); p++) {
      btns.push(`<button class="page-btn ${p===curPage?'active':''}" onclick="${gotoFn}(${p})">${p}</button>`);
    }
    pagHtml = `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--line);background:#f3f1ec;font-size:12px;color:var(--ink2)">
      <span>${allRecs.length} dòng · <span style="${mono};font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span></span>
      <div class="page-btns">${btns.join('')}</div>
    </div>`;
  }
  return `<div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--bg);border-radius:6px;margin-bottom:8px;border-left:3px solid ${accentColor}">
      <span style="font-weight:700;font-size:12px;color:var(--ink2)">${title}</span>
      <span style="${mono};font-size:12px;font-weight:700;color:${accentColor}">${fmtS(sumSec)}</span>
    </div>
    <div style="overflow-x:auto">
      <table class="records-table">
        <thead><tr>
          <th style="width:32px;text-align:center">
            <input type="checkbox" class="ung-section-chk-all" title="Chọn tất cả"
              onchange="this.closest('table').querySelectorAll('.ung-row-chk').forEach(c=>c.checked=this.checked)">
          </th>
          <th>Ngày</th><th>${nameColLabel}</th><th>Công Trình</th><th>Nội Dung</th>
          <th style="text-align:right">Số Tiền Ứng</th><th></th>
        </tr></thead>
        <tbody>${pagedRecs.map(r=>`<tr data-ung-id="${r.id}" class="${_editingUngId===r.id?'editing-row':''}">
          <td style="text-align:center;padding:4px">
            <input type="checkbox" class="ung-row-chk" data-id="${r.id}" style="width:15px;height:15px;cursor:pointer">
          </td>
          <td style="${mono};font-size:11px;color:var(--ink2)">${r.ngay ? (r.ngay.split('-').length === 3 ? r.ngay.split('-').reverse().join('-') : r.ngay) : '—'}</td>
          <td style="font-weight:600;font-size:12px">${x(r.tp)}</td>
          <td style="color:var(--ink2)">${x(resolveProjectName(r)||'—')}</td>
          <td style="color:var(--ink2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x(r.nd)}">${x(r.nd||'—')}</td>
          <td class="amount-td" style="color:var(--blue)">${numFmt(r.tien||0)}</td>
          <td style="white-space:nowrap;display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn-outline btn-sm" onclick="editUngRecord('${r.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="delUngRecord('${r.id}')">✕</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    ${pagHtml}
  </div>`;
}

function renderUngTable() {
  const container = document.getElementById('ung-all-sections');
  const allTp = filteredUng.filter(r => r.loai === 'thauphu');
  const allNcc = filteredUng.filter(r => r.loai === 'nhacungcap');
  const sumTien = sumBy(filteredUng, 'tien');

  if (!allTp.length && !allNcc.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink3);font-size:14px">Không có dữ liệu tiền ứng nào</div>`;
    document.getElementById('ung-pagination').innerHTML = ''; return;
  }

  const tpPaged = allTp.slice((ungTpPage-1)*UNG_TP_PG, ungTpPage*UNG_TP_PG);
  const nccPaged = allNcc.slice((ungTpPage-1)*UNG_TP_PG, ungTpPage*UNG_TP_PG);

  container.innerHTML =
    _ungSectionHTML(tpPaged, allTp, 'Thầu Phụ', 'var(--gold)', ungTpPage, UNG_TP_PG, 'goUngTpTo', 'Thầu phụ') +
    _ungSectionHTML(nccPaged, allNcc, 'Nhà Cung Cấp', 'var(--green)', ungTpPage, UNG_TP_PG, 'goUngTpTo', 'Nhà cung cấp');

  const mono = "font-family:'IBM Plex Mono',monospace";
  document.getElementById('ung-pagination').innerHTML =
    `<span>${filteredUng.length} bản ghi · Tổng tiền ứng: <strong style="color:var(--blue);${mono}">${fmtS(sumTien)}</strong></span>`;
}

function goUngTo(p) { ungPage=p; renderUngTable(); }
function goUngTpTo(p) { ungTpPage=p; renderUngTable(); }

function delUngRecord(id) {
  const idx = ungRecords.findIndex(r=>String(r.id)===String(id));
  if(idx<0) return;
  if(!confirm('Xóa bản ghi tiền ứng này?')) return;
  const now = Date.now();
  ungRecords[idx] = { ...ungRecords[idx], deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
  save('ung_v1',ungRecords); buildUngFilters(); filterAndRenderUng(); _refreshAllTabs();
  toast('Đã xóa bản ghi tiền ứng');
}

function rebuildUngSelects() {
  document.querySelectorAll('#ung-tbody [data-f="ct"]').forEach(sel=>{
    if(sel.tagName==='SELECT'){
      const cur=sel.value;
      sel.innerHTML = _buildProjOpts(cur, '-- Chọn --');
    }
  });
  // tp dùng custom AC — không cần cập nhật datalist
}

function exportUngEntryCSV() {
  const rows=[['Thầu Phụ / Nhà CC','Công Trình','Số Tiền Ứng','Nội Dung']];
  document.querySelectorAll('#ung-tbody tr').forEach(tr=>{
    const tp=tr.querySelector('[data-f="tp"]')?.value||'';
    if(!tp) return;
    rows.push([tp,tr.querySelector('[data-f="ct"]')?.value||'',parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw||'0',10)||0,tr.querySelector('[data-f="nd"]')?.value||'']);
  });
  dlCSV(rows,'nhap_tien_ung_'+today()+'.csv');
}

function exportUngAllCSV() {
  const src=filteredUng.length>0?filteredUng:ungRecords;
  const rows=[['Ngày','Thầu Phụ / Nhà CC','Công Trình','Nội Dung','Số Tiền Ứng']];
  src.forEach(r=>rows.push([r.ngay,r.tp,r.congtrinh||'',r.nd||'',r.tien]));
  dlCSV(rows,'tien_ung_'+today()+'.csv');
}

// ══════════════════════════════════════════════════════════════
// WRAPPERS (gọi từ HTML onclick)
// ══════════════════════════════════════════════════════════════
function toolBackupNow() {
  _snapshotNow('manual');
  renderBackupList();
  toast('✅ Đã tạo bản sao lưu thủ công', 'success');
}
function toolRestoreBackup() {
  renderBackupList();
  const wrap = document.getElementById('backup-list-wrap');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// ══════════════════════════════════════════════════════════════
