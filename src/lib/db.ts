import { getSupabase } from './supabase';
import { seesAllDealers, seesOwnRecordsOnly, canDelete } from './scope';
import { SessionUser, Dealer, Vehicle, ProblemCode, Technician, Branch, MqrRecord, OPEN_STATUSES } from './types';

// ---------- Auth / users ----------

export async function findUserByUsername(username: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertLoginLog(entry: {
  username: string;
  role: string;
  action: string;
  device?: string;
  result: 'ok' | 'fail';
}) {
  const supabase = getSupabase();
  await supabase.from('login_log').insert({
    username: entry.username,
    role: entry.role,
    action: entry.action,
    device: entry.device ?? '',
    result: entry.result,
  });
}

// ---------- Lookups ----------

export async function listDealers(): Promise<Dealer[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('dealers').select('*').order('short_name');
  if (error) throw error;
  return data ?? [];
}

export async function getDealer(dealerId: string): Promise<Dealer | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('dealers').select('*').eq('id', dealerId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Looks up a vehicle by serial, enforcing dealer-scoped "zero leakage". */
export async function getVehicleBySerial(serial: string, dealerId: string | null): Promise<Vehicle | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('serial', serial.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // dealerId === null means the caller sees all dealers (SuperAdmin / CentralAdmin)
  if (dealerId && data.dealer_id && data.dealer_id !== dealerId) return null;
  return data;
}

export async function listProblemCodes(): Promise<ProblemCode[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('problem_codes')
    .select('*')
    .order('group_name')
    .order('label');
  if (error) throw error;
  return data ?? [];
}

export async function listTechnicians(dealerId: string | null): Promise<Technician[]> {
  const supabase = getSupabase();
  let q = supabase.from('technicians').select('*').order('name');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listBranches(dealerId: string | null): Promise<Branch[]> {
  const supabase = getSupabase();
  let q = supabase.from('branches').select('*').order('name');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// ---------- Report number generation ----------

/**
 * Atomic global-per-month counter via the job_seq table + next_job_seq() Postgres
 * function (INSERT ... ON CONFLICT DO UPDATE ... RETURNING). Reuses the existing
 * (dealer_id, year) composite key with a constant sentinel dealer_id so the
 * sequence is global rather than per-dealer, matching the new report number format.
 * Format: QIR-YYMM-0001
 */
export async function nextJobId(): Promise<string> {
  const supabase = getSupabase();
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data, error } = await supabase.rpc('next_job_seq', {
    p_dealer_id: '__QIR_GLOBAL__',
    p_year: yymm,
  });
  if (error) throw error;
  const seq = Number(data);
  const seqStr = String(seq).padStart(4, '0');
  return `QIR-${yymm}-${seqStr}`;
}

// ---------- Records ----------

export interface CreateRecordInput {
  serial: string;
  model: string;
  hours: number | null;
  foundDate: string;
  problemCode: string;
  problemSystem: 'powertrain' | 'other';
  warrantyStatus: string;
  customerName: string;
  customerPhone: string;
  reporterName: string;
  reporterPhone: string;
  attachment: string;
  stockNote: string | null;
  lat: number | null;
  lng: number | null;
  photoLinks: { label: string; url: string }[];
  videoLink: string | null;
}

export async function createRecord(input: CreateRecordInput, session: SessionUser): Promise<MqrRecord> {
  if (!session.dealerId) {
    throw new Error('ผู้ใช้นี้ไม่ได้ผูกกับดีลเลอร์ ไม่สามารถสร้างรายงานได้');
  }
  const dealer = await getDealer(session.dealerId);
  if (!dealer) throw new Error('ไม่พบข้อมูลดีลเลอร์');

  const jobId = await nextJobId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('records')
    .insert({
      job_id: jobId,
      dealer_id: dealer.id,
      serial: input.serial,
      model: input.model,
      hours: input.hours,
      found_date: input.foundDate,
      problem_code: input.problemCode,
      problem_system: input.problemSystem,
      warranty_status: input.warrantyStatus,
      status: 'Open',
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      reporter_name: input.reporterName,
      reporter_phone: input.reporterPhone,
      user_name: session.fullName,
      attachment: input.attachment,
      stock_note: input.stockNote,
      lat: input.lat,
      lng: input.lng,
      photo_links: input.photoLinks,
      video_link: input.videoLink,
      created_by: session.username,
      record_status: 'Active',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MqrRecord;
}

function applyScope(query: any, session: SessionUser) {
  // Soft-deleted records are never visible through normal queries.
  query = query.eq('record_status', 'Active');
  if (!seesAllDealers(session.role)) {
    query = query.eq('dealer_id', session.dealerId ?? '__none__');
  }
  if (seesOwnRecordsOnly(session.role)) {
    query = query.eq('created_by', session.username);
  }
  return query;
}

export interface ListRecordsFilters {
  status?: string;
  q?: string;
  dealerId?: string;
}

export async function listRecords(session: SessionUser, filters: ListRecordsFilters = {}): Promise<MqrRecord[]> {
  const supabase = getSupabase();
  let query = supabase.from('records').select('*').order('created_at', { ascending: false });
  query = applyScope(query, session);

  // SuperAdmin / CentralAdmin may further narrow to one dealer via the UI.
  if (filters.dealerId && seesAllDealers(session.role)) {
    query = query.eq('dealer_id', filters.dealerId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().replace(/[%,]/g, '');
    query = query.or(
      `job_id.ilike.%${term}%,serial.ilike.%${term}%,customer_name.ilike.%${term}%,model.ilike.%${term}%`
    );
  }
  const { data, error } = await query.limit(500);
  if (error) throw error;
  return (data ?? []) as MqrRecord[];
}

/** Fetch one record by job_id, enforcing the same zero-leakage scoping as listRecords. */
export async function getRecordByJobId(jobId: string, session: SessionUser): Promise<MqrRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('records').select('*').eq('job_id', jobId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.record_status === 'Deleted') return null;
  if (!seesAllDealers(session.role) && data.dealer_id !== session.dealerId) return null;
  if (seesOwnRecordsOnly(session.role) && data.created_by !== session.username) return null;
  return data as MqrRecord;
}

export interface UpdateRecordInput {
  status?: string;
  cause?: string;
  damagedParts?: string;
  afterPhotoLink?: string;
  techName?: string;
}

export async function updateRecord(jobId: string, patch: UpdateRecordInput, session: SessionUser): Promise<MqrRecord> {
  // Re-validate scope before allowing the write.
  const existing = await getRecordByJobId(jobId, session);
  if (!existing) throw new Error('ไม่พบรายงานนี้ หรือไม่มีสิทธิ์เข้าถึง');

  const supabase = getSupabase();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: session.username,
  };
  if (patch.status !== undefined) updatePayload.status = patch.status;
  if (patch.cause !== undefined) updatePayload.cause = patch.cause;
  if (patch.damagedParts !== undefined) updatePayload.damaged_parts = patch.damagedParts;
  if (patch.afterPhotoLink !== undefined) updatePayload.after_photo_link = patch.afterPhotoLink;

  const { data, error } = await supabase
    .from('records')
    .update(updatePayload)
    .eq('job_id', jobId)
    .select('*')
    .single();
  if (error) throw error;
  return data as MqrRecord;
}

/** Soft-delete only — never a hard delete. Re-validates scope + the canDelete permission. */
export async function softDeleteRecord(jobId: string, session: SessionUser): Promise<void> {
  if (!canDelete(session.role)) {
    throw new Error('ไม่มีสิทธิ์ลบรายงานนี้');
  }
  const existing = await getRecordByJobId(jobId, session);
  if (!existing) throw new Error('ไม่พบรายงานนี้ หรือไม่มีสิทธิ์เข้าถึง');

  const supabase = getSupabase();
  const { error } = await supabase
    .from('records')
    .update({
      record_status: 'Deleted',
      deleted_by: session.username,
      deleted_at: new Date().toISOString(),
    })
    .eq('job_id', jobId);
  if (error) throw error;
}

/** All prior jobs for a given vehicle serial, scoped the same way as listRecords. */
export async function getVehicleHistory(serial: string, session: SessionUser): Promise<MqrRecord[]> {
  const supabase = getSupabase();
  let query = supabase.from('records').select('*').eq('serial', serial).order('found_date', { ascending: false });
  query = applyScope(query, session);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MqrRecord[];
}

// ---------- Dashboard ----------

export interface DashboardStats {
  totalOpen: number;
  totalThisMonth: number;
  totalAll: number;
  repeatRepairCount: number;
  monthly: { month: string; count: number }[];
  pareto: { label: string; count: number; cumulativePct: number }[];
}

export async function dashboardStats(session: SessionUser, dealerId?: string): Promise<DashboardStats> {
  const records = await listRecords(session, { dealerId });

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const openStatuses = new Set<string>(OPEN_STATUSES);
  const totalOpen = records.filter((r) => openStatuses.has(r.status)).length;
  const totalThisMonth = records.filter((r) => (r.found_date ?? '').slice(0, 7) === thisMonthKey).length;

  // Monthly trend, last 12 months.
  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, 0);
  }
  for (const r of records) {
    const key = (r.found_date ?? r.created_at ?? '').slice(0, 7);
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  }
  const monthly = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count }));

  // Pareto: frequency by problem_code (label), descending, with cumulative %.
  const freq = new Map<string, number>();
  for (const r of records) {
    const key = r.problem_code ?? 'ไม่ระบุ';
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, c]) => sum + c, 0) || 1;
  let cumulative = 0;
  const pareto = sorted.map(([label, count]) => {
    cumulative += count;
    return { label, count, cumulativePct: Math.round((cumulative / total) * 1000) / 10 };
  });

  // Repeat-repair rate: vehicles (by serial) with more than one job.
  const bySerial = new Map<string, number>();
  for (const r of records) {
    if (!r.serial) continue;
    bySerial.set(r.serial, (bySerial.get(r.serial) ?? 0) + 1);
  }
  const repeatRepairCount = Array.from(bySerial.values()).filter((c) => c > 1).length;

  return {
    totalOpen,
    totalThisMonth,
    totalAll: records.length,
    repeatRepairCount,
    monthly,
    pareto: pareto.slice(0, 12),
  };
}
