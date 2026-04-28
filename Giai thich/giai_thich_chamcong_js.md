# PHẦN 1: Khởi tạo dữ liệu và Cơ chế chống trùng lặp (Deduplication)

## Mục đích
Phần đầu tiên của file `chamcong.js` đóng vai trò là "người gác cổng" và "người làm sạch dữ liệu" khi ứng dụng vừa mới khởi động. Trong hệ thống đồng bộ (sync) giữa nhiều thiết bị, phần này đảm bảo rằng mỗi công trình trong một tuần chỉ có duy nhất **một** bảng chấm công, ngăn chặn tuyệt đối việc tạo ra các bản ghi rác hoặc trùng lặp dữ liệu trước khi bạn bắt đầu thao tác.

## Giải thích dễ hiểu
Hãy tưởng tượng bạn có 2 người quản lý công trình cầm 2 điện thoại khác nhau, lúc đó không có mạng internet (3G/Wifi), và cả hai đều lấy điện thoại ra chấm công cho thợ ở **cùng một công trình**, trong **cùng một tuần**.
Khi cả hai điện thoại có mạng và tự động đồng bộ lại với nhau, hệ thống sẽ nhận được 2 bảng chấm công khác nhau cho cùng một công trình ở cùng một tuần đó. Nếu không có "người gác cổng", số công và tiền lương của thợ sẽ bị cộng dồn lên gấp đôi! 
Phần code này giống như một "người quản lý cấp cao": nó sẽ nhìn vào 2 bảng chấm công đó, xem ai là người viết/chỉnh sửa **gần đây nhất**, sau đó chỉ giữ lại bảng mới nhất đó và loại bỏ bảng cũ đi.

## Ví dụ thực tế trong app của tôi
- **Tình huống:** Máy A và Máy B cùng mở app. Máy A chấm công cho "Công trình X" tuần 1 và bấm lưu. Máy B cũng chấm công cho "Công trình X" tuần 1, điền thêm ngày công cho một người thợ khác và bấm lưu sau máy A 5 phút.
- **Kết quả:** Khi đồng bộ xảy ra, phần code khởi tạo này sẽ dùng một chiếc chìa khóa gộp từ `Ngày bắt đầu tuần` + `Tên/Mã công trình` để phát hiện 2 bản này đang nói về cùng một thứ. Nó so sánh thời gian lưu (`updatedAt`) và quyết định giữ lại bản của Máy B (vì lưu sau 5 phút), giúp dữ liệu thống nhất và tổng tiền công thợ không bị nhân đôi lên một cách vô lý.

## Code chính
Dưới đây là đoạn trích xuất quan trọng nhất thực hiện nhiệm vụ trên (hàm `_dedupCC`):

```javascript
// Hard rule: 1 tuần + 1 công trình = 1 record duy nhất.
function _dedupCC(arr) {
  // ...
  records.forEach(r => {
    // Tạo chìa khóa nhận diện: Ngày bắt đầu tuần (fromDate) + Mã công trình (projectId)
    const key  = (r.fromDate || r.from || '') + '__' + (r.projectId || r.ct || '');
    const prev = byKey.get(key);
    
    // Nếu chưa có, đưa vào danh sách kiểm duyệt
    if (!prev) { byKey.set(key, r); return; }
    
    // Nếu đã có, so sánh thời gian cập nhật (updatedAt)
    const prevTs = safeTs(prev.updatedAt || prev.createdAt || 0);
    const rTs    = safeTs(r.updatedAt   || r.createdAt   || 0);
    
    // Giữ lại bản ghi có thời gian cập nhật mới nhất
    if (rTs > prevTs) {
      byKey.set(key, r);
    } else if (rTs === prevTs && r.deletedAt && !prev.deletedAt) {
      // Ưu tiên bản ghi đã bị "xóa" nếu thời gian bằng nhau chằn chặn
      byKey.set(key, r);
    }
  });
  return [...byKey.values()];
}
```

## Diễn giải code
Trong đoạn code trên và cấu trúc dữ liệu của file, có các khái niệm cực kỳ quan trọng đối với một app offline-first:

