# PROJECT_ANALYTICS.md
> Cập nhật kiến trúc hệ thống theo source code hiện tại (Vanilla JS)  
> Ngày cập nhật: 22/04/2026  
> Tài liệu này thay thế bản cũ ngày 08/04.

---

## 1) Mục tiêu tài liệu

Tài liệu này mô tả chính xác hiện trạng kiến trúc, luồng dữ liệu, mô hình lưu trữ, cơ chế sync và logic nghiệp vụ của **App Quản Lý Chi Phí Công Trình** tại thời điểm hiện tại, để phục vụ refactor an toàn ở vòng kế tiếp.

---

## 2) Tổng quan kiến trúc

Ứng dụng là SPA Vanilla JS, không bundler, không module system ES import/export. Toàn bộ file JS chạy theo thứ tự `<script>` trong `index.html`, chia sẻ state bằng biến/hàm global.

**Thứ tự nạp script runtime (quan trọng):**
1. `core.js`
2. `projects.js`
3. `tienich.js`
4. `hoadon.js`
5. `danhmuc.js`
6. `nhapxuat.js`
7. `datatools.js`
8. `chamcong.js`
9. `thietbi.js`
10. `doanhthu.js`
11. `sync.js`
12. `main.js`

Điều này tạo coupling theo thứ tự nạp: file sau có thể gọi hàm/biến file trước.

---

## 3) Runtime Architecture (cập nhật)

```text
+----------------------------- UI (index.html) ------------------------------+
| Tabs + Forms + Tables + Charts + Import/Export + Data Tools               |
+-----------------------------------+----------------------------------------+
                                    |
                                    v
+------------------------- Global Runtime (window) --------------------------+
| main.js: app bootstrap, auth/session, role UI, init, autosync start       |
| core.js: storage abstraction, Dexie, cats/settings, load/save, JSON I/O    |
| projects.js: project master, project lifecycle, cat_ct rebuild              |
| tienich.js: utility + buildInvoices() + cache                               |
| hoadon.js/chamcong.js/thietbi.js/doanhthu.js/danhmuc.js: domain UIs         |
| nhapxuat.js: Excel import/export pipeline                                   |
| datatools.js: reset/delete-year tools + dashboard rendering/KPI/charts      |
| sync.js: Firestore offline-first sync, merge/conflict/tombstone            |
+-----------------------------------+----------------------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
                          IndexedDB (Dexie `qlct`)       Firestore cloud
                          - invoices/attendance/...      - year documents
                          - categories/settings          - categories doc
```

---

## 4) Data Flow / Offline-First

```text
User action
  -> save(key, value) [core.js]
  -> cập nhật _mem + Dexie local
  -> mark pending + invalidate cache
  -> schedulePush() [sync.js, debounce]

Đọc dữ liệu UI
  -> load(key, default) [core.js]
  -> đọc từ _mem (memory snapshot sau dbInit)
  -> render module

Auto sync/manual sync
  -> pullChanges()
  -> merge cloud/local (LWW + tombstone)
  -> save local
  -> pushChanges() theo năm + categories
```

**Đặc điểm offline-first hiện tại:**
- Local IndexedDB là nguồn chạy UI tức thời.
- Sync cloud chạy nền (auto) hoặc thủ công.
- Conflict resolution kiểu timestamp (last-write-wins) + ưu tiên tombstone khi có xóa.
- Có cơ chế `_blockPullUntil` để chặn pull ngắn hạn trong các thao tác reset/import.

---

## 5) Các module chính (đã bổ sung `datatools.js`)

