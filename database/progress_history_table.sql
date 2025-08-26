-- 进度历史记录表
-- 用于存储关键结果的每次进度更新记录

CREATE TABLE public.progress_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    okr_id UUID REFERENCES public.okrs(id) ON DELETE CASCADE,
    key_result_index INTEGER NOT NULL, -- 关键结果在数组中的索引
    key_result_text TEXT NOT NULL, -- 关键结果文本（冗余存储，防止OKR修改后历史记录丢失）
    progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100), -- 进度百分比
    progress_description TEXT, -- 进度描述
    previous_progress INTEGER, -- 上一次的进度（用于计算变化）
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用行级安全策略
ALTER TABLE public.progress_history ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能操作自己的进度历史记录
CREATE POLICY "用户只能操作自己的进度历史记录" ON public.progress_history 
FOR ALL USING (auth.uid() = user_id);

-- 创建索引以提高查询性能
CREATE INDEX idx_progress_history_user_okr ON public.progress_history(user_id, okr_id);
CREATE INDEX idx_progress_history_okr_kr ON public.progress_history(okr_id, key_result_index);
CREATE INDEX idx_progress_history_created_at ON public.progress_history(created_at DESC);

-- 创建复合索引用于常见查询
CREATE INDEX idx_progress_history_lookup ON public.progress_history(okr_id, key_result_index, created_at DESC);

-- 添加注释
COMMENT ON TABLE public.progress_history IS '关键结果进度历史记录表';
COMMENT ON COLUMN public.progress_history.key_result_index IS '关键结果在OKR中的索引位置';
COMMENT ON COLUMN public.progress_history.key_result_text IS '关键结果文本快照';
COMMENT ON COLUMN public.progress_history.progress IS '进度百分比 (0-100)';
COMMENT ON COLUMN public.progress_history.previous_progress IS '上一次的进度值';
COMMENT ON COLUMN public.progress_history.progress_description IS '本次进度更新的描述';
