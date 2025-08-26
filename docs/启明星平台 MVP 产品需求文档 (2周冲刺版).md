一个人，一个AI编程助手，两周时间，一个核心价值验证的MVP。这意味着我们必须进行**最无情的优先级排序**，砍掉一切非核心功能，只构建能验证**“AI助手能否有效指导学生完成目标”**这一核心假设的最小闭环。

以下是专为此场景定制的 **“启明星”平台 MVP 产品需求文档（2周冲刺版）**。

---

# **🌟 “启明星”平台 MVP 产品需求文档 (2周冲刺版)**

- **文档版本**: MVP v1.0
- **创建日期**: 2025-08-21
- **目标读者**: The Solo Full-Stack Developer (with AI Co-pilot)
- **核心假设**: **一个能回答问题、并基于简单目标（OKR）提供每日待办的AI助手，能有效提升学生的学习清晰度和执行力。**

---

## **1. MVP 核心目标 (The One Goal)**

在2周内，构建并上线一个功能正常的Web应用。该应用允许一名学生**设定一个简单的学习目标（OKR），并能通过AI助手获得基于该目标的每日任务推荐和知识库问答**，以此验证产品的核心价值闭环。

---

## **2. 核心用户与唯一场景 (The Core User & The Golden Path)**

* **用户**: 仅限 **学生** 角色。
* **唯一场景 (The Golden Path)**:
  1. 学生 **小明** 首次访问应用，使用邮箱完成注册和登录。
  2. 登录后，他进入一个简洁的个人主页，引导他**手动创建一个本周的学习目标(O)和2-3个关键结果(KR)**。
  3. 创建后，主页显示他的OKR。他可以与**AI助手聊天**。
  4. 他向AI助手提问：“**今天我该做什么？**”，AI根据他的OKR，返回3条今日待办事项。
  5. 他在学习《数据结构》时遇到一个“B+树”的概念不懂，他向AI助手提问：“**解释一下什么是B+树**”。
  6. AI助手根据我们预置的《数据结构》知识库，给出了精准的回答。
  7. 小明可以查看他与AI的所有聊天记录。

---

## **3. 功能需求清单 (The "Must-Have" List)**

**原则：如果一个功能不是为了完成上述“唯一场景”，那就砍掉它！**

| Feature ID   | 功能名称             | 优先级    | 详细描述                                                | **给Solo Dev的技术实现建议 (AI Co-pilot Friendly)**                                                                                                |
|:------------ |:---------------- |:------ |:--------------------------------------------------- |:------------------------------------------------------------------------------------------------------------------------------------------ |
| **AUTH-101** | **基础用户认证**       | **最高** | 学生可以通过邮箱和密码进行注册、登录、登出。                              | **直接使用 Supabase Auth**。前端用Supabase.js库，几行代码就能搞定。这是最快的方式，不要手写。                                                                              |
| **OKR-101**  | **手动OKR创建**      | **最高** | 提供一个简单的表单，允许用户手动输入1个目标(O)和最多3个关键结果(KR)的文本。创建后显示在主页。 | 前端创建一个React/Vue组件。后端直接调用Supabase API，向`okrs`表插入数据。**无AI，无模板，纯手动文本输入。**                                                                     |
| **AI-201**   | **AI知识库问答(RAG)** | **最高** | 用户在聊天框输入问题，AI能根据预置的知识库（几本核心课程的PDF/Markdown）进行回答。    | **核心技术点**。使用Supabase `pgvector`。编写一个一次性的Python脚本（用AI辅助生成）来读取PDF，进行切片和向量化，然后入库。API可以是一个Vercel Edge Function，负责调用Supabase的RPC函数执行向量搜索并请求LLM。 |
| **AI-202**   | **基于OKR的每日任务推荐** | **最高** | AI助手能响应特定指令（如“今天做什么”），并基于用户设定的OKR文本，生成一个简单的待办列表。    | 在AI-201的API Function中加入一个if判断。如果用户输入包含“今天”和“做什么”，就构建一个特殊的Prompt，将用户的OKR文本 `{okr}` 注入进去，让LLM生成任务列表。**这是最简单的实现，无需复杂工作流。**                    |
| **UI-301**   | **极简主界面**        | **最高** | 一个页面包含三部分：左上角显示用户的OKR，右侧是主要的AI聊天窗口，左下角是聊天历史列表。      | 使用Tailwind CSS快速搭建布局。聊天气泡、输入框等组件可以用现成的UI库（如shadcn/ui）或让AI编程助手生成。**设计追求功能性，而非美观。**                                                          |
| **DATA-401** | **聊天记录存储**       | **最高** | 用户与AI的每一次对话都需要被保存。                                  | 在Supabase中创建一个`chat_history`表。每一次API请求和响应都插入一条记录。前端通过查询该表来渲染聊天历史。                                                                          |

