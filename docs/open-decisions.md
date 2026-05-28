# SmartBrief — Open Decisions

*Last updated: 2026-05-28*

Tracks product decisions that required CEO input. Resolved decisions are kept for historical context.

---

## Resolved Decisions

### Decision 1 — Weekly Recap: Default landing screen on Sunday/Monday?

**Decision:** No — do not change the default landing screen.

**Implementation:** On Sunday and Monday, the "This Week" card on the briefing complete screen is promoted to the top with slightly more prominent treatment. The recap is accessible but never hijacks the session. A persistent "This Week" nav item is also available. **Shipped in v1.2.**

---

### Decision 2 — Feedback Learning: Expose `preference_weight` slider?

**Decision:** Yes — expose under Settings → Feed → Advanced as "Learning strength" (Low / Medium / High, mapping to 0.1 / 0.3 / 0.6). The on/off toggle remains the primary control.

**Implementation:** Shipped as "Learning strength" slider in the Personalisation settings section. **Shipped in v1.2.**

---

### Decision 3 — Push Notifications: User-configurable significance threshold?

**Decision:** No — do not expose the threshold in v1. The daily cap (max 2 notifications/day) is the lever users care about. If the default threshold proves miscalibrated, adjust the constant in code.

**Implementation:** Daily cap exposed in Settings → Notifications (1/2/3 per day). Threshold remains an internal constant. **Shipped in v1.3.**

---

## Open Questions

These are not blocking anything, but are worth revisiting as the product matures:

| Question | Context | Status |
|----------|---------|--------|
| IMAP credential encryption | Storing IMAP passwords in SQLite plaintext is a known limitation. Document clearly in UI, or encrypt at rest. | Open — document limitation in IMAP UI when built |
| Newsletter ingest secret auto-generation | Should `NEWSLETTER_INGEST_SECRET` be auto-generated on first run (stored in `AppState`)? | Open — consider for IMAP UI sprint |
| `/admin/metrics` page | Surface SQLite metric queries as a plain table at a password-protected URL | Unscheduled backlog |
| 4-week trend in Recap | Add a 4-week view when there's enough data | Unscheduled — needs 4 weeks of `readAt` data |
