from app.core.style.presets import STYLE_PRESETS, PLATFORM_RULES


def compile_style(style_config: dict) -> str:
    parts = []

    preset_id = style_config.get("preset", "")
    if preset_id and preset_id in STYLE_PRESETS:
        preset = STYLE_PRESETS[preset_id]
        parts.append(f"【预设风格 — {preset['name']}】\n{preset['instruction']}")

    custom_desc = style_config.get("custom_description", "")
    if custom_desc:
        parts.append(f"【自定义风格要求】\n{custom_desc}")

    author_style = style_config.get("author_style", "")
    if author_style:
        parts.append(f"【作者风格参考】\n{author_style}")

    text_style = style_config.get("text_analysis", "")
    if text_style:
        parts.append(f"【文本分析风格特征】\n{text_style}")

    if not parts:
        return ""

    return "\n\n".join(parts)


def get_platform_rules(platform: str) -> str:
    rules = PLATFORM_RULES.get(platform, {})
    if not rules:
        return ""
    return f"目标平台：{platform}\n章节长度要求：{rules['chapter_length']}\n平台风格要求：{rules['style']}"
