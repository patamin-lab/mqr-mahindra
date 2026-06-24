'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProblemCode, PHOTO_SLOTS, Dealer, Branch, Technician } from '@/lib/types';
import { calcWarranty } from '@/lib/warranty';
import LocationPicker from './location-picker';

interface VehicleInfo {
  serial: string;
  model: string | null;
  delivery_date: string | null;
  engineSerial?: string | null;
  productCode?: string | null;
  pdiStatus?: string | null;
  source?: 'supabase' | 'tractor_in_sheet' | 'both';
}

interface VehicleSearchResult {
  serial: string;
  model: string | null;
  deliveryDate: string | null;
  source: 'supabase' | 'tractor_in_sheet';
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function formatPhoneDisplay(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

const PHONE_RE = /^0[0-9]{9}$/;

export default function ReportForm({
  problemCodes,
  dealers,
  lockedDealerId,
  initialBranches,
  initialTechnicians,
}: {
  problemCodes: ProblemCode[];
  dealers: Dealer[];
  lockedDealerId: string | null;
  initialBranches: Branch[];
  initialTechnicians: Technician[];
}) {
  const router = useRouter();

  // ---- vehicle smart search ----
  const [serial, setSerial] = useState('');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleChecked, setVehicleChecked] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<VehicleSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
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

  // ---- repair details (Phase 3) ----
  const [dealerId, setDealerId] = useState(lockedDealerId ?? '');
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians);
  const [branchId, setBranchId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [repairDate, setRepairDate] = useState(todayStr());
  const [hoursInForRepair, setHoursInForRepair] = useState('');

  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [video, setVideo] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ jobId: string; warrantyStatus: string } | null>(null);

  const effectiveDealerId = lockedDealerId ?? dealerId;

