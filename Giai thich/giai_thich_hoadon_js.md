# 📘 GIẢI THÍCH FILE `hoadon.js` — PHẦN 1/2

> **File:** `hoadon.js` · **1135 dòng** · Load thứ 3 trong hệ thống
> **Vai trò:** Quản lý toàn bộ chức năng liên quan đến Hóa đơn / Chi phí (Nhập nhanh, Nhập chi tiết, Quản lý danh sách, Thùng rác)

---

## PHẦN 1: BẢNG NHẬP NHANH (QUICK ENTRY)

### 1. Mục đích
Cho phép người dùng **nhập nhiều hóa đơn đơn giản cùng lúc** trên một bảng. Chức năng này phù hợp với các chi phí không cần ghi chi tiết từng món hàng (như chi phí nhân công khoán, ăn uống, điện nước...).

### 2. Giải thích dễ hiểu
Tưởng tượng bạn đang cầm trên tay 5 tờ hóa đơn lẻ tẻ. Thay vì phải mở 5 form nhập từng cái một, bạn có 1 bảng tính giống Excel. Bạn điền liên tục:
- Dòng 1: Tiền cơm (Công trình A) - 500k
- Dòng 2: Tiền điện (Công trình B) - 1 triệu
- Nhấn `Enter` để nhảy dòng rất nhanh.
Hệ thống cũng rất thông minh: Nếu dòng 2 bạn không chọn loại hay công trình, nó sẽ tự động "copy" từ dòng 1 xuống để tiết kiệm thời gian bấm.

### 3. Ví dụ thực tế trong app
| Loại | Công trình | Số tiền | Nội dung |
|---|---|---|---|
| Hóa Đơn Lẻ | CT A DŨNG | 500,000 | Ăn trưa thợ |
| Hóa Đơn Lẻ | (tự copy CT A DŨNG) | 200,000 | Tiền nước đá |

### 4. Logic xử lý dữ liệu
- **Input:** User nhập từng ô (loại, công trình, tiền, nội dung...).
- **Output:** Giao diện tự động tính tổng tiền ở cuối bảng.
- **Khi nào chạy:** Khi user mở tab Nhập Nhanh, hoặc bấm nút "+" thêm dòng.

### 5. Code chính
```javascript
function addRow(d={}) {
  const tbody = document.getElementById('entry-tbody');
  
  // Tự động copy Loại và Công trình từ dòng ngay trên nó
  if(!d.loai && !d.congtrinh) {
    const lastRow = tbody.querySelector('tr:last-child');
    if(lastRow) {
      const prevLoai = lastRow.querySelector('[data-f="loai"]')?.value || '';
      const prevCt   = lastRow.querySelector('[data-f="ct"]')?.value   || '';
      if(prevLoai || prevCt) d = { ...d, loai: prevLoai, congtrinh: prevCt };
    }
  }
  
  // Tạo HTML cho dòng mới... (dropdowns, inputs)
  // ...
  
  // Enter key → nhảy xuống dòng dưới
  entryInputs.forEach(inp => {
    inp.addEventListener('keydown', function(e) {
      if(e.key !== 'Enter') return;
      // Nhảy xuống ô tương ứng ở dòng dưới, hoặc tự thêm dòng mới nếu hết
    });
  });
}
```

### 6. Diễn giải code
| Dòng / Cụm từ | Ý nghĩa |
|---|---|
| `if(!d.loai && !d.congtrinh)` | Nếu tạo dòng rỗng, lấy dữ liệu từ `lastRow` (dòng trên cùng). |
| `dataset.raw` | Lưu giá trị tiền gốc (vd: 500000) để tính toán, trong khi ô input hiển thị có dấu phẩy (500,000). |
| `calcSummary()` | Duyệt tất cả các dòng, cộng dồn tổng tiền và đếm số hóa đơn. |

### 7. Kết luận
Hiểu phần này giúp bạn:
- Biết được tính năng "Copy thông minh" và "Enter nhảy dòng" giúp nhập liệu nhanh hơn.
- Biết tại sao ô số tiền phải xử lý đặc biệt (ẩn dấu phẩy khi gõ, hiện dấu phẩy khi xem).

