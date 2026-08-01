"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Send, Pause, Play, CheckCircle2, Clock, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

interface CampaignItem {
  id: string;
  name: string;
  targetAudienceType: string;
  scheduledAt: string;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
}

export default function CampaignsDashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([
    {
      id: "cmp-001",
      name: "August Vision Retest Recall Campaign",
      targetAudienceType: "CRM Tag: DUE_FOR_RETEST",
      scheduledAt: "2026-08-01 10:00 AM",
      status: "PROCESSING",
      totalRecipients: 64,
      sentCount: 42,
      deliveredCount: 38,
      readCount: 29,
      failedCount: 1,
    },
    {
      id: "cmp-002",
      name: "Independence Day Special Offer Flyer",
      targetAudienceType: "CRM Tag: VIP",
      scheduledAt: "2026-07-25 09:30 AM",
      status: "COMPLETED",
      totalRecipients: 42,
      sentCount: 42,
      deliveredCount: 41,
      readCount: 39,
      failedCount: 0,
    },
  ]);

  const handleTogglePause = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "PROCESSING" ? "PAUSED" : "PROCESSING";
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: nextStatus as any } : c))
    );
    toast.success(`Campaign ${nextStatus === "PAUSED" ? "paused" : "resumed"}.`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Broadcast Campaigns
            </h1>
            <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
              BullMQ Queue Active
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Monitor real-time campaign progress, recipient dispatch status, and human throttling rules.
          </p>
        </div>

        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Launch New Campaign</span>
        </Link>
      </div>

      {/* Campaign Cards List */}
      <div className="space-y-4">
        {campaigns.map((cmp) => {
          const progressPercent = Math.round((cmp.sentCount / cmp.totalRecipients) * 100) || 0;

          return (
            <div
              key={cmp.id}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl relative group"
            >
              {/* Card Top Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base tracking-tight">{cmp.name}</h3>
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-sky-300 text-[10px] font-mono border border-slate-700">
                      {cmp.targetAudienceType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Scheduled: {cmp.scheduledAt}</p>
                </div>

                {/* Actions & Status */}
                <div className="flex items-center gap-3">
                  {cmp.status === "PROCESSING" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-sky-500/10 border border-sky-500/20 text-sky-400">
                      <Zap className="w-3 h-3 animate-pulse text-sky-400" />
                      PROCESSING ({progressPercent}%)
                    </span>
                  )}

                  {cmp.status === "PAUSED" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      PAUSED
                    </span>
                  )}

                  {cmp.status === "COMPLETED" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      COMPLETED
                    </span>
                  )}

                  {cmp.status !== "COMPLETED" && (
                    <button
                      onClick={() => handleTogglePause(cmp.id, cmp.status)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border-none cursor-pointer"
                      title={cmp.status === "PROCESSING" ? "Pause Campaign" : "Resume Campaign"}
                    >
                      {cmp.status === "PROCESSING" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Progress ({cmp.sentCount} / {cmp.totalRecipients} Recipient Messages Sent)</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3 pt-2">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Sent</span>
                  <p className="text-sm font-bold text-white">{cmp.sentCount}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Delivered</span>
                  <p className="text-sm font-bold text-emerald-400">{cmp.deliveredCount}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Read</span>
                  <p className="text-sm font-bold text-sky-400">{cmp.readCount}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Failed</span>
                  <p className="text-sm font-bold text-rose-400">{cmp.failedCount}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
