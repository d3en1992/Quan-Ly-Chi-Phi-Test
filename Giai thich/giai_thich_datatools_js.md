# 📖 GIẢI THÍCH FILE `datatools.js`

## Tổng quan nhanh

File `datatools.js` đảm nhận **2 nhóm chức năng lớn** trong app quản lý chi phí công trình:

1. **Quản lý dữ liệu** — Xóa dữ liệu theo năm, Reset toàn bộ, Xuất/Nhập JSON backup
2. **Dashboard** — Hiển thị bảng thống kê tổng quan (KPI, biểu đồ cột, biểu đồ tròn, top 5 hóa đơn, phân tích theo công trình)

File được chia thành **7 phần** để giải thích:

| Phần | Nội dung | Trạng thái |
|------|----------|------------|
| **1** | Hộp thoại xác nhận xóa & Helper lưu danh mục | ✅ Xong |
| **2** | Xóa dữ liệu theo năm | ✅ Xong |
| **3** | Reset toàn bộ dữ liệu | ✅ Xong |
| **4** | Dashboard tổng quan & KPI Cards | ✅ Xong |
| **5** | Biểu đồ cột & Biểu đồ tròn | ✅ Xong |
| **6** | Bảng xếp hạng & Phân tích theo Công Trình | ✅ Xong |
| **7** | Liên kết hệ thống (cách module giao tiếp với phần còn lại) | ✅ Xong |

---

# PHẦN 1: HỘP THOẠI XÁC NHẬN XÓA & HELPER LƯU DANH MỤC

> **Dòng code:** 1 → 75
> **Các hàm chính:** `openDeleteModal()`, `_showDeleteConfirm()`, `_saveCatKey()`

---

## 1.1 — Mục đích

Phần này xây dựng **"lớp bảo vệ" trước khi xóa dữ liệu**. Trong app quản lý công trình, dữ liệu như hóa đơn, chấm công, tiền ứng là dữ liệu tiền — xóa nhầm là **mất tiền thật**. Vì vậy:

- Có một **"cửa chặn"** (tính năng xóa bị tắt hoàn toàn) cho trường hợp không muốn ai xóa
- Có một **"hộp thoại xác nhận"** yêu cầu gõ chữ "DELETE" trước khi xóa — để ngăn việc nhấn nhầm
- Có một **"helper nhỏ"** chuyên ghi danh mục (nhà cung cấp, thầu phụ, công nhân…) vào bộ nhớ

> [!IMPORTANT]
> Đây là phần **nền tảng** — mọi thao tác xóa dữ liệu trong PHẦN 2 và PHẦN 3 đều phải đi qua hộp thoại xác nhận này.

---

## 1.2 — Giải thích dễ hiểu

### 🚪 Hàm `openDeleteModal()` — "Cửa đã khóa"

Hãy tưởng tượng bạn có **1 nút "Xóa Dữ Liệu"** trên app. Nhưng bạn sợ ai đó (hoặc chính bạn) lỡ tay nhấn vào. Hàm này **khóa cửa luôn** — bất kỳ ai nhấn nút đều nhận thông báo:

> *"Tính năng Xóa Dữ Liệu đã bị tắt."*

Nút tồn tại trên giao diện nhưng **không làm gì cả**. Giống như ổ khóa giả — nhìn thấy ổ khóa nhưng không có chìa.

### 🔒 Hàm `_showDeleteConfirm()` — "Hộp thoại bắt gõ DELETE"

Đây mới là **ổ khóa thật**. Khi hệ thống cần xóa dữ liệu (xóa theo năm hoặc reset), nó sẽ hiện một hộp thoại:

1. **Tiêu đề đỏ** — cảnh báo nguy hiểm (ví dụ: "🗑 Xóa dữ liệu năm 2025")
2. **Nội dung giải thích** — cho bạn biết xóa sẽ mất gì
3. **Ô nhập yêu cầu gõ "DELETE"** — phải gõ đúng chữ "DELETE" (viết hoa) thì nút Xoá mới sáng lên
4. **Nút Xoá mờ (disabled)** — chỉ sáng khi gõ đúng

**Ví dụ đời thực:** Giống như khi bạn muốn xóa tài khoản Google — Google bắt bạn gõ lại email để xác nhận. App của bạn bắt gõ "DELETE" với mục đích tương tự: **chắc chắn bạn thực sự muốn xóa, không phải nhấn nhầm**.

### 📝 Hàm `_saveCatKey()` — "Người ghi sổ danh mục"

App có nhiều **danh mục**: danh sách nhà cung cấp, danh sách thầu phụ, danh sách công nhân, danh sách tên thiết bị…

Khi xóa dữ liệu theo năm, nếu một nhà cung cấp không còn xuất hiện trong bất kỳ hóa đơn nào → danh mục đó cũng nên bị xóa theo. Hàm `_saveCatKey()` chịu trách nhiệm **ghi lại danh mục mới** (sau khi đã dọn dẹp) vào 3 nơi:

| Nơi lưu | Giải thích | Ví dụ |
|---------|-----------|-------|
| `cats` (bộ nhớ tạm) | Biến toàn cục, app đang chạy đọc từ đây | `cats.nhaCungCap = ['Cty A', 'Cty B']` |
| `_mem` (bộ nhớ nhanh) | Cache trung gian, đọc nhanh hơn IDB | `_mem['cat_ncc'] = ['Cty A', 'Cty B']` |
| `IDB` (IndexedDB) | Lưu trữ vĩnh viễn trên thiết bị | Dữ liệu sống qua F5, sống qua tắt máy |

> [!TIP]
> **Tại sao phải ghi 3 nơi?** Vì app đọc dữ liệu từ nhiều nguồn tùy lúc. Nếu chỉ ghi 1 nơi, các nơi khác sẽ **"lệch nhau"** → giao diện hiện danh mục cũ, hoặc F5 lại thì danh mục cũ sống lại.

---

## 1.3 — Ví dụ thực tế trong app

### Tình huống 1: Bạn muốn xóa dữ liệu năm 2024

```
Bước 1: Nhấn nút "Xóa dữ liệu theo năm"
Bước 2: App gọi _showDeleteConfirm() → hiện hộp thoại
Bước 3: Hộp thoại nói: "Xóa toàn bộ hóa đơn, chấm công, tiền ứng năm 2024"
Bước 4: Bạn phải gõ "DELETE" → nút Xoá mới sáng lên
Bước 5: Nhấn Xoá → hệ thống mới thực sự chạy logic xóa (PHẦN 2)
```

### Tình huống 2: Sau khi xóa năm 2024, NCC "Cty Xi Măng A" không còn hóa đơn nào

```
Hệ thống phát hiện: NCC "Cty Xi Măng A" không còn trong bất kỳ hóa đơn nào
→ Gọi _saveCatKey() để cập nhật danh mục NCC
→ Ghi danh mục mới (không có "Cty Xi Măng A") vào cats, _mem, IDB
→ Kết quả: dropdown nhà cung cấp không còn hiện "Cty Xi Măng A"
```

### Tình huống 3: Ai đó nhấn nút "Xóa Dữ Liệu" cũ (bị khóa)

```
→ App gọi openDeleteModal()
→ Hiện thông báo lỗi: "Tính năng Xóa Dữ Liệu đã bị tắt."
→ Không có gì xảy ra — dữ liệu an toàn
```

---

## 1.4 — Code chính

### Hàm khóa tính năng xóa

```javascript
function openDeleteModal() {
  toast('Tính năng Xóa Dữ Liệu đã bị tắt.', 'error');
}
```

> **Diễn giải:** Hàm này **không làm gì ngoài hiện thông báo lỗi**. Đây là cách "vô hiệu hóa" một nút trên giao diện mà không cần xóa nút đó — nút vẫn còn, nhưng nhấn vào chỉ thấy cảnh báo.

---

### Hàm hộp thoại xác nhận — Phần quan trọng

```javascript
function _showDeleteConfirm(title, bodyHtml, onConfirm) {
  // 1. Xóa hộp thoại cũ (nếu có) — tránh hiện 2 hộp thoại chồng nhau
  const existing = document.getElementById('_del-confirm-modal');
  if (existing) existing.remove();

  // 2. Tạo overlay (nền đen mờ) + hộp thoại trắng bên trong
  const overlay = document.createElement('div');
  overlay.id = '_del-confirm-modal';
  // ... (HTML tạo form gõ DELETE)

  // 3. Lắng nghe người dùng gõ
  inp.addEventListener('input', () => {
    const ok = inp.value.trim() === 'DELETE';  // ← Phải gõ ĐÚNG "DELETE"
    okBtn.disabled = !ok;                       // ← Nút Xoá chỉ bật khi gõ đúng
    okBtn.style.opacity = ok ? '1' : '.45';     // ← Nút mờ → sáng khi gõ đúng
  });

  // 4. Nhấn Huỷ hoặc click ngoài → đóng hộp thoại
  canBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // 5. Nhấn Xoá (khi đã gõ đúng DELETE) → gọi hàm xóa thật
  okBtn.addEventListener('click', () => {
    if (inp.value.trim() !== 'DELETE') return;  // ← Kiểm tra lần nữa cho chắc
    overlay.remove();
    onConfirm();  // ← ĐÂY là lúc thực sự xóa dữ liệu
  });
}
```

> **Diễn giải từng dòng quan trọng:**

| Dòng | Ý nghĩa |
|------|---------|
| `existing.remove()` | Nếu đã có 1 hộp thoại cũ → xóa nó trước, tránh chồng 2 cái |
| `inp.value.trim() === 'DELETE'` | So sánh chính xác — gõ "delete" (thường) sẽ **không được** |
| `okBtn.disabled = !ok` | Nút Xoá bị khóa cho đến khi gõ đúng |
| `onConfirm()` | Hàm callback — tùy trường hợp sẽ gọi `_doDeleteYear()` hoặc `_doResetAll()` |
| `setTimeout(() => inp.focus(), 60)` | Tự động focus vào ô nhập sau 60ms — tiện cho người dùng |

---

### Hàm lưu danh mục

```javascript
function _saveCatKey(catsKey, lsKey, arr) {
  // Ghi vào biến toàn cục cats
  if (typeof cats !== 'undefined' && cats) cats[catsKey] = arr;
  
  // Ghi vào _mem (cache) + IDB (lưu trữ vĩnh viễn)
  if (typeof _memSet === 'function') _memSet(lsKey, arr);
  
  // Nếu không có _memSet → dùng _dbSave ghi trực tiếp IDB
  else if (typeof _dbSave === 'function') _dbSave(lsKey, arr).catch(() => {});
}
```

