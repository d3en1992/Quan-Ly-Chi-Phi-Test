// chamcong.js — Cham Cong / Phieu Luong
// Load order: 4


// ══════════════════════════════════════════════════════════════════
//  SỔ CHẤM CÔNG v3
//  worker: { name, luong, d:[CN,T2,T3,T4,T5,T6,T7], phucap, hdmuale, nd }
// ══════════════════════════════════════════════════════════════════
// Dedup cc_v2 theo logical key (fromDate + projectId): giữ bản updatedAt mới nhất.
// Hard rule: 1 tuần + 1 công trình = 1 record duy nhất.
// Bản standalone — chạy ở parse-time (trước sync.js). Sau khi sync.js load,
// normalizeCC() là canonical; _dedupCC gọi qua nó.
// Fix 1: gọi _fillCCProjectId nếu có (sync.js đã load)
// Fix 2: inline safeTs — _safeTs từ sync.js có thể chưa load ở parse-time
function _dedupCC(arr) {
  // Nếu sync.js đã load → dùng normalizeCC (canonical, có đủ fix 1+2)
  if (typeof normalizeCC === 'function') return normalizeCC(arr);

  // Standalone fallback cho parse-time (sync.js chưa load)
  // Áp dụng fix 1 nếu _fillCCProjectId có sẵn, fix 2 inline
  const _TS_MIN = 1577836800000; // 2020-01-01
  const safeTs  = ts => {
    const n = typeof ts === 'number' ? ts : 0;
    if (n < _TS_MIN) return 0;
    if (n > Date.now() + 86400000) return Date.now();
    return n;
  };
  const records = (typeof _fillCCProjectId === 'function') ? _fillCCProjectId(arr || []) : (arr || []);
  const byKey   = new Map();
  records.forEach(r => {
    const key  = (r.fromDate || r.from || '') + '__' + (r.projectId || r.ct || '');
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, r); return; }
    const prevTs = safeTs(prev.updatedAt || prev.createdAt || 0);
    const rTs    = safeTs(r.updatedAt   || r.createdAt   || 0);
    if (rTs > prevTs) {
      byKey.set(key, r);
    } else if (rTs === prevTs && r.deletedAt && !prev.deletedAt) {
      byKey.set(key, r);
    }
  });
  return [...byKey.values()];
}

let ccData = _dedupCC(load('cc_v2', [])).filter(x=>{
  if(!x||!x.fromDate||typeof x.fromDate!=='string'){ console.warn('Invalid CC record (no fromDate):', x); return false; }
  return true;
});
let ccOffset = 0;
let ccHistPage = 1, ccTltPage = 1;
const CC_PG_HIST = 30;
const CC_PG_TLT = 20;
const CC_DAY_LABELS   = ['CN','T2','T3','T4','T5','T6','T7'];
const CC_DATE_OFFSETS = [0,1,2,3,4,5,6]; // offset from Sunday (week starts Sunday)

function round1(n){ return Math.round(n * 10) / 10; }

// ── Collapsible debt columns (Nợ Cũ / Vay Mới / Trừ Nợ) ─────────
// Mặc định: ẩn. Bấm toggle để mở/đóng.
let _ccDebtColsHidden = true;

function toggleCCDebtCols() {
  _ccDebtColsHidden = !_ccDebtColsHidden;
  _applyCCDebtColsVisibility();
}

function _applyCCDebtColsVisibility() {
  const table = document.getElementById('cc-thead-row')?.closest('table');
  if (!table) return;
  table.classList.toggle('debt-cols-hidden', _ccDebtColsHidden);
  // Cập nhật icon trên toggle header
  document.querySelectorAll('.cc-debt-toggle-th').forEach(th => {
    th.textContent = _ccDebtColsHidden ? '▶' : '◀';
    th.title = _ccDebtColsHidden ? 'Mở rộng: HĐ Mua Lẻ / Nội Dung / Nợ Cũ / Vay Mới / Trừ Nợ' : 'Thu gọn';
  });
}

// Tính tổng nợ lũy kế của công nhân trước tuần fromDate
// debt = sum(loanAmount - tru) cho mọi tuần đã lưu có fromDate < ngày truyền vào
function _calcDebtBefore(workerName, fromDate) {
  if (!workerName || !fromDate) return 0;
  let debt = 0;
  ccData.forEach(w => {
    if (w.deletedAt) return;
    if (w.fromDate >= fromDate) return;
    (w.workers || []).forEach(wk => {
      if (wk.name !== workerName) return;
      debt += (wk.loanAmount || 0) - (wk.tru || 0);
    });
  });
  return debt;
}

// ─── date helpers ───────────────────────────────────────────────
// Tuần: CN (Sun) → T7 (Sat). iso date string là YYYY-MM-DD.
// Tránh timezone bug: dùng local date parts, không dùng toISOString cho date-only

function isoFromParts(y,m,d){ return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d; }

// Trả về iso string của CN (Sunday) cho tuần cách tuần hiện tại offset tuần
function ccSundayISO(offset=0){
  const now = new Date();
  const y=now.getFullYear(), mo=now.getMonth(), d=now.getDate();
  const jsDay=now.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // Tìm Sunday của tuần hiện tại
  const sunD = new Date(y, mo, d - jsDay + offset*7);
  return isoFromParts(sunD.getFullYear(), sunD.getMonth()+1, sunD.getDate());
}

// Trả về iso string của T7 (Saturday) = CN + 6
function ccSaturdayISO(sundayISO){
  const [y,m,d]=sundayISO.split('-').map(Number);
  const sat=new Date(y,m-1,d+6);
  return isoFromParts(sat.getFullYear(),sat.getMonth()+1,sat.getDate());
}

// Snap bất kỳ ngày → CN của tuần chứa ngày đó
function snapToSunday(dateISO){
  const [y,m,d]=dateISO.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  const jsDay=dt.getDay(); // 0=Sun
  const sun=new Date(y,m-1,d-jsDay);
  return isoFromParts(sun.getFullYear(),sun.getMonth()+1,sun.getDate());
}

function viShort(ds){
  if(!ds||typeof ds!=='string') return '—';
  const parts=ds.split('-');
  if(parts.length!==3) return '—';
  const [y,m,d]=parts.map(Number);
  if(!y||!m||!d) return '—';
  return (d<10?'0':'')+d+'/'+(m<10?'0':'')+m;
}
function weekLabel(sundayISO){
  if(!sundayISO||typeof sundayISO!=='string') return '—';
  const satISO=ccSaturdayISO(sundayISO);
  const y=sundayISO.split('-')[0];
  return viShort(sundayISO)+'–'+viShort(satISO)+'/'+y;
}

// iso() vẫn giữ để dùng chỗ khác nếu cần
function iso(d){ return d.toISOString().split('T')[0]; }

// ─── all worker names for autocomplete (Chấm Công: chỉ dùng cats.congNhan) ────
function ccAllNames(){
  const s=new Set();
  ccData.filter(w=>!w.deletedAt).forEach(w=>w.workers.forEach(wk=>{ if(wk.name) s.add(wk.name); }));
  // Tab Chấm Công chỉ gợi ý tên từ danh mục Công Nhân
  (cats.congNhan||[]).forEach(n=>s.add(n));
  return [...s].sort((a,b)=>a.localeCompare(b,'vi'));
}

// build/update the shared datalist for name autocomplete
function rebuildCCNameList(){
  let dl=document.getElementById('cc-name-dl');
  if(!dl){ dl=document.createElement('datalist'); dl.id='cc-name-dl'; document.body.appendChild(dl); }
  dl.innerHTML=ccAllNames().map(n=>`<option value="${x(n)}">`).join('');
}

// ─── init ────────────────────────────────────────────────────────
function initCC(){
  ccOffset=0;
  ccGoToWeek(0);
  populateCCCtSel();
  rebuildCCNameList();
  // Event delegation cho checkbox TLT — gắn 1 lần, không bị mất khi re-render
  document.addEventListener('change', function(e){
    if(e.target.classList.contains('cc-tlt-chk')) updateTLTSelectedSum();
  });
}

function ccGoToWeek(off){
  ccOffset=off;
  const sunISO=ccSundayISO(off);
  const satISO=ccSaturdayISO(sunISO);
  document.getElementById('cc-from').value=sunISO;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(sunISO);
  loadCCWeekForm();
}
function ccPrevWeek(){ ccGoToWeek(ccOffset-1); }
function ccNextWeek(){ ccGoToWeek(ccOffset+1); }

function onCCFromChange(){
  const raw=document.getElementById('cc-from').value; if(!raw) return;
  // Snap bất kỳ ngày được chọn về CN của tuần đó
  const sunISO=snapToSunday(raw);
  const satISO=ccSaturdayISO(sunISO);
  document.getElementById('cc-from').value=sunISO;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(sunISO);
  // Tính lại offset so với tuần hiện tại
  const thisSun=ccSundayISO(0);
  const [ty,tm,td]=thisSun.split('-').map(Number);
  const [fy,fm,fd]=sunISO.split('-').map(Number);
  const diffMs=new Date(fy,fm-1,fd)-new Date(ty,tm-1,td);
  ccOffset=Math.round(diffMs/(7*86400000));
  loadCCWeekForm();
}

function loadCCWeekForm(){
  const f=document.getElementById('cc-from').value;
  const ccCtSel=document.getElementById('cc-ct-sel');
  const ct=(ccCtSel.value||'').trim();
  const ctPid=_readPidFromSel(ccCtSel);
  // Try to find saved data for this week+ct — projectId/ctPid ưu tiên, fallback ct string
  const _matchCT = w => ctPid
    ? (w.projectId === ctPid || w.ctPid === ctPid)
    : w.ct === ct;
  const rec=ccData.find(w=>!w.deletedAt&&w.fromDate===f&&_matchCT(w));
  if(rec){
    buildCCTable(rec.workers);
  } else if(ct){
    // Auto-copy workers from most recent week of same CT (names+luong only, clear days/extra)
    const prev=ccData.filter(w=>!w.deletedAt&&_matchCT(w)&&w.fromDate<f).sort((a,b)=>b.fromDate.localeCompare(a.fromDate))[0];
    if(prev){
      const stub=prev.workers.map(wk=>({name:wk.name,luong:wk.luong,d:[0,0,0,0,0,0,0],phucap:0,hdmuale:0,loanAmount:0,nd:'',role:wk.role||'',tru:0}));
      buildCCTable(stub);
    } else {
      buildCCTable([]);
    }
  } else {
    buildCCTable([]);
  }
  updateCCSaveBtn();
}

