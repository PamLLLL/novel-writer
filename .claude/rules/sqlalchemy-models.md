---
paths:
  - "backend/app/models/**/*.py"
---

# SQLAlchemy 模型规范

- 继承 Base + UUIDMixin + TimestampMixin
- Mapped[] + mapped_column() 声明式
- 关系用 relationship() + back_populates
- 级联删除用 cascade="all, delete-orphan"
