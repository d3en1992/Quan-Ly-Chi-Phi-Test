// ══════════════════════════════════════════════════════════════
// src/modules/auth/auth.module.js — Auth + Session + Role UI
// Prompt 9 — ES Modules Refactor
// Bốc từ main.js: login, validateSession, getDeviceId,
// sessionHeartbeat, role UI, applyRoleUI
// ══════════════════════════════════════════════════════════════

// ── Constants ────────────────────────────────────────────────
export const USER_KEY         = 'users_v1';
export const USER_SESSION_KEY = 'currentUser';
export const USER_DEVICE_KEY  = 'device_id';

// ── Device identity ──────────────────────────────────────────
export function getDeviceId() {
  let id = localStorage.getItem(USER_DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_DEVICE_KEY, id);
  }
  return id;
}

// ── Session normalization ────────────────────────────────────
export function safeSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  const byDevice = new Map();
  sessions.forEach(s => {
    if (!s || !s.deviceId) return;
    const next = {
      deviceId:   String(s.deviceId),
      loginAt:    Number(s.loginAt)    || Date.now(),
      lastActive: Number(s.lastActive) || Number(s.loginAt) || Date.now()
    };
    const prev = byDevice.get(next.deviceId);
    if (!prev || next.lastActive >= prev.lastActive) byDevice.set(next.deviceId, next);
  });
  return [...byDevice.values()];
}

export function normalizeUserRecord(user, fallbackIdx = 0) {
  const now  = Date.now();
  const base = user && typeof user === 'object' ? user : {};
  return {
    id:             base.id || `u_${fallbackIdx}_${crypto.randomUUID()}`,
    username:       String(base.username || '').trim(),
    password:       String(base.password || ''),
    role:           base.role || 'ketoan',
    updatedAt:      Number(base.updatedAt) || now,
    sessionVersion: Number(base.sessionVersion) || 1,
    sessions:       safeSessions(base.sessions)
  };
}

export function normalizeUsersArray(users) {
  const list = Array.isArray(users) ? users : [];
  const byKey = new Map();
  list.forEach((u, idx) => {
    const next = normalizeUserRecord(u, idx);
    if (!next.username) return;
    const key  = String(next.id || next.username);
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, next); return; }
    const winner = (next.updatedAt || 0) >= (prev.updatedAt || 0) ? next : prev;
    winner.sessions       = safeSessions([...(prev.sessions || []), ...(next.sessions || [])]);
    winner.sessionVersion = Math.max(prev.sessionVersion || 1, next.sessionVersion || 1);
    byKey.set(key, winner);
  });
  return [...byKey.values()];
}

export function mergeUsers(localUsers, cloudUsers) {
  const local = normalizeUsersArray(localUsers);
  const cloud = normalizeUsersArray(cloudUsers);
  const byId  = new Map();
  local.forEach(u => byId.set(u.id, u));
  cloud.forEach(cloudUser => {
    const localUser = byId.get(cloudUser.id);
    if (!localUser) { byId.set(cloudUser.id, cloudUser); return; }
    const localTs  = Number(localUser.updatedAt) || 0;
    const cloudTs  = Number(cloudUser.updatedAt) || 0;
    const newer    = cloudTs > localTs ? cloudUser : localUser;
    const older    = newer === cloudUser ? localUser : cloudUser;
    byId.set(cloudUser.id, {
      ...older,
      ...newer,
      updatedAt:      Math.max(localTs, cloudTs),
      sessionVersion: Math.max(localUser.sessionVersion || 1, cloudUser.sessionVersion || 1),
      sessions:       safeSessions([...(localUser.sessions || []), ...(cloudUser.sessions || [])])
    });
  });
  return [...byId.values()];
}

// ── User CRUD (delegates to global load/save) ────────────────
export function loadUsers() {
  const raw   = (typeof load === 'function' ? load(USER_KEY, []) : []) || [];
  const users = normalizeUsersArray(raw);
  if (JSON.stringify(raw) !== JSON.stringify(users) && typeof save === 'function')
    save(USER_KEY, users);
  return users;
}

export function saveUsers(arr) {
  if (typeof save === 'function') save(USER_KEY, normalizeUsersArray(arr || []));
  if (typeof schedulePush === 'function') schedulePush();
}

