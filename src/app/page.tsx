'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import TopicTabs from '@/components/TopicTabs'
import TopStoryCard from '@/components/TopStoryCard'
import ArticleCard from '@/components/ArticleCard'
import BalanceMeter from '@/components/BalanceMeter'
import SessionProgress from '@/components/SessionProgress'
import LoadingSpinner from '@/components/LoadingSpinner'
import type {
  Article,
  TopStory,
  BalanceStats,
  UserPreferences,
  NewsApiResponse,
  MoodPreset,
  FeedbackType,
} from '@/types'

function SkeletonCard() {
  return (
    <div className="mx-4 mb-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-8 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mb-1.5 h-4 w-full animate-pulse rounded bg-gray-100" />
      <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
      <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-gray-100" />
    </div>
  )
}

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

  // Session state: how many articles in the current briefing session
  const [sessionLimit, setSessionLimit] = useState(15)
  const [articlesRead, setArticlesRead] = useState(0)
  const [sessionExpanded, setSessionExpanded] = useState(false)

  const fetchNews = useCallback(async (category: string) => {
    try {
      setError(null)
      const res = await fetch(`/api/news?category=${category}`)
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

          await fetchNews(activeCategory)
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
      fetchNews(activeCategory)
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

  function handleFeedback(id: string, feedback: FeedbackType) {
    if (feedback === 'hide-source') {
      const article = articles.find((a) => a.id === id)
      if (article) {
        setArticles((prev) => prev.filter((a) => a.source !== article.source))
      }
    }
  }

  const depthMode = preferences?.depthMode ?? 'skim'
  const moodPreset = preferences?.moodPreset ?? 'balanced'

  // Session-limited articles
  const displayedArticles = sessionExpanded
    ? articles
    : articles.slice(0, sessionLimit)

  const showTopStories =
    activeCategory === 'all' && topStories.length > 0 && !isLoading
  const showSessionProgress = articles.length > 0 && !isLoading

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
        <div className="mx-4 mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <strong>AI features disabled.</strong> Add your{' '}
          <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code>{' '}
          to{' '}
          <code className="rounded bg-amber-100 px-1">.env.local</code>{' '}
          to enable sentiment analysis and smart summaries.
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
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
          {/* Top Stories */}
          {showTopStories && (
            <section className="pt-4">
              {topStories.slice(0, 3).map((story) => (
                <TopStoryCard key={story.id} story={story} />
              ))}
            </section>
          )}

          {/* Balance Meter */}
          {balanceStats && balanceStats.total > 0 && (
            <div className="pt-3">
              <BalanceMeter stats={balanceStats} />
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
              <span className="text-xs text-gray-400">View:</span>
              <div className="flex rounded-lg bg-gray-100 p-0.5">
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
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-gray-500'
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
              <p className="text-sm font-medium text-gray-500">
                No articles yet
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Tap the refresh button to fetch news
              </p>
            </div>
          ) : (
            <div className="pt-1">
              {displayedArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  depthMode={depthMode}
                  onMarkRead={handleMarkRead}
                  onToggleSave={handleToggleSave}
                  onFeedback={handleFeedback}
                />
              ))}

              {/* Show session complete / load more when not expanded */}
              {!sessionExpanded && articles.length > sessionLimit && (
                <div className="mx-4 mb-4 mt-2 rounded-2xl bg-emerald-50 p-5 text-center">
                  <div className="mb-2 text-3xl">🌟</div>
                  <h3 className="mb-1 text-base font-bold text-emerald-800">
                    Briefing complete!
                  </h3>
                  <p className="mb-3 text-xs text-emerald-600">
                    You&apos;ve read your {sessionLimit}-story brief. Great job staying informed.
                  </p>
                  <button
                    onClick={() => setSessionExpanded(true)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    Load more stories
                  </button>
                </div>
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
    </div>
  )
}
