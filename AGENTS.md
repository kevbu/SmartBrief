# SmartBrief Agent Instructions

## Project
Next.js 14 app router, TypeScript (strict), Tailwind CSS, SQLite + Prisma ORM.
All source code is under `src/`. Use `@/` path alias for imports.

## AI Pipeline
RSS feeds → news-fetcher.ts → news-aggregator.ts → claude-analyzer.ts (sentiment + summary) → balance-filter.ts → API routes → UI

## Key Files
- `src/lib/claude-analyzer.ts` — Claude API integration
- `src/lib/news-sources.ts` — RSS feed registry
- `src/app/api/` — API routes by domain (articles, auth, news, preferences, recap)
- `prisma/schema.prisma` — DB schema (Article, TopStory, UserPreferences, AppState, ArticleFeedback)

## Rules
- Run `npm run build` to verify TypeScript before committing
- Use `prisma migrate dev` for schema changes (not `db push` in dev)
- Keep sentiment color classes consistent: `positive`, `neutral`, `negative`
- ANTHROPIC_API_KEY must be set in .env
