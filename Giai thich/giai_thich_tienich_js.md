# 📘 GIẢI THÍCH FILE `tienich.js` (UTILS)

> **File:** `tienich.js` (hoặc `utils.js`) · **693 dòng** · Load thứ 2 trong hệ thống
> **Vai trò:** Hộp đồ nghề chứa các công cụ dùng chung cho toàn bộ ứng dụng (tính toán, định dạng số, bàn phím ảo, gom dữ liệu).

---

## PHẦN 1: TỔNG HỢP HÓA ĐƠN (`buildInvoices`)

### 1. Mục đích
Gom chung hóa đơn tự nhập bằng tay và tiền lương thợ (từ tab Chấm công) thành **một danh sách duy nhất**. Đây là dữ liệu gốc để mọi báo cáo, biểu đồ trong app tính toán tổng chi phí.

### 2. Giải thích dễ hiểu
Bình thường, bạn nhập hóa đơn mua vật tư ở một nơi (tab Hóa đơn), và chấm công thợ ở một nơi khác (tab Chấm công).
Tuy nhiên, khi chủ thầu muốn xem **"Tổng chi phí công trình này là bao nhiêu?"**, họ muốn thấy CẢ tiền vật tư LẪN tiền lương thợ.
Hàm này đóng vai trò như một người kế toán tổng hợp: Nó nhặt hóa đơn mua vật tư, qua tab chấm công nhặt thêm bảng lương (biến lương thành hóa đơn vô hình), rồi gộp tất cả lại thành một tệp hồ sơ duy nhất.

### 3. Ví dụ thực tế trong app
- Hóa đơn A: Mua sắt 10 triệu
- Hóa đơn B: Mua cát 2 triệu
- Bảng chấm công: Lương thợ tuần này 15 triệu
→ Hàm này gộp lại thành danh sách 3 hóa đơn để vẽ biểu đồ tổng chi 27 triệu.

### 4. Logic xử lý dữ liệu
- **Input:** Mảng `inv_v3` (hóa đơn nhập tay) và `cc_v2` (dữ liệu chấm công tuần).
- **Output:** Mảng `invoices` duy nhất (chứa cả manual + cc).
- **Khi nào chạy:** Khi app cần vẽ báo cáo, dashboard, danh sách hóa đơn (qua hàm `getInvoicesCached()`).

### 5. Code chính
```javascript
function buildInvoices() {
  const _invRaw = load('inv_v3', []); // Hóa đơn tay
  const _ccRaw  = load('cc_v2',  []); // Dữ liệu chấm công

  // Lấy hóa đơn nhập tay chưa bị xóa
  const manual = _invRaw.filter(inv => !inv.deletedAt);

  const ccInvs = [];
  _ccRaw.filter(w => !w.deletedAt).forEach(week => {
    // 1. Biến hóa đơn mua lẻ của thợ thành hóa đơn hệ thống
    // 2. Biến Tổng lương tuần của thợ thành hóa đơn hệ thống
    ccInvs.push({
      id: ncKey, source: 'cc',
      loai: 'Nhân Công', nd: 'Lương tuần...',
      tien: totalLuong, thanhtien: totalLuong
    });
  });

  return [...manual, ...ccInvs]; // Trộn 2 mảng lại
}
```

### 6. Diễn giải code
| Dòng / Cụm từ | Ý nghĩa |
|---|---|
| `source: 'cc'` | Đánh dấu hóa đơn này là "Hàng nội bộ" sinh ra từ module Chấm Công, để sau này cấm không cho xóa ở tab Hóa đơn. |
| `!w.deletedAt` | Chỉ lấy những tuần chấm công chưa bị xóa bỏ. |
| `getInvoicesCached()` | Vì việc trộn này tốn thời gian, app tạo sẵn hàm "Cache" để lưu kết quả trộn lại, ai cần thì dùng luôn cho nhanh. |

### 7. Kết luận
Hiểu phần này giúp bạn:
- Biết tại sao tiền lương thợ tự động chui vào bảng chi phí công trình.
- Không thắc mắc tại sao có một số hóa đơn không thể bấm xóa (vì nó là lương thợ, phải qua tab Chấm Công để xóa/sửa).

---

## PHẦN 2: CHUẨN HÓA VÀ ĐỊNH DẠNG SỐ TIỀN (`parseMoney`, `numFmt`)

### 1. Mục đích
- Làm đẹp số tiền để đọc (VD: 1000000 → 1,000,000 đ)
- Hiểu ý người dùng khi họ gõ tắt (VD: "1.5tr" → 1,500,000)

### 2. Giải thích dễ hiểu
Dân công trình hay gõ tắt cho lẹ: "500k", "1.5tr", "2tỷ". Máy tính bình thường chỉ hiểu số "500000".
Hàm `parseMoney` là bộ não ngôn ngữ. Nó đọc được mọi kiểu bạn gõ: có dấu phẩy, có dấu chấm, có chữ k, chữ tr, chữ tỷ... và dịch hết về 1 con số nguyên chuẩn xác.
Hàm `numFmt` thì ngược lại, lấy con số chuẩn xác đó gắn dấu phẩy vào cho đẹp mắt khi hiển thị lên màn hình.