| Module | Vai trò chính | Tương tác chính |
|---|---|---|
| `core.js` | Nền tảng dữ liệu: Dexie init, map key, `load/save`, export/import JSON, quản lý category items mới | Tất cả module |
| `main.js` | Bootstrap app, auth/session/role, migration lúc startup, điều phối init + autosync start | Gọi hầu hết module |
| `projects.js` | Master dữ liệu công trình (`projects_v1`), chuẩn hóa liên kết `projectId`, rebuild danh mục công trình | `core.js`, tất cả module domain |
| `tienich.js` | Hàm tiện ích dùng chéo module, đặc biệt `buildInvoices()` và cache hóa đơn | `hoadon.js`, `doanhthu.js`, `datatools.js` |
| `hoadon.js` | Nghiệp vụ hóa đơn nhanh/chi tiết, trash | `invoices`, `cats`, `projects` |
| `chamcong.js` | Bảng chấm công theo tuần, worker-level lương/phụ cấp/HD lẻ | `cc_v2`, `projects`, `cats` |
| `thietbi.js` | Quản lý thiết bị theo công trình/kho tổng | `tb_v1`, `projects`, `cats` |
| `doanhthu.js` | Hợp đồng chính, thầu phụ, thu tiền, dashboard business phần doanh thu | `hopdong_v1`, `thauphu_v1`, `thu_v1` |
| `danhmuc.js` | Danh mục dùng chung + quản lý tiền ứng | `ung_v1`, `cat_items_v1`, `cats` |
| `nhapxuat.js` | Import/Export Excel nhiều sheet + log kiểm tra dữ liệu | Toàn bộ dataset |
| `sync.js` | Đồng bộ Firestore theo năm + categories, merge/conflict/tombstone | `core.js`, global datasets |
| `datatools.js` | **Mới:** Data maintenance tools (`Delete Year`, `Reset All`) + dashboard KPI/charts/filter theo công trình + export/import wrappers | `core.js`, `sync.js`, `tienich.js`, `doanhthu.js`, `projects.js` |

---

## 6) Chi tiết module mới `datatools.js`

### 6.1 Chức năng Data Tools
- `toolDeleteYear()` và `_doDeleteYear(yr)`
- `toolResetAll()` và `_doResetAll()`
- `toolExportJSON()` (wrapper `exportJSON()`)
- `toolImportJSON()` (trigger file input, gọi `importJSON()`)

### 6.2 Vai trò trong kiến trúc
`datatools.js` đứng giữa lớp UI thao tác quản trị dữ liệu và lớp persistence/sync:
- Gọi `save()` để ghi local + kích hoạt push.
- Dùng logic soft-delete/tombstone để không làm mất dấu trạng thái xóa khi đồng bộ cloud.
- Điều chỉnh categories/project associations sau thao tác xóa năm/reset.
- Chủ động sync/push trong một số nhánh quan trọng.

### 6.3 Dashboard trong `datatools.js`
Có global `selectedCT` và cụm hàm render:
- `renderDashboard()`
- `_dbPopulateCTFilter`
- `_dbKPI`
- `_dbBarChart`
- `_dbPieChart`
- `_dbTop5`
- `_dbByCT`
- `_dbUngByCT`
- `_dbTBByCT`

Nghĩa là dashboard không còn tập trung một chỗ cũ; hiện tại một phần logic analytics runtime nằm trong `datatools.js`.

---

## 7) Mô hình dữ liệu & IndexedDB schema (Dexie)

## 7.1 Dexie physical schema
```js
// version 1
invoices:   'id, updatedAt'
attendance: 'id, updatedAt'
equipment:  'id, updatedAt'
ung:        'id, updatedAt'
revenue:    'id, updatedAt'
categories: 'id'

// version 2
settings:   'id'
```

## 7.2 Key map logic (`DB_KEY_MAP`)
```json
{
  "inv_v3": "invoices",
  "cc_v2": "attendance",
  "tb_v1": "equipment",
  "ung_v1": "ung",
  "thu_v1": "revenue",
  "cat_ct": "categories",
  "cat_loai": "categories",
  "cat_ncc": "categories",
  "cat_nguoi": "categories",
  "cat_tp": "categories",
  "cat_cn": "categories",
  "cat_tbteb": "categories",
  "projects_v1": "settings",
  "hopdong_v1": "settings",
  "thauphu_v1": "settings",
  "trash_v1": "settings",
  "users_v1": "settings",
  "cat_ct_years": "settings",
  "cat_cn_roles": "settings",
  "cat_items_v1": "settings"
}
```

## 7.3 Logical JSON schema (runtime)

### `inv_v3` (Array)
```json
{
  "id": "string",
  "ngay": "YYYY-MM-DD|string",
  "congtrinh": "string",
  "projectId": "string|null",
  "loai": "string",
  "nguoi": "string",
  "ncc": "string",
  "nd": "string",
  "tien": "number|string",
  "thanhtien": "number",
  "sl": "number|string|optional",
  "items": "array|optional",
  "footerCkStr": "string|optional",
  "soHD": "string|optional",
  "source": "manual|cc|optional",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null",
  "deviceId": "string|optional"
}
```

