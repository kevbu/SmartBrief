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
          'bg-emerald-50 text-emerald-700': sentiment === 'positive',
          'bg-amber-50 text-amber-700': sentiment === 'negative',
        },
        className
      )}
    >
      {sentiment === 'positive' ? '✨ Uplifting' : '📌 In Focus'}
    </span>
  )
}
