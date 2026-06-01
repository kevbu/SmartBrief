# PRD — Newsletter Section for SmartBrief

## Purpose

Add a dedicated "Newsletter" section to SmartBrief that displays ingested newsletter emails separately from the news feed. Newsletters are identified by their `newsletter://` URL prefix already written by the IMAP poller.

## Goals

- Surface ingested newsletters in a readable, dedicated UI section.
- Keep the main news feed free of newsletter content.
- Track read/unread state so the user knows what's new.

---

## Features

### P0 — Must Have (v1)

| # | Feature | Description |
|---|---------|-------------|
| P0-1 | Newsletter tab | A "Newsletters" tab/section in the main page UI, switchable from the news feed |
| P0-2 | Newsletter list | Shows all newsletters sorted by date desc; each card shows sender name, subject, excerpt, date, and unread badge |
| P0-3 | Exclude from main feed | `newsletter://` articles are filtered out of the normal article list and cluster feed |
| P0-4 | Expand to read | Clicking a newsletter card expands it inline to show full content; marks it as read |
| P0-5 | Unread count badge | Tab label shows count of unread newsletters ("Newsletters (3)") |
| P0-6 | API endpoint | `GET /api/newsletters` returns newsletter articles (URL starts with `newsletter://`), paginated, with unread count |

### P1 — Should Have (v1)

| # | Feature | Description |
|---|---------|-------------|
| P1-1 | Mark all as read | Button to mark all newsletters as read |
| P1-2 | Source filter | Filter newsletter list by sender/source |
| P1-3 | Manual poll trigger | Button in Newsletter section to trigger an IMAP poll immediately |

### P2 — Nice to Have (future)

| # | Feature | Description |
|---|---------|-------------|
| P2-1 | Search newsletters | Full-text search within newsletter content |
| P2-2 | Save newsletter | Star/save a newsletter for later (uses existing `isSaved` field) |
| P2-3 | Newsletter-specific sentiment | Re-analyze newsletters with Claude for better categorization |

---

## User Stories

- **As a user**, I open SmartBrief and click "Newsletters" to see all my ingested newsletter emails.
- **As a user**, I see a badge showing how many newsletters I haven't read yet.
- **As a user**, I click a newsletter to expand it and read the full content inline.
- **As a user**, my main news feed no longer shows newsletter content mixed in.
- **As a user**, I can click "Poll now" to fetch new newsletters from IMAP immediately.

---

## Out of Scope (v1)

- Full-text search within newsletters
- Per-newsletter AI summary (newsletters already have content; Claude re-analysis is P2)
- Reply or forward actions
- Newsletter subscription management
- Mobile-specific layout (the existing app is desktop-first)

---

## Data Model

No schema changes needed. Newsletters are already `Article` rows with `url LIKE 'newsletter://%'`. The `isRead` field (already on Article) tracks read state.

New API route: `GET /api/newsletters?page=1&source=` → returns `{ newsletters: Article[], total: int, unreadCount: int }`.

`isRead` is set to `true` when the user expands a newsletter (via `PATCH /api/articles/:id/read` — already exists or needs to be created).

---

## Acceptance Criteria

- [ ] Newsletter articles (URL starts with `newsletter://`) do NOT appear in `GET /api/news` response
- [ ] `GET /api/newsletters` returns only newsletter articles
- [ ] Newsletter tab shows unread count badge
- [ ] Expanding a newsletter marks it as read
- [ ] "Poll now" button triggers IMAP poll
- [ ] "Mark all read" sets all newsletter `isRead = true`
