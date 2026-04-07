'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import TopicTabs from '@/components/TopicTabs'
import TopStoryCard from '@/components/TopStoryCard'
import ArticleCard from '@/components/ArticleCard'
import ArticleDetail from '@/components/ArticleDetail'
import BalanceMeter from '@/components/BalanceMeter'
import SessionProgress from '@/components/SessionProgress'
import LoadingSpinner from '@/components/LoadingSpinner'
import CatchUpBanner from '@/components/CatchUpBanner'
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
  world: 'World News',
  positive: 'Bright Spots',
}

function SkeletonCard() {
  return (
    <div className="mx-4 mb-3 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="mb-2 flex gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-8 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="mb-1.5 h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
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

  // Session state: how many articles in the current briefing session
  const [sessionLimit, setSessionLimit] = useState(15)
  const [articlesRead, setArticlesRead] = useState(0)
  const [sessionExpanded, setSessionExpanded] = useState(false)

  // Catch-up mode
  const [catchUpMode, setCatchUpMode] = useState(false)
  const [catchUpGapDays, setCatchUpGapDays] = useState(0)
  const [catchUpSince, setCatchUpSince] = useState<string | null>(null)
  const [catchUpDismissed, setCatchUpDismissed] = useState(false)

  // Feedback — undo toast: write immediately, allow DELETE within 5 s
  const [undoToast, setUndoToast] = useState<string | null>(null)
  const pendingFeedbackRef = useRef<{
    feedbackId: string
    id: string        // articleId
    feedback: FeedbackType
    source: string
  } | null>(null)
  // Separate timer ref: only used to defer the in-session hide-source feed filter
  const hideSourceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Auto-dismiss undo toast after 5 s
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // First-time discovery tooltip
  const [showFeedbackTooltip, setShowFeedbackTooltip] = useState(false)
  useEffect(() => {
    if (!localStorage.getItem('smartbrief:feedback-tooltip-shown')) {
      setShowFeedbackTooltip(true)
      // Auto-dismiss after 6 s if user never taps the button
      const t = setTimeout(() => setShowFeedbackTooltip(false), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  function dismissFeedbackTooltip() {
    setShowFeedbackTooltip(false)
    localStorage.setItem('smartbrief:feedback-tooltip-shown', '1')
  }

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
      if (data.preferences?.sessionSize) {
        setSessionLimit(data.preferences.sessionSize)
      }
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
      setArticlesRead(0)
      setSessionExpanded(false)
    } catch (err) {
      console.error('Refresh error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, fetchNews, activeCategory])

  const handleDismissCatchUp = useCallback(async () => {
    setCatchUpDismissed(true)
    setCatchUpMode(false)
    setArticlesRead(0)
    setSessionExpanded(false)
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
          if (data.preferences?.sessionSize) {
            setSessionLimit(data.preferences.sessionSize)
          }

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
      setArticlesRead(0)
      setSessionExpanded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  function handleMarkRead(id: string) {
    fetch(`/api/articles/${id}/read`, { method: 'POST' }).catch(console.error)
    setArticlesRead((n) => n + 1)
  }

  function handleToggleSave(id: string) {
    fetch(`/api/articles/${id}/save`, { method: 'POST' }).catch(console.error)
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isSaved: !a.isSaved } : a))
    )
  }

  const FEEDBACK_LABELS: Record<FeedbackType, string> = {
    'more-like-this': 'More like this saved',
    'less-like-this': 'Less like this saved',
    'too-negative':   'Marked too negative',
    'off-topic':      'Marked off-topic',
    'hide-source':    'Source hidden',
  }

  async function handleFeedback(id: string, feedback: FeedbackType) {
    // Dismiss tooltip on first use
    if (showFeedbackTooltip) dismissFeedbackTooltip()

    // Clear any previous undo state
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    if (hideSourceTimerRef.current) clearTimeout(hideSourceTimerRef.current)

    const article = articles.find((a) => a.id === id)
    const source = article?.source ?? ''

    // Write to SQLite immediately (spec: "not queued")
    let feedbackId = ''
    try {
      const res = await fetch(`/api/articles/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, source }),
      })
      const data = await res.json() as { success: boolean; feedbackId?: string }
      feedbackId = data.feedbackId ?? ''
    } catch (err) {
      console.error('Feedback error:', err)
    }

    pendingFeedbackRef.current = { feedbackId, id, feedback, source }
    setUndoToast(FEEDBACK_LABELS[feedback])

    // Auto-dismiss toast after 5 s and apply deferred in-session effects
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null)
      pendingFeedbackRef.current = null
    }, 5000)

    // Defer the in-session feed filter for hide-source so undo can still reverse it
    if (feedback === 'hide-source' && article) {
      hideSourceTimerRef.current = setTimeout(() => {
        setArticles((prev) => prev.filter((a) => a.source !== article.source))
      }, 5000)
    }
  }

  function handleUndoFeedback() {
    const pending = pendingFeedbackRef.current
    if (!pending) return

    // Cancel timers
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    if (hideSourceTimerRef.current) clearTimeout(hideSourceTimerRef.current)
    pendingFeedbackRef.current = null
    setUndoToast(null)

    // Delete the DB record and reverse side effects
    if (pending.feedbackId) {
      fetch(`/api/articles/${pending.id}/feedback?feedbackId=${pending.feedbackId}`, {
        method: 'DELETE',
      }).catch(console.error)
    }
  }

  function handleSkip(id: string) {
    // Fire-and-forget implicit skip signal — no undo, no UI change
    fetch(`/api/articles/${id}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    }).catch((e) => console.error('[skip-signal] failed:', e))
  }

  const depthMode = preferences?.depthMode ?? 'skim'
  const moodPreset = preferences?.moodPreset ?? 'balanced'

  // Session-limited articles
  const displayedArticles = sessionExpanded
    ? articles
    : articles.slice(0, sessionLimit)

  const showSessionProgress = articles.length > 0 && !isLoading

  // Build unified feed: interleave TopStoryCards and ArticleCards
  function buildUnifiedFeed(articleList: Article[], stories: TopStory[]) {
    // Filter stories by category if not 'all'
    const filteredStories =
      activeCategory === 'all'
        ? stories
        : stories.filter((s) => s.category === activeCategory)

    // Build a map: articleId -> topStory (first cluster that claims this article)
    const articleToStory = new Map<string, TopStory>()
    for (const story of filteredStories) {
      let ids: string[] = []
      try {
        ids = typeof story.articleIds === 'string'
          ? (JSON.parse(story.articleIds) as string[])
          : story.articleIds
      } catch {
        ids = []
      }
      for (const aid of ids) {
        if (!articleToStory.has(aid)) {
          articleToStory.set(aid, story)
        }
      }
    }

    // Track which stories have already been inserted
    const insertedStories = new Set<string>()

    type FeedItem =
      | { kind: 'article'; article: Article }
      | { kind: 'topStory'; story: TopStory }

    const feed: FeedItem[] = []

    for (const article of articleList) {
      const story = articleToStory.get(article.id)
      if (story) {
        if (!insertedStories.has(story.id)) {
          insertedStories.add(story.id)
          feed.push({ kind: 'topStory', story })
        }
        // Skip subsequent articles from the same cluster
      } else {
        feed.push({ kind: 'article', article })
      }
    }

    return feed
  }

  const unifiedFeed = buildUnifiedFeed(displayedArticles, topStories)
  const firstArticleId = (unifiedFeed.find((i) => i.kind === 'article') as { kind: 'article'; article: Article } | undefined)?.article.id ?? null

  // On Sunday (0) and Monday (1), promote the recap teaser above the article list
  const todayDow = new Date().getDay()
  const isWeekendReset = todayDow === 0 || todayDow === 1
  const showRecapTeaser = !sessionExpanded && articles.length > sessionLimit && !!recapTeaser && recapTeaser.totalRead > 0

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
        <div className="mx-4 mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          <strong>AI features disabled.</strong> Add your{' '}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">ANTHROPIC_API_KEY</code>{' '}
          to{' '}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env.local</code>{' '}
          to enable sentiment analysis and smart summaries.
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {isLoading ? (
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
            <div className="px-4 pt-3">
              <Link
                href="/recap"
                className="flex items-center justify-between rounded-2xl bg-indigo-50 px-5 py-4 transition-transform active:scale-[0.99] dark:bg-indigo-950/50"
              >
                <div>
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">📊 This Week&apos;s Recap</p>
                  <p className="mt-0.5 text-xs text-indigo-500 leading-snug dark:text-indigo-400">
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
              <span className="text-xs text-gray-400 dark:text-gray-500">View:</span>
              <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
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
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      depthMode === mode
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {mode === 'skim' ? '⚡ Skim' : '📖 Deep'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Session progress */}
          {showSessionProgress && !sessionExpanded && (
            <SessionProgress
              current={articlesRead}
              total={sessionLimit}
              onLoadMore={() => setSessionExpanded(true)}
              isCatchUp={catchUpMode && !catchUpDismissed}
            />
          )}

          {/* Articles */}
          {isRefreshing && articles.length === 0 ? (
            <div className="pt-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-3 text-4xl">📰</span>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                No articles yet
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Tap the refresh button to fetch news
              </p>
            </div>
          ) : (
            <div className="pt-1">
              {unifiedFeed.map((item) =>
                item.kind === 'topStory' ? (
                  <TopStoryCard
                    key={`ts-${item.story.id}`}
                    story={item.story}
                    onSelect={(ts) => setSelectedItem({ type: 'topStory', data: ts })}
                  />
                ) : (
                  <ArticleCard
                    key={item.article.id}
                    article={item.article}
                    depthMode={depthMode}
                    onMarkRead={handleMarkRead}
                    onToggleSave={handleToggleSave}
                    onFeedback={handleFeedback}
                    onSkip={handleSkip}
                    onSelect={(article) => setSelectedItem({ type: 'article', data: article })}
                    showFeedbackTooltip={showFeedbackTooltip && item.article.id === firstArticleId}
                    onFeedbackTooltipDismissed={dismissFeedbackTooltip}
                  />
                )
              )}

              {/* Show session complete / load more when not expanded */}
              {!sessionExpanded && articles.length > sessionLimit && (
                <div className="mx-4 mb-4 mt-2 rounded-2xl bg-emerald-50 p-5 text-center dark:bg-emerald-950/50">
                  <div className="mb-2 text-3xl">🌟</div>
                  <h3 className="mb-1 text-base font-bold text-emerald-800 dark:text-emerald-200">
                    {catchUpMode && !catchUpDismissed ? "You're caught up!" : 'Briefing complete!'}
                  </h3>
                  <p className="mb-3 text-xs text-emerald-600 dark:text-emerald-400">
                    {catchUpMode && !catchUpDismissed
                      ? `Top stories from the last ${catchUpGapDays} days. Great job catching up.`
                      : `You've read your ${sessionLimit}-story brief. Great job staying informed.`}
                  </p>
                  <button
                    onClick={() => setSessionExpanded(true)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    Load more stories
                  </button>
                </div>
              )}

              {/* This Week recap teaser — shown after briefing complete (standard days only; Sun/Mon shows above article list) */}
              {showRecapTeaser && !isWeekendReset && (
                <Link
                  href="/recap"
                  className="mx-4 mb-4 flex items-center justify-between rounded-2xl bg-indigo-50 px-5 py-4 active:scale-98 transition-transform dark:bg-indigo-950/50"
                >
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">This Week</p>
                    <p className="mt-0.5 text-[11px] text-indigo-500 leading-snug dark:text-indigo-400">
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
                  <LoadingSpinner size="sm" className="text-gray-400" />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 pl-4 pr-2 py-2.5 text-sm text-white shadow-lg">
          <span>{undoToast}</span>
          <button
            onClick={handleUndoFeedback}
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
          >
            Undo
          </button>
        </div>
      )}

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
