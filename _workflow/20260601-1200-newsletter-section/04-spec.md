# Newsletter Section — Implementation Spec

_SmartBrief · 2026-06-01_

---

## 1. Overview

This feature adds a dedicated Newsletters tab to the SmartBrief main page that surfaces articles whose `url` begins with `newsletter://`. These articles are excluded from the main Feed. The Newsletters tab displays a chronological list of newsletter cards (sender, subject, excerpt, date, unread indicator), supports inline expand-to-read with automatic mark-as-read, shows an unread count badge on the tab, and exposes "Poll now" and "Mark all read" actions. Three new API routes are introduced; the existing `/api/news` route gains one additional `where` filter clause; and `page.tsx` is extended with a tab switcher and newsletter-specific state.

---

## 2. Acceptance Criteria

### Feed exclusion
1. **Given** the `/api/news` endpoint is called, **when** it fetches articles, **then** no article whose `url` starts with `newsletter://` appears in the response.
2. **Given** a newsletter article exists in the database, **when** the user views the Feed tab, **then** that article does not appear in the feed list or top stories.

### Tab switcher
3. **Given** the home page loads, **when** no tab has been selected, **then** the "Feed" tab is active by default.
4. **Given** the user clicks the "Newsletters" tab, **when** the tab becomes active, **then** newsletter data is fetched and the tab label shows an unread count badge.
5. **Given** there are 5 unread newsletters, **when** the Newsletters tab is visible, **then** the badge displays "5".
6. **Given** there are 100+ unread newsletters, **when** the tab is visible, **then** the badge displays "99+".
7. **Given** there are 0 unread newsletters, **when** the tab is visible, **then** no badge is rendered.

### Newsletter list
8. **Given** newsletters exist, **when** the tab loads, **then** each card shows: sender (`source`), subject (`title`, line-clamp-2), excerpt (`description`, line-clamp-2), relative time, blue left accent bar for unread.
9. **Given** `isRead` is `true`, **when** the card renders, **then** it has `opacity-60` and no accent bar.
10. **Given** data is loading, **when** no cards are present yet, **then** 3 skeleton cards are shown.
11. **Given** no newsletters exist, **when** data has loaded, **then** an empty-state message is shown.
12. **Given** the API returns non-2xx, **when** fetch settles, **then** an error state with a Retry button is shown.

### Expand / mark as read
13. **Given** a collapsed card, **when** clicked, **then** it expands inline showing full content in a `max-h-[60vh]` scrollable region.
14. **Given** `isRead` is `false` and card is expanded, **then** PATCH `/api/newsletters/[id]/read` is sent and accent bar is removed immediately (optimistic).
15. **Given** `isRead` is already `true`, **when** expanded, **then** no PATCH is sent.
16. **Given** an expanded card, **when** "Close" is clicked, **then** the card collapses.
17. **Given** `content` is null, **when** expanded, **then** shows `description`; if both null shows "No content available."
18. **Given** PATCH fails, **then** optimistic read state is rolled back.

### Action bar
19. **Given** the tab is active, **then** a right-aligned action bar shows "Poll now" and "Mark all read".
20. **Given** "Poll now" is clicked, **then** POST `/api/ingest/newsletter/imap` fires, spinner shown, list re-fetched on success.
21. **Given** "Mark all read" is clicked, **then** POST `/api/newsletters/read-all` fires, all cards optimistically set to read.
22. **Given** "Mark all read" POST fails, **then** state is rolled back.

### Pagination
23. **Given** more newsletters exist beyond page 1, **then** a "Load more" button appends the next page.

---

## 3. Implementation Steps

### Step 1 — Filter newsletters out of `/api/news`

**File:** `src/app/api/news/route.ts`

Add to the `db.article.findMany` where clause:
```ts
url: { not: { startsWith: 'newsletter://' } },
```

### Step 2 — Create `GET /api/newsletters`

