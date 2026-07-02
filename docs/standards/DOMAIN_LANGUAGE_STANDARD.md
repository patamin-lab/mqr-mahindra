# Mahindra After Sales Platform (MASP)
# Domain Language & Localization Standard
# Release 1.0

## Objective

This document is the official business language standard for the Mahindra
After Sales Platform (MASP).

**All future modules must follow this standard.**

This document is the single source of truth for:

- Business terminology
- Localization
- Menu naming
- Icons
- PDF terminology
- CSV terminology
- Status names
- Business vocabulary

This document is separate from `docs/engineering/NAMING_CONVENTION.md`, which
governs source code naming only.

## Business Domain

MASP is an Agricultural After-Sales Platform.

The primary business asset is **Tractor**, NOT **Vehicle**.

User-facing UI must never use "Vehicle".

Database tables may retain existing names (`vehicles`, `vehicle_id`, etc.)
for backward compatibility.

## Official Menu Standard

| Icon | Thai | English |
|---|---|---|
| 🏠 | แดชบอร์ด | Dashboard |
| 🚜 | ทะเบียนรถแทรกเตอร์ | Tractor Registry |
| 📦 | ตรวจสภาพก่อนส่งมอบ (PDI) | Pre-Delivery Inspection |
| 📝 | ลงทะเบียนส่งมอบรถใหม่ (NTR) | New Tractor Registration |
| 🔧 | งานเช็คระยะ | Preventive Maintenance |
| ⚠️ | รายงานปัญหาคุณภาพ | Market Quality Report |
| 📜 | ประวัติรถแทรกเตอร์ | Tractor Profile |
| 📢 | แคมเปญบริการ | Service Campaign |
| 🛡️ | การรับประกัน | Warranty |
| 📦 | ขอเบิกอะไหล่ | Parts Request |
| 📈 | รายงาน | Reports |
| ⚙️ | ข้อมูลหลัก | Master Data |
| 👥 | ผู้ใช้งาน | Users |
| 🔧 | ตั้งค่าระบบ | System Settings |

## Official Business Terminology

| English | Thai |
|---|---|
| Tractor | รถแทรกเตอร์ |
| Tractor Registry | ทะเบียนรถแทรกเตอร์ |
| Tractor Profile | ประวัติรถแทรกเตอร์ |
| Tractor Life Cycle | วงจรชีวิตรถแทรกเตอร์ |
| Tractor Health | สุขภาพรถแทรกเตอร์ |
| Product Family | กลุ่มผลิตภัณฑ์ |
| Model | รุ่นรถ |
| Serial Number | หมายเลขตัวรถ |
| Engine Number | หมายเลขเครื่องยนต์ |
| Retail Date | วันที่ส่งมอบ |
| Dealer | ผู้แทนจำหน่าย |
| Branch | สาขา |
| Technician | ช่างบริการ |
| Customer | ลูกค้า |
| Owner | เจ้าของรถ |

### Maintenance

| English | Thai |
|---|---|
| Maintenance | การบำรุงรักษา |
| Preventive Maintenance | งานเช็คระยะ |
| Maintenance Program | โปรแกรมการบำรุงรักษา |
| Maintenance Stage | ระยะการเช็คระยะ |
| Maintenance Due | กำหนดเช็คระยะ |
| Current Stage | ระยะปัจจุบัน |
| Next Maintenance | เช็คระยะครั้งถัดไป |
| Remaining Hours | ชั่วโมงคงเหลือ |
| Remaining Days | วันคงเหลือ |
| Maintenance Compliance | ความครบถ้วนของการบำรุงรักษา |
| Health Score | คะแนนสุขภาพรถ |
| Health Status | สถานะสุขภาพรถ |

### Quality

| English | Thai |
|---|---|
| Market Quality Report | รายงานปัญหาคุณภาพ |
| Root Cause | สาเหตุที่แท้จริง |
| Corrective Action | แนวทางแก้ไข |
| Preventive Action | แนวทางป้องกัน |
| Severity | ระดับความรุนแรง |
| Problem Code | รหัสปัญหา |
| Symptom | อาการ |

### Warranty

| English | Thai |
|---|---|
| Warranty | การรับประกัน |
| Claim | เคลม |
| Claim Status | สถานะการเคลม |

### Delivery

| English | Thai |
|---|---|
| PDI | ตรวจสภาพก่อนส่งมอบ |
| NTR | ลงทะเบียนส่งมอบรถใหม่ |

### Service Campaign

| English | Thai |
|---|---|
| Campaign | แคมเปญบริการ |
| Recall | เรียกคืนสินค้า |
| Service Bulletin | ประกาศบริการ |

### Parts

| English | Thai |
|---|---|
| Parts Request | ขอเบิกอะไหล่ |
| Part Number | หมายเลขอะไหล่ |
| Parts Availability | สถานะอะไหล่ |

### General

| English | Thai |
|---|---|
| History | ประวัติ |
| Timeline | ไทม์ไลน์ |
| Audit Trail | ประวัติการเปลี่ยนแปลง |
| Attachment | ไฟล์แนบ |
| GPS | พิกัด GPS |
| Photo | รูปภาพ |
| Document | เอกสาร |

## Localization Standard

Thai is the default language. English remains fully supported.

All user-facing strings must come from `src/locales/`.

Never hardcode UI text.

Google Translate is NOT part of the production UI.

## Date Standard

- Thai: `01 กรกฎาคม 2569`
- English: `01 Jul 2026`

## Phone Format

`XXX-XXXXXXX`

## Report Number

- `PM-DLR-2026-000001`
- `MQR-DLR-2026-000001`

> **Status note (as implemented):** the live report-numbering scheme
> (`job_id`/`pm_number` generation in `lib/db.ts` / the maintenance
> repository) has not been changed to this format — see the compliance
> notes in the module changelog. Changing it is a business-logic/schema
> change, out of scope for a terminology-only pass, and requires its own
> reviewed migration.

## Status Colors

| Status | Color |
|---|---|
| Open | Blue |
| Under Investigation | Orange |
| Waiting Parts | Amber |
| Waiting Customer | Purple |
| Repaired | Green |
| Closed | Gray |
| Rejected | Red |

## Icon Standard

See the Official Menu Standard table above — the icon column is
authoritative for every top-level menu entry.

## Engineering Rules

- No hardcoded business terminology.
- No hardcoded translations.
- No duplicate terminology.
- Every future module must reference this document.

## Verification

Before merging any feature:

- [ ] Business terminology matches this document
- [ ] Menu names match this document
- [ ] PDF matches this document
- [ ] CSV matches this document
- [ ] Localization keys exist
- [ ] Icons follow the standard

---

From the commit that introduced this file forward, `DOMAIN_LANGUAGE_STANDARD.md`
is the project's canonical business-language reference. Any new feature,
module, page, PDF, CSV, report, or API documentation must comply with this
standard by default. If a future implementation conflicts with this
standard, stop and report the conflict instead of introducing new
terminology.
