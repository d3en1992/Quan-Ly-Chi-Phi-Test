# Kế hoạch Hành động (Vibecode-Friendly)

Dưới đây là checklist từng bước cực kỳ an toàn. Nguyên tắc tối thượng: **Làm đến đâu, App vẫn chạy bình thường đến đó**. Chúng ta sẽ không đập app đi, mà sẽ xây nhà mới ngay bên cạnh nhà cũ, rồi dọn dần đồ sang.

## Giai đoạn 1: Tạo Khung Xương (Infrastructure)
- [ ] Tạo toàn bộ cấu trúc thư mục rỗng trong dự án (Tạo thư mục `src/`, `core/`, `utils/`, `services/`, `modules/`...).
- [ ] Cập nhật `index.html`: Thêm thẻ `<script type="module" src="src/app.js"></script>` lên đầu.
- [ ] Phân chia lại CSS: Tạo `src/styles/` và chèn các `@import` vào `style.css` gốc.

## Giai đoạn 2: Nhặt "Đồ Nghề" (Tách Utils)
*Mục tiêu: Làm sạch code cũ, gom các hàm tính toán chung vào một chỗ.*
- [ ] Tạo `src/utils/math.util.js`: Bốc các hàm `fmtM`, `parseMoney` từ `tienich.js` sang. *(Tạm thời gán vào `window.fmtM` để code cũ không bị lỗi).*
- [ ] Tạo `src/utils/date.util.js`: Bốc các hàm `today`, `formatViDate` sang.
- [ ] Tạo `src/utils/string.util.js`: Bốc hàm `normalizeKey` sang.
- [ ] Tạo `src/utils/dom.util.js`: Bốc hàm `toast`, `showModal` sang.

## Giai đoạn 3: Xây Lõi & Dịch Vụ (Core & Services)
*Mục tiêu: Thiết lập trung tâm dữ liệu và kiểm duyệt.*
- [ ] Tạo `src/core/schema.js`: Viết các rule chuẩn hóa dữ liệu đầu vào.
- [ ] Tạo `src/core/store.js`: Thiết lập kho lưu trữ State (chứa `activeYear`).
- [ ] Tạo `src/services/project.svc.js`: Bốc hàm `findProjectIdByName` và logic tính Overhead từ `projects.js` sang.

## Giai đoạn 4: Di dời từng Phòng (Cuốn chiếu Modules)
*Mục tiêu: Bốc từng file cũ sang thư mục mới theo chuẩn ES Modules. Cứ làm xong 1 file là kiểm tra app ngay.*
- [ ] Tách `projects.js` (87KB) thành `modules/projects/project.ui.js` và `project.logic.js`.
- [ ] Tách `hoadon.js` sang `modules/invoices/`.
- [ ] Tách `chamcong.js` sang `modules/payroll/`.
- [ ] Tách Tiền ứng từ `danhmuc.js` sang `modules/advances/`.
- [ ] Tách `doanhthu.js` sang `modules/revenue/`.
- [ ] Tách `thietbi.js` sang `modules/equipment/`.
- [ ] Tách cài đặt danh mục sang `modules/settings/`.
- [ ] Bốc phần Dashboard sang `modules/dashboard/`.

## Giai đoạn 5: Dọn Rác (Cleanup)
- [ ] Tạo `src/modules/backup/` cho các tính năng sao lưu.
- [ ] Xóa bỏ toàn bộ các thẻ `<script>` cũ trong `index.html` (Vì giờ mọi thứ đã chạy qua `app.js`).
- [ ] Gỡ bỏ các hàm tạm thời gắn trên `window` ở Giai đoạn 2.
- [ ] Chạy thử toàn bộ luồng dữ liệu, test sync Firebase.
