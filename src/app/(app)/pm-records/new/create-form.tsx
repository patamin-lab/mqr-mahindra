'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose, swalSuccess } from '@/lib/swal';
import { isNonEmptyString } from '@/features/pm-record/validation';
import type { PmRecord } from '@/features/pm-record/types';
import TextField from '@/components/shared/forms/TextField';

export default function PmRecordCreateForm({ showDealerField }: { showDealerField: boolean }) {
  const router = useRouter();
  const [dealerId, setDealerId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [serial, setSerial] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (showDealerField && !isNonEmptyString(dealerId)) {
      swalError('กรุณากรอกรหัสดีลเลอร์');
      return;
    }
    if (!isNonEmptyString(status)) {
      swalError('กรุณากรอกสถานะ');
      return;
    }

    const payload: Record<string, unknown> = {
      branch_id: branchId.trim() || null,
      serial: serial.trim() || null,
      technician_id: technicianId.trim() || null,
      scheduled_date: scheduledDate.trim() || null,
      status: status.trim(),
      notes: notes.trim() || null,
    };
    if (showDealerField) {
      payload.dealer_id = dealerId.trim();
    }

    setSubmitting(true);
    swalLoading('กำลังบันทึก...');
    try {
      const result = await fetchJson<{ ok: true; data: PmRecord }>('/api/pm-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      swalClose();
      await swalSuccess('บันทึกข้อมูลสำเร็จ');
      router.push(`/pm-records/${encodeURIComponent(result.data.id)}`);
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      } else {
        swalError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        {showDealerField && (
          <TextField label="Dealer ID" value={dealerId} onChange={setDealerId} placeholder="Dealer ID" />
        )}
        <TextField label="Branch ID" value={branchId} onChange={setBranchId} placeholder="Branch ID (optional)" />
        <TextField label="Serial" value={serial} onChange={setSerial} placeholder="Vehicle serial (optional)" />
        <TextField
          label="Technician ID"
          value={technicianId}
          onChange={setTechnicianId}
          placeholder="Technician ID (optional)"
        />
        <TextField
          label="Scheduled Date"
          value={scheduledDate}
          onChange={setScheduledDate}
          placeholder="YYYY-MM-DD (optional)"
        />
        <TextField label="Status" value={status} onChange={setStatus} placeholder="Status" />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea
          className="w-full rounded border px-2 py-1.5 text-sm"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
