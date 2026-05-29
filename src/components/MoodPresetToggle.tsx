'use client'

import { clsx } from 'clsx'
import type { MoodPreset } from '@/types'

interface MoodPresetToggleProps {
  value: MoodPreset
  onChange: (preset: MoodPreset) => void
  disabled?: boolean
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18M3 6l4 8M17 6l4 8M7 14H3a4 4 0 0 0 4 4M17 14h4a4 4 0 0 1-4 4" />
    </svg>
  )
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

function NewspaperIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </svg>
  )
}

const PRESETS: { value: MoodPreset; label: string; icon: React.FC<{ className?: string }>; title: string }[] = [
  { value: 'balanced',     label: 'Balanced',     icon: ScaleIcon,    title: '40% uplifting · 40% neutral · 20% in-focus' },
  { value: 'constructive', label: 'Constructive',  icon: LeafIcon,     title: '60% uplifting · 35% neutral · 5% in-focus' },
  { value: 'hard-news',    label: 'Hard News',     icon: NewspaperIcon,title: '20% uplifting · 40% neutral · 40% in-focus' },
]

export default function MoodPresetToggle({ value, onChange, disabled }: MoodPresetToggleProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {PRESETS.map((preset) => {
        const Icon = preset.icon
        return (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            disabled={disabled}
            title={preset.title}
            className={clsx(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all disabled:opacity-50',
              value === preset.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate">{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}
