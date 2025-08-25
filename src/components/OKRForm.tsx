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
  const [message, setMessage] = useState('')

  const handleKeyResultChange = (index: number, value: string) => {
    const newKeyResults = [...keyResults]
    newKeyResults[index] = value
    setKeyResults(newKeyResults)
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
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">创建学习目标 (OKR)</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            目标 (Objective)
          </label>
          <Input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="例如：本周掌握数据结构基础知识"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            关键结果 (Key Results)
          </label>
          {keyResults.map((kr, index) => (
            <div key={index} className="mb-2">
              <Input
                value={kr}
                onChange={(e) => handleKeyResultChange(index, e.target.value)}
                placeholder={`关键结果 ${index + 1}（可选）`}
              />
            </div>
          ))}
        </div>

        {message && <p className="text-red-500 text-sm">{message}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '创建中...' : '创建 OKR'}
        </Button>
      </form>
    </div>
  )
}