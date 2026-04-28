# GIẢI THÍCH FILE `thietbi.js`

## PHẦN 1: Khởi tạo dữ liệu và Chuẩn hóa (Migration)

### Mục đích
Phần này định nghĩa các dữ liệu nền tảng ban đầu (các loại tình trạng, danh sách tên thiết bị mặc định) và tự động "dọn dẹp", chuẩn hóa dữ liệu cũ ngay khi ứng dụng vừa được tải lên.
**Trong hệ thống sync:** Khi dữ liệu thiết bị từ nhiều máy (điện thoại/máy tính) khác nhau được đồng bộ về cùng một nơi, rất dễ xảy ra tình trạng lộn xộn (ví dụ: lỗi sai mã công trình, hoặc trùng lặp thiết bị). Phần code này đóng vai trò như một "người gác cổng" tự động kiểm tra, sửa lỗi mã và gộp các thiết bị bị trùng lại với nhau một cách an toàn mà không làm mất lịch sử đồng bộ.

### Giải thích dễ hiểu (Như cho người không biết code)
**Ví dụ đời thực:**
Tưởng tượng bạn và một người đồng nghiệp cùng quản lý kho. Mỗi người cầm một quyển sổ (tượng trưng cho 2 chiếc điện thoại). 
- Bạn ghi vào sổ: *"Thêm 2 cái Máy cắt bàn - Đang hoạt động ở Kho Tổng"*.
- Đồng nghiệp cũng ghi: *"Thêm 1 cái Máy cắt bàn - Đang hoạt động ở Kho Tổng"*.
Khi cuối ngày hai người ngồi lại ghép sổ với nhau (đồng bộ - sync), nếu không cẩn thận, danh sách sẽ hiện ra 2 dòng chữ "Máy cắt bàn" nằm rải rác rất rối mắt.
Đoạn code này giống như một "trợ lý thông minh". Nó tự động dò tìm trong sổ, hễ thấy có 2 dòng giống hệt nhau về **Tên máy + Tình trạng + Nơi để** thì nó sẽ tự động gộp lại thành 1 dòng duy nhất: *"3 cái Máy cắt bàn - Đang hoạt động ở Kho Tổng"*. Dòng dư thừa kia sẽ bị lấy bút gạch ngang (đánh dấu là đã xóa) chứ không xé bỏ trang giấy, để sau này còn đối chiếu.

**Ví dụ thực tế trong app:**
Khi bạn vừa mở app lên, app sẽ chạy ngầm đoạn code này. Nếu máy A và máy B do rớt mạng mà vô tình cùng tạo mới một thiết bị giống nhau, khi có mạng và đồng bộ lại, app sẽ tự nhận diện và cộng dồn số lượng thiết bị lại (ví dụ 1 + 1 = 2) thay vì hiển thị 2 dòng rác trên màn hình. Đồng thời, nó ép tất cả thiết bị ở "KHO TỔNG" phải dùng chung một mã hệ thống là `COMPANY` để không máy nào bị hiểu sai.

### Code chính
Dưới đây là trích đoạn quan trọng nhất trong phần khởi tạo và gộp dữ liệu (`migrateTbData`):

```javascript
// Định nghĩa tình trạng và lấy dữ liệu từ bộ nhớ máy
const TB_TINH_TRANG = ['Đang hoạt động', 'Cần bảo trì', 'Cần sửa chữa'];
let tbData = load('tb_v1', []); 

function migrateTbData() {
  const dedup = new Map();
  tbData.forEach(r => {
    if (r.deletedAt) return; // Bỏ qua nếu dòng này đã bị xóa

    // Tạo "chìa khóa" nhận diện: Công trình + Tên máy + Tình trạng
    const key = (r.projectId || r.ct || '') + '||' + (r.ten || '') + '||' + (r.tinhtrang || '');
    
    if (dedup.has(key)) { // Nếu thấy chìa khóa này đã tồn tại (nghĩa là bị trùng)
      const primary = dedup.get(key);
      
      // Cộng dồn số lượng của dòng bị trùng vào dòng gốc
      primary.soluong = (primary.soluong || 0) + (r.soluong || 0);
      
      // Đánh dấu xóa (ẩn đi) dòng dư thừa, cập nhật thời gian
      r.deletedAt = Date.now();
      r.updatedAt = Date.now();
      changed = true;
    } else {
      dedup.set(key, r); // Nếu chưa có thì lưu chìa khóa này lại để đối chiếu tiếp
    }
  });
}
```

