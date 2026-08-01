"use client";

import React, { useEffect, useState } from "react";
import { 
  X, 
  Loader2, 
  CheckCircle2, 
  Smartphone, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle 
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
  const [status, setStatus] = useState<"INITIALIZING" | "GENERATING_QR" | "CONNECTED" | "ERROR">("INITIALIZING");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQrBase64(null);
      setStatus("INITIALIZING");
      setErrorMessage(null);
      return;
    }

    // Connect to WebSocket Gateway
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
    const socket: Socket = io(`${backendUrl}/ws/whatsapp`, {
      transports: ["websocket"],
      query: { token: "demo-token" }, // Will pass actual token
    });

    socket.on("connect", () => {
      console.log("[QrModal] WebSocket connected for QR stream");
      setStatus("GENERATING_QR");
    });

    socket.on("qr_code", (data: { numberId: string; qrBase64: string; status: string }) => {
      setQrBase64(data.qrBase64);
      setStatus("GENERATING_QR");
    });

    socket.on("session_connected", (data: { numberId: string; phoneNumber: string; displayName: string }) => {
      setStatus("CONNECTED");
      setConnectedNumber(data.phoneNumber);
      toast.success(`WhatsApp linked successfully for ${shopName}!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    });

    socket.on("status_changed", (data: { numberId: string; status: string; reason?: string }) => {
      if (data.status === "ERROR") {
        setStatus("ERROR");
        setErrorMessage(data.reason || "Failed to initialize Baileys session.");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, shopId, shopName, onClose, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Link WhatsApp Number</h2>
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

        {/* Content Area */}
        <div className="text-center py-4 space-y-4">
          {status === "INITIALIZING" && (
            <div className="py-12 space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-medium">
                Spinning up Baileys multi-device engine...
              </p>
            </div>
          )}

          {status === "GENERATING_QR" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl inline-block shadow-xl border-4 border-emerald-500/20 relative group">
                {qrBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrBase64} alt="WhatsApp QR Code" className="w-56 h-56 mx-auto rounded-lg" />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500 rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold">Generating QR...</span>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2 text-slate-300">
                <p className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Pairing Instructions:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>Open <strong>WhatsApp</strong> on your phone</li>
                  <li>Tap <strong>Menu</strong> or <strong>Settings</strong> $\rightarrow$ <strong>Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong> and point camera at screen</li>
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
                <p className="text-xs text-slate-400">{connectedNumber || "Connected to store instance"}</p>
              </div>
            </div>
          )}

          {status === "ERROR" && (
            <div className="py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Connection Failed</h3>
                <p className="text-xs text-rose-400 max-w-xs mx-auto">{errorMessage}</p>
              </div>
              <button
                onClick={() => setStatus("INITIALIZING")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Pair</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
