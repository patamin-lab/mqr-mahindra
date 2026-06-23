'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProblemCode, PHOTO_SLOTS } from '@/lib/types';
import { calcWarranty } from '@/lib/warranty';

interface VehicleInfo {
  serial: string;
  model: string | null;
  delivery_date: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ReportForm({ problemCodes }: { problemCodes: ProblemCode[] }) {
  const router = useRouter();

  const [serial, setSerial] = useState('');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleChecked, setVehicleChecked] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [model, setModel] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [hours, setHours] = useState('');
  const [foundDate, setFoundDate] = useState(todayStr());
  const [problemCodeId, setProblemCodeId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [attachment, setAttachment] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [video, setVideo] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ jobId: string; warrantyStatus: string } | null>(null);

  const selectedCode = useMemo(
    () => problemCodes.find((p) => p.id === problemCodeId) ?? null,
    [problemCodes, problemCodeId]
  );
  const problemSystem = selectedCode?.system ?? 'other';

  const grouped = useMemo(() => {
    const map = new Map<string, ProblemCode[]>();
    for (const pc of problemCodes) {
      const key = pc.group_name ?? 'อื่นๆ';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pc);
    }
    return Array.from(map.entries());
  }, [problemCodes]);

  const warrantyPreview = useMemo(() => {
    if (!foundDate) return null;
    return calcWarranty(vehicle?.delivery_date ?? null, foundDate, problemSystem as 'powertrain' | 'other');
  }, [vehicle, foundDate, problemSystem]);

  async function checkSerial() {
    if (!serial.trim()) return;
    setVehicleLoading(true);
    setVehicleChecked(false);
    try {
      const res = await fetch(`/api/vehicles/${encodeURIComponent(serial.trim())}`);
      const json = await res.json();
      if (json.ok && json.found) {
        setVehicle(json.vehicle);
        setModel(json.vehicle.model ?? '');
      } else {
        setVehicle(null);
      }
    } finally {
      setVehicleLoading(false);
      setVehicleChecked(true);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  async function uploadOne(file: File, label: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', label);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || `อัปโหลด ${label} ไม่สำเร็จ`);
    return json.url as string;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!serial.trim() || !foundDate || !problemCodeId) {
      setError('กรุณากรอกหมายเลขรถ วันที่พบปัญหา และอาการที่พบ ให้ครบถ้วน');
      return;
    }
    if (!vehicle && !stockNote) {
      setError('ไม่พบหมายเลขรถในระบบ กรุณาระบุที่มาของรถ (สต็อก/อื่นๆ)');
      return;
    }
    setSubmitting(true);
    try {
      const photoLinks: { label: string; url: string }[] = [];
      for (const slot of PHOTO_SLOTS) {
        const file = photos[slot.key];
        if (file) {
          const url = await uploadOne(file, slot.label);
          photoLinks.push({ label: slot.label, url });
        }
      }
      let videoLink: string | null = null;
      if (video) {
        videoLink = await uploadOne(video, 'วิดีโอปัญหา');
      }

      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial: serial.trim(),
          model: model || vehicle?.model || '',
          hours: hours === '' ? null : Number(hours),
          foundDate,
          problemCode: selectedCode?.label ?? '',
          problemSystem,
          customerName,
          customerPhone,
          reporterName,
          reporterPhone,
          attachment,
          stockNote: vehicle ? null : stockNote,
          lat,
          lng,
          photoLinks,
          videoLink,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      setSuccess({ jobId: json.record.job_id, warrantyStatus: json.warranty.status });
    } catch (err: any) {
      setError(err?.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-lg font-semibold text-brand-dark mb-1">บันทึกงานสำเร็จ</h2>
        <p className="text-sm text-gray-600 mb-1">
          เลขที่งาน: <span className="font-mono font-semibold">{success.jobId}</span>
        </p>
        <p className="text-sm text-gray-600 mb-6">สถานะการรับประกัน: {success.warrantyStatus}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/records')}
            className="px-4 py-2 rounded bg-brand-dark text-white text-sm"
          >
            ไปที่หน้าตรวจสอบสถานะ
          </button>
          <button onClick={() => router.refresh()} className="px-4 py-2 rounded border border-gray-300 text-sm">
            แจ้งงานใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
      )}

      {/* ข้อมูลรถ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">1. ข้อมูลรถ</h2>
        <div>
          <label className="block text-sm font-medium mb-1">หมายเลขรถ (Serial)</label>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded px-3 py-2"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              onBlur={checkSerial}
              required
            />
            <button
              type="button"
              onClick={checkSerial}
              className="px-3 py-2 rounded border border-gray-300 text-sm whitespace-nowrap"
            >
              {vehicleLoading ? 'กำลังค้นหา...' : 'ตรวจสอบ'}
            </button>
          </div>
          {vehicleChecked && !vehicleLoading && (
            <p className={`text-xs mt-1 ${vehicle ? 'text-green-600' : 'text-amber-600'}`}>
              {vehicle ? `พบในระบบ: ${vehicle.model ?? ''}` : 'ไม่พบหมายเลขรถนี้ในระบบ — กรุณากรอกข้อมูลด้านล่างเอง'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">รุ่นรถ (Model)</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!!vehicle}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">วันที่ส่งมอบ</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50"
              value={vehicle?.delivery_date ?? 'ไม่ระบุ'}
              disabled
            />
          </div>
        </div>

        {!vehicle && (
          <div>
            <label className="block text-sm font-medium mb-1">ที่มาของรถ</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={stockNote}
              onChange={(e) => setStockNote(e.target.value)}
              required
            >
              <option value="">-- เลือก --</option>
              <option value="รถใหม่ในสต๊อกดีลเลอร์">รถใหม่ในสต๊อกดีลเลอร์</option>
              <option value="รถของลูกค้า">รถของลูกค้า</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชั่วโมงการใช้งาน (Hours)</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">วันที่พบปัญหา</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={foundDate}
              onChange={(e) => setFoundDate(e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      {/* อาการ/ปัญหา */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">2. อาการที่พบ</h2>
        <div>
          <label className="block text-sm font-medium mb-1">อาการ (เลือกจากรายการ)</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={problemCodeId}
            onChange={(e) => setProblemCodeId(e.target.value)}
            required
          >
            <option value="">-- เลือกอาการ --</option>
            {grouped.map(([group, codes]) => (
              <optgroup key={group} label={group}>
                {codes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {warrantyPreview && (
            <p
              className={`text-xs mt-1 ${
                warrantyPreview.status === 'อยู่ในประกัน' ? 'text-green-600' : 'text-amber-600'
              }`}
            >
              ระยะรับประกัน: {warrantyPreview.limitMonths} เดือน — สถานะ: {warrantyPreview.status}
              {warrantyPreview.ageMonths !== null ? ` (อายุรถ ${warrantyPreview.ageMonths} เดือน)` : ''}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">รายละเอียดปัญหาที่ลูกค้าพบ</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={attachment}
            onChange={(e) => setAttachment(e.target.value)}
          />
        </div>
      </section>

      {/* บุคคล/พิกัด */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">3. ข้อมูลผู้แจ้ง / ลูกค้า</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">เบอร์โทรลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อผู้แจ้ง</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">เบอร์โทรผู้แจ้ง</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
            />
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={useCurrentLocation}
            className="text-sm px-3 py-2 rounded border border-gray-300"
          >
            {locating ? 'กำลังระบุตำแหน่ง...' : 'ใช้ตำแหน่งปัจจุบัน'}
          </button>
          {lat !== null && lng !== null && (
            <span className="text-xs text-gray-500 ml-2">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          )}
        </div>
      </section>

      {/* รูป/วิดีโอ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">4. รูปภาพ / วิดีโอ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PHOTO_SLOTS.map((slot) => (
            <div key={slot.key}>
              <label className="block text-sm font-medium mb-1">{slot.label}</label>
              <input
                type="file"
                accept="image/*"
                className="w-full text-sm"
                onChange={(e) => setPhotos((p) => ({ ...p, [slot.key]: e.target.files?.[0] ?? null }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">วิดีโอปัญหา (ถ้ามี)</label>
            <input
              type="file"
              accept="video/*"
              className="w-full text-sm"
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </section>

      <button
        disabled={submitting}
        className="w-full sm:w-auto px-6 py-3 rounded bg-brand-red hover:bg-brand-redDark text-white font-medium disabled:opacity-50"
      >
        {submitting ? 'กำลังบันทึก...' : 'บันทึกการแจ้งซ่อม'}
      </button>
    </form>
  );
}