### Diễn giải code
* **`const TB_TINH_TRANG`**: Danh sách cố định 3 tình trạng của thiết bị. Dùng để làm menu thả xuống cho người dùng chọn.
* **`load('tb_v1', [])`**: Tải toàn bộ dữ liệu thiết bị từ bộ nhớ trong (IndexedDB) của máy và gắn vào biến `tbData`.
* **`key = (r.projectId...) + '||' + ...`**: Đây là bước ghép chuỗi. Code lấy mã Công trình, ghép với Tên máy, ghép với Tình trạng để tạo ra một chuỗi "chìa khóa" duy nhất (Ví dụ: `COMPANY||Máy cắt bàn||Đang hoạt động`). Chỉ cần 2 thiết bị có chìa khóa giống y hệt nhau thì chắc chắn là chúng đang bị trùng lặp.
* **`primary.soluong = ... + r.soluong`**: Đây là thao tác **cộng dồn**. Lấy số lượng của máy gốc cộng thêm số lượng của máy bị trùng.
* **`r.deletedAt = Date.now()`**: Đây là khái niệm **Xóa mềm (Soft-delete)**. Thay vì xóa vĩnh viễn dòng dữ liệu trùng lặp (`delete`), hệ thống gắn cho nó một cái nhãn thời gian `deletedAt` (Bị xóa vào lúc...). Việc gắn nhãn này cực kỳ quan trọng, nó giúp hệ thống Sync biết rằng dòng này "đã chết" và sẽ ra lệnh cho các điện thoại khác cũng phải ẩn dòng này đi, tránh việc bị khôi phục lại do lỗi đồng bộ.

### Kết luận
Hiểu phần này sẽ giúp bạn tránh lỗi: **Trùng lặp dữ liệu thiết bị** và **Lỗi không đồng bộ được Kho Tổng**.
Nhờ cơ chế tạo `key` để gộp và dùng `deletedAt` để "xóa mềm", bạn có thể yên tâm rằng dù các thiết bị có tạo dữ liệu trùng nhau thì app vẫn tự dọn dẹp sạch sẽ thành 1 dòng đúng số lượng, và không bao giờ bị mất dữ liệu hay lỗi hiển thị rác.

---

## PHẦN 2: Quản lý danh mục Tên thiết bị và Giao diện chọn

### Mục đích
Phần này chịu trách nhiệm quản lý danh sách tên các thiết bị trong hệ thống (dùng làm các menu thả xuống - dropdown) để người dùng chọn thay vì phải tự gõ tay. Nó cũng có nhiệm vụ dọn dẹp (xóa) những tên thiết bị không còn sử dụng để menu không bị rác.
**Trong hệ thống sync:** Việc ép người dùng chọn từ một danh sách cố định thay vì tự gõ tay (ví dụ: máy A gõ "Máy cắt", máy B gõ "may cat") giúp dữ liệu khi đồng bộ về sẽ luôn đồng nhất, chính xác và có thể nhóm thống kê được.

### Giải thích dễ hiểu (Như cho người không biết code)
**Ví dụ đời thực:**
Việc này giống như tạo ra một tờ menu trong quán ăn. 
- Thay vì để khách hàng tự viết tên món ăn ra giấy (rất dễ viết sai lỗi chính tả, chữ xấu khó đọc), bạn in sẵn một tờ menu để khách chỉ việc "tích" chọn. 
- Hàm dọn dẹp (`pruneTbTen`) giống như người quản lý nhà hàng: Nếu cuối ngày kiểm tra lại thấy món "Máy khoan" đã bị hỏng hết không còn cái nào, người quản lý sẽ lấy bút bôi đen xóa món đó khỏi menu để ngày mai khách không gọi nhầm nữa.

**Ví dụ thực tế trong app:**
Khi bạn bấm nút "Xóa" chiếc "Máy uốn sắt" cuối cùng trong Kho Tổng, hệ thống nhận ra không còn bất kỳ chiếc "Máy uốn sắt" nào tồn tại trong app nữa. Lập tức, nó sẽ chạy đoạn code này để gỡ bỏ dòng chữ "Máy uốn sắt" ra khỏi danh sách menu thả xuống khi bạn thêm mới. Điều này giúp giao diện luôn sạch sẽ, gọn gàng.

### Code chính
Trích đoạn các hàm quản lý tên và danh mục chọn (`pruneTbTen`):

