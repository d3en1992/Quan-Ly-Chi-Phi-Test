# Kiến Trúc ES Modules Dự Kiến (Antigravity Modular)

Dựa trên yêu cầu của bạn muốn chia thành khoảng 20-30 file theo chuẩn ES Modules (Domain-Driven Design), đây là sơ đồ kiến trúc tối ưu nhất. Cấu trúc này chia tách rõ ràng UI, Logic, Database và Tiện ích.

## Tóm tắt Cấu trúc (Tổng cộng ~26 files)

```text
src/
├── app.js                     # (1) Entry point: Khởi tạo toàn bộ ứng dụng
├── core/                      # ── LỚP NỀN TẢNG (Hạ tầng, Database, Sync)
│   ├── config.js              # (2) Cấu hình: Constants, Tên bảng DB
│   ├── db.js                  # (3) Dexie.js: Kết nối IndexedDB
│   ├── store.js               # (4) Quản lý State: Thay thế các mảng global (invoices, ccData...)
│   ├── sync.js                # (5) Firebase: Logic đẩy/kéo dữ liệu
│   ├── migrate.js             # (6) Logic chuẩn hóa dữ liệu cũ khi app load
│   └── schema.js              # (7) [MỚI] Schema: Chuẩn hóa dữ liệu đầu vào (Validation)
├── utils/                     # ── LỚP TIỆN ÍCH (Hàm thuần túy dùng chung)
│   ├── date.util.js           # (8) formatViDate, today, ccSundayISO
│   ├── math.util.js           # (9) fmtM, numFmt, parseMoney
│   ├── string.util.js         # (10) normalizeKey, normalizeName
│   └── dom.util.js            # (11) toast, showModal, các UI helpers
├── services/                  # ── LỚP DỊCH VỤ CHUNG (Logic nghiệp vụ dùng chéo)
│   ├── project.svc.js         # (12) Logic dùng chung: Hàm resolve ID/Name, tính overhead
│   ├── category.svc.js        # (13) Logic Danh mục (Thầu phụ, Công nhân...)
│   └── excel.svc.js           # (14) Logic Nhập/Xuất Excel (nhapxuat.js cũ)
└── modules/                   # ── LỚP TÍNH NĂNG (Giao diện & Logic từng Tab)
    ├── auth/
    │   └── auth.module.js     # (15) Đăng nhập, phân quyền Role
    ├── backup/                # [MỚI] (Backup & Phục hồi)
    │   ├── backup.logic.js    # (16) Logic Auto-backup, xuất JSON snapshot
    │   └── backup.ui.js       # (17) Giao diện nút bấm tải/khôi phục dữ liệu
    ├── projects/              # [MỚI] (Tab Công Trình)
    │   ├── project.logic.js   # (18) Logic tính toán thẻ trạng thái, biểu đồ mini
    │   └── project.ui.js      # (19) Render danh sách thẻ công trình (Cards)
    ├── invoices/              # (Tab Hóa đơn)
    │   ├── invoice.logic.js   # (20) Logic tính toán tiền, validate hóa đơn
    │   └── invoice.ui.js      # (21) Logic render HTML, bắt sự kiện click
    ├── payroll/               # (Tab Chấm công)
    │   ├── payroll.logic.js   # (22) Logic chấm công, tính lương
    │   └── payroll.ui.js      # (23) Logic render bảng chấm công
    ├── advances/              # (Tiền ứng - Tách từ danhmuc.js cũ)
    │   ├── advance.logic.js   # (24) Logic kiểm tra số dư, đối tượng ứng
    │   └── advance.ui.js      # (25) Render bảng tiền ứng
    ├── revenue/               # (Tab Doanh thu)
    │   ├── revenue.logic.js   # (26) Logic Hợp đồng, Thu tiền, Công nợ
    │   └── revenue.ui.js      # (27) Render giao diện doanh thu
    ├── equipment/             # (Tab Thiết bị)
    │   ├── equipment.logic.js # (28) Logic điều chuyển KHO TỔNG <-> CT
    │   └── equipment.ui.js    # (29) Render kho thiết bị
    ├── settings/
    │   └── settings.module.js # (30) Cài đặt danh mục (Thêm/xóa tên danh mục)
    └── dashboard/
        └── dashboard.module.js# (31) Vẽ biểu đồ thống kê
```

## Giải thích chi tiết sự phân chia