// ─── build table ─────────────────────────────────────────────────
function buildCCTable(workers){
  const fromStr=document.getElementById('cc-from').value;
  const thead=document.getElementById('cc-thead-row');
  const dates=CC_DATE_OFFSETS.map(off=>{
    if(!fromStr) return '';
    const d=new Date(fromStr+'T00:00:00'); d.setDate(d.getDate()+off);
    return d.getDate()+'/'+(d.getMonth()+1);
  });
  const BG='background:#eeece7;color:var(--ink)';
  const BG_DEBT='background:#fff8e0;color:var(--ink)';
  thead.innerHTML=`
    <th class="col-num">#</th>
    <th class="cc-sticky-name col-name">Tên Công Nhân</th>
    <th class="col-tp" style="text-align:center">T/P</th>
    ${CC_DAY_LABELS.map((l,i)=>`<th class="cc-day-header col-day">${l}<br><span style="font-size:9px;font-weight:400;color:var(--ink2)">${dates[i]}</span></th>`).join('')}
    <th class="col-tc" style="text-align:center;${BG}">TC</th>
    <th class="col-luong" style="text-align:right;${BG}">Lương/Ngày</th>
    <th class="col-total-luong" style="text-align:right;${BG}">Tổng Lương</th>
    <th class="col-phucap" style="text-align:right;${BG}">
      <span style="display:inline-flex;align-items:center;gap:4px;justify-content:flex-end">
        Phụ Cấp
        <span class="cc-debt-toggle-th" onclick="toggleCCDebtCols()" title="Mở rộng: HĐ Mua Lẻ / Nội Dung / Nợ Cũ / Vay Mới / Trừ Nợ" style="cursor:pointer;font-size:10px;user-select:none;color:var(--ink2);padding:0 2px">▶</span>
      </span>
    </th>
    <th class="cc-debt-col col-hdml" style="text-align:right;${BG}">HĐ Mua Lẻ</th>
    <th class="cc-debt-col col-nd" style="${BG}">Nội Dung</th>
    <th class="cc-debt-col col-debtbefore" style="text-align:right;${BG_DEBT}" title="Nợ tồn đọng trước tuần này">Nợ Cũ</th>
    <th class="cc-debt-col col-loan" style="text-align:right;${BG_DEBT}">Vay Mới (+)</th>
    <th class="cc-debt-col col-tru" style="text-align:right;${BG_DEBT};color:var(--red)">Trừ Nợ (-)</th>
    <th class="col-total" style="text-align:right;background:#c8870a;color:#fff;font-weight:700">Thực Lãnh</th>
    <th class="col-del" style="${BG}"></th>
  `;
  const tbody=document.getElementById('cc-tbody');
  tbody.innerHTML='';
  const minRows=Math.max((workers||[]).length,8);
  for(let i=0;i<minRows;i++) addCCRow((workers||[])[i]||null);
  updateCCSumRow();
  _applyCCDebtColsVisibility(); // Áp dụng trạng thái ẩn/hiện cột nợ hiện tại
}

function addCCWorker(){
  const tbody=document.getElementById('cc-tbody');
  const sumRow=tbody.querySelector('.cc-sum-row');
  const nr=buildCCRow(null, tbody.querySelectorAll('tr:not(.cc-sum-row)').length+1);
  tbody.insertBefore(nr,sumRow||null);
  renumberCC(); updateCCSumRow();
  nr.querySelector('.cc-name-input')?.focus();
}

function addCCRow(w){
  const tbody=document.getElementById('cc-tbody');
  const num=tbody.querySelectorAll('tr:not(.cc-sum-row)').length+1;
  tbody.appendChild(buildCCRow(w,num));
}

function buildCCRow(w,num){
  const tr=document.createElement('tr');
  const ds=w?w.d:[0,0,0,0,0,0,0];
  const luong=w?(w.luong||0):0;
  const phucap=w?(w.phucap||0):0;
  const hdml=w?(w.hdmuale||0):0;
  const loanAmount=w?(w.loanAmount||0):0;
  const tru=w?(w.tru||0):0;
  const role=w?.role||(w?.name?cnRoles[w.name]||'':'');
  const isKnown=w?.name?cats.congNhan.some(n=>n.toLowerCase()===(w.name||'').toLowerCase()):false;

  tr.innerHTML=`
    <td class="row-num col-num">${num}</td>
    <td class="cc-sticky-name col-name" style="padding:0">
      <input class="cc-name-input" data-cc="name"
        value="${x(w?w.name||'':''||'')}" placeholder="Tên..." autocomplete="off">
    </td>
    <td class="col-tp" style="padding:4px 2px;text-align:center">
      <input type="hidden" data-cc="tp" value="${role}">
      <span class="cc-tp-display" style="display:inline-block;min-width:22px;font-size:12px;font-weight:700;color:${role?'var(--ink)':'var(--ink3)'}">${role||'—'}</span>
    </td>
    ${ds.map((v,i)=>`<td class="col-day" style="padding:0"><input class="cc-day-input ${v===1?'has-val':v>0&&v<1?'half-val':''}"
      data-cc="d${i}" value="${v||''}" placeholder="·" autocomplete="off" inputmode="decimal"></td>`).join('')}
    <td class="cc-tc-cell col-tc" data-cc="tc">0</td>
    <td class="col-luong" style="padding:0"><input class="cc-wage-input" data-cc="luong" data-raw="${luong||''}" inputmode="decimal"
      value="${luong?numFmt(luong):''}" placeholder="0"></td>
    <td class="cc-total-cell col-total-luong" data-cc="total">—</td>
    <td class="col-phucap" style="padding:0"><input class="cc-wage-input" data-cc="phucap" data-raw="${phucap||''}" inputmode="decimal"
      value="${phucap?numFmt(phucap):''}" placeholder="0"></td>
    <td class="cc-debt-col col-hdml" style="padding:0"><input class="cc-wage-input" data-cc="hdml" data-raw="${hdml||''}" inputmode="decimal"
      value="${hdml?numFmt(hdml):''}" placeholder="0"></td>
    <td class="cc-debt-col col-nd" style="padding:0"><input class="cc-name-input" data-cc="nd"
      value="${x(w?w.nd||'':''||'')}" placeholder="Nội dung..."
      style="font-size:11px"></td>
    <td class="cc-debt-col col-debtbefore" data-cc="debtbefore" style="text-align:right;font-size:11px;padding:4px 6px;white-space:nowrap">—</td>
    <td class="cc-debt-col col-loan" style="padding:0"><input class="cc-wage-input" data-cc="loan" data-raw="${loanAmount||''}" inputmode="decimal"
      value="${loanAmount?numFmt(loanAmount):''}" placeholder="0" style="color:var(--gold)"></td>
    <td class="cc-debt-col col-tru" style="padding:0"><input class="cc-wage-input" data-cc="tru" data-raw="${tru||''}" inputmode="decimal"
      value="${tru?numFmt(tru):''}" placeholder="0" style="color:var(--red)"></td>
    <td class="cc-total-cell col-total" data-cc="tongcong" style="color:var(--gold);font-size:13px">—</td>
    <td class="col-del"><button class="del-btn" onclick="delCCRow(this)">✕</button></td>
  `;
  tr.querySelectorAll('[data-cc^="d"]').forEach(el=>el.addEventListener('input',()=>{ onCCDayKey(el); updateCCSumRow(); }));
  tr.querySelector('[data-cc="luong"]').addEventListener('input',function(){ onCCWageKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="phucap"]').addEventListener('input',function(){ onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="loan"]').addEventListener('input',function(){ onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="hdml"]').addEventListener('input',function(){ onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="tru"]').addEventListener('input',function(){ onCCMoneyKey(this); updateCCSumRow(); });
  tr.querySelector('[data-cc="name"]').addEventListener('input',function(){
    _acShow(this, cats.congNhan, v => {
      this.value = v;
      onCCNameInput(this);
      updateCCSumRow();
    });
    onCCNameInput(this); updateCCSumRow();
  });
  tr.querySelector('[data-cc="name"]').addEventListener('focus',function(){
    if (cats.congNhan.length) _acShow(this, cats.congNhan, v => { this.value = v; onCCNameInput(this); updateCCSumRow(); });
  });
  tr.querySelector('[data-cc="name"]').addEventListener('blur',function(){
    // Validate: chỉ cho phép tên có trong danh mục
    const v = this.value.trim();
    if (!v) return;
    // Tìm tên chuẩn trong danh mục bằng normalizeKey (bỏ dấu + lowercase)
    // → "nguyen van a" khớp "NGUYỄN VĂN A" → điền đúng tên chuẩn, không ép UPPERCASE mù quáng
    const canonical = cats.congNhan.find(n => normalizeKey(n) === normalizeKey(v));
    if (!canonical) {
      this.style.boxShadow = 'inset 0 0 0 2px var(--red)';
      toast('⚠️ "' + v + '" không có trong danh mục công nhân!', 'error');
      this.value = '';
      this.style.boxShadow = '';
      updateCCSumRow();
    } else {
      this.style.boxShadow = '';
      this.value = canonical; // điền đúng tên chuẩn từ danh mục
    }
  });
  tr.querySelector('[data-cc="nd"]').addEventListener('input',updateCCSumRow);
  calcCCRow(tr);
  return tr;
}

