# 📘 GIẢI THÍCH FILE `danhmuc.js` — PHẦN 1/2

> **File:** `danhmuc.js` · **988 dòng** · Load thứ 4 (sau hoadon.js)
> **Vai trò:** Quản lý trang Công Trình (CT Page), Danh Mục (Settings), và Tiền Ứng

---

## PHẦN 1: TRANG CÔNG TRÌNH (CT PAGE)

### 1. Mục đích
Hiển thị **bảng tổng hợp chi phí theo từng công trình** trong năm đang chọn.

### 2. Giải thích dễ hiểu
Bạn mở app và muốn biết: "Năm nay tôi đã chi bao nhiêu cho từng công trình?" → Trang CT Page sẽ:
- Lấy tất cả hóa đơn trong năm
- Nhóm theo tên công trình
- Tính tổng tiền + đếm số hóa đơn
- Phân nhỏ theo loại chi phí

### 3. Ví dụ thực tế
| Công trình | Số HĐ | Tổng chi |
|---|---|---|
| CT A DŨNG - ĐỒNG NAI | 45 | 850,000,000đ |
| CT BÁC CHỮ - TÂN PHÚ | 32 | 620,000,000đ |

Nhấn vào thẻ → mở modal chi tiết với bảng hóa đơn phân theo loại.

### 4. Logic xử lý
- **Input:** Hóa đơn từ `getInvoicesCached()` + năm đang chọn
- **Output:** Các thẻ card trên giao diện
- **Khi nào chạy:** Mở tab "Công Trình" hoặc đổi năm

### 5. Code chính
```javascript
function renderCtPage() {
  const map = {};
  getInvoicesCached().forEach(inv => {
    if (!inActiveYear(inv.ngay)) return;
    const ctKey = resolveProjectName(inv) || '(Không rõ)';
    if (!map[ctKey]) map[ctKey] = {total:0, count:0, byLoai:{}};
    map[ctKey].total += (inv.thanhtien || inv.tien || 0);
    map[ctKey].count++;
  });
}
```

### 6. Diễn giải
| Dòng | Ý nghĩa |
|---|---|
| `getInvoicesCached()` | Lấy danh sách hóa đơn (đã lọc bỏ bản xóa mềm) |
| `inActiveYear(inv.ngay)` | Chỉ lấy hóa đơn thuộc năm đang chọn |
| `resolveProjectName(inv)` | Tìm tên công trình từ hóa đơn |
| `inv.thanhtien \|\| inv.tien` | Lấy thành tiền, nếu không có thì lấy đơn giá |

### 7. Kết luận
Hiểu phần này giúp biết tổng chi phí được tính từ đâu và tại sao đổi năm thì số liệu thay đổi.

### ⚠️ Lỗi thường gặp
| Lỗi | Nguyên nhân |
|---|---|
| Công trình hiện "(Không rõ)" | Hóa đơn không có tên CT hoặc projectId |
| Tổng tiền sai | Hóa đơn có `thanhtien=0` nhưng `tien>0` (data cũ) |
| Thiếu công trình | Hóa đơn thuộc năm khác |

### 🔗 Liên kết module
- **Từ:** `hoadon.js` → `getInvoicesCached()`, `projects.js` → `resolveProjectName()`
- **Tới:** Giao diện tab "Công Trình"

---

## PHẦN 2: CHUẨN HÓA VÀ CHỐNG TRÙNG DỮ LIỆU

### 1. Mục đích
Đảm bảo tên trong danh mục **luôn nhất quán** — không trùng do viết hoa/thường hoặc có/không dấu.

### 2. Giải thích dễ hiểu
Bạn thêm "Nguyễn Văn A", người khác thêm "NGUYỄN VĂN A" → cùng 1 người nhưng máy không biết. Hệ thống giải quyết:
1. **Chuẩn hóa tên**: Tự động viết hoa đúng quy tắc
2. **So sánh trùng**: Bỏ dấu + chữ thường để phát hiện

### 3. Ví dụ
| Bạn nhập | Hệ thống chuẩn thành | Quy tắc |
|---|---|---|
| "nhân công" | "Nhân Công" | Loại chi phí → Title Case |
| "nguyễn văn a" | "NGUYỄN VĂN A" | Thầu phụ → UPPERCASE |

