# PHẦN 1: KHUNG XƯƠNG VÀ CỔNG CHÀO (Phần đầu file index.html)

### 1. Mục đích
Phần này đóng vai trò là "bộ não" chuẩn bị và "cổng chào" của ứng dụng. Nó thiết lập các thư viện cần thiết, định nghĩa sẵn các mẫu in ấn (phiếu lương, hóa đơn) và tạo ra thanh điều hướng giúp bạn di chuyển giữa các chức năng như: Nhập chi phí, Chấm công, Xem báo cáo...

Trong hệ thống **Sync (Đồng bộ)**, phần này cực kỳ quan trọng vì nó chứa **Nút Đồng Bộ (Sync)** và **Khu vực Đăng nhập**. Đây là nơi xác định "Bạn là ai" và "Dữ liệu của bạn sẽ đi đâu".

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng ứng dụng của bạn như một **văn phòng công trường di động**:
- **Phần Header (Đầu trang):** Giống như bảng hiệu công ty và tập hồ sơ chứa các mẫu giấy tờ trống (phiếu thu, phiếu chi, bảng lương).
- **Nút Cloud/Sync:** Giống như một "nhân viên bưu tá". Khi bạn nhấn nút này, nhân viên sẽ gom tất cả giấy tờ bạn vừa ghi trong máy, chạy đi so khớp với máy chủ và mang những thay đổi từ các máy khác (của đồng nghiệp) về cập nhật vào máy bạn.
- **DeviceId (Mã thiết bị):** Giống như biển số xe của mỗi nhân viên. Khi gửi dữ liệu đi, hệ thống cần biết "tờ phiếu này do xe nào chở đến" để tránh nhầm lẫn.

---

### 3. Ví dụ thực tế trong app của bạn
- **Ví dụ về Sync:** Bạn đang ở công trình A, dùng điện thoại nhập một hóa đơn mua cát. Bạn nhấn nút ☁️ (Cloud). Ngay lập tức, kế toán ở văn phòng mở máy tính lên cũng sẽ thấy hóa đơn đó hiện ra.
- **Ví dụ về Template:** Khi bạn muốn trả lương, app không cần vẽ lại bảng lương từ đầu. Nó lấy cái "khuôn" đã giấu sẵn ở phần này, đổ tên công nhân và số tiền vào rồi "chụp ảnh" gửi cho bạn.

---

### 4. Code chính (Trích đoạn quan trọng)
```html
<!-- Nút Đồng Bộ và Cloud -->
<div class="topbar-controls">
  <button id="user-btn" onclick="toggleUserDropdown(...)">👤 <span id="current-user-label">Đăng nhập</span></button>
  <button id="sync-btn" onclick="manualSync()" title="Đồng bộ dữ liệu">☁️</button>
  <button id="jb-btn" onclick="openBinModal()"><span>☁️ Cloud</span></button>
</div>

<!-- Các Tab điều hướng chính -->
<nav class="topbar-nav">
  <button class="nav-btn active" onclick="goPage(this,'congtrinh')">🏗️ CÔNG TRÌNH</button>
  <button class="nav-btn" onclick="goPage(this,'nhap')">NHẬP CHI PHÍ</button>
  <button class="nav-btn" onclick="goPage(this,'chamcong')">📅 CHẤM CÔNG</button>
  ...
</nav>
```

---

### 5. Diễn giải các khái niệm then chốt

*   **id (Ví dụ: `id="sync-btn"`, `id="user-btn"`):** Đây là "tên định danh" duy nhất của mỗi nút hoặc mỗi ô nhập liệu. Giống như số CMND, không có hai cái tên nào trùng nhau trong cùng một file. Nhờ có `id`, khi bạn bấm nút, phần mềm mới biết chính xác bạn đang bấm vào "Nút Đồng Bộ" chứ không phải "Nút Chấm Công".
*   **deviceId (Mã máy):** Mặc dù không hiện trực tiếp trên giao diện này, nhưng khi bạn nhấn `sync-btn`, hệ thống sẽ bí mật đính kèm mã máy của bạn vào dữ liệu. 
    *   *Tại sao cần?* Để nếu bạn dùng 2 điện thoại cùng lúc, hệ thống biết dữ liệu nào mới hơn từ máy nào.
