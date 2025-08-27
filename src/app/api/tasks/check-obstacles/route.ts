import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 主动检查任务障碍的API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取用户的长时间未完成任务
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: staleTasks, error: tasksError } = await supabase
      .from('daily_tasks')
      .select(`
        *,
        okrs!inner(objective, key_results)
      `)
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .lt('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(5)

    if (tasksError) {
      console.error('Stale tasks query error:', tasksError)
      return NextResponse.json({ error: 'Failed to check tasks' }, { status: 500 })
    }

    if (!staleTasks || staleTasks.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No stale tasks found',
        suggestions: []
      })
    }

    // 检查这些任务是否已经有障碍记录
    const taskIds = staleTasks.map(task => task.id)
    const { data: existingObstacles } = await supabase
      .from('task_obstacles')
      .select('task_id')
      .in('task_id', taskIds)
      .eq('user_id', user.id)

    const existingObstacleTaskIds = new Set(existingObstacles?.map(o => o.task_id) || [])

    // 过滤出没有障碍记录的任务
    const tasksNeedingAttention = staleTasks.filter(task => 
      !existingObstacleTaskIds.has(task.id)
    )

    if (tasksNeedingAttention.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All stale tasks already have obstacle records',
        suggestions: []
      })
    }

    // 生成主动诊断建议
    const suggestions = tasksNeedingAttention.map(task => ({
      taskId: task.id,
      taskTitle: task.title,
      daysSinceCreated: Math.floor((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      suggestedObstacleTypes: suggestObstacleTypes(task),
      message: generateProactiveMessage(task)
    }))

    return NextResponse.json({ 
      success: true, 
      suggestions,
      message: `发现 ${suggestions.length} 个可能需要帮助的任务`
    })

  } catch (error) {
    console.error('Error in obstacle check API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 根据任务特征建议可能的障碍类型
function suggestObstacleTypes(task: Record<string, unknown>) {
  const suggestions = []
  
  // 根据任务创建时间推测可能的障碍
  const daysSinceCreated = Math.floor((Date.now() - new Date(task.created_at as string).getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceCreated >= 7) {
    suggestions.push('motivation') // 长时间未完成可能是动机问题
  }
  
  if (daysSinceCreated >= 5) {
    suggestions.push('time_management') // 可能是时间管理问题
  }
  
  // 根据任务标题关键词推测
  const title = (task.title as string).toLowerCase()
  
  if (title.includes('学习') || title.includes('掌握') || title.includes('理解')) {
    suggestions.push('knowledge_gap')
  }
  
  if (title.includes('编程') || title.includes('代码') || title.includes('技术')) {
    suggestions.push('technical_issue')
  }
  
  if (title.includes('资料') || title.includes('工具') || title.includes('环境')) {
    suggestions.push('resource_lack')
  }
  
  // 如果没有特定建议，默认推荐时间管理
  if (suggestions.length === 0) {
    suggestions.push('time_management')
  }
  
  return suggestions
}

// 生成主动关怀消息
function generateProactiveMessage(task: Record<string, unknown>) {
  const daysSinceCreated = Math.floor((Date.now() - new Date(task.created_at as string).getTime()) / (1000 * 60 * 60 * 24))
  const title = task.title as string
  
  if (daysSinceCreated >= 7) {
    return `任务"${title}"已经创建了${daysSinceCreated}天，是否遇到了什么困难？我可以帮你分析一下可能的障碍并提供解决方案。`
  } else if (daysSinceCreated >= 5) {
    return `注意到任务"${title}"已经${daysSinceCreated}天了，需要我帮你分析一下可能遇到的问题吗？`
  } else if (daysSinceCreated >= 3) {
    return `任务"${title}"看起来进展缓慢，要不要我帮你看看可能的原因？`
  } else {
    return `任务"${title}"需要一些帮助吗？我可以协助分析可能的障碍。`
  }
}
