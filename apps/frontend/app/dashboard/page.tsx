"use client";

import React, { useEffect, useState, useId } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Users,
  Send,
  CheckCheck,
  Smartphone,
  MessageSquare,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Radio,
  FileText,
  Bot,
  UserX,
  Upload,
  Layers,
  ChevronRight,
  Activity,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface DailyActivityPoint {
  date: string;
  label: string;
  sent: number;
  delivered: number;
  read: number;
  replies: number;
}

interface RecentCampaignSummary {
  id: string;
  name: string;
  status: string;
  targetAudienceType: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  scheduledAt: string;
  createdAt: string;
}

interface DashboardMetrics {
  devicesCount: number;
  devicesStatus: "CONNECTED" | "DISCONNECTED";
  activeInstanceName: string;
  activePhoneNumber: string | null;
  instancesList: Array<{
    id: string;
    instanceName: string;
    phoneNumber: string | null;
    status: string;
    connectedAt: string | null;
  }>;

  totalContacts: number;
  activeSubscribers: number;
  unsubscribedCount: number;
  totalSubscribers: number;

  totalCampaigns: number;
  totalMessages: number;
  sentMessages: number;
  deliveredMessages: number;
  readMessages: number;
  failedMessages: number;
  pendingMessages: number;
  pausedMessages: number;
  deliveryRate: number;
  readRate: number;

  incomingReplies: number;
  autoReplyMessages: number;
  autoReplyCount: number;
  welcomeMessageCount: number;
  welcomeMessages: number;
  templatesCount: number;

  errorWhileSending: number;
  invalidNumber: number;
  cancelledMessages: number;
  instanceNotConnected: number;
  instanceNotFound: number;
  notAWhatsAppNumber: number;

  dailyTrends: DailyActivityPoint[];
  recentCampaigns: RecentCampaignSummary[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, getAuthHeaders, user } = useAuth();
  const chartGradientId = useId();
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    devicesCount: 0,
    devicesStatus: "DISCONNECTED",
    activeInstanceName: "Primary WhatsApp Outlet",
    activePhoneNumber: null,
    instancesList: [],

    totalContacts: 0,
    activeSubscribers: 0,
    unsubscribedCount: 0,
    totalSubscribers: 0,

    totalCampaigns: 0,
    totalMessages: 0,
    sentMessages: 0,
    deliveredMessages: 0,
    readMessages: 0,
    failedMessages: 0,
    pendingMessages: 0,
    pausedMessages: 0,
    deliveryRate: 0,
    readRate: 0,

    incomingReplies: 0,
    autoReplyMessages: 0,
    autoReplyCount: 0,
    welcomeMessageCount: 0,
    welcomeMessages: 0,
    templatesCount: 0,

    errorWhileSending: 0,
    invalidNumber: 0,
    cancelledMessages: 0,
    instanceNotConnected: 0,
    instanceNotFound: 0,
    notAWhatsAppNumber: 0,

