import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })
}

export async function POST(request: NextRequest) {
  try {
    const { taskType = 'daily', forceRegenerate = false } = await request.json()
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]
    
    // 检查今天是否已经生成过任务
    if (!forceRegenerate) {
      const { data: existingLog } = await supabase
        .from('task_generation_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('generation_date', today)
        .eq('generation_type', taskType)
        .single()

      if (existingLog) {
        // 返回已生成的任务
        const { data: existingTasks } = await supabase
          .from('today_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('task_date', today)
          .eq('task_type', taskType)
          .order('priority', { ascending: true })

        return NextResponse.json({ 
          success: true, 
          tasks: existingTasks || [],
          message: '今日任务已存在',
          regenerated: false
        })
      }
    }

    // 获取用户的OKR
    const { data: okrs, error: okrError } = await supabase
      .from('okrs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3) // 获取最近3个OKR

    if (okrError || !okrs || okrs.length === 0) {
      return NextResponse.json({ 
        error: '请先创建OKR目标才能生成学习任务' 
      }, { status: 400 })
    }

    // 获取前一天的任务状态
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: previousTasks } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('task_date', yesterdayStr)
      .order('priority', { ascending: true })

    // 构建AI提示词
    const prompt = buildTaskGenerationPrompt(okrs, previousTasks, taskType)

    // 调用AI生成任务
    const openai = createOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'grok-2-1212',
      messages: [
        { 
          role: 'system', 
          content: '你是一位专业的学习规划师。请根据用户的OKR目标和前一天的任务完成情况，生成合理的学习任务。返回的结果必须是有效的JSON格式。' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0].message.content || ''
    
    // 解析AI响应
    let generatedTasks
    try {
      generatedTasks = JSON.parse(aiResponse)
    } catch (parseError) {
      console.error('AI response parsing error:', parseError)
      return NextResponse.json({ 
        error: 'AI响应格式错误，请重试' 
      }, { status: 500 })
    }

    // 验证和处理生成的任务
    const tasksToInsert = processGeneratedTasks(generatedTasks, okrs, user.id, today, taskType)

    // 保存任务到数据库
    const { data: insertedTasks, error: insertError } = await supabase
      .from('daily_tasks')
      .insert(tasksToInsert)
      .select()

    if (insertError) {
      console.error('Task insertion error:', insertError)
      return NextResponse.json({ 
        error: '任务保存失败，请重试' 
      }, { status: 500 })
    }

    // 记录生成日志
    await supabase
      .from('task_generation_logs')
      .insert({
        user_id: user.id,
        generation_date: today,
        generation_type: taskType,
        okr_snapshot: okrs,
        previous_tasks_snapshot: previousTasks,
        generated_tasks_count: tasksToInsert.length,
        generation_prompt: prompt,
        ai_response: aiResponse
      })

    // 如果有前一天未完成的任务，标记为失败
    if (previousTasks && previousTasks.length > 0) {
      const incompleteTasks = previousTasks.filter(task => 
        task.status === 'pending' || task.status === 'in_progress'
      )
      
      if (incompleteTasks.length > 0) {
        await supabase
          .from('daily_tasks')
          .update({ status: 'failed' })
          .in('id', incompleteTasks.map(task => task.id))
      }
    }

    return NextResponse.json({ 
      success: true, 
      tasks: insertedTasks,
      message: `成功生成${insertedTasks.length}个${taskType === 'daily' ? '每日' : '每周'}任务`,
      regenerated: forceRegenerate
    })

  } catch (error) {
    console.error('Error in task generation API:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

function buildTaskGenerationPrompt(okrs: Record<string, unknown>[], previousTasks: Record<string, unknown>[] | null, taskType: string) {
  const okrSummary = okrs.map(okr => ({
    objective: (okr as { objective: string }).objective,
    keyResults: ((okr as { key_results: Array<{ text: string; progress?: number }> }).key_results || []).map((kr, index: number) => ({
      index,
      text: kr.text,
      progress: kr.progress || 0
    }))
  }))

  const previousTasksSummary = previousTasks ? previousTasks.map(task => ({
    title: task.title,
    status: task.status,
    priority: task.priority,
    relatedKR: task.key_result_index
  })) : []

  return `
请基于以下信息生成${taskType === 'daily' ? '今日' : '本周'}的学习任务：

## 用户的OKR目标：
${JSON.stringify(okrSummary, null, 2)}

## 前一天的任务完成情况：
${previousTasks ? JSON.stringify(previousTasksSummary, null, 2) : '无前一天任务记录'}

## 任务生成要求：
1. 生成3-5个具体可执行的${taskType === 'daily' ? '每日' : '每周'}任务
2. 任务必须与OKR的关键结果直接相关
3. 考虑前一天未完成任务的延续性
4. 设置合理的优先级(1-5，1最高)
5. 估算每个任务的完成时间(分钟)
6. 任务描述要具体明确，可操作性强

## 返回格式(严格JSON)：
{
  "tasks": [
    {
      "title": "任务标题",
      "description": "详细描述",
      "priority": 1,
      "estimatedDuration": 60,
      "relatedKRIndex": 0,
      "okrId": "对应的OKR ID"
    }
  ]
}

请确保返回的是有效的JSON格式，不要包含任何其他文字。
`
}

function processGeneratedTasks(
  generatedTasks: { tasks: Array<{ title: string; description?: string; priority?: number; estimatedDuration?: number; relatedKRIndex?: number; okrId?: string }> },
  okrs: Array<{ id: string; objective: string; key_results: Array<{ text: string }> }>,
  userId: string,
  taskDate: string,
  taskType: string
) {
  if (!generatedTasks.tasks || !Array.isArray(generatedTasks.tasks)) {
    throw new Error('Invalid task format')
  }

  return generatedTasks.tasks.map((task) => {
    // 找到对应的OKR
    const relatedOKR = okrs.find(okr => okr.id === task.okrId) || okrs[0]
    
    return {
      user_id: userId,
      okr_id: relatedOKR.id,
      key_result_index: task.relatedKRIndex,
      title: task.title,
      description: task.description,
      task_type: taskType,
      status: 'pending',
      priority: Math.max(1, Math.min(5, task.priority || 3)),
      task_date: taskDate,
      estimated_duration: task.estimatedDuration || 60,
      generated_by: 'ai',
      generation_context: {
        aiGenerated: true,
        relatedOKR: relatedOKR.objective,
        relatedKR: task.relatedKRIndex !== undefined ? 
          relatedOKR.key_results[task.relatedKRIndex]?.text : null
      }
    }
  })
}