function onCCNameInput(inp){
  const name=inp.value.trim();
  if(!name){ inp.style.boxShadow=''; inp.title=''; return; }
  // Chống trùng tên không phân biệt hoa thường
  const nameLower=name.toLowerCase();
  let count=0;
  document.querySelectorAll('#cc-tbody [data-cc="name"]').forEach(el=>{ if(el.value.trim().toLowerCase()===nameLower) count++; });
  if(count>1){
    inp.style.boxShadow='inset 0 0 0 2px var(--red)';
    inp.title='⚠️ Tên trùng! Vui lòng đổi tên để phân biệt.';
    toast('⚠️ Tên "'+name+'" bị trùng – hãy đổi tên để tránh nhầm lẫn!','error');
  } else {
    inp.style.boxShadow='';
    inp.title='';
  }
  // Auto-fill T/P nếu thợ đã có trong danh mục
  const tr=inp.closest('tr');
  if(!tr) return;
  const tpInput=tr.querySelector('[data-cc="tp"]');
  const tpDisplay=tr.querySelector('.cc-tp-display');
  if(!tpInput) return;
  const known=cats.congNhan.find(n=>n.toLowerCase()===nameLower);
  const role=known?(cnRoles[known]||''):'';
  tpInput.value=role;
  if(tpDisplay){
    tpDisplay.textContent=role||'—';
    tpDisplay.style.color=role?'var(--ink)':'var(--ink3)';
  }
}

function onCCDayKey(inp){
  const n=parseFloat(inp.value.replace(',','.'))||0;
  inp.classList.toggle('has-val',n===1);
  inp.classList.toggle('half-val',n>0&&n<1);
  calcCCRow(inp.closest('tr'));
}
function onCCWageKey(inp){
  const raw=inp.value.replace(/\./g,'').replace(/,/g,'');
  inp.dataset.raw=raw;
  if(raw) inp.value=numFmt(parseInt(raw)||0);
  calcCCRow(inp.closest('tr'));
}
function onCCMoneyKey(inp){
  const raw=inp.value.replace(/\./g,'').replace(/,/g,'');
  inp.dataset.raw=raw;
  if(raw) inp.value=numFmt(parseInt(raw)||0);
  calcCCRow(inp.closest('tr'));
}

function calcCCRow(tr){
  let tc=0;
  for(let i=0;i<7;i++) tc+=parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0;
  tc=round1(tc);
  tr.querySelector('[data-cc="tc"]').textContent=tc||0;
  const luong=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
  const total=tc*luong;
  const phucap=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
  const hdml  =parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
  const loan  =parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw||0)||0;
  const tru   =parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw||0)||0;

  const totCell=tr.querySelector('[data-cc="total"]');
  totCell.textContent=total>0?numFmt(total):'—';
  totCell.style.color=total>0?'var(--green)':'var(--ink3)';

  // Nợ cũ: tính lũy kế từ ccData đã lưu (các tuần trước fromDate hiện tại)
  const workerName=(tr.querySelector('[data-cc="name"]')?.value||'').trim();
  const fromDate=document.getElementById('cc-from')?.value||'';
  const debtBefore=_calcDebtBefore(workerName, fromDate);
  const debtCell=tr.querySelector('[data-cc="debtbefore"]');
  if(debtCell){
    if(debtBefore===0){ debtCell.textContent='—'; debtCell.style.color='var(--ink3)'; }
    else if(debtBefore>0){ debtCell.textContent=numFmt(debtBefore)+' nợ'; debtCell.style.color='var(--red)'; }
    else{ debtCell.textContent=numFmt(-debtBefore)+' dư'; debtCell.style.color='var(--green)'; }
  }

  // Thực Lãnh = (Tổng Lương + Phụ Cấp) + Vay Mới + HĐ Mua Lẻ - Trừ Nợ
  const thucLanh=total+phucap+loan+hdml-tru;
  const tcCell=tr.querySelector('[data-cc="tongcong"]');
  if(thucLanh>0){ tcCell.textContent=numFmt(thucLanh); tcCell.style.color='var(--gold)'; }
  else if(thucLanh<0){ tcCell.textContent='('+numFmt(-thucLanh)+')'; tcCell.style.color='var(--red)'; }
  else{ tcCell.textContent='—'; tcCell.style.color='var(--ink3)'; }
}

function delCCRow(btn){ btn.closest('tr').remove(); renumberCC(); updateCCSumRow(); }
function renumberCC(){
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach((tr,i)=>tr.querySelector('.row-num').textContent=i+1);
}

function updateCCSumRow(){
  const rows=document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)');
  const dayT=new Array(7).fill(0);
  let tc=0,totalLuong=0,totalPC=0,totalHD=0,totalLoan=0,totalTru=0,totalTC=0;
  rows.forEach(tr=>{
    for(let i=0;i<7;i++) dayT[i]+=parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0;
    const t=parseFloat(tr.querySelector('[data-cc="tc"]')?.textContent||0)||0;
    tc+=t;
    const l=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const pc=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const hd=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    const ln=parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw||0)||0;
    const tru=parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw||0)||0;
    totalLuong+=t*l; totalPC+=pc; totalHD+=hd; totalLoan+=ln; totalTru+=tru;
    totalTC+=t*l+pc+ln+hd-tru; // Thực Lãnh
  });
  let sumRow=document.querySelector('#cc-tbody .cc-sum-row');
  if(!sumRow){ sumRow=document.createElement('tr'); sumRow.className='cc-sum-row'; document.getElementById('cc-tbody').appendChild(sumRow); }
  const mono="font-family:'IBM Plex Mono',monospace;font-weight:700";
  sumRow.innerHTML=`
    <td class="row-num col-num" style="font-size:10px;font-weight:700;color:var(--ink2)">∑</td>
    <td class="cc-sticky-name col-name" style="padding:7px 10px;font-size:10px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px">TỔNG</td>
    <td class="col-tp"></td>
    ${dayT.map(v=>`<td class="col-day" style="text-align:center;${mono};font-size:12px;color:var(--ink2);padding:6px 4px">${round1(v)||''}</td>`).join('')}
    <td class="col-tc" style="text-align:center;${mono};font-size:14px;color:var(--gold);padding:6px 8px">${round1(tc)}</td>
    <td class="col-luong"></td>
    <td class="col-total-luong" style="text-align:right;${mono};font-size:13px;color:var(--green);padding:6px 8px;white-space:nowrap">${totalLuong>0?numFmt(totalLuong):'—'}</td>
    <td class="col-phucap" style="text-align:right;${mono};font-size:12px;color:var(--blue);padding:6px 8px;white-space:nowrap">${totalPC>0?numFmt(totalPC):'—'}</td>
    <td class="cc-debt-col col-hdml" style="text-align:right;${mono};font-size:12px;color:var(--ink2);padding:6px 8px;white-space:nowrap">${totalHD>0?numFmt(totalHD):'—'}</td>
    <td class="cc-debt-col col-nd"></td>
    <td class="cc-debt-col col-debtbefore"></td>
    <td class="cc-debt-col col-loan" style="text-align:right;${mono};font-size:12px;color:var(--gold);padding:6px 8px;white-space:nowrap">${totalLoan>0?numFmt(totalLoan):'—'}</td>
    <td class="cc-debt-col col-tru" style="text-align:right;${mono};font-size:12px;color:var(--red);padding:6px 8px;white-space:nowrap">${totalTru>0?numFmt(totalTru):'—'}</td>
    <td class="col-total" style="text-align:right;${mono};font-size:14px;color:var(--gold);padding:6px 8px;white-space:nowrap;background:#fff8e8">${totalTC>0?numFmt(totalTC):totalTC<0?'('+numFmt(-totalTC)+')':'—'}</td>
    <td class="col-del"></td>
  `;
  document.getElementById('cc-sum-tc').textContent=round1(tc);
  document.getElementById('cc-sum-luong').textContent=fmtM(totalLuong);
  document.getElementById('cc-sum-tongcong').textContent=fmtM(totalTC);
}

// ─── save ─────────────────────────────────────────────────────────

// ── Cập nhật danh mục từ toàn bộ ccData (không tạo HĐ nữa) ──────────
// Gọi sau khi import/sync để cập nhật danh mục CT, CN, TP
// [MODIFIED] — Normalize dữ liệu cũ: gán projectId + ctPid cho record chưa có
// ALSO: sync .ct name from project when project was renamed
// Idempotent — gọi nhiều lần không gây hại
function normalizeAllChamCong() {
  let changed = false;
  ccData.forEach(r => {
    if (r.deletedAt) return;
    // Step 1: resolve projectId from ct name if missing
    if (!r.projectId && r.ct) {
      const pid = (typeof findProjectIdByName === 'function') ? findProjectIdByName(r.ct) : null;
      if (pid) { r.projectId = pid; changed = true; }
    }
    // Keep ctPid in sync with projectId
    if (r.projectId && r.ctPid !== r.projectId) {
      r.ctPid = r.projectId; changed = true;
    }
    // Step 2: sync .ct from project name (handles renames)
    if (r.projectId) {
      const currentName = _getProjectNameById(r.projectId);
      if (currentName && currentName !== r.ct) {
        r.ct = currentName; changed = true;
      }
    }
  });
  if (changed) save('cc_v2', ccData);
}

function rebuildCCCategories() {
  // cats.congTrinh chỉ được ghi bởi rebuildCatCTFromProjects() — không tự thêm từ ccData
  const addedCTs = 0;

  // Không tự động thêm danh mục từ dữ liệu chấm công
  const cnAdded = 0;

  // Không tự động thêm danh mục từ dữ liệu tiền ứng
  const addedTPs = 0;

  return { cts: addedCTs, names: cnAdded, tps: addedTPs };
}