### 3. Ví dụ thực tế trong app
- Gõ vào ô đơn giá: `1.5tr` → App tự biến thành `1,500,000`.
- Gõ: `2tỷ` → App tự biến thành `2,000,000,000`.
- Gõ: `1,500.5` → App tự biến thành `1500`.

### 4. Logic xử lý dữ liệu
- **Input:** Một chuỗi văn bản bất kỳ do người dùng gõ.
- **Output:** Số nguyên toán học.

### 5. Code chính
```javascript
function parseMoney(raw) {
  const s = String(raw).trim().toLowerCase().replace(/\s+/g,'');
  
  // Dò tìm các chữ viết tắt: tỷ, tr, k
  const unitMap = [
    [/^([\d,.]+)tỷ$/,   1e9],
    [/^([\d,.]+)tr$/,   1e6],
    [/^([\d,.]+)k$/,    1e3],
  ];
  for (const [rx, mult] of unitMap) {
    const m = s.match(rx);
    if (m) {
      // Xử lý dấu phẩy/chấm rồi nhân với triệu/tỷ
      return Math.round(num * mult);
    }
  }
  // Nếu chỉ gõ số, tự đoán đâu là dấu phẩy phân cách hàng nghìn để xóa đi
  // ...
}
```

### 6. Diễn giải code
| Logic | Ý nghĩa |
|---|---|
| `1e9, 1e6, 1e3` | Tương ứng với 1 Tỷ, 1 Triệu, 1 Ngàn. |
| `Math.round` | Làm tròn số, vứt bỏ số thập phân (vì tiền Việt Nam không xài số lẻ). |
| `numFmt(n)` | Format số `1500000` thành `1,500,000`. |
| `fmtS(n)` | Viết tắt siêu gọn cho biểu đồ: `1,500,000` → `1.5 tr`. |

### 7. Kết luận
Tính năng "nhập lẹ" này giúp thao tác điện thoại cực nhanh.

---

## PHẦN 3: BỘ LỌC THÔNG MINH THEO NĂM (`inActiveYear`, `_entityInYear`)

### 1. Mục đích
Quyết định xem một Công trình, Thợ, hay Máy móc có được **xuất hiện trên màn hình** của "Năm hiện tại" hay không.

### 2. Giải thích dễ hiểu
Nếu năm nay là 2026, bạn không muốn thấy danh sách 50 công trình của năm 2023. Bạn chỉ muốn thấy những dự án ĐANG làm năm nay.
Tuy nhiên, hệ thống không bắt bạn phải đi ngồi check từng công trình. Nó tự tìm:
- Chỗ công trình A này năm nay có tờ hóa đơn nào không?
- Hoặc có ai chấm công ở đó không?
- Hoặc có máy xúc nào đang chạy ở đó không?
Nếu có BẤT KỲ hoạt động nào sinh ra trong năm nay → Nó sẽ hiện công trình đó lên cho bạn chọn. Nếu cả năm im lìm → Nó tự giấu đi cho gọn.

### 3. Ví dụ thực tế trong app
- "CT A DŨNG" xong năm 2025. Chọn năm 2026 -> Dropdown chọn công trình sẽ không hiện "CT A DŨNG" nữa.
- Anh thợ "A LONG" nghỉ làm từ 2024. Chọn năm 2026 -> Danh sách công nhân không hiện "A LONG" nữa.

### 4. Code chính
```javascript
function _entityInYear(name, type) {
  if (type === 'ct') {
    // CT xuất hiện nếu có HĐ, CC, hoặc tiền ứng trong NĂM ĐANG CHỌN
    return invoices.some(i  => !i.deletedAt  && inActiveYear(i.ngay) && i.congtrinh === name)
        || ccData.some(w    => !w.deletedAt  && inActiveYear(w.fromDate) && w.ct === name)
        || ungRecords.some(r => !r.deletedAt && inActiveYear(r.ngay) && r.congtrinh === name);
  }
  if (type === 'cn') {
    // Công nhân xuất hiện nếu có đi làm trong năm nay
    return ccData.some(w => !w.deletedAt && inActiveYear(w.fromDate)
        && w.workers.some(wk => wk.name === name));
  }
}
```

### 7. Kết luận
- Giúp app không bị rối rắm rác rưởi qua các năm. Dữ liệu cũ tự động tàng hình nhưng không bị mất đi.

---

## PHẦN 4: BÀN PHÍM SỐ CẢM ỨNG (NUMPAD OVERLAY)

### 1. Mục đích
Tạo ra một **bàn phím số to, rõ** ngay trên giao diện web để nhập tiền hoặc ngày công dễ dàng trên màn hình cảm ứng điện thoại, thay vì dùng bàn phím số bé xíu của iPhone/Android.

