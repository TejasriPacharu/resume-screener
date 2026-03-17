import fitz  # pymupdf
from docx import Document
from pathlib import Path


def parse(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return _parse_pdf(path)
    elif suffix == ".docx":
        return _parse_docx(path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}. Only .pdf and .docx are supported.")


def _parse_pdf(path: Path) -> str:
    try:
        doc = fitz.open(str(path))
    except Exception:
        raise ValueError(f"Could not open PDF: {path.name}. The file may be corrupt or not a valid PDF.")

    if doc.is_encrypted:
        doc.close()
        raise ValueError(f"PDF is password-protected: {path.name}. Please provide an unlocked PDF.")

    text = []
    for page in doc:
        text.append(page.get_text())
    doc.close()

    result = "\n".join(text).strip()
    if not result:
        raise ValueError(
            f"No text found in PDF: {path.name}. "
            "It may be a scanned/image-based PDF. Please provide a text-based PDF."
        )
    return result


def _parse_docx(path: Path) -> str:
    doc = Document(str(path))
    text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    if not text:
        raise ValueError(f"Could not extract text from DOCX: {path.name}. The file may be empty.")
    return text