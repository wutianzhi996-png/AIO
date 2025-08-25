'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Sparkles, RefreshCw } from 'lucide-react'

interface QuestionSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void
  refreshTrigger?: number // 用于触发刷新的外部信号
}

export default function QuestionSuggestions({ 
  onSuggestionClick, 
  refreshTrigger = 0 
}: QuestionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/suggest-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (err) {
      console.error('Error fetching suggestions:', err)
      setError('获取推荐失败')
      // 设置默认推荐
      setSuggestions([
        '今天我该做什么？',
        '帮我制定学习计划',
        '如何提高学习效率？',
        '我需要学习建议',
        '推荐一些学习方法'
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [refreshTrigger]) // 当refreshTrigger变化时重新获取推荐

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick(suggestion)
  }

  const handleRefresh = () => {
    fetchSuggestions()
  }

  if (suggestions.length === 0 && !loading) {
    return null
  }

  return (
    <div className="mb-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>可能感兴趣的问题</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="刷新推荐"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {loading ? (
          // 加载状态的骨架屏
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-8 bg-gray-200 rounded-full animate-pulse"
              style={{ width: `${80 + Math.random() * 60}px` }}
            />
          ))
        ) : (
          suggestions.map((suggestion, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 hover:scale-105 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </Badge>
          ))
        )}
      </div>
      
      {error && (
        <div className="mt-2 text-xs text-gray-500">
          {error}
        </div>
      )}
    </div>
  )
}