# PHẦN 1: HỆ MÀU "PHONG THỦY" VÀ BỘ KHUNG ĐIỀU HÀNH (Root & Topbar)

### 1. Mục đích
File `style.css` giống như **"lớp sơn"** và **"cách bài trí nội thất"** cho ứng dụng của bạn. Nếu không có nó, app của bạn chỉ là những dòng chữ đen trắng thô kệch, rất khó nhìn.

Trong hệ thống **Sync (Đồng bộ)**, phần này cực kỳ quan trọng vì:
- Nó tạo ra các **"màu sắc nhận diện"**: Giúp bạn biết ngay cái nào là tiền vật tư (vàng), cái nào là tiền lương (xanh), cái nào là cảnh báo lỗi (đỏ).
- Nó giữ cho **Thanh công cụ (Topbar)** luôn nằm im ở trên cùng: Giúp bạn luôn thấy nút "Đồng bộ" và "Tên người dùng" dù bạn có cuộn trang xuống tận cùng.

---

### 2. Giải thích dễ hiểu (Dành cho người không biết code)
Hãy tưởng tượng ứng dụng của bạn là một **Công trường xây dựng**:
- **HTML (index.html):** Là khung nhà, gạch, đá, xi măng.
- **JavaScript (core.js, sync.js):** Là hệ thống điện, nước, máy móc chạy ngầm bên trong.
- **CSS (style.css):** Chính là **màu sơn tường**, **biển báo chỉ dẫn** và **cách sắp xếp bàn ghế**.

**Ví dụ đời thực:**
Bạn có 2 cái tủ hồ sơ giống hệt nhau (2 điện thoại). Để không bị nhầm, bạn dán nhãn màu vàng cho "Hóa đơn", nhãn màu xanh cho "Chấm công". CSS chính là người đi dán những cái nhãn màu đó cho bạn. Nếu nhìn vào thấy màu đỏ rực, bạn biết ngay là "Có lỗi" hoặc "Chưa lưu", từ đó tránh được việc quên đồng bộ dữ liệu giữa các máy.

---

### 3. Ví dụ thực tế trong app của bạn
- **Nhận diện trạng thái:** Khi bạn sửa một hóa đơn, nếu nút "Lưu" hiện màu vàng (`--gold`) rực rỡ, nó đang nhắc bạn: "Này, hãy bấm vào đây để tôi ghi lại vào bộ nhớ máy!".
- **Phân biệt thiết bị:** Nếu bạn dùng 2 máy, CSS có thể giúp hiển thị mã thiết bị (`deviceId`) một cách tinh tế ở góc màn hình, giúp bạn biết "Dữ liệu này là do máy bảng ở công trình gửi về, không phải máy tính ở văn phòng".
- **Tránh "nhập nhầm":** Nhờ cách chia cột rõ ràng trong CSS, bạn sẽ không bao giờ nhập nhầm "Số tiền" vào ô "Ngày tháng", giúp `updatedAt` luôn chính xác.

---

### 4. Code chính (Trích đoạn quan trọng)

```css
/* 1. Bảng màu chủ đạo của app */
:root {
  --bg: #f5f4f0;       /* Màu nền giấy cũ (dễ nhìn, không mỏi mắt) */
  --gold: #c8870a;     /* Màu vàng: Dành cho tiền bạc, công trình */
  --green: #1a7a45;    /* Màu xanh: Dành cho dữ liệu đã an toàn, đã lưu */
  --red: #c0392b;      /* Màu đỏ: Dành cho nút xóa, cảnh báo lỗi */
  --ink: #1a1814;      /* Màu mực đen: Để đọc chữ cho rõ */
}

/* 2. Thanh công cụ luôn nằm trên cùng (Topbar) */
.topbar {
  background: var(--ink); /* Nền đen tuyền sang trọng */
  color: #fff;            /* Chữ trắng nổi bật */
  position: sticky;       /* "Dính" chặt ở đỉnh màn hình */
  top: 0; 
  z-index: 100;           /* Luôn nằm đè lên trên các nội dung khác */
}

/* 3. Cách gọi tên để "mặc áo" cho từng phần */
#sync-btn { color: var(--gold); } /* Gọi đích danh Nút Sync để tô màu vàng */
.nav-btn { font-size: 12px; }    /* Gọi nhóm các nút điều hướng để chỉnh cỡ chữ */
```

---

### 5. Diễn giải các khái niệm then chốt

