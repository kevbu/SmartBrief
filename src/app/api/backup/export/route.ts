import { NextResponse } from 'next/server'
import { backupFilename } from '@/lib/backup'
import { exportBackup } from '@/lib/backup-db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/backup/export
 * Downloads preferences, learned weights and saved items as a versioned JSON file.
 * Auth: covered by src/proxy.ts like every non-public route.
 */
export async function GET() {
  try {
    const now = new Date()
    const backup = await exportBackup(now)
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${backupFilename(now)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Error exporting backup:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