export function ensureDefaultUsers() {
  let users = loadUsers();
  if (users && users.length > 0) return;
  const now = Date.now();
  users = normalizeUsersArray([
    { username: 'admin',    password: 'tinhden@', role: 'admin',    updatedAt: now, sessionVersion: 1, sessions: [] },
    { username: 'giamdoc', password: '123',       role: 'giamdoc', updatedAt: now, sessionVersion: 1, sessions: [] },
    { username: 'ketoan',  password: '123',       role: 'ketoan',  updatedAt: now, sessionVersion: 1, sessions: [] }
  ]);
  saveUsers(users);
  console.log('✅ Default users created');
}

// ── Current session ──────────────────────────────────────────
export function getCurrentUser() {
  try {
    const session = JSON.parse(localStorage.getItem(USER_SESSION_KEY) || 'null');
    return session && typeof session === 'object' ? session : null;
  } catch { return null; }
}

export function setCurrentUser(user) {
  const next = user ? {
    id:             user.id,
    username:       user.username,
    password:       user.password,
    role:           user.role,
    sessionVersion: user.sessionVersion || 1,
    deviceId:       getDeviceId()
  } : null;
  if (next) localStorage.setItem(USER_SESSION_KEY, JSON.stringify(next));
  else       localStorage.removeItem(USER_SESSION_KEY);
  return next;
}

export function isAdmin()    { return getCurrentUser()?.role === 'admin'; }
export function isKetoan()   { return getCurrentUser()?.role === 'ketoan'; }
export function isGiamdoc()  { return getCurrentUser()?.role === 'giamdoc'; }

// ── Touch session (heartbeat helper) ────────────────────────
export function touchUserSession(user, keepLoginAt) {
  const deviceId = getDeviceId();
  const now      = Date.now();
  const sessions = safeSessions(user.sessions);
  const existing = sessions.find(s => s.deviceId === deviceId);
  const next = {
    deviceId,
    loginAt:    keepLoginAt && existing ? existing.loginAt : now,
    lastActive: now
  };
  return [...sessions.filter(s => s.deviceId !== deviceId), next];
}

// ── Validate session against users store ────────────────────
export function validateCurrentSession() {
  const session = getCurrentUser();
  if (!session) return null;
  const user = loadUsers().find(u =>
    String(u.id) === String(session.id) || u.username === session.username
  );
  if (!user) return null;
  if ((user.sessionVersion || 1) !== (session.sessionVersion || 1)) return null;
  return user;
}

// ── Login / Logout ───────────────────────────────────────────
export function login(username, password) {
  const users = loadUsers();
  const idx   = users.findIndex(x => x.username === username && x.password === password);
  if (idx < 0) return false;

  const u = {
    ...users[idx],
    sessions:  touchUserSession(users[idx], false),
    updatedAt: Date.now()
  };
  users[idx] = normalizeUserRecord(u, idx);
  saveUsers(users);
  setCurrentUser(u);
  return true;
}

export function logout(deviceId) {
  const did     = deviceId || getDeviceId();
  const session = getCurrentUser();
  if (session) {
    const users = loadUsers();
    const idx   = users.findIndex(u => String(u.id) === String(session.id));
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        sessions:  safeSessions(users[idx].sessions).filter(s => s.deviceId !== did),
        updatedAt: Date.now()
      };
      saveUsers(users);
    }
  }
  setCurrentUser(null);
}

// ── Profile update ───────────────────────────────────────────
export function updateUserProfile({ username, password }) {
  const session = getCurrentUser();
  if (!session) return false;
  const users = loadUsers();
  const idx   = users.findIndex(u => String(u.id) === String(session.id));
  if (idx < 0) return false;

  const user    = users[idx];
  const now     = Date.now();
  const nextUser = { ...user, username: username || user.username, updatedAt: now };
  const pwChanged = !!password && password !== user.password;
  if (pwChanged) {
    nextUser.password       = password;
    nextUser.sessionVersion = (user.sessionVersion || 1) + 1;
    nextUser.sessions       = [];
  }
  users[idx] = normalizeUserRecord(nextUser, idx);
  saveUsers(users);
  if (!pwChanged) setCurrentUser(users[idx]);
  return { ok: true, passwordChanged: pwChanged };
}

// ── Heartbeat timer ──────────────────────────────────────────
let _heartbeatTimer = null;