- **`key = fromDate + projectId` (Chìa khóa nhận diện):** Ứng dụng quy định ngặt nghèo rằng `1 tuần (fromDate)` và `1 công trình (projectId)` chỉ được phép tồn tại 1 bảng chấm công. Code sẽ ghép 2 thông tin này lại làm "chứng minh thư" duy nhất. Bất kỳ bản ghi nào khác có cùng "chứng minh thư" này đều được coi là một phiên bản cũ/mới của nhau.
- **`updatedAt` (Thời gian cập nhật):** Mỗi khi bạn bấm "Lưu", app sẽ gắn vào bản ghi thời điểm đó chính xác đến từng mili-giây. Code dùng cái này để phân xử xem ai là người sửa sau cùng. Bản nào có `updatedAt` lớn hơn (tức là xảy ra sau) sẽ "đè" lên bản cũ.
- **`deletedAt` (Thời gian xóa - Xóa mềm):** Khi bạn bấm xóa một bảng chấm công, app không thực sự xóa sạch nó ngay lập tức khỏi bộ nhớ. Nếu xóa sạch, máy khác (chưa cập nhật) sẽ không biết là nó đã bị xóa và sẽ lại đẩy bản cũ đó lên hệ thống. Thay vào đó, nó đóng dấu `deletedAt` (thời điểm xóa). Logic của code rất tinh tế: nếu 2 máy cùng thao tác một lúc (`rTs === prevTs`), nó sẽ ưu tiên bản có dấu `deletedAt` để đảm bảo ý định "xóa" của người dùng luôn được thực thi, ngăn ngừa "bóng ma" dữ liệu đã xóa tự nhiên hiện về.
- **`id` và `deviceId` (Dù không hiện rõ ở đoạn này):** Mỗi bảng chấm công tạo ra đều được cấp một mã `id` ngẫu nhiên vĩnh viễn không đụng hàng, và `deviceId` để hệ thống đồng bộ (`sync.js`) biết là thiết bị nào tạo ra nó. Nhưng ở cấp độ gom nhóm bảng chấm công này, app quan tâm tới `fromDate` và `projectId` hơn.

## Kết luận
Hiểu được phần Khởi tạo và Lọc trùng (Deduplication) này sẽ giúp bạn biết tại sao dữ liệu chấm công của thợ luôn gọn gàng, chuẩn xác. Nhờ nó, bạn **tránh được lỗi cực kỳ nghiêm trọng là nhân đôi, nhân ba tiền công thợ** khi có nhiều người dùng chung tài khoản để nhập liệu ở công trường thiếu sóng wifi. Nó cũng giải thích cho bạn biết tại sao khi xảy ra mâu thuẫn dữ liệu (2 máy cùng sửa 1 lúc), máy nào bấm "Lưu" chậm hơn một chút thì dữ liệu của máy đó sẽ chiến thắng.

---

# PHẦN 2: Tính toán tự động trên giao diện (Real-time Calculation)

## Mục đích
Phần này chịu trách nhiệm biến bảng chấm công trên màn hình của bạn thành một "file Excel thông minh". Khi bạn nhập bất kỳ số liệu nào (ngày công, lương, phụ cấp, bị trừ tiền), nó sẽ tính toán ngay lập tức kết quả tổng của từng người thợ và tổng của cả bảng mà không cần phải chờ bấm nút "Lưu".

## Giải thích dễ hiểu
Giống như khi đi siêu thị, nhân viên thu ngân quét mã vạch tới đâu, màn hình hiện tổng tiền cộng dồn tới đó. 
Ở đây, thay vì mã vạch, bạn gõ "1" vào Chủ Nhật, "0.5" vào Thứ 2 cho anh thợ Nguyễn Văn A. Màn hình sẽ lập tức nhảy số báo: Anh A được 1.5 công, nhân với 500 nghìn/ngày = 750 nghìn. Dòng tổng màu vàng dưới cùng của cả công trường cũng tự động tăng thêm 750 nghìn.

## Ví dụ thực tế trong app của tôi
- **Tình huống:** Gần cuối tuần, bạn muốn ứng tiền trước cho thợ. Bạn vào bảng chấm công gõ thêm tiền "Phụ cấp" 100k cho thợ B, rồi nhập "Trừ" 50k cho thợ C.
- **Kết quả:** Ngay khi tay bạn vừa rời khỏi bàn phím, dòng "Tổng cộng" của thợ B nhảy thêm 100k, thợ C tụt 50k. Bạn nhìn xuống dưới cùng màn hình là biết ngay tuần này cần rút két bao nhiêu tiền mặt để mang ra công trường phát, không cần phải nhẩm bằng đầu hay lấy máy tính bấm lại.