### ⚠️ Lỗi thường gặp
- **Số tiền không cộng dồn:** Gõ chữ hoặc ký tự lạ vào ô số tiền khiến `dataset.raw` bị sai.
- **Dòng tự copy sai ý muốn:** Vì tính năng tự copy dòng trên, nếu quên đổi tên công trình, hóa đơn sẽ bị gán nhầm.

---

## PHẦN 2: LƯU HÓA ĐƠN & KIỂM TRA TRÙNG LẶP

### 1. Mục đích
Lưu các hóa đơn từ bảng nhập nhanh vào hệ thống, nhưng quan trọng nhất là **cảnh báo nếu phát hiện người dùng đang nhập lại một hóa đơn đã từng nhập trước đó**.

### 2. Giải thích dễ hiểu
Nhiều lúc bạn cầm 1 tờ hóa đơn và quên mất hôm qua mình đã nhập chưa.
Bạn nhập lại: "Mua xi măng 5 triệu cho CT A DŨNG".
Hệ thống sẽ "nghĩ": Hôm qua cũng có 1 cái 5 triệu ở CT này, nội dung cũng giống giống. Nó sẽ hiện bảng cảnh báo: "Ê, cái này quen quen, bạn có chắc muốn lưu không hay đây là hóa đơn cũ?". Bạn có thể chọn "Hủy" hoặc "Vẫn lưu".

### 3. Ví dụ thực tế trong app
- Hôm qua nhập: `Ngày 24/04 | CT BÁC CHỮ | 10,000,000đ | Tiền cát đá`
- Hôm nay nhập: `Ngày 24/04 | CT BÁC CHỮ | 10,000,000đ | Cát đá`
- App sẽ hiện cảnh báo: `HÓA ĐƠN MỚI Giống 85%` với hóa đơn cũ.

### 4. Logic xử lý dữ liệu
- **Input:** Các dòng dữ liệu từ bảng nhập nhanh chuẩn bị lưu.
- **Output:** Lưu vào Database, HOẶC hiện Modal cảnh báo trùng.
- **Khi nào chạy:** Khi user bấm "Lưu Tất Cả".

### 5. Code chính
```javascript
function saveAllRows(skipDupCheck) {
  // ... lấy dữ liệu các dòng ...

  if(!skipDupCheck) {
    const dupRows = [];
    newRows.forEach(r => {
      // Tìm các hóa đơn cũ có CÙNG ngày, CÙNG công trình, CÙNG số tiền
      const candidates = invoices.filter(i =>
        i.ngay === r.payload.ngay &&
        i.congtrinh === r.payload.congtrinh &&
        (i.thanhtien||i.tien||0) === r.payload.tien
      );

      // So sánh nội dung (nd) xem giống bao nhiêu %
      candidates.forEach(inv => {
        const sim = _strSimilarity(nd, (inv.nd||'').toLowerCase().trim());
        if(sim >= 0.7) { // Giống trên 70% thì coi là trùng
          dupRows.push({ newRow: r, existing: inv, similarity: sim });
        }
      });
    });

    if(dupRows.length > 0) {
      _showDupModal(dupRows, rows); // Hiện cảnh báo
      return; // Dừng việc lưu lại
    }
  }
  
  _doSaveRows(rows); // Thực sự lưu vào Data
}
```

### 6. Diễn giải code
| Hàm / Logic | Ý nghĩa |
|---|---|
| `skipDupCheck` | Cờ bỏ qua kiểm tra trùng (khi user đã xem cảnh báo và bấm "Vẫn lưu"). |
| `candidates` | Lọc thô: Chỉ xét nghi ngờ trùng nếu Trùng Ngày + Trùng CT + Trùng Tiền. |
| `_strSimilarity` | Hàm đo độ giống nhau của 2 chuỗi (nội dung). |
| `>= 0.7` | Độ giống nhau đạt 70% trở lên thì app mới cảnh báo. |
| `proj.status === 'closed'` | CT đã quyết toán thì chặn không cho lưu. |

