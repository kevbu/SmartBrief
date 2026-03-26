import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { UserPreferences, PreferencesApiResponse } from '@/types'

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
      },
      update: {},
    })

    const preferences: UserPreferences = {
      id: prefs.id,
      positiveRatio: prefs.positiveRatio,
      neutralRatio: prefs.neutralRatio,
      negativeRatio: prefs.negativeRatio,
      enabledCategories: prefs.enabledCategories.split(','),
      refreshIntervalMins: prefs.refreshIntervalMins,
    }

    const response: PreferencesApiResponse = { success: true, preferences }
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
    const body = await request.json() as Partial<UserPreferences>

    // Validate ratios sum to 1
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
    }

    const updateData: Record<string, unknown> = {}
    if (body.positiveRatio !== undefined)
      updateData.positiveRatio = body.positiveRatio
    if (body.neutralRatio !== undefined)
      updateData.neutralRatio = body.neutralRatio
    if (body.negativeRatio !== undefined)
      updateData.negativeRatio = body.negativeRatio
    if (body.enabledCategories !== undefined)
      updateData.enabledCategories = Array.isArray(body.enabledCategories)
        ? body.enabledCategories.join(',')
        : body.enabledCategories
    if (body.refreshIntervalMins !== undefined)
      updateData.refreshIntervalMins = body.refreshIntervalMins

    const prefs = await db.userPreferences.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        positiveRatio: (updateData.positiveRatio as number) ?? 0.4,
        neutralRatio: (updateData.neutralRatio as number) ?? 0.4,
        negativeRatio: (updateData.negativeRatio as number) ?? 0.2,
        enabledCategories:
          (updateData.enabledCategories as string) ??
          'technology,science,business,world,positive',
        refreshIntervalMins: (updateData.refreshIntervalMins as number) ?? 60,
      },
      update: updateData,
    })

    const preferences: UserPreferences = {
      id: prefs.id,
      positiveRatio: prefs.positiveRatio,
      neutralRatio: prefs.neutralRatio,
      negativeRatio: prefs.negativeRatio,
      enabledCategories: prefs.enabledCategories.split(','),
      refreshIntervalMins: prefs.refreshIntervalMins,
    }

    const response: PreferencesApiResponse = { success: true, preferences }
    return NextResponse.json(response)
  } catch (err) {
    console.error('Error updating preferences:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
