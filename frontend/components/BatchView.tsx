"use client";
import { useRef, useState } from "react";
import JDEditor, { type JDEntry } from "./JDEditor";
import ResultCard from "./ResultCard";
import { batchScreen } from "../lib/api";

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
  display: "block",
};

export default function BatchView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [jds, setJds] = useState<JDEntry[]>([{ role_name: "", jd_text: "" }]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files || []));
    setResults([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith(".pdf") || f.name.endsWith(".docx")
    );
    setFiles(dropped);
    setResults([]);
  };

  const removeFile = (i: number) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (files.length === 0) { setError("Upload at least one resume."); return; }
    const invalid = jds.some((j) => !j.role_name.trim() || !j.jd_text.trim());
    if (invalid) { setError("Fill in all JD fields."); return; }

    setLoading(true);
    setError(null);
    try {
      const data = await batchScreen(files, jds);
      setResults(data.results || []);
    } catch {
      setError("Batch request failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px" }}>
      <div className="fade-up">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Batch Screen
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 32 }}>
          Upload multiple resumes and screen them all against the same JDs in one shot.
        </p>
      </div>

      {/* File drop zone */}
      <div className="fade-up fade-up-1" style={{ marginBottom: 20 }}>
        <span style={LABEL}>Resume Files</span>
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: "1px dashed var(--border-accent)",
            borderRadius: 10,
            padding: "24px 20px",
            cursor: "pointer",
            background: "var(--surface)",
            textAlign: "center",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--accent)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-accent)")}
        >
          <svg width="20" height="20" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: "0 auto 8px", display: "block" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Drop multiple .pdf / .docx files, or click to browse
          </span>
          <input ref={fileRef} type="file" accept=".pdf,.docx" multiple style={{ display: "none" }} onChange={handleFiles} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "6px 12px",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text)" }}>{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JDs */}
      <div className="fade-up fade-up-2" style={{ marginBottom: 20 }}>
        <span style={LABEL}>Job Descriptions</span>
        <JDEditor entries={jds} onChange={setJds} />
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--red)", marginBottom: 14 }}>
          {error}
        </div>
      )}

      <button
        onClick={submit}
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
        {loading ? `Screening ${files.length} resume(s)…` : `Screen ${files.length || 0} Resume(s)`}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>
              Results — {results.length} candidate(s)
            </h2>
            {/* Quick ranking: sort by avg extraction score */}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Sorted by avg extraction score
            </span>
          </div>
          {[...results]
            .sort((a, b) => {
              const avgA = avg(a.scores);
              const avgB = avg(b.scores);
              return avgB - avgA;
            })
            .map((r, i) => (
              <div key={i} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      background: "var(--accent-soft)",
                      border: "1px solid var(--accent)",
                      color: "var(--accent)",
                      padding: "1px 8px",
                      borderRadius: 4,
                    }}
                  >
                    #{i + 1}
                  </span>
                  {r.error && (
                    <span style={{ fontSize: 12, color: "var(--red)" }}>Error: {r.error}</span>
                  )}
                </div>
                {!r.error && <ResultCard result={r} />}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function avg(scores: any[] = []) {
  if (!scores.length) return 0;
  const vals = scores.map((s) => s.extraction_score?.score ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}