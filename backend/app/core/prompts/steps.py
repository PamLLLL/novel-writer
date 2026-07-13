def _build_direction_block(user_direction: str) -> str:
    if not user_direction:
        return ""
    return f"""
## ！！！最高优先级指令！！！

以下是用户的具体要求，你必须严格遵守，生成内容要围绕这些要求来设计：

{user_direction}

以上用户要求的优先级高于其他所有规则。如果用户要求与参考信息有冲突，以用户要求为准。
"""


def prompt_settings(genre: str, concept: str, target_words: int, platform: str = "") -> str:
    platform_hint = f"\n目标发布平台：{platform}，请适配该平台的风格偏好。" if platform else ""
    return f"""请为以下小说创意生成详细的基础设定。

小说类型：{genre}
核心创意：{concept}
目标字数：约{target_words}字{platform_hint}

请以JSON格式返回，包含以下字段：
{{
  "title_suggestions": ["建议标题1", "建议标题2", "建议标题3"],
  "background": "故事背景设定（时代、地点、社会环境等，200字以上）",
  "tone": "整体基调（如：热血、阴郁、轻松幽默等）",
  "core_conflict": "核心冲突/矛盾（100字以上）",
  "themes": ["主题1", "主题2"],
  "target_audience": "目标读者画像",
  "unique_selling_point": "差异化卖点（与同类作品的区别）"
}}

要求：
- 设定要具体、可落地，不要泛泛而谈
- 核心冲突要有足够的戏剧张力
- 要考虑目标字数，设定复杂度要匹配篇幅"""


def prompt_characters(genre: str, concept: str, settings_json: str, target_words: int, user_direction: str = "") -> str:
    return f"""{_build_direction_block(user_direction)}基于以下小说设定，生成完整的人物体系。

小说类型：{genre}
核心创意：{concept}
目标字数：约{target_words}字
基础设定：
{settings_json}

请以JSON格式返回人物列表：
{{
  "characters": [
    {{
      "name": "角色姓名",
      "role": "protagonist/antagonist/supporting",
      "personality": "性格特点（具体、多层次，150字以上）",
      "background": "人物背景故事（200字以上）",
      "appearance": "外貌描写（100字以上）",
      "motivation": "核心动机/目标",
      "arc": "角色成长弧线",
      "relationships": [
        {{"target": "其他角色名", "relation": "关系描述", "dynamic": "关系变化趋势"}}
      ]
    }}
  ]
}}

要求：
- 主角至少1个，需要有清晰的性格缺陷和成长空间
- 反派/对手至少1个，要有合理的动机（不是纯粹的恶）
- 重要配角2-4个，各有特色和作用
- 人物之间要有关系网络和潜在的冲突点
- 根据篇幅调整人物数量：短篇3-5人，中篇5-8人，长篇8-15人"""


def prompt_worldview(genre: str, concept: str, settings_json: str, characters_json: str, user_direction: str = "") -> str:
    return f"""{_build_direction_block(user_direction)}基于以下小说设定和人物，构建世界观体系。

小说类型：{genre}
核心创意：{concept}
基础设定：{settings_json}
人物体系：{characters_json}

请以JSON格式返回：
{{
  "world_type": "世界观类型（现代都市/古代武侠/异界玄幻/未来科幻等）",
  "geography": "地理环境描述（主要场景和地点）",
  "society": "社会结构（阶层、组织、势力等）",
  "power_system": "力量/能力体系（如有，详细描述规则和等级）",
  "history": "重要历史事件（影响当前故事的背景）",
  "rules": ["世界观规则1：...", "世界观规则2：..."],
  "culture": "文化特色（风俗、信仰、禁忌等）",
  "technology": "科技/文明水平"
}}

要求：
- 如果是现代都市类，重点描述社会环境和文化背景
- 如果是玄幻/武侠类，重点描述力量体系和势力格局
- 规则要明确，后续写作必须遵守
- 世界观要为剧情服务，不要为设定而设定"""


