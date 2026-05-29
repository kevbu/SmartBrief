'use client'

import { useState, useRef, useEffect } from 'react'
import type { FeedbackType } from '@/types'

interface FeedbackMenuProps {
  articleId: string
  source: string
  showTooltip?: boolean
  onTooltipDismissed?: () => void
  onFeedback?: (feedback: FeedbackType) => void
  excludeOptions?: FeedbackType[]
}

function ThumbUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  )
}

function ThumbDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  )
}

function FaceFrownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01" />
    </svg>
  )
}

function NoSymbolIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; icon: React.FC }[] = [
  { value: 'more-like-this', label: 'More like this',   icon: ThumbUpIcon },
  { value: 'less-like-this', label: 'Less like this',   icon: ThumbDownIcon },
  { value: 'too-negative',   label: 'Too negative',     icon: FaceFrownIcon },
  { value: 'off-topic',      label: 'Off-topic',        icon: NoSymbolIcon },
  { value: 'hide-source',    label: 'Hide this source', icon: EyeOffIcon },
]

export default function FeedbackMenu({
  articleId: _articleId,
  source: _source,
  showTooltip = false,
  onTooltipDismissed,
  onFeedback,
  excludeOptions,
}: FeedbackMenuProps) {
  const visibleOptions = excludeOptions
    ? FEEDBACK_OPTIONS.filter((o) => !excludeOptions.includes(o.value))
    : FEEDBACK_OPTIONS
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
      {/* Trigger */}
      <button
        onClick={handleTrigger}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 active:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-400"
        aria-label="Article feedback"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {confirmed ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 text-emerald-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
        )}
      </button>

      {/* Discovery tooltip */}
      {showTooltip && !open && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
        >
          Tell us what you think of this story
          <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-slate-900" />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl shadow-slate-200/50 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-none"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Tune your feed
          </p>
          {visibleOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                role="menuitem"
                onClick={() => handleFeedback(opt.value)}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <span className="text-slate-400 dark:text-slate-500"><Icon /></span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
