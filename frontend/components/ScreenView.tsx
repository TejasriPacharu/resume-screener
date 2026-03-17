"use client";
import { useRef, useState } from "react";
import JDEditor, { type JDEntry } from "./JDEditor";
import ResultCard from "./ResultCard";
import { screenResume } from "../lib/api";

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
  const [file, setFile] = useState<File | null>(null);
  const [jds, setJds] = useState<JDEntry[]>([{ role_name: "", jd_text: "" }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dupPrompt, setDupPrompt] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  };

  const submit = async (force = false) => {
    if (!file) { setError("Please upload a resume file."); return; }
    const invalidJD = jds.some((j) => !j.role_name.trim() || !j.jd_text.trim());
    if (invalidJD) { setError("Fill in all role names and JD text."); return; }

    setLoading(true);
    setError(null);
    setDupPrompt(false);

    try {
      const { status, data } = await screenResume(file, jds, force);
      if (status === 409) {
        setDupPrompt(true);
      } else if (status !== 200) {
        setError(data.detail || "Unexpected error.");
      } else {
        setResult(data);
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
          Screen Resume
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 32 }}>
          Upload a resume and compare it against one or more job descriptions.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Upload */}
        <div className="fade-up fade-up-1">
          <span style={LABEL}>Resume File</span>
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: "1px dashed var(--border-accent)",
              borderRadius: 10,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: "var(--surface)",
              transition: "all 0.15s",
              minHeight: 120,
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
            {file ? (
              <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>{file.name}</span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Drop .pdf or .docx, or click to browse
              </span>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={handleFile} />
          </div>
        </div>

        {/* Options */}
        <div className="fade-up fade-up-2" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8 }}>
          <span style={LABEL}>Quick tips</span>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Supports .pdf and .docx resumes",
                "Add multiple JDs for multi-role ranking",
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

      {/* Error / dup prompt */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--red)",
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {dupPrompt && (
        <div
          style={{
            background: "rgba(234,179,8,0.07)",
            border: "1px solid rgba(234,179,8,0.3)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
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
        {loading ? "Screening…" : "Run Screening"}
      </button>

      {/* Result */}
      {result && <ResultCard result={result} />}
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