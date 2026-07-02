'use client';

import { useState } from 'react';
import { ProductFamily } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import SelectField from '@/components/shared/forms/SelectField';
import type { ProductFamilyModelRow } from '@/lib/db';

interface Props {
  initial: ProductFamilyModelRow[];
  productFamilies: ProductFamily[];
}

const UNASSIGNED = '';

export default function ProductFamilyModelsTable({ initial, productFamilies }: Props) {
  const [rows, setRows] = useState(initial);
  const [savingModel, setSavingModel] = useState<string | null>(null);

  const options = [{ value: UNASSIGNED, label: '— ยังไม่กำหนด —' }, ...productFamilies.map((f) => ({ value: f.id, label: f.name }))];

  async function save(model: string, productFamilyId: string) {
    setSavingModel(model);
    swalLoading('กำลังบันทึก...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>('/api/admin/product-family-models', {
        method: 'PUT',
        body: JSON.stringify({ model, productFamilyId: productFamilyId || null }),
      });
      if (!json.ok) throw new Error(json.error);
      setRows((prev) =>
        prev.map((r) =>
          r.model === model
            ? {
                model,
                productFamilyId: productFamilyId || null,
                productFamilyName: productFamilyId ? productFamilies.find((f) => f.id === productFamilyId)?.name ?? null : null,
              }
            : r
        )
      );
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
      setSavingModel(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        ยังไม่พบรุ่นรถใน Vehicle Master
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">รุ่นรถ</th>
            <th className="px-3 py-2 text-left">กลุ่มผลิตภัณฑ์</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model} className="border-t border-gray-100">
              <td className="px-3 py-2 font-medium text-brand-dark">{r.model}</td>
              <td className="px-3 py-2">
                <SelectField
                  value={r.productFamilyId ?? UNASSIGNED}
                  onChange={(v) => save(r.model, v)}
                  options={options}
                  selectClassName="border rounded px-2 py-1.5 text-sm w-64 disabled:opacity-50"
                />
                {savingModel === r.model && <span className="ml-2 text-xs text-gray-400">กำลังบันทึก...</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
