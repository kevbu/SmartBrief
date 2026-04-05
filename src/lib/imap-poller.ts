/**
 * IMAP Newsletter Poller
 *
 * Connects to a user-configured IMAP mailbox, fetches unseen messages from a
 * dedicated folder (default: "SmartBrief"), parses them as newsletters, and
 * persists them as Article rows.
 *
 * Configuration (environment variables):
 *   IMAP_HOST                 — e.g. imap.gmail.com
 *   IMAP_PORT                 — default 993
 *   IMAP_USER                 — e.g. you@gmail.com
 *   IMAP_PASS                 — app-specific password (Gmail) or regular password
 *   IMAP_FOLDER               — mailbox folder/label to watch (default: SmartBrief)
 *   IMAP_TLS                  — set to "false" to use STARTTLS on port 143 (default: true)
 *   IMAP_POLL_INTERVAL_MINS   — minimum 5, default 30
 *
 * Security notes:
 *   - Credentials live only in env vars; never written to the DB.
 *   - TLS required by default (IMAPS port 993).
 *   - Only the configured folder is accessed; no other folders are touched.
 *   - Messages are marked \Seen after processing (not deleted).
 */

import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { db } from './db'
import { parseNewsletterEmail } from './newsletter-parser'

export interface ImapConfig {
  host: string
  port: number
  secure: boolean
  user: string
  folder: string
  pollIntervalMins: number
}

export interface PollResult {
  ingested: number
  skipped: number
}

export function isImapConfigured(): boolean {
  return !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS)
}

export function getImapConfig(): ImapConfig {
  return {
    host: process.env.IMAP_HOST ?? '',
    port: parseInt(process.env.IMAP_PORT ?? '993', 10),
    secure: process.env.IMAP_TLS !== 'false',
    user: process.env.IMAP_USER ?? '',
    folder: process.env.IMAP_FOLDER ?? 'SmartBrief',
    pollIntervalMins: Math.max(5, parseInt(process.env.IMAP_POLL_INTERVAL_MINS ?? '30', 10)),
  }
}

function buildClient(cfg: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: process.env.IMAP_PASS ?? '',
    },
    logger: false,
    // Abort connection attempts that stall
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  })
}

/**
 * Verify IMAP credentials and folder existence without ingesting anything.
 * Used by the "Test connection" button in Settings.
 */
export async function testImapConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isImapConfigured()) {
    return { ok: false, error: 'IMAP not configured — set IMAP_HOST, IMAP_USER, IMAP_PASS.' }
  }
  const cfg = getImapConfig()
  const client = buildClient(cfg)
  try {
    await client.connect()
    const lock = await client.getMailboxLock(cfg.folder)
    lock.release()
    await client.logout()
    return { ok: true }
  } catch (err) {
    if (client.usable) await client.logout().catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

/**
 * Poll the IMAP folder for unseen messages, parse and store each one as an
 * Article, then mark them \Seen so they aren't re-processed.
 *
 * Deduplication strategy (in priority order):
 *   1. Message-ID header → `newsletter://imap/{encodedMessageId}`
 *   2. Fallback pseudo-URL from parseNewsletterEmail (sender + subject + ts)
 *
 * Processing is per-message: a failure on one message is logged and skipped so
 * the rest of the batch still completes.
 */
export async function pollImap(): Promise<PollResult> {
  if (!isImapConfigured()) throw new Error('IMAP not configured')

  const cfg = getImapConfig()
  const client = buildClient(cfg)
  let ingested = 0
  let skipped = 0

  try {
    await client.connect()

    const lock = await client.getMailboxLock(cfg.folder)
    try {
      for await (const msg of client.fetch('1:*', {
        envelope: true,
        source: true,
        flags: true,
      })) {
        // Skip already-read messages (flags may be absent on some servers)
        if (msg.flags?.has('\\Seen')) continue
        if (!msg.source) continue

        try {
          // simpleParser's overloads cause a type intersection — cast explicitly
          const parsed = await (simpleParser(msg.source) as Promise<ParsedMail>)

          const from = parsed.from?.text ?? ''
          const subject = parsed.subject ?? '(No subject)'
          const receivedAt = parsed.date ?? new Date()

          // Build a stable dedup URL from Message-ID (most reliable key)
          const rawMessageId = parsed.messageId ?? ''
          const messageId = rawMessageId.replace(/[<>\s]/g, '')
          const articleUrl = messageId
            ? `newsletter://imap/${encodeURIComponent(messageId)}`
            : null

          // Skip if already ingested by Message-ID
          if (articleUrl) {
            const exists = await db.article.findUnique({ where: { url: articleUrl } })
            if (exists) {
              await client.messageFlagsAdd(msg.seq, ['\\Seen'])
              skipped++
              continue
            }
          }

          // Require at least some body content
          const html = parsed.html || undefined
          const text = parsed.text || undefined
          if (!html && !text) {
            console.log(`[imap-poller] No body in "${subject}" — skipping`)
            await client.messageFlagsAdd(msg.seq, ['\\Seen'])
            skipped++
            continue
          }

          const newsletter = parseNewsletterEmail({ from, subject, html, text, receivedAt })

          // Resolve final URL: prefer Message-ID based, fall back to parser's pseudo-URL
          const finalUrl = articleUrl ?? newsletter.url

          // Final dedup check for fallback URLs
          if (!articleUrl) {
            const exists = await db.article.findUnique({ where: { url: finalUrl } })
            if (exists) {
              await client.messageFlagsAdd(msg.seq, ['\\Seen'])
              skipped++
              continue
            }
          }

          await db.article.create({
            data: {
              title: newsletter.title,
              description: newsletter.description,
              content: newsletter.content,
              url: finalUrl,
              imageUrl: null,
              publishedAt: newsletter.publishedAt,
              source: newsletter.source,
              sourceUrl: newsletter.sourceUrl,
              category: newsletter.category,
              sentiment: 'neutral',
              sentimentScore: 0,
            },
          })

          // Mark read in mailbox after successful DB write
          await client.messageFlagsAdd(msg.seq, ['\\Seen'])
          ingested++

          console.log(`[imap-poller] Ingested "${newsletter.title}" from ${newsletter.source}`)
        } catch (msgErr) {
          console.error('[imap-poller] Error processing message:', msgErr)
          // Don't mark seen — leave it for next poll attempt
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    if (client.usable) await client.logout().catch(() => {})
    throw err
  }

  // Record poll timestamp regardless of whether anything was ingested
  await db.appState.upsert({
    where: { id: 'default' },
    create: { id: 'default', lastImapPoll: new Date() },
    update: { lastImapPoll: new Date() },
  })

  console.log(`[imap-poller] Complete — ${ingested} ingested, ${skipped} skipped`)
  return { ingested, skipped }
}

/**
 * Check whether enough time has elapsed since the last poll to warrant a new one.
 * Used by the news refresh cycle to piggyback IMAP polling.
 */
export async function isImapPollDue(): Promise<boolean> {
  if (!isImapConfigured()) return false
  const cfg = getImapConfig()
  const state = await db.appState.findUnique({ where: { id: 'default' } })
  if (!state?.lastImapPoll) return true
  const elapsedMs = Date.now() - state.lastImapPoll.getTime()
  return elapsedMs >= cfg.pollIntervalMins * 60 * 1000
}
