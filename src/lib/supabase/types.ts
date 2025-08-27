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
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
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