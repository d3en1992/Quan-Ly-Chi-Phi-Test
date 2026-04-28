# PHẦN 1: QUẢN LÝ HỢP ĐỒNG CHÍNH (Hợp Đồng Công Ty)

### 1. Mục đích
- **Vai trò trong hệ thống sync**: Quản lý việc lưu trữ, chỉnh sửa và xóa thông tin Hợp đồng chính (giá trị, khối lượng chi tiết, đơn giá, ngày tạo...). Phần này định hình cấu trúc dữ liệu chuẩn để khi đồng bộ (sync) giữa nhiều thiết bị, dữ liệu không bị chồng chéo hay mất mát.
- **Giải thích dễ hiểu (cho người không biết code)**: Bạn hãy tưởng tượng file dữ liệu như một cuốn sổ cái chung của cả công ty. Khi bạn muốn sửa một hợp đồng, thay vì dùng gôm tẩy sạch số cũ đi rồi viết số mới, hệ thống sẽ chỉ "gạch ngang" số cũ và ghi một dòng mới, kèm theo con dấu ghi rõ **ngày, giờ, phút, giây** bạn vừa sửa. Nhờ con dấu thời gian này, khi 2 điện thoại cùng kết nối mạng, ứng dụng sẽ so sánh xem ai đóng dấu sau cùng thì lấy số liệu của người đó.
- **Ví dụ thực tế trong app**: 
  - Kỹ sư A và Kỹ sư B cùng mở ứng dụng xem Hợp đồng nhà anh C. 
  - Kỹ sư A đổi giá trị hợp đồng thành 1 tỷ lúc 08:00.
  - Kỹ sư B đổi thành 1.2 tỷ lúc 08:05. 
  - Khi hai máy đồng bộ với nhau, ứng dụng thấy "con dấu thời gian" của máy B mới hơn (08:05 > 08:00), nên giá trị chốt lại cuối cùng trên cả 2 máy sẽ là 1.2 tỷ.

### 2. Code chính và diễn giải
Dưới đây là trích đoạn quan trọng nhất khi Lưu / Sửa Hợp đồng (`saveHopDongChinh`):

```javascript
// NẾU LÀ SỬA HỢP ĐỒNG ĐÃ CÓ (editId)
if (editId) {
    const existing = hopDongData[editId] || {};
    if (editId !== _hdSaveKey) {
      // Trường hợp: Bạn đổi Hợp đồng này sang Công trình khác
      hopDongData[_hdSaveKey] = {
        // ...copy các thông tin mới
        createdAt: existing.createdAt || now,
        updatedAt: now, // Đóng dấu thời gian lúc vừa sửa xong
        deletedAt: null // Chưa bị xóa
      };
      // Đánh dấu hợp đồng cũ là "đã xóa" (Xóa mềm)
      hopDongData[editId] = { ...existing, deletedAt: now, updatedAt: now };
    } else {
      // Trường hợp: Chỉ sửa giá trị/nội dung, không đổi Công trình
      hopDongData[editId] = { ...existing, /*...dữ liệu mới...*/ updatedAt: now };
    }
} else {
    // NẾU LÀ TẠO MỚI HOÀN TOÀN
    hopDongData[_hdSaveKey] = {
      // ...các giá trị vừa nhập...
      createdAt: now, 
      updatedAt: now, 
      deletedAt: null
    };
}
```

**Giải thích các khái niệm cốt lõi:**
- `_hdSaveKey` (Tương đương ID): Là mã định danh duy nhất của hợp đồng. Trong app của bạn, nó thường lấy luôn mã ID của Công trình làm ID hợp đồng chính (vì mỗi công trình có 1 hợp đồng chính).
- `updatedAt` (Thời điểm cập nhật): "Con dấu thời gian" tính bằng mili-giây. Bất kỳ lúc nào bạn Tạo mới, Sửa, hay Xóa, dòng code `updatedAt: now` đều được gọi. Đây là chiếc "chìa khóa vàng" để giải quyết xung đột khi 2 máy cùng sửa 1 dữ liệu.
- `deletedAt` (Thời điểm xóa): Khi bạn bấm "Xóa" hợp đồng, app không hề xóa bay dữ liệu khỏi bộ nhớ. Thay vào đó, nó gán `deletedAt = now` (ví dụ: `deletedAt: 1713000000`). Cơ chế này gọi là **Xóa mềm (Soft Delete)**. Khi điện thoại của bạn gửi dữ liệu qua điện thoại khác, máy kia đọc thấy `deletedAt` có thời gian rõ ràng, nó sẽ tự hiểu: *"À, bên máy kia đã xóa cái này rồi, mình cũng ẩn nó đi khỏi màn hình thôi"*.

