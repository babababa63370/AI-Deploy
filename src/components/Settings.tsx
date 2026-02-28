import React, { useState, useEffect } from "react";
import {
  Save,
  Shield,
  Key,
  Globe,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-react";

export function Settings() {
  const [cfToken, setCfToken] = useState("");
  const [cfZone, setCfZone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [isLoadingDns, setIsLoadingDns] = useState(false);
  const [newDns, setNewDns] = useState({
    domain: "",
    target: "",
    type: "CNAME",
  });
  const [isAddingDns, setIsAddingDns] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setCfToken(data.cf_token || "");
      setCfZone(data.cf_zone || "");
      if (data.cf_token && data.cf_zone) {
        fetchDnsRecords(data.cf_token, data.cf_zone);
      }
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  };

  const fetchDnsRecords = async (token?: string, zone?: string) => {
    const t = token || cfToken;
    const z = zone || cfZone;
    if (!t || !z) return;

    setIsLoadingDns(true);
    try {
      const res = await fetch("/api/cloudflare/dns");
      const data = await res.json();
      if (data.success) {
        setDnsRecords(data.records);
      }
    } catch (e) {
      console.error("Failed to fetch DNS records", e);
    } finally {
      setIsLoadingDns(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cf_token: cfToken, cf_zone: cfZone }),
      });
      if (res.ok) {
        setMessage("Settings saved successfully.");
        setTimeout(() => setMessage(""), 3000);
        fetchDnsRecords();
      }
    } catch (e) {
      console.error("Failed to save settings", e);
      setMessage("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDns = async () => {
    if (!newDns.domain || !newDns.target) return;
    setIsAddingDns(true);
    try {
      const res = await fetch("/api/cloudflare/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDns),
      });
      const data = await res.json();
      if (data.success) {
        setNewDns({ domain: "", target: "", type: "CNAME" });
        fetchDnsRecords();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error("Failed to add DNS record", e);
    } finally {
      setIsAddingDns(false);
    }
  };

  const handleDeleteDns = async (id: string) => {
    if (!confirm("Are you sure you want to delete this DNS record?")) return;
    try {
      const res = await fetch(`/api/cloudflare/dns/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchDnsRecords();
      }
    } catch (e) {
      console.error("Failed to delete DNS record", e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
          <SettingsIcon size={28} />
          Settings
        </h2>
        <p className="text-zinc-400 mt-2">
          Configure your deployment environment and external integrations.
        </p>
      </header>

      <div className="space-y-8">
        {/* Cloudflare Configuration */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6 text-emerald-400">
            <Shield size={20} />
            <h3 className="text-lg font-medium text-white">
              Cloudflare Integration
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                <Key size={14} />
                API Token
              </label>
              <input
                type="password"
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
                placeholder="Enter your Cloudflare API Token"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                <Globe size={14} />
                Zone ID
              </label>
              <input
                type="text"
                value={cfZone}
                onChange={(e) => setCfZone(e.target.value)}
                placeholder="Enter your Cloudflare Zone ID"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-zinc-800">
              <span className="text-sm text-emerald-400">{message}</span>
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Save Configuration
              </button>
            </div>
          </div>
        </section>

        {/* DNS Management */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <Globe size={20} />
              <h3 className="text-lg font-medium text-white">DNS Management</h3>
            </div>
            <div className="text-[10px] text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
              Server IP (Type A): <code className="text-emerald-500">34.143.78.2</code>
            </div>
            {cfToken && cfZone && (
              <button
                onClick={() => fetchDnsRecords()}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>

          {!cfToken || !cfZone ? (
            <div className="text-center py-8 bg-zinc-950/50 border border-dashed border-zinc-800 rounded-lg">
              <p className="text-zinc-500 text-sm">
                Configure Cloudflare credentials above to manage DNS records.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add New Record Form */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-4">Add New Record</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <select
                      value={newDns.type}
                      onChange={(e) =>
                        setNewDns({ ...newDns, type: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="CNAME">CNAME</option>
                      <option value="A">A</option>
                      <option value="AAAA">AAAA</option>
                      <option value="TXT">TXT</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <input
                      type="text"
                      placeholder="Subdomain (e.g. test)"
                      value={newDns.domain}
                      onChange={(e) =>
                        setNewDns({ ...newDns, domain: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <input
                      type="text"
                      placeholder="Target (e.g. app.run.app)"
                      value={newDns.target}
                      onChange={(e) =>
                        setNewDns({ ...newDns, target: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <button
                      onClick={handleAddDns}
                      disabled={isAddingDns || !newDns.domain || !newDns.target}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {isAddingDns ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Plus size={16} />
                      )}
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Records List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Content</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {isLoadingDns ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center">
                          <Loader2
                            size={20}
                            className="animate-spin mx-auto text-zinc-600"
                          />
                        </td>
                      </tr>
                    ) : dnsRecords.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-zinc-600">
                          No DNS records found.
                        </td>
                      </tr>
                    ) : (
                      dnsRecords.map((record) => (
                        <tr key={record.id} className="group">
                          <td className="py-3">
                            <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[10px] font-bold">
                              {record.type}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-zinc-300">
                            {record.name}
                          </td>
                          <td className="py-3 text-zinc-500 truncate max-w-[200px]">
                            {record.content}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`https://${record.name}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button
                                onClick={() => handleDeleteDns(record.id)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