// Cập nhật topbar sau khi save CC — không dùng cache, không rebuild toàn hệ thống
function updateTopFromCC(){
  // CC portion: tính trực tiếp từ ccData theo năm đang chọn
  let ccTotal=0;
  ccData.forEach(w=>{
    if(w.deletedAt) return;
    if(!inActiveYear(w.fromDate)) return;
    (w.workers||[]).forEach(wk=>{
      const tc=(wk.d||[]).reduce((s,v)=>s+(Number(v)||0),0);
      ccTotal+=tc*(wk.luong||0)+(wk.phucap||0)+(wk.hdmuale||0);
    });
  });
  // Manual invoices portion: đọc thẳng từ mảng invoices (không qua cache)
  const manualTotal=(typeof invoices!=='undefined'?invoices:[])
    .filter(i=>!i.deletedAt&&inActiveYear(i.ngay))
    .reduce((s,i)=>s+(i.thanhtien||i.tien||0),0);
  const total=ccTotal+manualTotal;
  document.getElementById('top-total').textContent=fmtS(total);
  const m=document.getElementById('top-total-mobile');
  if(m) m.textContent=fmtS(total);
  const h=document.getElementById('top-total-header');
  if(h) h.textContent=fmtS(total);
}

function saveCCWeek(){
  // Chống double click — disable nút trong lúc save
  const btn=document.getElementById('cc-save-btn');
  if(btn&&btn.disabled) return;
  if(btn) btn.disabled=true;

  const fromDate=document.getElementById('cc-from').value;
  const toDate  =document.getElementById('cc-to').value;
  const ccCtSel =document.getElementById('cc-ct-sel');
  const ct      =(ccCtSel.value||'').trim();
  const ctPid   =_readPidFromSel(ccCtSel);

  const _enableBtn=()=>{ if(btn){ btn.disabled=false; updateCCSaveBtn(); } };

  if(!fromDate){ toast('Chọn ngày bắt đầu tuần!','error'); _enableBtn(); return; }
  if(!ct){ toast('Chọn công trình!','error'); _enableBtn(); return; }
  if(_checkProjectClosed(ctPid,ct)){ _enableBtn(); return; }

  // check duplicate names (không phân biệt hoa thường)
  const names=[];
  let dupFound=false;
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row) [data-cc="name"]').forEach(el=>{
    const n=el.value.trim();
    const nL=n.toLowerCase();
    if(n&&names.includes(nL)){ dupFound=true; el.style.boxShadow='inset 0 0 0 2px var(--red)'; }
    else if(n) names.push(nL);
  });
  if(dupFound){ toast('⚠️ Còn tên trùng nhau! Sửa trước khi lưu.','error'); _enableBtn(); return; }

  const workers=[];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr=>{
    const name=tr.querySelector('[data-cc="name"]')?.value?.trim()||'';
    const luong=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const phucap=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const hdmuale=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    const loanAmount=parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw||0)||0;
    const tru=parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw||0)||0;
    const nd=(tr.querySelector('[data-cc="nd"]')?.value?.trim()||'');
    const role=tr.querySelector('[data-cc="tp"]')?.value||'';
    const d=[];
    for(let i=0;i<7;i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0);
    if(name||d.some(v=>v>0)) workers.push({name,luong,d,phucap,hdmuale,loanAmount,nd,role,tru});
  });
  if(!workers.length){ toast('Chưa có công nhân nào!','error'); _enableBtn(); return; }

  // ── Dedup + save theo key duy nhất: fromDate|projectId ────────
  // [MODIFIED] matchKey: projectId ưu tiên tuyệt đối, fallback ct
  const matchKey=w=>{
    if(w.deletedAt) return false;
    if(w.fromDate!==fromDate) return false;
    if(ctPid) return (w.projectId===ctPid || w.ctPid===ctPid);
    return w.ct===ct;
  };
  // Xóa mọi duplicate — giữ record updatedAt mới nhất nếu bị trùng
  const dups=ccData.filter(w=>matchKey(w));
  if(dups.length>1){
    dups.sort((a,b)=>(b.updatedAt||b.id||0)-(a.updatedAt||a.id||0));
    ccData=ccData.filter(w=>!matchKey(w));
    ccData.unshift(dups[0]);
  }
  // Update hoặc tạo mới
  const idx=ccData.findIndex(w=>matchKey(w));
  if(idx>=0){
    ccData[idx].workers=workers;
    ccData[idx].toDate=toDate;
    ccData[idx].updatedAt=Date.now();
    // [MODIFIED] — always write projectId + sync ct name
    if(ctPid) { ccData[idx].projectId=ctPid; ccData[idx].ctPid=ctPid; }
    if(ct) ccData[idx].ct=ct;
  } else {
    // [MODIFIED] — new records always have projectId
    ccData.unshift({id:crypto.randomUUID(),updatedAt:Date.now(),fromDate,toDate,ct,ctPid,projectId:ctPid||null,workers});
  }
  save('cc_v2',ccData);
  clearInvoiceCache(); updateTop(); // xóa cache cũ → rebuild từ ccData mới nhất

  // Không tự động thêm công nhân mới vào danh mục từ dữ liệu chấm công

  rebuildCCNameList();
  populateCCCtSel();
  // Restore filter context: đúng tuần + đúng CT cho cả 2 bảng
  document.getElementById('cc-hist-week').value = fromDate;
  document.getElementById('cc-tlt-week').value  = fromDate;
  const _histCt=document.getElementById('cc-hist-ct');
  const _tltCt =document.getElementById('cc-tlt-ct');
  if(_histCt) _histCt.value=ct;
  if(_tltCt)  _tltCt.value=ct;
  renderCCHistory();  // cập nhật bảng lịch sử và TLT sau khi lưu
  // Scroll xuống bảng tổng lương để user thấy dữ liệu vừa lưu
  setTimeout(()=>{ document.getElementById('cc-tlt-pagination')?.scrollIntoView({behavior:'smooth',block:'nearest'}); },150);
  const totalLuong=workers.reduce((s,wk)=>{ const tc=round1(wk.d.reduce((a,v)=>a+v,0)); return s+tc*(wk.luong||0)+(wk.phucap||0); },0);
  const hdCount=workers.filter(w=>w.hdmuale>0).length;
  const msg=`✅ Đã lưu ${viShort(fromDate)}–${viShort(toDate)} [${ct}]`
    +(hdCount?` · ${hdCount} HĐ lẻ`:'')
    +(totalLuong>0?' · Nhân công cập nhật':'');
  toast(msg,'success');
  // Re-enable nút sau khi IDB write xong (~500ms)
  setTimeout(()=>{ if(btn){ btn.disabled=false; updateCCSaveBtn(); } },500);
}

function clearCCWeek(){
  if(!confirm('Xóa bảng nhập tuần này?')) return;
  buildCCTable([]);
}
let ccClipboard=null;
function copyCCWeek(){
  const workers=[];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr=>{
    const name=tr.querySelector('[data-cc="name"]')?.value?.trim()||'';
    const luong=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const d=[];
    for(let i=0;i<7;i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0);
    const roleCopy=tr.querySelector('[data-cc="tp"]')?.value||'';
    // Chỉ copy: tên, lương, ngày công — không copy phụ cấp/HĐ lẻ/vay/trừ/nội dung (dữ liệu phát sinh theo tuần)
    if(name||luong>0||d.some(v=>v>0)) workers.push({name,luong,d,phucap:0,hdmuale:0,loanAmount:0,nd:'',role:roleCopy,tru:0});
  });
  if(!workers.length){toast('Bảng trống, chưa có gì để copy!','error');return;}
  ccClipboard=workers;
  document.getElementById('cc-paste-btn').style.display='';
  const tc=workers.reduce((s,w)=>s+w.d.reduce((a,v)=>a+v,0),0);
  toast('📋 Đã copy '+workers.length+' công nhân ('+tc+' công) — nhấn Dán để áp dụng!','success');
}
function pasteCCWeek(){
  if(!ccClipboard||!ccClipboard.length){toast('Chưa copy tuần nào!','error');return;}
  // Dán: tên, lương, ngày công (phụ cấp/HĐ lẻ/trừ/nội dung đã reset từ lúc copy)
  buildCCTable(ccClipboard.map(w=>({...w})));
  toast('📌 Đã dán '+ccClipboard.length+' công nhân đầy đủ ngày công!','success');
}

// ─── CT selector ──────────────────────────────────────────────────
function populateCCCtSel(){
  const sel = document.getElementById('cc-ct-sel');
  const cur = sel.value;
  sel.innerHTML = _buildProjOpts(cur);
  updateCCSaveBtn();
}

/** Cập nhật text nút lưu tuần: "Lưu tuần này" nếu mới, "Cập nhật tuần này" nếu đã có. */
function updateCCSaveBtn() {
  const btn = document.getElementById('cc-save-btn');
  if (!btn) return;
  const fromDate  = document.getElementById('cc-from')?.value;
  const ccCtSel   = document.getElementById('cc-ct-sel');
  const ct        = (ccCtSel?.value||'').trim();
  const ctPid     = _readPidFromSel(ccCtSel);
  const isEdit    = !!(fromDate && ct && ccData.some(r => !r.deletedAt && r.fromDate === fromDate && (r.ctPid === ctPid || r.ct === ct)));
  btn.textContent = isEdit ? '💾 Cập nhật tuần này' : '💾 Lưu tuần này';
}

function onCCCtSelChange(){
  loadCCWeekForm();
}

