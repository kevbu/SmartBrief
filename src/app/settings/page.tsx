'use client'

import { useState, useEffect, useRef } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { UserPreferences, MoodPreset } from '@/types'
import { NEWS_SOURCES } from '@/lib/news-sources'

const REFRESH_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
]

const CATEGORY_OPTIONS = [
  { id: 'technology', label: 'Tech & AI',         emoji: '🤖' },
  { id: 'science',    label: 'Science & Health',   emoji: '🧪' },
  { id: 'business',   label: 'Business',            emoji: '📊' },
  { id: 'world',      label: 'World',               emoji: '🌍' },
  { id: 'positive',   label: 'Bright Spots',        emoji: '✨' },
]

const MOOD_PRESETS: { value: MoodPreset; emoji: string; label: string; desc: string }[] = [
  { value: 'balanced',     emoji: '⚖️', label: 'Balanced',     desc: '40% uplifting · 40% neutral · 20% in-focus' },
  { value: 'constructive', emoji: '🌱', label: 'Constructive',  desc: '60% uplifting · 35% neutral · 5% in-focus' },
  { value: 'hard-news',    emoji: '📰', label: 'Hard News',     desc: '20% uplifting · 40% neutral · 40% in-focus' },
]

const SESSION_OPTIONS = [5, 10, 15, 20, 30]

// Group sources by category for display
const SOURCE_CATEGORY_LABELS: Record<string, string> = {
  technology: '🤖 Technology',
  science: '🧪 Science & Health',
  business: '📊 Business',
  world: '🌍 World & Politics',
  positive: '✨ Bright Spots',
}

