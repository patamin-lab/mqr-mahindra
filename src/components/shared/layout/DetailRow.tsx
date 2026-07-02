/**
 * Shared label/value detail-grid tile (docs/standards/UI_COMPONENT_STANDARD.md
 * "Shared DetailLayout" consolidation). Extracted verbatim from two
 * byte-for-byte identical local `DetailRow` functions previously defined
 * independently in pm-records/[id]/page.tsx and vehicles/[serial]/page.tsx.
 */
export interface DetailRowProps {
  label: string;
  value: string;
}

export default function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}
