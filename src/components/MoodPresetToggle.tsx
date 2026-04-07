'use client'

import { clsx } from 'clsx'
import type { MoodPreset } from '@/types'

interface MoodPresetToggleProps {
  value: MoodPreset
  onChange: (preset: MoodPreset) => void
  disabled?: boolean
}

const PRESETS: { value: MoodPreset; label: string; emoji: string; title: string }[] = [
  { value: 'balanced',     label: 'Balanced',     emoji: '⚖️', title: '40% uplifting · 40% neutral · 20% in-focus' },
  { value: 'constructive', label: 'Constructive',  emoji: '🌱', title: '60% uplifting · 35% neutral · 5% in-focus' },
  { value: 'hard-news',    label: 'Hard News',     emoji: '📰', title: '20% uplifting · 40% neutral · 40% in-focus' },
]

export default function MoodPresetToggle({ value, onChange, disabled }: MoodPresetToggleProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          onClick={() => onChange(preset.value)}
          disabled={disabled}
          title={preset.title}
          className={clsx(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all',
            value === preset.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300'
          )}
        >
          <span className="text-sm">{preset.emoji}</span>
          <span className="hidden sm:inline">{preset.label}</span>
        </button>
      ))}
    </div>
  )
}
