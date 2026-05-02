# PROMPT 14A — Audit Manifest: Porting Payroll UI

## Tổng quan chamcong.js
- **Kích thước**: ~1405 dòng, 1 file duy nhất
- **Module state**: `ccData`, `ccOffset`, `ccHistPage`, `ccTltPage`, `ccClipboard`, `_ccDebtColsHidden`
- **3 section UI**: Sổ Chấm Công (entry table) | Tổng Lương Tuần (TLT) | Lịch Sử (history)
- **payroll.logic.js**: đã port đầy đủ logic thuần (13 functions, 5 constants)
- **payroll.ui.js hiện tại**: chỉ có 4 helpers nhỏ + initPayrollUI stub — chưa port gì cả

## 1. MODULE STATE — Biến toàn cục cần chuyển vào payroll.ui.js
| Symbol | Loại | Giá trị khởi tạo | Ghi chú |
| :--- | :--- | :--- | :--- |
| `ccOffset` | state | 0 | Offset tuần hiện tại so với hôm nay |
| `ccHistPage` | state | 1 | Trang lịch sử |
| `ccTltPage` | state | 1 | Trang TLT |
| `ccClipboard` | state | null | Buffer copy/paste tuần |
| `_ccDebtColsHidden` | state | true | Trạng thái ẩn/hiện cột nợ |

> [!WARNING]
> `ccData` KHÔNG chuyển vào `payroll.ui.js` — đây là data global, đọc từ `window.ccData` (re-assigned bởi `_reloadGlobals()` trong `app.js`).

## 2. NHÓM 1 — Bảng chấm công tuần (Entry Table)
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `buildCCTable(workers)` | UI render | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Vừa |
| `addCCRow(w)` | UI helper | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `buildCCRow(w, num)` | UI render | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Cao (nhiều event listeners, refs globals: cats, cnRoles, _acShow, normalizeKey) |
| `onCCNameInput(inp)` | handler | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Vừa |
| `onCCDayKey(inp)` | handler | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `onCCWageKey(inp)` | handler | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `onCCMoneyKey(inp)` | handler | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `calcCCRow(tr)` | UI calc | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp (dùng `calcDebtBefore` từ logic) |
| `updateCCSumRow()` | UI render | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Vừa |
| `delCCRow(btn)` | handler | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `renumberCC()` | helper | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |

## 3. NHÓM 2 — Thêm/Xóa công nhân
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `addCCWorker()` | UI handler | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `delCCRow(btn)` | UI handler | `payroll.ui.js` | ❌ | ✅ (xem trên) | ✅ | ❌ | Thấp |
| `delCCWeekById(id, fromDate, ct)` | WRITE/DELETE | — | ❌ | ❌ | ✅ | ✅ | Cao |
| `delCCWorker(wid, name)` | WRITE/DELETE | — | ❌ | ❌ | ❌ | ✅ | Cao |
| `loadCCWeekFromHistory(f, ct)` | alias | — | ❌ | ❌ | ❌ | ✅ | Thấp (alias) |
| `delCCWeekHistory(f, ct)` | alias | — | ❌ | ❌ | ❌ | ✅ | Thấp (alias) |

## 4. NHÓM 3 — Copy/Paste tuần
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `copyCCWeek()` | UI handler | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp (reads DOM, sets `ccClipboard`) |
| `pasteCCWeek()` | UI handler | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp (calls `buildCCTable`) |

> Logic `prepareCopyData(workers)` and `createWorkerStubs(workers)` đã có trong `payroll.logic.js` — gọi trực tiếp.

## 5. NHÓM 4 — Điều hướng tuần
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `initCC()` | init | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `ccGoToWeek(off)` | navigation | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `ccPrevWeek()` | navigation | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp (wrapper) |
| `ccNextWeek()` | navigation | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp (wrapper) |
| `onCCFromChange()` | handler | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `onCCCtSelChange()` | handler | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `loadCCWeekForm()` | data load | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Vừa (reads `window.ccData`) |
| `populateCCCtSel()` | UI | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `updateCCSaveBtn()` | UI | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `toggleCCDebtCols()` | UI toggle | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `_applyCCDebtColsVisibility()` | UI helper | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |

