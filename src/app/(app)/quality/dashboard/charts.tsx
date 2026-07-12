'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

export function MonthlyTrendChart({ data }: { data: { month: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#c8102e" strokeWidth={2} dot={{ r: 3 }} name="จำนวนงาน" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ParetoChart({ data }: { data: { label: string; count: number; cumulativePct: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={80}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#c8102e" name="จำนวนครั้ง" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Generic vertical bar chart — used for by-model breakdown, status backlog, aging buckets. */
export function SimpleBarChart({
  data,
  dataKey,
  labelKey,
  color = '#c8102e',
  height = 260,
  angledLabels = false,
}: {
  data: Record<string, any>[];
  dataKey: string;
  labelKey: string;
  color?: string;
  height?: number;
  angledLabels?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ bottom: angledLabels ? 60 : 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={labelKey}
          tick={{ fontSize: 10 }}
          angle={angledLabels ? -35 : 0}
          textAnchor={angledLabels ? 'end' : 'middle'}
          interval={0}
          height={angledLabels ? 70 : 30}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Draft: '#9ca3af',
  Open: '#f59e0b',
  UnderInvestigation: '#3b82f6',
  WaitingParts: '#a855f7',
  Repaired: '#14b8a6',
  Closed: '#22c55e',
};

export function StatusBarChart({ data, labelKey = 'statusLabel' }: { data: Record<string, any>[]; labelKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 10 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={STATUS_COLORS[d.status] ?? '#c8102e'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const AGING_COLORS = ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#dc2626'];

export function AgingBarChart({ data }: { data: { bucket: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={AGING_COLORS[i] ?? '#c8102e'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
