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

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

# ── pipeline modules ────────────────────────────────────────────────────────
import parser as resume_parser
import extractor
import scorer
import duplicate
import rag as rag_module

load_dotenv()

PORT = int(os.getenv("PORT", 8000))

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="Resume Screener API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_PATH = Path(__file__).parent / "config.json"


# ── helpers ──────────────────────────────────────────────────────────────────

def get_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in environment.")
    return Groq(api_key=api_key)


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {"extract_fields": []}


def save_config(config: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


# ── models ───────────────────────────────────────────────────────────────────

class ConfigPayload(BaseModel):
    extract_fields: list[str]


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
    return load_config()


@app.put("/config")
def update_config(payload: ConfigPayload):
    config = {"extract_fields": payload.extract_fields}
    save_config(config)
    return {"message": "Config updated.", "extract_fields": payload.extract_fields}


# --- Screen ---

@app.post("/screen")
async def screen_resume(
    resume: UploadFile = File(...),
    jd_entries: str = Form(...),       # JSON string: [{role_name, jd_text}, ...]
    force: bool = Form(False),
):
    """
    Main endpoint: parse → extract → score (extraction + RAG) for each JD.
    Accepts multipart/form-data with one resume file + JSON jd_entries.
    """
    # Validate file type
    suffix = Path(resume.filename).suffix.lower()
    if suffix not in (".pdf", ".docx"):
        raise HTTPException(status_code=400, detail="Only .pdf and .docx files are supported.")

    # Parse jd_entries
    try:
        jds: list[dict] = json.loads(jd_entries)
        assert isinstance(jds, list) and len(jds) > 0
        for jd in jds:
            assert "role_name" in jd and "jd_text" in jd
    except Exception:
        raise HTTPException(status_code=400, detail="jd_entries must be a JSON array of {role_name, jd_text}.")

    config = load_config()
    fields = config.get("extract_fields", [])
    client = get_client()

    # Save uploaded file to temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(resume.file, tmp)
        tmp_path = tmp.name

    try:
        role_id = jds[0]["role_name"]

        # Duplicate check
        is_dup = duplicate.is_duplicate(tmp_path, role_id)
        if is_dup and not force:
            return JSONResponse(
                status_code=409,
                content={
                    "duplicate": True,
                    "message": f"'{resume.filename}' was already uploaded for role '{role_id}'. Use force=true to re-process.",
                },
            )

        # Parse
        try:
            resume_text = resume_parser.parse(tmp_path)
        except (FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=422, detail=str(e))

        # Validate it's actually a resume
        if not extractor.is_resume(client, resume_text):
            raise HTTPException(
                status_code=422,
                detail=f"'{resume.filename}' does not appear to be a resume or CV. Please upload a resume file."
            )

        # Extract
        extracted = extractor.extract(client, resume_text, fields)
        candidate_name = extracted.get("name", Path(resume.filename).stem)

        # Score per JD
        results = []
        for jd in jds:
            role_name = jd["role_name"]
            jd_text = jd["jd_text"]

            extraction_score = scorer.score_from_extraction(client, extracted, jd_text, role_name)

            chunks = rag_module.retrieve_relevant_chunks(resume_text, jd_text)
            candidate_yoe = extracted.get("years_of_experience")
            rag_score = scorer.score_from_rag(client, chunks, jd_text, role_name, candidate_yoe)

            results.append({
                "role_name": role_name,
                "extraction_score": extraction_score,
                "rag_score": rag_score,
                "rag_chunks": chunks,
            })

        # Register after successful processing
        duplicate.register(tmp_path, role_id)

        return {
            "candidate_name": candidate_name,
            "filename": resume.filename,
            "is_duplicate": is_dup,
            "extracted": extracted,
            "scores": results,
            "timestamp": datetime.now().isoformat(),
        }

    finally:
        os.unlink(tmp_path)


# --- Batch ---

@app.post("/batch")
async def batch_screen(
    resumes: list[UploadFile] = File(...),
    jd_entries: str = Form(...),
):
    """
    Batch endpoint: process multiple resumes against the same set of JDs.
    Returns an array of results (same shape as /screen per item).
    """
    try:
        jds: list[dict] = json.loads(jd_entries)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid jd_entries JSON.")

    config = load_config()
    fields = config.get("extract_fields", [])
    client = get_client()

    all_results = []

    for resume in resumes:
        suffix = Path(resume.filename).suffix.lower()
        if suffix not in (".pdf", ".docx"):
            all_results.append({"filename": resume.filename, "error": "Unsupported file type."})
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(resume.file, tmp)
            tmp_path = tmp.name

        try:
            try:
                resume_text = resume_parser.parse(tmp_path)
            except Exception as e:
                all_results.append({"filename": resume.filename, "error": str(e)})
                continue

            if not extractor.is_resume(client, resume_text):
                all_results.append({
                    "filename": resume.filename,
                    "error": "File does not appear to be a resume or CV."
                })
                continue

            extracted = extractor.extract(client, resume_text, fields)
            candidate_name = extracted.get("name", Path(resume.filename).stem)

            role_id = jds[0]["role_name"] if jds else "batch"
            is_dup = duplicate.is_duplicate(tmp_path, role_id)

            scores = []
            for jd in jds:
                jd_text = jd["jd_text"]
                role_name = jd["role_name"]
                ext_score = scorer.score_from_extraction(client, extracted, jd_text, role_name)
                chunks = rag_module.retrieve_relevant_chunks(resume_text, jd_text)
                candidate_yoe = extracted.get("years_of_experience")
                rag_score = scorer.score_from_rag(client, chunks, jd_text, role_name, candidate_yoe)
                scores.append({
                    "role_name": role_name,
                    "extraction_score": ext_score,
                    "rag_score": rag_score,
                    "rag_chunks": chunks,
                })

            duplicate.register(tmp_path, role_id)

            all_results.append({
                "candidate_name": candidate_name,
                "filename": resume.filename,
                "is_duplicate": is_dup,
                "extracted": extracted,
                "scores": scores,
                "timestamp": datetime.now().isoformat(),
            })
        finally:
            os.unlink(tmp_path)

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
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)