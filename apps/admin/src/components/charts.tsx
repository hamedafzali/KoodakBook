'use client'
/* Dependency-free SVG/CSS charts for the admin (avoids recharts peer-dep risk on React 19). */

export function LineChart({ series, height = 180 }: {
  series: { name: string; color: string; points: number[] }[]
  height?: number
}) {
  const W = 600, H = height, pad = 24
  const all = series.flatMap(s => s.points)
  const max = Math.max(1, ...all)
  const n = Math.max(1, series[0]?.points.length ?? 1)
  const x = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, n - 1)
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {[0, 0.5, 1].map(t => (
        <line key={t} x1={pad} x2={W - pad} y1={y(max * t)} y2={y(max * t)} stroke="#f1f5f9" strokeWidth={1} />
      ))}
      {series.map(s => (
        <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round"
          points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      ))}
    </svg>
  )
}

/** Horizontal funnel/bar list. */
export function BarList({ items, color = '#f59e0b', suffix = '' }: {
  items: { label: string; value: number; sub?: string }[]
  color?: string
  suffix?: string
}) {
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-gray-600 truncate">{it.label}</span>
            <span className="text-gray-400">{it.value}{suffix}{it.sub ? ` · ${it.sub}` : ''}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-gray-400">داده‌ای نیست</p>}
    </div>
  )
}

/** Donut for distributions. */
export function Donut({ slices, size = 140 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = Math.max(1, slices.reduce((a, s) => a + s.value, 0))
  const r = size / 2 - 12, C = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s, i) => {
            const len = (s.value / total) * C
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
              strokeWidth={16} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
            offset += len
            return el
          })}
        </g>
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-gray-600">{s.label}</span>
            <span className="text-gray-400 ms-auto">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Cohort retention heatmap. */
export function CohortHeatmap({ cohorts }: { cohorts: { week: string; size: number; retention: (number | null)[] }[] }) {
  const cell = (v: number | null) => {
    if (v === null) return 'bg-gray-50 text-gray-300'
    if (v >= 0.6) return 'bg-emerald-500 text-white'
    if (v >= 0.4) return 'bg-emerald-400 text-white'
    if (v >= 0.2) return 'bg-amber-300 text-amber-900'
    if (v > 0) return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-400'
  }
  return (
    <table className="text-xs w-full">
      <thead>
        <tr className="text-gray-400">
          <th className="text-right font-medium py-1">هفته شروع</th>
          <th className="font-medium">تعداد</th>
          {['W0', 'W1', 'W2', 'W3', 'W4', 'W5'].map(w => <th key={w} className="font-medium px-1">{w}</th>)}
        </tr>
      </thead>
      <tbody>
        {cohorts.map(c => (
          <tr key={c.week}>
            <td className="text-gray-500 py-1 ltr">{c.week}</td>
            <td className="text-center text-gray-500">{c.size}</td>
            {c.retention.map((v, i) => (
              <td key={i} className="px-1 py-1">
                <div className={`rounded text-center py-1 ${cell(v)}`}>{v === null ? '' : `${Math.round(v * 100)}%`}</div>
              </td>
            ))}
          </tr>
        ))}
        {cohorts.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-3">داده‌ی کافی نیست</td></tr>}
      </tbody>
    </table>
  )
}