### `cc_v2` (Array)
```json
{
  "id": "string",
  "fromDate": "YYYY-MM-DD",
  "toDate": "YYYY-MM-DD",
  "ct": "string",
  "projectId": "string|null",
  "ctPid": "string|optional",
  "workers": [
    {
      "name": "string",
      "luong": "number",
      "d": "number[7]",
      "phucap": "number",
      "hdmuale": "number",
      "nd": "string",
      "role": "string|optional",
      "tru": "number|optional"
    }
  ],
  "createdAt": "timestamp|optional",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null",
  "deviceId": "string|optional"
}
```

### `tb_v1` (Array)
```json
{
  "id": "string",
  "ct": "string",
  "projectId": "string|null",
  "ten": "string",
  "soluong": "number",
  "tinhtrang": "string",
  "ghichu": "string",
  "ngay": "YYYY-MM-DD|string",
  "nguoi": "string|optional",
  "createdAt": "timestamp|optional",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null",
  "deviceId": "string|optional"
}
```

### `ung_v1` (Array)
```json
{
  "id": "string",
  "ngay": "YYYY-MM-DD|string",
  "loai": "thauphu|nhacungcap|congnhan",
  "tp": "string",
  "congtrinh": "string",
  "projectId": "string|null",
  "tien": "number",
  "nd": "string",
  "createdAt": "timestamp|optional",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null",
  "deviceId": "string|optional"
}
```

### `thu_v1` (Array)
```json
{
  "id": "string",
  "ngay": "YYYY-MM-DD|string",
  "congtrinh": "string",
  "projectId": "string|null",
  "tien": "number",
  "nguoi": "string",
  "nd": "string",
  "createdAt": "timestamp|optional",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null",
  "deviceId": "string|optional"
}
```

### `projects_v1` (Array)
```json
{
  "id": "string",
  "name": "string",
  "type": "congtrinh|company|other",
  "status": "active|closed|optional",
  "startDate": "YYYY-MM-DD|optional",
  "endDate": "YYYY-MM-DD|optional",
  "closedDate": "YYYY-MM-DD|optional",
  "note": "string|optional",
  "createdYear": "number|optional",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null"
}
```

### `hopdong_v1` (Object map)
```json
{
  "<projectId_or_legacy_projectName>": {
    "giaTri": "number",
    "giaTriphu": "number|optional",
    "phatSinh": "number|optional",
    "nguoi": "string|optional",
    "ngay": "YYYY-MM-DD|optional",
    "projectId": "string|optional",
    "sl": "number|optional",
    "donGia": "number|optional",
    "items": "array|optional",
    "ghichu": "string|optional",
    "createdAt": "timestamp|optional",
    "updatedAt": "timestamp|optional",
    "deletedAt": "timestamp|null"
  }
}
```

### `thauphu_v1` (Array)
```json
{
  "id": "string",
  "ngay": "YYYY-MM-DD|string",
  "congtrinh": "string",
  "projectId": "string|null",
  "thauphu": "string",
  "giaTri": "number|optional",
  "phatSinh": "number|optional",
  "nd": "string|optional",
  "sl": "number|optional",
  "donGia": "number|optional",
  "items": "array|optional",
  "createdAt": "timestamp|optional",
  "updatedAt": "timestamp",
  "deletedAt": "timestamp|null",
  "deviceId": "string|optional"
}
```

### Category keys
```json
{
  "cat_ct": "string[]",
  "cat_loai": "string[]",
  "cat_ncc": "string[]",
  "cat_nguoi": "string[]",
  "cat_tp": "string[]",
  "cat_cn": "string[]",
  "cat_tbteb": "string[]",
  "cat_ct_years": "number[]",
  "cat_cn_roles": "string[]"
}
```