*   **updatedAt (Ngày cập nhật):** Khi bạn thực hiện bất kỳ thao tác nào ở các tab điều hướng, hệ thống sẽ ghi lại giờ phút giây chính xác.
*   **deletedAt (Đánh dấu xóa):** Nếu bạn xóa một hóa đơn, app sẽ không xóa hẳn (vứt đi), mà chỉ "dán một nhãn đỏ" ghi ngày giờ xóa vào đó. Nhờ vậy, khi đồng bộ giữa các máy, các máy khác cũng biết để "ẩn" hóa đơn đó đi thay vì lại tải nó lên lại.

---

### 6. Kết luận
Hiểu rõ phần này giúp bạn tránh được lỗi:
- **Mất dữ liệu:** Nếu chưa đăng nhập hoặc chưa nhấn Sync, dữ liệu chỉ nằm "tạm" trên máy bạn. Nếu mất máy hoặc xóa trình duyệt, dữ liệu sẽ mất.
- **Trùng dữ liệu:** Nhấn Sync đúng cách giúp hệ thống nhận diện đúng `deviceId` và `updatedAt`, đảm bảo không bị cộng dồn tiền hai lần khi hai người cùng sửa một hóa đơn.

---
*Tiếp theo sẽ là **PHẦN 2: TRANG CHỦ VÀ BẢNG TỔNG HỢP (DASHBOARD)**.*

---

# PHẦN 2: TRANG CHỦ VÀ BẢNG TỔNG HỢP (DASHBOARD)

### 1. Mục đích
Nếu PHẦN 1 là "cổng vào", thì PHẦN 2 là **"phòng điều hành"**. Đây là nơi bạn không cần nhập liệu mà chỉ để **quan sát**. Nó tổng hợp hàng ngàn con số từ các hóa đơn, bảng chấm công, tiền ứng... để biến chúng thành những biểu đồ, thẻ màu (KPI) giúp bạn biết ngay lập tức: "Công trình này đang lời hay lỗ?" hoặc "Tháng này đã chi bao nhiêu tiền?".

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng bạn là **Chủ thầu**:
- Bạn không có thời gian để đọc từng tờ hóa đơn mua đinh, mua cát.
- Bạn cần một cái **bảng thông báo lớn** ở giữa công trường:
    - Một ô ghi: **"Tổng tiền đã chi: 1 tỷ"**.
    - Một cái biểu đồ hình tròn: **"60% là tiền vật tư, 30% là tiền nhân công, 10% là máy móc"**.
    - Một danh sách: **"5 công trình đang chạy"**.
- PHẦN 2 chính là cái bảng thông báo đó. Nó tự động cộng dồn mọi thứ cho bạn.

---

### 3. Ví dụ thực tế trong app của bạn
- **Ví dụ về KPI:** Khi bạn vừa lưu một hóa đơn 50 triệu ở tab "Nhập chi phí", bạn quay lại Dashboard sẽ thấy ô "Tổng CP" tự động nhảy số thêm 50 triệu mà không cần bạn phải làm gì.
- **Ví dụ về Lọc (Filter):** Bạn chọn "Công trình A" trong danh sách, toàn bộ biểu đồ sẽ biến đổi chỉ để hiện số liệu của riêng công trình A đó. Điều này giúp bạn so sánh chi phí thực tế với ngân sách dự kiến.

---

### 4. Code chính (Trích đoạn quan trọng)
```html
<!-- Trang hiển thị danh sách các công trình (Mặc định khi mở app) -->
<div class="page active" id="page-congtrinh">
  <div id="ct-overview-wrap"></div> <!-- Nơi hiện các "thẻ" công trình -->
</div>

<!-- Trang Dashboard tổng quan với biểu đồ -->
<div class="page" id="page-dashboard">
  <!-- Các thẻ con số (KPI) -->
  <div id="db-kpi-row"></div> 
  
  <!-- Khu vực biểu đồ -->
  <div id="db-charts-row">
    <div id="db-bar-chart"></div> <!-- Biểu đồ cột theo tháng -->
    <div id="db-pie-chart"></div> <!-- Biểu đồ tròn tỷ trọng -->
  </div>
  
  <!-- Danh sách chi tiết từng công trình -->
  <div id="ct-grid" class="ct-summary-grid"></div>
</div>
```

---

### 5. Diễn giải các khái niệm then chốt

