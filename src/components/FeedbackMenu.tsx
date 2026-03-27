'use client'

import { useState, useRef, useEffect } from 'react'
import type { FeedbackType } from '@/types'

interface FeedbackMenuProps {
  articleId: string
  source: string
  onFeedback?: (feedback: FeedbackType) => void
}

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: 'more-like-this',  label: 'More like this',  emoji: '👍' },
  { value: 'less-like-this',  label: 'Less like this',  emoji: '👎' },
  { value: 'too-negative',    label: 'Too negative',    emoji: '😔' },
  { value: 'off-topic',       label: 'Off-topic',       emoji: '🚫' },
  { value: 'hide-source',     label: 'Hide this source', emoji: '🙈' },
]

export default function FeedbackMenu({ articleId, source, onFeedback }: FeedbackMenuProps) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
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

  async function handleFeedback(feedback: FeedbackType) {
    setOpen(false)
    setSubmitted(true)
    onFeedback?.(feedback)
    try {
      await fetch(`/api/articles/${articleId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, source }),
      })
    } catch (err) {
      console.error('Feedback error:', err)
    }
  }

  if (submitted) {
    return (
      <span className="text-xs text-gray-400">Thanks!</span>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
        aria-label="Article feedback"
        title="Give feedback on this article"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Tune your feed
          </p>
          {FEEDBACK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
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
