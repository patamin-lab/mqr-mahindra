import { SessionUser } from '@/lib/types';
import { seesAllDealers, canAccessImportInspection } from '@/lib/scope';
import { getRecordByJobId } from '@/lib/db';
import { SupabaseNtrRepository } from '@/features/ntr/repositories/supabaseNtrRepository';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { DeliveryService } from '@/features/delivery/service';
import { Attachment } from './types';

/**
 * Whether `session` may access the business record that owns `attachment`.
 *
 * The `attachments` table (ADR-010) has no `dealer_id`/`branch_id` of its
 * own - unlike every other module's records, so a request naming an
 * attachment ID alone previously bypassed Dealer/Branch Scope entirely
 * (production regression audit, 2026-07-18). This resolves scope by
 * re-checking the owning record through each module's own already-scope-
 * safe accessor - the same check that module's own `[id]` route already
 * enforces - rather than inventing a second, parallel scope rule here.
 */
export async function canAccessAttachment(attachment: Pick<Attachment, 'module' | 'entityId'>, session: SessionUser): Promise<boolean> {
  switch (attachment.module) {
    case 'mqr':
      return !!(await getRecordByJobId(attachment.entityId, session));
    case 'ntr':
      return !!(await new SupabaseNtrRepository().getById(attachment.entityId, session));
    case 'pm':
      return !!(await new SupabaseMaintenanceRepository().getById(attachment.entityId, session));
    case 'delivery': {
      const delivery = await new DeliveryService().getDelivery(attachment.entityId).catch(() => null);
      if (!delivery) return false;
      return seesAllDealers(session.role) || session.dealerId === delivery.dealerId;
    }
    case 'pdi':
      // Import Inspection is MSEAL-internal, never dealer-visible in detail
      // (ADR-028) - the same role gate `InspectionService.getInspection()`
      // enforces, not a dealer/branch match.
      return canAccessImportInspection(session.role);
    case 'knowledge':
      // Knowledge is an intentionally cross-dealer shared engineering
      // knowledge base (ADR-018) - `GET /api/knowledge-cases/[id]` already
      // allows any authenticated user to read any case, so no additional
      // scope check applies to its evidence attachments either.
      return true;
    default:
      // Unrecognized module - fail closed rather than guess at a rule.
      return false;
  }
}