### 3. Kết luận: Hiểu phần này giúp gì?
- **Tránh lỗi mất mát dữ liệu vĩnh viễn**: Nhờ cơ chế "xóa mềm" (`deletedAt`), nếu ai đó lỡ tay bấm xóa sai, dữ liệu thực chất vẫn còn nằm ngầm trong cơ sở dữ liệu và hoàn toàn có thể khôi phục lại được nếu cần nhờ bộ phận kỹ thuật hỗ trợ.
- **Tránh lỗi lộn xộn, trùng lặp**: Việc luôn cập nhật `updatedAt` ở mọi thao tác đảm bảo hệ thống không bị phân vân giữa nhiều luồng dữ liệu. Kể cả khi đổi Hợp đồng sang tên Công trình khác, app rất thông minh khi biết cách "tạo một bản mới" và "xóa mềm bản cũ", giúp số liệu trên bảng Thống kê / Lãi lỗ luôn khớp 100%, không bao giờ bị tính tiền gấp đôi (1 cục ở công trình cũ, 1 cục ở công trình mới).

---

# PHẦN 2: GHI NHẬN THU TIỀN

### 1. Mục đích
- **Vai trò trong hệ thống sync**: Quản lý dòng tiền thu vào từ các công trình. Mỗi lần thu tiền là một "phiếu thu" độc lập. Hệ thống đảm bảo mỗi phiếu thu có một mã ID riêng biệt, và ghi nhận rõ ràng điện thoại/máy tính nào đã thao tác để đồng bộ không bị thiếu sót.
- **Giải thích dễ hiểu (cho người không biết code)**: Thay vì bạn cầm tẩy xóa đi số tiền tổng để viết số mới, app hoạt động bằng cách tạo ra từng "tờ biên lai" riêng lẻ (trong code gọi là Bản ghi - Record). Mỗi tờ biên lai đều được in tự động một **mã số không bao giờ trùng**, **ngày giờ tạo**, và đặc biệt là **chữ ký của cái máy** đã tạo ra nó.
- **Ví dụ thực tế trong app**: 
  - Kế toán ở văn phòng (Máy A) vừa nhập: Thu nhà anh C 50 triệu.
  - Gần như cùng lúc, kỹ sư ở công trường (Máy B) nhập: Thu nhà anh C 20 triệu.
  - Nhờ mỗi máy tự sinh ra một mã ID ngẫu nhiên cho tờ biên lai của mình, khi 2 máy có mạng và đồng bộ, ứng dụng sẽ thu thập cả 2 và cộng dồn thành 2 dòng: 50 triệu và 20 triệu (Tổng bằng 70 triệu). Không máy nào đè lên dữ liệu của máy nào.

### 2. Code chính và diễn giải

```javascript
// Trích đoạn 1: Khi Lưu phiếu thu mới
thuRecords.unshift(mkRecord({ 
    ngay, congtrinh: ct, projectId: _thuPid, tien, nguoi, nd 
}));

// Trích đoạn 2: Khi Xóa một phiếu thu
function delThuRecord(id) {
  // ...
  const now = Date.now();
  thuRecords[idx] = { 
      ...thuRecords[idx], 
      deletedAt: now,   // Đánh dấu thời gian xóa
      updatedAt: now,   // Cập nhật lại thời gian sửa đổi cuối
      deviceId: DEVICE_ID // Lưu lại chữ ký của máy đã ra lệnh xóa
  };
}
```

