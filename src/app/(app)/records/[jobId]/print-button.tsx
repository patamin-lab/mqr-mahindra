'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
    >
      🖨️พิมพ์รายงาน
    </button>
  );
}
