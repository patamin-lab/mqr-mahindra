'use client';

import { useRouter } from 'next/navigation';
import NtrForm from '@/features/ntr/components/ntr-form';
import type { NtrRecord } from '@/features/ntr/types';
import type { Branch } from '@/lib/types';

interface VehicleInfo {
  serial: string;
  model: string | null;
  engineNumber: string | null;
  productCode: string | null;
  dealerLabel: string | null;
  productFamilyName: string | null;
  subModel: string | null;
}

/** One Form, Dual Mode (Production Pilot readiness) - the exact same
 *  form the "New NTR" flow uses (`features/ntr/components/ntr-form.tsx`),
 *  in `mode="edit"`. Everything the create flow captures (customer info,
 *  delivery date, hour meter, GPS, photos/attachments) is editable here
 *  too; Vehicle Master / Factory Domain fields (Serial, Engine Number,
 *  Model, Product Family, Sub Model, Product Code, Dealer) stay read-only
 *  in both modes, unchanged from the previous, smaller edit form's own
 *  design principle. */
export default function NtrEditForm({ record, vehicleInfo, branches }: { record: NtrRecord; vehicleInfo: VehicleInfo; branches: Branch[] }) {
  const router = useRouter();

  return (
    <NtrForm
      mode="edit"
      record={record}
      vehicleInfo={vehicleInfo}
      branches={branches}
      onSaved={(saved) => {
        router.push(`/ntr/${encodeURIComponent(saved.id)}`);
        router.refresh();
      }}
    />
  );
}
