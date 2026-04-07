'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { RecapStats, UserPreferences } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  technology: '🤖 Tech & AI',
  science:    '🧪 Science & Health',
  business:   '📊 Business',
  world:      '🌍 World',
  positive:   '✨ Bright Spots',
}

const BIAS_DISPLAY: Record<string, { label: string; short: string; color: string }> = {
  'left':         { label: 'Left',         short: 'L',  color: 'bg-blue-600' },
  'center-left':  { label: 'Center-Left',  short: 'CL', color: 'bg-blue-400' },
  'center':       { label: 'Center',       short: 'C',  color: 'bg-gray-400' },
  'center-right': { label: 'Center-Right', short: 'CR', color: 'bg-orange-400' },
  'right':        { label: 'Right',        short: 'R',  color: 'bg-red-500' },
}

const PERIOD_OPTIONS = [
  { value: 7,  label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
]

const NUDGE_THRESHOLD_PP = 15  // percentage points

export default function RecapPage() {
  const [stats, setStats] = useState<RecapStats | null>(null)
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState(7)

  // Log recap_viewed event once on mount for the weekly usage metric
  useEffect(() => {
    fetch('/api/recap/viewed', { method: 'POST' }).catch(() => null)
  }, [])

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        // Parallel fetch — no waterfall
        const [recapRes, prefsRes] = await Promise.all([
          fetch(`/api/recap?days=${period}`),
          fetch('/api/preferences'),
        ])
        if (recapRes.ok) {
          const data = await recapRes.json()
          if (data.stats) setStats(data.stats)
        }
        if (prefsRes.ok) {
          const data = await prefsRes.json()
          if (data.preferences) setPrefs(data.preferences)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [period])

  // ── Derived helpers ──────────────────────────────────────────────────────

  function pct(count: number, total: number) {
    if (total === 0) return 0
    return Math.round((count / total) * 100)
  }

  function sentimentNudge(): string | null {
    if (!stats || !prefs) return null
    const total = stats.sentimentMix.positive + stats.sentimentMix.neutral + stats.sentimentMix.negative
    if (total === 0) return null
    const actualNeg = pct(stats.sentimentMix.negative, total)
    const actualPos = pct(stats.sentimentMix.positive, total)
    const targetNeg = Math.round(prefs.negativeRatio * 100)
    const targetPos = Math.round(prefs.positiveRatio * 100)

    if (actualNeg - targetNeg > NUDGE_THRESHOLD_PP) {
      return `Your feed ran more negative than your ${prefs.moodPreset} preset this week.`
    }
    if (targetPos - actualPos > NUDGE_THRESHOLD_PP) {
      return `Your feed had fewer uplifting stories than your ${prefs.moodPreset} preset targets.`
    }
    return null
  }

  // ── Insufficient data guard ──────────────────────────────────────────────

  if (!isLoading && stats && stats.daysActive < 3 && stats.totalRead > 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-slate-900">This Week</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <span className="mb-4 text-5xl">📊</span>
          <p className="mb-2 text-base font-semibold text-gray-700">Almost there</p>
          <p className="text-sm text-gray-500">
            Read for a few more days to unlock your weekly recap.
            You&apos;ve read on {stats.daysActive} day{stats.daysActive === 1 ? '' : 's'} so far — come back after day 3.
          </p>
        </div>
      </div>
    )
  }

  const topicTotal = stats ? Object.values(stats.topicMix).reduce((s, n) => s + n, 0) : 0
  const sentimentTotal = stats ? stats.sentimentMix.positive + stats.sentimentMix.neutral + stats.sentimentMix.negative : 0
  const biasTotal = stats ? Object.values(stats.biasMix).reduce((s, n) => s + n, 0) : 0
  const nudge = sentimentNudge()

  return (
    <div className="pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-slate-900">This Week</h1>
        <p className="text-xs text-gray-400">Your reading habits at a glance · all data stays local</p>
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
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : !stats || stats.totalRead === 0 ? (
        /* ── Zero-read empty state ────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <span className="mb-4 text-5xl">📰</span>
          <p className="mb-2 text-base font-semibold text-gray-700">No briefings this week</p>
          <p className="text-sm text-gray-500">
            Come back after your next read to see your news-diet summary.
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-4">

          {/* ── 5.1 Overview Bar ────────────────────────────────────────── */}
          <section className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.totalRead}</p>
                <p className="text-[11px] text-gray-500">stories read</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.daysActive}</p>
                <p className="text-[11px] text-gray-500">of {period} days active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.daysActive > 0 ? Math.round(stats.totalRead / stats.daysActive) : '—'}
                </p>
                <p className="text-[11px] text-gray-500">avg per day</p>
              </div>
            </div>
          </section>

          {/* ── 5.2 Topic Mix ───────────────────────────────────────────── */}
          {Object.keys(stats.topicMix).length > 0 && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Topics Read</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.topicMix)
                  .sort(([, a], [, b]) => b - a)
                  .map(([topic, count]) => {
                    const p = pct(count, topicTotal)
                    return (
                      <Link
                        key={topic}
                        href={`/?category=${topic}`}
                        className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 active:scale-95"
                      >
                        <span>{CATEGORY_LABELS[topic] ?? topic}</span>
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                          {p}%
                        </span>
                      </Link>
                    )
                  })}
              </div>
              {/* Proportional bar */}
              <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                {Object.entries(stats.topicMix)
                  .sort(([, a], [, b]) => b - a)
                  .map(([topic, count], i) => {
                    const p = pct(count, topicTotal)
                    const colors = ['bg-blue-500', 'bg-indigo-400', 'bg-violet-400', 'bg-cyan-400', 'bg-teal-400']
                    return (
                      <div
                        key={topic}
                        className={`${colors[i % colors.length]} first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${p}%` }}
                        title={`${CATEGORY_LABELS[topic] ?? topic}: ${p}%`}
                      />
                    )
                  })}
              </div>
            </section>
          )}

          {/* ── 5.3 Sentiment Distribution ──────────────────────────────── */}
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Sentiment Distribution</h3>

            {/* Stacked bar: actual */}
            <div className="mb-1 flex h-3 overflow-hidden rounded-full">
              <div className="bg-emerald-500 transition-all" style={{ width: `${pct(stats.sentimentMix.positive, sentimentTotal)}%` }} />
              <div className="bg-gray-300 transition-all" style={{ width: `${pct(stats.sentimentMix.neutral, sentimentTotal)}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${pct(stats.sentimentMix.negative, sentimentTotal)}%` }} />
            </div>

            <div className="mb-3 flex gap-3 text-[11px] text-gray-500">
              <span>✨ {pct(stats.sentimentMix.positive, sentimentTotal)}%</span>
              <span>📰 {pct(stats.sentimentMix.neutral, sentimentTotal)}%</span>
              <span>📌 {pct(stats.sentimentMix.negative, sentimentTotal)}%</span>
            </div>

            {/* Target comparison */}
            {prefs && (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                <span className="font-medium text-gray-600">Your {prefs.moodPreset} target: </span>
                ✨ {Math.round(prefs.positiveRatio * 100)}% · 📰 {Math.round(prefs.neutralRatio * 100)}% · 📌 {Math.round(prefs.negativeRatio * 100)}%
              </div>
            )}

            {/* Nudge */}
            {nudge ? (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
                <p className="text-[11px] text-amber-700">{nudge}</p>
                <Link href="/settings" className="mt-1 block text-[11px] font-medium text-amber-600 hover:underline">
                  Adjust mood preset →
                </Link>
              </div>
            ) : null}
          </section>

          {/* ── 5.4 Bias Spread ─────────────────────────────────────────── */}
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-gray-900">Bias Spread</h3>
            <p className="mb-3 text-[11px] text-gray-400">Source political positioning of stories you read — for information only</p>

            {/* Stacked bar */}
            <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
              {Object.entries(BIAS_DISPLAY).map(([key, { color }]) => {
                const count = stats.biasMix[key] ?? 0
                const p = pct(count, biasTotal)
                return p > 0 ? (
                  <div key={key} className={`${color} transition-all`} style={{ width: `${p}%` }} title={`${BIAS_DISPLAY[key].label}: ${p}%`} />
                ) : null
              })}
            </div>

            {/* Labels */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {Object.entries(BIAS_DISPLAY).map(([key, { short, label, color }]) => {
                const count = stats.biasMix[key] ?? 0
                const p = pct(count, biasTotal)
                return (
                  <div key={key} className="space-y-1">
                    <div className={`mx-auto h-2 w-2 rounded-full ${count === 0 ? 'bg-gray-200' : color}`} />
                    <p className={`text-[10px] font-medium ${count === 0 ? 'text-gray-300' : 'text-gray-600'}`}>{short}</p>
                    <p className={`text-[10px] ${count === 0 ? 'text-gray-300' : 'text-gray-500'}`}>{p}%</p>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 text-center text-[10px] text-gray-300">L · CL · C · CR · R</div>
          </section>

          {/* ── 5.5 Feedback Summary ────────────────────────────────────── */}
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Feedback Given</h3>

            {stats.feedbackSummary.moreLikeThis === 0 &&
             stats.feedbackSummary.lessLikeThis === 0 &&
             stats.feedbackSummary.hiddenSourceCount === 0 ? (
              <p className="text-[11px] text-gray-400">
                No feedback given this week — tap 👍 👎 on any card to teach SmartBrief your preferences.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">👍 More like this</span>
                  <span className="font-semibold text-gray-900">{stats.feedbackSummary.moreLikeThis}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">👎 Less like this</span>
                  <span className="font-semibold text-gray-900">{stats.feedbackSummary.lessLikeThis}</span>
                </div>
                {stats.feedbackSummary.hiddenSourceCount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">🚫 Hidden sources</span>
                    <span className="font-semibold text-gray-900">{stats.feedbackSummary.hiddenSourceCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* Topic nudge(s) */}
            {stats.feedbackSummary.topicNudges.length > 0 && (
              <div className="mt-3 rounded-lg bg-orange-50 px-3 py-2">
                {stats.feedbackSummary.topicNudges.map((topic) => (
                  <p key={topic} className="text-[11px] text-orange-700">
                    You gave negative feedback on <strong>{CATEGORY_LABELS[topic] ?? topic}</strong> stories multiple times.
                    Consider disabling that tab in settings.
                  </p>
                ))}
                <Link href="/settings" className="mt-1 block text-[11px] font-medium text-orange-600 hover:underline">
                  Manage sources →
                </Link>
              </div>
            )}
          </section>

          {/* ── Top Sources ─────────────────────────────────────────────── */}
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
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">{count}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <p className="pb-2 text-center text-[10px] text-gray-300">All data computed locally · nothing leaves your server</p>
        </div>
      )}
    </div>
  )
}
