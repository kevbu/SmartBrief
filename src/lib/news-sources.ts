import type { NewsSource, Category, CategoryType, BiasType } from '@/types'

export const NEWS_SOURCES: NewsSource[] = [
  // Technology & AI
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'technology',
    logoEmoji: '🚀',
    bias: 'center-left',
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'technology',
    logoEmoji: '💻',
    bias: 'center',
  },
  {
    id: 'wired',
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'technology',
    logoEmoji: '⚡',
    bias: 'center-left',
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Tech Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'technology',
    logoEmoji: '🔬',
    bias: 'center',
  },

  // Science & Health
  {
    id: 'science-daily',
    name: 'Science Daily',
    url: 'https://www.sciencedaily.com/rss/all.xml',
    category: 'science',
    logoEmoji: '🧬',
    bias: 'center',
  },
  {
    id: 'new-scientist',
    name: 'New Scientist',
    url: 'https://www.newscientist.com/feed/home/',
    category: 'science',
    logoEmoji: '🔭',
    bias: 'center',
  },
  {
    id: 'medical-xpress',
    name: 'Medical Xpress',
    url: 'https://medicalxpress.com/rss-feed/',
    category: 'science',
    logoEmoji: '🏥',
    bias: 'center',
  },

  // Business & Finance
  {
    id: 'cnbc',
    name: 'CNBC',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    category: 'business',
    logoEmoji: '📈',
    bias: 'center-right',
  },
  {
    id: 'fortune',
    name: 'Fortune',
    url: 'https://fortune.com/feed/',
    category: 'business',
    logoEmoji: '💼',
    bias: 'center-right',
  },
  {
    id: 'investopedia',
    name: 'Investopedia',
    url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline',
    category: 'business',
    logoEmoji: '💰',
    bias: 'center',
  },

  // World & Politics
  {
    id: 'bbc-news',
    name: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/rss.xml',
    category: 'world',
    logoEmoji: '🌍',
    bias: 'center',
  },
  {
    id: 'npr-news',
    name: 'NPR News',
    url: 'https://feeds.npr.org/1001/rss.xml',
    category: 'world',
    logoEmoji: '📻',
    bias: 'center-left',
  },
  {
    id: 'al-jazeera',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'world',
    logoEmoji: '🌐',
    bias: 'center-left',
  },

  // Good News / Positive
  {
    id: 'good-news-network',
    name: 'Good News Network',
    url: 'https://www.goodnewsnetwork.org/feed/',
    category: 'positive',
    logoEmoji: '✨',
    bias: 'center',
  },
  {
    id: 'positive-news',
    name: 'Positive News',
    url: 'https://www.positive.news/feed/',
    category: 'positive',
    logoEmoji: '🌟',
    bias: 'center',
  },
]

export const CATEGORIES: Category[] = [
  {
    id: 'all',
    label: 'All',
    emoji: '📰',
    description: 'All news from every source',
  },
  {
    id: 'technology',
    label: 'Tech & AI',
    emoji: '🤖',
    description: 'Technology and artificial intelligence',
  },
  {
    id: 'science',
    label: 'Science & Health',
    emoji: '🧪',
    description: 'Science, research, and health news',
  },
  {
    id: 'business',
    label: 'Business',
    emoji: '📊',
    description: 'Business, finance, and economics',
  },
  {
    id: 'world',
    label: 'World',
    emoji: '🌍',
    description: 'World news and politics',
  },
  {
    id: 'positive',
    label: '✨ Bright Spots',
    emoji: '✨',
    description: 'Uplifting and positive news',
  },
]

export function getSourceByName(name: string): NewsSource | undefined {
  return NEWS_SOURCES.find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  )
}

export function getSourcesForCategory(category: CategoryType): NewsSource[] {
  return NEWS_SOURCES.filter((s) => s.category === category)
}

export function getEmojiForSource(sourceName: string): string {
  const source = NEWS_SOURCES.find(
    (s) => s.name.toLowerCase() === sourceName.toLowerCase()
  )
  return source?.logoEmoji ?? '📰'
}

export function getBiasForSource(sourceName: string): BiasType {
  const source = NEWS_SOURCES.find(
    (s) => s.name.toLowerCase() === sourceName.toLowerCase()
  )
  return source?.bias ?? 'center'
}
