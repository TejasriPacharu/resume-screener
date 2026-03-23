import re

from config import SECTION_KEYWORDS


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r"[:\-|•]+$", "", text).strip()
    return text


def _is_header(line: str) -> bool:
    """
    A line is a section header if:
    - It's short (< 60 chars)
    - Its normalized form matches or starts with a known section keyword
    - It doesn't look like a sentence (no verb-like endings, no commas mid-line)
    """
    if not line or len(line.strip()) > 60:
        return False

    norm = _normalize(line)

    # Must not look like a sentence
    if "," in norm or "." in norm:
        return False

    for keyword in SECTION_KEYWORDS:
        if norm == keyword or norm.startswith(keyword):
            return True

    return False


def chunk_by_section(resume_text: str) -> list[dict]:
    """
    Split resume text into sections by detecting header lines.
    Falls back to fixed-size chunking if no headers found.
    """
    lines = resume_text.splitlines()
    sections = []
    current_section = "General"
    current_lines = []

    for line in lines:
        if _is_header(line.strip()):
            if current_lines and any(l.strip() for l in current_lines):
                sections.append({
                    "section": current_section,
                    "content": "\n".join(current_lines).strip()
                })
            current_section = line.strip().title()
            current_lines = []
        else:
            current_lines.append(line)

    # Last section
    if current_lines and any(l.strip() for l in current_lines):
        sections.append({
            "section": current_section,
            "content": "\n".join(current_lines).strip()
        })

    if len(sections) <= 1:
        sections = _fallback_chunk(resume_text)

    return sections


def _fallback_chunk(text: str, words_per_chunk: int = 200) -> list[dict]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), words_per_chunk):
        chunk_words = words[i:i + words_per_chunk]
        chunks.append({
            "section": f"Chunk {i // words_per_chunk + 1}",
            "content": " ".join(chunk_words)
        })
    return chunks