from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.settings import GlobalSettingsSchema, TestKeyRequest, TestKeyResponse
from app.services import settings_service

router = APIRouter()


@router.get("", response_model=GlobalSettingsSchema)
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await settings_service.get_settings(db)


@router.put("")
async def update_settings(data: GlobalSettingsSchema, db: AsyncSession = Depends(get_db)):
    await settings_service.update_settings(db, data)
    return {"status": "ok"}


@router.post("/test-key", response_model=TestKeyResponse)
async def test_key(data: TestKeyRequest):
    return await settings_service.test_api_key(data)
