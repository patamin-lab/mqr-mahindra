import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetVehicleBySerial, mockUpdateVehicleDeliveryInfo, mockResolveVehicleProgramVersionStages } = vi.hoisted(() => ({
  mockGetVehicleBySerial: vi.fn(),
  mockUpdateVehicleDeliveryInfo: vi.fn(),
  mockResolveVehicleProgramVersionStages: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getVehicleBySerial: mockGetVehicleBySerial,
  updateVehicleDeliveryInfo: mockUpdateVehicleDeliveryInfo,
  resolveVehicleProgramVersionStages: mockResolveVehicleProgramVersionStages,
}));

import { runNtrWarrantyOrchestration } from './ntrPostCreateOrchestration';
import type { DeliveryService } from '@/features/delivery';
import type { NtrRecord } from '../types';

const ACTOR = { username: 'tester' };

function baseRecord(overrides: Partial<NtrRecord> = {}): NtrRecord {
  return {
    id: 'ntr-1',
    ntr_number: 'NTR-2026-000001',
    dealer_id: 'D1',
    branch_id: null,
    serial: 'SN-001',
    model: 'Model X',
    engine_number: null,
    salesperson: null,
    receiving_person: null,
    customer_title: null,
    customer_first_name: null,
    customer_last_name: null,
    customer_name: 'John Doe',
    customer_phone: '0800000000',
    customer_address: null,
    customer_subdistrict: null,
    customer_district: null,
    customer_province: null,
    customer_postal_code: null,
    customer_type: null,
    product_family_id: 'PF-1',
    variant: null,
    retail_date: '2026-01-01',
    delivery_date: '2026-01-02',
    pdi_date: null,
    pdi_number: null,
    manufacturing_year: null,
    hour_meter: null,
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    google_maps_url: null,
    photo_customer_id_url: null,
    photo_customer_tractor_url: null,
    photo_serial_plate_url: null,
    photo_hour_meter_url: null,
    photo_signed_document_url: null,
    ...overrides,
  } as unknown as NtrRecord;
}

function makeDeliveryService(overrides: Partial<DeliveryService> = {}): DeliveryService {
  return {
    activateWarrantyFromNtr: vi.fn(() => Promise.resolve({})),
    ...overrides,
  } as unknown as DeliveryService;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runNtrWarrantyOrchestration', () => {
  it('updates vehicles.delivery_date/product_family_id/dealer_id/branch_id, activates Warranty via NTR, and resolves the PM schedule when the vehicle and product family exist', async () => {
    const vehicle = { id: 'veh-1' };
    mockGetVehicleBySerial.mockResolvedValue(vehicle);
    const record = baseRecord();
    const deliveryService = makeDeliveryService();

    await runNtrWarrantyOrchestration(record, ACTOR, deliveryService);

    expect(mockGetVehicleBySerial).toHaveBeenCalledWith('SN-001', expect.anything());
    expect(mockUpdateVehicleDeliveryInfo).toHaveBeenCalledWith('veh-1', {
      deliveryDate: '2026-01-02',
      productFamilyId: 'PF-1',
      dealerId: 'D1',
      branchId: null,
    });
    expect(deliveryService.activateWarrantyFromNtr).toHaveBeenCalledWith(
      { vehicleId: 'veh-1', serial: 'SN-001', dealerId: 'D1', ntrId: 'ntr-1', deliveryDate: '2026-01-02' },
      ACTOR
    );
    expect(mockResolveVehicleProgramVersionStages).toHaveBeenCalledWith('veh-1', 'PF-1', '2026-01-02');
  });

  it('does not resolve a PM schedule when the NTR record has no product_family_id', async () => {
    mockGetVehicleBySerial.mockResolvedValue({ id: 'veh-1' });
    const record = baseRecord({ product_family_id: null });

    await runNtrWarrantyOrchestration(record, ACTOR, makeDeliveryService());

    expect(mockUpdateVehicleDeliveryInfo).toHaveBeenCalledWith('veh-1', {
      deliveryDate: '2026-01-02',
      productFamilyId: null,
      dealerId: 'D1',
      branchId: null,
    });
    expect(mockResolveVehicleProgramVersionStages).not.toHaveBeenCalled();
  });

  it('is a no-op (never throws) when the serial has no matching Machine Registry row', async () => {
    mockGetVehicleBySerial.mockResolvedValue(null);
    const deliveryService = makeDeliveryService();

    await expect(runNtrWarrantyOrchestration(baseRecord(), ACTOR, deliveryService)).resolves.toBeUndefined();

    expect(mockUpdateVehicleDeliveryInfo).not.toHaveBeenCalled();
    expect(deliveryService.activateWarrantyFromNtr).not.toHaveBeenCalled();
    expect(mockResolveVehicleProgramVersionStages).not.toHaveBeenCalled();
  });

  it('never throws when Warranty activation fails - an NTR record must never be affected by this orchestration failing', async () => {
    mockGetVehicleBySerial.mockResolvedValue({ id: 'veh-1' });
    const deliveryService = makeDeliveryService({ activateWarrantyFromNtr: vi.fn(() => Promise.reject(new Error('db unavailable'))) });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runNtrWarrantyOrchestration(baseRecord(), ACTOR, deliveryService)).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith('NTR post-create warranty/PM orchestration error', expect.any(Error));
    consoleError.mockRestore();
  });

  it('never throws when vehicle lookup itself fails', async () => {
    mockGetVehicleBySerial.mockRejectedValue(new Error('SUPABASE_URL / SUPABASE_ANON_KEY env vars are not set'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runNtrWarrantyOrchestration(baseRecord(), ACTOR, makeDeliveryService())).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
