"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Plus, Send, Zap } from "lucide-react";

export default function SmartSegmentsPage() {
  const smartSegments = [
    { title: "🎂 Birthday This Month", desc: "Auto-syncs customers celebrating birthdays in current month", count: 143 },
    { title: "👁 Prescription Renewal Due", desc: "Auto-syncs customers whose 6-month eye checkup is due", count: 38 },
    { title: "👑 High-Value VIP Buyers", desc: "Customers with lifetime spend > ₹15,000 & 2+ orders", count: 2412 },
    { title: "👓 Progressive Lens Wearers", desc: "Prescription lens buyers using multifocal progressive lenses", count: 920 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Smart Segments</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 uppercase">
              Auto-Syncing
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated dynamic customer segments that continuously sync with CRM data.
          </p>
        </div>

        <Link
          href="/audience/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Segment</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {smartSegments.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Auto Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.desc}</p>
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="font-bold text-slate-900 dark:text-white">{s.count.toLocaleString()} Contacts</span>
              <Link href="/campaigns/new" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                Use in Campaign →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
