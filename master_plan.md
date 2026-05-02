# 🎯 MASTER PLAN — Refactor Antigravity sang ES Modules

## Tổng quan tình hình

| Hạng mục | Hiện trạng |
|---|---|
| **App cũ** | 12 file JS global (~700KB), coupling cao, không ES Modules |
| **Kiến trúc mới** | ~26 file ES Modules (đã thiết kế xong) |
| **Thư mục `src/`** | ✅ Đã tạo khung — ❌ Tất cả file đều RỖNG |
| **App cũ còn chạy?** | ✅ Vẫn chạy bình thường, chưa sửa gì |

---

## Nguyên tắc vàng

1. **Xây nhà mới bên cạnh nhà cũ** — App cũ vẫn chạy song song cho đến bước cuối
2. **Mỗi prompt = 1 nhóm file nhỏ** — Không overload AI
3. **Làm xong bước nào, test bước đó** — Gán `window.*` tạm để code cũ không vỡ
4. **Thứ tự bắt buộc**: Utils → Core → Services → Modules → Cleanup

---

## 5 Giai đoạn & 10 Mega Prompts

```
GĐ1: Khung xương ──── [ĐÃ XONG] Tạo thư mục
GĐ2: Utils ─────────── Prompt 1
GĐ3: Core & Services ─ Prompt 2, 3, 4
GĐ4: Modules ────────── Prompt 5, 6, 7, 8, 9
GĐ5: Cleanup ────────── Prompt 10
```

---

## 📋 PROMPT 1 — Tách Utils từ `tienich.js`

**Giai đoạn**: 2 · **File nguồn**: `tienich.js` (28KB)
**File tạo ra**: 4 file utils

> [!NOTE]
> Bước này an toàn nhất — chỉ copy hàm thuần túy ra file mới, không sửa file cũ

```
📎 Đính kèm: tienich.js, PROJECT_ANALYTICS.md (mục 8.2)

PROMPT:
═══════════════════════════════════════════════════
Tôi đang refactor app Vanilla JS sang ES Modules.
Hãy đọc file `tienich.js` và thực hiện:

1. Tạo `src/utils/math.util.js`:
   - Bốc các hàm: fmtM, parseMoney, _pNum, numFmt
   - Export named tất cả

2. Tạo `src/utils/date.util.js`:
   - Bốc: today, formatViDate, ccSundayISO, inActiveYear
   - Export named tất cả

3. Tạo `src/utils/string.util.js`:
   - Bốc: normalizeKey, normalizeName, toSlug
   - Export named tất cả

4. Tạo `src/utils/dom.util.js`:
   - Bốc: toast, showModal, showConfirm, $, $$
   - Export named tất cả

⚠️ QUY TẮC BẮT BUỘC:
- Mỗi file util phải có JSDoc cho từng hàm
- Cuối mỗi file, gán tạm vào window:
  window.fmtM = fmtM; // Bridge tạm cho code cũ
- KHÔNG sửa/xóa file tienich.js cũ
- KHÔNG bốc hàm buildInvoices() — đó là logic
  nghiệp vụ, sẽ xử lý ở prompt sau
═══════════════════════════════════════════════════
```

**Kiểm tra sau khi xong**: Mở app → Các tab hiển thị tiền và ngày tháng bình thường

---

## 📋 PROMPT 2 — Xây Schema Validator

**Giai đoạn**: 3 · **File nguồn**: PROJECT_ANALYTICS.md (mục 7)
**File tạo ra**: `src/core/schema.js`

