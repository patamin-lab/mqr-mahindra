import { describe, it, expect, vi, beforeEach } from 'vitest';

// logAuditEvent/logAuditEvents touch Supabase (via @/lib/supabase, which
// throws when env vars aren't set) - stub only those two, keep every other
// @/lib/db export (diffFieldsForAudit in particular) real, so the audit
// event assertions below exercise the actual diff logic, not a mock.
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, logAuditEvent: vi.fn(), logAuditEvents: vi.fn() };
});

import { NtrService } from '../services/ntrService';
import type { NtrRepository } from '../repositories/ntrRepository';
import type { NtrRecord, NtrRecordCreateInput, NtrRecordUpdateInput } from '../types';
import type { VehicleEventPublisher } from '@/features/vehicle-event/publisher';

function makeRecord(overrides: Partial<NtrRecord> = {}): NtrRecord {
  return {
    id: 'ntr-1',
    ntr_number: 'NTR-KTV-2026-000001',
    dealer_id: 'KTV',
    branch_id: null,
    serial: 'SN-1',
    model: 'Model X',
    engine_number: 'ENG-1',
    salesperson: null,
    receiving_person: null,
    customer_title: null,
    customer_first_name: null,
    customer_last_name: null,
    customer_name: 'Somchai',
    customer_phone: '081-2345678',
    customer_address: null,
    customer_subdistrict: null,
    customer_district: null,
    customer_province: null,
    customer_postal_code: null,
    customer_type: null,
    product_family_id: null,
    variant: null,
    retail_date: null,
    delivery_date: '2026-01-01',
    pdi_date: null,
    manufacturing_year: null,
    hour_meter: null,
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    google_maps_url: null,
    photo_customer_tractor_url: 'https://example.com/a.jpg',
    photo_serial_plate_url: 'https://example.com/b.jpg',
    photo_hour_meter_url: 'https://example.com/c.jpg',
    photo_signed_document_url: 'https://example.com/d.jpg',
    photo_customer_tractor_attachment_id: null,
    photo_serial_plate_attachment_id: null,
    photo_hour_meter_attachment_id: null,
    photo_signed_document_attachment_id: null,
    additional_photos: [],
    video_url: null,
    video_attachment_id: null,
    audio_url: null,
    status: 'Completed',
    record_status: 'Active',
    deleted_by: null,
    deleted_at: null,
    import_session_id: null,
    source: 'manual',
    created_by: 'alice',
    created_at: new Date().toISOString(),
    updated_by: 'alice',
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockRepository(): NtrRepository {
  return {
    getById: vi.fn(),
    findActiveBySerial: vi.fn(),
    findActiveBySerials: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listHistory: vi.fn(),
    commitLegacyImportRow: vi.fn(),
  };
}

function makeMockPublisher(): VehicleEventPublisher {
  return {
    publish: vi.fn(),
    publishNtrCreated: vi.fn(),
    publishNtrCompleted: vi.fn(),
    publishMaintenanceCompleted: vi.fn(),
    publishPdiCompleted: vi.fn(),
    publishMqrOpened: vi.fn(),
    publishMqrClosed: vi.fn(),
    publishCampaignAssigned: vi.fn(),
    publishCampaignCompleted: vi.fn(),
    publishPartsRequested: vi.fn(),
    publishPartsDelivered: vi.fn(),
  } as unknown as VehicleEventPublisher;
}

describe('NtrService', () => {
  let repository: NtrRepository;
  let publisher: VehicleEventPublisher;
  let service: NtrService;
  const actor = { username: 'alice' };

  const createInput: NtrRecordCreateInput = {
    dealer_id: 'KTV',
    branch_id: null,
    serial: 'SN-1',
    model: 'Model X',
    engine_number: 'ENG-1',
    salesperson: null,
    receiving_person: null,
    customer_title: null,
    customer_first_name: null,
    customer_last_name: null,
    customer_name: 'Somchai',
    customer_phone: '081-2345678',
    customer_address: null,
    customer_subdistrict: null,
    customer_district: null,
    customer_province: null,
    customer_postal_code: null,
    customer_type: null,
    product_family_id: null,
    variant: null,
    retail_date: null,
    delivery_date: '2026-01-01',
    pdi_date: null,
    manufacturing_year: null,
    hour_meter: null,
    photo_customer_tractor_url: 'https://example.com/a.jpg',
    photo_serial_plate_url: 'https://example.com/b.jpg',
    photo_hour_meter_url: 'https://example.com/c.jpg',
    photo_signed_document_url: 'https://example.com/d.jpg',
    video_url: null,
    audio_url: null,
  };

  beforeEach(() => {
    repository = makeMockRepository();
    publisher = makeMockPublisher();
    service = new NtrService(repository, publisher);
    vi.mocked(repository.findActiveBySerial).mockReset();
    vi.mocked(repository.create).mockReset();
  });

  describe('create', () => {
    it('rejects a serial that already has an active NTR (never create duplicate NTR)', async () => {
      vi.mocked(repository.findActiveBySerial).mockResolvedValue(makeRecord());

      await expect(service.create(createInput, actor)).rejects.toThrow(/already registered/);
      expect(repository.create).not.toHaveBeenCalled();
      expect(publisher.publishNtrCreated).not.toHaveBeenCalled();
      expect(publisher.publishNtrCompleted).not.toHaveBeenCalled();
    });

    it('creates the record and publishes NTR_CREATED + NTR_COMPLETED when the serial is free', async () => {
      vi.mocked(repository.findActiveBySerial).mockResolvedValue(null);
      const created = makeRecord();
      vi.mocked(repository.create).mockResolvedValue(created);

      const result = await service.create(createInput, actor);

      expect(result).toBe(created);
      expect(repository.create).toHaveBeenCalledWith(createInput, actor);
      expect(publisher.publishNtrCreated).toHaveBeenCalledWith(
        expect.objectContaining({ serial: created.serial, referenceId: created.ntr_number, customerName: created.customer_name })
      );
      expect(publisher.publishNtrCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ serial: created.serial, referenceId: created.ntr_number, customerName: created.customer_name })
      );
    });

    it('rejects when actor username is empty', async () => {
      await expect(service.create(createInput, { username: '' })).rejects.toThrow('Actor username is required');
      expect(repository.findActiveBySerial).not.toHaveBeenCalled();
    });

    it('composes customer_name from title/first/last name when structured name fields are provided (avoid duplicate data entry)', async () => {
      vi.mocked(repository.findActiveBySerial).mockResolvedValue(null);
      vi.mocked(repository.create).mockImplementation(async (input) => makeRecord({ customer_name: input.customer_name }));

      const structuredInput: NtrRecordCreateInput = {
        ...createInput,
        customer_name: '', // deliberately blank - should be derived, not required
        customer_title: 'นาย',
        customer_first_name: 'สมชาย',
        customer_last_name: 'ใจดี',
      };

      await service.create(structuredInput, actor);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer_name: 'นาย สมชาย ใจดี' }),
        actor
      );
    });
  });

  describe('update', () => {
    it('throws when the record does not exist', async () => {
      vi.mocked(repository.getById).mockResolvedValue(null);
      const patch: NtrRecordUpdateInput = { customer_name: 'New Name' };

      await expect(service.update('missing-id', patch, actor)).rejects.toThrow('NTR record not found');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('updates and returns the updated record', async () => {
      const existing = makeRecord();
      const updated = makeRecord({ customer_name: 'New Name' });
      vi.mocked(repository.getById).mockResolvedValue(existing);
      vi.mocked(repository.update).mockResolvedValue(updated);

      const result = await service.update(existing.id, { customer_name: 'New Name' }, actor);

      expect(result.customer_name).toBe('New Name');
      expect(repository.update).toHaveBeenCalledWith(existing.id, { customer_name: 'New Name' }, actor);
    });
  });

  describe('delete', () => {
    it('throws when the record does not exist', async () => {
      vi.mocked(repository.getById).mockResolvedValue(null);
      await expect(service.delete('missing-id', actor)).rejects.toThrow('NTR record not found');
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes an existing record', async () => {
      const existing = makeRecord();
      vi.mocked(repository.getById).mockResolvedValue(existing);

      await service.delete(existing.id, actor, 'mistake');

      expect(repository.delete).toHaveBeenCalledWith(existing.id, actor, 'mistake');
    });
  });
});
