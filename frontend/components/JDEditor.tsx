"use client";
import { useState } from "react";

export type JDEntry = { role_name: string; jd_text: string };

export default function JDEditor({
  entries,
  onChange,
}: {
  entries: JDEntry[];
  onChange: (e: JDEntry[]) => void;
}) {
  const add = () => onChange([...entries, { role_name: "", jd_text: "" }]);
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof JDEntry, val: string) => {
    const copy = entries.map((e, idx) => (idx === i ? { ...e, [field]: val } : e));
    onChange(copy);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map((entry, i) => (
        <div
          key={i}
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              JD #{i + 1}
            </span>
            {entries.length > 1 && (
              <button
                onClick={() => remove(i)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "2px 6px",
                  borderRadius: 4,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--red)")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-dim)")}
              >
                ✕ remove
              </button>
            )}
          </div>
          <input
            placeholder="Role name  (e.g. Backend Engineer)"
            value={entry.role_name}
            onChange={(e) => update(i, "role_name", e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Paste job description here…"
            value={entry.jd_text}
            onChange={(e) => update(i, "jd_text", e.target.value)}
            rows={6}
            style={{ ...inputStyle, resize: "vertical", marginTop: 8, fontFamily: "var(--font-body)" }}
          />
        </div>
      ))}

      <button
        onClick={add}
        style={{
          background: "transparent",
          border: "1px dashed var(--border-accent)",
          borderRadius: 8,
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: "10px 0",
          fontSize: 12,
          transition: "all 0.15s",
          width: "100%",
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
        + Add another JD
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  fontFamily: "var(--font-body)",
};