"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import {
  X,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Send,
  Loader2,
  ShieldCheck,
  Wifi,
  Clock,
  Radio,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface WhatsAppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (isConnected: boolean) => void;
}

interface LiveSessionStatus {
  numberId: string;
  phoneNumber: string | null;
  displayName: string;
  status: "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT" | "INITIALIZING";
  connectedAt: number | null;
}

export function WhatsAppDrawer({ isOpen, onClose, onStatusChange }: WhatsAppDrawerProps) {
  const [data, setData] = useState<LiveSessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<"IDLE" | "INITIALIZING" | "GENERATING_QR" | "CONNECTED" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // Test Message Form State
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from OpticalManager Broadcast! Your WhatsApp store engine is active.");
  const [sendingTest, setSendingTest] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const backendUrl = getBackendUrl();

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-5), `${ts}: ${msg}`]);
  }, []);

  const fetchLiveStatus = useCallback(async () => {
    try {
      setLoading(true);
      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.authenticated || !sessionData.session) {
        setLoading(false);
        return;
      }

      const sessionToken = JSON.stringify(sessionData.session);
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          onStatusChange?.(json.data.status === "CONNECTED");
        }
      }
    } catch (err) {
      console.error("[WhatsAppDrawer] Error fetching status:", err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, onStatusChange]);

  useEffect(() => {
    if (isOpen) {
      fetchLiveStatus();
    }
  }, [isOpen, fetchLiveStatus]);

  const startPairing = async () => {
    setPairingStatus("INITIALIZING");
    setErrorMessage(null);
    setQrBase64(null);

    addLog("Fetching owner session...");
    let session: any;
    try {
      const res = await fetch("/api/session");
      const sData = await res.json();
      if (!sData.authenticated) {
        setPairingStatus("ERROR");
        setErrorMessage("Session expired. Please launch from OpticalManager CRM.");
        return;
      }
      session = sData.session;
    } catch (err: any) {
      setPairingStatus("ERROR");
      setErrorMessage("Frontend API unreachable.");
      return;
    }

    const sessionToken = JSON.stringify(session);
    addLog("Connecting WebSocket to backend...");

    const socket: Socket = io(`${backendUrl}/ws/whatsapp`, {
      transports: ["websocket", "polling"],
      query: { token: sessionToken },
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      addLog("WebSocket connected! Initializing WhatsApp Multi-Device session...");
      fetch(`${backendUrl}/api/v1/whatsapp-numbers/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ shopId: session.shopId || "shop-main", forceFresh: true }),
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) {
            setPairingStatus("ERROR");
            setErrorMessage(body.message || "Init failed.");
          } else {
            addLog("Engine initializing... Waiting for WhatsApp QR payload");
          }
        })
        .catch((err) => {
          setPairingStatus("ERROR");
          setErrorMessage(err.message || "Cannot reach backend server.");
        });
    });

    socket.on("qr_code", (payload: { qrBase64: string }) => {
      if (payload.qrBase64) {
        addLog("WhatsApp QR Code received!");
        setQrBase64(payload.qrBase64);
        setPairingStatus("GENERATING_QR");
      }
    });

    socket.on("session_connected", (payload) => {
      addLog(`Session CONNECTED! Phone: ${payload.phoneNumber}`);
      setPairingStatus("CONNECTED");
      toast.success("WhatsApp Linked & Ready!");
      fetchLiveStatus();
      setTimeout(() => {
        setPairingStatus("IDLE");
      }, 2000);
    });

    socket.on("status_changed", (payload) => {
      addLog(`Status update: ${payload.status} ${payload.reason || ""}`);
    });
  };

  const handleDisconnect = async () => {
    if (!data?.numberId) return;
    try {
      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();
      const sessionToken = JSON.stringify(sessionData.session);

      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/${data.numberId}/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (res.ok) {
        toast.success("WhatsApp outlet disconnected.");
        setPairingStatus("IDLE");
        fetchLiveStatus();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect.");
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testMessage.trim()) {
      toast.error("Please enter recipient phone number & message.");
      return;
    }

    try {
      setSendingTest(true);
      const sessionRes = await fetch("/api/session");
      const sessionData = await sessionRes.json();
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
        toast.success("Live test WhatsApp message sent!");
        setTestMessage("Hello from OpticalManager Broadcast! Your WhatsApp store engine is active.");
      } else {
        toast.error(json.message || "Failed to send test message.");
      }
    } catch (err: any) {
      toast.error(err.message || "Test dispatch error.");
    } finally {
      setSendingTest(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = data?.status === "CONNECTED";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">WhatsApp Engine Status</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Global Store Connection Manager</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Live Connection Status Card */}
            <div className="bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm dark:shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                    isConnected 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                  }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                      {data?.displayName || "Optical Store Outlet"}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {data?.phoneNumber || "No active phone linked"}
                    </p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex items-center gap-1 ${
                  isConnected 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
                }`}>
                  {isConnected ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {isConnected ? "WhatsApp Ready" : "Disconnected"}
                </span>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 space-y-0.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Sync Status</span>
                  <p className={`font-bold text-xs flex items-center gap-1 ${isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    <Wifi className="w-3 h-3" />
                    {isConnected ? "Live Stream" : "Offline"}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 space-y-0.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Connected Since</span>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    {data?.connectedAt ? new Date(data.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex items-center gap-2">
                {isConnected ? (
                  <button
                    onClick={handleDisconnect}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-500/10 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 text-xs font-semibold transition-all border-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect WhatsApp</span>
                  </button>
                ) : (
                  <button
                    onClick={startPairing}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all border-none cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Pair WhatsApp Device</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pairing QR Stream State */}
            {pairingStatus !== "IDLE" && (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-center">
                {(pairingStatus === "INITIALIZING" || (pairingStatus === "GENERATING_QR" && !qrBase64)) && (
                  <div className="py-4 space-y-2">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Connecting to WhatsApp Servers...</p>
                  </div>
                )}

                {pairingStatus === "GENERATING_QR" && qrBase64 && (
                  <div className="space-y-3">
                    <div className="bg-white p-2.5 rounded-xl inline-block border border-slate-200 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrBase64} alt="WhatsApp QR Code" className="w-44 h-44 mx-auto rounded" />
                    </div>
                    <div className="text-left text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Pairing Steps:
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                        <li>Open WhatsApp $\rightarrow$ Settings $\rightarrow$ Linked Devices</li>
                        <li>Tap Link a Device and point phone camera at QR</li>
                      </ol>
                    </div>
                  </div>
                )}

                {pairingStatus === "CONNECTED" && (
                  <div className="py-4 space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto animate-bounce" />
                    <p className="text-xs font-bold text-slate-900 dark:text-white">WhatsApp Connected!</p>
                  </div>
                )}

                {pairingStatus === "ERROR" && (
                  <div className="py-3 space-y-1.5">
                    <AlertCircle className="w-7 h-7 text-rose-500 mx-auto" />
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errorMessage || "Connection error."}</p>
                    <button
                      onClick={startPairing}
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-semibold"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Live Test Message Dispatcher */}
            {isConnected && (
              <div className="bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2.5">
                  <Send className="w-3.5 h-3.5 text-indigo-500" />
                  <h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Quick Test Dispatcher</h4>
                </div>

                <form onSubmit={handleSendTest} className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Phone Number</label>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Test Message</label>
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Message content"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sendingTest}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white text-xs font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{sendingTest ? "Sending..." : "Send Test Message"}</span>
                  </button>
                </form>
              </div>
            )}

            {/* Connection Logs */}
            {debugLogs.length > 0 && (
              <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-[10px] font-mono text-slate-500 space-y-0.5">
                <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Live Protocol Log</span>
                {debugLogs.map((log, i) => (
                  <div key={i} className="truncate">{log}</div>
                ))}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-center text-[10px] text-slate-400">
            OpticalManager Broadcast Engine v2.0 • Secured Multi-Device Service
          </div>
        </div>
      </div>
    </div>
  );
}
