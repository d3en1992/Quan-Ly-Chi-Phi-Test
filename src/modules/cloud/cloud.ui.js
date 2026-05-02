// src/modules/cloud/cloud.ui.js
// Firebase Cloud Sync UI (ported from core.js)

export function openBinModal() { renderBinModal(); }
export function closeBinModal() {
  const ov = document.getElementById('bin-modal-overlay');
  if(ov) ov.style.display='none';
}

export function renderBinModal() {
  const yr = window.activeYear || new Date().getFullYear();
  const ov = document.getElementById('bin-modal-overlay') || _createModalOverlay();
  const isConnected = window.fbReady ? window.fbReady() : false;
  const yearKb = (isConnected && window.estimateYearKb) ? window.estimateYearKb(yr) : 0;

  const statusColor = yearKb < 200 ? '#1a7a45' : yearKb < 500 ? '#e67e00' : '#c0392b';
  const statusBg    = yearKb < 200 ? '#d4edda'  : yearKb < 500 ? '#fff3cd' : '#f8d7da';
  const statusLabel = yearKb < 200 ? '✅ OK'    : yearKb < 500 ? '⚠️ Khá lớn' : '🔴 Lớn';

  const cfg = window.FB_CONFIG || { projectId: '', apiKey: '' };

  ov.innerHTML = `<div onclick="event.stopPropagation()" style="max-width:460px;width:95vw;background:#fff;border-radius:16px;padding:24px;font-family:'IBM Plex Sans',sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.18)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:17px;font-weight:800;margin:0">🔥 Kết Nối Firebase</h3>
      <button onclick="closeBinModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888;line-height:1">✕</button>
    </div>

    ${isConnected ? `
    <div style="background:#f0fff4;border:1px solid #b2dfdb;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#1a7a45;margin-bottom:4px">✅ ĐÃ KẾT NỐI</div>
      <div style="font-size:11px;color:#555">Project: <strong>${cfg.projectId}</strong></div>
      <div style="font-size:11px;color:#888;margin-top:2px">API Key: ${(cfg.apiKey||'').substring(0,8)}••••••••</div>
    </div>
    <div style="background:#f5f4f0;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px">
      📊 Dữ liệu năm ${yr}: <strong style="color:${statusColor}">${yearKb}kb</strong>
      <span style="margin-left:6px;background:${statusBg};color:${statusColor};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700">${statusLabel}</span>
      <div style="font-size:10px;color:#aaa;margin-top:2px">Firebase free: 1GB storage · 50K reads/ngày · 20K writes/ngày</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button onclick="manualSync();closeBinModal();" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #1565c0;background:transparent;color:#1565c0;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">🔄 Sync</button>
      <button onclick="fbDisconnect()" style="flex:1;padding:10px;border-radius:8px;border:1.5px solid #c0392b;background:transparent;color:#c0392b;font-family:inherit;font-size:13px;cursor:pointer">⛔ Ngắt</button>
    </div>
    ` : `
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#856404">
      Nhập <strong>Project ID</strong> và <strong>Web API Key</strong> từ Firebase Console để kết nối.
    </div>
    `}

    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:700;color:#555;display:block;margin-bottom:4px">PROJECT ID</label>
      <input id="fb-proj-input" type="text" value="${cfg.projectId}"
        placeholder="your-project-id"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none">
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:700;color:#555;display:block;margin-bottom:4px">WEB API KEY</label>
      <input id="fb-key-input" type="text" value="${cfg.apiKey}"
        placeholder="AIzaSy..."
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none">
    </div>
    <button onclick="fbSaveConfig()" style="width:100%;padding:12px;border-radius:8px;border:none;background:#1a1814;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">
      💾 ${isConnected ? 'Cập Nhật Kết Nối' : 'Kết Nối Firebase'}
    </button>
    <div style="font-size:11px;color:#aaa;text-align:center;line-height:1.6">
      Firebase free tier: 1GB · Không giới hạn size/file · Google hỗ trợ lâu dài
    </div>
  </div>`;
  ov.style.display = 'flex';
}

export function _createModalOverlay() {
  let ov = document.getElementById('bin-modal-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bin-modal-overlay';
    ov.onclick = function(e) { if(e.target===this) closeBinModal(); };
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
    document.body.appendChild(ov);
  }
  return ov;
}

