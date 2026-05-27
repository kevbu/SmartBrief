# PRD: Themen-Aggregation (Story Clustering)

> Quelle: User Request
> Datum: 2026-05-27
> Status: Draft

---

## Zweck

Der SmartBrief-Feed soll Artikel aus verschiedenen Quellen, die über dasselbe Thema berichten, automatisch zu einem Themen-Cluster zusammenfassen. Statt 5 Einzelkarten zum selben KI-Durchbruch sieht Kevin eine Cluster-Karte mit 2–5 Bullet Points.

---

## Ziele

1. **Reduce redundancy** — kein Thema erscheint mehrfach als separate Karte
2. **Surface trend signal** — Themen mit vielen Quellen stehen oben (Quellenanzahl = Relevanz)
3. **Speed up morning briefing** — weniger Karten, mehr Information pro Karte

---

## Features

### P0 — Muss für v1

| Feature | Beschreibung |
|---------|-------------|
| **Clustering** | Artikel der letzten 12h semantisch zu Themen-Clustern zusammenfassen (via Claude API) |
| **Bullet Points** | Jede Cluster-Karte zeigt 2–5 Bullet Points statt einer Prosa-Zusammenfassung |
| **Source-Count-Ranking** | Cluster mit mehr Quellen erscheinen weiter oben im Feed |
| **Unclustered Articles** | Artikel ohne Cluster erscheinen am Ende des Feeds als normale ArticleCards |
| **Source-Count-Badge** | Cluster-Karte zeigt Anzahl der Quellen (z.B. "4 Quellen") |
| **Quellartikel-Links** | Cluster-Karte zeigt Liste der Quellartikel mit Titel + Quelle — klickbar (öffnet Original in neuem Tab) |

### P1 — Wichtig, aber kein Blocker

| Feature | Beschreibung |
|---------|-------------|
| **12h-Zeitfenster** | Nur Artikel der letzten 12h werden geclustered (verhindert veraltete Cluster) |
| **Summary-Fallback** | Falls Cluster keine Bullets hat (alter Eintrag), wird Summary angezeigt |

### P2 — Nice to have (out of scope für v1)

- Cluster-Karte mit Quellen-Logos statt -Namen
- Re-clustering bei neuem Artikel-Import

---

## User Stories

**Als Kevin möchte ich...**

1. Beim Öffnen des Feeds sehen, welche Themen gerade von vielen Quellen aufgegriffen werden — damit ich sofort erkenne, was wichtig ist
2. Pro Thema 2–5 Bullet Points sehen statt eines Prosa-Satzes — damit ich schnell die wichtigsten Fakten erfasse
3. Die Anzahl der Quellen zu jedem Cluster sehen — damit ich die Relevanz des Themas einschätzen kann
4. Artikel ohne Cluster-Zuordnung am Ende des Feeds sehen — damit ich auch Nischen-News nicht verpasse

---

## Akzeptanzkriterien

- [ ] Feed zeigt Cluster-Karten ganz oben, sortiert nach Quellenanzahl (absteigend)
- [ ] Jede Cluster-Karte zeigt 2–5 Bullet Points
- [ ] Bullet Points kommen aus dem Claude-generierten Cluster-Analysegang
- [ ] Cluster-Karte zeigt "X Quellen"-Badge
- [ ] Cluster-Karte zeigt Liste der Quellartikel (Titel + Quelle, klickbar → Original in neuem Tab)
- [ ] Unclustered Artikel erscheinen nach den Cluster-Karten als normale ArticleCards
- [ ] Zeitfenster: nur Artikel der letzten 12h fließen ins Clustering ein
- [ ] Fallback: falls keine Bullets, wird Summary angezeigt
- [ ] `npm run build` exits 0, kein TypeScript-Fehler
- [ ] Feed-Ladezeit bleibt < 500ms (kein Clustering on-the-fly, gecacht in DB)

---

## Out of Scope (v1)

- Quellen-Logos auf Cluster-Karten
- Manuelle Cluster-Überarbeitung
- Re-clustering bei neuem Import

---

## Technische Rahmenbedingungen

- Stack: Next.js 14, TypeScript strict, Tailwind CSS, SQLite + Prisma, Anthropic Claude API
- Keine neuen npm-Pakete
- `TopStory`-Model in Prisma existiert bereits (kein `bullets`-Feld) — Migration nötig
- `generateTopStories()` in claude-analyzer.ts existiert bereits — Prompt-Update nötig
- `buildUnifiedFeed()` in page.tsx existiert bereits — Reordering nötig
- Clustering läuft beim `refreshNews()`-Zyklus (bereits cron-getriggert), nicht on-demand
