interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

/** Sticky page header used by secondary pages (Saved, Recap, Settings). */
export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 px-4 pb-3 pt-4 backdrop-blur-md">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="headline text-[28px] font-semibold leading-none">{title}</h1>
          {subtitle && <p className="mt-1.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  )
}

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}

export function EmptyState({ icon, title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card text-ink-muted shadow-card">
        {icon}
      </div>
      <p className="headline mb-1.5 text-lg font-semibold">{title}</p>
      {children && <div className="max-w-xs text-sm leading-relaxed text-ink-muted">{children}</div>}
    </div>
  )
}

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'h-7 w-7',
  'aria-hidden': true,
}

export const EmptyIcons = {
  bookmark: (
    <svg {...svgProps}>
      <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  ),
  chart: (
    <svg {...svgProps}>
      <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
    </svg>
  ),
  newspaper: (
    <svg {...svgProps}>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </svg>
  ),
}
