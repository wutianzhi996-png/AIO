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

    // 使用视图查询今日任务
    const { data: tasks, error: tasksError } = await supabase
      .from('today_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('task_date', date)
      .eq('task_type', taskType)
      .order('priority', { ascending: true })

    if (tasksError) {
      console.error('Tasks query error:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      tasks: tasks || [],
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

    const updateData: Record<string, unknown> = { status }
    
    // 如果任务完成，记录完成时间
    if (status === 'completed') {
      updateData.completed_at = completedAt || new Date().toISOString()
    } else if (status === 'pending' || status === 'in_progress') {
      // 如果重新开始任务，清除完成时间
      updateData.completed_at = null
    }

    const { data, error: updateError } = await supabase
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

    return NextResponse.json({ 
      success: true, 
      task: data,
      message: 'Task updated successfully'
    })

  } catch (error) {
    console.error('Error in tasks PATCH API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
