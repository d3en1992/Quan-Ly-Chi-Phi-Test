# 🏗️ Antigravity - System Architecture & AI Developer Guide

*Tài liệu này được thiết kế dành riêng cho các AI Coding Assistants (Claude, Cursor, Copilot, v.v.) và Lập trình viên để hiểu rõ kiến trúc, luồng dữ liệu và quy định code của dự án Antigravity sau khi hoàn tất 100% việc chuyển đổi sang ES Modules (ESM).*

---

## 1. Tổng quan Kiến trúc (Architecture Overview)

Dự án sử dụng **Kiến trúc 3 lớp (3-Tier Architecture)** viết bằng **Vanilla JavaScript (ES Modules)**. Mọi thứ được gói gọn trong thư mục `src/`. Tất cả các file script nguyên khối (Monolithic) cũ (như `core.js`, `main.js`, `hoadon.js`...) đã được loại bỏ hoàn toàn khỏi `index.html`. Không còn tồn tại biến global không kiểm soát.

### 📂 Cấu trúc thư mục

```text
Antigravity/
├── index.html              # File entry duy nhất, chứa layout cơ bản.
└── src/
    ├── app.js              # Entry point của ES Modules (nơi import và khởi chạy toàn bộ ứng dụng).
    │
    ├── styles/             # (Layer 0) - Hệ thống giao diện CSS Modular
    │   ├── main.css        # File CSS gốc, chứa @import các file khác.
    │   ├── base.css        # CSS Reset, biến CSS (:root).
    │   ├── layout.css      # Topbar, Nav, cấu trúc khung trang.
    │   ├── components.css  # Buttons, modals, toasts, dropdowns.
    │   └── *.css           # Các CSS riêng cho từng module (auth, dashboard, invoices...).
    │
    ├── utils/              # (Layer 1) - Helpers độc lập, không chứa logic nghiệp vụ
    │   ├── date.util.js    # Tiện ích thời gian (ngày, tháng, ISO).
    │   ├── dom.util.js     # Tiện ích thao tác DOM (toast, autocomplete, modal).
    │   ├── math.util.js    # Format tiền tệ, số học.
    │   └── string.util.js  # Format chuỗi, lọc tiếng Việt, UUID.
    │
    ├── core/               # (Layer 2) - Trái tim của ứng dụng, quản lý Data & State
    │   ├── config.js       # Biến môi trường, hằng số cấu hình.
    │   ├── db.js           # Giao tiếp IndexedDB (load/save/delete).
    │   ├── schema.js       # [QUAN TRỌNG] Schema Validator. Mọi data trước khi lưu phải qua đây.
    │   ├── store.js        # Centralized State Management (Pub/Sub pattern).
    │   ├── sync.js         # Đồng bộ dữ liệu Firebase (Push/Pull, Queue).
    │   └── migrate.js      # Logic nâng cấp, dọn dẹp dữ liệu cũ (Idempotent).
    │
    ├── services/           # (Layer 3) - Logic nghiệp vụ dùng chung (Shared Business Logic)
    │   ├── category.svc.js # Quản lý danh mục (Soft-delete, đồng bộ tên).
    │   ├── excel.svc.js    # Logic Import/Export toàn bộ file Excel.
    │   └── project.svc.js  # Nghiệp vụ công trình, tính KPI, phân bổ chi phí.
    │
    └── modules/            # (Layer 4) - Các phân hệ tính năng độc lập (Logic & UI)
        ├── admin/          # Công cụ kiểm tra sức khỏe dữ liệu (Data Health), nâng cấp Schema.
        ├── advances/       # Module Tiền ứng.
        ├── auth/           # Phân quyền người dùng, quản lý Role.
        ├── backup/         # Quản lý sao lưu JSON và khôi phục.
        ├── cloud/          # UI tương tác với Firebase.
        ├── dashboard/      # Bảng tổng quan, biểu đồ KPI.
        ├── equipment/      # Module Thiết bị máy móc, kho bãi.
        ├── invoices/       # Module Hóa đơn chi phí (Nhập nhanh, Chi tiết).
        ├── nav/            # Thanh điều hướng, bộ lọc theo năm (Year Filter).
        ├── payroll/        # Module Chấm công, Tổng Lương Tuần, Xuất Phiếu Lương.
        ├── projects/       # Module Quản lý Công trình.
        ├── revenue/        # Module Hợp đồng, Doanh thu, Lãi lỗ, Công nợ.
        └── settings/       # Thiết lập danh mục dùng chung.
```

---

## 2. Quy tắc cốt lõi dành cho AI (Golden Rules for AI Agents)