export function fbSaveConfig() {
  const proj = (document.getElementById('fb-proj-input')?.value||'').trim();
  const key  = (document.getElementById('fb-key-input')?.value||'').trim();
  if (!proj || !key) { window.toast('Vui lòng nhập đủ Project ID và API Key!', 'error'); return; }
  
  if (window.FB_CONFIG) {
    window.FB_CONFIG.projectId = proj;
    window.FB_CONFIG.apiKey    = key;
  }
  if (window._saveLS) window._saveLS('fb_config', { projectId: proj, apiKey: key });
  
  closeBinModal();
  window.toast('✅ Đã lưu cấu hình Firebase! Đang tải dữ liệu...', 'success');
  if (window.updateJbBtn) window.updateJbBtn();
  reloadFromCloud();
}

export function fbDisconnect() {
  if (!confirm('Ngắt kết nối Firebase? Dữ liệu local vẫn còn.')) return;
  if (window.FB_CONFIG) {
    window.FB_CONFIG.projectId = '';
    window.FB_CONFIG.apiKey    = '';
  }
  localStorage.removeItem('fb_config');
  closeBinModal();
  if (window.updateJbBtn) window.updateJbBtn();
  window.toast('Đã ngắt kết nối Firebase');
}

export function reloadFromCloud() {
  if (window.showSyncBanner) window.showSyncBanner('⏳ Đang tải dữ liệu...');
  if (window.gsLoadAll) {
    window.gsLoadAll(function(data) {
      if (!data) { if(window.hideSyncBanner) window.hideSyncBanner(); window.toast('⚠️ Không tải được dữ liệu từ cloud', 'error'); return; }
      
      const _load = window.load || ((k,d)=>d);
      const _DEFAULTS = window.DEFAULTS || {};
      
      window.invoices   = _load('inv_v3', []);
      window.ungRecords = _load('ung_v1', []);
      window.ccData     = _load('cc_v2', []);
      window.tbData     = _load('tb_v1', []);
      if (typeof window.projects !== 'undefined') window.projects = _load('projects_v1', []);
      
      if (window.cats) {
        window.cats.congTrinh      = _load('cat_ct',       _DEFAULTS.congTrinh);
        window.cats.congTrinhYears = _load('cat_ct_years', {});
        window.cats.loaiChiPhi     = _load('cat_loai',     _DEFAULTS.loaiChiPhi);
        window.cats.nhaCungCap     = _load('cat_ncc',      _DEFAULTS.nhaCungCap);
        window.cats.nguoiTH        = _load('cat_nguoi',    _DEFAULTS.nguoiTH);
        window.cats.tbTen          = _load('cat_tbteb',    _DEFAULTS.tbTen);
      }
      
      if (typeof window.rebuildCatCTFromProjects === 'function') window.rebuildCatCTFromProjects();
      if (typeof window.buildYearSelect === 'function') window.buildYearSelect();
      if (typeof window.rebuildEntrySelects === 'function') window.rebuildEntrySelects();
      if (typeof window.rebuildUngSelects === 'function') window.rebuildUngSelects();
      if (typeof window.buildFilters === 'function') window.buildFilters();
      if (typeof window.filterAndRender === 'function') window.filterAndRender();
      if (typeof window.renderTrash === 'function') window.renderTrash();
      if (typeof window.renderCCHistory === 'function') window.renderCCHistory();
      if (typeof window.renderCCTLT === 'function') window.renderCCTLT();
      if (typeof window.buildUngFilters === 'function') window.buildUngFilters();
      if (typeof window.filterAndRenderUng === 'function') window.filterAndRenderUng();
      if (typeof window.renderCtPage === 'function') window.renderCtPage();
      if (typeof window.updateTop === 'function') window.updateTop();
      if (typeof window.renderSettings === 'function') window.renderSettings();
      
      window.toast('✅ Đã tải dữ liệu từ Firebase!', 'success');
    });
  }
}

// Window bridges
window.openBinModal = openBinModal;
window.closeBinModal = closeBinModal;
window.renderBinModal = renderBinModal;
window.fbSaveConfig = fbSaveConfig;
window.fbDisconnect = fbDisconnect;
window.reloadFromCloud = reloadFromCloud;

window.jbSaveId     = fbSaveConfig;
window.jbDisconnect = fbDisconnect;
window.copyBinId    = () => navigator.clipboard.writeText(window.FB_CONFIG?.projectId||'').then(()=>window.toast('✅ Đã copy Project ID')).catch(()=>{});
window.linkBinId    = fbSaveConfig;
window.resetBin     = fbDisconnect;
window.createNewBin = openBinModal;
window.syncNow      = () => { closeBinModal(); reloadFromCloud(); };
