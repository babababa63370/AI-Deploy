import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { NewDeployment } from "./components/NewDeployment";
import { Settings } from "./components/Settings";
import { ShellTerminal } from "./components/Terminal";
import { AppDetails } from "./components/AppDetails";
import { Deployment } from "./types";

export default function App() {
  const [currentView, setCurrentView] = useState<
    "dashboard" | "new" | "settings" | "terminal" | "details"
  >("dashboard");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  useEffect(() => {
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeployments = async () => {
    try {
      const res = await fetch("/api/deployments");
      if (res.ok) {
        const data = await res.json();
        setDeployments(data);
      }
    } catch (e) {
      console.error("Failed to fetch deployments", e);
    }
  };

  const handleDeploy = () => {
    fetchDeployments();
    setCurrentView("dashboard");
  };

  const handleViewDetails = (id: string) => {
    setSelectedAppId(id);
    setCurrentView("details");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deployment?")) return;
    try {
      const res = await fetch(`/api/deployments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDeployments();
      }
    } catch (e) {
      console.error("Failed to delete deployment", e);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans">
      <Sidebar
        currentView={currentView === "details" ? "dashboard" : currentView}
        setCurrentView={setCurrentView}
      />
      <main className="flex-1 overflow-y-auto p-8">
        {currentView === "dashboard" && (
          <Dashboard
            deployments={deployments}
            onViewDetails={handleViewDetails}
            onDelete={handleDelete}
          />
        )}
        {currentView === "new" && <NewDeployment onDeploy={handleDeploy} />}
        {currentView === "settings" && <Settings />}
        {currentView === "terminal" && <ShellTerminal />}
        {currentView === "details" && selectedAppId && (
          <AppDetails
            deploymentId={selectedAppId}
            onBack={() => setCurrentView("dashboard")}
          />
        )}
      </main>
    </div>
  );
}
