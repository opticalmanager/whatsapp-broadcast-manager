"use client";

import React, { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FileText,
  MessageSquare,
  CheckCircle2,
  Send,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface DashboardMetrics {
  devicesCount: number;
  devicesStatus: "CONNECTED" | "DISCONNECTED";
  autoReplyCount: number;
  welcomeMessageCount: number;
  templatesCount: number;
  totalCampaigns: number;

  totalMessages: number;
  pendingMessages: number;
  autoReplyMessages: number;
  welcomeMessages: number;
  sentMessages: number;
  pausedMessages: number;

  errorWhileSending: number;
  invalidNumber: number;
  cancelledMessages: number;
  instanceNotConnected: number;
  instanceNotFound: number;
  notAWhatsAppNumber: number;

  totalSubscribers: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, getAuthHeaders } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    devicesCount: 1,
    devicesStatus: "CONNECTED",
    autoReplyCount: 2,
    welcomeMessageCount: 0,
    templatesCount: 1,
    totalCampaigns: 3,

    totalMessages: 8,
    pendingMessages: 0,
    autoReplyMessages: 3,
    welcomeMessages: 0,
    sentMessages: 5,
    pausedMessages: 0,

    errorWhileSending: 0,
    invalidNumber: 0,
    cancelledMessages: 0,
    instanceNotConnected: 0,
    instanceNotFound: 0,
    notAWhatsAppNumber: 0,

    totalSubscribers: 0,
  });
  const [loading, setLoading] = useState(true);

  const backendUrl = getBackendUrl();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchMetrics = async (showLoading = false) => {
    if (!isAuthenticated) return;
    try {
      if (showLoading) setLoading(true);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/analytics/dashboard`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setMetrics(json.data);
        }
      }
    } catch {
      // Silent fallback
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMetrics(true);
      const interval = setInterval(() => fetchMetrics(false), 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-xs font-semibold">Loading marketing panel...</p>
      </div>
    );
  }

  // Circular progress ring with high contrast and visible background track
  const ProgressRing = ({ percentage = 0, color = "blue" }: { percentage?: number; color?: "blue" | "green" | "gray" }) => {
    const strokeColor = color === "blue" ? "#2563eb" : color === "green" ? "#10b981" : "#cbd5e1";
    const bgStroke = "#e2e8f0";
    const radius = 11;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <svg className="w-7 h-7 transform -rotate-90 shrink-0" viewBox="0 0 30 30">
        <circle
          cx="15"
          cy="15"
          r={radius}
          stroke={bgStroke}
          strokeWidth="3.5"
          className="dark:stroke-slate-800"
          fill="transparent"
        />
        {percentage > 0 ? (
          <circle
            cx="15"
            cy="15"
            r={radius}
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        ) : (
          <circle
            cx="15"
            cy="15"
            r={radius}
            stroke="#cbd5e1"
            strokeWidth="2"
            className="dark:stroke-slate-700"
            fill="transparent"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* =========================================================================
          ROW 1: TOP 5 SUMMARY RESOURCE CARDS (Elevated White on Warm Background)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* 1. Devices Card */}
        <Link href="/devices" className="bg-white dark:bg-[#111726] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] hover:border-slate-300 transition-all duration-200">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
            Devices
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.075-1.745-.386-1.423-.59-2.34-2.033-2.41-2.128-.071-.095-.572-.76-.572-1.448 0-.687.362-1.026.49-1.168.129-.142.28-.178.373-.178.094 0 .188.002.27.006.088.004.204-.033.319.243.12.288.409 1.002.445 1.076.036.074.06.16.012.256-.048.096-.072.155-.144.238-.073.083-.153.185-.219.249-.073.072-.149.15-.064.296.085.145.378.623.81 1.008.558.497 1.029.65 1.174.722.146.073.232.064.318-.036.087-.1.373-.435.474-.585.1-.15.201-.125.337-.075.136.05 1.007.474 1.18.56.173.087.288.13.33.203.043.074.043.43-.101.835z"/>
              </svg>
            </div>
            <span className="text-base font-extrabold text-slate-800 dark:text-white">
              {metrics.devicesCount} Instance
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className={`w-2 h-2 rounded-full ${metrics.devicesCount > 0 ? "bg-emerald-500 shadow-xs" : "bg-rose-500"}`} />
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Text</span>
          </div>
        </Link>

        {/* 2. Auto Reply Card */}
        <Link href="/auto-reply" className="bg-white dark:bg-[#111726] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] hover:border-slate-300 transition-all duration-200">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
            Auto Reply
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-base font-extrabold text-slate-800 dark:text-white">
              {metrics.autoReplyCount}
            </span>
          </div>
        </Link>

        {/* 3. WelcomeMessage Card */}
        <Link href="/welcome-message" className="bg-white dark:bg-[#111726] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] hover:border-slate-300 transition-all duration-200">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
            WelcomeMessage
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-base font-extrabold text-slate-800 dark:text-white">
              {metrics.welcomeMessageCount}
            </span>
          </div>
        </Link>

        {/* 4. Templates Card */}
        <Link href="/templates" className="bg-white dark:bg-[#111726] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] hover:border-slate-300 transition-all duration-200">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
            Templates
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-base font-extrabold text-slate-800 dark:text-white">
              {metrics.templatesCount}
            </span>
          </div>
        </Link>

        {/* 5. Total Campaigns Card */}
        <Link href="/send-message" className="bg-white dark:bg-[#111726] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)] hover:border-slate-300 transition-all duration-200">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
            Total Campaigns
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <span className="text-base font-extrabold text-slate-800 dark:text-white">
              {metrics.totalCampaigns}
            </span>
          </div>
        </Link>
      </div>

      {/* =========================================================================
          ROW 2: 6 REAL-TIME STATUS KPI CARDS (WITH HIGH-CONTRAST PROGRESS RINGS)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* 1. Total Messages */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.totalMessages}
            </span>
            <ProgressRing percentage={100} color="blue" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Total Messages
          </p>
        </div>

        {/* 2. Pending Messages */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.pendingMessages}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Pending Messages
          </p>
        </div>

        {/* 3. Auto Reply Messages */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.autoReplyMessages}
            </span>
            <ProgressRing percentage={40} color="blue" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Auto Reply Messages
          </p>
        </div>

        {/* 4. Welcome Message */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.welcomeMessages}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Welcome Message
          </p>
        </div>

        {/* 5. Message Sent */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.sentMessages}
            </span>
            <ProgressRing percentage={75} color="green" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Message Sent
          </p>
        </div>

        {/* 6. Paused Messages */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.pausedMessages}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Paused Messages
          </p>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: 6 DIAGNOSTIC & FAILURE MONITORING CARDS
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* 7. Error While Sending */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.errorWhileSending}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 leading-snug">
            Error While Sending
          </p>
        </div>

        {/* 8. Invalid Number */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.invalidNumber}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 leading-snug">
            Invalid Number
          </p>
        </div>

        {/* 9. Cancelled Messages */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.cancelledMessages}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 leading-snug">
            Cancelled Messages
          </p>
        </div>

        {/* 10. Instance Not Connected While Sending */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.instanceNotConnected}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 leading-snug">
            Instance Not Connected While Sending
          </p>
        </div>

        {/* 11. Instance Not Found While Sending */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.instanceNotFound}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 leading-snug">
            Instance Not Found While Sending
          </p>
        </div>

        {/* 12. Not A WhatsApp Number */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.notAWhatsAppNumber}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 leading-snug">
            Not A WhatsApp Number
          </p>
        </div>
      </div>

      {/* =========================================================================
          ROW 4: SUBSCRIBERS
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* 13. Total Subscriber */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {metrics.totalSubscribers}
            </span>
            <ProgressRing percentage={0} color="gray" />
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3">
            Total Subscriber
          </p>
        </div>
      </div>

    </div>
  );
}
