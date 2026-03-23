"use client";
import { useRef, useState } from "react";
import JDEditor, { type JDEntry } from "./JDEditor";
import ResultCard from "./ResultCard";
import { screenResumes } from "../lib/api";

const PAGE_STYLE: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: "40px 32px",
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
  display: "block",
};

export default function ScreenView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [jds, setJds] = useState<JDEntry[]>([{ role_name: "", jd_text: "" }]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dupPrompt, setDupPrompt] = useState(false);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => f.name.endsWith(".pdf") || f.name.endsWith(".docx"));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existing.has(f.name))];
    });
    setResults([]);
    setError(null);
    // Reset so the same file can be re-added after removal
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults([]);
    setError(null);
  };

  const submit = async (force = false) => {
    if (!files.length) { setError("Please upload at least one resume file."); return; }
    const invalidJD = jds.some((j) => !j.role_name.trim() || !j.jd_text.trim());
    if (invalidJD) { setError("Fill in all role names and JD text."); return; }

    setLoading(true);
    setError(null);
    setDupPrompt(false);

    try {
      const { status, data } = await screenResumes(files, jds, force);
      if (status === 409) {
        // Backend returns 409 only when a single file is a duplicate
        setDupPrompt(true);
      } else if (status !== 200) {
        setError(data.detail || "Unexpected error.");
      } else {
        setResults(data.results || []);
      }
    } catch {
      setError("Could not reach the API. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={PAGE_STYLE}>
      <div className="fade-up">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Screen Resumes
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 32 }}>
          Upload one or more resumes and compare each against one or more job descriptions.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Upload drop zone */}
        <div className="fade-up fade-up-1">
          <span style={LABEL}>Resume Files</span>
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: "1px dashed var(--border-accent)",
              borderRadius: 10,
              padding: "20px",
              textAlign: "center",
              cursor: "pointer",
              background: "var(--surface)",
              transition: "border-color 0.15s",
              minHeight: 100,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--accent)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-accent)")}
          >
            <svg width="20" height="20" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {files.length === 0
                ? "Drop .pdf / .docx files here, or click to browse"
                : "Drop more files or click to add more"}
            </span>
            <input ref={fileRef} type="file" accept=".pdf,.docx" multiple style={{ display: "none" }} onChange={handleFile} />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {files.map((f, i) => (
                <div
                  key={f.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "5px 10px",
                  }}
                >
                  <span style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "85%",
                  }}>
                    {f.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 11, padding: 0, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="fade-up fade-up-2" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8 }}>
          <span style={LABEL}>Quick tips</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Supports .pdf and .docx resumes",
                "Drop or browse to add multiple resumes",
                "Each resume is scored against every JD",
                "Scores use both extraction & RAG signals",
                "Configure extracted fields in Config tab",
              ].map((tip, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--accent)" }}>·</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* JD Editor */}
      <div className="fade-up fade-up-2" style={{ marginBottom: 20 }}>
        <span style={LABEL}>Job Descriptions</span>
        <JDEditor entries={jds} onChange={setJds} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--red)",
          marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {/* Duplicate prompt — only triggered for single-file submissions */}
      {dupPrompt && (
        <div style={{
          background: "rgba(234,179,8,0.07)",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "var(--yellow)" }}>
            ⚠ This resume was already uploaded for this role. Re-process anyway?
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDupPrompt(false)} style={ghostBtn}>Cancel</button>
            <button onClick={() => submit(true)} style={dangerBtn}>Re-process</button>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={() => submit(false)}
        disabled={loading}
        style={{
          background: "var(--accent)",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 13,
          fontWeight: 500,
          padding: "10px 24px",
          opacity: loading ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 36,
          transition: "opacity 0.15s",
        }}
      >
        {loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
        {loading ? "Screening…" : `Run Screening${files.length > 1 ? ` (${files.length} resumes)` : ""}`}
      </button>

      {/* Results — one ResultCard per resume */}
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {results.map((r, i) =>
            r.error ? (
              <div key={i} style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "var(--red)",
              }}>
                <strong>{r.filename}</strong>: {r.error}
              </div>
            ) : (
              <ResultCard key={i} result={r} />
            )
          )}
        </div>
      )}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 11,
  padding: "4px 12px",
};

const dangerBtn: React.CSSProperties = {
  background: "rgba(239,68,68,0.1)",
  border: "1px solid var(--red)",
  borderRadius: 6,
  color: "var(--red)",
  cursor: "pointer",
  fontSize: 11,
  padding: "4px 12px",
};
