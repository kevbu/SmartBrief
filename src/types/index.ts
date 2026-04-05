export type SentimentType = 'positive' | 'neutral' | 'negative'
export type CategoryType = 'technology' | 'science' | 'business' | 'world' | 'positive'
export type MoodPreset = 'balanced' | 'constructive' | 'hard-news'
export type DepthMode = 'skim' | 'deep'
export type BiasType = 'left' | 'center-left' | 'center' | 'center-right' | 'right'
export type FeedbackType = 'more-like-this' | 'less-like-this' | 'too-negative' | 'off-topic' | 'hide-source'

export interface Article {
  id: string
  title: string
  description: string | null
  content: string | null
  url: string
  imageUrl: string | null
  publishedAt: Date | string
  source: string
  sourceUrl: string | null
  category: string
  sentiment: SentimentType
  sentimentScore: number
  aiSummary: string | null
  isRead: boolean
  isSaved: boolean
  fetchedAt: Date | string
}

export interface TopStory {
  id: string
  title: string
  summary: string
  category: string
  articleIds: string[]
  sources: string[]
  sentiment: SentimentType
  createdAt: Date | string
}

export interface UserPreferences {
  id: string
  positiveRatio: number
  neutralRatio: number
  negativeRatio: number
  enabledCategories: string[]
  refreshIntervalMins: number
  moodPreset: MoodPreset
  avoidTopics: string[]
  hiddenSources: string[]
  sessionSize: number
  depthMode: DepthMode
  enabledSources: string[]
  pushEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

export interface AppState {
  id: string
  lastRefreshed: Date | string | null
}

export interface BalanceStats {
  positive: number
  neutral: number
  negative: number
  total: number
  positivePercent: number
  neutralPercent: number
  negativePercent: number
}

export interface CatchUpContext {
  active: boolean
  gapDays: number
  windowStart: string
  articleCount: number
}

export interface SessionOpenResponse {
  previousOpenedAt: string | null
  gapHours: number
  catchUpMode: boolean
}

export interface NewsApiResponse {
  articles: Article[]
  topStories: TopStory[]
  balanceStats: BalanceStats
  preferences: UserPreferences
  lastRefreshed: string | null
  hasApiKey: boolean
  catchUpContext?: CatchUpContext
}

export interface RefreshApiResponse {
  success: boolean
  articleCount: number
  lastRefreshed: string | null
  error?: string
}

export interface ArticleActionResponse {
  success: boolean
  article?: Article
  error?: string
}

export interface PreferencesApiResponse {
  success: boolean
  preferences?: UserPreferences
  error?: string
}

export interface SentimentResult {
  id: string
  sentiment: SentimentType
  score: number
  severity?: string
}

export interface NewsSource {
  id: string
  name: string
  url: string
  category: CategoryType
  logoEmoji: string
  bias: BiasType
  language: 'en' | 'de'
}

export interface Category {
  id: string
  label: string
  emoji: string
  description: string
}

export interface RawArticle {
  title: string
  description: string | null
  content: string | null
  url: string
  imageUrl: string | null
  publishedAt: Date
  source: string
  sourceUrl: string | null
  category: CategoryType
}

export interface ArticleFeedback {
  id: string
  articleId: string
  feedback: FeedbackType
  source?: string | null
  createdAt: Date | string
}

export interface RecapStats {
  totalRead: number
  topicMix: Record<string, number>
  sentimentMix: { positive: number; neutral: number; negative: number }
  sourceMix: Record<string, number>
  avgSentimentScore: number
  periodDays: number
}
