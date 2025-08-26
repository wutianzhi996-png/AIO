import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()
    
    // 验证输入参数
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '请提供当前密码和新密码' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度至少6位' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证当前密码
    // 通过尝试使用当前密码重新登录来验证
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    if (signInError) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400 })
    }

    // 更新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ error: '密码更新失败，请重试' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: '密码修改成功' 
    })

  } catch (error) {
    console.error('Error in change-password API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
