export type Role = 'SuperAdmin' | 'CentralAdmin' | 'DealerAdmin' | 'DealerUser';

export const ROLE_VALUES: Role[] = ['SuperAdmin', 'CentralAdmin', 'DealerAdmin', 'DealerUser'];

export interface SessionUser {
  username: string;
  fullName: string;
  role: Role;
  dealerId: string | null;
  branch: string | null;
}

export interface Dealer {
  id: string;
  short_name: string;
  full_name: string;
  address: string | null;
  active?: boolean;
}

export interface Vehicle {
  id: string;
  serial: string;
  model: string | null;
  delivery_date: string | null;
  dealer_id: string | null;
  engine_number?: string | null;
  branch_id?: string | null;
  maintenance_program_version_id?: string | null;
}

export type Severity = 'Critical' | 'Major' | 'Minor';
export const SEVERITY_VALUES: Severity[] = ['Critical', 'Major', 'Minor'];
export const SEVERITY_LABELS: Record<Severity, string> = {
  Critical: 'วิกฤต (รถใช้งานไม่ได้ / ความปลอดภัย)',
  Major: 'สำคัญ (กระทบการใช้งาน)',
  Minor: 'เล็กน้อย (ไม่กระทบการใช้งานหลัก)',
};

export interface ProblemCode {
  id: string;
  code?: string | null;
  label: string;
  system: 'powertrain' | 'other';
  group_name: string | null;
  default_severity?: Severity | null;
  active?: boolean;
}

/** PM Interval Master - shared maintenance-interval schedule, reused (never
 *  hardcoded) by the PM Record module. At least one of interval_hours /
 *  interval_months is expected to be set (an interval can be hour-based,
 *  month-based, or both), but neither is DB-enforced as required since a
 *  future interval type not yet known might need neither. */
export interface PmInterval {
  id: string;
  label: string;
  interval_hours: number | null;
  interval_months: number | null;
  active?: boolean;
}

/** Product Family Master (Phase 5b) - maintenance behavior is inherited
 *  through Product Family, never directly from Tractor Model ("Tractor
 *  Model remains for identification only" per spec). Supersedes the
 *  model-based PM Program mapping (removed this phase - see
 *  PROJECT_STATE.md). */
export interface ProductFamily {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active?: boolean;
}

/** Maps a Tractor Model (free-text, from the existing Vehicle Master
 *  `vehicles.model` values) to exactly one Product Family - "every tractor
 *  model belongs to one Product Family" per spec, unlike the old
 *  model<->interval mapping which was many-to-many. */
export interface ProductFamilyModel {
  id: string;
  product_family_id: string;
  model: string;
  active?: boolean;
}

/** Maintenance Program Assignment - maps a Product Family to one or more
 *  Maintenance Intervals (`pm_intervals`, reused as-is as the "Maintenance
 *  Program" master - see PROJECT_STATE.md for why no separate
 *  maintenance_programs table was created). A pure junction table like the
 *  PM Program mapping it replaces: no soft-delete/audit value of its own,
 *  unchecking a Product Family in the admin UI just removes the row. */
export interface MaintenanceProgramAssignment {
  id: string;
  product_family_id: string;
  pm_interval_id: string;
}

/** One immutable snapshot of a Product Family's Maintenance Program at a
 *  point in time (Production Stabilization Sprint). A new version is
 *  created whenever the live `maintenance_program_assignments` set for a
 *  family - or the defining attributes of one of its assigned
 *  `pm_intervals` - actually changes; `maintenance_program_assignments`
 *  itself remains the "live/editable" assignment set the admin UI shows
 *  and mutates, `maintenance_program_versions`/`_stages` are the
 *  read-only history the Due/Compliance/Health engines evaluate against.
 *  See `syncMaintenanceProgramVersion()`/`resolveVehicleProgramVersionStages()`
 *  in `lib/db.ts`. */
export interface MaintenanceProgramVersion {
  id: string;
  productFamilyId: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
}

export interface MaintenanceProgramVersionStage {
  pmIntervalId: string | null;
  label: string;
  intervalHours: number | null;
  intervalMonths: number | null;
}

export interface Technician {
  id: string;
  code?: string | null;
  name: string;
  mobile?: string | null;
  branch: string | null;
  dealer_id: string | null;
  active?: boolean;
}

export interface Branch {
  id: string;
  code?: string | null;
  name: string;
  dealer_id: string | null;
  active?: boolean;
}

/** Admin-facing user record (never includes password_hash). */
export interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  role: Role;
  dealer_id: string | null;
  branch: string | null;
  active: boolean;
  created_at: string;
}

