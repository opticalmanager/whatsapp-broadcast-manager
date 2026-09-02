"use client";

import React from "react";
import Link from "next/link";
import { 
  Wrench, 
  UsersRound, 
  Filter, 
  Bot, 
  UserX, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  FileSpreadsheet,
  Download
} from "lucide-react";

export default function ToolsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto select-none pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-600" />
            <span>Tools & Utilities Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Specialized productivity, group parsing, and audience validation utilities for WhatsApp broadcast operations.
          </p>
        </div>
      </div>

      {/* Grid of Tools Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* CARD 1: GROUP GRABBER (COMING SOON) */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden group">
          
          {/* Subtle Top Gradient Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500" />

          <div className="space-y-4">
            
            {/* Header with Icon + Coming Soon Pill */}
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <UsersRound className="w-6 h-6" />
              </div>

              <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-bold border border-amber-200/80 dark:border-amber-800/60 flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>Coming Soon</span>
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                WhatsApp Group Grabber
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Extract all active participant phone numbers and contact details directly from any WhatsApp group you have joined. Export into formatted CSV files or sync directly into Audience Segments for targeted marketing.
              </p>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                ⚡ Auto Participant Extraction
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                📥 1-Click CSV Export
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                👥 Audience Sync
              </span>
            </div>

          </div>

          {/* Bottom Status Banner */}
          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
              <span>🚀</span>
              <span>Feature currently in development</span>
            </span>

            <button
              disabled
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed opacity-75"
            >
              Coming Soon
            </button>
          </div>

        </div>

        {/* CARD 2: WHATSAPP NUMBER FILTER & CLEANER */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden group">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <Filter className="w-6 h-6" />
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Tool</span>
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                Number Filter & Normalizer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Clean customer phone number spreadsheets, deduplicate records, automatically prepend country dial codes (e.g. +91), and validate 10–15 digit WhatsApp phone numbers prior to broadcast dispatch.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                ⚡ Auto-Prepend Dial Code
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                ✂️ Instant Deduplication
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                📊 Format Verification
              </span>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              Ready to process contacts
            </span>

            <Link
              href="/number-filter"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>Open Tool</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

        {/* CARD 3: AUTO-REPLY BOT ENGINE */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden group">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <Bot className="w-6 h-6" />
              </div>

              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-200/80 dark:border-blue-800/60 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Tool</span>
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                Auto-Reply & Chatbot Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Configure smart keyword-matching auto-responders, multi-variation anti-ban Spintax replies, and human typing simulations to automatically assist incoming customer queries 24/7.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                🤖 Keyword Matching
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                ⏱️ Human Typing Delays
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                🔒 Friendly Whitelist
              </span>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold">
              Live automated responses
            </span>

            <Link
              href="/auto-reply"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>Open Tool</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

        {/* CARD 4: ANTI-BAN UNSUBSCRIBERS & COMPLIANCE ENGINE */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden group">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500" />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                <UserX className="w-6 h-6" />
              </div>

              <span className="px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200/80 dark:border-rose-800/60 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Tool</span>
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                Unsubscribers & Opt-Out Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Manage opt-out disclaimers, listen for inbound STOP keywords, and enforce a strict never-send safeguard across all broadcast campaigns to prevent permanent WhatsApp account bans.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                🛡️ Strict Never-Send Rule
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                🛑 STOP Inbound Listener
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                📋 Blacklist Sync
              </span>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
              Full compliance active
            </span>

            <Link
              href="/unsubscribers"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>Open Tool</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