**Giải thích các khái niệm cốt lõi:**
- `mkRecord()` (Hàm tạo bản ghi tự động): Khi bạn lưu phiếu thu, hàm này ngầm hoạt động phía sau để "bơm" thêm các thông số kỹ thuật sống còn vào dữ liệu:
  - `id`: Mã số phiếu ngẫu nhiên (ví dụ `1713001234_xyz`). Mã này có xác suất trùng bằng 0, kể cả 2 máy bấm Lưu cùng lúc.
  - `createdAt` và `updatedAt`: Đóng dấu thời gian khởi tạo.
  - `deviceId`: Tên hoặc mã của thiết bị (ví dụ `IPHONE-15-PRO`).
- `deviceId: DEVICE_ID` (Ở đoạn code xóa): Khi một người bấm Xóa phiếu thu, app không chỉ đánh dấu `deletedAt` (xóa mềm) giống như Hợp đồng, mà còn cẩn thận ghi đè thêm `deviceId: DEVICE_ID`. Điều này giống như lập một biên bản hủy tài liệu và bắt người hủy phải "ký tên".

### 3. Kết luận: Hiểu phần này giúp gì?
- **Không bao giờ bị lỗi "nhập đè", "mất tiền" hay "gấp đôi tiền"**: Bằng cách quản lý theo từng `id` biên lai lẻ (chứ không phải 1 biến tổng số tiền), 2 thiết bị nhập liệu cùng lúc hoàn toàn an toàn. Dữ liệu khi merge sẽ tự động lồng vào nhau như xếp bài, không bao giờ bị chèn ép.
- **Khả năng truy vết cực mạnh**: Nhờ biến `deviceId` đính kèm ở hành động nhạy cảm như nút Xóa (`delThuRecord`), nếu bỗng dưng một khoản tiền "không cánh mà bay", đội ngũ kỹ thuật chỉ cần mở lịch sử ngầm là sẽ biết chính xác khoản tiền đó đã bị **cái điện thoại nào** xóa đi vào lúc **mấy giờ, mấy phút**.

---

# PHẦN 3: QUẢN LÝ HỢP ĐỒNG THẦU PHỤ

### 1. Mục đích
- **Vai trò trong hệ thống sync**: Quản lý các hợp đồng giao khoán cho thầu phụ. Điểm khác biệt lớn nhất so với "Hợp đồng chính" (mỗi công trình chỉ có 1) là một công trình có thể có **rất nhiều** Hợp đồng thầu phụ (thầu sơn, thầu điện nước, thầu xây tô...). Do đó, hệ thống phải lưu trữ chúng dưới dạng một "danh sách" các bản ghi độc lập, giống hệt cách lưu "Phiếu thu tiền".
- **Giải thích dễ hiểu**: Nếu Hợp đồng chính là "Trang bìa" của hồ sơ công trình, thì Hợp đồng thầu phụ giống như những "Tờ giấy" kẹp thêm vào bên trong hồ sơ. Mỗi tờ giấy (hợp đồng thầu phụ) sẽ được hệ thống bấm một mã vạch ngẫu nhiên (ID) riêng biệt. Khi 2 người ở 2 nơi cùng tạo hợp đồng thầu phụ cho cùng 1 công trình, hệ thống sẽ tự động kẹp cả 2 tờ giấy vào đúng tập hồ sơ mà không vứt bỏ tờ nào.
- **Ví dụ thực tế trong app**: 
  - Kỹ sư A (máy A) tạo hợp đồng 50 triệu cho Đội Điện Nước nhà anh C.
  - Cùng lúc đó, Kỹ sư B (máy B) tạo hợp đồng 30 triệu cho Đội Sơn nhà anh C.
  - Khi 2 máy đồng bộ, công trình nhà anh C sẽ xuất hiện đủ 2 dòng hợp đồng thầu phụ này, tổng tiền thầu phụ sẽ tự động cộng thành 80 triệu.

### 2. Code chính và diễn giải
Dưới đây là trích đoạn quan trọng khi xử lý dữ liệu Hợp đồng Thầu phụ:

