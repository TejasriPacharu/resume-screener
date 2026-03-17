import json
from groq import Groq

MODEL = "llama-3.1-8b-instant"


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

    # Find outermost { ... } in case model added preamble/postamble
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
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=5,
    )
    answer = response.choices[0].message.content.strip().lower()
    return answer.startswith("yes")


def extract(client: Groq, resume_text: str, fields: list[str]) -> dict:
    fields_list = ", ".join(fields)
    prompt = f"""You are a precise resume parser. Extract the following fields from the resume text below.

Fields to extract: {fields_list}

Extraction rules — read carefully:

1. "name": Full name only. No email, no title.

2. "email": Exact email address as written. null if not found.

3. "phone": Exact phone number as written. null if not found.

4. "years_of_experience":
   - If stated explicitly (e.g. "5 years of experience"), use that number.
   - If not stated, calculate from work history dates:
     * Add up durations of all UNIQUE, non-overlapping roles only
     * If two roles overlap in time, count that period ONCE
     * Use 2025 as the current year if a role says "Present" or "Current"
     * A student internship of 3 months = 0.25 years
     * Round to 1 decimal place
   - If no dates at all, return null. Do NOT guess.

5. "primary_skills":
   - Return a flat list of specific technical skills only (languages, frameworks, tools, platforms)
   - Do NOT include soft skills like "communication" or "leadership"
   - Deduplicate. Normalise capitalisation (e.g. "javascript" -> "JavaScript")

6. "last_job_title":
   - Most recent job title only, exactly as written on the resume.
   - Do not paraphrase or generalise.

7. "education":
   - Format as: "Degree, Institution (Graduation Year)"
   - Graduation year = the END year of the degree, not the start year
   - Example: "2022 - 2026" means graduation year is 2026
   - If multiple degrees, return the highest qualification.

8. "authentication_experience":
   - List any authentication methods used (e.g. JWT, OAuth, OAuth2, session-based, API keys)
   - Look in work experience AND projects sections
   - Return a list of strings, or null if none found.

9. "ci_cd_tools":
   - List any CI/CD tools or practices mentioned (e.g. GitHub Actions, Jenkins, CircleCI, GitLab CI, Docker pipelines)
   - Return a list of strings, or null if none found.

10. "internships":
    - Return a list of objects: [{{"company": ..., "role": ..., "duration": ..., "technologies": [...]}}]
    - technologies = list of tools/languages mentioned for that role

11. "projects":
    - Return a list of objects: [{{"name": ..., "technologies": [...]}}]
    - technologies = list of tools/languages mentioned for that project

12. "achievements":
    - One string summarising notable achievements, hackathons, publications, or awards.
    - null if none.

General rules:
- Return ONLY a valid JSON object. No preamble, no headers, no markdown, no extra text before or after the JSON.
- Start your response with {{ and end with }}
- If a field truly cannot be determined, use null — do not fabricate.
- Only extract the fields listed above.

Resume text:
\"\"\"{resume_text}\"\"\"
"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
    )

    raw = response.choices[0].message.content.strip()

    try:
        return _parse_json_response(raw)
    except (json.JSONDecodeError, ValueError):
        return {"_raw_extraction": raw, "_parse_error": "Could not parse JSON from model output"}