## Code chính
Có 2 hàm chính lo việc tính toán này: một hàm tính cho từng thợ (`calcCCRow`), và một hàm cộng dồn cả bảng (`updateCCSumRow`).

```javascript
// Tính tiền cho 1 người thợ (1 hàng ngang)
function calcCCRow(tr) {
  let tc = 0; // tc = Tổng công
  // Quét 7 ngày trong tuần, cộng dồn số công
  for(let i=0; i<7; i++) tc += parseFloat(tr.querySelector(`[data-cc="d${i}"]`)?.value||0) || 0;
  tc = round1(tc); // Làm tròn 1 chữ số thập phân (VD: 1.5)
  
  // Tính tổng lương = Tổng công * Lương ngày
  const luong = parseInt(tr.querySelector('[data-cc="luong"]')?.dataset?.raw||0) || 0;
  const total = tc * luong;
  
  // Cộng thêm phụ cấp, hóa đơn lẻ
  const phucap = parseInt(tr.querySelector('[data-cc="phucap"]')?.dataset?.raw||0) || 0;
  const hdml   = parseInt(tr.querySelector('[data-cc="hdml"]')?.dataset?.raw||0) || 0;
  const tongcong = total + phucap + hdml;
  
  // Hiển thị số tiền lên màn hình
  tr.querySelector('[data-cc="tongcong"]').textContent = numFmt(tongcong);
}

// Tính dòng tổng cộng dưới cùng (Hàng dọc)
function updateCCSumRow() {
  let tc = 0, totalLuong = 0, totalPC = 0, totalHD = 0, totalTru = 0, totalTC = 0;
  
  // Đi từng hàng của từng thợ để cộng dồn vào các biến tổng
  rows.forEach(tr => {
    // ... cộng dồn công, lương, phụ cấp ...
    totalLuong += t * l; 
    totalPC += pc; 
    totalTC += t * l + pc + hd;
  });
  
  // In ra dòng dưới cùng
  document.getElementById('cc-sum-tongcong').textContent = fmtM(totalTC);
}
```

## Diễn giải code
- **Lắng nghe sự kiện (Event Listeners):** Ở một đoạn code khác (`buildCCRow`), mỗi khi bạn gõ phím vào ô nhập liệu (`addEventListener('input')`), app sẽ lập tức gọi 2 hàm `calcCCRow` và `updateCCSumRow` ở trên. Đó là lý do mọi thứ giật số tức thời (real-time).
- **`round1(tc)`:** Hàm làm tròn tránh lỗi số học thập phân kỳ quặc của máy tính (VD: `0.1 + 0.2 = 0.30000000000000004`). Nếu không có nó, số công hiện ra có thể bị lẻ kỳ cục.
- **`dataset.raw`:** Khi bạn nhập số tiền (như 5,000,000), app sẽ hiển thị có dấu phẩy cho đẹp, nhưng đằng sau nó âm thầm lưu một chuỗi không dấu (`raw = 5000000`) để máy tính có thể làm phép nhân cộng được.
- **Trình tự:** Tính hàng ngang (từng thợ) trước $\rightarrow$ Lấy kết quả đó tính hàng dọc (tổng bảng) sau.

## Kết luận
Hiểu phần này giúp bạn yên tâm rằng **số tiền nhìn thấy trên màn hình luôn khớp 100% với số liệu bạn đã nhập**, không bao giờ có chuyện "sao thợ A làm 2 ngày rưỡi mà máy tính ra sai tiền". Nó loại bỏ rủi ro tính nhầm bằng tay, giúp bạn minh bạch tài chính tuyệt đối khi đối soát công nợ với thợ. Đồng thời, nếu sau này bạn muốn thêm cột "Tạm ứng" hay "Phạt", bạn chỉ cần biết nhét thêm biến đó vào hàm `calcCCRow` là xong.

---

# PHẦN 3: Thu thập dữ liệu và Lưu trữ an toàn (Lưu bảng chấm công)

## Mục đích
Hàm `saveCCWeek()` là trái tim của việc lưu trữ. Nó có nhiệm vụ gom toàn bộ những gì bạn đã nhập trên màn hình, kiểm tra các lỗi ngớ ngẩn (như chưa chọn công trình, nhập trùng tên 2 người thợ), và đóng gói cất vào "két sắt" (cơ sở dữ liệu cục bộ IndexedDB).