```
📎 Đính kèm: PROJECT_ANALYTICS.md (mục 7 - Data Schema)

PROMPT:
═══════════════════════════════════════════════════
Đọc mục 7 "Mô hình dữ liệu" trong PROJECT_ANALYTICS.md.
Tạo file `src/core/schema.js` với các validator:

1. validateInvoice(data) — kiểm tra inv_v3
2. validateAttendance(data) — kiểm tra cc_v2
3. validateEquipment(data) — kiểm tra tb_v1
4. validateAdvance(data) — kiểm tra ung_v1
5. validateRevenue(data) — kiểm tra thu_v1
6. validateProject(data) — kiểm tra projects_v1
7. validateContract(data) — kiểm tra hopdong_v1
8. validateSubcontract(data) — kiểm tra thauphu_v1

Mỗi validator phải:
- Kiểm tra field bắt buộc (id, projectId, updatedAt)
- Auto-fill field thiếu (id → uuid, createdAt → now)
- Chuẩn hóa kiểu dữ liệu (tien → number, ngay → string)
- Return { valid: true, data: cleanedData }
  hoặc { valid: false, errors: [...] }

Export thêm hàm normalize(type, rawData) làm
entry point chung: nhận tên loại dữ liệu + data thô,
tự chọn validator phù hợp.

⚠️ KHÔNG import từ file nào khác ngoài uuid generator.
   Đây là module thuần túy, không phụ thuộc DOM/DB.
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 3 — Xây Store (Trái tim mới)

**Giai đoạn**: 3 · **File nguồn**: `core.js` (75KB) + schema.js vừa tạo
**File tạo ra**: `src/core/config.js`, `src/core/db.js`, `src/core/store.js`

```
📎 Đính kèm: core.js, src/core/schema.js, PROJECT_ANALYTICS.md (mục 7-8)

PROMPT:
═══════════════════════════════════════════════════
Đọc file core.js cũ. Tạo 3 file cốt lõi:

1. `src/core/config.js`:
   - Export DB_KEY_MAP (copy từ core.js)
   - Export APP_VERSION, DB_NAME, SYNC_INTERVAL
   - Export danh sách DATASET_KEYS

2. `src/core/db.js`:
   - Khởi tạo Dexie database (copy schema từ core.js)
   - Export hàm dbInit(), dbSave(table, id, data),
     dbLoad(table, id), dbDelete(table, id)
   - KHÔNG chứa business logic

3. `src/core/store.js`:
   - Private state: _state = { invoices:[], projects:[],
     ccData:[], ungRecords:[], tbData:[], thuRecords:[],
     hopDongData:{}, thauPhuContracts:[],
     cats:{}, activeYear:null, activeYears:[],
     currentUser:null }
   - Getter: getInvoices(), getProjects(), getActiveYear()...
   - Setter: setInvoices(arr), addInvoice(data)...
   - Mỗi setter phải gọi schema.normalize() trước khi lưu
   - Setter gọi db.js để persist xuống IndexedDB
   - Export hàm subscribe(key, callback) để module
     UI đăng ký lắng nghe thay đổi state

⚠️ store.js KHÔNG vẽ UI, KHÔNG gọi DOM
⚠️ Cuối file, gán window._store = store để debug
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 4 — Tách Services (project + category + excel)

**Giai đoạn**: 3 · **File nguồn**: `projects.js`, `danhmuc.js`, `nhapxuat.js`
**File tạo ra**: 3 file service + `src/core/migrate.js`

```
📎 Đính kèm: projects.js, danhmuc.js, nhapxuat.js,
             src/core/store.js, PROJECT_ANALYTICS.md (mục 15)

PROMPT:
═══════════════════════════════════════════════════
Tạo 4 file theo hướng dẫn Migration Map (mục 15):

1. `src/services/project.svc.js`:
   - Bốc từ projects.js: findProjectIdByName,
     resolveProjectName, allocateCompanyCost,
     getProjectAutoStartDate, getProjectDays,
     _ctInActiveYear, rebuildCatCTFromProjects
   - Import store.js để đọc/ghi projects

2. `src/services/category.svc.js`:
   - Bốc từ danhmuc.js: logic quản lý cat_items_v1
     (thêm/xóa/sửa danh mục thầu phụ, NCC, công nhân...)
   - Import store.js để đọc/ghi cats

3. `src/services/excel.svc.js`:
   - Bốc từ nhapxuat.js: exportExcelTemplate,
     các hàm parse sheet, import logic
   - Import math.util.js cho _pNum, parseMoney
   - Import schema.js để validate khi import

4. `src/core/migrate.js`:
   - Bốc từ projects.js: migrateProjectLinks(),
     deduplicateProjects()
   - Bốc từ core.js: các hàm migration chạy 1 lần
   - Import store.js, project.svc.js

⚠️ KHÔNG bốc code vẽ UI (DOM/innerHTML) — để prompt sau
⚠️ Dùng export/import chuẩn ES Modules
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 5 — Module Projects (file nặng nhất 87KB)

**Giai đoạn**: 4 · **File nguồn**: `projects.js`
**File tạo ra**: `project.logic.js`, `project.ui.js`

```
📎 Đính kèm: projects.js, src/services/project.svc.js,
             src/core/store.js

