'use client';

/** Machine Passport's Delivery section, empty state - starts Delivery
 *  lifecycle tracking for this machine (`POST /api/delivery-records`,
 *  the existing `DeliveryService.createDeliveryRecord()`), then
 *  navigates to the new record's own detail page. The smallest possible
 *  client subtree - `MachineDeliveryPanel` itself stays a Server
 *  Component. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';

export default function StartDeliveryTrackingButton({ serial }: { serial: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetchJson<{ record: { id: string } }>('/api/delivery-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      });
      router.push(`/delivery/records/${res.record.id}`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} onClick={start} className="rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
      {busy ? '...' : t('delivery.startTrackingAction')}
    </button>
  );
}
