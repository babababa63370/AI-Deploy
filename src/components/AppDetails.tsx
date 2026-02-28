import React, { useState, useEffect, useRef } from "react";
import { Deployment, AIAnalysisResult } from "../types";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal as TerminalIcon,
  Globe,
  RefreshCw,
  Sparkles,
  Loader2,
  Trash2,
} from "lucide-react";
import { suggestFix } from "../services/geminiService";

interface AppDetailsProps {
  deploymentId: string;
  onBack: () => void;
}

export function AppDetails({ deploymentId, onBack }: AppDetailsProps) {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [isHealing, setIsHealing] = useState(false);
  const [healingMessage, setHealingMessage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDeployment();
    const interval = setInterval(fetchDeployment, 5000);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "deploy_log" && msg.id === deploymentId) {
        setDeployment((prev) =>
          prev ? { ...prev, logs: [...prev.logs, msg.log] } : null,
        );
      } else if (msg.type === "deploy_status" && msg.id === deploymentId) {
        setDeployment((prev) =>
          prev ? { ...prev, status: msg.status } : null,
        );
      }
    };

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [deploymentId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [deployment?.logs]);

  const fetchDeployment = async () => {
    try {
      const res = await fetch(`/api/deployments/${deploymentId}`);
      if (res.ok) {
        const data = await res.json();
        setDeployment(data);
      }
    } catch (e) {
      console.error("Failed to fetch deployment", e);
    }
  };

  const handleAutoHeal = async () => {
    if (!deployment) return;
    setIsHealing(true);
    setHealingMessage("AI is analyzing the logs to find a fix...");

    try {
      const logsText = deployment.logs.join("\n");
      const fix = await suggestFix(logsText, deployment.source, {
        installCommand: deployment.installCommand,
        buildCommand: deployment.buildCommand,
        startCommand: deployment.startCommand,
      });

      setHealingMessage(`AI Suggestion: ${fix.explanation}`);

      if (fix.suggestedCommands) {
        setHealingMessage(
          (prev) => prev + "\nApplying suggested commands and retrying...",
        );

        // Update commands in DB
        await fetch(`/api/deployments/${deploymentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...fix.suggestedCommands,
            status: "Deploying",
          }),
        });

        // Trigger new deploy via WS
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "deploy",
              payload: {
                id: deploymentId,
                source: deployment.source,
                ...deployment, // current commands
                ...fix.suggestedCommands, // overridden commands
              },
            }),
          );
        }
      }
    } catch (e) {
      setHealingMessage("AI failed to suggest a fix.");
    } finally {
      setTimeout(() => setIsHealing(false), 3000);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this deployment?")) return;
    try {
      const res = await fetch(`/api/deployments/${deploymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onBack();
      }
    } catch (e) {
      console.error("Failed to delete deployment", e);
    }
  };

  if (!deployment) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    deployment.status === "Running"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : deployment.status === "Failed"
                        ? "bg-red-500/10 text-red-500"
                        : deployment.status === "Deploying"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-zinc-500/10 text-zinc-500"
                  }`}
                >
                  {deployment.status === "Running" && (
                    <CheckCircle2 size={24} />
                  )}
                  {deployment.status === "Failed" && <XCircle size={24} />}
                  {deployment.status === "Deploying" && (
                    <Activity size={24} className="animate-pulse" />
                  )}
                  {deployment.status === "Stopped" && <Clock size={24} />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{deployment.name}</h2>
                  <p className="text-zinc-400 text-sm">{deployment.source}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(deployment.status === "Failed" || deployment.status === "Running") && (
                  <button
                    onClick={handleAutoHeal}
                    disabled={isHealing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {isHealing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {deployment.status === "Running" ? "Re-build / Fix" : "AI Auto-Heal"}
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {isHealing && (
              <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-emerald-400 text-sm whitespace-pre-wrap">
                <div className="flex items-center gap-2 mb-2 font-bold">
                  <Sparkles size={16} />
                  AI Healing in Progress
                </div>
                {healingMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Status
                </div>
                <div className="font-medium">{deployment.status}</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Domain
                </div>
                <div className="font-medium flex flex-col gap-1">
                  {deployment.domain ? (
                    <>
                      <a
                        href={`https://${deployment.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Globe size={14} />
                        {deployment.domain}
                      </a>
                      <span className="text-[10px] text-zinc-500">
                        CNAME: {window.location.hostname}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        Type A (IP): 34.143.78.2 (Warning: CNAME is preferred)
                      </span>
                      {deployment.port > 0 && (
                        <span className="text-[10px] text-emerald-500 font-bold">
                          Internal Port: {deployment.port}
                        </span>
                      )}
                    </>
                  ) : (
                    "None"
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Build Configuration</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">
                    Install Command
                  </div>
                  <code className="block bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-zinc-300">
                    {deployment.installCommand}
                  </code>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">
                    Build Command
                  </div>
                  <code className="block bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-zinc-300">
                    {deployment.buildCommand || "None"}
                  </code>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">
                    Start Command
                  </div>
                  <code className="block bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-zinc-300">
                    {deployment.startCommand}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TerminalIcon size={16} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-300">
                Deployment Logs
              </span>
            </div>
            <button
              onClick={() =>
                setDeployment((prev) => (prev ? { ...prev, logs: [] } : null))
              }
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-sm whitespace-pre-wrap">
            {deployment.logs.length === 0 ? (
              <div className="text-zinc-600 h-full flex items-center justify-center">
                No logs available.
              </div>
            ) : (
              <div className="space-y-1">
                {deployment.logs.map((log, i) => (
                  <span
                    key={i}
                    className={
                      log.startsWith(">")
                        ? "text-emerald-400 font-semibold"
                        : "text-zinc-400"
                    }
                  >
                    {log}
                  </span>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