export function startSessionHeartbeat() {
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(() => {
    const session = getCurrentUser();
    if (!session) return;
    const users = loadUsers();
    const idx   = users.findIndex(u => String(u.id) === String(session.id));
    if (idx < 0) return;
    users[idx] = {
      ...users[idx],
      sessions:  touchUserSession(users[idx], true),
      updatedAt: Math.max(users[idx].updatedAt || 0, Date.now())
    };
    saveUsers(users);
    setCurrentUser(users[idx]);
  }, 60 * 1000);
}

export function stopSessionHeartbeat() {
  clearInterval(_heartbeatTimer);
  _heartbeatTimer = null;
}

// ── Role checks (pure) ───────────────────────────────────────
export function canAccess() { return !!getCurrentUser(); }

export function getRoleVisibility(role, page) {
  if (role === 'ketoan' && ['dashboard', 'doanhthu'].includes(page)) return false;
  return true;
}

// ── initAuth: pure init logic (returns result, no side effects on DOM) ──
export function initAuthState() {
  const users   = loadUsers();
  const session = getCurrentUser();

  if (!users || users.length === 0) {
    setCurrentUser(null);
    return { ok: false, reason: 'no_users' };
  }
  if (!session) {
    setCurrentUser(null);
    return { ok: false, reason: 'no_session' };
  }
  const user = users.find(u =>
    String(u.id) === String(session.id) || u.username === session.username
  );
  if (!user) {
    setCurrentUser(null);
    return { ok: false, reason: 'user_not_found' };
  }
  if ((user.sessionVersion || 1) !== (session.sessionVersion || 1)) {
    setCurrentUser(null);
    return { ok: false, reason: 'session_version_mismatch' };
  }
  setCurrentUser(user);
  return { ok: true, user };
}

// ══════════════════════════════════════════════════════════════
//  AUTH UI — DOM wiring (ported from main.js, Prompt 12)
// ══════════════════════════════════════════════════════════════
let currentUser   = null;
let _roleObserver = null;
let _roleTick     = 0;

// ── Login error messages ─────────────────────────────────────
export function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('show', !!msg);
}

export function clearLoginError() {
  showLoginError('');
}

// ── Force logout (DOM side effects) ──────────────────────────
export function forceLogout(reason) {
  setCurrentUser(null);
  stopSessionHeartbeat();
  syncAuthUI();
  applyRoleUI();
  toggleUserDropdown(true);
  if (reason) showLoginError(reason);
}

// ── Sync auth UI with current user state ─────────────────────
export function syncAuthUI() {
  const user = validateCurrentSession() || getCurrentUser();
  currentUser = user;

  const label   = document.getElementById('current-user-label');
  const userBtn = document.getElementById('user-btn');
  const guestBox = document.getElementById('user-guest');
  const authBox  = document.getElementById('user-auth');

  if (label) label.textContent = user ? user.username : 'Đăng nhập';
  if (userBtn) {
    userBtn.classList.toggle('is-authenticated', !!user);
    if (user) {
      userBtn.title = `Tài khoản: ${user.username} (${user.role})`;
      const avatar = document.getElementById('ud-avatar-circle');
      if (avatar) avatar.textContent = user.username.charAt(0).toUpperCase();
    } else {
      userBtn.title = 'Tài khoản';
    }
  }

  if (guestBox) guestBox.style.display = user ? 'none' : 'block';
  if (authBox)  authBox.style.display  = user ? 'block' : 'none';

  if (user) {
    const accountName = document.getElementById('account-current-username');
    const accountRole = document.getElementById('account-current-role');
    if (accountName) accountName.textContent = user.username;
    if (accountRole) accountRole.textContent = user.role;
    const newUsernameField = document.getElementById('account-new-username');
    if (newUsernameField) newUsernameField.value = user.username;
  }

  closeAccountSettings();
}

// ── User dropdown toggle ─────────────────────────────────────
export function toggleUserDropdown(forceOpen, e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const el = document.getElementById('user-dropdown');
  if (!el) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !el.classList.contains('show');

  const yearDd = document.getElementById('year-dropdown');
  if (yearDd) yearDd.classList.remove('open');

  el.classList.toggle('show', shouldOpen);
  el.classList.toggle('hidden', !shouldOpen);

  if (shouldOpen) {
    syncAuthUI();
    clearLoginError();
    if (!getCurrentUser()) {
      setTimeout(() => document.getElementById('login-username')?.focus(), 150);
    }
  }
}

