import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 获取个性化资源推荐
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const obstacleType = searchParams.get('obstacleType') // eslint-disable-line @typescript-eslint/no-unused-vars
    const difficulty = searchParams.get('difficulty') // eslint-disable-line @typescript-eslint/no-unused-vars
    const resourceType = searchParams.get('resourceType') // eslint-disable-line @typescript-eslint/no-unused-vars
    const platform = searchParams.get('platform') // eslint-disable-line @typescript-eslint/no-unused-vars
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Authentication failed: ' + authError.message }, { status: 401 })
    }

    if (!user) {
      console.error('No user found')
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // 获取用户学习偏好
    const { data: preferences, error: preferencesError } = await supabase // eslint-disable-line @typescript-eslint/no-unused-vars
      .from('user_learning_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 如果没有偏好记录，忽略错误继续执行
    if (preferencesError && preferencesError.code !== 'PGRST116') {
      console.error('Preferences query error:', preferencesError)
    }

    // 获取用户历史交互
    const { data: interactions, error: interactionsError } = await supabase // eslint-disable-line @typescript-eslint/no-unused-vars
      .from('user_resource_interactions')
      .select('resource_id, interaction_type, rating')
      .eq('user_id', user.id)

    if (interactionsError) {
      console.error('Interactions query error:', interactionsError)
    }

    // 构建推荐查询 - 先使用最简单的查询
    const query = supabase
      .from('learning_resources')
      .select('*')
      .eq('status', 'active')
      .order('quality_score', { ascending: false })
      .limit(limit)

    console.log('Executing basic query for active resources...')

    const { data: candidateResources, error: resourcesError } = await query

    if (resourcesError) {
      console.error('Resources query error:', resourcesError)
      return NextResponse.json({
        error: 'Failed to fetch resources',
        details: resourcesError.message,
        code: resourcesError.code
      }, { status: 500 })
    }

    console.log('Found candidate resources:', candidateResources?.length || 0)

    // 如果没有候选资源，返回空结果
    if (!candidateResources || candidateResources.length === 0) {
      return NextResponse.json({
        success: true,
        recommendations: [],
        total: 0,
        message: 'No resources found matching criteria'
      })
    }

    console.log('Successfully fetched resources:', candidateResources.length)

    // 暂时直接返回资源，不进行复杂的评分计算
    return NextResponse.json({
      success: true,
      recommendations: candidateResources,
      total: candidateResources.length
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
