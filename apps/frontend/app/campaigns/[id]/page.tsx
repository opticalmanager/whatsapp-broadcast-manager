"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { normalizePublicMediaUrl } from "@/lib/media-url-utils";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  MessageSquare, 
  Send, 
  Clock, 
  Pause, 
  XCircle, 
  AlertTriangle, 
  UserX, 
  ShieldAlert, 
  CheckCircle2, 
  Eye, 
  Vote, 
  BarChart2, 
  MessageCircle, 
  Download, 
  Search, 
  Filter, 
  Loader2, 
  RefreshCw,
  Sparkles,
  Phone,
  Check,
  RotateCw,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { CampaignChatWizard } from "@/components/campaigns/CampaignChatWizard";

export interface RecipientReportItem {
  id: string;
  phone: string;
  name: string;
  senderInstance?: string;
  instanceName?: string;
  instanceNumber?: string;
  messageType: "Text" | "Poll" | "Button" | "List/Menu" | "Text With Media" | string;
  messageText: string;
  previewWidget: {
    type: string;
    pollQuestion?: string;
    pollOptions?: string[];
    buttons?: Array<{ id: string; displayText?: string; text?: string; type?: string }>;
    menuData?: { buttonText?: string; sectionTitle?: string; items?: Array<{ id: string; title: string; description?: string }> };
    mediaUrl?: string;
  };
  status: "SENT" | "DELIVERED" | "READ" | "PENDING" | "PAUSED" | "CANCELLED" | "FAILED" | "INVALID_NUMBER" | "NON_WHATSAPP" | string;
  failureCategory?: string;
  failureReason?: string;
  pollVote?: string | null;
  pollVotedAt?: string | null;
  replyText?: string | null;
  repliedAt?: string | null;
  buttonClicked?: string | null;
  buttonClickedAt?: string | null;
  listItemSelected?: string | null;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
}

export interface PollAnalytics {
  isPoll: boolean;
  question: string;
  totalVotes: number;
  options: Array<{ text: string; votes: number; percentage: number }>;
  voters: Array<{ name: string; phone: string; option: string; votedAt: string }>;
}

export interface CustomerReplyItem {
  id: string;
  phone: string;
  name: string;
  text: string;
  receivedAt: string;
}

export interface CampaignReportData {
  campaign: {
    id: string;
    name: string;
    status: string;
    scheduledAt?: string;
    createdAt: string;
    messageText?: string;
    mediaUrl?: string;
    contentType?: string;
    targetAudienceType?: string;
    audienceNames?: string[];
  };
  kpis: {
    totalMessages: number;
    sentCount: number;
    pendingCount: number;
    pausedCount: number;
    cancelledCount: number;
    failedCount: number;
    invalidNumberCount: number;
    nonWhatsappCount: number;
    deliveredCount: number;
    readCount: number;
    deliveredRate: number;
    readRate: number;
    replyRate: number;
    voteRate?: number;
  };
  recipients: RecipientReportItem[];
  pollAnalytics: PollAnalytics;
  buttonAnalytics?: {
    hasButtons: boolean;
    totalClicks: number;
    buttons: Array<{ id: string; type: string; displayText: string; clicks: number; clickRate: number }>;
  };
  listAnalytics?: {
    hasList: boolean;
    totalSelections: number;
    sectionTitle: string;
    items: Array<{ id: string; title: string; description: string; selections: number; selectionRate: number }>;
  };
  replies: CustomerReplyItem[];
}

