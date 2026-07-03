import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllPmIntervalsAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import PmIntervalsTable from './pm-intervals-table';

export default async function PmIntervalsAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const pmIntervals = await listAllPmIntervalsAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการรอบ PM (PM Interval)</h1>
      <p className="text-sm text-gray-500">ใช้ทุกดีลเลอร์ร่วมกัน — กำหนดรอบตามชั่วโมงใช้งานและ/หรือระยะเวลา</p>
      <PmIntervalsTable initial={pmIntervals} />
    </div>
  );
}
