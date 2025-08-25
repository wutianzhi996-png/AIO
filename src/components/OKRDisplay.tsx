'use client'

import { OKR } from '@/lib/supabase/types'

interface OKRDisplayProps {
  okr: OKR
}

export default function OKRDisplay({ okr }: OKRDisplayProps) {
  const completedKRs = okr.key_results?.filter(kr => kr.completed).length || 0;
  const totalKRs = okr.key_results?.length || 0;
  const progressPercentage = totalKRs > 0 ? Math.round((completedKRs / totalKRs) * 100) : 0;

  return (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl card-shadow border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">当前目标</h2>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-gray-600">进度</div>
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-gray-700">{progressPercentage}%</span>
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mr-2"></div>
            <h3 className="text-lg font-medium text-gray-900">目标 (Objective)</h3>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100">
            <p className="text-gray-800 font-medium">{okr.objective}</p>
          </div>
        </div>

        {okr.key_results && okr.key_results.length > 0 && (
          <div>
            <div className="flex items-center mb-3">
              <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mr-2"></div>
              <h3 className="text-lg font-medium text-gray-900">关键结果 (Key Results)</h3>
            </div>
            <div className="space-y-3">
              {okr.key_results.map((kr, index) => (
                <div key={index} className="flex items-start space-x-3 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    kr.completed 
                      ? 'bg-gradient-to-r from-green-400 to-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                  }`}>
                    {kr.completed ? '✓' : index + 1}
                  </div>
                  <div className={`flex-1 p-3 rounded-xl transition-all duration-200 ${
                    kr.completed 
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 border border-green-200' 
                      : 'bg-gray-50 border border-gray-200 hover:bg-white hover:border-gray-300'
                  }`}>
                    <p className={`${kr.completed ? 'text-gray-700 line-through' : 'text-gray-800'}`}>
                      {kr.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-100 to-blue-100 text-gray-700">
                已完成 {completedKRs}/{totalKRs} 个关键结果
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            创建时间：{new Date(okr.created_at).toLocaleDateString('zh-CN')}
          </div>
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              progressPercentage === 100 ? 'bg-green-400' : progressPercentage > 50 ? 'bg-yellow-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm text-gray-600">
              {progressPercentage === 100 ? '已完成' : progressPercentage > 50 ? '进行中' : '刚开始'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}