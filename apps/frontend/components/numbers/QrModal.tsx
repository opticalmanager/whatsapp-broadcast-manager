"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import {
  X,
  Loader2,
  CheckCircle2,
  Smartphone,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
  onSuccess: () => void;
}

export function QrModal({ isOpen, onClose, shopId, shopName, onSuccess }: QrModalProps) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<"LOADING_SESSION" | "INITIALIZING" | "GENERATING_QR" | "CONNECTED" | "ERROR">("LOADING_SESSION");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Store volatile prop references in refs to prevent useEffect infinite loops
  const propsRef = useRef({ onClose, onSuccess, shopId, shopName });
  useEffect(() => {
    propsRef.current = { onClose, onSuccess, shopId, shopName };
  }, [onClose, onSuccess, shopId, shopName]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    console.log(`[QrModal ${ts}] ${msg}`);
    setDebugLog((prev) => [...prev.slice(-4), `${ts}: ${msg}`]);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQrBase64(null);
      setStatus("LOADING_SESSION");
      setErrorMessage(null);
      setConnectedNumber(null);
      setDebugLog([]);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function startConnection() {
      addLog("Fetching session from /api/session...");
      let session: any;
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        if (!data.authenticated || !data.session) {
          if (!cancelled) {
            setStatus("ERROR");
            setErrorMessage("No active session. Please launch from OpticalManager CRM first.");
          }
          return;
        }
        session = data.session;
        addLog(`Session OK: ${session.email} (org: ${session.organizationId?.slice(0, 8)}...)`);
      } catch (err: any) {
        if (!cancelled) {
          setStatus("ERROR");
          setErrorMessage("Cannot reach session API. Is the frontend server running?");
        }
        return;
      }

      if (cancelled) return;
      setStatus("INITIALIZING");

      const backendUrl = getBackendUrl();
      const sessionToken = JSON.stringify(session);

      addLog(`Connecting WebSocket to ${backendUrl}/ws/whatsapp...`);
      const socket: Socket = io(`${backendUrl}/ws/whatsapp`, {
        transports: ["websocket", "polling"],
        query: { token: sessionToken },
        timeout: 10000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        addLog(`WebSocket connected (id: ${socket.id}). Triggering WhatsApp pairing init...`);

        fetch(`${backendUrl}/api/v1/whatsapp-numbers/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ shopId: propsRef.current.shopId }),
        })
          .then(async (res) => {
            const body = await res.json();
            if (!res.ok) {
              addLog(`Init FAILED: ${res.status} - ${body.message || "Unknown error"}`);
              if (!cancelled) {
                setStatus("ERROR");
                setErrorMessage(body.message || `Backend error (${res.status})`);
              }
            } else {
              addLog(`Init OK: numberId=${body.numberId}, waiting for secure pairing QR...`);
            }
          })
          .catch((err) => {
            addLog(`Init network error: ${err.message}`);
            if (!cancelled) {
              setStatus("ERROR");
              setErrorMessage(`Cannot reach backend at ${backendUrl}. Is it running?`);
            }
          });
      });

      socket.on("connect_error", (err) => {
        addLog(`WebSocket error: ${err.message}`);
        if (!cancelled) {
          setStatus("ERROR");
          setErrorMessage(`Cannot connect to backend WebSocket at ${backendUrl}. Is the backend running on port 4000?`);
        }
      });

      socket.on("qr_code", (data: { numberId: string; qrBase64: string }) => {
        addLog("Secure QR code received!");
        if (!cancelled && data.qrBase64) {
          setQrBase64(data.qrBase64);
          setStatus("GENERATING_QR");
        }
      });

      socket.on("session_connected", (data: { numberId: string; phoneNumber: string; displayName: string }) => {
        addLog(`Connected! Phone: ${data.phoneNumber}`);
        if (!cancelled) {
          setStatus("CONNECTED");
          setConnectedNumber(data.phoneNumber);
          toast.success(`WhatsApp linked successfully for ${propsRef.current.shopName}!`);
          setTimeout(() => {
            propsRef.current.onSuccess();
            propsRef.current.onClose();
          }, 1500);
        }
      });

      socket.on("status_changed", (data: { numberId: string; status: string; reason?: string }) => {
        addLog(`Status: ${data.status} — ${data.reason || ""}`);
        if (!cancelled && data.status === "ERROR") {
          setStatus("ERROR");
          setErrorMessage(data.reason || "WhatsApp pairing session failed.");
        }
      });
    }

    startConnection();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isOpen, addLog]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Link Store WhatsApp Number</h2>
              <p className="text-xs text-slate-400">{shopName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="text-center py-2 space-y-4">
          {(status === "LOADING_SESSION" || status === "INITIALIZING") && (
            <div className="py-12 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  {status === "LOADING_SESSION" ? "Loading session..." : "Connecting to WhatsApp Servers..."}
                </p>
                <p className="text-xs text-slate-400">
                  {status === "LOADING_SESSION" ? "Validating owner credentials" : "Generating secure multi-device pairing key"}
                </p>
              </div>
            </div>
          )}

          {status === "GENERATING_QR" && qrBase64 && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl inline-block shadow-xl border-4 border-emerald-500/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrBase64} alt="WhatsApp QR Code" className="w-56 h-56 mx-auto rounded-lg shadow-sm" />
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2">
                <p className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Pairing Instructions:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Open <strong className="text-slate-200">WhatsApp</strong> on your Store phone</li>
                  <li>Tap <strong className="text-slate-200">Settings</strong> <span className="text-emerald-400 font-bold">→</span> <strong className="text-slate-200">Linked Devices</strong></li>
                  <li>Tap <strong className="text-slate-200">Link a Device</strong> and scan the QR code</li>
                </ol>
              </div>
            </div>
          )}

          {status === "CONNECTED" && (
            <div className="py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">WhatsApp Linked Successfully!</h3>
                <p className="text-xs text-slate-400">{connectedNumber || "Store number active"}</p>
              </div>
            </div>
          )}

          {status === "ERROR" && (
            <div className="py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Connection Error</h3>
                <p className="text-xs text-rose-400 max-w-xs mx-auto">{errorMessage}</p>
              </div>
              <button
                onClick={() => {
                  setStatus("LOADING_SESSION");
                  setQrBase64(null);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all border-none cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}
        </div>

        {/* Debug Log (development only) */}
        {debugLog.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-mono text-slate-500 space-y-0.5 max-h-24 overflow-y-auto">
            {debugLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
