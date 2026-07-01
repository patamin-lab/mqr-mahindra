'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import VehicleAutocomplete, {
  VehicleSnapshot,
} from '@/components/shared/vehicle/VehicleAutocomplete';

interface Props {
  /** Null for SuperAdmin / CentralAdmin.
   *  Non-null locks the form to that dealer (DealerAdmin / DealerUser). */
  lockedDealerId: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * PM Record create form — Sprint 11.3: redirects to detail page on success.
 *
 * On successful create the user is navigated to /pm-records/{id}.
 * The submit button stays disabled until navigation completes.
 */
export default function PmRecordForm({ lockedDealerId: _ }: Props) {
  const router = useRouter();

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

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleVehicleSelect(v: VehicleSnapshot | null) {
    setVehicle(v);
    setModel(v?.model ?? '');
    setDeliveryDate(v?.delivery_date ?? '');
    if (!v) {
      setModel('');
      setDeliveryDate('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledDate) {
      setSubmitError('กรุณาระบุวันที่นัดหมาย PM');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/pm-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial: serial.trim() || null,
          model: model.trim() || null,
          delivery_date: deliveryDate || null,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          scheduled_date: scheduledDate,
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Navigate to the new record's detail page.
        // submitting stays true — component unmounts on navigation.
        router.push('/pm-records/' + (json.data.id as string));
        return;
      }
      setSubmitError(json.error?.message ?? 'เกิดข้อผิดพลาดในระบบ');
      setSubmitting(false);
    } catch {
      setSubmitError('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่');
      setSubmitting(false);
    }
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
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
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">รุ่นรถ (Model)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!!vehicle || submitting}
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
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">เบอร์โทรลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
              value={customerPhone}
              onChange={(e) =>
                setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              inputMode="numeric"
              placeholder="08X-XXX-XXXX"
              disabled={submitting}
            />
          </div>
        </div>
      </section>

      {/* 3. PM details */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">3. รายละเอียด PM</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              วันที่นัดหมาย PM <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">หมายเหตุ</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="รายละเอียดเพิ่มเติม"
            disabled={submitting}
          />
        </div>
      </section>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded bg-brand-dark text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'กำลังบันทึก...' : 'บันทึก PM Record'}
        </button>
      </div>
    </form>
  );
}
