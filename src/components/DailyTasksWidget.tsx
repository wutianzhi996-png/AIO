'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Clock, Target, RefreshCw, AlertTriangle, Plus, Database, ExternalLink, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DailyTask } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'

interface DailyTasksWidgetProps {
  className?: string
}

export default function DailyTasksWidget({ className = '' }: DailyTasksWidgetProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsSetup(false)
    try {
      const response = await fetch('/api/tasks')
      const result = await response.json()

      if (!response.ok) {
        if (result.needsSetup) {
          setNeedsSetup(true)
          setError(result.error)
        } else {
          setError(result.error || '加载任务失败')
        }
      } else {
        setTasks(result.tasks || [])
      }
    } catch {
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }, [])

  const generateTasks = useCallback(async (forceRegenerate = false) => {
    setGenerating(true)
    setError(null)
    setNeedsSetup(false)
    try {
      const response = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'daily', forceRegenerate })
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.needsSetup) {
          setNeedsSetup(true)
          setError(result.error)
        } else {
          setError(result.error || '生成任务失败')
        }
      } else {
        setTasks(result.tasks || [])
      }
    } catch {
      setError('网络错误，请检查连接')
    } finally {
      setGenerating(false)
    }
  }, [])

  const updateTaskStatus = useCallback(async (taskId: number, status: string) => {
    try {
      const completedAt = status === 'completed' ? new Date().toISOString() : undefined
      const { error } = await supabaseService.updateTaskStatus(taskId, status, completedAt)
      if (error) {
        setError(error)
      } else {
        // 更新本地状态
        setTasks(prev => prev.map(task =>
          task.id === taskId
            ? { ...task, status: status as DailyTask['status'], completed_at: completedAt }
            : task
        ))
      }
    } catch {
      setError('更新任务状态失败')
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-red-600 bg-red-50 border-red-200'
      case 2: return 'text-orange-600 bg-orange-50 border-orange-200'
      case 3: return 'text-blue-600 bg-blue-50 border-blue-200'
      case 4: return 'text-green-600 bg-green-50 border-green-200'
      case 5: return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return '紧急'
      case 2: return '重要'
      case 3: return '普通'
      case 4: return '较低'
      case 5: return '最低'
      default: return '普通'
    }
  }

  const completedTasks = tasks.filter(task => task.status === 'completed')
  const pendingTasks = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress')
  const failedTasks = tasks.filter(task => task.status === 'failed')

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">今日学习任务</h2>
            <p className="text-sm text-gray-500">
              {tasks.length > 0 ? `${completedTasks.length}/${tasks.length} 已完成` : '暂无任务'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadTasks()}
            disabled={loading}
            className="text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          {tasks.length === 0 && (
            <Button
              size="sm"
              onClick={() => generateTasks(false)}
              disabled={generating}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  生成任务
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className={`mb-4 p-4 rounded-lg border ${needsSetup ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start space-x-3">
              {needsSetup ? (
                <Database className="w-5 h-5 text-blue-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${needsSetup ? 'text-blue-800' : 'text-red-700'} mb-2`}>
                  {needsSetup ? '需要数据库设置' : '错误'}
                </p>
                <p className={`text-sm ${needsSetup ? 'text-blue-700' : 'text-red-600'} mb-3`}>
                  {error}
                </p>
                {needsSetup && (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-600">
                      请按照以下步骤启用任务管理功能：
                    </p>
                    <ol className="text-xs text-blue-600 space-y-1 ml-4 list-decimal">
                      <li>登录 Supabase 控制台</li>
                      <li>打开 SQL Editor</li>
                      <li>执行 docs/DATABASE_SETUP_GUIDE.md 中的任务管理SQL脚本</li>
                    </ol>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                      className="mt-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      打开 Supabase
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null)
                  setNeedsSetup(false)
                }}
                className={`${needsSetup ? 'text-blue-600 hover:text-blue-700' : 'text-red-600 hover:text-red-700'}`}
              >
                ×
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">加载任务中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-4">还没有今日任务</p>
            <Button
              onClick={() => generateTasks(false)}
              disabled={generating}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  AI生成中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  AI生成今日任务
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 失败任务提醒 */}
            {failedTasks.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">昨日未完成任务</span>
                </div>
                <div className="space-y-1">
                  {failedTasks.map(task => (
                    <div key={task.id} className="text-sm text-red-600 line-through">
                      ✗ {task.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 待完成任务 */}
            {pendingTasks.map(task => (
              <div
                key={task.id}
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <button
                  onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                  className="mt-0.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Circle className="w-5 h-5" />
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </div>
                  
                  {task.description && (
                    <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      {task.estimated_duration && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{task.estimated_duration}分钟</span>
                        </div>
                      )}

                      {task.related_key_result && (
                        <div className="flex items-center space-x-1">
                          <Target className="w-3 h-3" />
                          <span className="truncate max-w-32">{task.related_key_result}</span>
                        </div>
                      )}
                    </div>

                    {/* 进度贡献显示 */}
                    {task.progress_contribution && task.progress_contribution > 0 && (
                      <div className="flex items-center space-x-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        <span>+{task.progress_contribution}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 已完成任务 */}
            {completedTasks.map(task => (
              <div
                key={task.id}
                className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg opacity-75"
              >
                <button
                  onClick={() => updateTaskStatus(task.id, 'pending')}
                  className="mt-0.5 text-green-600 hover:text-gray-400 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-gray-700 line-through">{task.title}</h3>
                    {task.progress_contribution && task.progress_contribution > 0 && (
                      <div className="flex items-center space-x-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        <span>+{task.progress_contribution}%</span>
                      </div>
                    )}
                  </div>
                  {task.completed_at && (
                    <p className="text-xs text-gray-500">
                      完成于 {new Date(task.completed_at).toLocaleTimeString('zh-CN')}
                      {task.progress_contribution && task.progress_contribution > 0 && task.related_key_result && (
                        <span className="ml-2 text-green-600">
                          • 已为&ldquo;{task.related_key_result}&rdquo;增加{task.progress_contribution}%进度
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* 重新生成按钮 */}
            {tasks.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateTasks(true)}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      重新生成中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重新生成今日任务
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
