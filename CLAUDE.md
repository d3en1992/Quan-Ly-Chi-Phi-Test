# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

**Ứng dụng quản lý chi phí công trình** — a Vietnamese construction project management SPA. Features: invoice entry, attendance/payroll, equipment tracking, revenue/contracts, category management, multi-device cloud sync via Firebase Firestore.

## How to Run

No build step. Open `index.html` directly in a browser. All dependencies are bundled locally:
- `dexie.min.js` — IndexedDB ORM
- `xlsx.full.min.js` — Excel import/export
- `html2canvas.min.js` — Print/screenshot

Firebase sync is optional; configured by the user at runtime (stored in localStorage as `fb_config`).

## Script Load Order (Critical)

Scripts must load in this exact order (enforced in `index.html`):

```
core.js → projects.js → tienich.js → hoadon.js → danhmuc.js →
nhapxuat.js → datatools.js → chamcong.js → thietbi.js → doanhthu.js →
sync.js → main.js
```

`main.js` is always last. It calls `dbInit()` then re-assigns all module globals before rendering UI.

## Storage Architecture

**Source of truth is IndexedDB** (Dexie, db name `qlct`, version 2). Never read from localStorage for business data.

- `_mem` — in-memory cache; populated by `dbInit()` from IDB at startup
- `load(key, def)` — reads from `_mem` only
- `save(key, v)` — writes `_mem` + async IDB + enqueues Firebase sync
- `_dbSave(k, v)` — internal IDB write (no sync trigger)

localStorage is **only** for: `deviceId`, `syncPending`, `lastSyncAt`, `fb_config`, `app_data_version`, and `backup_auto` snapshots.

### IDB Tables → Memory Keys

| IDB Table | Keys stored |
|-----------|-------------|
| `db.invoices` | `inv_v3` |
| `db.attendance` | `cc_v2` |
| `db.equipment` | `tb_v1` |
| `db.ung` | `ung_v1` |
| `db.revenue` | `thu_v1` |
| `db.categories` | `cat_ct`, `cat_loai`, `cat_ncc`, `cat_nguoi`, `cat_tp`, `cat_cn`, `cat_tbteb` |
| `db.settings` | `projects_v1`, `hopdong_v1`, `thauphu_v1`, `trash_v1`, `cat_ct_years`, `cat_cn_roles` |

## Data Model

### Projects Are the Core Entity

- `projects_v1` is the single source of truth for công trình (construction projects)
- `cat_ct` is **derived only** — rebuilt via `rebuildCatCTFromProjects()` in `projects.js`; never write to it directly
- Special project: `PROJECT_COMPANY = {id:'COMPANY', name:'CÔNG TY'}` for shared company expenses
- All new records (`inv_v3`, `cc_v2`, `ung_v1`, `tb_v1`, `thu_v1`) must include `projectId`
- Old records without `projectId` use `congtrinh`/`ct` text fields for backward compat
- `migrateProjectLinks()` runs at startup to assign `projectId` to old records by name-matching

### Record Lifecycle

Use these factories from `core.js` for all new/updated records:
- `mkRecord(fields)` — creates record with `id`, `createdAt`, `updatedAt`, `deletedAt: null`, `deviceId`
- `mkUpdate(existing, changes)` — preserves `id`+`createdAt`, updates `updatedAt`+`deviceId`
- **Never hard-delete** — use `softDeleteRecord(arr, id)` from `sync.js` to set `deletedAt`

### Firebase Sync (sync.js)

Architecture: Pull → Merge → Push. Conflict resolution:
1. Tombstone (deleted) beats live record
2. Latest `updatedAt` wins when both are same state
3. CC records dedup by `(fromDate, projectId)` instead of ID

Firestore document layout:
```
/cpct_data/
  ├── year_YYYY/   → {i, u, c, t, thu, updatedAt}  (compressed arrays)
  └── cats/        → {cats, hopDong, thauPhu, users, catItems}
```

