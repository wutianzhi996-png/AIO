export interface KeyResult {
  text: string
  completed?: boolean
  progress?: number // 进度百分比 (0-100)
  progress_description?: string // 进度描述
  last_updated?: string // 最后更新时间
}

export interface OKR {
  id: string
  user_id: string
  objective: string
  key_results: KeyResult[]
  created_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  province: string
  university: string
  major: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  user_id: string
  session_id: string
  message: {
    role: 'user' | 'assistant'
    content: string
  }
  created_at: string
}

export interface KnowledgeChunk {
  id: number
  content: string
  embedding: number[]
}

export interface ProgressHistory {
  id: number
  user_id: string
  okr_id: string
  key_result_index: number
  key_result_text: string
  progress: number
  progress_description?: string
  previous_progress?: number
  created_at: string
}

export interface DailyTask {
  id: number
  user_id: string
  okr_id: string
  key_result_index?: number
  title: string
  description?: string
  task_type: 'daily' | 'weekly'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  priority: number // 1-5, 1 is highest priority
  task_date: string
  estimated_duration?: number // in minutes
  completed_at?: string
  generated_by: 'ai' | 'user' | 'system'
  generation_context?: Record<string, unknown>
  progress_contribution?: number // 完成此任务对关键结果进度的贡献值 (0-100)
  parent_task_id?: number
  depends_on_task_ids?: number[]
  created_at: string
  updated_at: string
  // Joined fields from view
  objective?: string
  related_key_result?: string
}

export interface TaskGenerationLog {
  id: number
  user_id: string
  generation_date: string
  generation_type: 'daily' | 'weekly'
  okr_snapshot?: Record<string, unknown>
  previous_tasks_snapshot?: Record<string, unknown>
  generated_tasks_count: number
  generation_prompt?: string
  ai_response?: string
  created_at: string
}

export interface TaskCompletionStats {
  user_id: string
  task_date: string
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  pending_tasks: number
  completion_rate: number
}

export interface TaskObstacle {
  id: number
  user_id: string
  task_id: number
  obstacle_type: 'time_management' | 'knowledge_gap' | 'motivation' | 'resource_lack' | 'technical_issue' | 'other'
  description: string
  ai_analysis: string
  suggested_solutions: Array<{
    title: string
    description: string
    priority: number
    estimated_time: number
  }>
  status: 'identified' | 'in_progress' | 'resolved' | 'dismissed'
  created_at: string
  updated_at: string
  resolved_at?: string
}

export interface LearningResource {
  id: number
  title: string
  description: string
  url: string
  platform: 'youtube' | 'bilibili' | 'blog' | 'course' | 'documentation' | 'other'
  resource_type: 'video' | 'article' | 'course' | 'tutorial' | 'documentation' | 'interactive'
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  duration_minutes?: number
  language: 'zh' | 'en' | 'other'
  tags: string[]
  author: string
  thumbnail_url?: string
  view_count?: number
  rating?: number // 0-5 stars
  created_at: string
  updated_at: string
  // AI分析的内容特征
  content_features: {
    topics: string[]
    prerequisites: string[]
    learning_outcomes: string[]
    suitable_for_obstacles: string[] // 适合解决的障碍类型
  }
  // 质量评分
  quality_score: number // 0-100
  engagement_score: number // 基于用户互动的评分
}

export interface UserResourceInteraction {
  id: number
  user_id: string
  resource_id: number
  interaction_type: 'view' | 'bookmark' | 'complete' | 'rate' | 'share'
  rating?: number // 1-5 stars
  completion_percentage?: number // 0-100
  time_spent_minutes?: number
  feedback?: string
  created_at: string
}

export interface ResourceRecommendation {
  id: number
  user_id: string
  resource_id: number
  recommendation_reason: string
  relevance_score: number // 0-100
  obstacle_match?: string // 匹配的障碍类型
  created_at: string
  clicked?: boolean
  helpful_rating?: number // 用户对推荐的评价
}