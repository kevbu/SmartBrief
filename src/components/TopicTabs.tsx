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
      className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2.5"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id
        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={clsx(
              'flex-shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all',
              isActive
                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            )}
          >
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
