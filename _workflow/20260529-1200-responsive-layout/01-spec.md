# Spec: Responsive Layout for Mac / Desktop

## Context

SmartBrief was designed mobile-first with a hard `max-w-md` (448 px) cap on the root container, making it look like a narrow phone column on a Mac browser. The user wants the app to be usable and visually comfortable on desktop without breaking the existing mobile experience.

## Requirements

- **R1** — On mobile (< 768 px) the layout must be unchanged: single-column feed, full-width cards.
- **R2** — On tablet (≥ 768 px) the container widens to `max-w-2xl` (672 px), single-column feed.
- **R3** — On desktop (≥ 1024 px) the container widens to `max-w-4xl` (896 px) and the feed switches to a 2-column grid.
- **R4** — The bottom nav must stay aligned with the wider container on all breakpoints.
- **R5** — The mobile viewport `maximumScale: 1` / `userScalable: false` restrictions must be removed so desktop browsers can zoom normally.

## Acceptance Criteria

- [ ] AC1: At 375 px viewport width, the container is ≤ 448 px and the feed is a single column.
- [ ] AC2: At 768 px viewport width, the container is wider than 448 px (≥ 640 px).
- [ ] AC3: At 1280 px viewport width, the feed renders as 2 columns.
- [ ] AC4: The bottom nav inner content is centered and at most as wide as the page container.
- [ ] AC5: The `meta[name=viewport]` tag does not include `maximum-scale=1` or `user-scalable=no`.

## Out of Scope

- Side-nav / top-nav rework for desktop
- Per-page responsive overrides beyond the feed grid
