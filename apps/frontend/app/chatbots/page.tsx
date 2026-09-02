"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useRouter } from "next/navigation";
import { 
  Bot, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowLeft, 
  Save, 
  X, 
  ShieldCheck, 
  Scissors, 
  Loader2, 
  ChevronDown,
  MessageSquare,
  Smile
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface AutoReplyResponseItem {
  type: "Text" | "Text With Media" | "Button" | "Poll";
  text: string;
  mediaUrl?: string;
}

interface AutoReplyRule {
  id: string;
  organizationId: string;
  instanceId?: string;
  matchType: "Contains" | "Exact match" | "Starts with" | "Ends with" | "Regex (Pattern)";
  keyword: string;
  responses: AutoReplyResponseItem[];
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AutoReplySettings {
  organizationId: string;
  instanceId: string;
  botEngineEnabled: boolean;
  minDelaySec: number;
  maxDelaySec: number;
  friendlyNumbers: string[];
}

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  phoneNumber: string | null;
  status: string;
}

export default function AutoReplyKeyMarkerPage() {
  const router = useRouter();
  const { user, getAuthHeaders, isAuthenticated } = useAuth();
  const backendUrl = getBackendUrl();

  // Data State
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("ALL");
  const [settings, setSettings] = useState<AutoReplySettings>({
    organizationId: "org-demo",
    instanceId: "ALL",
    botEngineEnabled: true,
    minDelaySec: 0.8,
    maxDelaySec: 2.2,
    friendlyNumbers: [],
  });
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Controlled String State for Pacing Inputs (prevents backspacing 0 issue)
  const [minDelayStr, setMinDelayStr] = useState<string>("0.8");
  const [maxDelayStr, setMaxDelayStr] = useState<string>("2.2");

  // Friendly number input
  const [friendlyInput, setFriendlyInput] = useState<string>("" );
  const [addingFriendly, setAddingFriendly] = useState<boolean>(false);

  // View Mode: "DASHBOARD" vs "RULE_FORM"
  const [viewMode, setViewMode] = useState<"DASHBOARD" | "RULE_FORM">("DASHBOARD");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Rule Form State
  const [formMatchType, setFormMatchType] = useState<AutoReplyRule["matchType"]>("Contains");
  const [formKeyword, setFormKeyword] = useState<string>("");
  const [formResponses, setFormResponses] = useState<AutoReplyResponseItem[]>([
    { type: "Text", text: "" }
  ]);
  const [formEnabled, setFormEnabled] = useState<boolean>(true);
  const [formSaving, setFormSaving] = useState<boolean>(false);

  // 1. Fetch Instances, Settings & Rules
  const fetchData = async (showSpinner = false) => {
    if (!isAuthenticated) return;
    try {
      if (showSpinner) setLoading(true);
      const headers = getAuthHeaders();

      const [instRes, settRes, rulesRes] = await Promise.all([
        fetch(backendUrl + "/api/v1/whatsapp-numbers/instances", { headers }),
        fetch(backendUrl + "/api/v1/auto-reply/settings?instanceId=" + selectedInstanceId, { headers }),
        fetch(backendUrl + "/api/v1/auto-reply/rules?instanceId=" + selectedInstanceId, { headers }),
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
          setSettings(settJson.data);
          setMinDelayStr(String(settJson.data.minDelaySec ?? 0.8));
          setMaxDelayStr(String(settJson.data.maxDelaySec ?? 2.2));
        }
      }

      if (rulesRes.ok) {
        const rulesJson = await rulesRes.json();
        if (rulesJson.success && Array.isArray(rulesJson.data)) {
          setRules(rulesJson.data);
        }
      }
    } catch {
      // Quiet failover
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [isAuthenticated, selectedInstanceId]);

  // 2. Toggle Bot Engine
  const handleToggleBotEngine = async () => {
    const nextState = !settings.botEngineEnabled;
    setSettings((prev) => ({ ...prev, botEngineEnabled: nextState }));
    try {
      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/auto-reply/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          botEngineEnabled: nextState,
          minDelaySec: parseFloat(minDelayStr) || 0.8,
          maxDelaySec: parseFloat(maxDelayStr) || 2.2,
        }),
      });
      if (res.ok) {
        toast.success(nextState ? "Bot Engine activated! Rules will auto-reply." : "Bot Engine turned OFF.");
      }
    } catch {
      toast.error("Failed to update bot engine.");
    }
  };

  // 3. Save Pacing Delays
  const handleSavePacing = async () => {
    setSavingSettings(true);
    try {
      const minD = Math.max(0.2, parseFloat(minDelayStr) || 0.8);
      const maxD = Math.max(minD, parseFloat(maxDelayStr) || 2.2);

      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/auto-reply/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          botEngineEnabled: settings.botEngineEnabled,
          minDelaySec: minD,
          maxDelaySec: maxD,
        }),
      });

      if (res.ok) {
        toast.success("Reply pacing settings saved!");
        setSettings((prev) => ({ ...prev, minDelaySec: minD, maxDelaySec: maxD }));
      }
    } catch {
      toast.error("Failed to save pacing settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // 4. Friendly Numbers Management
  const handleAddFriendlyNumber = async () => {
    if (!friendlyInput.trim()) return;
    setAddingFriendly(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/auto-reply/friendly-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ phone: friendlyInput.trim(), instanceId: selectedInstanceId }),
      });
      if (res.ok) {
        const json = await res.json();
        setSettings((prev) => ({ ...prev, friendlyNumbers: json.data || [] }));
        setFriendlyInput("");
        toast.success("Number added to friendly whitelist.");
      }
    } catch {
      toast.error("Failed to add friendly number.");
    } finally {
      setAddingFriendly(false);
    }
  };

  const handleRemoveFriendlyNumber = async (phone: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/auto-reply/friendly-numbers?phone=" + encodeURIComponent(phone) + "&instanceId=" + selectedInstanceId, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        setSettings((prev) => ({ ...prev, friendlyNumbers: json.data || [] }));
        toast.info("Removed from friendly whitelist.");
      }
    } catch {
      toast.error("Failed to remove friendly number.");
    }
  };

  // 5. Open Rule Form (New or Edit)
  const handleOpenNewRule = () => {
    setEditingRuleId(null);
    setFormMatchType("Contains");
    setFormKeyword("");
    setFormResponses([{ type: "Text", text: "" }]);
    setFormEnabled(true);
    setViewMode("RULE_FORM");
  };

  const handleOpenEditRule = (rule: AutoReplyRule) => {
    setEditingRuleId(rule.id);
    setFormMatchType(rule.matchType || "Contains");
    setFormKeyword(rule.keyword || "");
    setFormResponses(
      rule.responses && rule.responses.length > 0 ? rule.responses : [{ type: "Text", text: "" }]
    );
    setFormEnabled(rule.enabled !== false);
    setViewMode("RULE_FORM");
  };

  // 6. Save Rule (Create or Update)
  const handleSaveRule = async () => {
    if (!formKeyword.trim()) {
      toast.error("Please enter a keyword or pattern.");
      return;
    }

    if (!formResponses[0]?.text?.trim() && !formResponses[0]?.mediaUrl) {
      toast.error("Please enter a response message.");
      return;
    }

    setFormSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = {
        instanceId: selectedInstanceId,
        matchType: formMatchType,
        keyword: formKeyword.trim(),
        responses: formResponses,
        enabled: formEnabled,
      };

      let res;
      if (editingRuleId) {
        res = await fetch(backendUrl + "/api/v1/auto-reply/rules/" + editingRuleId, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(backendUrl + "/api/v1/auto-reply/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const json = await res.json();
        const savedRule = json.data;
        if (savedRule) {
          setRules((prev) => {
            if (editingRuleId) {
              return prev.map((r) => (r.id === editingRuleId ? savedRule : r));
            } else {
              return [savedRule, ...prev];
            }
          });
        }
        toast.success(editingRuleId ? "Rule updated successfully!" : "New auto-reply rule created!");
        setViewMode("DASHBOARD");
        fetchData(false);
      } else {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson.message || "Failed to save rule from server.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save rule. Please check connection.");
    } finally {
      setFormSaving(false);
    }
  };

  // 7. Delete Rule
  const handleDeleteRule = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to remove this rule?")) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/auto-reply/rules/" + id, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        toast.success("Rule removed.");
      }
    } catch {
      toast.error("Failed to delete rule.");
    }
  };

  // Quick Tools for Message Box
  const insertFormVariable = (respIdx: number, tag: string) => {
    setFormResponses((prev) => {
      const updated = [...prev];
      updated[respIdx] = {
        ...updated[respIdx],
        text: (updated[respIdx].text || "") + " " + tag + " "
      };
      return updated;
    });
  };

  const insertFormSpintax = (respIdx: number) => {
    setFormResponses((prev) => {
      const updated = [...prev];
      updated[respIdx] = {
        ...updated[respIdx],
        text: (updated[respIdx].text || "") + " {Hi|Hello|Namaste} "
      };
      return updated;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 select-none animate-in fade-in duration-300">
      
      {/* =========================================================================
          VIEW A: DASHBOARD VIEW (Matching Images 1 & 2)
          ========================================================================= */}
      {viewMode === "DASHBOARD" && (
        <div className="space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Auto-reply / KeyMarker
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create chatbot rules: when a message matches the trigger, the bot sends the reply automatically.
              </p>
            </div>

            <button
              onClick={() => router.push("/welcome-message")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <Smile className="w-3.5 h-3.5 text-emerald-600" />
              <span>👋 Setup Welcome Message</span>
            </button>
          </div>

          {/* Send From Instance Selector */}
          <div className="space-y-1.5 max-w-sm">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Send from
            </label>
            <div className="relative">
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-emerald-500 outline-hidden appearance-none cursor-pointer"
              >
                <option value="ALL">All Connected Numbers (Global)</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.instanceName} ({inst.phoneNumber || "Connecting..."})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Master Bot Engine Switch Card */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className={
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " +
                (settings.botEngineEnabled
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800")
              }>
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Bot Engine
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {settings.botEngineEnabled
                    ? "On — enabled rules will run on this account."
                    : "Off — no rules reply until you turn the engine on."}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={handleToggleBotEngine}
              className={
                "w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 self-end sm:self-auto " +
                (settings.botEngineEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700")
              }
            >
              <div
                className={
                  "bg-white w-4 h-4 rounded-full shadow-md transform transition-transform " +
                  (settings.botEngineEnabled ? "translate-x-6" : "translate-x-0")
                }
              />
            </button>
          </div>

          {/* Chatbot Reply Pacing Card */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 w-full max-w-xl">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Chatbot reply pacing
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Delay before and between multi-step bot replies (seconds). Makes auto-replies feel more human.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Min delay (sec)
                </label>
                <input
                  type="text"
                  value={minDelayStr}
                  onChange={(e) => setMinDelayStr(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.8"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Max delay (sec)
                </label>
                <input
                  type="text"
                  value={maxDelayStr}
                  onChange={(e) => setMaxDelayStr(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="2.2"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleSavePacing}
              disabled={savingSettings}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Pacing</span>
            </button>
          </div>

          {/* Bot Rules Section (Matching Image 1 & 2) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Bot Rules
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Click a rule to edit. Use Save in the form to persist changes.
                </p>
              </div>

              <button
                onClick={handleOpenNewRule}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New rule</span>
              </button>
            </div>

            {/* Rules List or Empty State */}
            {loading ? (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                <p className="text-xs text-slate-400">Loading rules...</p>
              </div>
            ) : rules.length === 0 ? (
              
              /* Empty State (Matching Image 1) */
              <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-12 text-center shadow-2xs space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    No rules yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                    Create your first rule: pick a trigger (keyword), write the reply, then tap Save.
                  </p>
                </div>
                <button
                  onClick={handleOpenNewRule}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New rule</span>
                </button>
              </div>

            ) : (

              /* Active Rules List with Full Mobile Responsiveness */
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    onClick={() => handleOpenEditRule(rule)}
                    className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white break-all">
                            {rule.keyword}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold border border-slate-200/80 dark:border-slate-700 shrink-0">
                            {rule.matchType}
                          </span>
                          <span className={
                            "px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 " +
                            (rule.enabled
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800")
                          }>
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 sm:line-clamp-1 break-words">
                          {rule.responses?.[0]?.text || "Media / Interactive reply"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 w-full sm:w-auto justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditRule(rule);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteRule(rule.id, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            )}
          </div>

          {/* Friendly Numbers Section (Matching Image 2) */}
          <div className="space-y-3 pt-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                Friendly Numbers
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Numbers on this list are completely ignored by the bot — it never replies to them. Useful for known contacts you don't want the bot to answer.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-md">
              <input
                type="text"
                value={friendlyInput}
                onChange={(e) => setFriendlyInput(e.target.value)}
                placeholder="Phone number or JID"
                className="w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
              <button
                onClick={handleAddFriendlyNumber}
                disabled={addingFriendly || !friendlyInput.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Add Number</span>
              </button>
            </div>

            {/* Friendly Numbers List */}
            {settings.friendlyNumbers?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No friendly numbers yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {settings.friendlyNumbers.map((phone) => (
                  <span
                    key={phone}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    <span>{phone}</span>
                    <button
                      onClick={() => handleRemoveFriendlyNumber(phone)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW B: NEW RULE / EDIT RULE FORM (Matching Image 3)
          ========================================================================= */}
      {viewMode === "RULE_FORM" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Bar matching Image 3 */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("DASHBOARD")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingRuleId ? "Edit rule" : "New rule"}
                </h1>
                <p className="text-[11px] text-slate-400">
                  Fill in the trigger and reply. Nothing is stored until you click Save.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("DASHBOARD")}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={formSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                {formSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
            
            {/* 1. TRIGGER — WHEN TO REPLY */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                1. Trigger — When to reply
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Match type
                  </label>
                  <div className="relative">
                    <select
                      value={formMatchType}
                      onChange={(e) => setFormMatchType(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                    >
                      <option value="Contains">Contains</option>
                      <option value="Exact match">Exact match</option>
                      <option value="Starts with">Starts with</option>
                      <option value="Ends with">Ends with</option>
                      <option value="Regex (Pattern)">Regex (Pattern)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Keyword / pattern
                  </label>
                  <input
                    type="text"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                    placeholder="e.g. price, appointment, eye testing"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                The contact's message must match this trigger for the rule to fire.
              </p>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* 2. RESPONSE — WHAT TO SEND */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                2. Response — What to send
              </h3>

              {formResponses.map((resp, respIdx) => (
                <div key={respIdx} className="space-y-3 bg-slate-50/70 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  
                  {/* Top row: Response # & Type */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-500 uppercase">
                        Response {respIdx + 1}
                      </span>
                      <select
                        value={resp.type}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setFormResponses((prev) => {
                            const updated = [...prev];
                            updated[respIdx] = { ...updated[respIdx], type: val };
                            return updated;
                          });
                        }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="Text">Text</option>
                        <option value="Text With Media">Text With Media</option>
                        <option value="Button">Button</option>
                        <option value="Poll">Poll</option>
                      </select>
                    </div>

                    {/* Quick Tools */}
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => insertFormVariable(respIdx, "{{name}}")}
                        className="text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-mono text-[11px] cursor-pointer"
                        title="Insert Customer Name"
                      >
                        &#123; &#125; &#123;&#123;name&#125;&#125;
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormVariable(respIdx, "{{phone}}")}
                        className="text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-mono text-[11px] cursor-pointer"
                        title="Insert Customer Phone"
                      >
                        &#123;&#123;phone&#125;&#125;
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormSpintax(respIdx)}
                        className="text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1 text-[11px] cursor-pointer"
                        title="Insert Spintax Variation"
                      >
                        <Scissors className="w-3 h-3" />
                        <span>Spintax</span>
                      </button>
                    </div>
                  </div>

                  {/* Message Textarea */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      MESSAGE
                    </label>
                    <textarea
                      rows={4}
                      value={resp.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormResponses((prev) => {
                          const updated = [...prev];
                          updated[respIdx] = { ...updated[respIdx], text: val };
                          return updated;
                        });
                      }}
                      placeholder="Your pricing list or automated reply message here!"
                      className="w-full bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500 resize-y font-sans"
                    />
                  </div>

                </div>
              ))}

              {/* + Add Response Button for Multi-Step Sequence */}
              <button
                type="button"
                onClick={() => setFormResponses((prev) => [...prev, { type: "Text", text: "" }])}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer pt-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add response</span>
              </button>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* 3. STATUS */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                3. Status
              </h3>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Enabled
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Disabled rules never fire, even if the engine is on.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFormEnabled(!formEnabled)}
                  className={
                    "w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer " +
                    (formEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700")
                  }
                >
                  <div
                    className={
                      "bg-white w-4 h-4 rounded-full shadow-md transform transition-transform " +
                      (formEnabled ? "translate-x-6" : "translate-x-0")
                    }
                  />
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setViewMode("DASHBOARD")}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={formSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                {formSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
