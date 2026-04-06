'use client'

import { useState, useRef, useEffect } from 'react'
import type { FeedbackType } from '@/types'

interface FeedbackMenuProps {
  articleId: string
  source: string
  /** Show the one-time discovery tooltip above the trigger button */
  showTooltip?: boolean
  onTooltipDismissed?: () => void
  onFeedback?: (feedback: FeedbackType) => void
}

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: 'more-like-this',  label: 'More like this',  emoji: '👍' },
  { value: 'less-like-this',  label: 'Less like this',  emoji: '👎' },
  { value: 'too-negative',    label: 'Too negative',    emoji: '😔' },
  { value: 'off-topic',       label: 'Off-topic',       emoji: '🚫' },
  { value: 'hide-source',     label: 'Hide this source', emoji: '🙈' },
]

export default function FeedbackMenu({
  articleId: _articleId,
  source: _source,
  showTooltip = false,
  onTooltipDismissed,
  onFeedback,
}: FeedbackMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleTrigger(e: React.MouseEvent) {
    e.stopPropagation()
    if (showTooltip) onTooltipDismissed?.()
    setOpen((v) => !v)
  }

  function handleFeedback(feedback: FeedbackType) {
    setOpen(false)
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 1500)
    onFeedback?.(feedback)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger — 44×44 px hit area (iOS HIG) */}
      <button
        onClick={handleTrigger}
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 active:bg-gray-100"
        aria-label="Article feedback"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {confirmed ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 text-green-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
        )}
      </button>

      {/* One-time discovery tooltip */}
      {showTooltip && !open && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
        >
          Tell us what you think of this story
          <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-gray-900" />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Tune your feed
          </p>
          {FEEDBACK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="menuitem"
              onClick={() => handleFeedback(opt.value)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
