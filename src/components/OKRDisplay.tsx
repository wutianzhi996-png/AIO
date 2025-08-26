'use client'

import { useState } from 'react'
import { OKR, KeyResult } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'
import { Trash2, TrendingUp, Clock } from 'lucide-react'
import ProgressSubmissionModal from './ProgressSubmissionModal'

interface OKRDisplayProps {
  okr: OKR
  onDelete?: () => void
}

export default function OKRDisplay({ okr, onDelete }: OKRDisplayProps) {
  const [deleting, setDeleting] = useState(false)
  const [progressModalOpen, setProgressModalOpen] = useState(false)
  const [selectedKeyResult, setSelectedKeyResult] = useState<{ keyResult: KeyResult; index: number } | null>(null)

  // 计算整体进度 - 基于实际进度百分比而不是完成状态
  const totalProgress = okr.key_results?.reduce((sum, kr) => sum + (kr.progress || 0), 0) || 0
  const totalKRs = okr.key_results?.length || 0
  const progressPercentage = totalKRs > 0 ? Math.round(totalProgress / totalKRs) : 0

  const completedKRs = okr.key_results?.filter(kr => kr.completed || (kr.progress && kr.progress >= 100)).length || 0

  const handleDelete = async () => {
    if (!confirm('确定要删除这个学习目标吗？此操作无法撤销。')) return

    setDeleting(true)
    try {
      const { error } = await supabaseService.deleteOKR(okr.id)
      if (!error && onDelete) {
        onDelete()
      } else if (error) {
        alert('删除失败：' + error)
      }
    } catch {
      alert('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const handleProgressClick = (keyResult: KeyResult, index: number) => {
    setSelectedKeyResult({ keyResult, index })
    setProgressModalOpen(true)
  }

  const handleProgressSubmit = async (progress: number, description: string) => {
    if (!selectedKeyResult) return

    const { error } = await supabaseService.updateKeyResultProgress(
      okr.id,
      selectedKeyResult.index,
      progress,
      description
    )

    if (error) {
      throw new Error(error)
    }

    // 刷新页面或触发重新加载
    if (onDelete) {
      onDelete() // 重用这个回调来触发父组件刷新
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl card-shadow border border-white/20 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            progressPercentage === 100 ? 'bg-green-400' : progressPercentage > 50 ? 'bg-yellow-400' : 'bg-blue-400'
          }`}></div>
          <span className="text-xs text-gray-500">
            {new Date(okr.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <span className="text-xs font-medium text-gray-600">{progressPercentage}%</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all duration-200 disabled:opacity-50"
            title="删除目标"
          >
            <Trash2 className="w-3 h-3 text-red-500" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex items-center mb-2">
            <div className="w-1.5 h-1.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mr-2"></div>
            <h3 className="text-sm font-medium text-gray-900">目标</h3>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-100">
            <p className="text-gray-800 font-medium text-sm">{okr.objective}</p>
          </div>
        </div>

        {okr.key_results && okr.key_results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mr-2"></div>
                <h3 className="text-sm font-medium text-gray-900">关键结果</h3>
              </div>
              <span className="text-xs text-gray-500">
                {completedKRs}/{totalKRs}
              </span>
            </div>
            <div className="space-y-3">
              {okr.key_results.map((kr, index) => {
                const progress = kr.progress || 0
                const isCompleted = kr.completed || progress >= 100

                return (
                  <div key={index} className="group">
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCompleted
                          ? 'bg-gradient-to-r from-green-400 to-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isCompleted ? '✓' : index + 1}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className={`p-3 rounded-lg text-sm cursor-pointer transition-all hover:shadow-sm ${
                          isCompleted
                            ? 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 text-gray-700'
                            : 'bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100'
                        }`}
                        onClick={() => handleProgressClick(kr, index)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={isCompleted ? 'line-through' : ''}>{kr.text}</span>
                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/50 rounded transition-all">
                              <TrendingUp className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>

                          {/* Progress Bar */}
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  progress >= 100 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                  progress >= 75 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                                  progress >= 50 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                                  progress >= 25 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                                  'bg-gradient-to-r from-red-400 to-red-600'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600 min-w-[35px]">
                              {progress}%
                            </span>
                          </div>

                          {/* Progress Description and Last Updated */}
                          {(kr.progress_description || kr.last_updated) && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              {kr.progress_description && (
                                <p className="text-xs text-gray-600 mb-1">{kr.progress_description}</p>
                              )}
                              {kr.last_updated && (
                                <div className="flex items-center text-xs text-gray-500">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {new Date(kr.last_updated).toLocaleString('zh-CN')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Progress Submission Modal */}
      {selectedKeyResult && (
        <ProgressSubmissionModal
          isOpen={progressModalOpen}
          onClose={() => {
            setProgressModalOpen(false)
            setSelectedKeyResult(null)
          }}
          keyResult={selectedKeyResult.keyResult}
          keyResultIndex={selectedKeyResult.index}
          okrId={okr.id}
          onSubmit={handleProgressSubmit}
        />
      )}
    </div>
  )
}