> **Diễn giải:**

| Tham số | Ý nghĩa | Ví dụ |
|---------|---------|-------|
| `catsKey` | Tên danh mục trong biến `cats` | `'nhaCungCap'`, `'thauPhu'`, `'congNhan'` |
| `lsKey` | Key lưu trong bộ nhớ (_mem / IDB) | `'cat_ncc'`, `'cat_tp'`, `'cat_cn'` |
| `arr` | Mảng danh mục mới (đã dọn dẹp) | `['Cty A', 'Cty B']` |

> [!NOTE]
> Dấu gạch dưới `_` ở đầu tên hàm (`_saveCatKey`, `_showDeleteConfirm`) là quy ước trong code: **hàm nội bộ, không gọi trực tiếp từ giao diện**. Chỉ có các hàm khác trong code mới gọi nó.

---

## 1.5 — Kết luận

### Hiểu phần này giúp bạn tránh được các lỗi sau:

| Lỗi | Giải thích | Cách phần này bảo vệ |
|-----|-----------|----------------------|
| ❌ **Xóa nhầm dữ liệu** | Ai đó vô tình nhấn nút Xóa | Hộp thoại bắt gõ "DELETE" — nhấn nhầm không bị mất dữ liệu |
| ❌ **Mở 2 hộp thoại xóa cùng lúc** | Nhấn nút xóa liên tục 2 lần | `existing.remove()` xóa hộp thoại cũ trước khi tạo mới |
| ❌ **Danh mục "hồi sinh" sau khi xóa** | Xóa hết hóa đơn của NCC nhưng NCC vẫn còn trong dropdown | `_saveCatKey()` ghi đồng bộ cả 3 nơi (cats, _mem, IDB) |
| ❌ **Danh mục lệch giữa giao diện và bộ nhớ** | Giao diện hiện "Cty A" nhưng IDB không có | Hàm ghi cả 3 nơi cùng lúc, đảm bảo nhất quán |

> [!WARNING]
> Nếu bạn sửa code và quên gọi `_saveCatKey()` khi dọn danh mục → danh mục cũ sẽ **"sống lại"** khi F5 (vì IDB vẫn giữ dữ liệu cũ). Đây là lỗi rất phổ biến khi debug hệ thống này.

---

> **📌 Tiếp theo → PHẦN 2:** Xóa dữ liệu theo năm — Logic soft-delete, dọn dẹp danh mục, và chuyển thiết bị về KHO TỔNG.

---

# PHẦN 2: XÓA DỮ LIỆU THEO NĂM

> **Dòng code:** 77 → 214
> **Các hàm chính:** `toolDeleteYear()`, `_doDeleteYear(yr)`

---

## 2.1 — Mục đích

Phần này xử lý việc **xóa toàn bộ dữ liệu của 1 năm cụ thể** (ví dụ: xóa tất cả hóa đơn, chấm công, tiền ứng, thu tiền, hợp đồng của năm 2024). Đây là tính năng quan trọng khi:

- Năm cũ đã kết thúc, dữ liệu không cần nữa → dọn dẹp cho gọn
- Dữ liệu năm cũ quá nhiều → app chậm → cần xóa bớt
- Muốn "làm sạch" dữ liệu test trước khi dùng thật

> [!IMPORTANT]
> Xóa theo năm **KHÔNG phải xóa thật** (hard delete). App dùng kỹ thuật **"xóa mềm" (soft-delete)** — đánh dấu bản ghi là "đã xóa" thay vì xóa hẳn. Điều này rất quan trọng cho hệ thống sync giữa nhiều thiết bị.

---

## 2.2 — Giải thích dễ hiểu

### 🛡️ Bước 0: Kiểm tra an toàn trước khi xóa

Trước khi cho phép xóa, hệ thống kiểm tra **2 điều kiện**:

| Điều kiện | Tại sao? | Nếu vi phạm? |
|-----------|---------|--------------|
| Không đang sync | Xóa khi đang sync → dữ liệu lẫn lộn, có thể mất bản ghi | Hiện cảnh báo "Đang đồng bộ, vui lòng chờ" |
| Phải chọn năm cụ thể | Nếu đang ở chế độ "Tất cả năm" → không biết xóa năm nào | Hiện cảnh báo "Chọn một năm cụ thể" |

**Ví dụ đời thực:** Giống như khi bạn đang chuyển tiền trên banking app — app sẽ không cho bạn đóng app giữa chừng. Ở đây, app không cho bạn xóa khi đang sync vì sợ "đang chuyển đồ mà phá nhà".

### 📸 Bước 1: Tự động backup trước khi xóa

Trước khi xóa bất kỳ thứ gì, app **tự chụp ảnh toàn bộ dữ liệu** (snapshot). Giống như bạn chụp ảnh sổ sách trước khi xé trang — nếu xé nhầm thì còn ảnh để phục hồi.

### 🏷️ Bước 2: Soft-delete — "Đánh dấu xóa" thay vì "xóa thật"

Đây là khái niệm **quan trọng nhất** của hệ thống sync. Thay vì xóa hẳn bản ghi, app **gán thêm 3 thông tin** vào mỗi bản ghi:

| Thông tin | Ý nghĩa | Ví dụ |
|-----------|---------|-------|
| `deletedAt` | Thời điểm bị xóa (timestamp) | `1714000000000` (= ngày 25/04/2024 lúc 10h sáng) |
| `updatedAt` | Thời điểm cập nhật cuối | Giống `deletedAt` — vì xóa cũng là một "cập nhật" |
| `deviceId` | Thiết bị nào thực hiện xóa | `"phone-A"`, `"laptop-B"` |

**Tại sao không xóa thật?**

Hãy tưởng tượng bạn có **2 điện thoại A và B** cùng dùng app:

```
Tình huống XẤU — nếu xóa thật:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Điện thoại A: Xóa hóa đơn "Xi Măng 50 triệu" → biến mất hẳn
Điện thoại B: Chưa biết tin → khi sync, B gửi hóa đơn cũ lên cloud
→ Cloud nhận lại hóa đơn → A pull về → hóa đơn "sống lại"!
→ Kết quả: xóa hoài mà không xóa được

Tình huống TỐT — soft-delete:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Điện thoại A: Đánh dấu hóa đơn deletedAt = 10h00
Điện thoại B: Khi sync, B thấy bản ghi có deletedAt mới hơn
→ B cũng đánh dấu xóa bản local → UI ẩn hóa đơn này
→ Kết quả: cả 2 máy đều thấy hóa đơn đã bị xóa ✓
```

### 🔍 Bước 3: Tìm công trình còn "sống"

Sau khi đánh dấu xóa các bản ghi của năm đó, hệ thống **quét toàn bộ dữ liệu** để tìm ra những công trình **vẫn còn được sử dụng** (còn ít nhất 1 hóa đơn, 1 chấm công, hay 1 tiền ứng chưa bị xóa).

**Tại sao cần bước này?** Vì bước tiếp theo sẽ dọn dẹp thiết bị và danh mục — cần biết công trình nào "đã chết" để dọn.

### 🏪 Bước 4: Chuyển thiết bị về KHO TỔNG

Nếu một công trình **không còn bản ghi nào** sau khi xóa năm → thiết bị (máy trộn, máy cắt, cốp pha…) đang ở công trình đó sẽ được **chuyển về KHO TỔNG**.

**Ví dụ thực tế:**
```
Công trình "Nhà A" có 3 máy trộn bê tông
→ Xóa hết dữ liệu năm 2024 → "Nhà A" không còn hóa đơn, chấm công nào
→ 3 máy trộn bê tông được chuyển về KHO TỔNG
→ Khi mở tab Thiết Bị, 3 máy này xuất hiện ở KHO TỔNG thay vì "Nhà A"
```

> [!NOTE]
> Thiết bị **không bị xóa** — chỉ chuyển về KHO TỔNG. Bạn vẫn có thể phân bổ lại cho công trình khác.

### 🧹 Bước 5: Dọn dẹp danh mục

Sau khi xóa bản ghi, hệ thống dọn **5 loại danh mục**:

| Danh mục | Cách dọn | Ví dụ |
|----------|---------|-------|
| Nhà cung cấp (NCC) | Giữ NCC còn trong hóa đơn sống | "Cty Xi Măng A" bị xóa nếu không còn hóa đơn nào |
| Người thực hiện | Giữ người còn trong hóa đơn sống | "Anh Minh" bị xóa nếu không còn ghi sổ hóa đơn |
| Thầu phụ | Giữ thầu phụ còn trong tiền ứng/hợp đồng sống | "Đội thợ Bình" bị xóa nếu không còn ứng/HĐ |
| Công nhân | Giữ công nhân còn trong tiền ứng sống | "Anh Hùng" bị xóa nếu không còn ứng lương |
| Tên thiết bị | Giữ tên TB còn trong dữ liệu thiết bị sống | "Máy Trộn BT" bị xóa nếu không còn TB nào tên này |

**Lưu ý đặc biệt:** Danh mục **công trình** (cat_ct) **KHÔNG** bị dọn trực tiếp — nó được **tái tạo** từ danh sách dự án (`projects_v1`), vì danh sách công trình là "dữ liệu gốc", không phải "dữ liệu phát sinh".

### 💾 Bước 6: Lưu kết quả

Sau khi đánh dấu xóa + dọn dẹp xong, hệ thống **ghi tất cả xuống bộ nhớ**:

```
invoices (hóa đơn)        → save('inv_v3',     invoices)
ungRecords (tiền ứng)     → save('ung_v1',     ungRecords)
ccData (chấm công)        → save('cc_v2',      ccData)
thuRecords (thu tiền)     → save('thu_v1',     thuRecords)
thauPhuContracts (HĐ TP)  → save('thauphu_v1', thauPhuContracts)
tbData (thiết bị)         → save('tb_v1',      tbData)
hopDongData (hợp đồng)   → _memSet('hopdong_v1', hopDongData)
```

> [!TIP]
> Sau khi xóa theo năm, dữ liệu **chưa được push lên cloud tự động**. Bạn cần nhấn nút 🔄 Sync để đẩy lên. Điều này cho phép bạn kiểm tra lại trước khi đồng bộ.