// ── Account settings UI ──────────────────────────────────────
export function openAccountSettings() {
  const mainView     = document.getElementById('ud-main-view');
  const settingsView = document.getElementById('ud-settings-view');
  if (mainView) mainView.style.display = 'none';
  if (settingsView) {
    settingsView.style.display = 'block';
    hideUDError();
    setTimeout(() => document.getElementById('account-old-password')?.focus(), 50);
  }
}

export function closeAccountSettings() {
  const mainView     = document.getElementById('ud-main-view');
  const settingsView = document.getElementById('ud-settings-view');
  if (mainView)     mainView.style.display = 'block';
  if (settingsView) settingsView.style.display = 'none';
  hideUDError();
}

export function showUDError(msg) {
  const err = document.getElementById('ud-settings-error');
  if (err) { err.textContent = msg; err.classList.add('show'); }
}

export function hideUDError() {
  const err = document.getElementById('ud-settings-error');
  if (err) err.classList.remove('show');
}

// ── DOM login/logout handlers ────────────────────────────────
export function doLogin() {
  const username = (document.getElementById('login-username')?.value || '').trim();
  const password = document.getElementById('login-password')?.value || '';
  const ok = login(username, password);
  if (!ok) {
    showLoginError('Sai tên đăng nhập hoặc mật khẩu');
    return false;
  }
  clearLoginError();
  startSessionHeartbeat();
  if (typeof window.manualSync === 'function' && typeof window.fbReady === 'function' && window.fbReady()) {
    setTimeout(() => { try { window.manualSync(); } catch {} }, 0);
  }
  location.reload();
  return true;
}

export function doLogout() {
  logout();
  stopSessionHeartbeat();
  location.reload();
}

// ── Save account settings (DOM handler) ──────────────────────
export async function saveAccountSettings() {
  const user = validateCurrentSession();
  if (!user) return;

  hideUDError();
  const btn = document.getElementById('ud-save-btn');

  const newUsername     = (document.getElementById('account-new-username')?.value || '').trim();
  const oldPassword    = document.getElementById('account-old-password')?.value || '';
  const newPassword    = document.getElementById('account-new-password')?.value || '';
  const confirmPassword = document.getElementById('account-confirm-password')?.value || '';

  if (!newUsername) return showUDError('Tên đăng nhập không được để trống');
  if (!oldPassword) return showUDError('Vui lòng nhập mật khẩu hiện tại');
  if (oldPassword !== user.password) return showUDError('Mật khẩu cũ không chính xác');

  if (newPassword) {
    if (newPassword.length < 4) return showUDError('Mật khẩu mới phải từ 4 ký tự');
    if (newPassword !== confirmPassword) return showUDError('Xác nhận mật khẩu không khớp');
  }

  const users = loadUsers();
  const duplicate = users.find(u => u.username === newUsername && String(u.id) !== String(user.id));
  if (duplicate) return showUDError('Tên đăng nhập đã tồn tại');

  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
  await new Promise(r => setTimeout(r, 600));

  const result = updateUserProfile({ username: newUsername, password: newPassword || null });

  if (btn) { btn.disabled = false; btn.textContent = 'Lưu thay đổi'; }

  if (result && result.ok) {
    if (result.passwordChanged) {
      forceLogout('Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.');
    } else {
      if (typeof window.toast === 'function') window.toast('Cập nhật tài khoản thành công', 'success');
      syncAuthUI();
    }
  }
}

// ── Update user by old username (legacy) ─────────────────────
export function updateUser(oldUsername, data) {
  let users = loadUsers();
  users = users.map(u => {
    if (u.username === oldUsername) {
      return normalizeUserRecord({ ...u, ...data, updatedAt: Date.now() });
    }
    return u;
  });
  saveUsers(users);
}

// ── Show cloud setup message ─────────────────────────────────
export function showCloudSetup() {
  syncAuthUI();
  showLoginError('Vui lòng kết nối Cloud để sử dụng hệ thống');
  toggleUserDropdown(true);
  if (typeof window.openBinModal === 'function') window.openBinModal();
}

// ── Nav permissions ──────────────────────────────────────────
export function applyNavPermissions() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.style.display = canAccess() ? '' : 'none';
  });
}

