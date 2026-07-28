---
paths:
  - "backend/tests/**/*.py"
---

# 测试编写规范

- pytest + pytest-asyncio
- 内存 SQLite 每测试独立 session
- MockAiProvider 做 AI mock
- httpx AsyncClient 做 HTTP 测试
- asyncio_mode = "auto"
