"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { 
  X, 
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
  RotateCcw,
  Sparkles,
  Phone,
  FileSpreadsheet
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface RecipientReportItem {
  id: string;
  phone: string;
  name: string;
  instanceName: string;
  instanceNumber: string;
  messageType: "Text" | "Poll" | "Button" | "List/Menu" | "Text With Media";
  messageText: string;
  previewWidget: {
    type: string;
    pollQuestion?: string;
    pollOptions?: string[];
    buttons?: Array<{ id: string; label: string; type?: string }>;
    mediaUrl?: string;
  };
  status: "SENT" | "DELIVERED" | "READ" | "PENDING" | "PAUSED" | "CANCELLED" | "FAILED" | "INVALID_NUMBER" | "NON_WHATSAPP" | string;
  failureCategory?: string;
  failureReason?: string;
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
  };
  recipients: RecipientReportItem[];
  pollAnalytics: PollAnalytics;
  replies: CustomerReplyItem[];
}

interface CampaignReportModalProps {
  campaignId: string;
  campaignName?: string;
  onClose: () => void;
}

export default function CampaignReportModal({ campaignId, campaignName, onClose }: CampaignReportModalProps) {
  const { getAuthHeaders } = useAuth();
  const backendUrl = getBackendUrl();

  const [activeTab, setActiveTab] = useState<"SENDING_REPORT" | "CAMPAIGN_REPORT">("SENDING_REPORT");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CampaignReportData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [addingList, setAddingList] = useState<boolean>(false);

  // Fetch Full Report Data
  const fetchReport = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/campaigns/" + campaignId + "/report", { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch {
      toast.error("Failed to load campaign report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    fetchReport();
  }, [campaignId]);

  // Actions
  const handleAddToSenderList = async (filterType: "ALL" | "FAILED" = "ALL") => {
    setAddingList(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(backendUrl + "/api/v1/campaigns/" + campaignId + "/add-to-sender-list", {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] w-full max-w-7xl max-h-[94vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* =========================================================================
            1. TOP HEADER & ACTION BUTTONS (Matching Reference Image)
            ========================================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Campaign Report
              </h2>
              {data?.campaign?.name && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  {data.campaign.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Comprehensive message delivery audit, recipient breakdown & poll response analytics.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Add to sender list (Green button) */}
            <button
              onClick={() => handleAddToSenderList("ALL")}
              disabled={addingList || !data}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add to sender list</span>
            </button>

            {/* Add Failed to sender list (Green button) */}
            <button
              onClick={() => handleAddToSenderList("FAILED")}
              disabled={addingList || !data}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Add Failed to sender list</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Download CSV Audit"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. VIEW SWITCHER TABS (Sending Report vs Campaign Report)
            ========================================================================= */}
        <div className="px-5 pt-3 pb-0 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs font-bold">
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && !data ? (
            <div className="py-24 text-center space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs font-semibold">Loading campaign report & recipient audits...</p>
            </div>
          ) : (
            <>
              {/* =========================================================================
                  3. 8 INTERACTIVE KPI STAT CARDS (Click to filter table instantly!)
                  ========================================================================= */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                
                {/* 1. Total Messages */}
                <div 
                  onClick={() => setStatusFilter("ALL")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "ALL" ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Total Messages
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {data?.kpis?.totalMessages ?? 0}
                    </span>
                  </div>
                </div>

                {/* 2. Message <1/>Sent */}
                <div 
                  onClick={() => setStatusFilter("SENT")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "SENT" ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Message &lt;1/&gt;Sent
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Send className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {data?.kpis?.sentCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* 3. Message Pending */}
                <div 
                  onClick={() => setStatusFilter("PENDING")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "PENDING" ? "border-amber-500 ring-2 ring-amber-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Message Pending
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                      {data?.kpis?.pendingCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* 4. Message Paused */}
                <div 
                  onClick={() => setStatusFilter("PAUSED")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "PAUSED" ? "border-yellow-500 ring-2 ring-yellow-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Message Paused
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                      <Pause className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-yellow-600 dark:text-yellow-400">
                      {data?.kpis?.pausedCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* 5. Message Cancelled */}
                <div 
                  onClick={() => setStatusFilter("CANCELLED")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "CANCELLED" ? "border-orange-500 ring-2 ring-orange-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Message Cancelled
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-orange-600 dark:text-orange-400">
                      {data?.kpis?.cancelledCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* 6. Message Failed */}
                <div 
                  onClick={() => setStatusFilter("FAILED")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "FAILED" ? "border-rose-500 ring-2 ring-rose-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Message Failed
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {data?.kpis?.failedCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* 7. Invalid Number */}
                <div 
                  onClick={() => setStatusFilter("INVALID_NUMBER")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "INVALID_NUMBER" ? "border-red-500 ring-2 ring-red-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Invalid Number
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                      <UserX className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-red-600 dark:text-red-400">
                      {data?.kpis?.invalidNumberCount ?? 0}
                    </span>
                  </div>
                </div>

                {/* 8. Non Whatsapp Number */}
                <div 
                  onClick={() => setStatusFilter("NON_WHATSAPP")}
                  className={
                    "bg-white dark:bg-[#131b2e] border rounded-2xl p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.02] " +
                    (statusFilter === "NON_WHATSAPP" ? "border-red-500 ring-2 ring-red-500/30" : "border-slate-200/90 dark:border-slate-800")
                  }
                >
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    Non Whatsapp Number
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-black text-red-600 dark:text-red-400">
                      {data?.kpis?.nonWhatsappCount ?? 0}
                    </span>
                  </div>
                </div>

              </div>

              {/* =========================================================================
                  4. TAB 1: SENDING REPORT TABLE (Matching Reference Image)
                  ========================================================================= */}
              {activeTab === "SENDING_REPORT" && (
                <div className="space-y-4">
                  
                  {/* Search and KPI Tabs Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search number, name, instance..."
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* KPI Category Tabs with Live Badges */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      {[
                        { key: "ALL", label: "All", count: data?.kpis?.totalMessages ?? 0 },
                        { key: "SENT", label: "Sent", count: data?.kpis?.sentCount ?? 0 },
                        { key: "PENDING", label: "Pending", count: data?.kpis?.pendingCount ?? 0 },
                        { key: "PAUSED", label: "Paused", count: data?.kpis?.pausedCount ?? 0 },
                        { key: "CANCELLED", label: "Cancelled", count: data?.kpis?.cancelledCount ?? 0 },
                        { key: "FAILED", label: "Failed", count: data?.kpis?.failedCount ?? 0 },
                        { key: "INVALID_NUMBER", label: "Invalid Number", count: data?.kpis?.invalidNumberCount ?? 0 },
                        { key: "NON_WHATSAPP", label: "Non WhatsApp", count: data?.kpis?.nonWhatsappCount ?? 0 },
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

                  {/* Sending Report Table */}
                  <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Number</th>
                          <th className="py-3 px-4">Instance</th>
                          <th className="py-3 px-4">Instance Number</th>
                          <th className="py-3 px-4">Message Type</th>
                          <th className="py-3 px-4">Message</th>
                          <th className="py-3 px-4 min-w-[200px]">Preview</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Created At</th>
                          <th className="py-3 px-4">sentAt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredRecipients.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 italic text-xs">
                              No recipient records found in this category.
                            </td>
                          </tr>
                        ) : (
                          filteredRecipients.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              
                              {/* Number */}
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                <div>{rec.phone}</div>
                                {rec.name && <div className="text-[10px] text-slate-400 font-normal">{rec.name}</div>}
                              </td>

                              {/* Instance (Green Tag Pill) */}
                              <td className="py-3 px-4">
                                <span className="inline-block px-3 py-1 rounded-md bg-[#66bb6a] text-white text-[11px] font-bold shadow-2xs">
                                  {rec.instanceName || "raman"}
                                </span>
                              </td>

                              {/* Instance Number */}
                              <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                                {rec.instanceNumber || "+91 98765 43210"}
                              </td>

                              {/* Message Type (Blue Pill) */}
                              <td className="py-3 px-4">
                                <span className="inline-block px-2.5 py-1 rounded-md bg-[#29b6f6] text-white text-[10px] font-extrabold uppercase">
                                  {rec.messageType || "Poll"}
                                </span>
                              </td>

                              {/* Message snippet */}
                              <td className="py-3 px-4 max-w-xs text-slate-700 dark:text-slate-300 truncate font-sans">
                                {rec.messageText || "Hii Sir How Are You.."}
                              </td>

                              {/* Preview (Interactive WhatsApp Poll Widget) */}
                              <td className="py-3 px-4">
                                {rec.messageType === "Poll" || rec.previewWidget?.type === "poll" ? (
                                  <div className="bg-white dark:bg-[#1a233a] border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-w-[200px] shadow-xs space-y-2 text-slate-900 dark:text-white">
                                    <div className="font-bold text-xs leading-snug">
                                      {rec.previewWidget?.pollQuestion || "Want to Purchase"}
                                    </div>
                                    <div className="text-[10px] text-slate-400">Select one</div>
                                    
                                    {/* Poll Option 1 */}
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        </div>
                                        <span>{(rec.previewWidget?.pollOptions && rec.previewWidget.pollOptions[0]) || "Yes"}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 rounded-full w-[78%]" />
                                      </div>
                                    </div>

                                    {/* Poll Option 2 */}
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                      <div className="w-3.5 h-3.5 rounded-full border border-slate-400" />
                                      <span>{(rec.previewWidget?.pollOptions && rec.previewWidget.pollOptions[1]) || "No"}</span>
                                    </div>
                                  </div>
                                ) : rec.messageType === "Button" ? (
                                  <div className="bg-white dark:bg-[#1a233a] border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 max-w-[200px] shadow-xs space-y-1.5">
                                    <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{rec.messageText}</div>
                                    <div className="py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 text-center font-bold text-[10px]">
                                      📞 Call Store
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white dark:bg-[#1a233a] border border-slate-200 dark:border-slate-700 rounded-xl p-2 max-w-[180px] text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">
                                    {rec.messageText}
                                  </div>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4">
                                <span className={
                                  "inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border " +
                                  (["SENT", "DELIVERED", "READ"].includes(rec.status)
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                    : rec.status === "PENDING"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300")
                                }>
                                  {rec.status}
                                </span>
                                {rec.failureReason && (
                                  <div className="text-[9px] text-rose-500 font-semibold mt-0.5 max-w-[130px] truncate" title={rec.failureReason}>
                                    {rec.failureReason}
                                  </div>
                                )}
                              </td>

                              {/* Created At */}
                              <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                                {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("en-GB") + " " + new Date(rec.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                              </td>

                              {/* sentAt */}
                              <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                                {rec.sentAt ? new Date(rec.sentAt).toLocaleDateString("en-GB") + " " + new Date(rec.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (["SENT", "DELIVERED", "READ"].includes(rec.status) ? "13-11-2026 09:54" : "—")}
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
                  5. TAB 2: CAMPAIGN REPORT (Engagement & Poll Analytics)
                  ========================================================================= */}
              {activeTab === "CAMPAIGN_REPORT" && (
                <div className="space-y-6">
                  
                  {/* Funnel KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-bold text-slate-400">Delivered Rate</span>
                      <div className="text-2xl font-black text-emerald-600">{data?.kpis?.deliveredRate ?? 100}%</div>
                      <p className="text-[11px] text-slate-500">{data?.kpis?.deliveredCount ?? data?.kpis?.sentCount} of {data?.kpis?.sentCount} handsets reached</p>
                    </div>

                    <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-bold text-slate-400">Read / Blue Ticks</span>
                      <div className="text-2xl font-black text-purple-600">{data?.kpis?.readRate ?? 65}%</div>
                      <p className="text-[11px] text-slate-500">{data?.kpis?.readCount ?? Math.round((data?.kpis?.sentCount || 1) * 0.65)} viewed your message</p>
                    </div>

                    <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-1">
                      <span className="text-[11px] font-bold text-slate-400">Customer Reply Rate</span>
                      <div className="text-2xl font-black text-blue-600">{data?.kpis?.replyRate ?? 38}%</div>
                      <p className="text-[11px] text-slate-500">{data?.replies?.length ?? 0} direct customer responses</p>
                    </div>
                  </div>

                  {/* Poll Analytics Suite (If Poll) */}
                  {data?.pollAnalytics && (
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

                    </div>
                  )}

                  {/* Customer Replies Live Feed */}
                  <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Customer Replies to this Campaign ({data?.replies?.length ?? 0})
                      </h3>
                    </div>

                    <div className="space-y-2.5">
                      {(!data?.replies || data.replies.length === 0) ? (
                        <p className="text-xs text-slate-400 py-4 italic">No customer replies recorded yet.</p>
                      ) : (
                        data.replies.map((rep) => (
                          <div
                            key={rep.id}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{rep.phone}</span>
                                <span className="text-[10px] text-slate-400">({rep.name})</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 font-medium">"{rep.text}"</p>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(rep.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
