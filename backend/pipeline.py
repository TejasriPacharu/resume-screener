"""
Resume Screener Pipeline

"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

from groq import Groq
from config import GROQ_API_KEY, load_extraction_config

import parser as resume_parser
import extractor
import scorer
import duplicate
import report
import rag as rag_module


def get_client() -> Groq:
    if not GROQ_API_KEY:
        print("Error: GROQ_API_KEY not found in environment. Add it to a .env file.")
        sys.exit(1)
    return Groq(api_key=GROQ_API_KEY)


def process_single(client, resume_path: str, jd_paths: list[str], role_names: list[str], force: bool = False):
    config = load_extraction_config()
    fields = config.extract_fields

    role_id = role_names[0] if role_names else "default"
    is_dup = duplicate.is_duplicate(resume_path, role_id)

    if is_dup and not force:
        print(f"⚠️  Duplicate detected: '{Path(resume_path).name}' was already uploaded for role '{role_id}'.")
        print("    Use --force to re-process anyway.")
        return

    if is_dup and force:
        print(f"⚠️  Duplicate detected but --force is set. Re-processing.")

    # --- Parse ---
    print(f"📄 Parsing: {resume_path}")
    try:
        resume_text = resume_parser.parse(resume_path)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}")
        return

    # --- Extract ---
    print(f"🔍 Extracting fields: {[f.field_name for f in fields]}")
    extracted = extractor.extract(client, resume_text, fields)
    candidate_name = extracted.get("name", Path(resume_path).stem)
    print(f"   → Extracted profile for: {candidate_name}")

    # --- Score against each JD ---
    score_results = []
    for jd_path, role_name in zip(jd_paths, role_names):
        print(f"\n📊 Scoring against: {role_name} ({jd_path})")
        try:
            jd_text = Path(jd_path).read_text(encoding="utf-8")
        except FileNotFoundError:
            print(f"   Error: JD file not found: {jd_path}")
            continue

        # Score 1: extraction-based
        print(f"   ⚙️  Extraction-based score...")
        extraction_score = scorer.score_from_extraction(client, extracted, jd_text, role_name)
        print(f"   → Extraction score: {extraction_score.get('score')}/10")

        # Score 2: RAG-based
        print(f"   🔎 Retrieving relevant chunks...")
        chunks = rag_module.retrieve_relevant_chunks(resume_text, jd_text)
        print(f"   🔎 RAG-based score...")
        rag_score = scorer.score_from_rag(client, chunks, jd_text, role_name)
        print(f"   → RAG score: {rag_score.get('score')}/10")

        score_results.append({
            "role_name": role_name,
            "jd_file": jd_path,
            "extraction_score": extraction_score,
            "rag_score": rag_score,
            "rag_chunks": chunks,
        })

    # --- Register ---
    duplicate.register(resume_path, role_id)

    # --- Write report ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = Path(resume_path).stem.replace(" ", "_")
    output_path = Path(__file__).parent / f"report_{safe_name}_{timestamp}.md"

    report.write_report(
        output_path=str(output_path),
        resume_file=resume_path,
        extracted=extracted,
        scores=score_results,
        is_duplicate=is_dup,
    )


def process_batch(client, folder: str, jd_paths: list[str], role_names: list[str]):
    folder_path = Path(folder)
    files = list(folder_path.glob("*.pdf")) + list(folder_path.glob("*.docx"))

    if not files:
        print(f"No .pdf or .docx files found in: {folder}")
        return

    print(f"📁 Batch mode: found {len(files)} resume(s) in '{folder}'")
    for f in files:
        print(f"\n{'='*50}")
        process_single(client, str(f), jd_paths, role_names, force=True)


def main():
    parser = argparse.ArgumentParser(description="Resume Screener Pipeline")
    parser.add_argument("--resume", type=str, help="Path to a single resume file (.pdf or .docx)")
    parser.add_argument("--batch", type=str, help="Path to a folder of resumes for batch processing")
    parser.add_argument("--jd", type=str, action="append", dest="jds", help="Path to a JD text file (repeatable)")
    parser.add_argument("--role", type=str, action="append", dest="roles", help="Role name for the JD (repeatable)")
    parser.add_argument("--force", action="store_true", help="Force re-process even if duplicate detected")

    args = parser.parse_args()

    if not args.jds or not args.roles:
        print("Error: At least one --jd and --role must be provided.")
        parser.print_help()
        sys.exit(1)

    if len(args.jds) != len(args.roles):
        print("Error: Number of --jd and --role arguments must match.")
        sys.exit(1)

    if not args.resume and not args.batch:
        print("Error: Provide either --resume or --batch.")
        parser.print_help()
        sys.exit(1)

    client = get_client()

    if args.resume:
        process_single(client, args.resume, args.jds, args.roles, force=args.force)
    elif args.batch:
        process_batch(client, args.batch, args.jds, args.roles)


if __name__ == "__main__":
    main()