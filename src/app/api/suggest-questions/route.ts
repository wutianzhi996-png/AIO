import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取用户最近的聊天历史
    const { data: chatHistory, error: historyError } = await supabase
      .from('chat_history')
      .select('message')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20) // 获取最近20条消息

    if (historyError) {
      console.error('Error fetching chat history:', historyError)
      return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 })
    }

    // 提取用户消息
    const userMessages = (chatHistory || [])
      .filter(item => item.message?.role === 'user')
      .map(item => item.message?.content || '')
      .filter(content => content.length > 0)
      .slice(0, 10) // 只分析最近10条用户消息

    if (userMessages.length === 0) {
      // 如果没有历史消息，返回默认推荐问题
      const defaultSuggestions = [
        "今天我该做什么？",
        "帮我制定一个学习计划",
        "我的学习进度如何？",
        "有什么好的学习方法推荐？",
        "如何提高学习效率？"
      ]
      return NextResponse.json({ suggestions: defaultSuggestions })
    }

    // 分析用户消息模式并生成推荐
    const suggestions = await generateSuggestions(userMessages)
    
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error in suggest-questions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateSuggestions(userMessages: string[]): Promise<string[]> {
  try {
    // 分析消息中的关键词和模式
    const messageText = userMessages.join(' ')
    
    // 基于关键词的推荐逻辑
    const suggestions: string[] = []
    
    // 学习相关关键词
    if (messageText.includes('学习') || messageText.includes('复习') || messageText.includes('课程')) {
      suggestions.push('如何制定有效的学习计划？')
      suggestions.push('有什么好的记忆技巧？')
      suggestions.push('怎样保持学习动力？')
    }
    
    // 时间管理相关
    if (messageText.includes('时间') || messageText.includes('计划') || messageText.includes('安排')) {
      suggestions.push('如何更好地管理时间？')
      suggestions.push('怎样避免拖延症？')
      suggestions.push('如何平衡学习和休息？')
    }
    
    // 考试相关
    if (messageText.includes('考试') || messageText.includes('测试') || messageText.includes('成绩')) {
      suggestions.push('考试前如何复习最有效？')
      suggestions.push('如何克服考试焦虑？')
      suggestions.push('怎样分析错题？')
    }
    
    // 技能学习相关
    if (messageText.includes('编程') || messageText.includes('代码') || messageText.includes('技术')) {
      suggestions.push('如何提高编程能力？')
      suggestions.push('学习新技术的最佳方法？')
      suggestions.push('如何做技术项目？')
    }
    
    // 目标和进度相关
    if (messageText.includes('目标') || messageText.includes('进度') || messageText.includes('OKR')) {
      suggestions.push('如何设定合理的学习目标？')
      suggestions.push('怎样跟踪学习进度？')
      suggestions.push('如何调整学习计划？')
    }
    
    // 如果没有匹配的关键词，使用通用推荐
    if (suggestions.length === 0) {
      suggestions.push('我需要学习建议')
      suggestions.push('帮我分析学习情况')
      suggestions.push('推荐一些学习资源')
      suggestions.push('如何提高学习效果？')
      suggestions.push('制定今天的学习任务')
    }
    
    // 添加一些基于最近消息的连贯性推荐
    const lastMessage = userMessages[0]
    if (lastMessage) {
      if (lastMessage.includes('？') || lastMessage.includes('?')) {
        suggestions.push('继续深入这个话题')
        suggestions.push('给我更多相关建议')
      }
      if (lastMessage.includes('如何') || lastMessage.includes('怎么')) {
        suggestions.push('有什么具体的步骤？')
        suggestions.push('需要注意什么？')
      }
    }
    
    // 去重并限制到5个
    const uniqueSuggestions = Array.from(new Set(suggestions))
    return uniqueSuggestions.slice(0, 5)
  } catch (error) {
    console.error('Error generating suggestions:', error)
    // 返回默认推荐
    return [
      "今天我该做什么？",
      "帮我制定学习计划",
      "如何提高学习效率？",
      "推荐一些学习方法",
      "我的学习进度怎么样？"
    ]
  }
}