// ─── history (per week) ───────────────────────────────────────────
// [MODIFIED] — CT dropdown values use projectId, display resolved name
function buildCCHistFilters(){
  const yearCC=ccData.filter(w=>!w.deletedAt&&inActiveYear(w.fromDate));
  // Build unique CT list: resolve name from projectId for display
  const ctMap=new Map(); // pid/ct → displayName
  yearCC.forEach(w=>{
    const pid=w.projectId||w.ctPid||null;
    const displayName=pid ? (_getProjectNameById(pid)||w.ct||pid) : (w.ct||'');
    if(displayName) ctMap.set(pid||w.ct, displayName);
  });
  const allCts=[...ctMap.entries()].sort((a,b)=>a[1].localeCompare(b[1],'vi'));
  // weeks list — chỉ năm đang chọn
  const allWeeks=[...new Set(yearCC.map(w=>w.fromDate))].sort().reverse();

  const ctSel=document.getElementById('cc-hist-ct'); const cv=ctSel.value;
  ctSel.innerHTML='<option value="">Tất cả CT</option>'+allCts.map(([val,name])=>`<option ${val===cv?'selected':''} value="${x(val)}">${x(name)}</option>`).join('');

  const wkSel=document.getElementById('cc-hist-week'); const wv=wkSel.value;
  wkSel.innerHTML='<option value="">Tất cả tuần</option>'+allWeeks.map(w=>`<option ${w===wv?'selected':''} value="${w}">${weekLabel(w)}</option>`).join('');

  // also update TLT week filter
  const tltSel=document.getElementById('cc-tlt-week'); const tv=tltSel.value;
  tltSel.innerHTML='<option value="">Tất cả tuần</option>'+allWeeks.map(w=>`<option ${w===tv?'selected':''} value="${w}">${weekLabel(w)}</option>`).join('');

  // Cập nhật dropdown CT cho TLT
  const tltCtSel=document.getElementById('cc-tlt-ct');
  if(tltCtSel){ const tcv=tltCtSel.value;
    tltCtSel.innerHTML='<option value="">Tất cả CT</option>'+allCts.map(([val,name])=>`<option ${val===tcv?'selected':''} value="${x(val)}">${x(name)}</option>`).join('');
  }
}

// [MODIFIED] — filter/group/display by projectId, resolve name for display
function renderCCHistory(){
  buildCCHistFilters();
  const fCt=document.getElementById('cc-hist-ct').value; // may be projectId or ct name
  const fWk=document.getElementById('cc-hist-week').value;
  const fQ=(document.getElementById('cc-hist-search')?.value||'').toLowerCase().trim();

  // [MODIFIED] — filter matcher uses projectId
  const _fMatch=w=>{
    if(!fCt) return true;
    if(w.projectId && w.projectId===fCt) return true;
    if(w.ctPid && w.ctPid===fCt) return true;
    if(w.ct===fCt) return true;
    return false;
  };

  const map={};
  ccData.forEach(w=>{
    if(w.deletedAt) return;
    if(!inActiveYear(w.fromDate)) return;
    if(!_fMatch(w)) return;
    if(fWk&&w.fromDate!==fWk) return;
    // [MODIFIED] — group key uses projectId
    const gKey=w.fromDate+'|'+(w.projectId||w.ct);
    const ctDisplay=_resolveCtName(w); // [MODIFIED]
    if(!map[gKey]){
      map[gKey]={
        id:w.id,
        fromDate:w.fromDate,
        toDate:w.toDate,
        ct:ctDisplay,                  // [MODIFIED] — resolved name
        projectId:w.projectId||null,
        d:[0,0,0,0,0,0,0],
        tc:0, tl:0, pc:0, hd:0, tongcong:0,
        luongList:[],
        names:[],
        ndList:[]
      };
    }
    w.workers.forEach(wk=>{
      const tc=round1(wk.d.reduce((s,v)=>s+v,0));
      const luong=Number(wk.luong)||0;
      const tl=tc*luong;
      const pc=wk.phucap||0;
      const hd=wk.hdmuale||0;
      wk.d.forEach((v,i)=>{ map[gKey].d[i]+=Number(v)||0; });
      map[gKey].tc+=tc;
      map[gKey].tl+=tl;
      map[gKey].pc+=pc;
      map[gKey].hd+=hd;
      if(luong>0) map[gKey].luongList.push(luong);
      if(wk.name) map[gKey].names.push(wk.name);
      if(wk.nd) map[gKey].ndList.push(wk.nd);
    });
    map[gKey].tongcong=map[gKey].tl+map[gKey].pc+map[gKey].hd;
  });
  Object.values(map).forEach(r=>{ r.tc=round1(r.tc); r.d=r.d.map(v=>round1(v)); });
  let rows=Object.values(map).map(r=>{
    const avgLuong=r.luongList.length
      ? Math.round(r.luongList.reduce((s,v)=>s+v,0)/r.luongList.length)
      : 0;
    const nd=[...new Set(r.ndList.map(v=>(v||'').trim()).filter(Boolean))].join(' | ');
    const workers=[...new Set(r.names.map(v=>(v||'').trim()).filter(Boolean))];
    return {...r, avgLuong, nd, workers};
  });
  if(fQ){
    rows=rows.filter(r=>
      (r.ct||'').toLowerCase().includes(fQ) ||
      r.workers.some(n=>n.toLowerCase().includes(fQ))
    );
  }
  rows.sort((a,b)=>b.fromDate.localeCompare(a.fromDate)||(a.ct||'').localeCompare(b.ct||'','vi'));

  const tbody=document.getElementById('cc-hist-tbody');
  const totalTL=rows.reduce((s,r)=>s+r.tl,0);
  const totalTC2=rows.reduce((s,r)=>s+r.tongcong,0);

  if(!rows.length){
    tbody.innerHTML=`<tr class="empty-row"><td colspan="17">Chưa có dữ liệu chấm công</td></tr>`;
    document.getElementById('cc-hist-pagination').innerHTML=''; return;
  }

  const start=(ccHistPage-1)*CC_PG_HIST;
  const paged=rows.slice(start,start+CC_PG_HIST);

  tbody.innerHTML=paged.map(r=>`<tr>
    <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2);white-space:nowrap">${viShort(r.fromDate)}<br><span style="color:var(--ink3)">${viShort(r.toDate)}</span></td>
    <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(r.ct||'—')}</td>
    ${r.d.map(v=>`<td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;${v===1?'color:var(--green)':v>0?'color:var(--blue)':'color:var(--line2)'}">${v||'·'}</td>`).join('')}
    <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--gold)">${r.tc}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink2)">${r.avgLuong?numFmt(r.avgLuong):'—'}</td>
    <td class="amount-td">${r.tl?numFmt(r.tl):'—'}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--blue)">${r.pc?numFmt(r.pc):'—'}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink2)">${r.hd?numFmt(r.hd):'—'}</td>
    <td style="color:var(--ink2);font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x(r.nd||'—')}</td>
    <td style="text-align:right;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:13px;color:var(--gold)">${r.tongcong?numFmt(r.tongcong):'—'}</td>
    <td>
      <button class="btn btn-outline btn-sm" onclick="loadCCWeekById('${r.id}','${r.fromDate}','${x(r.ct)}')" title="Tải tuần này" style="min-width:44px;min-height:36px;padding:6px 10px">↩ Tải</button>
      <button class="btn btn-danger btn-sm" onclick="delCCWeekById('${r.id}','${r.fromDate}','${x(r.ct)}')" title="Xóa tuần" style="min-width:44px;min-height:36px;padding:6px 10px">✕ Xóa</button>
    </td>
  </tr>`).join('');

  const tp=Math.ceil(rows.length/CC_PG_HIST);
  let pag=`<span>${rows.length} dòng · Tổng lương: <strong style="color:var(--green);font-family:'IBM Plex Mono',monospace">${fmtS(totalTL)}</strong> · Tổng cộng: <strong style="color:var(--gold);font-family:'IBM Plex Mono',monospace">${fmtS(totalTC2)}</strong></span>`;
  if(tp>1){
    pag+='<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===ccHistPage?'active':''}" onclick="ccHistGoTo(${p})">${p}</button>`;
    if(tp>10) pag+=`<span style="padding:4px 6px;color:var(--ink3)">...${tp}</span>`;
    pag+='</div>';
  }
  document.getElementById('cc-hist-pagination').innerHTML=pag;
  renderCCTLT();
}

function ccHistGoTo(p){ ccHistPage=p; renderCCHistory(); }

