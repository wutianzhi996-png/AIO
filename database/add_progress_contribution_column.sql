-- 为现有的daily_tasks表添加progress_contribution字段
-- 如果你已经创建了daily_tasks表但没有progress_contribution字段，请执行此脚本

-- 添加progress_contribution字段
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS progress_contribution INTEGER DEFAULT 0 
CHECK (progress_contribution >= 0 AND progress_contribution <= 100);

-- 添加字段注释
COMMENT ON COLUMN public.daily_tasks.progress_contribution IS '完成此任务对关键结果进度的贡献值 (0-100)';

-- 为现有任务设置默认的进度贡献值
UPDATE public.daily_tasks 
SET progress_contribution = 10 
WHERE progress_contribution = 0 AND key_result_index IS NOT NULL;

-- 为通用任务（没有关联关键结果的）设置较低的贡献值
UPDATE public.daily_tasks 
SET progress_contribution = 5 
WHERE progress_contribution = 0 AND key_result_index IS NULL;
