# Tech Decisions — Newsletter Section

**Feature:** Newsletter tab in `src/app/page.tsx`
**Date:** 2026-06-01

---

## 1. File List

### New files to create

| File | Purpose |
|---|---|
| `src/app/api/newsletters/route.ts` | `GET /api/newsletters` — list newsletters with pagination |
| `src/app/api/newsletters/[id]/read/route.ts` | `PATCH /api/newsletters/[id]/read` — mark single as read |
| `src/app/api/newsletters/read-all/route.ts` | `POST /api/newsletters/read-all` — bulk mark read |
| `src/components/NewsletterCard.tsx` | Newsletter card component (inline expand, unread dot) |

### Existing files to modify

| File | Change |
|---|---|
| `src/app/api/news/route.ts` | Add `url: { not: { startsWith: 'newsletter://' } }` to findMany where clause |
| `src/app/page.tsx` | Add tab switcher, newsletter state, fetch logic, render newsletter list |

---

## 2. API Contracts

### `GET /api/newsletters`

Query params: `page` (default 1), `source` (optional filter on `article.source`)

Response 200:
```ts
{
  newsletters: Article[],
  unreadCount: number,   // total unread across ALL newsletter articles (not just this page)
  total: number          // total matching rows
}
```

Prisma query:
```ts
const where = {
  url: { startsWith: 'newsletter://' },
  ...(source ? { source } : {}),
}
const [newsletters, total, unreadCount] = await Promise.all([
  db.article.findMany({ where, orderBy: { publishedAt: 'desc' }, skip: (page-1)*20, take: 20 }),
  db.article.count({ where }),
  db.article.count({ where: { url: { startsWith: 'newsletter://' }, isRead: false } }),
])
```

### `PATCH /api/newsletters/[id]/read`

No request body. Response 200: `{ success: true, article: Article }`

- Uses Next.js 16 async params: `{ params }: { params: Promise<{ id: string }> }`
- Mirrors existing `src/app/api/articles/[id]/read/route.ts` but SKIPS `upsertTopicWeight` — newsletter reads must not skew the topic weight model used by the main feed

### `POST /api/newsletters/read-all`

No request body. Response 200: `{ success: true, updated: number }`

```ts
const result = await db.article.updateMany({
  where: { url: { startsWith: 'newsletter://' }, isRead: false },
  data: { isRead: true, readAt: new Date() },
})
```

### `GET /api/news` fix

Change `findMany` where clause to add:
```ts
url: { not: { startsWith: 'newsletter://' } }
```
Note: Prisma syntax is `{ not: { startsWith: '...' } }` NOT `{ NOT: ... }`.

---

## 3. Frontend State Shape

Add to `HomePage` in `src/app/page.tsx`:

```ts
const [activeTab, setActiveTab] = useState<'feed' | 'newsletters'>('feed')
const [newsletters, setNewsletters] = useState<Article[]>([])
const [newsletterUnreadCount, setNewsletterUnreadCount] = useState(0)
const [newsletterTotal, setNewsletterTotal] = useState(0)
const [newsletterPage, setNewsletterPage] = useState(1)
const [isNewsletterLoading, setIsNewsletterLoading] = useState(false)
const [isPollLoading, setIsPollLoading] = useState(false)
const [expandedNewsletterId, setExpandedNewsletterId] = useState<string | null>(null)
```

`fetchNewsletters` is triggered when:
- Tab switches to 'newsletters' and `newsletters.length === 0`
- "Poll now" completes
- "Mark all read" completes

---

## 4. `NewsletterCard` Component Props

```ts
interface NewsletterCardProps {
  newsletter: Article
  isExpanded: boolean
  onExpand: (id: string) => void
  onCollapse: () => void
}
```

On expand: call `PATCH /api/newsletters/[id]/read`, optimistically set `isRead: true` in local state, decrement `newsletterUnreadCount`.

`content` fallback: if `article.content` is null, use `article.description`. If both null, show "No content available."

---

## 5. Key Gotchas

- **`startsWith` in Prisma SQLite** maps to `LIKE 'newsletter://%'` — case-sensitive, fine since ingest always writes lowercase
- **Async params in Next.js 16** — use `{ params }: { params: Promise<{ id: string }> }` with `await params`
- **`unreadCount` is global** — always reflects total unread, not just current page; decrement locally after mark-read actions
- **"Poll now"** calls existing `POST /api/ingest/newsletter/imap`, then re-fetches newsletter list on success
- **Skip topic weight update** when marking newsletter as read — newsletters are a separate content type
