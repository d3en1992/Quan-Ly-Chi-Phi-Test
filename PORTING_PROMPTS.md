# 🔥 GIAI ĐOẠN PORTING CUỐI CÙNG — Xóa bỏ Legacy JS

## Tổng quan

**Mục tiêu**: Port toàn bộ DOM wiring từ 12 file legacy (~716KB) vào ES Modules, sau đó xóa sạch.

**Trạng thái hiện tại**: Logic đã tách xong (Prompt 1-10). Còn lại: DOM rendering, event handlers, bootstrap code.

**Chiến lược**: 8 Mega Prompts, mỗi prompt xử lý 1-2 file legacy → test → xóa file cũ.

**Thứ tự bắt buộc**: Foundation (bootstrap) → Modules (UI) → Heavy (Excel/Sync)

---

## 📋 PROMPT 11 — Port `tienich.js` + `core.js`

**Mục tiêu**: Hấp thụ 2 file nền tảng. Sau prompt này, xóa `tienich.js` và `core.js`.

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

⚠️ KHÔNG sửa các file legacy khác (hoadon.js, chamcong.js...)
   — chỉ đảm bảo chúng vẫn chạy qua window.* bridges
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 12 — Port `main.js`

**Mục tiêu**: Hấp thụ bootstrap + navigation + year filter. Sau prompt này, xóa `main.js`.

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
