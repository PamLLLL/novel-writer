# 墨韵 MoYun — AI 小说写作工具

## 构建与运行

### 后端
- `cd backend && pip install -e ".[dev]"` 安装依赖
- `cd backend && uvicorn app.main:app --reload --port 8000` 启动后端
- `cd backend && python -m pytest tests/ -v` 运行测试
- `cd backend && ruff check app/` 代码检查

### 前端
- `cd frontend && npm install` 安装依赖
- `cd frontend && npm run dev` 启动开发服务器（端口 3000）

## 技术栈
- 后端：Python 3.11+ / FastAPI / SQLAlchemy(async) / aiosqlite
- 前端：Next.js 16 / React 19 / TypeScript / shadcn/ui / TailwindCSS 4
- AI：7 个 provider（Anthropic / OpenAI / DeepSeek / Qwen / Gemini / MiniMax / ZhiPu）
- 数据库：SQLite（后端 data/ 目录）
- 规则引擎：Markdown 文件驱动（backend/rules/）

## 架构概览

### 后端 (backend/app/)
- `models/` — SQLAlchemy 模型（UUIDMixin + TimestampMixin）
- `schemas/` — Pydantic 请求/响应模型
- `api/routes/` — FastAPI 路由（8 个模块）
- `services/` — 业务逻辑层
  - `generation/` — AI 生成逻辑（按步骤拆分）
  - `rules_engine.py` — Markdown 规则加载引擎
- `core/ai/` — AI 提供商抽象（provider → 实现）
- `core/prompts/` — Prompt 模板（从 rules/ 加载）

### 前端 (frontend/src/)
- `app/` — Next.js App Router 页面
- `components/` — React 组件（steps/ + ui/）
- `hooks/` — 自定义 hooks（SSE 等）
- `lib/` — 工具库（api-client, types）
- `stores/` — Zustand 状态管理

### 规则文件 (backend/rules/)
- `generation/` — AI 生成步骤规则（system-prompt, characters, outline...）
- `platforms/` — 发布平台规则（预留扩展）
- `styles/` — 写作风格模板（预留扩展）

## 关键约定
- 后端：async/await 全异步，数据库用 AsyncSession
- AI 调用：统一走 AiProvider 抽象基类 + registry
- Prompt 规则：存放在 rules/*.md 文件中，运行时加载（热更新）
- API Key：存储在 .env 文件，不入数据库
- 前端 API 调用：统一使用 lib/api-client.ts
- SSE 流式：后端 EventSourceResponse，前端 use-sse.ts hook
