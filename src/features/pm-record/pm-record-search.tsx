'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalUpdateLoading, swalSuccessToast } from '@/lib/swal';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';
import type { Dealer, PmInterval, Technician, Branch } from '@/lib/types';
import type { PmVehicleSearchResult } from '@/lib/db';
import type { PmRecord } from './types';

const RECENT_VEHICLES_KEY = 'pm_record_recent_vehicles';
const RECENT_VEHICLES_MAX = 5;

function loadRecentVehicles(): PmVehicleSearchResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_VEHICLES_KEY);
    return raw ? (JSON.parse(raw) as PmVehicleSearchResult[]) : [];
  } catch {
    return [];
  }
}

function pushRecentVehicle(vehicle: PmVehicleSearchResult) {
  if (typeof window === 'undefined') return;
  const existing = loadRecentVehicles().filter((v) => v.serial !== vehicle.serial);
  const next = [vehicle, ...existing].slice(0, RECENT_VEHICLES_MAX);
  window.localStorage.setItem(RECENT_VEHICLES_KEY, JSON.stringify(next));
}

/** Strips non-digits and formats a Thai mobile number as 081-2345678 while
 *  the user types, matching what the server also normalizes to. */
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

type PhotoSlot = 'meter' | 'nameplate' | 'report';
const PHOTO_LABELS: Record<PhotoSlot, string> = {
  meter: 'รูปมิเตอร์ชั่วโมง',
  nameplate: 'รูป Nameplate / หมายเลขเครื่อง',
  report: 'รูปใบรายงาน PM',
};

interface Props {
  dealers: Dealer[];
  showDealerField: boolean;
  defaultDealerId: string | null;
}