---

## 2.3 — Ví dụ thực tế trong app

### Tình huống 1: Xóa dữ liệu năm 2024

```
Bạn đang ở năm 2025, chọn filter năm = 2024
→ Nhấn "Xóa dữ liệu theo năm"
→ Hộp thoại: "Xóa vĩnh viễn tất cả hóa đơn, chấm công... năm 2024"
→ Gõ "DELETE" → nhấn Xoá
→ App tự backup → soft-delete tất cả bản ghi năm 2024
→ Dọn NCC, thầu phụ, công nhân không còn dùng
→ Chuyển thiết bị về KHO TỔNG
→ Toast: "✅ Đã xóa dữ liệu năm 2024 · 3 thiết bị → KHO TỔNG"
```

### Tình huống 2: NCC "Cty Sắt Thép B" có hóa đơn cả 2024 và 2025

```
→ Xóa năm 2024
→ Hóa đơn 2024 của "Cty Sắt Thép B" bị soft-delete
→ Nhưng hóa đơn 2025 vẫn sống → NCC "Cty Sắt Thép B" KHÔNG bị xóa khỏi danh mục
→ Dropdown NCC vẫn hiện "Cty Sắt Thép B" ✓
```

### Tình huống 3: Xóa khi đang sync

```
→ Bạn đang nhấn Sync, hệ thống đang đồng bộ
→ Bạn nhấn "Xóa dữ liệu theo năm"
→ App chặn: "⚠️ Đang đồng bộ dữ liệu, vui lòng chờ"
→ Dữ liệu an toàn, không bị xóa giữa lúc sync
```

---

## 2.4 — Code chính

### Hàm kiểm tra an toàn + hiện hộp thoại

```javascript
function toolDeleteYear() {
  // Kiểm tra 1: Đang sync → chặn
  if (typeof isSyncing === 'function' && isSyncing()) {
    toast('⚠️ Đang đồng bộ dữ liệu, vui lòng chờ', 'error'); return;
  }

  // Kiểm tra 2: Phải chọn năm cụ thể
  const yr = (typeof activeYear !== 'undefined') ? String(activeYear) : '0';
  if (!yr || yr === '0') {
    toast('Chọn một năm cụ thể (không phải "Tất cả") rồi mới xóa.', 'error');
    return;
  }

  // Hiện hộp thoại xác nhận (PHẦN 1)
  _showDeleteConfirm(
    `🗑 Xóa dữ liệu năm ${yr}`,
    `Thao tác sẽ xóa vĩnh viễn tất cả hóa đơn, tiền ứng...`,
    () => _doDeleteYear(yr)   // ← Khi gõ DELETE xong, gọi hàm xóa thật
  );
}
```

> **Diễn giải:** Hàm này **không xóa gì cả** — chỉ kiểm tra điều kiện rồi hiện hộp thoại. Công việc xóa thật nằm trong `_doDeleteYear()`.

---

### Hàm xóa thật — Phần cốt lõi

```javascript
async function _doDeleteYear(yr) {
  // 1. Auto-backup
  if (typeof _snapshotNow === 'function') _snapshotNow('pre-delete-' + yr);

  // 2. Chuẩn bị công cụ soft-delete
  const now     = Date.now();                    // ← Thời điểm hiện tại
  const devId   = (typeof DEVICE_ID !== 'undefined') ? DEVICE_ID : '';  // ← Thiết bị nào

  // Hàm đánh dấu xóa: thêm deletedAt + updatedAt + deviceId
  const softDel = r => ({ ...r, deletedAt: now, updatedAt: now, deviceId: devId });

  // Hàm kiểm tra bản ghi có thuộc năm cần xóa không
  const matchYr = (r, field) => !r.deletedAt && r[field] && String(r[field]).startsWith(yr);
```

> **Diễn giải từng biến quan trọng:**

| Biến | Ý nghĩa | Tại sao quan trọng |
|------|---------|-------------------|
| `now` | Thời điểm xóa (mili giây) | Dùng để so sánh khi sync — bản ghi nào mới hơn thì thắng |
| `devId` | ID thiết bị đang xóa | Để biết "ai đã xóa" — hữu ích khi debug |
| `softDel(r)` | Hàm đánh dấu xóa 1 bản ghi | Thêm `deletedAt`, `updatedAt`, `deviceId` vào bản ghi |
| `matchYr(r, field)` | Kiểm tra bản ghi thuộc năm `yr` | Chỉ xóa bản ghi **chưa bị xóa** VÀ **thuộc năm cần xóa** |

---

### Soft-delete từng loại dữ liệu

```javascript
  // Hóa đơn: kiểm tra trường "ngay" (ngày hóa đơn)
  invoices = invoices.map(r => matchYr(r, 'ngay') ? softDel(r) : r);

  // Tiền ứng: kiểm tra trường "ngay"
  ungRecords = ungRecords.map(r => matchYr(r, 'ngay') ? softDel(r) : r);

  // Chấm công: kiểm tra trường "fromDate" (ngày bắt đầu kỳ chấm công)
  ccData = ccData.map(r => matchYr(r, 'fromDate') ? softDel(r) : r);

  // Thu tiền: kiểm tra trường "ngay"
  thuRecords = thuRecords.map(r => matchYr(r, 'ngay') ? softDel(r) : r);

  // Hợp đồng thầu phụ: kiểm tra trường "ngay"
  thauPhuContracts = thauPhuContracts.map(r => matchYr(r, 'ngay') ? softDel(r) : r);
```

> **Diễn giải:** Mỗi loại dữ liệu được duyệt qua từng bản ghi. Nếu bản ghi **thuộc năm cần xóa** VÀ **chưa bị xóa trước đó** → gán `deletedAt`. Nếu không → giữ nguyên.

---

### Chuyển thiết bị về KHO TỔNG

```javascript
  // Tìm công trình vẫn còn "sống"
  const usedCT = new Set([
    // Lấy tên CT từ hóa đơn chưa bị xóa
    // + tiền ứng chưa bị xóa
    // + chấm công chưa bị xóa
    // + thu tiền chưa bị xóa
    // + hợp đồng TP chưa bị xóa
    // + hợp đồng (hopDongData) chưa bị xóa
  ]);

  // Thiết bị ở CT "chết" → chuyển về KHO TỔNG
  tbData = tbData.map(r => {
    if (!r.deletedAt && r.ct && !usedCT.has(r.ct)) {
      movedEq++;
      return { ...r, ct: 'KHO TỔNG', projectId: null, updatedAt: now, deviceId: devId };
    }
    return r;
  });
```

> **Diễn giải:** `usedCT` là **tập hợp tên công trình vẫn còn dữ liệu sống**. Thiết bị nào đang ở công trình **không có trong usedCT** → chuyển `ct` thành `'KHO TỔNG'` và xóa `projectId`.

---

### Dọn dẹp danh mục

```javascript
  // Hàm lọc: chỉ giữ phần tử có trong usedSet
  const _prune = (arr, usedSet) => (arr || []).filter(v => usedSet.has(v));

  // Tìm NCC còn dùng → lọc danh mục NCC
  const usedNCC = new Set(invoices.filter(r => !r.deletedAt).map(r => r.ncc).filter(Boolean));
  _saveCatKey('nhaCungCap', 'cat_ncc', _prune(_catArr('nhaCungCap'), usedNCC));

  // Tương tự cho: nguoiTH, thauPhu, congNhan, tbTen
```

> **Diễn giải:** `_prune()` giống như **lọc danh bạ điện thoại** — chỉ giữ lại những người bạn còn liên hệ. NCC nào không còn xuất hiện trong bất kỳ hóa đơn sống nào → bị loại khỏi danh mục.

---

## 2.5 — Kết luận

### Luồng xóa theo năm — Tổng hợp 8 bước:

```
┌─────────────────────────────────────────────────────┐
│  Bước 0: Kiểm tra (không sync, có năm cụ thể)      │
│  Bước 1: Hiện hộp thoại → bắt gõ "DELETE"          │
│  Bước 2: Tự động backup (snapshot)                  │
│  Bước 3: Soft-delete bản ghi thuộc năm đó           │
│  Bước 4: Tìm công trình còn "sống"                  │
│  Bước 5: Chuyển thiết bị CT "chết" → KHO TỔNG      │
│  Bước 6: Dọn danh mục (NCC, TP, CN, TB...)         │
│  Bước 7: Lưu tất cả vào bộ nhớ (IDB + _mem)       │
│  Bước 8: Refresh giao diện                          │
└─────────────────────────────────────────────────────┘
```

### Hiểu phần này giúp bạn tránh được các lỗi sau:

| Lỗi | Nguyên nhân | Cách phần này xử lý |
|-----|------------|---------------------|
| ❌ **Hóa đơn "sống lại" sau khi xóa** | Xóa thật (hard delete) → thiết bị khác sync lại bản cũ | Soft-delete: gán `deletedAt` → thiết bị khác thấy và ẩn theo |
| ❌ **Xóa nhầm khi đang sync** | Dữ liệu lẫn lộn giữa xóa và sync | Kiểm tra `isSyncing()` trước khi xóa |
| ❌ **Thiết bị bị "mồ côi"** | Xóa CT nhưng thiết bị vẫn gắn CT cũ → không thấy đâu | Tự chuyển thiết bị về KHO TỔNG |
| ❌ **NCC cũ vẫn hiện trong dropdown** | Xóa hóa đơn nhưng không dọn danh mục | `_prune()` + `_saveCatKey()` dọn sạch |
| ❌ **Mất dữ liệu vĩnh viễn** | Xóa nhầm, không có backup | `_snapshotNow()` tự backup trước khi xóa |

> [!CAUTION]
> **`deletedAt` là "vũ khí" quan trọng nhất của hệ thống sync.** Nếu bạn sửa code mà quên gán `deletedAt` khi xóa → bản ghi sẽ **hồi sinh** khi thiết bị khác sync lại. Luôn nhớ: **xóa = gán `deletedAt`, KHÔNG BAO GIỜ xóa hẳn khỏi mảng.**

---

> **📌 Tiếp theo → PHẦN 3:** Reset toàn bộ dữ liệu — Logic xóa sạch + push soft-delete lên Firebase + chặn pull 5 phút.

---

# PHẦN 3: RESET TOÀN BỘ DỮ LIỆU

