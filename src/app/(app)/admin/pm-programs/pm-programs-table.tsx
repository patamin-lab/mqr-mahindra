'use client';

import { useMemo, useState } from 'react';
import { PmInterval, PmProgram } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';

interface Props {
  initialPmPrograms: PmProgram[];
  models: string[];
  pmIntervals: PmInterval[];
}

export default function PmProgramsTable({ initialPmPrograms, models, pmIntervals }: Props) {
  // modelsByInterval[pmIntervalId] = Set of currently-checked model names
  // (draft state, independent per interval so switching one doesn't lose
  // unsaved edits on another).
  const initialMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const iv of pmIntervals) map.set(iv.id, new Set());
    for (const p of initialPmPrograms) {
      if (!map.has(p.pm_interval_id)) map.set(p.pm_interval_id, new Set());
      map.get(p.pm_interval_id)!.add(p.model);
    }
    return map;
  }, [initialPmPrograms, pmIntervals]);

  const [modelsByInterval, setModelsByInterval] = useState(initialMap);
  const [savingId, setSavingId] = useState<string | null>(null);

  function toggleModel(pmIntervalId: string, model: string) {
    setModelsByInterval((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(pmIntervalId) ?? []);
      if (current.has(model)) current.delete(model);
      else current.add(model);
      next.set(pmIntervalId, current);
      return next;
    });
  }

  async function save(pmIntervalId: string) {
    setSavingId(pmIntervalId);
    swalLoading('กำลังบันทึก...');
    try {
      const selected = Array.from(modelsByInterval.get(pmIntervalId) ?? []);
      const json = await fetchJson<{ ok: boolean; error?: string }>(`/api/admin/pm-programs/${pmIntervalId}`, {
        method: 'PUT',
        body: JSON.stringify({ models: selected }),
      });
      if (!json.ok) throw new Error(json.error);
      swalClose();
      swalSuccessToast('บันทึกสำเร็จ');
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      } else {
        await swalError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSavingId(null);
    }
  }

  if (pmIntervals.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        ยังไม่มีรอบ PM — กรุณาเพิ่มรอบ PM ที่หน้า &quot;รอบ PM&quot; ก่อน
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        ยังไม่พบรุ่นรถใน Vehicle Master
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pmIntervals.map((iv) => {
        const selected = modelsByInterval.get(iv.id) ?? new Set<string>();
        return (
          <div key={iv.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-dark">
                {iv.label}
                {iv.interval_hours ? ` (${iv.interval_hours} ชม.)` : ''}
                {iv.active === false ? <span className="ml-2 text-xs text-gray-400">(ปิดใช้งาน)</span> : null}
              </h2>
              <button
                type="button"
                disabled={savingId === iv.id}
                onClick={() => save(iv.id)}
                className="rounded bg-brand-red px-3 py-1.5 text-xs text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {savingId === iv.id ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
            <p className="mb-2 text-xs text-gray-500">รุ่นรถที่ใช้รอบ PM นี้:</p>
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
              {models.map((model) => (
                <label key={model} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.has(model)} onChange={() => toggleModel(iv.id, model)} />
                  {model}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
