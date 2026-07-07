import { getSession } from '@/lib/auth';
import { listProblemCodes, listDealers, listTechnicians, getDealer, getBranchById } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import ReportForm from './report-form';

export default async function ReportPage() {
  const session = await getSession();
  if (!session) return null;

  const isCentral = seesAllDealers(session.role);
  const [problemCodes, dealers, technicians, pinnedDealer, pinnedBranch] = await Promise.all([
    listProblemCodes(),
    isCentral ? listDealers() : Promise.resolve([]),
    isCentral ? Promise.resolve([]) : listTechnicians(session.dealerId),
    !isCentral && session.dealerId ? getDealer(session.dealerId) : Promise.resolve(null),
    session.role === 'DealerUser' && session.branchId ? getBranchById(session.branchId) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-dark mb-1">รายงานปัญหาคุณภาพ</h1>
      <p className="text-sm text-gray-500 mb-6">รายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน</p>
      <ReportForm
        problemCodes={problemCodes}
        dealers={dealers}
        role={session.role}
        sessionDealerId={session.dealerId}
        sessionBranchId={session.branchId}
        pinnedDealerName={pinnedDealer?.short_name}
        pinnedBranchName={pinnedBranch?.name}
        initialTechnicians={technicians}
      />
    </div>
  );
}
