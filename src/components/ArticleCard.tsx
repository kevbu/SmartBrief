'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import type { Article, DepthMode, FeedbackType } from '@/types'
import SentimentBadge from './SentimentBadge'
import BiasBadge from './BiasBadge'
import FeedbackMenu from './FeedbackMenu'
import { getEmojiForSource } from '@/lib/news-sources'

const SKIP_VISIBILITY_MS = 3000

interface ArticleCardProps {
  article: Article
  depthMode?: DepthMode
  onMarkRead: (id: string) => void
  onToggleSave: (id: string) => void
  onFeedback?: (id: string, feedback: FeedbackType) => void
  onSkip?: (id: string) => void
  onSelect?: (article: Article) => void
  showFeedbackTooltip?: boolean
  onFeedbackTooltipDismissed?: () => void
}

export default function ArticleCard({
  article,
  depthMode = 'skim',
  onMarkRead,
  onToggleSave,
  onFeedback,
  onSkip,
  onSelect,
  showFeedbackTooltip = false,
  onFeedbackTooltipDismissed,
}: ArticleCardProps) {
  const [isSaved, setIsSaved] = useState(article.isSaved)
  const [isRead, setIsRead] = useState(article.isRead)
  const [hidden, setHidden] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [reasonVisible, setReasonVisible] = useState(false)

  const cardRef = useRef<HTMLElement>(null)
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactedRef = useRef(article.isRead)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!onSkip || interactedRef.current) return

    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          skipTimerRef.current = setTimeout(() => {
            if (!interactedRef.current) {
              onSkip(article.id)
              interactedRef.current = true
            }
          }, SKIP_VISIBILITY_MS)
        } else {
          if (skipTimerRef.current !== null) {
            clearTimeout(skipTimerRef.current)
            skipTimerRef.current = null
          }
          setReasonVisible(false)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (skipTimerRef.current !== null) clearTimeout(skipTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id])

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current)
      if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  function shortenReason(reason: string): string {
    if (reason.includes('a source you read often')) return `Source you trust · ${article.source}`
    if (reason.includes('your most-read topic')) return reason.split(' — ')[0]
    if (reason.includes('based on your settings')) return 'Relevant to your feed'
    return reason
  }

  function handlePointerDown(e: React.PointerEvent) {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY }
    pressTimerRef.current = setTimeout(() => setReasonVisible(true), 500)
  }

  function handlePointerUp() {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerDownPosRef.current) return
    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x)
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y)
    if (dx > 8 || dy > 8) {
      if (pressTimerRef.current !== null) {
        clearTimeout(pressTimerRef.current)
        pressTimerRef.current = null
      }
    }
  }

  function handleMouseEnter() {
    if (window.matchMedia('(pointer: coarse)').matches) return
    hoverTimerRef.current = setTimeout(() => setReasonVisible(true), 300)
  }

  function handleMouseLeave() {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setReasonVisible(false)
  }

  function handleClick() {
    interactedRef.current = true
    if (skipTimerRef.current !== null) {
      clearTimeout(skipTimerRef.current)
      skipTimerRef.current = null
    }

    if (collapsed) {
      setCollapsed(false)
      return
    }
    if (!isRead) {
      setIsRead(true)
      onMarkRead(article.id)
    }
    if (onSelect) {
      onSelect(article)
    } else {
      window.open(article.url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    setIsSaved(!isSaved)
    onToggleSave(article.id)
  }

  function handleFeedback(feedback: FeedbackType) {
    onFeedback?.(article.id, feedback)
    if (feedback === 'hide-source') {
      setHidden(true)
    } else if (feedback === 'off-topic') {
      setCollapsed(true)
    }
  }

  if (hidden) return null

  if (collapsed) {
    return (
      <article
        className="mx-4 mb-1.5 flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-3 opacity-40 ring-1 ring-slate-100 transition-all active:scale-[0.99] dark:bg-slate-900 dark:ring-slate-800"
        onClick={handleClick}
        aria-label="Off-topic story — tap to expand"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5 flex-shrink-0 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p className="min-w-0 flex-1 truncate text-xs text-slate-400">{article.title}</p>
        <span className="flex-shrink-0 text-[10px] text-slate-300 dark:text-slate-600">tap to expand</span>
      </article>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })

  const displayText = depthMode === 'deep'
    ? (article.aiSummary || article.description)
    : article.description

  const textClamp = depthMode === 'deep' ? 'line-clamp-4' : 'line-clamp-2'

  return (
    <article
      ref={cardRef}
      className={clsx(
        'mx-4 mb-2 cursor-pointer rounded-2xl bg-white p-4 ring-1 ring-slate-100 transition-all active:scale-[0.99] hover:ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-slate-700',
        isRead && 'opacity-55'
      )}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Source row */}
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <span>{article.url.startsWith('newsletter://') ? '✉️' : getEmojiForSource(article.source)}</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">{article.source}</span>
            {article.url.startsWith('newsletter://') && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-400">
                newsletter
              </span>
            )}
            <BiasBadge source={article.source} />
            <span>·</span>
            <span>{timeAgo}</span>
          </div>

          {/* Title */}
          <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {article.title}
          </h3>

          {/* Description / AI Summary */}
          {displayText && (
            <p className={clsx('text-xs leading-relaxed text-slate-600 dark:text-slate-400', textClamp)}>
              {displayText}
            </p>
          )}

          {/* Why am I seeing this? */}
          {depthMode === 'deep' ? (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-600">
              <span>✦</span>
              <span>{article.reason ?? `From ${article.source} · ${article.category} · ${article.sentiment} tone`}</span>
            </p>
          ) : article.reason && reasonVisible ? (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              <span>✦</span>
              <span>{shortenReason(article.reason)}</span>
            </p>
          ) : null}

          {/* Footer */}
          <div className="mt-2.5 flex items-center justify-between">
            <SentimentBadge sentiment={article.sentiment} />
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <FeedbackMenu
                articleId={article.id}
                source={article.source}
                showTooltip={showFeedbackTooltip}
                onTooltipDismissed={onFeedbackTooltipDismissed}
                onFeedback={handleFeedback}
              />
              <button
                onClick={handleSave}
                className={clsx(
                  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors',
                  isSaved
                    ? 'text-blue-500'
                    : 'text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-500'
                )}
                aria-label={isSaved ? 'Remove bookmark' : 'Bookmark article'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isSaved ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail */}
        {article.imageUrl && (
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
            <Image
              src={article.imageUrl}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </article>
  )
}