## 6. NHÓM 5 — Tổng lương tháng / TLT
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `renderCCTLT()` | HEAVY render | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Cao (desktop+mobile card view, calls `_calcDebtBefore`) |
| `updateTLTSelectedSum()` | UI calc | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `ccTltGoTo(p)` | pagination | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `fmtK(v)` | helper | — | ✅ `payroll.ui.js` | ❌ | — | — | — |

## 7. NHÓM 6 — Lịch sử chấm công
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `buildCCHistFilters()` | UI build | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Vừa |
| `renderCCHistory()` | HEAVY render | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Vừa |
| `ccHistGoTo(p)` | pagination | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `loadCCWeekById(id, fromDate, ct)` | load | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Vừa |

## 8. NHÓM 7 — Phiếu lương
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `xuatPhieuLuong()` | export/UI | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Vừa (html2canvas — external lib via window) |
| `removeVietnameseTones(str)` | helper | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |
| `_fmtDate(iso)` | helper | `payroll.ui.js` | ❌ | ✅ | ❌ | ❌ | Thấp |

## 9. NHÓM 8 — Debt/vay/trừ nợ
Không có UI riêng cho debt management trong `chamcong.js`. Nợ được xử lý inline trong `buildCCRow` (hiển thị `data-cc="debtbefore"`) and `calcCCRow` (tính `_calcDebtBefore`).

| Symbol | Loại | Ghi chú |
| :--- | :--- | :--- |
| `_calcDebtBefore(name, fromDate)` | helper | Dùng `window.ccData` global. Wrapper quanh `calcDebtBefore` từ `payroll.logic.js`. Cần port dạng: `const _calcDebtBefore = (n,f) => calcDebtBefore(n, f, window.ccData)` |

## 10. NHÓM 9 — CSV/Export
| Symbol | Loại | Đích | Có trong logic/ui? | Cần port? | Bridge? | Delegate? | Rủi ro |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `exportCCWeekCSV()` | export | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp (calls `window.dlCSV`) |
| `exportCCTLTCSV()` | export | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `exportCCHistCSV()` | export | `payroll.ui.js` | ❌ | ✅ | ✅ | ❌ | Thấp |
| `exportUngToImage()` | export | KHÔNG PORT | — | ❌ | ❌ | ✅ | — |

> `exportUngToImage()` — nằm vật lý trong `chamcong.js` nhưng thao tác trên `filteredUng` (advance module). Không port vào `payroll.ui.js`. Delegate lại legacy `advance.js` khi port advance module.