> **Dòng code:** 216 → 428
> **Các hàm chính:** `toolResetAll()`, `_doResetAll()`

---

## 3.1 — Mục đích

Phần này xử lý việc **xóa sạch 100% dữ liệu** — tất cả hóa đơn, chấm công, tiền ứng, thu tiền, hợp đồng, danh mục, thiết bị… trên **cả thiết bị hiện tại VÀ cloud (Firebase)**. Dùng khi:

- Muốn bắt đầu lại từ đầu
- Dữ liệu test quá nhiều, cần làm sạch trước khi dùng thật
- Chuyển giao app cho người khác

> [!CAUTION]
> Reset toàn bộ **nguy hiểm hơn nhiều** so với xóa theo năm (PHẦN 2). Nó xóa **tất cả mọi thứ**, bao gồm cả dữ liệu trên cloud. Không thể hoàn tác (trừ khi có backup).

---

## 3.2 — Giải thích dễ hiểu

### 🛡️ Bước 0: Kiểm tra an toàn — NGHIÊM NGẶT hơn xóa theo năm

| Điều kiện | Tại sao? |
|-----------|---------|
| **Phải có mạng (online)** | Reset cần xóa cả cloud. Nếu offline → chỉ xóa local → cloud vẫn còn → F5 lại thì dữ liệu hồi sinh |
| **Không đang sync** | Tránh xung đột dữ liệu |

**Ví dụ đời thực:** Giống như bạn muốn dọn sạch cả nhà lẫn kho — bạn phải có xe (mạng) để chở đồ ra bãi rác. Nếu không có xe, bạn chỉ dọn được trong nhà, kho vẫn đầy.

### 📸 Bước 1–2: Backup + Thu thập năm

- Tự động backup trước khi reset (giống PHẦN 2)
- Thu thập **tất cả năm** có dữ liệu (2023, 2024, 2025…) để biết cần xóa trên cloud bao nhiêu document

### 🔑 Bước 3: Soft-delete TRƯỚC KHI push lên Firebase — BÍ QUYẾT QUAN TRỌNG NHẤT

Đây là phần **phức tạp nhất** và cũng là **thông minh nhất** trong toàn bộ file. Vấn đề:

```
❌ Cách SAI — Push mảng rỗng [] lên Firebase:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Máy A: Reset → push invoices = [] lên cloud
Máy B: Pull từ cloud → nhận []
Máy B: mergeUnique(localData, []) = localData KHÔNG ĐỔI!
→ Máy B vẫn giữ nguyên toàn bộ dữ liệu cũ!
→ Reset thất bại!

✅ Cách ĐÚNG — Push bản ghi có deletedAt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Máy A: Reset → đánh dấu tất cả bản ghi deletedAt = now
Máy A: Push bản ghi đã soft-delete lên cloud
Máy B: Pull từ cloud → mergeUnique thấy deletedAt mới hơn
→ Máy B ghi đè bản local → bản ghi bị "xóa" trên B
→ UI ẩn hết → Reset thành công trên cả 2 máy ✓
```

> [!IMPORTANT]
> **Đây là lý do soft-delete tồn tại.** Nếu xóa thật (hard delete), không có cách nào "thông báo" cho thiết bị khác rằng bản ghi đã bị xóa. Soft-delete = "gửi tin nhắn xóa" qua cloud.

### 🔒 Bước 4: Chặn pull 5 phút sau reset

Sau khi push soft-delete lên cloud, app **chặn pull trong 5 phút**:

```
Tại sao?
━━━━━━━
Máy A: Vừa reset xong → local trống
Cloud: Vừa nhận soft-delete → có bản ghi (dù đã đánh dấu xóa)
Nếu pull ngay: cloud gửi bản soft-delete về → local có lại bản ghi (dù ẩn)
→ Tốn bộ nhớ vô ích, gây nhầm lẫn

Giải pháp: Chặn pull 5 phút → cho cloud có thời gian "lan tỏa" tới các máy khác
→ Sau 5 phút, mọi máy đều đã nhận soft-delete → pull an toàn
```

### 🧹 Bước 5–7: Xóa sạch bộ nhớ (globals, cats, _mem)

Sau khi cloud đã nhận soft-delete, app xóa tất cả dữ liệu trên **3 tầng bộ nhớ**:

| Tầng | Xóa gì | Ví dụ |
|------|--------|-------|
| **Globals** | Biến toàn cục → `[]` hoặc `{}` | `invoices = []`, `ccData = []`, `hopDongData = {}` |
| **cats** | Danh mục → `[]` | `cats.congTrinh = []`, `cats.nhaCungCap = []` |
| **_mem** | Cache trung gian → `[]` hoặc `{}` | `_mem['inv_v3'] = []`, `_mem['hopdong_v1'] = {}` |

Đặc biệt: **LS-only keys** (`cat_ct_years`, `cat_cn_roles`) phải xóa bằng `localStorage.removeItem()` vì chúng không nằm trong IDB.

### 💽 Bước 8: Xóa IDB + Ghi lại mảng rỗng — CHỐNG "HỒI SINH"

```
Bước 8a: Xóa sạch tất cả bảng trong IndexedDB
         db.invoices.clear(), db.attendance.clear()...

Bước 8b: Ghi [] vào IDB cho tất cả cat keys
         _dbSave('cat_ct', []), _dbSave('cat_ncc', [])...
```

> [!WARNING]
> **Tại sao phải ghi [] sau khi clear?** Vì khi IDB rỗng (không có key), hàm `load()` sẽ dùng **DEFAULTS** (giá trị mặc định). Defaults có sẵn danh mục như "Vật Liệu XD", tên thiết bị mặc định… → **danh mục "hồi sinh" sau F5!** Ghi `[]` vào IDB = "tôi đã biết danh mục rỗng, đừng dùng defaults".

---

## 3.3 — Ví dụ thực tế trong app

### Tình huống 1: Reset khi offline

```
Bạn tắt wifi → nhấn Reset
→ App chặn: "🔴 Không có mạng — không thể reset"
→ Lý do: nếu reset offline, chỉ xóa local; máy khác sync sẽ đẩy dữ liệu về
→ Dữ liệu "hồi sinh" → reset vô nghĩa
```

### Tình huống 2: Reset thành công, mở app trên máy khác

```
Máy A: Reset → soft-delete lên cloud → local trống
Máy B: Mở app → pull từ cloud → thấy tất cả bản ghi có deletedAt
→ mergeUnique ghi đè → UI ẩn hết → Máy B cũng trống ✓
```

### Tình huống 3: Danh mục "hồi sinh" sau F5

```
❌ NẾU KHÔNG có bước 8b:
   Reset → clear IDB → F5 → load('cat_tbteb') thấy IDB rỗng
   → Dùng DEFAULTS → "Máy Trộn BT", "Máy Cắt"... quay lại!

✅ CÓ bước 8b:
   Reset → clear IDB → ghi _dbSave('cat_tbteb', []) → F5
   → load('cat_tbteb') thấy [] trong IDB → dùng [] → danh mục rỗng ✓
```

---

## 3.4 — Code chính

### Hàm kiểm tra an toàn

```javascript
function toolResetAll() {
  // BẮT BUỘC online — khác với toolDeleteYear()
  if (!navigator.onLine) {
    toast('🔴 Không có mạng — không thể reset', 'error');
    return;
  }
  if (typeof isSyncing === 'function' && isSyncing()) {
    toast('⚠️ Đang đồng bộ, vui lòng chờ', 'error'); return;
  }
  _showDeleteConfirm('⚠️ Reset toàn bộ dữ liệu', '...', _doResetAll);
}
```

### Soft-delete tất cả bản ghi trước khi push

```javascript
// Tạo hàm soft-delete cho mảng
const _softDelArr = key => load(key, []).map(r =>
  r.deletedAt ? r : { ...r, deletedAt: now, updatedAt: now, deviceId: devId }
);

// Ghi soft-deleted vào _mem (TẠM) để fbYearPayload đọc
['inv_v3','ung_v1','cc_v2','tb_v1','thu_v1','thauphu_v1'].forEach(k => {
  _mem[k] = _softDelArr(k);
});
```

> **Diễn giải:** Mỗi bản ghi chưa có `deletedAt` → được gán `deletedAt = now`. Bản ghi đã xóa trước đó → giữ nguyên. Tất cả ghi vào `_mem` (tạm) để hàm `fbYearPayload()` đọc và push lên Firebase.

### Xử lý đặc biệt: cat_items_v1

```javascript
// cat_items_v1 dùng isDeleted thay vì deletedAt
const _softCatItems = {};
Object.entries(_existCatItems).forEach(([type, arr]) => {
  _softCatItems[type] = (arr || []).map(item =>
    item.isDeleted ? item : { ...item, isDeleted: true, updatedAt: now }
  );
});
_mem['cat_items_v1'] = _softCatItems;
```

> **Diễn giải:** `cat_items_v1` là danh mục dạng mới (mỗi item là object có `isDeleted`). Phải đánh dấu `isDeleted: true` trước khi push — nếu không, thiết bị khác pull về sẽ **rebuild lại danh mục** từ items chưa xóa → danh mục "hồi sinh".

### Chặn pull 5 phút

```javascript
const _blockTs = Date.now() + 5 * 60 * 1000;  // 5 phút sau
_blockPullUntil = _blockTs;                     // Biến trong RAM
localStorage.setItem('_blockPullUntil', String(_blockTs));  // Persist qua F5
```

> **Diễn giải:** Lưu cả vào RAM (`_blockPullUntil`) và `localStorage` — vì nếu F5, RAM mất nhưng localStorage còn → vẫn chặn pull.

### Ghi [] vào IDB sau khi clear — chống defaults

```javascript
// Xóa sạch IDB
await Promise.all([
  db.invoices.clear(), db.attendance.clear(),
  db.equipment.clear(), db.ung.clear(),
  db.revenue.clear(), db.categories.clear(), db.settings.clear(),
]);

// GHI LẠI [] để load() không dùng DEFAULTS
await Promise.all([
  'cat_ct','cat_loai','cat_ncc','cat_nguoi','cat_tp','cat_cn','cat_tbteb',
  'projects_v1'
].map(k => _dbSave(k, [])));
await _dbSave('hopdong_v1', {});
await _dbSave('cat_items_v1', {});
```

---

## 3.5 — Kết luận