### 4. Logic xử lý
- **Input:** Tên user nhập
- **Output:** Tên đã chuẩn hóa hoặc thông báo trùng
- **Khi nào:** Thêm mới hoặc sửa tên

### 5. Code chính
```javascript
function normalizeName(catId, val) {
  val = (val || '').trim();
  if (catId === 'loaiChiPhi' || catId === 'tbTen') {
    return val.toLowerCase().split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return val.toUpperCase();
}

function normalizeKey(val) {
  return (val || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu
    .replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
```

### 6. Diễn giải
- `normalizeName`: Viết hoa đúng chuẩn tuỳ loại
- `normalizeKey`: Bỏ dấu + lowercase → dùng phát hiện trùng
- `normalize('NFD')`: Tách dấu khỏi chữ (ă → a + dấu)

### 7. Kết luận
Biết tại sao tên tự viết hoa và tại sao không thể thêm tên trùng.

### ⚠️ Lỗi thường gặp
| Lỗi | Nguyên nhân |
|---|---|
| "Đã tồn tại!" | Tên trùng sau khi bỏ dấu |
| Tên khác với nhập | `normalizeName` tự chuẩn hóa |

### 🔗 Liên kết module
- **Gọi từ:** `addItem()`, `finishEdit()` trong cùng file
- **Ảnh hưởng:** Tất cả danh mục

---

## PHẦN 3: QUẢN LÝ DANH MỤC (THÊM / SỬA / XÓA)

### 1. Mục đích
Cho phép thêm, sửa tên, xóa các mục trong danh mục. Khi sửa tên → tự động cập nhật toàn bộ hóa đơn, tiền ứng, chấm công liên quan.

### 2. Giải thích dễ hiểu
Giống như bạn đổi tên liên hệ trong điện thoại → tất cả tin nhắn cũ cũng đổi theo. App hoạt động tương tự:
- **Sửa tên thầu phụ** "A" → "B" → Tất cả hóa đơn ghi "A" sẽ đổi thành "B"
- **Xóa NCC** → Chỉ được nếu chưa có hóa đơn nào gắn với NCC đó
- **Thêm mới** → Kiểm tra trùng trước khi thêm

### 3. Ví dụ
Bạn đổi tên NCC từ "CÔNG TY MINH PHÁT" → "VLXD MINH PHÁT":
- 50 hóa đơn ghi NCC = "CÔNG TY MINH PHÁT" → tự động đổi thành "VLXD MINH PHÁT"
- Tiền ứng NCC → cũng đổi theo
- Hợp đồng → cũng đổi theo

### 4. Logic xử lý
- **Input:** Tên mới từ user + catId (loại danh mục)
- **Output:** Cập nhật toàn bộ data liên quan + lưu
- **Khi nào:** User nhấn Enter sau khi sửa hoặc nhấn nút "Thêm"

### 5. Code chính
```javascript
function finishEdit(catId, idx) {
  // Không cho sửa công trình ở đây
  if (catId === 'congTrinh') { cancelEdit(catId, idx); return; }
  
  let newVal = normalizeName(catId, inp.value);
  const old = cats[catId][idx];
  if (newVal === old) { cancelEdit(catId, idx); return; }
  
  // Chống trùng
  const isDup = cats[catId].some((existing, i) => 
    i !== idx && normalizeKey(existing) === normalizeKey(newVal));
  if (isDup) { toast('Đã tồn tại!', 'error'); return; }
  
  cats[catId][idx] = newVal;
  // Cập nhật hóa đơn
  invoices.forEach(inv => { if (inv[cfg.refField] === old) inv[cfg.refField] = newVal; });
  // Cập nhật tiền ứng
  ungRecords.forEach(r => { if (r.tp === old) r.tp = newVal; });
  // Cập nhật chấm công (nếu công nhân)
  ccData.forEach(week => { week.workers.forEach(wk => { if (wk.name === old) wk.name = newVal; }); });
  
  saveCats(catId); save('inv_v3', invoices); save('ung_v1', ungRecords);
}

function delItem(catId, idx) {
  if (isItemInUse(catId, item)) { toast('Đã có dữ liệu, không xóa được!'); return; }
  cats[catId].splice(idx, 1);
  saveCats(catId);
}
```