PROMPT:
═══════════════════════════════════════════════════
File projects.js (87KB, 1800+ dòng) cần được giải phẫu.
Các hàm service/migrate ĐÃ được tách ở prompt trước.
Phần còn lại chia thành 2 file:

1. `src/modules/projects/project.logic.js`:
   - Logic tính trạng thái công trình (_PT_STATUS_META)
   - Logic tính KPI từng công trình (tổng chi, doanh thu)
   - Logic filter/sort/paginate danh sách công trình
   - Import từ store.js và project.svc.js

2. `src/modules/projects/project.ui.js`:
   - Render danh sách thẻ công trình (Cards)
   - _buildProjOpts, _buildCTDropdown
   - Form thêm/sửa/xóa công trình
   - Bindinding sự kiện click, submit
   - Export hàm initProjectUI() để app.js gọi

⚠️ UI file gọi logic file để lấy data — KHÔNG truy
   cập trực tiếp biến global hay IndexedDB
⚠️ Tất cả HTML template dùng backtick string
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 6 — Module Invoices (Hóa đơn)

**Giai đoạn**: 4 · **File nguồn**: `hoadon.js` (58KB)
**File tạo ra**: `invoice.logic.js`, `invoice.ui.js`

```
📎 Đính kèm: hoadon.js, src/core/store.js,
             src/core/schema.js, src/utils/*

PROMPT:
═══════════════════════════════════════════════════
Chuyển đổi module Hóa Đơn. Đọc file hoadon.js.

1. `src/modules/invoices/invoice.logic.js`:
   - Bốc buildInvoices() từ tienich.js cũ vào đây
     (đây là logic nghiệp vụ, không phải utility)
   - Logic getInvoicesCached(), clearInvoiceCache()
   - Logic saveInvoice(data), deleteInvoice(id) — soft delete
   - Logic tính tổng tiền, filter theo năm/CT/loại
   - Quản lý trash (trash_v1)
   - Import store.js để get/set, schema.js để validate

2. `src/modules/invoices/invoice.ui.js`:
   - Render bảng hóa đơn nhanh + chi tiết
   - Form nhập/sửa hóa đơn
   - Render bảng HDC (hóa đơn chi tiết có items)
   - Logic tìm kiếm UI, phân trang
   - Export initInvoiceUI()

⚠️ buildInvoices() hợp nhất inv_v3 + dẫn xuất từ cc_v2
   — phải giữ nguyên logic merge, đánh dấu source:'cc'
⚠️ Hóa đơn chi tiết có mảng items[] — giữ nguyên cấu trúc
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 7 — Module Payroll (Chấm công)

**Giai đoạn**: 4 · **File nguồn**: `chamcong.js` (70KB)
**File tạo ra**: `payroll.logic.js`, `payroll.ui.js`

```
📎 Đính kèm: chamcong.js, src/core/store.js, src/core/schema.js

PROMPT:
═══════════════════════════════════════════════════
Chuyển module Chấm Công. Đọc chamcong.js.

1. `src/modules/payroll/payroll.logic.js`:
   - Logic tính lương: ngày công × lương + phụ cấp - trừ
   - Logic normalizeCC (dedup chấm công) — bốc từ sync.js cũ
   - Logic clipboard (copy/paste bảng chấm công)
   - saveAttendance(), deleteAttendance()

