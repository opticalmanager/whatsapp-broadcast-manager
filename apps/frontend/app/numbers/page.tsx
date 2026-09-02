"use client";

import React, { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { 
  Smartphone, 
  CheckCircle2, 
  QrCode, 
  ShieldCheck, 
  RefreshCw, 
  LogOut, 
  Send,
  Loader2,
  AlertCircle,
  Wifi,
  Clock
} from "lucide-react";
import { QrModal } from "@/components/numbers/QrModal";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface LiveNumberData {
  numberId: string;
  organizationId: string;
  shopId: string;
  phoneNumber: string | null;
  displayName: string;
  status: "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT" | "INITIALIZING";
  connectedAt: number | null;
}

export default function StoreWhatsAppNumberPage() {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LiveNumberData | null>(null);
  
  // Test Message Form State
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from OpticalManager Broadcast! Your store WhatsApp connection is active.");
  const [sendingTest, setSendingTest] = useState(false);

  const backendUrl = getBackendUrl();

  // Fetch session data from server-side API (reads httpOnly cookie)
  const fetchLiveStatus = async () => {
    try {
      setLoading(true);
      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.authenticated || !sessionData.session) {
        toast.error("Session expired. Please launch from OpticalManager CRM.");
        setLoading(false);
        return;
      }

      const sessionToken = JSON.stringify(sessionData.session);
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch number status (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err: any) {
      console.error("[NumbersPage] Error fetching live status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStatus();

    // Setup WebSockets listener for real-time connection state updates
    fetch("/api/session").then((res) => res.json()).then((sessionData) => {
      if (!sessionData.authenticated) return;
      const socket: Socket = io(`${backendUrl}/ws/whatsapp`, {
        transports: ["websocket", "polling"],
        query: { token: JSON.stringify(sessionData.session) },
      });

      socket.on("session_connected", (payload) => {
        toast.success("WhatsApp outlet linked & active!");
        fetchLiveStatus();
      });

      socket.on("status_changed", (payload) => {
        fetchLiveStatus();
      });

      return () => {
        socket.disconnect();
      };
    });
  }, []);

  const handleDisconnect = async () => {
    if (!data?.numberId) return;
    try {
      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();
      const sessionToken = JSON.stringify(sessionData.session);

      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/${data.numberId}/disconnect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (res.ok) {
        toast.success("WhatsApp device disconnected & session purged.");
        fetchLiveStatus();
      } else {
        toast.error("Failed to disconnect WhatsApp device.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error disconnecting device.");
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      toast.error("Please provide both target phone number and message body.");
      return;
    }

    try {
      setSendingTest(true);
      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.authenticated) {
        toast.error("Session expired.");
        return;
      }

      const sessionToken = JSON.stringify(sessionData.session);
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          recipientPhoneNumber: testPhone,
          messageText: testMessage,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Live test WhatsApp message sent successfully!");
        setTestMessage("Hello from OpticalManager Broadcast! Your store WhatsApp connection is active.");
      } else {
        toast.error(json.message || "Failed to send test message.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error sending test message.");
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = data?.status === "CONNECTED";

  return (
    <div className="space-y-8 max-w-4xl mx-auto select-none">
      {/* Top Page Header */}
      <div className="border-b border-slate-800/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Store WhatsApp Connection Hub
            </h1>
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Owner Instance
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry and single-device session control for your optical store's WhatsApp marketing engine.
          </p>
        </div>

        <button
          onClick={() => setIsQrModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer border-none"
        >
          <QrCode className="w-4 h-4" />
          <span>{isConnected ? "Re-pair WhatsApp QR" : "Link WhatsApp Device"}</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading live WhatsApp session status...</p>
        </div>
      ) : (
        <>
          {/* Live Store WhatsApp Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${
                  isConnected 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  <Smartphone className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-lg tracking-tight">
                      {data?.displayName || "Optical Store Outlet"}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                      isConnected 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}>
                      {isConnected ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {data?.status || "DISCONNECTED"}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-slate-300">
                    {data?.phoneNumber || "No active device paired"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isConnected ? (
                  <button
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 text-xs font-semibold transition-colors border-none cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all border-none cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Pair Device QR</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Telemetry Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Protocol Engine</span>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  WhatsApp Multi-Device Engine
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Session Status</span>
                <p className={`text-sm font-bold flex items-center gap-1.5 ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>
                  <Wifi className="w-4 h-4" />
                  {isConnected ? "Active Stream" : "Offline"}
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Connected Uptime</span>
                <p className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  {data?.connectedAt ? new Date(data.connectedAt).toLocaleTimeString() : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Live Test Dispatcher */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Quick Live Test Dispatcher</h3>
                <p className="text-xs text-slate-400">Send a real-time WhatsApp message to test device outlet connectivity.</p>
              </div>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Recipient Phone Number (with Country Code)</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    disabled={!isConnected || sendingTest}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Test Message Body</label>
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Enter test message content"
                    disabled={!isConnected || sendingTest}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!isConnected || sendingTest}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer border-none disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                >
                  {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{sendingTest ? "Dispatching..." : "Send Test Message"}</span>
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* QR Pairing Modal */}
      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        shopId={data?.shopId || "shop-main"}
        shopName={data?.displayName || "Optical Store Outlet"}
        onSuccess={fetchLiveStatus}
      />
    </div>
  );
}
