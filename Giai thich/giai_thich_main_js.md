# 📋 GIẢI THÍCH FILE `main.js` — Trái Tim Khởi Động & Phân Quyền Ứng Dụng

> **Tổng quan**: File `main.js` dài khoảng 1109 dòng, là **"bộ não điều hành"** tải cuối cùng (Load order: 7). Nó chịu trách nhiệm khởi động app, điều hướng các trang, lọc dữ liệu theo năm, và quan trọng nhất là **quản lý hệ thống tài khoản (Đăng nhập / Phân quyền)**.
>
> Tài liệu chia thành **7 phần**:
> - PHẦN 1: Quản lý Bộ lọc Năm & Định danh Thiết bị
> - PHẦN 2: Hệ thống Tài khoản & Đồng bộ Người dùng (Sync Users)
> - PHẦN 3: Đăng nhập, Đăng xuất & Phiên hoạt động (Session)
> - PHẦN 4: Quản lý Quyền hạn (Phân quyền Kế toán / Giám đốc)
> - PHẦN 5: Điều hướng & Làm mới Giao diện (Navigation & Render)
> - PHẦN 6: Vòng đời Khởi động Ứng dụng (App Init)
> - PHẦN 7: Liên kết với phần còn lại của hệ thống

---

## PHẦN 1: QUẢN LÝ BỘ LỌC NĂM & ĐỊNH DANH THIẾT BỊ

*(Dòng 1 – 42 trong file)*

---

### 🎯 Mục đích

Phần này làm 2 nhiệm vụ nhỏ nhưng cực kỳ quan trọng làm nền tảng cho toàn bộ App:
1. **Bộ lọc Năm (`activeYears`)**: Xác định xem App đang hiển thị dữ liệu của năm nào (2024, 2025 hay Tất cả). 
2. **Định danh Thiết bị (`getDeviceId`)**: Cấp cho mỗi cái điện thoại/máy tính một "Số CMND" duy nhất để hệ thống Đồng bộ (Sync) biết máy nào vừa tạo/sửa dữ liệu.

---

### 📖 Giải thích dễ hiểu

#### 1️⃣ Bộ lọc Năm (Year Filter) — "Ngăn kéo hồ sơ"

**Vấn đề thực tế**: Khi app dùng được 3-4 năm, dữ liệu sẽ lên tới chục ngàn dòng. Nếu mở app ra tải toàn bộ 4 năm thì máy sẽ cực kỳ giật lag.
**Giải pháp**: App sẽ cất dữ liệu vào các "ngăn kéo" theo năm. Biến `activeYears` lưu danh sách các năm bạn đang muốn xem. Mặc định khi mới mở app, nó sẽ kéo ngăn chứa năm hiện tại (ví dụ: 2025) ra cho bạn xem.

**Ví dụ thực tế**: 
- Bạn chọn xem năm 2025 -> `activeYears = {2025}` -> App chỉ tải và tính toán hóa đơn năm 2025.
- Bạn chọn "Tất cả" -> `activeYears` rỗng (bằng 0) -> App tải hết toàn bộ hóa đơn từ trước đến nay.

```javascript
// Biến lưu các năm đang chọn (mặc định là năm hiện tại)
let activeYears = new Set([new Date().getFullYear()]);

// Hàm cũ dùng cho các đoạn code chưa kịp nâng cấp (backward compat)
let activeYear = new Date().getFullYear();

// Đồng bộ biến cũ và biến mới
function _syncActiveYearCompat() {
  if (activeYears.size === 0)      activeYear = 0; // 0 nghĩa là Tất cả
  else if (activeYears.size === 1) activeYear = [...activeYears][0];
  else                             activeYear = 0; // Xem nhiều năm -> gộp thành "Tất cả" cho code cũ
}
```

#### 2️⃣ Định danh Thiết bị — "Biển số xe của điện thoại"

**Vấn đề thực tế**: Hai người (A và B) cùng đăng nhập chung 1 tài khoản Kế toán trên 2 điện thoại khác nhau. Làm sao hệ thống biết máy nào vừa sửa hóa đơn để báo cáo?