2. `src/modules/payroll/payroll.ui.js`:
   - Render bảng chấm công theo tuần (7 cột ngày)
   - Form thêm/sửa worker trong bảng
   - Logic phân trang, chọn tuần
   - Export initPayrollUI()

⚠️ cc_v2 có cấu trúc workers[] lồng nhau — giữ nguyên
⚠️ normalizeCC phải dời từ sync.js sang đây (logic nghiệp vụ)
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 8 — Module Revenue + Advances + Equipment

**Giai đoạn**: 4 · **File nguồn**: `doanhthu.js`, `danhmuc.js`, `thietbi.js`
**File tạo ra**: 6 file (3 cặp logic + ui)

```
📎 Đính kèm: doanhthu.js, danhmuc.js (phần tiền ứng),
             thietbi.js, src/core/store.js

PROMPT:
═══════════════════════════════════════════════════
Chuyển 3 module còn lại. Mỗi module tạo cặp logic+ui:

A. Revenue (doanhthu.js → src/modules/revenue/):
   - revenue.logic.js: Hợp đồng chính, thầu phụ,
     thu tiền, tính công nợ
   - revenue.ui.js: Render tab doanh thu, form hợp đồng
   ⚠️ Gỡ bỏ _initDoanhThuAddons() gán window.*
      → chuyển thành export bình thường

B. Advances (từ danhmuc.js → src/modules/advances/):
   - advance.logic.js: Logic tiền ứng (ung_v1),
     filter theo loại (thauphu/nhacungcap/congnhan)
   - advance.ui.js: Render bảng tiền ứng
   ⚠️ Tiền ứng ẨN trong danhmuc.js — tách riêng hẳn

C. Equipment (thietbi.js → src/modules/equipment/):
   - equipment.logic.js: Logic kho tổng ↔ công trình
   - equipment.ui.js: Render tab thiết bị
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 9 — Module Auth + Dashboard + Settings + Backup + Sync

**Giai đoạn**: 4 · **File nguồn**: `main.js`, `datatools.js`, `sync.js`, `danhmuc.js`
**File tạo ra**: 5 module files + sync mới

```
📎 Đính kèm: main.js, datatools.js, sync.js,
             danhmuc.js (phần settings), src/core/store.js

PROMPT:
═══════════════════════════════════════════════════
Chuyển 5 module hệ thống cuối cùng:

1. `src/modules/auth/auth.module.js`:
   - Bốc từ main.js: login, validateSession,
     getDeviceId, sessionHeartbeat, role UI
   - Import store.js cho currentUser

2. `src/modules/dashboard/dashboard.module.js`:
   - Bốc từ datatools.js: renderDashboard, _dbKPI,
     _dbBarChart, _dbPieChart, _dbTop5, _dbByCT
   - Import store.js để đọc data tổng hợp

3. `src/modules/settings/settings.module.js`:
   - Bốc từ danhmuc.js: UI quản lý danh mục
     (thêm/xóa tên thầu phụ, NCC, công nhân, loại...)
   - Bốc từ datatools.js: toolDeleteYear, toolResetAll
   - Import category.svc.js

4. `src/modules/backup/`:
   - backup.logic.js: Auto-backup (từ main.js),
     exportJSON, importJSON (từ core.js)
   - backup.ui.js: Nút tải/khôi phục JSON

5. `src/core/sync.js` (viết lại):
   - Giữ logic thuần Pull/Push Firestore
   - KHÔNG chứa normalizeCC (đã dời sang payroll)
   - Import store.js, config.js
═══════════════════════════════════════════════════
```

---

## 📋 PROMPT 10 — Nối dây & Dọn rác (Final)

**Giai đoạn**: 5 · **File nguồn**: Toàn bộ `src/` + `index.html`
**Kết quả**: App chạy hoàn toàn bằng ES Modules

```
📎 Đính kèm: index.html, src/app.js, toàn bộ src/

PROMPT:
═══════════════════════════════════════════════════
Tất cả module đã sẵn sàng. Thực hiện bước cuối:

