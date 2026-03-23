"""
Centralized configuration
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

from models import ResumeExtractionConfig  

load_dotenv()

# ── Paths ────────────────────────────────────────────────────────────────────

BACKEND_DIR = Path(__file__).parent
EXTRACTION_CONFIG_PATH = BACKEND_DIR / "resume_extraction_config.json"
REGISTRY_PATH = BACKEND_DIR / "registry.json"

# ── Environment variables ────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PORT = int(os.getenv("PORT", 8000))

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── LLM ──────────────────────────────────────────────────────────────────────

LLM_MODEL = "llama-3.1-8b-instant"

# ── RAG / Embeddings ────────────────────────────────────────────────────────

EMBED_MODEL = "all-MiniLM-L6-v2"
RAG_TOP_K = 3
LOW_SIGNAL_SECTIONS = {"technical skills", "skills", "education", "achievements", "general"}

# ── Chunker ──────────────────────────────────────────────────────────────────

SECTION_KEYWORDS = [
    "experience", "work experience", "professional experience", "employment history",
    "projects", "personal projects", "academic projects", "project experience", "side projects",
    "skills", "technical skills", "core competencies", "technologies",
    "education", "academic background", "qualifications", "academics",
    "certifications", "certificates", "licenses",
    "achievements", "awards", "honors", "accomplishments",
    "summary", "objective", "profile", "about me", "about",
    "publications", "research", "volunteering", "interests", "activities",
    "internships", "internship experience",
]


# ── Resume extraction config I/O ────────────────────────────────────────────


def load_extraction_config() -> ResumeExtractionConfig:
    if EXTRACTION_CONFIG_PATH.exists():
        with open(EXTRACTION_CONFIG_PATH) as f:
            data = json.load(f)
        return ResumeExtractionConfig(**data)
    return ResumeExtractionConfig(extract_fields=[])


def save_extraction_config(config: ResumeExtractionConfig):
    with open(EXTRACTION_CONFIG_PATH, "w") as f:
        json.dump(config.model_dump(), f, indent=2)