---
name: create-ai-provider
description: 新增 AI 模型提供商（继承 AiProvider 基类）
---

## 步骤
1. 在 backend/app/core/ai/ 创建 provider 文件
2. 继承 AiProvider，实现 generate() 和 stream_generate()
3. 在 registry.py 注册
4. 在 .env.example 添加 Key 模板
