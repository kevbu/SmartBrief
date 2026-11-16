import type { SentimentType } from '@/types'

export const CATEGORY_LABELS: Record<string, string> = {
  technology: 'Tech & AI',
  science: 'Science & Health',
  business: 'Business',
  world: 'World',
  positive: 'Bright Spots',
}

interface IconProps {
  className?: string
}

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Line icon per news category (Lucide-style, 24px grid). */
export default function CategoryIcon({ category, className = 'h-3.5 w-3.5' }: IconProps & { category: string }) {
  switch (category) {
    case 'technology':
      return (
        <svg {...base} className={className}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
        </svg>
      )
    case 'science':
      return (
        <svg {...base} className={className}>
          <path d="M10 2v7.31M14 9.3V1.99M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0M5.52 16h12.96" />
        </svg>
      )
    case 'business':
      return (
        <svg {...base} className={className}>
          <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
        </svg>
      )
    case 'world':
      return (
        <svg {...base} className={className}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'positive':
      return (
        <svg {...base} className={className}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )
    default:
      return (
        <svg {...base} className={className}>
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
        </svg>
      )
  }
}

/** Sentiment as a small dot + word. Neutral renders nothing unless `showNeutral`. */
export function SentimentDot({ sentiment, showNeutral = false }: { sentiment: SentimentType; showNeutral?: boolean }) {
  if (sentiment === 'neutral' && !showNeutral) return null
  const cfg = {
    positive: { dot: 'bg-positive', text: 'text-positive-ink', label: 'Uplifting' },
    neutral: { dot: 'bg-ink-faint', text: 'text-ink-muted', label: 'Neutral' },
    negative: { dot: 'bg-negative', text: 'text-negative-ink', label: 'In focus' },
  }[sentiment]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}