export default function PmRecordSearch({ dealers, showDealerField, defaultDealerId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'search' | 'form'>('search');

  // ---- Search state ----
  const [dealerId, setDealerId] = useState(defaultDealerId ?? '');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [serial, setSerial] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [results, setResults] = useState<PmVehicleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recentVehicles, setRecentVehicles] = useState<PmVehicleSearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentVehicles(loadRecentVehicles());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBranches() {
      if (!dealerId) {
        setBranches([]);
        return;
      }
      try {
        const json = await fetchJson<{ ok: boolean; branches: Branch[] }>(`/api/branches?dealerId=${encodeURIComponent(dealerId)}`);
        if (!cancelled) setBranches(json.branches ?? []);
      } catch {
        if (!cancelled) setBranches([]);
      }
    }
    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [dealerId]);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (dealerId) params.set('dealerId', dealerId);
      if (branchId) params.set('branchId', branchId);
      if (serial.trim()) params.set('serial', serial.trim());
      if (customerName.trim()) params.set('customerName', customerName.trim());
      if (customerPhone.trim()) params.set('customerPhone', customerPhone.trim());
      const json = await fetchJson<{ ok: boolean; data: PmVehicleSearchResult[] }>(
        `/api/pm-records/vehicle-search?${params.toString()}`
      );
      setResults(json.data ?? []);
    } catch (err) {
      setResults([]);
      await showError(err);
    } finally {
      setSearching(false);
    }
  }, [dealerId, branchId, serial, customerName, customerPhone]);

  // Auto-complete: typing 3+ characters into Serial Number immediately
  // suggests matches, debounced so every keystroke doesn't hit the server.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (serial.trim().length < 3) return;
    debounceRef.current = setTimeout(() => {
      runSearch();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial]);

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalErrorToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    } else {
      await swalErrorToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }

  const [selectedVehicle, setSelectedVehicle] = useState<PmVehicleSearchResult | null>(null);

  function selectVehicle(vehicle: PmVehicleSearchResult) {
    setSelectedVehicle(vehicle);
    pushRecentVehicle(vehicle);
    setMode('form');
  }

  if (mode === 'form' && selectedVehicle) {
    return (
      <PmRecordCreateForm
        vehicle={selectedVehicle}
        onBack={() => {
          setMode('search');
          setSelectedVehicle(null);
        }}
        onSaved={(record) => router.push(`/pm-records/${encodeURIComponent(record.id)}`)}
      />
    );
  }

  const dealerOptions = [{ value: '', label: '-- ทุกดีลเลอร์ --' }, ...dealers.map((d) => ({ value: d.id, label: d.short_name }))];
  const branchOptions = [{ value: '', label: '-- ทุกสาขา --' }, ...branches.map((b) => ({ value: b.id, label: b.name }))];

  return (
    <div className="space-y-4">
      {recentVehicles.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-600">รถที่เปิดล่าสุด</h2>
          <div className="flex flex-wrap gap-2">
            {recentVehicles.map((v) => (
              <button
                key={v.serial}
                type="button"
                onClick={() => selectVehicle(v)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:border-brand-red hover:bg-gray-50"
              >
                <span className="font-semibold">{v.serial}</span>
                {v.model ? <span className="text-gray-500"> · {v.model}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h1 className="text-lg font-bold text-brand-dark">ค้นหารถแทรกเตอร์</h1>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {showDealerField && (
            <SelectField
              label="ดีลเลอร์"
              value={dealerId}
              onChange={(v) => {
                setDealerId(v);
                setBranchId('');
              }}
              options={dealerOptions}
            />
          )}
          <SelectField label="สาขา" value={branchId} onChange={setBranchId} options={branchOptions} />
          <TextField label="หมายเลขตัวถัง (Serial)" value={serial} onChange={setSerial} placeholder="พิมพ์อย่างน้อย 3 ตัวอักษร" />
          <TextField label="ชื่อลูกค้า" value={customerName} onChange={setCustomerName} placeholder="ค้นหาจากประวัติ PM" />
          <TextField label="เบอร์โทรศัพท์" value={customerPhone} onChange={setCustomerPhone} placeholder="ค้นหาจากประวัติ PM" />
        </div>
        <div>
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {searching ? 'กำลังค้นหา...' : 'ค้นหา'}
          </button>
        </div>
      </div>

      {searched && !searching && results.length === 0 && (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          ไม่พบรถแทรกเตอร์ที่ตรงกับเงื่อนไขค้นหา
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Serial</th>
                <th className="px-3 py-2">รุ่น</th>
                <th className="px-3 py-2">ดีลเลอร์</th>
                <th className="px-3 py-2">สาขา</th>
                <th className="px-3 py-2">วันที่ส่งมอบ</th>
                <th className="px-3 py-2">ลูกค้า</th>
                <th className="px-3 py-2">PM ล่าสุด</th>
                <th className="px-3 py-2">วันที่ PM ล่าสุด</th>
                <th className="px-3 py-2">ชั่วโมงล่าสุด</th>
                <th className="px-3 py-2">PM ครั้งถัดไป</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{v.serial}</td>
                  <td className="px-3 py-2">{v.model ?? '-'}</td>
                  <td className="px-3 py-2">{v.dealer_name ?? v.dealer_id ?? '-'}</td>
                  <td className="px-3 py-2">{v.branch_name ?? '-'}</td>
                  <td className="px-3 py-2">{v.delivery_date ?? '-'}</td>
                  <td className="px-3 py-2">{v.last_customer_name ?? '-'}</td>
                  <td className="px-3 py-2">{v.last_pm_number ?? '-'}</td>
                  <td className="px-3 py-2">{v.last_pm_date ?? '-'}</td>
                  <td className="px-3 py-2">{v.last_hour_meter ?? '-'}</td>
                  <td className="px-3 py-2">{v.next_pm_due ?? '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => selectVehicle(v)}
                      className="rounded bg-brand-red px-3 py-1.5 text-xs text-white hover:bg-brand-dark"
                    >
                      เลือก
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PmRecordCreateForm({
  vehicle,
  onBack,
  onSaved,
}: {
  vehicle: PmVehicleSearchResult;
  onBack: () => void;
  onSaved: (record: PmRecord) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [pmIntervalId, setPmIntervalId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  const [pmIntervals, setPmIntervals] = useState<PmInterval[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [photos, setPhotos] = useState<Record<PhotoSlot, string | null>>({
    meter: null,
    nameplate: null,
    report: null,
  });
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [intervalJson, technicianJson] = await Promise.all([
          fetchJson<{ ok: boolean; pmIntervals: PmInterval[] }>('/api/pm-intervals'),
          fetchJson<{ ok: boolean; technicians: Technician[] }>(
            `/api/technicians?dealerId=${encodeURIComponent(vehicle.dealer_id ?? '')}${
              vehicle.branch_name ? `&branch=${encodeURIComponent(vehicle.branch_name)}` : ''
            }`
          ),
        ]);
        setPmIntervals(intervalJson.pmIntervals ?? []);
        setTechnicians(technicianJson.technicians ?? []);
      } catch (err) {
        await swalErrorToast('โหลดข้อมูลรอบ PM/ช่างซ่อมไม่สำเร็จ');
      }
    })();
  }, [vehicle.dealer_id, vehicle.branch_name]);

  async function uploadPhoto(slot: PhotoSlot, file: File) {
    setUploadingSlot(slot);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('label', slot);
      form.append('dealerId', vehicle.dealer_id ?? '');
      const res = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', body: form });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'อัปโหลดรูปไม่สำเร็จ');
      setPhotos((prev) => ({ ...prev, [slot]: json.url as string }));
    } catch (err) {
      await swalErrorToast(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingSlot(null);
    }
  }

  function validate(): string | null {
    if (!customerName.trim()) return 'กรุณากรอกชื่อลูกค้า';
    if (!/^0\d{9}$/.test(customerPhone.replace(/\D/g, ''))) return 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)';
    if (!hourMeter.trim() || Number.isNaN(Number(hourMeter))) return 'กรุณากรอกชั่วโมงเครื่องยนต์';
    if (!pmIntervalId) return 'กรุณาเลือกรอบ PM';
    if (!technicianId) return 'กรุณาเลือกช่างซ่อม';
    if (!photos.meter || !photos.nameplate || !photos.report) return 'กรุณาอัปโหลดรูปให้ครบทั้ง 3 รูป';
    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      await swalErrorToast(validationError);
      return;
    }

    const performedDate = new Date().toISOString().slice(0, 10);
    setSubmitting(true);
    swalLoading('กำลังตรวจสอบ...');
    try {
      const dupCheck = await fetchJson<{ ok: boolean; data: { duplicate: PmRecord | null } }>(
        `/api/pm-records/check-duplicate?serial=${encodeURIComponent(vehicle.serial)}&pmIntervalId=${encodeURIComponent(
          pmIntervalId
        )}&performedDate=${performedDate}`
      );
      swalClose();
      if (dupCheck.data.duplicate) {
        const proceed = await swalConfirm(
          `พบรายการ PM ที่ตรงกัน (รอบ PM เดียวกัน วันที่เดียวกัน) เลขที่ ${dupCheck.data.duplicate.pm_number ?? dupCheck.data.duplicate.id} ต้องการบันทึกต่อหรือไม่?`,
          { title: 'พบรายการซ้ำ', confirmText: 'บันทึกต่อ', cancelText: 'ยกเลิก' }
        );
        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }

      swalLoading('กำลังบันทึก...');
      const created = await fetchJson<{ ok: true; data: PmRecord }>('/api/pm-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          branch_id: vehicle.branch_id,
          serial: vehicle.serial,
          model: vehicle.model,
          delivery_date: vehicle.delivery_date,
          engine_number: vehicle.engine_number,
          customer_name: customerName,
          customer_phone: customerPhone,
          technician_id: technicianId,
          performed_date: performedDate,
          hour_meter: Number(hourMeter),
          pm_interval_id: pmIntervalId,
          meter_photo_url: photos.meter,
          nameplate_photo_url: photos.nameplate,
          report_photo_url: photos.report,
          notes: notes.trim() || null,
        }),
      });
      swalClose();
      swalSuccessToast('บันทึก PM สำเร็จ');
      onSaved(created.data);
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        await swalErrorToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      } else {
        await swalErrorToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pmIntervalOptions = [
    { value: '', label: '-- เลือกรอบ PM --' },
    ...pmIntervals.map((iv) => ({
      value: iv.id,
      label: `${iv.label}${iv.interval_hours ? ` (${iv.interval_hours} ชม.)` : ''}`,
    })),
  ];
  const technicianOptions = [
    { value: '', label: '-- เลือกช่างซ่อม --' },
    ...technicians.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">บันทึก PM: {vehicle.serial}</h1>
          <p className="text-sm text-gray-500">{vehicle.model ?? '-'}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          กลับไปค้นหา
        </button>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">ข้อมูลรถ (Auto Fill)</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-3">
          <p>ดีลเลอร์: {vehicle.dealer_name ?? vehicle.dealer_id ?? '-'}</p>
          <p>สาขา: {vehicle.branch_name ?? '-'}</p>
          <p>Serial: {vehicle.serial}</p>
          <p>หมายเลขเครื่อง: {vehicle.engine_number ?? '-'}</p>
          <p>รุ่น: {vehicle.model ?? '-'}</p>
          <p>วันที่ส่งมอบ: {vehicle.delivery_date ?? '-'}</p>
        </div>
      </div>

      <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-600">ข้อมูลลูกค้า (กรอกทุกครั้ง)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="ชื่อลูกค้า *" value={customerName} onChange={setCustomerName} disabled={submitting} />
          <TextField
            label="เบอร์โทรศัพท์ *"
            value={customerPhone}
            onChange={(v) => setCustomerPhone(formatPhoneInput(v))}
            placeholder="081-2345678"
            disabled={submitting}
          />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">ข้อมูล PM</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <TextField label="ชั่วโมงเครื่องยนต์ *" value={hourMeter} onChange={setHourMeter} placeholder="ตัวเลข" disabled={submitting} />
          <SelectField label="รอบ PM *" value={pmIntervalId} onChange={setPmIntervalId} options={pmIntervalOptions} />
          <SelectField label="ช่างซ่อม *" value={technicianId} onChange={setTechnicianId} options={technicianOptions} />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">รูปถ่าย (บังคับ 3 รูป)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['meter', 'nameplate', 'report'] as PhotoSlot[]).map((slot) => (
            <div key={slot} className="rounded border border-dashed border-gray-300 p-3 text-center">
              <p className="mb-2 text-xs text-gray-500">{PHOTO_LABELS[slot]}</p>
              {photos[slot] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[slot] as string} alt={PHOTO_LABELS[slot]} className="mb-2 h-24 w-full rounded object-cover" />
              ) : (
                <div className="mb-2 flex h-24 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                  ยังไม่มีรูป
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={submitting || uploadingSlot === slot}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhoto(slot, file);
                }}
                className="w-full text-xs"
              />
              {uploadingSlot === slot && <p className="mt-1 text-xs text-gray-400">กำลังอัปโหลด...</p>}
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">หมายเหตุ</label>
          <textarea
            className="w-full rounded border px-2 py-1.5 text-sm disabled:opacity-50"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : 'บันทึก PM'}
          </button>
        </div>
      </div>
    </div>
  );
}