### So sánh Xóa theo năm vs Reset toàn bộ:

| Tiêu chí | Xóa theo năm (PHẦN 2) | Reset toàn bộ (PHẦN 3) |
|----------|----------------------|----------------------|
| Phạm vi | 1 năm cụ thể | Tất cả mọi thứ |
| Yêu cầu mạng | Không bắt buộc | **Bắt buộc online** |
| Push cloud | Không auto push | **Auto push soft-delete** |
| Chặn pull | Không | **Chặn 5 phút** |
| Xóa IDB | Không | **Clear + ghi []** |
| Xóa danh mục | Dọn danh mục không dùng | **Xóa sạch tất cả** |
| Thiết bị | Chuyển về KHO TỔNG | Xóa luôn |

### Hiểu phần này giúp bạn tránh được:

| Lỗi | Cách phần này xử lý |
|-----|---------------------|
| ❌ **Reset nhưng máy khác vẫn thấy dữ liệu** | Push soft-delete lên cloud → mergeUnique trên máy khác ẩn bản ghi |
| ❌ **Danh mục "hồi sinh" sau F5** | Ghi `[]` vào IDB sau khi clear → load() không dùng DEFAULTS |
| ❌ **cat_items_v1 hồi sinh danh mục** | Đánh dấu `isDeleted: true` trước khi push cloud |
| ❌ **Cloud ghi đè local trống** | Chặn pull 5 phút sau reset |
| ❌ **Reset khi offline = mất dữ liệu cloud** | Bắt buộc online mới cho reset |

> [!CAUTION]
> **Bài học lớn nhất:** Trong hệ thống sync, "xóa" không bao giờ đơn giản là "biến mất". Phải **thông báo xóa** cho tất cả thiết bị khác qua cloud. Nếu quên bước này → dữ liệu sẽ hồi sinh vô tận.

---

> **📌 Tiếp theo → PHẦN 4:** Dashboard tổng quan & KPI Cards — Cách app hiển thị thống kê chi phí.

---

# PHẦN 4: DASHBOARD TỔNG QUAN & KPI CARDS

> **Dòng code:** 430 → 510
> **Các hàm chính:** `renderDashboard()`, `_dbPopulateCTFilter()`, `_dbKPI()`

---

## 4.1 — Mục đích

Phần này xây dựng **trang Dashboard** — nơi bạn mở app lên và thấy ngay **bức tranh tổng thể** về chi phí công trình: tổng tiền, trung bình/tháng, hóa đơn lớn nhất, số công trình đang theo dõi. Dashboard giúp bạn:

- Nắm nhanh tình hình chi phí mà **không cần lật từng hóa đơn**
- So sánh chi phí giữa các tháng, các loại chi phí
- Lọc theo **công trình cụ thể** để xem chi tiết

---

## 4.2 — Giải thích dễ hiểu

### 🏗️ Kiến trúc 2 tầng dữ liệu — "Tổng quan" vs "Chi tiết"

Dashboard chia dữ liệu thành **2 tầng**:

| Tầng | Dữ liệu | Bị filter CT không? | Dùng cho |
|------|---------|---------------------|---------|
| **Tầng 1: Tổng quan năm** | Tất cả hóa đơn trong năm | ❌ KHÔNG — luôn hiện toàn bộ | KPI Cards, Biểu đồ cột, Biểu đồ tròn |
| **Tầng 2: Chi tiết theo CT** | Hóa đơn đã lọc theo công trình | ✅ CÓ — thay đổi khi chọn CT | Top 5 HĐ, Tiền ứng, Thiết bị |

**Ví dụ đời thực:** Giống như bảng thống kê của công ty:
- **Tầng 1** = Báo cáo tổng công ty → luôn hiện tổng doanh thu, chi phí toàn bộ
- **Tầng 2** = Báo cáo chi nhánh → chỉ hiện khi bạn chọn 1 chi nhánh cụ thể

```
Bạn chọn CT "Nhà Anh A" trong dropdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tầng 1 (KPI, Biểu đồ): Vẫn hiện tổng chi phí TẤT CẢ công trình
Tầng 2 (Top 5, Tiền ứng): Chỉ hiện dữ liệu của "Nhà Anh A"
```

> [!TIP]
> **Tại sao thiết kế vậy?** Vì khi chọn 1 công trình, bạn vẫn muốn thấy "bức tranh toàn cảnh" ở trên, và "chi tiết CT đó" ở dưới. Nếu tất cả đều filter, bạn sẽ mất khả năng so sánh.

### 🔽 Dropdown lọc công trình (`_dbPopulateCTFilter`)

Trên Dashboard có 1 dropdown "Chọn công trình". Khi bạn chọn 1 CT → biến `selectedCT` thay đổi → Tầng 2 render lại theo CT đó.

### 📊 4 thẻ KPI — "Bảng tin nhanh"

Phần đầu Dashboard hiện **4 thẻ thống kê**:

| Thẻ | Hiển thị gì | Cách tính | Màu |
|-----|------------|----------|-----|
| **Tổng Chi Phí** | Tổng tiền tất cả hóa đơn trong năm | Cộng `thanhtien` (hoặc `tien`) mỗi HĐ | 🟡 Vàng |
| **TB / Tháng** | Trung bình chi phí mỗi tháng | Tổng ÷ Số tháng có phát sinh | 🔵 Xanh dương |
| **HĐ Lớn Nhất** | Hóa đơn có số tiền cao nhất | Tìm max trong mảng | 🔴 Đỏ |
| **Công Trình** | Số công trình đang theo dõi | Đếm tên CT không trùng | 🟢 Xanh lá |

**Ví dụ thực tế:**
```
Năm 2025, bạn có:
- 150 hóa đơn, tổng 5 tỷ
- Phát sinh trong 8 tháng → TB = 625 triệu/tháng
- HĐ lớn nhất: "Đổ bê tông sàn tầng 3" = 180 triệu
- 4 công trình đang theo dõi

→ 4 thẻ KPI hiện:
  [5.000.000.000đ] [625.000.000đ] [180.000.000đ] [4 công trình]
```

---

## 4.3 — Ví dụ thực tế trong app

### Tình huống 1: Chưa có dữ liệu

```
Năm 2026, bạn chưa nhập hóa đơn nào
→ Dashboard hiện: "Chưa có dữ liệu cho Năm 2026"
→ Tất cả 6 ô (KPI, biểu đồ cột, tròn, top 5, ứng, thiết bị) đều trống
```

### Tình huống 2: Chọn filter "Tất cả năm"

```
activeYears = {} (rỗng) → yr = 0 → yrLabel = "Tất cả năm"
→ KPI hiện tổng chi phí MỌI NĂM
→ Biểu đồ cột gộp T1-T12 từ nhiều năm
```

### Tình huống 3: Chọn CT "Nhà Anh B"

```
selectedCT = "Nhà Anh B"
→ Tầng 1 (KPI Cards): Vẫn hiện tổng 5 tỷ (tất cả CT)
→ Tầng 2 (Top 5): Chỉ hiện 5 hóa đơn lớn nhất CỦA "Nhà Anh B"
→ Tầng 2 (Tiền ứng): Chỉ hiện tiền ứng CỦA "Nhà Anh B"
```

---

## 4.4 — Code chính

### Hàm chính: renderDashboard()

```javascript
function renderDashboard() {
  // Xác định năm đang xem
  const ay = typeof activeYears !== 'undefined' ? activeYears : new Set();
  const yr = ay.size === 0 ? 0 : (ay.size === 1 ? [...ay][0] : 0);

  // Tạo dropdown công trình
  _dbPopulateCTFilter();

  // TẦNG 1: Tổng quan năm — KHÔNG filter theo CT
  const dataYear = getInvoicesCached().filter(i => inActiveYear(i.ngay));

  // TẦNG 2: Chi tiết — CÓ filter theo CT (nếu chọn)
  const dataDetail = getInvoicesCached().filter(i =>
    inActiveYear(i.ngay) &&
    (!selectedCT || resolveProjectName(i) === selectedCT)
  );

  // Nếu không có dữ liệu → hiện "Chưa có dữ liệu"
  if (!dataYear.length) { /* hiện thông báo rỗng */ return; }

  // Render Tầng 1 (không bị filter CT)
  _dbKPI(dataYear, yr);        // 4 thẻ KPI
  _dbBarChart(dataYear);       // Biểu đồ cột (PHẦN 5)
  _dbPieChart(dataYear);       // Biểu đồ tròn (PHẦN 5)

  // Render Tầng 2 (bị filter CT)
  _dbTop5(dataDetail);         // Top 5 HĐ lớn nhất (PHẦN 6)
  _dbUngByCT();                // Tiền ứng theo CT (PHẦN 6)
  _dbTBByCT();                 // Thiết bị theo CT (PHẦN 6)
}
```

> **Diễn giải:** `getInvoicesCached()` trả về danh sách hóa đơn **chưa bị xóa** (đã lọc `deletedAt`). `inActiveYear()` kiểm tra hóa đơn thuộc năm đang chọn. `resolveProjectName()` lấy tên công trình từ hóa đơn.

### Hàm KPI Cards

```javascript
function _dbKPI(data, yr) {
  // Tổng chi phí = cộng thanhtien (hoặc tien) của mỗi hóa đơn
  const total = data.reduce((s, i) => s + (i.thanhtien || i.tien || 0), 0);

  // Số tháng có phát sinh = đếm "YYYY-MM" không trùng
  const months = new Set(data.map(i => i.ngay?.slice(0,7))).size;

  // Trung bình/tháng
  const avgMonth = months ? Math.round(total / months) : 0;

  // Hóa đơn lớn nhất = tìm max
  const maxInv = data.reduce((mx, i) =>
    (i.thanhtien||i.tien||0) > (mx.thanhtien||mx.tien||0) ? i : mx, data[0]);

  // Số công trình = đếm tên CT không trùng
  const ctSet = new Set(data.map(i => resolveProjectName(i)).filter(Boolean));

  // Render 4 thẻ
  const cards = [
    { label:'Tổng Chi Phí',  val: fmtM(total),    cls:'accent-gold'  },
    { label:'TB / Tháng',     val: fmtM(avgMonth), cls:'accent-blue'  },
    { label:'HĐ Lớn Nhất',   val: fmtM(maxInv...), cls:'accent-red'  },
    { label:'Công Trình',     val: ctSet.size,      cls:'accent-green' },
  ];
}
```

