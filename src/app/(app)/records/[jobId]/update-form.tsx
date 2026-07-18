'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MqrRecord,
  STATUS_VALUES,
  STATUS_LABELS,
  StatusValue,
  Severity,
  SEVERITY_VALUES,
  SEVERITY_LABELS,
  PhotoLink,
  Role,
  canTransitionMqrStatus,
} from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalSuccess, swalLoading, swalUpdateLoading, swalClose } from '@/lib/swal';
import { uploadAttachment } from '@/components/shared/attachments/uploadAttachment';
import { ImageThumbnail } from '@/components/shared/image';
import { mqrPhotoToImageItem } from '@/lib/mqrImageItems';

export default function UpdateForm({ record, role }: { record: MqrRecord; role: Role }) {
  const router = useRouter();
  const [status, setStatus] = useState(record.status);
  // The record's own current status is always offered (a no-op "keep as-is"
  // option), plus whatever canTransitionMqrStatus() allows from here for
  // this role - SuperAdmin sees every status (unconditional override),
  // everyone else only the forward transitions defined in
  // MQR_STATUS_TRANSITIONS. Prevents selecting an invalid transition in the
  // UI rather than only rejecting it after Save.
  const selectableStatuses = STATUS_VALUES.filter(
    (s) => s === record.status || canTransitionMqrStatus(record.status as StatusValue, s, role)
  );
  const [severity, setSeverity] = useState<Severity | ''>(record.severity ?? '');
  const [cause, setCause] = useState(record.cause ?? '');
  const [damagedParts, setDamagedParts] = useState(record.damaged_parts ?? '');
  const [technicianAction, setTechnicianAction] = useState(record.technician_action ?? '');
  const [correctiveAction, setCorrectiveAction] = useState(record.corrective_action ?? '');
  const [preventiveAction, setPreventiveAction] = useState(record.preventive_action ?? '');
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [photos, setPhotos] = useState<PhotoLink[]>(record.photo_links ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhotos(record.photo_links ?? []);
  }, [record.photo_links]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    swalLoading('กำลังบันทึก...');
    try {
      const addPhotoLinks: PhotoLink[] = [];
      for (let i = 0; i < afterPhotos.length; i++) {
        const label = `ภาพหลังการแก้ไข ${i + 1}`;
        swalUpdateLoading(`กำลังอัปโหลด${label} (${i + 1}/${afterPhotos.length})...`);
        // Uploaded through AttachmentService (docs/engineering/ATTACHMENT_FRAMEWORK.md)
        // straight against the record's real job_id - unlike the report
        // form, this record already exists, so there's no pending/reassign
        // step needed.
        const uploaded = await uploadAttachment(
          afterPhotos[i],
          { module: 'mqr', entityType: 'record', entityId: record.job_id, attachmentType: 'RepairPhoto', label },
          (pct) => swalUpdateLoading(`กำลังอัปโหลด${label} (${i + 1}/${afterPhotos.length}) ${pct}%...`)
        );
        addPhotoLinks.push({ category: 'after_repair', label, url: uploaded.url ?? '', attachmentId: uploaded.attachmentId });
      }

      const keptUrls = new Set(photos.map((p) => p.url));
      const removePhotoUrls = (record.photo_links ?? [])
        .filter((p) => !keptUrls.has(p.url))
        .map((p) => p.url);

      swalUpdateLoading('กำลังบันทึกข้อมูล...');
      const json = await fetchJson<{ ok: boolean; error?: string }>(`/api/records/${encodeURIComponent(record.job_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          severity: severity || undefined,
          cause,
          damagedParts,
          technicianAction,
          correctiveAction,
          preventiveAction,
          addPhotoLinks,
          removePhotoUrls,
        }),
      });
      if (!json.ok) throw new Error(json.error || 'อัปเดตไม่สำเร็จ');
      setAfterPhotos([]);
      swalClose();
      await swalSuccess('บันทึกเรียบร้อย');
      router.refresh();
    } catch (err: any) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      } else {
        await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">สถานะ</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {selectableStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s as StatusValue]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ความรุนแรงของปัญหา</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | '')}
          >
            <option value="">-- ไม่ระบุ --</option>
            {SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">สาเหตุ (Cause)</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ชิ้นส่วนที่เสียหาย</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={damagedParts}
            onChange={(e) => setDamagedParts(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">การดำเนินการของช่าง</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={technicianAction}
            onChange={(e) => setTechnicianAction(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">การแก้ไข (Corrective Action)</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">การป้องกัน (Preventive Action)</label>
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            value={preventiveAction}
            onChange={(e) => setPreventiveAction(e.target.value)}
          />
        </div>
      </div>
      {photos.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">รูปภาพที่แนบไว้ ({photos.length})</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((p, i) => (
              <div key={`${p.url}-${i}`} className="relative">
                <ImageThumbnail item={mqrPhotoToImageItem(p, `${record.job_id}-edit-${i}`, p.label)} className="rounded border border-gray-200 aspect-square object-contain" />
                <button
                  type="button"
                  title="ลบรูปนี้"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs leading-6 text-center shadow hover:bg-red-700"
                >
                  ×
                </button>
                <div className="text-xs text-gray-500 mt-1 truncate">{p.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            กด × เพื่อลบรูป (จะลบจริงเมื่อกด &quot;บันทึกการอัปเดต&quot; ด้านล่าง) — หากต้องการเปลี่ยนรูป ให้ลบรูปเดิมแล้วแนบรูปใหม่ในช่อง
            &quot;เพิ่มภาพหลังการแก้ไข&quot;
          </p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">เพิ่มภาพหลังการแก้ไข</label>
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="text-sm"
          onChange={(e) => setAfterPhotos(Array.from(e.target.files ?? []))}
        />
        {afterPhotos.length > 0 && (
          <p className="text-xs text-green-600 mt-1">เลือกแล้ว {afterPhotos.length} รูป</p>
        )}
      </div>
      <button
        disabled={saving}
        className="px-5 py-2 rounded bg-brand-dark text-white text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก...' : 'บันทึกการอัปเดต'}
      </button>
    </form>
  );
}