### 1. Xử lý "Năm đang chọn" (activeYear) và Lọc công trình theo năm ở đâu?
Đây là câu hỏi rất hay. Hiện tại biến `activeYear` đang nằm lơ lửng ở `main.js`. Trong kiến trúc mới, chúng ta xử lý như sau:
- **Biến lưu trữ (State)**: Biến `activeYear` (hoặc `activeYears` nếu chọn nhiều năm) sẽ được lưu trong `core/store.js`. Bất kỳ module nào đổi năm (qua giao diện chọn năm) đều phải gọi `store.setActiveYear(2024)`.
- **Hàm kiểm tra ngày tháng cơ bản**: Hàm `inActiveYear(dateString)` sẽ nằm ở `utils/date.util.js`. Nó chỉ làm nhiệm vụ thuần túy: "Chuỗi ngày này có thuộc năm đang chọn không?".
- **Logic Lọc Công Trình (`_ctInActiveYear`)**: Logic phức tạp quyết định xem một Công trình có được hiển thị trong dropdown của năm 2024 hay không sẽ nằm ở `services/project.svc.js`. Ví dụ, `ProjectService.getProjectsForYear(year)` sẽ query từ Store tất cả dự án có phát sinh trong năm đó. 

### 2. Schema chuẩn hóa dữ liệu đặt ở đâu?
Việc thêm Schema là bước cực kỳ đúng đắn để chặn dữ liệu "rác" ngay từ vòng gửi xe.
- **Vị trí**: Tạo thêm một file `src/core/schema.js` (hoặc `validators.js`).
- **Cách hoạt động**: Trong file này, bạn định nghĩa các cấu trúc chuẩn. Ví dụ `validateInvoice(data)`. Nó sẽ kiểm tra xem `data` có trường `projectId` chưa, `amount` có phải là số không. 
- Khi `invoice.logic.js` muốn lưu dữ liệu, nó sẽ gọi `validateInvoice()` trước. Nếu đúng schema mới cho phép đẩy xuống `store.js`. Việc gom schema vào lõi `core/` giúp cả app dùng chung một bộ quy tắc, dù nhập từ UI hay import từ Excel đều phải tuân thủ.

### 3. Có nên chia HTML và CSS không?
**Có, nhưng theo chiến lược sau để không bị rối:**

**Với CSS (Hiện tại `style.css` đang nặng 66KB):**
Nên chia nhỏ bằng cách dùng cú pháp `@import` của CSS. Tạo folder `src/styles/`:
```css
/* Trong file style.css chính */
@import url('./styles/variables.css'); /* Màu sắc, font chữ */
@import url('./styles/layout.css');    /* Header, Sidebar */
@import url('./styles/table.css');     /* Các bảng chung */
@import url('./styles/hoadon.css');    /* Riêng cho tab hóa đơn */
```
Khi load HTML, bạn chỉ nạp đúng 1 file `style.css` này, trình duyệt sẽ tự động gom các file con lại. Rất sạch sẽ.

**Với HTML (Hiện tại `index.html` quá dài):**
Vì đây là app Vanilla JS (không dùng React/Vue), việc tách HTML thành nhiều file `.html` rồi load bằng JS `fetch()` sẽ gây lag và khó làm. Chiến lược tốt nhất là:
1. **Giữ `index.html` làm khung sườn (Shell):** Chỉ chứa Header, Sidebar, và các thẻ `<div id="page-hoadon"></div>` rỗng.
2. **Đẩy nội dung vào `*.ui.js`:** Các đoạn HTML chi tiết (như bảng, form nhập liệu) sẽ được chuyển thành **Template Strings** (chuỗi backtick) bên trong các file `invoice.ui.js`, `payroll.ui.js`.
3. Khi người dùng click vào Tab Hóa Đơn, hàm trong `invoice.ui.js` sẽ vẽ (render) chuỗi HTML đó nhét vào thẻ `<div id="page-hoadon"></div>`. 

Cách này gọi là "Component-based Vanilla JS", vừa giúp `index.html` cực nhẹ, vừa gắn chặt HTML với code xử lý sự kiện của nó!

### 4. Tại sao lại chia `*.logic.js` và `*.ui.js` ở các module lớn?
- **Ví dụ Module Hóa Đơn (`invoices`)**: 
  - `invoice.logic.js`: Chứa hàm `saveInvoice(data)` nhận một object data, kiểm tra xem số tiền có âm không, công trình có tồn tại không, rồi gọi `store.js` để lưu. Tuyệt đối **không** đụng chạm tới DOM (không dùng `document.getElementById`).
  - `invoice.ui.js`: Chứa hàm `renderHdcTable()`. Nó gọi hàm lấy data từ `invoice.logic.js`, sau đó nhét data vào các chuỗi HTML `<tr>...</tr>` và in ra màn hình.
  
### 5. Xử lý Backup (Snapshot JSON, Auto-backup)
Dữ liệu là mạng sống của app. Chức năng Backup sẽ được tách thành một module riêng: `src/modules/backup/`.
- **`backup.logic.js`**: Chứa logic tự động chạy ngầm (Auto-backup) mỗi khi có thay đổi lớn, hoặc logic xuất toàn bộ IndexedDB ra một cục JSON (Snapshot).
- **`backup.ui.js`**: Chứa giao diện (nút bấm tải file JSON, chọn file JSON để khôi phục). 
- Bằng cách này, logic xuất file JSON không làm rác các file UI khác.