1. Cấu hình `src/app.js` làm Entry Point:
   - Import tất cả init functions:
     initInvoiceUI, initPayrollUI, initProjectUI,
     initRevenueUI, initAdvanceUI, initEquipmentUI,
     initDashboard, initSettings, initAuth, initBackup
   - Viết hàm main() gọi: dbInit → auth → migrate
     → init tất cả UI → startAutoSync
   - DOMContentLoaded → main()

2. Cập nhật `index.html`:
   - XÓA tất cả 12 thẻ <script> cũ:
     core.js, projects.js, tienich.js, hoadon.js,
     danhmuc.js, nhapxuat.js, datatools.js,
     chamcong.js, thietbi.js, doanhthu.js,
     sync.js, main.js
   - THÊM đúng 1 thẻ:
     <script type="module" src="src/app.js"></script>
   - Giữ nguyên HTML structure (tabs, divs)

3. Gỡ bỏ window.* bridge tạm ở tất cả utils files

4. Phân chia CSS (nếu chưa làm):
   - Tạo src/styles/variables.css, layout.css,
     table.css, form.css
   - style.css gốc chỉ chứa @import

⚠️ TEST CHECKLIST sau khi xong:
   □ App load không lỗi console
   □ Đăng nhập hoạt động
   □ Xem/thêm/sửa/xóa hóa đơn
   □ Chấm công render đúng
   □ Dashboard hiển thị biểu đồ
   □ Export/Import Excel hoạt động
   □ Sync Firebase push/pull thành công
   □ Backup JSON xuất/nhập được
═══════════════════════════════════════════════════
```

---

## 📊 Bảng tóm tắt — File cũ → File mới

| File cũ (xóa cuối) | → File mới (tạo) |
|---|---|
| `tienich.js` (28KB) | `utils/*.js` (4 file) + `invoice.logic.js` (buildInvoices) |
| `core.js` (75KB) | `core/config.js` + `core/db.js` + `core/store.js` |
| `projects.js` (87KB) | `project.svc.js` + `migrate.js` + `project.logic.js` + `project.ui.js` |
| `hoadon.js` (58KB) | `invoice.logic.js` + `invoice.ui.js` |
| `chamcong.js` (70KB) | `payroll.logic.js` + `payroll.ui.js` |
| `doanhthu.js` (73KB) | `revenue.logic.js` + `revenue.ui.js` |
| `danhmuc.js` (55KB) | `advance.*.js` + `settings.module.js` + `category.svc.js` |
| `thietbi.js` (35KB) | `equipment.logic.js` + `equipment.ui.js` |
| `datatools.js` (87KB) | `dashboard.module.js` + `settings.module.js` (phần admin) |
| `nhapxuat.js` (89KB) | `excel.svc.js` |
| `sync.js` (39KB) | `core/sync.js` (mới, gọn hơn) |
| `main.js` (37KB) | `auth.module.js` + `backup.*.js` + `app.js` |

---

## ⏱️ Thời gian ước tính

| Prompt | Thời gian | Độ khó |
|---|---|---|
| P1: Utils | 15-20 phút | ⭐ Dễ |
| P2: Schema | 20-30 phút | ⭐⭐ TB |
| P3: Store | 30-45 phút | ⭐⭐⭐ Khó |
| P4: Services | 30-45 phút | ⭐⭐⭐ Khó |
| P5: Projects | 45-60 phút | ⭐⭐⭐⭐ Rất khó |
| P6: Invoices | 30-45 phút | ⭐⭐⭐ Khó |
| P7: Payroll | 30-45 phút | ⭐⭐⭐ Khó |
| P8: Revenue+Adv+Equip | 45-60 phút | ⭐⭐⭐ Khó |
| P9: Auth+Dash+Settings | 45-60 phút | ⭐⭐⭐ Khó |
| P10: Final cleanup | 30-45 phút | ⭐⭐ TB |
| **Tổng** | **~5-8 giờ** | |

> [!IMPORTANT]
> **Bạn có muốn tôi bắt đầu thực hiện Prompt 1 (Tách Utils) ngay bây giờ không?**
> Hay bạn muốn điều chỉnh gì trong kế hoạch trước?
