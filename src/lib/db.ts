import { getSupabase } from './supabase';
import { seesAllDealers, canDelete } from './scope';
import { resolveDealerScope, resolveBranchScope, canAccessDealerBranch, assertBranchAccess } from './dealerBranchScope';
import { translate } from './i18n/translate';
import { Locale } from './i18n/types';
import {
  SessionUser,
  Dealer,
  Vehicle,
  ProblemCode,
  PmInterval,
  ProductFamily,
  MaintenanceProgramAssignment,
  Technician,
  Branch,
  MqrRecord,
  OPEN_STATUSES,
  AdminUser,
  Role,
  PhotoLink,
  Severity,
  AuditModule,
  AuditLogEntry,
  LogAuditEventInput,
  StatusValue,
  STATUS_LABELS,
  canTransitionMqrStatus,
  MaintenanceProgramVersionStage,
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

export async function getBranchById(branchId: string): Promise<Branch | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('branches').select('*').eq('id', branchId).maybeSingle();
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

/**
 * Active PM Interval Master entries - powers the PM Record form's dropdown.
 * When `model` is given, narrows to only the intervals mapped to that
 * model's Product Family via Maintenance Program Assignment (Phase 5b -
 * maintenance logic must never depend directly on Tractor Model, only on
 * Product Family; a model with no Product Family, or a Product Family with
 * no assigned intervals, correctly returns an empty list, same "zero
 * mapping = zero options" behavior as before, now one hierarchy level up).
 */
export async function listActivePmIntervals(model?: string | null): Promise<PmInterval[]> {
  const supabase = getSupabase();

  let allowedIds: string[] | null = null;
  if (model) {
    const productFamilyId = await getProductFamilyIdForModel(model);
    if (!productFamilyId) return [];

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('maintenance_program_assignments')
      .select('pm_interval_id')
      .eq('product_family_id', productFamilyId);
    if (assignmentError) throw assignmentError;
    allowedIds = Array.from(new Set((assignmentRows ?? []).map((r) => r.pm_interval_id as string)));
    if (allowedIds.length === 0) return [];
  }

  let query = supabase.from('pm_intervals').select('*').eq('active', true);
  if (allowedIds) query = query.in('id', allowedIds);
  const { data, error } = await query.order('interval_hours', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPmInterval(id: string): Promise<PmInterval | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('pm_intervals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Full PM Interval Master list (including inactive) - admin management UI only. */
export async function listAllPmIntervalsAdmin(): Promise<PmInterval[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pm_intervals')
    .select('*')
    .order('interval_hours', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPmInterval(
  input: { label: string; intervalHours: number | null; intervalMonths: number | null },
  session: SessionUser
): Promise<PmInterval> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pm_intervals')
    .insert({
      label: input.label,
      interval_hours: input.intervalHours,
      interval_months: input.intervalMonths,
      created_by: session.username,
      updated_by: session.username,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PmInterval;
}

export async function updatePmInterval(
  id: string,
  patch: Partial<{ label: string; intervalHours: number | null; intervalMonths: number | null; active: boolean }>,
  session: SessionUser
): Promise<PmInterval> {
  const supabase = getSupabase();
  const updatePayload: Record<string, unknown> = { updated_by: session.username, updated_at: new Date().toISOString() };
  if (patch.label !== undefined) updatePayload.label = patch.label;
  if (patch.intervalHours !== undefined) updatePayload.interval_hours = patch.intervalHours;
  if (patch.intervalMonths !== undefined) updatePayload.interval_months = patch.intervalMonths;
  if (patch.active !== undefined) updatePayload.active = patch.active;
  const { data, error } = await supabase.from('pm_intervals').update(updatePayload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as PmInterval;
}

/** Distinct tractor models already known to Vehicle Master - powers the
 *  Product Family <-> Model mapping admin page. A newly-synced model from
 *  the Tractor IN sheet appears here automatically - no code change needed
 *  to add a new tractor model, per spec. */
export async function listDistinctVehicleModels(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('vehicles').select('model').not('model', 'is', null);
  if (error) throw error;
  const models = Array.from(new Set((data ?? []).map((v) => v.model as string)));
  return models.sort((a, b) => a.localeCompare(b));
}

// ---------- Product Family Master (Phase 5b) ----------

export async function listActiveProductFamilies(): Promise<ProductFamily[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('product_families').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data ?? [];
}

/** Full Product Family list (including inactive) - admin management UI only. */
export async function listAllProductFamiliesAdmin(): Promise<ProductFamily[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('product_families').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}


export async function getProductFamily(id: string): Promise<ProductFamily | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('product_families').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProductFamily(
  input: { code: string; name: string; description: string | null },
  session: SessionUser
): Promise<ProductFamily> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('product_families')
    .insert({
      code: input.code,
      name: input.name,
      description: input.description,
      created_by: session.username,
      updated_by: session.username,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProductFamily;
}

export async function updateProductFamily(
  id: string,
  patch: Partial<{ code: string; name: string; description: string | null; active: boolean }>,
  session: SessionUser
): Promise<ProductFamily> {
  const supabase = getSupabase();
  const updatePayload: Record<string, unknown> = { updated_by: session.username, updated_at: new Date().toISOString() };
  if (patch.code !== undefined) updatePayload.code = patch.code;
  if (patch.name !== undefined) updatePayload.name = patch.name;
  if (patch.description !== undefined) updatePayload.description = patch.description;
  if (patch.active !== undefined) updatePayload.active = patch.active;
  const { data, error } = await supabase.from('product_families').update(updatePayload).eq('id', id).select('*').single();
  if (error) throw error;
  return data as ProductFamily;
}

// ---------- Product Family <-> Model mapping (Phase 5b) ----------

/** Resolves the Product Family a given Tractor Model belongs to, or null if
 *  that model hasn't been assigned to one yet. "Every tractor model belongs
 *  to one Product Family" per spec - this is the one place that rule is
 *  enforced by construction (unique(model) on `product_family_models`). */
export async function getProductFamilyIdForModel(model: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('product_family_models')
    .select('product_family_id')
    .eq('model', model)
    .maybeSingle();
  if (error) throw error;
  return (data as { product_family_id: string } | null)?.product_family_id ?? null;
}

export interface ProductFamilyModelRow {
  model: string;
  productFamilyId: string | null;
  productFamilyName: string | null;
}

/** Every known model paired with its assigned Product Family (or null if
 *  unmapped yet) - powers the Product Family <-> Model mapping admin page. */
export async function listProductFamilyModelMap(): Promise<ProductFamilyModelRow[]> {
  const [models, mappingRows, families] = await Promise.all([
    listDistinctVehicleModels(),
    (async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('product_family_models').select('model, product_family_id');
      if (error) throw error;
      return (data ?? []) as { model: string; product_family_id: string }[];
    })(),
    listAllProductFamiliesAdmin(),
  ]);

  const familyNameById = new Map(families.map((f) => [f.id, f.name]));
  const familyIdByModel = new Map(mappingRows.map((r) => [r.model, r.product_family_id]));

  return models.map((model) => {
    const productFamilyId = familyIdByModel.get(model) ?? null;
    return {
      model,
      productFamilyId,
      productFamilyName: productFamilyId ? familyNameById.get(productFamilyId) ?? null : null,
    };
  });
}

/** Upserts the single Product Family a model belongs to (unique per model -
 *  never a many-to-many, unlike the interval<->family assignment below). */
export async function setProductFamilyForModel(
  model: string,
  productFamilyId: string | null,
  session: SessionUser
): Promise<void> {
  const supabase = getSupabase();
  if (!productFamilyId) {
    const { error } = await supabase.from('product_family_models').delete().eq('model', model);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('product_family_models').upsert(
    {
      model,
      product_family_id: productFamilyId,
      created_by: session.username,
      updated_by: session.username,
    },
    { onConflict: 'model' }
  );
  if (error) throw error;
}

// ---------- Maintenance Program Assignment (Phase 5b) ----------
// Product Family <-> Maintenance Interval (`pm_intervals`, reused as the
// "Maintenance Program" master - see PROJECT_STATE.md). Replaces the old
// model-based PM Program mapping (removed this phase).

/** Full Maintenance Program Assignment list (product_family_id <->
 *  pm_interval_id pairs) - admin management UI only. */
export async function listAllMaintenanceProgramAssignmentsAdmin(): Promise<MaintenanceProgramAssignment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('maintenance_program_assignments')
    .select('id, product_family_id, pm_interval_id');
  if (error) throw error;
  return data ?? [];
}

/** The Maintenance Program stages (active `pm_intervals`) assigned to one
 *  Product Family, shaped for `MaintenanceDueService` - powers Vehicle 360 /
 *  the Due Engine, never resolved via Tractor Model. */
export async function listMaintenanceProgramStagesForFamily(
  productFamilyId: string
): Promise<{ pmIntervalId: string; label: string; intervalHours: number | null; intervalMonths: number | null }[]> {
  const supabase = getSupabase();
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('maintenance_program_assignments')
    .select('pm_interval_id')
    .eq('product_family_id', productFamilyId);
  if (assignmentError) throw assignmentError;

  const intervalIds = Array.from(new Set((assignmentRows ?? []).map((r) => r.pm_interval_id as string)));
  if (intervalIds.length === 0) return [];

  const { data: intervalRows, error: intervalError } = await supabase
    .from('pm_intervals')
    .select('id, label, interval_hours, interval_months')
    .eq('active', true)
    .in('id', intervalIds);
  if (intervalError) throw intervalError;

  return (intervalRows ?? []).map((r) => ({
    pmIntervalId: r.id as string,
    label: r.label as string,
    intervalHours: r.interval_hours as number | null,
    intervalMonths: r.interval_months as number | null,
  }));
}

/**
 * Replaces the full set of Product Families mapped to one Maintenance
 * Interval, matching the admin UI's per-interval checkbox multi-select
 * (checked = mapped, unchecked = not mapped): deletes removed pairs,
 * inserts newly-checked ones. A pure junction table with no standalone
 * business/audit value of its own, so a real delete here - rather than a
 * soft-delete flag - is the correct, simplest model (same reasoning as the
 * PM Program mapping it replaces).
 */
/** Returns the set of Product Family ids whose assignment to this interval
 *  actually changed (added or removed) - the caller uses this to know which
 *  families' version snapshot needs re-syncing via
 *  `syncMaintenanceProgramVersion()`. */
export async function setMaintenanceProgramFamilies(
  pmIntervalId: string,
  productFamilyIds: string[],
  session: SessionUser
): Promise<string[]> {
  const supabase = getSupabase();
  const { data: existingRows, error: existingError } = await supabase
    .from('maintenance_program_assignments')
    .select('id, product_family_id')
    .eq('pm_interval_id', pmIntervalId);
  if (existingError) throw existingError;

  const existing = existingRows ?? [];
  const wantedFamilies = new Set(productFamilyIds);
  const existingFamilies = new Set(existing.map((r) => r.product_family_id as string));

  const idsToDelete = existing.filter((r) => !wantedFamilies.has(r.product_family_id as string)).map((r) => r.id);
  const familiesToDelete = existing
    .filter((r) => !wantedFamilies.has(r.product_family_id as string))
    .map((r) => r.product_family_id as string);
  const familiesToInsert = productFamilyIds.filter((f) => !existingFamilies.has(f));

  if (idsToDelete.length > 0) {
    const { error } = await supabase.from('maintenance_program_assignments').delete().in('id', idsToDelete);
    if (error) throw error;
  }
  if (familiesToInsert.length > 0) {
    const { error } = await supabase.from('maintenance_program_assignments').insert(
      familiesToInsert.map((productFamilyId) => ({
        product_family_id: productFamilyId,
        pm_interval_id: pmIntervalId,
        created_by: session.username,
        updated_by: session.username,
      }))
    );
    if (error) throw error;
  }

  return Array.from(new Set([...familiesToDelete, ...familiesToInsert]));
}

// ---------- Maintenance Program Versioning (Production Stabilization Sprint) ----------
// Maintenance history must never be recalculated against today's live
// program definition. Every time a Product Family's resolved stage list
// actually changes (assignment add/remove, or an edit to one of its
// assigned pm_intervals' own hours/months), a new immutable version
// snapshot is created; each vehicle is pinned once to whichever version
// was effective at its retail date, and stays pinned even after a newer
// version is created for the same family.

function sortMaintenanceStages<T extends { intervalHours: number | null; intervalMonths: number | null }>(
  stages: T[]
): T[] {
  return [...stages].sort((a, b) => {
    const ah = a.intervalHours ?? Number.POSITIVE_INFINITY;
    const bh = b.intervalHours ?? Number.POSITIVE_INFINITY;
    if (ah !== bh) return ah - bh;
    const am = a.intervalMonths ?? Number.POSITIVE_INFINITY;
    const bm = b.intervalMonths ?? Number.POSITIVE_INFINITY;
    return am - bm;
  });
}

/** Ensures `productFamilyId`'s current version snapshot matches its live
 *  assignment set, creating a new version (closing out the previous one)
 *  only if they actually differ. Idempotent - safe to call after any admin
 *  mutation that could affect what the family's program resolves to, even
 *  if nothing actually changed for this particular family. */
export async function syncMaintenanceProgramVersion(productFamilyId: string, session: SessionUser): Promise<void> {
  const supabase = getSupabase();
  const liveStages = sortMaintenanceStages(await listMaintenanceProgramStagesForFamily(productFamilyId)).map((s) => ({
    pmIntervalId: s.pmIntervalId as string | null,
    label: s.label,
    intervalHours: s.intervalHours,
    intervalMonths: s.intervalMonths,
  }));

  const { data: currentVersionRow, error: currentVersionError } = await supabase
    .from('maintenance_program_versions')
    .select('id, version_number')
    .eq('product_family_id', productFamilyId)
    .eq('is_current', true)
    .maybeSingle();
  if (currentVersionError) throw currentVersionError;

  let currentStages: typeof liveStages = [];
  if (currentVersionRow) {
    const { data: stageRows, error: stageError } = await supabase
      .from('maintenance_program_version_stages')
      .select('pm_interval_id, label, interval_hours, interval_months')
      .eq('version_id', currentVersionRow.id)
      .order('display_order', { ascending: true });
    if (stageError) throw stageError;
    currentStages = (stageRows ?? []).map((r) => ({
      pmIntervalId: r.pm_interval_id,
      label: r.label,
      intervalHours: r.interval_hours,
      intervalMonths: r.interval_months,
    }));
  }

  if (currentVersionRow && JSON.stringify(currentStages) === JSON.stringify(liveStages)) return;
  // A family with no live stages configured yet and no version created yet
  // has nothing to snapshot - wait until it has at least one assigned
  // interval before creating version 1.
  if (!currentVersionRow && liveStages.length === 0) return;

  const now = new Date().toISOString();
  if (currentVersionRow) {
    const { error } = await supabase
      .from('maintenance_program_versions')
      .update({ is_current: false, effective_to: now })
      .eq('id', currentVersionRow.id);
    if (error) throw error;
  }

  const nextVersionNumber = (currentVersionRow?.version_number ?? 0) + 1;
  const { data: newVersion, error: insertVersionError } = await supabase
    .from('maintenance_program_versions')
    .insert({
      product_family_id: productFamilyId,
      version_number: nextVersionNumber,
      effective_from: now,
      is_current: true,
      created_by: session.username,
    })
    .select('id')
    .single();
  if (insertVersionError) throw insertVersionError;

  if (liveStages.length > 0) {
    const { error: insertStagesError } = await supabase.from('maintenance_program_version_stages').insert(
      liveStages.map((s, i) => ({
        version_id: newVersion.id,
        pm_interval_id: s.pmIntervalId,
        label: s.label,
        interval_hours: s.intervalHours,
        interval_months: s.intervalMonths,
        display_order: i,
      }))
    );
    if (insertStagesError) throw insertStagesError;
  }
}

/** Every Product Family currently assigned a given Maintenance Interval -
 *  used to re-sync every affected family's version snapshot after an admin
 *  edits that interval's own hours/months (not just its assignment set). */
async function listProductFamilyIdsForInterval(pmIntervalId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('maintenance_program_assignments')
    .select('product_family_id')
    .eq('pm_interval_id', pmIntervalId);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.product_family_id as string)));
}

/** Re-syncs the version snapshot for every Product Family assigned this
 *  interval - call after `updatePmInterval()` changes hours/months/label,
 *  since that changes what every assigned family's *live* program resolves
 *  to even though the assignment table itself didn't change. */
export async function syncMaintenanceProgramVersionsForInterval(pmIntervalId: string, session: SessionUser): Promise<void> {
  const familyIds = await listProductFamilyIdsForInterval(pmIntervalId);
  for (const familyId of familyIds) {
    await syncMaintenanceProgramVersion(familyId, session);
  }
}

/**
 * Resolves (and permanently pins, on first resolution) the Maintenance
 * Program Version that applies to one vehicle: whichever version of its
 * Product Family's program was effective at the vehicle's retail date (or
 * "now" if no retail date is known). Once pinned, later edits to the
 * family's program never change what this vehicle evaluates against - a
 * stale pin (the vehicle's Product Family itself changed since) is
 * detected and re-resolved rather than trusted blindly. Returns null if
 * the family has no Maintenance Program configured at all yet.
 */
export async function resolveVehicleProgramVersionStages(
  vehicleId: string,
  productFamilyId: string,
  retailDate: string | null
): Promise<{ versionId: string; versionNumber: number; stages: MaintenanceProgramVersionStage[] } | null> {
  const supabase = getSupabase();

  const { data: vehicleRow, error: vehicleError } = await supabase
    .from('vehicles')
    .select('maintenance_program_version_id')
    .eq('id', vehicleId)
    .maybeSingle();
  if (vehicleError) throw vehicleError;

  let versionId: string | null = vehicleRow?.maintenance_program_version_id ?? null;

  if (versionId) {
    const { data: pinnedVersion, error: pinnedError } = await supabase
      .from('maintenance_program_versions')
      .select('id, product_family_id')
      .eq('id', versionId)
      .maybeSingle();
    if (pinnedError) throw pinnedError;
    // A pin belonging to a different Product Family (the vehicle's model
    // was re-assigned since) is stale and must be re-resolved.
    if (!pinnedVersion || pinnedVersion.product_family_id !== productFamilyId) {
      versionId = null;
    }
  }

  if (!versionId) {
    const asOf = retailDate ?? new Date().toISOString();
    const { data: candidateRows, error: candidateError } = await supabase
      .from('maintenance_program_versions')
      .select('id, effective_from')
      .eq('product_family_id', productFamilyId)
      .lte('effective_from', asOf)
      .order('effective_from', { ascending: false })
      .limit(1);
    if (candidateError) throw candidateError;
    let candidate = candidateRows?.[0] ?? null;

    if (!candidate) {
      // The vehicle's retail date predates every configured version -
      // fall back to the earliest version for this family, if any.
      const { data: earliestRows, error: earliestError } = await supabase
        .from('maintenance_program_versions')
        .select('id, effective_from')
        .eq('product_family_id', productFamilyId)
        .order('effective_from', { ascending: true })
        .limit(1);
      if (earliestError) throw earliestError;
      candidate = earliestRows?.[0] ?? null;
    }

    if (!candidate) return null;
    versionId = candidate.id;

    const { error: pinError } = await supabase
      .from('vehicles')
      .update({ maintenance_program_version_id: versionId })
      .eq('id', vehicleId);
    if (pinError) throw pinError;
  }
  // Unreachable in practice (every path above either returns null or sets
  // versionId to a real value) - narrows the type for TypeScript across the
  // two conditional blocks above.
  if (!versionId) return null;

  const { data: versionRow, error: versionRowError } = await supabase
    .from('maintenance_program_versions')
    .select('id, version_number')
    .eq('id', versionId)
    .single();
  if (versionRowError) throw versionRowError;

  const { data: stageRows, error: stageError } = await supabase
    .from('maintenance_program_version_stages')
    .select('pm_interval_id, label, interval_hours, interval_months')
    .eq('version_id', versionId)
    .order('display_order', { ascending: true });
  if (stageError) throw stageError;

  return {
    versionId,
    versionNumber: versionRow.version_number,
    stages: (stageRows ?? []).map((r) => ({
      pmIntervalId: r.pm_interval_id,
      label: r.label,
      intervalHours: r.interval_hours,
      intervalMonths: r.interval_months,
    })),
  };
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

export interface PmVehicleSearchFilters {
  dealerId?: string | null;
  branchId?: string | null;
  serial?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  limit?: number;
}

export interface PmVehicleSearchResult {
  id: string;
  serial: string;
  model: string | null;
  delivery_date: string | null;
  engine_number: string | null;
  dealer_id: string | null;
  dealer_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  last_pm_number: string | null;
  last_pm_date: string | null;
  last_hour_meter: number | null;
  last_customer_name: string | null;
  next_pm_due: string | null;
}

/**
 * Server-side search over Vehicle Master (`vehicles`) ONLY - never the live
 * Tractor IN sheet (unlike `searchVehicles` above, which QIR's report form
 * uses) - enriched with each match's most recent active PM history (last PM
 * number/date/hour meter, a rough next-due date estimate from the interval's
 * month value, and last customer name, since `vehicles` itself carries no
 * customer field - customer info only ever exists per PM visit). Always
 * capped (default 20, max 50) so this never returns the full table, per the
 * "must scale to 100,000+ vehicles" requirement. Two queries total (vehicles,
 * then one bulk pm_records lookup for the matched serials) - not N+1.
 */
export async function searchVehiclesForPm(filters: PmVehicleSearchFilters): Promise<PmVehicleSearchResult[]> {
  const supabase = getSupabase();
  const limit = Math.min(filters.limit ?? 20, 50);

  // "Customer Name"/"Phone Number" aren't vehicle attributes - narrow to
  // serials that have a matching PM-visit history first, then filter the
  // vehicle query itself by that serial set (AND semantics with the other
  // filters, not OR).
  let historySerials: string[] | null = null;
  if (filters.customerName?.trim() || filters.customerPhone?.trim()) {
    let historyQuery = supabase
      .from('pm_records')
      .select('serial')
      .eq('record_status', 'Active')
      .not('serial', 'is', null)
      .limit(500);
    if (filters.customerName?.trim()) historyQuery = historyQuery.ilike('customer_name', `%${filters.customerName.trim()}%`);
    if (filters.customerPhone?.trim()) historyQuery = historyQuery.ilike('customer_phone', `%${filters.customerPhone.trim()}%`);
    const { data: historyRows, error: historyError } = await historyQuery;
    if (historyError) throw historyError;
    historySerials = Array.from(new Set((historyRows ?? []).map((r: any) => r.serial as string).filter(Boolean)));
    if (historySerials.length === 0) return [];
  }

  let query = supabase
    .from('vehicles')
    .select('id, serial, model, delivery_date, engine_number, dealer_id, branch_id, dealers(short_name, full_name), branches(name)')
    .order('serial')
    .limit(limit);

  if (filters.dealerId) query = query.eq('dealer_id', filters.dealerId);
  if (filters.branchId) query = query.eq('branch_id', filters.branchId);
  if (filters.serial?.trim()) query = query.ilike('serial', `%${filters.serial.trim()}%`);
  if (historySerials) query = query.in('serial', historySerials);

  const { data: vehicleRows, error } = await query;
  if (error) throw error;
  const vehicles = (vehicleRows ?? []) as any[];
  if (vehicles.length === 0) return [];

  const serials = vehicles.map((v) => v.serial);
  const { data: pmRows, error: pmError } = await supabase
    .from('pm_records')
    .select('serial, pm_number, performed_date, hour_meter, customer_name, pm_interval_id')
    .eq('record_status', 'Active')
    .in('serial', serials)
    .order('performed_date', { ascending: false });
  if (pmError) throw pmError;

  const latestBySerial = new Map<string, any>();
  for (const row of (pmRows ?? []) as any[]) {
    if (row.serial && !latestBySerial.has(row.serial)) latestBySerial.set(row.serial, row);
  }

  const intervalIds = Array.from(
    new Set(Array.from(latestBySerial.values()).map((r) => r.pm_interval_id).filter(Boolean))
  );
  const intervalsById = new Map<string, { interval_months: number | null }>();
  if (intervalIds.length > 0) {
    const { data: intervalRows, error: intervalError } = await supabase
      .from('pm_intervals')
      .select('id, interval_months')
      .in('id', intervalIds);
    if (intervalError) throw intervalError;
    for (const iv of (intervalRows ?? []) as any[]) intervalsById.set(iv.id, iv);
  }

  return vehicles.map((v): PmVehicleSearchResult => {
    const last = latestBySerial.get(v.serial);
    let nextPmDue: string | null = null;
    if (last?.performed_date && last?.pm_interval_id) {
      const interval = intervalsById.get(last.pm_interval_id);
      if (interval?.interval_months) {
        const d = new Date(last.performed_date);
        d.setMonth(d.getMonth() + interval.interval_months);
        nextPmDue = d.toISOString().slice(0, 10);
      }
    }
    return {
      id: v.id,
      serial: v.serial,
      model: v.model,
      delivery_date: v.delivery_date,
      engine_number: v.engine_number,
      dealer_id: v.dealer_id,
      dealer_name: v.dealers?.short_name ?? v.dealers?.full_name ?? null,
      branch_id: v.branch_id,
      branch_name: v.branches?.name ?? null,
      last_pm_number: last?.pm_number ?? null,
      last_pm_date: last?.performed_date ?? null,
      last_hour_meter: last?.hour_meter ?? null,
      last_customer_name: last?.customer_name ?? null,
      next_pm_due: nextPmDue,
    };
  });
}

export interface NtrTractorSearchFilters {
  dealerId?: string | null;
  branchId?: string | null;
  serial?: string | null;
  engineNumber?: string | null;
  model?: string | null;
  limit?: number;
}

export interface NtrTractorSearchResult {
  id: string;
  serial: string;
  model: string | null;
  delivery_date: string | null;
  engine_number: string | null;
  dealer_id: string | null;
  dealer_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  /** Non-null when this tractor already has an active NTR on file - the
   *  Tractor Search step uses this to warn "already registered" instead of
   *  letting a dealer create a duplicate NTR for the same tractor. */
  existing_ntr_number: string | null;
  /** Synced from the Tractor IN Google Sheet by `TractorInSyncService` -
   *  read-only here, never resolved/derived by this search itself. Null
   *  until the sheet has the corresponding columns and a sync has run. */
  product_family_id: string | null;
  product_family_name: string | null;
  sub_model: string | null;
}

/**
 * Tractor Search for the NTR module - searches Vehicle Master (`vehicles`)
 * only, by serial/engine number/model/Product Family/dealer, and reports
 * whether each match already has an active NTR. Mirrors
 * `searchVehiclesForPm()`'s two-query shape (vehicles, then one bulk
 * `ntr_records` lookup for the matched serials) - never N+1, always capped.
 */
export async function searchTractorsForNtr(filters: NtrTractorSearchFilters): Promise<NtrTractorSearchResult[]> {
  const supabase = getSupabase();
  const limit = Math.min(filters.limit ?? 20, 50);

  let query = supabase
    .from('vehicles')
    .select(
      'id, serial, model, delivery_date, engine_number, dealer_id, branch_id, product_family_id, sub_model, dealers(short_name, full_name), branches(name), product_families(name)'
    )
    .order('serial')
    .limit(limit);

  if (filters.dealerId) query = query.eq('dealer_id', filters.dealerId);
  if (filters.branchId) query = query.eq('branch_id', filters.branchId);
  if (filters.serial?.trim()) query = query.ilike('serial', `%${filters.serial.trim()}%`);
  if (filters.engineNumber?.trim()) query = query.ilike('engine_number', `%${filters.engineNumber.trim()}%`);
  if (filters.model?.trim()) query = query.ilike('model', `%${filters.model.trim()}%`);

  const { data: vehicleRows, error } = await query;
  if (error) throw error;
  const vehicles = (vehicleRows ?? []) as any[];
  if (vehicles.length === 0) return [];

  const serials = vehicles.map((v) => v.serial);
  const { data: ntrRows, error: ntrError } = await supabase
    .from('ntr_records')
    .select('serial, ntr_number')
    .eq('record_status', 'Active')
    .in('serial', serials);
  if (ntrError) throw ntrError;
  const ntrNumberBySerial = new Map((ntrRows ?? []).map((r: any) => [r.serial as string, r.ntr_number as string]));

  return vehicles.map((v): NtrTractorSearchResult => ({
    id: v.id,
    serial: v.serial,
    model: v.model,
    delivery_date: v.delivery_date,
    engine_number: v.engine_number,
    dealer_id: v.dealer_id,
    dealer_name: v.dealers?.short_name ?? v.dealers?.full_name ?? null,
    branch_id: v.branch_id,
    branch_name: v.branches?.name ?? null,
    existing_ntr_number: ntrNumberBySerial.get(v.serial) ?? null,
    product_family_id: v.product_family_id ?? null,
    product_family_name: v.product_families?.name ?? null,
    sub_model: v.sub_model ?? null,
  }));
}

export interface NtrTractorCreateInput {
  serial: string;
  model: string | null;
  engineNumber: string | null;
  dealerId: string;
  branchId: string | null;
  deliveryDate: string | null;
  /** Traceability metadata only, not business logic - set only by the
   *  Legacy Import service (see docs/standards/SECURITY_STANDARD.md). */
  importSessionId?: string | null;
}

/**
 * Registers a tractor that has no `vehicles` row yet (NTR's "Create
 * Tractor" step - the one new capability this module adds on top of the
 * otherwise externally-synced `vehicles` table, see root CLAUDE.md §8.6).
 * `serial` is unique at the database level, so a race against a concurrent
 * insert (or the Tractor-IN sheet sync) surfaces as a clean constraint
 * violation rather than a silent duplicate - callers should re-check
 * `getVehicleBySerial()` on error rather than assume this always succeeds.
 */
export async function createVehicleManual(input: NtrTractorCreateInput): Promise<Vehicle> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      serial: input.serial.trim(),
      model: input.model,
      engine_number: input.engineNumber,
      dealer_id: input.dealerId,
      branch_id: input.branchId,
      delivery_date: input.deliveryDate,
      import_session_id: input.importSessionId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Vehicle;
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
 * Business-facing MQR report number: MQR-{DealerCode}-{Year}-{Running}
 * (docs/standards/DOMAIN_LANGUAGE_STANDARD.md's Dealer Standard - e.g.
 * "MQR-KTV-2026-000001"). Reuses the same job_seq table / next_job_seq()
 * Postgres RPC (INSERT ... ON CONFLICT DO UPDATE ... RETURNING) that PM's
 * pm_number generation already uses (see nextPmNumber() in
 * supabaseMaintenanceRepository.ts) - both modules share the table, but
 * each gets its own independent per-dealer-per-year counter because the
 * RPC's `dealer_id` argument is really just an opaque bucket key: PM calls
 * it with the bare dealer code, MQR calls it with a `MQR:`-prefixed key,
 * so the two modules' running numbers never interleave for the same
 * dealer/year even though the report number itself only shows the plain
 * dealer code.
 *
 * Supersedes the previous global QIR-YYMM-#### scheme (kept as-is for
 * already-issued job_id values - this only changes what's generated for
 * new records going forward, per the explicit migration approval).
 */
export async function nextJobId(dealerId: string): Promise<string> {
  const supabase = getSupabase();
  const year = String(new Date().getFullYear());
  const { data, error } = await supabase.rpc('next_job_seq', {
    p_dealer_id: `MQR:${dealerId}`,
    p_year: year,
  });
  if (error) throw error;
  const seq = Number(data);
  return `MQR-${dealerId}-${year}-${String(seq).padStart(6, '0')}`;
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
  gpsAccuracy?: number | null;
  googleMapsUrl?: string | null;
  photoLinks: PhotoLink[];
  videoLink: string | null;
  videoAttachmentId?: string | null;
  /** Only honored when the session role sees all dealers; otherwise forced to session.dealerId. */
  dealerId?: string | null;
  branchId: string | null;
  technicianId: string | null;
  repairDate: string;
  hoursInForRepair: number | null;
}

export async function createRecord(input: CreateRecordInput, session: SessionUser): Promise<MqrRecord> {
  const { dealerId: effectiveDealerId } = resolveDealerScope(session, input.dealerId ?? null);
  if (!effectiveDealerId) {
    throw new Error('กรุณาเลือกดีลเลอร์ ไม่สามารถสร้างรายงานได้');
  }
  const dealer = await getDealer(effectiveDealerId);
  if (!dealer) throw new Error('ไม่พบข้อมูลดีลเลอร์');

  // Dealer/Branch Scope Platform Standard: a DealerUser is always pinned
  // to their own branch (never whatever the client's report-form selector
  // sent) - "branch is the ownership boundary." Every other role may pick
  // any branch within the resolved dealer, validated via the shared
  // `assertBranchAccess()` (replaces the old inline branches-table query).
  const supabase = getSupabase();
  const { branchId: effectiveBranchId } = resolveBranchScope(session, effectiveDealerId, input.branchId);
  let branchName: string | null = null;
  if (effectiveBranchId) {
    try {
      await assertBranchAccess(effectiveDealerId, effectiveBranchId);
    } catch {
      throw new Error('สาขาที่เลือกไม่ถูกต้อง');
    }
    const { data: branch } = await supabase.from('branches').select('name').eq('id', effectiveBranchId).maybeSingle();
    branchName = branch?.name ?? null;
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

  const jobId = await nextJobId(dealer.id);
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
      gps_accuracy: input.gpsAccuracy ?? null,
      google_maps_url: input.googleMapsUrl ?? null,
      photo_links: input.photoLinks,
      video_link: input.videoLink,
      video_attachment_id: input.videoAttachmentId ?? null,
      branch_id: effectiveBranchId,
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
  const created = data as MqrRecord;
  await logAuditEvent({
    module: 'mqr',
    recordId: created.id,
    recordRef: created.job_id,
    eventType: 'Created',
    performedBy: session.username,
  });
  return created;
}

/**
 * DealerBranchScope Platform Standard — the one shared dealer/branch (and
 * soft-delete) scoping function every MQR `records` query goes through.
 * `requested` is whatever dealer/branch the caller (a privileged role's UI
 * filter) asked for; a non-privileged role's own session always wins
 * regardless of what's requested (`resolveDealerScope`/`resolveBranchScope`
 * enforce this). `DealerUser` visibility is now branch-scoped (every
 * record in their own branch, not just ones they personally created) — a
 * service branch is a team, not an individual.
 */
export function applyScope(query: any, session: SessionUser, requested: { dealerId?: string | null; branchId?: string | null } = {}) {
  // Soft-deleted records are never visible through normal queries.
  query = query.eq('record_status', 'Active');

  const { dealerId } = resolveDealerScope(session, requested.dealerId);
  if (dealerId) {
    query = query.eq('dealer_id', dealerId);
  } else if (!seesAllDealers(session.role)) {
    query = query.eq('dealer_id', '__none__');
  }

  const { branchId } = resolveBranchScope(session, dealerId, requested.branchId);
  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else if (session.role === 'DealerUser') {
    // No accessible branch assigned yet — fail closed, never fail open.
    // `branch_id` is a uuid column, so the sentinel must be a syntactically
    // valid (but unassignable) uuid, not an arbitrary string like
    // `dealer_id`'s text-column sentinel above.
    query = query.eq('branch_id', '00000000-0000-0000-0000-000000000000');
  }
  return query;
}

export interface ListRecordsFilters {
  status?: string;
  q?: string;
  dealerId?: string;
  branchId?: string;
  /** Inclusive `found_date` range, ISO `YYYY-MM-DD`. */
  dateFrom?: string;
  dateTo?: string;
}

export async function listRecords(session: SessionUser, filters: ListRecordsFilters = {}): Promise<MqrRecord[]> {
  const supabase = getSupabase();
  let query = supabase.from('records').select('*').order('created_at', { ascending: false });
  query = applyScope(query, session, { dealerId: filters.dealerId, branchId: filters.branchId });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('found_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('found_date', filters.dateTo);
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

export interface ListRecordsPaginatedFilters extends ListRecordsFilters {
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface PaginatedRecords {
  records: MqrRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/** Server-side paginated/filtered records list, replacing the old
 *  `listRecords()` + `.limit(500)` pattern that silently truncated any
 *  dealer/period with more than 500 records with no indication to the user
 *  (found in the production-stabilization audit). `listRecords()` itself is
 *  kept unchanged for the bulk-export route, which still needs the whole
 *  matching set rather than one page of it. */
export async function listRecordsPaginated(
  session: SessionUser,
  filters: ListRecordsPaginatedFilters = {}
): Promise<PaginatedRecords> {
  const supabase = getSupabase();
  const pageSize = Math.min(Math.max(Math.trunc(filters.pageSize ?? 50), 1), 200);
  const page = Math.max(Math.trunc(filters.page ?? 1), 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('records').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  query = applyScope(query, session, { dealerId: filters.dealerId, branchId: filters.branchId });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('found_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('found_date', filters.dateTo);
  }
  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().replace(/[%,]/g, '');
    query = query.or(
      `job_id.ilike.%${term}%,serial.ilike.%${term}%,customer_name.ilike.%${term}%,model.ilike.%${term}%,branch_name.ilike.%${term}%,technician_name.ilike.%${term}%,problem_code.ilike.%${term}%`
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { records: (data ?? []) as MqrRecord[], total: count ?? 0, page, pageSize };
}

/** Fetch one record by job_id, enforcing the same zero-leakage scoping as listRecords. */
export async function getRecordByJobId(jobId: string, session: SessionUser): Promise<MqrRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('records').select('*').eq('job_id', jobId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.record_status === 'Deleted') return null;
  if (!canAccessDealerBranch(session, data.dealer_id, data.branch_id ?? null)) return null;
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

/** Thai labels for the RCA-family free-text fields, reused between the audit
 *  trail and (eventually) any other place these fields need a display name -
 *  kept in one place rather than re-typed at each call site. Matches the
 *  labels shown on the update form itself (`update-form.tsx`). */
const MQR_RCA_FIELD_LABELS: Record<string, string> = {
  cause: 'สาเหตุ',
  damaged_parts: 'ชิ้นส่วนที่เสียหาย',
  technician_action: 'การดำเนินการของช่าง',
  corrective_action: 'การแก้ไข (Corrective Action)',
  preventive_action: 'การป้องกัน (Preventive Action)',
};

export async function updateRecord(
  jobId: string,
  patch: UpdateRecordInput,
  session: SessionUser,
  locale: Locale = 'th'
): Promise<MqrRecord> {
  // Re-validate scope before allowing the write.
  const existing = await getRecordByJobId(jobId, session);
  if (!existing) throw new Error('ไม่พบรายงานนี้ หรือไม่มีสิทธิ์เข้าถึง');

  if (patch.status !== undefined && patch.status !== existing.status) {
    if (!canTransitionMqrStatus(existing.status as StatusValue, patch.status as StatusValue, session.role)) {
      throw new Error(
        translate(locale, 'validation.invalidStatusTransition', {
          from: translate(locale, `mqrStatus.${existing.status}`),
          to: translate(locale, `mqrStatus.${patch.status}`),
        })
      );
    }
  }

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
  const updated = data as MqrRecord;

  const auditBase = { module: 'mqr' as const, recordId: updated.id, recordRef: updated.job_id, performedBy: session.username };
  const events: LogAuditEventInput[] = [];
  if (patch.status !== undefined && patch.status !== existing.status) {
    events.push({
      ...auditBase,
      eventType: 'StatusChanged',
      oldValue: STATUS_LABELS[existing.status as StatusValue] ?? existing.status,
      newValue: STATUS_LABELS[updated.status as StatusValue] ?? updated.status,
    });
  }
  if (patch.severity !== undefined && patch.severity !== existing.severity) {
    events.push({ ...auditBase, eventType: 'SeverityChanged', oldValue: existing.severity, newValue: updated.severity });
  }
  events.push(
    ...diffFieldsForAudit(auditBase, MQR_RCA_FIELD_LABELS, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>).map(
      (e) => ({ ...e, eventType: 'RcaUpdated' as const })
    )
  );
  for (const p of patch.addPhotoLinks ?? []) {
    events.push({ ...auditBase, eventType: 'AttachmentAdded', fieldName: p.label, newValue: p.url });
  }
  for (const url of patch.removePhotoUrls ?? []) {
    events.push({ ...auditBase, eventType: 'AttachmentRemoved', oldValue: url });
  }
  await logAuditEvents(events);

  return updated;
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

  await logAuditEvent({
    module: 'mqr',
    recordId: existing.id,
    recordRef: existing.job_id,
    eventType: 'Deleted',
    performedBy: session.username,
  });
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

// ---------- Audit Log (shared: MQR `records` + PM `pm_records`) ----------

/** Writes one immutable audit-log row. Never throws-and-swallows - a failed
 *  audit write must surface as a real error, since a silent audit gap would
 *  defeat the point of the trail. */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('record_audit_log').insert({
    module: input.module,
    record_id: input.recordId,
    record_ref: input.recordRef,
    event_type: input.eventType,
    field_name: input.fieldName ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    performed_by: input.performedBy,
  });
  if (error) throw error;
}

/** Batched form of `logAuditEvent`, for a single business action that
 *  produces several field-level entries at once (e.g. one edit that changes
 *  three fields becomes three rows, inserted together). */
export async function logAuditEvents(inputs: LogAuditEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('record_audit_log').insert(
    inputs.map((input) => ({
      module: input.module,
      record_id: input.recordId,
      record_ref: input.recordRef,
      event_type: input.eventType,
      field_name: input.fieldName ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      performed_by: input.performedBy,
    }))
  );
  if (error) throw error;
}

/** Defensive cap - a long-lived, frequently-edited record could otherwise
 *  grow this response unbounded (RC1 production-readiness review). The
 *  Timeline UI shows newest-first and 300 entries is already far more
 *  than a human reviews in one sitting. */
const AUDIT_LOG_MAX_ENTRIES = 300;

export async function listAuditLog(module: AuditModule, recordId: string): Promise<AuditLogEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('record_audit_log')
    .select('*')
    .eq('module', module)
    .eq('record_id', recordId)
    .order('performed_at', { ascending: false })
    .limit(AUDIT_LOG_MAX_ENTRIES);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    module: row.module,
    recordId: row.record_id,
    recordRef: row.record_ref,
    eventType: row.event_type,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
  }));
}

/** Compares `before`/`after` on each key in `fieldLabels` and returns one
 *  `FieldChanged` audit input per key whose stringified value actually
 *  changed (null/undefined both normalize to `null` so "cleared" is not
 *  reported as a false-positive change from `undefined` to `null`). Callers
 *  pass only the base fields (module/recordId/recordRef/performedBy) - this
 *  never touches Supabase itself, so it's easy to unit test the diff logic
 *  in isolation from the insert. */
export function diffFieldsForAudit(
  base: Omit<LogAuditEventInput, 'eventType' | 'fieldName' | 'oldValue' | 'newValue'>,
  fieldLabels: Record<string, string>,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): LogAuditEventInput[] {
  const events: LogAuditEventInput[] = [];
  for (const [key, label] of Object.entries(fieldLabels)) {
    const oldRaw = before[key];
    const newRaw = after[key];
    const oldStr = oldRaw === null || oldRaw === undefined ? null : String(oldRaw);
    const newStr = newRaw === null || newRaw === undefined ? null : String(newRaw);
    if (oldStr === newStr) continue;
    events.push({ ...base, eventType: 'FieldChanged', fieldName: label, oldValue: oldStr, newValue: newStr });
  }
  return events;
}

// ---------- Dashboard (Phase 6: full KPI suite) ----------

/** SLA target (days from found_date to resolution) by severity. Records
 * without a recognised severity fall back to the Major threshold. */
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
  branchId?: string;
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

  // Period-filtered analytics (respects year/month/model/dealer/branch filters).
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
  query = applyScope(query, session, { dealerId: filters.dealerId, branchId: filters.branchId });
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
  // independent of which filters are currently applied.
  let optionsQuery = supabase.from('records').select('found_date, model');
  optionsQuery = applyScope(optionsQuery, session, { dealerId: filters.dealerId, branchId: filters.branchId });
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

  // 3. Period-filtered set — respects year/month/model/dealer/branch.
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
  session: SessionUser
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      updated_by: session.username,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export interface TractorInSyncHealth {
  lastSyncTime: string | null;
  inserted: number | null;
  updated: number | null;
  failed: number | null;
  totalVehicles: number;
  syncStatus: 'success' | 'partial_failure' | 'never_run';
}

/** Powers `GET /api/admin/tractor-in/health` - the last recorded
 *  `tractor_in_sync_runs` row (see `TractorInSyncService`) plus a live
 *  `vehicles` count, so an operator can tell "did the last sync work" and
 *  "is it stale" without querying Supabase directly. */
export async function getTractorInSyncHealth(): Promise<TractorInSyncHealth> {
  const supabase = getSupabase();

  const [{ data: lastRun, error: runError }, { count: totalVehicles, error: countError }] = await Promise.all([
    supabase
      .from('tractor_in_sync_runs')
      .select('started_at, inserted, updated, failed, status')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }),
  ]);
  if (runError) throw runError;
  if (countError) throw countError;

  return {
    lastSyncTime: lastRun?.started_at ?? null,
    inserted: lastRun?.inserted ?? null,
    updated: lastRun?.updated ?? null,
    failed: lastRun?.failed ?? null,
    totalVehicles: totalVehicles ?? 0,
    syncStatus: lastRun ? (lastRun.status as 'success' | 'partial_failure') : 'never_run',
  };
}

/** Hard delete — SuperAdmin only, enforced again at the API route layer. */
export async function deleteUserAdmin(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
}
