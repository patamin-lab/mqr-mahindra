/**
 * Vehicle Event — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase`, same as
 * every other repository in this app - no second Supabase client/connection.
 */
import { getSupabase } from '@/lib/supabase';
import { VehicleEventRepository } from './repository';
import {
  EventDefinition,
  VehicleEvent,
  VehicleEventActor,
  VehicleEventCreateInput,
  VehicleEventFilter,
  VehicleEventListResult,
  VehicleEventUpdateInput,
} from './types';

export class SupabaseVehicleEventRepository implements VehicleEventRepository {
  private readonly client = getSupabase();

  private readonly table = 'vehicle_events';

  async createEvent(input: VehicleEventCreateInput, actor: VehicleEventActor): Promise<VehicleEvent> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = {
      id,
      vehicle_id: input.vehicle_id,
      event_definition_id: input.event_definition_id,
      source_module: input.source_module,
      reference_id: input.reference_id,
      event_datetime: input.event_datetime,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      status: input.status ?? null,
      created_by: actor.username,
      created_at: now,
      updated_by: actor.username,
      updated_at: now,
      record_status: 'Active',
    };

    const { data, error } = await this.client.from(this.table).insert(payload).select('*').single();
    if (error) throw error;
    return data as VehicleEvent;
  }

  async updateEvent(id: string, input: VehicleEventUpdateInput, actor: VehicleEventActor): Promise<VehicleEvent> {
    const updatePayload: Record<string, unknown> = {
      updated_by: actor.username,
      updated_at: new Date().toISOString(),
    };
    if (input.event_datetime !== undefined) updatePayload.event_datetime = input.event_datetime;
    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.metadata !== undefined) updatePayload.metadata = input.metadata;
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data, error } = await this.client
      .from(this.table)
      .update(updatePayload)
      .eq('id', id)
      .eq('record_status', 'Active')
      .select('*')
      .single();
    if (error) throw error;
    return data as VehicleEvent;
  }

  async deleteEvent(id: string, actor: VehicleEventActor): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({
        record_status: 'Deleted',
        deleted_by: actor.username,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('record_status', 'Active');
    if (error) throw error;
  }

  async getVehicleEvents(vehicleId: string): Promise<VehicleEvent[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('record_status', 'Active')
      .order('event_datetime', { ascending: false });
    if (error) throw error;
    return (data ?? []) as VehicleEvent[];
  }

  async getModuleEvents(sourceModule: string): Promise<VehicleEvent[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('source_module', sourceModule)
      .eq('record_status', 'Active')
      .order('event_datetime', { ascending: false });
    if (error) throw error;
    return (data ?? []) as VehicleEvent[];
  }

  async searchEvents(filter: VehicleEventFilter): Promise<VehicleEventListResult> {
    const page = Math.max(filter.page, 1);
    const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // `vehicle_events` has no dealer_id column of its own (per spec's column
    // list) - dealer scoping is enforced via an inner-join filter on the
    // vehicle_id FK instead of a stored column, same "every query enforces
    // dealer scope" rule every other table in this app follows.
    const selectClause = filter.dealerId ? '*, vehicles!inner(dealer_id)' : '*';
    let query = this.client.from(this.table).select(selectClause, { count: 'exact' }).eq('record_status', 'Active');

    if (filter.dealerId) query = query.eq('vehicles.dealer_id', filter.dealerId);
    if (filter.vehicleId) query = query.eq('vehicle_id', filter.vehicleId);
    if (filter.sourceModule) query = query.eq('source_module', filter.sourceModule);
    if (filter.eventDefinitionId) query = query.eq('event_definition_id', filter.eventDefinitionId);
    if (filter.dateFrom) query = query.gte('event_datetime', filter.dateFrom);
    if (filter.dateTo) query = query.lte('event_datetime', filter.dateTo);
    if (filter.search?.trim()) {
      const term = filter.search.trim();
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,reference_id.ilike.%${term}%`);
    }
    query = query.order('event_datetime', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    const rows = (data ?? []) as unknown as (VehicleEvent & { vehicles?: unknown })[];
    return {
      data: rows.map(({ vehicles: _vehicles, ...rest }) => rest as VehicleEvent),
      total: count ?? 0,
    };
  }

  async getEventDefinitionByCode(eventCode: string): Promise<EventDefinition | null> {
    const { data, error } = await this.client
      .from('event_definitions')
      .select('*')
      .eq('event_code', eventCode)
      .maybeSingle();
    if (error) throw error;
    return (data as EventDefinition) ?? null;
  }
}
