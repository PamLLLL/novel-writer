from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import GlobalSettings
from app.schemas.settings import ApiKeyConfig, GlobalSettingsSchema, TestKeyRequest, TestKeyResponse


async def get_settings(db: AsyncSession) -> GlobalSettingsSchema:
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        row = GlobalSettings(id=1)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    api_keys = {k: ApiKeyConfig(**v) for k, v in (row.api_keys or {}).items()}
    return GlobalSettingsSchema(
        api_keys=api_keys,
        default_provider=row.default_provider,
        preferences=row.preferences or {},
    )


async def update_settings(db: AsyncSession, data: GlobalSettingsSchema) -> None:
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.id == 1))
    row = result.scalar_one_or_none()
    api_keys_dict = {k: v.model_dump() for k, v in data.api_keys.items()}
    if row is None:
        row = GlobalSettings(id=1, api_keys=api_keys_dict, default_provider=data.default_provider, preferences=data.preferences)
        db.add(row)
    else:
        row.api_keys = api_keys_dict
        row.default_provider = data.default_provider
        row.preferences = data.preferences
    await db.commit()


async def test_api_key(data: TestKeyRequest) -> TestKeyResponse:
    try:
        import httpx

        http_client = httpx.AsyncClient(verify=False)

        if data.provider == "anthropic":
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=data.key, http_client=http_client)
            await client.messages.create(
                model=data.model or "claude-sonnet-4-20250514",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
        elif data.provider in ("openai", "deepseek", "qwen", "minimax", "zhipu"):
            from openai import AsyncOpenAI
            from app.core.ai.registry import BASE_URLS, DEFAULT_MODELS

            client = AsyncOpenAI(api_key=data.key, base_url=BASE_URLS.get(data.provider), http_client=http_client)
            await client.chat.completions.create(
                model=data.model or DEFAULT_MODELS.get(data.provider, ""),
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}],
            )
        elif data.provider == "gemini":
            from google import genai

            client = genai.Client(api_key=data.key, http_options={"api_version": "v1beta"})
            await client.aio.models.generate_content(
                model=data.model or "gemini-2.5-flash",
                contents="Hi",
            )
        else:
            return TestKeyResponse(valid=False, error=f"Unknown provider: {data.provider}")
        return TestKeyResponse(valid=True)
    except Exception as e:
        return TestKeyResponse(valid=False, error=str(e))
