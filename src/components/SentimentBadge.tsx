import { clsx } from 'clsx'
import type { SentimentType } from '@/types'

interface SentimentBadgeProps {
  sentiment: SentimentType
  className?: string
}

export default function SentimentBadge({
  sentiment,
  className,
}: SentimentBadgeProps) {
  if (sentiment === 'neutral') {
    return null
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400': sentiment === 'positive',
          'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': sentiment === 'negative',
        },
        className
      )}
    >
      {sentiment === 'positive' ? '✨ Uplifting' : '📌 In Focus'}
    </span>
  )
}