### 2. Giải thích dễ hiểu
Đứng ngoài công trường nắng chói, tay đeo găng tay bấm bàn phím nhỏ rất dễ sai. App tự bật một Bảng Tính Bỏ Túi (Numpad) to đùng che nửa màn hình. Bạn có thể bấm `500 * 3` nó tự ra `1,500,000`. Cực kỳ hữu dụng cho thợ và cai thầu.

### 3. Ví dụ thực tế trong app
Khi chạm vào ô "Số tiền", một bàn phím hiện lên với các nút bự: `000` (nhập lẹ hàng ngàn), `+`, `-`, `x`, `/`. Bấm `15` `000` `000` nó hiện `15,000,000`.

### 5. Code chính
```javascript
function numpadKey(k) {
  if(k==='C') {
    _npRaw='0'; _npOp=null; // Xóa trắng
  } else if(k==='⌫') {
    _npRaw = _npRaw.slice(0,-1); // Xóa 1 số
  } else if(k==='000') {
    _npRaw = _npRaw + '000'; // Phím tắt 3 số 0
  } else if(['÷','×','−','+'].includes(k)) {
    // Bấm phép tính (+ - x /)
    _npLeft = parseInt(_npRaw)||0; 
    _npRaw = '0';
    _npOp = k;
  } else {
    _npRaw = _npRaw + k; // Bấm số bình thường
  }
  _npRefresh();
}
```

---

## PHẦN 5: ĐIỀU HƯỚNG BẰNG BÀN PHÍM (KEYBOARD NAV)

### 1. Mục đích
Giúp dân kế toán dùng laptop **nhập liệu nhanh bằng bàn phím**, không cần cầm chuột click click.

### 2. Giải thích dễ hiểu
Giống hệt Excel:
- Gõ xong số tiền, bấm `Enter` -> Con nháy tự nhảy sang ô bên cạnh.
- Hết dòng, bấm `Enter` -> Tự nhảy xuống dòng dưới.
- Bấm `Shift + Enter` -> Tự động sinh thêm 1 dòng trắng mới.
- Bấm `Ctrl + Enter` -> Tự động Lưu cả bảng.

### 4. Logic xử lý dữ liệu
Bắt sự kiện `keydown` trên màn hình. Nếu phím là Enter, tìm ô Input tiếp theo trong mảng HTML và gọi lệnh `.focus()`.

---

## PHẦN 6: CÁC HÀM CÔNG CỤ NHỎ KHÁC

- `_strSimilarity`: Thuật toán "AI" cây nhà lá vườn giúp so sánh 2 đoạn text giống nhau bao nhiêu % (dùng để cảnh báo trùng hóa đơn).
- `dlCSV`: Hàm tạo file Excel/CSV tải xuống máy tính. Biến mảng dữ liệu thành file text.
- `toast`: Hiện cái thông báo màu xanh/đỏ nhỏ nhỏ ló lên ở góc dưới màn hình ("Đã lưu thành công!").
- `uuid`: Tạo mã ID ngẫu nhiên siêu dài và không bao giờ trùng lặp (ví dụ: `f47ac10b-58cc-4372-a567-0e02b2c3d479`) dùng để đánh dấu từng hóa đơn.

---

## 🔗 LIÊN KẾT MODULE (QUAN TRỌNG)

File `tienich.js` là file "Đáy", nó không chứa dữ liệu quan trọng, nhưng **mọi file khác đều phải gọi nó**.

**1. Dữ liệu LẤY TỪ ĐÂU?**
- `buildInvoices()` lấy mảng `inv_v3` và `cc_v2` từ bộ nhớ tạm `_mem` (do `core.js` quản lý).
- Đọc biến cấu hình `activeYears` từ file `main.js`.

**2. Dữ liệu ĐƯỢC SỬ DỤNG Ở ĐÂU?**
- Toàn bộ các file giao diện (`hoadon.js`, `doanhthu.js`, `datatools.js`, `projects.js`, `danhmuc.js`) đều gọi hàm `numFmt`, `fmtM`, `fmtS` để in số tiền ra màn hình.
- `hoadon.js` gọi `_strSimilarity` để bắt lỗi trùng lặp hóa đơn.
- Các trang xuất báo cáo đều gọi `dlCSV`.

**3. ẢNH HƯỞNG TRỰC TIẾP TỚI TOÀN HỆ THỐNG**
- Hàm quan trọng nhất là `getInvoicesCached()` (bên trong gọi `buildInvoices`). Đây là "Họng nước chính" cung cấp dữ liệu hóa đơn cho toàn bộ app. Nếu hàm này lỗi, TẤT CẢ các bảng biểu đồ, danh sách hóa đơn, tính toán lãi lỗ của hệ thống đều sẽ hiển thị sai số liệu.