function getSourcesByCategory() {
  const groups: Record<string, typeof NEWS_SOURCES> = {}
  for (const source of NEWS_SOURCES) {
    if (!groups[source.category]) groups[source.category] = []
    groups[source.category].push(source)
  }
  return groups
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Local state
  const [positiveRatio, setPositiveRatio] = useState(40)
  const [neutralRatio,  setNeutralRatio]  = useState(40)
  const [negativeRatio, setNegativeRatio] = useState(20)
  const [enabledCategories, setEnabledCategories] = useState<string[]>([
    'technology', 'science', 'business', 'world', 'positive',
  ])
  const [refreshInterval, setRefreshInterval] = useState(60)
  const [moodPreset,  setMoodPreset]  = useState<MoodPreset>('balanced')
  const [avoidInput,  setAvoidInput]  = useState('')
  const [sessionSize, setSessionSize] = useState(15)
  const [depthMode,   setDepthMode]   = useState<'skim' | 'deep'>('skim')
  const [hiddenSources, setHiddenSources] = useState<string[]>([])
  const [enabledSources, setEnabledSources] = useState<string[]>([])

  // Debounce timer for sources
  const sourcesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
          setMoodPreset(prefs.moodPreset ?? 'balanced')
          setAvoidInput((prefs.avoidTopics ?? []).join(', '))
          setSessionSize(prefs.sessionSize ?? 15)
          setDepthMode(prefs.depthMode ?? 'skim')
          setHiddenSources(prefs.hiddenSources ?? [])
          setEnabledSources(prefs.enabledSources ?? [])
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

  function applyMoodPreset(preset: MoodPreset) {
    setMoodPreset(preset)
    const ratios = {
      balanced:     [40, 40, 20],
      constructive: [60, 35, 5],
      'hard-news':  [20, 40, 40],
    }[preset]
    setPositiveRatio(ratios[0])
    setNeutralRatio(ratios[1])
    setNegativeRatio(ratios[2])
  }

  function adjustRatios(changed: 'positive' | 'neutral' | 'negative', value: number) {
    const remaining = 100 - value
    if (changed === 'positive') {
      const total = neutralRatio + negativeRatio || 1
      setNeutralRatio(Math.round((neutralRatio / total) * remaining))
      setNegativeRatio(Math.round((negativeRatio / total) * remaining))
      setPositiveRatio(value)
    } else if (changed === 'neutral') {
      const total = positiveRatio + negativeRatio || 1
      setPositiveRatio(Math.round((positiveRatio / total) * remaining))
      setNegativeRatio(Math.round((negativeRatio / total) * remaining))
      setNeutralRatio(value)
    } else {
      const total = positiveRatio + neutralRatio || 1
      setPositiveRatio(Math.round((positiveRatio / total) * remaining))
      setNeutralRatio(Math.round((neutralRatio / total) * remaining))
      setNegativeRatio(value)
    }
    setMoodPreset('balanced') // custom = reset preset label
  }

  function toggleCategory(catId: string) {
    setEnabledCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  function removeHiddenSource(source: string) {
    setHiddenSources((prev) => prev.filter((s) => s !== source))
  }

  function isSourceEnabled(sourceId: string) {
    // Empty enabledSources means all are enabled
    return enabledSources.length === 0 || enabledSources.includes(sourceId)
  }

  function toggleSource(sourceId: string) {
    setEnabledSources((prev) => {
      let next: string[]
      if (prev.length === 0) {
        // All currently enabled; toggling one off means all except this one
        next = NEWS_SOURCES.map((s) => s.id).filter((id) => id !== sourceId)
      } else if (prev.includes(sourceId)) {
        next = prev.filter((id) => id !== sourceId)
      } else {
        next = [...prev, sourceId]
      }
      // If all are enabled, normalize to empty array
      if (next.length === NEWS_SOURCES.length) next = []

      // Debounce save
      if (sourcesDebounceRef.current) clearTimeout(sourcesDebounceRef.current)
      sourcesDebounceRef.current = setTimeout(() => {
        fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledSources: next }),
        }).catch(console.error)
      }, 800)

      return next
    })
  }

  function selectAllInCategory(categoryId: string) {
    const categorySourceIds = NEWS_SOURCES
      .filter((s) => s.category === categoryId)
      .map((s) => s.id)

    setEnabledSources((prev) => {
      let next: string[]
      if (prev.length === 0) {
        // All enabled already, nothing to do
        next = prev
      } else {
        // Add all from this category
        const merged = new Set([...prev, ...categorySourceIds])
        next = Array.from(merged)
        if (next.length === NEWS_SOURCES.length) next = []
      }

      if (sourcesDebounceRef.current) clearTimeout(sourcesDebounceRef.current)
      sourcesDebounceRef.current = setTimeout(() => {
        fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledSources: next }),
        }).catch(console.error)
      }, 800)

      return next
    })
  }

  function deselectAllInCategory(categoryId: string) {
    const categorySourceIds = NEWS_SOURCES
      .filter((s) => s.category === categoryId)
      .map((s) => s.id)

    setEnabledSources((prev) => {
      let current = prev.length === 0
        ? NEWS_SOURCES.map((s) => s.id)
        : [...prev]
      const next = current.filter((id) => !categorySourceIds.includes(id))

      if (sourcesDebounceRef.current) clearTimeout(sourcesDebounceRef.current)
      sourcesDebounceRef.current = setTimeout(() => {
        fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledSources: next }),
        }).catch(console.error)
      }, 800)

      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const avoidTopics = avoidInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      const sum = positiveRatio + neutralRatio + negativeRatio || 100
      const payload: Partial<UserPreferences> = {
        positiveRatio: positiveRatio / sum,
        neutralRatio:  neutralRatio  / sum,
        negativeRatio: negativeRatio / sum,
        enabledCategories,
        refreshIntervalMins: refreshInterval,
        moodPreset,
        avoidTopics,
        hiddenSources,
        sessionSize,
        depthMode,
        enabledSources,
      }

      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      if (data.preferences) setPreferences(data.preferences)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      setError('Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    window.location.href = '/login'
  }

  if (isLoading || !preferences) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  const sourcesByCategory = getSourcesByCategory()

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-xs text-gray-400">Customize your news experience</p>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* Mood Preset */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Mood Preset</h2>
          <p className="mb-3 text-xs text-gray-500">
            Quick settings to match your current needs
          </p>
          <div className="space-y-2">
            {MOOD_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => applyMoodPreset(preset.value)}
                className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                  moodPreset === preset.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-transparent bg-gray-50 hover:border-gray-200'
                }`}
              >
                <span className="mt-0.5 text-xl">{preset.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{preset.label}</p>
                  <p className="text-xs text-gray-500">{preset.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Balance Sliders */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Fine-tune Balance</h2>
          <p className="mb-4 text-xs text-gray-500">
            Manually adjust your feed mix
          </p>
          <div className="space-y-4">
            {[
              { key: 'positive' as const, label: 'Uplifting',  value: positiveRatio, color: 'emerald', accent: 'accent-emerald-500', max: 80 },
              { key: 'neutral'  as const, label: 'Neutral',    value: neutralRatio,  color: 'gray',    accent: 'accent-gray-500',    max: 80 },
              { key: 'negative' as const, label: 'In Focus',   value: negativeRatio, color: 'amber',   accent: 'accent-amber-400',   max: 60 },
            ].map(({ key, label, value, accent, max }) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{label}</span>
                  <span className="font-semibold text-gray-600">{value}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={max}
                  value={value}
                  onChange={(e) => adjustRatios(key, parseInt(e.target.value))}
                  className={`h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 ${accent}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            <div className="bg-emerald-500 transition-all" style={{ width: `${positiveRatio}%` }} />
            <div className="bg-gray-300 transition-all"   style={{ width: `${neutralRatio}%` }} />
            <div className="bg-amber-400 transition-all"  style={{ width: `${100 - positiveRatio - neutralRatio}%` }} />
          </div>
        </section>

        {/* Topics */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">News Topics</h2>
          <p className="mb-3 text-xs text-gray-500">Choose which categories to follow</p>
          <div className="space-y-1">
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
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${isEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* News Sources */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">News Sources</h2>
          <p className="mb-3 text-xs text-gray-500">Toggle individual sources on or off</p>
          <div className="space-y-4">
            {Object.entries(sourcesByCategory).map(([categoryId, sources]) => {
              const allEnabled = sources.every((s) => isSourceEnabled(s.id))
              return (
                <div key={categoryId}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {SOURCE_CATEGORY_LABELS[categoryId] ?? categoryId}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectAllInCategory(categoryId)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-xs text-gray-300">·</span>
                      <button
                        onClick={() => deselectAllInCategory(categoryId)}
                        className="text-xs text-gray-400 hover:underline"
                      >
                        Deselect all
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {sources.map((source) => {
                      const enabled = isSourceEnabled(source.id)
                      return (
                        <button
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                        >
                          <span className="flex items-center gap-2 text-sm text-gray-700">
                            <span>{source.logoEmoji}</span>
                            <span className="font-medium">{source.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                source.language === 'de'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {source.language.toUpperCase()}
                            </span>
                          </span>
                          <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Avoid Topics */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Avoid Topics</h2>
          <p className="mb-3 text-xs text-gray-500">
            Comma-separated keywords to filter out (e.g. war, celebrity, crypto)
          </p>
          <input
            type="text"
            value={avoidInput}
            onChange={(e) => setAvoidInput(e.target.value)}
            placeholder="war, celebrity gossip, crypto..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </section>

        {/* Hidden Sources */}
        {hiddenSources.length > 0 && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Hidden Sources</h2>
            <p className="mb-3 text-xs text-gray-500">
              Sources you&apos;ve hidden via article feedback
            </p>
            <div className="flex flex-wrap gap-2">
              {hiddenSources.map((source) => (
                <span key={source} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {source}
                  <button
                    onClick={() => removeHiddenSource(source)}
                    className="ml-0.5 text-gray-400 hover:text-gray-600"
                    aria-label={`Unhide ${source}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Session & Reading */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Reading Session</h2>
          <p className="mb-3 text-xs text-gray-500">
            Control how many stories appear in each briefing session
          </p>
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-gray-600">Stories per session</p>
            <div className="flex gap-2">
              {SESSION_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setSessionSize(n)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    sessionSize === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">Default reading depth</p>
            <div className="flex gap-2">
              {(['skim', 'deep'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDepthMode(mode)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    depthMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mode === 'skim' ? '⚡ Skim' : '📖 Deep dive'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Auto-Refresh */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Auto-Refresh</h2>
          <p className="mb-3 text-xs text-gray-500">How often to fetch fresh articles</p>
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
          <h2 className="mb-2 text-base font-semibold text-gray-900">About SmartBrief</h2>
          <div className="space-y-2 text-xs leading-relaxed text-gray-500">
            <p>
              <strong className="text-gray-700">Sentiment Analysis</strong> — Claude Haiku reads each article to determine its emotional tone. Positive articles are discoveries, achievements, and solutions. Neutral is factual reporting. &ldquo;In Focus&rdquo; are challenging or concerning topics.
            </p>
            <p>
              <strong className="text-gray-700">Multi-source Briefs</strong> — Claude Sonnet clusters related articles from different outlets and writes balanced summaries, like Perplexity — but always with a constructive framing.
            </p>
            <p>
              <strong className="text-gray-700">Session Mode</strong> — Your feed is a finite briefing, not an infinite scroll. When you&apos;ve read your session, you&apos;re done for now. This is intentional.
            </p>
            <p>
              <strong className="text-gray-700">Privacy</strong> — All data stays local on your device (SQLite). No tracking, no ads, no engagement optimization. Your mental health is the metric.
            </p>
            <p className="text-gray-400">SmartBrief v0.1.0 · Powered by Anthropic Claude</p>
          </div>
        </section>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {isSaving ? (
            <><LoadingSpinner size="sm" />Saving...</>
          ) : saved ? (
            '✓ Saved!'
          ) : (
            'Save Preferences'
          )}
        </button>

        {/* Sign out */}
        <div className="pt-2">
          <div className="mb-4 border-t border-gray-100" />
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
