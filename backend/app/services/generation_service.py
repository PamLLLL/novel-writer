# Re-export all generation functions for backward compatibility.
# New code should import from app.services.generation.xxx directly.

from app.services.generation.settings_gen import generate_settings_stream
from app.services.generation.characters_gen import (
    generate_single_character_stream,
    generate_characters_stream,
)
from app.services.generation.worldview_gen import generate_worldview_stream
from app.services.generation.outline_gen import (
    generate_outline_stream,
    generate_outline_act_stream,
    generate_outline_item_stream,
)
from app.services.generation.volumes_gen import (
    generate_volumes_stream,
    generate_chapter_outlines_stream,
    generate_detailed_outline_stream,
    generate_batch_detailed_outlines_stream,
)
from app.services.generation.content_gen import (
    generate_chapter_content_stream,
    rewrite_chapter_stream,
    continue_chapter_stream,
)
from app.services.generation.polish_gen import (
    polish_chapter_stream,
    generate_quality_check_stream,
    apply_quality_fix_stream,
    generate_publish_materials_stream,
)

__all__ = [
    "generate_settings_stream",
    "generate_single_character_stream",
    "generate_characters_stream",
    "generate_worldview_stream",
    "generate_outline_stream",
    "generate_outline_act_stream",
    "generate_outline_item_stream",
    "generate_volumes_stream",
    "generate_chapter_outlines_stream",
    "generate_chapter_content_stream",
    "generate_detailed_outline_stream",
    "generate_batch_detailed_outlines_stream",
    "rewrite_chapter_stream",
    "continue_chapter_stream",
    "polish_chapter_stream",
    "generate_quality_check_stream",
    "apply_quality_fix_stream",
    "generate_publish_materials_stream",
]
