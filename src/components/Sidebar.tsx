import React from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Server,
  TerminalSquare,
} from "lucide-react";

interface SidebarProps {
  currentView: "dashboard" | "new" | "settings" | "terminal";
  setCurrentView: (view: "dashboard" | "new" | "settings" | "terminal") => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <Server size={18} className="text-zinc-950" />
        </div>
        <h1 className="font-semibold text-lg tracking-tight">AI Deploy</h1>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        <button
          onClick={() => setCurrentView("dashboard")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            currentView === "dashboard"
              ? "bg-zinc-800 text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-sm font-medium">Deployments</span>
        </button>
        <button
          onClick={() => setCurrentView("new")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            currentView === "new"
              ? "bg-zinc-800 text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <PlusCircle size={18} />
          <span className="text-sm font-medium">New App</span>
        </button>
        <button
          onClick={() => setCurrentView("terminal")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            currentView === "terminal"
              ? "bg-zinc-800 text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <TerminalSquare size={18} />
          <span className="text-sm font-medium">Shell Terminal</span>
        </button>
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={() => setCurrentView("settings")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
            currentView === "settings"
              ? "bg-zinc-800 text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <Settings size={18} />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
