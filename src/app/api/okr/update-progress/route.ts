import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { okrId, keyResultIndex, progress, progressDescription } = await request.json()
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证输入参数
    if (!okrId || keyResultIndex === undefined || progress === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    if (progress < 0 || progress > 100) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 })
    }

    // 获取当前OKR
    const { data: okr, error: fetchError } = await supabase
      .from('okrs')
      .select('*')
      .eq('id', okrId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !okr) {
      return NextResponse.json({ error: 'OKR not found' }, { status: 404 })
    }

    // 验证关键结果索引
    if (keyResultIndex < 0 || keyResultIndex >= okr.key_results.length) {
      return NextResponse.json({ error: 'Invalid key result index' }, { status: 400 })
    }

    // 更新关键结果进度
    const updatedKeyResults = [...okr.key_results]
    updatedKeyResults[keyResultIndex] = {
      ...updatedKeyResults[keyResultIndex],
      progress: progress,
      progress_description: progressDescription || '',
      last_updated: new Date().toISOString(),
      completed: progress >= 100
    }

    // 保存到数据库
    const { data, error: updateError } = await supabase
      .from('okrs')
      .update({ key_results: updatedKeyResults })
      .eq('id', okrId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating OKR progress:', updateError)
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: data,
      message: 'Progress updated successfully' 
    })

  } catch (error) {
    console.error('Error in update-progress API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 批量更新进度的API
export async function PUT(request: NextRequest) {
  try {
    const { okrId, progressUpdates } = await request.json()
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证输入参数
    if (!okrId || !Array.isArray(progressUpdates)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 获取当前OKR
    const { data: okr, error: fetchError } = await supabase
      .from('okrs')
      .select('*')
      .eq('id', okrId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !okr) {
      return NextResponse.json({ error: 'OKR not found' }, { status: 404 })
    }

    // 批量更新关键结果进度
    const updatedKeyResults = [...okr.key_results]
    const currentTime = new Date().toISOString()

    for (const update of progressUpdates) {
      const { keyResultIndex, progress, progressDescription } = update
      
      // 验证每个更新
      if (keyResultIndex < 0 || keyResultIndex >= updatedKeyResults.length) {
        continue // 跳过无效的索引
      }
      
      if (progress < 0 || progress > 100) {
        continue // 跳过无效的进度值
      }

      updatedKeyResults[keyResultIndex] = {
        ...updatedKeyResults[keyResultIndex],
        progress: progress,
        progress_description: progressDescription || '',
        last_updated: currentTime,
        completed: progress >= 100
      }
    }

    // 保存到数据库
    const { data, error: updateError } = await supabase
      .from('okrs')
      .update({ key_results: updatedKeyResults })
      .eq('id', okrId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error batch updating OKR progress:', updateError)
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: data,
      message: 'Progress updated successfully' 
    })

  } catch (error) {
    console.error('Error in batch update-progress API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
