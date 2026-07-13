from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="墨韵 MoYun",
    description="AI Novel Writing Tool",
    version="2.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import health, projects, settings as settings_router, steps, style, export, knowledge

app.include_router(health.router, prefix="/api")
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])
app.include_router(steps.router, prefix="/api/steps", tags=["steps"])
app.include_router(style.router, prefix="/api/style", tags=["style"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
