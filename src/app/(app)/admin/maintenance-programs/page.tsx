import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllMaintenanceProgramAssignmentsAdmin, listActiveProductFamilies, listAllPmIntervalsAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import MaintenanceProgramsTable from './maintenance-programs-table';

export default async function MaintenanceProgramsAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const [assignments, productFamilies, pmIntervals] = await Promise.all([
    listAllMaintenanceProgramAssignmentsAdmin(),
    listActiveProductFamilies(),
    listAllPmIntervalsAdmin(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">Maintenance Program (รอบบำรุงรักษาตามกลุ่มผลิตภัณฑ์)</h1>
      <p className="text-sm text-gray-500">
        กำหนดว่ากลุ่มผลิตภัณฑ์ใดใช้รอบบำรุงรักษาใดได้บ้าง — รถทุกคันในกลุ่มผลิตภัณฑ์เดียวกันจะสืบทอดรอบบำรุงรักษาเดียวกันโดยอัตโนมัติ
        เพิ่มรุ่นรถใหม่เข้ากลุ่มผลิตภัณฑ์ได้โดยไม่ต้องแก้โค้ด
      </p>
      <MaintenanceProgramsTable initialAssignments={assignments} productFamilies={productFamilies} pmIntervals={pmIntervals} />
    </div>
  );
}
