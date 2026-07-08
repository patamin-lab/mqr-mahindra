/**
 * MASP Platform — Lookup Platform: MQR Status workflow.
 *
 * Same re-export rationale as `severity.ts`: `StatusValue`/`STATUS_LABELS`/
 * `MQR_STATUS_TRANSITIONS` are declared in `lib/types.ts` because
 * `lib/db.ts` (Infrastructure) is typed against them, and Infrastructure
 * may not depend upward on this Platform service. This module is the one
 * Lookup Platform facade a business module should import for MQR status
 * display/transition logic, rather than reaching into `lib/types.ts`
 * directly for this specific concern.
 */
import { STATUS_VALUES, STATUS_LABELS, OPEN_STATUSES, MQR_STATUS_TRANSITIONS, canTransitionMqrStatus, type StatusValue } from '@/lib/types';

export { STATUS_VALUES, STATUS_LABELS, OPEN_STATUSES, MQR_STATUS_TRANSITIONS, canTransitionMqrStatus };
export type { StatusValue };
