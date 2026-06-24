'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MqrRecord, STATUS_VALUES, STATUS_LABELS, StatusValue } from '@/lib/types';

export default function UpdateForm({ record }: { record: MqrRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(record.status);
  const [cause, setCause] = useState(record.cause ?? '');
  const [damagedParts, setDamagedParts] = useState(record.damaged_parts ?? '');
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let afterPhotoLink: string | undefined;
      if (afterPhoto) {
        const fd = new FormData();
        fd.append('file', afterPhoto);
        fd.append('label', 'รูปหลังซ่อม');
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
        const upJson = await upRes.json();
        if (!upJson.ok) throw new Error(upJson.error || 'อัปโหลดรูปไม่สำเร็จ');
        afterPhotoLink = upJson.url;
      }

      const res = await fetch(`/api/records/${encodeURIComponent(record.job_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cause, damagedParts, afterPhotoLink }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'อัปเดตไม่สำเร็จ');
      setSavedAt(Date.now());
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
      <div>
        <label className="block text-sm font-medium mb-1">สถานะ</label>
        <select
          className="w-full sm:w-64 border border-gray-300 rounded px-3 py-2"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">สาเหตุ</label>
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
      <div>
        <label className="block text-sm font-medium mb-1">รูปหลังซ่อม</label>
        <input
          type="file"
          accept="image/*"
          className="text-sm"
          onChange={(e) => setAfterPhoto(e.target.files?.[0] ?? null)}
        />
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