### 6. Diễn giải
| Thao tác | Chi tiết |
|---|---|
| Sửa tên | Chuẩn hóa → kiểm tra trùng → cập nhật data liên quan → lưu tất cả |
| Xóa | Kiểm tra "đang dùng" → nếu có thì từ chối → nếu không thì xóa + cleanup tiền ứng |
| Thêm | Chuẩn hóa → kiểm tra trùng → thêm vào cuối danh mục → lưu |

### 7. Kết luận
Hiểu phần này giúp bạn:
- Biết khi đổi tên thì **tất cả data cũ cũng đổi theo**
- Hiểu tại sao một số mục **không xóa được**
- Biết cách thêm đúng (tên sẽ tự chuẩn hóa)

### ⚠️ Lỗi thường gặp
| Lỗi | Nguyên nhân |
|---|---|
| Không xóa được | Mục đang dùng trong hóa đơn/ứng/chấm công |
| Đổi tên nhưng data cũ không đổi | Bug nếu `cfg.refField` không đúng hoặc data nằm ở module chưa xử lý |
| Gấp đôi dữ liệu sau đổi tên | Nếu sửa trực tiếp localStorage thay vì qua app |

### 🔗 Liên kết module
- **Cập nhật:** `hoadon.js` (invoices), `danhmuc.js` (ungRecords), `chamcong.js` (ccData), `thietbi.js` (tbData), `doanhthu.js` (thuRecords, hopDongData, thauPhuContracts)
- **Lưu qua:** `core.js` → `saveCats()`, `save()`
- **Rebuild UI:** `rebuildEntrySelects()`, `rebuildUngSelects()`, `dtPopulateSels()`
# 📘 GIẢI THÍCH FILE `danhmuc.js` — PHẦN 2/2

---

## PHẦN 4: QUẢN LÝ TIỀN ỨNG — NHẬP LIỆU

### 1. Mục đích
Cho phép nhập **tiền ứng** cho thầu phụ, nhà cung cấp, hoặc công nhân. Tiền ứng là tiền trả trước cho đối tác trước khi có hóa đơn/quyết toán.

### 2. Giải thích dễ hiểu
Hãy tưởng tượng: Thầu phụ A cần tiền mua vật liệu trước khi thi công → bạn ứng trước 50 triệu. Đây là **tiền ứng**, chưa phải chi phí cuối cùng.

Form nhập tiền ứng gồm:
- **Ngày** ứng tiền
- Bảng nhiều dòng, mỗi dòng gồm: Loại (Thầu phụ/NCC/Công nhân) → Tên → Công trình → Số tiền → Nội dung
- Nút "Lưu tất cả" để lưu cùng lúc nhiều dòng

### 3. Ví dụ thực tế

| Loại | Tên | Công trình | Số tiền | Nội dung |
|---|---|---|---|---|
| Thầu phụ | NGUYỄN VĂN A | CT BÁC CHỮ | 50,000,000 | Ứng tiền mua sắt |
| NCC | VLXD MINH PHÁT | CT A DŨNG | 30,000,000 | Ứng tiền vật liệu |
| Công nhân | A LONG | CT BÁC CHỮ | 5,000,000 | Ứng lương tuần |

### 4. Logic xử lý
- **Input:** Dữ liệu từ form nhập (ngày, loại, tên, CT, tiền, nội dung)
- **Output:** Bản ghi tiền ứng lưu vào `ungRecords` → `ung_v1` trong IDB
- **Khi nào:** User điền form và nhấn "Lưu tất cả"

