import {
  FAILURE_BACKOFF_MS,
  MIN_INTERVAL_MINS,
  clampIntervalMins,
  isBackoffActive,
  isRefreshDue,
  isSchedulerEnabled,
  mostRecentDailySlot,
  nextDailyTimeInput,
  parseDailyTime,
  parseRefreshMode,
  validateRefreshPrefsInput,
} from './refresh-schedule'

const MIN = 60 * 1000

// Local-time constructor, so the tests pass in any TZ.
function at(day: number, hours: number, minutes: number): Date {
  return new Date(2026, 10, day, hours, minutes, 0, 0)
}

const TODAY = 17
const YESTERDAY = 16

describe('parseRefreshMode', () => {
  it('keeps valid modes', () => {
    expect(parseRefreshMode('manual')).toBe('manual')
    expect(parseRefreshMode('interval')).toBe('interval')
    expect(parseRefreshMode('daily')).toBe('daily')
  })

  it('treats unknown values as manual', () => {
    expect(parseRefreshMode('bogus')).toBe('manual')
    expect(parseRefreshMode('hourly')).toBe('manual')
    expect(parseRefreshMode(undefined)).toBe('manual')
    expect(parseRefreshMode(null)).toBe('manual')
    expect(parseRefreshMode(42)).toBe('manual')
  })
})

describe('parseDailyTime', () => {
  it('parses valid HH:MM', () => {
    expect(parseDailyTime('07:00')).toEqual({ hours: 7, minutes: 0 })
    expect(parseDailyTime('00:00')).toEqual({ hours: 0, minutes: 0 })
    expect(parseDailyTime('23:59')).toEqual({ hours: 23, minutes: 59 })
  })

  it.each(['7:00', '24:00', '07:60', '', undefined, null, '07:00:00', ' 07:00', 'ab:cd'])(
    'rejects %p',
    (raw) => {
      expect(parseDailyTime(raw)).toBeNull()
    }
  )
})

describe('mostRecentDailySlot', () => {
  it('returns today when the time has passed', () => {
    expect(mostRecentDailySlot(at(TODAY, 8, 0), { hours: 7, minutes: 0 })).toEqual(at(TODAY, 7, 0))
  })

  it('returns yesterday when the time is still ahead', () => {
    expect(mostRecentDailySlot(at(TODAY, 6, 59), { hours: 7, minutes: 0 })).toEqual(
      at(YESTERDAY, 7, 0)
    )
  })

  it('returns now when now is exactly the slot (midnight)', () => {
    expect(mostRecentDailySlot(at(TODAY, 0, 0), { hours: 0, minutes: 0 })).toEqual(at(TODAY, 0, 0))
  })
})

describe('isRefreshDue', () => {
  const base = { intervalMins: 60, dailyTime: '07:00' }

  describe('manual', () => {
    it('is never due', () => {
      expect(isRefreshDue({ ...base, mode: 'manual', lastRefreshed: null, now: at(TODAY, 7, 0) })).toBe(
        false
      )
      expect(
        isRefreshDue({
          ...base,
          mode: 'manual',
          lastRefreshed: at(TODAY - 10, 7, 0),
          now: at(TODAY, 7, 0),
        })
      ).toBe(false)
    })
  })

  describe('interval', () => {
    const now = at(TODAY, 12, 0)

    it('is due when never refreshed', () => {
      expect(isRefreshDue({ ...base, mode: 'interval', lastRefreshed: null, now })).toBe(true)
    })

    it('is not due 59 minutes after the last refresh', () => {
      expect(
        isRefreshDue({ ...base, mode: 'interval', lastRefreshed: new Date(now.getTime() - 59 * MIN), now })
      ).toBe(false)
    })

    it('is due 60 minutes after the last refresh', () => {
      expect(
        isRefreshDue({ ...base, mode: 'interval', lastRefreshed: new Date(now.getTime() - 60 * MIN), now })
      ).toBe(true)
    })

    it(`clamps intervals below ${MIN_INTERVAL_MINS} minutes`, () => {
      const input = { ...base, mode: 'interval' as const, intervalMins: 5, now }
      expect(isRefreshDue({ ...input, lastRefreshed: new Date(now.getTime() - 10 * MIN) })).toBe(false)
      expect(isRefreshDue({ ...input, lastRefreshed: new Date(now.getTime() - 14 * MIN) })).toBe(false)
      expect(isRefreshDue({ ...input, lastRefreshed: new Date(now.getTime() - 15 * MIN) })).toBe(true)
    })
  })

  describe('daily 07:00', () => {
    const daily = { ...base, mode: 'daily' as const }

    it('is not due at 06:59 after yesterday\'s refresh at 07:01', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: at(YESTERDAY, 7, 1), now: at(TODAY, 6, 59) })).toBe(
        false
      )
    })

    it('is due at 07:00 after yesterday\'s refresh at 07:01', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: at(YESTERDAY, 7, 1), now: at(TODAY, 7, 0) })).toBe(
        true
      )
    })

    it('is not due again at 07:30 after a refresh at 07:05 today', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: at(TODAY, 7, 5), now: at(TODAY, 7, 30) })).toBe(false)
    })

    it('catches up at 14:00 after sleep when the last refresh was yesterday', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: at(YESTERDAY, 7, 0), now: at(TODAY, 14, 0) })).toBe(
        true
      )
    })

    it('is due at 07:00 after a manual refresh at 06:50 today', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: at(TODAY, 6, 50), now: at(TODAY, 7, 0) })).toBe(true)
    })

    it('is due when never refreshed', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: null, now: at(TODAY, 6, 0) })).toBe(true)
    })

    it('treats a manual refresh after the slot as satisfying it', () => {
      expect(isRefreshDue({ ...daily, lastRefreshed: at(TODAY, 9, 0), now: at(TODAY, 23, 0) })).toBe(false)
    })
  })

  it('handles a 00:00 slot at exactly midnight', () => {
    expect(
      isRefreshDue({
        ...base,
        mode: 'daily',
        dailyTime: '00:00',
        lastRefreshed: at(YESTERDAY, 12, 0),
        now: at(TODAY, 0, 0),
      })
    ).toBe(true)
  })

  it.each(['7:00', '24:00', '07:60', '', undefined])('is never due with invalid daily time %p', (t) => {
    expect(
      isRefreshDue({
        ...base,
        mode: 'daily',
        dailyTime: t as unknown as string,
        lastRefreshed: null,
        now: at(TODAY, 12, 0),
      })
    ).toBe(false)
  })
})

