'use client'

import { useState, useEffect } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { RecapStats } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  technology: '🤖 Tech & AI',
  science:    '🧪 Science & Health',
  business:   '📊 Business',
  world:      '🌍 World',
  positive:   '✨ Bright Spots',
}

const PERIOD_OPTIONS = [
  { value: 7,  label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
]

export default function RecapPage() {
  const [stats, setStats] = useState<RecapStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState(7)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/recap?days=${period}`)
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (data.stats) setStats(data.stats)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [period])

  function sentimentEmoji(score: number): string {
    if (score > 0.2) return '🌟'
    if (score > -0.1) return '⚖️'
    return '😐'
  }

  function sentimentLabel(score: number): string {
    if (score > 0.3) return 'Very balanced & uplifting'
    if (score > 0.1) return 'Mostly balanced'
    if (score > -0.1) return 'Neutral overall'
    if (score > -0.3) return 'Somewhat heavy'
    return 'Heavy news diet'
  }

  function getCoachingTip(stats: RecapStats): string {
    const { sentimentMix, totalRead } = stats
    const total = sentimentMix.positive + sentimentMix.neutral + sentimentMix.negative || 1
    const negPct = (sentimentMix.negative / total) * 100
    const posPct = (sentimentMix.positive / total) * 100

    if (totalRead === 0) return "No articles read yet. Refresh your feed to get started!"
    if (negPct > 50) return "You've been reading a lot of heavy news. Consider switching to 'Constructive' mode for your next session."
    if (posPct > 60) return "Great balance! You're staying informed while keeping things uplifting."
    if (totalRead > 50) return "You're a thorough reader! Remember, quality over quantity — try a shorter session size."
    return "Nice reading habits! You're staying informed across a good range of topics."
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-slate-900">News Recap</h1>
        <p className="text-xs text-gray-400">Your reading habits at a glance</p>
      </header>

      {/* Period selector */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                period === opt.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !stats || stats.totalRead === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <span className="mb-3 text-5xl">📊</span>
          <p className="text-sm font-medium text-gray-500">No reading history yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Read some articles from your feed and come back here to see your stats.
          </p>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          {/* Overall score */}
          <section className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
            <div className="mb-1 text-4xl">{sentimentEmoji(stats.avgSentimentScore)}</div>
            <h2 className="mb-1 text-lg font-bold text-slate-900">
              {sentimentLabel(stats.avgSentimentScore)}
            </h2>
            <p className="mb-3 text-xs text-slate-600">{getCoachingTip(stats)}</p>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalRead}
              <span className="ml-1 text-sm font-normal text-gray-500">articles read</span>
            </div>
          </section>

          {/* Sentiment balance */}
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Sentiment Mix</h3>
            {(() => {
              const total = stats.sentimentMix.positive + stats.sentimentMix.neutral + stats.sentimentMix.negative || 1
              return (
                <div className="space-y-2.5">
                  {[
                    { label: '✨ Uplifting',   count: stats.sentimentMix.positive, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                    { label: '📰 Neutral',     count: stats.sentimentMix.neutral,  color: 'bg-gray-300',    textColor: 'text-gray-600' },
                    { label: '📌 In Focus',    count: stats.sentimentMix.negative, color: 'bg-amber-400',   textColor: 'text-amber-700' },
                  ].map(({ label, count, color, textColor }) => {
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className={`font-medium ${textColor}`}>{label}</span>
                          <span className="text-gray-400">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </section>

          {/* Topic mix */}
          {Object.keys(stats.topicMix).length > 0 && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Topics Read</h3>
              <div className="space-y-2.5">
                {Object.entries(stats.topicMix)
                  .sort(([, a], [, b]) => b - a)
                  .map(([topic, count]) => {
                    const total = Object.values(stats.topicMix).reduce((s, n) => s + n, 0) || 1
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={topic}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium text-gray-700">
                            {CATEGORY_LABELS[topic] ?? topic}
                          </span>
                          <span className="text-gray-400">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          )}

          {/* Top sources */}
          {Object.keys(stats.sourceMix).length > 0 && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Top Sources</h3>
              <div className="space-y-1.5">
                {Object.entries(stats.sourceMix)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">{source}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <p className="text-center text-[10px] text-gray-300 pb-2">
            Tip: Aim for a mix of topics and &gt;30% uplifting stories for a healthier news diet.
          </p>
        </div>
      )}
    </div>
  )
}
