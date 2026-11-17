'use client'

import { useRef, useState } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import type { ImportCounts, MergeCount } from '@/lib/backup'

const BUTTON_CLASS =
  'flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-card py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-well/60 disabled:cursor-default disabled:opacity-60'

function changed(count: MergeCount): number {
  return count.created + count.updated
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function summarize(counts: ImportCounts): string {
  const parts = [
    counts.preferences.created + counts.preferences.updated > 0 ? 'preferences' : null,
    plural(changed(counts.sourceWeights) + changed(counts.topicWeights), 'weight', 'weights'),
    plural(changed(counts.articles), 'article', 'articles'),
    plural(changed(counts.topStories), 'story', 'stories'),
  ].filter(Boolean)
  const unchanged = counts.articles.unchanged + counts.topStories.unchanged
  return `Imported ${parts.join(', ')}${unchanged > 0 ? ` (${unchanged} already present)` : ''}.`
}

export default function BackupSection({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset so picking the same file again fires onChange.
    e.target.value = ''
    if (!file) return

    setImporting(true)
    setResult(null)
    try {
      const body = await file.text()
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const data = (await res.json().catch(() => null)) as
        | { success: true; counts: ImportCounts }
        | { success: false; error?: string }
        | null
      if (res.ok && data?.success) {
        setResult({ ok: true, message: summarize(data.counts) })
        onImported?.()
      } else {
        setResult({ ok: false, message: (data && !data.success && data.error) || `Import failed (${res.status})` })
      }
    } catch {
      setResult({ ok: false, message: 'Import failed: could not read or send the file' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <h2 className="headline mb-1 text-lg font-semibold">Backup</h2>
      <p className="mb-3 text-xs text-ink-muted">
        Export preferences, learned weights and saved items as a file. Import merges a file into this
        device and never deletes anything. Push and newsletter credentials are not included.
      </p>
      <div className="flex gap-2">
        <a href="/api/backup/export" download className={BUTTON_CLASS}>
          Export
        </a>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className={BUTTON_CLASS}
        >
          {importing ? (
            <>
              <LoadingSpinner size="sm" />
              Importing…
            </>
          ) : (
            'Import'
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose backup file to import"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      <div aria-live="polite">
        {result && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              result.ok
                ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
            }`}
          >
            {result.message}
          </p>
        )}
      </div>
    </section>
  )
}