```javascript
// Trích đoạn 1: Khi Lưu Hợp đồng thầu phụ
if (editId) {
    // Nếu SỬA hợp đồng đã có: Dùng hàm mkUpdate để làm mới 'updatedAt'
    thauPhuContracts[idx] = mkUpdate(thauPhuContracts[idx], { 
        ngay, congtrinh: ct, projectId: _hdtpPid, thauphu: tp, 
        giaTri, phatSinh, nd, sl, donGia, items: [..._hdtpItems] 
    }); 
} else {
    // Nếu TẠO MỚI: Dùng hàm mkRecord để tự sinh 'id', 'createdAt'
    thauPhuContracts.unshift(mkRecord({ 
        ngay, congtrinh: ct, projectId: _hdtpPid, thauphu: tp, 
        // ...
    })); 
}

// Trích đoạn 2: Khi XÓA Hợp đồng thầu phụ
function delHopDongThauPhu(id) {
    // ...
    const now = Date.now();
    thauPhuContracts[idx] = { 
        ...thauPhuContracts[idx], 
        deletedAt: now,   // Xóa mềm: đánh dấu thời gian xóa
        updatedAt: now    // Cập nhật lại thời gian sửa đổi
    };
}
```

**Diễn giải logic khác biệt:**
- **Không dùng tên Công trình làm Key**: Trong Phần 1, app dùng `_hdSaveKey` (mã công trình) làm mã hợp đồng vì tỉ lệ là 1-1. Nhưng ở Phần 3 này, app dùng hàm `mkRecord()` để tạo ra một `id` ngẫu nhiên hoàn toàn mới. Điều này là cốt lõi để cho phép 1 công trình có vô số hợp đồng thầu phụ mà không đè lên nhau.
- `mkUpdate()` (Hàm cập nhật thông minh): Thay vì phải tự viết code gán `updatedAt = now` một cách thủ công như Phần 1, hàm `mkUpdate` sẽ tự động "đóng dấu" thời gian cập nhật mới nhất vào hợp đồng. Điều này đảm bảo quy tắc "Ai lưu sau cùng thì lấy bản đó" hoạt động hoàn hảo khi đồng bộ.
- `items: [..._hdtpItems]`: Khi bạn lưu danh sách Khối lượng chi tiết (bảng phụ bên trong hợp đồng), app dùng cú pháp `[... ]`. Cú pháp này giống như việc mang toàn bộ bảng chi tiết đi "Photocopy" ra một tờ giấy mới rồi cất vào kho. Nó giúp ngăn chặn lỗi "dính dữ liệu" (lỗi tham chiếu) khi người dùng tiếp tục bấm sửa bảng chi tiết trên màn hình.

### 3. Kết luận: Hiểu phần này giúp gì?
- **Tránh lỗi lưu đè mất hợp đồng thầu phụ**: Nếu lập trình viên thiết kế phần này giống hệt Phần 1 (dùng ID công trình làm mã hợp đồng), thì khi bạn thêm đội Sơn, nó sẽ xóa đè mất đội Điện Nước. Việc áp dụng cách tạo `id` riêng qua `mkRecord()` giúp triệt tiêu hoàn toàn lỗi này.
- **Tính năng Xóa an toàn tuyệt đối**: Cũng giống như các phần trước, hợp đồng thầu phụ bị xóa cũng chỉ là "Xóa mềm" (thêm thuộc tính `deletedAt`). Các hàm tính toán công nợ, số tiền thầu phụ sau này (sẽ nói ở Phần 4) đều sẽ tự động tìm và bỏ qua các hợp đồng có gắn mác `deletedAt`, giữ cho bảng Thống kê Lãi/Lỗ luôn chuẩn xác từng đồng.

---

# PHẦN 4: BẢNG CÔNG NỢ THẦU PHỤ

### 1. Mục đích
- **Vai trò trong hệ thống**: Đây là phần "tổng hợp báo cáo". Nó không trực tiếp lưu dữ liệu mới, mà làm nhiệm vụ "đi gom" dữ liệu từ 2 kho khác nhau: kho "Tiền ứng thầu phụ" (nằm ở một file khác) và kho "Hợp đồng thầu phụ". Sau đó, nó tự động gạt bỏ các dữ liệu đã bị "xóa mềm" và làm toán để tính ra số tiền Còn nợ (hoặc vượt ứng) cho từng đội thầu tại từng công trình.
- **Giải thích dễ hiểu (cho người không biết code)**: Giống như việc cuối tháng kế toán lôi 2 cuốn sổ ra đối chiếu. Cuốn sổ 1 là "Đã ứng cho ai bao nhiêu tiền". Cuốn sổ 2 là "Đã ký hợp đồng với ai bao nhiêu tiền". App sẽ tự động ghép 2 cuốn sổ này lại, lọc ra những dòng đã bị gạch bỏ (bị xóa), và làm phép tính trừ để ra kết quả cuối cùng lên màn hình.
- **Ví dụ thực tế trong app**: 
  - Tại nhà anh C: Kế toán đã xuất phiếu ứng cho Đội Sơn 2 lần (10 triệu và 5 triệu). Kỹ sư chốt hợp đồng với Đội Sơn là 20 triệu.
  - Hàm này sẽ đi gom nhặt lại: Đội Sơn (Nhà anh C) -> Đã ứng 15 triệu, Hợp đồng 20 triệu -> Kết quả: Còn nợ 5 triệu.

