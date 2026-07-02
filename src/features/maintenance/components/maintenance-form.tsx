'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalSuccessToast, swalErrorToast } from '@/lib/swal';
import { isNonEmptyString } from '../utils/validation';
import type { MaintenanceRecord } from '../types';
import TextField from '@/components/shared/forms/TextField';

export interface MaintenanceFormInitial {
  dealer_id?: string | null;
  branch_id?: string | null;
  serial?: string | null;
  technician_id?: string | null;
  scheduled_date?: string | null;
  performed_date?: string | null;
  status?: string;
  notes?: string | null;
}

/** Discriminated on `mode` so `recordId` is compiler-enforced as required
 *  for 'edit' (a PUT with no id would be a bug, not a runtime option). */
export type MaintenanceFormProps =
  | {
      mode: 'create';
      /** A privileged actor may set an arbitrary dealer_id; only rendered/sent in 'create' mode. */
      showDealerField: boolean;
    }
  | {
      mode: 'edit';
      /** MaintenanceRecordUpdateInput has no dealer_id field at all, so 'edit' mode never shows or sends it. */
      showDealerField: boolean;
      recordId: string;
      initial?: MaintenanceFormInitial;
      /** Server-computed via `evaluateMaintenanceLock()` - when true, the
       *  two calculation-affecting fields this form exposes (Serial,
       *  Performed Date) are disabled. Notes/Status/other non-calculation
       *  fields stay editable even on a locked record. The API enforces
       *  this independently either way - this is UX only. */
      locked?: boolean;
    };

export default function MaintenanceForm(props: MaintenanceFormProps) {
  const { mode, showDealerField } = props;
  const initial = props.mode === 'edit' ? props.initial : undefined;
  const locked = props.mode === 'edit' && (props.locked ?? false);
  const router = useRouter();
  const [dealerId, setDealerId] = useState(initial?.dealer_id ?? '');
  const [branchId, setBranchId] = useState(initial?.branch_id ?? '');
  const [serial, setSerial] = useState(initial?.serial ?? '');
  const [technicianId, setTechnicianId] = useState(initial?.technician_id ?? '');
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduled_date ?? '');
  const [performedDate, setPerformedDate] = useState(initial?.performed_date ?? '');
  const [status, setStatus] = useState(initial?.status ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const showDealerInput = mode === 'create' && showDealerField;
  const cancelHref = props.mode === 'create' ? '/pm-records' : `/pm-records/${encodeURIComponent(props.recordId)}`;

  async function onSubmit() {
    if (showDealerInput && !isNonEmptyString(dealerId)) {
      swalErrorToast('กรุณากรอกรหัสดีลเลอร์');
      return;
    }
    if (!isNonEmptyString(status)) {
      swalErrorToast('กรุณากรอกสถานะ');
      return;
    }

    const payload: Record<string, unknown> = {
      branch_id: branchId.trim() || null,
      technician_id: technicianId.trim() || null,
      scheduled_date: scheduledDate.trim() || null,
      status: status.trim(),
      notes: notes.trim() || null,
    };
    if (showDealerInput) {
      payload.dealer_id = dealerId.trim();
    }
    // Calculation-affecting fields are omitted entirely (not just left
    // unchanged) when locked, so a locked record's edit still goes through
    // for the fields that are actually being changed (e.g. notes) instead
    // of being rejected server-side just for including these keys
    // unmodified - see MaintenanceService.update()'s touchesLockAffectingFields() guard.
    if (!locked) {
      payload.serial = serial.trim() || null;
      if (mode === 'edit') {
        payload.performed_date = performedDate.trim() || null;
      }
    }

    setSubmitting(true);
    swalLoading('กำลังบันทึก...');
    try {
      const url =
        props.mode === 'create' ? '/api/pm-records' : `/api/pm-records/${encodeURIComponent(props.recordId)}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const result = await fetchJson<{ ok: true; data: MaintenanceRecord }>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      swalClose();
      swalSuccessToast('บันทึกข้อมูลสำเร็จ');
      if (mode === 'create') {
        router.push('/pm-records');
      } else {
        router.push(`/pm-records/${encodeURIComponent(result.data.id)}`);
      }
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalErrorToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      } else {
        swalErrorToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        {showDealerInput && (
          <TextField
            label="Dealer ID"
            value={dealerId}
            onChange={setDealerId}
            placeholder="Dealer ID"
            disabled={submitting}
          />
        )}
        <TextField
          label="Branch ID"
          value={branchId}
          onChange={setBranchId}
          placeholder="Branch ID (optional)"
          disabled={submitting}
        />
        <TextField
          label={locked ? 'Serial (ล็อกอยู่)' : 'Serial'}
          value={serial}
          onChange={setSerial}
          placeholder="Vehicle serial (optional)"
          disabled={submitting || locked}
        />
        <TextField
          label="Technician ID"
          value={technicianId}
          onChange={setTechnicianId}
          placeholder="Technician ID (optional)"
          disabled={submitting}
        />
        <TextField
          label="Scheduled Date"
          value={scheduledDate}
          onChange={setScheduledDate}
          placeholder="YYYY-MM-DD (optional)"
          disabled={submitting}
        />
        {mode === 'edit' && (
          <TextField
            label={locked ? 'Performed Date (ล็อกอยู่)' : 'Performed Date'}
            value={performedDate}
            onChange={setPerformedDate}
            placeholder="YYYY-MM-DD (optional)"
            disabled={submitting || locked}
          />
        )}
        <TextField
          label="Status"
          value={status}
          onChange={setStatus}
          placeholder="Status"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea
          className="w-full rounded border px-2 py-1.5 text-sm disabled:opacity-50"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Link
          href={submitting ? '#' : cancelHref}
          aria-disabled={submitting}
          className={`rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 ${
            submitting ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
