# Models Conventions

## Base Classes
- All models inherit from `Base` (declarative base)
- Include `UUIDMixin` (UUID primary key) and `TimestampMixin` (created_at, updated_at)
- Table name set via `__tablename__`

## Column Style
- Use `Mapped[T]` type annotations with `mapped_column()` for all columns
- Example: `name: Mapped[str] = mapped_column(String(200), nullable=False)`
- Optional fields: `Mapped[Optional[str]]`

## Relationships
- Always use `relationship()` with explicit `back_populates` on both sides
- Parent-to-child: `cascade="all, delete-orphan"` for owned entities
- Foreign keys: `Mapped[str] = mapped_column(ForeignKey("parent.id"))`

## SQLite Compatibility
- JSON/dict data stored as `Text` column, serialized/deserialized manually
- No array columns; use related tables or JSON-in-Text instead
- Avoid database-specific features not supported by SQLite