**Giải pháp**: Ngay lần đầu tiên mở app, hàm `getDeviceId()` sẽ tạo ra một dải mã ngẫu nhiên (ví dụ: `abcd-1234`) và lưu chết vào bộ nhớ trình duyệt của máy đó (`localStorage`). Dù bạn có đăng xuất ra vào lại, cái điện thoại đó vẫn giữ nguyên "biển số" này.

```javascript
function getDeviceId() {
  // Tìm biển số xe cũ trong túi (localStorage)
  let id = localStorage.getItem('device_id');
  
  // Nếu chưa có (máy mới cài app lần đầu)
  if (!id) {
    id = crypto.randomUUID(); // Bấm nút tạo 1 dải số ngẫu nhiên không bao giờ trùng
    localStorage.setItem('device_id', id); // Nhét lại vào túi
  }
  return id;
}
```

---

### 📌 Khái niệm quan trọng: `deviceId`

Trong cơ chế Đồng bộ (Sync) của app bạn, biến `deviceId` đi khắp mọi nơi. 
Khi bạn tạo 1 hóa đơn, hóa đơn đó sẽ được gắn kèm `deviceId` của máy bạn. Điều này giúp:
- Chống "Gội đầu ngược": Khi máy bạn đẩy hóa đơn lên Đám mây, Đám mây đẩy dữ liệu mới về. Máy bạn thấy hóa đơn có `deviceId` trùng với máy mình -> "À, cái này mình vừa tạo xong, không cần tải về lại nữa".
- Quản lý phiên đăng nhập: Biết được có bao nhiêu cái điện thoại đang đăng nhập tài khoản "Giám đốc" cùng một lúc.

---

### ✅ Kết luận

Hiểu phần này sẽ giúp bạn tránh các lỗi:
- **Lag máy vì dữ liệu quá lớn**: Luôn nhớ `activeYears` giúp giới hạn dữ liệu. Nếu thấy app tự nhiên chậm, có thể ai đó đang chọn xem "Tất cả các năm".
- **Lỗi đồng bộ (Sync Loop)**: Nếu `deviceId` không được tạo đúng hoặc bị xóa liên tục (do dùng tab Ẩn danh), app sẽ bị kẹt trong vòng lặp: Đẩy dữ liệu lên -> Không nhận ra dữ liệu của mình -> Tải ngược dữ liệu về -> Lại đẩy lên.

---

<br><br>

## PHẦN 2: HỆ THỐNG TÀI KHOẢN & ĐỒNG BỘ NGƯỜI DÙNG (SYNC USERS)

*(Dòng 44 – 154 trong file)*

---

### 🎯 Mục đích

Phần này dùng để quản lý **Danh sách người dùng** (Admin, Giám đốc, Kế toán) và mật khẩu của họ. 

Điểm đặc biệt nhất: Nó **đồng bộ danh sách tài khoản** giữa nhiều thiết bị giống hệt như cách nó đồng bộ Hóa đơn hay Chấm công.

**Tại sao phải đồng bộ tài khoản?**
Nếu bạn là Giám đốc và bạn đổi mật khẩu trên điện thoại của mình, làm sao cái máy tính ở công ty biết bạn đã đổi mật khẩu để bắt bạn đăng nhập lại? Chính là nhờ cơ chế đồng bộ (Sync) danh sách `users_v1` này.

---

### 📖 Giải thích dễ hiểu

#### 1️⃣ Khởi tạo tài khoản mặc định — "Gieo mầm"

**Vấn đề:** Khi cài app lần đầu tiên, lấy đâu ra tài khoản để đăng nhập?
**Giải pháp:** Hàm `ensureDefaultUsers()` sẽ tự động kiểm tra. Nếu Két sắt chưa có ai, nó tự động "đẻ" ra 3 tài khoản mặc định với mật khẩu là `123`.

