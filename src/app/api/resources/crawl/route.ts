import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })
}

// 资源爬取和分析API
export async function POST(request: NextRequest) {
  try {
    const { url, platform } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 检查资源是否已存在
    const { data: existingResource } = await supabase
      .from('learning_resources')
      .select('id')
      .eq('url', url)
      .single()

    if (existingResource) {
      return NextResponse.json({ 
        success: true, 
        message: 'Resource already exists',
        resource_id: existingResource.id 
      })
    }

    // 根据URL分析平台类型
    const detectedPlatform = detectPlatform(url)
    const finalPlatform = platform || detectedPlatform

    // 爬取和分析资源
    const resourceData = await crawlAndAnalyzeResource(url, finalPlatform)

    // 保存到数据库
    const { data: resource, error: insertError } = await supabase
      .from('learning_resources')
      .insert({
        title: resourceData.title,
        description: resourceData.description,
        url: url,
        platform: finalPlatform,
        resource_type: resourceData.resource_type,
        difficulty_level: resourceData.difficulty_level,
        duration_minutes: resourceData.duration_minutes,
        language: resourceData.language,
        tags: resourceData.tags,
        author: resourceData.author,
        thumbnail_url: resourceData.thumbnail_url,
        content_features: resourceData.content_features,
        quality_score: resourceData.quality_score,
        status: 'active'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Resource insertion error:', insertError)
      return NextResponse.json({ error: 'Failed to save resource' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      resource,
      message: 'Resource crawled and analyzed successfully'
    })

  } catch (error) {
    console.error('Error in resource crawl API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 批量添加预设资源
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 预设的高质量学习资源
    const presetResources = [
      {
        title: "JavaScript 基础教程 - MDN Web Docs",
        description: "Mozilla 官方的 JavaScript 完整教程，从基础语法到高级特性",
        url: "https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide",
        platform: "documentation",
        resource_type: "documentation",
        difficulty_level: "beginner",
        language: "zh",
        tags: ["JavaScript", "前端开发", "编程基础"],
        author: "Mozilla",
        content_features: {
          topics: ["JavaScript语法", "变量", "函数", "对象", "数组"],
          prerequisites: ["HTML基础"],
          learning_outcomes: ["掌握JavaScript基础语法", "理解编程概念"],
          suitable_for_obstacles: ["knowledge_gap", "technical_issue"]
        },
        quality_score: 95
      },
      {
        title: "React 官方教程",
        description: "React 官方提供的入门教程，通过构建井字棋游戏学习 React",
        url: "https://react.dev/learn/tutorial-tic-tac-toe",
        platform: "documentation",
        resource_type: "tutorial",
        difficulty_level: "intermediate",
        language: "zh",
        tags: ["React", "前端框架", "组件开发"],
        author: "React Team",
        content_features: {
          topics: ["React组件", "状态管理", "事件处理"],
          prerequisites: ["JavaScript基础", "HTML/CSS"],
          learning_outcomes: ["掌握React基础概念", "能够构建简单应用"],
          suitable_for_obstacles: ["knowledge_gap", "technical_issue"]
        },
        quality_score: 90
      },
      {
        title: "Python 编程：从入门到实践",
        description: "适合初学者的Python编程教程，包含大量实例和练习",
        url: "https://python.org/doc/",
        platform: "documentation",
        resource_type: "course",
        difficulty_level: "beginner",
        language: "zh",
        tags: ["Python", "编程入门", "后端开发"],
        author: "Python Software Foundation",
        content_features: {
          topics: ["Python语法", "数据结构", "函数", "面向对象"],
          prerequisites: ["计算机基础"],
          learning_outcomes: ["掌握Python编程", "能够编写简单程序"],
          suitable_for_obstacles: ["knowledge_gap", "motivation"]
        },
        quality_score: 88
      },
      {
        title: "Git 版本控制教程",
        description: "学习Git版本控制系统的基础和进阶用法",
        url: "https://git-scm.com/book/zh/v2",
        platform: "documentation",
        resource_type: "tutorial",
        difficulty_level: "beginner",
        language: "zh",
        tags: ["Git", "版本控制", "开发工具"],
        author: "Git Community",
        content_features: {
          topics: ["Git基础", "分支管理", "远程仓库", "协作开发"],
          prerequisites: ["命令行基础"],
          learning_outcomes: ["掌握Git使用", "理解版本控制概念"],
          suitable_for_obstacles: ["technical_issue", "knowledge_gap"]
        },
        quality_score: 85
      },
      {
        title: "算法与数据结构可视化",
        description: "通过可视化方式学习常见算法和数据结构",
        url: "https://visualgo.net/zh",
        platform: "other",
        resource_type: "interactive",
        difficulty_level: "intermediate",
        language: "zh",
        tags: ["算法", "数据结构", "计算机科学"],
        author: "VisuAlgo Team",
        content_features: {
          topics: ["排序算法", "搜索算法", "树结构", "图算法"],
          prerequisites: ["编程基础", "数学基础"],
          learning_outcomes: ["理解算法原理", "掌握数据结构"],
          suitable_for_obstacles: ["knowledge_gap", "motivation"]
        },
        quality_score: 92
      }
    ]

    // 批量插入资源
    const { data: resources, error: insertError } = await supabase
      .from('learning_resources')
      .upsert(presetResources, { onConflict: 'url' })
      .select()

    if (insertError) {
      console.error('Batch insert error:', insertError)
      return NextResponse.json({ error: 'Failed to insert preset resources' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      resources,
      message: `Successfully added ${resources?.length || 0} preset resources`
    })

  } catch (error) {
    console.error('Error in preset resources API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 检测平台类型
function detectPlatform(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube'
  } else if (url.includes('bilibili.com')) {
    return 'bilibili'
  } else if (url.includes('github.com')) {
    return 'documentation'
  } else if (url.includes('developer.mozilla.org') || url.includes('docs.')) {
    return 'documentation'
  } else if (url.includes('blog') || url.includes('medium.com') || url.includes('dev.to')) {
    return 'blog'
  } else {
    return 'other'
  }
}

// 爬取和分析资源（简化版本）
async function crawlAndAnalyzeResource(url: string, platform: string) {
  const openai = createOpenAIClient()

  // 基于URL和平台生成基础信息
  const prompt = `
分析这个学习资源URL并提供详细信息：
URL: ${url}
平台: ${platform}

请提供以下信息的JSON格式：
{
  "title": "资源标题",
  "description": "资源描述",
  "resource_type": "video|article|course|tutorial|documentation|interactive",
  "difficulty_level": "beginner|intermediate|advanced",
  "duration_minutes": 估计学习时间（分钟），
  "language": "zh|en|other",
  "tags": ["标签1", "标签2"],
  "author": "作者名称",
  "content_features": {
    "topics": ["主题1", "主题2"],
    "prerequisites": ["前置知识1"],
    "learning_outcomes": ["学习成果1"],
    "suitable_for_obstacles": ["knowledge_gap", "technical_issue"]
  },
  "quality_score": 0-100的质量评分
}
`

  try {
    const completion = await openai.chat.completions.create({
      model: 'grok-2-1212',
      messages: [
        { 
          role: 'system', 
          content: '你是一位专业的学习资源分析师，能够准确分析和评估各种学习资源。返回有效的JSON格式。' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    })

    const aiResponse = completion.choices[0].message.content || ''
    
    try {
      return JSON.parse(aiResponse)
    } catch {
      // AI响应解析失败时的备用方案
      return generateFallbackResourceData(url, platform)
    }
  } catch (error) {
    console.error('AI analysis error:', error)
    return generateFallbackResourceData(url, platform)
  }
}

// 备用资源数据生成
function generateFallbackResourceData(url: string, platform: string) {
  const domain = new URL(url).hostname
  
  return {
    title: `学习资源 - ${domain}`,
    description: `来自 ${domain} 的学习资源`,
    resource_type: platform === 'youtube' || platform === 'bilibili' ? 'video' : 'article',
    difficulty_level: 'beginner',
    duration_minutes: 30,
    language: 'zh',
    tags: ['学习资源'],
    author: domain,
    content_features: {
      topics: ['通用学习内容'],
      prerequisites: [],
      learning_outcomes: ['获得新知识'],
      suitable_for_obstacles: ['knowledge_gap']
    },
    quality_score: 60
  }
}
