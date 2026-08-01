"use client";

import React, { useState } from "react";
import { Settings, Zap, ShieldCheck, Clock, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [minDelay, setMinDelay] = useState(8);
  const [maxDelay, setMaxDelay] = useState(20);
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [dailyQuota, setDailyQuota] = useState(500);
  const [businessStart, setBusinessStart] = useState("09:00");
  const [businessEnd, setBusinessEnd] = useState("20:00");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Human-Engine throttling rules updated successfully!");
    }, 600);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto select-none">
      {/* Top Header */}
      <div className="border-b border-slate-800/80 pb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Sending Rules & Throttling Settings
            </h1>
            <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
              Anti-Spam Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure human behavior simulation, random delay ranges, daily limits, and business hours windows.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-lg shadow-purple-600/20 cursor-pointer border-none"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Settings</span>
        </button>
      </div>

      {/* Settings Form Cards */}
      <div className="space-y-6">
        {/* Card 1: Inter-Message Delays */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Random Inter-Message Delays</h3>
              <p className="text-xs text-slate-400">Injects a randomized pause between message dispatches to mimic human speed.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Minimum Delay (Seconds)
              </label>
              <input
                type="number"
                min={5}
                max={30}
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Maximum Delay (Seconds)
              </label>
              <input
                type="number"
                min={10}
                max={60}
                value={maxDelay}
                onChange={(e) => setMaxDelay(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Business Hours & Daily Caps */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Business Hours & Daily Quota Caps</h3>
              <p className="text-xs text-slate-400">Restricts message sending strictly within store operational hours.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Store Open Time
              </label>
              <input
                type="time"
                value={businessStart}
                onChange={(e) => setBusinessStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Store Close Time
              </label>
              <input
                type="time"
                value={businessEnd}
                onChange={(e) => setBusinessEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Daily Message Limit
              </label>
              <input
                type="number"
                step={50}
                min={100}
                max={2000}
                value={dailyQuota}
                onChange={(e) => setDailyQuota(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