### 6. Tại sao `projects.js` hiện tại nặng tới 87KB và nên chia thế nào?
Bạn thắc mắc rất đúng. File `projects.js` của bạn hiện tại quá khổ (hơn 1800 dòng code) vì nó đang "ôm rơm rặng bụng" 4 nhiệm vụ hoàn toàn khác nhau:
1. **Lưu trữ dữ liệu**: Biến global `let projects = []`.
2. **Logic Nghiệp vụ (Service)**: Hàm giải quyết Tên -> ID (`findProjectIdByName`), tính toán phân bổ chi phí chung (`allocateCompanyCost`).
3. **Logic Giao diện (UI Tab)**: Code vẽ giao diện "Thẻ công trình", tô màu "Đang thi công", "Đã quyết toán" (`_PT_STATUS_META`).
4. **Logic Chuyển đổi dữ liệu cũ (Migration)**: Hàm `migrateProjectLinks()` và `deduplicateProjects()`. Hai hàm này dài hàng trăm dòng, phải duyệt qua TẤT CẢ hóa đơn, chấm công để sửa lỗi dữ liệu. 

**Cách "giải phẫu" `projects.js` (87KB) trong kiến trúc mới:**
- **Nhét phần số 1 vào `core/store.js`**.
- **Nhét phần số 2 vào `services/project.svc.js`** (Để các tab khác có thể tái sử dụng).
- **Nhét phần số 3 vào `modules/projects/project.ui.js`** (Chỉ lo vẽ cái Tab Công Trình).
- **Nhét phần số 4 vào `core/migrate.js`** (Chạy 1 lần lúc app vừa mở lên rồi ẩn đi, không nằm chình ình trong file nghiệp vụ nữa).

Sự phân chia này sẽ xé nhỏ cục 87KB ra thành 4 file nhỏ (khoảng 10-20KB mỗi file), giúp bạn chỉnh sửa UI mà không sợ vô tình làm hỏng logic tính toán!
- **Lợi ích**: Khi bạn cần xuất báo cáo hoặc test lỗi tính tiền, bạn chỉ cần xem `logic.js`. Khi giao diện bị lệch CSS, bạn chỉ cần sửa `ui.js`. Điều này giúp code cực kỳ dễ debug bằng AI.

### 2. Tầng `services` giải quyết vấn đề gì?
Hiện tại, `nhapxuat.js`, `hoadon.js`, `chamcong.js` đều phải tự viết hàm tìm `projectId` từ tên công trình.
Trong kiến trúc mới, chúng ta có `project.svc.js`. Bất kỳ module nào cần biến Tên thành ID chỉ cần gọi: `import { resolveProjectId } from '../../services/project.svc.js'`. Giảm thiểu hàng nghìn dòng code lặp.

### 3. Tầng `core/store.js` là Trái tim mới
Thay vì khai báo `let invoices = []` lơ lửng, `store.js` sẽ đóng vai trò như thủ kho.
Bất kỳ ai muốn lấy hóa đơn phải gọi `store.getInvoices()`. Bất kỳ ai muốn lưu hóa đơn phải gọi `store.addInvoice(data)`. `store.js` sẽ tự động lo việc lưu xuống IndexedDB (`db.js`).

## Lộ trình Chuyển đổi Đề xuất (Migration Strategy)

Vì bạn đã chấp nhận làm mới và có thể reset dữ liệu, đây là lộ trình an toàn:

1. **Bước 1: Xây nền móng (Core & Utils)**
   - Tạo các file trong `core/` và `utils/`.
   - Di chuyển các hàm format hiện tại vào `utils/`.

2. **Bước 2: Xây Dịch vụ (Services)**
   - Tách logic Công trình và Danh mục vào `services/`.

3. **Bước 3: Chuyển đổi Modules (UI & Logic)**
   - Thực hiện theo thứ tự: `settings` -> `equipment` -> `advances` -> `invoices` -> `payroll` -> `revenue`.
   - Cứ làm xong module nào thì ráp vào `app.js` để test ngay.

4. **Bước 4: Nối Sync & Import**
   - Viết lại `sync.js` theo chuẩn mới.
   - Thêm `excel.svc.js` để import lại dữ liệu cũ.

> [!IMPORTANT]
> **User Review Required**
> 
> Bạn có đồng ý với số lượng file (~26 files) và cách phân chia ranh giới Logic/UI như trên không? Nếu bạn "Ok", tôi sẽ bắt đầu tạo các thư mục này trong ổ đĩa của bạn và viết những file `Utils` đầu tiên để làm nền tảng.