**NẾU BẠN LÀ AI, HÃY ĐỌC KỸ PHẦN NÀY TRƯỚC KHI VIẾT CODE:**

1. **NO GLOBAL VARIABLES**: Tuyệt đối không lưu trạng thái ứng dụng vào các biến toàn cục trên `window`. Trạng thái toàn cục phải được quản lý qua các file module cụ thể. 
2. **SEPARATION OF CONCERNS**:
   * Các hàm thay đổi DOM, render HTML, gắn event listener **BẮT BUỘC** phải nằm trong file `*.ui.js` hoặc `*.module.js`.
   * Các hàm tính toán, lọc mảng, logic phức tạp **BẮT BUỘC** phải là Pure Functions và nằm trong file `*.logic.js`. Tuyệt đối không dùng `document.getElementById` trong các file logic.
3. **SCHEMA VALIDATION IS MANDATORY**: Bất cứ khi nào tạo mới hoặc cập nhật một Object (Hóa đơn, Công trình, Chấm công...), dữ liệu đó phải được chạy qua `schema.js` (`normalizeRecord`) trước khi gọi hàm save vào Database.
4. **SOFT DELETE ONLY**: Không dùng hàm `array.splice()` để xóa vĩnh viễn dữ liệu. Thay vào đó, thiết lập trường `deletedAt = Date.now()` (Soft Delete).
5. **DOM EVENT BINDING**: Thay vì ghi đè hàm lên `window.xxx` để phục vụ `onclick` trong HTML, hãy ưu tiên sử dụng Event Delegation trong file JS ở các tính năng mới. 

---

## 3. Bản đồ điều hướng: Tìm file ở đâu để sửa? (Navigation Guide)

| Yêu cầu của User | Nơi AI cần tìm và sửa |
| :--- | :--- |
| *"Sửa lỗi giao diện hiển thị xấu trên điện thoại"* | Thư mục `src/styles/` (tìm các file css tương ứng như `layout.css`, `components.css` v.v). |
| *"Đổi màu nút lưu, thêm cột mới vào bảng chấm công"* | Thư mục `src/modules/payroll/payroll.ui.js` (chứa HTML string builder) và `src/styles/payroll.css`. |
| *"Sửa lại công thức tính phụ cấp lương"* | Thư mục `src/modules/payroll/payroll.logic.js` |
| *"Sửa lỗi export Excel bị mất cột"* | Thư mục `src/services/excel.svc.js` |
| *"Thay đổi cách lọc dữ liệu hóa đơn theo năm"* | Thư mục `src/modules/nav/nav.ui.js` (logic chuyển năm) và `src/modules/invoices/invoice.logic.js`. |
| *"Sửa lỗi không lưu được dữ liệu xuống Firebase"* | Thư mục `src/core/sync.js` |
| *"Kiểm tra dữ liệu bị lỗi, thừa ID"* | Thư mục `src/modules/admin/admin.module.js` (Sử dụng Data Health Tool). |

---

## 4. Quy trình chuẩn để tạo một tính năng mới (SOP for New Features)

Khi User yêu cầu tạo một module hoàn toàn mới, AI phải tuân thủ chính xác 4 bước sau:

**Bước 1: Khai báo cấu trúc dữ liệu (Data Layer)**
* Mở `src/core/schema.js`.
* Định nghĩa khung chuẩn (schema) cho Object mới (đảm bảo luôn có `id`, `projectId`, `createdAt`, `updatedAt`).
* Đăng ký store IndexedDB mới (nếu cần) trong `src/core/config.js` và cập nhật migrate.js nếu cần thiết.

**Bước 2: Viết Logic (Business Layer)**
* Tạo thư mục `src/modules/<tên_module>/`.
* Tạo file `<tên_module>.logic.js`.
* Viết các pure function để xử lý dữ liệu. Tuyệt đối không thao tác DOM.

**Bước 3: Viết Giao diện (UI Layer & Style)**
* Tạo file `<tên_module>.ui.js`.
* Viết hàm `renderTable()`, `openForm()`. Lấy dữ liệu từ thẻ input, chạy qua logic layer rồi gọi `dbSave()`.
* Tạo file CSS tương ứng `src/styles/<tên_module>.css` và `import` nó vào `src/styles/main.css`.

**Bước 4: Kích hoạt Module (Integration Layer)**
* Mở `src/app.js`.
* Thêm lệnh `import` cho UI module mới và gọi hàm khởi tạo bên trong `bootstrap()` (ví dụ: `init<TênModule>UI()`).
* Báo cáo hoàn thành với User.