> **Diễn giải từng phép tính:**

| Phép tính | Kỹ thuật | Giải thích dễ |
|-----------|---------|--------------|
| `reduce((s, i) => s + ...)` | Cộng dồn | Lần lượt cộng tiền mỗi HĐ vào tổng |
| `new Set(data.map(...)).size` | Đếm không trùng | Tạo tập hợp → đếm phần tử = không bị đếm trùng |
| `i.thanhtien \|\| i.tien \|\| 0` | Fallback giá trị | Ưu tiên `thanhtien`, nếu không có thì dùng `tien`, nếu cũng không thì = 0 |
| `i.ngay?.slice(0,7)` | Cắt tháng từ ngày | `"2025-04-24"` → `"2025-04"` |

---

## 4.5 — Kết luận

### Hiểu phần này giúp bạn tránh được:

| Lỗi | Nguyên nhân | Cách phần này xử lý |
|-----|------------|---------------------|
| ❌ **KPI thay đổi khi chọn CT** | Filter CT áp dụng lên cả Tầng 1 | Tầng 1 dùng `dataYear` (không filter CT) |
| ❌ **Tổng chi phí sai** | Cộng nhầm HĐ đã xóa | `getInvoicesCached()` đã lọc `deletedAt` sẵn |
| ❌ **TB/tháng = 0** | Chia cho 0 khi chưa có tháng nào | Kiểm tra `months ? ... : 0` trước khi chia |
| ❌ **HĐ bị xóa vẫn hiện trong Top 5** | Không lọc soft-delete | Dữ liệu đã đi qua `getInvoicesCached()` |

> [!NOTE]
> **Biến `selectedCT`** là biến toàn cục — khi bạn chọn CT trên dropdown, nó thay đổi giá trị → `renderDashboard()` được gọi lại → Tầng 2 render theo CT mới. Tầng 1 luôn không đổi.

---

> **📌 Tiếp theo → PHẦN 5:** Biểu đồ cột & Biểu đồ tròn — Cách app vẽ chart bằng SVG.

---

# PHẦN 5: BIỂU ĐỒ CỘT & BIỂU ĐỒ TRÒN

> **Dòng code:** 512 → 619
> **Các hàm chính:** `_dbBarChart()`, `_dbPieChart()`

---

## 5.1 — Mục đích

Phần này vẽ **2 biểu đồ trực quan** trên Dashboard:

1. **Biểu đồ cột (Bar Chart)** — Hiện chi phí từng tháng (T1 → T12), giúp thấy tháng nào chi nhiều nhất
2. **Biểu đồ tròn (Pie Chart)** — Hiện tỷ trọng các loại chi phí (Nhân Công, Vật Liệu, Thầu Phụ…), giúp thấy tiền đổ vào đâu nhiều nhất

Cả 2 biểu đồ đều thuộc **Tầng 1** (PHẦN 4) → **KHÔNG bị filter** khi chọn công trình.

> [!NOTE]
> App **không dùng thư viện chart** (Chart.js, D3…). Biểu đồ được vẽ bằng **SVG thuần** — code tự tính toán tọa độ và vẽ hình. Ưu điểm: nhẹ, nhanh, không cần cài thêm gì.

---

## 5.2 — Giải thích dễ hiểu

### 📊 Biểu đồ cột — "12 cột cho 12 tháng"

**Cách hoạt động:**

```
Bước 1: Gom tiền theo tháng
  "2025-01" → 200 triệu
  "2025-03" → 450 triệu
  "2025-04" → 180 triệu
  (các tháng khác = 0)

Bước 2: Luôn hiện đủ 12 cột (T1 → T12)
  Tháng có dữ liệu → cột vàng, cao tỷ lệ với số tiền
  Tháng không có dữ liệu → cột xám nhạt, rất thấp (2px)

Bước 3: Hiện số tiền trên đầu cột
  ≥ 1 tỷ → hiện "1.5tỷ"
  ≥ 1 triệu → hiện "450tr"
  < 1 triệu → hiện số thường
```

**Xử lý đặc biệt khi chọn "Tất cả năm":**

```
1 năm cụ thể (VD: 2025):
  T1-2025, T2-2025, T3-2025... → 12 cột riêng biệt

"Tất cả năm" hoặc nhiều năm:
  T1-2024 + T1-2025 = gộp thành 1 cột T1
  T2-2024 + T2-2025 = gộp thành 1 cột T2
  → Vẫn 12 cột, nhưng mỗi cột là TỔNG nhiều năm
```

### 🥧 Biểu đồ tròn — "Miếng bánh chi phí"

Hãy tưởng tượng tổng chi phí là **1 cái bánh pizza**. Biểu đồ tròn chia bánh thành các miếng, mỗi miếng là 1 loại chi phí:

| Loại chi phí | Ý nghĩa | Màu |
|-------------|---------|-----|
| Nhân Công | Tiền lương, công thợ | 🟡 Vàng |
| Vật Liệu XD | Xi măng, gạch, cát... | 🟢 Xanh lá |
| Thầu Phụ | Thuê đội thầu phụ | 🔵 Xanh dương |
| Sắt Thép | Sắt, thép xây dựng | 🔴 Đỏ |
| Đổ Bê Tông | Chi phí đổ bê tông | 🟣 Tím |
| **Khác** | Tất cả loại còn lại gộp vào | ⚫ Xám |

**Ví dụ thực tế:**
```
Tổng chi phí: 5 tỷ
  Nhân Công:    2 tỷ   → 40% → miếng lớn nhất
  Vật Liệu XD: 1.5 tỷ → 30%
  Sắt Thép:    800 tr  → 16%
  Khác:        700 tr  → 14%

→ Biểu đồ tròn: miếng vàng (40%) + xanh lá (30%) + đỏ (16%) + xám (14%)
→ Bên cạnh có chú thích (legend) ghi tên + phần trăm
```

---

## 5.3 — Ví dụ thực tế trong app

### Tình huống 1: Tháng 6 chi gấp đôi tháng khác

```
Biểu đồ cột: cột T6 cao vượt trội
→ Bạn biết ngay tháng 6 có chi phí bất thường
→ Kiểm tra: hóa hóa đơn đổ bê tông móng + mua sắt thép cùng lúc
```

### Tình huống 2: Nhân Công chiếm 60% tổng chi phí

```
Biểu đồ tròn: miếng "Nhân Công" chiếm hơn nửa bánh
→ Bạn biết cần xem lại chi phí nhân công
→ Có thể so với dự toán để kiểm tra vượt ngân sách
```

---

## 5.4 — Code chính

### Biểu đồ cột — Gom dữ liệu theo tháng

```javascript
function _dbBarChart(data) {
  // Bước 1: Gom tiền theo tháng ("YYYY-MM" → tổng tiền)
  const byMonth = {};
  data.forEach(i => {
    const m = i.ngay?.slice(0,7);   // "2025-04-24" → "2025-04"
    byMonth[m] = (byMonth[m] || 0) + (i.thanhtien || i.tien || 0);
  });

  // Bước 2: Tạo mảng 12 tháng
  const months12 = Array.from({length: 12}, (_, k) =>
    `${yr}-${String(k + 1).padStart(2, '0')}`   // "2025-01", "2025-02"...
  );

  // Bước 3: Nếu "Tất cả năm" → gộp cùng số tháng
  if (_ay.size !== 1) {
    // T1-2024 + T1-2025 → gộp thành 1 giá trị cho T1
    const byNum = {};
    Object.entries(byMonth).forEach(([m, v]) => {
      const num = m.slice(5);  // "2025-04" → "04"
      byNum[num] = (byNum[num] || 0) + v;
    });
  }
```

### Biểu đồ cột — Vẽ SVG

```javascript
  const maxVal = Math.max(...vals, 1);  // Giá trị lớn nhất (tối thiểu 1 tránh chia 0)
  const H = 160;                         // Chiều cao vùng vẽ (px)

  const bars = months12.map((m, i) => {
    const v = vals[i];                   // Giá trị tháng i
    const h = Math.round((v / maxVal) * H);  // Chiều cao cột tỷ lệ
    const cx = i * (colW + gap);         // Vị trí X của cột
    const y = H - h;                     // Vị trí Y (SVG đo từ trên xuống)

    // Rút gọn số tiền: 1.5tỷ, 450tr...
    const amt = v >= 1e9 ? (v/1e9).toFixed(1)+'tỷ'
              : v >= 1e6 ? Math.round(v/1e6)+'tr' : '';

    return `<rect x="${cx}" y="${y}" width="${colW}" height="${Math.max(h, 2)}"
                  fill="${v ? 'var(--gold)' : 'var(--line)'}"/>  <!-- cột vàng hoặc xám -->
            <text ...>${amt}</text>       <!-- số tiền trên đầu cột -->
            <text ...>T${i+1}</text>`;    <!-- nhãn T1, T2... dưới cột -->
  });
```

> **Diễn giải quan trọng:**

| Dòng | Ý nghĩa |
|------|---------|
| `Math.max(h, 2)` | Cột tối thiểu cao 2px — tháng = 0 vẫn thấy cột mỏng |
| `v ? 'var(--gold)' : 'var(--line)'` | Có tiền → vàng; không tiền → xám nhạt |
| `h > 14 ? amt : ''` | Cột quá thấp → không hiện số (tránh chữ đè lên cột) |

### Biểu đồ tròn — Vẽ "bánh pizza"

```javascript
function _dbPieChart(data) {
  // 5 loại chính, còn lại gộp "Khác"
  const KEY_TYPES = ['Nhân Công','Vật Liệu XD','Thầu Phụ','Sắt Thép','Đổ Bê Tông'];

  // Gom tiền theo loại
  const byType = {};
  data.forEach(i => {
    const k = KEY_TYPES.includes(i.loai) ? i.loai : 'Khác';
    byType[k] = (byType[k] || 0) + (i.thanhtien || i.tien || 0);
  });

  // Tính phần trăm + sắp xếp lớn → nhỏ
  const entries = Object.entries(byType)
    .sort((a,b) => b[1]-a[1])
    .map(([name, val], i) => ({ name, val, pct: val/total, color: COLORS[i] }));

  // Vẽ từng miếng bánh bằng SVG path (arc)
  let startAngle = -Math.PI / 2;  // Bắt đầu từ 12 giờ
  entries.forEach(e => {
    const angle = e.pct * Math.PI * 2;  // Góc miếng bánh
    // Tính tọa độ điểm đầu + điểm cuối trên đường tròn
    // Vẽ path: M(tâm) → L(điểm đầu) → A(cung tròn) → Z(về tâm)
  });
}
```

