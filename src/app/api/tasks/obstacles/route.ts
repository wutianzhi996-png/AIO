import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })
}

// 获取任务障碍列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const status = searchParams.get('status')
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('task_obstacles')
      .select(`
        *,
        daily_tasks!inner(id, title, status)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (taskId) {
      query = query.eq('task_id', taskId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: obstacles, error: obstaclesError } = await query

    if (obstaclesError) {
      console.error('Obstacles query error:', obstaclesError)
      return NextResponse.json({ error: 'Failed to fetch obstacles' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      obstacles: obstacles || []
    })

  } catch (error) {
    console.error('Error in obstacles GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 创建障碍报告和AI分析
export async function POST(request: NextRequest) {
  try {
    const { taskId, description, obstacleType = 'other' } = await request.json()
    
    if (!taskId || !description) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取任务信息
    const { data: task, error: taskError } = await supabase
      .from('daily_tasks')
      .select(`
        *,
        okrs!inner(objective, key_results)
      `)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 调用AI分析障碍
    const aiAnalysis = await analyzeObstacleWithAI(task, description, obstacleType)

    // 保存障碍记录
    const { data: obstacle, error: insertError } = await supabase
      .from('task_obstacles')
      .insert({
        user_id: user.id,
        task_id: taskId,
        obstacle_type: obstacleType,
        description: description,
        ai_analysis: aiAnalysis.analysis,
        suggested_solutions: aiAnalysis.solutions,
        status: 'identified'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Obstacle insertion error:', insertError)
      return NextResponse.json({ error: 'Failed to save obstacle' }, { status: 500 })
    }

    // 将任务状态更新为blocked
    await supabase
      .from('daily_tasks')
      .update({ status: 'blocked' })
      .eq('id', taskId)
      .eq('user_id', user.id)

    return NextResponse.json({ 
      success: true, 
      obstacle,
      message: 'Obstacle analyzed and solutions generated'
    })

  } catch (error) {
    console.error('Error in obstacles POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 更新障碍状态
export async function PATCH(request: NextRequest) {
  try {
    const { obstacleId, status, userFeedback, effectivenessRating } = await request.json()
    
    if (!obstacleId || !status) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const validStatuses = ['identified', 'in_progress', 'resolved', 'dismissed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updateData: Record<string, unknown> = { status }
    
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString()
    }

    if (userFeedback) {
      updateData.user_feedback = userFeedback
    }

    if (effectivenessRating) {
      updateData.effectiveness_rating = effectivenessRating
    }

    const { data: obstacle, error: updateError } = await supabase
      .from('task_obstacles')
      .update(updateData)
      .eq('id', obstacleId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Obstacle update error:', updateError)
      return NextResponse.json({ error: 'Failed to update obstacle' }, { status: 500 })
    }

    // 如果障碍已解决，将任务状态改回pending
    if (status === 'resolved') {
      await supabase
        .from('daily_tasks')
        .update({ status: 'pending' })
        .eq('id', obstacle.task_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ 
      success: true, 
      obstacle,
      message: 'Obstacle updated successfully'
    })

  } catch (error) {
    console.error('Error in obstacles PATCH API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// AI分析障碍的辅助函数
async function analyzeObstacleWithAI(task: Record<string, unknown>, description: string, obstacleType: string) {
  const openai = createOpenAIClient()

  const taskInfo = task as { title: string; description?: string; okrs?: { objective: string } }

  const prompt = `
作为一位专业的学习指导师，请分析以下学习任务遇到的障碍并提供解决方案。

## 任务信息：
- 任务标题：${taskInfo.title}
- 任务描述：${taskInfo.description || '无'}
- 关联目标：${taskInfo.okrs?.objective || '无'}
- 障碍类型：${obstacleType}

## 用户描述的障碍：
${description}

请提供：
1. 深度分析障碍的根本原因
2. 3-4个具体可行的解决方案

返回JSON格式：
{
  "analysis": "详细的障碍原因分析",
  "solutions": [
    {
      "title": "解决方案标题",
      "description": "详细描述",
      "priority": 1,
      "estimated_time": 30,
      "steps": ["步骤1", "步骤2", "步骤3"]
    }
  ]
}
`

  try {
    const completion = await openai.chat.completions.create({
      model: 'grok-2-1212',
      messages: [
        { 
          role: 'system', 
          content: '你是一位专业的学习指导师，擅长分析学习障碍并提供实用的解决方案。返回有效的JSON格式。' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0].message.content || ''
    
    try {
      return JSON.parse(aiResponse)
    } catch {
      // 如果AI响应解析失败，使用备用分析
      return generateFallbackAnalysis(obstacleType, description)
    }
  } catch (error) {
    console.error('AI analysis error:', error)
    return generateFallbackAnalysis(obstacleType, description)
  }
}

// 备用分析生成函数
function generateFallbackAnalysis(obstacleType: string, _description: string) {
  const analysisMap: Record<string, string> = {
    time_management: '时间管理问题通常源于缺乏明确的优先级设定和有效的时间规划技巧。',
    knowledge_gap: '知识缺口表明需要补充相关的基础知识或技能，建议系统性学习。',
    motivation: '动机不足可能与目标不够明确、缺乏成就感或外部压力过大有关。',
    resource_lack: '资源不足需要寻找替代方案或优化现有资源的使用效率。',
    technical_issue: '技术问题需要具体的技术支持和解决方案。',
    other: '需要进一步分析具体情况以确定最佳解决方案。'
  }

  const solutionsMap: Record<string, Array<{ title: string; description: string; priority: number; estimated_time: number; steps: string[] }>> = {
    time_management: [
      {
        title: '制定时间计划',
        description: '使用时间块规划法，将任务分解为具体的时间段',
        priority: 1,
        estimated_time: 30,
        steps: ['评估任务所需时间', '制定每日时间表', '设置提醒和检查点']
      }
    ],
    knowledge_gap: [
      {
        title: '系统性学习',
        description: '寻找相关的学习资源，建立知识体系',
        priority: 1,
        estimated_time: 120,
        steps: ['识别知识缺口', '寻找学习资源', '制定学习计划']
      }
    ],
    motivation: [
      {
        title: '重新设定目标',
        description: '明确学习目标的意义和价值，增强内在动机',
        priority: 1,
        estimated_time: 45,
        steps: ['反思学习目标', '设定小的里程碑', '建立奖励机制']
      }
    ]
  }

  return {
    analysis: analysisMap[obstacleType] || analysisMap.other,
    solutions: solutionsMap[obstacleType] || solutionsMap.time_management
  }
}
