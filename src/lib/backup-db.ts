import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  buildBackup,
  coerceRow,
  collectReferencedArticleIds,
  emptyCount,
  findSchemaViolation,
  planArticleMerge,
  planKeyedUpserts,
  planTopStoryMerge,
  type BackupFile,
  type FieldRules,
  type FieldSpec,
  type ImportCounts,
  type MergeCount,
} from '@/lib/backup'

/**
 * Allow-list of models in a backup. Secrets (AppState with VAPID keys,
 * PushSubscription, IMAP env vars) are never read.
 */
type BackupModel = 'UserPreferences' | 'SourceWeight' | 'TopicWeight' | 'Article' | 'TopStory'

function scalarFields(model: BackupModel) {
  const dmmfModel = Prisma.dmmf.datamodel.models.find((m) => m.name === model)
  if (!dmmfModel) throw new Error(`Unknown model ${model}`)
  return dmmfModel.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum')
}

/** Scalar fields of a model from the runtime schema, so new columns need no code change. */
function fieldSpec(model: BackupModel): FieldSpec {
  const spec: FieldSpec = {}
  for (const field of scalarFields(model)) spec[field.name] = field.type
  return spec
}

function fieldRules(model: BackupModel): FieldRules {
  const fields = scalarFields(model)
  return {
    required: fields.filter((f) => f.isRequired && !f.hasDefaultValue && !f.isUpdatedAt).map((f) => f.name),
    nonNullable: fields.filter((f) => f.isRequired).map((f) => f.name),
  }
}

/** The file is well-formed JSON but its rows do not fit the current schema. */
export class BackupSchemaError extends Error {}

export async function exportBackup(now: Date = new Date()): Promise<BackupFile> {
  const [preferences, sourceWeights, topicWeights, savedArticles, savedTopStories] = await Promise.all([
    db.userPreferences.findUnique({ where: { id: 'default' } }),
    db.sourceWeight.findMany({ orderBy: { source: 'asc' } }),
    db.topicWeight.findMany({ orderBy: { topic: 'asc' } }),
    db.article.findMany({ where: { isSaved: true }, orderBy: { publishedAt: 'desc' } }),
    db.topStory.findMany({ where: { saved: true }, orderBy: { createdAt: 'desc' } }),
  ])

  const referencedIds = collectReferencedArticleIds(
    savedTopStories,
    savedArticles.map((a) => a.id)
  )
  const referencedArticles =
    referencedIds.length > 0 ? await db.article.findMany({ where: { id: { in: referencedIds } } }) : []

  return buildBackup(
    { preferences, sourceWeights, topicWeights, savedArticles, savedTopStories, referencedArticles },
    now
  )
}

// Device-bound: needs a push subscription on this device, which is never exported.
const PREFERENCE_FIELDS_NOT_IMPORTED = ['id', 'pushEnabled', 'updatedAt'] as const

/**
 * Merges a validated backup into the DB in one transaction. Never deletes.
 * Preferences and weights take the backup values; articles and stories are
 * only added or promoted to saved.
 */