## Giải thích dễ hiểu
Hãy tưởng tượng bạn nộp sổ chấm công cho kế toán. Kế toán sẽ không cất ngay mà sẽ kiểm tra:
1. "Anh đã ghi tên công trình chưa?"
2. "Anh có vô tình ghi tên anh Nguyễn Văn A tận 2 dòng khác nhau không?"
Nếu tất cả đều chuẩn, kế toán sẽ mở két sắt ra. Nếu trong két đã có một cuốn sổ của đúng công trình đó, đúng tuần đó, kế toán sẽ xé cuốn sổ cũ đi, cất cuốn sổ mới của bạn vào, và ghi chú "Cập nhật lúc 5h chiều". 

## Ví dụ thực tế trong app của tôi
- **Tình huống:** Bạn lỡ tay gõ tên "Lê Văn B" ở dòng số 1 và lại gõ tiếp "Lê Văn B" ở dòng số 3, sau đó bấm "Lưu tuần này".
- **Kết quả:** App sẽ lập tức tô đỏ dòng số 3 và hiện thông báo lỗi: *"⚠️ Còn tên trùng nhau! Sửa trước khi lưu"*. Nó sẽ chặn đứng không cho lưu. Nếu không có bước chặn này, khi tính tổng kết tháng, Lê Văn B sẽ được nhận lương của cả 2 dòng cộng lại, gây thất thoát tiền mặt rất lớn!

## Code chính
Đoạn mã quan trọng nhất trong `saveCCWeek` chuyên xử lý việc ghi đè (Cập nhật) hoặc Tạo mới:

```javascript
// Bước 1: Kiểm tra xem có nhập trùng tên 2 thợ trong 1 bảng không
let dupFound = false;
document.querySelectorAll('[data-cc="name"]').forEach(el => {
  const n = el.value.trim().toLowerCase(); // Đổi ra chữ thường để so sánh (A = a)
  if(n && names.includes(n)){ dupFound = true; /* Đánh dấu đỏ */ }
  else if(n) names.push(n);
});
if(dupFound){ toast('⚠️ Còn tên trùng nhau!', 'error'); return; } // Chặn lưu

// Bước 2: Chìa khóa nhận diện (Tuần + Công trình)
const matchKey = w => {
  if(w.deletedAt) return false;
  if(w.fromDate !== fromDate) return false; // Trượt nếu sai tuần
  if(ctPid) return (w.projectId === ctPid || w.ctPid === ctPid); // Dựa vào mã công trình
  return w.ct === ct; 
};

// Bước 3: Tìm trong CSDL xem đã có bảng của tuần/công trình này chưa
const idx = ccData.findIndex(w => matchKey(w));

if(idx >= 0){
  // ĐÃ CÓ: Ghi đè dữ liệu mới, cập nhật thời gian (updatedAt)
  ccData[idx].workers = workers;
  ccData[idx].updatedAt = Date.now(); // Gắn mốc thời gian hiện tại
} else {
  // CHƯA CÓ: Tạo ra một bản ghi hoàn toàn mới
  ccData.unshift({
    id: crypto.randomUUID(), // Cấp mã định danh ngẫu nhiên (VD: 123e4567-...)
    updatedAt: Date.now(),
    fromDate, toDate, ct, ctPid, projectId: ctPid||null, 
    workers
  });
}

// Lưu vào CSDL
save('cc_v2', ccData);
```

## Diễn giải code
- **Chống trùng tên (dupFound):** Code dùng `.toLowerCase()` để đảm bảo "Nguyễn Văn A" và "nguyễn văn a" bị phát hiện là một người. Điều này rất quan trọng để việc gom nhóm tính tiền sau này không bị lỗi.
- **`matchKey`:** Tương tự logic phần 1, app phải xác định được "đây là bảng nào".
- **`Date.now()`:** Gắn mốc thời gian cụ thể (như 1713958300000). Khi máy của bạn đồng bộ dữ liệu với máy khác, con số này sẽ quyết định ai là người ghi đè ai.
- **`crypto.randomUUID()`:** Khi tạo mới, app cấp một chuỗi ID ngẫu nhiên không bao giờ đụng hàng trên toàn cầu. Điều này giúp hệ thống quản lý dữ liệu phía sau (hoặc server) nhận diện được chính xác bản ghi đó mà không sợ trùng với bản ghi do một máy điện thoại khác tạo ra cùng lúc.

