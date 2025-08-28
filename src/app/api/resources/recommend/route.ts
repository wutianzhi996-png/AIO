import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 获取个性化资源推荐
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const obstacleType = searchParams.get('obstacleType')
    const difficulty = searchParams.get('difficulty')
    const resourceType = searchParams.get('resourceType')
    const platform = searchParams.get('platform')
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取用户学习偏好
    const { data: preferences } = await supabase
      .from('user_learning_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 获取用户历史交互
    const { data: interactions } = await supabase
      .from('user_resource_interactions')
      .select('resource_id, interaction_type, rating')
      .eq('user_id', user.id)

    // 构建推荐查询
    let query = supabase
      .from('learning_resources')
      .select('*')
      .eq('status', 'active')

    // 应用筛选条件
    if (difficulty) {
      query = query.eq('difficulty_level', difficulty)
    } else if (preferences?.preferred_difficulty) {
      query = query.eq('difficulty_level', preferences.preferred_difficulty)
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    } else if (preferences?.preferred_resource_types?.length > 0) {
      query = query.in('resource_type', preferences.preferred_resource_types)
    }

    if (platform) {
      query = query.eq('platform', platform)
    } else if (preferences?.preferred_platforms?.length > 0) {
      query = query.in('platform', preferences.preferred_platforms)
    }

    if (preferences?.preferred_language) {
      query = query.eq('language', preferences.preferred_language)
    }

    // 基于障碍类型筛选
    if (obstacleType) {
      query = query.contains('content_features', { suitable_for_obstacles: [obstacleType] })
    }

    // 排除用户已完成的资源
    const completedResourceIds = interactions
      ?.filter(i => i.interaction_type === 'complete')
      ?.map(i => i.resource_id) || []

    if (completedResourceIds.length > 0) {
      query = query.not('id', 'in', `(${completedResourceIds.join(',')})`)
    }

    // 按质量评分排序
    query = query.order('quality_score', { ascending: false })
    query = query.limit(limit * 2) // 获取更多候选资源

    const { data: candidateResources, error: resourcesError } = await query

    if (resourcesError) {
      console.error('Resources query error:', resourcesError)
      return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 })
    }

    // 计算个性化推荐评分
    const recommendations = await calculateRecommendationScores(
      candidateResources || [],
      user.id,
      preferences,
      interactions || [],
      obstacleType
    )

    // 排序并限制结果数量
    const topRecommendations = recommendations
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit)

    // 保存推荐记录
    if (topRecommendations.length > 0) {
      const recommendationRecords = topRecommendations.map(rec => ({
        user_id: user.id,
        resource_id: (rec as Record<string, unknown>).id as number,
        recommendation_reason: (rec as Record<string, unknown>).recommendation_reason as string,
        relevance_score: (rec as Record<string, unknown>).relevance_score as number,
        obstacle_match: obstacleType
      }))

      await supabase
        .from('resource_recommendations')
        .upsert(recommendationRecords, { 
          onConflict: 'user_id,resource_id',
          ignoreDuplicates: false 
        })
    }

    return NextResponse.json({ 
      success: true, 
      recommendations: topRecommendations,
      total: topRecommendations.length
    })

  } catch (error) {
    console.error('Error in recommendation API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 计算个性化推荐评分
async function calculateRecommendationScores(
  resources: Record<string, unknown>[],
  userId: string,
  preferences: Record<string, unknown> | null,
  interactions: Record<string, unknown>[],
  obstacleType?: string | null
) {
  const userRatedResources = interactions.filter(i => (i as Record<string, unknown>).rating).reduce((acc, i) => {
    const interaction = i as Record<string, unknown>
    acc[interaction.resource_id as number] = interaction.rating as number
    return acc
  }, {} as Record<number, number>)

  return resources.map(resource => {
    let score = (resource.quality_score as number) || 50
    const reasons = []

    // 基础质量评分 (30%)
    reasons.push(`基础质量评分: ${resource.quality_score || 50}分`)

    // 障碍匹配度 (25%)
    const contentFeatures = (resource as Record<string, unknown>).content_features as Record<string, unknown> || {}
    const suitableObstacles = contentFeatures.suitable_for_obstacles as string[] || []
    if (obstacleType && suitableObstacles.includes(obstacleType)) {
      score += 20
      reasons.push(`适合解决${getObstacleTypeName(obstacleType)}问题`)
    }

    // 用户偏好匹配 (20%)
    if (preferences) {
      const resourceData = resource as Record<string, unknown>

      // 平台偏好
      const preferredPlatforms = preferences.preferred_platforms as string[] || []
      if (preferredPlatforms.includes(resourceData.platform as string)) {
        score += 10
        reasons.push(`符合平台偏好`)
      }

      // 资源类型偏好
      const preferredResourceTypes = preferences.preferred_resource_types as string[] || []
      if (preferredResourceTypes.includes(resourceData.resource_type as string)) {
        score += 10
        reasons.push(`符合资源类型偏好`)
      }

      // 难度偏好
      if (preferences.preferred_difficulty === resourceData.difficulty_level) {
        score += 10
        reasons.push(`难度级别匹配`)
      }

      // 兴趣主题匹配
      const topicsOfInterest = preferences.topics_of_interest as string[] || []
      const resourceTags = resourceData.tags as string[] || []
      const topicMatches = topicsOfInterest.filter(topic =>
        resourceTags.some(tag => tag.toLowerCase().includes(topic.toLowerCase()))
      )

      if (topicMatches.length > 0) {
        score += topicMatches.length * 5
        reasons.push(`匹配兴趣主题: ${topicMatches.join(', ')}`)
      }
    }

    // 协同过滤 (15%) - 基于相似用户的评分
    const ratingValues = Object.values(userRatedResources) as number[]
    const avgRating = ratingValues.length > 0 ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : 3
    const resourceRating = (resource as Record<string, unknown>).rating as number
    if (resourceRating && resourceRating > avgRating) {
      score += (resourceRating - avgRating) * 5
      reasons.push(`用户评分较高 (${resourceRating.toFixed(1)}星)`)
    }

    // 新颖性奖励 (10%) - 鼓励探索新内容
    const isNewContent = !interactions.some(i => (i as Record<string, unknown>).resource_id === (resource as Record<string, unknown>).id)
    if (isNewContent) {
      score += 5
      reasons.push(`新内容推荐`)
    }

    // 确保评分在合理范围内
    score = Math.max(0, Math.min(100, score))

    return {
      ...resource,
      relevance_score: Math.round(score),
      recommendation_reason: reasons.join('; ')
    }
  })
}

// 获取障碍类型的中文名称
function getObstacleTypeName(obstacleType: string): string {
  const typeNames: Record<string, string> = {
    'time_management': '时间管理',
    'knowledge_gap': '知识缺口',
    'motivation': '动机不足',
    'resource_lack': '资源不足',
    'technical_issue': '技术问题',
    'other': '其他'
  }
  return typeNames[obstacleType] || obstacleType
}

// 搜索学习资源
export async function POST(request: NextRequest) {
  try {
    const { query, filters = {} } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 构建搜索查询
    let searchQuery = supabase
      .from('learning_resources')
      .select('*')
      .eq('status', 'active')

    // 文本搜索 - 在标题、描述、标签中搜索
    searchQuery = searchQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`)

    // 应用筛选器
    if (filters.platform) {
      searchQuery = searchQuery.eq('platform', filters.platform)
    }
    if (filters.resource_type) {
      searchQuery = searchQuery.eq('resource_type', filters.resource_type)
    }
    if (filters.difficulty_level) {
      searchQuery = searchQuery.eq('difficulty_level', filters.difficulty_level)
    }
    if (filters.language) {
      searchQuery = searchQuery.eq('language', filters.language)
    }

    // 排序
    searchQuery = searchQuery.order('quality_score', { ascending: false })
    searchQuery = searchQuery.limit(20)

    const { data: resources, error: searchError } = await searchQuery

    if (searchError) {
      console.error('Search error:', searchError)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      resources: resources || [],
      total: resources?.length || 0
    })

  } catch (error) {
    console.error('Error in search API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