### 5. Code chính
```javascript
function saveAllUngRows() {
  const date = document.getElementById('ung-date').value;
  if (!date) { toast('Vui lòng chọn ngày!', 'error'); return; }
  
  const rowsData = [];
  document.querySelectorAll('#ung-tbody tr').forEach(tr => {
    const tp = tr.querySelector('[data-f="tp"]')?.value.trim();
    const tien = parseInt(tr.querySelector('[data-f="tien"]')?.dataset.raw || '0');
    if (!tp && !tien) return; // bỏ qua dòng trống
    if (!tp) { errRow++; return; } // thiếu tên → báo lỗi
    
    // Kiểm tra CT đã quyết toán → không cho ứng thêm
    const proj = getProjectById(ctPid);
    if (proj && proj.status === 'closed') { errRow++; return; }
    
    rowsData.push({ ngay: date, loai, tp, congtrinh, tien, nd });
  });
  
  // Lưu mới hoặc cập nhật
  if (_editingUngId != null) {
    ungRecords[idx] = { ...ungRecords[idx], ...rec, updatedAt: Date.now() };
  } else {
    rowsData.forEach(rec => ungRecords.unshift(mkRecord(rec)));
  }
  save('ung_v1', ungRecords);
}
```

### 6. Diễn giải
| Logic | Ý nghĩa |
|---|---|
| `_editingUngId` | Nếu có giá trị → đang **sửa** bản ghi cũ, không phải tạo mới |
| `mkRecord(rec)` | Tạo bản ghi mới với id, timestamp, deviceId |
| `ungRecords.unshift()` | Thêm vào đầu danh sách (mới nhất lên trên) |
| `proj.status === 'closed'` | CT đã quyết toán → từ chối nhập tiền ứng |
| `onUngLoaiChange` | Đổi loại → đổi placeholder ô tên (Thầu phụ/NCC/CN) |

### 7. Kết luận
Hiểu phần này giúp bạn:
- Biết cách nhập tiền ứng đúng (phải chọn ngày, phải có tên)
- Hiểu tại sao CT quyết toán rồi thì không ứng được
- Biết sửa tiền ứng cũ bằng cách nhấn ✏️

### ⚠️ Lỗi thường gặp
| Lỗi | Nguyên nhân |
|---|---|
| "Dòng có lỗi" khi lưu | Thiếu tên TP/NCC hoặc CT đã quyết toán |
| Tên không có trong danh mục | Phải thêm vào Danh Mục trước |
| Số tiền = 0 | Nhập sai format hoặc quên nhập |
| Gấp đôi tiền ứng | Nhấn "Lưu" 2 lần trước khi form reset |

### 🔗 Liên kết module
- **Dữ liệu từ:** `core.js` → `load('ung_v1')`, `cats` (danh mục TP/NCC/CN)
- **Projects:** `projects.js` → kiểm tra CT quyết toán, `_buildProjOpts()` cho dropdown
- **Ảnh hưởng:** Dashboard tổng hợp, tab Doanh Thu, tab Công Trình

---

## PHẦN 5: HIỂN THỊ DANH SÁCH TIỀN ỨNG + LỌC + PHÂN TRANG

### 1. Mục đích
Hiển thị **toàn bộ tiền ứng đã lưu**, chia thành 3 nhóm (Thầu Phụ / NCC / Công Nhân), có bộ lọc và phân trang.

### 2. Giải thích dễ hiểu
Sau khi nhập tiền ứng, bạn cần xem lại: "Đã ứng bao nhiêu cho ai, ở CT nào?" Phần này hiển thị danh sách đó.

Giao diện chia 3 bảng:
- 🟡 **Thầu Phụ**: 10 dòng/trang
- 🟢 **Nhà Cung Cấp**: 10 dòng/trang  
- 🔵 **Công Nhân**: 5 dòng/trang

Mỗi bảng có:
- Checkbox chọn nhiều dòng
- Nút ✏️ sửa, ✕ xóa từng dòng
- Tổng tiền ở header + cuối trang

### 3. Ví dụ
Bạn lọc: CT = "CT BÁC CHỮ", Tháng = "2026-03" → chỉ hiện tiền ứng thuộc CT và tháng đó.

### 4. Logic xử lý
- **Input:** `ungRecords` + bộ lọc (tên, CT, tháng, tìm kiếm)
- **Output:** 3 bảng HTML phân theo loại
- **Khi nào:** Mở tab Tiền Ứng, thay đổi bộ lọc, sau lưu/xóa

