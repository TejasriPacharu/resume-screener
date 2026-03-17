"use client";
import { useState } from "react";

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  const pct = score != null ? (score / 10) * 100 : 0;
  const color =
    score == null ? "var(--border-accent)"
    : score >= 7 ? "var(--green)"
    : score >= 4 ? "var(--yellow)"
    : "var(--red)";

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color, fontSize: 13 }}>
          {score != null ? `${score}/10` : "—"}
        </span>
      </div>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items?.length) return <span style={{ color: "var(--text-dim)", fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((s, i) => (
        <span key={i} className="tag">{s}</span>
      ))}
    </div>
  );
}

function List({ items, icon }: { items: string[]; icon: string }) {
  if (!items?.length) return null;
  return (
    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((s, i) => (
        <li key={i} style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 6 }}>
          <span>{icon}</span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function RoleScore({ result }: { result: any }) {
  const [tab, setTab] = useState<"extraction" | "rag" | "chunks">("extraction");
  const ext = result.extraction_score || {};
  const rag = result.rag_score || {};
  const chunks = result.rag_chunks || [];

  const TABS = [
    { id: "extraction", label: "Extraction" },
    { id: "rag", label: "RAG" },
    { id: "chunks", label: `Chunks (${chunks.length})` },
  ] as const;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {/* Role header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>
          {result.role_name}
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Ext: <strong style={{ color: scoreColor(ext.score) }}>{ext.score ?? "—"}</strong>/10
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            RAG: <strong style={{ color: scoreColor(rag.score) }}>{rag.score ?? "—"}</strong>/10
          </span>
        </div>
      </div>

      {/* Score bars */}
      <div style={{ padding: "14px 16px 4px" }}>
        <ScoreBar score={ext.score} label="Extraction-based" />
        <ScoreBar score={rag.score} label="RAG-based" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 8px" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: tab === t.id ? 500 : 400,
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {tab === "extraction" && (
          <div>
            {ext.justification && (
              <Section title="Justification">
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>{ext.justification}</p>
              </Section>
            )}
            {ext.matched_requirements?.length > 0 && (
              <Section title="Matched">
                <List items={ext.matched_requirements} icon="✓" />
              </Section>
            )}
            {ext.missing_requirements?.length > 0 && (
              <Section title="Missing">
                <List items={ext.missing_requirements} icon="✗" />
              </Section>
            )}
          </div>
        )}

        {tab === "rag" && (
          <div>
            {rag.justification && (
              <Section title="Justification">
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>{rag.justification}</p>
              </Section>
            )}
            {rag.strengths?.length > 0 && (
              <Section title="Strengths">
                <List items={rag.strengths} icon="▲" />
              </Section>
            )}
            {rag.gaps?.length > 0 && (
              <Section title="Gaps">
                <List items={rag.gaps} icon="▼" />
              </Section>
            )}
            {rag.improvements?.length > 0 && (
              <Section title="Improvements">
                <List items={rag.improvements} icon="→" />
              </Section>
            )}
          </div>
        )}

        {tab === "chunks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {chunks.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-dim)" }}>No chunks retrieved.</p>
            )}
            {chunks.map((c: any) => (
              <div
                key={c.rank}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--accent)" }}>
                    #{c.rank} — {c.section}
                  </span>
                  <span className="tag">{(c.similarity * 100).toFixed(1)}%</span>
                </div>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    maxHeight: 120,
                    overflow: "auto",
                  }}
                >
                  {c.content.slice(0, 400)}{c.content.length > 400 ? "…" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function scoreColor(score: number | null) {
  if (score == null) return "var(--text-dim)";
  if (score >= 7) return "var(--green)";
  if (score >= 4) return "var(--yellow)";
  return "var(--red)";
}

export default function ResultCard({ result }: { result: any }) {
  const extracted = result.extracted || {};
  const [showProfile, setShowProfile] = useState(false);

  const skills = extracted.primary_skills || [];
  const internships = extracted.internships || [];
  const projects = extracted.projects || [];

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Candidate header */}
      <div
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 2 }}>
            {result.candidate_name}
          </h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {extracted.email && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{extracted.email}</span>
            )}
            {extracted.last_job_title && (
              <span className="tag">{extracted.last_job_title}</span>
            )}
            {extracted.years_of_experience != null && (
              <span className="tag">{extracted.years_of_experience} yrs exp</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {result.is_duplicate && (
            <span
              style={{
                fontSize: 10,
                color: "var(--yellow)",
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: 4,
                padding: "2px 8px",
                fontFamily: "var(--font-mono)",
              }}
            >
              DUPLICATE
            </span>
          )}
          <button
            onClick={() => setShowProfile((p) => !p)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 11,
              padding: "4px 10px",
              transition: "all 0.15s",
            }}
          >
            {showProfile ? "Hide profile" : "View profile"}
          </button>
        </div>
      </div>

      {/* Extracted profile */}
      {showProfile && (
        <div
          className="fade-up"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <Section title="Education">
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{extracted.education || "—"}</p>
            </Section>
            <Section title="Skills">
              <Chips items={skills} />
            </Section>
            {extracted.authentication_experience?.length > 0 && (
              <Section title="Auth Experience">
                <Chips items={extracted.authentication_experience} />
              </Section>
            )}
            {extracted.ci_cd_tools?.length > 0 && (
              <Section title="CI/CD">
                <Chips items={extracted.ci_cd_tools} />
              </Section>
            )}
          </div>
          <div>
            {internships.length > 0 && (
              <Section title="Internships">
                {internships.map((item: any, i: number) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>
                      {item.role} @ {item.company}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{item.duration}</p>
                    <Chips items={item.technologies || []} />
                  </div>
                ))}
              </Section>
            )}
            {projects.length > 0 && (
              <Section title="Projects">
                {projects.map((p: any, i: number) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{p.name}</p>
                    <Chips items={p.technologies || []} />
                  </div>
                ))}
              </Section>
            )}
            {extracted.achievements && (
              <Section title="Achievements">
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{extracted.achievements}</p>
              </Section>
            )}
          </div>
        </div>
      )}

      {/* Role scores */}
      {(result.scores || []).map((r: any, i: number) => (
        <RoleScore key={i} result={r} />
      ))}
    </div>
  );
}