from collections.abc import AsyncIterator


MOCK_DEFAULT_JSON = '{"result": "mock AI response"}'


class MockAiProvider:
    async def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return MOCK_DEFAULT_JSON

    async def stream_generate(self, system_prompt: str, user_prompt: str, **kwargs) -> AsyncIterator[str]:
        result = await self.generate(system_prompt, user_prompt)
        for i in range(0, len(result), 20):
            yield result[i:i + 20]