### 5. Code chính
```javascript
function filterAndRenderUng() {
  filteredUng = ungRecords.filter(r => {
    if (r.deletedAt) return false;           // bỏ bản xóa mềm
    if (!inActiveYear(r.ngay)) return false;  // chỉ năm đang chọn
    if (fTp && r.tp !== fTp) return false;    // lọc theo tên
    if (fCt && resolveProjectName(r) !== fCt) return false; // lọc theo CT
    if (fMonth && !r.ngay.startsWith(fMonth)) return false; // lọc theo tháng
    if (q) { /* tìm kiếm text */ }
    return true;
  });
  filteredUng.sort((a, b) => b.ngay.localeCompare(a.ngay)); // mới nhất trước
  renderUngTable();
}

function renderUngTable() {
  const allTp = filteredUng.filter(r => r.loai === 'thauphu');
  const allNcc = filteredUng.filter(r => r.loai === 'nhacungcap');
  const allCn = filteredUng.filter(r => r.loai === 'congnhan');
  // Render 3 section riêng biệt
}
```

### 6. Diễn giải
| Logic | Ý nghĩa |
|---|---|
| `r.deletedAt` | Bản ghi đã xóa mềm → ẩn khỏi danh sách |
| `inActiveYear` | Chỉ hiện tiền ứng của năm đang chọn |
| `filteredUng.sort` | Sắp xếp ngày mới nhất lên đầu |
| `UNG_TP_PG = 10` | Thầu phụ/NCC hiện 10 dòng/trang |
| `UNG_CN_PG = 5` | Công nhân hiện 5 dòng/trang |

### 7. Kết luận
Hiểu phần này giúp:
- Biết cách lọc tiền ứng theo nhiều tiêu chí
- Hiểu tại sao dòng "biến mất" (do lọc năm hoặc đã xóa mềm)
- Xuất CSV để gửi báo cáo

### ⚠️ Lỗi thường gặp
| Lỗi | Nguyên nhân |
|---|---|
| Tiền ứng biến mất | Đổi năm → tiền ứng năm khác bị ẩn |
| Tổng tiền không khớp | Bộ lọc đang bật mà không nhận ra |
| Xóa nhưng vẫn thấy | Xóa mềm chưa sync → thiết bị khác vẫn thấy |
| Sai số tiền tổng | Filter đang lọc 1 phần, nhưng tưởng là toàn bộ |

### 🔗 Liên kết module
- **Dữ liệu từ:** `ungRecords` (load từ IDB `ung_v1`), `projects.js` → `resolveProjectName()`
- **Export:** `exportUngAllCSV()` xuất file CSV
- **Ảnh hưởng:** Khi xóa → gọi `_refreshAllTabs()` cập nhật dashboard

---

## PHẦN 6: XÓA TIỀN ỨNG + CHUẨN HÓA DỮ LIỆU CŨ + SAO LƯU

### 1. Mục đích
- **Xóa mềm** tiền ứng (không xóa thật, chỉ đánh dấu)
- **Chuẩn hóa data cũ**: Chuyển format cũ (`cancelled`) sang format mới (`deletedAt`)
- **Sao lưu**: Tạo backup thủ công + khôi phục

### 2. Giải thích dễ hiểu
Khi bạn nhấn ✕ xóa tiền ứng, app KHÔNG xóa thật. Thay vào đó, nó đánh dấu `deletedAt = timestamp`. Bản ghi vẫn còn trong data nhưng không hiển thị. Điều này giúp:
- **Đồng bộ cloud**: Thiết bị khác biết bản ghi đã xóa
- **Khôi phục**: Có thể phục hồi nếu xóa nhầm (qua backup)

Ngoài ra, app tự động chuyển data cũ (field `cancelled: true`) sang format mới (`deletedAt: timestamp`).

### 3. Ví dụ
Bạn xóa 1 tiền ứng 50 triệu:
- Bản ghi được gắn `deletedAt: 1714012345678`
- Không hiện trong danh sách nữa
- Nhưng khi sync cloud → thiết bị khác cũng biết để ẩn
- Dashboard tự cập nhật (trừ 50 triệu)

