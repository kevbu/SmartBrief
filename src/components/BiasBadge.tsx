import { clsx } from 'clsx'
import type { BiasType } from '@/types'
import { getBiasForSource } from '@/lib/news-sources'

interface BiasBadgeProps {
  source: string
  className?: string
}

const BIAS_CONFIG: Record<BiasType, { label: string; short: string; color: string }> = {
  left:          { label: 'Left',         short: 'L',  color: 'bg-blue-600 text-white' },
  'center-left': { label: 'Center-Left',  short: 'CL', color: 'bg-blue-400 text-white' },
  center:        { label: 'Center',       short: 'C',  color: 'bg-gray-400 text-white' },
  'center-right':{ label: 'Center-Right', short: 'CR', color: 'bg-orange-400 text-white' },
  right:         { label: 'Right',        short: 'R',  color: 'bg-red-500 text-white' },
}

export default function BiasBadge({ source, className }: BiasBadgeProps) {
  const bias = getBiasForSource(source)
  const config = BIAS_CONFIG[bias]

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold leading-none',
        config.color,
        className
      )}
      title={`Political bias: ${config.label}`}
    >
      {config.short}
    </span>
  )
}
