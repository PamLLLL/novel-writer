from __future__ import annotations

import logging
from pathlib import Path

from app.core.markdown.parser import read_markdown_content

logger = logging.getLogger(__name__)

RULES_DIR = Path(__file__).resolve().parent.parent.parent / "rules"


class RulesFileNotFound(Exception):
    """Raised when a required rules file is missing."""


class RulesEngine:
    """Loads Markdown rule files and assembles prompts.

    Rule files live under RULES_DIR:
        rules/generation/{step}.md
        rules/platforms/{name}.md
        rules/styles/{name}.md
    """

    def __init__(self, rules_dir: Path | None = None) -> None:
        self.rules_dir = rules_dir or RULES_DIR

    def _load(self, path: Path, required: bool = True) -> str:
        if not path.exists():
            if required:
                raise RulesFileNotFound(f"必需的规则文件缺失: {path}")
            logger.warning("可选规则文件不存在，跳过: %s", path)
            return ""

        content = read_markdown_content(path)
        if not content.strip():
            if required:
                raise RulesFileNotFound(f"规则文件内容为空: {path}")
            return ""

        return content

    def load_generation_rules(self, step: str) -> str:
        path = self.rules_dir / "generation" / f"{step}.md"
        return self._load(path, required=True)

    def load_platform_rules(self, platform: str) -> str:
        path = self.rules_dir / "platforms" / f"{platform}.md"
        return self._load(path, required=False)

    def load_style(self, style: str) -> str:
        path = self.rules_dir / "styles" / f"{style}.md"
        return self._load(path, required=False)

    def build_system_base(self) -> str:
        """Load the 3 base system prompt components."""
        parts = [
            self.load_generation_rules("system-prompt"),
            self.load_generation_rules("anti-cliche"),
            self.load_generation_rules("quality-directives"),
        ]
        return "\n".join(parts)

    def list_available(self, category: str) -> list[dict[str, str]]:
        from app.core.markdown.parser import parse_markdown_file

        category_dir = self.rules_dir / category
        if not category_dir.exists():
            return []

        result = []
        for md_file in sorted(category_dir.glob("*.md")):
            if md_file.name == "AGENTS.md":
                continue
            parsed = parse_markdown_file(md_file)
            result.append({
                "name": parsed.name or md_file.stem,
                "display_name": parsed.display_name or md_file.stem,
                "description": parsed.description or "",
            })
        return result
