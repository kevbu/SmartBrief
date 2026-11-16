import { clsx } from 'clsx'

interface SourceMarkProps {
  source: string
  size?: 'xs' | 'sm' | 'md'
  newsletter?: boolean
  className?: string
}

function hueFor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

function initialsFor(name: string): string {
  const words = name
    .replace(/^the\s+/i, '')
    .split(/[\s\-.]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

const SIZES = {
  xs: 'h-4 w-4 rounded text-[8px]',
  sm: 'h-5 w-5 rounded-md text-[9px]',
  md: 'h-8 w-8 rounded-lg text-xs',
}

/** Deterministic coloured monogram for a news source (replaces emoji logos). */
export default function SourceMark({ source, size = 'sm', newsletter = false, className }: SourceMarkProps) {
  if (newsletter) {
    return (
      <span
        aria-hidden="true"
        className={clsx('inline-flex flex-shrink-0 items-center justify-center bg-accent-soft text-accent-ink', SIZES[size], className)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-[65%] w-[65%]">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      style={{ '--h': hueFor(source) } as React.CSSProperties}
      className={clsx(
        'source-mark inline-flex flex-shrink-0 select-none items-center justify-center font-bold leading-none tracking-tight',
        SIZES[size],
        className
      )}
    >
      {initialsFor(source)}
    </span>
  )
}
