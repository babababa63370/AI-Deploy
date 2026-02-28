import React from "react";
import { Deployment } from "../types";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TerminalSquare,
  Globe,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";

interface DashboardProps {
  deployments: Deployment[];
  onViewDetails: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Dashboard({
  deployments,
  onViewDetails,
  onDelete,
}: DashboardProps) {
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight">Deployments</h2>
        <p className="text-zinc-400 mt-2">
          Manage your AI-deployed applications.
        </p>
      </header>

      {deployments.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
          <TerminalSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">
            No deployments yet
          </h3>
          <p className="text-zinc-500 mt-2">
            Create a new app to get started with AI-powered deployments.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {deployments.map((dep, index) => (
            <motion.div
              key={dep.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors"
              onClick={() => onViewDetails(dep.id)}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    dep.status === "Running"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : dep.status === "Failed"
                        ? "bg-red-500/10 text-red-500"
                        : dep.status === "Deploying"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-zinc-500/10 text-zinc-500"
                  }`}
                >
                  {dep.status === "Running" && <CheckCircle2 size={20} />}
                  {dep.status === "Failed" && <XCircle size={20} />}
                  {dep.status === "Deploying" && (
                    <Activity size={20} className="animate-pulse" />
                  )}
                  {dep.status === "Stopped" && <Clock size={20} />}
                </div>
                <div>
                  <h3 className="font-medium text-lg flex items-center gap-2">
                    {dep.name}
                    {dep.domain && (
                      <span className="text-xs font-normal text-emerald-400 flex items-center gap-1">
                        <Globe size={12} />
                        {dep.domain}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-zinc-400 truncate max-w-md">
                    {dep.source}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm font-medium text-zinc-300">
                    {dep.status}
                    {dep.status === "Running" && dep.port > 0 && (
                      <span className="ml-2 text-xs text-emerald-500">
                        :{dep.port}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(dep.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(dep.id);
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(dep.id);
                  }}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
