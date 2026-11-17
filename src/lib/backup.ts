/**
 * Portable backup of preferences, learned weights and saved items.
 *
 * Pure functions only (no Prisma import) so the format, validation and merge
 * planning are unit-testable. DB access lives in `backup-db.ts`.
 *
 * Rows are copied generically (whole Prisma rows). On import, `coerceRow`
 * filters them against the runtime schema, so columns added later flow through
 * without code changes here.
 */

export const BACKUP_FORMAT = 'smartbrief-backup'
export const BACKUP_VERSION = 1
/** Upper bound for an import body. A backup holds saved items only, so this is generous. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024

export type BackupRow = Record<string, unknown>

export interface BackupData {
  preferences: BackupRow | null
  sourceWeights: BackupRow[]
  topicWeights: BackupRow[]
  savedArticles: BackupRow[]
  savedTopStories: BackupRow[]
  /** Articles referenced by saved stories that are not saved themselves. */
  referencedArticles: BackupRow[]
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: BackupData
}

export interface MergeCount {
  created: number
  updated: number
  unchanged: number
}

export interface ImportCounts {
  preferences: MergeCount
  sourceWeights: MergeCount
  topicWeights: MergeCount
  articles: MergeCount
  topStories: MergeCount
}

export function emptyCount(): MergeCount {
  return { created: 0, updated: 0, unchanged: 0 }
}

// ── Export ──────────────────────────────────────────────────────────────────

export function buildBackup(data: BackupData, now: Date = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data,
  }
}

export function backupFilename(now: Date = new Date()): string {
  return `smartbrief-backup-${now.toISOString().slice(0, 10)}.json`
}

/** `TopStory.articleIds` is a JSON string in the DB. Accept a parsed array too. */
export function parseArticleIds(value: unknown): string[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
}

/** Ids referenced by saved stories that are not already among the saved articles. */
export function collectReferencedArticleIds(
  savedTopStories: BackupRow[],
  savedArticleIds: Iterable<string>
): string[] {
  const saved = new Set(savedArticleIds)
  const ids = new Set<string>()
  for (const story of savedTopStories) {
    for (const id of parseArticleIds(story.articleIds)) {
      if (!saved.has(id)) ids.add(id)
    }
  }
  return Array.from(ids)
}

// ── Validation ──────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true; backup: BackupFile } | { ok: false; error: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function checkRows(
  rows: unknown,
  section: string,
  check: (row: Record<string, unknown>) => boolean,
  requirement: string
): string | null {
  if (!Array.isArray(rows)) return `"${section}" must be an array`
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!isObject(row) || !check(row)) return `"${section}[${i}]" ${requirement}`
  }
  return null
}

const hasString = (key: string) => (row: Record<string, unknown>) =>
  typeof row[key] === 'string' && (row[key] as string).length > 0

const isWeightRow = (key: string) => (row: Record<string, unknown>) =>
  hasString(key)(row) && typeof row.weight === 'number' && Number.isFinite(row.weight)

