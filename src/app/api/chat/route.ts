import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Save user message
    await supabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        message: { role: 'user', content: message }
      })

    let response: string
    
    // Check if this is a daily task request
    if (message.toLowerCase().includes('今天') && message.toLowerCase().includes('做什么')) {
      // Get user's OKR
      const { data: okrs } = await supabase
        .from('okrs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const userOKR = okrs?.[0]
      
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
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: taskPrompt }],
          temperature: 0.7,
        })

        response = completion.choices[0].message.content || '抱歉，无法生成今日任务。'
      } else {
        response = '您还没有设定OKR目标，请先创建您的学习目标，我才能为您推荐今日任务。'
      }
    } else {
      // Knowledge-based Q&A using RAG
      try {
        // Get embedding for the query
        const embeddingResponse = await fetch(`${request.nextUrl.origin}/api/embedding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message })
        })
        
        if (!embeddingResponse.ok) {
          throw new Error('Failed to get embedding')
        }
        
        const { embedding } = await embeddingResponse.json()

        // Search for relevant knowledge chunks
        const { data: knowledgeChunks } = await supabase.rpc('match_documents', {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 3
        })

        let context = ''
        if (knowledgeChunks && knowledgeChunks.length > 0) {
          context = knowledgeChunks.map((chunk: { content: string }) => chunk.content).join('\n\n')
        }

        const systemPrompt = context 
          ? `你是一位专业的学习助手。请基于以下知识库内容回答用户的问题。如果知识库中没有相关信息，请说明并提供一般性的建议。

知识库内容：
${context}

请用中文回答，语言要清晰易懂。`
          : '你是一位专业的学习助手。请用中文回答用户的问题，语言要清晰易懂。'

        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
        })

        response = completion.choices[0].message.content || '抱歉，我无法理解您的问题。'
      } catch (error) {
        console.error('RAG error:', error)
        // Fallback to general response
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: '你是一位专业的学习助手。请用中文回答用户的问题，语言要清晰易懂。' },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
        })

        response = completion.choices[0].message.content || '抱歉，我无法理解您的问题。'
      }
    }

    // Save assistant response
    await supabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        message: { role: 'assistant', content: response }
      })

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}