function _setRoleDisabled(selector, disabled, skip) {
  document.querySelectorAll(selector).forEach(el => {
    if (skip && skip(el)) return;
    if (disabled) {
      el.disabled = true;
      if ('readOnly' in el) el.readOnly = true;
      el.dataset.roleLocked = '1';
    } else if (el.dataset.roleLocked === '1') {
      el.disabled = false;
      if ('readOnly' in el) el.readOnly = false;
      el.dataset.roleLocked = '0';
    }
  });
}

export function applyRoleUI() {
  const loggedIn = !!getCurrentUser();
  document.body.classList.toggle('auth-guest', !loggedIn);
  applyNavPermissions();
  if (!loggedIn) return;

  const lock = isGiamdoc();
  _setRoleDisabled(
    '#sub-nhap-hd input, #sub-nhap-hd select, #sub-nhap-hd textarea, #sub-nhap-hd button',
    lock,
    el => el.classList.contains('inner-sub-btn') || el.classList.contains('sub-nav-btn')
  );
  _setRoleDisabled(
    '#page-chamcong > .section-header:first-of-type button, #page-chamcong > .entry-date-bar input, #page-chamcong > .entry-date-bar select, #page-chamcong > .entry-date-bar button, #page-chamcong > .entry-table-wrap .add-row-bar button, #cc-tbody input, #cc-tbody button, #cc-tbody select, #cc-tbody textarea',
    lock
  );
  _setRoleDisabled(
    '#page-thietbi > .section-header:first-of-type button, #thietbi-form input, #thietbi-form button, #thietbi-form select, #thietbi-form textarea',
    lock
  );

  const user = getCurrentUser();
  if (!user) return;
  const role = user.role;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const page = btn.dataset.page;
    let visible = true;
    if (role === 'ketoan') {
      if (['dashboard', 'doanhthu'].includes(page)) visible = false;
    }
    btn.style.display = visible ? '' : 'none';
  });
}

export function queueApplyRoleUI() {
  if (_roleTick) cancelAnimationFrame(_roleTick);
  _roleTick = requestAnimationFrame(() => {
    _roleTick = 0;
    applyRoleUI();
  });
}

export function startRoleObserver() {
  if (_roleObserver) return;
  const content = document.querySelector('.content');
  if (!content || !window.MutationObserver) return;
  _roleObserver = new MutationObserver(() => queueApplyRoleUI());
  _roleObserver.observe(content, { childList: true, subtree: true });
}

// ── initAuth (full DOM version) ──────────────────────────────
export function initAuth() {
  const users   = loadUsers();
  const session = getCurrentUser();

  if (!users || users.length === 0) {
    currentUser = null;
    syncAuthUI();
    applyRoleUI();
    showCloudSetup();
    return false;
  }

  if (!session) {
    currentUser = null;
    syncAuthUI();
    applyRoleUI();
    toggleUserDropdown(true);
    return false;
  }

  const user = users.find(u => String(u.id) === String(session.id) || u.username === session.username);
  if (!user) {
    setCurrentUser(null);
    syncAuthUI();
    applyRoleUI();
    toggleUserDropdown(true);
    showLoginError('Tài khoản không còn tồn tại');
    return false;
  }

  if ((user.sessionVersion || 1) !== (session.sessionVersion || 1)) {
    forceLogout('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
    return false;
  }

  setCurrentUser(user);
  syncAuthUI();
  applyRoleUI();
  startSessionHeartbeat();
  toggleUserDropdown(false);
  return true;
}

// ── afterSync — post-sync handler ────────────────────────────
export function afterSync() {
  const users = loadUsers();
  if (users && users.length > 0) {
    const session = getCurrentUser();
    if (!session) {
      showLoginError('Vui lòng đăng nhập để sử dụng hệ thống');
      toggleUserDropdown(true);
      return;
    }
    const user = users.find(u => String(u.id) === String(session.id) || u.username === session.username);
    if (!user || (user.sessionVersion || 1) !== (session.sessionVersion || 1)) {
      forceLogout('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.');
      return;
    }
    setCurrentUser(user);
    startSessionHeartbeat();
    syncAuthUI();
  }
}

// ── trySyncUsersBeforeAuth ───────────────────────────────────
export async function trySyncUsersBeforeAuth() {
  const users = loadUsers();
  if (users && users.length > 0) return;
  if (typeof window.fbReady !== 'function' || !window.fbReady()) return;
  if (typeof window.pullChanges !== 'function') return;

  await new Promise(resolve => window.pullChanges(null, () => resolve(), { silent: true }));
  if (typeof window._reloadGlobals === 'function') window._reloadGlobals();
  afterSync();
}

// ── manualSync wrapper ───────────────────────────────────────
export function wrapManualSync() {
  if (typeof window.manualSync === 'function' && !window.manualSync.__authWrapped) {
    const _orig = window.manualSync;
    window.manualSync = async function (...args) {
      const result = await _orig.apply(this, args);
      afterSync();
      return result;
    };
    window.manualSync.__authWrapped = true;
  }
}

// ── Click outside handler ────────────────────────────────────
export function initClickOutsideHandler() {
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('user-dropdown');
    const userBtn  = document.getElementById('user-btn');
    if (dropdown && dropdown.classList.contains('show')) {
      if (!dropdown.contains(e.target) && userBtn && !userBtn.contains(e.target)) {
        toggleUserDropdown(false);
      }
    }
  });
}

