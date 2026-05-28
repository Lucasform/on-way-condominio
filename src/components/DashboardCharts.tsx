// Componente com os graficos do Dashboard. Lazy-loaded pra que o chunk
// do recharts so seja baixado ao abrir o Dashboard de fato.
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#a855f7', '#64748b']

interface MonthlyRow {
  mes: string
  ocorrencias: number
  multas: number
}

interface StatusRow {
  name: string
  value: number
  color: string
}

export function MonthlyBarChart({ data }: { data: MonthlyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#e2e8f0',
          }}
        />
        <Bar dataKey="ocorrencias" fill="#0ea5e9" name="Ocorrências" />
        <Bar dataKey="multas" fill="#ef4444" name="Multas" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MultasStatusPie({ data }: { data: StatusRow[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-slate-500">
        Sem multas no período.
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(entry) => `${entry.name}: ${entry.value}`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#e2e8f0',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function DashboardCharts({
  monthly,
  multasByStatus,
}: {
  monthly: MonthlyRow[]
  multasByStatus: StatusRow[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Ocorrências e multas (últimos 6 meses)">
        <MonthlyBarChart data={monthly} />
      </ChartCard>
      <ChartCard title="Multas por status">
        <MultasStatusPie data={multasByStatus} />
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-100 mb-3">{title}</h3>
      {children}
    </div>
  )
}
