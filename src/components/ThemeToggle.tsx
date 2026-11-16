'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { readThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme'

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

const OPTIONS: { value: ThemePreference; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
]

export default function ThemeToggle() {
  const [value, setValue] = useState<ThemePreference>('system')

  useEffect(() => {
    setValue(readThemePreference())
  }, [])

  function choose(pref: ThemePreference) {
    setThemePreference(pref)
    setValue(pref)
  }

  return (
    <div role="group" aria-label="Theme" className="flex gap-1 rounded-xl bg-well p-1">
      {OPTIONS.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={value === option.value}
            className={clsx(
              'flex min-h-[36px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors duration-200',
              value === option.value
                ? 'bg-raised text-ink shadow-card'
                : 'text-ink-muted hover:text-ink-soft'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
