import { clsx } from 'clsx'
import type { BiasType } from '@/types'
import { getBiasForSource } from '@/lib/news-sources'

interface BiasBadgeProps {
  source: string
  className?: string
}

const BIAS_ORDER: BiasType[] = ['left', 'center-left', 'center', 'center-right', 'right']

const BIAS_LABEL: Record<BiasType, string> = {
  left: 'Left',
  'center-left': 'Center-left',
  center: 'Center',
  'center-right': 'Center-right',
  right: 'Right',
}

const BIAS_COLOR: Record<BiasType, string> = {
  left: 'bg-blue-600 dark:bg-blue-400',
  'center-left': 'bg-sky-500 dark:bg-sky-400',
  center: 'bg-ink-muted',
  'center-right': 'bg-orange-500 dark:bg-orange-400',
  right: 'bg-red-600 dark:bg-red-400',
}

/** Five-tick left→right spectrum with the source's position highlighted. */
export default function BiasBadge({ source, className }: BiasBadgeProps) {
  const bias = getBiasForSource(source)
  const index = BIAS_ORDER.indexOf(bias)
  const label = `Political lean: ${BIAS_LABEL[bias]}`

  return (
    <span
      className={clsx('inline-flex flex-shrink-0 items-center gap-[2px] rounded-full bg-well px-1.5 py-1', className)}
      title={label}
      role="img"
      aria-label={label}
    >
      {BIAS_ORDER.map((b, i) => (
        <span
          key={b}
          className={clsx(
            'h-1.5 rounded-full transition-colors',
            i === index ? `w-2.5 ${BIAS_COLOR[bias]}` : 'w-1 bg-line-strong'
          )}
        />
      ))}
    </span>
  )
}
