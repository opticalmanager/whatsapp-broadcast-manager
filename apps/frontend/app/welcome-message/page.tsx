"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useRouter } from "next/navigation";
import { 
  Smile, 
  Save, 
  Bot, 
  Clock, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Loader2, 
  ChevronDown, 
  Send, 
  CheckCircle2, 
  RotateCcw,
  Users,
  Smartphone,
  Sparkles,
  Shuffle,
  Info,
  Check
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface WelcomeResponseItem {
  type: "Text" | "Text With Media";
  text: string;
  mediaUrl?: string;
}

interface WelcomeMessageSettings {
  organizationId: string;
  instanceId: string;
  enabled: boolean;
  frequency: "FIRST_TIME_EVER";
  minDelaySec: number;
  maxDelaySec: number;
  excludeFriendlyNumbers: boolean;
  responses: WelcomeResponseItem[];
}

interface WelcomeLogItem {
  id: string;
  phone: string;
  name: string;
  instanceId: string;
  sentAt: string;
  status: "DELIVERED" | "SENT";
}

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  phoneNumber: string | null;
  status: string;
}

export default function WelcomeMessagePage() {
  const router = useRouter();
  const { user, getAuthHeaders, isAuthenticated } = useAuth();
  const backendUrl = getBackendUrl();

  // State
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);

  const [settings, setSettings] = useState<WelcomeMessageSettings>({
    organizationId: user?.organizationId || "",
    instanceId: "ALL",
    enabled: false,
    frequency: "FIRST_TIME_EVER",
    minDelaySec: 1.0,
    maxDelaySec: 3.0,
    excludeFriendlyNumbers: true,
    responses: [
      {
        type: "Text",
        text: "👋 Hello {{name}}! Thank you for contacting us. How can we assist you today?",
      },
    ],
  });

  const [logs, setLogs] = useState<WelcomeLogItem[]>([]);

  // Controlled String State for Pacing
  const [minDelayStr, setMinDelayStr] = useState<string>("1.0");
  const [maxDelayStr, setMaxDelayStr] = useState<string>("3.0");

  // Fetch Settings & Instances
  const fetchData = async (showSpinner = false) => {
    if (!isAuthenticated) return;
    try {
      if (showSpinner) setLoading(true);
      const headers = getAuthHeaders();

      const [instRes, settRes, logsRes] = await Promise.all([
        fetch(backendUrl + "/api/v1/whatsapp-numbers/instances", { headers }),
        fetch(backendUrl + "/api/v1/welcome-message/settings?instanceId=" + selectedInstanceId, { headers }),
        fetch(backendUrl + "/api/v1/welcome-message/logs?instanceId=" + selectedInstanceId, { headers }),
      ]);

      if (instRes.ok) {
        const instJson = await instRes.json();
        if (instJson.success && Array.isArray(instJson.data)) {
          setInstances(instJson.data);
        }
      }

      if (settRes.ok) {
        const settJson = await settRes.json();
        if (settJson.success && settJson.data) {
          setSettings({
            ...settJson.data,
            enabled: settJson.data.enabled === true,
            frequency: "FIRST_TIME_EVER",
            responses:
              settJson.data.responses && settJson.data.responses.length > 0
                ? settJson.data.responses
                : [
                    {
                      type: "Text",
                      text: "👋 Hello {{name}}! Thank you for contacting us. How can we assist you today?",
                    },
                  ],
          });
          setMinDelayStr(String(settJson.data.minDelaySec ?? 1.0));
          setMaxDelayStr(String(settJson.data.maxDelaySec ?? 3.0));
        }
      }

      if (logsRes.ok) {
        const logsJson = await logsRes.json();
        if (logsJson.success && Array.isArray(logsJson.data)) {
          setLogs(logsJson.data);
        }
      }
    } catch {
      toast.error("Failed to load welcome settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [isAuthenticated, selectedInstanceId]);

  // Save Settings
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const minD = Math.max(0.5, parseFloat(minDelayStr) || 1.0);
      const maxD = Math.max(minD, parseFloat(maxDelayStr) || 3.0);

      const payload: Partial<WelcomeMessageSettings> = {
        instanceId: selectedInstanceId,
        enabled: settings.enabled,
        frequency: "FIRST_TIME_EVER",
        minDelaySec: minD,
        maxDelaySec: maxD,
        excludeFriendlyNumbers: settings.excludeFriendlyNumbers,
        responses: settings.responses,
      };

      const res = await fetch(backendUrl + "/api/v1/welcome-message/settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Welcome message settings saved successfully!");
      } else {
        toast.error("Failed to save welcome message settings.");
      }
    } catch {
      toast.error("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  // Reset Logs
  const handleResetHistory = async () => {
    if (!confirm("Are you sure you want to reset the welcome message history?")) return;
    setClearing(true);
    try {
      const res = await fetch(backendUrl + "/api/v1/welcome-message/reset-history", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success("Welcome history reset successfully.");
        setLogs([]);
      } else {
        toast.error("Failed to reset history.");
      }
    } catch {
      toast.error("Network error while resetting history.");
    } finally {
      setClearing(false);
    }
  };

  // Add / Edit Response
  const handleUpdateResponseText = (index: number, text: string) => {
    const next = [...settings.responses];
    next[index] = { ...next[index], text };
    setSettings((prev) => ({ ...prev, responses: next }));
  };

  // Live preview text generator
  const previewText = useMemo(() => {
    const raw = settings.responses[0]?.text || "👋 Hello John! Welcome to our business.";
    return raw
      .replace(/\{([^{}]+)\}/g, (_, opts) => opts.split("|")[0])
      .replace(/\{\{name\}\}/gi, "Rahul Sharma")
      .replace(/\{\{phone\}\}/gi, "+91 98765 43210")
      .replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
      .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"));
  }, [settings.responses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading welcome message engine...</span>
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
            <Smile className="w-5 h-5 text-emerald-600" />
            <span>Automated Welcome Greeting</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Greet completely new customers automatically when they contact your business for the first time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/auto-reply")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Keyword Rules</span>
          </button>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Settings (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Send From Instance Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Send greeting from
            </label>
            <div className="relative">
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-emerald-500 outline-none appearance-none cursor-pointer"
              >
                <option value="ALL">All Connected Numbers (Global)</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.instanceName} ({inst.phoneNumber ? "+" + inst.phoneNumber.replace(/\D/g, "") : "Connecting..."})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Master Engine Switch Card */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className={
                "w-10 h-10 rounded-xl flex items-center justify-center " +
                (settings.enabled
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800")
              }>
                <Smile className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Welcome Greeting Engine
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {settings.enabled
                    ? "Active — automatic welcome greeting will be sent to completely new contacts."
                    : "Paused — welcome greetings are currently disabled."}
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              onClick={() => setSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={
                "w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer " +
                (settings.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")
              }
            >
              <div
                className={
                  "bg-white w-5 h-5 rounded-full shadow-md transform transition-transform " +
                  (settings.enabled ? "translate-x-5" : "translate-x-0")
                }
              />
            </button>
          </div>

          {/* Simple & Clean First-Time-Ever Target Banner */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>First-Time Inquiries Only (Strict Rule)</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Welcome greetings are sent <strong>strictly once</strong> when a brand-new WhatsApp number contacts your business for the first time ever. Returning conversations and existing customers are automatically skipped to avoid repetitive messages.
            </p>
          </div>

          {/* Message Composer Card */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Welcome Message Content
              </h3>
              <span className="text-[10px] text-slate-400">
                Supports Spintax & Dynamic Variables
              </span>
            </div>

            <div className="space-y-2">
              <textarea
                rows={4}
                value={settings.responses[0]?.text || ""}
                onChange={(e) => handleUpdateResponseText(0, e.target.value)}
                placeholder="Type your welcome message..."
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none leading-relaxed font-sans"
              />

              {/* Variable Helper Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Insert:</span>
                <button
                  type="button"
                  onClick={() => handleUpdateResponseText(0, (settings.responses[0]?.text || "") + " {{name}}")}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold cursor-pointer"
                >
                  {"{{name}}"}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateResponseText(0, (settings.responses[0]?.text || "") + " {{phone}}")}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold cursor-pointer"
                >
                  {"{{phone}}"}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateResponseText(0, (settings.responses[0]?.text || "") + " {{time}}")}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold cursor-pointer"
                >
                  {"{{time}}"}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateResponseText(0, "{Hello|Hi|Greetings} " + (settings.responses[0]?.text || ""))}
                  className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Insert Spintax</span>
                </button>
              </div>
            </div>

            {/* Typing Simulation Delay */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Min Delay (sec)</label>
                <input
                  type="number"
                  step="0.5"
                  value={minDelayStr}
                  onChange={(e) => setMinDelayStr(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Max Delay (sec)</label>
                <input
                  type="number"
                  step="0.5"
                  value={maxDelayStr}
                  onChange={(e) => setMaxDelayStr(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Live Mobile Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-100 dark:bg-[#0c1f17] border border-slate-200 dark:border-emerald-900/60 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Live Welcome Message Preview</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">Real-Time</span>
            </div>

            <div className="max-w-xs ml-auto bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3.5 rounded-2xl rounded-tr-xs shadow-xs space-y-2">
              <p className="text-xs whitespace-pre-line leading-relaxed font-normal">
                {previewText}
              </p>
              <div className="flex justify-end text-[9px] text-slate-500 dark:text-slate-300">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION 2: RECENT WELCOMED CONTACTS TABLE (REAL POSTGRESQL DATA)
          ========================================================================= */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recently Welcomed Contacts
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/40">
              {logs.length} Greeted
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetHistory}
            disabled={clearing || logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Greeting History</span>
          </button>
        </div>

        {/* Real Logs Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Sender Device</th>
                <th className="py-3 px-4">Greeted At</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-bold text-xs">No Welcome Greetings Sent Yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      When a new WhatsApp user messages your connected numbers for the first time, they will be greeted and recorded here.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {log.phone.startsWith("+") ? log.phone : "+" + log.phone.replace(/\D/g, "")}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {log.name || "New Contact"}
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {log.instanceId || "Global"}
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(log.sentAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                        {log.status || "DELIVERED"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