## Kết luận
Hiểu phần này giúp bạn yên tâm rằng hệ thống cực kỳ chặt chẽ trong việc "đầu vào". Việc chặn trùng tên thợ cứu bạn khỏi những bàn thua trông thấy khi thanh toán lương. Việc gán `updatedAt` và ghi đè bằng `matchKey` đảm bảo cơ sở dữ liệu `ccData` không bao giờ bị phình to bởi những bảng lưu nháp lắt nhắt của cùng một tuần. Tóm lại: Lưu bao nhiêu lần cũng được, app chỉ giữ lại bản cuối cùng hoàn hảo nhất!

---

# PHẦN 4: Tổng hợp dữ liệu và Quản lý công nợ thợ (Tổng Lương Tuần/Tháng)

## Mục đích
Nếu phần 2 và phần 3 chuyên lo việc nhập liệu cho "Từng tuần", thì hàm `renderCCTLT()` (Tổng Lương Tuần) trong phần 4 này đóng vai trò là một "Kế toán trưởng". Nó lôi tất cả các bảng chấm công trong cơ sở dữ liệu ra, nhào nặn lại để cấp cho bạn một cái nhìn toàn cảnh: Thợ này tổng cộng làm bao nhiêu tiền, ứng bao nhiêu, và mình còn nợ họ bao nhiêu.

## Giải thích dễ hiểu
Giả sử thợ Nguyễn Văn A làm việc cho bạn nay ở công trình X, mai ở công trình Y. Anh ta cứ làm lắt nhắt mỗi tuần một ít, và thỉnh thoảng lại xin ứng 500k, 1 triệu để tiêu xài.
Đến cuối tháng thanh toán, bạn không thể ngồi giở từng sổ của từng tuần ra cộng lại được. Hàm này sẽ tự động đi gom tất cả dữ liệu có chữ "Nguyễn Văn A" ở mọi công trình, cộng dồn tổng tiền công, trừ đi tiền anh ta đã ứng, và chốt lại đúng một con số cuối cùng: "Còn nợ anh A 12.5 triệu".

## Ví dụ thực tế trong app của tôi
- **Tình huống:** Bạn mở tab "Tổng Lương", chọn lọc "Tất cả tuần".
- **Kết quả:** App sẽ hiện ra anh thợ B. Nó báo anh B làm tổng 15 công (gộp từ 3 công trình khác nhau), thành tiền 7.5 triệu. Nhưng vì hôm qua anh B đã xin ứng 2 triệu (ghi ở mục Tiền Ứng), cột "Nợ Còn" sẽ hiện màu đỏ báo: `-5,500,000 (dư)` — tức là quỹ của bạn đang nợ (dư) tiền của thợ này 5.5 triệu và cần phải trả.

## Code chính
Đây là đoạn code gom nhóm dữ liệu (gom theo tên thợ) và đoạn code tính bù trừ công nợ cực kỳ quan trọng:

```javascript
// 1. GOM NHÓM DỮ LIỆU TỪ NHIỀU TUẦN
ccData.forEach(w => {
  w.workers.forEach(wk => {
    const key = wk.name; // Dùng Tên Thợ làm cái rổ để gom
    
    // Nếu chưa có rổ cho người này, tạo một rổ mới
    if(!map[key]) map[key] = { d:[0,0,0,0,0,0,0], tc:0, tl:0, pc:0, hdml:0, tru:0, cts:[] };
    
    // Bỏ số công, tiền lương, phụ cấp của tuần này vào rổ
    map[key].tc += tc; // Tổng công
    map[key].tl += tc * (wk.luong||0); // Tổng lương
    map[key].pc += (wk.phucap||0); // Phụ cấp
    if(!map[key].cts.includes(ctDisplay)) map[key].cts.push(ctDisplay); // Ghi chú lại tên công trình
  });
});

// ... (Chuyển xuống đoạn in ra bảng giao diện) ...

// 2. TÍNH TOÁN BÙ TRỪ CÔNG NỢ (Tự động liên kết với module Tiền Ứng)
const tcLuong = r.tl + r.pc; // Tổng tiền làm ra
const thucLanh_ = r.tl + r.pc + r.hdml - r.tru; // Thực lãnh của tuần

// Lục tìm trong kho Tiền Ứng (ungRecords) xem thợ này đã ứng bao nhiêu
const tongUng_ = ungRecords.filter(u => !u.deletedAt && u.loai === 'congnhan' && u.tp === r.name)
                           .reduce((s, u) => s + (u.tien||0), 0);
                           
// Lục tìm tổng số tiền đã bị TRỪ trong các bảng chấm công
const tongTruAll_ = ccData.filter(w => !w.deletedAt).reduce(/*...*/);

// NỢ CÒN = Tiền đã ứng - Tiền bị trừ (Nếu âm là chủ nợ thợ, nếu dương là thợ nợ chủ)
const noCon_ = tongUng_ - tongTruAll_; 
const noConColor_ = noCon_ > 0 ? 'var(--red)' : noCon_ < 0 ? 'var(--green)' : 'var(--ink3)';
```