```javascript
function ensureDefaultUsers() {
  let users = loadUsers(); // Kéo danh sách từ trong máy ra
  
  if (!users || users.length === 0) { // Ôi trống trơn!
    // Tạo ngay 3 tài khoản mẫu
    users = normalizeUsersArray([
      { username: 'admin', password: '123', role: 'admin', updatedAt: now... },
      { username: 'giamdoc', password: '123', role: 'giamdoc', updatedAt: now... },
      { username: 'ketoan', password: '123', role: 'ketoan', updatedAt: now... }
    ]);
    saveUsers(users); // Cất lại vào máy
  }
}
```

---

#### 2️⃣ Giải quyết xung đột tài khoản — "Ai cập nhật sau, người đó thắng"

**Vấn đề thực tế (Xung đột):** 
- Lúc 8h00, Kế toán trưởng dùng Điện thoại đổi tên thành "ketoan1".
- Cùng lúc 8h00, Kế toán phó dùng Máy tính đổi mật khẩu của tài khoản đó thành "456".
- Vậy rốt cuộc trên mạng Đám mây sẽ lưu bản nào?

**Giải pháp (Hàm `mergeUsers` & `normalizeUsersArray`):**
Hệ thống sử dụng luật **"Last Write Wins" (Ghi đè bằng thời gian mới nhất)** thông qua biến `updatedAt`. 

1. Máy tính so sánh `updatedAt` của bản trên Điện thoại và bản trên Máy tính.
2. Bản nào có thời gian (`updatedAt`) trễ hơn (mới hơn) sẽ được chọn làm bản chính.

```javascript
// Trích đoạn hàm mergeUsers (Gộp người dùng từ mây về máy)
const localTs = Number(localUser.updatedAt) || 0; // Thời gian sửa ở máy mình
const cloudTs = Number(cloudUser.updatedAt) || 0; // Thời gian sửa trên mây

// Đứa nào mới hơn (thời gian lớn hơn) thì thắng (newer)
const newer = cloudTs > localTs ? cloudUser : localUser;
const older = newer === cloudUser ? localUser : cloudUser;

byId.set(cloudUser.id, {
  ...older,
  ...newer, // Lấy dữ liệu của thằng thắng đè lên thằng thua
  updatedAt: Math.max(localTs, cloudTs), // Cập nhật lại thời gian chót
});
```

---

#### 3️⃣ Cấu trúc của một Tài khoản — "Hồ sơ cá nhân"

Hàm `normalizeUserRecord` đảm bảo rằng bất cứ ai được tạo ra đều phải có đủ các thông tin cốt lõi sau:

- **`id`**: Chuỗi ngẫu nhiên (ví dụ `u_1234abcd`). Kể cả khi bạn đổi tên đăng nhập từ `ketoan` thành `ketoan_vip`, hệ thống vẫn biết đó là bạn nhờ cái `id` này.
- **`username` / `password` / `role`**: Tên, mật khẩu và Vai trò (Giám đốc hay Kế toán).
- **`updatedAt`**: Thời gian lần cuối cùng có người sửa tài khoản này. (Yếu tố quyết định sống còn để đồng bộ).
- **`sessionVersion`**: "Phiên bản của Mật khẩu". Mỗi lần đổi mật khẩu, số này tăng lên 1 (ví dụ từ 1 lên 2). Cực kỳ quan trọng để đá văng các thiết bị cũ.
- **`sessions`**: Cuốn sổ ghi lại *Danh sách các thiết bị* (nhớ cái `deviceId` ở Phần 1 không?) đang đăng nhập bằng nick này. 

---

### ✅ Kết luận

Hiểu Phần 2 sẽ giúp bạn không còn bỡ ngỡ với các tình huống:
- **Tại sao tự nhiên có 3 tài khoản lúc mới cài app?** (Do hàm `ensureDefaultUsers` tự sinh).
- **2 người cùng sửa 1 tài khoản thì sao?** (Biến `updatedAt` phân xử, người bấm nút "Lưu" trễ hơn vài mili-giây sẽ thắng).
- **Tránh mất tài khoản:** Đừng bao giờ đụng vào biến `id` của user. Tên và mật khẩu đổi thoải mái, nhưng `id` là thứ duy nhất gắn liền với các dữ liệu mà người đó tạo ra.

