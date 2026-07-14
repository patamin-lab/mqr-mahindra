'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ProblemCode,
  PhotoLink,
  Dealer,
  Technician,
  Severity,
  SEVERITY_VALUES,
  SEVERITY_LABELS,
  Role,
  MqrRecord,
} from '@/lib/types';
import { calcWarranty } from '@/lib/warranty';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalSuccess, swalLoading, swalUpdateLoading, swalClose } from '@/lib/swal';
import { uploadAttachment, newPendingEntityId } from '@/components/shared/attachments/uploadAttachment';
import GpsLocationPicker from '@/components/shared/gps/GpsLocationPicker';
import type { GpsLocation } from '@/components/shared/gps/types';
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import DealerBranchSelector from '@/components/shared/scope/DealerBranchSelector';

interface VehicleInfo {
  serial: string;
  model: string | null;
  delivery_date: string | null;
  engine_number?: string | null;
  product_code?: string | null;
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
  mode = 'create',
  record,
}: {
  problemCodes: ProblemCode[];
  dealers: Dealer[];
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  pinnedDealerName?: string | null;
  pinnedBranchName?: string | null;
  initialTechnicians: Technician[];
  /** 'edit' reuses this exact form, prefilled from `record`, saving via
   *  `PATCH /api/records/[jobId]` instead of `POST /api/records` - see
   *  `records/[jobId]/edit/page.tsx`. */
  mode?: 'create' | 'edit';
  /** Required when `mode === 'edit'`. */
  record?: MqrRecord;
}) {
  const router = useRouter();
  const isEdit = mode === 'edit' && !!record;

  function existingPhoto(category: PhotoLink['category']): PhotoLink | null {
    return record?.photo_links?.find((p) => p.category === category) ?? null;
  }
  const existingOdometer = existingPhoto('odometer');
  const existingSerialPhoto = existingPhoto('vehicle_serial');
  const existingDamage1 = existingPhoto('damage_point_1');
  const existingDamage2 = existingPhoto('damage_point_2');
  const existingDamage3 = existingPhoto('damage_point_3');

  // ---- vehicle smart search ----
  // Uploaded via AttachmentService against this temporary ID (the real
  // job_id doesn't exist until /api/records creates the record) - see
  // uploadAttachment.ts / reassignAttachments(). Edit mode uploads
  // directly against the real, already-existing job_id instead (see
  // `uploadOne` below) - no pending/reassign step needed, same reasoning
  // as `update-form.tsx`'s after-repair photo uploads.
  const pendingEntityId = useRef(newPendingEntityId()).current;
  const [serial, setSerial] = useState(record?.serial ?? '');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleChecked, setVehicleChecked] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [allVehicles, setAllVehicles] = useState<VehicleSearchResult[]>([]);
  const [vehicleListLoading, setVehicleListLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<VehicleSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [model, setModel] = useState(record?.model ?? '');
  const [stockNote, setStockNote] = useState(record?.stock_note ?? '');
  const [hours, setHours] = useState(record?.hours != null ? String(record.hours) : '');
  const [foundDate, setFoundDate] = useState(record?.found_date ?? todayStr());
  const [problemCodeId, setProblemCodeId] = useState<string>(() =>
    record ? problemCodes.find((p) => p.label === record.problem_code)?.id ?? '' : ''
  );
  const [severity, setSeverity] = useState<Severity | ''>(record?.severity ?? '');
  // In edit mode the severity is already prefilled from the record - never
  // let the auto-fill-from-problem-code effect below silently overwrite it.
  const severityTouched = useRef(isEdit);
  const [peripheralEquipment, setPeripheralEquipment] = useState(record?.peripheral_equipment ?? '');
  const [customerName, setCustomerName] = useState(record?.customer_name ?? '');
  const [customerPhone, setCustomerPhone] = useState(record?.customer_phone ?? '');
  const [reporterName, setReporterName] = useState(record?.reporter_name ?? '');
  const [reporterPhone, setReporterPhone] = useState(record?.reporter_phone ?? '');
  const [attachment, setAttachment] = useState(record?.attachment ?? '');
  const [gpsLocation, setGpsLocation] = useState<GpsLocation>({
    latitude: record?.lat ?? null,
    longitude: record?.lng ?? null,
    accuracy: record?.gps_accuracy ?? null,
    googleMapsUrl: record?.google_maps_url ?? null,
  });

  // ---- repair details (Phase 3) ----
  const scope = useDealerBranchScope({
    role,
    sessionDealerId,
    sessionBranchId,
    initialDealers: dealers,
    initialDealerId: record?.dealer_id,
    initialBranchId: record?.branch_id,
  });
  const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians);
  const [technicianId, setTechnicianId] = useState(record?.technician_id ?? '');
  const [repairDate, setRepairDate] = useState(record?.repair_date ?? todayStr());
  const [hoursInForRepair, setHoursInForRepair] = useState(record?.hours_in_for_repair != null ? String(record.hours_in_for_repair) : '');

  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);
  const [damagePhoto1, setDamagePhoto1] = useState<File | null>(null);
  const [damagePhoto2, setDamagePhoto2] = useState<File | null>(null);
  const [damagePhoto3, setDamagePhoto3] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ jobId: string; warrantyStatus: string } | null>(null);

  // Edit mode never reassigns dealer/branch (job_id already embeds the
  // dealer at creation time) - the selector is rendered read-only (see the
  // JSX below) and these stay fixed to the record's original values,
  // regardless of what `scope` would otherwise resolve to for a
  // privileged role.
  const effectiveDealerId = isEdit ? record?.dealer_id ?? '' : scope.currentDealer?.id ?? sessionDealerId ?? '';
  const branchId = isEdit ? record?.branch_id ?? '' : scope.currentBranch?.id ?? '';

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

    // Best-effort, non-blocking enrichment (engine number / product code
    // from vehicle master data) - doesn't delay the autofill.
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

  // Edit mode: run the same exact-match lookup on mount as if the user had
  // just blurred the serial field with the record's existing serial -
  // reuses checkSerialExact() rather than reconstructing `vehicle` from the
  // record (which doesn't store delivery_date/engine_number/product_code -
  // only a live lookup has those). Also means an edit correctly reflects
  // the vehicle's *current* state (e.g. since renamed/removed), not stale
  // data frozen at creation time.
  useEffect(() => {
    if (isEdit) checkSerialExact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Uploads through AttachmentService (`src/shared/attachments/`) rather
   *  than any storage provider directly - see
   *  `docs/engineering/ATTACHMENT_FRAMEWORK.md`. Edit mode uploads
   *  directly against the real, already-existing job_id (no pending id/
   *  reassignment needed - see the comment on `pendingEntityId` above). */
  async function uploadOne(file: File, label: string, attachmentType: 'ReportPhoto' | 'DefectPhoto' | 'RepairPhoto' | 'Video', onProgress?: (pct: number) => void) {
    const entityId = isEdit && record ? record.job_id : pendingEntityId;
    return uploadAttachment(file, { module: 'mqr', entityType: 'record', entityId, attachmentType, label }, onProgress);
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
    if (
      (!odometerPhoto && !existingOdometer) ||
      (!serialPhoto && !existingSerialPhoto) ||
      (!damagePhoto1 && !existingDamage1)
    ) {
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
      const namedPhotoSlots: {
        file: File | null;
        existing: PhotoLink | null;
        category: PhotoLink['category'];
        label: string;
        attachmentType: 'ReportPhoto' | 'DefectPhoto' | 'RepairPhoto';
      }[] = [
        { file: odometerPhoto, existing: existingOdometer, category: 'odometer', label: 'รูปเรือนไมล์', attachmentType: 'ReportPhoto' },
        { file: serialPhoto, existing: existingSerialPhoto, category: 'vehicle_serial', label: 'รูปเลขรถ', attachmentType: 'ReportPhoto' },
        { file: damagePhoto1, existing: existingDamage1, category: 'damage_point_1', label: 'รูปจุดที่เสียหาย 1', attachmentType: 'DefectPhoto' },
        { file: damagePhoto2, existing: existingDamage2, category: 'damage_point_2', label: 'รูปจุดที่เสียหาย 2', attachmentType: 'DefectPhoto' },
        { file: damagePhoto3, existing: existingDamage3, category: 'damage_point_3', label: 'รูปจุดที่เสียหาย 3', attachmentType: 'DefectPhoto' },
      ];
      const totalFiles = namedPhotoSlots.filter((s) => s.file).length + (video ? 1 : 0);
      let doneFiles = 0;
      // In edit mode, a slot with no newly-selected file keeps its existing
      // photo untouched (not resent) - only replaced slots are uploaded and
      // diffed via addPhotoLinks/removePhotoUrls (the same merge mechanism
      // `update-form.tsx`'s after-repair photos already use).
      const newPhotoLinks: PhotoLink[] = [];
      const replacedPhotoUrls: string[] = [];
      for (const slot of namedPhotoSlots) {
        if (!slot.file) continue;
        doneFiles += 1;
        swalUpdateLoading(`กำลังอัปโหลด${slot.label} (${doneFiles}/${totalFiles})...`);
        const uploaded = await uploadOne(slot.file, slot.label, slot.attachmentType, (pct) =>
          swalUpdateLoading(`กำลังอัปโหลด${slot.label} (${doneFiles}/${totalFiles}) ${pct}%`),
        );
        newPhotoLinks.push({ category: slot.category, label: slot.label, url: uploaded.url ?? '', attachmentId: uploaded.attachmentId });
        if (slot.existing) replacedPhotoUrls.push(slot.existing.url);
      }
      let videoLink: string | null = isEdit ? record?.video_link ?? null : null;
      let videoAttachmentId: string | null = isEdit ? record?.video_attachment_id ?? null : null;
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

      if (isEdit && record) {
        await fetchJson<{ ok: boolean }>(`/api/records/${encodeURIComponent(record.job_id)}`, {
          method: 'PATCH',
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
            videoLink,
            videoAttachmentId,
            technicianId: technicianId || null,
            repairDate,
            hoursInForRepair: hoursInForRepair === '' ? null : Number(hoursInForRepair),
            addPhotoLinks: newPhotoLinks,
            removePhotoUrls: replacedPhotoUrls,
          }),
        });
        swalClose();
        await swalSuccess('บันทึกการแก้ไขรายงานเรียบร้อย');
        router.push(`/records/${encodeURIComponent(record.job_id)}`);
        router.refresh();
        return;
      }

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
            photoLinks: newPhotoLinks,
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
          isEdit
            ? 'เซสชันของคุณหมดอายุ ข้อมูลที่กรอกจะยังอยู่ในหน้านี้ — กรุณาเปิดแท็บใหม่แล้วเข้าสู่ระบบอีกครั้ง จากนั้นกลับมาที่แท็บนี้และกด "บันทึกการแก้ไข" อีกครั้ง'
            : 'เซสชันของคุณหมดอายุ ข้อมูลที่กรอกจะยังอยู่ในหน้านี้ — กรุณาเปิดแท็บใหม่แล้วเข้าสู่ระบบอีกครั้ง จากนั้นกลับมาที่แท็บนี้และกด "บันทึกรายงานปัญหาคุณภาพ" อีกครั้ง',
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
          {vehicle && (vehicle.engine_number || vehicle.product_code) && (
            <p className="text-xs mt-1 text-gray-500">
              {vehicle.engine_number ? `เลขเครื่องยนต์: ${vehicle.engine_number}` : ''}
              {vehicle.engine_number && vehicle.product_code ? ' · ' : ''}
              {vehicle.product_code ? `Product Code: ${vehicle.product_code}` : ''}
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
          {isEdit ? (
            // Dealer/branch are never reassigned via edit - job_id already
            // embeds the dealer at creation time (see effectiveDealerId's
            // comment above) - shown as fixed text instead of the
            // interactive selector, regardless of role.
            <>
              <div>
                <label className="block text-sm font-medium mb-1">ดีลเลอร์</label>
                <p className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-gray-600">
                  {pinnedDealerName ?? '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">สาขา</label>
                <p className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-gray-600">
                  {pinnedBranchName ?? '-'}
                </p>
              </div>
            </>
          ) : (
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
          )}
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
              { label: 'รูปเรือนไมล์', file: odometerPhoto, set: setOdometerPhoto, required: true, existing: existingOdometer },
              { label: 'รูปเลขรถ', file: serialPhoto, set: setSerialPhoto, required: true, existing: existingSerialPhoto },
              {
                label: 'รูปจุดที่เสียหาย 1',
                file: damagePhoto1,
                set: setDamagePhoto1,
                required: true,
                existing: existingDamage1,
              },
              {
                label: 'รูปจุดที่เสียหาย 2',
                file: damagePhoto2,
                set: setDamagePhoto2,
                required: false,
                existing: existingDamage2,
              },
              {
                label: 'รูปจุดที่เสียหาย 3',
                file: damagePhoto3,
                set: setDamagePhoto3,
                required: false,
                existing: existingDamage3,
              },
            ] as const
          ).map((slot) => (
            <div key={slot.label}>
              <label className="block text-sm font-medium mb-1">
                {slot.label} {slot.required && !slot.existing && <span className="text-red-500">*</span>}
              </label>
              {slot.existing && !slot.file && (
                <div className="mb-2">
                  <img
                    src={slot.existing.url}
                    alt={slot.label}
                    className="rounded border border-gray-200 h-20 w-20 object-cover"
                  />
                  <p className="text-xs text-gray-400 mt-1">รูปปัจจุบัน — เลือกไฟล์ใหม่เพื่อแทนที่</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="w-full text-sm"
                onChange={(e) => slot.set(e.target.files?.[0] ?? null)}
                required={slot.required && !slot.file && !slot.existing}
              />
              {slot.file ? (
                <p className="text-xs text-green-600 mt-1">เลือกแล้ว: {slot.file.name}</p>
              ) : (
                !slot.required && !slot.existing && <p className="text-xs text-gray-400 mt-1">ไม่บังคับ</p>
              )}
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">วิดีโอปัญหา (ถ้ามี)</label>
            {isEdit && record?.video_link && !video && (
              <p className="text-xs text-gray-400 mb-1">
                มีวิดีโออยู่แล้ว —{' '}
                <a href={record.video_link} target="_blank" className="text-brand-red hover:underline">
                  ดูวิดีโอปัจจุบัน
                </a>{' '}
                (เลือกไฟล์ใหม่เพื่อแทนที่)
              </p>
            )}
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

      <div className="flex items-center gap-3">
        <button
          disabled={submitting}
          className="w-full sm:w-auto px-6 py-3 rounded bg-brand-red hover:bg-brand-redDark text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึกรายงานปัญหาคุณภาพ'}
        </button>
        {isEdit && record && (
          <Link
            href={`/records/${encodeURIComponent(record.job_id)}`}
            className="px-4 py-2 text-sm text-gray-600 hover:underline"
          >
            ยกเลิก
          </Link>
        )}
      </div>
    </form>
  );
}