### 2. Code chính và diễn giải

```javascript
function renderCongNoThauPhu() {
  // Tạo một bộ phân loại (Gom nhóm) theo cú pháp: "Tên thầu phụ ||| Tên công trình"
  const map = {}; 
  
  // BƯỚC 1: Đi nhặt dữ liệu từ nguồn Tiền Ứng (ungRecords)
  ungRecords.filter(r => 
      r.loai === 'thauphu' && 
      !r.deletedAt && // RẤT QUAN TRỌNG: Bỏ qua các phiếu ứng đã bị xóa mềm
      inActiveYear(r.ngay)
  ).forEach(r => {
      // Bỏ vào rổ và cộng dồn tổng tiền ứng...
  });

  // BƯỚC 2: Đi nhặt dữ liệu từ nguồn Hợp Đồng Thầu Phụ (thauPhuContracts)
  thauPhuContracts.filter(r => 
      !r.deletedAt && // RẤT QUAN TRỌNG: Bỏ qua các hợp đồng đã bị xóa mềm
      _dtInYear(r.ngay)
  ).forEach(r => {
      // Bỏ vào cùng cái rổ đó và cộng dồn tổng tiền hợp đồng...
  });
}
```

**Diễn giải logic cốt lõi:**
- `key = thauphu + '|||' + congtrinh`: Để tính đúng công nợ, app phải tìm chính xác "Đội thầu đó" đang làm ở "Công trình đó". Nó dùng dấu `|||` làm vách ngăn để tạo ra một chiếc hộp chứa riêng biệt. Ví dụ chiếc hộp mang tên `Đội Sơn|||Nhà Anh C`. Mọi khoản tiền ứng hay hợp đồng khớp cái tên này sẽ được quăng chung vào hộp để cộng dồn.
- Hàm lọc `!r.deletedAt`: Đây là lúc cơ chế "Xóa mềm" ở các Phần 1, 2, 3 phát huy sức mạnh. Hàm `filter()` đóng vai trò như một chiếc màng rây, tự động chặn lại tất cả những phiếu ứng hoặc hợp đồng nào có gắn mác `deletedAt` (đã bị xóa). Nó chỉ lấy những dữ liệu "còn sống" để đưa vào tính toán.

### 3. Kết luận: Hiểu phần này giúp gì?
- **Sửa tận gốc khi "Bảng công nợ bị sai tiền"**: Bảng này chỉ hiển thị kết quả chứ không chứa dữ liệu gốc. Nếu thấy công nợ bị sai lệch, bạn sẽ biết ngay lỗi không nằm ở đây, mà nằm ở 1 trong 2 nơi: hoặc ai đó đã nhập sai Phiếu ứng (thiếu/dư), hoặc nhập sai Hợp đồng thầu phụ. Chỉ cần sửa ở nguồn, bảng này tự động đúng.
- **Biết được tại sao không bao giờ sợ xóa nhầm**: Nhờ bộ rây lọc `!r.deletedAt` hoạt động ngầm cực kỳ mượt mà, khi bạn lỡ tay xóa một phiếu ứng 10 triệu, bảng công nợ lập tức trừ 10 triệu đi. Nếu đội kỹ thuật khôi phục lại dữ liệu (chỉ cần xóa dòng chữ `deletedAt` trong code), bảng công nợ lại tự động tính tiền lại cộng thêm 10 triệu như cũ mà không cần chạy bất kỳ lệnh sửa chữa phức tạp nào.