*   **page active (`id="page-congtrinh"`):** Chữ "active" có nghĩa là trang này sẽ hiện ra ngay lập tức khi bạn vừa mở app. Nó là "bộ mặt" của ứng dụng.
*   **KPI (Key Performance Indicator):** Trong code là `db-kpi-row`. Đây là những ô chữ nhật hiện số tiền lớn. Nếu số này bị sai (ví dụ: **gấp đôi tiền**), thường là do có dữ liệu bị trùng ở file gốc chưa được lọc bỏ.
*   **Charts (Biểu đồ):** App sử dụng các thẻ `div` để vẽ biểu đồ. Nếu biểu đồ không hiện, có thể do trình duyệt của bạn quá cũ hoặc dữ liệu ngày tháng (`updatedAt`) bị ghi sai định dạng.
*   **Dữ liệu "Động":** Bạn sẽ thấy trong code có những thẻ `div` trống không (như `<div id="db-top5"></div>`). Điều này là vì Senior Developer muốn app chạy nhanh: Khi bạn nhấn xem, app mới bắt đầu "nấu" dữ liệu và đổ vào các thẻ này, chứ không làm sẵn từ đầu để tránh nặng máy.

---

### 6. Kết luận
Hiểu phần này giúp bạn tránh được lỗi:
- **Nhìn sai con số:** Dashboard lấy dữ liệu từ tất cả các máy đã đồng bộ. Nếu đồng nghiệp của bạn nhập sai, Dashboard của bạn cũng sẽ sai. Hãy luôn kiểm tra "Tổng CP" ở đầu trang để đối chiếu.
- **Lỗi hiển thị:** Nếu Dashboard trắng trơn, hãy kiểm tra xem bạn đã chọn đúng "Năm" ở thanh trên cùng chưa (phần này liên quan đến logic lọc dữ liệu theo năm).

---
*Tiếp theo sẽ là **PHẦN 3: CÁC BIỂU MẪU NHẬP LIỆU (CHI PHÍ, CHẤM CÔNG, TIỀN ỨNG)**.*

---

# PHẦN 3: CÁC BIỂU MẪU NHẬP LIỆU (CHI PHÍ, CHẤM CÔNG, TIỀN ỨNG)

### 1. Mục đích
Đây là **"trạm thu mua"** dữ liệu. Phần lớn thời gian bạn sử dụng app là ở đây. PHẦN 3 định nghĩa giao diện của các bảng tính, các ô nhập ngày tháng, số tiền... để bạn đổ dữ liệu thô vào hệ thống. Mỗi khi bạn nhấn "Lưu", app sẽ gắn cho dữ liệu đó các mã ẩn như `id`, `deviceId` để bắt đầu vòng đời đồng bộ.

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng các biểu mẫu nhập liệu này giống như những **tờ hóa đơn trắng** hoặc **sổ chấm công**:
- **Nhập chi phí:** Giống như một xấp hóa đơn bán lẻ, bạn ghi nhanh từng dòng: "Cát: 500k", "Đá: 200k".
- **Chấm công:** Giống như tờ lịch treo tường có tên công nhân, mỗi ngày bạn đánh dấu 1 công hoặc nửa công.
- **Tiền ứng:** Giống như một cuốn sổ nợ nhỏ, ghi lại ai đã tạm ứng bao nhiêu.

Tất cả những gì bạn nhập ở đây sẽ được app "đóng dấu" ngày giờ chính xác để sau này biết cái nào nhập trước, cái nào nhập sau.

---

### 3. Ví dụ thực tế trong app của bạn
- **Sửa dữ liệu trên 2 máy:** Nếu bạn sửa một hóa đơn trên máy A lúc 8:00 và đồng nghiệp cũng sửa chính hóa đơn đó trên máy B lúc 8:05. Nhờ khái niệm `updatedAt` (giờ cập nhật), khi đồng bộ, app sẽ tự động lấy bản sửa lúc 8:05 vì nó "mới hơn".
- **Xóa dữ liệu:** Khi bạn nhấn nút "Xóa", app không thực sự xóa. Nó chỉ ghi chú vào thuộc tính `deletedAt` rằng: "Tờ phiếu này đã bị hủy". Điều này giúp các máy khác cũng biết để xóa theo thay vì lại tải lại tờ phiếu đó lên.

---

