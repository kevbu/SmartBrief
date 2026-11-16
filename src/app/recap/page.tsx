'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import SourceMark from '@/components/SourceMark'
import PageHeader, { EmptyState, EmptyIcons } from '@/components/PageHeader'
import CategoryIcon, { CATEGORY_LABELS } from '@/components/CategoryIcon'
import type { RecapStats, UserPreferences } from '@/types'

const BIAS_DISPLAY: Record<string, { label: string; short: string; color: string }> = {
  'left':         { label: 'Left',         short: 'L',  color: 'bg-blue-600 dark:bg-blue-400' },
  'center-left':  { label: 'Center-Left',  short: 'CL', color: 'bg-sky-500 dark:bg-sky-400' },
  'center':       { label: 'Center',       short: 'C',  color: 'bg-ink-muted' },
  'center-right': { label: 'Center-Right', short: 'CR', color: 'bg-orange-500 dark:bg-orange-400' },
  'right':        { label: 'Right',        short: 'R',  color: 'bg-red-600 dark:bg-red-400' },
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
        <PageHeader title="This Week" />
        <EmptyState icon={EmptyIcons.chart} title="Almost there">
          Read for a few more days to unlock your weekly recap.
          You&apos;ve read on {stats.daysActive} day{stats.daysActive === 1 ? '' : 's'} so far. Come back after day 3.
        </EmptyState>
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
      <PageHeader title="This Week" subtitle="Your reading habits at a glance · all data stays local" />

      {/* Period selector */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 rounded-xl bg-well p-1" role="group" aria-label="Period">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              aria-pressed={period === opt.value}
              className={`min-h-[36px] flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-medium transition-colors duration-200 ${
                period === opt.value
                  ? 'bg-raised text-ink shadow-card'
                  : 'text-ink-muted hover:text-ink'
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
        <EmptyState icon={EmptyIcons.newspaper} title="No briefings this week">
          Come back after your next read to see your news-diet summary.
        </EmptyState>
      ) : (
        <div className="space-y-3 px-4 py-4">

          {/* ── 5.1 Overview Bar ────────────────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="grid grid-cols-3 divide-x divide-line text-center">
              <div>
                <p className="headline text-[32px] font-semibold leading-none tabular-nums">{stats.totalRead}</p>
                <p className="mt-1.5 text-[11px] text-ink-muted">stories read</p>
              </div>
              <div>
                <p className="headline text-[32px] font-semibold leading-none tabular-nums">{stats.daysActive}</p>
                <p className="mt-1.5 text-[11px] text-ink-muted">of {period} days active</p>
              </div>
              <div>
                <p className="headline text-[32px] font-semibold leading-none tabular-nums">
                  {stats.daysActive > 0 ? Math.round(stats.totalRead / stats.daysActive) : '—'}
                </p>
                <p className="mt-1.5 text-[11px] text-ink-muted">avg per day</p>
              </div>
            </div>
          </section>

          {/* ── 5.2 Topic Mix ───────────────────────────────────────────── */}
          {Object.keys(stats.topicMix).length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
              <h3 className="eyebrow mb-3 text-ink-muted">Topics Read</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.topicMix)
                  .sort(([, a], [, b]) => b - a)
                  .map(([topic, count]) => {
                    const p = pct(count, topicTotal)
                    return (
                      <Link
                        key={topic}
                        href={`/?category=${topic}`}
                        className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-well/60 py-1.5 pl-2.5 pr-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                      >
                        <CategoryIcon category={topic} />
                        <span>{CATEGORY_LABELS[topic] ?? topic}</span>
                        <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink">
                          {p}%
                        </span>
                      </Link>
                    )
                  })}
              </div>
              {/* Proportional bar */}
              <div className="mt-3 flex h-2 gap-0.5">
                {Object.entries(stats.topicMix)
                  .sort(([, a], [, b]) => b - a)
                  .map(([topic, count], i) => {
                    const p = pct(count, topicTotal)
                    const colors = ['bg-accent', 'bg-accent/70', 'bg-accent/45', 'bg-accent/25', 'bg-line-strong']
                    return (
                      <div
                        key={topic}
                        className={`${colors[i % colors.length]} rounded-full`}
                        style={{ width: `${p}%` }}
                        title={`${CATEGORY_LABELS[topic] ?? topic}: ${p}%`}
                      />
                    )
                  })}
              </div>
            </section>
          )}

          {/* ── 5.3 Sentiment Distribution ──────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <h3 className="eyebrow mb-3 text-ink-muted">Sentiment Distribution</h3>

            {/* Stacked bar: actual */}
            <div className="mb-2 flex h-2.5 gap-0.5">
              <div className="rounded-full bg-positive transition-all" style={{ width: `${pct(stats.sentimentMix.positive, sentimentTotal)}%` }} />
              <div className="rounded-full bg-line-strong transition-all" style={{ width: `${pct(stats.sentimentMix.neutral, sentimentTotal)}%` }} />
              <div className="rounded-full bg-negative transition-all" style={{ width: `${pct(stats.sentimentMix.negative, sentimentTotal)}%` }} />
            </div>

            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" /><b className="tabular-nums text-ink">{pct(stats.sentimentMix.positive, sentimentTotal)}%</b> uplifting</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-line-strong" /><b className="tabular-nums text-ink">{pct(stats.sentimentMix.neutral, sentimentTotal)}%</b> neutral</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-negative" /><b className="tabular-nums text-ink">{pct(stats.sentimentMix.negative, sentimentTotal)}%</b> in focus</span>
            </div>

            {/* Target comparison */}
            {prefs && (
              <div className="rounded-xl bg-well/60 px-3 py-2 text-[11px] text-ink-muted">
                <span className="font-medium text-ink-soft">Your {prefs.moodPreset} target: </span>
                <span className="tabular-nums">{Math.round(prefs.positiveRatio * 100)}% uplifting · {Math.round(prefs.neutralRatio * 100)}% neutral · {Math.round(prefs.negativeRatio * 100)}% in focus</span>
              </div>
            )}

            {/* Nudge */}
            {nudge ? (
              <div className="mt-3 rounded-xl bg-negative-soft px-3 py-2">
                <p className="text-[11px] text-negative-ink">{nudge}</p>
                <Link href="/settings" className="mt-1 block text-[11px] font-semibold text-negative-ink hover:underline">
                  Adjust mood preset →
                </Link>
              </div>
            ) : null}
          </section>

          {/* ── 5.4 Bias Spread ─────────────────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <h3 className="eyebrow mb-1 text-ink-muted">Bias Spread</h3>
            <p className="mb-3 text-[11px] text-ink-muted">Source political positioning of stories you read — for information only</p>

            {/* Stacked bar */}
            <div className="mb-3 flex h-2.5 gap-0.5">
              {Object.entries(BIAS_DISPLAY).map(([key, { color }]) => {
                const count = stats.biasMix[key] ?? 0
                const p = pct(count, biasTotal)
                return p > 0 ? (
                  <div key={key} className={`${color} rounded-full transition-all`} style={{ width: `${p}%` }} title={`${BIAS_DISPLAY[key].label}: ${p}%`} />
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
                    <div className={`mx-auto h-2 w-2 rounded-full ${count === 0 ? 'bg-well-strong' : color}`} />
                    <p className={`text-[10px] font-medium ${count === 0 ? 'text-ink-faint' : 'text-ink-soft'}`}>{short}</p>
                    <p className={`text-[10px] ${count === 0 ? 'text-ink-faint' : 'text-ink-muted'}`}>{p}%</p>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 text-center text-[10px] text-ink-faint">L · CL · C · CR · R</div>
          </section>

          {/* ── 5.5 Feedback Summary ────────────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <h3 className="eyebrow mb-3 text-ink-muted">Feedback Given</h3>

            {stats.feedbackSummary.moreLikeThis === 0 &&
             stats.feedbackSummary.lessLikeThis === 0 &&
             stats.feedbackSummary.hiddenSourceCount === 0 ? (
              <p className="text-[11px] text-ink-muted">
                No feedback given this week. Use the ··· menu on any card to teach SmartBrief your preferences.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-soft"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-muted" aria-hidden="true"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>More like this</span>
                  <span className="font-semibold tabular-nums text-ink">{stats.feedbackSummary.moreLikeThis}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-soft"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-muted" aria-hidden="true"><path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" /></svg>Less like this</span>
                  <span className="font-semibold tabular-nums text-ink">{stats.feedbackSummary.lessLikeThis}</span>
                </div>
                {stats.feedbackSummary.hiddenSourceCount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-soft"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-ink-muted" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>Hidden sources</span>
                    <span className="font-semibold tabular-nums text-ink">{stats.feedbackSummary.hiddenSourceCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* Topic nudge(s) */}
            {stats.feedbackSummary.topicNudges.length > 0 && (
              <div className="mt-3 rounded-xl bg-negative-soft px-3 py-2">
                {stats.feedbackSummary.topicNudges.map((topic) => (
                  <p key={topic} className="text-[11px] text-negative-ink">
                    You gave negative feedback on <strong>{CATEGORY_LABELS[topic] ?? topic}</strong> stories multiple times.
                    Consider disabling that tab in settings.
                  </p>
                ))}
                <Link href="/settings" className="mt-1 block text-[11px] font-semibold text-negative-ink hover:underline">
                  Manage sources →
                </Link>
              </div>
            )}
          </section>

          {/* ── Top Sources ─────────────────────────────────────────────── */}
          {Object.keys(stats.sourceMix).length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
              <h3 className="eyebrow mb-3 text-ink-muted">Top Sources</h3>
              <div className="space-y-2">
                {Object.entries(stats.sourceMix)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-ink-soft"><SourceMark source={source} />{source}</span>
                      <span className="rounded-full bg-well px-2 py-0.5 tabular-nums text-ink-muted">{count}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <p className="pb-2 text-center text-[10px] text-ink-faint">All data computed locally · nothing leaves your server</p>
        </div>
      )}
    </div>
  )
}