### 7. Kết luận
Hiểu phần này giúp bạn:
- An tâm vì app tự canh chừng việc nhập đúp (gấp đôi chi phí).
- Biết cách máy nhận diện "trùng": Phải giống Ngày, CT, Số tiền, và chữ nghĩa giống 70%.

### ⚠️ Lỗi thường gặp
- **Cảnh báo sai (False Alarm):** Nếu trong 1 ngày, ở 1 công trình, bạn nhập 2 lần mua đồ cùng giá 500k và nội dung ghi y chang nhau → App sẽ báo trùng, bạn chỉ cần bấm xác nhận lưu tiếp là được.

---

## PHẦN 3: HÓA ĐƠN CHI TIẾT (INVOICE DETAIL)

### 1. Mục đích
Dùng để nhập các hóa đơn mua vật tư/thiết bị có **nhiều món hàng bên trong**, có số lượng, đơn giá, và đặc biệt là có **chiết khấu (giảm giá)**.

### 2. Giải thích dễ hiểu
Bảng Nhập Nhanh chỉ nhập được cục tổng. Nếu bạn cầm hóa đơn mua Vật Liệu XD dài dằng dặc:
1. Xi măng: 10 bao x 90k
2. Cát: 5 khối x 300k
... Và nhà cung cấp bớt cho 5% tổng bill.
Trang "Nhập Chi Tiết" sẽ giúp bạn điền từng dòng. Máy tự nhân Số lượng x Đơn giá, tự trừ Chiết khấu ra Thành tiền, và gom tên các món hàng lại thành một câu Nội dung ghi chú.

### 3. Ví dụ thực tế trong app
- Dòng 1: `Tên: Xi măng | ĐVT: bao | SL: 10 | Đơn giá: 90,000 | CK: để trống` → Thành tiền: 900,000
- Dòng 2: `Tên: Đá 1x2 | ĐVT: khối | SL: 5 | Đơn giá: 350,000 | CK: 50000 (trừ thẳng 50k)` → Thành tiền: 1,700,000
- Tổng cộng hóa đơn: Chiết khấu tổng thêm 5% ở dưới chân bảng.

### 4. Logic xử lý dữ liệu
- **Input:** Từng món hàng (tên, sl, giá, ck dòng) + ck tổng hóa đơn.
- **Output:** Tự động điền "Thành tiền" dòng, tự sinh "Nội dung" (VD: "Xi măng, Đá 1x2"), lưu lại thành 1 hóa đơn lớn (có chứa mảng `items`).
- **Khi nào chạy:** Khi gõ số vào ô Giá/SL/CK thì tự nhảy Thành tiền.

### 5. Code chính
```javascript
// Hàm tính tiền 1 dòng có áp chiết khấu
function calcRowMoney(sl, dongia, ck) {
  const base = sl * dongia;
  if (!ck) return Math.round(base);
  // Nếu ghi "5%" thì giảm 5%
  if (ck.endsWith('%')) return Math.round(base * (1 - (parseFloat(ck) || 0) / 100));
  // Nếu ghi "50000" thì trừ thẳng 50 ngàn
  return Math.round(base - parseMoney(ck));
}

// Tự động gom tên hàng hóa thành "Nội Dung"
function generateDetailNd() {
  const items = [];
  document.querySelectorAll('#detail-tbody tr [data-f="ten"]').forEach(inp => {
    const v = inp.value.trim();
    if(v) items.push({ ten: v });
  });
  document.getElementById('detail-nd').value = buildNDFromItems(items); // Hàm ở core.js
}
```

### 6. Diễn giải code
| Dòng / Logic | Ý nghĩa |
|---|---|
| `ck.endsWith('%')` | Phân biệt thông minh: Gõ `%` thì hiểu là giảm theo tỷ lệ, gõ số thì hiểu là trừ tiền mặt. |
| `calcDetailTotals()` | Cộng dồn các thành tiền dòng lại, sau đó áp dụng chiết khấu tổng (footer-ck) ra con số phải trả cuối cùng. |
| `inv.items = [...]` | Khác với hóa đơn nhập nhanh, hóa đơn này có thêm một cái "túi" tên là `items` chứa chi tiết từng dòng để sau này mở ra xem lại. |