*   **id (Ví dụ: `#sync-btn`, `#user-btn`):** Trong CSS, dấu `#` nghĩa là "chỉ đích danh". Giống như bạn gọi: "Anh Bình ơi, anh mặc áo vàng đi". App có hàng nghìn nút, nhưng chỉ nút nào có `id` là `sync-btn` mới được CSS tô đúng màu đó. Điều này giúp các nút chức năng quan trọng (Đồng bộ, Lưu) luôn nổi bật, tránh việc bạn bấm nhầm nút "Xóa".
*   **updatedAt & deletedAt:** Mặc dù CSS không trực tiếp "tính toán" thời gian, nhưng nó được dùng để **thể hiện** các trạng thái này. 
    *   Ví dụ: Nếu một dòng dữ liệu có `deletedAt` (đã bị xóa), CSS sẽ làm dòng đó mờ đi hoặc gạch ngang chữ. Bạn nhìn vào là biết ngay: "À, cái này bỏ rồi, không cần cộng tiền nữa".
*   **deviceId (Mã máy):** CSS giúp hiển thị mã máy của bạn một cách gọn gàng. Nếu một hóa đơn hiện mã máy khác với máy bạn đang cầm, bạn sẽ hiểu: "Cái này là do người khác nhập, mình không nên sửa đè lên kẻo mất dữ liệu của họ".
*   **Variables (Biến màu - `:root`):** Đây là cách Senior Developer làm việc thông minh. Thay vì đi tô màu vàng cho 100 chỗ, họ chỉ đặt tên là `--gold`. Sau này nếu bạn muốn đổi sang màu cam cho "phong thủy", chỉ cần đổi 1 chỗ duy nhất, toàn bộ app sẽ đổi theo.

---

### 6. Kết luận
Hiểu rõ phần này giúp bạn tránh được lỗi:
- **Hoa mắt, nhập sai:** Giao diện lộn xộn sẽ khiến bạn nhập 1 triệu thành 10 triệu. CSS giúp mọi thứ ngay hàng thẳng lối.
- **Quên đồng bộ:** Màu sắc cảnh báo của các nút giúp bạn luôn nhớ việc nhấn Sync để dữ liệu giữa các máy luôn khớp nhau.
- **Mất dữ liệu do nhầm lẫn:** Nhìn rõ `id` và trạng thái `deletedAt` (qua màu sắc mờ/đậm) giúp bạn quản lý đúng hóa đơn cần xử lý.

---
*Tiếp theo sẽ là **PHẦN 2: BẢNG NHẬP LIỆU VÀ CÁC NÚT BẤM (TABLES & BUTTONS)** - Nơi chúng ta "thay áo" cho các ô nhập tiền và nút lưu.*

---

# PHẦN 2: BẢNG NHẬP LIỆU VÀ CÁC NÚT BẤM (TABLES & BUTTONS)

### 1. Mục đích
Nếu PHẦN 1 là "cổng chào" thì PHẦN 2 là **"bàn làm việc"** chính của bạn. Đây là nơi định nghĩa giao diện của các bảng tính, các ô nhập ngày tháng, số tiền... 

Phần này cực kỳ quan trọng đối với dữ liệu vì:
- Nó tạo ra không gian để bạn nhập liệu chính xác.
- Nó chứa các **Nút bấm (Buttons)** - là "công tắc" để kích hoạt quá trình ghi đè `updatedAt` hoặc đánh dấu `deletedAt`.

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng bạn đang cầm một **tờ phiếu thu/chi bằng giấy**:
- **Bảng (Table):** Là các dòng kẻ ô ly giúp bạn không viết chữ hàng này xọ hàng kia.
- **Ô nhập liệu (Input Cell):** Là những cái hộp trống để bạn điền số tiền, nội dung. CSS giúp những cái hộp này "to rõ", dễ bấm trên điện thoại.
- **Nút bấm (Button):** Giống như con dấu và chữ ký. Khi bạn nhấn "Lưu", hệ thống mới chính xác "đóng dấu" ngày giờ (`updatedAt`) vào tờ phiếu đó.

**Ví dụ đời thực:**
Nếu cái bàn làm việc của bạn bừa bãi (CSS lỗi), bạn rất dễ viết nhầm số 0 thành số 8. CSS trong phần này giúp các ô nhập tiền luôn "nằm bên phải", ô chữ "nằm bên trái", giúp mắt bạn lướt qua là biết ngay dữ liệu có hợp lý hay không.