### 4. Code chính (Trích đoạn quan trọng)
```html
<!-- Bảng nhập nhanh hóa đơn -->
<div class="page" id="page-nhap">
  <table class="entry-table">
    <thead>
      <tr>
        <th>Loại Chi Phí *</th>
        <th>Công Trình *</th>
        <th>Số Tiền (đ)</th>
        <th>Nội Dung / Ghi Chú</th>
      </tr>
    </thead>
    <tbody id="entry-tbody"></tbody> <!-- Nơi các dòng nhập liệu hiện ra -->
  </table>
  <button id="entry-save-btn" onclick="saveAllRows()">💾 Lưu Hóa Đơn</button>
</div>

<!-- Bảng chấm công tuần -->
<div class="page" id="page-chamcong">
  <table class="cc-grid-table">
    <tbody id="cc-tbody"></tbody> <!-- Các ô nhập công (1, 0.5) -->
  </table>
  <button id="cc-save-btn" onclick="saveCCWeek()">💾 Lưu tuần này</button>
</div>
```

---

### 5. Diễn giải các khái niệm then chốt

*   **id (Định danh bản ghi):** Mỗi khi bạn nhấn "Lưu", app tự sinh ra một dãy số dài dằng dặc cho hóa đơn đó. Đây là "mã vạch" riêng của nó. Dù bạn đổi tên công trình hay đổi số tiền, cái `id` này vẫn giữ nguyên để app biết bạn đang sửa "đúng người, đúng việc".
*   **updatedAt (Thời gian cập nhật):** Mỗi lần bạn bấm "Lưu", app sẽ ghi lại giây phút đó. 
    *   *Tránh lỗi:* Nếu không có cái này, khi hai người cùng sửa một hóa đơn, app sẽ bị loạn không biết nghe theo ai.
*   **deviceId (ID thiết bị):** App ghi lại hóa đơn này được tạo từ điện thoại của "Anh A" hay máy tính của "Chị B". 
    *   *Tránh lỗi:* Giúp bạn biết ai là người đã nhập con số đó để dễ dàng đối chiếu khi có sai sót.
*   **Logic Merge (Gộp dữ liệu):** Khi bạn nhập ở tab này, app sẽ kiểm tra xem `id` này đã có trong máy chưa. Nếu có rồi thì "Cập nhật", chưa có thì "Thêm mới".

---

### 6. Kết luận
Hiểu phần này giúp bạn tránh được lỗi:
- **Mất dữ liệu khi sửa:** Luôn đảm bảo bạn có mạng khi nhấn Lưu (nếu muốn đồng bộ ngay) hoặc nhấn Sync sau khi nhập xong.
- **Trùng lặp tiền:** Nếu bạn nhập một hóa đơn hai lần (tạo ra 2 `id` khác nhau), app sẽ coi đó là 2 khoản chi khác nhau. Dashboard sẽ hiện số tiền gấp đôi. Hãy sử dụng chức năng tìm kiếm ở tab "Tất cả chi phí" để kiểm tra xem mình đã nhập chưa trước khi nhập mới.

---
*Tiếp theo sẽ là **PHẦN 4: HỆ THỐNG QUẢN LÝ DANH MỤC VÀ CÔNG CỤ CỐT LÕI (TOOLS)**.*

---

# PHẦN 4: HỆ THỐNG QUẢN LÝ DANH MỤC VÀ CÔNG CỤ CỐT LÕI (TOOLS)

### 1. Mục đích
Đây là **"phòng kỹ thuật"** và **"kho lưu trữ"** của ứng dụng. Phần này quản lý những thứ nền tảng như: Danh sách công trình, tên nhân công, loại chi phí... Đặc biệt, nó chứa các công cụ cực kỳ quan trọng để **bảo vệ dữ liệu** của bạn (Sao lưu, Xuất file Excel) và các bảng điều khiển ẩn (Numpad) giúp nhập liệu trên điện thoại dễ dàng hơn.

---

### 2. Giải thích dễ hiểu
Hãy tưởng tượng bạn có một cái **két sắt** và một **cuốn từ điển**:
- **Danh mục (Danh mục):** Giống như cuốn từ điển. Trước khi viết hóa đơn, bạn phải có tên công trình trong từ điển này. Nếu bạn sửa tên công trình ở đây, app sẽ tự động "đi tìm" tất cả hóa đơn cũ để đổi tên theo cho khớp.
- **Tools (Công cụ):** Giống như chiếc két sắt bảo hiểm.
    - **Xuất snapshot (JSON):** Chụp ảnh toàn bộ văn phòng và cất vào một cái hộp. Bạn có thể mang cái hộp này sang điện thoại khác để mở ra y hệt.
    - **Import Excel:** Đổ một bao tải dữ liệu từ máy tính vào app một cách nhanh chóng.
