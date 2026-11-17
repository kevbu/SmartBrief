import { NextResponse } from 'next/server'
import { MAX_BACKUP_BYTES, validateBackup } from '@/lib/backup'
import { BackupSchemaError, importBackup } from '@/lib/backup-db'

export const dynamic = 'force-dynamic'

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

/**
 * POST /api/backup/import
 * Body: a file produced by GET /api/backup/export. Merges it into the DB in one
 * transaction (upsert, never deletes) and returns counts per table.
 * Auth: covered by src/proxy.ts like every non-public route.
 */
export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BACKUP_BYTES) return fail('Backup file is too large', 413)

  let text: string
  try {
    text = await request.text()
  } catch {
    return fail('Could not read request body', 400)
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BACKUP_BYTES) return fail('Backup file is too large', 413)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail('File is not valid JSON', 400)
  }

  const result = validateBackup(parsed)
  if (!result.ok) return fail(result.error, 400)

  try {
    const counts = await importBackup(result.backup)
    return NextResponse.json({ success: true, counts })
  } catch (err) {
    if (err instanceof BackupSchemaError) return fail(err.message, 400)
    console.error('Error importing backup:', err)
    // Prisma errors are multi-line with the full query; the last line names the problem.
    const detail = err instanceof Error ? err.message.trim().split('\n').pop()?.trim() : undefined
    return fail(`Import failed, nothing was changed${detail ? `: ${detail}` : ''}`, 500)
  }
}