---

### 3. Ví dụ thực tế trong app của bạn
- **Thêm dòng mới:** Khi bạn nhấn nút "Thêm dòng", một dòng trống hiện ra với một mã số `id` mới toanh đang chờ được cấp. CSS làm cho dòng này hiện ra mượt mà để bạn bắt đầu nhập.
- **Xóa hóa đơn:** Nút xóa thường có màu đỏ (`--red`). Khi bạn bấm vào, CSS không làm dòng đó biến mất ngay (để tránh xóa nhầm), mà nó có thể làm dòng đó mờ đi, tương ứng với việc hệ thống ghi nhận `deletedAt`.
- **Nhập tiền trên điện thoại:** Khi bạn chạm vào ô nhập tiền, một bàn phím số (Numpad) hiện ra. CSS định nghĩa cái bàn phím này phải to bằng nửa màn hình để ngón tay bạn bấm không bị trượt.

---

### 4. Code chính (Trích đoạn quan trọng)

```css
/* 1. Các loại nút bấm */
.btn {
  display: inline-flex; align-items: center; 
  padding: 7px 14px; border-radius: 6px; 
  font-weight: 600; cursor: pointer;
}
.btn-gold { background: var(--gold); color: #fff; } /* Nút Lưu/Thêm */
.btn-danger { background: var(--red-bg); color: var(--red); } /* Nút Xóa */

/* 2. Bảng nhập liệu - "Trái tim" của việc nhập chi phí */
.entry-table {
  width: 100%; border-collapse: collapse;
}
.entry-table thead th {
  background: #eeece7; color: var(--ink2);
  font-size: 10px; text-transform: uppercase; /* Tiêu đề cột viết hoa cho chuyên nghiệp */
}

/* 3. Ô nhập liệu thông minh */
.cell-input {
  width: 100%; padding: 7px; border: none;
  outline: none; background: transparent;
}
.cell-input:focus { 
  background: #fffbef; /* Khi bạn đang gõ, ô đó sẽ đổi màu nền để bạn biết mình đang ở đâu */
  box-shadow: inset 0 0 0 2px var(--gold); /* Hiện viền vàng khi đang nhập */
}
```

---

### 5. Diễn giải các khái niệm then chốt

*   **id (Mã định danh):** Mỗi dòng trong bảng nhập liệu sẽ tương ứng với một `id` duy nhất trong cơ sở dữ liệu. CSS giúp bạn nhìn thấy số thứ tự dòng (`.row-num`) để bạn biết mình đang ở hóa đơn số mấy.
*   **updatedAt (Lệnh cập nhật):** Khi bạn bấm vào các nút có class `.btn-gold` (Nút Lưu), JavaScript sẽ lấy toàn bộ chữ trong các ô `.cell-input` và ghi đè thời gian `updatedAt` mới nhất. CSS giúp nút này "sáng lên" khi bạn di chuột vào, nhắc nhở bạn: "Hãy lưu lại để dữ liệu được đồng bộ!".
*   **deletedAt (Lệnh xóa):** Các nút `.del-btn` (thường là biểu tượng thùng rác) được CSS thiết kế nhỏ gọn ở cuối mỗi dòng. 
    *   *Tránh lỗi:* CSS giúp nút này có khoảng cách vừa đủ để bạn không bấm nhầm nút "Xóa" khi đang định bấm "Sửa".
*   **deviceId (Mã máy):** Trong phần này, CSS đảm bảo rằng thanh thông tin lưu trữ (`.save-bar`) luôn hiện rõ bạn đang dùng máy nào để lưu, giúp tránh việc hai người cùng lưu một lúc mà không biết.

---

### 6. Kết luận
Hiểu phần này giúp bạn tránh được lỗi:
- **Nhập sai số tiền:** Nhờ CSS căn lề phải cho các ô số (`.right`), bạn sẽ dễ dàng phát hiện ra mình có gõ thừa hay thiếu một số 0 nào không.
- **Xóa nhầm dữ liệu:** Màu đỏ cảnh báo của nút xóa giúp bạn khựng lại 1 giây trước khi quyết định, bảo vệ an toàn cho dữ liệu đã nhập.
- **Quên lưu:** CSS tạo hiệu ứng "tập trung" (`:focus`) vào ô đang nhập, giúp bạn không bị xao nhãng và hoàn thành việc nhập liệu trước khi chuyển sang trang khác.

