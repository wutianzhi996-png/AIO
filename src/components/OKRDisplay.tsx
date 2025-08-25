'use client'

import { useState } from 'react'
import { OKR } from '@/lib/supabase/types'
import { supabaseService } from '@/lib/services/supabase-service'
import { Trash2 } from 'lucide-react'

interface OKRDisplayProps {
  okr: OKR
  onDelete?: () => void
}

export default function OKRDisplay({ okr, onDelete }: OKRDisplayProps) {
  const [deleting, setDeleting] = useState(false)
  const completedKRs = okr.key_results?.filter(kr => kr.completed).length || 0;
  const totalKRs = okr.key_results?.length || 0;
  const progressPercentage = totalKRs > 0 ? Math.round((completedKRs / totalKRs) * 100) : 0;

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
            <div className="space-y-2">
              {okr.key_results.map((kr, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                    kr.completed 
                      ? 'bg-gradient-to-r from-green-400 to-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {kr.completed ? '✓' : index + 1}
                  </div>
                  <div className={`flex-1 p-2 rounded-lg text-xs ${
                    kr.completed 
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 text-gray-700 line-through' 
                      : 'bg-gray-50 border border-gray-200 text-gray-800'
                  }`}>
                    {kr.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}