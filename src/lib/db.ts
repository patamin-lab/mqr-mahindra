import { getSupabase } from './supabase';
import { seesAllDealers, seesOwnRecordsOnly, canDelete } from './scope';
import {
  SessionUser,
  Dealer,
  Vehicle,
  ProblemCode,
  Technician,
  Branch,
  MqrRecord,
  OPEN_STATUSES,
  AdminUser,
  Role,
  PhotoLink,
  Severity,
} from './types';

// ---------- Auth / users ----------

/** Escapes ILIKE wildcard/escape characters so a username pattern only ever matches itself. */
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function findUserByUsername(username: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', escapeIlike(username.trim()))
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

/** Count of failed login attempts for a username within the trailing window — backs the login lockout. */
export async function recentFailedLogins(username: string, sinceMinutesAgo: number): Promise<number> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - sinceMinutesAgo * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('login_log')
    .select('id', { count: 'exact', head: true })
    .ilike('username', escapeIlike(username.trim()))
    .eq('result', 'fail')
    .gte('ts', since);
  if (error) throw error;
  return count ?? 0;
}

/** System-initiated, silent upgrade of a legacy SHA-256 hash to salted scrypt after a successful login. */
export async function upgradePasswordHash(id: string, passwordHash: string, passwordSalt: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, password_salt: passwordSalt, password_algo: 'scrypt' })
    .eq('id', id);
  if (error) console.error('password upgrade error', error);
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

/** Active failure-taxonomy entries only - powers the report form's dropdown. */
export async function listProblemCodes(): Promise<ProblemCode[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('problem_codes')
    .select('*')
    .eq('active', true)
    .order('group_name')
    .order('label');
  if (error) throw error;
  return data ?? [];
}

/** Full failure-taxonomy list (including inactive) - admin management UI only. */
export async function listAllProblemCodesAdmin(): Promise<ProblemCode[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('problem_codes').select('*').order('group_name').order('label');
  if (error) throw error;
  return data ?? [];
}