    dailyTrends: [],
    recentCampaigns: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChartMetric, setActiveChartMetric] = useState<"all" | "sent" | "delivered" | "replies">("all");
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  const backendUrl = getBackendUrl();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchMetrics = async (showFullLoading = false) => {
    if (!isAuthenticated) return;
    try {
      if (showFullLoading) setLoading(true);
      else setRefreshing(true);

      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/analytics/dashboard`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMetrics(json.data);
        }
      }
    } catch {
      // Fallback gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMetrics(true);
    }
  }, [isAuthenticated]);

  // Derived Trend Chart Calculations
  const trends = metrics.dailyTrends && metrics.dailyTrends.length > 0 ? metrics.dailyTrends : [
    { date: "Day 1", label: "Mon", sent: 0, delivered: 0, read: 0, replies: 0 },
    { date: "Day 2", label: "Tue", sent: 0, delivered: 0, read: 0, replies: 0 },
    { date: "Day 3", label: "Wed", sent: 0, delivered: 0, read: 0, replies: 0 },
    { date: "Day 4", label: "Thu", sent: 0, delivered: 0, read: 0, replies: 0 },
    { date: "Day 5", label: "Fri", sent: 0, delivered: 0, read: 0, replies: 0 },
    { date: "Day 6", label: "Sat", sent: 0, delivered: 0, read: 0, replies: 0 },
    { date: "Day 7", label: "Sun", sent: 0, delivered: 0, read: 0, replies: 0 },
  ];

  const maxTrendVal = Math.max(
    ...trends.map((t) => Math.max(t.sent, t.delivered, t.read, t.replies)),
    10
  );

  // Delivery Diagnostics Breakdown Percentages
  const totalAudited = (metrics.sentMessages + metrics.failedMessages) || 1;
  const pctDeliveredRead = Math.round((metrics.readMessages / totalAudited) * 100);
  const pctDeliveredUnread = Math.max(0, Math.round(((metrics.deliveredMessages - metrics.readMessages) / totalAudited) * 100));
  const pctFailed = Math.round((metrics.failedMessages / totalAudited) * 100);
  const pctInTransit = Math.max(0, 100 - (pctDeliveredRead + pctDeliveredUnread + pctFailed));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading CRM dashboard telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Activity className="w-3 h-3" /> Live Telemetry
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {user?.email || "Organization Workspace"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Broadcast & CRM Command Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time delivery rates, audience engagement, and campaign performance diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => fetchMetrics(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500" : "text-slate-500"}`} />
            <span>{refreshing ? "Syncing..." : "Refresh"}</span>
          </button>

          <Link
            href="/received-messages"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Live Chat</span>
          </Link>

          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs shadow-emerald-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Broadcast</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Executive KPI Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Audience / Contacts */}
        <Link href="/contacts" className="block group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Audience Reach
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {metrics.totalContacts.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-medium">contacts</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {metrics.activeSubscribers.toLocaleString()} reachable
              </span>
              <span className="text-slate-400">
                {metrics.unsubscribedCount} opted-out
              </span>
            </div>
          </div>
        </Link>

        {/* KPI 2: Broadcasts Dispatched */}
        <Link href="/campaigns" className="block group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Dispatched Messages
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {metrics.sentMessages.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 ml-1 font-medium">messages</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {metrics.deliveryRate}% delivery rate
              </span>
              <span className="text-slate-400">
                {metrics.totalCampaigns} {metrics.totalCampaigns === 1 ? "campaign" : "campaigns"}
              </span>
            </div>
          </div>
        </Link>

        {/* KPI 3: Read & Engagement */}
        <Link href="/report" className="block group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-purple-500/40 dark:hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Read & Engagement
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <CheckCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400">
                {metrics.readRate}%
              </span>
              <span className="text-xs text-slate-400 ml-1 font-medium">read rate</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                {metrics.readMessages.toLocaleString()} read receipts
              </span>
              <span className="text-slate-400 font-medium">
                {metrics.incomingReplies} replies
              </span>
            </div>
          </div>
        </Link>

        {/* KPI 4: Connected WhatsApp Channel */}
        <Link href="/numbers" className="block group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                WhatsApp Channel
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${metrics.devicesStatus === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {metrics.devicesStatus === "CONNECTED" ? (metrics.activePhoneNumber || "Connected") : "Disconnected"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span className="truncate max-w-[140px] font-medium">
                {metrics.activeInstanceName}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                metrics.devicesStatus === "CONNECTED" 
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
              }`}>
                {metrics.devicesStatus}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* 3. Center Section: Velocity Chart (60%) & Delivery Funnel Diagnostics (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Columns: Broadcast Activity Trends (Pure Interactive Responsive SVG Chart) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  Broadcast & Engagement Velocity (Last 7 Days)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Daily volume of dispatched broadcasts, delivered messages, and customer replies.
                </p>
              </div>

              {/* Metric filter buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setActiveChartMetric("all")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    activeChartMetric === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  All Volume
                </button>
                <button
                  onClick={() => setActiveChartMetric("delivered")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    activeChartMetric === "delivered"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Delivered
                </button>
                <button
                  onClick={() => setActiveChartMetric("replies")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    activeChartMetric === "replies"
                      ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Replies
                </button>
              </div>
            </div>

            {/* SVG Chart Canvas */}
            <div className="mt-6 relative h-56 w-full">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 200">
                <defs>
                  <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal gridlines */}
                <line x1="0" y1="40" x2="700" y2="40" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="3 3" />
                <line x1="0" y1="100" x2="700" y2="100" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="3 3" />
                <line x1="0" y1="160" x2="700" y2="160" stroke="currentColor" className="text-slate-100 dark:text-slate-800/80" strokeDasharray="3 3" />

                {/* Render bars / curves for each trend point */}
                {trends.map((item, index) => {
                  const stepX = 700 / (trends.length || 1);
                  const x = index * stepX + stepX / 2;
                  
                  const sentH = Math.max(4, (item.sent / maxTrendVal) * 150);
                  const delH = Math.max(4, (item.delivered / maxTrendVal) * 150);
                  const repH = Math.max(4, (item.replies / maxTrendVal) * 150);

                  const isHovered = hoveredTrendIndex === index;

                  return (
                    <g 
                      key={item.date} 
                      className="cursor-pointer transition-opacity"
                      onMouseEnter={() => setHoveredTrendIndex(index)}
                      onMouseLeave={() => setHoveredTrendIndex(null)}
                    >
                      {/* Highlight Background on Hover */}
                      {isHovered && (
                        <rect
                          x={index * stepX + 4}
                          y="0"
                          width={stepX - 8}
                          height="180"
                          fill="currentColor"
                          className="text-slate-100/60 dark:text-slate-800/40 rounded"
                          rx="6"
                        />
                      )}

                      {/* Bar 1: Sent (Indigo) */}
                      {(activeChartMetric === "all" || activeChartMetric === "sent") && (
                        <rect
                          x={x - 14}
                          y={170 - sentH}
                          width="8"
                          height={sentH}
                          className={`fill-indigo-500 transition-all ${isHovered ? "opacity-100" : "opacity-80"}`}
                          rx="3"
                        />
                      )}

                      {/* Bar 2: Delivered (Emerald) */}
                      {(activeChartMetric === "all" || activeChartMetric === "delivered") && (
                        <rect
                          x={x - 4}
                          y={170 - delH}
                          width="8"
                          height={delH}
                          className={`fill-emerald-500 transition-all ${isHovered ? "opacity-100" : "opacity-80"}`}
                          rx="3"
                        />
                      )}

                      {/* Bar 3: Replies (Purple) */}
                      {(activeChartMetric === "all" || activeChartMetric === "replies") && (
                        <rect
                          x={x + 6}
                          y={170 - repH}
                          width="8"
                          height={repH}
                          className={`fill-purple-500 transition-all ${isHovered ? "opacity-100" : "opacity-80"}`}
                          rx="3"
                        />
                      )}

                      {/* X-axis date label */}
                      <text
                        x={x}
                        y="192"
                        textAnchor="middle"
                        className={`text-[11px] font-semibold transition-colors ${
                          isHovered 
                            ? "fill-slate-900 dark:fill-white font-bold" 
                            : "fill-slate-400 dark:fill-slate-500"
                        }`}
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip Card */}
              {hoveredTrendIndex !== null && trends[hoveredTrendIndex] && (
                <div 
                  className="absolute z-20 bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none transition-all"
                  style={{
                    left: `${(hoveredTrendIndex / trends.length) * 100 + 4}%`,
                    top: "10px"
                  }}
                >
                  <p className="font-bold border-b border-slate-700 pb-1 mb-1">
                    {trends[hoveredTrendIndex].label} ({trends[hoveredTrendIndex].date})
                  </p>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-indigo-400">Dispatched:</span>
                      <span className="font-bold">{trends[hoveredTrendIndex].sent}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-emerald-400">Delivered:</span>
                      <span className="font-bold">{trends[hoveredTrendIndex].delivered}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-purple-400">Replies:</span>
                      <span className="font-bold">{trends[hoveredTrendIndex].replies}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" />
                <span>Dispatched</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>Delivered</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-purple-500" />
                <span>Inbound Replies</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Peak Broadcast Activity: 11:00 AM – 4:00 PM
            </span>
          </div>
        </div>

        {/* Right 5 Columns: Delivery Diagnostics & Health Funnel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Delivery Health Diagnostics
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  End-to-end receipt breakdown & failure audit.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                {metrics.deliveryRate}% Success
              </span>
            </div>

            {/* Visual Funnel Multi-Bar */}
            <div className="mt-5 space-y-4">
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${pctDeliveredRead}%` }} 
                  className="bg-purple-500 transition-all duration-500" 
                  title={`Delivered & Read: ${pctDeliveredRead}%`}
                />
                <div 
                  style={{ width: `${pctDeliveredUnread}%` }} 
                  className="bg-emerald-500 transition-all duration-500" 
                  title={`Delivered Unread: ${pctDeliveredUnread}%`}
                />
                <div 
                  style={{ width: `${pctInTransit}%` }} 
                  className="bg-amber-400 transition-all duration-500" 
                  title={`In Transit: ${pctInTransit}%`}
                />
                <div 
                  style={{ width: `${pctFailed}%` }} 
                  className="bg-rose-500 transition-all duration-500" 
                  title={`Failed: ${pctFailed}%`}
                />
              </div>

              {/* Diagnostic Categories */}
              <div className="space-y-2.5 text-xs">
                
                <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Delivered & Read (Blue Ticks)</span>
                  </div>
                  <span className="font-black text-purple-700 dark:text-purple-300">
                    {metrics.readMessages.toLocaleString()} ({pctDeliveredRead}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Delivered (Gray Ticks)</span>
                  </div>
                  <span className="font-black text-emerald-700 dark:text-emerald-300">
                    {Math.max(0, metrics.deliveredMessages - metrics.readMessages).toLocaleString()} ({pctDeliveredUnread}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="font-medium text-slate-600 dark:text-slate-300">Queued / Pending</span>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {metrics.pendingMessages.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Failed / Rejected</span>
                  </div>
                  <span className="font-black text-rose-700 dark:text-rose-300">
                    {metrics.failedMessages.toLocaleString()} ({pctFailed}%)
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Breakdown Error Tags */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Failure Breakdown Telemetry
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-200/60 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500">Non-WhatsApp:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.notAWhatsAppNumber}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-200/60 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500">Invalid Format:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{metrics.invalidNumber}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Lower Section: Recent Campaigns Table (65%) & CRM Shortcuts (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Broadcast Campaigns Table */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Recent Broadcast Campaigns
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live delivery progress and recipient response metrics.
              </p>
            </div>
            <Link 
              href="/campaigns"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {metrics.recentCampaigns && metrics.recentCampaigns.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase">
                    <th className="pb-2.5">Campaign</th>
                    <th className="pb-2.5">Audience</th>
                    <th className="pb-2.5">Progress</th>
                    <th className="pb-2.5">Read %</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {metrics.recentCampaigns.map((cmp) => {
                    const pct = cmp.totalRecipients > 0 ? Math.round(((cmp.sentCount + cmp.deliveredCount + cmp.readCount) / cmp.totalRecipients) * 100) : 0;
                    const rPct = (cmp.deliveredCount + cmp.readCount) > 0 ? Math.round((cmp.readCount / (cmp.deliveredCount + cmp.readCount)) * 100) : 0;

                    return (
                      <tr key={cmp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3">
                          <Link href={`/campaigns/${cmp.id}`} className="font-bold text-slate-900 dark:text-white hover:text-emerald-600">
                            {cmp.name}
                          </Link>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {new Date(cmp.createdAt).toLocaleDateString()} at {new Date(cmp.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-300">
                          {cmp.targetAudienceType} ({cmp.totalRecipients})
                        </td>
                        <td className="py-3">
                          <div className="w-24">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>{pct}%</span>
                              <span>{cmp.sentCount + cmp.deliveredCount + cmp.readCount}/{cmp.totalRecipients}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-semibold text-purple-600 dark:text-purple-400">
                          {rPct}%
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            cmp.status === "COMPLETED" 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : cmp.status === "RUNNING"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {cmp.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <Link 
                            href={`/campaigns/${cmp.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors"
                          >
                            <span>Report</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No campaigns launched yet</p>
              <p className="text-[11px] text-slate-400">Launch your first broadcast campaign to see live delivery metrics.</p>
              <div className="pt-2">
                <Link
                  href="/campaigns/new"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Campaign</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* CRM Shortcuts & Channel Health */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Quick Actions Hub */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              CRM Action Center
            </h3>
            
            <div className="space-y-2 text-xs font-semibold">
              
              <Link 
                href="/contacts" 
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  <span>Import Contact Audience (CSV)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link 
                href="/templates" 
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>Broadcast Templates ({metrics.templatesCount})</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link 
                href="/auto-reply" 
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4 text-purple-500" />
                  <span>Auto-Reply Rules ({metrics.autoReplyCount} Active)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link 
                href="/unsubscribers" 
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <UserX className="w-4 h-4 text-rose-500" />
                  <span>Opt-Out / Unsubscribers ({metrics.unsubscribedCount})</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

            </div>
          </div>

          {/* Instance Telemetry Mini-Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Channel Health
              </span>
              <span className="text-[11px] text-slate-400">Anti-Ban Engine Active</span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-white">
                {metrics.activeInstanceName}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {metrics.activePhoneNumber || "No phone paired"}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Session Status:</span>
              <span className={`font-bold ${metrics.devicesStatus === "CONNECTED" ? "text-emerald-400" : "text-amber-400"}`}>
                {metrics.devicesStatus}
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