### `cat_items_v1` (Object)
```json
{
  "loai": [{ "id": "string", "name": "string", "isDeleted": "boolean", "updatedAt": "timestamp" }],
  "ncc": [{ "id": "string", "name": "string", "isDeleted": "boolean", "updatedAt": "timestamp" }],
  "nguoi": [{ "id": "string", "name": "string", "isDeleted": "boolean", "updatedAt": "timestamp" }],
  "tp": [{ "id": "string", "name": "string", "isDeleted": "boolean", "updatedAt": "timestamp" }],
  "cn": [{ "id": "string", "name": "string", "isDeleted": "boolean", "updatedAt": "timestamp" }],
  "tbteb": [{ "id": "string", "name": "string", "isDeleted": "boolean", "updatedAt": "timestamp" }]
}
```

### `users_v1` (Array)
```json
{
  "id": "string",
  "username": "string",
  "password": "string",
  "role": "admin|giamdoc|ketoan",
  "updatedAt": "timestamp",
  "sessionVersion": "number",
  "sessions": [
    {
      "deviceId": "string",
      "loginAt": "timestamp",
      "lastActive": "timestamp"
    }
  ]
}
```

---

## 8) Quick Reference — Hàm & Global quan trọng

## 8.1 Global state chính

| File | Global |
|---|---|
| `main.js` | `activeYears`, `activeYear`, `currentUser`, observer/timer auth |
| `core.js` | `cats`, `cnRoles`, `invoices`, `filteredInvs`, `curPage`, `_mem`, pending/sync flags |
| `projects.js` | `projects`, filter/paging cho tab công trình |
| `hoadon.js` | `trash` |
| `danhmuc.js` | `ungRecords`, `filteredUng`, paging/edit flags |
| `chamcong.js` | `ccData`, paging/offset, clipboard |
| `thietbi.js` | `tbData`, `tbPage`, `khoPage` |
| `doanhthu.js` | `hopDongData`, `thuRecords`, `thauPhuContracts`, filter/paging flags |
| `tienich.js` | `invoiceCache` |
| `sync.js` | `DEVICE_ID`, `_syncPulling`, `_syncPushing`, `_pushTimer` |
| `datatools.js` | `selectedCT` |
| `nhapxuat.js` | `_importSession` |

## 8.2 Hàm quan trọng theo luồng

- Khởi động: `dbInit()` -> migration/normalize -> `init()` -> `startAutoSync()`
- Persistence: `load(k)`, `save(k,v)`, `_dbSave()`
- Hóa đơn tổng hợp: `buildInvoices()` + `getInvoicesCached()`
- Project linking: `migrateProjectLinks()`, `resolveProjectName()`
- Sync: `pullChanges()`, `pushChanges()`, `manualSync()`, `schedulePush()`
- Data tools: `_doDeleteYear()`, `_doResetAll()`, `renderDashboard()`
- JSON I/O: `exportJSON()`, `importJSON()`, `importJSONFull()`
- Excel I/O: `exportExcelTemplate()`, import từng sheet qua parser strict.

---

## 9) Giải thích chi tiết logic quan trọng

## 9.1 `buildInvoices()` (không được lược bỏ)
`buildInvoices()` hợp nhất 2 nguồn:
- Nguồn tay từ `inv_v3` (manual invoices, bỏ record có `deletedAt`).
- Nguồn dẫn xuất từ `cc_v2`:
  - Dòng “Hóa Đơn Lẻ” cho từng worker nếu `hdmuale > 0`.
  - Dòng “Nhân Công” theo tuần, cộng tổng tiền công từ mảng ngày công + lương/phụ cấp/trừ.

Kết quả trả mảng hóa đơn chuẩn hóa có cờ `source: 'cc'` cho dòng dẫn xuất.  
Dùng cache `invoiceCache` để giảm tính toán lặp lại, bị invalidated qua `clearInvoiceCache()` khi save dữ liệu liên quan.

## 9.2 Offline-first + Sync
- Mọi sửa đổi ghi local trước (`save` -> Dexie + memory).
- Push cloud chạy debounce và auto interval.
- Pull cloud merge vào local theo id, conflict theo timestamp, tombstone có ưu tiên.
- Dữ liệu cloud tổ chức theo document theo năm + document categories tổng.
- `normalizeCC` trong sync xử lý dedup record chấm công theo khóa logic tuần/công trình.

## 9.3 Quản lý công trình và liên kết `projectId`
- `projects_v1` là master.
- `migrateProjectLinks()` chuẩn hóa `projectId` trong dữ liệu nghiệp vụ.
- `resolveProjectName()` ưu tiên tên từ `projectId`, fallback text cũ.
- `rebuildCatCTFromProjects()` tái dựng danh mục công trình hiển thị từ project master.