```javascript
// Lấy danh sách tên thiết bị hiện có (ưu tiên lấy từ danh mục chung)
function tbGetNames() {
  const catList = (cats && cats.tbTen && cats.tbTen.length) ? cats.tbTen : TB_TEN_MAY;
  return [...catList].sort((a,b) => a.localeCompare(b,'vi')); // Sắp xếp theo bảng chữ cái
}

// Xóa tên thiết bị khỏi danh sách chọn nếu không còn cái nào trong thực tế
function pruneTbTen() {
  // Tìm TẤT CẢ các tên thiết bị đang có trong app (những dòng chưa bị xóa)
  const usedTens = new Set(tbData.filter(r => !r.deletedAt).map(r => r.ten).filter(Boolean));
  const before = cats.tbTen.length;
  
  // Lọc lại menu: Chỉ giữ lại những tên nào CÒN đang được sử dụng
  cats.tbTen = cats.tbTen.filter(n => n && usedTens.has(n));
  
  // Nếu danh sách menu bị ngắn đi (có tên bị xóa), thì tiến hành lưu lại
  if (cats.tbTen.length < before) {
    saveCats('tbTen');
    tbRefreshNameDl();
  }
}
```

### Diễn giải code
* **`tbGetNames()`**: Hàm này cung cấp dữ liệu cho các menu thả xuống. Nó sẽ ưu tiên lấy danh sách tên từ `cats.tbTen` (danh mục do người dùng tự tạo). Nếu rỗng, nó lấy danh sách mặc định `TB_TEN_MAY`. Cuối cùng, nó dùng `localeCompare` để sắp xếp từ A-Z giúp dễ tìm kiếm.
* **`usedTens = new Set(...)`**: Hàm này đi lùng sục toàn bộ kho dữ liệu (`tbData`), loại bỏ những thiết bị đã bị xóa (`!r.deletedAt`), và nhặt ra tất cả các tên đang còn tồn tại gom vào một "chiếc rổ" (ví dụ: đang còn Máy cắt bàn, Máy uốn sắt).
* **`cats.tbTen.filter(n => usedTens.has(n))`**: Quét lại menu tổng. Chỉ những tên nào đang nằm trong "chiếc rổ" `usedTens` thì mới được giữ lại trong menu. Các tên "rác" sẽ bị vứt đi.
* **`saveCats('tbTen')`**: Lưu danh mục mới vào bộ nhớ. Ngay lập tức, hành động này sẽ kích hoạt cơ chế Sync, cập nhật danh sách menu mới trên tất cả các điện thoại/máy tính khác trong mạng lưới.

### Kết luận
Hiểu phần này sẽ giúp bạn hiểu cơ chế hoạt động của menu dropdown. 
Nhờ việc tự động dọn dẹp tên thừa (`pruneTbTen`), bạn sẽ tránh được lỗi: **Giao diện hiển thị quá nhiều tên thiết bị rác không tồn tại**, và **Tránh lỗi sai chính tả khi nhập liệu** (bảo vệ tính toàn vẹn của dữ liệu trên toàn hệ thống).

---

## PHẦN 3: Thêm mới và Lưu dữ liệu thiết bị

### Mục đích
Phần này làm nhiệm vụ thu thập thông tin khi bạn nhập liệu trên màn hình (như tên máy, số lượng, tình trạng, ghi chú) và lưu vào bộ nhớ của máy. 
**Trong hệ thống sync:** Điểm thông minh của phần này là nó biết tự động kiểm tra trùng lặp. Nếu bạn nhập một thiết bị đã có sẵn, nó sẽ tự động "cộng dồn" thay vì tạo ra một dòng mới. Đồng thời, nó bắt buộc phải tự động dán nhãn `deviceId` (mã của điện thoại đang dùng) và `updatedAt` (thời gian sửa) vào dữ liệu, để khi đồng bộ, hệ thống máy chủ biết được "Ai vừa sửa" và "Sửa lúc nào".

### Giải thích dễ hiểu (Như cho người không biết code)
**Ví dụ đời thực:**
Tưởng tượng bạn đang giữ một tờ hóa đơn trống gồm 5 dòng.
- Dòng 1 bạn ghi: *"Máy cắt bàn - Số lượng: 2 - KHO TỔNG"*
- Chút nữa quên mất, dòng 2 bạn lại ghi tiếp: *"Máy cắt bàn - Số lượng: 3 - KHO TỔNG"*
Thay vì đưa cả tờ hóa đơn lộn xộn cho sếp, phần code `tbSave()` giống như một người kế toán tỉ mỉ. Người kế toán này sẽ đọc qua hóa đơn, phát hiện ra sự trùng lặp và tự động gộp lại thành: *"Máy cắt bàn - Số lượng: 5"* rồi mới cất vào tủ hồ sơ. Hơn nữa, kế toán còn cẩn thận đóng dấu tên bạn và giờ giấc ghi chép lên hồ sơ đó.