**Compression**: field names are shortened for upload (e.g., `id→i`, `ngay→n`, `projectId→pi`). All compress/expand functions live in `sync.js`. If you add a new field to a record type, you **must** add it to both the compress and expand functions — otherwise the field is silently dropped on every sync round-trip.

## Key Functions Reference

**core.js**
- `dbInit()` — must await before any data access
- `mergeUnique(oldArr, newArr)` — dedup by id, latest updatedAt wins
- `saveCats(catId)` — save a specific category

**projects.js**
- `resolveProjectName(record)` — get project name: prefers `projectId` lookup, falls back to text field
- `getProjectNameById(id)` — lookup project name by ID
- `rebuildCatCTFromProjects()` — call after any projects change

**tienich.js**
- `buildInvoices()` — merges manual invoices + CC-derived invoices; result is what all stats use
- `getInvoicesCached()` — memoized version; invalidate on data change
- `parseMoney(raw)` — parses "1.000.000", "1tr", "2tỷ" etc.
- `fmtM(n)` — format as "1.234.567 đ"; `fmtS(n)` — short "1,5tr"
- `inActiveYear(dateStr)` — checks against `activeYears` Set

## Module Responsibilities

| File | Owns |
|------|------|
| `core.js` | Storage layer, Firebase REST calls, record factories |
| `projects.js` | Project CRUD, `projects_v1`, cat_ct rebuild, project year tracking |
| `tienich.js` | Formatters, parsers, `buildInvoices()`, helpers used by all modules |
| `hoadon.js` | Invoice entry form, `inv_v3` CRUD |
| `danhmuc.js` | Category UI, `cats` global, normalization |
| `nhapxuat.js` | Excel/JSON import-export, validation |
| `datatools.js` | Backup/restore, delete-by-year, reset |
| `chamcong.js` | Attendance tracking, payroll, `cc_v2` |
| `thietbi.js` | Equipment tracking, `tb_v1` |
| `doanhthu.js` | Revenue, contracts (`hopdong_v1`, `thauphu_v1`, `thu_v1`), dashboard |
| `sync.js` | Firebase sync engine, compress/expand, soft-delete |
| `main.js` | App init, auth, page routing, year filter, global re-assignment after `dbInit()` |

## Global State Pattern

Module-level globals are declared at parse time (from localStorage or empty defaults), then **re-assigned by `main.js`** after `dbInit()` completes. Example:

```js
// In hoadon.js (module level — initial value)
let invoices = [];

// In main.js after dbInit()
invoices = load('inv_v3') || [];
```

When adding a new data key, follow this pattern: declare the global in the owning module, add the re-assignment in `main.js`'s `_reloadGlobals()`.

## Vietnamese UI Rules

- All UI labels, button text, column headers, and messages must remain in Vietnamese
- UTF-8 encoding must be preserved in all files
- Category normalization: `loaiChiPhi` and `tbTen` → Title Case; all other categories → UPPERCASE
- Do not "translate" or "improve" Vietnamese text

## Year Filtering

- `activeYears` (Set) is the multi-year filter; `activeYear` (number) is kept for backward compat
- `0` means "all years"
- All renders must call `inActiveYear(dateStr)` to filter — don't filter manually
- Firebase stores each year as a separate document (`year_YYYY`)

## Auth System

Users stored in `users_v1` (IDB settings table). Roles: `admin | giamdoc | ketoan`. Sessions tracked by `deviceId`. Default users created by `ensureDefaultUsers()` if table is empty. Auth state lives in `currentUser` (main.js).

## Adding New Data Fields

Checklist when adding a field to an existing record type:
1. Add to the record's compress function in `sync.js` (pick a short key not already used)
2. Add to the corresponding expand function in `sync.js`
3. Add to `mkRecord()` or `mkUpdate()` defaults if needed
4. Update import validation in `nhapxuat.js` if the field should be importable
5. Update any print templates in `index.html` if the field should appear on printed documents