---

## 5.5 — Kết luận

### Hiểu phần này giúp bạn tránh được:

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|------------|------------|
| ❌ **Biểu đồ cột thiếu tháng** | Chỉ vẽ tháng có dữ liệu | Luôn tạo 12 cột (T1→T12), tháng trống = cột xám |
| ❌ **"Tất cả năm" hiện sai** | Không gộp cùng tháng từ nhiều năm | Khi multi-year → gộp T1-2024 + T1-2025 thành 1 cột |
| ❌ **Loại chi phí lạ chiếm chỗ** | Quá nhiều loại nhỏ lẻ | Gộp tất cả loại ngoài 5 loại chính thành "Khác" |
| ❌ **Biểu đồ tròn sai tỷ lệ** | Tính phần trăm sai | `pct = val / total` → tổng luôn = 100% |

> [!TIP]
> **Tại sao vẽ SVG thay vì dùng thư viện?** App này chạy offline trên điện thoại — mỗi KB thư viện đều quan trọng. SVG thuần nhẹ hơn Chart.js (~60KB) rất nhiều, và không cần download thêm gì.

---

> **📌 Tiếp theo → PHẦN 6:** Bảng xếp hạng & Phân tích theo Công Trình — Top 5 HĐ, tiền ứng, thiết bị.

---

# PHẦN 6: BẢNG XẾP HẠNG & PHÂN TÍCH THEO CÔNG TRÌNH

> **Dòng code:** 621 → 847
> **Các hàm chính:** `_dbTop5()`, `_dbByCT()`, `_dbUngByCT()`, `_dbTBByCT()`, `toolExportJSON()`, `toolImportJSON()`

---

## 6.1 — Mục đích

Phần này hiển thị **dữ liệu chi tiết theo công trình** trên Dashboard, bao gồm:

1. **Top 5 hóa đơn lớn nhất** — Những khoản chi lớn nhất
2. **Tiền ứng theo công trình** — Tổng tiền ứng cho từng CT (hoặc chi tiết khi chọn CT)
3. **Thiết bị theo công trình** — Số lượng + tình trạng TB tại từng CT và KHO TỔNG
4. **Xuất/Nhập JSON** — Nút bọc backup dữ liệu

Tất cả đều thuộc **Tầng 2** (PHẦN 4) → **Bị filter** khi chọn công trình.

---

## 6.2 — Giải thích dễ hiểu

### 🏆 Top 5 hóa đơn lớn nhất (`_dbTop5`)

Sắp xếp tất cả hóa đơn theo số tiền **từ lớn đến nhỏ**, lấy **5 cái đầu**:

```
🥇 Đổ bê tông sàn T3     180.000.000đ  ██████████ 100%
 2  Mua sắt thép         150.000.000đ  █████████  83%
 3  Lương tháng 6        120.000.000đ  ███████    67%
 4  Xi măng + cát        95.000.000đ  ██████     53%
 5  Điện nước tháng 6     80.000.000đ  █████      44%
```

Mỗi hàng có **thanh progress bar** tỷ lệ với hóa đơn lớn nhất (hàng 1 luôn = 100%).

### 💰 Tiền ứng theo công trình (`_dbUngByCT`) — 2 chế độ

Hàm này có **2 chế độ hiển thị** tùy thuộc bạn có chọn công trình hay không:

| Chế độ | Khi nào | Hiển thị gì |
|---------|---------|-------------|
| **Tổng quan** | `selectedCT = ''` (chưa chọn CT) | Bảng xếp hạng: CT nào ứng nhiều nhất (thanh bar xanh dương) |
| **Chi tiết** | `selectedCT = 'Nhà Anh A'` | Bảng chi tiết: Ngày, Thầu Phụ/NCC, Nội Dung, Số Tiền + Tổng cộng |

**Ví dụ:** Khi chưa chọn CT → thấy "Nhà Anh A: 500tr, Nhà Anh B: 300tr". Khi chọn "Nhà Anh A" → thấy bảng chi tiết 10 lần ứng tiền, tổng 500tr.

### 🛠️ Thiết bị theo công trình (`_dbTBByCT`) — Cũng 2 chế độ

| Chế độ | Hiển thị |
|---------|-----------|
| **Tổng quan** | KHO TỔNG (đầu tiên, viền vàng) + từng CT: Tổng số, Đang HĐ, Cần bảo trì, Cần sửa chữa |
| **Chi tiết** | Bảng: Tên Thiết Bị, Số Lượng, Tình Trạng (màu xanh/vàng/đỏ), Công Trình |

**3 màu tình trạng:**
- 🟢 **Đang hoạt động** = xanh lá
- 🟡 **Cần bảo trì** = vàng
- 🔴 **Cần sửa chữa** = đỏ

### 📦 Xuất/Nhập JSON (`toolExportJSON`, `toolImportJSON`)

2 hàm nhỏ ở cuối file, là **nút bọc** cho HTML gọi:
- `toolExportJSON()` → gọi `exportJSON()` (hàm thật nằm ở file khác)
- `toolImportJSON()` → mở hộp chọn file JSON để import

---

## 6.3 — Ví dụ thực tế trong app

### Tình huống 1: Xem tổng quan tiền ứng

```
Không chọn CT nào:
→ Hiện bảng xếp hạng:
  1. Nhà Anh A: 500.000.000đ  ██████████ 100%
  2. Nhà Anh B: 300.000.000đ  ██████      60%
  3. Nhà Anh C: 150.000.000đ  ███           30%
```

### Tình huống 2: Chọn CT để xem chi tiết tiền ứng

```
Chọn "Nhà Anh A":
→ Hiện bảng chi tiết:
  Ngày        | Thầu Phụ    | Nội Dung        | Số Tiền
  2025-04-20 | Đội Bình   | Ứng đợt 3      | 200.000.000
  2025-03-15 | Đội Bình   | Ứng đợt 2      | 150.000.000
  2025-02-01 | Đội Bình   | Ứng đợt 1      | 150.000.000
  Tổng cộng (3 lần):                  500.000.000
```

### Tình huống 3: Xem thiết bị tổng quan

```
🏠 KHO TỔNG (viền vàng, luôn ở đầu)
  Tổng: 15  |  Đang HĐ: 10  |  Cần BT: 3  |  Cần SC: 2

Nhà Anh A
  Tổng: 8   |  Đang HĐ: 6   |  Cần BT: 2  |  Cần SC: 0

Nhà Anh B
  Tổng: 5   |  Đang HĐ: 5   |  Cần BT: 0  |  Cần SC: 0
```

---

## 6.4 — Code chính

### Top 5 hóa đơn

```javascript
function _dbTop5(data) {
  // Sắp xếp giảm dần theo tiền, lấy 5 cái đầu
  const top5 = [...data]
    .sort((a,b) => (b.thanhtien||b.tien||0) - (a.thanhtien||a.tien||0))
    .slice(0, 5);

  // Hàng 1 = 100%, các hàng sau tỷ lệ theo hàng 1
  const max = top5[0] ? (top5[0].thanhtien||top5[0].tien||0) : 1;

  // Render: 🥇 cho hàng 1, số thứ tự cho các hàng sau
  top5.map((inv, i) => {
    const pct = Math.round(amt / max * 100);  // Tỷ lệ % so với max
    // Hiện: Nội dung | Ngày · Công trình | Thanh bar | Số tiền
  });
}
```

### Tiền ứng — 2 chế độ

```javascript
function _dbUngByCT() {
  // Lọc: chưa xóa + đúng năm + đúng CT (để trống = tất cả)
  const filtered = ungRecords.filter(r =>
    !r.deletedAt &&              // ← KHÔNG lấy bản ghi đã xóa
    inActiveYear(r.ngay) &&      // ← Đúng năm đang xem
    (!selectedCT || resolveProjectName(r) === selectedCT)  // ← Filter CT
  );

  if (!selectedCT) {
    // CHẾ ĐỘ 1: Tổng quan → gom tiền theo CT → hiện bảng xếp hạng
  } else {
    // CHẾ ĐỘ 2: Chi tiết → bảng từng dòng + tổng cộng
  }
}
```

> **Diễn giải:** `!r.deletedAt` là điều kiện **lọc soft-delete**. Tiền ứng đã bị xóa (có `deletedAt`) sẽ **không hiện** trên Dashboard. Đây là lý do soft-delete hoạt động — bản ghi vẫn còn trong mảng nhưng UI lờ nghích.

### Thiết bị — KHO TỔNG + từng CT

```javascript
function _dbTBByCT() {
  // Tách 2 nhóm: thiết bị tại CT và thiết bị trong KHO TỔNG
  const allTB = tbData.filter(t => !t.deletedAt && t.ct !== TB_KHO_TONG);
  const khoTB = tbData.filter(t => !t.deletedAt && t.ct === TB_KHO_TONG);

  if (!selectedCT) {
    // TỔNG QUAN: KHO TỔNG (đầu tiên) + từng CT
    // Mỗi CT: đếm Tổng, Đang HĐ, Cần BT, Cần SC
  } else {
    // CHI TIẾT: bảng có cột Tên, SL, Tình Trạng, Công Trình
    // Màu tình trạng: xanh (HĐ) / vàng (BT) / đỏ (SC)
  }
}
```

---

## 6.5 — Kết luận

### Hiểu phần này giúp bạn tránh được:

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|------------|------------|
| ❌ **Top 5 hiện HĐ đã xóa** | Không lọc `deletedAt` | Dữ liệu đã đi qua `getInvoicesCached()` — đã lọc sẵn |
| ❌ **Tiền ứng gấp đôi** | Đếm cả bản ghi soft-delete | `!r.deletedAt` lọc ngay từ đầu |
| ❌ **Thiết bị ở KHO TỔNG không hiện** | Lọc nhầm KHO TỔNG | Tách riêng `allTB` (tại CT) và `khoTB` (KHO TỔNG) |
| ❌ **Chọn CT nhưng thấy dữ liệu tất cả** | Quên filter `selectedCT` | Mọi hàm đều kiểm tra `!selectedCT \|\| resolveProjectName(r) === selectedCT` |