**Ví dụ thực tế trong app:**
Bạn mở app, chọn công trình "KHO TỔNG", nhập số lượng thiết bị mới và bấm Lưu. Code sẽ quét xem trong KHO TỔNG hiện tại đã có cái máy đó chưa. 
- Nếu CHƯA CÓ: Nó tạo ra 1 thẻ thiết bị mới tinh (có gắn mã ID ngẫu nhiên không bao giờ trùng lặp).
- Nếu ĐÃ CÓ: Nó sẽ mở thẻ thiết bị cũ ra, lấy số lượng cũ cộng thêm số lượng bạn vừa nhập, ghi chú lại thời gian (`updatedAt`) và mã điện thoại của bạn (`deviceId`), sau đó cất lại thẻ vào kho.

### Code chính
Trích đoạn logic lưu trữ và cộng dồn trong hàm `tbSave()`:

```javascript
// Quá trình lưu từng dòng dữ liệu mà người dùng vừa nhập
rows.forEach(row => {
  // BƯỚC 1: Tìm xem thiết bị này đã tồn tại hay chưa (cùng Tên + Tình trạng + Công trình)
  const exist = tbData.find(rec => 
    !rec.deletedAt && rec.ten === row.ten && rec.tinhtrang === row.tinhtrang &&
    (savePid ? (rec.projectId === savePid) : rec.ct === ct)
  );

  if (exist) {
    // BƯỚC 2A: Nếu ĐÃ CÓ -> Tiến hành CỘNG DỒN
    exist.soluong = (exist.soluong || 0) + row.soluong; // Cộng dồn số lượng
    exist.ngay = ngay;
    exist.updatedAt = Date.now(); // Cập nhật thời gian sửa đổi (quan trọng cho Sync)
    exist.deviceId  = DEVICE_ID;  // Đóng dấu thiết bị nào vừa sửa (quan trọng cho Sync)
    if (row.ghichu) exist.ghichu = row.ghichu;
  } else {
    // BƯỚC 2B: Nếu CHƯA CÓ -> TẠO MỚI HOÀN TOÀN
    tbData.push({
       id: uuid(), // Tạo mã ID ngẫu nhiên độc nhất
       ct: ct, projectId: savePid, ...row, ngay,
       createdAt: Date.now(), updatedAt: Date.now(), deviceId: DEVICE_ID
    });
  }
});
save('tb_v1', tbData); // BƯỚC 3: Lưu toàn bộ vào bộ nhớ
```

### Diễn giải code
* **`tbData.find(...)`**: Lệnh này đi tìm kiếm xem trong kho dữ liệu hiện tại có dòng nào khớp hoàn toàn về Tên, Tình trạng và Nơi để (Công trình/Kho tổng) hay không. Đặc biệt là nó bỏ qua các dòng đã bị xóa (`!rec.deletedAt`).
* **`exist.soluong = ... + row.soluong`**: Đây chính là hành động "Kế toán cộng dồn" đã nói ở trên.
* **`updatedAt = Date.now()` và `deviceId = DEVICE_ID`**: Đây là 2 thông số **"bắt buộc phải có"** của hệ thống Đồng bộ. `Date.now()` cho biết thời điểm chính xác tính đến từng mili-giây, giúp hệ thống Sync biết bản ghi nào là mới nhất để ưu tiên chép đè. `DEVICE_ID` giúp hệ thống phân biệt được ai đang sửa.
* **`uuid()`**: Một hàm tự động đẻ ra một đoạn mã ngẫu nhiên (ví dụ: `123e4567-e89b-12d3...`). Bất kỳ khi nào tạo dữ liệu mới (chưa từng tồn tại), bắt buộc phải có `uuid` (đóng vai trò như Số CMND của thiết bị) để phân biệt nó với hàng triệu dữ liệu khác trong hệ thống.

### Kết luận
Hiểu phần này sẽ giúp bạn tránh lỗi: **Mất dữ liệu do đồng bộ sai phiên bản**.
Nhờ việc code tuân thủ nghiêm ngặt việc cập nhật `updatedAt` và `deviceId` mỗi khi có thay đổi (dù là tạo mới hay cộng dồn), hệ thống Sync sẽ luôn biết được đâu là thông tin mới nhất để tải về các máy khác. Ngoài ra, cơ chế tự động tìm và cộng dồn giúp dữ liệu hiển thị trên máy luôn cực kỳ gọn gàng.

