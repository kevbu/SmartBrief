# Problem Statement: Themen-Aggregation (Story Clustering)

> Datum: 2026-05-27
> Feature: Story Clustering / Themen-Aggregation

---

## Problem Framing Narrative

**Ich bin:** Ein vielbeschäftigter Nutzer, der jeden Morgen seinen personalisierten News-Feed öffnet, um sich in kurzer Zeit einen Überblick über die wichtigsten Themen des Tages zu verschaffen.

- Ich abonniere mehrere Nachrichtenquellen zu ähnlichen Themen (Tech, KI, Business)
- Ich lese den Feed auf dem Handy, meist zwischen Meetings oder beim Frühstück
- Ich will relevante Themen schnell erfassen – nicht jede Quelle einzeln durchlesen

**Versuche zu:**

- In 5–10 Minuten einen vollständigen Überblick über die wichtigsten Entwicklungen des Tages bekommen
- Erkennen, welche Themen gerade besonders relevant sind (viele Quellen berichten darüber)
- Die wichtigsten Fakten zu jedem Thema ohne Wiederholungen aufnehmen

**Aber:**

- Der Feed zeigt mir dieselbe Geschichte 4–6 Mal, weil mehrere Quellen über dasselbe Thema berichten
- Ich muss selbst im Kopf aggregieren: "Das ist die dritte Karte zum selben KI-Durchbruch"
- Ich kann nicht auf einen Blick sehen, welche Themen gerade wirklich im Trend sind
- Viel Zeit geht verloren durch redundante Artikel zum selben Thema

**Weil:**

- Der Feed Artikel einzeln sortiert (nach Zeit, Quelle, Relevanz) statt nach übergeordnetem Thema
- Keine Clustering-Logik existiert, die inhaltlich ähnliche Artikel aus verschiedenen Quellen zusammenfasst

**Was mich dazu bringt zu fühlen:**

- Genervt: Der Feed fühlt sich fragmentiert und repetitiv an
- Überfordert: Ich sehe viele Karten, aber nicht, was wirklich wichtig ist
- Ineffizient: Ich muss selbst leisten, was ein intelligentes System übernehmen sollte

---

## Kontext & Einschränkungen

- Nutzung primär morgens, 5–10 Minuten, auf dem Smartphone
- App ist selbst-gehostet (Next.js 14, SQLite, Claude API) — keine externen Dienste
- Clustering muss schnell genug sein, um den Feed-Ladevorgang nicht zu verlangsamen (< 300 ms)
- Claude API ist bereits im Stack eingebunden und kann für semantisches Clustering genutzt werden
- `TopStory`-Model, `TopStoryCard`-Komponente und `generateTopStories()` existieren bereits

---

## Finales Problem Statement

Kevin braucht einen News-Feed, der ähnliche Artikel aus verschiedenen Quellen automatisch zu Themen-Clustern zusammenfasst, weil er aktuell dieselbe Geschichte mehrfach sieht und selbst aggregieren muss — was seinen Morgenüberblick ineffizient macht und die wirklich wichtigen Trends im Rauschen versteckt.
