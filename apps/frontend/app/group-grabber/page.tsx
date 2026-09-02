"use client";
import React from "react";
import { UsersRound, Download } from "lucide-react";

export default function GroupGrabberPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 select-none">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Group Grabber</h1>
        <p className="text-xs text-slate-500 mt-0.5">Extract participant contacts from your connected WhatsApp groups</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xs text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
          <UsersRound className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Sync WhatsApp Groups</p>
        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">Link your WhatsApp device in Settings to automatically discover all your customer communities and export member phonebooks to CSV.</p>
      </div>
    </div>
  );
}
