'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, AlertTriangle, Brain, CheckCircle, Clock, BookOpen } from 'lucide-react'
import { DailyTask, TaskObstacle } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'
import LearningResourcesWidget from './LearningResourcesWidget'

interface TaskObstacleModalProps {
  isOpen: boolean
  onClose: () => void
  task: DailyTask
  onObstacleReported?: () => void
}

export default function TaskObstacleModal({ isOpen, onClose, task, onObstacleReported }: TaskObstacleModalProps) {
  const [step, setStep] = useState<'report' | 'analysis' | 'solutions' | 'resources'>('report')
  const [description, setDescription] = useState('')
  const [obstacleType, setObstacleType] = useState('other')
  const [loading, setLoading] = useState(false)
  const [obstacle, setObstacle] = useState<TaskObstacle | null>(null)
  const [selectedSolution, setSelectedSolution] = useState<number | null>(null)

  const obstacleTypes = [
    { value: 'time_management', label: '时间管理问题', icon: '⏰' },
    { value: 'knowledge_gap', label: '知识缺口', icon: '📚' },
    { value: 'motivation', label: '动机不足', icon: '💪' },
    { value: 'resource_lack', label: '资源不足', icon: '🔧' },
    { value: 'technical_issue', label: '技术问题', icon: '💻' },
    { value: 'other', label: '其他', icon: '❓' }
  ]

  const handleSubmitObstacle = async () => {
    if (!description.trim()) return

    setLoading(true)
    try {
      const { data, error } = await supabaseService.reportTaskObstacle(task.id, description, obstacleType)
      
      if (error) {
        alert('报告障碍失败：' + error)
      } else if (data) {
        setObstacle(data)
        setStep('analysis')
        if (onObstacleReported) {
          onObstacleReported()
        }
      }
    } catch {
      alert('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkResolved = async (solutionIndex?: number) => {
    if (!obstacle) return

    setLoading(true)
    try {
      const { error } = await supabaseService.updateObstacleStatus(
        obstacle.id, 
        'resolved',
        solutionIndex !== undefined ? `使用了解决方案${solutionIndex + 1}` : undefined
      )
      
      if (error) {
        alert('更新状态失败：' + error)
      } else {
        onClose()
        if (onObstacleReported) {
          onObstacleReported()
        }
      }
    } catch {
      alert('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">任务障碍诊断</h2>
              <p className="text-sm text-gray-500">{task.title}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'report' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-4">描述遇到的障碍</h3>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请详细描述你在完成这个任务时遇到的具体困难..."
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <h3 className="text-md font-medium text-gray-900 mb-4">障碍类型</h3>
                <div className="grid grid-cols-2 gap-3">
                  {obstacleTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setObstacleType(type.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        obstacleType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{type.icon}</span>
                        <span className="text-sm font-medium">{type.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={onClose}>
                  取消
                </Button>
                <Button 
                  onClick={handleSubmitObstacle}
                  disabled={!description.trim() || loading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? (
                    <>
                      <Brain className="w-4 h-4 mr-2 animate-spin" />
                      AI分析中...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      开始AI分析
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'analysis' && obstacle && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">AI分析结果</h3>
                </div>
                <p className="text-blue-800 text-sm leading-relaxed">
                  {obstacle.ai_analysis}
                </p>
              </div>

              <div>
                <h3 className="text-md font-medium text-gray-900 mb-4">推荐解决方案</h3>
                <div className="space-y-3">
                  {obstacle.suggested_solutions?.map((solution: { title: string; description: string; priority: number; estimated_time: number; steps?: string[] }, index: number) => (
                    <div
                      key={index}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedSolution === index
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedSolution(selectedSolution === index ? null : index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              解决方案 {index + 1}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              solution.priority === 1 
                                ? 'bg-red-100 text-red-700' 
                                : solution.priority === 2 
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              优先级 {solution.priority}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1">{solution.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{solution.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>预计 {solution.estimated_time} 分钟</span>
                            </div>
                          </div>
                        </div>
                        {selectedSolution === index && (
                          <CheckCircle className="w-5 h-5 text-green-600 ml-2" />
                        )}
                      </div>

                      {selectedSolution === index && solution.steps && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <h5 className="text-sm font-medium text-green-900 mb-2">执行步骤：</h5>
                          <ol className="list-decimal list-inside space-y-1">
                            {solution.steps.map((step: string, stepIndex: number) => (
                              <li key={stepIndex} className="text-sm text-green-800">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setStep('report')}>
                  重新报告
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep('resources')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  查看学习资源
                </Button>
                <Button
                  onClick={() => handleMarkResolved(selectedSolution || undefined)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      标记为已解决
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'resources' && obstacle && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-900">推荐学习资源</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('analysis')}
                >
                  返回解决方案
                </Button>
              </div>

              <LearningResourcesWidget
                obstacleType={obstacle.obstacle_type}
                className="border-0 shadow-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
