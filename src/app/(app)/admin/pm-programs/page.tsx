import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllPmProgramsAdmin, listDistinctVehicleModels, listAllPmIntervalsAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import PmProgramsTable from './pm-programs-table';

export default async function PmProgramsAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const [pmPrograms, models, pmIntervals] = await Promise.all([
    listAllPmProgramsAdmin(),
    listDistinctVehicleModels(),
    listAllPmIntervalsAdmin(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">PM Program (รอบ PM ตามรุ่นรถ)</h1>
      <p className="text-sm text-gray-500">
        กำหนดว่ารุ่นรถแทรกเตอร์ใดใช้รอบ PM ใดได้บ้าง — รายการรอบ PM ในหน้าบันทึก PM
        จะแสดงเฉพาะรอบที่กำหนดไว้สำหรับรุ่นรถที่เลือกเท่านั้น
      </p>
      <PmProgramsTable initialPmPrograms={pmPrograms} models={models} pmIntervals={pmIntervals} />
    </div>
  );
}
