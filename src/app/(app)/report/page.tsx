import { listProblemCodes } from '@/lib/db';
import ReportForm from './report-form';

export default async function ReportPage() {
  const problemCodes = await listProblemCodes();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-dark mb-1">รายงานปัญหาคุณภาพ</h1>
      <p className="text-sm text-gray-500 mb-6">รายงานปัญหาคุณภาพสำหรับรถในระยะรับประกัน</p>
      <ReportForm problemCodes={problemCodes} />
    </div>
  );
}