## 11. NHÓM 10 — Inline handlers trong index.html
| onclick trong HTML | Nguồn gọi | Cần bridge? | Ghi chú |
| :--- | :--- | :--- | :--- |
| `clearCCWeek()` | `index.html` line ~923 | ✅ | Port + bridge |
| `exportCCWeekCSV()` | `index.html` line ~924 | ✅ | Port + bridge |
| `copyCCWeek()` | `index.html` line ~925 | ✅ | Port + bridge |
| `pasteCCWeek()` | `index.html` line ~926 | ✅ | Port + bridge |
| `saveCCWeek()` | `index.html` line ~927 | ✅ | DELEGATE — stays as legacy global |
| `ccPrevWeek()` | `index.html` line ~933 | ✅ | Port + bridge |
| `ccNextWeek()` | `index.html` line ~935 | ✅ | Port + bridge |
| `onCCFromChange()` | `index.html` line ~938 | ✅ | Port + bridge |
| `onCCCtSelChange()` | `index.html` line ~943 | ✅ | Port + bridge |
| `addCCWorker()` | `index.html` line ~957 | ✅ | Port + bridge |
| `exportCCTLTCSV()` | `index.html` line ~983 | ✅ | Port + bridge |
| `xuatPhieuLuong()` | `index.html` line ~984 | ✅ | Port + bridge |
| `renderCCTLT()` | `index.html` (onchange) | ✅ | Port + bridge |
| `renderCCHistory()` | `index.html` (oninput/onchange) | ✅ | Port + bridge |
| `exportCCHistCSV()` | `index.html` line ~1030 | ✅ | Port + bridge |
| `delCCRow(this)` | inline từ `buildCCRow` | ✅ | Port + bridge |
| `toggleCCDebtCols()` | inline từ `buildCCTable thead` | ✅ | Port + bridge |
| `ccHistGoTo(p)` | inline từ `renderCCHistory` | ✅ | Port + bridge |
| `ccTltGoTo(p)` | inline từ `renderCCTLT` | ✅ | Port + bridge |
| `loadCCWeekById(id,f,ct)` | inline từ `renderCCHistory` | ✅ | Port + bridge |
| `delCCWeekById(id,f,ct)` | inline từ `renderCCHistory` | ✅ | DELEGATE stays legacy |

## Tổng kết kết quả audit

### A. Symbol cần port vào payroll.ui.js (38 symbols)
- **Module state (5)**: `ccOffset`, `ccHistPage`, `ccTltPage`, `ccClipboard`, `_ccDebtColsHidden`
- **Helpers/debt (3)**: `_calcDebtBefore` (wrapper), `_applyCCDebtColsVisibility`, `toggleCCDebtCols`
- **Week nav (9)**: `initCC`, `ccGoToWeek`, `ccPrevWeek`, `ccNextWeek`, `onCCFromChange`, `onCCCtSelChange`, `loadCCWeekForm`, `populateCCCtSel`, `updateCCSaveBtn`
- **Table build (11)**: `buildCCTable`, `addCCRow`, `addCCWorker`, `buildCCRow`, `onCCNameInput`, `onCCDayKey`, `onCCWageKey`, `onCCMoneyKey`, `calcCCRow`, `delCCRow`, `renumberCC`, `updateCCSumRow`, `clearCCWeek` (13 — gộp vào nhóm)
- **Copy/paste (2)**: `copyCCWeek`, `pasteCCWeek`
- **History (4)**: `buildCCHistFilters`, `renderCCHistory`, `ccHistGoTo`, `loadCCWeekById`
- **TLT (3)**: `renderCCTLT`, `updateTLTSelectedSum`, `ccTltGoTo`
- **Export/phiếu (6)**: `exportCCWeekCSV`, `exportCCTLTCSV`, `exportCCHistCSV`, `xuatPhieuLuong`, `removeVietnameseTones`, `_fmtDate`

### B. Symbol đã có, KHÔNG port lại
- `_dedupCC` -> `dedupCC` trong `payroll.logic.js`
- `round1` -> `round1` trong `payroll.logic.js`
- `isoFromParts`, `ccSundayISO`, `ccSaturdayISO`, `snapToSunday`, `viShort`, `weekLabel` -> `payroll.logic.js`
- `fmtK` -> `payroll.ui.js`
- `rebuildCCNameList` -> `payroll.ui.js` (params khác — cần cập nhật window bridge)
- `calcWeekOffset` -> `payroll.ui.js`
- `CC_DAY_LABELS`, `CC_DATE_OFFSETS`, `CC_PG_HIST`, `CC_PG_TLT` -> `payroll.logic.js`

### C. Bridge bắt buộc (window.xxx = yyy)
`initCC`, `buildCCTable`, `addCCWorker`, `delCCRow`, `toggleCCDebtCols`, `ccPrevWeek`, `ccNextWeek`, `onCCFromChange`, `onCCCtSelChange`, `copyCCWeek`, `pasteCCWeek`, `clearCCWeek`, `populateCCCtSel`, `renderCCHistory`, `renderCCTLT`, `ccHistGoTo`, `ccTltGoTo`, `loadCCWeekById`, `exportCCWeekCSV`, `exportCCTLTCSV`, `exportCCHistCSV`, `xuatPhieuLuong`, `rebuildCCNameList` (cập nhật wrapper)

