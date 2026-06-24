import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllProblemCodesAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import ProblemCodesTable from './problem-codes-table';

export default async function ProblemCodesAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const problemCodes = await listAllProblemCodesAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการหมวดปัญหา/อาการเสีย</h1>
      <p className="text-sm text-gray-500">
        ใช้ทุกดีลเลอร์ร่วมกัน — กลุ่ม (หมวดหมู่) กำหนดระยะรับประกัน: Powertrain = 48 เดือน, อื่นๆ = 24 เดือน
      </p>
      <ProblemCodesTable initial={problemCodes} />
    </div>
  );
}
