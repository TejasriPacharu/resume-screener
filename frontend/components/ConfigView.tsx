"use client";
import { useEffect, useState } from "react";
import { getConfig, updateConfig, clearAllDuplicates } from "../lib/api";

const DEFAULT_FIELDS = [
  "name", "email", "phone", "years_of_experience", "primary_skills",
  "last_job_title", "education", "internships", "projects", "achievements",
  "authentication_experience", "ci_cd_tools",
];

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
  display: "block",
};

export default function ConfigView() {
  const [fields, setFields] = useState<string[]>([]);
  const [newField, setNewField] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const [clearStatus, setClearStatus] = useState<"idle" | "clearing" | "cleared" | "error">("idle");

  useEffect(() => {
    getConfig()
      .then((c) => setFields(c.extract_fields || []))
      .catch(() => setFields(DEFAULT_FIELDS))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (field: string) => {
    setFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
    setStatus("idle");
  };

  const addField = () => {
    const f = newField.trim().toLowerCase().replace(/\s+/g, "_");
    if (!f || fields.includes(f)) return;
    setFields((prev) => [...prev, f]);
    setNewField("");
    setStatus("idle");
  };

  const removeField = (field: string) => {
    setFields((prev) => prev.filter((f) => f !== field));
    setStatus("idle");
  };

  const save = async () => {
    setStatus("saving");
    try {
      await updateConfig(fields);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  };

  const reset = () => {
    setFields(DEFAULT_FIELDS);
    setStatus("idle");
  };

  const clearRegistry = async () => {
    setClearStatus("clearing");
    try {
      await clearAllDuplicates();
      setClearStatus("cleared");
      setTimeout(() => setClearStatus("idle"), 3000);
    } catch {
      setClearStatus("error");
      setTimeout(() => setClearStatus("idle"), 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <span className="spinner" />
      </div>
    );
  }

  // Which defaults are not currently in fields
  const available = DEFAULT_FIELDS.filter((f) => !fields.includes(f));

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 32px" }}>
      <div className="fade-up">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Extraction Config
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 32 }}>
          Choose which fields to extract from resumes. Changes apply to all future screenings.
        </p>
      </div>

      {/* Active fields */}
      <div className="fade-up fade-up-1" style={{ marginBottom: 24 }}>
        <span style={LABEL}>Active Fields</span>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            minHeight: 60,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {fields.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No fields selected.</span>
          )}
          {fields.map((f) => (
            <span
              key={f}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "var(--accent-soft)",
                border: "1px solid var(--accent)",
                borderRadius: 5,
                color: "var(--accent)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                padding: "3px 8px",
              }}
            >
              {f}
              <button
                onClick={() => removeField(f)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: 0,
                  opacity: 0.6,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Available defaults to add back */}
      {available.length > 0 && (
        <div className="fade-up fade-up-2" style={{ marginBottom: 24 }}>
          <span style={LABEL}>Suggested Fields</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {available.map((f) => (
              <button
                key={f}
                onClick={() => toggle(f)}
                style={{
                  background: "var(--surface-2)",
                  border: "1px dashed var(--border-accent)",
                  borderRadius: 5,
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  padding: "3px 10px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--accent)";
                  (e.target as HTMLElement).style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--border-accent)";
                  (e.target as HTMLElement).style.color = "var(--text-muted)";
                }}
              >
                + {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom field */}
      <div className="fade-up fade-up-3" style={{ marginBottom: 28 }}>
        <span style={LABEL}>Add Custom Field</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addField()}
            placeholder="e.g. github_profile"
            style={{
              flex: 1,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              outline: "none",
            }}
          />
          <button
            onClick={addField}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 12,
              padding: "8px 14px",
              transition: "all 0.15s",
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="fade-up fade-up-4" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={status === "saving"}
          style={{
            background: "var(--accent)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            cursor: status === "saving" ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
            padding: "9px 22px",
            opacity: status === "saving" ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "opacity 0.15s",
          }}
        >
          {status === "saving" && <span className="spinner" style={{ width: 14, height: 14 }} />}
          {status === "saving" ? "Saving…" : "Save Config"}
        </button>

        <button
          onClick={reset}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 13,
            padding: "9px 22px",
          }}
        >
          Reset to Defaults
        </button>

        {status === "saved" && (
          <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>
        )}
        {status === "error" && (
          <span style={{ fontSize: 12, color: "var(--red)" }}>Failed to save</span>
        )}
      </div>

      {/* Batch re-parse */}
      <div
        className="fade-up"
        style={{
          marginTop: 32,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "14px 16px",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Re-parse with new config
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 12 }}>
          After changing extraction fields, clear the duplicate registry so existing resumes can be re-submitted and re-processed with the updated config.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={clearRegistry}
            disabled={clearStatus === "clearing"}
            style={{
              background: "transparent",
              border: "1px solid var(--border-accent)",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: clearStatus === "clearing" ? "not-allowed" : "pointer",
              fontSize: 12,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: clearStatus === "clearing" ? 0.6 : 1,
            }}
          >
            {clearStatus === "clearing" && <span className="spinner" style={{ width: 12, height: 12 }} />}
            {clearStatus === "clearing" ? "Clearing…" : "Clear Duplicate Registry"}
          </button>
          {clearStatus === "cleared" && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Registry cleared — resumes can be re-uploaded</span>}
          {clearStatus === "error" && <span style={{ fontSize: 12, color: "var(--red)" }}>Failed to clear registry</span>}
        </div>
      </div>

      {/* Info box */}
      <div
        style={{
          marginTop: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "14px 16px",
        }}
      >
        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          How it works
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          Selected fields are passed to the LLM extractor prompt. The more specific the fields, the more targeted the extraction. Custom fields are extracted as free-text. Changes are persisted in <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>config.json</code> on the backend.
        </p>
      </div>
    </div>
  );
}