export async function createProblemCode(
  input: {
    code: string | null;
    label: string;
    groupName: string;
    system: 'powertrain' | 'other';
    defaultSeverity: Severity | null;
  },
  session: SessionUser
): Promise<ProblemCode> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('problem_codes')
    .insert({
      code: input.code,
      label: input.label,
      group_name: input.groupName,
      system: input.system,
      default_severity: input.defaultSeverity,
      created_by: session.username,
      updated_by: session.username,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProblemCode;
}

export async function updateProblemCode(
  id: string,
  patch: Partial<{
    code: string | null;
    label: string;
    groupName: string;
    system: 'powertrain' | 'other';
    defaultSeverity: Severity | null;
    active: boolean;
  }>,
  session: SessionUser
): Promise<ProblemCode> {
  const supabase = getSupabase();
  const updatePayload: Record<string, unknown> = { updated_by: session.username, updated_at: new Date().toISOString() };
  if (patch.code !== undefined) updatePayload.code = patch.code;
  if (patch.label !== undefined) updatePayload.label = patch.label;
  if (patch.groupName !== undefined) updatePayload.group_name = patch.groupName;
  if (patch.system !== undefined) updatePayload.system = patch.system;
  if (patch.defaultSeverity !== undefined) updatePayload.default_severity = patch.defaultSeverity;
  if (patch.active !== undefined) updatePayload.active = patch.active;
  const { data, error } = await supabase.from('problem_codes').update(updatePayload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as ProblemCode;
}

/** Active technicians only - used to populate the report form's cascading dropdown. */
export async function listTechnicians(dealerId: string | null, branchName?: string | null): Promise<Technician[]> {
  const supabase = getSupabase();
  let q = supabase.from('technicians').select('*').eq('active', true).order('name');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  const all = data ?? [];
  if (!branchName) return all;
  // Soft cascade: narrow to the selected branch if any technician actually matches it,
  // otherwise fall back to the full dealer list (branch text is free-form master data,
  // entered independently on Technician records, so it may not always line up exactly).
  const narrowed = all.filter((t) => t.branch === branchName);
  return narrowed.length > 0 ? narrowed : all;
}

/** Active branches only - used to populate the report form's cascading dropdown. */
export async function listBranches(dealerId: string | null): Promise<Branch[]> {
  const supabase = getSupabase();
  let q = supabase.from('branches').select('*').eq('active', true).order('name');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface VehicleSearchResult {
  serial: string;
  model: string | null;
  deliveryDate: string | null;
  source: 'supabase' | 'tractor_in_sheet';
}

/**
 * Full list of known vehicle serials straight from the Supabase `vehicles`
 * table (populated by the Tractor IN -> Supabase sync). Powers the report
 * form's serial dropdown so dealer staff pick a unit directly instead of
 * typing + manually checking - model/delivery date come along for free.
 */
export async function listVehicles(dealerId: string | null): Promise<VehicleSearchResult[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('vehicles')
    .select('serial, model, delivery_date')
    .order('serial')
    .limit(5000);
  if (dealerId) query = query.eq('dealer_id', dealerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((v) => ({
    serial: v.serial,
    model: v.model,
    deliveryDate: v.delivery_date,
    source: 'supabase' as const,
  }));
}

/**
 * Partial-match "smart search" across both the Supabase `vehicles` table and the
 * live Tractor IN sheet, merged and de-duplicated by serial. Powers the report
 * form's typeahead so dealer staff no longer need to type the exact serial.
 */
export async function searchVehicles(q: string, dealerId: string | null): Promise<VehicleSearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const supabase = getSupabase();
  let query = supabase.from('vehicles').select('*').ilike('serial', `%${term}%`).limit(20);
  if (dealerId) query = query.eq('dealer_id', dealerId);
  const { data: vehicleRows, error } = await query;
  if (error) throw error;

  const results = new Map<string, VehicleSearchResult>();
  for (const v of vehicleRows ?? []) {
    results.set(v.serial.toUpperCase(), {
      serial: v.serial,
      model: v.model,
      deliveryDate: v.delivery_date,
      source: 'supabase',
    });
  }

  try {
    const { lookupTractorBySerialPartial } = await import('./tractorSheet');
    const tractorRows = await lookupTractorBySerialPartial(term, 20);
    for (const r of tractorRows) {
      const key = r.productSerial.toUpperCase();
      if (!results.has(key)) {
        results.set(key, {
          serial: r.productSerial,
          model: r.productModel || null,
          deliveryDate: null,
          source: 'tractor_in_sheet',
        });
      }
    }
  } catch (err) {
    console.error('tractor sheet search error', err);
  }

  return Array.from(results.values()).slice(0, 20);
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
  severity: Severity;
  peripheralEquipment: string | null;
  customerName: string;
  customerPhone: string;
  reporterName: string;
  reporterPhone: string;
  attachment: string;
  stockNote: string | null;
  lat: number | null;
  lng: number | null;
  photoLinks: PhotoLink[];
  videoLink: string | null;
  /** Only honored when the session role sees all dealers; otherwise forced to session.dealerId. */
  dealerId?: string | null;
  branchId: string | null;
  technicianId: string | null;
  repairDate: string;
  hoursInForRepair: number | null;
}

export async function createRecord(input: CreateRecordInput, session: SessionUser): Promise<MqrRecord> {
  const effectiveDealerId = seesAllDealers(session.role) ? input.dealerId ?? null : session.dealerId;
  if (!effectiveDealerId) {
    throw new Error('กรุณาเลือกดีลเลอร์ ไม่สามารถสร้างรายงานได้');
  }
  const dealer = await getDealer(effectiveDealerId);
  if (!dealer) throw new Error('ไม่พบข้อมูลดีลเลอร์');

  // Resolve branch/technician name snapshots server-side (never trust client-sent text),
  // re-checking that each belongs to the effective dealer to prevent cross-dealer spoofing.
  const supabase = getSupabase();
  let branchName: string | null = null;
  if (input.branchId) {
    const { data: branch } = await supabase.from('branches').select('id, name, dealer_id').eq('id', input.branchId).maybeSingle();
    if (!branch || branch.dealer_id !== dealer.id) throw new Error('สาขาที่เลือกไม่ถูกต้อง');
    branchName = branch.name;
  }
  let technicianName: string | null = null;
  if (input.technicianId) {
    const { data: tech } = await supabase.from('technicians').select('id, name, dealer_id').eq('id', input.technicianId).maybeSingle();
    if (!tech || tech.dealer_id !== dealer.id) throw new Error('ช่างที่เลือกไม่ถูกต้อง');
    technicianName = tech.name;
  }

  if (input.hoursInForRepair !== null && input.hours !== null && input.hoursInForRepair < input.hours) {
    throw new Error('ชั่วโมงการใช้งานขณะนำเข้าซ่อม ต้องไม่น้อยกว่าชั่วโมงขณะพบปัญหา');
  }

  // Defense in depth: the report form requires the 3 mandatory named photo
  // slots (odometer, vehicle serial, damage point 1), but re-check
  // server-side since the client cannot be trusted.
  const REQUIRED_PHOTO_CATEGORIES = ['odometer', 'vehicle_serial', 'damage_point_1'];
  const presentCategories = new Set(input.photoLinks.map((p) => p.category));
  const missingRequired = REQUIRED_PHOTO_CATEGORIES.filter((c) => !presentCategories.has(c as any));
  if (missingRequired.length > 0) {
    throw new Error('กรุณาแนบรูปเรือนไมล์, รูปเลขรถ, และรูปจุดที่เสียหาย 1 ให้ครบ');
  }

  const jobId = await nextJobId();
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
      severity: input.severity,
      peripheral_equipment: input.peripheralEquipment,
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
      branch_id: input.branchId,
      branch_name: branchName,
      technician_id: input.technicianId,
      technician_name: technicianName,
      repair_date: input.repairDate,
      hours_in_for_repair: input.hoursInForRepair,
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
  severity?: Severity;
  cause?: string;
  damagedParts?: string;
  peripheralEquipment?: string;
  technicianAction?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  /** Newly-uploaded photos (e.g. after-repair) to append to the existing photo_links array. */
  addPhotoLinks?: PhotoLink[];
  /** URLs to drop from the existing photo_links array (per-photo delete from the record detail/edit page). */
  removePhotoUrls?: string[];
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
  if (patch.severity !== undefined) updatePayload.severity = patch.severity;
  if (patch.cause !== undefined) updatePayload.cause = patch.cause;
  if (patch.damagedParts !== undefined) updatePayload.damaged_parts = patch.damagedParts;
  if (patch.peripheralEquipment !== undefined) updatePayload.peripheral_equipment = patch.peripheralEquipment;
  if (patch.technicianAction !== undefined) updatePayload.technician_action = patch.technicianAction;
  if (patch.correctiveAction !== undefined) updatePayload.corrective_action = patch.correctiveAction;
  if (patch.preventiveAction !== undefined) updatePayload.preventive_action = patch.preventiveAction;
  if ((patch.addPhotoLinks && patch.addPhotoLinks.length > 0) || (patch.removePhotoUrls && patch.removePhotoUrls.length > 0)) {
    const removeSet = new Set(patch.removePhotoUrls ?? []);
    const remaining = (existing.photo_links ?? []).filter((p) => !removeSet.has(p.url));
    updatePayload.photo_links = [...remaining, ...(patch.addPhotoLinks ?? [])];
  }

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

// ---------- Dashboard (Phase 6: full KPI suite) ----------

/** SLA target (days from found_date to resolution) by severity. Records
 *  without a recognised severity fall back to the Major threshold. */
const SLA_THRESHOLD_DAYS: Record<string, number> = { Critical: 3, Major: 7, Minor: 14 };
const DEFAULT_SLA_THRESHOLD_DAYS = 7;

function slaThresholdFor(severity: string | null): number {
  if (severity && SLA_THRESHOLD_DAYS[severity] != null) return SLA_THRESHOLD_DAYS[severity];
  return DEFAULT_SLA_THRESHOLD_DAYS;
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export interface DashboardFilters {
  dealerId?: string;
  year?: number;
  month?: number; // 1-12
  model?: string;
}

export interface LeaderboardEntry {
  key: string;
  label: string;
  count: number;
  mttrDays: number | null;
}

export interface AgingJobEntry {
  jobId: string;
  model: string | null;
  serial: string | null;
  severity: string | null;
  status: string;
  daysOpen: number;
  slaBreached: boolean;
  dealerId: string;
}

export interface DashboardStats {
  // "Right now" backlog — never affected by the year/month filter, so it
  // always reflects today's real outstanding workload.
  totalOpen: number;
  statusBacklog: { status: string; count: number }[];
  agingBuckets: { bucket: string; count: number }[];
  slaBreachCount: number;
  topAgingJobs: AgingJobEntry[];

  // Period-filtered analytics (respects year/month/model/dealer filters).
  totalAll: number;
  totalThisMonth: number;
  totalRepaired: number;
  totalWaitingParts: number;
  repeatRepairCount: number;
  mttrDays: number | null;
  statusBreakdown: { status: string; count: number }[];
  severityBreakdown: { severity: string; count: number }[];
  monthly: { month: string; count: number }[];
  pareto: { label: string; count: number; cumulativePct: number }[];
  topParts: { label: string; count: number }[];
  byModel: { model: string; count: number }[];
  dealerLeaderboard: LeaderboardEntry[];
  branchLeaderboard: LeaderboardEntry[];
  technicianLeaderboard: LeaderboardEntry[];

  filterOptions: { years: number[]; models: string[] };
}

function applyDealerModelScope(query: any, session: SessionUser, filters: DashboardFilters) {
  query = applyScope(query, session);
  if (filters.dealerId && seesAllDealers(session.role)) {
    query = query.eq('dealer_id', filters.dealerId);
  }
  if (filters.model) {
    query = query.eq('model', filters.model);
  }
  return query;
}

function dateRangeForFilter(year?: number, month?: number): { from: string; to: string } | null {
  if (!year) return null;
  if (month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const toYear = month === 12 ? year + 1 : year;
    const toMonth = month === 12 ? 1 : month + 1;
    return { from, to: `${toYear}-${String(toMonth).padStart(2, '0')}-01` };
  }
  return { from: `${year}-01-01`, to: `${year + 1}-01-01` };
}

export async function dashboardStats(session: SessionUser, filters: DashboardFilters = {}): Promise<DashboardStats> {
  const supabase = getSupabase();

  // 1. Lightweight query to populate the year/model filter dropdowns —
  //    independent of which filters are currently applied.
  let optionsQuery = supabase.from('records').select('found_date, model');
  optionsQuery = applyScope(optionsQuery, session);
  if (filters.dealerId && seesAllDealers(session.role)) {
    optionsQuery = optionsQuery.eq('dealer_id', filters.dealerId);
  }
  const { data: optionsRows, error: optionsErr } = await optionsQuery.limit(5000);
  if (optionsErr) throw optionsErr;
  const years = Array.from(
    new Set(
      (optionsRows ?? [])
        .map((r: any) => (r.found_date ? Number(String(r.found_date).slice(0, 4)) : null))
        .filter((y: number | null): y is number => !!y)
    )
  ).sort((a, b) => b - a);
  const models = Array.from(
    new Set((optionsRows ?? []).map((r: any) => r.model).filter((m: any): m is string => !!m))
  ).sort();

  // 2. Current backlog — open jobs right now, never date-filtered.
  let backlogQuery = supabase.from('records').select('*').in('status', OPEN_STATUSES);
  backlogQuery = applyDealerModelScope(backlogQuery, session, filters);
  const { data: backlogRows, error: backlogErr } = await backlogQuery.limit(5000);
  if (backlogErr) throw backlogErr;
  const backlog = (backlogRows ?? []) as MqrRecord[];

  const now = new Date();
  const nowIso = now.toISOString().slice(0, 10);

  const statusBacklogMap = new Map<string, number>();
  for (const s of OPEN_STATUSES) statusBacklogMap.set(s, 0);
  for (const r of backlog) statusBacklogMap.set(r.status, (statusBacklogMap.get(r.status) ?? 0) + 1);
  const statusBacklog = Array.from(statusBacklogMap.entries()).map(([status, count]) => ({ status, count }));

  const agingBucketDefs = [
    { bucket: '0-3 วัน', min: 0, max: 3 },
    { bucket: '4-7 วัน', min: 4, max: 7 },
    { bucket: '8-15 วัน', min: 8, max: 15 },
    { bucket: '16-30 วัน', min: 16, max: 30 },
    { bucket: '31+ วัน', min: 31, max: Infinity },
  ];
  const agingCounts = agingBucketDefs.map((b) => ({ bucket: b.bucket, count: 0 }));
  let slaBreachCount = 0;
  const agingJobs: AgingJobEntry[] = [];
  for (const r of backlog) {
    const fromDate = r.found_date ?? r.created_at;
    if (!fromDate) continue;
    const daysOpen = daysBetween(fromDate, nowIso);
    const bucketIdx = agingBucketDefs.findIndex((b) => daysOpen >= b.min && daysOpen <= b.max);
    if (bucketIdx >= 0) agingCounts[bucketIdx].count += 1;
    const breached = daysOpen > slaThresholdFor(r.severity);
    if (breached) slaBreachCount += 1;
    agingJobs.push({
      jobId: r.job_id,
      model: r.model,
      serial: r.serial,
      severity: r.severity,
      status: r.status,
      daysOpen,
      slaBreached: breached,
      dealerId: r.dealer_id,
    });
  }
  agingJobs.sort((a, b) => b.daysOpen - a.daysOpen);

  // 3. Period-filtered set — respects year/month/model/dealer.
  let periodQuery = supabase.from('records').select('*');
  periodQuery = applyDealerModelScope(periodQuery, session, filters);
  const range = dateRangeForFilter(filters.year, filters.month);
  if (range) periodQuery = periodQuery.gte('found_date', range.from).lt('found_date', range.to);
  const { data: periodRows, error: periodErr } = await periodQuery.limit(5000);
  if (periodErr) throw periodErr;
  const period = (periodRows ?? []) as MqrRecord[];

  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const totalThisMonth = period.filter((r) => (r.found_date ?? '').slice(0, 7) === thisMonthKey).length;
  const totalRepaired = period.filter((r) => r.status === 'Repaired' || r.status === 'Closed').length;
  const totalWaitingParts = period.filter((r) => r.status === 'WaitingParts').length;

  const statusBreakdownMap = new Map<string, number>();
  const severityBreakdownMap = new Map<string, number>();
  for (const r of period) {
    statusBreakdownMap.set(r.status, (statusBreakdownMap.get(r.status) ?? 0) + 1);
    const sev = r.severity ?? 'ไม่ระบุ';
    severityBreakdownMap.set(sev, (severityBreakdownMap.get(sev) ?? 0) + 1);
  }
  const statusBreakdown = Array.from(statusBreakdownMap.entries()).map(([status, count]) => ({ status, count }));
  const severityBreakdown = Array.from(severityBreakdownMap.entries()).map(([severity, count]) => ({ severity, count }));

  // Monthly trend: selected year's Jan-Dec, or the trailing 12 months when no year is chosen.
  const monthlyMap = new Map<string, number>();
  if (filters.year) {
    for (let m = 1; m <= 12; m++) monthlyMap.set(`${filters.year}-${String(m).padStart(2, '0')}`, 0);
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
  }
  for (const r of period) {
    const key = (r.found_date ?? r.created_at ?? '').slice(0, 7);
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  }
  const monthly = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count }));

  // Pareto: frequency by problem_code, descending, with cumulative %.
  const freq = new Map<string, number>();
  for (const r of period) {
    const key = r.problem_code ?? 'ไม่ระบุ';
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const sortedFreq = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  const totalFreq = sortedFreq.reduce((sum, [, c]) => sum + c, 0) || 1;
  let cumulative = 0;
  const pareto = sortedFreq.map(([label, count]) => {
    cumulative += count;
    return { label, count, cumulativePct: Math.round((cumulative / totalFreq) * 1000) / 10 };
  });

  // Top 10 frequently-replaced parts. damaged_parts is free text, so tokens
  // are split on common delimiters and counted individually.
  const partsFreq = new Map<string, number>();
  for (const r of period) {
    if (!r.damaged_parts) continue;
    const tokens = r.damaged_parts.split(/[,;\/\n]+/).map((t) => t.trim()).filter(Boolean);
    for (const t of tokens) partsFreq.set(t, (partsFreq.get(t) ?? 0) + 1);
  }
  const topParts = Array.from(partsFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  // By vehicle model.
  const modelFreq = new Map<string, number>();
  for (const r of period) {
    const key = r.model ?? 'ไม่ระบุ';
    modelFreq.set(key, (modelFreq.get(key) ?? 0) + 1);
  }
  const byModel = Array.from(modelFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([model, count]) => ({ model, count }));

  // Repeat-repair rate: vehicles (by serial) with more than one job in period.
  const bySerial = new Map<string, number>();
  for (const r of period) {
    if (!r.serial) continue;
    bySerial.set(r.serial, (bySerial.get(r.serial) ?? 0) + 1);
  }
  const repeatRepairCount = Array.from(bySerial.values()).filter((c) => c > 1).length;

  // MTTR — mean days from found_date to repair_date, among resolved jobs with both dates.
  const resolved = period.filter(
    (r) => (r.status === 'Repaired' || r.status === 'Closed') && r.found_date && r.repair_date
  );
  const mttrDays = resolved.length
    ? Math.round(
        (resolved.reduce((sum, r) => sum + daysBetween(r.found_date as string, r.repair_date as string), 0) /
          resolved.length) *
          10
      ) / 10
    : null;

  // Leaderboards — grouped count + average MTTR, by dealer (admins only), branch, technician.
  function buildLeaderboard(
    keyFn: (r: MqrRecord) => string | null,
    labelFn?: (key: string) => string
  ): LeaderboardEntry[] {
    const groups = new Map<string, { count: number; mttrTotal: number; mttrCount: number }>();
    for (const r of period) {
      const key = keyFn(r);
      if (!key) continue;
      const g = groups.get(key) ?? { count: 0, mttrTotal: 0, mttrCount: 0 };
      g.count += 1;
      if ((r.status === 'Repaired' || r.status === 'Closed') && r.found_date && r.repair_date) {
        g.mttrTotal += daysBetween(r.found_date, r.repair_date);
        g.mttrCount += 1;
      }
      groups.set(key, g);
    }
    return Array.from(groups.entries())
      .map(([key, g]) => ({
        key,
        label: labelFn ? labelFn(key) : key,
        count: g.count,
        mttrDays: g.mttrCount ? Math.round((g.mttrTotal / g.mttrCount) * 10) / 10 : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  let dealerLeaderboard: LeaderboardEntry[] = [];
  if (seesAllDealers(session.role)) {
    const allDealers = await listDealers();
    const dealerNameMap = new Map(allDealers.map((d) => [d.id, d.short_name]));
    dealerLeaderboard = buildLeaderboard((r) => r.dealer_id ?? null, (key) => dealerNameMap.get(key) ?? key);
  }
  const branchLeaderboard = buildLeaderboard((r) => r.branch_name ?? null);
  const technicianLeaderboard = buildLeaderboard((r) => r.technician_name ?? null);

  return {
    totalOpen: backlog.length,
    statusBacklog,
    agingBuckets: agingCounts,
    slaBreachCount,
    topAgingJobs: agingJobs.slice(0, 10),

    totalAll: period.length,
    totalThisMonth,
    totalRepaired,
    totalWaitingParts,
    repeatRepairCount,
    mttrDays,
    statusBreakdown,
    severityBreakdown,
    monthly,
    pareto: pareto.slice(0, 12),
    topParts,
    byModel,
    dealerLeaderboard,
    branchLeaderboard,
    technicianLeaderboard,

    filterOptions: { years, models },
  };
}

// ---------- Master data management (Phase 2) ----------
// All writes here are scoped/permission-checked again at the API route layer —
// never rely on the frontend alone (spec section 27).

export async function listAllDealersAdmin(): Promise<Dealer[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('dealers').select('*').order('short_name');
  if (error) throw error;
  return data ?? [];
}

export async function createDealer(
  input: { id: string; short_name: string; full_name: string; address: string | null },
  session: SessionUser
): Promise<Dealer> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('dealers')
    .insert({ ...input, created_by: session.username, updated_by: session.username })
    .select('*')
    .single();
  if (error) throw error;
  return data as Dealer;
}

export async function updateDealer(
  id: string,
  patch: Partial<{ short_name: string; full_name: string; address: string | null; active: boolean }>,
  session: SessionUser
): Promise<Dealer> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('dealers')
    .update({ ...patch, updated_by: session.username, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Dealer;
}

export async function listAllBranchesAdmin(dealerId: string | null): Promise<Branch[]> {
  const supabase = getSupabase();
  let q = supabase.from('branches').select('*').order('name');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createBranch(
  input: { code: string | null; name: string; dealer_id: string },
  session: SessionUser
): Promise<Branch> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('branches')
    .insert({ ...input, created_by: session.username, updated_by: session.username })
    .select('*')
    .single();
  if (error) throw error;
  return data as Branch;
}

export async function updateBranch(
  id: string,
  patch: Partial<{ code: string | null; name: string; active: boolean }>,
  session: SessionUser
): Promise<Branch> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('branches')
    .update({ ...patch, updated_by: session.username, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Branch;
}

export async function listAllTechniciansAdmin(dealerId: string | null): Promise<Technician[]> {
  const supabase = getSupabase();
  let q = supabase.from('technicians').select('*').order('name');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createTechnician(
  input: { code: string | null; name: string; mobile: string | null; branch: string | null; dealer_id: string },
  session: SessionUser
): Promise<Technician> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('technicians')
    .insert({ ...input, created_by: session.username, updated_by: session.username })
    .select('*')
    .single();
  if (error) throw error;
  return data as Technician;
}

export async function updateTechnician(
  id: string,
  patch: Partial<{ code: string | null; name: string; mobile: string | null; branch: string | null; active: boolean }>,
  session: SessionUser
): Promise<Technician> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('technicians')
    .update({ ...patch, updated_by: session.username, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Technician;
}

const ADMIN_USER_COLUMNS =
  'id, username, full_name, email, mobile, role, dealer_id, branch, active, created_at';

export async function listAllUsersAdmin(dealerId: string | null): Promise<AdminUser[]> {
  const supabase = getSupabase();
  let q = supabase.from('users').select(ADMIN_USER_COLUMNS).order('username');
  if (dealerId) q = q.eq('dealer_id', dealerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function getUserById(id: string): Promise<AdminUser | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select(ADMIN_USER_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AdminUser | null;
}

export async function createUserAdmin(
  input: {
    username: string;
    passwordHash: string;
    passwordSalt: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    role: Role;
    dealerId: string | null;
    branch: string | null;
  },
  session: SessionUser
): Promise<AdminUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .insert({
      username: input.username,
      password_hash: input.passwordHash,
      password_salt: input.passwordSalt,
      password_algo: 'scrypt',
      full_name: input.fullName,
      email: input.email,
      mobile: input.mobile,
      role: input.role,
      dealer_id: input.dealerId,
      branch: input.branch,
      active: true,
      created_by: session.username,
      updated_by: session.username,
    })
    .select(ADMIN_USER_COLUMNS)
    .single();
  if (error) throw error;
  return data as AdminUser;
}

export async function updateUserAdmin(
  id: string,
  patch: Partial<{
    fullName: string;
    email: string | null;
    mobile: string | null;
    role: Role;
    dealerId: string | null;
    branch: string | null;
    active: boolean;
  }>,
  session: SessionUser
): Promise<AdminUser> {
  const supabase = getSupabase();
  const updatePayload: Record<string, unknown> = { updated_by: session.username, updated_at: new Date().toISOString() };
  if (patch.fullName !== undefined) updatePayload.full_name = patch.fullName;
  if (patch.email !== undefined) updatePayload.email = patch.email;
  if (patch.mobile !== undefined) updatePayload.mobile = patch.mobile;
  if (patch.role !== undefined) updatePayload.role = patch.role;
  if (patch.dealerId !== undefined) updatePayload.dealer_id = patch.dealerId;
  if (patch.branch !== undefined) updatePayload.branch = patch.branch;
  if (patch.active !== undefined) updatePayload.active = patch.active;

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', id)
    .select(ADMIN_USER_COLUMNS)
    .single();
  if (error) throw error;
  return data as AdminUser;
}

export async function resetUserPassword(
  id: string,
  passwordHash: string,
  passwordSalt: string,
  session: SessionUser
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      password_salt: passwordSalt,
      password_algo: 'scrypt',
      updated_by: session.username,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Hard delete — SuperAdmin only, enforced again at the API route layer. */
export async function deleteUserAdmin(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
}
