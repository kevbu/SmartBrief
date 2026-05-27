# UX Design: Story Clustering

> PRD: [01-prd.md](01-prd.md)
> Tech: [02-tech-decisions.md](02-tech-decisions.md)
> Datum: 2026-05-27

---

## User Flow

```
Feed öffnen
  │
  ├─ [Cluster-Karten] — oben, sortiert nach Quellenanzahl
  │    └─ Karte anzeigen:
  │         • "Top Story" Badge + "X Quellen" Badge
  │         • Headline
  │         • 2–5 Bullet Points (Fallback: Summary)
  │         • Quellartikel-Liste (Titel + Quelle, klickbar)
  │         • Source Pills (bestehendes Design)
  │
  └─ [Einzelartikel] — darunter, alle unklustered Articles
       └─ Bestehende ArticleCard (unverändert)
```

---

## Cluster-Karte: Design

### Layout (erweitert TopStoryCard)

```
┌─────────────────────────────────────────────────┐
│ [Top Story]           [4 Quellen] [🤖 Tech & AI] │
│                                                   │
│ OpenAI stellt GPT-5 vor                          │
│                                                   │
│ • Neues Modell übertrifft GPT-4 auf allen        │
│   Benchmarks laut internen Tests                 │
│ • Preismodell: $20/Monat für Consumer,           │
│   API ab $0.002/1K Tokens                        │
│ • Verfügbar ab sofort für Plus-Nutzer,           │
│   Pro-Roll-out in 2 Wochen                       │
│                                                   │
│ ─── Quellartikel ────────────────────────────── │
│ The Verge · OpenAI announces GPT-5 with...  ↗   │
│ Reuters · OpenAI's new model sets record...  ↗   │
│ Ars Technica · We tested GPT-5: here's...   ↗   │
│                                                   │
│ [The Verge] [Reuters] [Ars Technica] [+1 more]  │
└─────────────────────────────────────────────────┘
```

---

## Designentscheidungen

### Bullets

- `<ul>` mit `·` als Bullet-Glyph (konsistent mit Skim-Chip: `✦`)
- Text: `text-xs text-gray-600 dark:text-gray-400`, `leading-relaxed`
- Kein Truncating — Bullets sind kurz genug (≤15 Wörter)
- Fallback auf `<p>{story.summary}</p>` wenn `story.bullets` nicht vorhanden oder leer

### Source-Count-Badge

- Neben dem "Top Story"-Badge: `"4 Quellen"` oder `"1 Quelle"`
- Styling: `rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500`
- Platzierung: rechts vom "Top Story"-Badge in der Label-Zeile

### Quellartikel-Links

- Abgesetzte Section unter den Bullets mit dünner Trennlinie
- Jeder Eintrag: `{article.source} · {article.title (truncated 60 chars)}` + `↗` Icon
- Klick → `window.open(url, '_blank', 'noopener,noreferrer')`
- Max. 5 Einträge anzeigen, Rest weglassen (keine "+N more" für Links — Links müssen lesbar sein)
- Styling: `text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200`

### Source Pills (bestehendes Design)

- Bleibt erhalten unterhalb der Quellartikel-Links
- Dient als visuelle Bestätigung der Quellenpräsenz

---

## Feed-Layout (Reihenfolge)

```
┌─────────────────────┐
│  Cluster: 5 Quellen │  ← zuerst (meiste Quellen)
├─────────────────────┤
│  Cluster: 3 Quellen │
├─────────────────────┤
│  Cluster: 2 Quellen │
├─────────────────────┤
│  Cluster: 1 Quelle  │  ← (Einzel-Quellen-Cluster)
├─────────────────────┤
│  ArticleCard        │  ← unklustered, danach
│  ArticleCard        │
│  ...                │
└─────────────────────┘
```

---

## Kein Design-Change an

- `ArticleCard` — unverändert
- Kategorien-Filter — unverändert (filtert sowohl Cluster als auch Artikel)
- Dark Mode — TopStoryCard hat bereits Dark-Mode-Unterstützung