---
*Tiếp theo sẽ là **PHẦN 3: DANH SÁCH DỮ LIỆU VÀ CÁC THẺ TÓM TẮT (RECORDS & CARDS)** - Cách chúng ta xem lại "thành quả" đã nhập.*

---

# PHẦN 3: DANH SÁCH DỮ LIỆU VÀ CÁC THẺ TÓM TẮT (RECORDS & CARDS)

### 1. Mục đích
Sau khi bạn đã nhập liệu ở PHẦN 2, thì PHẦN 3 là nơi bạn **"hưởng thụ thành quả"**. Đây là giao diện của các trang xem lại lịch sử chi phí và các thẻ tóm tắt tổng tiền của từng công trình.

Phần này giúp bảo vệ dữ liệu bằng cách:
- Giúp bạn so khớp dữ liệu giữa các máy (Sync) thông qua mắt nhìn.
- Làm nổi bật các con số tổng quát để bạn phát hiện ra ngay nếu có sự sai lệch do trùng lặp hoặc mất mát thông tin.

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng bạn có một **Bảng thông báo lớn** và một **Cuốn sổ nhật ký**:
- **Thẻ công trình (Cards):** Giống như những tấm bảng thông báo treo trước mỗi công trình. Nó chỉ ghi con số quan trọng nhất: "Tổng chi: 2 tỷ". CSS giúp cái thẻ này trông như một khối nổi, dễ nhìn và dễ bấm vào để xem chi tiết.
- **Bảng lịch sử (Records Table):** Giống như cuốn nhật ký ghi lại mọi thứ đã xảy ra. CSS giúp phân biệt dòng nào là "Hóa đơn mua vật tư" (màu vàng nhạt), dòng nào là "Chi phí khác" (màu xanh nhạt).

**Ví dụ đời thực:**
Khi hai máy cùng đồng bộ, bạn muốn biết máy kia đã gửi dữ liệu về chưa. Bạn chỉ cần nhìn vào bảng lịch sử. Nếu dòng mới hiện lên có màu sắc khác biệt hoặc có "nhãn" (Tag) ghi tên máy đó, bạn sẽ yên tâm là dữ liệu đã về đủ.

---

### 3. Ví dụ thực tế trong app của bạn
- **Phân loại nguồn dữ liệu:** App của bạn có 2 cách nhập: nhập nhanh và nhập chi tiết. CSS sẽ tô màu `.inv-row-quick` (xanh nhạt) và `.inv-row-detail` (vàng nhạt). Nhìn vào danh sách, bạn biết ngay cái nào là do bạn ghi nhanh tay, cái nào là có hóa đơn đầy đủ.
- **Thẻ công trình "biết nói":** Các thẻ `.ct-card` có hiệu ứng đổ bóng (`box-shadow`). Khi bạn di chuột vào, nó hơi nổi lên. Điều này giúp bạn không bấm trượt khi muốn xem chi tiết một công trình cụ thể.
- **Trạng thái "Trống":** Nếu một công trình chưa có tiền, CSS sẽ hiện chữ nghiêng mờ mờ (`.ghost`). Nhìn vào là biết ngay: "Công trình này chưa có ai nhập liệu gì cả".

---

### 4. Code chính (Trích đoạn quan trọng)

```css
/* 1. Thẻ tóm tắt công trình (Dashboard) */
.ct-card {
  background: var(--paper);
  border-radius: 10px;
  box-shadow: var(--shadow); /* Tạo độ nổi cho thẻ */
  transition: transform 0.2s; /* Hiệu ứng nhấp nhô khi chạm vào */
}
.ct-card:hover { 
  transform: translateY(-2px); /* Nhấc thẻ lên một chút khi di chuột */
}

/* 2. Màu sắc phân biệt nguồn gốc dữ liệu */
.inv-row-quick  td { background: #f0f9ff; } /* Màu xanh: Nhập nhanh */
.inv-row-detail td { background: #fffbeb; } /* Màu vàng: Nhập chi tiết */

/* 3. Các nhãn (Tags) để phân loại */
.tag {
  display: inline-block; padding: 2px 8px;
  border-radius: 3px; font-size: 11px; font-weight: 600;
}
.tag-gold { background: var(--gold-bg); color: var(--gold); }
```

---

### 5. Diễn giải các khái niệm then chốt

