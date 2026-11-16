import type { BalanceStats } from '@/types'

interface BalanceMeterProps {
  stats: BalanceStats
}

const SEGMENTS = [
  { key: 'positivePercent', label: 'uplifting', bar: 'bg-positive' },
  { key: 'neutralPercent', label: 'neutral', bar: 'bg-line-strong' },
  { key: 'negativePercent', label: 'in focus', bar: 'bg-negative' },
] as const

export default function BalanceMeter({ stats }: BalanceMeterProps) {
  if (stats.total === 0) return null

  const summary = SEGMENTS.map((s) => `${stats[s.key]}% ${s.label}`).join(', ')

  return (
    <div className="mx-4 mb-2 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-card">
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="eyebrow text-ink-muted">Today&apos;s balance</p>
        <p className="text-[11px] tabular-nums text-ink-muted">{stats.total} stories</p>
      </div>
      <div className="flex h-2 gap-0.5" role="img" aria-label={`Feed balance: ${summary}`}>
        {SEGMENTS.map((s) =>
          stats[s.key] > 0 ? (
            <div
              key={s.key}
              className={`${s.bar} rounded-full transition-[width] duration-500`}
              style={{ width: `${stats[s.key]}%` }}
            />
          ) : null
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft" aria-hidden="true">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.bar}`} />
            <span className="font-semibold tabular-nums text-ink">{stats[s.key]}%</span> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