// ─── Tổng Lương Tuần (grouped by name per week) ───────────────────
function renderCCTLT(){
  buildCCHistFilters();
  const fWk=document.getElementById('cc-tlt-week').value;
  const fCt2=document.getElementById('cc-tlt-ct')?.value||'';

  // Group by name only khi "tất cả tuần", hoặc (tuần+name) khi lọc tuần cụ thể
  // [MODIFIED] — filter by projectId, resolve CT names for display
  const _fMatch2=w=>{
    if(!fCt2) return true;
    if(w.projectId && w.projectId===fCt2) return true;
    if(w.ctPid && w.ctPid===fCt2) return true;
    if(w.ct===fCt2) return true;
    return false;
  };
  const map={};
  ccData.forEach(w=>{
    if(w.deletedAt) return;
    if(!inActiveYear(w.fromDate)) return;
    if(!_fMatch2(w)) return;
    if(fWk&&w.fromDate!==fWk) return;
    const ctDisplay=_resolveCtName(w); // [MODIFIED]
    w.workers.forEach(wk=>{
      const key = fWk ? w.fromDate+'|'+wk.name : wk.name;
      if(!map[key]) map[key]={fromDate:w.fromDate,toDate:w.toDate,name:wk.name,
        d:[0,0,0,0,0,0,0],tc:0,tl:0,pc:0,hdml:0,loan:0,tru:0,cts:[],luongList:[]};
      wk.d.forEach((v,i)=>{ map[key].d[i]+=v; });
      const tc=round1(wk.d.reduce((s,v)=>s+v,0));
      map[key].tc+=tc;
      map[key].tl+=tc*(wk.luong||0);
      map[key].pc+=(wk.phucap||0);
      map[key].hdml+=(wk.hdmuale||0);
      map[key].loan+=(wk.loanAmount||0);
      map[key].tru+=(wk.tru||0);
      if(!map[key].cts.includes(ctDisplay)) map[key].cts.push(ctDisplay); // [MODIFIED]
      map[key].luongList.push(wk.luong||0);
      if(!fWk){ if(w.fromDate<map[key].fromDate) map[key].fromDate=w.fromDate;
                if(w.toDate>map[key].toDate) map[key].toDate=w.toDate; }
    });
  });
  Object.values(map).forEach(r=>{ r.tc=round1(r.tc); r.d=r.d.map(v=>round1(v)); });

  const rows=Object.values(map).sort((a,b)=>
    fWk ? b.fromDate.localeCompare(a.fromDate)||a.name.localeCompare(b.name,'vi')
        : a.name.localeCompare(b.name,'vi'));

  const tbody=document.getElementById('cc-tlt-tbody');
  const tableWrap=document.getElementById('cc-tlt-table-wrap');
  const cardsEl=document.getElementById('cc-tlt-cards');
  const isMobile=window.innerWidth<768;

  if(!rows.length){
    if(isMobile){ tableWrap.style.display='none'; cardsEl.style.display='block'; cardsEl.innerHTML='<p style="text-align:center;color:var(--ink3);padding:20px">Chưa có dữ liệu</p>'; }
    else{ tableWrap.style.display=''; cardsEl.style.display='none'; tbody.innerHTML=`<tr class="empty-row"><td colspan="17">Chưa có dữ liệu</td></tr>`; }
    document.getElementById('cc-tlt-pagination').innerHTML=''; return;
  }

  const grandTCLuong=rows.reduce((s,r)=>s+r.tl+r.pc,0);
  const start=(ccTltPage-1)*CC_PG_TLT;
  const paged=rows.slice(start,start+CC_PG_TLT);
  const mono="font-family:'IBM Plex Mono',monospace";
  const DAY_LABELS=['CN','T2','T3','T4','T5','T6','T7'];

  if(isMobile){
    // ── Mobile: card view ──
    tableWrap.style.display='none';
    cardsEl.style.display='block';
    cardsEl.innerHTML=paged.map(r=>{
      const tcLuong=r.tl+r.pc;
      const daysHtml=r.d.map((v,i)=>v>0?`<span class="tlt-day-badge${v>=1?' tlt-day-full':' tlt-day-half'}">${DAY_LABELS[i]}: ${v}</span>`:'').filter(Boolean).join('');
      const ctsHtml=r.cts.length?`<div class="tlt-card-cts">${r.cts.map(c=>x(c)).join(' · ')}</div>`:'';
      const periodHtml=fWk?`${viShort(r.fromDate)} – ${viShort(r.toDate)}`:'Tổng nhiều tuần';
      const noCon_=_calcDebtBefore(r.name, r.fromDate);
      return `<div class="tlt-card"
        data-name="${x(r.name)}" data-from="${r.fromDate}" data-to="${r.toDate}"
        data-tc="${r.tc}" data-tl="${r.tl}" data-pc="${r.pc}" data-hdml="${r.hdml}"
        data-loan="${r.loan}" data-tru="${r.tru}" data-no-con="${noCon_}"
        data-cts="${r.cts.join('|')}">
        <div class="tlt-card-header">
          <label class="tlt-card-label">
            <input type="checkbox" class="cc-tlt-chk">
            <span class="tlt-card-name">${x(r.name||'—')}</span>
          </label>
          <span class="tlt-card-amount">${tcLuong?numFmt(tcLuong)+' đ':'—'}</span>
        </div>
        <div class="tlt-card-meta">${periodHtml} &nbsp;·&nbsp; <strong>${r.tc}</strong> công</div>
        ${daysHtml?`<div class="tlt-card-days">${daysHtml}</div>`:''}
        ${ctsHtml}
      </div>`;
    }).join('');
  } else {
    // ── Desktop: table view ──
    tableWrap.style.display='';
    cardsEl.style.display='none';
    tbody.innerHTML=paged.map(r=>{
      const tcLuong=r.tl+r.pc;
      const thucLanh_=r.tl+r.pc+r.loan+r.hdml-r.tru;
      const luongTB=r.tc>0?Math.round(tcLuong/r.tc):0; // TB/ngày = TC Lương ÷ TC
      const noCon_=_calcDebtBefore(r.name, r.fromDate);
      const ctDisplay_=r.cts.length<=1
        ? x(r.cts[0]||'—')
        : x(r.cts[0])+` <span class="tlt-ct-more" title="${r.cts.map(c=>x(c)).join(', ')}">+${r.cts.length-1}</span>`;
      return `<tr
        data-name="${x(r.name)}" data-from="${r.fromDate}" data-to="${r.toDate}"
        data-tc="${r.tc}" data-tl="${r.tl}" data-pc="${r.pc}" data-hdml="${r.hdml}"
        data-loan="${r.loan}" data-tru="${r.tru}" data-no-con="${noCon_}"
        data-cts="${r.cts.join('|')}">
        <td style="text-align:center;padding:4px"><input type="checkbox" class="cc-tlt-chk" style="width:15px;height:15px;cursor:pointer"></td>
        <td style="${mono};font-size:10px;color:var(--ink2);white-space:nowrap">${fWk?viShort(r.fromDate):'Tổng'}<br><span style="color:var(--ink3)">${fWk?viShort(r.toDate):r.tc+' công'}</span></td>
        <td style="font-weight:700;font-size:13px">${x(r.name||'—')}</td>
        <td style="text-align:center;font-size:12px;font-weight:700;color:var(--ink2)">${cnRoles[r.name]||'—'}</td>
        ${r.d.map(v=>`<td style="text-align:center;${mono};font-weight:600;font-size:12px;${v===1?'color:var(--green)':v>0?'color:var(--blue)':'color:var(--line2)'}">${v||'·'}</td>`).join('')}
        <td style="text-align:center;${mono};font-weight:700;color:var(--gold)">${r.tc}</td>
        <td style="text-align:right;${mono};font-weight:700;font-size:13px;color:var(--green)">${tcLuong?numFmt(tcLuong):'—'}</td>
        <td style="text-align:right;${mono};font-size:12px;color:var(--ink2)">${luongTB?numFmt(luongTB):'—'}</td>
        <td style="text-align:right;${mono};font-size:12px;color:var(--red)">${r.tru?numFmt(r.tru):'—'}</td>
        <td style="text-align:right;${mono};font-weight:700;color:var(--green);background:#f1f8f4">${thucLanh_>0?numFmt(thucLanh_):thucLanh_<0?'('+numFmt(-thucLanh_)+')':'—'}</td>
        <td class="project-col" style="font-size:11px;color:var(--ink2)">${ctDisplay_}</td>
      </tr>`;
    }).join('');
  }

  const tp=Math.ceil(rows.length/CC_PG_TLT);
  let pag=`<span>${rows.length} công nhân · Tổng TC Lương: <strong style="color:var(--green);${mono}">${fmtS(grandTCLuong)}</strong></span><span id="cc-tlt-selected-sum" style="margin-left:14px;color:var(--gold);font-weight:700;${mono}"></span>`;
  if(tp>1){
    pag+='<div class="page-btns">';
    for(let p=1;p<=Math.min(tp,10);p++) pag+=`<button class="page-btn ${p===ccTltPage?'active':''}" onclick="ccTltGoTo(${p})">${p}</button>`;
    pag+='</div>';
  }
  document.getElementById('cc-tlt-pagination').innerHTML=pag;
}

// Format nghìn đồng — chỉ dùng cho selected summary (32,620,000 → "32.620 k")
function fmtK(v){ const k=Math.round((v||0)/1000); return k.toLocaleString('vi-VN')+' k'; }

// Tính tổng Thực Lãnh của các dòng đang được tick trong bảng TLT
function updateTLTSelectedSum(){
  const sumEl=document.getElementById('cc-tlt-selected-sum');
  if(!sumEl) return;
  const chks=[...document.querySelectorAll('#cc-tlt-tbody .cc-tlt-chk:checked, #cc-tlt-cards .cc-tlt-chk:checked')];
  if(!chks.length){ sumEl.textContent=''; return; }
  let total=0;
  chks.forEach(chk=>{
    const container=chk.closest('tr')||chk.closest('.tlt-card');
    if(!container) return;
    const tl=+(container.dataset.tl||0);
    const pc=+(container.dataset.pc||0);
    const hdml=+(container.dataset.hdml||0);
    const loan=+(container.dataset.loan||0);
    const tru=+(container.dataset.tru||0);
    total+=tl+pc+loan+hdml-tru;
  });
  sumEl.textContent=chks.length+'cn: '+fmtK(total);
}

function exportCCTLTCSV(){
  const fWk=document.getElementById('cc-tlt-week').value;
  const fCt2=document.getElementById('cc-tlt-ct')?.value||'';
  const map={};
  // [MODIFIED] — filter by projectId, resolve CT names
  ccData.forEach(w=>{
    if(w.deletedAt) return;
    if(!inActiveYear(w.fromDate)) return;
    if(fCt2&&!(w.projectId===fCt2||w.ctPid===fCt2||w.ct===fCt2)) return; // [MODIFIED]
    if(fWk&&w.fromDate!==fWk) return;
    const ctDisplay=_resolveCtName(w); // [MODIFIED]
    w.workers.forEach(wk=>{
      // Mirror same key logic as renderCCTLT: group by name-only when no week filter
      const key=fWk?w.fromDate+'|'+wk.name:wk.name;
      if(!map[key]) map[key]={fromDate:w.fromDate,toDate:w.toDate,name:wk.name,
        d:[0,0,0,0,0,0,0],tc:0,tl:0,pc:0,hdml:0,loan:0,tru:0,cts:[]};
      wk.d.forEach((v,i)=>{ map[key].d[i]+=v; });
      const tc=round1(wk.d.reduce((s,v)=>s+v,0));
      map[key].tc+=tc; map[key].tl+=tc*(wk.luong||0);
      map[key].pc+=(wk.phucap||0); map[key].hdml+=(wk.hdmuale||0);
      map[key].loan+=(wk.loanAmount||0);
      map[key].tru+=(wk.tru||0);
      if(!map[key].cts.includes(ctDisplay)) map[key].cts.push(ctDisplay); // [MODIFIED]
      if(!fWk){ if(w.fromDate<map[key].fromDate) map[key].fromDate=w.fromDate;
                if(w.toDate>map[key].toDate) map[key].toDate=w.toDate; }
    });
  });
  Object.values(map).forEach(r=>{ r.tc=round1(r.tc); r.d=r.d.map(v=>round1(v)); });
  const rows=[['Tuần','Tên CN','CN','T2','T3','T4','T5','T6','T7','TC','TC Lương','Lương TB/Ngày','Vay Mới','Trừ Nợ','Thực Lãnh','Công Trình']];
  Object.values(map).sort((a,b)=>fWk?b.fromDate.localeCompare(a.fromDate)||a.name.localeCompare(b.name,'vi'):a.name.localeCompare(b.name,'vi')).forEach(r=>{
    const tcL=r.tl+r.pc+r.hdml;  // TC Lương = lương + phụ cấp + HĐ mua lẻ
    const ltb=r.tc>0?Math.round(tcL/r.tc):0;
    const thucLanh_csv=r.tl+r.pc+r.loan+r.hdml-r.tru;
    const periodStr=fWk?viShort(r.fromDate)+'–'+viShort(r.toDate):'Tổng';
    rows.push([periodStr,r.name,...r.d,r.tc,tcL,ltb,r.loan,r.tru,thucLanh_csv,r.cts.join(', ')]);
  });
  dlCSV(rows,'tong_luong_tuan_'+today()+'.csv');
}

