import { z } from 'zod';
import { EVENT_CODES } from './types';

const requiredTrimmedString = (message: string) =>
  z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(1, message));

const nullableTrimmedString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim().length > 0 ? val.trim() : null),
  z.string().min(1).nullable()
);

/**
 * `POST /api/platform/events` body — routes through `VehicleEventPublisher`,
 * so callers identify the vehicle/event type the same ergonomic way every
 * publish*() convenience method does (serial + eventCode), never by
 * internal `vehicle_id`/`event_definition_id` uuids.
 */
export const VehicleEventPublishBodySchema = z.object({
  eventCode: z.enum(EVENT_CODES, { errorMap: () => ({ message: 'eventCode ต้องเป็นรหัสเหตุการณ์ที่รู้จัก' }) }),
  serial: requiredTrimmedString('serial is required'),
  sourceModule: requiredTrimmedString('sourceModule is required'),
  referenceId: requiredTrimmedString('referenceId is required'),
  eventDatetime: nullableTrimmedString.optional(),
  title: requiredTrimmedString('title is required'),
  description: nullableTrimmedString.optional(),
  metadata: z.record(z.unknown()).optional(),
  status: nullableTrimmedString.optional(),
});
export type VehicleEventPublishBody = z.infer<typeof VehicleEventPublishBodySchema>;

/** `PUT /api/platform/events` body — a direct partial patch via
 *  `VehicleEventService.updateEvent()` (no eventCode/serial resolution
 *  needed for an update). `event_datetime`/`title` are NOT NULL columns,
 *  so when present they must be non-empty; `description`/`metadata`/
 *  `status` are nullable and may be explicitly cleared. */
export const VehicleEventUpdateBodySchema = z.object({
  id: requiredTrimmedString('id is required'),
  eventDatetime: requiredTrimmedString('eventDatetime ต้องไม่ว่าง').optional(),
  title: requiredTrimmedString('title ต้องไม่ว่าง').optional(),
  description: nullableTrimmedString.optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  status: nullableTrimmedString.optional(),
});
export type VehicleEventUpdateBody = z.infer<typeof VehicleEventUpdateBodySchema>;
