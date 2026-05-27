# Tech Decisions: Story Clustering

> PRD: [01-prd.md](01-prd.md)
> Datum: 2026-05-27

---

## Stack (unverändert)

Next.js 14, TypeScript strict, Tailwind CSS, Prisma 5 + SQLite, Anthropic Claude API. Keine neuen npm-Pakete.

---

## Architektur-Entscheidungen

### 1. Bullets und Quellartikel direkt in TopStory speichern

**Problem:** Cluster-Artikel (Titel, URL) könnten aus dem paginierten `articles`-Array nicht erreichbar sein (API liefert max. 50 Artikel, Cluster kann 200 referenzieren).

**Entscheidung:** Zwei neue Felder in `TopStory`:
- `bullets String?` — JSON-Array von 2–5 Bullet-Strings
- `clusterArticles String?` — JSON-Array von `{title, source, url}` — für klickbare Quellartikel-Links

Kein Client-Side-Lookup. Die Karte hat immer alle Daten.

**Alternative verworfen:** Look-up aus `articles`-State → funktioniert nur wenn alle Cluster-Artikel zufällig im paginierten Set sind.

---

### 2. Prisma-Migration erforderlich

`TopStory`-Model bekommt zwei optionale Felder (`String?`). Ältere Einträge (ohne bullets/clusterArticles) bleiben kompatibel — `TopStoryCard` fällt auf `summary` zurück.

Migration: `npx prisma migrate dev --name add-topstory-bullets-and-articles`

---

### 3. Claude-Prompt-Erweiterung (generateTopStories)

Bestehender Prompt gibt `title, summary, category, articleIndices, sources, sentiment` zurück. Erweiterung:
- `"bullets"`: Array von 2–5 Strings (jeder ≤ 15 Wörter, konkrete Fakten)
- `"summary"` bleibt erhalten (für Detail-View und Fallback)

Die `articleIndices` → `recentArticles[idx-1]` Logik liefert bereits Article-Objekte mit `title`, `source`, `url` — daraus wird `clusterArticles` gebaut. Kein zweiter API-Call.

---

### 4. 12h-Zeitfenster für Clustering-Input

`refreshNews()` in `news-aggregator.ts` verwendet derzeit `take: 100` ohne Zeitfilter. Änderung:
```typescript
const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)
where: { publishedAt: { gte: twelveHoursAgo } }
take: 200
```

Fallback: wenn `recentArticles.length < 5`, kein Clustering (bereits durch `if (recentArticles.length < 3) return []` abgedeckt).

---

### 5. API-Route: kein `take: 5`, sort by source count

Aktuell: `db.topStory.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })`

Änderung: Kein `take`-Limit; nach Parsing sortieren nach `sources.length` desc. Alle gecachten TopStories werden ausgegeben — der Feed zeigt sowieso nur so viele wie existieren (typisch 5–15 Cluster).

---

### 6. buildUnifiedFeed: Cluster zuerst, dann Einzelartikel

Aktuell: Cluster werden inline interleavt, beim ersten Cluster-Artikel im Feed.

Änderung:
1. Alle Cluster-Karten zuerst (in der Reihenfolge der API-Response, d.h. nach Quellenanzahl)
2. Dann alle Artikel die keinem Cluster zugeordnet sind

Einfacher, direkter. Keine Interleave-Logik mehr nötig.

---

## Kritische Dateien

| Datei | Änderung |
|-------|----------|
| `prisma/schema.prisma` | `bullets String?`, `clusterArticles String?` zu `TopStory` |
| `src/types/index.ts` | `TopStory`-Interface: `bullets?: string[]`, `clusterArticles?: {title,source,url}[]` |
| `src/lib/claude-analyzer.ts` | Prompt + Return-Mapping für `bullets` + `clusterArticles` |
| `src/lib/news-aggregator.ts` | 12h-Filter, `clusterArticles` beim Speichern |
| `src/app/api/news/route.ts` | Kein `take:5`, `bullets`+`clusterArticles` parsen, sort by source count |
| `src/app/page.tsx` | `buildUnifiedFeed()`: Cluster zuerst, dann unklustered |
| `src/components/TopStoryCard.tsx` | Bullets-Rendering, Quellartikel-Links, Source-Count-Badge |
