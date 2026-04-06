import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { UserPreferences, PreferencesApiResponse, MoodPreset, DepthMode } from '@/types'

const MOOD_RATIOS: Record<MoodPreset, { pos: number; neu: number; neg: number }> = {
  balanced:     { pos: 0.4, neu: 0.4, neg: 0.2 },
  constructive: { pos: 0.6, neu: 0.35, neg: 0.05 },
  'hard-news':  { pos: 0.2, neu: 0.4, neg: 0.4 },
}

function dbToPreferences(prefs: {
  id: string
  positiveRatio: number
  neutralRatio: number
  negativeRatio: number
  enabledCategories: string
  refreshIntervalMins: number
  moodPreset: string
  avoidTopics: string
  hiddenSources: string
  sessionSize: number
  depthMode: string
  enabledSources: string
  pushEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  learningEnabled: boolean
  preferenceWeight: number
}): UserPreferences {
  return {
    id: prefs.id,
    positiveRatio: prefs.positiveRatio,
    neutralRatio: prefs.neutralRatio,
    negativeRatio: prefs.negativeRatio,
    enabledCategories: prefs.enabledCategories
      ? prefs.enabledCategories.split(',').filter(Boolean)
      : ['technology', 'science', 'business', 'world', 'positive'],
    refreshIntervalMins: prefs.refreshIntervalMins,
    moodPreset: (prefs.moodPreset as MoodPreset) ?? 'balanced',
    avoidTopics: prefs.avoidTopics
      ? prefs.avoidTopics.split(',').filter(Boolean)
      : [],
    hiddenSources: prefs.hiddenSources
      ? prefs.hiddenSources.split(',').filter(Boolean)
      : [],
    sessionSize: prefs.sessionSize ?? 15,
    depthMode: (prefs.depthMode as DepthMode) ?? 'skim',
    enabledSources: prefs.enabledSources
      ? prefs.enabledSources.split(',').filter(Boolean)
      : [],
    pushEnabled: prefs.pushEnabled ?? false,
    quietHoursEnabled: prefs.quietHoursEnabled ?? false,
    quietHoursStart: prefs.quietHoursStart ?? '22:00',
    quietHoursEnd: prefs.quietHoursEnd ?? '07:00',
    learningEnabled: prefs.learningEnabled ?? true,
    preferenceWeight: prefs.preferenceWeight ?? 0.3,
  }
}

export async function GET() {
  try {
    const prefs = await db.userPreferences.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        positiveRatio: 0.4,
        neutralRatio: 0.4,
        negativeRatio: 0.2,
        enabledCategories: 'technology,science,business,world,positive',
        refreshIntervalMins: 60,
        moodPreset: 'balanced',
        avoidTopics: '',
        hiddenSources: '',
        sessionSize: 15,
        depthMode: 'skim',
      },
      update: {},
    })

    const response: PreferencesApiResponse = {
      success: true,
      preferences: dbToPreferences(prefs),
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error fetching preferences:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Partial<UserPreferences> & { moodPreset?: MoodPreset }

    const updateData: Record<string, unknown> = {}

    // If a mood preset is being set, derive the ratios automatically
    if (body.moodPreset) {
      const ratios = MOOD_RATIOS[body.moodPreset]
      if (ratios) {
        updateData.moodPreset = body.moodPreset
        updateData.positiveRatio = ratios.pos
        updateData.neutralRatio = ratios.neu
        updateData.negativeRatio = ratios.neg
      }
    } else {
      // Manual ratio update — validate they sum to 1
      if (
        body.positiveRatio !== undefined &&
        body.neutralRatio !== undefined &&
        body.negativeRatio !== undefined
      ) {
        const sum = body.positiveRatio + body.neutralRatio + body.negativeRatio
        if (Math.abs(sum - 1) > 0.01) {
          return NextResponse.json(
            { success: false, error: 'Ratios must sum to 1' },
            { status: 400 }
          )
        }
        updateData.positiveRatio = body.positiveRatio
        updateData.neutralRatio = body.neutralRatio
        updateData.negativeRatio = body.negativeRatio
        updateData.moodPreset = 'balanced' // custom = balanced preset label
      } else {
        if (body.positiveRatio !== undefined) updateData.positiveRatio = body.positiveRatio
        if (body.neutralRatio !== undefined) updateData.neutralRatio = body.neutralRatio
        if (body.negativeRatio !== undefined) updateData.negativeRatio = body.negativeRatio
      }
    }

    if (body.enabledCategories !== undefined)
      updateData.enabledCategories = Array.isArray(body.enabledCategories)
        ? body.enabledCategories.join(',')
        : body.enabledCategories
    if (body.refreshIntervalMins !== undefined)
      updateData.refreshIntervalMins = body.refreshIntervalMins
    if (body.avoidTopics !== undefined)
      updateData.avoidTopics = Array.isArray(body.avoidTopics)
        ? body.avoidTopics.join(',')
        : body.avoidTopics
    if (body.hiddenSources !== undefined)
      updateData.hiddenSources = Array.isArray(body.hiddenSources)
        ? body.hiddenSources.join(',')
        : body.hiddenSources
    if (body.sessionSize !== undefined) updateData.sessionSize = body.sessionSize
    if (body.depthMode !== undefined) updateData.depthMode = body.depthMode
    if (body.enabledSources !== undefined)
      updateData.enabledSources = Array.isArray(body.enabledSources)
        ? body.enabledSources.join(',')
        : body.enabledSources
    if (body.pushEnabled !== undefined) updateData.pushEnabled = body.pushEnabled
    if (body.quietHoursEnabled !== undefined) updateData.quietHoursEnabled = body.quietHoursEnabled
    if (body.quietHoursStart !== undefined) updateData.quietHoursStart = body.quietHoursStart
    if (body.quietHoursEnd !== undefined) updateData.quietHoursEnd = body.quietHoursEnd
    if (body.learningEnabled !== undefined) updateData.learningEnabled = body.learningEnabled
    if (body.preferenceWeight !== undefined) {
      const clamped = Math.max(0, Math.min(1, body.preferenceWeight))
      updateData.preferenceWeight = clamped
    }

    const prefs = await db.userPreferences.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        positiveRatio: (updateData.positiveRatio as number) ?? 0.4,
        neutralRatio: (updateData.neutralRatio as number) ?? 0.4,
        negativeRatio: (updateData.negativeRatio as number) ?? 0.2,
        enabledCategories: (updateData.enabledCategories as string) ?? 'technology,science,business,world,positive',
        refreshIntervalMins: (updateData.refreshIntervalMins as number) ?? 60,
        moodPreset: (updateData.moodPreset as string) ?? 'balanced',
        avoidTopics: (updateData.avoidTopics as string) ?? '',
        hiddenSources: (updateData.hiddenSources as string) ?? '',
        sessionSize: (updateData.sessionSize as number) ?? 15,
        depthMode: (updateData.depthMode as string) ?? 'skim',
        enabledSources: (updateData.enabledSources as string) ?? '',
      },
      update: updateData,
    })

    const response: PreferencesApiResponse = {
      success: true,
      preferences: dbToPreferences(prefs),
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error updating preferences:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