---

## 10) Import/Export hiện trạng

## 10.1 JSON
- `exportJSON()` xuất snapshot toàn bộ `_mem`.
- `importJSONFull()` clear local DB rồi nạp lại dữ liệu đã sanitize.
- Có nhánh đẩy cloud và chặn pull tạm thời để tránh tự ghi đè ngay sau import/reset.

## 10.2 Excel (strict)
Export gồm 10 sheet:
1. `1_HoaDonNhanh`
2. `2_HoaDonChiTiet`
3. `3_ChamCong`
4. `4_TienUng`
5. `5_ThietBi`
6. `6_DanhMuc`
7. `7_HopDongChinh`
8. `8_ThuTien`
9. `9_HopDongThauPhu`
10. `10_HuongDan`

Import là parser cột cố định, không đoán cột, có log bỏ qua dòng lỗi/trùng.

---

## 11) Delta so với tài liệu cũ (08/04) và Hiện tại

- Có module mới `datatools.js` (trước đây chưa mô tả).
- Dashboard runtime hiện có phần lớn logic ở `datatools.js`.
- Bổ sung schema/settings key mới: `users_v1`, `cat_ct_years`, `cat_cn_roles`, `cat_items_v1`.
- Mô hình category nâng cấp: dual model (array category + item object có soft-delete).
- Auth/session đa vai trò tích hợp sâu ở `main.js`.
- Đồng bộ cloud có thêm merge cho users/projects/hợp đồng/thầu phụ/category items.
- Luồng reset/delete-year phức tạp hơn, cloud-aware tombstone.

**[CẬP NHẬT MỚI NHẤT TỪ SOURCE CODE HIỆN TẠI]:**
- **Tính năng Auto-backup ngầm:** Đã được thêm vào `init()` trong `main.js` (chạy mỗi 30 phút), cần lưu ý tách thành module `backup`.
- **Cơ chế Session Heartbeat & Device ID:** Auth trong `main.js` nay đã sử dụng `getDeviceId()`, `_startSessionHeartbeat()` và `validateCurrentSession()` để kiểm soát timeout và đa thiết bị. Rất phức tạp.
- **Dynamic UI Injection (Anti-pattern):** Trong `doanhthu.js`, hàm `_initDoanhThuAddons()` tự động chèn mã HTML bảng chi tiết "Khối lượng" vào DOM và gán trực tiếp các hàm xử lý sự kiện lên biến global `window` (`window.hdcCalcAuto`, `window.renderhdcChiTiet`). **LƯU Ý:** Khi chuyển sang ES Modules, tuyệt đối phải bóc tách những hàm `window.` này trả về scope cục bộ của module.
- **ResizeObserver cho Topbar:** Có logic tự đo chiều cao Topbar dính trong `init()`.

---

## 12) Technical Debt & rủi ro refactor

1. Coupling global state rất cao, phụ thuộc thứ tự nạp script, khó cô lập test.
2. Nhiều biến global mutable chia sẻ ngang module, side-effect khó kiểm soát.
3. `hopdong_v1` đang song song 2 kiểu key (`projectId` và legacy tên công trình), dễ sai dữ liệu.
4. Import hợp đồng chính còn upsert theo tên (`row.ct`) nên tiếp tục nuôi legacy key.
5. Inconsistent field naming (`soHD` vs truy vấn `sohd`) có nguy cơ miss dữ liệu tìm kiếm.
6. `ung_v1.loai` đã mở rộng (`nhacungcap`) nhưng các nhánh cũ có thể chưa bao quát hết.
7. `tb_v1.nguoi` được dùng ở vài nơi nhưng không luôn được chuẩn hóa khi save/import.
8. Logic dedup/normalize chấm công tồn tại ở nhiều chỗ (`normalizeAllChamCong`, `_dedupCC`, `normalizeCC`) dễ lệch hành vi.
9. Conflict resolution hiện tại là LWW + tombstone, có nguy cơ mất chỉnh sửa hợp lệ khi edit đồng thời.
10. Quy trình reset/delete-year có nhiều nhánh sync và timing (`_blockPullUntil`), rủi ro race condition.
11. Business logic + rendering + storage đang trộn trong cùng file lớn, gây spaghetti code.
12. Thiếu lớp domain model/validator tập trung, schema drift giữa module diễn ra âm thầm.
13. Thiếu test tự động regression cho import/sync/merge nên refactor dễ phá vỡ hành vi.