---

# PHẦN 5: BẢNG CÔNG NỢ NHÀ CUNG CẤP

### 1. Mục đích
- **Vai trò trong hệ thống**: Tương tự như bảng công nợ thầu phụ, bảng này làm nhiệm vụ "đi gom" dữ liệu để đối chiếu công nợ với các Nhà Cung Cấp (vật tư, thiết bị...). Tuy nhiên, nguồn dữ liệu của nó phức tạp hơn: lấy từ "Tiền ứng nhà cung cấp" và từ kho "Hóa đơn mua hàng".
- **Giải thích dễ hiểu (cho người không biết code)**: Bảng này giống như một kế toán tổng hợp chuyên đi nhặt số liệu. Cuốn sổ 1 là "Tiền đã trả trước cho cửa hàng vật tư" (Ứng tiền). Cuốn sổ 2 là "Tiền mua hàng thực tế" (Hóa đơn). Đặc biệt, hệ thống đủ thông minh để **vứt bỏ hoàn toàn** những hóa đơn thuộc về các công trình đã "Đóng cửa" (Closed) khỏi bảng tính này, giúp kế toán không bị rối mắt bởi những công nợ cũ rích.
- **Ví dụ thực tế trong app**: 
  - Tại cửa hàng Thép A: Kế toán tạm ứng 50 triệu. Kỹ sư mua thép đem về nhà anh C hết 30 triệu, mua đem về nhà anh D hết 40 triệu.
  - Bảng này sẽ tổng hợp: Cửa hàng Thép A -> Đã ứng 50 triệu -> Mua tổng cộng 70 triệu -> Kết quả: Còn nợ cửa hàng 20 triệu.

### 2. Code chính và diễn giải

```javascript
// BƯỚC 1: Lọc ra danh sách Nhà Cung Cấp có nhận tiền ứng
const nccFromUng = new Set(
    ungRecords.filter(r => r.loai === 'nhacungcap' && !r.deletedAt /*...*/)
);

// BƯỚC 2: Tính toán tiền Hóa Đơn (Hàng đã mua thực tế)
getInvoicesCached()
    .filter(inv => !inv.deletedAt && (inv.ncc || '') === ncc /*...*/)
    .forEach(inv => {
        // CỰC KỲ QUAN TRỌNG: Kiểm tra trạng thái công trình
        const proj = inv.projectId ? getProjectById(inv.projectId) : null;
        if (proj && proj.status === 'closed') return; // Công trình đã đóng -> Từ chối tính nợ!
        
        const amt = inv.thanhtien || inv.tien || 0;
        tongTien += amt;
    });
```

**Diễn giải logic cốt lõi:**
- **Lấy dữ liệu từ Hóa Đơn (`getInvoicesCached`)**: Đây là điểm khác biệt lớn nhất so với phần Thầu Phụ. Công nợ nhà cung cấp không dựa trên "Hợp đồng cố định", mà dựa trên số lượng hàng hóa (Vật liệu, Thiết bị) thực tế nhập về thông qua các phiếu Hóa đơn hằng ngày.
- `if (proj && proj.status === 'closed') return;`: Đây là "luật ngầm" cực kỳ hay của phần này. Khi một công trình đã được gán mác là "Đóng" (Hoàn thành, quyết toán xong), ứng dụng sẽ phát lệnh `return` (từ chối tính toán). Nhờ vậy, hàng trăm hóa đơn của các công trình năm ngoái sẽ không bị cộng dồn vào bảng công nợ hiện tại, giúp danh sách nợ luôn "sạch sẽ" và chỉ tập trung vào các công trình đang thi công.

### 3. Kết luận: Hiểu phần này giúp gì?
- **Giải quyết thắc mắc "Tại sao hóa đơn có mà công nợ bằng 0"**: Nếu bạn nhập một hóa đơn mua 100 bao xi măng nhưng nhìn vào bảng Công nợ lại không thấy tiền nợ tăng lên, nguyên nhân 99% là do công trình đó đã bị chuyển sang trạng thái "Đóng cửa" (Closed). Bạn chỉ cần mở lại công trình (Open) là tiền nợ sẽ tự động hiển thị trở lại.
- **Tiết kiệm thời gian rà soát**: Nhờ tự động gạt bỏ các công trình đã đóng, kế toán và quản lý chỉ nhìn thấy chính xác số tiền cần trả cho nhà cung cấp ở thời điểm hiện tại. Bạn không cần phải cấn trừ thủ công những khoản tiền của các dự án đã kết thúc từ lâu.

