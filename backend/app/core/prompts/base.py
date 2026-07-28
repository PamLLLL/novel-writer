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
            parts.append(
                f"\n## 风格参考范文（你的写作标杆）\n\n"
                f"以下是目标平台的优秀作品片段。你的每一个句子都要问自己：'这句话放在范文里违和吗？'如果违和，重写。\n"
                f"你的句式长度、用词密度、对话比例都要向范文看齐，而不是用你默认的写作习惯。\n\n"
                f"{refs}"
            )
    parts.append(_rules.load_generation_rules("writing-examples"))
    parts.append(_rules.load_generation_rules("anti-ai-substitution"))
    parts.append(_rules.load_generation_rules("anti-cliche"))
    parts.append(_rules.load_generation_rules("quality-directives"))
    return "\n".join(parts)
