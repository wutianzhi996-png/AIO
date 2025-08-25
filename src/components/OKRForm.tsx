'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseService } from '@/lib/services/supabase-service'

interface OKRFormProps {
  onSuccess: () => void
}

export default function OKRForm({ onSuccess }: OKRFormProps) {
  const [objective, setObjective] = useState('')
  const [keyResults, setKeyResults] = useState(['', '', ''])
  const [loading, setLoading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [message, setMessage] = useState('')

  const handleKeyResultChange = (index: number, value: string) => {
    const newKeyResults = [...keyResults]
    newKeyResults[index] = value
    setKeyResults(newKeyResults)
  }

  const generateKeyResults = async () => {
    if (!objective.trim()) {
      setMessage('请先输入学习目标')
      return
    }

    setAiGenerating(true)
    setMessage('')

    try {
      const response = await fetch('/api/generate-okr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: objective.trim() })
      })

      if (!response.ok) {
        throw new Error('生成失败')
      }

      const { keyResults: generatedKeyResults } = await response.json()
      
      // 将生成的关键结果填入表单，最多3个
      const newKeyResults = ['', '', '']
      generatedKeyResults.slice(0, 3).forEach((kr: string, index: number) => {
        newKeyResults[index] = kr
      })
      setKeyResults(newKeyResults)
      setMessage('✅ AI已为您生成关键结果，您可以根据需要修改')
    } catch (error) {
      console.error('Generate key results error:', error)
      setMessage('AI生成失败，请稍后重试')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const validKeyResults = keyResults.filter(kr => kr.trim() !== '')
      
      if (!objective.trim() || validKeyResults.length === 0) {
        setMessage('请填写目标和至少一个关键结果')
        return
      }

      const { data, error } = await supabaseService.createOKR(objective.trim(), validKeyResults)
      
      if (data) {
        onSuccess()
        setObjective('')
        setKeyResults(['', '', ''])
      } else {
        setMessage(error || '创建失败，请重试')
      }
    } catch {
      setMessage('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl card-shadow border border-white/20 animate-fade-in">
      <div className="flex items-center mb-6">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
          <span className="text-white font-bold text-sm">OKR</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">创建学习目标</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center mb-2">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mr-2"></div>
            <label className="text-sm font-medium text-gray-900">
              目标 (Objective)
            </label>
          </div>
          <div className="flex space-x-2">
            <Input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="例如：本周掌握数据结构基础知识"
              required
              className="flex-1 bg-white/80 backdrop-blur-sm border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl"
            />
            <Button
              type="button"
              onClick={generateKeyResults}
              disabled={!objective.trim() || aiGenerating || loading}
              className="px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-sm disabled:opacity-50"
            >
              {aiGenerating ? (
                <span className="flex items-center">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                  生成中
                </span>
              ) : (
                <span className="flex items-center">
                  ✨ AI生成
                </span>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 ml-2">设定一个明确、可衡量的学习目标，然后点击AI生成自动创建关键结果</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center mb-2">
            <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mr-2"></div>
            <label className="text-sm font-medium text-gray-900">
              关键结果 (Key Results)
            </label>
          </div>
          {keyResults.map((kr, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                  {index + 1}
                </div>
                <Input
                  value={kr}
                  onChange={(e) => handleKeyResultChange(index, e.target.value)}
                  placeholder={`关键结果 ${index + 1}${index === 0 ? '（必填）' : '（可选）'}`}
                  required={index === 0}
                  className="flex-1 bg-white/80 backdrop-blur-sm border-gray-200 focus:border-green-400 focus:ring-green-400/20 rounded-xl"
                />
              </div>
              {index === 0 && (
                <p className="text-xs text-gray-500 ml-9">具体的、可衡量的学习成果</p>
              )}
            </div>
          ))}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-100">
            <p className="text-xs text-gray-600">
              💡 提示：关键结果应该是具体的、可衡量的成果。比如&quot;完成10道算法题&quot;而不是&quot;学好算法&quot;
            </p>
          </div>
        </div>

        {message && (
          <div className={`border rounded-xl p-3 animate-fade-in ${
            message.startsWith('✅') 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm flex items-center ${
              message.startsWith('✅') 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {!message.startsWith('✅') && <span className="mr-2">⚠️</span>}
              {message}
            </p>
          </div>
        )}

        <div className="flex space-x-3">
          <Button 
            type="submit" 
            disabled={loading} 
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl py-3 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                创建中...
              </span>
            ) : (
              <span className="flex items-center">
                <span className="mr-2">🎯</span>
                创建 OKR
              </span>
            )}
          </Button>
          <Button 
            type="button"
            variant="outline" 
            onClick={() => {
              setObjective('')
              setKeyResults(['', '', ''])
              setMessage('')
            }}
            className="px-6 hover:bg-gray-50 border-gray-200 rounded-xl"
          >
            重置
          </Button>
        </div>
      </form>
    </div>
  )
}