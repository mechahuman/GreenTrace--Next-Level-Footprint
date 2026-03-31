"""
/api/analyze  — accepts notebook + dataset, runs analysis, returns full result.
"""

import os
import uuid
import tempfile
import shutil
import json
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from models.schemas import AnalysisResult, AnalysisResponse
from core.static_analyzer import analyze_notebook
from core.notebook_runner import run_notebook, estimate_from_static
from core.carbon_calculator import build_summary
from core.path_resolver import prepare_execution_env
from rag.retriever import retrieve_chunks
from rag.groq_client import generate_suggestions, generate_interpretation
import nbformat

router = APIRouter(prefix="/api", tags=["analysis"])

# In-memory job store (replace with Redis for production)
JOB_STORE: dict = {}
PDF_STORE: dict = {}  # job_id -> pdf_path (populated by /report endpoint)


@router.post("/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    notebook: UploadFile = File(..., description="Jupyter notebook (.ipynb)"),
    dataset:  Optional[List[UploadFile]] = File(None, description="Dataset files (optional)"),
    dataset_paths: Optional[str] = Form(None, description="JSON encoded valid paths"),
    region:   Optional[str] = Form(None, description="ISO-3166-1 alpha-3 region code, e.g. IND, USA"),
    run_live: bool          = Form(True,  description="Execute notebook and measure live emissions"),
):
    """
    Uploads notebook and dataset, initiates processing.
    If run_live=True, starts a background job and returns {"job_id": job_id, "status": "processing"}.
    If run_live=False, computes estimation instantly and returns {"job_id": job_id, "status": "completed", "result": ...}
    """

    # ── Validate file types ──────────────────────────────────────────────────
    if not notebook.filename.endswith(".ipynb"):
        raise HTTPException(400, "Notebook must be a .ipynb file.")

    job_id   = str(uuid.uuid4())
    tmp_dir  = tempfile.mkdtemp(prefix=f"greentrace_{job_id}_")

    try:
        # ── Save uploads ─────────────────────────────────────────────────────
        nb_path  = os.path.join(tmp_dir, notebook.filename)
        with open(nb_path, "wb") as f:
            f.write(await notebook.read())
            
        paths = []
        if dataset_paths:
            try:
                paths = json.loads(dataset_paths)
            except:
                pass

        if dataset:
            for i, f in enumerate(dataset):
                rel_path = paths[i] if i < len(paths) else f.filename
                if not rel_path: continue
                # Save the file flat into tmp_dir using just its basename
                # (the path resolver below will copy it to all expected locations)
                flat_path = os.path.join(tmp_dir, os.path.basename(rel_path))
                os.makedirs(os.path.dirname(flat_path), exist_ok=True)
                with open(flat_path, "wb") as out:
                    out.write(await f.read())

        # Initialize job state
        JOB_STORE[job_id] = {"status": "processing"}

        dataset_provided = bool(dataset and len(dataset) > 0)

        # Dispatch background task for both Live Trace and Fast Estimate
        background_tasks.add_task(
            _process_analysis,
            job_id, tmp_dir, nb_path, notebook.filename, dataset_provided, region, run_live
        )
        return {"job_id": job_id, "status": "processing"}

    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(500, f"Analysis initiation failed: {str(e)}")


