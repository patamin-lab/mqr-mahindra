import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { dashboardStats, listDealers, listBranches } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { STATUS_LABELS, StatusValue, SEVERITY_LABELS, Severity } from '@/lib/types';
import { THAI_MONTHS_FULL, formatMonthKeyThai, buildYearOptions, toBuddhistYear } from '@/lib/thaiDate';
import {
  MonthlyTrendChart,
  ParetoChart,
  SimpleBarChart,
  StatusBarChart,
  AgingBarChart,
} from './charts';

function KpiCard({ label, value, accent, sub }: { label: string; value: number | string; accent?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accent ?? 'text-brand-dark'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="font-semibold text-brand-dark mb-1">{title}</h2>
      {note && <p className="text-xs text-gray-400 mb-2">{note}</p>}
      {children}
    </div>
  );
}

const severityBadgeClass = (severity: string): string =>
  severity === 'Critical'
    ? 'bg-red-100 text-red-700'
    : severity === 'Major'
    ? 'bg-amber-100 text-amber-700'
    : severity === 'Minor'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; model?: string; dealerId?: string; branchId?: string };
}) {
  const session = await getSession();
  if (!session) return null;

  const year = searchParams.year ? Number(searchParams.year) : undefined;
  const month = searchParams.month ? Number(searchParams.month) : undefined;
  const model = searchParams.model || undefined;
  const dealerId = searchParams.dealerId || undefined;
  const branchId = searchParams.branchId || undefined;

  const stats = await dashboardStats(session, { year, month, model, dealerId, branchId });
  const dealers = seesAllDealers(session.role) ? await listDealers() : [];
  // Central roles (SuperAdmin/CentralAdmin) see branches scoped to whichever dealer is
  // currently selected (or all branches across all dealers if none is selected yet);
  // dealer-scoped roles always see only their own dealer's branches.
  const branchScopeDealerId = seesAllDealers(session.role) ? dealerId ?? null : session.dealerId;
  const branches = await listBranches(branchScopeDealerId ?? null);
  const yearOptions = buildYearOptions(stats.filterOptions.years);

  const filterQuery = new URLSearchParams();
  if (searchParams.year) filterQuery.set('year', searchParams.year);
  if (searchParams.month) filterQuery.set('month', searchParams.month);
  if (searchParams.model) filterQuery.set('model', searchParams.model);
  if (searchParams.dealerId) filterQuery.set('dealerId', searchParams.dealerId);
  if (searchParams.branchId) filterQuery.set('branchId', searchParams.branchId);
  const hasFilters = filterQuery.toString().length > 0;

  const monthlyData = stats.monthly.map((m) => ({ ...m, label: formatMonthKeyThai(m.month) }));
  const statusBacklogData = stats.statusBacklog.map((s) => ({
    ...s,
    statusLabel: STATUS_LABELS[s.status as StatusValue] ?? s.status,
  }));
  const statusBreakdownData = stats.statusBreakdown.map((s) => ({
    ...s,
    statusLabel: STATUS_LABELS[s.status as StatusValue] ?? s.status,
  }));
  const severityBreakdownData = stats.severityBreakdown.map((s) => ({
    ...s,
    severityLabel: SEVERITY_LABELS[s.severity as Severity] ?? s.severity,
  }));
  const byModelData = stats.byModel.map((m) => ({ ...m, modelLabel: m.model }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">หน้าหลัก</h1>
        <p className="text-sm text-gray-500">ภาพรวมคุณภาพและสถานะงานซ่อมในระยะรับประกัน</p>
      </div>

      {/* ---------- Filter bar ---------- */}
      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1">ปี (พ.ศ.)</label>
          <select name="year" defaultValue={searchParams.year ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">ทั้งหมด (12 เดือนล่าสุด)</option>
            {yearOptions.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">เดือน</label>
          <select name="month" defaultValue={searchParams.month ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">ทุกเดือน</option>
            {THAI_MONTHS_FULL.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">รุ่นรถ</label>
          <select name="model" defaultValue={searchParams.model ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">ทุกรุ่น</option>
            {stats.filterOptions.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {dealers.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">ดีลเลอร์</label>
            <select name="dealerId" defaultValue={searchParams.dealerId ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">ทั้งหมด</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {branches.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">สาขา</label>
            <select name="branchId" defaultValue={searchParams.branchId ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">ทั้งหมด</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="px-4 py-2 rounded border border-gray-300 text-sm bg-gray-50">กรอง</button>
        {hasFilters && (
          <Link href="/dashboard" className="text-sm text-gray-500 underline">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {/* ---------- Current backlog (always "right now", not affected by year/month filter) ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-1">ภาพรวมงานค้างปัจจุบัน</h2>
        <p className="text-xs text-gray-400 mb-3">
          อัปเดตตามสถานะปัจจุบัน ไม่ขึ้นกับตัวกรองปี/เดือนด้านบน (กรองได้เฉพาะรุ่นรถ/ดีลเลอร์/สาขา)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <KpiCard label="งานค้างทั้งหมด" value={stats.totalOpen} accent="text-brand-red" />
          <KpiCard
            label="เกิน SLA"
            value={stats.slaBreachCount}
            accent={stats.slaBreachCount > 0 ? 'text-red-600' : 'text-brand-dark'}
            sub="วิกฤต 3 วัน / สำคัญ 7 วัน / เล็กน้อย 14 วัน"
          />
          <KpiCard label="รออะไหล่" value={stats.statusBacklog.find((s) => s.status === 'WaitingParts')?.count ?? 0} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="งานค้างแยกตามสถานะ">
            <StatusBarChart data={statusBacklogData} />
          </Panel>
          <Panel title="อายุของงานค้าง (วันตั้งแต่แจ้งซ่อม)">
            <AgingBarChart data={stats.agingBuckets} />
          </Panel>
        </div>
        {stats.topAgingJobs.length > 0 && (
          <Panel title="งานค้างนานที่สุด (Top 10)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left py-1 pr-3">เลขที่งาน</th>
                    <th className="text-left py-1 pr-3">รุ่น/Serial</th>
                    <th className="text-left py-1 pr-3">สถานะ</th>
                    <th className="text-left py-1 pr-3">ความรุนแรง</th>
                    <th className="text-right py-1 pr-3">ค้างมา (วัน)</th>
                    <th className="text-left py-1">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topAgingJobs.map((j) => (
                    <tr key={j.jobId} className="border-t border-gray-100">
                      <td className="py-1.5 pr-3">
                        <Link href={`/records/${encodeURIComponent(j.jobId)}`} className="text-brand-red hover:underline">
                          {j.jobId}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-gray-600">
                        {j.model ?? '-'}{' '}
                        {j.serial && (
                          <Link href={`/vehicles/${encodeURIComponent(j.serial)}`} className="hover:text-brand-red hover:underline">
                            ({j.serial})
                          </Link>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-600">{STATUS_LABELS[j.status as StatusValue] ?? j.status}</td>
                      <td className="py-1.5 pr-3">
                        {j.severity ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${severityBadgeClass(j.severity)}`}>
                            {SEVERITY_LABELS[j.severity as Severity] ?? j.severity}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-medium">{j.daysOpen}</td>
                      <td className="py-1.5">
                        {j.slaBreached ? (
                          <span className="text-red-600 font-medium">เกิน SLA</span>
                        ) : (
                          <span className="text-gray-400">ปกติ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {/* ---------- Period-filtered analytics ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-1">สรุปผลตามช่วงเวลาที่เลือก</h2>
        <p className="text-xs text-gray-400 mb-3">
          {year ? `ปี พ.ศ. ${toBuddhistYear(year)}${month ? ` เดือน${THAI_MONTHS_FULL[month - 1]}` : ''}` : 'ช่วง 12 เดือนล่าสุด'}
          {model ? ` · รุ่น ${model}` : ''}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <KpiCard label="งานที่แจ้งในช่วงนี้" value={stats.totalAll} />
          <KpiCard label="แจ้งเดือนนี้" value={stats.totalThisMonth} />
          <KpiCard label="ซ่อมสำเร็จ/ปิดงาน" value={stats.totalRepaired} accent="text-green-600" />
          <KpiCard label="รถซ่อมซ้ำ (>1 ครั้ง)" value={stats.repeatRepairCount} />
          <KpiCard label="MTTR เฉลี่ย" value={stats.mttrDays ?? '-'} sub={stats.mttrDays != null ? 'วัน จากแจ้งถึงซ่อมเสร็จ' : 'ยังไม่มีข้อมูลซ่อมเสร็จ'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Panel title={year ? `แนวโน้มจำนวนงานต่อเดือน (พ.ศ. ${toBuddhistYear(year)})` : 'แนวโน้มจำนวนงานต่อเดือน (12 เดือนล่าสุด)'}>
            <MonthlyTrendChart data={monthlyData.map((m) => ({ month: m.label, count: m.count }))} />
          </Panel>
          <Panel title="Pareto: ความถี่ปัญหาตามอาการ" note="แท่งเรียงจากมากไปน้อย — ปัญหาส่วนน้อยที่เป็นต้นเหตุของงานซ่อมส่วนใหญ่">
            {stats.pareto.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <ParetoChart data={stats.pareto} />
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Panel title="ปัญหาตามรุ่นรถ (Top 12)">
            {byModelData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <SimpleBarChart data={byModelData} dataKey="count" labelKey="modelLabel" angledLabels color="#9c1c1c" />
            )}
          </Panel>
          <Panel title="งานในช่วงนี้แยกตามความรุนแรง">
            {severityBreakdownData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <SimpleBarChart data={severityBreakdownData} dataKey="count" labelKey="severityLabel" color="#d68910" />
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Panel title="งานในช่วงนี้แยกตามสถานะ">
            {statusBreakdownData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <StatusBarChart data={statusBreakdownData} />
            )}
          </Panel>
          <Panel title="อะไหล่ที่เปลี่ยนบ่อย (Top 10)" note="นับจากข้อความ 'อะไหล่ที่เสียหาย' ที่ช่างกรอกตอนปิดงาน">
            {stats.topParts.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <ol className="text-sm space-y-1.5">
                {stats.topParts.map((p, i) => (
                  <li key={p.label} className="flex justify-between border-b border-gray-50 pb-1">
                    <span className="text-gray-700">
                      <span className="text-gray-400 mr-2">{i + 1}.</span>
                      {p.label}
                    </span>
                    <span className="font-medium text-brand-dark">{p.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* ---------- Leaderboards ---------- */}
        <div className={`grid grid-cols-1 gap-6 ${stats.dealerLeaderboard.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {stats.dealerLeaderboard.length > 0 && (
            <Panel title="อันดับดีลเลอร์ (จำนวนงาน)">
              <LeaderboardTable rows={stats.dealerLeaderboard} />
            </Panel>
          )}
          <Panel title="อันดับสาขา (จำนวนงาน)">
            {stats.branchLeaderboard.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <LeaderboardTable rows={stats.branchLeaderboard} />
            )}
          </Panel>
          <Panel title="อันดับช่าง (จำนวนงาน)">
            {stats.technicianLeaderboard.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">ยังไม่มีข้อมูล</p>
            ) : (
              <LeaderboardTable rows={stats.technicianLeaderboard} />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTable({ rows }: { rows: { key: string; label: string; count: number; mttrDays: number | null }[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-gray-500 text-xs uppercase">
        <tr>
          <th className="text-left py-1">ชื่อ</th>
          <th className="text-right py-1">จำนวนงาน</th>
          <th className="text-right py-1">MTTR (วัน)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key} className="border-t border-gray-100">
            <td className="py-1.5 text-gray-700">
              <span className="text-gray-400 mr-1.5">{i + 1}.</span>
              {r.label}
            </td>
            <td className="py-1.5 text-right font-medium">{r.count}</td>
            <td className="py-1.5 text-right text-gray-500">{r.mttrDays ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
