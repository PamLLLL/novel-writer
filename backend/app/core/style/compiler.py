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

    parts = [
        f"目标平台：{platform}",
        f"章节长度要求：{rules['chapter_length']}",
        f"平台风格要求：{rules['style']}",
    ]

    if rules.get("writing_technique"):
        parts.append(rules["writing_technique"])

    if rules.get("opening_rules"):
        parts.append(f"开篇规则：{rules['opening_rules']}")

    if rules.get("pacing_rules"):
        parts.append(f"节奏控制：{rules['pacing_rules']}")

    if rules.get("dialogue_rules"):
        parts.append(f"对话要求：{rules['dialogue_rules']}")

    if rules.get("character_rules"):
        parts.append(f"人物塑造：{rules['character_rules']}")

    if rules.get("structure_rules"):
        parts.append(f"结构要求：{rules['structure_rules']}")

    if rules.get("immersion_rules"):
        parts.append(f"代入感技巧：{rules['immersion_rules']}")

    if rules.get("forbidden_patterns"):
        items = "\n".join(f"  - {p}" for p in rules["forbidden_patterns"])
        parts.append(f"禁忌事项：\n{items}")

    if rules.get("good_examples"):
        items = "\n".join(f"  - {e}" for e in rules["good_examples"])
        parts.append(f"范例参考：\n{items}")

    genre_tips = rules.get("genre_tips", {})
    if genre_tips:
        for genre_name, tip in genre_tips.items():
            parts.append(f"【{genre_name}特别指导】\n{tip}")

    return "\n".join(parts)
