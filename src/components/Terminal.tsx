import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

export function ShellTerminal() {
  const [logs, setLogs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log") {
          setLogs((prev) => [...prev, msg.data]);
        } else if (msg.type === "exit") {
          setLogs((prev) => [
            ...prev,
            `\n[Process exited with code ${msg.code}]\n`,
          ]);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;
    setLogs((prev) => [...prev, `$ ${input}\n`]);
    wsRef.current.send(
      JSON.stringify({ type: "execute", payload: { command: input } }),
    );
    setInput("");
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto">
      <header className="mb-6">
        <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
          <TerminalIcon size={28} />
          Shell Terminal
        </h2>
        <p className="text-zinc-400 mt-2">
          Execute commands directly on the host environment.
        </p>
      </header>
      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col font-mono text-sm">
        <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap text-zinc-300">
          {logs.join("")}
          <div ref={bottomRef} />
        </div>
        <form
          onSubmit={handleCommand}
          className="border-t border-zinc-800 p-2 flex items-center bg-zinc-900"
        >
          <span className="text-emerald-500 font-bold mr-2">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none text-zinc-100"
            autoFocus
          />
        </form>
      </div>
    </div>
  );
}