### 7. Kết luận
Hiểu phần này giúp bạn:
- Biết cách nhập chiết khấu rất linh hoạt (thích trừ % hay trừ thẳng tiền đều được).
- Không cần mất công gõ tay "Nội dung" hóa đơn, máy tự nối tên hàng hóa lại.

### ⚠️ Lỗi thường gặp
- **Ghi nhầm chiết khấu:** Cố tình ghi "5%" nhưng gõ thiếu dấu `%` thành "5", hệ thống sẽ hiểu là trừ 5 VNĐ.
- **Mất chi tiết hàng hóa:** Nếu mạng chậm/lỗi lúc lưu, hoặc xuất ra Excel không có cột chi tiết thì người khác chỉ thấy tổng tiền (do bản chất nó vẫn là 1 hóa đơn tổng).
# 📘 GIẢI THÍCH FILE `hoadon.js` — PHẦN 2/2

---

## PHẦN 4: HIỂN THỊ DANH SÁCH & BỘ LỌC (INVOICE LIST)

### 1. Mục đích
Hiển thị **tất cả hóa đơn** đã nhập thành một bảng lớn, cho phép người quản lý tìm kiếm, lọc dữ liệu (theo Công trình, Loại, Tháng), và xem dưới dạng phân trang (mỗi trang một số lượng dòng nhất định).

### 2. Giải thích dễ hiểu
Giống như bạn cầm một tệp hồ sơ dày cộm hàng ngàn hóa đơn, trang Danh Sách sẽ giúp bạn:
- Rút riêng các hóa đơn của "CT BÁC CHỮ" ra xem (Lọc Công trình).
- Rút tiếp chỉ xem tiền "Nhân Công" của công trình đó (Lọc Loại).
- Hiển thị 50 dòng mỗi trang để bảng không bị đơ giật.
Ở đây, bạn có thể bấm sửa (✏️) hoặc xóa (✕) bất kỳ hóa đơn nào bạn nhập sai.

### 3. Ví dụ thực tế trong app
Giao diện hiển thị:
`150 hóa đơn · Tổng: 2,500,000,000`
Khi chọn Lọc Tháng = `2026-03`, màn hình tự thu lại chỉ còn:
`45 hóa đơn · Tổng: 850,000,000`

### 4. Logic xử lý dữ liệu
- **Input:** Tất cả hóa đơn từ Cache (`getInvoicesCached()`) + Giá trị đang chọn ở các ô Lọc (Filter).
- **Output:** Một mảng hóa đơn đã lọc (`filteredInvs`), cắt ra một phần tử nhỏ để render ra HTML.
- **Khi nào chạy:** Đổi năm, chọn bộ lọc, gõ tìm kiếm, đổi trang, hoặc sau khi mới lưu xong.

### 5. Code chính
```javascript
function filterAndRender() {
  const q=document.getElementById('search').value.toLowerCase();
  const fCt=document.getElementById('f-ct').value;
  
  // 1. Lọc hóa đơn
  filteredInvs = getInvoicesCached().filter(inv => {
    if(!inActiveYear(inv.ngay)) return false; // Khác năm đang xem -> Ẩn
    if(fCt && resolveProjectName(inv)!==fCt) return false; // Sai công trình -> Ẩn
    // ... lọc loại, tháng
    return true;
  });
  
  // 2. Sắp xếp Mới Nhất lên đầu
  filteredInvs.sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
  
  renderTable(); // 3. Cắt trang và in ra màn hình
}

// Kiểm tra hóa đơn này sinh ra từ đâu?
function _resolveInvSource(inv) {
  if (inv.source === 'detail') return 'detail';
  if (inv.source === 'quick') return 'quick';
  if (inv.items && inv.items.length) return 'detail'; // data cũ
  return 'quick';
}
```