---

<br><br>

## PHẦN 3: ĐĂNG NHẬP, ĐĂNG XUẤT & PHIÊN HOẠT ĐỘNG (SESSION)

*(Dòng 163 – 420 trong file)*

---

### 🎯 Mục đích

Phần này đóng vai trò là **"Người gác cổng"** và **"Hệ thống an ninh"**. Nó kiểm soát:
1. Bạn là ai (Đăng nhập).
2. Bạn có còn quyền ở lại trong app không (Kiểm tra phiên hoạt động).
3. Khi nào thì mời bạn ra ngoài (Đăng xuất hoặc bị "Đá văng").

---

### 📖 Giải thích dễ hiểu

#### 1️⃣ Nhịp tim của ứng dụng (Heartbeat) — "Đèn báo hiệu"

**Vấn đề thực tế**: Làm sao Giám đốc biết Kế toán có đang mở app làm việc không, hay là đã tắt máy đi ngủ nhưng vẫn để nick treo đó?

**Giải pháp**: Hàm `_startSessionHeartbeat()` hoạt động như một cái **đèn báo hiệu**. Cứ mỗi 1 phút (60 giây), app sẽ tự động gửi một tín hiệu "nháy đèn" (cập nhật biến `lastActive`) lên hệ thống.
- Đèn còn nháy -> Người dùng còn đang mở app.
- Đèn tắt quá lâu -> Người dùng đã thoát hoặc mất kết nối.

```javascript
function _startSessionHeartbeat() {
  // Cứ mỗi 60 giây lại chạy hàm tick một lần
  _userHeartbeatTimer = setInterval(() => {
    const session = getCurrentUser();
    if (!session) return;
    
    // Cập nhật thời gian hoạt động cuối cùng (lastActive)
    users[idx].sessions = _touchUserSession(users[idx], true);
    saveUsers(users); // Lưu lại để các máy khác biết mình còn online
  }, 60 * 1000);
}
```

---

#### 2️⃣ Cơ chế "Đá văng" (Force Logout) — "Đổi chìa khóa nhà"

**Vấn đề thực tế**: Bạn nghi ngờ mật khẩu bị lộ, bạn dùng điện thoại đổi mật khẩu mới. Nhưng cái máy tính của kẻ trộm đang mở sẵn app thì sao? Nó có tự thoát ra không?

**Giải pháp**: Sử dụng biến **`sessionVersion`** (Số phiên bản mật khẩu).
1. Khi bạn đổi mật khẩu, `sessionVersion` tăng từ 1 lên 2.
2. Cái máy tính của kẻ trộm vẫn đang giữ cái "vé" ghi `sessionVersion = 1`.
3. Hàm `validateCurrentSession()` liên tục kiểm tra: "Vé của mày là phiên bản 1, nhưng chủ nhà đã đổi sang phiên bản 2 rồi!".
4. Ngay lập tức, hàm `forceLogout()` sẽ kích hoạt và đá kẻ trộm ra màn hình đăng nhập.

```javascript
function validateCurrentSession() {
  const session = getCurrentUser(); // Lấy vé đang cầm trên tay
  const user = loadUsers().find(...); // Xem hồ sơ gốc trên hệ thống
  
  // So sánh phiên bản trên vé và phiên bản trong hồ sơ
  if (user.sessionVersion !== session.sessionVersion) {
    forceLogout('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    return null;
  }
}
```

---

#### 3️⃣ Đăng nhập (Login) — "Cấp thẻ vào cổng"

Khi bạn gõ đúng tên và mật khẩu, hàm `login()` sẽ thực hiện 3 việc:
1. Ghi tên bạn vào danh sách "Đang hoạt động" của thiết bị này.
2. Phát cho bạn một cái "Thẻ vào cổng" (lưu vào `localStorage`).
3. Tự động tải lại trang (`location.reload()`) để làm mới toàn bộ dữ liệu theo quyền của bạn.

---

### 📌 Khái niệm quan trọng: `sessionVersion` & `lastActive`

