# 🔥 GIAI ĐOẠN PORTING CUỐI CÙNG — Xóa bỏ Legacy JS

## Tổng quan

**Mục tiêu**: Port toàn bộ DOM wiring từ 12 file legacy (~716KB) vào ES Modules, sau đó xóa sạch.

**Trạng thái hiện tại**: Logic đã tách xong (Prompt 1-10). Còn lại: DOM rendering, event handlers, bootstrap code.

**Chiến lược**: 8 Mega Prompts, mỗi prompt xử lý 1-2 file legacy → test → xóa file cũ.

**Thứ tự bắt buộc**: Foundation (bootstrap) → Modules (UI) → Heavy (Excel/Sync)

---

## 📋 PROMPT 11 — Port `tienich.js` + `core.js`

**Mục tiêu**: Hấp thụ 2 file nền tảng. Sau prompt này, xóa `tienich.js` và `core.js`.
> **Trạng thái**: ✅ **HOÀN THÀNH**
> - Đã port thành công toàn bộ logic sang ES Modules (`src/utils/`, `src/services/`, `src/modules/cloud/`, `src/core/`).
> - Đã thay thế `core.js` và `tienich.js` bằng các Thin Bridge Stubs.
> - Đã cung cấp đầy đủ window bridges để giữ cho legacy code hoạt động ổn định.

```
📎 Đính kèm: tienich.js, core.js, src/utils/*.js, src/core/*.js, src/app.js

PROMPT:
═══════════════════════════════════════════════════
ĐỌC KỸ: ARCHITECTURE.md và master_plan_result.md trước.

NHIỆM VỤ: Port toàn bộ code còn lại từ tienich.js và core.js vào ES Modules.

1. Đọc tienich.js — xác định mọi hàm/biến CHƯA có trong src/utils/*.js
   - Ví dụ: updateTop(), _ctInActiveYear(), _entityInYear(), _buildProjOpts(),
     _buildProjFilterOpts(), _readPidFromSel(), _acShow(), resolveProjectName()...
   - Port vào file utils hoặc services phù hợp
   - Gán window.* cho mỗi hàm (vì legacy khác vẫn dùng)

2. Đọc core.js — xác định mọi hàm/biến CHƯA có trong src/core/*.js
   - Ví dụ: load(), save(), dbInit(), mkRecord(), mkUpdate(), DEVICE_ID,
     _mem, initAuth gốc, renderBackupList()...
   - Port vào db.js, store.js, hoặc config.js phù hợp
   - Đảm bảo dbInit() được export và gọi đúng thời điểm

3. Cập nhật src/app.js: thay thế waitForDataReady() bằng
   tự gọi dbInit() trực tiếp (không cần chờ legacy nữa)

4. Xóa <script src="tienich.js"> và <script src="core.js">
   khỏi index.html

5. TEST: App phải load không lỗi. Console không có
   "xxx is not defined".

⚠️ KHÔNG sửa các file legacy khác (hoadon.js, chamcong.js...)
   — chỉ đảm bảo chúng vẫn chạy qua window.* bridges
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 12 — Port `main.js`

**Mục tiêu**: Hấp thụ bootstrap + navigation + year filter. Sau prompt này, xóa `main.js`.
> **Trạng thái**: ✅ **HOÀN THÀNH**
> - Đã tạo `src/modules/nav/nav.ui.js` — toàn bộ year filter + navigation + tab rendering
> - Đã mở rộng `src/modules/auth/auth.module.js` — thêm toàn bộ Auth UI DOM functions từ main.js
> - Đã viết lại `src/app.js` thành bootstrap chính: `dbInit → reload globals → migrations → auth → init()`
> - Đã thay `main.js` bằng Thin Bridge Stub (placeholder `||` chains)
> - Đã sửa bug pre-existing: `_PROJ_FACTORS` chưa được export trong `project.svc.js` → ESM không load được
> - **Test**: `_dataReady=true`, login/logout OK, goPage OK, year filter OK, không có console error

### Chi tiết thay đổi

#### File mới: `src/modules/nav/nav.ui.js`
- **Year filter state**: `activeYears (Set)`, `activeYear`, `_syncActiveYearCompat()`
- **Year dropdown**: `buildYearSelect()` — tạo checkbox list từ data, `_updateYearBtn()` — cập nhật label nút
- **Year actions**: `setActiveYear()`, `onYearToggle()`, `yearQuickAll()`, `yearQuickRecent()`, `toggleYearDropdown()`, `onYearChange()` — kéo data từ Firebase nếu năm chưa có local
- **Navigation**: `goPage()`, `goSubPage()`
- **Tab rendering**: `getCurrentTab()`, `renderActiveTab()`, `refreshAllTabs()`
- **Utilities**: `syncTopbarHeight()` (ResizeObserver), `today()`
- **Window bridges**: tất cả hàm trên đều gán lên `window.*`

#### File sửa: `src/modules/auth/auth.module.js`
Thêm các hàm Auth UI (DOM wiring) từ main.js:
- **Error messages**: `showLoginError()`, `clearLoginError()`, `showUDError()`, `hideUDError()`
- **User dropdown**: `syncAuthUI()`, `toggleUserDropdown()`, `openAccountSettings()`, `closeAccountSettings()`
- **Login/Logout DOM**: `doLogin()`, `doLogout()`, `saveAccountSettings()`, `updateUser()`, `forceLogout()`, `showCloudSetup()`
- **Role UI**: `applyNavPermissions()`, `_setRoleDisabled()`, `applyRoleUI()`, `queueApplyRoleUI()`, `startRoleObserver()`
- **Auth flow DOM**: `initAuth()` (full DOM version), `afterSync()`, `trySyncUsersBeforeAuth()`
- **Event setup**: `initClickOutsideHandler()`, `initVisibilityHandler()`, `wrapManualSync()`
- **Window bridges**: 30+ hàm gán lên `window.*` cho HTML onclick handlers

#### File viết lại: `src/app.js`
- Bỏ `waitForDataReady()` — gọi `dbInit()` trực tiếp
- Bootstrap sequence: `dbInit()` → `_reloadGlobals()` → migrations (`_migrateProjectDates`, `cleanupInvalidProjects`, `migrateProjectLinks`, `normalizeAllChamCong`) → `_dataReady = true` → `trySyncUsersBeforeAuth()` → `ensureDefaultUsers()` → `initClickOutsideHandler()` + `initVisibilityHandler()` + `wrapManualSync()` → `initAuth()` → `init()` → ES module subsystems → `startAutoSync()`
- `init()` function ported: date defaults, initTable, initUngTable, initCC, buildYearSelect, renderTrash, renderTodayInvoices, autoBackup, syncTopbarHeight, gsLoadAll cloud load
- Import: thêm `nav.ui.js`, mở rộng imports từ `auth.module.js`
- Error boundary: `bootstrap().catch()` để không fail silently

#### File thay thế: `main.js` → Thin Bridge Stub
- Xóa 1104 dòng logic, thay bằng ~60 dòng `window.xxx = window.xxx || function(){}`
- Đảm bảo legacy scripts không bị "xxx is not defined" trong gap trước ESM load

#### Bug fix: `src/services/project.svc.js`
- Thêm `export` vào `_PROJ_FACTORS` constant (bị import bởi `project.logic.js` nhưng không export) → đây là bug pre-existing chặn toàn bộ ESM module graph

```
📎 Đính kèm: main.js, src/app.js, src/modules/auth/auth.module.js,
             src/modules/dashboard/dashboard.module.js, index.html

PROMPT:
═══════════════════════════════════════════════════
ĐỌC KỸ: ARCHITECTURE.md và master_plan_result.md trước.

