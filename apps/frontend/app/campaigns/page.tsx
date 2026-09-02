"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  Pause, 
  Play, 
  Trash2, 
  Loader2, 
  Zap, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCw,
  Send,
  Sparkles,
  BarChart3,
  Layers,
  ChevronRight,
  BarChart2,
  FileText
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import CampaignReportModal from "@/components/campaigns/CampaignReportModal";

interface CampaignItem {
  id: string;
  name: string;
  targetAudienceType?: string;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  scheduledAt?: string;
  messageText?: string;
  mediaUrl?: string;
}

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  status: string;
}

export default function CampaignsDashboardPage() {
  const router = useRouter();
  const { user: authUser, getAuthHeaders, isAuthenticated } = useAuth();
  const backendUrl = getBackendUrl();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [activeFilterTab, setActiveFilterTab] = useState<"All" | "Running" | "Scheduled" | "Completed" | "Failed">("All");
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch Live Campaigns & Instances
  const fetchCampaignData = async (showSpinner = false) => {
    if (!isAuthenticated) return;
    try {
      if (showSpinner) setLoading(true);
      const headers = getAuthHeaders();

      const [campRes, instRes] = await Promise.all([
        fetch(`${backendUrl}/api/v1/campaigns`, { headers }),
        fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances`, { headers })
      ]);

      if (campRes.ok) {
        const campJson = await campRes.json();
        if (campJson.success && Array.isArray(campJson.data)) {
          setCampaigns(campJson.data);
        }
      }

      if (instRes.ok) {
        const instJson = await instRes.json();
        if (instJson.success && Array.isArray(instJson.data)) {
          setInstances(instJson.data);
        }
      }
    } catch {
      // Quiet background polling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData(true);
    // Poll every 3 seconds for live progress
    const interval = setInterval(() => fetchCampaignData(false), 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Top Metrics Calculation (matching Image 2)
  const todaySentCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return campaigns
      .filter((c) => new Date(c.createdAt).toDateString() === todayStr)
      .reduce((sum, c) => sum + (c.sentCount || c.deliveredCount || 0), 0);
  }, [campaigns]);

  const deliveryRate = useMemo(() => {
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
    const totalDelivered = campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
    if (totalSent === 0) return 0;
    return Math.round((totalDelivered / totalSent) * 100);
  }, [campaigns]);

  const activeRunningCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.status === "PROCESSING");
  }, [campaigns]);

  const activeWorkersCount = useMemo(() => {
    return instances.filter((i) => i.status === "CONNECTED").length || 1;
  }, [instances]);

  // Primary active campaign currently sending (for "⚡ Sending now" card)
  const primarySendingCampaign = activeRunningCampaigns[0] || null;

  // Filtered Campaigns for Table
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (activeFilterTab === "All") return true;
      if (activeFilterTab === "Running") return c.status === "PROCESSING";
      if (activeFilterTab === "Scheduled") return c.status === "SCHEDULED";
      if (activeFilterTab === "Completed") return c.status === "COMPLETED";
      if (activeFilterTab === "Failed") return c.status === "FAILED" || c.status === "CANCELLED";
      return true;
    });
  }, [campaigns, activeFilterTab]);

  // Pause Campaign
  const handlePause = async (id: string) => {
    try {
      setActionLoadingId(id);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${id}/pause`, { method: "POST", headers });
      if (res.ok) {
        toast.info("Campaign paused.");
        fetchCampaignData(false);
      }
    } catch {
      toast.error("Failed to pause campaign.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Resume Campaign
  const handleResume = async (id: string) => {
    try {
      setActionLoadingId(id);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${id}/resume`, { method: "POST", headers });
      if (res.ok) {
        toast.success("Campaign resumed.");
        fetchCampaignData(false);
      }
    } catch {
      toast.error("Failed to resume campaign.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Campaign
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      setActionLoadingId(id);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success("Campaign deleted.");
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      toast.error("Failed to delete campaign.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none pb-12">
      
      {/* Top Header matching Image 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        
        {/* Title & Live Status Badges */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Campaigns
            </h1>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold border border-slate-200/80 dark:border-slate-700">
              Today sent: {todaySentCount}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
              Delivery rate: {deliveryRate}%
            </span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
              activeRunningCampaigns.length > 0
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-bold animate-pulse"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700"
            }`}>
              Active: {activeRunningCampaigns.length}
            </span>
          </div>
        </div>

        {/* Top Right Action: + New campaign matching Image 2 */}
        <button
          onClick={() => router.push("/send-message")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New campaign</span>
        </button>
      </div>

      {/* =========================================================================
          ACTIVE "⚡ Sending now" CARD (matching Image 2)
          ========================================================================= */}
      {primarySendingCampaign && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Zap className="w-3 h-3 fill-current" />
            </span>
            <span>Sending now</span>
          </div>

          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {primarySendingCampaign.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                    Running
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Sent: {primarySendingCampaign.sentCount || primarySendingCampaign.deliveredCount || 0} · Failed: {primarySendingCampaign.failedCount || 0} / {primarySendingCampaign.totalRecipients} · Workers: {activeWorkersCount}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/campaigns/${primarySendingCampaign.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>View Report</span>
                </button>

                {/* Pause Action */}
                <button
                  onClick={() => handlePause(primarySendingCampaign.id)}
                  disabled={actionLoadingId === primarySendingCampaign.id}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Pause Broadcast"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-200 dark:bg-indigo-700 transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (((primarySendingCampaign.sentCount || 0) + (primarySendingCampaign.failedCount || 0)) /
                          Math.max(primarySendingCampaign.totalRecipients, 1)) *
                          100
                      )
                    )}%`
                  }}
                />
              </div>

              <div className="flex justify-start text-[11px] font-mono text-slate-400">
                {(primarySendingCampaign.sentCount || 0) + (primarySendingCampaign.failedCount || 0)} / {primarySendingCampaign.totalRecipients}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CAMPAIGNS TABLE & FILTER TABS (matching Image 2)
          ========================================================================= */}
      <div className="space-y-4">
        
        {/* Filter Tabs Bar matching Image 2 */}
        <div className="flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold">
          {(["All", "Running", "Scheduled", "Completed", "Failed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilterTab(tab)}
              className={`pb-2.5 transition-all cursor-pointer relative ${
                activeFilterTab === tab
                  ? "text-emerald-700 dark:text-emerald-400 font-extrabold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold"
              }`}
            >
              <span>{tab}</span>
              {activeFilterTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Table / Empty State Container */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          
          /* Clean & Better UI Empty State when no campaigns exist */
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center shadow-2xs space-y-4 max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
              <Send className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                No campaigns created yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Create your first broadcast campaign to send personalized WhatsApp messages with smart number warmup.
              </p>
            </div>
            <button
              onClick={() => router.push("/send-message")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Campaign</span>
            </button>
          </div>

        ) : filteredCampaigns.length === 0 ? (
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-12 text-center text-xs text-slate-400">
            No {activeFilterTab.toLowerCase()} campaigns found.
          </div>
        ) : (
          
          /* Campaigns Table matching Image 2 */
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-5">NAME</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">PROGRESS</th>
                  <th className="py-3 px-4">CREATED</th>
                  <th className="py-3 px-5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCampaigns.map((camp) => {
                  const progressRatio = `${(camp.sentCount || 0) + (camp.failedCount || 0)} / ${camp.totalRecipients}`;
                  const progressPct = Math.min(
                    100,
                    Math.round(
                      (((camp.sentCount || 0) + (camp.failedCount || 0)) / Math.max(camp.totalRecipients, 1)) * 100
                    )
                  );

                  return (
                    <tr key={camp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                      
                      {/* Name */}
                      <td className="py-3.5 px-5 font-bold text-slate-800 dark:text-white">
                        <button
                          onClick={() => router.push(`/campaigns/${camp.id}`)}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline text-left cursor-pointer font-bold block"
                        >
                          {camp.name}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {camp.status === "PROCESSING" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                            Running
                          </span>
                        ) : camp.status === "SCHEDULED" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                            Scheduled
                          </span>
                        ) : camp.status === "COMPLETED" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold">
                            Completed
                          </span>
                        ) : camp.status === "PAUSED" ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
                            Paused
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Progress */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 min-w-[130px] max-w-[180px]">
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-200 dark:bg-indigo-700 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {progressRatio}
                          </span>
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-medium">
                        {new Date(camp.createdAt).toLocaleString("en-US", {
                          month: "numeric",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/campaigns/${camp.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="View Campaign Report"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Report</span>
                          </button>

                          {camp.status === "PROCESSING" && (
                            <button
                              onClick={() => handlePause(camp.id)}
                              className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                              title="Pause"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {camp.status === "PAUSED" && (
                            <button
                              onClick={() => handleResume(camp.id)}
                              className="p-1 text-slate-400 hover:text-emerald-600 cursor-pointer"
                              title="Resume"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(camp.id)}
                            disabled={actionLoadingId === camp.id}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        )}

      </div>

    </div>
  );
}
