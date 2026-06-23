import { getSession } from '@/lib/auth';
import { dashboardStats } from '@/lib/db';
import { MonthlyTrendChart, ParetoChart } from './charts';
import { redirect } from 'next/navigation';

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accent ?? 'text-brand-dark'}`}>{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const stats = await dashboardStats(session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">หน้าหลัก</h1>
        <p className="text-sm text-gray-500">ภาพรวมคุณภาพและสถานะงานซ่อมในระยะรับประกัน</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="งานที่กำลังดำเนินการ" value={stats.totalOpen} accent="text-brand-red" />
        <KpiCard label="งานที่แจ้งเดือนนี้" value={stats.totalThisMonth} />
        <KpiCard label="งานทั้งหมด (ที่เห็นสิทธิ์)" value={stats.totalAll} />
        <KpiCard label="รถที่ซ่อมซ้ำ (>1 ครั้ง)" value={stats.repeatRepairCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-brand-dark mb-2">แนวโน้มจำนวนงานต่อเดือน (12 เดือนล่าสุด)</h2>
          <MonthlyTrendChart data={stats.monthly} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-brand-dark mb-2">Pareto: ความถี่ปัญหาตามอาการ</h2>
          {stats.pareto.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">ยังไม่มีข้อมูล</p>
          ) : (
            <ParetoChart data={stats.pareto} />
          )}
        </div>
      </div>
    </div>
  );
}