### 6. Diễn giải code
| Logic | Ý nghĩa |
|---|---|
| `getInvoicesCached()` | Nguồn dữ liệu đã được làm sạch, bỏ qua các hóa đơn nằm trong thùng rác. |
| `resolveProjectName(inv)` | Hàm lấy đúng tên công trình, phòng khi tên cũ bị đổi. |
| `sort(...)` | So sánh chuỗi ngày tháng (VD: "2026-04-20" vs "2026-03-15") để đẩy ngày gần nhất lên trên cùng. |
| `_resolveInvSource` | Hóa đơn từ Bảng Nhập Nhanh, Nhập Chi Tiết, hay là từ chức năng Chấm Công đẩy sang? Phân biệt để hiện icon Sửa ✏️ cho đúng. |

### 7. Kết luận
- Biết cách máy tính thu hẹp danh sách rất nhanh.
- Hiểu tại sao có hóa đơn bấm sửa thì ra bảng Ngắn, có cái lại ra bảng Dài (do nó phân biệt nguồn `quick` và `detail`).
- Hóa đơn từ Tab Chấm Công đẩy sang không thể xóa ở đây (bảo vệ dữ liệu gốc).

---

## PHẦN 5: THÙNG RÁC & PHỤC HỒI (TRASH SYSTEM)

### 1. Mục đích
**Bảo vệ dữ liệu an toàn**. Khi xóa hóa đơn, nó không bị hủy vĩnh viễn mà rơi vào Thùng Rác (giống Recycle Bin của Windows). Có thể khôi phục lại khi xóa nhầm.

### 2. Giải thích dễ hiểu
Khi bạn bấm nút Xóa (✕), hệ thống sẽ:
1. Gắn một cái nhãn `deletedAt` (Ngày bị xóa) lên hóa đơn đó.
2. Từ lúc này, mọi bộ lọc đều lờ nó đi, màn hình tổng kết coi như nó bằng 0.
3. Nhưng nó vẫn còn nằm trong bộ nhớ máy. Khi mở mục "Đã Xóa", bạn sẽ thấy nó. Bạn bấm "Khôi phục", cái nhãn `deletedAt` bị tháo ra, nó sống lại.

### 3. Ví dụ thực tế trong app
- Xóa hóa đơn 10 triệu.
- Tổng chi phí Công trình tự động giảm 10 triệu.
- Chuyển sang xem "Thùng Rác" -> thấy hóa đơn 10 triệu ở đó -> Bấm "Khôi phục" -> Tổng chi phí lại tăng lại 10 triệu.

### 4. Logic xử lý dữ liệu
- **Soft Delete (Xóa mềm):** Gắn cờ `deletedAt`.
- **Trash Add:** Lưu một bản sao nhỏ vào list `trash_v1` để giao diện Thùng rác dễ hiển thị.
- **Restore:** Gỡ cờ `deletedAt` ra khỏi Database chính.

### 5. Code chính
```javascript
function delInvoice(id) {
  // ...
  const now = Date.now();
  const idx = invoices.findIndex(i => String(i.id) === String(id));
  
  // 1. Soft Delete (Gắn cờ đã xóa)
  invoices[idx] = { ...invoices[idx], deletedAt: now, updatedAt: now };
  
  save('inv_v3', invoices); // Lưu db chính
  trashAdd({...inv}); // 2. Đưa vào giao diện thùng rác
}

function trashRestore(id) {
  // 3. Phục hồi: Tìm trong db chính, xóa cờ deletedAt = null
  const invIdx = invoices.findIndex(i => String(i.id) === String(id));
  invoices[invIdx] = { ...invoices[invIdx], deletedAt: null, updatedAt: now };
  
  // ... lưu lại và xóa khỏi thùng rác
}
```

### 6. Diễn giải code
| Code | Ý nghĩa |
|---|---|
| `deletedAt: now` | Chốt thời điểm xóa. Nếu đồng bộ (Sync) lên mạng, máy khác thấy field này cũng sẽ tự giấu đi. |
| `updatedAt: now` | Quan trọng cho Cloud Sync: Báo cho mạng biết là tôi vừa bị thay đổi (bị xóa), hãy lấy thông tin mới này đi. |
| `trashRestore` | Set `deletedAt: null` để báo là nó không còn bị xóa nữa (sống lại). |

### 7. Kết luận
Tuyệt đối an toàn. Việc này chống trường hợp 2 máy tính dùng chung, máy A xóa nhầm, máy B không biết, gây ra lệch tiền.

