"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Send, X, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function DeluGPT() {
  const MAX_CONTEXT_TURNS = 12; // how many recent messages to send to API
  const MAX_RENDER_MESSAGES = 100; // cap DOM rendering for smooth scroll
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I’m DELU‑GPT. How can I help?" },
  ]);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const endRef = useRef(null);
  const modalRef = useRef(null);
  const [pos, setPos] = useState({ x: 16, y: 100 });
  const dragRef = useRef({ mx: 0, my: 0, x: 0, y: 0 });
  const dragRAF = useRef(null);
  const [dragging, setDragging] = useState(false);
  const synthRef = useRef(null);
  const recogRef = useRef(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [typing, setTyping] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!endRef.current) return;
    const behave = messages.length > 40 ? "auto" : "smooth";
    requestAnimationFrame(() => {
      try { endRef.current.scrollIntoView({ behavior: behave }); } catch {}
    });
  }, [messages, open]);

  // Initialize modal position on open
  useEffect(() => {
    if (!open) return;
    try {
      const h = modalRef.current?.offsetHeight || 420;
      const top = Math.max(16, window.innerHeight - h - 16);
      setPos({ x: 16, y: top });
    } catch {}
  }, [open]);

  // Init TTS/STT
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis || null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSttSupported(true);
      const recog = new SR();
      recog.lang = "en-IN";
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recog.onresult = (e) => {
        const t = e.results?.[0]?.[0]?.transcript || "";
        if (t) setInput((prev) => (prev ? prev + " " : "") + t);
      };
      recog.onend = () => setRecognizing(false);
      recog.onerror = () => setRecognizing(false);
      recogRef.current = recog;
    }
    return () => {
      try { if (synthRef.current?.speaking) synthRef.current.cancel(); } catch {}
      try { if (recognizing) recogRef.current?.stop(); } catch {}
    };
  }, []);

  const ask = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setBusy(true);
    setTyping(true);
    // cancel any in-flight request
    try { abortRef.current?.abort(); } catch {}
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messagesRef.current, { role: "user", content }].slice(-MAX_CONTEXT_TURNS),
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok) {
        const reply = data.reply || "(No reply)";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        if (ttsEnabled && synthRef.current) {
          try {
            const u = new SpeechSynthesisUtterance(reply.replace(/<[^>]+>/g, " "));
            u.lang = "en-IN";
            u.rate = 1.0;
            synthRef.current.cancel();
            synthRef.current.speak(u);
          } catch {}
        }
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "Request failed" }]);
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        setMessages((m) => [...m, { role: "assistant", content: e.message || "Network error" }]);
      }
    } finally {
      setBusy(false);
      setTyping(false);
    }
  };

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    dragRef.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y };
    const onMove = (ev) => {
      const dx = ev.clientX - dragRef.current.mx;
      const dy = ev.clientY - dragRef.current.my;
      let nx = dragRef.current.x + dx;
      let ny = dragRef.current.y + dy;
      const w = modalRef.current?.offsetWidth || 360;
      const h = modalRef.current?.offsetHeight || 420;
      nx = Math.max(0, Math.min(nx, window.innerWidth - w));
      ny = Math.max(0, Math.min(ny, window.innerHeight - h));
      if (dragRAF.current) return;
      dragRAF.current = requestAnimationFrame(() => {
        setPos({ x: nx, y: ny });
        dragRAF.current = null;
      });
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const quick = [
    { label: "My current MRN", text: "What is my current MRN?" },
    ...(session?.user?.role === "team_manager"
      ? [{ label: "Assign task", text: "How to assign a task to a member?" }]
      : []),
    ...(session?.user?.role === "admin"
      ? [{ label: "Add user", text: "Guide me to add a new user." }]
      : []),
  ];

  const hideFloating = pathname?.startsWith("/dashboard/member/workTogether");
  if (hideFloating) return null;

  return (
    <>
      <div className="fixed bottom-4 sm:bottom-20 left-4 z-[1000] flex items-center gap-3 mb-safe">
        <button
          onClick={() => setOpen(true)}
          className="rounded-full p-0.5 shadow-xl border border-pink-300/40 bg-gradient-to-br from-pink-500 to-fuchsia-600 hover:brightness-110"
          title="Open DELU‑GPT"
          aria-label="Open DELU‑GPT"
        >
          <span
            className="block w-12 h-12 rounded-full bg-white/95 flex items-center justify-center text-2xl"
            style={{ boxShadow: "inset 0 0 10px rgba(0,0,0,.06)" }}
          >
            {/* Cartoon face emoji */}
            <span role="img" aria-label="cartoon assistant">🤖</span>
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1001]" onClick={() => setOpen(false)}>
          <div
            ref={modalRef}
            className="absolute w-[92vw] max-w-md rounded-2xl bg-[#0b1220] text-white border border-cyan-900/40 shadow-2xl overflow-hidden"
            style={{ left: pos.x, top: pos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b border-cyan-900/40 ${dragging ? 'cursor-grabbing' : 'cursor-move'} select-none`} onMouseDown={startDrag}>
              <div className="flex items-center gap-2">
                <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-pink-500/30 border border-pink-400/40">🤖</span>
                <h3 className="font-semibold text-cyan-200">DELU‑GPT</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  title={ttsEnabled ? "Disable speech out" : "Enable speech out"}
                  onClick={() => setTtsEnabled((v) => !v)}
                  className="p-2 rounded-lg hover:bg-white/10"
                >
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-3 h-80 overflow-y-auto space-y-2">
              {messages.slice(-MAX_RENDER_MESSAGES).map((m, i) => (
                <div key={i} className={`text-sm ${m.role === "assistant" ? "text-cyan-100" : "text-gray-200"}`}>
                  <span className="font-semibold mr-1">{m.role === "assistant" ? "DELU‑GPT:" : "You:"}</span>
                  <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, "<br/>") }} />
                </div>
              ))}
              {typing && (
                <div className="text-sm text-cyan-200">
                  <span className="font-semibold mr-1">DELU‑GPT:</span>
                  <span>typing…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="px-3 pb-2 flex gap-2 flex-wrap">
              {quick.map((q) => (
                <button
                  key={q.label}
                  onClick={() => setInput(q.text)}
                  className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-cyan-900/40 flex items-center gap-2">
              {sttSupported && (
                <button
                  onClick={() => {
                    if (!recognizing) {
                      try { recogRef.current?.start(); setRecognizing(true); } catch {}
                    } else {
                      try { recogRef.current?.stop(); } catch {}
                    }
                  }}
                  title={recognizing ? "Stop recording" : "Speak"}
                  className={`px-2 py-2 rounded-xl ${recognizing ? "bg-rose-600 hover:bg-rose-700" : "bg-white/10 hover:bg-white/15"}`}
                >
                  {recognizing ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
                placeholder="Ask something…"
                className="flex-1 bg-white/10 border border-cyan-900/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-600"
              />
              <Link
                href="/dashboard/managersCommon/assignTask"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg border border-emerald-200/50 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 flex-shrink-0 whitespace-nowrap"
                aria-label="Assign Task"
              >
                <span role="img" aria-label="clipboard">🗒️</span>
                <span className="hidden sm:inline">Assign Task</span>
                <span className="sm:hidden">Assign</span>
              </Link>
              <button onClick={ask} disabled={busy || !input.trim()} className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