- **`sessionVersion`**: Giống như số lần đổi chìa khóa. Mỗi máy khách phải giữ đúng số này mới được vào.
- **`lastActive`**: Ghi lại chính xác đến từng phút lần cuối bạn chạm vào app. Nó giúp hệ thống biết thiết bị nào đang "treo máy" để dọn dẹp bộ nhớ.

---

### ✅ Kết luận

Hiểu Phần 3 sẽ giúp bạn giải quyết các lỗi:
- **"Tại sao tôi đổi mật khẩu rồi mà máy kia vẫn vào được?"**: Hãy kiểm tra xem hàm `saveUsers` có được gọi để tăng `sessionVersion` chưa.
- **"App cứ bắt đăng nhập lại liên tục"**: Có thể thời gian trên điện thoại và máy tính bị lệch nhau quá nhiều, khiến hàm kiểm tra phiên bị nhầm lẫn.
- **An toàn bảo mật**: Bạn có thể yên tâm rằng chỉ cần bấm "Đổi mật khẩu", tất cả các thiết bị khác đang dùng nick của bạn sẽ bị văng ra ngay lập tức.

---

<br><br>

## PHẦN 4: QUẢN LÝ QUYỀN HẠN (PHÂN QUYỀN KẾ TOÁN / GIÁM ĐỐC)

*(Dòng 535 – 620 trong file)*

---

### 🎯 Mục đích

Đây là phần **"Phân vai"** trong ứng dụng. Nó đảm bảo:
1. **Kế toán**: Được nhập liệu thoải mái nhưng KHÔNG được xem các báo cáo nhạy cảm (như Lợi nhuận, Doanh thu tổng).
2. **Giám đốc**: Được xem toàn bộ báo cáo, biểu đồ nhưng KHÔNG được sửa hay xóa bất cứ thứ gì (để tránh lỡ tay làm sai lệch sổ sách).
3. **Admin**: Có toàn quyền "sinh sát".

---

### 📖 Giải thích dễ hiểu

#### 1️⃣ Chiếc khóa vạn năng (`_setRoleDisabled`) — "Đóng băng nút bấm"

**Vấn đề thực tế**: Làm sao để Giám đốc vào app vẫn nhìn thấy nút "Xóa" nhưng lại không bấm được? 

**Giải pháp**: Hàm `_setRoleDisabled()` giống như một lọ keo dán. Nếu bạn là Giám đốc (`isGiamdoc()`), app sẽ quét toàn bộ các ô nhập liệu, nút Lưu, nút Xóa và "dán keo" chúng lại (`disabled = true`). Bạn vẫn thấy chúng, nhưng chúng bị xám xịt và không có tác dụng.

```javascript
function _setRoleDisabled(selector, disabled) {
  // Tìm tất cả các thành phần theo tên (ví dụ: tất cả nút bấm)
  document.querySelectorAll(selector).forEach(el => {
    if (disabled) {
      el.disabled = true;    // Khóa nút
      el.readOnly = true;    // Không cho gõ chữ
      el.dataset.roleLocked = '1'; // Đánh dấu: "Bị khóa do phân quyền"
    }
  });
}
```

---

#### 2️⃣ Kính lọc Menu (`applyNavPermissions`) — "Ẩn/Hiện bí mật"

**Vấn đề thực tế**: Bạn không muốn nhân viên kế toán tò mò bấm vào mục "Doanh thu" để xem công ty lãi bao nhiêu.

**Giải pháp**: Hàm `applyRoleUI()` sẽ kiểm tra vai trò của bạn ngay khi vừa đăng nhập. Nếu bạn là Kế toán, nó sẽ dùng "phép tàng hình" để ẩn toàn bộ các nút menu dẫn đến trang Dashboard hoặc Doanh thu.

```javascript
if (role === 'ketoan') {
  if (['dashboard', 'doanhthu'].includes(page)) {
    visible = false; // Kế toán thì không cho thấy 2 mục này
  }
}
```

---

#### 3️⃣ Người giám sát tận tụy (`startRoleObserver`) — "Canh gác 24/7"