export async function importBackup(backup: BackupFile): Promise<ImportCounts> {
  const { data } = backup
  const prefSpec = fieldSpec('UserPreferences')
  const sourceSpec = fieldSpec('SourceWeight')
  const topicSpec = fieldSpec('TopicWeight')
  const articleSpec = fieldSpec('Article')
  const storySpec = fieldSpec('TopStory')

  const savedArticles = data.savedArticles.map((r) => coerceRow(r, articleSpec))
  const referencedArticles = data.referencedArticles.map((r) => coerceRow(r, articleSpec))
  const stories = data.savedTopStories.map((r) => coerceRow(r, storySpec))
  const sourceRows = data.sourceWeights.map((r) => coerceRow(r, sourceSpec))
  const topicRows = data.topicWeights.map((r) => coerceRow(r, topicSpec))
  const prefs = data.preferences
    ? coerceRow(data.preferences, prefSpec, PREFERENCE_FIELDS_NOT_IMPORTED)
    : null

  // Reject rows Prisma would refuse before anything is written.
  const articleRules = fieldRules('Article')
  const violation =
    findSchemaViolation(savedArticles, articleRules, 'savedArticles') ??
    findSchemaViolation(referencedArticles, articleRules, 'referencedArticles') ??
    findSchemaViolation(stories, fieldRules('TopStory'), 'savedTopStories') ??
    findSchemaViolation(sourceRows, fieldRules('SourceWeight'), 'sourceWeights') ??
    findSchemaViolation(topicRows, fieldRules('TopicWeight'), 'topicWeights') ??
    (prefs ? findSchemaViolation([prefs], fieldRules('UserPreferences'), 'preferences') : null)
  if (violation) throw new BackupSchemaError(violation)

  return db.$transaction(
    async (tx) => {
      const counts: ImportCounts = {
        preferences: emptyCount(),
        sourceWeights: emptyCount(),
        topicWeights: emptyCount(),
        articles: emptyCount(),
        topStories: emptyCount(),
      }

      // Preferences (single row)
      if (prefs) {
        const existing = await tx.userPreferences.findUnique({ where: { id: 'default' }, select: { id: true } })
        await tx.userPreferences.upsert({
          where: { id: 'default' },
          create: { ...prefs, id: 'default' } as Prisma.UserPreferencesCreateInput,
          update: prefs as Prisma.UserPreferencesUpdateInput,
        })
        counts.preferences[existing ? 'updated' : 'created']++
      }

      // Learned weights, keyed by source / topic
      const sourcePlan = planKeyedUpserts(sourceRows, 'source', await tx.sourceWeight.findMany())
      for (const row of sourcePlan.creates) {
        await tx.sourceWeight.create({ data: row as Prisma.SourceWeightCreateInput })
      }
      for (const { key, data: update } of sourcePlan.updates) {
        await tx.sourceWeight.update({ where: { source: key }, data: update as Prisma.SourceWeightUpdateInput })
      }
      addPlanCounts(counts.sourceWeights, sourcePlan.creates.length, sourcePlan.updates.length, sourcePlan.unchanged)

      const topicPlan = planKeyedUpserts(topicRows, 'topic', await tx.topicWeight.findMany())
      for (const row of topicPlan.creates) {
        await tx.topicWeight.create({ data: row as Prisma.TopicWeightCreateInput })
      }
      for (const { key, data: update } of topicPlan.updates) {
        await tx.topicWeight.update({ where: { topic: key }, data: update as Prisma.TopicWeightUpdateInput })
      }
      addPlanCounts(counts.topicWeights, topicPlan.creates.length, topicPlan.updates.length, topicPlan.unchanged)

      // Articles, matched by URL
      const allArticles = [...savedArticles, ...referencedArticles]
      const urls = allArticles.map((a) => a.url as string)
      const ids = allArticles.map((a) => a.id as string)
      const existingArticles =
        allArticles.length > 0
          ? await tx.article.findMany({
              where: { OR: [{ url: { in: urls } }, { id: { in: ids } }] },
              select: { id: true, url: true, isSaved: true },
            })
          : []
      const articlePlan = planArticleMerge(savedArticles, referencedArticles, existingArticles, randomUUID)
      for (const row of articlePlan.creates) {
        await tx.article.create({ data: row as Prisma.ArticleCreateInput })
      }
      for (const { id, data: update } of articlePlan.updates) {
        await tx.article.update({ where: { id }, data: update as Prisma.ArticleUpdateInput })
      }
      addPlanCounts(counts.articles, articlePlan.creates.length, articlePlan.updates.length, articlePlan.unchanged)

      // Saved top stories, articleIds remapped to local ids
      if (stories.length > 0) {
        const [existingStories, newest] = await Promise.all([
          tx.topStory.findMany({
            where: { id: { in: stories.map((s) => s.id as string) } },
            select: { id: true, saved: true },
          }),
          tx.topStory.aggregate({ _max: { createdAt: true } }),
        ])
        const storyPlan = planTopStoryMerge(stories, existingStories, articlePlan.idMap, newest._max.createdAt)
        for (const row of storyPlan.creates) {
          await tx.topStory.create({ data: row as Prisma.TopStoryCreateInput })
        }
        for (const { id, data: update } of storyPlan.updates) {
          await tx.topStory.update({ where: { id }, data: update as Prisma.TopStoryUpdateInput })
        }
        addPlanCounts(counts.topStories, storyPlan.creates.length, storyPlan.updates.length, storyPlan.unchanged)
      }

      return counts
    },
    { timeout: 60_000, maxWait: 10_000 }
  )
}

function addPlanCounts(count: MergeCount, created: number, updated: number, unchanged = 0) {
  count.created += created
  count.updated += updated
  count.unchanged += unchanged
}
