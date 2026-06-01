# Problem Statement — Newsletter Section

## Core Problem

Newsletter emails are already ingested into the SmartBrief database via the IMAP poller, but they are invisible in the UI. Because they are stored as `Article` rows alongside RSS-sourced news, they either get mixed into the main feed (polluting it with long-form newsletter content) or are filtered out entirely. The user has no dedicated place to read their newsletters inside the app.

## Who It's For

Single user (personal app). The user subscribes to newsletters that arrive in a dedicated IMAP folder ("SmartBrief") and wants to read them in SmartBrief, not in their email client.

## Jobs-To-Be-Done

1. **See all newsletters** — browse ingested newsletters in one dedicated section, separate from news articles.
2. **Know what's new** — distinguish unread newsletters from already-read ones at a glance.
3. **Read newsletter content** — expand a newsletter to read its full text inline, without leaving the app.
4. **Keep the main feed clean** — newsletter articles must never appear in the normal article/cluster feed.

## What Already Exists

- `src/lib/imap-poller.ts` — polls IMAP, writes Article rows; URL scheme `newsletter://imap/{messageId}` identifies newsletter rows.
- `src/lib/newsletter-parser.ts` — converts emails to Article-shaped objects.
- Multiple API routes under `/api/ingest/newsletter/` for triggering polls and checking status.
- `Article.isRead` flag in the DB for read-state tracking.

## Success Criteria

- A "Newsletter" tab/section is visible in the main page alongside the article feed.
- Only articles whose URL starts with `newsletter://` appear there.
- Newsletter articles do NOT appear in the main feed or cluster cards.
- Clicking a newsletter expands it to show full content.
- Read/unread state is tracked and visually indicated.