export type PhotoCategory =
  | 'odometer'
  | 'vehicle_serial'
  | 'damage_point_1'
  | 'damage_point_2'
  | 'damage_point_3'
  | 'after_repair'
  // Legacy categories from the old 3-box layout. No longer produced by the
  // report form (replaced by the 5 named slots above), but kept here so
  // older records' already-saved photos still render on the detail page.
  | 'problem_evidence'
  | 'problem_location';

/** Named photo slots (replaces the old 3 generic multi-add boxes): each one
 *  is a single required-or-optional upload, not a repeatable list. */
export const PHOTO_CATEGORIES: { key: PhotoCategory; label: string; required: boolean }[] = [
  { key: 'odometer', label: 'รูปเรือนไมล์', required: true },
  { key: 'vehicle_serial', label: 'รูปเลขรถ', required: true },
  { key: 'damage_point_1', label: 'รูปจุดที่เสียหาย 1', required: true },
  { key: 'damage_point_2', label: 'รูปจุดที่เสียหาย 2', required: false },
  { key: 'damage_point_3', label: 'รูปจุดที่เสียหาย 3', required: false },
  { key: 'after_repair', label: 'ภาพหลังการแก้ไข', required: false },
  // Legacy labels - only shown when an older record still has photos saved
  // under these categories.
  { key: 'problem_evidence', label: 'ภาพหลักฐานปัญหา (เดิม)', required: false },
  { key: 'problem_location', label: 'ภาพตำแหน่ง/จุดที่เกิดปัญหา (เดิม)', required: false },
];

/** Maps each photo category to its `pdf.*` / dictionary translation key -
 *  shared by the PDF renderer and any UI page that wants a locale-aware
 *  label instead of `PHOTO_CATEGORIES`' single Thai-only `label` field. */
export const PHOTO_CATEGORY_I18N_KEY: Record<PhotoCategory, string> = {
  odometer: 'photoOdometer',
  vehicle_serial: 'photoVehicleSerial',
  damage_point_1: 'photoDamagePoint1',
  damage_point_2: 'photoDamagePoint2',
  damage_point_3: 'photoDamagePoint3',
  after_repair: 'photoAfterRepair',
  problem_evidence: 'photoProblemEvidence',
  problem_location: 'photoProblemLocation',
};

export interface PhotoLink {
  category: PhotoCategory;
  label: string;
  /** Legacy direct URL (Google Drive share link) - still populated and
   *  read as-is for records saved before the Attachment Platform
   *  migration (Phase 5B.1). A new upload sets this to whatever
   *  `AttachmentService` resolved at upload time, but display code must
   *  prefer `attachmentId` (resolve a fresh URL via `AttachmentService`)
   *  whenever it's present, since a stored signed URL expires. */
  url: string;
  /** Set for every photo uploaded via the Attachment Platform - null only
   *  for pre-migration records. See `docs/engineering/ATTACHMENT_FRAMEWORK.md`. */
  attachmentId?: string | null;
}

export interface MqrRecord {
  id: string;
  job_id: string;
  dealer_id: string;
  serial: string | null;
  model: string | null;
  hours: number | null;
  found_date: string | null;
  problem_code: string | null;
  problem_system: string | null;
  warranty_status: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  user_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  technician_id: string | null;
  technician_name: string | null;
  repair_date: string | null;
  hours_in_for_repair: number | null;
  severity: Severity | null;
  cause: string | null;
  damaged_parts: string | null;
  peripheral_equipment: string | null;
  technician_action: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  attachment: string | null;
  stock_note: string | null;
  lat: number | null;
  lng: number | null;
  gps_accuracy: number | null;
  google_maps_url: string | null;
  pdf_link: string | null;
  photo_links: PhotoLink[] | null;
  video_link: string | null;
  /** Set for a video uploaded via the Attachment Platform - null for
   *  pre-migration records (see `PhotoLink.attachmentId`'s doc comment). */
  video_attachment_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  record_status: 'Active' | 'Deleted';
}

/** New status workflow (replaces the old 7-status Thai list). Machine codes are
 *  stored in the DB; STATUS_LABELS gives the Thai text shown in the UI.
 *  WaitingCustomer/Rejected added in the Production Stabilization Sprint to
 *  close two genuine gaps in the investigation workflow (a job can be
 *  blocked on the customer, not just parts; a reported issue can turn out
 *  not to be a valid claim) - the existing Draft/Open/UnderInvestigation/
 *  WaitingParts/Repaired/Closed names were deliberately kept as-is rather
 *  than renamed to match another spec's wording, to avoid unnecessary
 *  schema/data churn. */