---

## 13) Đề xuất định hướng refactor (ngắn gọn)

- Chuẩn hóa data contract tập trung (Type/Schema validator runtime).
- Tách repository layer (storage/sync) khỏi UI module.
- Cô lập auth/session thành service độc lập.
- Hợp nhất model `projectId` làm khóa chuẩn duy nhất, migrate dứt điểm `hopdong_v1`.
- Đóng gói global state vào store có event rõ ràng.
- Viết test cho `buildInvoices`, merge sync, import Excel và reset/delete-year trước khi refactor sâu.

---

## 14) Kết luận

Hệ thống hiện tại đã phát triển thành kiến trúc offline-first nhiều module, có đồng bộ cloud theo năm, có auth-role và bộ công cụ dữ liệu mạnh hơn (đặc biệt `datatools.js`). Tuy nhiên độ kết dính global và drift schema đang là điểm nghẽn chính. Tài liệu này phản ánh hiện trạng để làm baseline cho refactor an toàn ở vòng tiếp theo.

---

## 15) Bản đồ Di chuyển (Migration Map) sang ES Modules

Phần này dùng làm "Kim chỉ nam" cho Cursor/Claude trong quá trình chia tách mã nguồn cũ thành cấu trúc src/ mới. Rất nhiều file cũ chứa các logic "ẩn" không khớp với tên file. Cần lưu ý các điểm sau khi thực hiện prompt:

### 15.1 Tầng Nền Tảng (Core & Services)
*   **core.js cũ** -> Tách thành src/core/db.js (Dexie), src/core/store.js (State invoices, cats...) và src/core/config.js.
*   **tienich.js cũ** -> Tách thành src/utils/math.util.js, date.util.js, dom.util.js. Chú ý: Hàm buildInvoices() bên trong file này chứa logic nghiệp vụ, phải dời sang src/modules/invoices/invoice.logic.js chứ không để ở utils.
*   **nhapxuat.js cũ** -> Tách thành src/services/excel.svc.js (xuất nhập Excel). Các hàm parse nhỏ (như _pNum) phải dời vào utils/math.util.js.

### 15.2 Giải phẫu các file "Nặng" (Domain Modules)
*   **projects.js (File phức tạp nhất)**
    - Nhiệm vụ 1 (Logic): Chuyển findProjectIdByName, allocateCompanyCost sang src/services/project.svc.js.
    - Nhiệm vụ 2 (UI): Chuyển code vẽ UI Thẻ Công Trình sang src/modules/projects/project.ui.js.
    - Nhiệm vụ 3 (Migration ẩn): Chuyển migrateProjectLinks() và deduplicateProjects() sang src/core/migrate.js.
*   **danhmuc.js (Chứa 2 domain khác nhau)**
    - Domain Cài đặt: Quản lý thêm/xóa danh mục thầu phụ, tên máy -> Chuyển sang src/modules/settings/.
    - Domain Tiền ứng (ẨN): Quản lý chi/tạm ứng tiền (ungRecords) -> BẮT BUỘC tách thành src/modules/advances/advance.logic.js và advance.ui.js. Tuyệt đối không để chung với settings.
*   **datatools.js (Chứa Dashboard và Destructive actions)**
    - Domain Dashboard: Chuyển code vẽ biểu đồ sang src/modules/dashboard/.
    - Domain Admin Tools: Chuyển chức năng Delete Year / Reset sang src/modules/settings/ hoặc core/store.js.
*   **sync.js (Bị lẫn business logic)**
    - Chứa logic normalizeCC (gộp chấm công). Phải dời logic này trả về src/modules/payroll/payroll.logic.js. Chỉ giữ lại logic thuần túy Push/Pull ở src/core/sync.js.
*   **doanhthu.js, chamcong.js, hoadon.js, thietbi.js**
    - Cứ mỗi file băm thành cặp .ui.js (Xử lý DOM, HTML string) và .logic.js (Tính toán, validate schema, lưu qua store.js).