**File:** `src/app/api/newsletters/route.ts` _(new)_

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = 20
    const source = searchParams.get('source') || undefined

    const where = {
      url: { startsWith: 'newsletter://' },
      ...(source ? { source } : {}),
    }

    const [newsletters, total, unreadCount] = await Promise.all([
      db.article.findMany({ where, orderBy: { publishedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.article.count({ where }),
      db.article.count({ where: { url: { startsWith: 'newsletter://' }, isRead: false } }),
    ])

    return NextResponse.json({ newsletters, unreadCount, total })
  } catch (err) {
    console.error('GET /api/newsletters error:', err)
    return NextResponse.json({ error: 'Failed to fetch newsletters' }, { status: 500 })
  }
}
```

### Step 3 — Create `PATCH /api/newsletters/[id]/read`

**File:** `src/app/api/newsletters/[id]/read/route.ts` _(new)_

Mirror `src/app/api/articles/[id]/read/route.ts` but:
- Use `PATCH` method
- Skip `upsertTopicWeight` — newsletter reads must not skew feed curation weights
- Guard that the article URL starts with `newsletter://` (return 404 otherwise)
- Idempotent: if already read, return 200 without a DB write

### Step 4 — Create `POST /api/newsletters/read-all`

**File:** `src/app/api/newsletters/read-all/route.ts` _(new)_

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const result = await db.article.updateMany({
      where: { url: { startsWith: 'newsletter://' }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ success: true, updated: result.count })
  } catch (err) {
    console.error('POST /api/newsletters/read-all error:', err)
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 })
  }
}
```

### Step 5 — Create `NewsletterCard` component

**File:** `src/components/NewsletterCard.tsx` _(new)_

Props: `{ article: Article, isExpanded: boolean, onExpand: (id: string) => void, onCollapse: () => void }`

- Outer element: `border-l-4` with `border-blue-500` (unread) or `border-transparent` (read), `opacity-60` when read
- Collapsed: sender, subject (line-clamp-2), excerpt (line-clamp-2), relative time via `formatDistanceToNow`
- Expanded: divider + scrollable prose area (`max-h-[60vh] overflow-y-auto`) + Close button
- Content priority: `article.content` → `article.description` → `"No content available."`
- On expand when `!isRead`: call `onExpand(id)` which triggers PATCH in parent

### Step 6 — Extend `page.tsx`

**File:** `src/app/page.tsx`

Add imports: `NewsletterCard`, date-fns `formatDistanceToNow` (if not already present).

Add state:
```ts
const [activeTab, setActiveTab] = useState<'feed' | 'newsletters'>('feed')
const [newsletters, setNewsletters] = useState<Article[]>([])
const [newsletterUnreadCount, setNewsletterUnreadCount] = useState(0)
const [newsletterTotal, setNewsletterTotal] = useState(0)
const [newsletterPage, setNewsletterPage] = useState(1)
const [isNewsletterLoading, setIsNewsletterLoading] = useState(false)
const [isPollLoading, setIsPollLoading] = useState(false)
const [expandedNewsletterId, setExpandedNewsletterId] = useState<string | null>(null)
const [newsletterError, setNewsletterError] = useState<string | null>(null)
```

Add `fetchNewsletters`, `handleNewsletterExpand` (with optimistic read + rollback), `handleNewsletterCollapse`, `handleMarkAllRead` (optimistic + rollback), `handlePollNow` callbacks.

Add `useEffect` to fetch on tab switch: `if (activeTab === 'newsletters' && newsletters.length === 0) fetchNewsletters(1)`.

In JSX: add tab switcher bar below Header, wrap existing feed in `{activeTab === 'feed' && ...}`, add newsletter panel `{activeTab === 'newsletters' && ...}` with action bar, skeleton/empty/error states, card list, and Load more button.

---

## 4. Edge Cases

| Scenario | Handling |
|---|---|
| `content` null | Fall back to `description`; if also null → "No content available." |
| `description` null | Omit excerpt element entirely in collapsed view |
| Unread count already 0 when decrement fires | `Math.max(0, c - 1)` |
| PATCH called when `isRead` already true | Client skips fetch; server returns 200 idempotently |
| `updateMany` with 0 unread rows | Returns `{ success: true, updated: 0 }` — no error |
| PATCH 404 (article not found) | Client rolls back optimistic state |
| `fetchNewsletters` called while loading | `isNewsletterLoading` guard in useEffect prevents double-fetch |
| Poll endpoint fails | Caught silently; button returns to idle; no state change |

---

## 5. Out of Scope

- Push notifications for new newsletter arrivals
- Source filter UI (API supports `?source=` but no dropdown built)
- Rich HTML rendering / iframe sandboxing
- Saving newsletters to bookmarks
- IMAP credential configuration UI
- Learning signal integration (newsletter reads don't update topic weights)
- Sentiment/balance stats for newsletters
- Prisma schema changes