---

## PHẦN 4: Hiển thị danh sách thiết bị và Chỉnh sửa nhanh

### Mục đích
Phần này chịu trách nhiệm hiển thị các thiết bị (đang nằm ở các công trình, không tính Kho Tổng) lên một bảng danh sách. Không chỉ để nhìn, bảng này còn cung cấp các tính năng để bạn "chỉnh sửa nhanh" tình trạng thiết bị hoặc "xóa" thiết bị (chỉ được xóa ở Kho Tổng).
**Trong hệ thống sync:** Khi bạn chỉnh sửa nhanh một thông tin trên bảng (ví dụ: đổi từ "Đang hoạt động" sang "Cần bảo trì"), ứng dụng không tạo ra bản ghi mới mà sẽ tìm đúng mã `id` duy nhất của thiết bị đó để sửa đè lên, đảm bảo không sinh ra dữ liệu rác khi đồng bộ.

### Giải thích dễ hiểu (Như cho người không biết code)
**Ví dụ đời thực:**
Bảng danh sách này giống như một chiếc "Bảng theo dõi vật tư" treo ở phòng bảo vệ công trường. Trên bảng ghi rõ máy cắt A đang ở đâu, tình trạng thế nào.
Nếu hôm nay máy cắt A bị hỏng, thay vì chạy về văn phòng lấy tờ giấy mới để viết báo cáo, bạn chỉ cần cầm bút lông, xóa chữ "Đang hoạt động" trên bảng và viết đè lên chữ "Cần bảo trì" (`tbUpdateField`).
Còn với nút "Xóa" (`tbDeleteRow`), hệ thống có một quy định chặt chẽ: Bạn không được quyền vứt bỏ (xóa) một cái máy khi nó đang nằm ở ngoài công trường. Bạn chỉ được phép xóa nó khi nó đã được thu hồi về KHO TỔNG. Và khi xóa, bạn cũng không ném nó vào sọt rác, mà chỉ gạch ngang tên nó để lưu lại bằng chứng đối soát sau này.

**Ví dụ thực tế trong app:**
Khi bạn mở danh sách Thiết bị ở một công trình, ở cột "Tình trạng", bạn bấm vào và đổi thành "Cần sửa chữa". Ngay lập tức, thẻ thiết bị đó trong bộ nhớ máy sẽ được cập nhật, hệ thống sẽ đánh dấu thời gian `updatedAt` mới nhất để khi có mạng, máy chủ biết là tình trạng máy này vừa bị thay đổi và báo cho các máy khác.

### Code chính
Trích đoạn 2 tính năng quan trọng: Cập nhật nhanh và Xóa thiết bị:

```javascript
// Tính năng 1: Cập nhật nhanh tình trạng thiết bị trực tiếp trên bảng
function tbUpdateField(id, field, val) {
  // Tìm đúng cái thẻ thiết bị có mã ID tương ứng
  const idx = tbData.findIndex(r => r.id === id);
  if (idx < 0) return; // Không tìm thấy thì dừng lại
  
  // Cập nhật tình trạng mới (ví dụ: 'Cần sửa chữa')
  tbData[idx][field] = val;
  
  // 2 dòng sống còn của hệ thống Sync:
  tbData[idx].updatedAt = Date.now(); // Cập nhật giờ sửa mới nhất
  tbData[idx].deviceId  = DEVICE_ID;  // Đóng dấu người vừa sửa
  
  save('tb_v1', tbData); // Lưu lại vào bộ nhớ
}

// Tính năng 2: Xóa thiết bị (chỉ dành cho Kho Tổng)
function tbDeleteRow(id) {
  const r = tbData.find(rec => rec.id === id);
  
  // LUẬT: Không được xóa thiết bị nếu nó đang ở công trình
  if (!isKhoTong(r)) { 
    toast('Không thể xóa thiết bị ở công trình!', 'error'); 
    return; 
  }
  
  // Xóa mềm: Không dùng lệnh `delete` mà gán deletedAt bằng thời gian hiện tại
  tbData = softDeleteRecord(tbData, id); 
  
  save('tb_v1', tbData); // Lưu lại
  pruneTbTen(); // Tiện thể dọn rác các menu tên trống (đã giải thích ở Phần 2)
}
```

