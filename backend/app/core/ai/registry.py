from app.core.ai.provider import AiProvider
from app.core.ai.claude_provider import ClaudeProvider
from app.core.ai.openai_provider import OpenAIProvider
from app.core.ai.gemini_provider import GeminiProvider

DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "deepseek": "deepseek-chat",
    "qwen": "qwen-max",
    "gemini": "gemini-2.5-flash",
    "minimax": "MiniMax-Text-01",
    "zhipu": "glm-4-plus",
}

PROVIDER_NAMES = {
    "anthropic": "Anthropic Claude",
    "openai": "OpenAI",
    "deepseek": "DeepSeek",
    "qwen": "通义千问",
    "gemini": "Google Gemini",
    "minimax": "MiniMax",
    "zhipu": "智谱 GLM",
}

BASE_URLS = {
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "minimax": "https://api.minimax.chat/v1",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
}

OPENAI_COMPATIBLE = ("openai", "deepseek", "qwen", "minimax", "zhipu")


def get_provider(provider_name: str, api_key: str, model: str | None = None) -> AiProvider:
    model = model or DEFAULT_MODELS.get(provider_name, "")

    if provider_name == "anthropic":
        return ClaudeProvider(api_key=api_key, model=model)
    elif provider_name in OPENAI_COMPATIBLE:
        return OpenAIProvider(api_key=api_key, model=model, base_url=BASE_URLS.get(provider_name))
    elif provider_name == "gemini":
        return GeminiProvider(api_key=api_key, model=model)
    else:
        raise ValueError(f"Unknown provider: {provider_name}")
