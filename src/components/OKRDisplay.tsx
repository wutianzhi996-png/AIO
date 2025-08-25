'use client'

import { OKR } from '@/lib/supabase/types'

interface OKRDisplayProps {
  okr: OKR
}

export default function OKRDisplay({ okr }: OKRDisplayProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">当前目标</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-blue-600 mb-2">目标 (Objective)</h3>
          <p className="text-gray-800 bg-blue-50 p-3 rounded">{okr.objective}</p>
        </div>

        {okr.key_results && okr.key_results.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-green-600 mb-2">关键结果 (Key Results)</h3>
            <div className="space-y-2">
              {okr.key_results.map((kr, index) => (
                <div key={index} className="flex items-start">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-sm font-medium mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-gray-800 bg-green-50 p-2 rounded flex-1">{kr.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-sm text-gray-500">
          创建时间：{new Date(okr.created_at).toLocaleDateString('zh-CN')}
        </div>
      </div>
    </div>
  )
}