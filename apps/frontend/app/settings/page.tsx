"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { Send, Moon, Globe, Check, Loader2, Sparkles, Flame, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

type ActiveTab = "sending" | "sleep" | "country" | "warmup";

interface SettingsData {
  switchAccountAfter: number;
  sendParallelInstances: boolean;
  minDelaySec: number;
  maxDelaySec: number;
  sleepEnabled: boolean;
  sleepAfterMessages: number;
  sleepForSeconds: number;
  defaultCountryCode: string;
  defaultCountryName: string;
  defaultLanguage: string;
  warmupWeek1Limit: number;
  warmupWeek2Limit: number;
  warmupWeek3Limit: number;
  warmupWeek4Limit: number;
  deliveryWindowEnabled: boolean;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
}

const COUNTRY_OPTIONS = [
  { code: "91", name: "India", label: "[IN] India: +91" },
  { code: "1", name: "United States", label: "[US] United States: +1" },
  { code: "971", name: "United Arab Emirates", label: "[AE] UAE: +971" },
  { code: "44", name: "United Kingdom", label: "[UK] United Kingdom: +44" },
  { code: "966", name: "Saudi Arabia", label: "[SA] Saudi Arabia: +966" },
  { code: "1", name: "Canada", label: "[CA] Canada: +1" },
  { code: "61", name: "Australia", label: "[AU] Australia: +61" },
  { code: "65", name: "Singapore", label: "[SG] Singapore: +65" },
];

