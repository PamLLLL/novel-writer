---
paths:
  - "backend/app/api/**/*.py"
---

# FastAPI 路由规范

- 每个模块用 APIRouter()
- 数据库 session 通过 Depends(get_db) 注入
- SSE 流式响应用 EventSourceResponse
- prefix 在 main.py include_router 时设置
- 错误用 HTTPException
