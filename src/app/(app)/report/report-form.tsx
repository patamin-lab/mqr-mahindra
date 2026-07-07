'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ProblemCode,
  PHOTO_CATEGORIES,
  PhotoLink,
  Dealer,
  Technician,
  Severity,
  SEVERITY_VALUES,
  SEVERITY_LABELS,
  Role,
} from '@/lib/types';
import { calcWarranty } from '@/lib/warranty';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalUpdateLoading, swalClose } from '@/lib/swal';
import { uploadAttachment, newPendingEntityId } from '@/components/shared/attachments/uploadAttachment';
import GpsLocationPicker from '@/components/shared/gps/GpsLocationPicker';
import type { GpsLocation } from '@/components/shared/gps/types';
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import DealerBranchSelector from '@/components/shared/scope/DealerBranchSelector';

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
  role,
  sessionDealerId,
  sessionBranchId,
  pinnedDealerName,
  pinnedBranchName,
  initialTechnicians,
}: {
  problemCodes: ProblemCode[];
  dealers: Dealer[];
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  pinnedDealerName?: string | null;
  pinnedBranchName?: string | null;
  initialTechnicians: Technician[];
}) {
  const router = useRouter();

  // ---- vehicle smart search ----
  // Uploaded via AttachmentService against this temporary ID (the real
  // job_id doesn't exist until /api/records creates the record) - see
  // uploadAttachment.ts / reassignAttachments().
  const pendingEntityId = useRef(newPendingEntityId()).current;
  const [serial, setSerial] = useState('');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleChecked, setVehicleChecked] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [allVehicles, setAllVehicles] = useState<VehicleSearchResult[]>([]);
  const [vehicleListLoading, setVehicleListLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<VehicleSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [model, setModel] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [hours, setHours] = useState('');
  const [foundDate, setFoundDate] = useState(todayStr());
  const [problemCodeId, setProblemCodeId] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const severityTouched = useRef(false);
  const [peripheralEquipment, setPeripheralEquipment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [attachment, setAttachment] = useState('');
  const [gpsLocation, setGpsLocation] = useState<GpsLocation>({
    latitude: null,
    longitude: null,
    accuracy: null,
    googleMapsUrl: null,
  });

  // ---- repair details (Phase 3) ----
  const scope = useDealerBranchScope({
    role,
    sessionDealerId,
    sessionBranchId,
    initialDealers: dealers,
  });
  const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians);
  const [technicianId, setTechnicianId] = useState('');
  const [repairDate, setRepairDate] = useState(todayStr());
  const [hoursInForRepair, setHoursInForRepair] = useState('');

  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);
  const [damagePhoto1, setDamagePhoto1] = useState<File | null>(null);
  const [damagePhoto2, setDamagePhoto2] = useState<File | null>(null);
  const [damagePhoto3, setDamagePhoto3] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ jobId: string; warrantyStatus: string } | null>(null);

  const effectiveDealerId = scope.currentDealer?.id ?? sessionDealerId ?? '';
  const branchId = scope.currentBranch?.id ?? '';

  // Refetch technicians whenever the dealer or branch selection changes,
  // and clear the previously-selected technician since it may not belong
  // to the new dealer/branch's roster.
  const firstTechFetch = useRef(true);
  useEffect(() => {
    if (firstTechFetch.current) {
      firstTechFetch.current = false;
      return; // skip redundant refetch on mount - server already loaded initialTechnicians
    }
    setTechnicianId('');
    if (!effectiveDealerId) {
      setTechnicians([]);
      return;
    }
    const branchName = scope.currentBranch?.name ?? '';
    const qs = new URLSearchParams({ dealerId: effectiveDealerId });
    if (branchName) qs.set('branch', branchName);
    fetch(`/api/technicians?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setTechnicians(json.technicians);
      })
      .catch(() => {});
  }, [effectiveDealerId, branchId, scope.currentBranch]);

  const selectedCode = useMemo(
    () => problemCodes.find((p) => p.id === problemCodeId) ?? null,
    [problemCodes, problemCodeId],
  );
  const problemSystem = selectedCode?.system ?? 'other';

  // Auto-fill severity from the failure code's default, but stop overriding
  // once the user has manually picked a severity of their own.
  useEffect(() => {
    if (selectedCode?.default_severity && !severityTouched.current) {
      setSeverity(selectedCode.default_severity);
    }
  }, [selectedCode]);

  function onSeverityChange(value: Severity | '') {
    severityTouched.current = true;
    setSeverity(value);
  }

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
    return calcWarranty(
      vehicle?.delivery_date ?? null,
      foundDate,
      problemSystem as 'powertrain' | 'other',
    );
  }, [vehicle, foundDate, problemSystem]);

  // Preload the full vehicle list directly from Supabase once - the report
  // form then renders it as a dropdown (filtered client-side as the user
  // types) instead of debouncing a server search and requiring a manual
  // "ตรวจสอบ" click before model/delivery date show up.
  useEffect(() => {
    const CACHE_KEY = 'mqr_vehicle_list_cache_v1';
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min - long enough to cover one visit's worth of navigation, short enough to stay fresh within a shift
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, results } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS && Array.isArray(results)) {
          setAllVehicles(results);
          setVehicleListLoading(false);
          return; // skip the network round-trip entirely on repeat visits
        }
      }
    } catch {
      /* ignore corrupt/unavailable sessionStorage, fall through to fetch */
    }
    (async () => {
      try {
        const res = await fetch('/api/vehicles/list');
        const json = await res.json();
        if (json.ok) {
          setAllVehicles(json.results);
          try {
            sessionStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ ts: Date.now(), results: json.results }),
            );
          } catch {
            /* sessionStorage full/unavailable - not critical */
          }
        }
      } catch {
        /* ignore - falls back to manual entry + the onBlur exact-lookup */
      } finally {
        setVehicleListLoading(false);
      }
    })();
  }, []);

  // Dropdown: show matches from the preloaded list as the user types, or the
  // full list (capped) when the field is focused with nothing typed yet.
  useEffect(() => {
    if (vehicle) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const term = serial.trim().toUpperCase();
    const matches = term
      ? allVehicles.filter((v) => v.serial.toUpperCase().includes(term)).slice(0, 30)
      : allVehicles.slice(0, 30);
    setSearchResults(matches);
  }, [serial, vehicle, allVehicles]);

  function onSerialChange(value: string) {
    setSerial(value);
    setSearchOpen(true);
    if (vehicle) {
      setVehicle(null);
      setVehicleChecked(false);
      setModel('');
    }
  }

  function onSerialFocus() {
    if (!vehicle) setSearchOpen(true);
  }

  // Selecting from the dropdown fills model/delivery date immediately from
  // the already-loaded Supabase data - no fetch, no "ตรวจสอบ" click.
  function selectVehicleResult(r: VehicleSearchResult) {
    setSearchOpen(false);
    setSerial(r.serial);
    setVehicle({
      serial: r.serial,
      model: r.model,
      delivery_date: r.deliveryDate,
      source: r.source,
    });
    setModel(r.model ?? '');
    setVehicleChecked(true);

    // Best-effort, non-blocking enrichment (engine serial / product code /
    // PDI status from the live Tractor IN sheet) - doesn't delay the autofill.
    fetch(`/api/vehicles/${encodeURIComponent(r.serial)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.found) setVehicle(json.vehicle);
      })
      .catch(() => {
        /* ignore - the instant local autofill above already covers the form */
      });
  }

  // Fallback for serials typed by hand that aren't in the preloaded dropdown
  // list yet (e.g. a unit that just arrived, before the next sync). Runs
  // automatically on blur - no manual "ตรวจสอบ" button needed.
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

  /** Uploads through AttachmentService (`src/shared/attachments/`) rather
   *  than any storage provider directly - see
   *  `docs/engineering/ATTACHMENT_FRAMEWORK.md`. */
  async function uploadOne(file: File, label: string, attachmentType: 'ReportPhoto' | 'DefectPhoto' | 'RepairPhoto' | 'Video', onProgress?: (pct: number) => void) {
    return uploadAttachment(file, { module: 'mqr', entityType: 'record', entityId: pendingEntityId, attachmentType, label }, onProgress);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serial.trim() || !foundDate || !problemCodeId) {
      swalError('กรุณากรอกหมายเลขรถ วันที่พบปัญหา และอาการที่พบ ให้ครบถ้วน');
      return;
    }
    if (!severity) {
      swalError('กรุณาเลือกความรุนแรงของปัญหา');
      return;
    }
    if (!odometerPhoto || !serialPhoto || !damagePhoto1) {
      swalError('กรุณาแนบรูปเรือนไมล์, รูปเลขรถ, และรูปจุดที่เสียหาย 1 ให้ครบ');
      return;
    }
    if (!vehicle && !stockNote) {
      swalError('ไม่พบหมายเลขรถในระบบ กรุณาระบุที่มาของรถ (สต็อก/อื่นๆ)');
      return;
    }
    if (!scope.isDealerPinned && !effectiveDealerId) {
      swalError('กรุณาเลือกดีลเลอร์');
      return;
    }
    if (!customerName.trim()) {
      swalError('กรุณากรอกชื่อลูกค้า');
      return;
    }
    if (customerPhone && !PHONE_RE.test(customerPhone)) {
      swalError('เบอร์โทรลูกค้าไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก ขึ้นต้นด้วย 0)');
      return;
    }
    if (reporterPhone && !PHONE_RE.test(reporterPhone)) {
      swalError('เบอร์โทรผู้แจ้งไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก ขึ้นต้นด้วย 0)');
      return;
    }
    if (!repairDate) {
      swalError('กรุณากรอกวันที่นำรถเข้าซ่อม');
      return;
    }
    if (repairDate < foundDate) {
      swalError('วันที่นำรถเข้าซ่อม ต้องไม่ก่อนวันที่พบปัญหา');
      return;
    }
    if (hours !== '' && hoursInForRepair !== '' && Number(hoursInForRepair) < Number(hours)) {
      swalError('ชั่วโมงการใช้งานขณะนำเข้าซ่อม ต้องไม่น้อยกว่าชั่วโมงขณะพบปัญหา');
      return;
    }

    setSubmitting(true);
    swalLoading('กำลังบันทึก...');
    try {
      const photoLinks: PhotoLink[] = [];
      const namedPhotoSlots: {
        file: File | null;
        category: PhotoLink['category'];
        label: string;
        attachmentType: 'ReportPhoto' | 'DefectPhoto' | 'RepairPhoto';
      }[] = [
        { file: odometerPhoto, category: 'odometer', label: 'รูปเรือนไมล์', attachmentType: 'ReportPhoto' },
        { file: serialPhoto, category: 'vehicle_serial', label: 'รูปเลขรถ', attachmentType: 'ReportPhoto' },
        { file: damagePhoto1, category: 'damage_point_1', label: 'รูปจุดที่เสียหาย 1', attachmentType: 'DefectPhoto' },
        { file: damagePhoto2, category: 'damage_point_2', label: 'รูปจุดที่เสียหาย 2', attachmentType: 'DefectPhoto' },
        { file: damagePhoto3, category: 'damage_point_3', label: 'รูปจุดที่เสียหาย 3', attachmentType: 'DefectPhoto' },
      ];
      const totalFiles = namedPhotoSlots.filter((s) => s.file).length + (video ? 1 : 0);
      let doneFiles = 0;
      for (const slot of namedPhotoSlots) {
        if (!slot.file) continue;
        doneFiles += 1;
        swalUpdateLoading(`กำลังอัปโหลด${slot.label} (${doneFiles}/${totalFiles})...`);
        const uploaded = await uploadOne(slot.file, slot.label, slot.attachmentType, (pct) =>
          swalUpdateLoading(`กำลังอัปโหลด${slot.label} (${doneFiles}/${totalFiles}) ${pct}%`),
        );
        photoLinks.push({ category: slot.category, label: slot.label, url: uploaded.url ?? '', attachmentId: uploaded.attachmentId });
      }
      let videoLink: string | null = null;
      let videoAttachmentId: string | null = null;
      if (video) {
        doneFiles += 1;
        swalUpdateLoading(`กำลังอัปโหลดวิดีโอปัญหา (${doneFiles}/${totalFiles})...`);
        const uploaded = await uploadOne(video, 'วิดีโอปัญหา', 'Video', (pct) =>
          swalUpdateLoading(`กำลังอัปโหลดวิดีโอปัญหา (${doneFiles}/${totalFiles}) ${pct}%`),
        );
        videoLink = uploaded.url;
        videoAttachmentId = uploaded.attachmentId;
      }

      swalUpdateLoading('กำลังบันทึกข้อมูลรายงาน...');
      const json = await fetchJson<{ record: { job_id: string }; warranty: { status: string } }>(
        '/api/records',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serial: serial.trim(),
            model: model || vehicle?.model || '',
            hours: hours === '' ? null : Number(hours),
            foundDate,
            problemCode: selectedCode?.label ?? '',
            problemSystem,
            severity,
            peripheralEquipment,
            customerName,
            customerPhone,
            reporterName,
            reporterPhone,
            attachment,
            stockNote: vehicle ? null : stockNote,
            lat: gpsLocation.latitude,
            lng: gpsLocation.longitude,
            gpsAccuracy: gpsLocation.accuracy,
            googleMapsUrl: gpsLocation.googleMapsUrl,
            photoLinks,
            videoLink,
            videoAttachmentId,
            dealerId: effectiveDealerId || null,
            branchId: branchId || null,
            technicianId: technicianId || null,
            repairDate,
            hoursInForRepair: hoursInForRepair === '' ? null : Number(hoursInForRepair),
          }),
        },
      );

      // Reassigning uploaded attachments from pendingEntityId to the real
      // job_id happens server-side in /api/records (single source of
      // truth - see route.ts) rather than a second client round-trip.
      swalClose();
      setSuccess({ jobId: json.record.job_id, warrantyStatus: json.warranty.status });
    } catch (err: any) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalError(
          'เซสชันของคุณหมดอายุ ข้อมูลที่กรอกจะยังอยู่ในหน้านี้ — กรุณาเปิดแท็บใหม่แล้วเข้าสู่ระบบอีกครั้ง จากนั้นกลับมาที่แท็บนี้และกด "บันทึกรายงานปัญหาคุณภาพ" อีกครั้ง',
        );
      } else {
        swalError(err?.message ?? 'เกิดข้อผิดพลาด');
      }
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
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 rounded border border-gray-300 text-sm"
          >
            แจ้งงานใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ข้อมูลรถ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">1. ข้อมูลรถ</h2>
        <div className="relative">
          <label className="block text-sm font-medium mb-1">หมายเลขรถ (Serial)</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={serial}
            onChange={(e) => onSerialChange(e.target.value)}
            onFocus={onSerialFocus}
            onBlur={() =>
              setTimeout(() => {
                setSearchOpen(false);
                checkSerialExact();
              }, 150)
            }
            autoComplete="off"
            placeholder={
              vehicleListLoading
                ? 'กำลังโหลดรายการเลขรถ...'
                : 'เลือกจากรายการ หรือพิมพ์หมายเลขรถ...'
            }
            required
          />
          {vehicleListLoading && (
            <p className="text-xs text-gray-400 mt-1">กำลังโหลดรายการเลขรถ...</p>
          )}

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
                    <span className="text-gray-500 text-xs">{r.model ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {vehicleChecked && !vehicleLoading && !searchOpen && (
            <p className={`text-xs mt-1 ${vehicle ? 'text-green-600' : 'text-amber-600'}`}>
              {vehicle
                ? `พบในระบบ: ${vehicle.model ?? ''}${
                    vehicle.source === 'tractor_in_sheet'
                      ? ' (จากฐานข้อมูล Tractor IN — ยังไม่มีข้อมูลส่งมอบ)'
                      : ''
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
            <label className="block text-sm font-medium mb-1">
              ชั่วโมงการใช้งานขณะพบปัญหา (Hours)
            </label>
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
              {warrantyPreview.ageMonths !== null
                ? ` (อายุรถ ${warrantyPreview.ageMonths} เดือน)`
                : ''}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ความรุนแรงของปัญหา</label>
          <select
            className="w-full sm:w-72 border border-gray-300 rounded px-3 py-2"
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value as Severity | '')}
            required
          >
            <option value="">-- เลือกความรุนแรง --</option>
            {SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">อุปกรณ์ต่อพ่วงที่ใช้งาน (ถ้ามี)</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={peripheralEquipment}
            onChange={(e) => setPeripheralEquipment(e.target.value)}
            placeholder="เช่น ผาลไถ, เครื่องตัดหญ้า"
          />
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
          <DealerBranchSelector
            scope={scope}
            pinnedDealerName={pinnedDealerName}
            pinnedBranchName={pinnedBranchName}
            dealerLabel="ดีลเลอร์"
            branchLabel="สาขา"
            dealerAllLabel="-- เลือกดีลเลอร์ --"
            branchAllLabel="-- ไม่ระบุ --"
            className="contents"
          />
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
          <GpsLocationPicker value={gpsLocation} onChange={setGpsLocation} />
        </div>
      </section>

      {/* รูป/วิดีโอ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-brand-dark">4. รูปภาพ / วิดีโอ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { label: 'รูปเรือนไมล์', file: odometerPhoto, set: setOdometerPhoto, required: true },
              { label: 'รูปเลขรถ', file: serialPhoto, set: setSerialPhoto, required: true },
              {
                label: 'รูปจุดที่เสียหาย 1',
                file: damagePhoto1,
                set: setDamagePhoto1,
                required: true,
              },
              {
                label: 'รูปจุดที่เสียหาย 2',
                file: damagePhoto2,
                set: setDamagePhoto2,
                required: false,
              },
              {
                label: 'รูปจุดที่เสียหาย 3',
                file: damagePhoto3,
                set: setDamagePhoto3,
                required: false,
              },
            ] as const
          ).map((slot) => (
            <div key={slot.label}>
              <label className="block text-sm font-medium mb-1">
                {slot.label} {slot.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="w-full text-sm"
                onChange={(e) => slot.set(e.target.files?.[0] ?? null)}
                required={slot.required && !slot.file}
              />
              {slot.file ? (
                <p className="text-xs text-green-600 mt-1">เลือกแล้ว: {slot.file.name}</p>
              ) : (
                !slot.required && <p className="text-xs text-gray-400 mt-1">ไม่บังคับ</p>
              )}
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
            {video && <p className="text-xs text-green-600 mt-1">เลือกแล้ว: {video.name}</p>}
          </div>
        </div>
        <p className="text-xs text-gray-400">
          รูปหลังการแก้ไขสามารถแนบเพิ่มได้หลังปิดงาน ในหน้ารายละเอียดรายงาน
        </p>
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
