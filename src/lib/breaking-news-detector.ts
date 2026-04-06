/**
 * Breaking news detector.
 *
 * Three-gate qualification:
 *   1. Urgency   — article published within the last 2 hours
 *   2. Coverage  — >= 3 distinct sources cover the same cluster within 30 min
 *   3. Severity  — Claude Haiku rated at least one article in the cluster "critical"
 *
 * Clusters are formed by grouping articles whose titles share a significant
 * keyword overlap (a simple bag-of-words approach — no extra API call needed).
 * The lead article for each qualifying cluster is marked isCriticalBreaking = true
 * and a push notification is dispatched if criticalPushedAt is null.
 *
 * isDetectDue() mirrors the imap-poller pattern: check AppState.lastBreakingCheck
 * to avoid running more often than DETECT_INTERVAL_MS.
 */

import { db } from './db'
import { dispatch } from './push-dispatcher'

const URGENCY_WINDOW_MS = 2 * 60 * 60 * 1000       // 2 hours
const CLUSTER_WINDOW_MS = 30 * 60 * 1000            // 30 minutes
const MIN_SOURCES = 3
const DETECT_INTERVAL_MS = 5 * 60 * 1000            // 5 minutes
const DAILY_PUSH_CAP = 2                             // max notifications per calendar day
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','by','from','as','its','it','this',
  'that','has','have','had','not','no','says','said','new','over','into',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const aArr = Array.from(a)
  const intersection = aArr.filter((w) => b.has(w)).length
  const union = new Set(aArr.concat(Array.from(b))).size
  return union === 0 ? 0 : intersection / union
}

export async function isDetectDue(): Promise<boolean> {
  const state = await db.appState.findUnique({ where: { id: 'default' } })
  if (!state?.lastBreakingCheck) return true
  return Date.now() - state.lastBreakingCheck.getTime() >= DETECT_INTERVAL_MS
}

export interface DetectResult {
  clustersFound: number
  pushSent: number
}

export async function detectAndPush(): Promise<DetectResult> {
  const prefs = await db.userPreferences.findUnique({ where: { id: 'default' } })
  if (!prefs?.pushEnabled) {
    await markChecked()
    return { clustersFound: 0, pushSent: 0 }
  }

  // Daily cap: count pushes already sent today (midnight to midnight, local server time)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const pushedToday = await db.article.count({
    where: { criticalPushedAt: { gte: todayStart } },
  })
  if (pushedToday >= DAILY_PUSH_CAP) {
    console.log(`[breaking-news-detector] Daily cap reached (${pushedToday}/${DAILY_PUSH_CAP}) — skipping`)
    await markChecked()
    return { clustersFound: 0, pushSent: 0 }
  }

  const windowStart = new Date(Date.now() - URGENCY_WINDOW_MS)

  // Fetch recent articles not yet pushed
  const articles = await db.article.findMany({
    where: {
      publishedAt: { gte: windowStart },
      severity: 'critical',
    },
    orderBy: { publishedAt: 'asc' },
  })

  if (articles.length === 0) {
    await markChecked()
    return { clustersFound: 0, pushSent: 0 }
  }

  // Cluster by title similarity within 30-minute windows
  type Cluster = { lead: typeof articles[0]; members: typeof articles }
  const clusters: Cluster[] = []

  for (const article of articles) {
    const tokens = tokenize(article.title)
    let placed = false

    for (const cluster of clusters) {
      const leadPublished = new Date(cluster.lead.publishedAt).getTime()
      const articlePublished = new Date(article.publishedAt).getTime()
      // Must be within 30-min window of cluster lead
      if (Math.abs(articlePublished - leadPublished) > CLUSTER_WINDOW_MS) continue
      // Must share significant keyword overlap
      const leadTokens = tokenize(cluster.lead.title)
      if (jaccardSimilarity(tokens, leadTokens) >= 0.2) {
        cluster.members.push(article)
        placed = true
        break
      }
    }

    if (!placed) {
      clusters.push({ lead: article, members: [article] })
    }
  }

  let pushSent = 0
  const remaining = DAILY_PUSH_CAP - pushedToday
  const qualifying = clusters
    .filter((c) => new Set(c.members.map((a) => a.source)).size >= MIN_SOURCES)
    .slice(0, remaining)   // never exceed the daily cap even with multiple qualifying clusters

  for (const cluster of qualifying) {
    const lead = cluster.lead

    // Mark isCriticalBreaking if not already set
    if (!lead.isCriticalBreaking) {
      await db.article.update({
        where: { id: lead.id },
        data: { isCriticalBreaking: true },
      })
    }

    // Skip if already pushed
    if (lead.criticalPushedAt) continue

    // Reserve the push slot (dedup guard)
    await db.article.update({
      where: { id: lead.id },
      data: { criticalPushedAt: new Date() },
    })

    const sources = Array.from(new Set(cluster.members.map((a) => a.source))).slice(0, 3).join(', ')
    const result = await dispatch({
      title: '⚡ Breaking News',
      body: `${lead.title} — ${sources}`,
      storyId: lead.id,
      url: `/`,
    }).catch(async (err) => {
      console.error('[breaking-news-detector] Push failed:', err)
      // Clear reservation so next cycle can retry
      await db.article.update({
        where: { id: lead.id },
        data: { criticalPushedAt: null },
      })
      return 'error' as const
    })

    if (result === 'sent') pushSent++
  }

  await markChecked()
  console.log(`[breaking-news-detector] ${qualifying.length} clusters, ${pushSent} pushed`)
  return { clustersFound: qualifying.length, pushSent }
}

async function markChecked() {
  await db.appState.upsert({
    where: { id: 'default' },
    create: { id: 'default', lastBreakingCheck: new Date() },
    update: { lastBreakingCheck: new Date() },
  })
}