---

# PHẦN 6: BẢNG LÃI/LỖ (Dashboard)

### 1. Mục đích
- **Vai trò trong hệ thống**: Đây là "Trùm cuối" của file `doanhthu.js`. Nó hiển thị bức tranh toàn cảnh về tài chính của toàn bộ công ty. Bảng này làm nhiệm vụ quét qua mọi ngóc ngách của dữ liệu (Chi phí hóa đơn, Tiền đã thu, Hợp đồng đã ký) để trả lời 2 câu hỏi sống còn: **"Đang lời hay lỗ?"** và **"Còn phải đòi khách hàng bao nhiêu tiền?"**.
- **Giải thích dễ hiểu (cho người không biết code)**: Bạn hãy tưởng tượng hàm này là một người Kế toán trưởng mẫn cán. Người này không tự tạo ra dữ liệu, mà đi quanh công ty thu thập thông tin:
  - Hỏi Kế toán chi phí: "Tổng tiền mua vật tư, trả lương thợ... là bao nhiêu?" (Ra được số **Tổng Chi**)
  - Hỏi Thủ quỹ: "Đã cầm tiền mặt của chủ nhà C bao nhiêu rồi?" (Ra được số **Đã Thu**)
  - Hỏi Giám đốc: "Ký hợp đồng với chủ nhà C tổng cộng mấy tỷ?" (Ra được số **Tổng Doanh Thu**)
  Sau đó người này lập một bảng tính trừ đi cộng lại để ra con số Lãi/Lỗ cuối cùng.
- **Ví dụ thực tế trong app**: 
  - Hợp đồng nhà anh C: 1 Tỷ. Có phát sinh thêm 200 triệu -> Tổng Doanh Thu: 1.2 Tỷ.
  - Tổng chi phí (Vật tư, nhân công) nhà anh C: 800 triệu.
  - Khách đã chuyển khoản: 500 triệu.
  - Bảng Lãi/Lỗ sẽ tự động báo: Lãi dự kiến = 1.2 tỷ - 800tr = **400 triệu**. Còn phải đi thu của khách = 1.2 tỷ - 500tr = **700 triệu**.

### 2. Code chính và diễn giải

```javascript
function renderLaiLo() {
  // 1. Quét Hóa đơn để lấy TỔNG CHI
  const tongChi = {};
  getInvoicesCached().filter(i => inActiveYear(i.ngay)).forEach(i => {
    // Cộng dồn tiền hóa đơn theo từng Công trình
    tongChi[ct] = (tongChi[ct] || 0) + (i.thanhtien || i.tien || 0);
  });

  // 2. Quét Phiếu thu để lấy số ĐÃ THU
  const daThu = {};
  thuRecords.filter(r => !r.deletedAt && inActiveYear(r.ngay)).forEach(r => {
    daThu[ct] = (daThu[ct] || 0) + (r.tien || 0);
  });

  // 3. Quét Hợp đồng chính để lấy TỔNG DOANH THU
  const hdByCT = {};
  Object.entries(hopDongData).filter(([, v]) => !v.deletedAt && _dtInYear(v.ngay)).forEach(([keyId, hd]) => {
    hdByCT[ctName] = { giaTri: hd.giaTri, phatSinh: hd.phatSinh };
  });

  // 4. Bắt đầu làm phép tính cho kết quả cuối cùng
  const tongDTct = giaTri + giaTriphu + phatSinh; // DOANH THU
  const conPhaiThu = tongDTct - thu;              // CÒN PHẢI THU KHÁCH
  const laiLo = tongDTct - chi;                   // LÃI HAY LỖ
}
```

