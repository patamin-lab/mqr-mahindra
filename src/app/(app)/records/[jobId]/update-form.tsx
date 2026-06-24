'use client';

import { useState } from 'react';
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
} from '@/lib/types';

export default function UpdateForm({ record }: { record: MqrRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(record.status);
  const [severity, setSeverity] = useState<Severity | ''>(record.severity ?? '');
  const [cause, setCause] = useState(record.cause ?? '');
  const [damagedParts, setDamagedParts] = useState(record.damaged_parts ?? '');
  const [technicianAction, setTechnicianAction] = useState(record.technician_action ?? '');
  const [correctiveAction, setCorrectiveAction] = useState(record.corrective_action ?? '');
  const [preventiveAction, setPreventiveAction] = useState(record.preventive_action ?? '');
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const addPhotoLinks: PhotoLink[] = [];
      for (let i = 0; i < afterPhotos.length; i++) {
        const label = `ภาพหลังการแก้ไข ${i + 1}`;
        const fd = new FormData();
        fd.append('file', afterPhotos[i]);
        fd.append('label', label);
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
        const upJson = await upRes.json();
        if (!upJson.ok) throw new Error(upJson.error || 'อัปโหลดรูปไม่สำเร็จ');
        addPhotoLinks.push({ category: 'after_repair', label, url: upJson.url });
      }

      const res = await fetch(`/api/records/${encodeURIComponent(record.job_id)}`, {
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
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'อัปเดตไม่สำเร็จ');
      setSavedAt(Date.now());
      setAfterPhotos([]);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {savedAt && !error && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          บันทึกเรียบร้อย
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">สถานะ</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_VALUES.map((s) => (
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
