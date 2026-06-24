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

export interface ProblemCode {
  id: string;
  label: string;
  system: 'powertrain' | 'other';
  group_name: string | null;
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

export interface PhotoLink {
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
  cause: string | null;
  damaged_parts: string | null;
  attachment: string | null;
  stock_note: string | null;
  lat: number | null;
  lng: number | null;
  pdf_link: string | null;
  photo_links: PhotoLink[] | null;
  video_link: string | null;
  after_photo_link: string | null;
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

export const PHOTO_SLOTS: { key: string; label: string }[] = [
  { key: 'vehicle_number', label: 'รูปหมายเลขรถ' },
  { key: 'hour_meter', label: 'รูปเรือนไมล์' },
  { key: 'far_angle', label: 'รูปมุมไกล' },
  { key: 'near_1', label: 'รูปมุมใกล้ (1)' },
  { key: 'near_2', label: 'รูปมุมใกล้ (2)' },
  { key: 'near_3', label: 'รูปมุมใกล้ (3)' },
  { key: 'near_4', label: 'รูปมุมใกล้ (4)' },
];
