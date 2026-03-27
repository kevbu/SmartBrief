'use client'

import { useState, useEffect } from 'react'
import ArticleCard from '@/components/ArticleCard'
import ArticleDetail from '@/components/ArticleDetail'
import LoadingSpinner from '@/components/LoadingSpinner'
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
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-slate-900">Saved</h1>
        <p className="text-xs text-gray-400">Your bookmarked articles</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <span className="mb-4 text-5xl">🔖</span>
          <p className="text-base font-semibold text-gray-700">
            No saved articles yet
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Tap the bookmark icon on any article to save it here for later
          </p>
        </div>
      ) : (
        <div className="pt-4">
          <p className="mb-3 px-4 text-xs text-gray-400">
            {articles.length} saved {articles.length === 1 ? 'article' : 'articles'}
          </p>
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