### Diễn giải code
* **`r.id === id`**: Khi sửa hay xóa, code luôn luôn dùng `id` (mã định danh duy nhất) để tìm kiếm chứ không dùng Tên thiết bị. Vì Tên có thể trùng nhau (cùng là "Máy cắt bàn" nhưng có hàng chục cái), nhưng `id` thì mỗi cái là độc nhất. Điều này giúp sửa/xóa chính xác 100%.
* **`tbData[idx].updatedAt = Date.now()`**: Tương tự Phần 3, hễ có bất kỳ thay đổi nhỏ nào (đổi tình trạng) cũng phải cập nhật `updatedAt`. Nếu quên dòng này, khi đồng bộ, máy chủ sẽ tưởng dữ liệu này là dữ liệu cũ và sẽ lấy dữ liệu của máy khác đè lên, khiến bạn bị mất thao tác vừa chỉnh sửa.
* **`!isKhoTong(r)`**: Đây là hàng rào bảo vệ (logic nghiệp vụ). Nó khóa chức năng xóa ở các công trình để chống thất thoát vật tư. Nếu ai đó táy máy bấm xóa thiết bị ở công trình, app sẽ chặn lại và báo lỗi ngay.
* **`softDeleteRecord(...)`**: Hàm này thay vì "tiêu diệt" dữ liệu biến mất khỏi ổ cứng, nó sẽ gán thêm một thuộc tính `deletedAt = Date.now()`. Hệ thống đồng bộ (Sync) rất cần điều này, vì nó sẽ đọc được thông điệp "À, cái máy này đã bị xóa lúc 10h sáng", và nó sẽ ra lệnh cho tất cả các điện thoại khác trong mạng lưới cũng phải ẩn cái máy này đi.

### Kết luận
Hiểu phần này sẽ giúp bạn nhận ra tại sao app không cho xóa thiết bị ở công trình (để **tránh thất thoát vật tư trái phép**). 
Đồng thời, bạn cũng hiểu được tầm quan trọng của việc dùng `id` để định vị dữ liệu, và tại sao cơ chế "Xóa mềm" (`deletedAt`) lại là cứu cánh để các thiết bị điện thoại khi đồng bộ không bị hiểu nhầm là bị thiếu dữ liệu rồi tự động "hồi sinh" lại những thiết bị mà bạn đã xóa.

---

## PHẦN 5: Luân chuyển thiết bị và Bảng Kho Tổng / Thống kê

### Mục đích
Đây là "trái tim" của module Thiết bị, giải quyết bài toán phức tạp nhất: **Di chuyển thiết bị từ nơi này sang nơi khác và chia tách số lượng**. Nó giúp quản lý việc điều động vật tư từ Kho ra Công trình, hoặc giữa các Công trình với nhau một cách chặt chẽ.
Bên cạnh đó, phần này còn vẽ ra 2 bảng quan trọng: Bảng Kho Tổng (chỉ hiện thiết bị trong kho) và Bảng Thống kê (gom nhóm xem công trình nào đang cầm bao nhiêu máy).
**Trong hệ thống sync:** Khi luân chuyển (chia tách số lượng), hệ thống không được phép làm sai lệch tổng số. Nó giải quyết bằng quy trình 3 bước: Xóa thẻ cũ -> Tạo thẻ phần chuyển đi -> Tạo thẻ phần giữ lại. Việc này đảm bảo khi đồng bộ, máy chủ nhận được một phép toán cực kỳ chuẩn xác, không làm nhân đôi hay làm mất mát thiết bị.

### Giải thích dễ hiểu (Như cho người không biết code)
**Ví dụ đời thực:**
Trong Kho Tổng của bạn đang có "10 cái xẻng". Hôm nay bạn muốn điều "3 cái xẻng" ra Công trình Vinpearl.
Người thủ kho (app) sẽ không gạch xóa số 10 thành số 7 (vì như thế rất dễ mất dấu vết lịch sử). Thay vào đó, thủ kho sẽ làm đúng 3 bước nộp lên công ty:
1. Gạch bỏ tấm thẻ cũ *"10 xẻng ở Kho Tổng"* (cất vào tủ lưu trữ).
2. Viết một tấm thẻ mới: *"3 xẻng xuất đi Vinpearl"*.
3. Viết một tấm thẻ mới: *"7 xẻng còn lại ở Kho Tổng"*.
Tổng số xẻng vẫn là 10, nhưng lịch sử di chuyển cực kỳ rõ ràng và an toàn.

