import { clsx } from 'clsx'
import type { SentimentType } from '@/types'

interface SentimentBadgeProps {
  sentiment: SentimentType
  className?: string
}

export default function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  if (sentiment === 'neutral') return null

  const positive = sentiment === 'positive'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
        positive ? 'bg-positive-soft text-positive-ink' : 'bg-negative-soft text-negative-ink',
        className
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', positive ? 'bg-positive' : 'bg-negative')} aria-hidden="true" />
      {positive ? 'Uplifting' : 'In focus'}
    </span>
  )
}
