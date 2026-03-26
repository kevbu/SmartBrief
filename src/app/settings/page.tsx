'use client'

import { useState, useEffect } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { UserPreferences } from '@/types'

const REFRESH_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
]

const CATEGORY_OPTIONS = [
  { id: 'technology', label: 'Tech & AI', emoji: '🤖' },
  { id: 'science', label: 'Science & Health', emoji: '🧪' },
  { id: 'business', label: 'Business', emoji: '📊' },
  { id: 'world', label: 'World', emoji: '🌍' },
  { id: 'positive', label: 'Bright Spots', emoji: '✨' },
]

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Local state for sliders
  const [positiveRatio, setPositiveRatio] = useState(40)
  const [neutralRatio, setNeutralRatio] = useState(40)
  const [negativeRatio, setNegativeRatio] = useState(20)
  const [enabledCategories, setEnabledCategories] = useState<string[]>([
    'technology',
    'science',
    'business',
    'world',
    'positive',
  ])
  const [refreshInterval, setRefreshInterval] = useState(60)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/preferences')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (data.preferences) {
          const prefs: UserPreferences = data.preferences
          setPreferences(prefs)
          setPositiveRatio(Math.round(prefs.positiveRatio * 100))
          setNeutralRatio(Math.round(prefs.neutralRatio * 100))
          setNegativeRatio(Math.round(prefs.negativeRatio * 100))
          setEnabledCategories(prefs.enabledCategories)
          setRefreshInterval(prefs.refreshIntervalMins)
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load preferences')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  function adjustRatios(
    changed: 'positive' | 'neutral' | 'negative',
    value: number
  ) {
    const remaining = 100 - value
    if (changed === 'positive') {
      const total = neutralRatio + negativeRatio
      if (total === 0) {
        setNeutralRatio(Math.round(remaining / 2))
        setNegativeRatio(Math.round(remaining / 2))
      } else {
        setNeutralRatio(Math.round((neutralRatio / total) * remaining))
        setNegativeRatio(Math.round((negativeRatio / total) * remaining))
      }
      setPositiveRatio(value)
    } else if (changed === 'neutral') {
      const total = positiveRatio + negativeRatio
      if (total === 0) {
        setPositiveRatio(Math.round(remaining / 2))
        setNegativeRatio(Math.round(remaining / 2))
      } else {
        setPositiveRatio(Math.round((positiveRatio / total) * remaining))
        setNegativeRatio(Math.round((negativeRatio / total) * remaining))
      }
      setNeutralRatio(value)
    } else {
      const total = positiveRatio + neutralRatio
      if (total === 0) {
        setPositiveRatio(Math.round(remaining / 2))
        setNeutralRatio(Math.round(remaining / 2))
      } else {
        setPositiveRatio(Math.round((positiveRatio / total) * remaining))
        setNeutralRatio(Math.round((neutralRatio / total) * remaining))
      }
      setNegativeRatio(value)
    }
  }

  function toggleCategory(catId: string) {
    setEnabledCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
    )
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const sum = positiveRatio + neutralRatio + negativeRatio
      const payload: Partial<UserPreferences> = {
        positiveRatio: positiveRatio / sum,
        neutralRatio: neutralRatio / sum,
        negativeRatio: negativeRatio / sum,
        enabledCategories,
        refreshIntervalMins: refreshInterval,
      }

      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      if (data.preferences) {
        setPreferences(data.preferences)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      setError('Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !preferences) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-xs text-gray-400">Customize your news experience</p>
      </header>

      <div className="px-4 py-4 space-y-6">
        {/* Balance Settings */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            Feed Balance
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Control the mix of positive, neutral, and in-focus news
          </p>

          <div className="space-y-4">
            {/* Positive */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Uplifting
                </span>
                <span className="font-semibold text-emerald-700">
                  {positiveRatio}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={positiveRatio}
                onChange={(e) =>
                  adjustRatios('positive', parseInt(e.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-emerald-500"
              />
            </div>

            {/* Neutral */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                  Neutral
                </span>
                <span className="font-semibold text-gray-600">
                  {neutralRatio}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={neutralRatio}
                onChange={(e) =>
                  adjustRatios('neutral', parseInt(e.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-gray-500"
              />
            </div>

            {/* Negative */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-amber-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  In Focus
                </span>
                <span className="font-semibold text-amber-700">
                  {negativeRatio}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={negativeRatio}
                onChange={(e) =>
                  adjustRatios('negative', parseInt(e.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-amber-400"
              />
            </div>
          </div>

          {/* Preview bar */}
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${positiveRatio}%` }}
            />
            <div
              className="bg-gray-300 transition-all"
              style={{ width: `${neutralRatio}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{
                width: `${100 - positiveRatio - neutralRatio}%`,
              }}
            />
          </div>
        </section>

        {/* Topic Toggles */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            News Topics
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Choose which categories to include in your feed
          </p>

          <div className="space-y-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const isEnabled = enabledCategories.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </span>
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Refresh Interval */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            Auto-Refresh
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            How often to automatically fetch new articles
          </p>

          <div className="grid grid-cols-2 gap-2">
            {REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRefreshInterval(opt.value)}
                className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  refreshInterval === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-gray-900">
            About AI Features
          </h2>
          <div className="space-y-2 text-xs text-gray-500 leading-relaxed">
            <p>
              <strong className="text-gray-700">Sentiment Analysis</strong> –
              Claude Haiku reads each article&apos;s headline and description to
              determine whether it&apos;s positive, neutral, or concerning news.
            </p>
            <p>
              <strong className="text-gray-700">Top Stories</strong> – Claude
              Sonnet clusters related articles from multiple sources and writes
              balanced, Perplexity-style briefings so you understand the full
              picture.
            </p>
            <p>
              <strong className="text-gray-700">Balance Filter</strong> –
              Ensures your feed maintains the ratios you set above, so you stay
              informed without doom-scrolling.
            </p>
            <p className="text-gray-400">
              SmartBrief v0.1.0 · Powered by Anthropic Claude
            </p>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) : saved ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z"
                  clipRule="evenodd"
                />
              </svg>
              Saved!
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  )
}
