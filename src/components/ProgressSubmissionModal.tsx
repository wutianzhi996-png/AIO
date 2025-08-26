'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, TrendingUp, Save, History, Clock, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { KeyResult, ProgressHistory } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'

interface ProgressSubmissionModalProps {
  isOpen: boolean
  onClose: () => void
  keyResult: KeyResult
  keyResultIndex: number
  okrId: string
  onSubmit: (progress: number, description: string) => Promise<void>
}

export default function ProgressSubmissionModal({
  isOpen,
  onClose,
  keyResult,
  keyResultIndex,
  okrId,
  onSubmit
}: ProgressSubmissionModalProps) {
  const [progress, setProgress] = useState(keyResult.progress || 0)
  const [description, setDescription] = useState(keyResult.progress_description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progressHistory, setProgressHistory] = useState<ProgressHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (isOpen && showHistory && !historyLoading && progressHistory.length === 0) {
      loadProgressHistory()
    }
  }, [isOpen, showHistory, historyLoading, progressHistory.length])

  const loadProgressHistory = async () => {
    setHistoryLoading(true)
    try {
      const { data, error } = await supabaseService.getProgressHistory(okrId, keyResultIndex)
      if (data) {
        setProgressHistory(data)
      } else if (error) {
        console.error('Failed to load progress history:', error)
      }
    } catch (error) {
      console.error('Error loading progress history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await onSubmit(progress, description)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleProgressChange = (value: string) => {
    const numValue = parseInt(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setProgress(numValue)
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'from-green-400 to-green-600'
    if (progress >= 75) return 'from-blue-400 to-blue-600'
    if (progress >= 50) return 'from-yellow-400 to-yellow-600'
    if (progress >= 25) return 'from-orange-400 to-orange-600'
    return 'from-red-400 to-red-600'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">更新进度</h2>
              <p className="text-sm text-gray-500">关键结果 #{keyResultIndex + 1}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setShowHistory(!showHistory)
                if (!showHistory && progressHistory.length === 0) {
                  loadProgressHistory()
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="查看历史记录"
            >
              <History className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Key Result Display */}
          <div className="bg-gray-50 p-4 rounded-xl">
            <h3 className="text-sm font-medium text-gray-700 mb-2">关键结果</h3>
            <p className="text-gray-900">{keyResult.text}</p>
          </div>

          {/* Progress Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              完成进度 (%)
            </label>
            
            {/* Progress Bar */}
            <div className="relative">
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${getProgressColor(progress)} transition-all duration-300`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-white drop-shadow-sm">
                  {progress}%
                </span>
              </div>
            </div>

            {/* Progress Input */}
            <div className="flex items-center space-x-3">
              <Input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => handleProgressChange(e.target.value)}
                className="flex-1"
                placeholder="0-100"
              />
              <div className="flex space-x-1">
                {[25, 50, 75, 100].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProgress(value)}
                    className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              进度说明 (可选)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述一下你的进展情况、遇到的问题或下一步计划..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Last Updated Info */}
          {keyResult.last_updated && (
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              上次更新：{new Date(keyResult.last_updated).toLocaleString('zh-CN')}
            </div>
          )}

          {/* Progress History */}
          {showHistory && (
            <div className="border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">进度历史</span>
                </div>
                {progressHistory.length > 0 && (
                  <span className="text-xs text-gray-500">{progressHistory.length} 条记录</span>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto">
                {historyLoading ? (
                  <div className="p-4 text-center">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-sm text-gray-500">加载历史记录...</span>
                  </div>
                ) : progressHistory.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {progressHistory.map((record) => {
                      const progressChange = record.previous_progress !== undefined
                        ? record.progress - record.previous_progress
                        : null

                      return (
                        <div key={record.id} className="p-3 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {record.progress}%
                              </span>
                              {progressChange !== null && (
                                <div className={`flex items-center space-x-1 text-xs ${
                                  progressChange > 0 ? 'text-green-600' :
                                  progressChange < 0 ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  {progressChange > 0 ? (
                                    <ArrowUp className="w-3 h-3" />
                                  ) : progressChange < 0 ? (
                                    <ArrowDown className="w-3 h-3" />
                                  ) : (
                                    <Minus className="w-3 h-3" />
                                  )}
                                  <span>{Math.abs(progressChange)}%</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(record.created_at).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                          {record.progress_description && (
                            <p className="text-sm text-gray-600 mt-1">{record.progress_description}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    暂无历史记录
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {loading ? (
                <span className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  提交中...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  提交进度
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