*   **id (Số thứ tự):** Trong bảng lịch sử, CSS căn chỉnh các cột rất đều nhau. Mỗi dòng hiển thị một `id` hoặc số thứ tự rõ ràng, giúp bạn đối chiếu với hóa đơn giấy: "Hóa đơn số 105 trong app có khớp với tờ phiếu trên bàn không?".
*   **updatedAt (Thời gian):** CSS định dạng phông chữ cho cột ngày tháng thường là phông chữ "đều cạnh" (`IBM Plex Mono`). 
    *   *Tại sao?* Để các con số ngày giờ thẳng hàng nhau, giúp bạn dễ dàng so sánh xem hóa đơn nào mới nhất, vừa được đồng bộ về.
*   **deletedAt (Dữ liệu đã xóa):** Mặc dù trong danh sách chính thường ẩn đi, nhưng nếu bạn xem "Thùng rác", CSS sẽ giúp các dòng bị xóa hiện lên với màu xám xịt hoặc gạch ngang, tương ứng với việc thuộc tính `deletedAt` đã có giá trị.
*   **deviceId (Mã máy):** Các nhãn (`.tag`) thường được dùng để hiển thị mã máy hoặc tên người nhập. 
    *   *Tránh lỗi:* Nếu bạn thấy một loạt hóa đơn có màu lạ và nhãn lạ, bạn sẽ nhận ra ngay: "À, đây là dữ liệu từ máy của đồng nghiệp vừa Sync về".

---

### 6. Kết luận
Hiểu phần này giúp bạn tránh được lỗi:
- **Tính trùng tiền:** Nhìn vào các thẻ `.ct-card`, nếu thấy số tiền vọt lên bất thường, bạn sẽ biết để vào kiểm tra danh sách chi tiết ngay lập tức.
- **Bỏ sót dữ liệu:** Nếu một công trình lẽ ra phải có tiền mà lại hiện chữ "Trống" (`.ghost`), bạn sẽ biết là máy của mình chưa Sync xong hoặc chưa có ai nhập liệu cho nó.
- **Nhầm lẫn giữa các loại chi phí:** CSS tô màu giúp bạn không bao giờ nhầm giữa tiền vật tư và tiền công thợ khi nhìn lướt qua bảng tổng hợp.

---

# PHẦN 4: GIAO DIỆN DI ĐỘNG VÀ CÁC THÔNG BÁO (MOBILE & TOASTS)

### 1. Mục đích
Đây là **"bộ phận cảm biến"** và **"hệ thống loa thông báo"** của ứng dụng. Phần này đảm bảo app hoạt động tốt trên mọi kích thước màn hình (từ máy tính bảng đến điện thoại cũ) và luôn phản hồi cho bạn biết dữ liệu đã đi đâu, về đâu.

Phần này bảo vệ dữ liệu bằng cách:
- Cung cấp bàn phím số (Numpad) chuyên dụng để bạn không bấm nhầm số tiền khi ở công trường.
- Hiện thông báo (Toast) ngay lập tức khi Sync thành công hoặc thất bại, giúp bạn kiểm soát dòng chảy dữ liệu.

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng ứng dụng của bạn như một **Chiếc xe biến hình**:
- **Tính tương thích (Responsive):** Khi đi trên đường rộng (Máy tính), xe mở rộng ra để bạn thấy nhiều cột thông tin. Khi đi vào ngõ hẹp (Điện thoại), xe tự thu gọn lại, ẩn bớt những thứ không cần thiết nhưng vẫn giữ lại những nút bấm quan trọng nhất.
- **Thông báo (Toasts/Modals):** Giống như bảng điều khiển trên xe. Khi bạn nhấn Sync, nó hiện đèn xanh: "Đã gửi dữ liệu lên mây thành công!". Nếu mất mạng, nó hiện đèn đỏ: "Lỗi kết nối, hãy thử lại!".

**Ví dụ đời thực:**
Bạn đang đứng ở công trường nắng nóng, tay ra mồ hôi. CSS trong phần này tạo ra các nút bấm cực to và bàn phím số riêng (`#numpad`). Bạn không cần phải căng mắt ra nhìn hay cố bấm vào những phím số nhỏ xíu của điện thoại nữa.

---