export function validateBackup(input: unknown): ValidationResult {
  if (!isObject(input)) return { ok: false, error: 'Backup must be a JSON object' }
  if (input.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Not a SmartBrief backup file' }
  }
  const version = input.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'Backup version is missing or invalid' }
  }
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Backup version ${version} was created by a newer SmartBrief (supported: ${BACKUP_VERSION})`,
    }
  }
  const data = input.data
  if (!isObject(data)) return { ok: false, error: '"data" must be an object' }

  if (data.preferences !== null && data.preferences !== undefined && !isObject(data.preferences)) {
    return { ok: false, error: '"preferences" must be an object or null' }
  }

  const error =
    checkRows(data.sourceWeights, 'sourceWeights', isWeightRow('source'), 'needs a "source" and a numeric "weight"') ??
    checkRows(data.topicWeights, 'topicWeights', isWeightRow('topic'), 'needs a "topic" and a numeric "weight"') ??
    checkRows(data.savedArticles, 'savedArticles', (r) => hasString('id')(r) && hasString('url')(r), 'needs "id" and "url"') ??
    checkRows(data.savedTopStories, 'savedTopStories', hasString('id'), 'needs an "id"') ??
    checkRows(data.referencedArticles, 'referencedArticles', (r) => hasString('id')(r) && hasString('url')(r), 'needs "id" and "url"')
  if (error) return { ok: false, error }

  const prefs = data.preferences
  if (isObject(prefs)) {
    const ratios = [prefs.positiveRatio, prefs.neutralRatio, prefs.negativeRatio]
    // Same rule as PUT /api/preferences.
    if (ratios.every((r) => typeof r === 'number') && Math.abs((ratios as number[]).reduce((a, b) => a + b, 0) - 1) > 0.01) {
      return { ok: false, error: 'Preference ratios must sum to 1' }
    }
  }

  const articleIds = [...(data.savedArticles as BackupRow[]), ...(data.referencedArticles as BackupRow[])].map((r) => r.id)
  if (new Set(articleIds).size !== articleIds.length) return { ok: false, error: 'Duplicate article ids in backup' }
  const storyIds = (data.savedTopStories as BackupRow[]).map((r) => r.id)
  if (new Set(storyIds).size !== storyIds.length) return { ok: false, error: 'Duplicate story ids in backup' }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version,
      exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
      data: {
        preferences: (data.preferences as BackupRow | null | undefined) ?? null,
        sourceWeights: data.sourceWeights as BackupRow[],
        topicWeights: data.topicWeights as BackupRow[],
        savedArticles: data.savedArticles as BackupRow[],
        savedTopStories: data.savedTopStories as BackupRow[],
        referencedArticles: data.referencedArticles as BackupRow[],
      },
    },
  }
}

// ── Row coercion ────────────────────────────────────────────────────────────

/** Scalar field name → Prisma scalar type ("String", "DateTime", "Int", ...). */
export type FieldSpec = Record<string, string>

/**
 * Keeps only fields the current schema knows, revives DateTime strings and
 * drops values of the wrong scalar type, so Prisma falls back to defaults.
 */
export function coerceRow(row: BackupRow, spec: FieldSpec, omit: readonly string[] = []): BackupRow {
  const out: BackupRow = {}
  for (const [key, value] of Object.entries(row)) {
    const type = spec[key]
    if (!type || omit.includes(key)) continue
    if (value === null) {
      out[key] = null
      continue
    }
    switch (type) {
      case 'DateTime': {
        const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
        if (date && !Number.isNaN(date.getTime())) out[key] = date
        break
      }
      case 'String':
        if (typeof value === 'string') out[key] = value
        break
      case 'Int':
        if (typeof value === 'number' && Number.isInteger(value)) out[key] = value
        break
      case 'Float':
        if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
        break
      case 'Boolean':
        if (typeof value === 'boolean') out[key] = value
        break
      default:
        // Types this backup never needs (Json, Bytes, BigInt, Decimal): skip.
        break
    }
  }
  return out
}

export interface FieldRules {
  /** Required fields without a DB default: must be present. */
  required: readonly string[]
  /** Non-nullable fields: must not be null when present. */
  nonNullable: readonly string[]
}

/**
 * Checks coerced rows against the schema's required / non-nullable fields, so
 * a broken file is rejected before any write instead of failing mid-transaction.
 */
export function findSchemaViolation(rows: BackupRow[], rules: FieldRules, section: string): string | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const missing = rules.required.find((f) => row[f] === undefined || row[f] === null)
    if (missing) return `"${section}[${i}]" is missing a valid "${missing}"`
    const nulled = rules.nonNullable.find((f) => row[f] === null)
    if (nulled) return `"${section}[${i}]" has null "${nulled}"`
  }
  return null
}

function without(row: BackupRow, keys: readonly string[]): BackupRow {
  const out: BackupRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (!keys.includes(key)) out[key] = value
  }
  return out
}

// ── Merge planning ──────────────────────────────────────────────────────────

export interface UpdateOp {
  id: string
  data: BackupRow
}

export interface KeyedUpsertPlan {
  creates: BackupRow[]
  updates: Array<{ key: string; data: BackupRow }>
  unchanged: number
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

/**
 * Plans upserts by a natural unique key (e.g. `source`, `topic`). The cuid is
 * dropped: it differs between machines and the key is what identifies the row.
 * Rows must already be coerced. The backup value wins on conflict; a row
 * whose values already match is counted as unchanged and not written.
 */
export function planKeyedUpserts(
  rows: BackupRow[],
  keyField: string,
  existing: BackupRow[]
): KeyedUpsertPlan {
  const byKey = new Map(existing.map((r) => [r[keyField] as string, r]))
  const seen = new Set<string>()
  const plan: KeyedUpsertPlan = { creates: [], updates: [], unchanged: 0 }
  for (const row of rows) {
    const key = row[keyField]
    if (typeof key !== 'string' || seen.has(key)) continue
    seen.add(key)
    const local = byKey.get(key)
    if (local) {
      const data = without(row, ['id', keyField, 'createdAt', 'updatedAt'])
      if (Object.entries(data).every(([field, value]) => sameValue(value, local[field]))) {
        plan.unchanged++
      } else {
        plan.updates.push({ key, data })
      }
    } else {
      plan.creates.push(without(row, ['id']))
    }
  }
  return plan
}

const SAVED_FIELD = /^(isSaved|saved[A-Z].*)$/

function pickSavedFields(row: BackupRow): BackupRow {
  const out: BackupRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (SAVED_FIELD.test(key)) out[key] = value
  }
  return out
}

export interface ExistingArticle {
  id: string
  url: string
  isSaved: boolean
}

export interface ArticleMergePlan {
  creates: BackupRow[]
  updates: UpdateOp[]
  unchanged: number
  /** Backup article id → local article id. */
  idMap: Map<string, string>
}

/**
 * Matches articles by URL (ids differ between machines). Saved articles win
 * over referenced duplicates. Existing articles are only promoted to saved,
 * never unsaved or otherwise touched: the promotion copies `isSaved` and
 * `saved*` columns (e.g. a later `savedAt`), not read state, severity or push
 * bookkeeping of the other machine.
 */
export function planArticleMerge(
  saved: BackupRow[],
  referenced: BackupRow[],
  existing: ExistingArticle[],
  newId: () => string
): ArticleMergePlan {
  const byUrl = new Map(existing.map((a) => [a.url, a]))
  const takenIds = new Set(existing.map((a) => a.id))
  const plan: ArticleMergePlan = { creates: [], updates: [], unchanged: 0, idMap: new Map() }

  // URL → local id of the row already planned for that URL.
  const plannedUrls = new Map<string, string>()
  const rows: BackupRow[] = [
    ...saved.map((row): BackupRow => ({ ...row, isSaved: true })),
    ...referenced,
  ]

  for (const row of rows) {
    const id = row.id as string
    const url = row.url as string
    const planned = plannedUrls.get(url)
    if (planned) {
      // Same URL listed twice (saved + referenced): map the second id as well.
      plan.idMap.set(id, planned)
      continue
    }

    const local = byUrl.get(url)
    if (local) {
      plannedUrls.set(url, local.id)
      plan.idMap.set(id, local.id)
      if (row.isSaved === true && !local.isSaved) {
        plan.updates.push({ id: local.id, data: pickSavedFields(row) })
      } else {
        plan.unchanged++
      }
      continue
    }

    const localId = takenIds.has(id) ? newId() : id
    takenIds.add(localId)
    plannedUrls.set(url, localId)
    plan.idMap.set(id, localId)
    plan.creates.push({ ...row, id: localId })
  }
  return plan
}

export interface ExistingTopStory {
  id: string
  saved: boolean
}

export interface TopStoryMergePlan {
  creates: BackupRow[]
  updates: UpdateOp[]
  unchanged: number
}

/**
 * Saved stories: remap `articleIds` to local ids, create missing ones as saved,
 * promote existing unsaved ones. New rows get a `createdAt` just before the
 * newest local story, so they never become the feed's current batch
 * (`selectCurrentBatch` treats the newest `createdAt` as the batch).
 */
export function planTopStoryMerge(
  stories: BackupRow[],
  existing: ExistingTopStory[],
  idMap: Map<string, string>,
  newestLocalCreatedAt: Date | null
): TopStoryMergePlan {
  const byId = new Map(existing.map((s) => [s.id, s]))
  const plan: TopStoryMergePlan = { creates: [], updates: [], unchanged: 0 }
  const seen = new Set<string>()

  for (const story of stories) {
    const id = story.id as string
    if (seen.has(id)) continue
    seen.add(id)

    const articleIds = JSON.stringify(parseArticleIds(story.articleIds).map((a) => idMap.get(a) ?? a))
    const local = byId.get(id)

    if (local) {
      if (local.saved) {
        plan.unchanged++
      } else {
        plan.updates.push({
          id,
          data: { ...without(story, ['id', 'createdAt']), articleIds, saved: true },
        })
      }
      continue
    }

    const row: BackupRow = { ...story, articleIds, saved: true }
    const createdAt = story.createdAt
    if (newestLocalCreatedAt && (!(createdAt instanceof Date) || createdAt >= newestLocalCreatedAt)) {
      row.createdAt = new Date(newestLocalCreatedAt.getTime() - 1)
    }
    plan.creates.push(row)
  }
  return plan
}