const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Spanish", label: "Spanish" },
  { value: "Arabic", label: "Arabic" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const backendUrl = getBackendUrl();

  const [activeTab, setActiveTab] = useState<ActiveTab>("sending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings State with Safe Anti-Ban Defaults
  const [settings, setSettings] = useState<SettingsData>({
    switchAccountAfter: 1,
    sendParallelInstances: true,
    minDelaySec: 50,
    maxDelaySec: 60,
    sleepEnabled: true,
    sleepAfterMessages: 10,
    sleepForSeconds: 60,
    defaultCountryCode: "91",
    defaultCountryName: "India",
    defaultLanguage: "English",
    warmupWeek1Limit: 50,
    warmupWeek2Limit: 150,
    warmupWeek3Limit: 300,
    warmupWeek4Limit: 500,
    deliveryWindowEnabled: true,
    deliveryWindowStart: "10:00",
    deliveryWindowEnd: "19:00",
  });

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("broadcast_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  };

  // Fetch settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch(`${backendUrl}/api/v1/settings`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSettings({
              switchAccountAfter: Number(json.data.switchAccountAfter) || 1,
              sendParallelInstances: json.data.sendParallelInstances !== false,
              minDelaySec: json.data.minDelaySec != null ? Number(json.data.minDelaySec) : 50,
              maxDelaySec: json.data.maxDelaySec != null ? Number(json.data.maxDelaySec) : 60,
              sleepEnabled: json.data.sleepEnabled !== false,
              sleepAfterMessages: json.data.sleepAfterMessages != null ? Number(json.data.sleepAfterMessages) : 10,
              sleepForSeconds: json.data.sleepForSeconds != null ? Number(json.data.sleepForSeconds) : 60,
              defaultCountryCode: json.data.defaultCountryCode || "91",
              defaultCountryName: json.data.defaultCountryName || "India",
              defaultLanguage: json.data.defaultLanguage || "English",
              warmupWeek1Limit: Number(json.data.warmupWeek1Limit) || 50,
              warmupWeek2Limit: Number(json.data.warmupWeek2Limit) || 150,
              warmupWeek3Limit: Number(json.data.warmupWeek3Limit) || 300,
              warmupWeek4Limit: Number(json.data.warmupWeek4Limit) || 500,
              deliveryWindowEnabled: json.data.deliveryWindowEnabled !== false,
              deliveryWindowStart: json.data.deliveryWindowStart || "10:00",
              deliveryWindowEnd: json.data.deliveryWindowEnd || "19:00",
            });
          }
        }
      } catch {
        toast.error("Failed to load settings from server.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [backendUrl]);

  // Save Settings Handler
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${backendUrl}/api/v1/settings`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...settings,
          minDelaySec: Math.max(0, Number(settings.minDelaySec) || 0),
          maxDelaySec: Math.max(Number(settings.minDelaySec) || 0, Number(settings.maxDelaySec) || 0),
          sleepAfterMessages: Math.max(1, Number(settings.sleepAfterMessages) || 10),
          sleepForSeconds: Math.max(0, Number(settings.sleepForSeconds) || 0),
          switchAccountAfter: Math.max(1, Number(settings.switchAccountAfter) || 1),
          warmupWeek1Limit: Math.max(1, Number(settings.warmupWeek1Limit) || 50),
          warmupWeek2Limit: Math.max(1, Number(settings.warmupWeek2Limit) || 150),
          warmupWeek3Limit: Math.max(1, Number(settings.warmupWeek3Limit) || 300),
          warmupWeek4Limit: Math.max(1, Number(settings.warmupWeek4Limit) || 500),
        }),
      });

      if (res.ok) {
        toast.success("Settings saved successfully!");
      } else {
        const err = await res.json().catch(() => ({ message: "Failed to save settings" }));
        toast.error(err.message || "Failed to save settings");
      }
    } catch {
      toast.error("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none pb-12">
      
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white lowercase tracking-tight">
          setting
        </h1>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-2xs space-y-8">
        
        {/* Navigation Tabs Pill Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-xl w-full sm:w-max flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("sending")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "sending"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Sending Message
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sleep")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "sleep"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Sleep Mode
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("country")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "country"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Country & Language
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("warmup")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "warmup"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Smart Warmup</span>
          </button>
        </div>

        {/* Tab 1: Sending Message (Image 1) */}
        {activeTab === "sending" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Top Row: Switch Account After & Send Parallel Messages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              
              {/* Switch Account After */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-rose-500 font-bold">*</span>
                  <span>Switch Account After</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={1}
                    value={settings.switchAccountAfter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        switchAccountAfter: val === "" ? ("" as any) : Number(val),
                      }));
                    }}
                    onBlur={() => {
                      setSettings((prev) => ({
                        ...prev,
                        switchAccountAfter: Math.max(1, Number(prev.switchAccountAfter) || 1),
                      }));
                    }}
                    className="w-28 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl text-xs text-slate-500 font-medium">
                    Messages
                  </div>
                </div>
              </div>

              {/* Send Parallel Messages From Instance */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Send Parallel Messages From Instance
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      sendParallelInstances: !prev.sendParallelInstances,
                    }))
                  }
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    settings.sendParallelInstances
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      settings.sendParallelInstances ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

            </div>

            {/* Delay Between Messages */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Delay Between Messages
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
                
                {/* Between */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span className="text-rose-500 font-bold">*</span>
                    <span>Between</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={1}
                      value={settings.minDelaySec}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          minDelaySec: val === "" ? ("" as any) : Number(val),
                        }));
                      }}
                      onBlur={() => {
                        setSettings((prev) => ({
                          ...prev,
                          minDelaySec: Math.max(0, Number(prev.minDelaySec) || 0),
                        }));
                      }}
                      className="w-28 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl text-xs text-slate-500 font-medium">
                      Seconds
                    </div>
                  </div>
                </div>

                {/* And */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span className="text-rose-500 font-bold">*</span>
                    <span>And</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={settings.minDelaySec}
                      value={settings.maxDelaySec}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          maxDelaySec: val === "" ? ("" as any) : Number(val),
                        }));
                      }}
                      onBlur={() => {
                        setSettings((prev) => ({
                          ...prev,
                          maxDelaySec: Math.max(Number(prev.minDelaySec) || 0, Number(prev.maxDelaySec) || Number(prev.minDelaySec) || 0),
                        }));
                      }}
                      className="w-28 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl text-xs text-slate-500 font-medium">
                      Seconds
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Delivery Time Window / Active Sending Hours */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Delivery Time Window (Active Sending Hours)
                  </h3>

                  {/* Enable Delivery Window Toggle - Kept Close to Title */}
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        deliveryWindowEnabled: !prev.deliveryWindowEnabled,
                      }))
                    }
                    className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                      settings.deliveryWindowEnabled
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        settings.deliveryWindowEnabled ? "translate-x-4.5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Restrict broadcast dispatches to business hours to avoid spam reports and protect account health.
                </p>
              </div>

              {settings.deliveryWindowEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl pt-1">
                  {/* Start Sending At */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span className="text-rose-500 font-bold">*</span>
                      <span>Start Sending At</span>
                    </label>
                    <input
                      type="time"
                      value={settings.deliveryWindowStart}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          deliveryWindowStart: e.target.value || "10:00",
                        }))
                      }
                      className="w-full sm:w-36 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Stop Sending At */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span className="text-rose-500 font-bold">*</span>
                      <span>Stop Sending At</span>
                    </label>
                    <input
                      type="time"
                      value={settings.deliveryWindowEnd}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          deliveryWindowEnd: e.target.value || "19:00",
                        }))
                      }
                      className="w-full sm:w-36 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 max-w-xl">
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                  💡 <strong>Smart Night Pause:</strong> If a broadcast campaign is in progress outside your active delivery hours (e.g. after 7:00 PM), the dispatch engine automatically pauses and resumes next morning at {settings.deliveryWindowStart}, ensuring optimal open rates and preventing user annoyance.
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save</span>
              </button>
            </div>

          </div>
        )}

        {/* Tab 2: Sleep Mode (Image 2) */}
        {activeTab === "sleep" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Sleep Between Sending Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Sleep Between Sending
              </label>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    sleepEnabled: !prev.sleepEnabled,
                  }))
                }
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                  settings.sleepEnabled
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    settings.sleepEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Sleep Parameters: after X messages for Y seconds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
              
              {/* After X Messages */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-rose-500 font-bold">*</span>
                  <span>after</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={1}
                    value={settings.sleepAfterMessages}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          sleepAfterMessages: val === "" ? ("" as any) : Number(val),
                        }));
                      }}
                      onBlur={() => {
                        setSettings((prev) => ({
                          ...prev,
                          sleepAfterMessages: Math.max(1, Number(prev.sleepAfterMessages) || 10),
                        }));
                      }}
                    className="w-28 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl text-xs text-slate-500 font-medium">
                    Messages
                  </div>
                </div>
              </div>

              {/* For Y Seconds */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-rose-500 font-bold">*</span>
                  <span>for</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={1}
                    value={settings.sleepForSeconds}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          sleepForSeconds: val === "" ? ("" as any) : Number(val),
                        }));
                      }}
                      onBlur={() => {
                        setSettings((prev) => ({
                          ...prev,
                          sleepForSeconds: Math.max(0, Number(prev.sleepForSeconds) || 0),
                        }));
                      }}
                    className="w-28 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-xl text-xs text-slate-500 font-medium">
                    Seconds
                  </div>
                </div>
              </div>

            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save</span>
              </button>
            </div>

          </div>
        )}

        {/* Tab 3: Country & Language (Image 3) */}
        {activeTab === "country" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
              
              {/* Default Country */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-rose-500 font-bold">*</span>
                  <span>Default Country</span>
                </label>
                <select
                  value={settings.defaultCountryCode}
                  onChange={(e) => {
                    const opt = COUNTRY_OPTIONS.find((c) => c.code === e.target.value);
                    setSettings((prev) => ({
                      ...prev,
                      defaultCountryCode: e.target.value,
                      defaultCountryName: opt ? opt.name : "India",
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-rose-500 font-bold">*</span>
                  <span>Language</span>
                </label>
                <select
                  value={settings.defaultLanguage}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      defaultLanguage: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Helper Notice */}
            <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 max-w-2xl">
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                💡 <strong>Auto-Prefix Rule:</strong> Whenever dispatching messages, if a recipient number already includes a country code (like +91 or 91), it is preserved. If a 10-digit number is provided, the system will automatically prepend <strong>+{settings.defaultCountryCode}</strong> to ensure accurate WhatsApp delivery.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save</span>
              </button>
            </div>

          </div>
        )}

        {/* Tab 4: Smart Warmup Engine */}
        {activeTab === "warmup" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* Explanatory Banner */}
            <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 max-w-2xl">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Smart 4-Week Anti-Ban Progressive Warmup
                  </h4>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                    Fresh SIM cards & newly paired WhatsApp numbers are protected from spam bans by gradually building trust with WhatsApp servers. Once a fresh number finishes Week 4, it transitions to full 500+/day high-volume maturity.
                  </p>
                </div>
              </div>
            </div>

            {/* Weekly Daily Limits Grid */}
            <div className="space-y-4 max-w-2xl">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Daily Message Caps Per Warmup Stage
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Week 1 */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Week 1 (Days 1–7)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                      Introduction
                    </span>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={settings.warmupWeek1Limit}
                      onChange={(e) => {
                      const val = e.target.value;
                      setSettings((prev) => ({ ...prev, warmupWeek1Limit: val === "" ? ("" as any) : Number(val) }));
                    }}
                    onBlur={() => setSettings((prev) => ({ ...prev, warmupWeek1Limit: Math.max(1, Number(prev.warmupWeek1Limit) || 50) }))}
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl text-xs text-slate-500 font-medium">
                      msgs / day
                    </div>
                  </div>
                </div>

                {/* Week 2 */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Week 2 (Days 8–14)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                      Ramp-Up
                    </span>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={50}
                      max={300}
                      value={settings.warmupWeek2Limit}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          warmupWeek2Limit: Math.max(1, parseInt(e.target.value) || 150),
                        }))
                      }
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl text-xs text-slate-500 font-medium">
                      msgs / day
                    </div>
                  </div>
                </div>

                {/* Week 3 */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Week 3 (Days 15–21)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                      Accelerate
                    </span>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={100}
                      max={500}
                      value={settings.warmupWeek3Limit}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          warmupWeek3Limit: Math.max(1, parseInt(e.target.value) || 300),
                        }))
                      }
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl text-xs text-slate-500 font-medium">
                      msgs / day
                    </div>
                  </div>
                </div>

                {/* Week 4+ */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Week 4+ (Days 22+)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      Full Maturity
                    </span>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={200}
                      max={2000}
                      value={settings.warmupWeek4Limit}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          warmupWeek4Limit: Math.max(1, parseInt(e.target.value) || 500),
                        }))
                      }
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-xl text-xs text-slate-500 font-medium">
                      msgs / day
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Schedule</span>
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
