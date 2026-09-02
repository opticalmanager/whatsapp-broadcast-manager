"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { 
  UserX, 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  Plus, 
  Download, 
  RefreshCw, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Loader2, 
  FileSpreadsheet,
  X,
  Phone,
  User,
  MessageSquare,
  Sparkles,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface UnsubscriberSettings {
  enabled: boolean;
  optoutText: string;
  triggerKeywords: string;
  autoReplyConfirmation: boolean;
  confirmationMessage: string;
}

interface UnsubscriberRecord {
  id: string;
  phone: string;
  name: string | null;
  reason: string | null;
  triggerKeyword: string;
  instanceId: string | null;
  source: string;
  unsubscribedAt: string;
  createdAt: string;
}

export default function UnsubscribersPage() {
  const { user } = useAuth();
  const backendUrl = getBackendUrl();

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [unsubscribers, setUnsubscribers] = useState<UnsubscriberRecord[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<UnsubscriberSettings>({
    enabled: true,
    optoutText: "_Reply STOP to unsubscribe from promotional messages._",
    triggerKeywords: "STOP,UNSUBSCRIBE,OPTOUT",
    autoReplyConfirmation: true,
    confirmationMessage: "You have been successfully unsubscribed. You will no longer receive promotional broadcasts from us.",
  });

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualKeyword, setManualKeyword] = useState("MANUAL");
  const [addingLoading, setAddingLoading] = useState(false);

  // Re-subscribe Confirmation Modal
  const [resubscribeTarget, setResubscribeTarget] = useState<UnsubscriberRecord | null>(null);
  const [resubscribingLoading, setResubscribingLoading] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("broadcast_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  };

  // 1. Fetch Settings & Unsubscribers List
  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const headers = getAuthHeaders();

      // Fetch Settings
      const setRes = await fetch(`${backendUrl}/api/v1/unsubscribers/settings`, { headers });
      if (setRes.ok) {
        const setJson = await setRes.json();
        if (setJson.success && setJson.data) {
          setSettings({
            enabled: setJson.data.enabled !== false,
            optoutText: setJson.data.optoutText || "_Reply STOP to unsubscribe from promotional messages._",
            triggerKeywords: setJson.data.triggerKeywords || "STOP,UNSUBSCRIBE,OPTOUT",
            autoReplyConfirmation: setJson.data.autoReplyConfirmation !== false,
            confirmationMessage: setJson.data.confirmationMessage || "You have been successfully unsubscribed.",
          });
        }
      }

      // Fetch Unsubscribers
      const listRes = await fetch(`${backendUrl}/api/v1/unsubscribers${search ? `?search=${encodeURIComponent(search)}` : ""}`, { headers });
      if (listRes.ok) {
        const listJson = await listRes.json();
        if (listJson.success && Array.isArray(listJson.data)) {
          setUnsubscribers(listJson.data);
        }
      }
    } catch {
      toast.error("Failed to load unsubscribers data");
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [backendUrl]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 2. Save Settings Handler
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await fetch(`${backendUrl}/api/v1/unsubscribers/settings`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast.success("Unsubscriber settings saved successfully!");
      } else {
        toast.error("Failed to save unsubscriber settings");
      }
    } catch {
      toast.error("Network error saving settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // 3. Manual Add Unsubscriber
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    try {
      setAddingLoading(true);
      const res = await fetch(`${backendUrl}/api/v1/unsubscribers`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: manualPhone,
          name: manualName,
          triggerKeyword: manualKeyword,
        }),
      });

      if (res.ok) {
        toast.success(`Added ${manualPhone} to Unsubscribers list`);
        setIsAddModalOpen(false);
        setManualPhone("");
        setManualName("");
        loadData(false);
      } else {
        toast.error("Failed to add unsubscriber");
      }
    } catch {
      toast.error("Error adding unsubscriber");
    } finally {
      setAddingLoading(false);
    }
  };

  // 4. Re-Subscribe (Remove from unsubscribers list)
  const handleResubscribe = async () => {
    if (!resubscribeTarget) return;

    try {
      setResubscribingLoading(true);
      const res = await fetch(`${backendUrl}/api/v1/unsubscribers/${resubscribeTarget.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        toast.success(`Re-subscribed ${resubscribeTarget.phone}! Contact can now receive broadcasts.`);
        setResubscribeTarget(null);
        loadData(false);
      } else {
        toast.error("Failed to re-subscribe contact");
      }
    } catch {
      toast.error("Error re-subscribing contact");
    } finally {
      setResubscribingLoading(false);
    }
  };

  // 5. Export CSV
  const handleExportCsv = () => {
    if (unsubscribers.length === 0) {
      toast.error("No unsubscribers to export");
      return;
    }

    const headers = ["Phone", "Name", "Date Unsubscribed", "Trigger Keyword", "Source"];
    const rows = unsubscribers.map((u) => [
      `+${u.phone}`,
      u.name || "N/A",
      new Date(u.unsubscribedAt).toLocaleString(),
      u.triggerKeyword || "STOP",
      u.source || "AUTO_KEYWORD",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `unsubscribers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Unsubscribers list exported to CSV!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading unsubscriber engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto select-none pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <UserX className="w-5 h-5 text-rose-500" />
            <span>Unsubscribers & Opt-Out Engine</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated compliance & anti-ban protection: customers who opt out are never sent broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Unsubscriber</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: OPT-OUT RULES & SETTINGS CARD
          ========================================================================= */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-2xs space-y-6">
        
        {/* Toggle Header Row */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Automated Opt-Out & Unsubscriber Engine
            </h3>

            {/* Feature Toggle (Default: ON) */}
            <button
              type="button"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  enabled: !prev.enabled,
                }))
              }
              className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                settings.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <div
                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  settings.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            When enabled, the opt-out footer is automatically attached to broadcasts, and any incoming "STOP" keyword automatically opts the customer out.
          </p>
        </div>

        {/* Warning Alert when Toggled OFF */}
        {!settings.enabled && (
          <div className="p-4 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 animate-in fade-in">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-rose-900 dark:text-rose-200">
                ⚠️ High WhatsApp Ban Risk Warning
              </h4>
              <p className="text-rose-800/90 dark:text-rose-300/90 leading-relaxed font-medium">
                Disabling the automated opt-out engine significantly increases your WhatsApp account ban risk. Without an opt-out keyword, dissatisfied recipients are forced to click <strong>"Report as Spam"</strong> or <strong>"Block"</strong> inside WhatsApp, which triggers immediate permanent account bans.
              </p>
            </div>
          </div>
        )}

        {/* Config Inputs (when enabled) */}
        {settings.enabled && (
          <div className="space-y-5 pt-1 animate-in fade-in duration-150">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Textarea: Opt-Out Footer Text */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="text-rose-500 font-bold">*</span>
                    <span>Opt-Out Disclaimer Footer Text</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Appended automatically to all outgoing broadcasts
                  </span>
                </label>

                <textarea
                  rows={2}
                  value={settings.optoutText}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      optoutText: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Input: Trigger Keyword */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-rose-500 font-bold">*</span>
                  <span>Trigger Keyword(s)</span>
                </label>
                <input
                  type="text"
                  value={settings.triggerKeywords}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      triggerKeywords: e.target.value,
                    }))
                  }
                  placeholder="e.g. STOP, UNSUBSCRIBE"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-[10px] text-slate-400">
                  Case-insensitive (matches "stop", "STOP", "Stop")
                </p>
              </div>

            </div>

            {/* Live Message Composer Locked Preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                  Footer Preview: <span className="font-mono text-slate-800 dark:text-white font-bold">"{settings.optoutText}"</span>
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                Locked & Auto-Appended
              </span>
            </div>

          </div>
        )}

        {/* Save Button */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-400 font-medium">
            Strict never-send rule: Unsubscribed numbers are skipped in all broadcasts.
          </p>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
          >
            {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Settings</span>
          </button>
        </div>

      </div>

      {/* =========================================================================
          SECTION 2: UNSUBSCRIBERS CONTACTS TABLE
          ========================================================================= */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden space-y-4 p-5 sm:p-6">
        
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Unsubscribed Numbers List
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200/60 dark:border-rose-800/40">
              {unsubscribers.length} Opted Out
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone or keyword..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Contact Name</th>
                <th className="py-3 px-4">Opt-Out Date</th>
                <th className="py-3 px-4">Trigger Keyword</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {unsubscribers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <UserX className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-bold text-xs">No Unsubscribed Numbers Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Recipients who reply with "STOP" will be recorded here automatically.
                    </p>
                  </td>
                </tr>
              ) : (
                unsubscribers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      +{item.phone.replace(/\D/g, "")}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {item.name || "Customer"}
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(item.unsubscribedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-mono text-[10px] font-bold border border-rose-200/60 dark:border-rose-800/40">
                        {item.triggerKeyword || "STOP"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {item.source === "AUTO_KEYWORD" ? "🤖 Inbound Reply" : "👤 Manual Add"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setResubscribeTarget(item)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition-colors cursor-pointer border border-emerald-200/60 dark:border-emerald-800/40"
                      >
                        Re-Subscribe
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* =========================================================================
          MODAL: MANUAL ADD UNSUBSCRIBER
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-600" />
                <span>Add Number to Opt-Out List</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="e.g. 919876543210"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Contact Name (Optional)
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Rohit Sharma"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs"
                >
                  {addingLoading ? "Adding..." : "Add to Opt-Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RE-SUBSCRIBE CONFIRMATION
          ========================================================================= */}
      {resubscribeTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Re-Subscribe Contact?
                </h3>
                <p className="text-xs text-slate-500">
                  Allow promotional broadcasts to +{resubscribeTarget.phone}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will remove <strong>+{resubscribeTarget.phone}</strong> from your opt-out blacklist and remove the UNSUBSCRIBED tag from their contact record.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResubscribeTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={resubscribingLoading}
                onClick={handleResubscribe}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                {resubscribingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Re-Subscribe</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
