import type { BalanceStats } from '@/types'

interface BalanceMeterProps {
  stats: BalanceStats
}

export default function BalanceMeter({ stats }: BalanceMeterProps) {
  if (stats.total === 0) return null

  return (
    <div className="mx-4 mb-2 rounded-2xl bg-white p-3.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Today&apos;s balance</p>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {stats.positivePercent > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${stats.positivePercent}%` }}
          />
        )}
        {stats.neutralPercent > 0 && (
          <div
            className="bg-slate-300 transition-all duration-500 dark:bg-slate-600"
            style={{ width: `${stats.neutralPercent}%` }}
          />
        )}
        {stats.negativePercent > 0 && (
          <div
            className="bg-amber-400 transition-all duration-500"
            style={{ width: `${stats.negativePercent}%` }}
          />
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {stats.positivePercent}% uplifting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          {stats.neutralPercent}% neutral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {stats.negativePercent}% in focus
        </span>
      </div>
    </div>
  )
}
