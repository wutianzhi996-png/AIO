import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
})

export async function POST(request: NextRequest) {
  try {
    console.log('Generate OKR API called')
    const { objective } = await request.json()
    console.log('Objective:', objective)
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User:', user ? 'authenticated' : 'not authenticated')
    
    if (!user) {
      console.log('User not authenticated')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!objective || typeof objective !== 'string') {
      return NextResponse.json({ error: 'Valid objective is required' }, { status: 400 })
    }

    console.log('Making Grok API call for OKR generation...')
    
    const prompt = `作为学习规划专家，请为以下学习目标生成2个具体的、可衡量的关键结果(Key Results)。

学习目标: ${objective}

要求:
1. 关键结果必须具体、可衡量
2. 关键结果应该是可在合理时间内完成的
3. 关键结果要直接支持主目标的达成
4. 使用数字或明确的完成标准
5. 避免模糊的表述

请只返回2个关键结果，每行一个，不需要编号，格式如下:
完成xxx个具体任务
掌握xxx项具体技能`

    try {
      const completion = await openai.chat.completions.create({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: '你是一位专业的学习规划助手，擅长制定SMART目标和可衡量的关键结果。请用中文回答。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300,
      })
      
      console.log('Grok API response received for OKR generation')
      const response = completion.choices[0].message.content || ''
      
      // 解析返回的关键结果
      const keyResults = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.match(/^[\d.\-•]*$/)) // 过滤空行和纯编号
        .map(line => line.replace(/^[\d.\-•\s]*/, '')) // 移除开头的编号
        .filter(line => line.length > 5) // 过滤太短的内容
        .slice(0, 2) // 只取前2个

      console.log('Generated key results:', keyResults)

      if (keyResults.length === 0) {
        throw new Error('Failed to generate valid key results')
      }

      return NextResponse.json({ keyResults })
    } catch (grokError) {
      console.error('Grok API error for OKR generation:', grokError)
      return NextResponse.json({ 
        error: 'AI generation failed',
        details: grokError instanceof Error ? grokError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Generate OKR API error:', error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}