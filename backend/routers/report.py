"""
/api/report/{job_id}  — generates and streams a PDF report for a completed analysis.
"""

import os
import tempfile
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from routers.analyze import JOB_STORE
from core.pdf_generator import generate_pdf
from models.schemas import AnalysisResult, SuggestionsResult

router = APIRouter(prefix="/api", tags=["report"])

# Track generated PDF paths to avoid regenerating on repeated downloads
_PDF_CACHE: dict = {}


@router.get("/report/{job_id}")
async def download_report(job_id: str):
    """Generate (or reuse cached) PDF report and return it as a file download."""
    if job_id not in JOB_STORE:
        raise HTTPException(404, f"Job {job_id} not found.")

    job = JOB_STORE[job_id]

    if job.get("status") == "processing":
        raise HTTPException(400, "Job is still processing. Please wait until analysis completes.")

    if job.get("status") == "failed":
        raise HTTPException(500, f"Cannot generate report — analysis failed: {job.get('error')}")

    # Return cached PDF if it still exists on disk
    if job_id in _PDF_CACHE:
        cached = _PDF_CACHE[job_id]
        if os.path.exists(cached):
            return FileResponse(
                path=cached,
                media_type="application/pdf",
                filename=f"greentrace_report_{job_id[:8]}.pdf",
            )

    # JOB_STORE saves the result as a plain dict (via .dict()), so we
    # must reconstruct Pydantic models before passing to generate_pdf.
    result_dict = job.get("result")
    if not result_dict:
        raise HTTPException(500, "Result data is missing from the job store.")

    try:
        analysis_dict    = result_dict.get("analysis", {})
        suggestions_dict = result_dict.get("suggestions", {})
        analysis    = AnalysisResult(**analysis_dict)
        suggestions = SuggestionsResult(**suggestions_dict)
    except Exception as e:
        raise HTTPException(500, f"Failed to deserialise result data: {str(e)}")

    # Write PDF to a persistent temp file (deleted when the server restarts)
    tmp_dir  = tempfile.mkdtemp(prefix="greentrace_pdf_")
    pdf_path = os.path.join(tmp_dir, f"greentrace_{job_id[:8]}.pdf")

    try:
        generate_pdf(analysis, suggestions, pdf_path)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {str(e)}")

    _PDF_CACHE[job_id] = pdf_path

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"greentrace_report_{job_id[:8]}.pdf",
    )
