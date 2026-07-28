import logging

from app.services.rules_engine import RulesEngine

logger = logging.getLogger(__name__)
_rules = RulesEngine()

# Load base components from Markdown rule files (hot-reloadable)
SYSTEM_ROLE = _rules.load_generation_rules("system-prompt")
ANTI_CLICHE_RULES = _rules.load_generation_rules("anti-cliche")
QUALITY_DIRECTIVES = _rules.load_generation_rules("quality-directives")


def build_system_prompt(style_instruction: str = "", platform_rules: str = "", reference_texts: list[str] | None = None) -> str:
    parts = [_rules.load_generation_rules("system-prompt")]
    if style_instruction:
        parts.append(f"\n## 写作风格要求\n\n{style_instruction}")
    if platform_rules:
        parts.append(f"\n## 平台适配规则\n\n{platform_rules}")
    if reference_texts:
        ref_parts = []
        for i, text in enumerate(reference_texts[:3], 1):
            trimmed = text.strip()[:2000]
            if trimmed:
                ref_parts.append(f"### 范文{i}\n\n{trimmed}")
        if ref_parts:
            refs = "\n\n".join(ref_parts)
            parts.append(f"\n## 风格参考范文\n\n仔细研读以下目标平台的优秀作品片段，学习并模仿它们的语言风格、句式节奏、叙事手法和用词习惯：\n\n{refs}\n\n你的写作必须在语感和调性上向这些范文靠拢，而非用你默认的AI写作风格。")
    parts.append(_rules.load_generation_rules("anti-cliche"))
    parts.append(_rules.load_generation_rules("quality-directives"))
    return "\n".join(parts)
