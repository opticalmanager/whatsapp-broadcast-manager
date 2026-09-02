"use client";

import React from "react";
import Link from "next/link";
import { Bookmark, Plus, Send } from "lucide-react";

export default function SavedAudiencesPage() {
  const savedList = [
    { title: "👑 VIP Customers", count: 2412, type: "Dynamic", updated: "Yesterday" },
    { title: "👓 Frame & Eyewear Buyers", count: 5281, type: "Dynamic", updated: "2 days ago" },
    { title: "🕶 Sunglass Buyers", count: 1842, type: "Dynamic", updated: "3 days ago" },
    { title: "🎂 Birthday This Month", count: 143, type: "Dynamic", updated: "Today" },
    { title: "👁 Prescription Renewal Due", count: 38, type: "Dynamic", updated: "Today" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Saved Audiences</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Quick list of all saved customer target lists.
          </p>
        </div>

        <Link
          href="/audience/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Audience</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {savedList.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-slate-500">{item.count.toLocaleString()} Contacts • Updated {item.updated}</p>
              </div>

              <Link
                href={`/campaigns/new?audience=${encodeURIComponent(item.title)}`}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
              >
                Use in Campaign →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