## Diễn giải code
- **`map[key]`:** Kỹ thuật này gọi là Grouping (Gom nhóm). Bằng cách dùng tên thợ (`wk.name`) làm chìa khóa (`key`), hệ thống biến hàng trăm bản ghi rời rạc thành danh sách rút gọn chỉ còn mỗi thợ 1 dòng duy nhất.
- **`cts.push(ctDisplay)`:** Máy cẩn thận lưu lại danh sách tên các công trình (`cts`) mà người thợ này đã tham gia để hiển thị ra cho bạn biết (VD: "Nhà A, Biệt thự B").
- **`ungRecords.filter(...)` (Giao tiếp liên module):** Đây là điểm đắt giá nhất! Mặc dù đang ở file chấm công, nhưng code chạy sang tận file lưu Tiền Ứng (`ungRecords`) để lôi dữ liệu của người thợ đó ra. Nhờ vậy, hai tính năng này kết nối chặt chẽ với nhau.
- **Logic `noCon_`:** Hệ thống định nghĩa Nợ = Tiền Ứng - Tiền Trừ. Nếu con số này mang dấu Âm (`< 0`), nghĩa là bạn chưa trả đủ lương cho thợ (thợ dư), app sẽ tô màu xanh hoặc đỏ tùy giao diện để nhắc nhở bạn thanh toán.

## Kết luận
Hiểu phần này giúp bạn thấy được sự lợi hại của một app quản lý tổng thể so với Excel thông thường. Mọi khoản "Tạm ứng" bạn ghi chú ở chỗ khác đều tự động "chạy" về đây để cấn trừ vào tiền công. Nó giúp bạn thanh toán lương cực kỳ tự tin, chính xác, không bao giờ lo phát dư tiền hay bị thợ thắc mắc "sao anh tính thiếu công cho tôi", vì mọi thứ đã được máy tính gom nhặt không trượt một cắc nào.

---

# PHẦN 5: Chốt sổ và Xuất Phiếu Lương (Export to Image/CSV)

## Mục đích
Phần cuối cùng của vòng đời chấm công là xuất kết quả ra ngoài. Hàm `xuatPhieuLuong()` và các hàm xuất CSV đóng vai trò như một "máy in bill ảo", giúp bạn tạo ra các bức ảnh Phiếu Lương hoặc file Excel gọn gàng để gửi cho thợ hoặc lưu trữ đối soát qua Zalo.

## Giải thích dễ hiểu
Giống như việc bạn ra cây ATM rút tiền, máy sẽ in cho bạn cái biên lai. Ở đây, thay vì in ra giấy, app ráp các số liệu công, lương, ứng, nợ của những người thợ mà bạn chọn vào một cái "biểu mẫu đẹp mắt" ẩn trong app. Sau đó, nó dùng một chiếc máy ảnh vô hình chụp phập một cái, biến biểu mẫu đó thành một file ảnh và lưu thẳng vào điện thoại của bạn.

## Ví dụ thực tế trong app của tôi
- **Tình huống:** Cuối tháng, bạn mở tab Tổng Lương, chọn (tick) vào 3 ông thợ A, B, C rồi bấm nút "Xuất phiếu lương".
- **Kết quả:** App lập tức tải xuống điện thoại một bức ảnh. Trong ảnh ghi rõ rành rành: Tuần này thanh toán cho Nguyễn Văn A 5 công (2.5tr), Trần Văn B 3 công (1.5tr), Lê Văn C nợ 500k... Tên file ảnh tự động được lưu là `Phieuluong_240426_NguyenVanA_5c_TranVanB_3c...png`. Bạn chỉ việc bốc ảnh này gửi vào nhóm Zalo của công trường. Thợ nhìn vào là im re, không cãi được câu nào.

