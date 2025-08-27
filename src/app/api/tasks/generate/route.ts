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

    // 先检查daily_tasks表是否存在
    const { error: tableError } = await supabase
      .from('daily_tasks')
      .select('id')
      .limit(1)

    if (tableError) {
      console.error('Table check error:', tableError)
      if (tableError.code === 'PGRST116' || tableError.message.includes('does not exist')) {
        return NextResponse.json({
          error: '任务管理功能尚未启用，请先在数据库中创建daily_tasks表。请查看DATABASE_SETUP_GUIDE.md了解如何创建。',
          needsSetup: true
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

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
          .from('daily_tasks')
          .select(`
            *,
            okrs!inner(objective, key_results)
          `)
          .eq('user_id', user.id)
          .eq('task_date', today)
          .eq('task_type', taskType)
          .order('priority', { ascending: true })

        const processedTasks = existingTasks?.map(task => ({
          ...task,
          objective: task.okrs?.objective,
          related_key_result: task.key_result_index !== null && task.okrs?.key_results?.[task.key_result_index]
            ? task.okrs.key_results[task.key_result_index].text
            : null
        })) || []

        return NextResponse.json({
          success: true,
          tasks: processedTasks,
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
          content: '你是一个JSON API。只返回有效的JSON格式数据，不要任何解释或额外文字。根据用户的OKR目标生成学习任务列表。'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0].message.content || ''
    console.log('AI Response:', aiResponse)

    // 解析AI响应 - 改进的JSON提取逻辑
    let generatedTasks
    try {
      // 尝试直接解析
      generatedTasks = JSON.parse(aiResponse)
    } catch {
      console.error('Direct JSON parse failed, trying to extract JSON from response')

      // 尝试从响应中提取JSON
      try {
        // 查找JSON代码块
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                         aiResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                         aiResponse.match(/\{[\s\S]*\}/)

        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0]
          generatedTasks = JSON.parse(jsonStr)
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (extractError) {
        console.error('JSON extraction failed:', extractError)
        console.error('AI Response was:', aiResponse)

        // 如果AI解析失败，使用备用任务生成逻辑
        console.log('Using fallback task generation')
        generatedTasks = generateFallbackTasks(okrs, previousTasks, taskType)
      }
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

  return `你是一个专业的学习规划师。请基于用户的OKR目标生成今日学习任务。

用户OKR目标：
${JSON.stringify(okrSummary, null, 2)}

前一天任务完成情况：
${previousTasks ? JSON.stringify(previousTasksSummary, null, 2) : '无前一天任务记录'}

请生成3-4个具体可执行的${taskType === 'daily' ? '每日' : '每周'}任务，要求：
1. 任务与OKR关键结果直接相关
2. 优先级1-5（1最高）
3. 估算完成时间（分钟）
4. 设置进度贡献值（完成此任务对关键结果进度的贡献百分比，5-20%）
5. 任务具体可操作

**重要：只返回JSON格式，不要任何解释文字**

JSON格式：
{
  "tasks": [
    {
      "title": "具体任务标题",
      "description": "详细描述",
      "priority": 2,
      "estimatedDuration": 60,
      "relatedKRIndex": 0,
      "okrId": "${okrs[0] ? (okrs[0] as { id: string }).id : ''}",
      "progressContribution": 10
    }
  ]
}`
}

function generateFallbackTasks(
  okrs: Array<{ id: string; objective: string; key_results: Array<{ text: string; progress?: number }> }>,
  _previousTasks: Record<string, unknown>[] | null,
  _taskType: string
) {
  const tasks = []
  const mainOkr = okrs[0]

  if (!mainOkr) {
    return { tasks: [] }
  }

  // 为每个关键结果生成一个任务
  mainOkr.key_results.forEach((kr, index) => {
    const progress = kr.progress || 0
    let taskTitle = ''
    let description = ''
    let priority = 2

    if (progress < 25) {
      taskTitle = `开始学习：${kr.text.substring(0, 20)}...`
      description = `开始执行关键结果：${kr.text}`
      priority = 1
    } else if (progress < 75) {
      taskTitle = `继续推进：${kr.text.substring(0, 20)}...`
      description = `继续完成关键结果：${kr.text}`
      priority = 2
    } else {
      taskTitle = `完善提升：${kr.text.substring(0, 20)}...`
      description = `完善和提升关键结果：${kr.text}`
      priority = 3
    }

    // 计算进度贡献值
    let progressContribution = 10 // 默认贡献10%
    if (progress < 25) {
      progressContribution = 15 // 初期任务贡献更多
    } else if (progress < 75) {
      progressContribution = 10 // 中期任务正常贡献
    } else {
      progressContribution = 5 // 后期任务贡献较少
    }

    tasks.push({
      title: taskTitle,
      description: description,
      priority: priority,
      estimatedDuration: 60,
      relatedKRIndex: index,
      okrId: mainOkr.id,
      progressContribution: progressContribution
    })
  })

  // 如果关键结果少于3个，添加一个通用学习任务
  if (tasks.length < 3) {
    tasks.push({
      title: `学习规划：${mainOkr.objective}`,
      description: `制定详细的学习计划来实现目标：${mainOkr.objective}`,
      priority: 2,
      estimatedDuration: 45,
      relatedKRIndex: null,
      okrId: mainOkr.id,
      progressContribution: 5 // 通用任务贡献较少
    })
  }

  return { tasks: tasks.slice(0, 4) } // 最多返回4个任务
}

function processGeneratedTasks(
  generatedTasks: { tasks: Array<{ title: string; description?: string; priority?: number; estimatedDuration?: number; relatedKRIndex?: number; okrId?: string; progressContribution?: number }> },
  okrs: Array<{ id: string; objective: string; key_results: Array<{ text: string; progress?: number }> }>,
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

    // 计算进度贡献值
    let progressContribution = task.progressContribution || 10

    // 如果AI没有提供进度贡献值，根据关键结果当前进度智能计算
    if (!task.progressContribution && task.relatedKRIndex !== undefined) {
      const currentKR = relatedOKR.key_results[task.relatedKRIndex]
      const currentProgress = currentKR?.progress || 0

      if (currentProgress < 25) {
        progressContribution = 15 // 初期任务贡献更多
      } else if (currentProgress < 75) {
        progressContribution = 10 // 中期任务正常贡献
      } else {
        progressContribution = 5 // 后期任务贡献较少
      }
    }

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
      progress_contribution: progressContribution,
      generation_context: {
        aiGenerated: true,
        relatedOKR: relatedOKR.objective,
        relatedKR: task.relatedKRIndex !== undefined ?
          relatedOKR.key_results[task.relatedKRIndex]?.text : null
      }
    }
  })
}
