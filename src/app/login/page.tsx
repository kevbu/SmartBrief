'use client'

import { useState } from 'react'
import { BrandMark } from '@/components/Header'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        window.location.href = '/'
      } else {
        setError('Incorrect password. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-lift">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandMark className="mb-4 h-11 w-11 !text-[26px]" />
          <h1 className="headline text-[28px] font-semibold leading-none">SmartBrief</h1>
          <p className="mt-2 text-sm text-ink-muted">Your personal news briefing</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-ink-soft"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-base text-ink placeholder-ink-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 sm:text-sm"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-full bg-ink py-3 text-sm font-semibold text-paper transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
