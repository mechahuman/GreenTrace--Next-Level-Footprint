"""
GreenTrace — ML Carbon Footprint Analyzer
FastAPI backend entry point.
"""

import matplotlib
matplotlib.use("Agg")

import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from rag.ingestion import ingest_documents
from routers.analyze import router as analyze_router
from routers.report  import router as report_router


# ──────────────────────────────────────────────
# Startup / shutdown
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ingest green-AI documents into ChromaDB on first run (in background so it doesn't block startup)
    def run_ingestion():
        try:
            ingest_documents()
        except Exception as e:
            print(f"[WARN] RAG ingestion failed (non-fatal): {e}")

    # Fire and forget in a background thread
    asyncio.create_task(asyncio.to_thread(run_ingestion))
    
    yield
    # Cleanup on shutdown (nothing to do currently)


# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────

app = FastAPI(
    title="GreenTrace",
    description="Carbon Footprint Analyzer for ML/DL Notebooks",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React dev server and any deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:3000",   # Alt dev
        "https://green-trace-next-level-footprint.vercel.app",
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(report_router)


@app.get("/")
async def root():
    return {
        "service": "GreenTrace",
        "version": "1.0.0",
        "docs":    "/docs",
    }

if __name__ == "__main__":
    import uvicorn
    # Render sets the PORT environment variable
    # If it's not set (e.g. running locally), default to 8000
    port = int(os.environ.get("PORT", 8000))
    # Binding to 0.0.0.0 ensures the app is accessible outside the local container
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