**Diễn giải logic cốt lõi:**
- Ba vòng lặp `forEach` ở trên đóng vai trò như 3 cỗ máy hút dữ liệu độc lập. Dù dữ liệu có nằm rải rác ở hàng trăm điện thoại khác nhau, chỉ cần nó đã được đồng bộ về máy hiện tại, 3 cỗ máy này sẽ gom sạch sẽ và chia nhóm về đúng từng Công trình tương ứng.
- `inActiveYear(i.ngay)`: Đây là một bộ lọc thời gian cực kỳ quan trọng. Nó giúp Bảng Lãi/Lỗ chỉ hiển thị bức tranh tài chính của **năm hiện tại** (hoặc năm bạn đang chọn xem trên thanh công cụ), thay vì cộng dồn số liệu hổ lốn từ các năm trước.

### 3. Kết luận: Hiểu phần này giúp gì?
- **Khám bệnh cho số liệu Lãi/Lỗ**: Nếu Giám đốc thắc mắc "Ơ sao công trình này Lãi to thế?", bạn có thể suy luận ngay lập tức: 1 là Hợp đồng (Tổng DT) nhập sai số to quá, 2 là Hóa đơn (Tổng Chi) kế toán chưa nhập đủ. Bảng này không bao giờ tự tính sai, nó chỉ phản ánh đúng dữ liệu đầu vào.
- **Biết sự liên kết dữ liệu**: Qua hàm này, bạn thấy rõ bảng Lãi/Lỗ là nơi duy nhất "hút" dữ liệu từ toàn bộ các ngóc ngách của ứng dụng. Bất kỳ thao tác Xóa, Sửa, Thêm nào ở các mục khác (như xóa một tờ hóa đơn) đều ngay lập tức làm biến động con số Lãi/Lỗ ở đây.

---

# PHẦN 7: TỔNG KẾT - CÁCH `doanhthu.js` GIAO TIẾP VỚI HỆ THỐNG

Để bạn có cái nhìn bao quát nhất, đây là cách module `doanhthu.js` làm việc với phần còn lại của ứng dụng:

1. **Giao tiếp với `sync.js` (Trạm phát sóng / Bộ thu phát)**
   - Bản thân `doanhthu.js` **không tự biết gửi dữ liệu qua internet**. Khi bạn nhập một Hợp đồng, nó chỉ dùng hàm `save()` để lưu vào ổ cứng máy tính/điện thoại hiện tại (IndexedDB).
   - Ngay lúc đó, `sync.js` đóng vai trò như người đưa thư, phát hiện ổ cứng vừa có thay đổi, lập tức đóng gói dữ liệu (kèm theo `updatedAt` và `deviceId` mà `doanhthu.js` đã đóng dấu sẵn) và bắn lên mạng để chuyển tới các máy khác.

2. **Giao tiếp với `core.js` (Bộ não trung tâm)**
   - `doanhthu.js` liên tục mượn các "đồ nghề" từ xưởng `core.js` như: mượn hàm `mkRecord()` để tạo ID ngẫu nhiên, mượn hàm `toast()` để hiện thông báo xanh/đỏ (Lưu thành công/Thất bại), và mượn hàm `getInvoicesCached()` để lấy hóa đơn một cách siêu tốc mà không làm giật lag máy.

3. **Giao tiếp với `projects.js` (Quản lý Công trình)**
   - Bất kỳ lúc nào bạn tạo một hợp đồng hay thu tiền, `doanhthu.js` luôn phải "gõ cửa" file `projects.js` (thông qua hàm `getProjectById`) để kiểm tra xem: "Công trình này có tồn tại thật không? Nó đã bị Đóng cửa (Closed) hay chưa?". Từ đó nó mới quyết định có cho phép tính toán công nợ hay không.

**📌 TÓM LẠI:** 
File `doanhthu.js` giống như bộ phận **Kế Toán Tổng Hợp** của công ty. Nó vừa tự tạo ra dữ liệu riêng của mình (Ghi nhận Phiếu thu, Hợp đồng), vừa liên tục chạy đi mượn sổ sách từ bộ phận Thu Mua (Hóa đơn) và bộ phận Kỹ thuật (Công trình) để xào nấu ra các Báo cáo Lãi/Lỗ, Công nợ cuối cùng dâng lên cho Giám đốc. Mọi dữ liệu nó tạo ra đều được đóng dấu `updatedAt` cẩn thận để chống dẫm chân lên nhau khi làm việc nhóm trên nhiều thiết bị.