- **Numpad (Bàn phím số):** Giống như một chiếc máy tính bỏ túi hiện ra mỗi khi bạn cần nhập tiền, giúp ngón tay to cũng có thể bấm chính xác trên màn hình điện thoại nhỏ.

---

### 3. Ví dụ thực tế trong app của bạn
- **Ví dụ về Cập nhật Danh mục:** Bạn đổi tên công trình "Nhà anh Bình" thành "Biệt thự Bình Tân". Ngay lập tức, Dashboard và tất cả hóa đơn liên quan sẽ tự nhảy theo tên mới. Điều này giúp dữ liệu luôn thống nhất.
- **Ví dụ về Sao lưu (Backup):** Điện thoại của bạn bị hỏng. Nếu bạn đã từng nhấn "Xuất snapshot" và lưu file đó vào email, bạn chỉ cần mua máy mới, tải app về và "Import JSON" là mọi thứ quay trở lại 100%.

---

### 4. Code chính (Trích đoạn quan trọng)
```html
<!-- Khu vực quản lý Danh mục -->
<div class="page" id="page-danhmuc">
  <div id="dm-grid" class="settings-grid"></div> <!-- Nơi sửa tên CT, nhân công... -->
  
  <!-- Khu vực công cụ Tools -->
  <div class="records-wrap">
    <button onclick="toolExportJSON()">📦 Xuất snapshot hệ thống</button>
    <button onclick="toolImportJSON()">📥 Import JSON</button>
    <button onclick="toolExportExcel()">📤 Export Excel</button>
  </div>
</div>

<!-- Các file logic "chạy ngầm" phía sau -->
<script src="core.js"></script> <!-- Bộ não chính -->
<script src="sync.js"></script> <!-- Nhân viên đồng bộ -->
<script src="main.js"></script> <!-- Người điều phối -->
```

---

### 5. Diễn giải các khái niệm then chốt

*   **script src="...":** Đây là cách HTML gọi các "vị quân sư" đến làm việc.
    *   `core.js`: Quản lý việc lưu dữ liệu vào bộ nhớ máy (IndexedDB).
    *   `sync.js`: Quản lý việc gửi dữ liệu lên mây.
    *   Thứ tự gọi rất quan trọng: Phải gọi "Bộ não" (`core`) trước rồi mới đến "Người điều phối" (`main`).
*   **IndexedDB (Kho lưu trữ cục bộ):** Đây là một ngăn kéo bí mật bên trong trình duyệt điện thoại của bạn. Dữ liệu bạn nhập sẽ nằm ở đây TRƯỚC KHI được đồng bộ lên mạng. Đó là lý do tại sao app vẫn chạy được khi không có Wifi.
*   **JSON (Snapshot):** Là một định dạng file đặc biệt chứa toàn bộ dữ liệu dưới dạng văn bản. Nó là "bản sao tuyệt đối" của hệ thống.
*   **Reset toàn bộ dữ liệu:** Nút này có màu đỏ cảnh báo. Nó sẽ dọn sạch "ngăn kéo" IndexedDB. Đừng bao giờ nhấn nút này nếu bạn chưa chắc chắn dữ liệu đã được đồng bộ hoặc đã có file snapshot.

---

### 6. Kết luận
Hiểu phần cuối này giúp bạn tránh được lỗi:
- **Mất trắng dữ liệu:** Hãy tập thói quen "Xuất snapshot" mỗi cuối tuần và lưu vào Google Drive hoặc Email. Đây là cách bảo vệ dữ liệu 100% trước mọi sự cố máy móc.
- **Sai lệch báo cáo:** Luôn giữ Danh mục sạch sẽ. Nếu có 2 công trình tên gần giống nhau (VD: "Nhà A" và "Nha A"), app sẽ coi đó là 2 nơi khác nhau và chia tiền ra làm hai, khiến bạn nhìn báo cáo bị sai.

---
**CHÚC MỪNG!** Bạn đã đi hết sơ đồ "văn phòng điện tử" của mình. Hiểu được file `index.html` này nghĩa là bạn đã nắm được cái khung để quản lý chi phí công trình một cách chuyên nghiệp và an toàn nhất.



