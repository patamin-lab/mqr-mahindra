'use client';

import { useRouter } from 'next/navigation';
import NtrForm from '@/features/ntr/components/ntr-form';
import type { NtrRecord } from '@/features/ntr/types';
import type { Branch, Dealer, Role } from '@/lib/types';

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
 *  Model, Product Family, Sub Model, Product Code) stay read-only in both
 *  modes. Dealer (NTR Form Update, 2026-07) is now also editable here for
 *  a `seesAllDealers` actor - a pinned actor still sees it read-only
 *  (`NtrForm` itself renders the RBAC gate; this component only threads
 *  the data through). */
export default function NtrEditForm({
  record,
  vehicleInfo,
  branches,
  dealers,
  role,
  sessionDealerId,
}: {
  record: NtrRecord;
  vehicleInfo: VehicleInfo;
  branches: Branch[];
  dealers: Dealer[];
  role: Role;
  sessionDealerId: string | null;
}) {
  const router = useRouter();

  return (
    <NtrForm
      mode="edit"
      record={record}
      vehicleInfo={vehicleInfo}
      branches={branches}
      dealers={dealers}
      role={role}
      sessionDealerId={sessionDealerId}
      onSaved={(saved) => {
        router.push(`/ntr/${encodeURIComponent(saved.id)}`);
        router.refresh();
      }}
    />
  );
}