### 3. Ví dụ thực tế trong app của bạn
- **Bàn phím số Numpad:** Khi bạn chạm vào ô "Số tiền" trên điện thoại, một bảng số màu đen (`#numpad-box`) hiện lên từ dưới đáy màn hình. CSS giúp các phím này có khoảng cách rộng, bấm rất "sướng" và chính xác.
- **Thông báo thành công:** Sau khi bạn nhấn "Lưu" hoặc "Sync", một ô chữ nhỏ hiện ra ở góc dưới: "Đã lưu thành công" (`.toast.success`). Nhờ cái đèn xanh này, bạn yên tâm tắt máy đi làm việc khác.
- **Ẩn bớt cột trên điện thoại:** Trên máy tính bạn thấy cột "Người thực hiện", "Nhà cung cấp"... nhưng trên điện thoại, CSS sẽ ẩn bớt (`.hide-mobile`) để dành chỗ cho cột "Số tiền" và "Nội dung" to rõ hơn.

---

### 4. Code chính (Trích đoạn quan trọng)

```css
/* 1. Giao diện riêng cho điện thoại (Màn hình nhỏ hơn 768px) */
@media (max-width: 768px) {
  .hide-mobile { display: none !important; } /* Ẩn bớt những thứ rườm rà */
  .content { padding: 10px; } /* Thu nhỏ khoảng trắng để tận dụng màn hình điện thoại */
  .btn { width: 100%; justify-content: center; } /* Cho nút bấm to hết cỡ chiều ngang */
}

/* 2. Bàn phím số Numpad cho điện thoại */
#numpad-box {
  background: #1a1814;
  border-radius: 20px 20px 0 0; /* Bo tròn góc trên cho đẹp */
  animation: slideUp 0.22s; /* Hiệu ứng trượt từ dưới lên */
}
.np-key {
  height: 60px; font-size: 20px; /* Phím bấm cực to cho ngón tay */
}

/* 3. Thông báo (Toast) */
.toast {
  position: fixed; bottom: 24px; right: 24px;
  background: var(--ink); color: #fff;
  padding: 11px 18px; border-radius: 8px;
  opacity: 0; transition: all 0.25s; /* Mặc định là ẩn đi */
}
.toast.show { opacity: 1; transform: translateY(0); } /* Hiện ra khi có thông báo */
```

---

### 5. Diễn giải các khái niệm then chốt

*   **id (Ví dụ: `#numpad-overlay`, `#current-user-label`):** CSS dùng `id` để điều khiển các thành phần đặc biệt chỉ xuất hiện khi cần. 
    *   *Tránh lỗi:* Nhờ có `id` riêng cho điện thoại, app sẽ không bị nhầm lẫn giao diện giữa các thiết bị khác nhau.
*   **updatedAt (Xác nhận thời gian):** Các thông báo Toast thường kèm theo thông tin: "Cập nhật lúc 10:30". CSS giúp dòng chữ này nhỏ và tinh tế, không làm phiền trải nghiệm của bạn nhưng vẫn đủ để bạn biết dữ liệu là mới nhất.
*   **deletedAt (Xác nhận xóa):** Khi bạn bấm xóa, CSS sẽ hiện một bảng hỏi (Modal) giữa màn hình: "Bạn có chắc muốn xóa không?". 
    *   *Tránh lỗi:* Cái khung Modal này được CSS làm nổi bật lên, che mờ mọi thứ phía sau, buộc bạn phải tập trung trả lời, tránh việc lỡ tay xóa mất dữ liệu quan trọng.
*   **deviceId (Nhận diện thiết bị):** Trên điện thoại, CSS có thể ẩn tên máy dài dòng và chỉ hiện một biểu tượng nhỏ. Tuy nhiên, nó vẫn đảm bảo bạn luôn biết máy mình đang ở trạng thái "Online" hay "Offline".

---

### 6. Kết luận
Hiểu phần cuối cùng này giúp bạn tránh được lỗi:
- **Bấm nhầm trên điện thoại:** Tận dụng giao diện Mobile đã được tối ưu để nhập liệu nhanh và chuẩn xác.
- **Mất kiểm soát đồng bộ:** Luôn để ý các thông báo "Toast". Nếu không thấy thông báo thành công sau khi nhấn Sync, hãy kiểm tra lại mạng Wifi/4G ngay lập tức.
- **Xóa nhầm:** Luôn đọc kỹ nội dung trong các khung Modal nổi lên trước khi nhấn xác nhận.

---
**CHÚC MỪNG!** Bạn đã hoàn thành việc tìm hiểu toàn bộ file `style.css`. Giờ đây, bạn không chỉ biết app của mình đẹp như thế nào, mà còn hiểu tại sao từng màu sắc, từng nút bấm lại giúp bạn quản lý chi phí công trình an toàn và chuyên nghiệp đến thế.