// ── Visibility change handler ────────────────────────────────
export function initVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const session = getCurrentUser();
    if (!session) return;
    const users = loadUsers();
    const idx = users.findIndex(u => String(u.id) === String(session.id));
    if (idx < 0) return;
    users[idx] = {
      ...users[idx],
      sessions: touchUserSession(users[idx], true),
      updatedAt: Math.max(users[idx].updatedAt || 0, Date.now())
    };
    saveUsers(users);
    setCurrentUser(users[idx]);
  });
}

// ══════════════════════════════════════════════════════════════
// 🔌 WINDOW BRIDGES
// ══════════════════════════════════════════════════════════════
window._authModule = {
  USER_KEY, USER_SESSION_KEY, USER_DEVICE_KEY,
  getDeviceId, safeSessions, normalizeUserRecord, normalizeUsersArray, mergeUsers,
  loadUsers, saveUsers, ensureDefaultUsers,
  getCurrentUser, setCurrentUser, isAdmin, isKetoan, isGiamdoc,
  touchUserSession, validateCurrentSession,
  login, logout, updateUserProfile,
  startSessionHeartbeat, stopSessionHeartbeat,
  canAccess, getRoleVisibility, initAuthState,
  // UI functions (Prompt 12)
  syncAuthUI, toggleUserDropdown, showLoginError, clearLoginError,
  openAccountSettings, closeAccountSettings, showUDError, hideUDError,
  doLogin, doLogout, saveAccountSettings, updateUser, showCloudSetup,
  forceLogout, applyNavPermissions, applyRoleUI, queueApplyRoleUI,
  startRoleObserver, initAuth, afterSync, trySyncUsersBeforeAuth,
};

// Direct window globals for HTML onclick handlers
window.getCurrentUser       = getCurrentUser;
window.setCurrentUser       = setCurrentUser;
window.isAdmin              = isAdmin;
window.isKetoan             = isKetoan;
window.isGiamdoc            = isGiamdoc;
window.loadUsers            = loadUsers;
window.saveUsers            = saveUsers;
window.ensureDefaultUsers   = ensureDefaultUsers;
window.getDeviceId          = getDeviceId;
window.mergeUsers           = mergeUsers;
window.normalizeUsersArray  = normalizeUsersArray;
window.normalizeUserRecord  = normalizeUserRecord;

window.syncAuthUI           = syncAuthUI;
window.toggleUserDropdown   = toggleUserDropdown;
window.openAccountSettings  = openAccountSettings;
window.closeAccountSettings = closeAccountSettings;
window.doLogin              = doLogin;
window.logout               = doLogout;
window.saveAccountSettings  = saveAccountSettings;
window.updateUser           = updateUser;
window.showCloudSetup       = showCloudSetup;
window.forceLogout          = forceLogout;
window.applyNavPermissions  = applyNavPermissions;
window.applyRoleUI          = applyRoleUI;
window.queueApplyRoleUI     = queueApplyRoleUI;
window.startRoleObserver    = startRoleObserver;
window.initAuth             = initAuth;
window.afterSync            = afterSync;
window.canAccess            = canAccess;
window.showLoginError       = showLoginError;
window.clearLoginError      = clearLoginError;
window.validateCurrentSession = validateCurrentSession;

console.log('[auth.module] ES Module loaded ✅');
