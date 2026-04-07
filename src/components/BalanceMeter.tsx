import type { BalanceStats } from '@/types'

interface BalanceMeterProps {
  stats: BalanceStats
}

export default function BalanceMeter({ stats }: BalanceMeterProps) {
  if (stats.total === 0) return null

  return (
    <div className="mx-4 mb-3 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
      <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Today&apos;s balance</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {stats.positivePercent > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${stats.positivePercent}%` }}
          />
        )}
        {stats.neutralPercent > 0 && (
          <div
            className="bg-gray-300 transition-all duration-500"
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
      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {stats.positivePercent}% positive
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          {stats.neutralPercent}% neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {stats.negativePercent}% in focus
        </span>
      </div>
    </div>
  )
}
