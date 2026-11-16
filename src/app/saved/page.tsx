'use client'

import { useState, useEffect } from 'react'
import ArticleCard from '@/components/ArticleCard'
import ArticleDetail from '@/components/ArticleDetail'
import LoadingSpinner from '@/components/LoadingSpinner'
import PageHeader, { EmptyState, EmptyIcons } from '@/components/PageHeader'
import type { Article } from '@/types'

type SelectedItem =
  | { type: 'article'; data: Article }
  | null

export default function SavedPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)

  useEffect(() => {
    async function fetchSaved() {
      try {
        const res = await fetch('/api/news?pageSize=200')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        const saved = (data.articles as Article[]).filter((a) => a.isSaved)
        setArticles(saved)
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

  return (
    <div>
      <PageHeader
        title="Saved"
        subtitle={isLoading || articles.length === 0 ? 'Your bookmarked articles' : `${articles.length} saved ${articles.length === 1 ? 'article' : 'articles'}`}
      />

      {isLoading ? (
        <div className="flex justify-center py-12 text-ink-muted">
          <LoadingSpinner />
        </div>
      ) : articles.length === 0 ? (
        <EmptyState icon={EmptyIcons.bookmark} title="Nothing saved yet">
          Tap the bookmark on any story to keep it here for later.
        </EmptyState>
      ) : (
        <div className="pt-4">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onMarkRead={handleMarkRead}
              onToggleSave={handleToggleSave}
              onSelect={(a) => setSelectedItem({ type: 'article', data: a })}
            />
          ))}
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedItem && (
        <ArticleDetail
          article={selectedItem.type === 'article' ? selectedItem.data : null}
          topStory={null}
          allArticles={articles}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