function ccTltGoTo(p){ ccTltPage=p; renderCCTLT(); }

// [MODIFIED] — resolve ct name from projectId for display
function loadCCWeekById(id, fromDate, ct) {
  const rec = ccData.find(w => !w.deletedAt && String(w.id) === String(id))
           || ccData.find(w => !w.deletedAt && w.fromDate === fromDate && (w.projectId === ct || w.ct === ct));
  if (!rec) { toast('Không tìm thấy dữ liệu tuần này', 'error'); return; }
  const thisSun=ccSundayISO(0);
  const [ty,tm,td]=thisSun.split('-').map(Number);
  const [fy,fm,fd]=rec.fromDate.split('-').map(Number);
  const diffMs=new Date(fy,fm-1,fd)-new Date(ty,tm-1,td);
  ccOffset=Math.round(diffMs/(7*86400000));
  const satISO=ccSaturdayISO(rec.fromDate);
  const ctDisplay=_resolveCtName(rec); // [MODIFIED]
  document.getElementById('cc-from').value=rec.fromDate;
  document.getElementById('cc-to').value=satISO;
  document.getElementById('cc-week-label').textContent='Tuần: '+weekLabel(rec.fromDate);
  document.getElementById('cc-ct-sel').value=ctDisplay; // [MODIFIED]
  buildCCTable(rec.workers);
  window.scrollTo({top:0,behavior:'smooth'});
  toast('Đã tải tuần '+viShort(rec.fromDate)+' – '+ctDisplay); // [MODIFIED]
}

// [MODIFIED] — match by projectId, display resolved name
function delCCWeekById(id, fromDate, ct) {
  const ctDisplay = _getProjectNameById(ct) || ct; // [MODIFIED] — ct may be projectId
  if(!confirm(`Xóa toàn bộ chấm công tuần ${viShort(fromDate)} của công trình "${ctDisplay}"?`)) return;
  const now = Date.now();
  let found = false;
  ccData = ccData.map(r => {
    const matchId  = String(r.id) === String(id);
    // [MODIFIED] — also match by projectId
    const matchKey = r.fromDate === fromDate && (r.projectId === ct || r.ct === ct);
    if ((matchId || matchKey) && !r.deletedAt) {
      found = true;
      return { ...r, deletedAt: now, updatedAt: now, deviceId: DEVICE_ID };
    }
    return r;
  });
  if (!found) { toast('Không tìm thấy dữ liệu để xóa', 'error'); return; }
  clearInvoiceCache(); save('cc_v2', ccData);
  updateTop(); renderCCHistory(); renderCCTLT();
  toast('Đã xóa tuần chấm công');
}

// ── Aliases — keep old names so any external call still works ──
function loadCCWeekFromHistory(fromDate, ct) { loadCCWeekById('', fromDate, ct); }
function delCCWeekHistory(fromDate, ct)      { delCCWeekById('', fromDate, ct); }

function delCCWorker(wid,name){
  if(!confirm(`Xóa "${name}" khỏi tuần này?`)) return;
  const w=ccData.find(r=>r.id===wid);
  if(w){ w.workers=w.workers.filter(wk=>wk.name!==name); if(!w.workers.length) ccData=ccData.filter(r=>r.id!==wid); }
  clearInvoiceCache(); save('cc_v2',ccData); renderCCHistory(); toast('Đã xóa');
}

// ─── export ────────────────────────────────────────────────────────
function exportCCWeekCSV(){
  const f=document.getElementById('cc-from').value;
  const ct=document.getElementById('cc-ct-sel').value||'?';
  const rows=[['CT','Từ','Đến','Tên','CN','T2','T3','T4','T5','T6','T7','TC','Lương/N','Tổng Lương','Phụ Cấp','Vay Mới','HĐ Mua Lẻ','Trừ Nợ','Nội Dung','Thực Lãnh']];
  document.querySelectorAll('#cc-tbody tr:not(.cc-sum-row)').forEach(tr=>{
    const name=tr.querySelector('[data-cc="name"]')?.value?.trim()||'';
    if(!name) return;
    const d=[]; for(let i=0;i<7;i++) d.push(parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0)||0);
    const tc=round1(d.reduce((s,v)=>s+v,0));
    const l=parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0)||0;
    const pc=parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0)||0;
    const ln=parseInt(tr.querySelector('[data-cc="loan"]')?.dataset?.raw||0)||0;
    const hd=parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0)||0;
    const tru=parseInt(tr.querySelector('[data-cc="tru"]')?.dataset?.raw||0)||0;
    const nd=tr.querySelector('[data-cc="nd"]')?.value?.trim()||'';
    rows.push([ct,f,document.getElementById('cc-to').value,name,...d,tc,l,tc*l,pc,ln,hd,tru,nd,tc*l+pc+ln+hd-tru]);
  });
  dlCSV(rows,'chamcong_'+f+'.csv');
}

function exportCCHistCSV(){
  // Xuất đúng dữ liệu đang lọc trong bảng Lịch Sử Chấm Công Tuần
  const fCt=document.getElementById('cc-hist-ct').value;
  const fWk=document.getElementById('cc-hist-week').value;
  const fQ=(document.getElementById('cc-hist-search')?.value||'').toLowerCase().trim();
  const rows=[['CT','Từ','Đến','CN','T2','T3','T4','T5','T6','T7','TC','Lương/Ngày TB','Tổng Lương','Phụ Cấp','HĐ Mua Lẻ','Nội Dung','Tổng Cộng']];
  const map={};
  // [MODIFIED] — filter + group by projectId, display resolved name
  ccData.forEach(w=>{
    if(w.deletedAt) return;
    if(!inActiveYear(w.fromDate)) return;
    if(fCt&&!(w.projectId===fCt||w.ctPid===fCt||w.ct===fCt)) return; // [MODIFIED]
    if(fWk&&w.fromDate!==fWk) return;
    const ctDisplay=_resolveCtName(w); // [MODIFIED]
    const key=w.fromDate+'|'+(w.projectId||w.ct); // [MODIFIED]
    if(!map[key]) map[key]={
      fromDate:w.fromDate,toDate:w.toDate,ct:ctDisplay, // [MODIFIED]
      d:[0,0,0,0,0,0,0],tc:0,tl:0,pc:0,hd:0,luongList:[],names:[],ndList:[]
    };
    w.workers.forEach(wk=>{
      const tc=round1(wk.d.reduce((s,v)=>s+v,0));
      const luong=Number(wk.luong)||0;
      wk.d.forEach((v,i)=>{ map[key].d[i]+=Number(v)||0; });
      map[key].tc+=tc;
      map[key].tl+=tc*luong;
      map[key].pc+=(wk.phucap||0);
      map[key].hd+=(wk.hdmuale||0);
      if(luong>0) map[key].luongList.push(luong);
      if(wk.name) map[key].names.push(wk.name);
      if(wk.nd) map[key].ndList.push(wk.nd);
    });
  });
  Object.values(map).forEach(r=>{ r.tc=round1(r.tc); r.d=r.d.map(v=>round1(v)); });
  Object.values(map)
    .map(r=>{
      const avgLuong=r.luongList.length?Math.round(r.luongList.reduce((s,v)=>s+v,0)/r.luongList.length):0;
      const workers=[...new Set(r.names.map(v=>(v||'').trim()).filter(Boolean))];
      const nd=[...new Set(r.ndList.map(v=>(v||'').trim()).filter(Boolean))].join(' | ');
      return {...r,avgLuong,workers,nd,tong:r.tl+r.pc+r.hd};
    })
    .filter(r=>!fQ||(r.ct||'').toLowerCase().includes(fQ)||r.workers.some(n=>n.toLowerCase().includes(fQ)))
    .sort((a,b)=>b.fromDate.localeCompare(a.fromDate)||(a.ct||'').localeCompare(b.ct||'','vi'))
    .forEach(r=>{
      rows.push([r.ct,viShort(r.fromDate)+'–'+viShort(r.toDate),r.toDate,...r.d,r.tc,r.avgLuong,r.tl,r.pc,r.hd,r.nd,r.tong]);
    });
  const label=fWk?viShort(fWk):'all';
  dlCSV(rows,'lich_su_cham_cong_'+label+'_'+today()+'.csv');
}

// [MODULE: PHIẾU LƯƠNG] — xuatPhieuLuong · html2canvas
// Ctrl+F → "MODULE: PHIẾU LƯƠNG"
// ══════════════════════════════════════════════════════════════

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // xóa dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s_]/g, '')    // xóa ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '_');
}

