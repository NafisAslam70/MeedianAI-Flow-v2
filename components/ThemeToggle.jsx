"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

// Simple day/night/system toggle using Tailwind's `dark` class on <html>
export default function ThemeToggle({ compact = false }) {
  const [mode, setMode] = useState("system"); // "light" | "dark" | "system"

  // Initialize from localStorage or system
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") || "system";
      setMode(stored);
      applyTheme(stored);
    } catch {}
  }, []);

  const applyTheme = (m) => {
    const root = document.documentElement;
    if (m === "dark") {
      root.classList.add("dark");
    } else if (m === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", !!prefersDark);
    }
  };

  const cycle = () => {
    const order = ["light", "dark", "system"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    try { localStorage.setItem("theme", next); } catch {}
    applyTheme(next);
  };

  const Label = () => (
    <span className="text-xs ml-1 hidden sm:inline">{mode}</span>
  );

  return (
    <button
      onClick={cycle}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/10 hover:bg-white/15 text-cyan-50 ${compact ? "text-xs" : "text-sm"}`}
      title="Toggle theme (light/dark/system)"
      aria-label="Toggle theme"
    >
      {mode === "light" && <Sun className="w-4 h-4" />}
      {mode === "dark" && <Moon className="w-4 h-4" />}
      {mode === "system" && <Monitor className="w-4 h-4" />}
      <Label />
    </button>
  );
}