**Vấn đề thực tế**: App của bạn rất hiện đại, dữ liệu mới được tải về liên tục. Nếu một cái hóa đơn mới vừa hiện ra trên màn hình, làm sao app kịp "khóa" nó lại trước khi sếp kịp bấm xóa?

**Giải pháp**: `MutationObserver` giống như một **camera giám sát**. Nó liên tục nhìn vào màn hình. Chỉ cần có bất kỳ thay đổi nào (thêm dòng mới, hiện bảng mới), nó lập tức gọi hàm `applyRoleUI()` để kiểm tra và khóa ngay lập tức nếu cần. Sếp sẽ không bao giờ có cơ hội bấm vào một nút "chưa kịp khóa".

---

### 📌 Khái niệm quan trọng: `roleLocked`

- **`roleLocked`**: Đây là một cái nhãn dán tạm thời. Nó giúp app phân biệt được: "Nút này bị khóa vì sếp không có quyền sửa" khác với "Nút này bị khóa vì mạng lỗi". Khi bạn đăng xuất và vào lại bằng nick Admin, nhãn này sẽ giúp app biết đường mà "mở khóa" lại cho bạn.

---

### ✅ Kết luận

Hiểu Phần 4 sẽ giúp bạn giải quyết các lỗi:
- **"Tại sao tôi là sếp mà không sửa được số tiền?"**: Đó không phải lỗi, đó là tính năng bảo vệ dữ liệu. Muốn sửa, bạn phải dùng tài khoản có quyền (như Admin).
- **"Nhân viên thấy hết bí mật công ty"**: Hãy kiểm tra lại hàm `applyRoleUI`, có thể bạn chưa đưa trang đó vào danh sách bị ẩn đối với vai trò `ketoan`.
- **Dữ liệu an toàn**: Giám đốc có thể yên tâm đưa điện thoại cho khách xem báo cáo mà không sợ khách lỡ tay bấm xóa mất dữ liệu quý giá.

---

<br><br>

## PHẦN 5: ĐIỀU HƯỚNG & LÀM MỚI GIAO DIỆN (NAVIGATION & RENDER)

*(Dòng 803 – 1029 trong file)*

---

### 🎯 Mục đích

Phần này giống như **"Quản lý tòa nhà"**. Nó lo việc:
1. Dẫn bạn đi đúng phòng (Chuyển giữa các Tab: Nhập liệu, Biểu đồ, Chấm công...).
2. "Sơn sửa" lại phòng cho đẹp và mới mỗi khi có dữ liệu mới bay về (`Render`).
3. Tự động đi lấy thêm hồ sơ nếu bạn muốn xem một năm khác (`onYearChange`).

---

### 📖 Giải thích dễ hiểu

#### 1️⃣ Người chỉ đường (`goPage`) — "Mở cửa - Đóng cửa"

**Vấn đề thực tế**: App của bạn có rất nhiều tính năng, nếu hiện ra hết một lúc thì màn hình sẽ cực kỳ rối mắt.

**Giải pháp**: Hàm `goPage()` hoạt động như một người quản gia cầm chùm chìa khóa. Khi bạn bấm nút "Dashboard":
- Nó sẽ đi **Đóng cửa** (ẩn) tất cả các trang khác.
- Nó **Mở cửa** (hiện) đúng trang Dashboard.
- Nó thắp đèn (gọi hàm `render`) để dữ liệu hiện ra lung linh.

```javascript
function goPage(btn, id) {
  // 1. Cất hết các trang khác đi
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // 2. Hiện trang bạn vừa bấm lên
  document.getElementById('page-'+id).classList.add('active');
  
  // 3. Đọc lại dữ liệu mới nhất để vẽ
  if (typeof _reloadGlobals === 'function') _reloadGlobals();
}
```

---

#### 2️⃣ Vẽ lại thông minh (`renderActiveTab`) — "Chỉ sơn căn phòng đang đứng"

**Vấn đề thực tế**: Nếu app có 10 trang, mỗi lần có 1 hóa đơn mới mà phải vẽ lại cả 10 trang thì máy sẽ cực kỳ nóng và chậm.

