import { describe, expect, it } from 'vitest'
import { formatLastRefreshed, formatToday, freshnessOf, STALE_AFTER_MS } from './freshness'

const now = new Date('2026-11-19T09:30:00')

describe('formatToday', () => {
  it('formats the passed-in date, not the module load time', () => {
    expect(formatToday(now)).toBe('Thursday 19 November')
    expect(formatToday(new Date('2026-11-18T23:59:00'))).toBe('Wednesday 18 November')
  })
})

describe('formatLastRefreshed', () => {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR

  it('handles missing or unparseable input', () => {
    expect(formatLastRefreshed(null, now)).toBe('Never synced')
    expect(formatLastRefreshed('not a date', now)).toBe('Never synced')
  })

  it('counts minutes and hours', () => {
    expect(formatLastRefreshed(ago(20_000), now)).toBe('Updated just now')
    expect(formatLastRefreshed(ago(5 * MIN), now)).toBe('Updated 5m ago')
    expect(formatLastRefreshed(ago(8 * HOUR + 10 * MIN), now)).toBe('Updated 8h ago')
  })

  it('reports real ages past one day instead of a flat "yesterday"', () => {
    expect(formatLastRefreshed(ago(DAY + HOUR), now)).toBe('Updated yesterday')
    expect(formatLastRefreshed(ago(2 * DAY), now)).toBe('Updated 2d ago')
    expect(formatLastRefreshed(ago(5 * DAY + 3 * HOUR), now)).toBe('Updated 5d ago')
  })

  it('advances when only `now` changes (the frozen-header bug)', () => {
    const refreshed = new Date('2026-11-18T09:00:00').toISOString()
    const renderedYesterday = new Date('2026-11-18T17:00:00')
    expect(formatLastRefreshed(refreshed, renderedYesterday)).toBe('Updated 8h ago')
    expect(formatLastRefreshed(refreshed, new Date('2026-11-19T07:00:00'))).toBe('Updated 22h ago')
    expect(formatLastRefreshed(refreshed, now)).toBe('Updated yesterday')
  })
})

describe('freshnessOf', () => {
  it('is never without a timestamp', () => {
    expect(freshnessOf(null, now)).toBe('never')
    expect(freshnessOf('garbage', now)).toBe('never')
  })

  it('flips to stale only past the threshold', () => {
    const at = (ms: number) => new Date(now.getTime() - ms).toISOString()
    expect(freshnessOf(at(STALE_AFTER_MS), now)).toBe('fresh')
    expect(freshnessOf(at(STALE_AFTER_MS + 60_000), now)).toBe('stale')
  })
})
