import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 获取任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const taskType = searchParams.get('type') || 'daily'
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 先检查daily_tasks表是否存在
    const { error: tableError } = await supabase
      .from('daily_tasks')
      .select('id')
      .limit(1)

    if (tableError) {
      console.error('Table check error:', tableError)
      // 如果表不存在，返回友好的错误信息
      if (tableError.code === 'PGRST116' || tableError.message.includes('does not exist')) {
        return NextResponse.json({
          error: '任务管理功能尚未启用，请先在数据库中创建相关表结构',
          needsSetup: true
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // 查询今日任务 (直接查询表而不是视图)
    const { data: tasks, error: tasksError } = await supabase
      .from('daily_tasks')
      .select(`
        *,
        okrs!inner(objective, key_results)
      `)
      .eq('user_id', user.id)
      .eq('task_date', date)
      .eq('task_type', taskType)
      .order('priority', { ascending: true })

    if (tasksError) {
      console.error('Tasks query error:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // 处理关联的关键结果信息
    const processedTasks = tasks?.map(task => ({
      ...task,
      objective: task.okrs?.objective,
      related_key_result: task.key_result_index !== null && task.okrs?.key_results?.[task.key_result_index]
        ? task.okrs.key_results[task.key_result_index].text
        : null
    })) || []

    return NextResponse.json({
      success: true,
      tasks: processedTasks,
      date,
      taskType
    })

  } catch (error) {
    console.error('Error in tasks GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 更新任务状态
export async function PATCH(request: NextRequest) {
  try {
    const { taskId, status, completedAt } = await request.json()

    if (!taskId || !status) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 首先获取任务信息，包括关联的OKR信息
    const { data: task, error: taskError } = await supabase
      .from('daily_tasks')
      .select(`
        *,
        okrs!inner(id, objective, key_results)
      `)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { status }

    // 如果任务完成，记录完成时间
    if (status === 'completed') {
      updateData.completed_at = completedAt || new Date().toISOString()
    } else if (status === 'pending' || status === 'in_progress') {
      // 如果重新开始任务，清除完成时间
      updateData.completed_at = null
    }

    // 更新任务状态
    const { data: updatedTask, error: updateError } = await supabase
      .from('daily_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Task update error:', updateError)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    // 如果任务完成且有关联的关键结果，更新OKR进度
    if (status === 'completed' && task.key_result_index !== null && task.progress_contribution > 0) {
      try {
        await updateOKRProgress(supabase, task, user.id)
      } catch (progressError) {
        console.error('Error updating OKR progress:', progressError)
        // 不因为进度更新失败而影响任务状态更新
      }
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: 'Task updated successfully'
    })

  } catch (error) {
    console.error('Error in tasks PATCH API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 更新OKR进度的辅助函数
async function updateOKRProgress(supabase: Awaited<ReturnType<typeof createClient>>, task: Record<string, unknown>, userId: string) {
  const okr = (task as { okrs: { id: string; objective: string; key_results: Array<{ text: string; progress?: number; progress_description?: string; last_updated?: string; completed?: boolean }> } }).okrs
  const keyResultIndex = (task as { key_result_index: number }).key_result_index
  const progressContribution = (task as { progress_contribution?: number }).progress_contribution || 0

  if (!okr || keyResultIndex === null || progressContribution <= 0) {
    return
  }

  // 获取当前关键结果
  const currentKeyResult = okr.key_results[keyResultIndex]
  if (!currentKeyResult) {
    return
  }

  const currentProgress = currentKeyResult.progress || 0
  const newProgress = Math.min(100, currentProgress + progressContribution)

  // 更新关键结果进度
  const updatedKeyResults = [...okr.key_results]
  updatedKeyResults[keyResultIndex] = {
    ...updatedKeyResults[keyResultIndex],
    progress: newProgress,
    progress_description: `通过完成任务"${(task as { title: string }).title}"增加了${progressContribution}%进度`,
    last_updated: new Date().toISOString(),
    completed: newProgress >= 100
  }

  // 保存到数据库
  const { error: updateError } = await supabase
    .from('okrs')
    .update({ key_results: updatedKeyResults })
    .eq('id', okr.id)
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  // 保存进度历史记录
  try {
    await supabase
      .from('progress_history')
      .insert({
        user_id: userId,
        okr_id: okr.id,
        key_result_index: keyResultIndex,
        key_result_text: currentKeyResult.text,
        progress: newProgress,
        progress_description: `通过完成任务"${(task as { title: string }).title}"增加了${progressContribution}%进度`,
        previous_progress: currentProgress
      })
  } catch (historyError) {
    console.error('Error saving progress history:', historyError)
    // 不因为历史记录保存失败而影响主要功能
  }
}

// 创建新任务
export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      description, 
      okrId, 
      keyResultIndex, 
      priority = 3, 
      estimatedDuration = 60,
      taskType = 'daily',
      taskDate 
    } = await request.json()
    
    if (!title || !okrId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证OKR是否属于当前用户
    const { data: okr, error: okrError } = await supabase
      .from('okrs')
      .select('id, objective, key_results')
      .eq('id', okrId)
      .eq('user_id', user.id)
      .single()

    if (okrError || !okr) {
      return NextResponse.json({ error: 'Invalid OKR' }, { status: 400 })
    }

    const taskData = {
      user_id: user.id,
      okr_id: okrId,
      key_result_index: keyResultIndex,
      title,
      description,
      task_type: taskType,
      status: 'pending',
      priority: Math.max(1, Math.min(5, priority)),
      task_date: taskDate || new Date().toISOString().split('T')[0],
      estimated_duration: estimatedDuration,
      generated_by: 'user',
      generation_context: {
        userCreated: true,
        relatedOKR: okr.objective,
        relatedKR: keyResultIndex !== undefined ? 
          okr.key_results[keyResultIndex]?.text : null
      }
    }

    const { data, error: insertError } = await supabase
      .from('daily_tasks')
      .insert(taskData)
      .select()
      .single()

    if (insertError) {
      console.error('Task creation error:', insertError)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      task: data,
      message: 'Task created successfully'
    })

  } catch (error) {
    console.error('Error in tasks POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 删除任务
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    
    if (!taskId) {
      return NextResponse.json({ error: 'Missing task ID' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('daily_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Task deletion error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Task deleted successfully'
    })

  } catch (error) {
    console.error('Error in tasks DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
