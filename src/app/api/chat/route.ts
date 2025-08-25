import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
})

export async function POST(request: NextRequest) {
  try {
    console.log('Chat API called')
    const { message, sessionId } = await request.json()
    console.log('Message:', message)
    console.log('SessionId:', sessionId)
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User:', user ? 'authenticated' : 'not authenticated')
    
    if (!user) {
      console.log('User not authenticated')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Save user message (optional - continue even if it fails)
    try {
      await supabase
        .from('chat_history')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          message: { role: 'user', content: message }
        })
    } catch (error) {
      console.log('Failed to save user message to database:', error)
    }

    let response: string
    
    // Check if this is a daily task request
    if (message.toLowerCase().includes('今天') && message.toLowerCase().includes('做什么')) {
      // Get user's OKR (optional - continue even if it fails)
      let userOKR = null
      try {
        const { data: okrs } = await supabase
          .from('okrs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
        userOKR = okrs?.[0]
      } catch (error) {
        console.log('Failed to fetch user OKR from database:', error)
      }
      
      if (userOKR) {
        const taskPrompt = `基于用户的OKR目标，为今天生成3个具体的任务建议。

目标(O): ${userOKR.objective}
关键结果(KR): ${userOKR.key_results.map((kr: { text: string }, i: number) => `${i + 1}. ${kr.text}`).join('\n')}

请生成今日任务，格式如下：
1. [具体任务1]
2. [具体任务2] 
3. [具体任务3]

任务要具体可执行，与OKR直接相关。`

        const completion = await openai.chat.completions.create({
          model: 'grok-2-1212',
          messages: [{ role: 'user', content: taskPrompt }],
          temperature: 0.7,
        })

        response = completion.choices[0].message.content || '抱歉，无法生成今日任务。'
      } else {
        response = '您还没有设定OKR目标，请先创建您的学习目标，我才能为您推荐今日任务。'
      }
    } else {
      // Direct chat with Grok
      console.log('Making Grok API call...')
      try {
        const completion = await openai.chat.completions.create({
          model: 'grok-2-1212',
          messages: [
            { role: 'system', content: '你是一位专业的学习助手。请用中文回答用户的问题，语言要清晰易懂，提供实用的学习建议和帮助。' },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
        })
        console.log('Grok API response received')
        response = completion.choices[0].message.content || '抱歉，我无法理解您的问题。'
      } catch (grokError) {
        console.error('Grok API error:', grokError)
        response = `Grok API 调用失败: ${grokError.message || 'Unknown error'}`
      }
    }

    // Save assistant response (optional - continue even if it fails)
    try {
      await supabase
        .from('chat_history')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          message: { role: 'assistant', content: response }
        })
    } catch (error) {
      console.log('Failed to save assistant response to database:', error)
    }

    console.log('Returning response:', response)
    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat API error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}