def _process_analysis(
    job_id: str,
    tmp_dir: str,
    nb_path: str,
    notebook_filename: str,
    dataset_provided: bool,
    region: Optional[str],
    run_live: bool
):
    """
    Background worker that runs the AST analysis, live execution, and RAG suggestions.
    Updates the JOB_STORE and cleans up the temp directory when finished.
    """
    try:
        # ── Smart path resolution ─────────────────────────────────────────────
        try:
            nb_for_paths = nbformat.read(nb_path, as_version=4)
            path_log = prepare_execution_env(tmp_dir, nb_for_paths)
            if path_log:
                import logging
                logging.getLogger(__name__).info(
                    "Path resolution for %s:\n%s", notebook_filename, "\n".join(path_log)
                )
        except Exception:
            pass

        # ── Static analysis ──────────────────────────────────────────────────
        static = analyze_notebook(nb_path)

        # ── Execution / estimation ───────────────────────────────────────────
        if run_live:
            try:
                cell_emissions, hw, total_kwh, total_co2 = run_notebook(
                    nb_path, static, region=region, timeout=600
                )
            except Exception as exec_err:
                cell_emissions, hw, total_kwh, total_co2 = estimate_from_static(
                    nb_path, static, region=region
                )
        else:
            cell_emissions, hw, total_kwh, total_co2 = estimate_from_static(
                nb_path, static, region=region
            )

        # ── Carbon summary ───────────────────────────────────────────────────
        summary = build_summary(cell_emissions, region, static)

        # ── Count execution errors ────────────────────────────────────────────
        errored_cells = [c for c in cell_emissions if getattr(c, 'execution_error', None)]
        cells_with_errors = len(errored_cells)
        execution_note = None
        if cells_with_errors > 0:
            total_cells = len(cell_emissions)
            pct = int(100 * cells_with_errors / max(total_cells, 1))
            execution_note = (
                f"{cells_with_errors} of {total_cells} cells ({pct}%) raised exceptions "
                f"during execution. This usually means the notebook requires a specific dataset "
                f"or file that was not provided, or depends on environment variables / "
                f"installed packages not available in this session. "
                f"The carbon measurements below reflect actual hardware usage during the "
                f"(partially failed) execution — they may underestimate the true footprint "
                f"of a successful run."
            )

        # ── Build analysis result ────────────────────────────────────────────
        analysis = AnalysisResult(
            job_id=job_id,
            notebook_name=notebook_filename,
            dataset_name="Uploaded Dataset(s)" if dataset_provided else "None",
            timestamp=datetime.now(timezone.utc).isoformat(),
            summary=summary,
            cell_breakdown=cell_emissions,
            static_analysis=static,
            hardware_info=hw,
            cells_with_errors=cells_with_errors,
            execution_note=execution_note,
        )

        # ── RAG + Groq suggestions ───────────────────────────────────────────
        try:
            chunks      = retrieve_chunks(static, summary, n_results=6)
            suggestions = generate_suggestions(static, summary, hw, chunks)
            suggestions.job_id = job_id
        except Exception as sug_err:
            from models.schemas import Suggestion, SuggestionsResult
            suggestions = SuggestionsResult(
                job_id=job_id,
                suggestions=[
                    Suggestion(
                        title="Set your Groq API key to unlock AI suggestions",
                        description="Add GROQ_API_KEY to your .env file to receive AI suggestions.",
                        impact="high",
                        category="training_strategy",
                        estimated_savings=None,
                        source_reference="GreenTrace setup guide",
                    )
                ],
                summary_insight=f"Analysis complete. Groq suggestions unavailable: {str(sug_err)[:120]}",
            )

        try:
            interpretation = generate_interpretation(static, summary, hw, cell_emissions)
            suggestions.interpretation = interpretation
        except Exception:
            suggestions.interpretation = None

        # ── Store final output ───────────────────────────────────────────────
        result = AnalysisResponse(
            job_id=job_id,
            analysis=analysis,
            suggestions=suggestions,
        )
        
        JOB_STORE[job_id] = {
            "status": "completed",
            "result": result.dict() if hasattr(result, "dict") else result
        }

    except Exception as e:
        JOB_STORE[job_id] = {
            "status": "failed",
            "error": f"Internal execution failed: {str(e)}"
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)



@router.get("/status/{job_id}")
async def get_status(job_id: str):
    """Retrieve the current processing status of a job."""
    if job_id not in JOB_STORE:
        raise HTTPException(404, f"Job {job_id} not found.")
    return JOB_STORE[job_id]


@router.get("/result/{job_id}")
async def get_result(job_id: str):
    """Retrieve a previously computed analysis result by job ID."""
    if job_id not in JOB_STORE:
        raise HTTPException(404, f"Job {job_id} not found.")
    
    data = JOB_STORE[job_id]
    if data.get("status") == "processing":
        raise HTTPException(400, "Job is still processing.")
    
    if data.get("status") == "failed":
        raise HTTPException(500, data.get("error"))
        
    return data.get("result")


@router.get("/health")
async def health():
    return {"status": "ok", "jobs_cached": len(JOB_STORE)}
