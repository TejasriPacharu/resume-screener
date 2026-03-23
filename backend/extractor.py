import json
from groq import Groq
from models import ResumeField
from config import LLM_MODEL


def _parse_json_response(raw: str) -> dict:
    """
    Robustly extract a JSON object from model output.
    Handles: markdown fences, preamble text, trailing text.
    """
    # Strip markdown fences
    if "```" in raw:
        parts = raw.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                raw = part
                break

    
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end+1]

    return json.loads(raw)


def is_resume(client: Groq, text: str) -> bool:
    """
    Quick binary check: is this document a resume/CV?
    Uses only the first 1500 chars to keep it fast and cheap.
    """
    snippet = text[:1500]
    prompt = (
        "Does the following document appear to be a resume or CV "
        "(i.e., a personal document listing someone's work experience, education, and skills)?\n\n"
        f"Document:\n\"\"\"{snippet}\"\"\"\n\n"
        "Answer with a single word: yes or no."
    )
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=5,
    )
    answer = response.choices[0].message.content.strip().lower()
    return answer.startswith("yes")


def _build_extraction_rules(fields: list[ResumeField]) -> str:
    rules = []
    for i, field in enumerate(fields, 1):
        rules.append(f'{i}. "{field.field_name}": {field.field_extraction_description}')
    return "\n\n".join(rules)


def extract(client: Groq, resume_text: str, fields: list[ResumeField]) -> dict:
    field_names = ", ".join(f.field_name for f in fields)
    extraction_rules = _build_extraction_rules(fields)

    prompt = f"""You are a precise resume parser. Extract the following fields from the resume text below.

Fields to extract: {field_names}

Extraction rules — read carefully:

{extraction_rules}

General rules:
- Return ONLY a valid JSON object. No preamble, no headers, no markdown, no extra text before or after the JSON.
- Start your response with {{ and end with }}
- If a field truly cannot be determined, use null — do not fabricate.
- Only extract the fields listed above.

Resume text:
\"\"\"{resume_text}\"\"\"
"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
    )

    raw = response.choices[0].message.content.strip()

    try:
        return _parse_json_response(raw)
    except (json.JSONDecodeError, ValueError):
        return {"_raw_extraction": raw, "_parse_error": "Could not parse JSON from model output"}