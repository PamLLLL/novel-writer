import pytest
from app.services.rules_engine import RulesEngine, RulesFileNotFound


@pytest.fixture
def engine():
    return RulesEngine()


def test_load_system_prompt(engine):
    content = engine.load_generation_rules("system-prompt")
    assert content
    assert "写作" in content


def test_load_anti_cliche(engine):
    content = engine.load_generation_rules("anti-cliche")
    assert content
    assert "套路" in content


def test_load_quality_directives(engine):
    content = engine.load_generation_rules("quality-directives")
    assert content
    assert "质量" in content


def test_load_missing_required(engine):
    with pytest.raises(RulesFileNotFound):
        engine.load_generation_rules("nonexistent")


def test_load_optional_missing(engine):
    content = engine.load_platform_rules("nonexistent")
    assert content == ""


def test_build_system_base(engine):
    base = engine.build_system_base()
    assert "写作" in base
    assert "套路" in base
    assert "质量" in base


def test_list_available_generation(engine):
    items = engine.list_available("generation")
    names = [i["name"] for i in items]
    assert "system-prompt" in names
    assert "anti-cliche" in names
