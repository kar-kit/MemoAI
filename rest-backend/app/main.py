# app/main.py

from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.db.client import ensure_indexes, test_connection as test_db_connection
from app.services.ollama_health import test_ollama

## Routers
from app.routers.auth import router as auth_router
from app.routers.llm import router as llm_router
from app.routers.decks import router as decks_router
from app.routers.study import router as study_router
from app.routers.survey import router as survey_router


import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
)

app = FastAPI(title="MemoAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    same_site="lax",  # good for local + prod
    https_only=False,  # set True in production
)

app.include_router(auth_router)
app.include_router(llm_router)
app.include_router(decks_router)
app.include_router(study_router)
app.include_router(survey_router)


@app.on_event("startup")
def startup_checks():
    print("🚀 Starting MemoAI API...")

    # 1) DB check
    print("🔌 Checking MongoDB connection...")
    test_db_connection()
    print("✅ MongoDB ready 🗄️")

    # 2) Ollama check
    print("🧠 Checking Ollama server + model...")
    test_ollama()
    print("✅ Ollama ready ⚡️")

    print("📚 Ensuring MongoDB indexes...")
    ensure_indexes()
    print("✅ Indexes ready")

    print("🎉 Startup checks passed — API is live ✅")


@app.get("/")
def read_root():
    return {"status": "ok"}
