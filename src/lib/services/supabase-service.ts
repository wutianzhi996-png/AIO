import { createClient } from '@/lib/supabase/client'
import { OKR, ChatMessage, UserProfile, ProgressHistory, DailyTask, TaskObstacle, LearningResource, UserResourceInteraction } from '@/lib/supabase/types'

class SupabaseService {
  private _supabase: ReturnType<typeof createClient> | null = null

  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient()
    }
    return this._supabase
  }

  async signUp(email: string, password: string, profile?: { province: string; university: string; major: string }) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    })
    
    if (!error && data.user && profile) {
      // 创建用户档案
      const { error: profileError } = await this.supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          province: profile.province,
          university: profile.university,
          major: profile.major
        })
      
      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }
    
    return { data, error }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    return { error }
  }

  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    return { user, error }
  }

  async getUserProfile(): Promise<{ data: UserProfile | null, error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    return { data, error: error?.message || null }
  }

  async createUserProfile(profile: { province: string; university: string; major: string }): Promise<{ data: UserProfile | null, error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        province: profile.province,
        university: profile.university,
        major: profile.major
      })
      .select()
      .single()

    return { data, error: error?.message || null }
  }

  async getUniversityMajorStats(): Promise<{ data: { major: string; count: number }[] | null, error: string | null }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) return { data: null, error: 'Not authenticated' }

      // 获取当前用户的学校信息
      const { data: userProfile, error: profileError } = await this.getUserProfile()
      if (profileError) return { data: null, error: profileError }
      if (!userProfile) return { data: null, error: 'User profile not found. Please complete your profile first.' }

      // 统计同一所大学各专业的人数
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('major')
        .eq('university', userProfile.university)

      if (error) return { data: null, error: error.message }
      if (!data || data.length === 0) return { data: [], error: null }

      // 统计各专业人数
      const majorCounts: { [key: string]: number } = {}
      data.forEach(profile => {
        if (profile.major) {
          majorCounts[profile.major] = (majorCounts[profile.major] || 0) + 1
        }
      })

      // 转换为图表需要的格式
      const statsData = Object.entries(majorCounts).map(([major, count]) => ({
        major,
        count
      })).sort((a, b) => b.count - a.count) // 按人数降序排列

      return { data: statsData, error: null }
    } catch (err) {
      console.error('Error fetching university major stats:', err)
      return { data: null, error: 'Failed to fetch statistics' }
    }
  }

  async createOKR(objective: string, keyResults: string[]): Promise<{ data: OKR | null, error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('okrs')
      .insert({
        user_id: user.id,
        objective,
        key_results: keyResults.map(text => ({ text }))
      })
      .select()
      .single()

    return { data, error: error?.message || null }
  }

  async getUserOKRs(): Promise<{ data: OKR[] | null, error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('okrs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return { data, error: error?.message || null }
  }

  async deleteOKR(okrId: string): Promise<{ error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await this.supabase
      .from('okrs')
      .delete()
      .eq('id', okrId)
      .eq('user_id', user.id) // Ensure user can only delete their own OKRs

    return { error: error?.message || null }
  }

  async updateKeyResultProgress(
    okrId: string,
    keyResultIndex: number,
    progress: number,
    progressDescription?: string
  ): Promise<{ data: OKR | null, error: string | null }> {
    try {
      const response = await fetch('/api/okr/update-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          okrId,
          keyResultIndex,
          progress,
          progressDescription
        })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to update progress' }
      }

      return { data: result.data, error: null }
    } catch (error) {
      console.error('Error updating key result progress:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async batchUpdateKeyResultProgress(
    okrId: string,
    progressUpdates: Array<{
      keyResultIndex: number
      progress: number
      progressDescription?: string
    }>
  ): Promise<{ data: OKR | null, error: string | null }> {
    try {
      const response = await fetch('/api/okr/update-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          okrId,
          progressUpdates
        })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to update progress' }
      }

      return { data: result.data, error: null }
    } catch (error) {
      console.error('Error batch updating key result progress:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async saveChatMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        message: { role, content }
      })

    return { data, error }
  }

  async getChatHistory(sessionId?: string): Promise<{ data: ChatMessage[] | null, error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    let query = this.supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    return { data, error: error?.message || null }
  }

  async getRecentUserMessages(limit: number = 10): Promise<{ data: string[] | null, error: string | null }> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const { data, error } = await this.supabase
      .from('chat_history')
      .select('message')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit * 2) // Get more to filter user messages

    if (error) return { data: null, error: error.message }

    // Filter for user messages only
    const userMessages = (data || [])
      .filter(item => item.message?.role === 'user')
      .map(item => item.message?.content || '')
      .filter(content => content.length > 0)
      .slice(0, limit)

    return { data: userMessages, error: null }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean, error: string | null }> {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const result = await response.json()

      if (!response.ok) {
        return { success: false, error: result.error || 'Password change failed' }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Error changing password:', error)
      return { success: false, error: 'Network error' }
    }
  }

  async getProgressHistory(okrId: string, keyResultIndex: number): Promise<{ data: ProgressHistory[] | null, error: string | null }> {
    try {
      const response = await fetch(`/api/okr/progress-history?okrId=${okrId}&keyResultIndex=${keyResultIndex}`)

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to fetch progress history' }
      }

      return { data: result.data, error: null }
    } catch (error) {
      console.error('Error fetching progress history:', error)
      return { data: null, error: 'Network error' }
    }
  }

  // 任务管理相关方法
  async generateDailyTasks(taskType: 'daily' | 'weekly' = 'daily', forceRegenerate: boolean = false): Promise<{ data: DailyTask[] | null, error: string | null }> {
    try {
      const response = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, forceRegenerate })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to generate tasks' }
      }

      return { data: result.tasks, error: null }
    } catch (error) {
      console.error('Error generating tasks:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async getTodayTasks(date?: string, taskType: 'daily' | 'weekly' = 'daily'): Promise<{ data: DailyTask[] | null, error: string | null }> {
    try {
      const params = new URLSearchParams()
      if (date) params.append('date', date)
      params.append('type', taskType)

      const response = await fetch(`/api/tasks?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to fetch tasks' }
      }

      return { data: result.tasks, error: null }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async updateTaskStatus(taskId: number, status: string, completedAt?: string): Promise<{ data: DailyTask | null, error: string | null }> {
    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status, completedAt })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to update task' }
      }

      return { data: result.task, error: null }
    } catch (error) {
      console.error('Error updating task:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async createTask(taskData: {
    title: string
    description?: string
    okrId: string
    keyResultIndex?: number
    priority?: number
    estimatedDuration?: number
    taskType?: 'daily' | 'weekly'
    taskDate?: string
  }): Promise<{ data: DailyTask | null, error: string | null }> {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to create task' }
      }

      return { data: result.task, error: null }
    } catch (error) {
      console.error('Error creating task:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async deleteTask(taskId: number): Promise<{ error: string | null }> {
    try {
      const response = await fetch(`/api/tasks?taskId=${taskId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        return { error: result.error || 'Failed to delete task' }
      }

      return { error: null }
    } catch (error) {
      console.error('Error deleting task:', error)
      return { error: 'Network error' }
    }
  }

  // 障碍诊断相关方法
  async reportTaskObstacle(taskId: number, description: string, obstacleType: string): Promise<{ data: TaskObstacle | null, error: string | null }> {
    try {
      const response = await fetch('/api/tasks/obstacles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, description, obstacleType })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to report obstacle' }
      }

      return { data: result.obstacle, error: null }
    } catch (error) {
      console.error('Error reporting obstacle:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async getTaskObstacles(taskId?: number, status?: string): Promise<{ data: TaskObstacle[] | null, error: string | null }> {
    try {
      const params = new URLSearchParams()
      if (taskId) params.append('taskId', taskId.toString())
      if (status) params.append('status', status)

      const response = await fetch(`/api/tasks/obstacles?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to fetch obstacles' }
      }

      return { data: result.obstacles, error: null }
    } catch (error) {
      console.error('Error fetching obstacles:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async updateObstacleStatus(obstacleId: number, status: string, userFeedback?: string, effectivenessRating?: number): Promise<{ data: TaskObstacle | null, error: string | null }> {
    try {
      const response = await fetch('/api/tasks/obstacles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obstacleId, status, userFeedback, effectivenessRating })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to update obstacle' }
      }

      return { data: result.obstacle, error: null }
    } catch (error) {
      console.error('Error updating obstacle:', error)
      return { data: null, error: 'Network error' }
    }
  }

  // 学习资源推荐相关方法
  async getResourceRecommendations(params?: {
    obstacleType?: string
    difficulty?: string
    resourceType?: string
    platform?: string
    limit?: number
  }): Promise<{ data: LearningResource[] | null, error: string | null }> {
    try {
      const searchParams = new URLSearchParams()
      if (params?.obstacleType) searchParams.append('obstacleType', params.obstacleType)
      if (params?.difficulty) searchParams.append('difficulty', params.difficulty)
      if (params?.resourceType) searchParams.append('resourceType', params.resourceType)
      if (params?.platform) searchParams.append('platform', params.platform)
      if (params?.limit) searchParams.append('limit', params.limit.toString())

      const response = await fetch(`/api/resources/recommend?${searchParams.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to get recommendations' }
      }

      return { data: result.recommendations, error: null }
    } catch (error) {
      console.error('Error getting recommendations:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async searchResources(query: string, filters?: {
    platform?: string
    resource_type?: string
    difficulty_level?: string
    language?: string
  }): Promise<{ data: LearningResource[] | null, error: string | null }> {
    try {
      const response = await fetch('/api/resources/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to search resources' }
      }

      return { data: result.resources, error: null }
    } catch (error) {
      console.error('Error searching resources:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async recordResourceInteraction(
    resourceId: number,
    interactionType: string,
    options?: {
      rating?: number
      completionPercentage?: number
      timeSpentMinutes?: number
      feedback?: string
    }
  ): Promise<{ data: UserResourceInteraction | null, error: string | null }> {
    try {
      const response = await fetch('/api/resources/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          interactionType,
          ...options
        })
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to record interaction' }
      }

      return { data: result.interaction, error: null }
    } catch (error) {
      console.error('Error recording interaction:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async getUserResourceInteractions(params?: {
    resourceId?: number
    interactionType?: string
    limit?: number
  }): Promise<{ data: UserResourceInteraction[] | null, error: string | null }> {
    try {
      const searchParams = new URLSearchParams()
      if (params?.resourceId) searchParams.append('resourceId', params.resourceId.toString())
      if (params?.interactionType) searchParams.append('interactionType', params.interactionType)
      if (params?.limit) searchParams.append('limit', params.limit.toString())

      const response = await fetch(`/api/resources/interactions?${searchParams.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to get interactions' }
      }

      return { data: result.interactions, error: null }
    } catch (error) {
      console.error('Error getting interactions:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async addPresetResources(): Promise<{ data: LearningResource[] | null, error: string | null }> {
    try {
      const response = await fetch('/api/resources/crawl', {
        method: 'PUT'
      })

      const result = await response.json()

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to add preset resources' }
      }

      return { data: result.resources, error: null }
    } catch (error) {
      console.error('Error adding preset resources:', error)
      return { data: null, error: 'Network error' }
    }
  }

  async searchKnowledge(query: string, limit = 5) {
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: await this.getEmbedding(query),
      match_threshold: 0.7,
      match_count: limit
    })

    return { data, error }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error('Failed to get embedding')
    }

    const { embedding } = await response.json()
    return embedding
  }
}

export const supabaseService = new SupabaseService()