describe('isBackoffActive', () => {
  const now = at(TODAY, 12, 0)

  it('is inactive without a failure', () => {
    expect(isBackoffActive(null, now)).toBe(false)
  })

  it('is active just before the backoff ends', () => {
    expect(isBackoffActive(new Date(now.getTime() - FAILURE_BACKOFF_MS + 1), now)).toBe(true)
  })

  it('is inactive once the backoff has passed', () => {
    expect(isBackoffActive(new Date(now.getTime() - FAILURE_BACKOFF_MS), now)).toBe(false)
  })
})

describe('isSchedulerEnabled', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['on', true],
    ['off', false],
    [' OFF ', false],
    ['0', false],
    ['false', false],
  ])('%p → %p', (env, expected) => {
    expect(isSchedulerEnabled(env)).toBe(expected)
  })
})

describe('validateRefreshPrefsInput', () => {
  it('accepts valid values and returns only present fields', () => {
    expect(validateRefreshPrefsInput({})).toEqual({ ok: true, data: {} })
    expect(
      validateRefreshPrefsInput({ refreshMode: 'daily', refreshDailyTime: '07:30', refreshIntervalMins: 360 })
    ).toEqual({
      ok: true,
      data: { refreshMode: 'daily', refreshDailyTime: '07:30', refreshIntervalMins: 360 },
    })
    expect(validateRefreshPrefsInput({ refreshIntervalMins: 15 })).toEqual({
      ok: true,
      data: { refreshIntervalMins: 15 },
    })
  })

  it.each([
    [{ refreshMode: 'hourly' }, 'Invalid refreshMode'],
    [{ refreshDailyTime: '7:00' }, 'refreshDailyTime must be HH:MM'],
    [{ refreshDailyTime: '25:00' }, 'refreshDailyTime must be HH:MM'],
    [{ refreshIntervalMins: 5 }, 'refreshIntervalMins must be an integer of at least 15'],
    [{ refreshIntervalMins: 30.5 }, 'refreshIntervalMins must be an integer of at least 15'],
    [{ refreshIntervalMins: '60' }, 'refreshIntervalMins must be an integer of at least 15'],
  ])('rejects %p', (body, error) => {
    expect(validateRefreshPrefsInput(body)).toEqual({ ok: false, error })
  })
})

describe('nextDailyTimeInput', () => {
  it('accepts a valid HH:MM value', () => {
    expect(nextDailyTimeInput('07:30', '07:00')).toBe('07:30')
  })

  it('keeps the previous value when the input is cleared or invalid', () => {
    expect(nextDailyTimeInput('', '07:00')).toBe('07:00')
    expect(nextDailyTimeInput('7:3', '07:00')).toBe('07:00')
    expect(nextDailyTimeInput('25:00', '07:00')).toBe('07:00')
  })
})

describe('clampIntervalMins', () => {
  it('passes valid values through', () => {
    expect(clampIntervalMins(60, 360)).toBe(60)
    expect(clampIntervalMins(MIN_INTERVAL_MINS, 360)).toBe(MIN_INTERVAL_MINS)
  })

  it('raises a legacy value below the minimum', () => {
    expect(clampIntervalMins(5, 360)).toBe(MIN_INTERVAL_MINS)
    expect(clampIntervalMins(0, 360)).toBe(MIN_INTERVAL_MINS)
    expect(clampIntervalMins(-30, 360)).toBe(MIN_INTERVAL_MINS)
  })

  it('rounds non-integers so the API accepts them', () => {
    expect(clampIntervalMins(30.4, 360)).toBe(30)
  })

  it('falls back for missing or non-numeric values', () => {
    expect(clampIntervalMins(undefined, 360)).toBe(360)
    expect(clampIntervalMins(NaN, 360)).toBe(360)
    expect(clampIntervalMins('60', 360)).toBe(360)
  })
})
