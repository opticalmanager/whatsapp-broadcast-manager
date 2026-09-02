"use client";

import React from "react";
import { Download, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Analytics & Performance</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Delivery rates, customer read performance, and campaign metrics.
          </p>
        </div>

        <button
          onClick={() => toast.success("Analytics CSV report exported successfully!")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-semibold text-xs transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-indigo-500" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Sent</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">1,420</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Dispatched</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Delivery Rate</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">98.6%</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Delivered</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Read Rate</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">84.2%</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Opened</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Avg Speed</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">12.4s</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Spacing</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Peak Dispatch Hours</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Optimal delivery times for highest read rates.</p>
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center space-y-1.5">
            <Calendar className="w-6 h-6 text-indigo-500 mx-auto" />
            <p className="text-xs font-bold text-slate-900 dark:text-white">Peak Engagement: 11:00 AM - 2:00 PM</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Noon dispatches achieve 89% read rates.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">Delivery Diagnostics</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Breakdown of delivery status across contacts.</p>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-600 dark:text-slate-300">Delivered & Read:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">1,195 (84.2%)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-600 dark:text-slate-300">Delivered Unread:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">205 (14.4%)</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-slate-600 dark:text-slate-300">Failed / Invalid Phone:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">20 (1.4%)</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