**Giải pháp**: Hệ thống sử dụng cơ chế **Vẽ lại có chọn lọc**. 
- Nếu bạn đang ở trang Chấm công, nó chỉ vẽ lại bảng Chấm công. 
- Các trang khác (như Dashboard hay Thiết bị) vẫn đang "đóng cửa", app sẽ không tốn sức vẽ chúng. Điều này giúp app chạy cực nhanh kể cả trên điện thoại cũ.

---

#### 3️⃣ Đổi năm hồ sơ (`onYearChange`) — "Đi tìm hồ sơ cũ"

**Vấn đề thực tế**: Bạn đang xem năm 2025, giờ bạn muốn xem lại năm 2023. Nhưng dữ liệu năm 2023 chưa có trong điện thoại vì bạn vừa mới đổi máy mới.

**Giải pháp**: Hàm `onYearChange()` sẽ kiểm tra:
1. Nếu năm đó đã có trong máy -> Vẽ luôn.
2. Nếu năm đó chưa có -> Hiện một cái biển thông báo "⏳ Đang tải dữ liệu năm 2023..." và âm thầm đi gọi Đám mây để lấy về. Khi lấy xong, nó tự động vẽ ra cho bạn xem.

---

### 📌 Khái niệm quan trọng: `_reloadGlobals` & `renderActiveTab`

- **`_reloadGlobals`**: Đây là động tác "mở túi lấy sổ sách". Trước khi vẽ bất cứ thứ gì, app phải nạp lại dữ liệu mới nhất từ bộ nhớ vào "não" để đảm bảo không vẽ nhầm số liệu cũ.
- **`renderActiveTab`**: Là lệnh "vẽ ngay lập tức trang đang xem". Đây là hàm được gọi nhiều nhất trong app, giúp màn hình luôn phản ánh đúng thực tế.

---

### ✅ Kết luận

Hiểu Phần 5 sẽ giúp bạn giải quyết các lỗi:
- **"Số liệu bị sai lệch"**: Nếu bạn thấy số trên Dashboard không khớp với danh sách Hóa đơn, có thể do `_reloadGlobals` chưa được gọi đúng lúc.
- **"Bấm nút đổi trang mà không thấy gì"**: Kiểm tra xem ID của trang trong HTML có khớp với tên gọi trong hàm `goPage` không.
- **App bị giật lag**: Nếu bạn lỡ tay gọi hàm `_refreshAllTabs` (vẽ lại tất cả) quá nhiều lần, hãy chuyển sang dùng `renderActiveTab` để app mượt mà hơn.

---

<br><br>

## PHẦN 6: VÒNG ĐỜI KHỞI ĐỘNG ỨNG DỤNG (APP INIT)

*(Dòng 723 – 1109 trong file)*

---

### 🎯 Mục đích

Đây là quy trình **"Mở cửa hàng"** mỗi khi bạn truy cập vào App. Nó giống như việc một ông chủ cửa hàng đến sớm vào sáng sớm để:
1. Mở khóa két sắt (Kết nối dữ liệu).
2. Kiểm tra sổ sách xem có cần nâng cấp không (Migration).
3. Kiểm tra nhân viên có ai đi làm không (Xác thực người dùng).
4. Sắp xếp hàng hóa lên kệ (Vẽ giao diện).

---

### 📖 Giải thích dễ hiểu

#### 1️⃣ Mở khóa két sắt (`dbInit`) — "Kiểm tra hạ tầng"

Việc đầu tiên và quan trọng nhất là app phải kết nối được với **IndexedDB** (cái két sắt nằm ngay trong trình duyệt của bạn). Nếu két sắt này bị hỏng (do trình duyệt bị lỗi hoặc bộ nhớ đầy), app sẽ báo lỗi ngay lập tức vì không có chỗ để đọc/ghi dữ liệu.

---

#### 2️⃣ Nâng cấp sổ sách (`migrateData`) — "Di cư dữ liệu"

**Vấn đề thực tế**: Tuần trước app chưa có tính năng "Ngày kết thúc công trình", nhưng tuần này sếp yêu cầu thêm vào. Vậy hàng trăm công trình cũ sẽ bị trống thông tin này sao?

