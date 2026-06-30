'use client';

import { useState } from 'react';
import VehicleAutocomplete, { VehicleSnapshot } from '@/components/shared/vehicle/VehicleAutocomplete';

interface Props {
  /** Null for SuperAdmin / CentralAdmin — they select any dealer.
   *  Non-null locks the form to that dealer (DealerAdmin / DealerUser). */
  lockedDealerId: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * PM Record create form — Sprint 11.1: Vehicle Lookup.
 *
 * Vehicle autocomplete is fully wired: preloads from /api/vehicles/list,
 * filters client-side, and falls back to exact lookup on blur. Selecting
 * a vehicle populates the Serial, Model, and Delivery Date snapshot fields.
 *
 * Customer Name and Phone are manual inputs (no Customer Master — snapshot
 * data only, consistent with MqrRecord and ADR constraints).
 *
 * CRUD (save / submit) is NOT yet implemented. That is Sprint 11.2 and
 * requires the pm_records database migration.
 */
export default function PmRecordForm({ lockedDealerId: _ }: Props) {
  // Vehicle snapshot
  const [serial, setSerial] = useState('');
  const [model, setModel] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [vehicle, setVehicle] = useState<VehicleSnapshot | null>(null);

  // Customer snapshot — manual entry, no Customer Master
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // PM scheduling
  const [scheduledDate, setScheduledDate] = useState(todayStr());
  const [notes, setNotes] = useState('');

  function handleVehicleSelect(v: VehicleSnapshot | null) {
    setVehicle(v);
    setModel(v?.model ?? '');
    setDeliveryDate(v?.delivery_date ?? '');
    if (!v) {
      setModel('');
      setDeliveryDate('');
    }
  }

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* 1. Vehicle */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">1. ข้อมูลรถ</h2>

        <div>
          <label className="block text-sm font-medium mb-1">
            หมายเลขรถ (Serial) <span className="text-red-500">*</span>
          </label>
          <VehicleAutocomplete
            value={serial}
            onChange={setSerial}
            onSelect={handleVehicleSelect}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">รุ่นรถ (Model)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!!vehicle}
              placeholder="จะถูกกรอกอัตโนมัติเมื่อเลือกรถ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">วันที่ส่งมอบ</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50"
              value={deliveryDate || 'ไม่ระบุ'}
              disabled
            />
          </div>
        </div>
      </section>

      {/* 2. Customer snapshot */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">2. ข้อมูลลูกค้า</h2>
        <p className="text-xs text-gray-400">
          บันทึกเป็น Snapshot ณ วันที่บันทึก — ไม่เชื่อมต่อกับ Customer Master
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">เบอร์โทรลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              placeholder="08X-XXX-XXXX"
            />
          </div>
        </div>
      </section>

      {/* 3. PM details */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">3. รายละเอียด PM</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">วันที่นัดหมาย PM</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">หมายเหตุ</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="รายละเอียดเพิ่มเติม"
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled
          className="px-6 py-3 rounded bg-brand-dark text-white font-medium opacity-40 cursor-not-allowed"
          title="CRUD will be enabled after the pm_records database migration (Sprint 11.2)"
        >
          บันทึก PM Record
        </button>
        <p className="text-xs text-gray-400">
          Sprint 11.1 — Vehicle Lookup เท่านั้น · CRUD จะพร้อมใน Sprint 11.2
        </p>
      </div>
    </form>
  );
}
