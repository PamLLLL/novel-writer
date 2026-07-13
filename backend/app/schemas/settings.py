from pydantic import BaseModel


class ApiKeyConfig(BaseModel):
    key: str = ""
    default_model: str = ""


class GlobalSettingsSchema(BaseModel):
    api_keys: dict[str, ApiKeyConfig] = {}
    default_provider: str = "anthropic"
    preferences: dict = {}


class TestKeyRequest(BaseModel):
    provider: str
    key: str
    model: str | None = None


class TestKeyResponse(BaseModel):
    valid: bool
    error: str | None = None