### D. Symbol nên delegate tạm (giữ nguyên trong legacy chamcong.js)
| Symbol | Lý do |
| :--- | :--- |
| `saveCCWeek()` | WRITE phức tạp: reads DOM, dedup, save IDB, update cache, trigger renders |
| `delCCWeekById()` | WRITE/DELETE + soft-delete pattern |
| `delCCWorker()` | WRITE/DELETE |
| `normalizeAllChamCong()` | WRITE, chạy lúc bootstrap (đã gọi qua `window.normalizeAllChamCong` trong `app.js`) |
| `rebuildCCCategories()` | Essentially no-op, ổn khi giữ legacy |
| `updateTopFromCC()` | Gọi `window.updateTop()` anyway — giữ legacy |
| `exportUngToImage()` | Không thuộc payroll module |
| `loadCCWeekFromHistory()`, `delCCWeekHistory()` | Aliases cho delegated functions |

### E. Thứ tự port an toàn
1. Module state + constants (`ccOffset`, `ccHistPage`, `ccTltPage`, `ccClipboard`, `_ccDebtColsHidden`)
2. Pure helpers (`removeVietnameseTones`, `_fmtDate`, `_calcDebtBefore` wrapper)
3. Debt cols UI (`_applyCCDebtColsVisibility`, `toggleCCDebtCols`)
4. Input handlers — KHÔNG cần window bridge (`onCCDayKey`, `onCCWageKey`, `onCCMoneyKey`)
5. Row calc + delete (`calcCCRow`, `delCCRow`, `renumberCC`)
6. Name input + autocomplete (`onCCNameInput`)
7. `buildCCRow` ← PHỨC TẠP, port sau khi các phụ thuộc ready
8. `addCCRow`, `addCCWorker`, `updateCCSumRow`
9. `buildCCTable`, `clearCCWeek`
10. Week navigation (`updateCCSaveBtn`, `populateCCCtSel`, `loadCCWeekForm`, `ccGoToWeek`, `ccPrevWeek`, `ccNextWeek`, `onCCFromChange`, `onCCCtSelChange`)
11. `initCC`
12. Copy/paste (`copyCCWeek`, `pasteCCWeek`)
13. History filters (`buildCCHistFilters`) — no window bridge
14. History render (`renderCCHistory`, `ccHistGoTo`, `loadCCWeekById`)
15. TLT render (`renderCCTLT`, `updateTLTSelectedSum`, `ccTltGoTo`)
16. CSV exports (`exportCCWeekCSV`, `exportCCTLTCSV`, `exportCCHistCSV`)
17. Phiếu lương (`xuatPhieuLuong`)
18. Window bridges — tất cả cùng 1 lúc ở cuối file

### Rủi ro tổng thể
| Mức | Symbol |
| :--- | :--- |
| **Cao** | `buildCCRow` (refs cats, cnRoles, _acShow, normalizeKey — tất cả globals), `saveCCWeek` (delegate), `renderCCTLT` (mobile+desktop branch, _calcDebtBefore) |
| **Vừa** | `buildCCTable`, `updateCCSumRow`, `loadCCWeekForm`, `renderCCHistory`, `buildCCHistFilters`, `xuatPhieuLuong` |
| **Thấp** | Tất cả còn lại |

> [!IMPORTANT]
> `buildCCRow` gọi `_acShow(this, cats.congNhan, cb)` — hàm autocomplete từ `tienich.js`. Phải access qua `window._acShow` hoặc `window.acShow`. Tương tự `normalizeKey` and `cnRoles` cần `window.cnRoles`, `window.normalizeKey`.