**Ví dụ thực tế trong app:**
Khi bạn bấm nút "Luân chuyển" và chuyển 2 máy khoan đi nơi khác. App sẽ:
1. Đánh dấu xóa (`soft-delete`) dòng chứa 10 máy khoan cũ.
2. Tìm ở Công trình đích xem có máy khoan nào chưa? Nếu có thì lấy số đó cộng thêm 2, nếu chưa thì tạo thẻ mới gồm 2 máy khoan.
3. Tạo lại một thẻ mới gồm 8 máy khoan giữ lại Kho Tổng.
Tất cả các thẻ mới này đều được gắn thời gian `updatedAt` mới nhất để máy chủ biết đây là hành động vừa xảy ra.

### Code chính
Trích đoạn quá trình 3 bước khi luân chuyển (`tbSaveEdit`):

```javascript
function tbSaveEdit(id) {
  // ... (Lấy thông tin thiết bị cũ, số lượng cần chuyển là newSL)
  const remaining = oldSL - newSL; // Tính số lượng còn lại

  // BƯỚC 1: Xóa mềm dòng gốc để giữ lịch sử (Không xóa cứng)
  tbData = softDeleteRecord(tbData, id);

  // BƯỚC 2: Xử lý số lượng CHUYỂN ĐI vào Công trình đích
  const destExist = tbData.find(...); // Tìm xem đích đến đã có máy này chưa
  if (destExist) {
    // Đã có -> Cộng dồn số lượng chuyển đi, cập nhật giờ, mã máy
    destExist.soluong = (destExist.soluong || 0) + newSL;
    destExist.updatedAt = Date.now();
    destExist.deviceId  = DEVICE_ID;
  } else {
    // Chưa có -> Tạo thẻ mới tinh cho công trình đích
    tbData.push({ id: uuid(), ct: newCT, soluong: newSL, updatedAt: Date.now() ... });
  }

  // BƯỚC 3: Xử lý số lượng CÒN LẠI ở nơi xuất phát
  if (remaining > 0) {
    const srcExist = tbData.find(...); // Tìm xem nơi xuất phát còn máy nào không
    if (srcExist) {
      srcExist.soluong = (srcExist.soluong || 0) + remaining;
      srcExist.updatedAt = Date.now();
    } else {
      // Tạo thẻ mới cho số lượng còn lại
      tbData.push({ id: uuid(), ct: srcCt, soluong: remaining, updatedAt: Date.now() ... });
    }
  }

  save('tb_v1', tbData); // Lưu toàn bộ 3 bước này vào thẻ nhớ
}
```

### Diễn giải code
* **`remaining = oldSL - newSL`**: Phép toán đơn giản tính số lượng giữ lại (Ví dụ: 10 - 3 = 7).
* **`softDeleteRecord(...)`**: Hành động gạch bỏ tấm thẻ "10 cái xẻng" cũ. Bắt buộc phải xóa mềm để hệ thống Sync biết là số 10 này không còn giá trị nữa, tránh việc máy tính khác vẫn tưởng kho còn 10 cái rồi lại mang đi chuyển tiếp (gây ra lỗi nhân bản vô tính thiết bị).
* **`destExist.soluong + newSL`**: Tự động cộng dồn số lượng chuyển đi vào công trình đích (nếu nó đã có sẵn máy giống vậy). Tính năng này rất hay, giúp công trình đích không bị hiện ra 2 dòng xẻng khác nhau.
* **`tbData.push({ ... uuid() ... })`**: Lệnh sinh ra một tấm thẻ thiết bị hoàn toàn mới (cấp mã `uuid` mới) cho phần luân chuyển, kèm theo `updatedAt` để phục vụ đồng bộ.

### Kết luận
Hiểu phần này bạn sẽ không còn sợ lỗi: **Mất thiết bị hoặc tự nhiên bị nhân đôi số lượng khi đồng bộ**.
Quy trình "1 hủy, 2 tạo" này là một quy trình cực kỳ chặt chẽ. Nó đảm bảo mọi thay đổi về số lượng đều được kiểm soát bằng những mã `ID` mới và thời gian `updatedAt` chuẩn xác, giúp các máy điện thoại luôn khớp số lượng tuyệt đối dù bạn đang thao tác lúc mất mạng hay có mạng.

---

## PHẦN 6: Giao tiếp với hệ thống Đồng bộ (Sync)

