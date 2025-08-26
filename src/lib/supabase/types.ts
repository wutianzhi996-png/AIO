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