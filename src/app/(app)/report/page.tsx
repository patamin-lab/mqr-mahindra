import { getSession } from '@/lib/auth';
import { listProblemCodes, listDealers, listBranches, listTechnicians } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import ReportForm from './report-form';

export default async function ReportPage() {
  const session = await getSession();
  if (!session) return null;

  const isCentral = seesAllDealers(session.role);
  const [problemCodes, dealers, branches, technicians] = await Promise.all([
    listProblemCodes(),
    isCentral ? listDealers() : Promise.resolve([]),
    isCentral ? Promise.resolve([]) : listBranches(session.dealerId),
    isCentral ? Promise.resolve([]) : listTechnicians(session.dealerId),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-dark mb-1">รายงานปัญหาคุณภาพ</h1>
      <p className="text-sm text-gray-500 mb-6">รายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน</p>
      <ReportForm
        problemCodes={problemCodes}
        dealers={dealers}
        lockedDealerId={isCentral ? null : session.dealerId}
        initialBranches={branches}
        initialTechnicians={technicians}
      />
    </div>
  );
}