### Mục đích
Phần này không phải là một đoạn code cụ thể mới, mà là **bức tranh toàn cảnh** tóm tắt lại cách mà file `thietbi.js` (như một phân xưởng làm việc) "nói chuyện" và "giao hàng" cho file `sync.js` (người vận chuyển - shipper) để truyền dữ liệu đi khắp các điện thoại khác trong công ty mà không bị hỏng hóc hay thất lạc.

### Giải thích dễ hiểu (Như cho người không biết code)
**Ví dụ đời thực:**
Hãy tưởng tượng `thietbi.js` là một Xưởng sản xuất, còn `sync.js` là một anh Shipper. Xưởng thì liên tục làm ra rất nhiều món đồ: tạo mới thiết bị, cập nhật tình trạng hư hỏng, luân chuyển qua lại, v.v.
Nếu Xưởng cứ vứt hàng lộn xộn cho Shipper mang đi, chắc chắn đến nơi sẽ bị nhầm lẫn (cái nào mới làm, cái nào đồ cũ, cái nào của ai làm?). Để giải quyết bài toán này, Xưởng (`thietbi.js`) đã đặt ra **4 quy tắc đóng gói** cực kỳ nghiêm ngặt trước khi giao hàng cho Shipper (`sync.js`):

1. **Mã vạch độc nhất (`id`):** Dù là tạo mới hay luân chuyển (chia tách), mỗi thẻ thiết bị đều được gắn một mã vạch không bao giờ trùng lặp (`uuid`). Anh Shipper nhìn mã vạch là biết ngay gói hàng này đã từng luân chuyển chưa, hay là hàng mới tinh.
2. **Đóng dấu thời gian (`updatedAt`):** Bất cứ khi nào bạn sửa số lượng hay đổi tình trạng, Xưởng lập tức dán nhãn thời gian hiện tại lên gói hàng (tính đến từng mili-giây). Nhờ vậy, nếu 2 kỹ sư dùng 2 điện thoại cùng sửa tình trạng của 1 cái máy, anh Shipper (khi có mạng) chỉ cần nhìn tem thời gian: tem nào dán sau cùng (mới nhất) thì lấy cái đó đè lên cái cũ. Không bao giờ có chuyện dữ liệu cũ đè mất dữ liệu mới.
3. **Đóng dấu người làm (`deviceId`):** Trên gói hàng luôn ghi rõ mã số của chiếc điện thoại vừa thao tác. Nếu có sự cố trùng lặp xảy ra cùng một lúc, hệ thống sẽ biết phải ưu tiên cho ai hoặc dễ dàng truy vết ai là người vừa sửa.
4. **Không vứt rác bừa bãi (`deletedAt` - Xóa mềm):** Khi bạn bấm nút Xóa một thiết bị, Xưởng không đem vứt nó vào sọt rác. Thay vào đó, Xưởng lấy bút đỏ gạch chéo gói hàng và ghi `deletedAt`. Tại sao? Vì nếu vứt luôn, anh Shipper đến lấy hàng sẽ không thấy gói hàng đó đâu, anh ta lại tưởng Xưởng "bị mất" hàng nên sẽ tự động... lấy một gói hàng giống hệt trên mạng tải xuống (khôi phục dữ liệu đã xóa). Nhờ cái nhãn gạch chéo đỏ kia, anh Shipper mới hiểu: *"À, món này đã bị hủy, để mình báo cho các máy khác hủy theo"*.

### Kết luận tổng quát
File `thietbi.js` được thiết kế với logic cực kỳ chặt chẽ để dọn đường cho việc Đồng bộ (Sync) diễn ra mượt mà nhất. 
* Nhờ cơ chế **"Cộng dồn tự động"**, bảng quản lý thiết bị của bạn không bao giờ bị rác hay xuất hiện hàng chục dòng máy cắt giống hệt nhau.
* Nhờ cơ chế **"1 Hủy, 2 Tạo"** khi luân chuyển, tổng tài sản thiết bị của công ty không bao giờ bị thất thoát hay bị "đẻ" thêm một cách vô lý.
* Và nhờ việc luôn tuân thủ **4 quy tắc đóng gói** (`id`, `updatedAt`, `deviceId`, `deletedAt`), dù bạn có đang dùng app ở dưới hầm công trình không có mạng, rồi 3 ngày sau mới có 4G để đồng bộ, thì dữ liệu thiết bị của bạn vẫn sẽ được trộn vào hệ thống máy chủ của công ty một cách chính xác tuyệt đối, không trật đi đâu một cái máy nào!