### 4. Logic xử lý
- **Input:** ID bản ghi cần xóa
- **Output:** Bản ghi được đánh dấu `deletedAt` + `updatedAt` + `deviceId`
- **Khi nào:** User nhấn nút ✕ + xác nhận

### 5. Code chính
```javascript
function delUngRecord(id) {
  const idx = ungRecords.findIndex(r => String(r.id) === String(id));
  if (idx < 0) return;
  if (!confirm('Xóa bản ghi tiền ứng này?')) return;
  const now = Date.now();
  ungRecords[idx] = { 
    ...ungRecords[idx], 
    deletedAt: now, 
    updatedAt: now, 
    deviceId: DEVICE_ID 
  };
  save('ung_v1', ungRecords);
  _refreshAllTabs();
}

// Chuẩn hóa data cũ: cancelled → deletedAt
function _normalizeUngDeletedAt() {
  ungRecords = ungRecords.map(r => {
    if (r.cancelled === true && !r.deletedAt) {
      return { ...r, deletedAt: r.updatedAt || Date.now() };
    }
    return r;
  });
}
_normalizeUngDeletedAt(); // chạy tự động khi load file

// Chuẩn hóa projectId cho tiền ứng cũ
function _normalizeUngProjectIds() {
  ungRecords.forEach(r => {
    if (!r.projectId && r.congtrinh) {
      const pid = _getProjectIdByName(r.congtrinh);
      if (pid) r.projectId = pid;
    }
  });
}
_normalizeUngProjectIds(); // chạy tự động khi load file
```

### 6. Diễn giải
| Logic | Ý nghĩa |
|---|---|
| `deletedAt: now` | Đánh dấu thời điểm xóa (xóa mềm) |
| `deviceId: DEVICE_ID` | Ghi nhận thiết bị nào thực hiện xóa |
| `_normalizeUngDeletedAt` | Chuyển data cũ (`cancelled`) sang format mới |
| `_normalizeUngProjectIds` | Gắn `projectId` cho tiền ứng cũ chỉ có tên CT |
| `_refreshAllTabs()` | Cập nhật tất cả tab sau khi xóa |

### 7. Kết luận
Hiểu phần này giúp bạn:
- Biết xóa **không mất data** (xóa mềm)
- Hiểu tại sao data cũ vẫn hoạt động (tự chuẩn hóa)
- Biết cách sao lưu thủ công

### ⚠️ Lỗi thường gặp
| Lỗi | Nguyên nhân |
|---|---|
| Xóa rồi nhưng tổng tiền dashboard không đổi | Chưa gọi `_refreshAllTabs()` hoặc cache chưa clear |
| Data cũ hiện sai tên CT | `_normalizeUngProjectIds` không tìm được project (đã xóa?) |
| Bản ghi "ma" xuất hiện sau sync | Xóa mềm ở thiết bị A nhưng thiết bị B chưa sync |

### 🔗 Liên kết module
- **Xóa mềm pattern:** Giống `hoadon.js`, `chamcong.js`, `thietbi.js` — tất cả dùng `deletedAt`
- **Sync:** `sync.js` → merge dựa trên `updatedAt`, giữ bản mới nhất
- **Backup:** `core.js` → `_snapshotNow()`, `renderBackupList()`

---

# 📋 TỔNG KẾT TOÀN BỘ FILE `danhmuc.js`

## Sơ đồ tổng quan