  // Refetch branches when an unlocked Dealer selector changes.
  useEffect(() => {
    if (lockedDealerId) return;
    if (!dealerId) {
      setBranches([]);
      setBranchId('');
      return;
    }
    fetch(`/api/branches?dealerId=${encodeURIComponent(dealerId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setBranches(json.branches);
      })
      .catch(() => {});
  }, [dealerId, lockedDealerId]);

  // Refetch technicians whenever the dealer or branch selection changes.
  const firstTechFetch = useRef(true);
  useEffect(() => {
    if (firstTechFetch.current) {
      firstTechFetch.current = false;
      return; // skip redundant refetch on mount - server already loaded initialTechnicians
    }
    if (!effectiveDealerId) {
      setTechnicians([]);
      return;
    }
    const branchName = branches.find((b) => b.id === branchId)?.name ?? '';
    const qs = new URLSearchParams({ dealerId: effectiveDealerId });
    if (branchName) qs.set('branch', branchName);
    fetch(`/api/technicians?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setTechnicians(json.technicians);
      })
      .catch(() => {});
  }, [effectiveDealerId, branchId, branches]);

  function onDealerChange(id: string) {
    setDealerId(id);
    setBranchId('');
    setTechnicianId('');
  }
  function onBranchChange(id: string) {
    setBranchId(id);
    setTechnicianId('');
  }

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

  // Smart search: debounced partial-match lookup as the user types the serial.
  useEffect(() => {
    if (vehicle) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const term = serial.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (json.ok) {
          setSearchResults(json.results);
          setSearchOpen(json.results.length > 0);
        }
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [serial, vehicle]);

  function onSerialChange(value: string) {
    setSerial(value);
    if (vehicle) {
      setVehicle(null);
      setVehicleChecked(false);
      setModel('');
    }
  }

  async function selectVehicleResult(r: VehicleSearchResult) {
    setSearchOpen(false);
    setSerial(r.serial);
    setVehicleLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${encodeURIComponent(r.serial)}`);
      const json = await res.json();
      if (json.ok && json.found) {
        setVehicle(json.vehicle);
        setModel(json.vehicle.model ?? '');
      } else {
        setVehicle({ serial: r.serial, model: r.model, delivery_date: r.deliveryDate, source: r.source });
        setModel(r.model ?? '');
      }
    } finally {
      setVehicleLoading(false);
      setVehicleChecked(true);
    }
  }

  async function checkSerialExact() {
    if (!serial.trim() || vehicle) return;
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
      setSearchOpen(false);
    }
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
    if (!lockedDealerId && !dealerId) {
      setError('กรุณาเลือกดีลเลอร์');
      return;
    }
    if (!customerName.trim()) {
      setError('กรุณากรอกชื่อลูกค้า');
      return;
    }
    if (customerPhone && !PHONE_RE.test(customerPhone)) {
      setError('เบอร์โทรลูกค้าไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก ขึ้นต้นด้วย 0)');
      return;
    }
    if (reporterPhone && !PHONE_RE.test(reporterPhone)) {
      setError('เบอร์โทรผู้แจ้งไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก ขึ้นต้นด้วย 0)');
      return;
    }
    if (!repairDate) {
      setError('กรุณากรอกวันที่นำรถเข้าซ่อม');
      return;
    }
    if (repairDate < foundDate) {
      setError('วันที่นำรถเข้าซ่อม ต้องไม่ก่อนวันที่พบปัญหา');
      return;
    }
    if (hours !== '' && hoursInForRepair !== '' && Number(hoursInForRepair) < Number(hours)) {
      setError('ชั่วโมงการใช้งานขณะนำเข้าซ่อม ต้องไม่น้อยกว่าชั่วโมงขณะพบปัญหา');
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
          dealerId: lockedDealerId ?? dealerId,
          branchId: branchId || null,
          technicianId: technicianId || null,
          repairDate,
          hoursInForRepair: hoursInForRepair === '' ? null : Number(hoursInForRepair),
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
        <div className="relative">
          <label className="block text-sm font-medium mb-1">หมายเลขรถ (Serial)</label>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded px-3 py-2"
              value={serial}
              onChange={(e) => onSerialChange(e.target.value)}
              onBlur={() => setTimeout(checkSerialExact, 150)}
              autoComplete="off"
              placeholder="พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา..."
              required
            />
            <button
              type="button"
              onClick={checkSerialExact}
              className="px-3 py-2 rounded border border-gray-300 text-sm whitespace-nowrap"
            >
              {vehicleLoading ? 'กำลังค้นหา...' : 'ตรวจสอบ'}
            </button>
          </div>

          {searchOpen && searchResults.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto text-sm">
              {searchResults.map((r) => (
                <li key={r.serial}>
                  <button
                    type="button"
                    onClick={() => selectVehicleResult(r)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span className="font-mono">{r.serial}</span>
                    <span className="text-gray-500 text-xs">
                      {r.model ?? ''}
                      {r.source === 'tractor_in_sheet' ? ' · Tractor IN' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {vehicleChecked && !vehicleLoading && !searchOpen && (
            <p className={`text-xs mt-1 ${vehicle ? 'text-green-600' : 'text-amber-600'}`}>
              {vehicle
                ? `พบในระบบ: ${vehicle.model ?? ''}${
                    vehicle.source === 'tractor_in_sheet' ? ' (จากฐานข้อมูล Tractor IN — ยังไม่มีข้อมูลส่งมอบ)' : ''
                  }`
                : 'ไม่พบหมายเลขรถนี้ในระบบ — กรุณากรอกข้อมูลด้านล่างเอง'}
            </p>
          )}
          {vehicle && (vehicle.engineSerial || vehicle.productCode) && (
            <p className="text-xs mt-1 text-gray-500">
              {vehicle.engineSerial ? `เลขเครื่องยนต์: ${vehicle.engineSerial}` : ''}
              {vehicle.engineSerial && vehicle.productCode ? ' · ' : ''}
              {vehicle.productCode ? `Product Code: ${vehicle.productCode}` : ''}
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

        <div>
          <label className="block text-sm font-medium mb-1">ที่มาของรถ</label>
          {vehicle ? (
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-600"
              value="มีข้อมูลในระบบแล้ว (ตรวจสอบจากหมายเลขรถ)"
              disabled
            />
          ) : (
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={stockNote}
              onChange={(e) => setStockNote(e.target.value)}
              required={vehicleChecked}
            >
              <option value="">-- เลือก --</option>
              <option value="รถใหม่ในสต๊อกดีลเลอร์">รถใหม่ในสต๊อกดีลเลอร์</option>
              <option value="รถของลูกค้า">รถของลูกค้า</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชั่วโมงการใช้งานขณะพบปัญหา (Hours)</label>
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

      {/* รายละเอียดงานซ่อม */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">3. รายละเอียดงานซ่อม</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {!lockedDealerId && (
            <div>
              <label className="block text-sm font-medium mb-1">ดีลเลอร์</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={dealerId}
                onChange={(e) => onDealerChange(e.target.value)}
                required
              >
                <option value="">-- เลือกดีลเลอร์ --</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.short_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">สาขา</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={branchId}
              onChange={(e) => onBranchChange(e.target.value)}
            >
              <option value="">-- ไม่ระบุ --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ช่างผู้รับผิดชอบ</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              <option value="">-- ไม่ระบุ --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">วันที่นำรถเข้าซ่อม</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={repairDate}
              onChange={(e) => setRepairDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ชั่วโมงการใช้งานขณะนำเข้าซ่อม</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={hoursInForRepair}
              onChange={(e) => setHoursInForRepair(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">เบอร์โทรลูกค้า</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              value={formatPhoneDisplay(customerPhone)}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="08X-XXX-XXXX"
              inputMode="numeric"
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
              value={formatPhoneDisplay(reporterPhone)}
              onChange={(e) => setReporterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="08X-XXX-XXXX"
              inputMode="numeric"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">พิกัดสถานที่ (ละติจูด, ลองจิจูด)</label>
          <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
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
        {submitting ? 'กำลังบันทึก...' : 'บันทึกรายงานปัญหาคุณภาพ'}
      </button>
    </form>
  );
}