### ⚠️ Lỗi thường gặp
- Xóa vĩnh viễn trong thùng rác: Mất data thật sự, không thể lấy lại trừ khi có File Backup.

---

## PHẦN 6: HÓA ĐƠN HÔM NAY & LIÊN KẾT MODULE

### 1. Mục đích
Giao diện nhỏ (Sub-tab) tên là **"CP/HĐ Nhập Hôm Nay"** giúp kế toán kiểm tra nhanh cuối ngày xem mình vừa nhập bao nhiêu phiếu, có thiếu hay sai sót gì không.

### 2. Giải thích dễ hiểu
Cuối ngày làm việc, bạn mở tab này. Nó tự lấy `ngay = today()` (ví dụ: hôm nay 24/04) và chỉ hiện ra đúng các phiếu có ngày 24/04. Dưới đáy có dòng Tổng kết tiền. Nếu khớp với sổ tay là an tâm đi về.

### 3. Code chính
```javascript
function renderTodayInvoices() {
  const date = document.getElementById('entry-date')?.value || today();
  
  // Chỉ lấy hóa đơn có ngay === ngày hôm nay, không lấy từ chấm công, chưa bị xóa
  const todayInvs = invoices.filter(i => i.ngay === date && !i.ccKey && !i.deletedAt);
  
  // In ra bảng...
}
```

---

## 🔗 LIÊN KẾT MODULE (QUAN TRỌNG)

File `hoadon.js` là "Trái tim" chi tiêu của ứng dụng. Mọi thứ xoay quanh nó.

**1. Dữ liệu LẤY TỪ ĐÂU?**
- **Từ `core.js`:** Lấy Database Hóa đơn gốc (`invoices`), và gọi hàm lưu `save()`.
- **Từ `danhmuc.js`:** Gọi hàm tạo Option (`cats.loaiChiPhi`, `cats.nguoiTH`...) để đổ chữ vào các ô chọn thả xuống (Dropdown). Lấy tên công trình chuẩn.
- **Từ `projects.js`:** Lấy trạng thái công trình. Nếu status = `closed` (quyết toán), không cho nhập thêm.

**2. Dữ liệu ĐƯỢC SỬ DỤNG Ở ĐÂU?**
Toàn bộ mảng hóa đơn này (của `hoadon.js`) sẽ được nạp vào hàm `getInvoicesCached()` và phân phát đi khắp nơi:
- **`danhmuc.js`:** Để vẽ Trang Công Trình (CT Page) hiển thị từng card hình vuông.
- **`doanhthu.js`:** Để tính tổng Lãi/Lỗ, so sánh Tiền Thu - Tiền Chi.
- **`datatools.js`:** Để vẽ biểu đồ hình tròn, biểu đồ cột (Analytics).

**3. ẢNH HƯỞNG TRỰC TIẾP**
- `chamcong.js` (Chấm công công nhân): Khi chốt sổ lương tuần, file chấm công sẽ **bắn một cục hóa đơn vô hình** vào `hoadon.js` (thông qua `ccKey`). Cho nên tiền lương thợ cũng nằm chung bảng với hóa đơn ở đây.

---

# 📋 TỔNG KẾT FILE `hoadon.js`

1. **Nhập Nhanh:** Giúp gõ liên tục hóa đơn lẻ tẻ, tự động cộng tiền, Enter để qua dòng.
2. **Kiểm Tra Trùng:** Trí tuệ nhân tạo (Fuzzy match) báo động nếu nhập nhầm 2 lần.
3. **Nhập Chi Tiết:** Ghi chú từng viên gạch, bao xi măng, tự trừ tiền chiết khấu (%).
4. **Danh Sách & Lọc:** Quản lý kho dữ liệu hàng vạn dòng không bị lag, tìm kiếm cực nhanh.
5. **Thùng Rác:** Xóa mềm an toàn, dọn sạch hậu quả nếu lỡ tay.

Đây là file cốt lõi nhất để đảm bảo **Đầu Ra (Chi Phí)** của công ty không bao giờ bị lệch 1 đồng.
