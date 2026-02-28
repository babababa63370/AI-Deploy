import React, { useState, useEffect, useRef } from "react";
import {
  Github,
  Folder,
  Sparkles,
  ArrowRight,
  Terminal,
  Loader2,
  Globe,
} from "lucide-react";
import { analyzeProject } from "../services/geminiService";
import { AIAnalysisResult } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface NewDeploymentProps {
  onDeploy: () => void;
}

export function NewDeployment({ onDeploy }: NewDeploymentProps) {
  const [sourceType, setSourceType] = useState<"github" | "local">("github");
  const [sourceInput, setSourceInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [dnsType, setDnsType] = useState<"CNAME" | "A">("CNAME");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "deploy_log") {
          setDeploymentLogs((prev) => [...prev, msg.log]);
        } else if (msg.type === "deploy_status") {
          if (msg.status === "Running" || msg.status === "Failed") {
            setTimeout(() => {
              onDeploy();
            }, 2000);
          }
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    return () => ws.close();
  }, [onDeploy]);

  const handleAnalyze = async () => {
    if (!sourceInput.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeProject(sourceInput);
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeploy = async () => {
    if (!analysis) return;
    setIsDeploying(true);
    setDeploymentLogs(["Starting deployment process...\n"]);

    const id = Math.random().toString(36).substring(7);
    const name = sourceInput.split("/").pop() || "New App";

    // 1. Save to DB
    await fetch("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name,
        source: sourceInput,
        installCommand: analysis.installCommand,
        buildCommand: analysis.buildCommand,
        startCommand: analysis.startCommand,
        domain: domainInput || undefined,
      }),
    });

    // 2. Setup DNS if domain provided
    if (domainInput) {
      setDeploymentLogs((prev) => [
        ...prev,
        `> Configuring Cloudflare DNS for ${domainInput}...\n`,
      ]);
      try {
        const dnsRes = await fetch("/api/cloudflare/dns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: domainInput,
            target: dnsType === "A" ? "34.143.78.2" : window.location.hostname,
            type: dnsType,
          }),
        });
        const dnsData = await dnsRes.json();
        if (dnsData.success) {
          setDeploymentLogs((prev) => [
            ...prev,
            `[Success] DNS configured successfully.\n`,
          ]);
        } else {
          setDeploymentLogs((prev) => [
            ...prev,
            `[Warning] DNS setup failed: ${dnsData.error}\n`,
          ]);
        }
      } catch (e: any) {
        setDeploymentLogs((prev) => [
          ...prev,
          `[Warning] DNS setup failed: ${e.message}\n`,
        ]);
      }
    }

    // 3. Start deployment via WS
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "deploy",
          payload: {
            id,
            source: sourceInput,
            installCommand: analysis.installCommand,
            buildCommand: analysis.buildCommand,
            startCommand: analysis.startCommand,
          },
        }),
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight">
          Deploy New App
        </h2>
        <p className="text-zinc-400 mt-2">
          Connect a repository or local folder and let AI handle the rest.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-medium mb-4">Source Configuration</h3>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setSourceType("github")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  sourceType === "github"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50"
                }`}
              >
                <Github size={18} />
                GitHub URL
              </button>
              <button
                onClick={() => setSourceType("local")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  sourceType === "local"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/50"
                }`}
              >
                <Folder size={18} />
                Local Folder
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  {sourceType === "github"
                    ? "Repository URL"
                    : "Folder Path or Description"}
                </label>
                <input
                  type="text"
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder={
                    sourceType === "github"
                      ? "https://github.com/user/repo"
                      : '/Users/name/projects/app or "React Vite app"'
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={14} />
                    Custom Domain (Optional)
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDnsType("CNAME")}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${dnsType === "CNAME" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"}`}
                    >
                      CNAME
                    </button>
                    <button
                      type="button"
                      onClick={() => setDnsType("A")}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${dnsType === "A" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"}`}
                    >
                      Type A
                    </button>
                  </div>
                </label>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="app.example.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                {dnsType === "A" && (
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Will point to IP: <code className="text-emerald-500">34.143.78.2</code>
                  </p>
                )}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!sourceInput.trim() || isAnalyzing || isDeploying}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isAnalyzing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                {isAnalyzing ? "Analyzing with AI..." : "Analyze Project"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {analysis && !isDeploying && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-4 text-emerald-400">
                  <Sparkles size={18} />
                  <h3 className="text-lg font-medium text-white">
                    AI Analysis Complete
                  </h3>
                </div>

                <p className="text-sm text-zinc-400 mb-6">
                  {analysis.explanation}
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
                      Install Command
                    </div>
                    <code className="block bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-emerald-300">
                      {analysis.installCommand || "N/A"}
                    </code>
                  </div>
                  {analysis.buildCommand && (
                    <div>
                      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
                        Build Command
                      </div>
                      <code className="block bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-emerald-300">
                        {analysis.buildCommand}
                      </code>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
                      Start Command
                    </div>
                    <code className="block bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono text-emerald-300">
                      {analysis.startCommand || "N/A"}
                    </code>
                  </div>
                </div>

                <button
                  onClick={handleDeploy}
                  className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Start Deployment
                  <ArrowRight size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
            <Terminal size={16} className="text-zinc-500" />
            <span className="text-sm font-medium text-zinc-300">
              Deployment Logs
            </span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-sm whitespace-pre-wrap">
            {deploymentLogs.length === 0 ? (
              <div className="text-zinc-600 h-full flex items-center justify-center">
                Waiting for deployment to start...
              </div>
            ) : (
              <div className="space-y-1">
                {deploymentLogs.map((log, i) => (
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
                {isDeploying && (
                  <div className="flex items-center gap-2 text-zinc-500 mt-4">
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
