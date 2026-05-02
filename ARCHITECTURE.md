# 🏗️ Antigravity - System Architecture & AI Developer Guide

*Tài liệu này được thiết kế dành riêng cho các AI Coding Assistants (Claude, Cursor, Copilot, v.v.) và Lập trình viên để hiểu rõ kiến trúc, luồng dữ liệu và quy định code của dự án Antigravity sau khi nâng cấp lên ES Modules.*

---

## 1. Tổng quan Kiến trúc (Architecture Overview)

Dự án sử dụng **Kiến trúc 3 lớp (3-Tier Architecture)** viết bằng **Vanilla JavaScript (ES Modules)**. Mọi thứ được gói gọn trong thư mục `src/`, loại bỏ hoàn toàn các script spaghetti cũ và các biến global (`window.data`).

### 📂 Cấu trúc thư mục

```text
Antigravity/
├── index.html              # File entry duy nhất, chứa layout cơ bản.
├── style.css               # File style tổng.
└── src/
    ├── app.js              # Entry point của ES Modules (nơi import tất cả).
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
    │   └── migrate.js      # Logic nâng cấp, dọn dẹp dữ liệu cũ (Idempotent).
    │
    ├── services/           # (Layer 3) - Logic nghiệp vụ dùng chung (Shared Business Logic)
    │   ├── category.svc.js # Quản lý danh mục (Soft-delete, đồng bộ tên).
    │   ├── excel.svc.js    # Logic Import/Export Excel.
    │   └── project.svc.js  # Nghiệp vụ công trình, tính KPI, phân bổ chi phí.
    │
    └── modules/            # (Layer 4) - Các phân hệ tính năng độc lập
        ├── projects/       # Module Quản lý Công trình
        ├── invoices/       # Module Hóa đơn chi phí
        ├── payroll/        # Module Chấm công & Lương
        ├── revenue/        # Module Hợp đồng & Doanh thu
        ├── advances/       # Module Tiền ứng
        └── equipment/      # Module Thiết bị máy móc
```

---

## 2. Quy tắc cốt lõi dành cho AI (Golden Rules for AI Agents)

**NẾU BẠN LÀ AI, HÃY ĐỌC KỸ PHẦN NÀY TRƯỚC KHI VIẾT CODE:**

1. **NO GLOBAL VARIABLES**: Tuyệt đối không lưu trạng thái ứng dụng vào các biến toàn cục (ví dụ: `let inActiveYear = 2026`). Tất cả trạng thái đều phải được get/set qua `store.js`.
2. **SEPARATION OF CONCERNS**:
   * Các hàm thay đổi DOM, render HTML, gắn event listener **BẮT BUỘC** phải nằm trong file `*.ui.js`.
   * Các hàm tính toán, lọc mảng, tính lương, tính thuế **BẮT BUỘC** phải là Pure Functions và nằm trong file `*.logic.js`. Tuyệt đối không dùng `document.getElementById` trong các file logic.
3. **SCHEMA VALIDATION IS MANDATORY**: Bất cứ khi nào tạo mới hoặc cập nhật một Object (Hóa đơn, Công trình, Chấm công...), dữ liệu đó phải được chạy qua `schema.js` (`normalizeRecord`) trước khi gọi hàm save vào Database. Đảm bảo dữ liệu luôn có `id` (UUID) và `projectId`.
4. **SOFT DELETE ONLY**: Không dùng hàm `array.splice()` để xóa dữ liệu. Thay vào đó, set field `deletedAt = Date.now()` (Soft Delete).
5. **IDEMPOTENT MIGRATIONS**: Mọi hàm xử lý di chuyển hoặc sửa lỗi data cũ phải đảm bảo tính idempotent (chạy 1 lần hay 100 lần kết quả vẫn giống nhau, không sinh thêm rác).

---

## 3. Bản đồ điều hướng: Tìm file ở đâu để sửa? (Navigation Guide)

| Yêu cầu của User | Nơi AI cần tìm và sửa |
| :--- | :--- |
| *"Sửa lỗi giao diện hiển thị xấu trên điện thoại"* | Thư mục `style.css` (tìm các khối `@media` queries). |
| *"Thêm màu sắc, chỉnh cỡ chữ, khoảng cách"* | Thư mục `style.css` (tuyệt đối hạn chế inline-style trong JS). |
| *"Đổi màu nút lưu, thêm cột mới vào bảng chấm công"* | Thư mục `src/modules/payroll/payroll.ui.js` (chứa mã tạo HTML động). |
| *"Sửa lại công thức tính phụ cấp lương"* | Thư mục `src/modules/payroll/payroll.logic.js` |
| *"Thêm trường 'Ghi chú' vào form Hóa đơn"* | 1. Thêm validation ở `src/core/schema.js`<br>2. Sửa HTML form ở `src/modules/invoices/invoice.ui.js` |
| *"Sửa lỗi export Excel bị mất cột"* | Thư mục `src/services/excel.svc.js` |
| *"Sửa lỗi không lưu được dữ liệu xuống bộ nhớ"* | Thư mục `src/core/db.js` |

---

## 4. Quy trình chuẩn để tạo một tính năng mới (SOP for New Features)

Khi User yêu cầu tạo một module hoàn toàn mới (Ví dụ: **Module Quản lý Nghỉ Phép**), AI phải tuân thủ chính xác 4 bước sau:

**Bước 1: Khai báo cấu trúc dữ liệu (Data Layer)**
* Mở `src/core/schema.js`.
* Định nghĩa khung chuẩn (schema) cho Nghỉ Phép (ví dụ: cần có `id`, `workerId`, `fromDate`, `toDate`, `reason`).
* Đăng ký key IndexedDB mới (nếu cần) trong `src/core/config.js`.

**Bước 2: Viết Logic (Business Layer)**
* Tạo thư mục `src/modules/leave/`.
* Tạo file `leave.logic.js`.
* Viết các hàm pure function tính toán số ngày nghỉ, kiểm tra ngày trùng lặp, logic duyệt/từ chối. 
* *Lưu ý:* Không import bất kỳ thứ gì liên quan đến DOM vào đây.

**Bước 3: Viết Giao diện (UI Layer)**
* Tạo file `leave.ui.js`.
* Viết hàm `renderLeaveTable()`, `openLeaveForm()`.
* Bắt sự kiện click button, lấy dữ liệu từ `input` -> gọi hàm logic ở Bước 2 -> gọi hàm `save()` để lưu vào IndexedDB.

**Bước 4: Kích hoạt Module (Integration Layer)**
* Mở `src/app.js`.
* Thêm import cho module mới:
  ```javascript
  import './modules/leave/leave.logic.js';
  import './modules/leave/leave.ui.js';
  ```
* Báo cáo hoàn thành với User.
