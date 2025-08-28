import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 记录用户资源交互
export async function POST(request: NextRequest) {
  try {
    const { 
      resourceId, 
      interactionType, 
      rating, 
      completionPercentage, 
      timeSpentMinutes, 
      feedback 
    } = await request.json()
    
    if (!resourceId || !interactionType) {
      return NextResponse.json({ error: 'Resource ID and interaction type are required' }, { status: 400 })
    }

    const validInteractionTypes = ['view', 'bookmark', 'complete', 'rate', 'share']
    if (!validInteractionTypes.includes(interactionType)) {
      return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 检查资源是否存在
    const { data: resource, error: resourceError } = await supabase
      .from('learning_resources')
      .select('id, title')
      .eq('id', resourceId)
      .single()

    if (resourceError || !resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    // 准备交互数据
    const interactionData: Record<string, unknown> = {
      user_id: user.id,
      resource_id: resourceId,
      interaction_type: interactionType
    }

    if (rating !== undefined) {
      interactionData.rating = rating
    }
    if (completionPercentage !== undefined) {
      interactionData.completion_percentage = completionPercentage
    }
    if (timeSpentMinutes !== undefined) {
      interactionData.time_spent_minutes = timeSpentMinutes
    }
    if (feedback) {
      interactionData.feedback = feedback
    }

    // 对于非view类型的交互，使用upsert避免重复记录
    let result
    if (interactionType === 'view') {
      // view类型允许多次记录
      const { data, error } = await supabase
        .from('user_resource_interactions')
        .insert(interactionData)
        .select()
        .single()
      result = { data, error }
    } else {
      // 其他类型使用upsert
      const { data, error } = await supabase
        .from('user_resource_interactions')
        .upsert(interactionData, { 
          onConflict: 'user_id,resource_id,interaction_type',
          ignoreDuplicates: false 
        })
        .select()
        .single()
      result = { data, error }
    }

    if (result.error) {
      console.error('Interaction insertion error:', result.error)
      return NextResponse.json({ error: 'Failed to record interaction' }, { status: 500 })
    }

    // 如果是评分交互，更新资源的平均评分
    if (interactionType === 'rate' && rating) {
      await updateResourceRating(supabase, resourceId)
    }

    // 如果是完成交互，更新用户学习偏好
    if (interactionType === 'complete') {
      await updateUserPreferences(supabase, user.id, resource)
    }

    return NextResponse.json({ 
      success: true, 
      interaction: result.data,
      message: 'Interaction recorded successfully'
    })

  } catch (error) {
    console.error('Error in interaction API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 获取用户的资源交互历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId')
    const interactionType = searchParams.get('interactionType')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('user_resource_interactions')
      .select(`
        *,
        learning_resources!inner(id, title, platform, resource_type, thumbnail_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }

    if (interactionType) {
      query = query.eq('interaction_type', interactionType)
    }

    const { data: interactions, error: interactionsError } = await query

    if (interactionsError) {
      console.error('Interactions query error:', interactionsError)
      return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      interactions: interactions || [],
      total: interactions?.length || 0
    })

  } catch (error) {
    console.error('Error in interactions GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 更新资源的平均评分
async function updateResourceRating(supabase: Awaited<ReturnType<typeof createClient>>, resourceId: number) {
  try {
    // 计算该资源的平均评分
    const { data: ratings } = await supabase
      .from('user_resource_interactions')
      .select('rating')
      .eq('resource_id', resourceId)
      .eq('interaction_type', 'rate')
      .not('rating', 'is', null)

    if (ratings && ratings.length > 0) {
      const avgRating = ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / ratings.length
      
      // 更新资源表中的评分
      await supabase
        .from('learning_resources')
        .update({ rating: Math.round(avgRating * 100) / 100 })
        .eq('id', resourceId)
    }
  } catch (error) {
    console.error('Error updating resource rating:', error)
  }
}

// 更新用户学习偏好
async function updateUserPreferences(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, resource: Record<string, unknown>) {
  try {
    // 获取当前用户偏好
    const { data: currentPrefs } = await supabase
      .from('user_learning_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!currentPrefs) {
      // 创建新的偏好记录
      await supabase
        .from('user_learning_preferences')
        .insert({
          user_id: userId,
          preferred_platforms: [resource.platform],
          preferred_resource_types: [resource.resource_type],
          preferred_difficulty: resource.difficulty_level,
          preferred_language: resource.language,
          topics_of_interest: resource.tags || []
        })
    } else {
      // 更新现有偏好
      const updatedPrefs: Record<string, unknown> = {}

      // 更新偏好平台
      if (!currentPrefs.preferred_platforms?.includes(resource.platform)) {
        updatedPrefs.preferred_platforms = [...(currentPrefs.preferred_platforms || []), resource.platform]
      }

      // 更新偏好资源类型
      if (!currentPrefs.preferred_resource_types?.includes(resource.resource_type)) {
        updatedPrefs.preferred_resource_types = [...(currentPrefs.preferred_resource_types || []), resource.resource_type]
      }

      // 更新兴趣主题
      const resourceTags = resource.tags as string[] || []
      const newTopics = resourceTags.filter((tag: string) =>
        !currentPrefs.topics_of_interest?.includes(tag)
      )
      
      if (newTopics.length > 0) {
        updatedPrefs.topics_of_interest = [...(currentPrefs.topics_of_interest || []), ...newTopics]
      }

      // 如果有更新，保存到数据库
      if (Object.keys(updatedPrefs).length > 0) {
        await supabase
          .from('user_learning_preferences')
          .update(updatedPrefs)
          .eq('user_id', userId)
      }
    }
  } catch (error) {
    console.error('Error updating user preferences:', error)
  }
}

// 删除交互记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const interactionId = searchParams.get('interactionId')
    
    if (!interactionId) {
      return NextResponse.json({ error: 'Interaction ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('user_resource_interactions')
      .delete()
      .eq('id', interactionId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Interaction deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete interaction' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Interaction deleted successfully'
    })

  } catch (error) {
    console.error('Error in interaction DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