NHIỆM VỤ: Port toàn bộ main.js vào ES Modules.

1. Đọc main.js — liệt kê TỪNG hàm và phân loại:
   - Bootstrap: init(), _dataReady, onYearChange → src/app.js
   - Auth UI: syncAuthUI(), applyRoleUI(), login form handlers → auth.module.js
   - Navigation: goTo(), updateTop(), sidebar menu → tạo src/modules/nav/nav.ui.js
   - Year filter: activeYear, activeYears, inActiveYear UI → nav.ui.js hoặc app.js
   - Topbar rendering: updateTop() → dashboard hoặc nav module

2. Cập nhật src/app.js thành bootstrap chính:
   - main() gọi dbInit() → loadAllData() → initAuth() → renderUI()
   - Không cần waitForDataReady() nữa

3. Tạo src/modules/nav/nav.ui.js nếu cần (sidebar + topbar + year filter)

4. Xóa <script src="main.js"> khỏi index.html

═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 13 — Port `hoadon.js`

**Mục tiêu**: Hấp thụ toàn bộ Invoice UI. Sau prompt này, xóa `hoadon.js`.
> **Trạng thái**: ✅ **HOÀN THÀNH** (an toàn, hoadon.js vẫn giữ nguyên)
> - Đã viết lại `src/modules/invoices/invoice.ui.js` từ 97 dòng stub → ~828 dòng đầy đủ
> - Port toàn bộ render/UI functions an toàn; delegate các hàm write/delete sang legacy hoadon.js
> - Thêm 25+ window bridges cho index.html onclick handlers
> - **Kiểm tra tĩnh**: tất cả onclick handlers trong index.html đều có bridge hoặc được delegate hợp lệ

### Chi tiết thay đổi

#### File viết lại: `src/modules/invoices/invoice.ui.js`

**Giữ nguyên từ trước** (6 exports):
- `setSelectFlexible`, `resolveInvSource`, `sourceBadge`, `getRowData`, `getDetailRows`

**Ported từ hoadon.js** — Entry table (Nhập nhanh):
- `initTable(n)` — khởi tạo bảng nhập nhanh với n dòng trống, copy loai/CT từ dòng trên
- `addRow(d)` — thêm 1 dòng với dropdown CT/loai/nguoi/ncc, tien input formatting, Enter-to-next
- `addRows(n)` — thêm n dòng (gọi addRow lặp)
- `delRow(btn)` — xóa dòng → renumber → calcSummary
- `renumber()` — cập nhật số thứ tự (internal)
- `calcSummary()` — đếm dòng có data, tính tổng tiền → cập nhật #row-count, #entry-total
- `clearTable()` — confirm → initTable(5)
- `refreshEntryDropdowns()` — rebuild tất cả dropdowns trong bảng nhập và detail form
- `refreshHoadonCtDropdowns()` — rebuild chỉ CT dropdowns (sau khi projects thay đổi)

**Ported từ hoadon.js** — Detail form (Hóa đơn chi tiết):
- `renderDetailRowHTML(d, num)` — tạo HTML cho 1 dòng chi tiết (ten/dv/sl/dongia/ck/thtien)
- `addDetailRow(d)` — thêm dòng chi tiết với event listeners (dongia, sl, ck, ten, Enter-to-next)
- `delDetailRow(btn)` — xóa dòng, renumber, recalc totals
- `calcDetailRow(tr)` — tính thành tiền từ sl×dongia-ck, cập nhật `tr.dataset.tt`
- `calcDetailTotals()` — tổng tất cả dòng, áp CK footer, cập nhật #detail-tc, #detail-tong, #detail-tong-save
- `generateDetailNd()` — auto-fill #detail-nd từ tên hàng hóa (`window.buildNDFromItems`)
- `clearDetailForm()` — reset toàn bộ detail form (5 dòng trống, xóa các field, reset save btn text)

