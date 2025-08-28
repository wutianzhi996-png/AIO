import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 测试资源推荐功能
export async function GET() {
  try {
    const supabase = await createClient()
    
    // 测试数据库连接
    const { data: resources, error: resourcesError } = await supabase
      .from('learning_resources')
      .select('*')
      .eq('status', 'active')
      .limit(5)

    if (resourcesError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database error: ' + resourcesError.message,
        details: resourcesError
      }, { status: 500 })
    }

    // 测试用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    return NextResponse.json({ 
      success: true,
      message: 'Resources API test successful',
      data: {
        resourcesCount: resources?.length || 0,
        resources: resources,
        userAuthenticated: !!user,
        authError: authError?.message || null
      }
    })

  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
