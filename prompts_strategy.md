# Chiến Lược Mega Prompts (Dành cho Vibecode)

Để giải quyết 5 giai đoạn mà không làm AI bị "ngợp" (overload context), bạn sẽ cần sử dụng khoảng **8 - 10 Mega Prompts**. Nguyên tắc: Mỗi Prompt chỉ giải quyết **1 nhóm file nhỏ** và có đầu ra rõ ràng.

Dưới đây là kế hoạch chi tiết từng Prompt bạn cần copy-paste cho AI (Cursor/Claude).

---

## 🛠️ Mega Prompt 1: Dọn Dẹp Utils (Giai đoạn 2)
**Bối cảnh:** Tách các hàm tiện ích từ file cũ rích rắc rối.
- **Files cần cung cấp cho AI:** `tienich.js`
- **Mục tiêu:** Bốc các hàm độc lập ra các file Utils.
- **Nội dung Mega Prompt:**
  > "Tôi đang tái cấu trúc app sang ES Modules. Hãy đọc file `tienich.js` của tôi. 
  > 1. Trích xuất tất cả các hàm liên quan đến định dạng tiền tệ (`fmtM`, `parseMoney`, v.v.) và viết vào file `src/utils/math.util.js`. Export chúng ra.
  > 2. Trích xuất các hàm liên quan đến ngày tháng (`today`, `formatViDate`...) vào `src/utils/date.util.js`.
  > 3. Trích xuất `normalizeKey` vào `src/utils/string.util.js`.
  > 4. Trích xuất `toast`, `showModal` vào `src/utils/dom.util.js`.
  > **Quan trọng:** Để không làm vỡ app cũ, ở cuối các file util này, hãy tạm thời gán chúng vào `window` (VD: `window.fmtM = fmtM`). Đừng sửa hay xóa file `tienich.js` cũ vội."

---

## 🧠 Mega Prompt 2: Xây Lõi Dữ Liệu (Giai đoạn 3)
**Bối cảnh:** Tạo trung tâm quản lý State và chuẩn hóa dữ liệu.
- **Files cần cung cấp cho AI:** `PROJECT_ANALYTICS.md` (để AI hiểu dữ liệu) + `core.js` (cũ).
- **Mục tiêu:** Thiết lập Store và Schema.
- **Nội dung Mega Prompt:**
  > "Hãy đọc `PROJECT_ANALYTICS.md` để hiểu các loại dữ liệu của app. Tôi cần bạn viết 2 file cốt lõi bằng ES Modules:
  > 1. `src/core/schema.js`: Viết các hàm Validator (VD: `validateInvoice`, `validateProject`) đảm bảo dữ liệu có đủ `id`, `projectId`, `createdAt`.
  > 2. `src/core/store.js`: Viết một class hoặc module quản lý toàn bộ State (dùng biến `activeYear`, mảng `invoices`, `projects`...). Cung cấp các hàm Getter/Setter (VD: `getInvoices()`, `addInvoice(data)`) và gọi qua Schema để check lỗi trước khi lưu xuống DB. Không viết logic vẽ UI ở đây."

---

## 🏗️ Mega Prompt 3: Giải Phẫu Cục Bướu `projects.js` (Giai đoạn 3 & 4)
**Bối cảnh:** File `projects.js` quá nặng (87KB), cần chia làm 4.
- **Files cần cung cấp cho AI:** `projects.js` (cũ).
- **Mục tiêu:** Tách logic dùng chung và logic dọn rác.
- **Nội dung Mega Prompt:**
  > "File `projects.js` của tôi dài hơn 1800 dòng. Hãy đọc và xé nhỏ nó ra làm 3 phần, tuyệt đối không được sót logic:
  > 1. Tách các hàm như `getProjectAutoStartDate`, `getProjectDays`, `allocateCompanyCost`, `findProjectIdByName` sang file `src/services/project.svc.js`. 
  > 2. Tách các hàm dài ngoằng `migrateProjectLinks()` và `deduplicateProjects()` sang file `src/core/migrate.js`.
  > 3. Tách toàn bộ phần HTML DOM (vẽ `_PT_STATUS_META`, `_buildProjOpts`...) sang `src/modules/projects/project.ui.js`.
  > Dùng `export/import` chuẩn ES Modules."

---

## 🧩 Mega Prompts 4 đến 8: Xử lý Từng Tab Chức Năng (Giai đoạn 4)
*Lưu ý: Bạn sẽ lặp lại cấu trúc Prompt này cho từng module (Hóa đơn, Chấm công, Doanh thu...). Đừng làm 2 module cùng lúc.*

**Ví dụ Mega Prompt 4 (Tách Tab Hóa Đơn):**
- **Files cần cung cấp cho AI:** `hoadon.js` (cũ) + `src/core/store.js` + `src/core/schema.js`.
- **Mục tiêu:** Chia ranh giới UI và Logic cho Hóa đơn.
- **Nội dung Mega Prompt:**
  > "Bây giờ chúng ta sẽ chuyển đổi module Hóa Đơn. Hãy đọc `hoadon.js`. 
  > Nhiệm vụ của bạn là tạo 2 file mới theo chuẩn ES Modules:
  > 1. `src/modules/invoices/invoice.logic.js`: Bốc toàn bộ logic tính toán (tổng tiền, lưu DB, xóa mềm) sang đây. Lưu ý: Thay vì ghi trực tiếp vào biến global `invoices`, hãy gọi các hàm từ `store.js` mà chúng ta đã làm.
  > 2. `src/modules/invoices/invoice.ui.js`: Bốc toàn bộ các hàm có `document.getElementById`, `innerHTML` sang đây. UI file sẽ gọi hàm từ Logic file để lấy data.
  > Đảm bảo import đầy đủ các hàm format từ `src/utils/*.js`."

*(Bạn làm tương tự như Prompt 4 cho `chamcong.js`, `doanhthu.js`, `thietbi.js`, `danhmuc.js`).*

---

## 🧹 Mega Prompt Cuối Cùng: Nối Dây & Dọn Rác (Giai đoạn 5)
**Bối cảnh:** App đã chia xong, giờ là lúc nối lại và bỏ đồ cũ.
- **Files cần cung cấp cho AI:** `index.html`, `src/app.js` và thư mục `src/`.
- **Mục tiêu:** Kích hoạt ES Modules.
- **Nội dung Mega Prompt:**
  > "Tất cả các module đã sẵn sàng. Bây giờ:
  > 1. Hãy cấu hình file `src/app.js` làm Entry Point. Import các hàm khởi tạo từ tất cả các module UI (VD: `initInvoiceUI()`, `initPayrollUI()`).
  > 2. Gợi ý cho tôi cách xóa an toàn tất cả các thẻ `<script>` gọi file cũ (như `<script src="hoadon.js">`) trong `index.html`, và thay bằng đúng 1 thẻ `<script type="module" src="src/app.js"></script>`.
  > 3. Hướng dẫn tôi gỡ bỏ các biến `window` tạm thời ở các file utils."
