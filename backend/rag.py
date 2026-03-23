import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from chunker import chunk_by_section
from config import EMBED_MODEL, RAG_TOP_K, LOW_SIGNAL_SECTIONS

_embedder = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        print("  Loading embedding model (first run only)...")
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _chunk_to_sentence(chunk: dict) -> str:
    section = chunk["section"].lower()
    content = chunk["content"]


    if "project" in section:
        return f"Student project (no professional experience): {content}"

    elif "experience" in section or "internship" in section:
        return f"Internship or limited experience (not full-time senior role): {content}"

    elif "skill" in section or "technical" in section:
        return f"Listed skills (no proof of real-world experience): {content}"

    elif "education" in section:
        return f"Education background: {content}"

    else:
        return f"{chunk['section']}: {content}"


def _extract_jd_queries(jd_text: str) -> list[str]:
    queries = [jd_text]
    for line in jd_text.splitlines():
        line = line.strip().lstrip("-•*").strip()
        if 10 < len(line) < 120:
            queries.append(line)
    return queries


def retrieve_relevant_chunks(resume_text: str, jd_text: str) -> list[dict]:
    embedder = _get_embedder()
    chunks = chunk_by_section(resume_text)

    if not chunks:
        return []

    chunk_sentences = [_chunk_to_sentence(c) for c in chunks]

    chunk_vectors = embedder.encode(chunk_sentences, convert_to_numpy=True).astype("float32")
    faiss.normalize_L2(chunk_vectors)

    dim = chunk_vectors.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(chunk_vectors)

    queries = _extract_jd_queries(jd_text)
    query_vectors = embedder.encode(queries, convert_to_numpy=True).astype("float32")
    faiss.normalize_L2(query_vectors)

    chunk_max_scores = np.zeros(len(chunks))

    for qvec in query_vectors:
        sims, idxs = index.search(qvec.reshape(1, -1), len(chunks))
        for sim, idx in zip(sims[0], idxs[0]):
            if sim > chunk_max_scores[idx]:
                chunk_max_scores[idx] = sim

    PENALTY = 0.5
    for i, chunk in enumerate(chunks):
        if chunk["section"].lower() in LOW_SIGNAL_SECTIONS:
            chunk_max_scores[i] *= (1 - PENALTY)

    top_indices = np.argsort(chunk_max_scores)[::-1][:RAG_TOP_K]

    results = []
    for rank, idx in enumerate(top_indices):
        results.append({
            "rank": rank + 1,
            "section": chunks[idx]["section"],
            "content": chunks[idx]["content"],
            "embedded_as": chunk_sentences[idx],
            "similarity": round(float(chunk_max_scores[idx]), 4),
        })

    return results