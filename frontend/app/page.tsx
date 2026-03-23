"use client";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import ScreenView from "../components/ScreenView";
import ConfigView from "../components/ConfigView";

type View = "screen" | "config";

export default function Home() {
  const [view, setView] = useState<View>("screen");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar active={view} onChange={setView} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {view === "screen" && <ScreenView />}
        {view === "config" && <ConfigView />}
      </main>
    </div>
  );
}