def prompt_outline(genre: str, concept: str, settings_json: str, characters_json: str, worldview_json: str, target_words: int, user_direction: str = "") -> str:
    return f"""{_build_direction_block(user_direction)}基于以下所有设定，生成完整的故事大纲。

小说类型：{genre}
核心创意：{concept}
目标字数：约{target_words}字
基础设定：{settings_json}
人物体系：{characters_json}
世界观：{worldview_json}

请以JSON格式返回：
{{
  "premise": "故事前提（一句话概括）",
  "act_one": {{
    "title": "第一幕标题",
    "summary": "第一幕概述（300字以上）",
    "key_events": ["关键事件1", "关键事件2"],
    "turning_point": "第一幕转折点"
  }},
  "act_two": {{
    "title": "第二幕标题",
    "summary": "第二幕概述（500字以上，这是最长的部分）",
    "key_events": ["关键事件1", "关键事件2", "关键事件3"],
    "midpoint": "中点反转",
    "turning_point": "第二幕转折点"
  }},
  "act_three": {{
    "title": "第三幕标题",
    "summary": "第三幕概述（300字以上）",
    "climax": "高潮描述",
    "resolution": "结局方式"
  }},
  "subplots": [
    {{"name": "副线名称", "description": "副线描述", "related_characters": ["角色名"]}}
  ],
  "foreshadowing": [
    {{"setup": "伏笔埋设", "payoff": "伏笔回收", "location": "大约在哪个阶段"}}
  ]
}}

要求：
- 三幕结构清晰，每幕有明确的转折点
- 主线和副线交织，不要平铺直叙
- 伏笔要提前规划，确保后续能自然回收
- 高潮部分要有足够的情感冲击力"""


