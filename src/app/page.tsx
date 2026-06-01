'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import TopicTabs from '@/components/TopicTabs'
import TopStoryCard from '@/components/TopStoryCard'
import ArticleDetail from '@/components/ArticleDetail'
import BalanceMeter from '@/components/BalanceMeter'
import LoadingSpinner from '@/components/LoadingSpinner'
import CatchUpBanner from '@/components/CatchUpBanner'
import NewsletterCard from '@/components/NewsletterCard'
import Link from 'next/link'
import type {
  Article,
  TopStory,
  BalanceStats,
  UserPreferences,
  NewsApiResponse,
  SessionOpenResponse,
  MoodPreset,
  FeedbackType,
} from '@/types'

const TOPIC_LABELS: Record<string, string> = {
  technology: 'Tech & AI',
  science: 'Science & Health',
  business: 'Business',
  world: 'World',
  positive: 'Bright Spots',
}

function SkeletonCard() {
  return (
    <div className="mx-4 mb-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="mb-2 flex gap-2">
        <div className="h-3 w-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="mb-1.5 h-4 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      <div className="mb-3 h-4 w-3/4 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      <div className="h-3 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      <div className="mt-1 h-3 w-2/3 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  )
}

type SelectedItem =
  | { type: 'article'; data: Article }
  | { type: 'topStory'; data: TopStory }
  | null

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [topStories, setTopStories] = useState<TopStory[]>([])
  const [balanceStats, setBalanceStats] = useState<BalanceStats | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [hasApiKey, setHasApiKey] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)

  // Newsletter tab
  const [activeTab, setActiveTab] = useState<'feed' | 'newsletters'>('feed')
  const [newsletters, setNewsletters] = useState<Article[]>([])
  const [newsletterUnreadCount, setNewsletterUnreadCount] = useState(0)
  const [newsletterTotal, setNewsletterTotal] = useState(0)
  const [newsletterPage, setNewsletterPage] = useState(1)
  const [isNewsletterLoading, setIsNewsletterLoading] = useState(false)
  const [isPollLoading, setIsPollLoading] = useState(false)
  const [expandedNewsletterId, setExpandedNewsletterId] = useState<string | null>(null)
  const [newsletterError, setNewsletterError] = useState<string | null>(null)

  // Catch-up mode
  const [catchUpMode, setCatchUpMode] = useState(false)
  const [catchUpGapDays, setCatchUpGapDays] = useState(0)
  const [catchUpSince, setCatchUpSince] = useState<string | null>(null)
  const [catchUpDismissed, setCatchUpDismissed] = useState(false)

  // Recap teaser — shown on briefing complete screen
  const [recapTeaser, setRecapTeaser] = useState<{ totalRead: number; topTopic: string | null } | null>(null)
  useEffect(() => {
    fetch('/api/recap?days=7')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.stats) return
        const { totalRead, topicMix } = data.stats
        const topTopic = totalRead > 0
          ? (Object.entries(topicMix as Record<string, number>)
              .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null)
          : null
        setRecapTeaser({ totalRead, topTopic })
      })
      .catch(() => null)
  }, [])

  const fetchNews = useCallback(async (category: string, mode: 'standard' | 'catchup' = 'standard', since?: string) => {
    try {
      setError(null)
      const params = new URLSearchParams({ category })
      if (mode === 'catchup' && since) {
        params.set('mode', 'catchup')
        params.set('since', since)
      }
      const res = await fetch(`/api/news?${params}`)
      if (!res.ok) throw new Error('Failed to fetch news')
      const data: NewsApiResponse = await res.json()
      setArticles(data.articles)
      setTopStories(data.topStories)
      setBalanceStats(data.balanceStats)
      setPreferences(data.preferences)
      setLastRefreshed(data.lastRefreshed)
      setHasApiKey(data.hasApiKey)
    } catch (err) {
      setError('Failed to load news. Please try again.')
      console.error(err)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/news/refresh', { method: 'POST' })
      if (!res.ok) throw new Error('Refresh failed')
      const data = await res.json()
      setLastRefreshed(data.lastRefreshed)
      await fetchNews(activeCategory)
    } catch (err) {
      console.error('Refresh error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, fetchNews, activeCategory])

  const handleDismissCatchUp = useCallback(async () => {
    setCatchUpDismissed(true)
    setCatchUpMode(false)
    await fetchNews(activeCategory, 'standard')
  }, [fetchNews, activeCategory])

  const handleMoodChange = useCallback(async (preset: MoodPreset) => {
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodPreset: preset }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.preferences) setPreferences(data.preferences)
        await fetchNews(activeCategory)
      }
    } catch (err) {
      console.error('Mood change error:', err)
    }
  }, [fetchNews, activeCategory])

  const fetchNewsletters = useCallback(async (page = 1, append = false) => {
    try {
      setIsNewsletterLoading(true)
      setNewsletterError(null)
      const res = await fetch(`/api/newsletters?page=${page}`)
      if (!res.ok) throw new Error('Failed to fetch newsletters')
      const data = await res.json()
      setNewsletters((prev) => append ? [...prev, ...data.newsletters] : data.newsletters)
      setNewsletterUnreadCount(data.unreadCount)
      setNewsletterTotal(data.total)
      setNewsletterPage(page)
    } catch (err) {
      setNewsletterError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsNewsletterLoading(false)
    }
  }, [])

  const handleNewsletterExpand = useCallback(async (id: string) => {
    setExpandedNewsletterId(id)
    const target = newsletters.find((n) => n.id === id)
    if (!target || target.isRead) return

    // Optimistic update
    setNewsletters((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    setNewsletterUnreadCount((c) => Math.max(0, c - 1))

    try {
      const res = await fetch(`/api/newsletters/${id}/read`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed')
    } catch {
      // Rollback
      setNewsletters((prev) => prev.map((n) => n.id === id ? { ...n, isRead: false } : n))
      setNewsletterUnreadCount((c) => c + 1)
    }
  }, [newsletters])

  const handleNewsletterCollapse = useCallback(() => {
    setExpandedNewsletterId(null)
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    const snapshot = newsletters.map((n) => ({ ...n }))
    setNewsletters((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setNewsletterUnreadCount(0)
    try {
      const res = await fetch('/api/newsletters/read-all', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setNewsletters(snapshot)
      setNewsletterUnreadCount(snapshot.filter((n) => !n.isRead).length)
    }
  }, [newsletters])

  const handlePollNow = useCallback(async () => {
    try {
      setIsPollLoading(true)
      const res = await fetch('/api/ingest/newsletter/imap', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      await fetchNewsletters(1)
    } catch {
      // Silent — button returns to idle
    } finally {
      setIsPollLoading(false)
    }
  }, [fetchNewsletters])

  useEffect(() => {
    if (activeTab === 'newsletters' && newsletters.length === 0 && !isNewsletterLoading) {
      void fetchNewsletters(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Initial load
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        // Record this session open and determine catch-up mode
        let isCatchUp = false
        let sinceTs: string | null = null
        let gapDays = 0
        try {
          const sessionRes = await fetch('/api/session/open', { method: 'POST' })
          if (sessionRes.ok) {
            const sessionData: SessionOpenResponse = await sessionRes.json()
            isCatchUp = sessionData.catchUpMode
            sinceTs = sessionData.previousOpenedAt
            gapDays = Math.ceil(sessionData.gapHours / 24)
          }
        } catch (e) {
          console.error('Session open failed:', e)
        }

        if (isCatchUp && sinceTs) {
          setCatchUpMode(true)
          setCatchUpSince(sinceTs)
          setCatchUpGapDays(gapDays)
        }

        const res = await fetch('/api/news?category=all')
        if (res.ok) {
          const data: NewsApiResponse = await res.json()
          setLastRefreshed(data.lastRefreshed)
          setHasApiKey(data.hasApiKey)

          const intervalMins = data.preferences?.refreshIntervalMins ?? 60
          const shouldRefresh =
            !data.lastRefreshed ||
            new Date().getTime() - new Date(data.lastRefreshed).getTime() >
              intervalMins * 60 * 1000

          if (shouldRefresh || data.articles.length === 0) {
            setIsLoading(false)
            setIsRefreshing(true)
            try {
              await fetch('/api/news/refresh', { method: 'POST' })
            } catch (e) {
              console.error('Auto-refresh failed:', e)
            } finally {
              setIsRefreshing(false)
            }
          }

          if (isCatchUp && sinceTs) {
            await fetchNews(activeCategory, 'catchup', sinceTs)
          } else {
            await fetchNews(activeCategory)
          }
        }
      } catch (err) {
        console.error('Init error:', err)
        setError('Failed to initialize. Please refresh.')
      } finally {
        setIsLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch when category changes
  useEffect(() => {
    if (!isLoading) {
      if (catchUpMode && catchUpSince) {
        fetchNews(activeCategory, 'catchup', catchUpSince)
      } else {
        fetchNews(activeCategory)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  function handleClusterToggleSave(id: string) {
    fetch(`/api/top-stories/${id}/save`, { method: 'POST' }).catch(console.error)
    setTopStories((prev) =>
      prev.map((s) => (s.id === id ? { ...s, saved: !s.saved } : s))
    )
  }

  async function handleClusterFeedback(id: string, feedback: FeedbackType) {
    try {
      await fetch(`/api/top-stories/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      })
    } catch (err) {
      console.error('Cluster feedback error:', err)
    }
  }

  const depthMode = preferences?.depthMode ?? 'skim'
  const moodPreset = preferences?.moodPreset ?? 'balanced'

  // Build feed: only clusters with 2+ sources, sorted by source count
  function buildUnifiedFeed(stories: TopStory[]) {
    const filteredStories =
      activeCategory === 'all'
        ? stories
        : stories.filter((s) => s.category === activeCategory)

    return filteredStories.filter((s) => s.sources.length >= 2)
  }

  const unifiedFeed = buildUnifiedFeed(topStories)

  // On Sunday (0) and Monday (1), promote the recap teaser above the article list
  const todayDow = new Date().getDay()
  const isWeekendReset = todayDow === 0 || todayDow === 1
  const showRecapTeaser = !!recapTeaser && recapTeaser.totalRead >= 3

  return (
    <div>
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        lastRefreshed={lastRefreshed}
        moodPreset={moodPreset}
        onMoodChange={handleMoodChange}
      />

      {!hasApiKey && (
        <div className="mx-4 mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60">
          <strong>AI features disabled.</strong> Add your{' '}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">ANTHROPIC_API_KEY</code>{' '}
          to{' '}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env.local</code>{' '}
          to enable sentiment analysis and smart summaries.
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-2xl bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/60">
          {error}
        </div>
      )}

      {/* Tab switcher: Feed / Newsletters */}
      <div className="flex border-b border-slate-200 px-4 dark:border-slate-800">
        {(['feed', 'newsletters'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'relative mr-6 pb-2 pt-3 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
          >
            {tab === 'feed' ? 'Feed' : (
              <span className="flex items-center gap-1.5">
                Newsletters
                {newsletterUnreadCount > 0 && (
                  <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {newsletterUnreadCount > 99 ? '99+' : newsletterUnreadCount}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Newsletter panel */}
      {activeTab === 'newsletters' && (
        <div className="flex flex-col">
          {/* Action bar */}
          <div className="flex items-center justify-end gap-2 px-4 py-2">
            <button
              onClick={handlePollNow}
              disabled={isPollLoading}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {isPollLoading ? (
                <LoadingSpinner size="xs" className="text-slate-500" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              )}
              Poll now
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={newsletterUnreadCount === 0}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <path d="M18 6 7 17l-5-5" />
                <path d="m22 10-7.5 7.5L13 16" />
              </svg>
              Mark all read
            </button>
          </div>

          {/* List states */}
          {isNewsletterLoading && newsletters.length === 0 ? (
            <div className="pt-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : newsletterError ? (
            <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3">
              <p className="text-xs text-red-400">{newsletterError}</p>
              <button onClick={() => fetchNewsletters(1)} className="text-xs text-red-300 underline underline-offset-2 hover:text-red-200">
                Retry
              </button>
            </div>
          ) : newsletters.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-slate-400 dark:text-slate-500">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No newsletters yet</p>
              <p className="max-w-[220px] text-xs text-slate-400 dark:text-slate-500">
                Newsletters you receive will appear here. Configure IMAP in Settings.
              </p>
              <button
                onClick={handlePollNow}
                disabled={isPollLoading}
                className="mt-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Poll now
              </button>
            </div>
          ) : (
            <>
              {newsletters.map((n) => (
                <NewsletterCard
                  key={n.id}
                  article={n}
                  isExpanded={expandedNewsletterId === n.id}
                  onExpand={handleNewsletterExpand}
                  onCollapse={handleNewsletterCollapse}
                />
              ))}
              {newsletters.length < newsletterTotal && (
                <button
                  onClick={() => fetchNewsletters(newsletterPage + 1, true)}
                  disabled={isNewsletterLoading}
                  className="mx-4 my-4 rounded-xl border border-slate-200 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50"
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'feed' && (isLoading ? (
        <div className="pt-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        </div>
      ) : (
        <>
          {/* Balance Meter */}
          {balanceStats && balanceStats.total > 0 && (
            <div className="pt-3">
              <BalanceMeter stats={balanceStats} />
            </div>
          )}

          {/* Catch-up banner */}
          {catchUpMode && !catchUpDismissed && (
            <div className="pt-3">
              <CatchUpBanner
                gapDays={catchUpGapDays}
                onDismiss={handleDismissCatchUp}
              />
            </div>
          )}

          {/* This Week recap teaser — promoted above article list on Sunday/Monday */}
          {isWeekendReset && showRecapTeaser && (
            <div className="px-4 pt-2">
              <Link
                href="/recap"
                className="flex cursor-pointer items-center justify-between rounded-2xl bg-indigo-50 px-5 py-4 ring-1 ring-indigo-100 transition-all active:scale-[0.99] dark:bg-indigo-950/40 dark:ring-indigo-900/60"
              >
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
                    </svg>
                    This Week&apos;s Recap
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-indigo-500 dark:text-indigo-400">
                    You read {recapTeaser!.totalRead} {recapTeaser!.totalRead === 1 ? 'story' : 'stories'} this week
                    {recapTeaser!.topTopic ? ` — mostly ${TOPIC_LABELS[recapTeaser!.topTopic] ?? recapTeaser!.topTopic}` : ''}.
                    See your full reading summary.
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="ml-3 h-5 w-5 flex-shrink-0 text-indigo-400 dark:text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          )}

          {/* Topic Tabs */}
          <TopicTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          {/* Depth mode toggle */}
          {articles.length > 0 && (
            <div className="mx-4 mb-2 flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">View:</span>
              <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
                {(['skim', 'deep'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/preferences', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ depthMode: mode }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          if (data.preferences) setPreferences(data.preferences)
                        }
                      } catch (err) {
                        console.error(err)
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      depthMode === mode
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {mode === 'skim' ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                          <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.257a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .906-.143Z" clipRule="evenodd" />
                        </svg>
                        Skim
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        Deep
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feed */}
          {isRefreshing && unifiedFeed.length === 0 ? (
            <div className="pt-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : unifiedFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-slate-400 dark:text-slate-500">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                No articles yet
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Tap the refresh button to fetch news
              </p>
            </div>
          ) : (
            <div className="pt-1 lg:grid lg:grid-cols-2 lg:items-start">
              {unifiedFeed.map((story) => (
                <TopStoryCard
                  key={`ts-${story.id}`}
                  story={story}
                  depthMode={depthMode}
                  onSelect={(ts) => setSelectedItem({ type: 'topStory', data: ts })}
                  onFeedback={handleClusterFeedback}
                  onToggleSave={handleClusterToggleSave}
                  isSaved={story.saved}
                />
              ))}

              {/* This Week recap teaser */}
              {showRecapTeaser && !isWeekendReset && (
                <Link
                  href="/recap"
                  className="mx-4 mb-4 flex cursor-pointer items-center justify-between rounded-2xl bg-indigo-50 px-5 py-4 ring-1 ring-indigo-100 transition-all active:scale-[0.99] dark:bg-indigo-950/40 dark:ring-indigo-900/60"
                >
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">This Week</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-indigo-500 dark:text-indigo-400">
                      You read {recapTeaser.totalRead} {recapTeaser.totalRead === 1 ? 'story' : 'stories'} this week
                      {recapTeaser.topTopic ? ` — mostly ${TOPIC_LABELS[recapTeaser.topTopic] ?? recapTeaser.topTopic}` : ''}.
                      Tap to see your full recap.
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="ml-3 h-4 w-4 flex-shrink-0 text-indigo-400 dark:text-indigo-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              )}

              {isRefreshing && (
                <div className="flex justify-center py-4">
                  <LoadingSpinner size="sm" className="text-slate-400" />
                </div>
              )}
            </div>
          )}
        </>
      ))}

      {/* Article Detail Modal */}
      {selectedItem && (
        <ArticleDetail
          article={selectedItem.type === 'article' ? selectedItem.data : null}
          topStory={selectedItem.type === 'topStory' ? selectedItem.data : null}
          allArticles={articles}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
