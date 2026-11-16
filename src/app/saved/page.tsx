'use client'

import { useState, useEffect } from 'react'
import ArticleCard from '@/components/ArticleCard'
import ArticleDetail from '@/components/ArticleDetail'
import TopStoryCard from '@/components/TopStoryCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import PageHeader, { EmptyState, EmptyIcons } from '@/components/PageHeader'
import type { Article, SavedApiResponse, TopStory } from '@/types'

type SelectedItem =
  | { type: 'article'; data: Article }
  | { type: 'topStory'; data: TopStory }
  | null

export default function SavedPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [topStories, setTopStories] = useState<TopStory[]>([])
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)

  useEffect(() => {
    async function fetchSaved() {
      try {
        const res = await fetch('/api/saved')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = (await res.json()) as SavedApiResponse
        setArticles(data.articles)
        setTopStories(data.topStories)
        setRelatedArticles(data.relatedArticles)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSaved()
  }, [])

  function handleMarkRead(id: string) {
    fetch(`/api/articles/${id}/read`, { method: 'POST' }).catch(console.error)
  }

  function handleToggleSave(id: string) {
    fetch(`/api/articles/${id}/save`, { method: 'POST' }).catch(console.error)
    setArticles((prev) => prev.filter((a) => a.id !== id))
  }

  function handleStoryToggleSave(id: string) {
    fetch(`/api/top-stories/${id}/save`, { method: 'POST' }).catch(console.error)
    setTopStories((prev) => prev.filter((s) => s.id !== id))
  }

  const total = articles.length + topStories.length

  return (
    <div>
      <PageHeader
        title="Saved"
        subtitle={isLoading || total === 0 ? 'Your bookmarks' : `${total} saved`}
      />

      {isLoading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <LoadingSpinner />
        </div>
      ) : total === 0 ? (
        <EmptyState icon={EmptyIcons.bookmark} title="Nothing saved yet">
          Tap the bookmark on any story to keep it here for later.
        </EmptyState>
      ) : (
        <div className="pt-4">
          {topStories.length > 0 && (
            <section aria-labelledby="saved-stories-heading" className="mb-4">
              <h2 id="saved-stories-heading" className="headline mb-3 px-4 text-lg font-semibold">
                Stories
              </h2>
              {topStories.map((story) => (
                <TopStoryCard
                  key={story.id}
                  story={story}
                  isSaved
                  onToggleSave={handleStoryToggleSave}
                  onSelect={(ts) => setSelectedItem({ type: 'topStory', data: ts })}
                />
              ))}
            </section>
          )}

          {articles.length > 0 && (
            <section aria-labelledby="saved-articles-heading">
              <h2 id="saved-articles-heading" className="headline mb-3 px-4 text-lg font-semibold">
                Articles
              </h2>
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onMarkRead={handleMarkRead}
                  onToggleSave={handleToggleSave}
                  onSelect={(a) => setSelectedItem({ type: 'article', data: a })}
                />
              ))}
            </section>
          )}
        </div>
      )}

      {selectedItem && (
        <ArticleDetail
          article={selectedItem.type === 'article' ? selectedItem.data : null}
          topStory={selectedItem.type === 'topStory' ? selectedItem.data : null}
          allArticles={[...articles, ...relatedArticles]}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