function xuatPhieuLuong() {
  // 1. Thu thập công nhân được tick từ bảng Tổng Lương Tuần
  //    Hỗ trợ cả table row (desktop) và card div (mobile)
  const rows = [];
  document.querySelectorAll('.cc-tlt-chk:checked').forEach(chk => {
    const container = chk.closest('[data-name]');
    if (!container) return;
    const name     = container.dataset.name || '(Chưa đặt tên)';
    const fromDate = container.dataset.from  || '';
    const toDate   = container.dataset.to    || '';
    const tc       = parseFloat(container.dataset.tc)   || 0;
    const tl       = parseInt(container.dataset.tl)     || 0; // tc * luong
    const pc       = parseInt(container.dataset.pc)     || 0; // phụ cấp
    const hdml     = parseInt(container.dataset.hdml)   || 0; // HĐ mua lẻ
    const loan     = parseInt(container.dataset.loan)   || 0; // vay mới
    const tru      = parseInt(container.dataset.tru)    || 0; // trừ nợ ứng
    const noCon    = parseInt(container.dataset.noCon)  || 0; // nợ còn
    const cts      = (container.dataset.cts || '').split('|').filter(Boolean);
    const tongCong = tl + pc;
    const luongTB  = tc > 0 ? Math.round(tl / tc) : 0;
    rows.push({ name, fromDate, toDate, tc, tl, pc, hdml, loan, cts, tongCong, luongTB, tru, noCon });
  });

  if (!rows.length) {
    toast('⚠️ Tick chọn ít nhất 1 công nhân trong bảng Tổng Lương Tuần!', 'error');
    return;
  }

  // 2. Tổng hợp thông tin chung
  const allFrom = rows.map(r => r.fromDate).filter(Boolean).sort();
  const allTo   = rows.map(r => r.toDate).filter(Boolean).sort();
  const fromDt  = allFrom[0] || '';
  const toDt    = allTo[allTo.length - 1] || '';
  const period  = fromDt && toDt ? _fmtDate(fromDt) + ' — ' + _fmtDate(toDt) : '(Chưa rõ)';

  const allCts     = [...new Set(rows.flatMap(r => r.cts))];
  const ctLabel    = allCts.join(', ') || '(Nhiều công trình)';
  const today_     = new Date().toLocaleDateString('vi-VN');
  const tongThanhToan  = rows.reduce((s, r) => s + r.tongCong, 0); // sum(tl+pc)
  const tongTru_       = rows.reduce((s, r) => s + r.tru,      0);
  const tongLoan_      = rows.reduce((s, r) => s + r.loan,     0);
  const tongHDML_      = rows.reduce((s, r) => s + r.hdml,     0);
  const tongThucLanh_  = tongThanhToan + tongHDML_ + tongLoan_ - tongTru_;
  const _seenCNNames = new Set();
  let tongNoCon_ = 0; // tổng nợ cũ (trước tuần) — mỗi CN chỉ tính 1 lần
  rows.forEach(r => { if(!_seenCNNames.has(r.name)){ _seenCNNames.add(r.name); tongNoCon_ += r.noCon; } });
  const tongNoHienTai_ = tongNoCon_ + tongLoan_ - tongTru_; // nợ còn sau tuần này

  // 3. Đổ dữ liệu vào template
  document.getElementById('pl-ct-name').textContent = ctLabel;
  document.getElementById('pl-ct-label').textContent = ctLabel;
  document.getElementById('pl-period').textContent   = period;
  document.getElementById('pl-date').textContent     = today_;

  document.getElementById('pl-tbody').innerHTML = rows.map(r => `
    <tr>
      <td>${x(r.name)}</td>
      <td>${r.tc}</td>
      <td>${r.luongTB ? numFmt(r.luongTB) + ' đ' : '—'}</td>
      <td>${r.pc ? numFmt(r.pc) + ' đ' : '—'}</td>
      <td style="font-weight:700;color:#c8870a">${numFmt(r.tongCong)} đ</td>
    </tr>`).join('');

  document.getElementById('pl-total-cell').textContent = numFmt(tongThanhToan) + ' đ';

  // ── Phần tổng hợp chi phí & công nợ ──────────────────────────────
  document.getElementById('pl-sum-hdml').textContent =
    tongHDML_ ? numFmt(tongHDML_) + ' đ' : '—';
  document.getElementById('pl-sum-thuclanh').textContent =
    numFmt(tongThanhToan + tongHDML_) + ' đ'; // (lương+PC) + HĐ mua lẻ
  document.getElementById('pl-sum-tru').textContent =
    tongTru_ ? numFmt(tongTru_) + ' đ' : '—';
  document.getElementById('pl-sum-loan').textContent =
    tongLoan_ ? numFmt(tongLoan_) + ' đ' : '—';
  const _noConEl    = document.getElementById('pl-sum-nocon');
  const _noConStr   = tongNoHienTai_ > 0 ? numFmt(tongNoHienTai_) + ' (nợ)'
                    : tongNoHienTai_ < 0 ? numFmt(-tongNoHienTai_) + ' (dư)'
                    : '0 đ';
  const _noConColor = tongNoHienTai_ > 0 ? '#c0392b'
                    : tongNoHienTai_ < 0 ? '#1a6e3a' : '#555';
  if (_noConEl) { _noConEl.textContent = _noConStr; _noConEl.style.color = _noConColor; }

  // Grand total — luôn hiển thị Thực Lãnh
  document.getElementById('pl-grand-total').textContent =
    'THỰC LÃNH: ' + numFmt(Math.max(0, tongThucLanh_)) + ' đồng';

  // 4. Hiện template tạm để chụp
  const tpl = document.getElementById('phieu-luong-template');
  tpl.style.display = 'block';

  // 5. Chụp bằng html2canvas
  const _now = new Date();
  const _dd = String(_now.getDate()).padStart(2, '0');
  const _mm = String(_now.getMonth() + 1).padStart(2, '0');
  const _yy = String(_now.getFullYear()).slice(-2);
  const _datePart = _dd + _mm + _yy;
  const _wParts = rows.map(r =>
    removeVietnameseTones(r.name) + '_' + r.tc + 'c'
  ).join('_');
  const _ctList = allCts.slice(0, 3).map(ct => removeVietnameseTones(ct).slice(0, 3));
  const _ctPart = _ctList.join('_') + (allCts.length > 3 ? '_etc' : '');
  const fileName = 'Phieuluong_' + _datePart + '_' + _wParts + (_ctPart ? '_' + _ctPart : '');
  toast('⏳ Đang tạo phiếu lương...', 'info');

  document.fonts.ready.then(() => {
    html2canvas(tpl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: 760
    }).then(canvas => {
      tpl.style.display = 'none';
      const link = document.createElement('a');
      link.download = fileName + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('✅ Đã xuất phiếu lương ' + rows.length + ' người!', 'success');
    }).catch(err => {
      tpl.style.display = 'none';
      console.error('html2canvas error:', err);
      toast('❌ Lỗi khi tạo ảnh: ' + err.message, 'error');
    });
  });
}

// Helper: format ngày YYYY-MM-DD → DD/MM/YYYY
function exportUngToImage() {
  // 1. Lấy các dòng được tick (dựa vào data-id khớp filteredUng)
  const checkedIds = new Set(
    [...document.querySelectorAll('.ung-row-chk:checked')].map(el => el.dataset.id)
  );
  if (!checkedIds.size) {
    toast('⚠️ Vui lòng tick chọn ít nhất 1 khoản ứng!', 'error');
    return;
  }
  const rows = filteredUng.filter(r => checkedIds.has(String(r.id)));
  if (!rows.length) {
    toast('⚠️ Không tìm thấy dữ liệu — thử lọc lại rồi tick chọn!', 'error');
    return;
  }

  // 2. Thông tin chung
  const ct       = rows[0]?.congtrinh || '(Chưa rõ CT)';
  const tongTien = sumBy(rows, 'tien');

  // 3. Đổ dữ liệu vào template
  document.getElementById('pul-ct-name').textContent  = ct;
  document.getElementById('pul-ct-label').textContent = ct;
  document.getElementById('pul-date').textContent     = new Date().toLocaleDateString('vi-VN');

  document.getElementById('pul-tbody').innerHTML = rows.map((r, i) => `
    <tr style="${i % 2 === 1 ? 'background:#f9f7f4' : ''}">
      <td style="padding:8px 10px;white-space:nowrap">${r.ngay}</td>
      <td style="padding:8px 10px;font-weight:600">${x(r.tp || '—')}</td>
      <td style="padding:8px 10px;color:#555">${x(r.nd || '—')}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;color:#c8870a;white-space:nowrap">
        ${numFmt(r.tien || 0)} đ
      </td>
    </tr>`).join('');

  document.getElementById('pul-total-cell').textContent   = numFmt(tongTien) + ' đ';
  document.getElementById('pul-grand-total').textContent  =
    'TỔNG TIỀN TẠM ỨNG: ' + numFmt(tongTien) + ' đồng';

  // 4. Tạo tên file:  Phieuung_TenCT_TenTP1_500k_TenTP2_300k.png
  const safeCT = removeVietnameseTones(ct);
  const tpMap  = {};
  rows.forEach(r => {
    const key = r.tp || 'KhongRo';
    tpMap[key] = (tpMap[key] || 0) + (r.tien || 0);
  });
  const workerParts = Object.entries(tpMap)
    .map(([tp, tien]) => removeVietnameseTones(tp) + '_' + Math.round(tien / 1000) + 'k')
    .join('_');
  const fileName = 'Phieuung_' + safeCT + '_' + workerParts;

  // 5. Chụp ảnh
  const tpl = document.getElementById('phieu-ung-template');
  tpl.style.display = 'block';
  toast('⏳ Đang tạo phiếu tạm ứng...', 'info');

  document.fonts.ready.then(() => {
    html2canvas(tpl, {
      scale: 2, backgroundColor: '#ffffff',
      useCORS: true, logging: false, windowWidth: 760
    }).then(canvas => {
      tpl.style.display = 'none';
      const link = document.createElement('a');
      link.download = fileName + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('✅ Đã xuất phiếu tạm ứng ' + rows.length + ' dòng!', 'success');
    }).catch(err => {
      tpl.style.display = 'none';
      toast('❌ Lỗi khi tạo ảnh: ' + err.message, 'error');
    });
  });
}

function _fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}
