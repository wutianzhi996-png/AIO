'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  BookOpen,
  Video,
  FileText,
  ExternalLink,
  Star,
  Clock,
  User,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  RefreshCw,
  Lightbulb
} from 'lucide-react'
import { LearningResource } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'

interface LearningResourcesWidgetProps {
  className?: string
  obstacleType?: string // 从障碍诊断传入的障碍类型
}

export default function LearningResourcesWidget({ className, obstacleType }: LearningResourcesWidgetProps) {
  const [resources, setResources] = useState<LearningResource[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    platform: '',
    resource_type: '',
    difficulty_level: '',
    language: 'zh'
  })
  const [bookmarkedResources, setBookmarkedResources] = useState<Set<number>>(new Set())
  const [viewMode, setViewMode] = useState<'recommended' | 'search'>('recommended')

  useEffect(() => {
    loadRecommendations()
    loadBookmarkedResources()
  }, [obstacleType]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecommendations = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseService.getResourceRecommendations({
        obstacleType,
        limit: 12
      })
      
      if (error) {
        console.error('Failed to load recommendations:', error)
      } else {
        setResources(data || [])
      }
    } catch (error) {
      console.error('Error loading recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBookmarkedResources = async () => {
    try {
      const { data } = await supabaseService.getUserResourceInteractions({
        interactionType: 'bookmark'
      })
      
      if (data) {
        const bookmarkedIds = new Set(data.map(interaction => interaction.resource_id))
        setBookmarkedResources(bookmarkedIds)
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setViewMode('search')
    
    try {
      const { data, error } = await supabaseService.searchResources(searchQuery, filters)
      
      if (error) {
        console.error('Search failed:', error)
      } else {
        setResources(data || [])
      }
    } catch (error) {
      console.error('Error searching resources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResourceInteraction = async (resourceId: number, interactionType: string, options?: Record<string, unknown>) => {
    try {
      await supabaseService.recordResourceInteraction(resourceId, interactionType, options)
      
      if (interactionType === 'bookmark') {
        setBookmarkedResources(prev => {
          const newSet = new Set(prev)
          if (newSet.has(resourceId)) {
            newSet.delete(resourceId)
          } else {
            newSet.add(resourceId)
          }
          return newSet
        })
      }
    } catch (error) {
      console.error('Error recording interaction:', error)
    }
  }

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />
      case 'article': return <FileText className="w-4 h-4" />
      case 'course': return <BookOpen className="w-4 h-4" />
      case 'tutorial': return <BookOpen className="w-4 h-4" />
      case 'documentation': return <FileText className="w-4 h-4" />
      case 'interactive': return <Lightbulb className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'youtube': return 'bg-red-100 text-red-700'
      case 'bilibili': return 'bg-pink-100 text-pink-700'
      case 'blog': return 'bg-green-100 text-green-700'
      case 'documentation': return 'bg-blue-100 text-blue-700'
      case 'course': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700'
      case 'intermediate': return 'bg-yellow-100 text-yellow-700'
      case 'advanced': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">学习资源推荐</h2>
              {obstacleType && (
                <p className="text-sm text-gray-500">
                  为您推荐解决{obstacleType === 'knowledge_gap' ? '知识缺口' : obstacleType}问题的资源
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'recommended' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('recommended')
                loadRecommendations()
              }}
            >
              推荐
            </Button>
            <Button
              variant={viewMode === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('search')}
            >
              搜索
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        {viewMode === 'search' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索学习资源..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={filters.platform} onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">所有平台</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="bilibili">Bilibili</SelectItem>
                  <SelectItem value="blog">技术博客</SelectItem>
                  <SelectItem value="documentation">文档</SelectItem>
                  <SelectItem value="course">在线课程</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.resource_type} onValueChange={(value) => setFilters(prev => ({ ...prev, resource_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">所有类型</SelectItem>
                  <SelectItem value="video">视频</SelectItem>
                  <SelectItem value="article">文章</SelectItem>
                  <SelectItem value="course">课程</SelectItem>
                  <SelectItem value="tutorial">教程</SelectItem>
                  <SelectItem value="documentation">文档</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.difficulty_level} onValueChange={(value) => setFilters(prev => ({ ...prev, difficulty_level: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="难度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">所有难度</SelectItem>
                  <SelectItem value="beginner">初级</SelectItem>
                  <SelectItem value="intermediate">中级</SelectItem>
                  <SelectItem value="advanced">高级</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.language} onValueChange={(value) => setFilters(prev => ({ ...prev, language: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">英文</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Resources Grid */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">加载中...</span>
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无推荐资源</p>
            {viewMode === 'recommended' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => supabaseService.addPresetResources().then(() => loadRecommendations())}
                className="mt-2"
              >
                添加预设资源
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((resource) => {
              const resourceData = resource as unknown as Record<string, unknown>
              return (
                <div
                  key={resourceData.id as number}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Resource Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getResourceIcon(resourceData.resource_type as string)}
                      <Badge className={getPlatformColor(resourceData.platform as string)}>
                        {resourceData.platform as string}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResourceInteraction(resourceData.id as number, 'bookmark')}
                      className="p-1"
                    >
                      {bookmarkedResources.has(resourceData.id as number) ? (
                        <BookmarkCheck className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Bookmark className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>

                  {/* Resource Content */}
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                      {resourceData.title as string}
                    </h3>
                    {Boolean(resourceData.description) && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {resourceData.description as string}
                      </p>
                    )}
                  </div>

                  {/* Resource Meta */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <div className="flex items-center space-x-3">
                      {Boolean(resourceData.author) && (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{resourceData.author as string}</span>
                        </div>
                      )}
                      {Boolean(resourceData.duration_minutes) && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{resourceData.duration_minutes as number}分钟</span>
                        </div>
                      )}
                    </div>
                    {Boolean(resourceData.rating) && (
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-500" />
                        <span>{(resourceData.rating as number).toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags and Difficulty */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-wrap gap-1">
                      {((resourceData.tags as string[]) || []).slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Badge className={getDifficultyColor(resourceData.difficulty_level as string)}>
                      {resourceData.difficulty_level === 'beginner' ? '初级' :
                       resourceData.difficulty_level === 'intermediate' ? '中级' : '高级'}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        handleResourceInteraction(resourceData.id as number, 'view')
                        window.open(resourceData.url as string, '_blank')
                      }}
                      className="flex-1"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      查看
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResourceInteraction(resourceData.id as number, 'complete')}
                    >
                      <CheckCircle className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Recommendation Reason (if available) */}
                  {Boolean(resourceData.recommendation_reason) && (
                    <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      💡 {resourceData.recommendation_reason as string}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
