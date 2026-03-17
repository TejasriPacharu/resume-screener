from pathlib import Path
from datetime import datetime


def write_report(
    output_path: str,
    resume_file: str,
    extracted: dict,
    scores: list[dict],
    is_duplicate: bool = False,
):
    lines = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines.append(f"# Resume Screening Report")
    lines.append(f"**Generated:** {now}  ")
    lines.append(f"**Resume file:** `{Path(resume_file).name}`")

    if is_duplicate:
        lines.append(f"\n> ⚠️ **Duplicate detected** — this resume was already uploaded for this role.\n")

    # --- Extracted Profile ---
    lines.append("\n---\n")
    lines.append("## Extracted Profile\n")
    for key, value in extracted.items():
        if key.startswith("_"):
            continue
        label = key.replace("_", " ").title()
        if isinstance(value, list):
            value_str = ", ".join(str(v) for v in value) if value else "—"
        elif value is None:
            value_str = "—"
        else:
            value_str = str(value)
        lines.append(f"**{label}:** {value_str}  ")

    if "_parse_error" in extracted:
        lines.append(f"\n> ⚠️ Extraction warning: {extracted['_parse_error']}")

    # --- Scores per role ---
    lines.append("\n---\n")
    lines.append("## Fit Scores\n")

    for result in scores:
        role_name = result.get("role_name", "Unknown Role")
        jd_file = result.get("jd_file", "")
        ext_score = result.get("extraction_score", {})
        rag_score = result.get("rag_score", {})
        chunks = result.get("rag_chunks", [])

        lines.append(f"### {role_name}")
        if jd_file:
            lines.append(f"*JD: `{Path(jd_file).name}`*\n")

        # --- Score summary bar ---
        e_val = ext_score.get("score")
        r_val = rag_score.get("score")
        lines.append("| | Score | Signal |")
        lines.append("|---|---|---|")
        lines.append(f"| **Extraction-based** | {_fmt_score(e_val)} | Structured profile vs JD requirements |")
        lines.append(f"| **RAG-based** | {_fmt_score(r_val)} | Evidence from most relevant resume sections |")
        lines.append("")

        # --- Extraction score detail ---
        lines.append("#### Extraction Score\n")
        lines.append(f"**Justification:** {ext_score.get('justification', '—')}\n")

        matched = ext_score.get("matched_requirements", [])
        missing = ext_score.get("missing_requirements", [])
        if matched:
            lines.append("**Matched requirements:**")
            for m in matched:
                lines.append(f"- ✅ {m}")
            lines.append("")
        if missing:
            lines.append("**Missing from profile:**")
            for m in missing:
                lines.append(f"- ❌ {m}")
            lines.append("")
        if "_parse_error" in ext_score:
            lines.append(f"> ⚠️ {ext_score['_parse_error']}\n")

        # --- RAG score detail ---
        lines.append("#### RAG Score\n")
        lines.append(f"**Justification:** {rag_score.get('justification', '—')}\n")

        strengths = rag_score.get("strengths", [])
        gaps = rag_score.get("gaps", [])
        if strengths:
            lines.append("**Strengths:**")
            for s in strengths:
                lines.append(f"- {s}")
            lines.append("")
        if gaps:
            lines.append("**Gaps / Concerns:**")
            for g in gaps:
                lines.append(f"- {g}")
            lines.append("")
        if "_parse_error" in rag_score:
            lines.append(f"> ⚠️ {rag_score['_parse_error']}\n")

        # --- Retrieved chunks ---
        if chunks:
            lines.append("#### Retrieved Resume Sections *(semantic search)*\n")
            for chunk in chunks:
                sim_pct = f"{chunk['similarity'] * 100:.1f}%"
                lines.append(f"**#{chunk['rank']} — {chunk['section']}** (similarity: {sim_pct})")
                indented = "\n".join(f"> {l}" for l in chunk["content"].splitlines()[:6])
                lines.append(indented)
                lines.append("")

        lines.append("---\n")

    report = "\n".join(lines)
    Path(output_path).write_text(report, encoding="utf-8")
    print(f"\n✅ Report saved → {output_path}")


def _fmt_score(score) -> str:
    if score is None:
        return "N/A"
    bar = "🟩" * score + "⬜" * (10 - score)
    return f"**{score}/10** {bar}"