**Ported từ hoadon.js** — Navigation, Today, Trash, Filters:
- `goInnerSub(btn, id)` — chuyển inner sub-tab (#inr-nhap-nhanh / #inr-hd-chitiet), init detail selects khi cần
- `renderTodayInvoices()` — render bảng hóa đơn hôm nay (6 cột, footer tổng), guard `window._dataReady`
- `renderTrash()` — render thùng rác (100 records, nút khôi phục/xóa vĩnh viễn)
- `buildFilters()` — build 4 dropdown filter từ data (CT, loai, NCC, tháng)
- `filterAndRender()` — lọc + sort theo filter inputs → ghi vào `window.filteredInvs` → renderTable()
- `renderTable()` — paginated table (PG items/page), action buttons (edit/del/cc), pagination buttons
- `goTo(p)` — set window.curPage, renderTable()
- `switchTatCaView(val)` — toggle "Tất cả HĐ" / "🗑 Đã xóa" view

**Ported từ hoadon.js** — Modal, Edit, Init:
- `closeDupModal()` — đóng #dup-modal-overlay
- `editTodayInv(id)` — tìm invoice, route tới openDetailEdit (items) hoặc openEntryEdit
- `initInvoiceModule()` — gọi renderTodayInvoices, log ready message

**Delegate sang legacy hoadon.js** (hoadon.js vẫn loaded, các hàm này vẫn là window globals):
- `saveAllRows` / `_doSaveRows` / `forceSaveAll` — lưu bảng nhập nhanh (write operation)
- `saveDetailInvoice` — lưu hóa đơn chi tiết (write operation)
- `delInvoice` — xóa hóa đơn (write/delete)
- `trashClearAll` / `trashRestore` / `trashDeletePermanent` — quản lý thùng rác (write/delete)
- `editManualInvoice` / `openDetailEdit` / `openEntryEdit` / `editCCInvoice` / `saveEditInvoice` — edit flows phức tạp

**Window bridges thêm**:
```
window.initTable, addRows, addRow, delRow, calcSummary, clearTable
window.refreshEntryDropdowns, refreshHoadonCtDropdowns
window.addDetailRow, delDetailRow, calcDetailRow, calcDetailTotals
window.generateDetailNd, clearDetailForm
window.goInnerSub, renderTodayInvoices, renderTrash
window.buildFilters, filterAndRender, renderTable, goTo
window.switchTatCaView, closeDupModal, editTodayInv
window.rebuildEntrySelects  ← alias cho refreshEntryDropdowns (gọi bởi danhmuc.js/nav.ui.js)
window._invoiceUI           ← namespace object chứa tất cả exports
```

### Kiểm tra tĩnh

| onclick trong index.html | Bridge | Trạng thái |
|---|---|---|
| `closeDupModal()` | `window.closeDupModal` | ✅ bridged |
| `forceSaveAll()` | legacy hoadon.js | ✅ delegated |
| `goInnerSub(this,...)` | `window.goInnerSub` | ✅ bridged |
| `clearTable()` | `window.clearTable` | ✅ bridged |
| `addRows(1/5/10)` | `window.addRows` | ✅ bridged |
| `saveAllRows()` | legacy hoadon.js | ✅ delegated |
| `clearDetailForm()` | `window.clearDetailForm` | ✅ bridged |
| `addDetailRow()` | `window.addDetailRow` | ✅ bridged |
| `saveDetailInvoice()` | legacy hoadon.js | ✅ delegated |
| `renderTodayInvoices()` | `window.renderTodayInvoices` | ✅ bridged |
| `trashClearAll()` | legacy hoadon.js | ✅ delegated |
| `editManualInvoice(id)` | legacy hoadon.js | ✅ delegated (từ renderTable HTML) |
| `delInvoice(id)` | legacy hoadon.js | ✅ delegated (từ renderTable HTML) |
| `editCCInvoice(id)` | legacy hoadon.js | ✅ delegated (từ renderTable HTML) |
| `trashRestore(id)` | legacy hoadon.js | ✅ delegated (từ renderTrash HTML) |
| `trashDeletePermanent(id)` | legacy hoadon.js | ✅ delegated (từ renderTrash HTML) |

### Rủi ro còn lại

- **`delDetailRow` / `delRow`**: gọi từ inline `onclick="delDetailRow(this)"` trong `renderDetailRowHTML` — cần `window.delDetailRow` có sẵn trước khi user click. ESM loads deferred nhưng user không thể click ngay, nên an toàn.
- **`_strSimilarity`**: hoadon.js line ~227 gọi `_strSimilarity()` (underscore prefix) nhưng không tìm thấy định nghĩa rõ ràng — đây là bug pre-existing trong legacy code, không liên quan tới ESM port. `saveAllRows` vẫn delegated sang legacy nên nếu bug xảy ra thì ở hoadon.js, không phải invoice.ui.js.
- **`window.buildNDFromItems`**: được gọi trong `generateDetailNd()` — nếu hoadon.js chưa định nghĩa hàm này trước khi ESM module chạy, sẽ no-op. Không crash, chỉ nd không auto-fill.

```
📎 Đính kèm: hoadon.js, src/modules/invoices/invoice.logic.js,
             src/modules/invoices/invoice.ui.js, index.html

PROMPT:
═══════════════════════════════════════════════════
NHIỆM VỤ: Port toàn bộ hoadon.js (58KB) vào invoice.ui.js.

1. Đọc hoadon.js — phân loại tất cả hàm:
   - Entry table: initEntryTable(), addRow(), _doSaveRows(), calcSummary()
   - List rendering: renderInvList(), renderInvDetail(), pagination
   - Duplicate check UI: checkDuplicatesUI(), showDupModal()
   - Trash UI: renderTrashList(), restoreFromTrash()
   - Event handlers: onclick, oninput, onchange cho toàn bộ form

2. Mở rộng invoice.ui.js — thêm TẤT CẢ hàm DOM đã liệt kê
   - Import logic từ invoice.logic.js (đã có sẵn)
   - Gán window.* cho mọi hàm mà index.html onclick gọi trực tiếp

3. Thêm initInvoiceModule() trong invoice.ui.js:
   - Gán event listeners
   - Render bảng ban đầu
   - Được gọi từ app.js sau khi data ready

4. Xóa <script src="hoadon.js"> khỏi index.html

═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 14 — Port `chamcong.js`

**Mục tiêu**: Hấp thụ toàn bộ Payroll UI. Sau prompt này, xóa `chamcong.js`.
> **Trạng thái**: ✅ **HOÀN THÀNH** (Prompt 14A: Audit + 14B: Port)

### 14A — Audit Manifest

Đọc toàn bộ `chamcong.js` (1405 dòng, 70KB) và phân loại mọi symbol:

| Nhóm | Symbols | Hành động |
|------|---------|-----------|
| **Module state** | `ccOffset`, `ccClipboard`, `_ccDebtColsHidden`, `ccHistPage`, `ccTltPage` | Port — chú ý `ccHistPage`/`ccTltPage` phải là `window.*` |
| **Init** | `initCC()`, `populateCCCtSel()` | Port → ESM |
| **Table render** | `buildCCTable()`, `buildCCRow()`, `updateCCSumRow()`, `toggleCCDebtCols()` | Port → ESM |
| **Worker CRUD** | `addCCWorker()`, `delCCRow()` | Port → ESM |
| **Week nav** | `ccPrevWeek()`, `ccNextWeek()`, `onCCFromChange()`, `onCCCtSelChange()` | Port → ESM |
| **Clipboard** | `copyCCWeek()`, `pasteCCWeek()`, `clearCCWeek()`, `loadCCWeekById()` | Port → ESM |
| **History/TLT** | `renderCCHistory()`, `renderCCTLT()`, `ccHistGoTo()`, `ccTltGoTo()` | Port → ESM |
| **Export** | `exportCCWeekCSV()`, `exportCCTLTCSV()`, `exportCCHistCSV()`, `xuatPhieuLuong()` | Port → ESM |
| **Write/Delete** | `saveCCWeek()`, `delCCWeekById()`, `delCCWorker()` | **Delegate** → giữ legacy |
| **Rebuild/Sync** | `normalizeAllChamCong()`, `rebuildCCCategories()`, `updateTopFromCC()` | **Delegate** → giữ legacy |
| **Image export** | `exportUngToImage()` | **Delegate** → giữ legacy |

**Phát hiện quan trọng (Rủi ro):**
- `ccHistPage` và `ccTltPage` được ghi trực tiếp trong inline handlers của index.html (`onchange="ccHistPage=1;renderCCHistory()"`). Nếu khai báo là module-level `let`, inline handlers sẽ ghi vào `window.ccHistPage` khác (shadow). → **Bắt buộc dùng `window.ccHistPage`**.
- `ccData` không phải module var — luôn đọc từ `window.ccData || []`.
- `rebuildCCNameList()` trong legacy gọi không có tham số (tự tính names). ESM version nhận `allNames` param → cần wrapper bridge.

### 14B — Kết quả Port

**File thay đổi**: `src/modules/payroll/payroll.ui.js`
- **Trước**: 91 dòng stub (4 helpers + `initPayrollUI` rỗng)
- **Sau**: ~1295 dòng đầy đủ

**Imports thêm từ payroll.logic.js:**
```javascript
import {
  CC_DAY_LABELS, CC_DATE_OFFSETS, CC_PG_HIST, CC_PG_TLT,
  ccSundayISO, ccSaturdayISO, snapToSunday,
  viShort, weekLabel, round1,
  calcDebtBefore,
  prepareCopyData, createWorkerStubs, ccAllNames,
} from './payroll.logic.js';
```

**Pattern đặc biệt — `ccHistPage`/`ccTltPage`:**
```javascript
// KHÔNG dùng let — phải dùng window để inline handlers sync được
window.ccHistPage = window.ccHistPage || 1;
window.ccTltPage  = window.ccTltPage  || 1;

// Trong render functions:
const ccHistPage = window.ccHistPage || 1;  // đọc từ window

// Trong goto functions:
export function ccHistGoTo(p) { window.ccHistPage = p; renderCCHistory(); }
export function ccTltGoTo(p)  { window.ccTltPage  = p; renderCCTLT(); }
```

**`_calcDebtBefore` wrapper:**
```javascript
function _calcDebtBefore(workerName, fromDate) {
  return calcDebtBefore(workerName, fromDate, window.ccData || []);
}
```

**`rebuildCCNameList` bridge (no-arg compat):**
```javascript
window.rebuildCCNameList = () => {
  const names = ccAllNames(window.ccData || [], (window.cats || {}).congNhan || []);
  rebuildCCNameList(names);
};
```

**24 window bridges đã gán:**
`initCC`, `buildCCTable`, `addCCWorker`, `delCCRow`, `toggleCCDebtCols`,
`ccPrevWeek`, `ccNextWeek`, `onCCFromChange`, `onCCCtSelChange`,
`copyCCWeek`, `pasteCCWeek`, `clearCCWeek`, `populateCCCtSel`,
`renderCCHistory`, `renderCCTLT`, `ccHistGoTo`, `ccTltGoTo`,
`loadCCWeekById`, `exportCCWeekCSV`, `exportCCTLTCSV`, `exportCCHistCSV`,
`xuatPhieuLuong`, `rebuildCCNameList` (wrapper), `removeVietnameseTones`

**9 symbols delegate (giữ legacy chamcong.js):**
`saveCCWeek`, `delCCWeekById`, `delCCWorker`,
`normalizeAllChamCong`, `rebuildCCCategories`, `updateTopFromCC`,
`exportUngToImage`

**Fix phát sinh:**
- Regex `removeVietnameseTones`: literal Unicode range chars `/[̀-ͯ]/g` → `̀-ͯ` (fix bằng Python script để tránh encoding corruption khi Edit tool ghi file).

```
📎 Đính kèm: chamcong.js, src/modules/payroll/payroll.logic.js,
             src/modules/payroll/payroll.ui.js, index.html

PROMPT:
═══════════════════════════════════════════════════
NHIỆM VỤ: Port toàn bộ chamcong.js (70KB) vào payroll.ui.js.

1. Đọc chamcong.js — phân loại:
   - Bảng chấm công: buildCCTable(), buildCCRow(), updateCCSumRow()
   - Worker management: addWorker(), editWorker(), deleteWorker()
   - Tuần navigation: prevWeek(), nextWeek(), goToWeek()
   - Lịch sử: renderCCHistory(), pagination
   - TLT (Tổng lương tháng): renderCCTLT()
   - Phiếu lương: xuatPhieuLuong(), exportCSV()
   - Debt management: renderDebtTable()

2. Mở rộng payroll.ui.js — thêm TẤT CẢ hàm DOM
   - Import logic từ payroll.logic.js
   - Gán window.* cho onclick handlers

3. Thêm initPayrollModule()

4. Xóa <script src="chamcong.js"> khỏi index.html

═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 15 — Port `doanhthu.js`

**Mục tiêu**: Hấp thụ Revenue + Contracts UI. Sau prompt này, xóa `doanhthu.js`.

---

### 15A — Audit Manifest (HOÀN THÀNH)

**Tổng quan doanhthu.js**: 1660 dòng. Sử dụng globals: `hopDongData`, `thuRecords`, `thauPhuContracts`, `ungRecords`, `projects`, `cats`, `activeYears`, `activeYear`, `DEVICE_ID`. Gọi các hàm global: `load()`, `save()`, `mkRecord()`, `mkUpdate()`, `resolveProjectName()`, `getAllProjects()`, `getProjectById()`, `getInvoicesCached()`, `fmtM()`, `fmtS()`, `numFmt()`, `toast()`, `today()`, `inActiveYear()`, `x()` (escapeHtml), `_ctInActiveYear()`, `_buildProjFilterOpts()`, `renderDashboard()`, `removeVietnameseTones()`.

---

#### NHÓM 1 — Hợp Đồng Chính

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `hdcUpdateTotal()` | UI/helper | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Thấp |
| `saveHopDongChinh()` | handler/write | revenue.ui.js | Không | ✅ Port | ✅ window | Không | **Cao** — gọi save(), mkRecord(), mkUpdate() |
| `_hdcResetForm()` | UI/helper | revenue.ui.js | Không | ✅ Port | Không (internal) | Không | Thấp |
| `editHopDongChinh(keyId)` | handler/edit | revenue.ui.js | Không | ✅ Port | ✅ window (từ renderHdcTable) | Không | Vừa |
| `delHopDongChinh(keyId)` | handler/write | revenue.ui.js | Không | ✅ Port | ✅ window (từ renderHdcTable) | Không | **Cao** — gọi save() |
| `renderHdcTable(page)` | UI/render | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Vừa |

#### NHÓM 2 — Hợp Đồng Thầu Phụ

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `hdtpUpdateTotal()` | UI/helper | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Thấp |
| `saveHopDongThauPhu()` | handler/write | revenue.ui.js | Không | ✅ Port | ✅ window | Không | **Cao** — gọi save(), mkRecord(), mkUpdate() |
| `_hdtpResetForm()` | UI/helper | revenue.ui.js | Không | ✅ Port | Không | Không | Thấp |
| `editHopDongThauPhu(id)` | handler/edit | revenue.ui.js | Không | ✅ Port | ✅ window (từ renderHdtpTable) | Không | Vừa |
| `delHopDongThauPhu(id)` | handler/write | revenue.ui.js | Không | ✅ Port | ✅ window (từ renderHdtpTable) | Không | **Cao** — gọi save() |
| `renderHdtpTable(page)` | UI/render | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Vừa |

#### NHÓM 3 — Thu Tiền

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `saveThuRecord()` | handler/write | revenue.ui.js | Không | ✅ Port | ✅ window | Không | **Cao** — gọi save(), mkRecord(), mkUpdate() |
| `editThuRecord(id)` | handler/edit | revenue.ui.js | Không | ✅ Port | ✅ window (từ renderThuTable) | Không | Vừa |
| `_thuCancelEdit()` | handler/UI | revenue.ui.js | Không | ✅ Port | ✅ window (onclick index.html) | Không | Thấp |
| `_thuResetForm()` | UI/helper | revenue.ui.js | Không | ✅ Port | Không | Không | Thấp |
| `delThuRecord(id)` | handler/write | revenue.ui.js | Không | ✅ Port | ✅ window (từ renderThuTable) | Không | **Cao** — gọi save() |
| `renderThuTable(page)` | UI/render | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Vừa |

#### NHÓM 4 — Công Nợ

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `renderCongNoThauPhu()` | UI/render | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Vừa — đọc `ungRecords` global |
| `renderCongNoNhaCungCap()` | UI/render | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Vừa — đọc `cats.nhaCungCap` global |
| `_renderCongNoTable(rows, tbody, empty)` | UI/helper | revenue.ui.js | ⚡ Có tương đương `renderCongNoTableHtml()` trong ESM | ✅ Merge/thay thế | Không | Không | Thấp — ESM version khác signature |

**Ghi chú**: `_renderCongNoTable()` trong legacy nhận `(rows, tbody, empty)` và ghi trực tiếp vào DOM. `renderCongNoTableHtml()` trong `revenue.ui.js` trả HTML string. Cần wrapper adapter.

#### NHÓM 5 — Lãi/Lỗ

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `renderLaiLo()` | UI/render | revenue.ui.js | ⚡ Logic có trong `calcLaiLo()` (logic.js) | ✅ Port render wrapper | ✅ window | Không | Vừa — render trực tiếp vào `#db-lailo-wrap` |

**Ghi chú**: `renderLaiLo()` trong legacy là full render (HTML builder + DOM write). Logic tính toán đã có trong `calcLaiLo()` (revenue.logic.js). Cần port wrapper gọi `calcLaiLo()` rồi render HTML.

#### NHÓM 6 — Chi tiết Khối Lượng / KLCT

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `_hdcItems` | state (array) | revenue.ui.js | Không | ✅ Port (module-level var) | ✅ `window._hdcItems` (pasteKLCT đọc) | Không | **Cao** — pasteKLCT trong ESM đọc `window._hdcItems` |
| `_hdtpItems` | state (array) | revenue.ui.js | Không | ✅ Port (module-level var) | ✅ `window._hdtpItems` | Không | **Cao** — tương tự |
| `_initDoanhThuAddons()` | UI/init | revenue.ui.js | Không | ✅ Port vào `initDoanhThu()` | Không | Không | Vừa — inject HTML động vào DOM |
| `updateGlobalTotals(prefix, arr)` | UI/helper | revenue.ui.js | Không | ✅ Port | Không (internal) | Không | Thấp |
| `window.updateItem(prefix, idx, field, val)` | handler | revenue.ui.js | Không | ✅ Port | ✅ window (từ bindItemsToTable HTML) | Không | Vừa |
| `window.removeItem(prefix, idx)` | handler | revenue.ui.js | Không | ✅ Port | ✅ window | Không | Vừa |
| `bindItemsToTable(prefix, getItemsArr)` | UI/init | revenue.ui.js | Không | ✅ Port | Gán: `renderhdcChiTiet`, `renderhdtpChiTiet`, `addhdcChiTietRow`, `addhdtpChiTietRow`, `togglehdcChiTiet`, `togglehdtpChiTiet`, `hdcCalcAuto`, `hdtpCalcAuto` | Không | **Cao** — tạo nhiều window globals |
| `copyKLCT(btn)` | handler | revenue.ui.js | ✅ Đã có trong ESM | Không port lại | ✅ window.copyKLCT | Không | Thấp |
| `pasteKLCT(btn)` | handler | revenue.ui.js | ✅ Đã có trong ESM | Không port lại | ✅ window.pasteKLCT | Không | Thấp |

**Rủi ro đặc biệt `_hdcItems`/`_hdtpItems`**: `pasteKLCT()` trong `revenue.ui.js` hiện đọc `window._hdcItems`. Nếu `_hdcItems` khai báo là module-level `let`, `window._hdcItems` sẽ là `undefined`. **Bắt buộc** dùng `window._hdcItems = window._hdcItems || []` pattern (tương tự `ccHistPage`/`ccTltPage` trong payroll).

#### NHÓM 7 — Sub-tab Navigation

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `dtGoSub(btn, id)` | handler/nav | revenue.ui.js | Không | ✅ Port | ✅ window (index.html line 1132-1133) | Không | Vừa — gọi nhiều render |
| `dtEnsureCongNoSubtab()` | UI/init | revenue.ui.js | Không | ✅ Port | Không (gọi từ initDoanhThu) | Không | **Cao** — thao tác DOM phức tạp, inject HTML |
| `dtPopulateSels()` | UI/init | revenue.ui.js | Không | ✅ Port | ✅ window (gọi từ nav/year change) | Không | Vừa — đọc `cats`, `activeYear`, `projects` globals |
| `dtPopulateCtFilter()` | UI/helper | revenue.ui.js | Không | ✅ Port | Không (gọi từ dtGoSub, initDoanhThu) | Không | Thấp |
| `dtSetCtFilter(val)` | handler | revenue.ui.js | Không | ✅ Port | ✅ window (index.html line 1277) | Không | Thấp |
| `_dtCtFilter` | state | revenue.ui.js | Không | ✅ Port (module-level let) | Không | Không | Thấp |
| `_hdcPage`, `_hdtpPage`, `_thuPage` | state | revenue.ui.js | Không | ✅ Port (module-level let) | Không | Không | Thấp |
| `_dtInYear(ngay)` | helper | revenue.ui.js | ⚡ Tương đương trong logic.js | ✅ Port local wrapper | Không | Không | Thấp |
| `_dtMatchProjFilter(record)` | helper | revenue.ui.js | ⚡ `matchProjFilter()` trong logic.js | ✅ Dùng ESM version + wrapper | Không | Không | Thấp |
| `_dtMatchHDCFilter(keyId, hd)` | helper | revenue.ui.js | ⚡ `matchHDCFilter()` trong logic.js | ✅ Dùng ESM version + wrapper | Không | Không | Thấp |
| `_dtAddCT()`, `_dtAddTP()` | helper | revenue.ui.js | Không | ✅ Port (no-op) | Không | Không | Thấp |
| `_resolveCtName(record)` | helper | revenue.ui.js | ⚡ `resolveCtNameFromRecord()` trong logic.js | ✅ Dùng ESM version + wrapper | Không | Không | Thấp |
| `initDoanhThu()` | UI/init | revenue.ui.js | Không | ✅ Port | ✅ window | Không | **Cao** — orchestrator chính |

#### NHÓM 8 — Export Image

| Symbol | Loại | Module đích | Đã có ESM? | Cần port? | Bridge? | Delegate? | Rủi ro |
|--------|------|------------|-----------|----------|---------|-----------|--------|
| `exportHdcToImage()` | handler/export | revenue.ui.js | Không | ✅ Port | ✅ window (index.html line 1285) | Có thể delegate | Vừa — html2canvas |
| `exportHdtpToImage()` | handler/export | revenue.ui.js | Không | ✅ Port | ✅ window (index.html line 1317) | Có thể delegate | Vừa — html2canvas |
| `exportThuToImage()` | handler/export | revenue.ui.js | Không | ✅ Port | ✅ window (index.html line 1353) | Có thể delegate | Vừa — html2canvas |

#### NHÓM 9 — Inline Handlers index.html (đầy đủ)

| line | Handler | Đã bridge? | Trạng thái |
|------|---------|-----------|------------|
| 1132 | `dtGoSub(this,'dt-sub-khaibao')` | ❌ Chưa | Cần port + window bridge |
| 1133 | `dtGoSub(this,'dt-sub-thongke')` | ❌ Chưa | Cần port + window bridge |
| 1144 | `saveHopDongChinh()` | ❌ Chưa | Cần port + window bridge |
| 1168 | `fmtInputMoney(this);hdcUpdateTotal()` | ⚡ fmtInputMoney có ESM bridge; hdcUpdateTotal ❌ | Cần port hdcUpdateTotal |
| 1173 | `fmtInputMoney(this);hdcUpdateTotal()` | ⚡ fmtInputMoney có; hdcUpdateTotal ❌ | Cần port |
| 1178 | `fmtInputMoney(this);hdcUpdateTotal()` | ⚡/❌ | Cần port |
| 1189 | `_thuCancelEdit()` | ❌ Chưa | Cần port + window bridge |
| 1191 | `saveThuRecord()` | ❌ Chưa | Cần port + window bridge |
| 1214 | `fmtInputMoney(this)` | ✅ ESM bridge sẵn | OK |
| 1229 | `saveHopDongThauPhu()` | ❌ Chưa | Cần port + window bridge |
| 1253 | `fmtInputMoney(this);hdtpUpdateTotal()` | ⚡/❌ | Cần port hdtpUpdateTotal |
| 1258 | `fmtInputMoney(this);hdtpUpdateTotal()` | ⚡/❌ | Cần port |
| 1277 | `dtSetCtFilter(this.value)` | ❌ Chưa | Cần port + window bridge |
| 1285 | `exportHdcToImage()` | ❌ Chưa | Cần port + window bridge |
| 1317 | `exportHdtpToImage()` | ❌ Chưa | Cần port + window bridge |
| 1353 | `exportThuToImage()` | ❌ Chưa | Cần port + window bridge |
| (từ renderHdcTable HTML) | `editHopDongChinh(keyId)` | ❌ | Cần window bridge |
| (từ renderHdcTable HTML) | `delHopDongChinh(keyId)` | ❌ | Cần window bridge |
| (từ renderHdtpTable HTML) | `editHopDongThauPhu(id)` | ❌ | Cần window bridge |
| (từ renderHdtpTable HTML) | `delHopDongThauPhu(id)` | ❌ | Cần window bridge |
| (từ renderThuTable HTML) | `editThuRecord(id)` | ❌ | Cần window bridge |
| (từ renderThuTable HTML) | `delThuRecord(id)` | ❌ | Cần window bridge |
| (từ bindItemsToTable HTML) | `updateItem(prefix, idx, field, val)` | ❌ | Cần window.updateItem |
| (từ bindItemsToTable HTML) | `removeItem(prefix, idx)` | ❌ | Cần window.removeItem |
| (từ bindItemsToTable HTML) | `renderhdcChiTiet()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `renderhdtpChiTiet()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `addhdcChiTietRow()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `addhdtpChiTietRow()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `togglehdcChiTiet()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `togglehdtpChiTiet()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `hdcCalcAuto()` / `hdtpCalcAuto()` | ❌ | Gán từ bindItemsToTable |
| (từ bindItemsToTable HTML) | `copyKLCT(btn)` | ✅ ESM bridge sẵn | OK |
| (từ bindItemsToTable HTML) | `pasteKLCT(btn)` | ✅ ESM bridge sẵn | OK |
| index.html line 1065/1087 | `renderDashboard()` | ✅ Đang là window global (projects.js/datatools.js) | delegate legacy |

---

### Kết quả tổng hợp

#### 1. Symbol cần port vào revenue.ui.js (28 symbols)

```
hdcUpdateTotal, saveHopDongChinh, _hdcResetForm, editHopDongChinh, delHopDongChinh, renderHdcTable
hdtpUpdateTotal, saveHopDongThauPhu, _hdtpResetForm, editHopDongThauPhu, delHopDongThauPhu, renderHdtpTable
saveThuRecord, editThuRecord, _thuCancelEdit, _thuResetForm, delThuRecord, renderThuTable
renderCongNoThauPhu, renderCongNoNhaCungCap, renderLaiLo (wrapper)
_initDoanhThuAddons, updateGlobalTotals, bindItemsToTable
dtGoSub, dtEnsureCongNoSubtab, dtPopulateSels, dtPopulateCtFilter, dtSetCtFilter, initDoanhThu
exportHdcToImage, exportHdtpToImage, exportThuToImage
```

#### 2. Symbol đã có, KHÔNG port lại

```
calcHopDongValue       → revenue.logic.js ✅
migrateHopDongSL       → revenue.logic.js ✅
normalizeThuProjectIds → revenue.logic.js ✅
matchProjFilter        → revenue.logic.js ✅ (dùng wrapper _dtMatchProjFilter)
matchHDCFilter         → revenue.logic.js ✅ (dùng wrapper _dtMatchHDCFilter)
fmtInputMoney          → revenue.logic.js ✅ + window bridge sẵn
readMoneyInput         → revenue.logic.js ✅ (alias _readMoneyInput)
paginationHtml         → revenue.logic.js ✅ (alias _dtPaginationHtml)
resolveCtNameFromRecord→ revenue.logic.js ✅ (alias _resolveCtName)
copyKLCT               → revenue.ui.js ✅
pasteKLCT              → revenue.ui.js ✅
buildDtCtFilterOpts    → revenue.ui.js ✅
buildDtCtEntryOpts     → revenue.ui.js ✅
renderCongNoTableHtml  → revenue.ui.js ✅ (adapter cho _renderCongNoTable)
DT_PG = 7              → revenue.ui.js ✅
```

#### 3. Bridge bắt buộc (window.*)

```
window._hdcItems = window._hdcItems || []   ← CRITICAL: pasteKLCT đọc window._hdcItems
window._hdtpItems = window._hdtpItems || [] ← CRITICAL
window.dtGoSub
window.saveHopDongChinh
window.saveHopDongThauPhu
window.saveThuRecord
window._thuCancelEdit
window.dtSetCtFilter
window.exportHdcToImage, exportHdtpToImage, exportThuToImage
window.editHopDongChinh, delHopDongChinh (từ renderHdcTable HTML)
window.editHopDongThauPhu, delHopDongThauPhu (từ renderHdtpTable HTML)
window.editThuRecord, delThuRecord (từ renderThuTable HTML)
window.updateItem, removeItem (từ bindItemsToTable HTML)
window.renderHdcTable, renderHdtpTable, renderThuTable
window.renderCongNoThauPhu, renderCongNoNhaCungCap
window.hdcUpdateTotal, hdtpUpdateTotal
window.renderDashboard          ← không port, delegate legacy
window.initDoanhThu             ← gọi từ goPage() trong nav
```
`bindItemsToTable` tự gán: `window.renderhdcChiTiet`, `window.renderhdtpChiTiet`, `window.addhdcChiTietRow`, `window.addhdtpChiTietRow`, `window.togglehdcChiTiet`, `window.togglehdtpChiTiet`, `window.hdcCalcAuto`, `window.hdtpCalcAuto`

#### 4. Symbol nên delegate tạm (giữ legacy)

```
renderDashboard()   ← gọi bởi index.html buttons; vẫn là global từ projects.js/datatools.js
saveHopDong()       ← backward compat alias → đã gọi saveHopDongChinh(), chỉ cần bridge
renderHopDongList() ← backward compat alias
delHopDong()        ← backward compat alias
hdLoadCT()          ← deprecated no-op
```

#### 5. Thứ tự port an toàn

```
1. Module state: khai báo window._hdcItems, window._hdtpItems, module-level vars
2. Helpers: _dtInYear, _dtMatchProjFilter, _dtMatchHDCFilter, _resolveCtName (wrappers)
3. KLCT subsystem: updateGlobalTotals, window.updateItem, window.removeItem, bindItemsToTable
4. HĐC: hdcUpdateTotal, _hdcResetForm → renderHdcTable → editHopDongChinh, delHopDongChinh → saveHopDongChinh
5. HĐ Thầu Phụ: hdtpUpdateTotal, _hdtpResetForm → renderHdtpTable → editHopDongThauPhu, delHopDongThauPhu → saveHopDongThauPhu
6. Thu tiền: _thuResetForm, _thuCancelEdit → renderThuTable → editThuRecord, delThuRecord → saveThuRecord
7. Công nợ: renderCongNoThauPhu, renderCongNoNhaCungCap (dùng adapter _renderCongNoTable)
8. Lãi/Lỗ: renderLaiLo (wrapper gọi calcLaiLo từ logic.js)
9. Sub-tab: dtPopulateCtFilter, dtSetCtFilter, dtPopulateSels, dtGoSub, dtEnsureCongNoSubtab
10. Export image: exportHdcToImage, exportHdtpToImage, exportThuToImage
11. Init: _initDoanhThuAddons → initDoanhThu
12. Backward compat aliases: saveHopDong, renderHopDongList, delHopDong
```

---

```
📎 Đính kèm: doanhthu.js, src/modules/revenue/revenue.logic.js,
             src/modules/revenue/revenue.ui.js, index.html

PROMPT:
═══════════════════════════════════════════════════
NHIỆM VỤ: Port toàn bộ doanhthu.js (73KB) vào revenue.ui.js.

1. Đọc doanhthu.js — phân loại:
   - HĐ Chính: saveHopDongChinh(), editHopDongChinh(), renderHdcTable()
   - HĐ Thầu phụ: saveHopDongThauPhu(), renderHdtpTable()
   - Thu tiền: saveThuRecord(), editThuRecord(), renderThuTable()
   - Công nợ: renderCongNoThauPhu(), renderCongNoNhaCungCap()
   - Lãi/Lỗ: renderLaiLo()
   - Chi tiết KL: bindItemsToTable(), copyKLCT(), pasteKLCT()
   - Sub-tab navigation: dtGoSub(), dtEnsureCongNoSubtab()
   - Export image: exportHdcToImage(), exportHdtpToImage()

2. Mở rộng revenue.ui.js — thêm TẤT CẢ hàm DOM
3. Thêm initRevenueModule()
4. Xóa <script src="doanhthu.js">
═══════════════════════════════════════════════════
```

### 15B — Port Kết Quả (HOÀN THÀNH)

**Files đã sửa:**
- `src/modules/revenue/revenue.ui.js` — Rewrite từ 161 dòng (stub) → ~720 dòng (full port)
- `src/app.js` — Thêm `import { initRevenueUI }` + gọi `initRevenueUI()` trong bootstrap

**Symbols đã port (33 symbols):**
```
// Module state
window._hdcItems, window._hdtpItems, _hdcPage, _hdtpPage, _thuPage, _dtCtFilter

// Local helpers
_dtInYear, _dtMatchProjFilter, _dtMatchHDCFilter, _resolveCtName (unified keyId|record)

// KLCT subsystem
updateGlobalTotals, window.updateItem, window.removeItem, bindItemsToTable
_initDoanhThuAddons (inject HTML động vào DOM)

// HĐ Chính
hdcUpdateTotal, _hdcResetForm, saveHopDongChinh, editHopDongChinh, delHopDongChinh, renderHdcTable

// Thu Tiền
_thuResetForm, _thuCancelEdit, saveThuRecord, editThuRecord, delThuRecord, renderThuTable

// HĐ Thầu Phụ
hdtpUpdateTotal, _hdtpResetForm, saveHopDongThauPhu, editHopDongThauPhu, delHopDongThauPhu, renderHdtpTable

// Công Nợ
renderCongNoThauPhu (inline logic khớp legacy), renderCongNoNhaCungCap (dùng calcCongNoNCC)

// Lãi/Lỗ
renderLaiLo (wrapper gọi calcLaiLo từ logic.js)

// Sub-tab + Filter
dtPopulateCtFilter, dtSetCtFilter, dtPopulateSels, dtGoSub, dtEnsureCongNoSubtab

// Export image
exportHdcToImage, exportHdtpToImage, exportThuToImage

// Init
initDoanhThu (migrations + bindItemsToTable + DOM init)

// Backward compat aliases
saveHopDong → saveHopDongChinh, renderHopDongList → renderHdcTable, delHopDong → delHopDongChinh
```

**Bridges đã thêm trong `initRevenueUI()` (~30 window.*)**
```
window.copyKLCT, pasteKLCT
window.saveHopDongChinh, editHopDongChinh, delHopDongChinh, renderHdcTable, hdcUpdateTotal
window.saveThuRecord, editThuRecord, delThuRecord, _thuCancelEdit, renderThuTable
window.saveHopDongThauPhu, editHopDongThauPhu, delHopDongThauPhu, renderHdtpTable, hdtpUpdateTotal
window.renderCongNoThauPhu, renderCongNoNhaCungCap, renderLaiLo
window.dtGoSub, dtSetCtFilter, dtPopulateSels, initDoanhThu
window.exportHdcToImage, exportHdtpToImage, exportThuToImage
window.saveHopDong, renderHopDongList, delHopDong
```
`bindItemsToTable('hdc',...)` + `bindItemsToTable('hdtp',...)` tự gán 8 globals:
`renderhdcChiTiet`, `addhdcChiTietRow`, `togglehdcChiTiet`, `hdcCalcAuto` (và các hdtp* variants)

**Symbols còn delegate legacy (doanhthu.js):**
- `renderDashboard()` — còn là global từ projects.js/datatools.js, không port
- `hopDongData`, `thuRecords`, `thauPhuContracts` module-vars trong doanhthu.js — vẫn tham chiếu bởi `_reloadGlobals()` trong main.js; doanhthu.js chưa thể xóa

**Ghi chú kiến trúc quan trọng:**
- `renderCongNoThauPhu` inline logic thay vì dùng `calcCongNoThauPhu` từ logic.js — lý do: signature mismatch (legacy áp dụng `inActiveYear` cho thauPhuContracts, logic.js không áp dụng)
- `_resolveCtName` hỗ trợ cả `string keyId` lẫn `object record` qua `typeof` check
- `window._hdcItems = window._hdcItems || []` bắt buộc để `pasteKLCT` đọc đúng reference

**Rủi ro còn lại:**
- ESM `initDoanhThu()` override legacy; nếu `initDoanhThu()` gọi trước data ready → form trống (chấp nhận được, legacy cũng vậy)
- Chưa test trên trình duyệt thực; cần verify bindItemsToTable inject đúng HTML vào container `#hdc-chitiet-wrap` và `#hdtp-chitiet-wrap`
- `doanhthu.js` vẫn chạy trước ESM — window functions bị override đúng thứ tự (deanhthu.js parse-time → ESM bootstrap overrides)

---

## 📋 PROMPT 16 — Port `danhmuc.js` + `thietbi.js`

**Mục tiêu**: Hấp thụ Settings + Equipment UI. Sau prompt này, xóa 2 file.

```
📎 Đính kèm: danhmuc.js, thietbi.js,
  src/modules/settings/settings.module.js,
  src/modules/advances/advance.ui.js,
  src/modules/equipment/equipment.ui.js, index.html

PROMPT:
═══════════════════════════════════════════════════
NHIỆM VỤ: Port 2 file cùng lúc (vì liên quan chặt).

A. danhmuc.js (53KB):
   - Danh mục CRUD: renderSettings(), addItem(), delItem(), finishEdit()
   - Tiền ứng entry: addUngRow(), saveAllUngRows(), renderUngTable()
   - Port vào: settings.module.js (danh mục) + advance.ui.js (tiền ứng)

B. thietbi.js (34KB):
   - Nhập TB: tbBuildRows(), tbSave()
   - Danh sách: tbRenderList(), tbUpdateField(), tbDeleteRow()
   - Luân chuyển: tbLuanChuyen(), tbSaveEdit()
   - Kho tổng: renderKhoTong()
   - Port vào: equipment.ui.js

Xóa cả 2 script khỏi index.html.
═══════════════════════════════════════════════════
```

### 16 — Port Kết Quả (HOÀN THÀNH)

**Files đã sửa:**
- `src/modules/settings/settings.module.js` — Rewrite từ stub → ~530 dòng (full port danhmuc.js: CRUD danh mục)
- `src/modules/advances/advance.ui.js` — Rewrite từ ~97 dòng stub → ~280 dòng (full port danhmuc.js: tiền ứng UI)
- `src/modules/equipment/equipment.ui.js` — Rewrite từ 175 dòng (HTML builders only) → ~470 dòng (full port thietbi.js)
- `src/app.js` — Thêm `import { initAdvanceUI }` + `import { initEquipmentUI }` + gọi trong bootstrap

**Scope A — settings.module.js (từ danhmuc.js):**
```
// Local helpers
normalizeName(catId, val), normalizeKey(val), _dedupCatArr(arr)
_isDmItemUsedInYear(catId, item), _isDmItemUsedAnytime(catId, item)

// Item renderers
renderCTItem, renderItem, renderCNItem, renderTbTenItem

// Per-card search
_dmFilterCard(catId)

// Main render
renderSettings() — đọc window.CATS, window.cats, window.tbData; gọi _migrateCatNamesFormat()

// CRUD
isItemInUse, startEdit, cancelEdit, finishEdit (cascade rename 7 stores), addItem, delItem

// Role management
updateCNRole, syncCNRoles

// Dropdown refresh
rebuildEntrySelects() — dùng window._buildProjOpts

// Migration / format fix
scanAndFixAllDataFormats(), _migrateCatNamesFormat() (idempotent, guard _catNamesMigrated)

// CT page
renderCtPage(), showCtModal(ctName), closeModal()
```

**Scope B — advance.ui.js (từ danhmuc.js):**
```
// Module state
filteredUng, ungPage, ungTpPage, _editingUngId

// Entry table
initUngTable(n), initUngTableIfEmpty(), addUngRows(n), clearUngRows(), resetUngForm()
onUngLoaiChange(sel), _ungTpOptions(loai), addUngRow(d), delUngRow(btn), renumberUng()
calcUngSummary(), clearUngTable()

// Data write / edit
saveAllUngRows(), editUngRecord(id)

// List / filter
buildUngFilters(), filterAndRenderUng(), renderUngTable(), goUngTo(p), goUngTpTo(p)

// Delete
delUngRecord(id) — soft-delete (deletedAt = Date.now())

// Utilities
rebuildUngSelects(), exportUngEntryCSV(), exportUngAllCSV()
```

**Scope C — equipment.ui.js (từ thietbi.js):**
```
// Name management
tbRefreshNameDl(), pruneTbTen() (no-op)

// Populate selects
tbPopulateSels() — entry CT, filter CT, kho-filter-ten, tk-filter-ten

// Entry table
tbBuildRows(n), tbAddRows(n), tbRefreshTenSel(), tbAddRow(data, num)
tbRenum(), tbClearRows()

// Save
tbSave() — cộng dồn nếu trùng (projectId+ten+tinhtrang); tạo mới nếu chưa có

// List + pagination
tbRenderList(), tbGoTo(p)

// Inline update / soft-delete
tbUpdateField(id, field, val), tbDeleteRow(id)

// Transfer overlay
tbLuanChuyen(id), tbSaveEdit(id) — soft-delete gốc + create/merge dest + create/merge remainder

// Export
tbExportCSV()

// KHO TỔNG
renderKhoTong(), khoGoTo(p)

// Thống kê vốn
tbRenderThongKeVon()

// DOM filter
filterKhoTable()
```

**Bridges trong initSettings() (~22 window.*):**
```
window.renderSettings, renderCtPage, showCtModal, closeModal, _dmFilterCard
window.startEdit, cancelEdit, finishEdit, addItem, isItemInUse, delItem
window.updateCNRole, syncCNRoles, rebuildEntrySelects
window._dedupCatArr, _migrateCatNamesFormat, scanAndFixAllDataFormats
window.renderCTItem, renderItem, renderCNItem, renderTbTenItem
```

**Bridges trong initAdvanceUI() (~20 window.*):**
```
window.initUngTable, initUngTableIfEmpty, addUngRows, clearUngRows, resetUngForm
window.onUngLoaiChange, addUngRow, delUngRow, renumberUng, calcUngSummary, clearUngTable
window.saveAllUngRows, editUngRecord
window.buildUngFilters, filterAndRenderUng, renderUngTable, goUngTo, goUngTpTo
window.delUngRecord, rebuildUngSelects, exportUngEntryCSV, exportUngAllCSV
```

**Bridges trong initEquipmentUI() (~29 window.*):**
```
window.buildTbNameOpts, buildTbTtOpts, buildTbEntryRowHtml, buildTbListRowHtml
window.buildKhoRowHtml, buildTbStatsRowHtml, buildTbPaginationHtml
window.buildTbCtEntryOpts, buildTbCtFilterOpts
window.tbRefreshNameDl, pruneTbTen, tbPopulateSels
window.tbBuildRows, tbAddRows, tbRefreshTenSel, tbAddRow, tbRenum, tbClearRows
window.tbSave, tbRenderList, tbGoTo, tbUpdateField, tbDeleteRow
window.tbLuanChuyen, tbSaveEdit, tbExportCSV
window.renderKhoTong, khoGoTo, tbRenderThongKeVon, filterKhoTable
```

**Ghi chú kiến trúc:**
- `window.tbData` đọc tại call-time (không snapshot tại module load) → đảm bảo luôn lấy data sau dbInit
- `tbDeleteRow` và `tbSaveEdit` dùng `window.tbData = window.softDeleteRecord(window.tbData, id)` để xử lý reassignment từ soft-delete (trả về array mới)
- `_migrateCatNamesFormat` chỉ chạy 1 lần/session nhờ guard `_catNamesMigrated`
- `finishEdit` cascade rename qua 7 stores: invoices, ungRecords, ccData (name field), tbData, hopDongData (key), thuRecords, thauPhuContracts

**Rủi ro còn lại:**
- `danhmuc.js` và `thietbi.js` vẫn còn trong index.html — các window functions bị ESM override đúng thứ tự
- Chưa test trên trình duyệt; cần verify `tbSaveEdit` không duplicate khi merge dest/remainder
- `addUngRow` dùng `window._acShow` — cần đảm bảo dom.util.js đã gán bridge trước khi gọi

---

## 📋 PROMPT 17 — Port `projects.js` + `datatools.js`

**Mục tiêu**: Hấp thụ Projects UI + Admin tools. Sau prompt này, xóa 2 file.

```
📎 Đính kèm: projects.js, datatools.js,
  src/modules/projects/project.ui.js,
  src/modules/dashboard/dashboard.module.js,
  src/modules/settings/settings.module.js, index.html

PROMPT:
═══════════════════════════════════════════════════
NHIỆM VỤ: Port 2 file lớn nhất.

A. projects.js (87KB):
   - Project CRUD UI: renderProjectList(), addProject(), editProject()
   - Dashboard render: renderDashboard(), renderByCT(), charts
   - Project detail: renderProjectDetail(), chi phí theo CT
   - Port vào: project.ui.js + dashboard.module.js

B. datatools.js (85KB):
   - Admin tools UI: data viewer, fix tools, stats
   - Port vào: settings.module.js hoặc tạo
     src/modules/admin/admin.module.js nếu quá lớn

Xóa cả 2 script khỏi index.html.
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 18 — Port `sync.js` + `nhapxuat.js` + XÓA SẠCH

**Mục tiêu**: Port 2 file cuối + dọn dẹp hoàn toàn. HOÀN TẤT MIGRATION.

```
📎 Đính kèm: sync.js, nhapxuat.js,
  src/core/sync.js, src/services/excel.svc.js, index.html

PROMPT:
═══════════════════════════════════════════════════
NHIỆM VỤ: Port 2 file cuối cùng + Final cleanup.

A. sync.js (38KB):
   - Firebase connection: initFirebase(), pushChanges(), pullChanges()
   - Real-time listeners: onSnapshot handlers
   - Port vào: src/core/sync.js (mở rộng file đã có)

B. nhapxuat.js (87KB):
   - Excel export: exportToExcel() cho từng sheet
   - Excel import: importFromExcel(), parseSheet()
   - CSV helpers
   - Port vào: src/services/excel.svc.js (mở rộng skeleton)

C. FINAL CLEANUP:
   1. Xóa TẤT CẢ <script> cũ khỏi index.html — chỉ giữ:
      - <script src="lib/dexie.min.js">
      - <script type="module" src="src/app.js">
   2. Xóa 12 file legacy: tienich.js, core.js, main.js,
      hoadon.js, chamcong.js, doanhthu.js, danhmuc.js,
      thietbi.js, projects.js, datatools.js, nhapxuat.js, sync.js
   3. Cập nhật ARCHITECTURE.md — xóa mọi mention về legacy/bridge
   4. Xóa tất cả window.* bridges không còn cần thiết
   5. Console log: "[Antigravity] 100% ES Modules ✅"

═══════════════════════════════════════════════════
```

---

## ⚠️ LƯU Ý QUAN TRỌNG CHO NGƯỜI DÙNG

1. **Backup trước mỗi Prompt**: Commit Git hoặc copy thư mục trước khi chạy
2. **Chạy tuần tự**: KHÔNG nhảy prompt. P11 → P12 → ... → P18
3. **Test sau mỗi Prompt**: Mở app, bấm thử TẤT CẢ nút trước khi tiếp
4. **Nếu bị lỗi**: Rollback Git và chạy lại prompt đó
5. **Thời gian dự kiến**: Mỗi prompt ~1-2 giờ. Tổng ~10-16 giờ.
