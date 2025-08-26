import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const okrId = searchParams.get('okrId')
    const keyResultIndex = searchParams.get('keyResultIndex')
    
    if (!okrId || keyResultIndex === null) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 查询进度历史记录
    const { data: history, error: historyError } = await supabase
      .from('progress_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('okr_id', okrId)
      .eq('key_result_index', parseInt(keyResultIndex))
      .order('created_at', { ascending: false })
      .limit(50) // 限制最多返回50条记录

    if (historyError) {
      console.error('Error fetching progress history:', historyError)
      return NextResponse.json({ error: 'Failed to fetch progress history' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: history || []
    })

  } catch (error) {
    console.error('Error in progress-history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      okrId, 
      keyResultIndex, 
      keyResultText, 
      progress, 
      progressDescription, 
      previousProgress 
    } = await request.json()
    
    if (!okrId || keyResultIndex === undefined || progress === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 插入进度历史记录
    const { data, error: insertError } = await supabase
      .from('progress_history')
      .insert({
        user_id: user.id,
        okr_id: okrId,
        key_result_index: keyResultIndex,
        key_result_text: keyResultText,
        progress: progress,
        progress_description: progressDescription,
        previous_progress: previousProgress
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting progress history:', insertError)
      return NextResponse.json({ error: 'Failed to save progress history' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: data
    })

  } catch (error) {
    console.error('Error in progress-history POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
