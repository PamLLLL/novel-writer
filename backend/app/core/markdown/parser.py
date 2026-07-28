from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import frontmatter

logger = logging.getLogger(__name__)


@dataclass
class ParsedMarkdown:
    content: str
    metadata: dict = field(default_factory=dict)
    name: str = ""
    type: str = ""
    display_name: str = ""
    description: str = ""


def parse_markdown_file(path: str | Path) -> ParsedMarkdown:
    path = Path(path)
    raw = path.read_text(encoding="utf-8")

    try:
        post = frontmatter.loads(raw)
        metadata = dict(post.metadata)
        return ParsedMarkdown(
            content=post.content,
            metadata=metadata,
            name=metadata.get("name", ""),
            type=metadata.get("type", ""),
            display_name=metadata.get("display_name", ""),
            description=metadata.get("description", ""),
        )
    except Exception:
        logger.warning("Failed to parse frontmatter in %s, using raw content", path)
        return ParsedMarkdown(content=raw)


def read_markdown_content(path: str | Path) -> str:
    parsed = parse_markdown_file(path)
    return parsed.content