---

## **4. 砍掉的功能 (The "Won't-Have" List for MVP)**

* **所有教师和管理员功能**：砍！
* **所有复杂的AI功能**：如智能诊断、全网资源推荐、成长画像、进度预警、智能任务调配：全砍！
* **所有自动化功能**：如自动更新OKR进度、自动报告：全砍！
* **所有与AIP平台的集成**：砍！
* **所有高级设置**：如个人资料修改、主题切换、多语言：全砍！
* **n8n工作流**：本次不用，用一个Serverless Function搞定所有AI逻辑，追求最简链路。

---

## **5. 技术栈 (The MVP Tech Stack)**

* **前端**: **Next.js** (或 Vite + React)
* **UI库**: **Tailwind CSS** + **shadcn/ui** (可选，为了速度)
* **后端即服务(BaaS)**: **Supabase** (用于Auth, Database, pgvector, Edge Functions)
* **LLM API**: OpenAI API (或任何你熟悉的模型提供商)
* **部署**: **Vercel** (一键部署Next.js和Edge Functions)

---

## **6. 数据模型 (The Simple Schema)**

直接在Supabase SQL Editor中运行以下代码：

```sql
-- 用户表 (由Supabase Auth自动管理，只需开启RLS)
-- public.users

-- OKR表
CREATE TABLE public.okrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    key_results JSONB, -- 存储一个JSON数组，如 [{"text": "KR1"}, {"text": "KR2"}]
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能操作自己的OKR" ON public.okrs FOR ALL USING (auth.uid() = user_id);

-- 聊天记录表
CREATE TABLE public.chat_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID DEFAULT gen_random_uuid(),
    message JSONB, -- 存储 {"role": "user/assistant", "content": "..."}
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能操作自己的聊天记录" ON public.chat_history FOR ALL USING (auth.uid() = user_id);

-- 知识库向量表 (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE public.knowledge_chunks (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    embedding VECTOR(1536) -- 向量维度取决于你的嵌入模型
);
-- RLS策略：对所有用户开放读取权限，写入权限仅限service_role
CREATE POLICY "对所有认证用户开放读取权限" ON public.knowledge_chunks FOR SELECT USING (auth.role() = 'authenticated');
```

---

## **7. 2周开发计划 (The 2-Week Sprint Plan)**

* **Week 1: 后端与核心AI**
  
  * **Day 1-2**: **环境搭建**。初始化Next.js项目，创建Supabase项目，完成数据库表结构设计（直接复制粘贴上面的代码），设置Vercel部署。
  * **Day 3-5**: **核心AI链路打通**。编写本地Python脚本，完成知识库PDF的向量化入库。创建Vercel Edge Function，实现RAG问答逻辑。**这是本次开发最难的部分，集中火力攻克。**
  * **Day 6-7**: **基础功能API化**。实现用户认证、OKR的增删改查、聊天记录的保存与读取API（全部使用Supabase JS SDK或Edge Functions）。

* **Week 2: 前端与集成测试**
  
  * **Day 8-10**: **UI开发**。使用Tailwind CSS快速构建极简主界面，包括登录/注册页、主聊天页。
  * **Day 11-12**: **前后端联调**。将前端UI与所有后端API进行连接，确保“唯一场景”能完整跑通。
  * **Day 13-14**: **测试、修复与部署**。进行密集测试，修复关键Bug，确保在Vercel上部署成功，并找1-2个“种子用户”进行体验。

---

## **8. 验收标准 (Definition of Done)**

当以下所有条件都满足时，MVP开发完成：

1. ✅ 一个新用户可以成功**注册**并**登录**系统。
2. ✅ 登录后，用户可以**创建**并看到自己的OKR。
3. ✅ 用户可以在聊天框中**提问**，并收到基于知识库的**回答**。
4. ✅ 用户可以发送“**今天做什么**”并收到基于其OKR的**任务列表**。
5. ✅ 所有的**聊天记录**都被保存并正确显示。
6. ✅ 应用已成功**部署**到Vercel，并可以通过公开URL访问。
