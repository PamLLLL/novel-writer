# AI Provider Conventions

## Abstract Base
- All providers inherit from `AiProvider` abstract base class in `provider.py`
- Must implement `generate(prompt, **kwargs)` and `stream_generate(prompt, **kwargs)`
- `generate()` returns a complete string response
- `stream_generate()` yields string chunks via `AsyncGenerator`

## Supported Providers
1. **Anthropic** (Claude) - native SDK via `claude_provider.py`
2. **OpenAI** - native SDK via `openai_provider.py`
3. **DeepSeek** - OpenAI-compatible, reuses `openai_provider.py` with custom base_url
4. **Qwen** (Alibaba) - OpenAI-compatible
5. **Gemini** (Google) - native SDK via `gemini_provider.py`
6. **MiniMax** - OpenAI-compatible
7. **Zhipu** (GLM) - OpenAI-compatible

## OpenAI-Compatible Pattern
- Providers sharing the OpenAI protocol reuse `openai_provider.py`
- Differentiated only by `base_url` and `api_key` configuration

## Registry
- `registry.py` maps provider names to provider classes
- Use `registry.get_provider(name, model, api_key)` to instantiate
- Provider instances are lightweight and created per-request