**Giải pháp**: Các hàm `migrate...` sẽ tự động quét qua toàn bộ dữ liệu cũ. Nếu thấy chỗ nào thiếu, nó sẽ tự động điền thông tin mặc định hoặc chuyển đổi định dạng cũ sang định dạng mới. Việc này giúp dữ liệu của bạn luôn "hợp thời đại" mà bạn không cần phải sửa tay từng dòng.

---

#### 3️⃣ Điểm danh và Mở cửa (`initAuth` & `init`)

Sau khi dữ liệu đã sẵn sàng, app thực hiện 2 bước cuối:
- **`initAuth`**: "Bạn là ai?". Nếu bạn chưa đăng nhập, nó sẽ hiện bảng đăng nhập. Nếu bạn đã có nick, nó kiểm tra xem "vé" của bạn còn hạn không.
- **`init`**: Khi đã vào được nhà, app bắt đầu "thắp đèn" (vẽ bảng biểu), khởi động bộ máy **Auto Backup** (tự động sao lưu mỗi 30 phút) và **Auto Sync** (tự động đồng bộ mỗi khi có thay đổi).

---

### 📌 Khái niệm quan trọng: `_dataReady`

- **`_dataReady`**: Đây là một cái "công tắc tổng". Khi app đang bận nâng cấp dữ liệu hoặc đang mở két sắt, công tắc này ở trạng thái `false` (tắt). Mọi lệnh "Vẽ màn hình" sẽ bị chặn lại để tránh việc vẽ ra những con số sai lệch hoặc thiếu sót. Chỉ khi mọi thứ xong xuôi, công tắc này mới bật lên `true`.

---

### ✅ Kết luận

Hiểu Phần 6 giúp bạn yên tâm về:
- **An toàn dữ liệu**: App luôn tự động sao lưu ngầm sau lưng bạn.
- **Tính kế thừa**: Khi app cập nhật phiên bản mới, dữ liệu cũ của bạn sẽ được "chăm sóc" và nâng cấp tự động, không bao giờ bị mất hay hỏng hóc.

---
<br><br>

## PHẦN 7: 🔗 LIÊN KẾT MODULE (QUAN TRỌNG)

File `main.js` chính là **"Ông chủ"** điều phối toàn bộ các module khác trong hệ thống.

**1. File này ĐIỀU KHIỂN AI?**
- Gọi `core.js` để yêu cầu "Nạp dữ liệu vào túi" (`load`) hoặc "Cất dữ liệu vào két" (`save`).
- Gọi `sync.js` để ra lệnh "Đẩy dữ liệu lên Đám mây ngay đi" (`pushChanges`).
- Gọi `hoadon.js`, `chamcong.js`, `datatools.js`... để yêu cầu: "Này, sếp vừa chuyển sang trang của bạn đấy, vẽ màn hình đi!".

**2. AI ĐIỀU KHIỂN file này?**
- Chính là **Bạn** thông qua file HTML. Mỗi khi bạn bấm nút "Đăng nhập", "Chuyển tab" hay "Đổi năm", trình duyệt sẽ gọi các hàm trong `main.js` để thực thi.
- **Hệ thống Đám mây (Firebase)**: Mỗi khi có dữ liệu từ máy khác bay về, `sync.js` sẽ báo cho `main.js` biết để ông chủ này ra lệnh cho các phòng ban vẽ lại màn hình.

**3. ⚠️ NẾU `main.js` BỊ LỖI?**
Toàn bộ ứng dụng sẽ bị tê liệt. Bạn sẽ thấy một màn hình trắng xóa hoặc một cái vòng tròn xoay mãi không dừng. Đó là vì "ông chủ" đang bị kẹt ở bước Mở két sắt hoặc Điểm danh người dùng. Do đó, đây là file quan trọng nhất, nắm giữ "vòng đời" từ lúc app sinh ra đến lúc bạn đóng trình duyệt.

---

*Chúc mừng bạn đã hoàn thành chuyến hành trình khám phá bộ não của ứng dụng!*