```
danhmuc.js (988 dòng)
│
├── CT PAGE (dòng 1-69)
│   ├── renderCtPage()     — Hiển thị thẻ công trình + tổng chi phí
│   ├── showCtModal()      — Modal chi tiết khi nhấn vào thẻ
│   └── closeModal()       — Đóng modal
│
├── CHUẨN HÓA (dòng 71-148)
│   ├── normalizeName()    — Viết hoa đúng chuẩn
│   ├── normalizeKey()     — Bỏ dấu để so sánh trùng
│   ├── _isDmItemUsedInYear()  — Kiểm tra dùng trong năm
│   └── _isDmItemUsedAnytime() — Kiểm tra dùng bất kỳ năm
│
├── SETTINGS / DANH MỤC (dòng 150-519)
│   ├── renderSettings()   — Hiển thị trang danh mục
│   ├── renderItem/CNItem/CTItem/TbTenItem — Render từng mục
│   ├── addItem()          — Thêm mục mới
│   ├── finishEdit()       — Sửa tên + propagate
│   ├── delItem()          — Xóa mục (nếu chưa dùng)
│   ├── isItemInUse()      — Kiểm tra đang sử dụng
│   └── rebuildEntrySelects() — Cập nhật dropdown
│
├── TIỀN ỨNG - NHẬP (dòng 521-813)
│   ├── initUngTable()     — Khởi tạo bảng nhập
│   ├── addUngRow()        — Thêm 1 dòng nhập
│   ├── saveAllUngRows()   — Lưu tất cả dòng
│   ├── editUngRecord()    — Sửa bản ghi cũ
│   └── calcUngSummary()   — Tính tổng preview
│
├── TIỀN ỨNG - DANH SÁCH (dòng 815-971)
│   ├── buildUngFilters()  — Tạo bộ lọc
│   ├── filterAndRenderUng() — Lọc + hiển thị
│   ├── renderUngTable()   — Render 3 bảng (TP/NCC/CN)
│   ├── delUngRecord()     — Xóa mềm
│   └── exportUngAllCSV()  — Xuất CSV
│
└── SAO LƯU (dòng 974-988)
    ├── toolBackupNow()    — Backup thủ công
    └── toolRestoreBackup() — Mở danh sách backup
```

## Bảng tóm tắt dữ liệu

| Dữ liệu | Storage key | Nơi dùng |
|---|---|---|
| Tiền ứng | `ung_v1` | Form nhập, danh sách, dashboard |
| Danh mục | `cat_ct`, `cat_loai`, `cat_ncc`, `cat_nguoi`, `cat_tp`, `cat_cn`, `cat_tbteb` | Dropdown khắp app |
| Vai trò CN | `cat_cn_roles` | Chấm công, danh mục |
| Năm CT | `cat_ct_years` | Lọc theo năm |

## Tổng hợp lỗi thường gặp

| # | Lỗi | Phần | Cách xử lý |
|---|---|---|---|
| 1 | Sai số tiền tổng | CT Page | Kiểm tra hóa đơn có `thanhtien` hay chỉ `tien` |
| 2 | Gấp đôi dữ liệu | Danh mục | Không sửa trực tiếp data, luôn qua app |
| 3 | Sai filter | Tiền ứng | Kiểm tra năm + bộ lọc đang bật |
| 4 | Không xóa được | Danh mục | Mục đang dùng → xóa hóa đơn liên quan trước |
| 5 | Tên trùng | Chuẩn hóa | `normalizeKey` bỏ dấu trước khi so sánh |
| 6 | CT quyết toán → không ứng được | Tiền ứng | Đúng thiết kế, phải mở lại CT |
| 7 | Data cũ sai format | Chuẩn hóa | `_normalizeUngDeletedAt` tự sửa khi load |

## Sơ đồ liên kết module

```
core.js ──────► danhmuc.js ──────► Giao diện
  │ cats, CATS     │                  │
  │ save()         │ renderSettings   │ Tab Cài Đặt
  │ load()         │ renderCtPage     │ Tab Công Trình  
  │ saveCats()     │ filterAndRenderUng│ Tab Tiền Ứng
  │                │                  │
hoadon.js ────►    │    ◄──── projects.js
  getInvoicesCached│         resolveProjectName
  invoices         │         getProjectById
                   │
chamcong.js ──►    │    ◄──── doanhthu.js
  ccData           │         thuRecords
  cnRoles          │         hopDongData
                   │         thauPhuContracts
thietbi.js ───►    │
  tbData           │    ◄──── sync.js
                   │         đồng bộ cloud
                   │         merge ungRecords
```

> **Lưu ý quan trọng:** File `danhmuc.js` là **trung tâm quản lý danh mục** của toàn app. Mọi thay đổi danh mục ở đây đều ảnh hưởng tới dropdown/dữ liệu ở các module khác. Khi sửa tên → tất cả hóa đơn, tiền ứng, chấm công liên quan đều được cập nhật tự động.
