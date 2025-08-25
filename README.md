# 启明星 (Qiming Star) 学习平台 MVP

一个基于 AI 的学习助手平台，帮助学生设定 OKR 目标并提供智能学习指导。

## 功能特性

- 🔐 **用户认证** - 基于 Supabase Auth 的邮箱登录/注册
- 🎯 **OKR 管理** - 创建和管理学习目标与关键结果
- 🤖 **AI 聊天助手** - 基于知识库的智能问答
- 📋 **任务推荐** - 基于 OKR 的每日任务建议
- 💾 **聊天历史** - 自动保存和查看对话记录

## 技术栈

- **前端**: Next.js 15, TypeScript, Tailwind CSS
- **后端**: Supabase (Auth, Database, pgvector)
- **AI**: OpenAI GPT-3.5-turbo, text-embedding-ada-002
- **部署**: Vercel

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

配置 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. Supabase 数据库设置

在 Supabase SQL Editor 中运行以下 SQL：

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- OKR表
CREATE TABLE public.okrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    key_results JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能操作自己的OKR" ON public.okrs FOR ALL USING (auth.uid() = user_id);

-- 聊天记录表
CREATE TABLE public.chat_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID DEFAULT gen_random_uuid(),
    message JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能操作自己的聊天记录" ON public.chat_history FOR ALL USING (auth.uid() = user_id);

-- 知识库向量表
CREATE TABLE public.knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    embedding VECTOR(1536)
);
CREATE POLICY "对所有认证用户开放读取权限" ON public.knowledge_chunks FOR SELECT USING (auth.role() = 'authenticated');

-- 创建向量搜索函数
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        knowledge_chunks.id,
        knowledge_chunks.content,
        1 - (knowledge_chunks.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks
    WHERE 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY knowledge_chunks.embedding <=> query_embedding
    LIMIT match_count;
$$;
```

### 4. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 部署到 Vercel

1. 将项目推送到 GitHub 仓库
2. 在 Vercel Dashboard 中导入项目
3. 配置环境变量
4. 自动部署完成

## 主要用户流程

1. **注册/登录** - 邮箱注册并登录系统
2. **创建 OKR** - 设定学习目标和关键结果
3. **AI 对话** - 与 AI 助手进行学习问答
4. **任务推荐** - 询问"今天我该做什么？"获取任务建议
5. **查看历史** - 浏览对话记录

## 文件结构

```
src/
├── app/
│   ├── api/           # API 路由
│   ├── auth/         # 认证页面
│   ├── dashboard/    # 主页面
│   └── page.tsx     # 根页面
├── components/      # React 组件
├── lib/
│   ├── services/   # 服务层
│   ├── supabase/  # Supabase 配置
│   └── utils.ts   # 工具函数
└── middleware.ts  # 路由中间件
```
