---
name: create-model
description: 创建新的 SQLAlchemy 模型（继承 UUIDMixin + TimestampMixin）
---

## 步骤
1. 在 backend/app/models/ 创建新文件，继承 Base, UUIDMixin, TimestampMixin
2. 定义字段和关系
3. 在 models/__init__.py 导入
4. 编写测试