## Code chính
Đoạn code "chụp ảnh" phiếu lương bằng thư viện `html2canvas` kết hợp xử lý tên file:

```javascript
// Bước 1: Nhặt những thợ đã được bạn đánh dấu tick trên màn hình
const rows = [];
document.querySelectorAll('.cc-tlt-chk:checked').forEach(chk => {
  const container = chk.closest('[data-name]');
  // Rút trích: Tên, Số công, Lương, Phụ cấp, Nợ...
  rows.push({ name: container.dataset.name, tc: container.dataset.tc, ... });
});

// Bước 2: Ráp số liệu vào cái Biểu mẫu HTML (template)
document.getElementById('pl-tbody').innerHTML = rows.map(r => `
  <tr>
    <td>${x(r.name)}</td>
    <td>${r.tc}</td>
    <td style="font-weight:700;color:#c8870a">${numFmt(r.tongCong)} đ</td>
  </tr>`).join('');

// Bước 3: Tạo tên file chuyên nghiệp (Xóa dấu tiếng Việt)
const _wParts = rows.map(r => removeVietnameseTones(r.name) + '_' + r.tc + 'c').join('_');
const fileName = 'Phieuluong_' + _datePart + '_' + _wParts; 
// Kết quả: Phieuluong_240426_Nguyen_Van_A_5c_Tran_Van_B_3c

// Bước 4: Chụp ảnh bằng html2canvas
const tpl = document.getElementById('phieu-luong-template');
tpl.style.display = 'block'; // Hiện biểu mẫu lên

html2canvas(tpl, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
  tpl.style.display = 'none'; // Chụp xong thì giấu đi
  
  // Ép điện thoại tải ảnh xuống
  const link = document.createElement('a');
  link.download = fileName + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
```

## Diễn giải code
- **`.cc-tlt-chk:checked`:** Code tận dụng luôn giao diện màn hình. Dòng nào bạn tick chọn (`:checked`) thì nó mới lôi vào phiếu lương. Rất tiện lợi cho việc phát lương lẻ tẻ từng tổ thợ.
- **`removeVietnameseTones()`:** Hàm này tự động biến "Nguyễn Văn A" thành "Nguyen_Van_A". Điều này là bắt buộc vì nếu để nguyên dấu tiếng Việt làm tên file, khi gửi qua Zalo hoặc copy sang máy tính khác, file dễ bị lỗi font hoặc bị hỏng không mở được.
- **`html2canvas(tpl)`:** Đây là thư viện cốt lõi. Nó vẽ lại toàn bộ các thẻ HTML/CSS của biểu mẫu thành một tấm ảnh (`canvas`). Thuộc tính `scale: 2` giúp ảnh nét gấp đôi bình thường, phóng to trên điện thoại không bị mờ.
- **`link.click()`:** Chiêu trò kinh điển trong lập trình Web/App cục bộ. Code giả vờ tạo ra một cái link tải ảnh, rồi tự động "bấm hộ" người dùng để bức ảnh nhảy thẳng vào thư viện ảnh của điện thoại.

## Kết luận
Phần này nâng tầm ứng dụng của bạn từ một "cuốn sổ tay điện tử" thành một "phần mềm kế toán chuyên nghiệp". Nó giúp bạn tối ưu khâu giao tiếp với thợ thuyền. Thợ nhận được ảnh phiếu lương rõ ràng, minh bạch, sẽ có cảm giác tin tưởng người chủ (cai thầu) hơn. Việc đặt tên file thông minh cũng giúp bạn dễ dàng tìm lại phiếu lương cũ trong bộ nhớ điện thoại khi cần đối chứng.

---

# PHẦN 6: Bức tranh toàn cảnh - Sự giao tiếp của `chamcong.js` trong hệ thống

## Mục đích
Phần này sẽ giúp bạn nhìn `chamcong.js` từ trên cao xuống. Module này không hoạt động cô lập mà là một "mắt xích" sống còn trong bộ máy của ứng dụng. Bất kỳ thay đổi nào trong file này cũng có thể ảnh hưởng đến các file khác, và ngược lại.

## Giải thích dễ hiểu
Hãy tưởng tượng ứng dụng của bạn là một công ty xây dựng:
- `core.js` là ông Tổng Giám Đốc (lo xây dựng nền móng, cấp phát kho lưu trữ).
- `sync.js` là bộ phận IT kiêm Vận chuyển (lo mang sổ sách từ máy bạn lên đám mây và tải của người khác về).
- `danhmuc.js` là phòng Nhân sự (quản lý danh sách thợ chuẩn).
- `chamcong.js` là phòng **Kế toán Tiền lương**.

