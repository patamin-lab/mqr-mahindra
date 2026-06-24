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

export type PhotoCategory = 'problem_evidence' | 'problem_location' | 'after_repair';

/** 3-category restructure (Phase 4): each uploaded photo is tagged with which
 *  category it belongs to, replacing the old fixed 9-slot layout. */
export const PHOTO_CATEGORIES: { key: PhotoCategory; label: string; required: boolean }[] = [
  { key: 'problem_evidence', label: 'ภาพหลักฐานปัญหา (หมายเลขรถ/เรือนไมล์/อาการที่พบ)', required: true },
  { key: 'problem_location', label: 'ภาพตำแหน่ง/จุดที่เกิดปัญหา', required: false },
  { key: 'after_repair', label: 'ภาพหลังการแก้ไข', required: false },
];

export interface PhotoLink {
  category: PhotoCategory;
  label: string;
  url: string;
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
  pdf_link: string | null;
  photo_links: PhotoLink[] | null;
  video_link: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  record_status: 'Active' | 'Deleted';
}

/** New status workflow (replaces the old 7-status Thai list). Machine codes are
 *  stored in the DB; STATUS_LABELS gives the Thai text shown in the UI. */
export const STATUS_VALUES = [
  'Draft',
  'Open',
  'UnderInvestigation',
  'WaitingParts',
  'Repaired',
  'Closed',
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

export const STATUS_LABELS: Record<StatusValue, string> = {
  Draft: 'แบบร่าง',
  Open: 'เปิดเรื่อง',
  UnderInvestigation: 'กำลังตรวจสอบ',
  WaitingParts: 'รออะไหล่',
  Repaired: 'ซ่อมเสร็จแล้ว',
  Closed: 'ปิดเรื่อง',
};

export const OPEN_STATUSES = STATUS_VALUES.filter((s) => s !== 'Closed');