export const STATUS_VALUES = [
  'Draft',
  'Open',
  'UnderInvestigation',
  'WaitingParts',
  'WaitingCustomer',
  'Repaired',
  'Closed',
  'Rejected',
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

export const STATUS_LABELS: Record<StatusValue, string> = {
  Draft: 'แบบร่าง',
  Open: 'เปิดเรื่อง',
  UnderInvestigation: 'กำลังตรวจสอบ',
  WaitingParts: 'รออะไหล่',
  WaitingCustomer: 'รอข้อมูลจากลูกค้า',
  Repaired: 'ซ่อมเสร็จแล้ว',
  Closed: 'ปิดเรื่อง',
  Rejected: 'ปฏิเสธเคลม',
};

export const OPEN_STATUSES = STATUS_VALUES.filter((s) => s !== 'Closed' && s !== 'Rejected');

/** Normal-role-allowed forward transitions for the MQR investigation
 *  workflow. `Closed`/`Rejected` are terminal for everyone but SuperAdmin -
 *  see `canTransitionMqrStatus()`, which grants SuperAdmin an unconditional
 *  override (e.g. to reopen a wrongly-closed job) while every other role
 *  (CentralAdmin/DealerAdmin - DealerUser can never change status at all,
 *  per `canUpdateStatus()` in `scope.ts`) must follow this graph. */
export const MQR_STATUS_TRANSITIONS: Record<StatusValue, StatusValue[]> = {
  Draft: ['Open'],
  Open: ['UnderInvestigation', 'Rejected'],
  UnderInvestigation: ['WaitingParts', 'WaitingCustomer', 'Repaired', 'Rejected'],
  WaitingParts: ['UnderInvestigation', 'WaitingCustomer', 'Repaired'],
  WaitingCustomer: ['UnderInvestigation', 'WaitingParts', 'Repaired'],
  Repaired: ['Closed', 'UnderInvestigation'],
  Closed: [],
  Rejected: [],
};

/** Whether `role` may move an MQR record from `from` to `to`. Staying on the
 *  same status is always allowed (a no-op transition, e.g. editing RCA text
 *  without changing status). SuperAdmin may make any transition; every
 *  other status-updating role must follow `MQR_STATUS_TRANSITIONS`. */
export function canTransitionMqrStatus(from: StatusValue, to: StatusValue, role: Role): boolean {
  if (from === to) return true;
  if (role === 'SuperAdmin') return true;
  return MQR_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Thai labels for the shared audit trail's event types, used by both the
 *  MQR and PM Timeline UIs. */
export const AUDIT_EVENT_LABELS_TH: Record<AuditEventType, string> = {
  Created: 'สร้างรายการ',
  StatusChanged: 'เปลี่ยนสถานะ',
  FieldChanged: 'แก้ไขข้อมูล',
  AttachmentAdded: 'เพิ่มไฟล์แนบ',
  AttachmentRemoved: 'ลบไฟล์แนบ',
  RcaUpdated: 'อัปเดตข้อมูลการวิเคราะห์สาเหตุ (RCA)',
  SeverityChanged: 'เปลี่ยนระดับความรุนแรง',
  AssignmentChanged: 'เปลี่ยนผู้รับผิดชอบ',
  Locked: 'ล็อกข้อมูล',
  Unlocked: 'ปลดล็อกข้อมูล',
  Deleted: 'ลบรายการ',
  SystemEvent: 'เหตุการณ์ระบบ',
};

/** Shared, immutable audit trail (`record_audit_log`) - one system-logged
 *  entry per business event, reused by both MQR (`records`) and PM
 *  (`pm_records`), which is why it lives in the platform-wide `types.ts`/
 *  `db.ts` rather than either module's own feature folder. Never edited or
 *  deleted after insert - see `record_audit_log`'s RLS policies (no
 *  UPDATE/DELETE policy exists at all). */
export type AuditModule = 'mqr' | 'pm';

export type AuditEventType =
  | 'Created'
  | 'StatusChanged'
  | 'FieldChanged'
  | 'AttachmentAdded'
  | 'AttachmentRemoved'
  | 'RcaUpdated'
  | 'SeverityChanged'
  | 'AssignmentChanged'
  | 'Locked'
  | 'Unlocked'
  | 'Deleted'
  | 'SystemEvent';

export interface AuditLogEntry {
  id: string;
  module: AuditModule;
  recordId: string;
  recordRef: string;
  eventType: AuditEventType;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  performedBy: string;
  performedAt: string;
}

export interface LogAuditEventInput {
  module: AuditModule;
  recordId: string;
  recordRef: string;
  eventType: AuditEventType;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  performedBy: string;
}
