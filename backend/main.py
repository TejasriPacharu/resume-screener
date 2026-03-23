"""
Resume Screener – FastAPI Backend
Wraps the existing pipeline modules into HTTP endpoints.
"""

import json
import os
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Optional

import uvicorn

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from groq import Groq
from models import ResumeField, ResumeExtractionConfig
from config import GROQ_API_KEY, PORT, ALLOWED_ORIGINS, load_extraction_config, save_extraction_config

# ── pipeline modules ────────────────────────────────────────────────────────
import parser as resume_parser
import extractor
import scorer
import duplicate
import rag as rag_module

app = FastAPI(title="Resume Screener API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ──────────────────────────────────────────────────────────────────

def get_client() -> Groq:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in environment.")
    return Groq(api_key=GROQ_API_KEY)




# ── models ───────────────────────────────────────────────────────────────────

class ConfigPayload(BaseModel):
    extract_fields: list[ResumeField]


class JDEntry(BaseModel):
    role_name: str
    jd_text: str


# ── routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# --- Config ---

@app.get("/config")
def get_config():
    return load_extraction_config()


@app.put("/config")
def update_config(payload: ConfigPayload):
    config = ResumeExtractionConfig(extract_fields=payload.extract_fields)
    save_extraction_config(config)
    return {"message": "Config updated.", "extract_fields": payload.extract_fields}


# --- Screen (unified: single or batch) ---

async def _process_resume(
    resume: UploadFile,
    jds: list[dict],
    fields: list,
    client: Groq,
    force: bool,
    single: bool,
) -> tuple[dict | None, JSONResponse | None]:
    """
    Parse, extract, and score one resume against all JDs.
    Returns (result_dict, None) on success, or (None, JSONResponse) for a 409 duplicate hit
    (only raised in single-file mode), or (error_dict, None) for soft errors in batch mode.
    """
    suffix = Path(resume.filename).suffix.lower()
    if suffix not in (".pdf", ".docx"):
        return {"filename": resume.filename, "error": "Unsupported file type."}, None

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(resume.file, tmp)
        tmp_path = tmp.name

    try:
        role_id = jds[0]["role_name"]
        is_dup = duplicate.is_duplicate(tmp_path, role_id)

        if is_dup and not force:
            if single:
                return None, JSONResponse(
                    status_code=409,
                    content={
                        "duplicate": True,
                        "message": f"'{resume.filename}' was already uploaded for role '{role_id}'. Use force=true to re-process.",
                    },
                )
            # In batch mode, record duplicate status but still skip re-processing
            return {
                "filename": resume.filename,
                "is_duplicate": True,
                "error": f"Already uploaded for role '{role_id}'. Use force=true to re-process.",
            }, None

        try:
            resume_text = resume_parser.parse(tmp_path)
        except Exception as e:
            return {"filename": resume.filename, "error": str(e)}, None

        if not extractor.is_resume(client, resume_text):
            return {"filename": resume.filename, "error": "File does not appear to be a resume or CV."}, None

        extracted = extractor.extract(client, resume_text, fields)
        candidate_name = extracted.get("name", Path(resume.filename).stem)

        scores = []
        for jd in jds:
            role_name = jd["role_name"]
            jd_text = jd["jd_text"]
            extraction_score = scorer.score_from_extraction(client, extracted, jd_text, role_name)
            chunks = rag_module.retrieve_relevant_chunks(resume_text, jd_text)
            candidate_yoe = extracted.get("years_of_experience")
            rag_score = scorer.score_from_rag(client, chunks, jd_text, role_name, candidate_yoe)
            scores.append({
                "role_name": role_name,
                "extraction_score": extraction_score,
                "rag_score": rag_score,
                "rag_chunks": chunks,
            })

        duplicate.register(tmp_path, role_id)

        return {
            "candidate_name": candidate_name,
            "filename": resume.filename,
            "is_duplicate": is_dup,
            "extracted": extracted,
            "scores": scores,
            "timestamp": datetime.now().isoformat(),
        }, None

    finally:
        os.unlink(tmp_path)


@app.post("/screen")
async def screen_resumes(
    resumes: list[UploadFile] = File(...),
    jd_entries: str = Form(...),
    force: bool = Form(False),
):
    """
    Unified screening endpoint: accepts one or more resume files against the same set of JDs.
    """
    try:
        jds: list[dict] = json.loads(jd_entries)
        assert isinstance(jds, list) and len(jds) > 0
        for jd in jds:
            assert "role_name" in jd and "jd_text" in jd
    except Exception:
        raise HTTPException(status_code=400, detail="jd_entries must be a JSON array of {role_name, jd_text}.")

    config = load_extraction_config()
    fields = config.extract_fields
    client = get_client()

    single = len(resumes) == 1
    all_results = []

    for resume in resumes:
        result, early_response = await _process_resume(resume, jds, fields, client, force, single)
        if early_response is not None:
            return early_response
        all_results.append(result)

    return {"results": all_results}


# --- Clear duplicates ---

@app.delete("/duplicates")
def clear_all_duplicates():
    """Clear duplicate registry for ALL roles (useful after config changes)."""
    duplicate.clear_all()
    return {"message": "Cleared duplicate registry for all roles."}


@app.delete("/duplicates/{role_id}")
def clear_duplicates(role_id: str):
    duplicate.clear_role(role_id)
    return {"message": f"Cleared duplicate registry for role: {role_id}"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)