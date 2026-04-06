'use client'

import { useState, useEffect, useRef } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { UserPreferences, MoodPreset } from '@/types'
import { NEWS_SOURCES } from '@/lib/news-sources'

interface ImapStatus {
  configured: boolean
  host?: string
  user?: string
  folder?: string
  pollIntervalMins?: number
  lastPoll?: string | null
  newsletterCount?: number
}

/** IMAP polling sub-section inside the Newsletter Ingestion settings card. */
function ImapSection() {
  const [status, setStatus] = useState<ImapStatus | null>(null)
  const [fetching, setFetching] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [fetchResult, setFetchResult] = useState<string | null>(null)

  function load() {
    fetch('/api/ingest/newsletter/imap/status')
      .then((r) => r.json())
      .then((d: ImapStatus) => setStatus(d))
      .catch(() => setStatus({ configured: false }))
  }

  useEffect(() => { load() }, [])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/ingest/newsletter/imap/test', { method: 'POST' })
      const d = await r.json() as { ok: boolean; error?: string }
      setTestResult(d)
    } catch {
      setTestResult({ ok: false, error: 'Request failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleFetchNow() {
    setFetching(true)
    setFetchResult(null)
    try {
      const r = await fetch('/api/ingest/newsletter/imap', { method: 'POST' })
      const d = await r.json() as { success: boolean; ingested?: number; skipped?: number; error?: string }
      if (d.success) {
        setFetchResult(`Done — ${d.ingested} new, ${d.skipped} skipped`)
        load() // refresh last-poll timestamp
      } else {
        setFetchResult(`Error: ${d.error ?? 'unknown'}`)
      }
    } catch {
      setFetchResult('Request failed')
    } finally {
      setFetching(false)
    }
  }

  if (!status) return <p className="text-xs text-gray-400">Loading…</p>

  if (!status.configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1.5">
        <p className="font-semibold">IMAP polling — not configured</p>
        <p>Add these to your <code className="rounded bg-amber-100 px-1 font-mono">.env</code> / docker-compose and restart:</p>
        <pre className="rounded bg-amber-100 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
{`IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=you@gmail.com
IMAP_PASS=your-app-password
IMAP_FOLDER=SmartBrief
IMAP_POLL_INTERVAL_MINS=30`}
        </pre>
        <p className="text-amber-700">
          For Gmail, create a label called <strong>SmartBrief</strong> and an app-specific password
          at <em>myaccount.google.com › Security › App passwords</em>.
        </p>
      </div>
    )
  }

  const lastPollLabel = status.lastPoll
    ? new Date(status.lastPoll).toLocaleString()
    : 'Never'

  return (
    <div className="space-y-3">
      {/* Status card */}
      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-xs space-y-1">
        <p className="font-semibold text-green-800">IMAP polling active</p>
        <p className="text-green-700">{status.user} · {status.host} · folder: <strong>{status.folder}</strong></p>
        <p className="text-green-700">Interval: every {status.pollIntervalMins} min · Last polled: {lastPollLabel}</p>
        {typeof status.newsletterCount === 'number' && (
          <p className="text-green-700">{status.newsletterCount} newsletter article{status.newsletterCount === 1 ? '' : 's'} ingested</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleFetchNow}
          disabled={fetching}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {fetching ? 'Fetching…' : 'Fetch now'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      {/* Feedback */}
      {fetchResult && (
        <p className={`rounded-lg px-3 py-2 text-xs ${fetchResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {fetchResult}
        </p>
      )}
      {testResult && (
        <p className={`rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok ? 'Connection successful' : `Connection failed: ${testResult.error}`}
        </p>
      )}
    </div>
  )
}

/** Webhook sub-section — forwards emails to SmartBrief via an automation tool. */
function WebhookSection() {
  const [status, setStatus] = useState<'loading' | 'not-configured' | 'ready'>('loading')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/ingest/newsletter/status')
      .then((r) => r.json())
      .then((data: { configured: boolean; webhookUrl?: string }) => {
        if (data.configured && data.webhookUrl) {
          setWebhookUrl(data.webhookUrl)
          setStatus('ready')
        } else {
          setStatus('not-configured')
        }
      })
      .catch(() => setStatus('not-configured'))
  }, [])

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (status === 'loading') return null

  if (status === 'not-configured') {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-semibold text-gray-700 mb-1">Webhook (n8n / Zapier / Mailgun)</p>
        <p>
          Set <code className="rounded bg-gray-200 px-1 font-mono">NEWSLETTER_INGEST_SECRET</code> in your environment
          to enable a POST webhook endpoint for automation tools.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">Webhook (n8n / Zapier / Mailgun)</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-gray-100 px-3 py-2 font-mono text-[11px] text-gray-700">
          {webhookUrl}
        </code>
        <button
          onClick={copyUrl}
          className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function NewsletterIngestSection() {
  return (
    <div className="space-y-4">
      <ImapSection />
      <WebhookSection />
    </div>
  )
}

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

const SOURCE_CATEGORY_LABELS: Record<string, string> = {
  technology: '🤖 Technology',
  science: '🧪 Science & Health',
  business: '📊 Business',
  world: '🌍 World & Politics',
  positive: '✨ Bright Spots',
}

const BIAS_LABELS: Record<string, string> = {
  left: 'Left',
  'center-left': 'Center-Left',
  center: 'Center',
  'center-right': 'Center-Right',
  right: 'Right',
}

/** Two-level grouping: language → category → sources */
function getSourcesByLanguageThenCategory() {
  const result: Record<string, Record<string, typeof NEWS_SOURCES>> = { en: {}, de: {} }
  for (const source of NEWS_SOURCES) {
    const lang = source.language ?? 'en'
    if (!result[lang]) result[lang] = {}
    if (!result[lang][source.category]) result[lang][source.category] = []
    result[lang][source.category].push(source)
  }
  // Remove empty language buckets
  return Object.fromEntries(Object.entries(result).filter(([, cats]) => Object.keys(cats).length > 0))
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
  const [activeWeights, setActiveWeights] = useState<number | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  // Source list UI state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [detailSource, setDetailSource] = useState<(typeof NEWS_SOURCES)[0] | null>(null)

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState('22:00')
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00')
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushRegistering, setPushRegistering] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

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
          setPushEnabled(prefs.pushEnabled ?? false)
          setQuietHoursEnabled(prefs.quietHoursEnabled ?? false)
          setQuietHoursStart(prefs.quietHoursStart ?? '22:00')
          setQuietHoursEnd(prefs.quietHoursEnd ?? '07:00')
        }
        // Check current browser push permission status
        if (typeof window !== 'undefined' && 'Notification' in window) {
          setPushPermission(Notification.permission)
        } else {
          setPushPermission('unsupported')
        }
        const wRes = await fetch('/api/settings/personalisation')
        if (wRes.ok) {
          const wData = await wRes.json()
          setActiveWeights(wData.activeWeights ?? 0)
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
      const roundedNeutral = Math.round((neutralRatio / total) * remaining)
      setNeutralRatio(roundedNeutral)
      setNegativeRatio(remaining - roundedNeutral)
      setPositiveRatio(value)
    } else if (changed === 'neutral') {
      const total = positiveRatio + negativeRatio || 1
      const roundedPositive = Math.round((positiveRatio / total) * remaining)
      setPositiveRatio(roundedPositive)
      setNegativeRatio(remaining - roundedPositive)
      setNeutralRatio(value)
    } else {
      const total = positiveRatio + neutralRatio || 1
      const roundedPositive = Math.round((positiveRatio / total) * remaining)
      setPositiveRatio(roundedPositive)
      setNeutralRatio(remaining - roundedPositive)
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

  async function handleResetPersonalisation() {
    setIsResetting(true)
    try {
      const res = await fetch('/api/settings/personalisation', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to reset')
      setActiveWeights(0)
      setShowResetConfirm(false)
      setResetDone(true)
      setTimeout(() => setResetDone(false), 3000)
    } catch (err) {
      console.error(err)
      setError('Failed to reset personalisation')
    } finally {
      setIsResetting(false)
    }
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
        pushEnabled,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
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

  async function handlePushToggle(enable: boolean) {
    setPushRegistering(true)
    setPushError(null)
    try {
      if (enable) {
        // Request permission first
        const permission = await Notification.requestPermission()
        setPushPermission(permission)
        if (permission !== 'granted') {
          setPushError('Permission denied. Enable notifications in browser settings.')
          setPushRegistering(false)
          return
        }
        // Register service worker and subscribe
        const reg = await navigator.serviceWorker.register('/sw.js')
        const vapidRes = await fetch('/api/push/vapid-public')
        const { publicKey } = await vapidRes.json() as { publicKey: string }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        })
        setPushEnabled(true)
      } else {
        // Unsubscribe and remove from DB
        const reg = await navigator.serviceWorker.getRegistration('/sw.js')
        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            await fetch('/api/push/subscribe', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            })
            await sub.unsubscribe()
          }
        }
        setPushEnabled(false)
      }
      // Persist preference change immediately
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushEnabled: enable }),
      })
    } catch (err) {
      console.error(err)
      setPushError('Failed to update push notifications. Try again.')
    } finally {
      setPushRegistering(false)
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

  const sourcesByLanguage = getSourcesByLanguageThenCategory()

  function toggleGroupCollapsed(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
          <p className="mb-3 text-xs text-gray-500">Toggle individual sources on or off. Tap a source name for details.</p>

          {Object.entries(sourcesByLanguage).map(([lang, categoryMap]) => (
            <div key={lang} className="mb-5 last:mb-0">
              {/* Language header */}
              <div className="mb-2 flex items-center gap-2 border-b border-gray-100 pb-1.5">
                <span className="text-sm font-bold text-gray-700">
                  {lang === 'de' ? '🇩🇪 German Sources' : '🇬🇧 English Sources'}
                </span>
                <span className="text-xs text-gray-400">
                  ({Object.values(categoryMap).flat().length} sources)
                </span>
              </div>

              {/* Category groups */}
              <div className="space-y-3">
                {Object.entries(categoryMap).map(([categoryId, sources]) => {
                  const groupKey = `${lang}:${categoryId}`
                  const isCollapsed = collapsedGroups.has(groupKey)
                  const enabledCount = sources.filter((s) => isSourceEnabled(s.id)).length
                  const total = sources.length

                  return (
                    <div key={categoryId}>
                      {/* Category header row */}
                      <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50">
                        <button
                          onClick={() => toggleGroupCollapsed(groupKey)}
                          className="flex flex-1 items-center gap-2 text-left"
                          aria-expanded={!isCollapsed}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className={`h-3 w-3 flex-shrink-0 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-600">
                            {SOURCE_CATEGORY_LABELS[categoryId] ?? categoryId}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {enabledCount === total ? `${total} enabled` : `${enabledCount}/${total} enabled`}
                          </span>
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => selectAllInCategory(categoryId)}
                            className="text-[11px] text-blue-600 hover:underline"
                          >
                            All
                          </button>
                          <span className="text-[11px] text-gray-300">·</span>
                          <button
                            onClick={() => deselectAllInCategory(categoryId)}
                            className="text-[11px] text-gray-400 hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      {/* Source rows */}
                      {!isCollapsed && (
                        <div className="mt-1 space-y-0.5 pl-2">
                          {sources.map((source) => {
                            const enabled = isSourceEnabled(source.id)
                            return (
                              <div
                                key={source.id}
                                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 ${!enabled ? 'opacity-50' : ''}`}
                              >
                                {/* Left: emoji + name (tappable for detail) + language badge + bias badge */}
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <span className="text-base leading-none">{source.logoEmoji}</span>
                                  <button
                                    onClick={() => setDetailSource(source)}
                                    className="truncate text-sm font-medium text-gray-800 hover:underline focus:outline-none"
                                    aria-label={`${source.name} — tap for details`}
                                  >
                                    {source.name}
                                  </button>
                                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${source.language === 'de' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {source.language.toUpperCase()}
                                  </span>
                                  <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                                    {BIAS_LABELS[source.bias] ?? source.bias}
                                  </span>
                                </div>
                                {/* Toggle */}
                                <button
                                  onClick={() => toggleSource(source.id)}
                                  className="ml-3 flex-shrink-0"
                                  aria-label={`${enabled ? 'Disable' : 'Enable'} ${source.name}`}
                                  aria-pressed={enabled}
                                >
                                  <div className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                  </div>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Source detail popover */}
        {detailSource && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
            onClick={() => setDetailSource(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl">{detailSource.logoEmoji}</span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{detailSource.name}</h3>
                  <p className="text-xs text-gray-500">{BIAS_LABELS[detailSource.bias] ?? detailSource.bias} · {detailSource.language.toUpperCase()} · {SOURCE_CATEGORY_LABELS[detailSource.category] ?? detailSource.category}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">RSS Feed</p>
                  <p className="mt-0.5 break-all text-xs text-gray-600 font-mono">{detailSource.url}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailSource(null)}
                className="mt-4 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

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

        {/* Personalisation */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Personalisation</h2>
          <p className="mb-3 text-xs text-gray-500">
            SmartBrief learns from your feedback to surface sources you prefer
          </p>
          <p className="mb-4 text-sm text-gray-600">
            {activeWeights === null
              ? 'Loading…'
              : activeWeights === 0
              ? 'No personalisation active — give feedback on articles to get started.'
              : `Personalisation active — tracking ${activeWeights} source ${activeWeights === 1 ? 'preference' : 'preferences'}.`}
          </p>
          {resetDone && (
            <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
              Personalisation reset. Your next briefing starts fresh.
            </p>
          )}
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={activeWeights === 0}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset personalisation
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-3 text-xs text-red-700">
                This will delete all learned source preferences. Your feedback history is kept but won&apos;t be re-applied.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResetPersonalisation}
                  disabled={isResetting}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {isResetting ? 'Resetting…' : 'Yes, reset'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Newsletter Ingestion */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Newsletter Ingestion</h2>
          <p className="mb-3 text-xs text-gray-500">
            Forward newsletters to SmartBrief via a webhook. Set{' '}
            <code className="rounded bg-gray-100 px-1 font-mono text-[11px] text-gray-700">NEWSLETTER_INGEST_SECRET</code>{' '}
            in your environment to enable this.
          </p>
          <NewsletterIngestSection />
        </section>

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

        {/* Push Notifications */}
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Push Notifications</h2>
          <p className="mb-3 text-xs text-gray-500">
            Get alerted for critical breaking news only — verified across 3+ sources. Fires rarely by design.
          </p>
          {pushPermission === 'unsupported' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Push notifications are not supported in this browser. Install SmartBrief to your home screen on iOS 16.4+ or use a modern desktop browser.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Master toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Enable push notifications</p>
                  {pushPermission === 'denied' && (
                    <p className="text-xs text-red-500 mt-0.5">
                      Permission denied — re-enable in browser settings.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handlePushToggle(!pushEnabled)}
                  disabled={pushRegistering || pushPermission === 'denied'}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                    pushEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={pushEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      pushEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {pushError && (
                <p className="text-xs text-red-500">{pushError}</p>
              )}

              {/* Quiet hours — only shown when push is enabled */}
              {pushEnabled && (
                <div className="rounded-lg bg-gray-50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Quiet hours</p>
                    <button
                      onClick={() => setQuietHoursEnabled((v) => !v)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        quietHoursEnabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={quietHoursEnabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                          quietHoursEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {quietHoursEnabled && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <label className="text-xs text-gray-500 w-10">From</label>
                      <input
                        type="time"
                        value={quietHoursStart}
                        onChange={(e) => setQuietHoursStart(e.target.value)}
                        className="rounded border border-gray-200 px-2 py-1 text-xs"
                      />
                      <label className="text-xs text-gray-500 w-6">to</label>
                      <input
                        type="time"
                        value={quietHoursEnd}
                        onChange={(e) => setQuietHoursEnd(e.target.value)}
                        className="rounded border border-gray-200 px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