def prompt_volumes(
    genre: str, concept: str, outline_json: str, characters_json: str,
    worldview_json: str, settings_json: str, target_words: int, user_direction: str = ""
) -> str:
    num_volumes = max(1, target_words // 100000) if target_words > 50000 else 1
    return f"""{_build_direction_block(user_direction)}基于以下完整的小说设定和故事大纲，将小说分为合理的卷结构。

小说类型：{genre}
核心创意：{concept}
目标字数：约{target_words}字
建议分卷数：约{num_volumes}卷

基础设定：{settings_json}
人物体系：{characters_json}
世界观：{worldview_json}
故事大纲：{outline_json}

请以JSON格式返回：
{{
  "volumes": [
    {{
      "title": "卷名（如：第一卷 命运之始）",
      "summary": "本卷详细内容概述（300字以上，要具体说明本卷发生了什么，涉及哪些角色，有什么关键转折）",
      "word_target": 预计字数,
      "key_arc": "本卷主要发展弧线（哪个角色经历了什么变化）",
      "start_state": "卷开始时主角和关键角色的状态",
      "end_state": "卷结束时的状态变化（为下一卷埋下什么钩子）"
    }}
  ]
}}

要求：
- 每卷内容必须紧扣故事大纲中的三幕结构，把大纲的事件合理分配到各卷
- summary 必须具体——要写清楚本卷中发生的关键事件、涉及的人物、情感变化，不要笼统概括
- 每卷有相对完整的叙事弧，卷末有悬念钩子
- 字数分配合理，中间卷可以略长
- 短篇（5万字以下）只分1卷，中篇2-3卷，长篇按10万字左右一卷"""


def prompt_chapter_outlines(
    genre: str, volume_title: str, volume_summary: str, outline_json: str,
    characters_json: str, volume_word_target: int, all_volumes_json: str = "",
    user_direction: str = "", start_chapter_num: int = 1
) -> str:
    default_chapter_count = max(3, volume_word_target // 3000)
    volumes_context = f"\n全部分卷结构（帮助你理解当前卷在整体中的位置）：\n{all_volumes_json}" if all_volumes_json else ""

    return f"""{_build_direction_block(user_direction)}请严格只为【{volume_title}】这一卷生成章节大纲，不要生成其他卷的内容。

小说类型：{genre}
当前卷：{volume_title}
当前卷内容概述：{volume_summary}
本卷目标字数：约{volume_word_target}字
章节编号从第{start_chapter_num}章开始（全书升序编号，不按卷重新计数）
如果用户没有指定章节数，默认约{default_chapter_count}章{volumes_context}

故事大纲：{outline_json}
人物体系：{characters_json}

请以JSON格式返回：
{{
  "chapters": [
    {{
      "title": "第{start_chapter_num}章 章节标题",
      "summary": "本章内容摘要（150-250字，要具体描述本章发生了什么事，谁做了什么，结果如何）",
      "characters_involved": ["出场人物"],
      "emotional_tone": "情感基调",
      "chapter_hook": "章末钩子"
    }}
  ]
}}

要求：
- 只生成【{volume_title}】这一卷的章节，严禁包含其他卷的内容
- 章节编号从第{start_chapter_num}章开始，依次递增
- 如果用户指定了章节数，严格按用户指定的数量生成，忽略默认值
- 章节内容必须严格对应本卷概述中描述的事件和角色
- 每章有明确的叙事目标
- 章节之间衔接自然
- 节奏张弛有度：不要连续多章都是高潮或都是铺垫
- 章末钩子要自然，不要生硬断章"""


def prompt_detailed_outline(
    genre: str,
    chapter_title: str,
    chapter_summary: str,
    characters_json: str,
    worldview_json: str,
    outline_json: str,
    prev_chapter_outline: dict | None = None,
    next_chapter_summary: str = "",
    user_direction: str = "",
) -> str:
    prev_block = ""
    if prev_chapter_outline:
        last_scene = prev_chapter_outline.get("scenes", [{}])[-1] if prev_chapter_outline.get("scenes") else {}
        prev_block = f"""

## 上一章细纲（确保衔接）

上一章最后一个场景：
- 场景位置：{last_scene.get('location', '未知')}
- 场景时间：{last_scene.get('time', '未知')}
- POV角色：{last_scene.get('pov', '未知')}
- 场景结尾过渡：{last_scene.get('transition_to_next', '无')}
- 上一章章节弧线：{prev_chapter_outline.get('chapter_arc', '无')}
"""

    next_block = f"\n下一章摘要（确保本章结尾能自然引向下一章）：{next_chapter_summary}" if next_chapter_summary else ""

    return f"""{_build_direction_block(user_direction)}请为以下章节生成详细的场景级细纲。

小说类型：{genre}
章节标题：{chapter_title}
章节摘要：{chapter_summary}
{prev_block}{next_block}

故事大纲：{outline_json}
人物设定：{characters_json}
世界观：{worldview_json}

请以JSON格式返回：
{{
  "scenes": [
    {{
      "location": "具体场景地点（如：破旧的茶楼二层、雨后的竹林小径）",
      "time": "场景时间（如：深夜、黄昏、清晨第一缕阳光时）",
      "pov": "本场景的视角人物",
      "characters": ["出场人物列表"],
      "purpose": "本场景在叙事中的作用（如：揭示秘密、制造冲突、情感转折）",
      "conflict": "本场景的具体冲突或张力（不要写'无'，每个场景都有张力来源）",
      "emotional_arc": "本场景的情绪变化轨迹（如：从轻松闲聊 → 暗中警觉 → 紧张对峙）",
      "key_beats": [
        "具体的关键节拍——是动作、对话或内心活动，不是笼统描述",
        "例如：'林远假装不经意提到伤疤'而不是'林远试探老陈'"
      ],
      "sensory_anchors": "本场景的感官锚点（视觉、听觉、嗅觉、触觉中至少两种，要具体）",
      "dialogue_notes": "本场景的对话风格指导（谁的语气怎样变化，有什么潜台词）",
      "transition_to_next": "如何过渡到下一个场景（具体动作或事件触发转场）"
    }}
  ],
  "chapter_arc": "本章的整体叙事弧线（如：从平静到暴风雨前的寂静）",
  "key_revelations": ["本章揭示的重要信息"],
  "foreshadowing_plants": ["本章埋下的伏笔"],
  "foreshadowing_payoffs": ["本章回收的之前章节的伏笔"]
}}

要求：
- 每章设计 2-4 个场景，每个场景是一个完整的叙事单元
- key_beats 必须是具体的、可执行的动作或对话要点，不要抽象概括
- sensory_anchors 要足够具体，让写作时有画面感（"茶楼里的檀香味"而不是"有味道"）
- emotional_arc 必须有变化，不能全程一个情绪
- dialogue_notes 要具体到角色和语气变化
- transition_to_next 是具体的转场动作，不是"然后到了下一个场景"
- foreshadowing 要与故事大纲中的伏笔规划对应"""


def prompt_chapter_content(
    genre: str,
    chapter_title: str,
    chapter_summary: str,
    characters_json: str,
    worldview_json: str,
    prev_summary: str = "",
    chapter_word_target: int = 3000,
    user_direction: str = "",
    detailed_outline: dict | None = None,
    narrative_state: dict | None = None,
) -> str:
    import json

    prev_block = ""
    if prev_summary:
        prev_block = f"""

## 前情提要（必读，确保衔接连贯）

{prev_summary}

"""

    narrative_block = ""
    if narrative_state:
        ns = json.dumps(narrative_state, ensure_ascii=False)
        narrative_block = f"""

## 叙事状态（全局故事记忆——确保连贯性）

{ns[:4000]}

"""

    if detailed_outline and detailed_outline.get("scenes"):
        scenes_text = json.dumps(detailed_outline["scenes"], ensure_ascii=False, indent=2)
        chapter_arc = detailed_outline.get("chapter_arc", "")
        plants = detailed_outline.get("foreshadowing_plants", [])
        payoffs = detailed_outline.get("foreshadowing_payoffs", [])
        plant_text = "、".join(plants) if plants else "无"
        payoff_text = "、".join(payoffs) if payoffs else "无"

        return f"""{_build_direction_block(user_direction)}请撰写以下章节的完整正文。
{prev_block}{narrative_block}
## 场景细纲（按场景顺序写作，这是你的创作蓝图）

{scenes_text}

本章弧线：{chapter_arc}
本章需埋伏笔：{plant_text}
本章需回收伏笔：{payoff_text}

小说类型：{genre}
章节标题：{chapter_title}
目标字数：约{chapter_word_target}字
人物设定：{characters_json}
世界观：{worldview_json}

写作要求：
- 【最重要】按照场景细纲中的场景顺序逐场景写作，每个场景的 key_beats 都必须体现在正文中
- 本章开头必须自然承接上一章结尾，不能有任何断裂感
- 每个场景的 sensory_anchors 必须融入描写中，营造沉浸感
- 对话要遵循 dialogue_notes 中的指导，不同角色说话方式不同
- 场景之间的过渡要使用 transition_to_next 中的指导
- emotional_arc 要通过细节展现（表情、动作、环境变化），不要直接写"他感到紧张"
- 开篇要抓人，不要用"阳光洒在..."之类的陈词滥调
- 章末要有悬念或情感钩子
- 目标字数{chapter_word_target}字左右，不要水字数

直接输出小说正文，不要任何解释或标注。"""

    return f"""{_build_direction_block(user_direction)}请撰写以下章节的完整正文。
{prev_block}{narrative_block}
小说类型：{genre}
章节标题：{chapter_title}
章节摘要：{chapter_summary}
目标字数：约{chapter_word_target}字
人物设定：{characters_json}
世界观：{worldview_json}

写作要求：
- 【最重要】本章开头必须自然承接上一章结尾，不能有任何断裂感。如果上一章提供了结尾原文，本章的第一段要在场景、情绪、人物状态上与之无缝衔接
- 严格按照章节摘要的内容来写，但要丰富细节
- 开篇要抓人，不要用"阳光洒在..."之类的陈词滥调
- 对话要生动，符合角色性格
- 场景描写要有五感体验
- 保持与前文中人物名称、关系、状态的一致性
- 章末要有悬念或情感钩子
- 目标字数{chapter_word_target}字左右，不要水字数

直接输出小说正文，不要任何解释或标注。"""


def prompt_extract_narrative_state(
    chapter_title: str,
    chapter_content: str,
    previous_state: dict,
    characters_json: str,
) -> str:
    import json
    prev_state_text = json.dumps(previous_state, ensure_ascii=False)

    return f"""请基于以下新完成的章节内容，更新叙事状态。

## 当前叙事状态（上一次更新后的状态）
{prev_state_text[:6000]}

## 新完成的章节
章节标题：{chapter_title}
章节内容：
{chapter_content[:8000]}

## 人物设定参考
{characters_json}

请以JSON格式返回更新后的完整叙事状态：
{{
  "characters_state": {{
    "角色名": {{
      "location": "当前所在位置",
      "emotion": "当前情绪状态",
      "knowledge": ["该角色目前知道的重要信息"],
      "goals": "该角色当前的目标/动机",
      "relationships_update": "本章中关系的变化（如有）",
      "status": "存活/受伤/失踪等状态"
    }}
  }},
  "plot_hooks": [
    {{
      "description": "情节线索/伏笔描述",
      "setup_chapter": "埋设章节",
      "status": "active/resolved",
      "resolve_chapter": "回收章节（如已回收）"
    }}
  ],
  "timeline": [
    {{
      "chapter": "章节标题",
      "story_time": "故事内时间",
      "events": "关键事件摘要"
    }}
  ],
  "items": [
    {{
      "name": "重要物品名称",
      "current_holder": "当前持有者",
      "location": "当前位置",
      "status": "状态描述"
    }}
  ],
  "rules": [
    {{
      "rule": "已确立的世界规则",
      "source": "确立于哪一章"
    }}
  ]
}}

要求：
- 在上一次状态基础上【增量更新】，不要丢弃之前的信息
- 新章节中出现的角色状态变化要反映在 characters_state 中
- 已解决的 plot_hooks 标记为 resolved，新出现的添加为 active
- timeline 追加本章的关键事件
- 物品状态如有变化要更新
- 如果本章确立了新的世界规则，添加到 rules 中"""


def prompt_polish(
    chapter_content: str,
    characters_json: str,
    selected_text: str = "",
    user_direction: str = "",
) -> str:
    if selected_text:
        context_block = f"""
## 完整章节（保持上下文一致性）
{chapter_content}

## 需要润色的片段
{selected_text}
"""
    else:
        context_block = f"""
## 需要润色的章节
{chapter_content}
"""

    output_hint = "只输出润色后的片段，不要输出整章" if selected_text else "输出润色后的完整章节"

    return f"""{_build_direction_block(user_direction)}请对以下小说文本进行润色，降低AI感，提升文学质感。
{context_block}
人物设定：{characters_json}

润色规则（严格执行）：

### 1. 替换AI典型表达
- "不禁" → 去掉或换成具体动作（"他攥紧了拳"而不是"他不禁攥紧了拳"）
- "一丝XX" → 换成更自然的表达（"一丝笑意"→"嘴角微微翘起"）
- "仿佛/似乎/好像" → 减少使用频率，改用直接描写
- "缓缓" → 大部分可以删除
- "深邃的目光" → 换成具体描写（"他盯着窗外的暮色"）
- "心中涌起一股" → 用身体反应替代（"胃里一阵翻腾"）
- "不由自主" → 删除，直接写动作
- "XXX般的" → 减少比喻堆砌
- "嘴角微微上扬" → 在同一篇中不要重复超过1次

### 2. 对话去AI味
- 确保每个角色说话方式不同（用词、句长、语气词）
- 删除过于书面化的对话（真人说话更短、更口语）
- 加入角色特有的口头禅或语言习惯
- 潜台词胜过直白表达

### 3. 感官细节增强
- 用具体的、独特的感官描写替换通用描写
- "安静的房间" → "只能听到墙上时钟的滴答声"
- 每个场景至少有两种不同感官的描写

### 4. 节奏调整
- 删除不推进情节或情感的描写段落
- 紧张处用短句，舒缓处可以用长句
- 动作场景减少心理描写，用行为展示心理

### 5. 过渡自然化
- 删除"然而"、"不过"等过度使用的转折词
- 用场景细节或动作来制造过渡

{output_hint}。直接输出内容，不要任何解释或标注。"""


def prompt_quality_check(full_text: str, characters_json: str, worldview_json: str) -> str:
    return f"""请对以下小说内容进行全面质量检查。

人物设定：{characters_json}
世界观设定：{worldview_json}

小说内容：
{full_text[:30000]}

请以JSON格式返回检查报告：
{{
  "overall_score": 85,
  "issues": [
    {{
      "severity": "error/warning/info",
      "category": "人物一致性/剧情逻辑/伏笔回收/时间线/设定一致/物品连续性/称谓一致",
      "chapter_title": "问题所在章节的完整标题（如：第1章 命运的开端）",
      "location": "第X章第X段",
      "description": "问题描述",
      "suggestion": "具体的修改建议，要写清楚应该怎么改、改成什么样",
      "original_text": "问题所在的原文片段（20-50字）"
    }}
  ],
  "strengths": ["优点1", "优点2"],
  "summary": "总体评价（200字以上）"
}}

检查维度：
1. 人物一致性：名字、外貌、性格是否前后一致
2. 剧情逻辑：因果关系是否成立
3. 伏笔回收：是否有遗漏的伏笔
4. 时间线：时间描述是否矛盾
5. 设定一致：世界观规则是否被违反
6. 物品连续性：重要物品状态是否连贯
7. 称谓一致：人物称呼是否一致"""
