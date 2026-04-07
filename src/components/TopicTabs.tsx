'use client'

import { useRef } from 'react'
import { clsx } from 'clsx'
import { CATEGORIES } from '@/lib/news-sources'

interface TopicTabsProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
}

export default function TopicTabs({
  activeCategory,
  onCategoryChange,
}: TopicTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id
        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={clsx(
              'flex-shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
          >
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