Phòng Tiền lương không tự biên tự diễn. Họ phải xin danh sách thợ từ phòng Nhân sự để điền form, phải check xem thợ đã ứng bao nhiêu từ phòng Quỹ, sau khi chốt sổ thì phải nộp sổ cho bộ phận IT cất giữ, và cuối cùng báo cáo con số tổng chi phí lên cho Tổng Giám Đốc.

## Các luồng giao tiếp chính (Hệ sinh thái)

### 1. Nhận dữ liệu "Đầu vào" (Input)
- **Từ `danhmuc.js` (Biến `cats.congNhan` và `cnRoles`):**
  Khi bạn gõ chữ "Ng", `chamcong.js` liền chạy sang lấy danh sách tên thợ trong `cats.congNhan` để hiện gợi ý "Nguyễn Văn A". Nếu bạn gõ bậy một cái tên không có trong danh mục, nó sẽ lấy danh sách này ra đối chiếu và báo lỗi đỏ ngầu (Validate). Nó cũng lấy luôn vai trò (`cnRoles`) để tự động điền "Thợ chính" hay "Phụ".
- **Từ module Tiền Ứng (Biến `ungRecords`):**
  Như đã nói ở Phần 4, để tính được cột "Nợ Còn", nó phải đọc trực tiếp dữ liệu từ các phiếu ứng tiền của thợ.

### 2. Giao tiếp với "Bộ não lưu trữ" (Storage & Sync)
- **Giao cho `core.js` (Hàm `save()`):** 
  Khi bạn bấm lưu bảng chấm công, `chamcong.js` không tự ghi vào ổ cứng. Nó ném cục dữ liệu `ccData` cho hàm `save('cc_v2', ccData)` của `core.js`. Thằng `core.js` mới là người mở IndexedDB ra cất vào.
- **Tạo luật chơi cho `sync.js` (Đồng bộ):**
  `chamcong.js` bắt buộc phải gắn `id`, `updatedAt`, `deletedAt`, và dùng chìa khóa `fromDate + projectId` cho mỗi bảng. Nó làm thế để "dọn cỗ" cho `sync.js`. Khi có mạng, `sync.js` chỉ việc nhìn vào mấy cái tem thời gian đó để biết phải tải cái nào lên mạng, kéo cái nào về mà không sợ bị loạn.

### 3. Cung cấp dữ liệu "Đầu ra" (Output) cho báo cáo
- **Cho Dashboard (Tab Doanh thu / Tab Công trình):**
  Các file báo cáo như `datatools.js` hay `projects.js` (khi xem chi tiết công trình) sẽ móc thẳng vào mảng `ccData` do `chamcong.js` tạo ra. Nó lôi tổng tiền lương thợ của từng công trình ra cộng vào cột "Chi Phí". Nếu `chamcong.js` tính sai 1 đồng, báo cáo Lãi/Lỗ của cả công ty sẽ sai 1 đồng.
- **Cho Topbar (Thanh tổng tiền trên cùng):**
  Hàm `updateTopFromCC()` trong file này có nhiệm vụ chạy lên cái thẻ hiển thị tiền to đùng trên cùng màn hình, cộng tiền lương vào đó để bạn luôn thấy tổng dòng tiền đang chạy trong năm nay là bao nhiêu.

## Kết luận tổng kết
- `chamcong.js` là file cực kỳ nhạy cảm vì nó **chạm trực tiếp vào túi tiền**. 
- Nếu bạn có ý định sửa code (ví dụ đổi công thức tính lương, thêm tính năng chuyên cần), hãy nhớ rằng:
  1. Dữ liệu tạo ra **phải luôn có `updatedAt`** để hệ thống sync không bị mù.
  2. Việc sửa logic ở đây có thể ảnh hưởng đến **Dashboard** và **Chi tiết công trình**.
  3. Tuyệt đối **không thay đổi cấu trúc `fromDate` và `projectId`** vì nó là chìa khóa xương sống để hệ thống chống trùng lặp dữ liệu khi offline.

*Qua 6 phần này, bạn đã hoàn toàn nắm giữ được "linh hồn" của hệ thống quản lý công nợ thợ thuyền trong ứng dụng của mình!*