export default function CampaignReportFullPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = (params.id as string) || "";
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const backendUrl = getBackendUrl();

  const [activeTab, setActiveTab] = useState<"SENDING_REPORT" | "CAMPAIGN_REPORT">("SENDING_REPORT");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CampaignReportData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [addingList, setAddingList] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Resume / Retry all disconnected recipients
  const handleRetryDisconnected = async () => {
    setRetryingId("DISCONNECTED");
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${campaignId}/retry-disconnected`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Resumed campaign dispatch across connected devices!");
        fetchReport(false);
      } else {
        toast.error(json.message || "Failed to resume campaign. Ensure at least 1 WhatsApp device is connected.");
      }
    } catch {
      toast.error("Network error while resuming campaign.");
    } finally {
      setRetryingId(null);
    }
  };

  // Retry Failed Recipient
  const handleRetryRecipient = async (recipientId: string, phone: string) => {
    setRetryingId(recipientId);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${campaignId}/retry-recipient/${recipientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Message resent to ${phone}!`);
        fetchReport(false);
      } else {
        toast.error(json.message || json.error || `Retry failed for ${phone}.`);
      }
    } catch {
      toast.error("Network error while retrying message.");
    } finally {
      setRetryingId(null);
    }
  };

  // Bulk Retry All Failed
  const handleRetryAllFailed = async () => {
    setRetryingId("ALL");
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${campaignId}/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "All failed messages retried!");
        fetchReport(false);
      } else {
        toast.error(json.message || "Bulk retry failed.");
      }
    } catch {
      toast.error("Network error retrying failed messages.");
    } finally {
      setRetryingId(null);
    }
  };

  // Fetch 100% Genuine Report Data
  const fetchReport = async (isInitial = false) => {
    if (!campaignId) return;
    try {
      if (isInitial) setLoading(true);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${campaignId}/report`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData((prev) => {
            if (!prev || prev.campaign?.id !== json.data?.campaign?.id) return json.data;
            if (
              prev.kpis.sentCount === json.data.kpis.sentCount &&
              prev.kpis.deliveredCount === json.data.kpis.deliveredCount &&
              prev.kpis.readCount === json.data.kpis.readCount &&
              prev.kpis.replyRate === json.data.kpis.replyRate &&
              prev.campaign.status === json.data.campaign.status &&
              prev.recipients.length === json.data.recipients.length &&
              (prev.replies?.length || 0) === (json.data.replies?.length || 0)
            ) {
              return prev;
            }
            return json.data;
          });
        }
      } else if (isInitial) {
        toast.error("Campaign report not found.");
      }
    } catch {
      if (isInitial) toast.error("Failed to load campaign report.");
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    setLoading(true);
    fetchReport(true);

    // Poll periodically for live status updates
    const interval = setInterval(() => {
      fetchReport(false);
    }, 2500);
    return () => clearInterval(interval);
  }, [campaignId]);

  // Actions
  const handleAddToSenderList = async (filterType: "ALL" | "FAILED" = "ALL") => {
    setAddingList(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/campaigns/${campaignId}/add-to-sender-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ filterType }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(json.message || "Audience updated successfully!");
      }
    } catch {
      toast.error("Failed to add to sender list.");
    } finally {
      setAddingList(false);
    }
  };

  const handleExportCsv = () => {
    if (!data || !data.recipients || data.recipients.length === 0) {
      toast.error("No recipient data to export.");
      return;
    }
    const headers = ["Phone", "Name", "Instance", "Sender Number", "Message Type", "Status", "Reason", "Created At", "Sent At"];
    const rows = data.recipients.map((r) => [
      r.phone,
      r.name,
      r.instanceName,
      r.instanceNumber,
      r.messageType,
      r.status,
      r.failureReason || "",
      r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
      r.sentAt ? new Date(r.sentAt).toLocaleString() : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `campaign_${campaignId}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Campaign CSV report downloaded!");
  };

  // Filtered Recipients
  const filteredRecipients = useMemo(() => {
    if (!data) return [];
    return data.recipients.filter((r) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "SENT" && !["SENT", "DELIVERED", "READ"].includes(r.status)) return false;
        if (statusFilter === "PENDING" && r.status !== "PENDING" && r.status !== "QUEUED" && r.status !== "SENDING") return false;
        if (statusFilter === "PAUSED" && r.status !== "PAUSED") return false;
        if (statusFilter === "CANCELLED" && r.status !== "CANCELLED") return false;
        if (statusFilter === "FAILED" && r.status !== "FAILED") return false;
        if (statusFilter === "INVALID_NUMBER" && r.status !== "INVALID_NUMBER") return false;
        if (statusFilter === "NON_WHATSAPP" && r.status !== "NON_WHATSAPP") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.phone.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || (r.instanceName && r.instanceName.toLowerCase().includes(q));
      }
      return true;
    });
  }, [data, statusFilter, searchQuery]);

  if (loading && !data) {
    return (
      <div className="py-24 text-center space-y-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
        <p className="text-xs font-semibold">Loading campaign report & recipient audits...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-24 text-center space-y-4 text-slate-400 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Campaign Not Found</h3>
        <p className="text-xs text-slate-500">This campaign report is unavailable or has been removed.</p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none pb-12">
      
      {/* =========================================================================
          1. TOP PAGE HEADER & ACTIONS (Dedicated Full Page)
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Back to Campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Campaign Report
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                {data.campaign.name}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-extrabold uppercase">
                {data.campaign.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Audience: <strong className="text-slate-700 dark:text-slate-300">{data.campaign.audienceNames?.join(" + ") || "Selected Audience"}</strong> • Launched {data.campaign.createdAt ? new Date(data.campaign.createdAt).toLocaleString() : "Recently"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Refresh Action */}
          <button
            onClick={() => fetchReport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {/* Retry All Failed Button */}
          {data && data.kpis.failedCount > 0 && (
            <button
              onClick={handleRetryAllFailed}
              disabled={retryingId === "ALL"}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <RotateCw className={"w-3.5 h-3.5 " + (retryingId === "ALL" ? "animate-spin" : "")} />
              <span>Retry All Failed ({data.kpis.failedCount})</span>
            </button>
          )}

          {/* Add to sender list */}
          <button
            onClick={() => handleAddToSenderList("ALL")}
            disabled={addingList}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add to sender list</span>
          </button>

          {/* Add Failed to sender list */}
          <button
            onClick={() => handleAddToSenderList("FAILED")}
            disabled={addingList}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Add Failed to sender list</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Download CSV Audit"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. VIEW SWITCHER TABS (Sending Report vs Campaign Report)
          ========================================================================= */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab("SENDING_REPORT")}
          className={
            "pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 " +
            (activeTab === "SENDING_REPORT"
              ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400")
          }
        >
          <Send className="w-3.5 h-3.5" />
          <span>Sending Report</span>
        </button>

        <button
          onClick={() => setActiveTab("CAMPAIGN_REPORT")}
          className={
            "pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 " +
            (activeTab === "CAMPAIGN_REPORT"
              ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400")
          }
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Campaign Report (Engagement & Poll Analytics)</span>
        </button>
      </div>

      {/* =========================================================================
          3. TOP BANNER: KPIs (Left) + Campaign Broadcast Preview Card (Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: 9 KPI Stat Cards (Click to filter table instantly!) */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            
            {/* 1. Total Messages */}
            <div 
              onClick={() => setStatusFilter("ALL")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "ALL" ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Total
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {data.kpis.totalMessages}
                </span>
              </div>
            </div>

            {/* 2. Message Sent */}
            <div 
              onClick={() => setStatusFilter("SENT")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "SENT" ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Sent
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {data.kpis.sentCount}
                </span>
              </div>
            </div>

            {/* 3. Delivered */}
            <div 
              onClick={() => setStatusFilter("DELIVERED")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "DELIVERED" ? "border-teal-500 ring-2 ring-teal-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Delivered
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-teal-600 dark:text-teal-400">
                  {data.kpis.deliveredCount}
                </span>
              </div>
            </div>

            {/* 4. Message Read (Blue Ticks) */}
            <div 
              onClick={() => setStatusFilter("READ")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "READ" ? "border-blue-500 ring-2 ring-blue-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Read (Blue Ticks)
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                  ✓✓
                </div>
                <span className="text-base font-black text-blue-600 dark:text-blue-400">
                  {data.kpis.readCount}
                </span>
              </div>
            </div>

            {/* 5. Message Pending */}
            <div 
              onClick={() => setStatusFilter("PENDING")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "PENDING" ? "border-amber-500 ring-2 ring-amber-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Pending
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                  {data.kpis.pendingCount}
                </span>
              </div>
            </div>

            {/* 6. Message Paused */}
            <div 
              onClick={() => setStatusFilter("PAUSED")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "PAUSED" ? "border-yellow-500 ring-2 ring-yellow-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Paused
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                  <Pause className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-yellow-600 dark:text-yellow-400">
                  {data.kpis.pausedCount}
                </span>
              </div>
            </div>

            {/* 7. Message Failed */}
            <div 
              onClick={() => setStatusFilter("FAILED")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "FAILED" ? "border-rose-500 ring-2 ring-rose-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Failed
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-rose-600 dark:text-rose-400">
                  {data.kpis.failedCount}
                </span>
              </div>
            </div>

            {/* 8. Invalid Number */}
            <div 
              onClick={() => setStatusFilter("INVALID_NUMBER")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "INVALID_NUMBER" ? "border-red-500 ring-2 ring-red-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Invalid
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <UserX className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-red-600 dark:text-red-400">
                  {data.kpis.invalidNumberCount}
                </span>
              </div>
            </div>

            {/* 9. Non Whatsapp Number */}
            <div 
              onClick={() => setStatusFilter("NON_WHATSAPP")}
              className={
                "bg-white dark:bg-[#131b2e] border rounded-2xl p-3 shadow-2xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.02] " +
                (statusFilter === "NON_WHATSAPP" ? "border-red-500 ring-2 ring-red-500/30" : "border-slate-200/90 dark:border-slate-800")
              }
            >
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate uppercase">
                Non-WA
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <span className="text-base font-black text-red-600 dark:text-red-400">
                  {data.kpis.nonWhatsappCount}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Live Campaign Broadcast Preview Card */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="bg-white dark:bg-[#131b2e] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>📱</span> Broadcast Preview
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-extrabold text-[9px] uppercase">
                {data.campaign.contentType || "MESSAGE"}
              </span>
            </div>

            {/* WhatsApp Bubble Preview */}
            <div className="bg-[#f0f2f5] dark:bg-[#1a233a] rounded-xl p-3 space-y-2 border border-slate-200/60 dark:border-slate-700/60 text-slate-900 dark:text-white">
              {data.campaign.mediaUrl && (
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 aspect-video flex items-center justify-center text-xs text-slate-400">
                  <img
                    src={normalizePublicMediaUrl(data.campaign.mediaUrl)}
                    alt="Campaign Media"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}

              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                {data.campaign.messageText || "Campaign Broadcast Message"}
              </p>

              {/* Action Buttons inside Preview */}
              {data.buttonAnalytics?.hasButtons && data.buttonAnalytics.buttons.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  {data.buttonAnalytics.buttons.map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 text-center font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1.5 truncate"
                    >
                      <span>{b.type === "CALL" ? "📞" : b.type === "URL" ? "🌐" : "⚡"}</span>
                      <span className="truncate">{b.displayText}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Poll Options inside Preview */}
              {data.pollAnalytics?.isPoll && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-xs leading-snug">{data.pollAnalytics.question}</div>
                  {data.pollAnalytics.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 py-0.5">
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center">
                        {oIdx === 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <span>{opt.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Menu Data inside Preview */}
              {data.listAnalytics?.hasList && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <div className="py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] text-center flex items-center justify-center gap-1">
                    <span>📋</span>
                    <span>{data.listAnalytics.sectionTitle || "View Menu Options"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          4. TAB 1: SENDING REPORT TABLE
          ========================================================================= */}
      {activeTab === "SENDING_REPORT" && (
        <div className="space-y-4">
          
          {/* Search and KPI Category Tabs Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search number, name..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* KPI Category Tabs with Live Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { key: "ALL", label: "All", count: data.kpis.totalMessages },
                { key: "SENT", label: "Sent", count: data.kpis.sentCount },
                { key: "DELIVERED", label: "Delivered", count: data.kpis.deliveredCount },
                { key: "READ", label: "Read", count: data.kpis.readCount },
                { key: "PENDING", label: "Pending", count: data.kpis.pendingCount },
                { key: "PAUSED", label: "Paused", count: data.kpis.pausedCount },
                { key: "CANCELLED", label: "Cancelled", count: data.kpis.cancelledCount },
                { key: "FAILED", label: "Failed", count: data.kpis.failedCount },
                { key: "INVALID_NUMBER", label: "Invalid Number", count: data.kpis.invalidNumberCount },
                { key: "NON_WHATSAPP", label: "Non WhatsApp", count: data.kpis.nonWhatsappCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs " +
                    (statusFilter === tab.key
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200")
                  }
                >
                  <span>{tab.label}</span>
                  <span className={
                    "px-1.5 py-0.2 rounded-md text-[10px] font-black " +
                    (statusFilter === tab.key
                      ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300")
                  }>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Streamlined Sending Report Table */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Recipient Number & Name</th>
                  <th className="py-3 px-4">Sender Number</th>
                  <th className="py-3 px-4">Action / Customer Choice</th>
                  <th className="py-3 px-4">Status & Actions</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4">Delivered / Read At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 italic text-xs">
                      No recipient records found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Recipient Number & Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="font-mono text-xs">{rec.phone}</div>
                        {rec.name && <div className="text-[10px] text-slate-400 font-normal">{rec.name}</div>}
                      </td>

                      {/* Sender Number (Clean Compact Chip) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-mono text-[11px] font-bold shadow-2xs whitespace-nowrap">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{rec.instanceNumber || rec.senderInstance?.replace(/^.*\(|\).*$/g, '') || rec.senderInstance || "+918178962366"}</span>
                        </span>
                      </td>

                      {/* Action / Customer Choice */}
                      <td className="py-3.5 px-4">
                        {rec.buttonClicked ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-bold shadow-2xs">
                            <span>🔘</span>
                            <span>{rec.buttonClicked}</span>
                          </div>
                        ) : rec.pollVote ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold shadow-2xs">
                            <span>🗳️</span>
                            <span>{rec.pollVote}</span>
                          </div>
                        ) : rec.listItemSelected ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-bold shadow-2xs">
                            <span>📋</span>
                            <span>{rec.listItemSelected}</span>
                          </div>
                        ) : rec.replyText ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-medium shadow-2xs">
                            <span>💬</span>
                            <span>"{rec.replyText}"</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic font-normal">
                            No interaction yet
                          </span>
                        )}
                      </td>

                      {/* Status & Actions */}
                      <td className="py-3.5 px-4">
                        {rec.status === "READ" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                              <span className="text-blue-600 dark:text-blue-400 font-black">✓✓</span>
                              <span>READ</span>
                            </span>
                            {rec.readAt && (
                              <div className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">
                                {new Date(rec.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </div>
                        ) : rec.status === "DELIVERED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <span className="text-slate-400">✓✓</span>
                            <span>DELIVERED</span>
                          </span>
                        ) : rec.status === "SENT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                            <span className="text-slate-400">✓</span>
                            <span>SENT</span>
                          </span>
                        ) : rec.status === "NON_WHATSAPP" ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
                              NON-WHATSAPP
                            </span>
                            <div className="text-[9px] text-orange-600 dark:text-orange-400 font-semibold" title={rec.failureReason || "Not registered on WhatsApp"}>
                              {rec.failureReason || "Not registered on WhatsApp"}
                            </div>
                          </div>
                        ) : rec.status === "INVALID_NUMBER" ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
                              INVALID NUMBER
                            </span>
                            <div className="text-[9px] text-red-500 font-semibold" title={rec.failureReason || "Invalid phone digits / Landline"}>
                              {rec.failureReason || "Invalid phone digits / Landline"}
                            </div>
                          </div>
                        ) : rec.status === "FAILED" ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                                FAILED
                              </span>
                              <button
                                onClick={() => handleRetryRecipient(rec.id, rec.phone)}
                                disabled={retryingId === rec.id}
                                title="Retry sending to this number"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                              >
                                <RotateCw className={"w-2.5 h-2.5 " + (retryingId === rec.id ? "animate-spin" : "")} />
                                <span>Retry</span>
                              </button>
                            </div>
                            {rec.failureReason && (
                              <div className="text-[9px] text-rose-500 font-semibold max-w-[180px] leading-tight" title={rec.failureReason}>
                                {rec.failureReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className={
                              "inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border " +
                              (rec.status === "PENDING"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300")
                            }>
                              {rec.status}
                            </span>
                            {rec.failureReason && (
                              <div className="text-[9px] text-slate-400 font-semibold max-w-[180px]" title={rec.failureReason}>
                                {rec.failureReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("en-GB") + " " + new Date(rec.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>

                      {/* Delivered / Read At */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {rec.readAt ? (
                          <div className="text-blue-600 dark:text-blue-400 font-bold">
                            👁 {new Date(rec.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ) : rec.deliveredAt ? (
                          <div className="text-emerald-600 dark:text-emerald-400">
                            ✓ {new Date(rec.deliveredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* =========================================================================
          5. TAB 2: CAMPAIGN REPORT (Engagement & Analytics)
          ========================================================================= */}
      {activeTab === "CAMPAIGN_REPORT" && (
        <div className="space-y-6">
          
          {/* Funnel KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400">Delivered Rate</span>
              <div className="text-2xl font-black text-emerald-600">{data.kpis.deliveredRate}%</div>
              <p className="text-[11px] text-slate-500">{data.kpis.deliveredCount} of {data.kpis.sentCount} reached</p>
            </div>

            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400">Read / Blue Ticks</span>
              <div className="text-2xl font-black text-blue-600">{data.kpis.readRate}%</div>
              <p className="text-[11px] text-slate-500">{data.kpis.readCount} viewed message</p>
            </div>

            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400">Customer Reply Rate</span>
              <div className="text-2xl font-black text-purple-600">{data.kpis.replyRate}%</div>
              <p className="text-[11px] text-slate-500">{data.replies.length} responses</p>
            </div>

            <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400">Poll Engagement</span>
              <div className="text-2xl font-black text-teal-600">{data.kpis.voteRate || 0}%</div>
              <p className="text-[11px] text-slate-500">{data.pollAnalytics?.totalVotes || 0} votes cast</p>
            </div>
          </div>

          {/* Interactive Button Click Analytics */}
          {data.buttonAnalytics && data.buttonAnalytics.hasButtons && (
            <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔘</span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Action Button Click Analytics
                  </h3>
                </div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {data.buttonAnalytics.totalClicks} Total Button Clicks
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.buttonAnalytics.buttons.map((btn, bIdx) => (
                  <div key={bIdx} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="truncate">{btn.displayText}</span>
                      <span className="text-blue-600 font-extrabold">{btn.clicks} clicks</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${btn.clickRate}%` }}
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400">{btn.clickRate}% click-through rate</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List Menu Selection Analytics */}
          {data.listAnalytics && data.listAnalytics.hasList && (
            <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Menu Selection Analytics: "{data.listAnalytics.sectionTitle}"
                  </h3>
                </div>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  {data.listAnalytics.totalSelections} Total Menu Selections
                </span>
              </div>

              <div className="space-y-2.5">
                {data.listAnalytics.items.map((item, iIdx) => (
                  <div key={iIdx} className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <div>
                        <span>{item.title}</span>
                        {item.description && <span className="text-[10px] text-slate-400 font-normal block">{item.description}</span>}
                      </div>
                      <span className="text-purple-600 font-extrabold">{item.selections} ({item.selectionRate}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.selectionRate}%` }}
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Poll Analytics Suite (If Poll) */}
          {data.pollAnalytics?.isPoll && (
            <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Vote className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Poll Analytics: "{data.pollAnalytics.question}"
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {data.pollAnalytics.totalVotes} Total Votes Cast
                </span>
              </div>

              {/* Vote Distribution Bars */}
              <div className="space-y-3">
                {data.pollAnalytics.options.map((opt, i) => (
                  <div key={i} className="space-y-1.5 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>{opt.text}</span>
                      <span className="text-emerald-600">{opt.votes} votes ({opt.percentage}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${opt.percentage}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Voter Records */}
              {data.pollAnalytics.voters.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Voter Breakdown</h4>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.pollAnalytics.voters.map((v, vIdx) => (
                      <div key={vIdx} className="py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">{v.phone} ({v.name})</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Voted: {v.option}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* WhatsApp Web Live Chat Wizard for Campaign Replies */}
          <CampaignChatWizard
            campaignId={campaignId}
            campaignName={data.campaign.name}
            campaignMessageText={data.campaign.messageText}
            campaignMediaUrl={data.campaign.mediaUrl}
          />

        </div>
      )}

    </div>
  );
}