> [!NOTE]
> **Pattern "2 chế độ"** xuất hiện nhiều lần: chưa chọn CT = tổng quan (bảng xếp hạng), chọn CT = chi tiết (bảng dữ liệu). Pattern này giúp 1 vùng hiển thị phục vụ được 2 mục đích khác nhau mà không cần thêm trang.

---

> **📌 Tiếp theo → PHẦN 7:** Liên kết hệ thống — Cách module `datatools.js` giao tiếp với phần còn lại.

---

# PHẦN 7: LIÊN KẾT HỆ THỐNG — CÁCH MODULE GIAO TIẾP VỚI PHẦN CÒN LẠI

> Phần này không giải thích code cụ thể, mà chỉ ra **datatools.js "nói chuyện" với những file nào** và theo cách nào.

---

## 7.1 — Bản đồ giao tiếp tổng quan

```
┌──────────────────────────────────────────────────────────────┐
│                      datatools.js                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Xóa theo năm │  │ Reset toàn bộ│  │ Dashboard + KPI  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼─────────────────┼────────────────────┼────────────┘
          │                 │                    │
    ┌─────▼─────┐   ┌───────▼───────┐   ┌───────▼───────┐
    │  core.js  │   │   sync.js     │   │  hoadon.js    │
    │  (lưu trữ)│   │  (Firebase)   │   │  (invoices)   │
    └───────────┘   └───────────────┘   └───────────────┘
```

---

## 7.2 — Hàm/biến datatools.js GỌI từ module khác

### Từ `core.js` — Lưu trữ & Cấu hình

| Hàm/Biến | Dùng ở đâu | Mục đích |
|----------|-----------|----------|
| `save(key, data)` | Xóa năm, Reset | Ghi dữ liệu vào _mem + IDB |
| `load(key, default)` | Reset | Đọc dữ liệu từ bộ nhớ |
| `_memSet(key, data)` | Xóa năm, Reset | Ghi vào cache _mem |
| `_dbSave(key, data)` | Reset | Ghi trực tiếp vào IDB |
| `_mem` | Reset | Cache trung gian (object toàn cục) |
| `db` | Reset | Đối tượng IndexedDB (db.invoices, db.attendance...) |
| `cats` | Xóa năm, Reset | Object danh mục toàn cục |
| `DEVICE_ID` | Xóa năm, Reset | ID thiết bị hiện tại |
| `activeYear` / `activeYears` | Xóa năm, Dashboard | Năm đang chọn trên giao diện |

### Từ `sync.js` — Đồng bộ Firebase

| Hàm/Biến | Dùng ở đâu | Mục đích |
|----------|-----------|----------|
| `isSyncing()` | Xóa năm, Reset | Kiểm tra đang sync → chặn xóa |
| `fbReady()` | Reset | Kiểm tra Firebase đã sẵn sàng |
| `fsSet(doc, data)` | Reset | Ghi dữ liệu lên Firestore |
| `fbDocYear(yr)` | Reset | Lấy reference document theo năm |
| `fbDocCats()` | Reset | Lấy reference document danh mục |
| `fbYearPayload(yr)` | Reset | Đóng gói dữ liệu năm để push |
| `fbCatsPayload()` | Reset | Đóng gói danh mục để push |
| `showSyncBanner()` / `hideSyncBanner()` | Xóa năm, Reset | Hiện/ẩn banner "Đang xử lý..." |
| `_blockPullUntil` | Reset | Biến chặn pull sau reset |

### Từ `hoadon.js` — Hóa đơn

| Hàm/Biến | Dùng ở đâu | Mục đích |
|----------|-----------|----------|
| `invoices` | Xóa năm, Dashboard | Mảng hóa đơn toàn cục |
| `getInvoicesCached()` | Dashboard | Lấy hóa đơn đã lọc deletedAt + cache |
| `clearInvoiceCache()` | Xóa năm | Xóa cache sau khi thay đổi dữ liệu |
| `resolveProjectName(i)` | Dashboard | Lấy tên CT từ hóa đơn (qua projectId) |

### Từ các module dữ liệu khác

| Biến | Module gốc | Dùng trong datatools |
|------|-----------|---------------------|
| `ungRecords` | nhapxuat.js | Xóa năm + Dashboard tiền ứng |
| `ccData` | chamcong.js | Xóa năm (soft-delete chấm công) |
| `thuRecords` | doanhthu.js | Xóa năm (soft-delete thu tiền) |
| `thauPhuContracts` | doanhthu.js | Xóa năm (soft-delete HĐ thầu phụ) |
| `hopDongData` | doanhthu.js | Xóa năm + Reset (object hợp đồng) |
| `tbData` | thietbi.js | Xóa năm (chuyển KHO TỔNG) + Dashboard TB |
| `projects` | danhmuc.js | Reset (danh sách dự án) |

### Từ UI helpers

| Hàm | Mục đích |
|-----|----------|
| `toast(msg, type)` | Hiện thông báo cho người dùng |
| `fmtM(amount)` | Format tiền: 1000000 → "1.000.000đ" |
| `fmtS(amount)` | Format ngắn gọn |
| `sumBy(arr, key)` | Cộng tổng 1 trường trong mảng |
| `inActiveYear(ngay)` | Kiểm tra ngày thuộc năm đang chọn |
| `x(str)` | Escape HTML (tránh XSS) |
| `_refreshAllTabs()` | Refresh toàn bộ giao diện sau khi xóa/reset |
| `_snapshotNow(label)` | Tự động backup trước khi xóa |

---

## 7.3 — Hàm datatools.js CUNG CẤP cho module khác

| Hàm | Ai gọi | Mục đích |
|-----|--------|----------|
| `renderDashboard()` | `core.js` (khi chuyển tab) | Render trang Dashboard |
| `toolDeleteYear()` | HTML onclick | Xóa dữ liệu theo năm |
| `toolResetAll()` | HTML onclick | Reset toàn bộ |
| `toolExportJSON()` | HTML onclick | Xuất JSON backup |
| `toolImportJSON()` | HTML onclick | Nhập JSON backup |
| `openDeleteModal()` | HTML onclick | Hiện thông báo "tính năng bị tắt" |
| `selectedCT` | Dashboard dropdown | Biến filter công trình |

---

## 7.4 — Luồng dữ liệu quan trọng

### Luồng 1: Xóa theo năm

```
HTML onclick → toolDeleteYear()
  → _showDeleteConfirm() → gõ DELETE
    → _doDeleteYear(yr)
      → _snapshotNow()           [từ core.js]
      → soft-delete invoices...  [từ hoadon.js, nhapxuat.js...]
      → _saveCatKey()            [ghi cats + _mem + IDB]
      → save()                   [từ core.js]
      → _refreshAllTabs()        [từ core.js]
```

### Luồng 2: Reset toàn bộ

```
HTML onclick → toolResetAll()
  → _showDeleteConfirm() → gõ DELETE
    → _doResetAll()
      → _snapshotNow()           [từ core.js]
      → soft-delete ALL records  [ghi vào _mem]
      → fsSet(fbDocYear...)      [push lên Firebase - từ sync.js]
      → fsSet(fbDocCats...)      [push danh mục lên Firebase]
      → chặn pull 5 phút         [_blockPullUntil]
      → clear IDB + ghi []       [từ core.js]
      → _refreshAllTabs()        [từ core.js]
```

### Luồng 3: Dashboard

```
Chuyển tab Dashboard → renderDashboard()
  → getInvoicesCached()          [từ hoadon.js - đã lọc deletedAt]
  → Tầng 1: _dbKPI, _dbBarChart, _dbPieChart
  → Tầng 2: _dbTop5, _dbUngByCT, _dbTBByCT
  → renderCtPage()               [từ projects.js]
```

---

## 7.5 — Kết luận tổng thể

### datatools.js là "trung tâm điều phối" cho 2 nhiệm vụ:

| Nhiệm vụ | Giao tiếp với | Khái niệm cốt lõi |
|----------|--------------|-------------------|
| **Quản lý dữ liệu** (Xóa/Reset) | core.js, sync.js, tất cả module dữ liệu | `deletedAt`, `updatedAt`, `deviceId`, soft-delete |
| **Dashboard** (Hiển thị) | hoadon.js, nhapxuat.js, thietbi.js | 2 tầng dữ liệu, `selectedCT`, `getInvoicesCached()` |

### 5 khái niệm quan trọng nhất xuyên suốt file:

| # | Khái niệm | Ý nghĩa |
|---|----------|----------|
| 1 | **`deletedAt`** | Đánh dấu xóa mềm — bản ghi vẫn tồn tại nhưng UI ẩn |
| 2 | **`updatedAt`** | Thời điểm cập nhật — dùng để giải quyết xung đột sync |
| 3 | **`deviceId`** | Thiết bị nào thao tác — debug khi có vấn đề |
| 4 | **`selectedCT`** | Filter công trình — điều khiển Tầng 2 của Dashboard |
| 5 | **`_mem` + IDB + cats`** | 3 tầng bộ nhớ — phải ghi đồng bộ cả 3 |

> [!IMPORTANT]
> **Quy tắc vàng:** Trong hệ thống sync, **KHÔNG BAO GIỜ xóa thật** (hard delete). Luôn dùng soft-delete (`deletedAt`) để thông báo cho các thiết bị khác. Vi phạm quy tắc này = dữ liệu "hồi sinh" vô tận.

---

## 🎉 HOÀN THÀNH — Tổng kết 7 phần

| Phần | Nội dung | Điểm chính |
|------|----------|------------|
| **1** | Hộp thoại xác nhận xóa | Bắt gõ "DELETE", `_saveCatKey()` ghi 3 nơi |
| **2** | Xóa theo năm | Soft-delete, chuyển TB → KHO TỔNG, dọn danh mục |
| **3** | Reset toàn bộ | Push soft-delete lên Firebase, chặn pull 5 phút, ghi `[]` chống hồi sinh |
| **4** | Dashboard & KPI | 2 tầng dữ liệu, 4 thẻ KPI, `getInvoicesCached()` |
| **5** | Biểu đồ cột & tròn | SVG thuần, 12 cột/tháng, 5 loại + "Khác" |
| **6** | Bảng xếp hạng & CT | Top 5, tiền ứng 2 chế độ, thiết bị + KHO TỔNG |
| **7** | Liên kết hệ thống | Bản đồ giao tiếp giữa các module |
