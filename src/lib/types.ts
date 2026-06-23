export type Role = 'SuperAdmin' | 'Admin' | 'SuperUser' | 'User';

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
  name: string;
  branch: string | null;
  dealer_id: string | null;
}

export interface Branch {
  id: string;
  name: string;
  dealer_id: string | null;
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
}

export const STATUS_VALUES = [
  'กำลังดำเนินการ',
  'อยู่ระหว่างซ่อม',
  'รออะไหล่',
  'ส่งซ่อมภายนอก',
  'ซ่อมไม่สำเร็จ',
  'ยกเลิกการซ่อม',
  'ซ่อมสำเร็จ',
] as const;

export const OPEN_STATUSES = STATUS_VALUES.filter(
  (s) => s !== 'ซ่อมสำเร็จ' && s !== 'ยกเลิกการซ่อม'
);

export const PHOTO_SLOTS: { key: string; label: string }[] = [
  { key: 'vehicle_number', label: 'รูปหมายเลขรถ' },
  { key: 'hour_meter', label: 'รูปเรือนไมล์' },
  { key: 'far_angle', label: 'รูปมุมไกล' },
  { key: 'near_1', label: 'รูปมุมใกล้ (1)' },
  { key: 'near_2', label: 'รูปมุมใกล้ (2)' },
  { key: 'near_3', label: 'รูปมุมใกล้ (3)' },
  { key: 'near_4', label: 'รูปมุมใกล้ (4)' },
];
