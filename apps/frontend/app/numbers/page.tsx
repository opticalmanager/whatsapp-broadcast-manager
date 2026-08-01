"use client";

import React, { useState } from "react";
import { 
  Smartphone, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  Radio,
  Battery
} from "lucide-react";
import { QrModal } from "@/components/numbers/QrModal";
import { toast } from "sonner";

interface WhatsAppNumberItem {
  id: string;
  shopName: string;
  phoneNumber: string;
  displayName: string;
  status: "CONNECTED" | "GENERATING_QR" | "RECONNECTING" | "LOGGED_OUT";
  batteryLevel: number;
  warmupTier: number;
}

export default function WhatsAppNumbersPage() {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<{ id: string; name: string }>({
    id: "shop-main-01",
    name: "Main Branch - Narsapur",
  });

  const [numbers, setNumbers] = useState<WhatsAppNumberItem[]>([
    {
      id: "num-01",
      shopName: "Main Branch - Narsapur",
      phoneNumber: "+91 98765 43210",
      displayName: "Narsapur Store Optical",
      status: "CONNECTED",
      batteryLevel: 94,
      warmupTier: 2,
    },
    {
      id: "num-02",
      shopName: "City Outlet Branch",
      phoneNumber: "+91 91234 56789",
      displayName: "City Outlet Support",
      status: "CONNECTED",
      batteryLevel: 82,
      warmupTier: 1,
    },
  ]);

  const handleOpenConnectModal = () => {
    setIsQrModalOpen(true);
  };

  const handleDisconnectNumber = (id: string) => {
    setNumbers((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "LOGGED_OUT" } : item
      )
    );
    toast.success("WhatsApp number disconnected successfully.");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              WhatsApp Multi-Number Engine
            </h1>
            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
              Store Owner Portal
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Pair and manage independent WhatsApp Business instances for each of your optical store branches.
          </p>
        </div>

        <button
          onClick={handleOpenConnectModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer border-none"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Outlet Number</span>
        </button>
      </div>

      {/* Number Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {numbers.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 relative overflow-hidden group shadow-xl"
          >
            {/* Top Bar */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base tracking-tight">{item.shopName}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.phoneNumber}</p>
                </div>
              </div>

              {/* Status Badge */}
              {item.status === "CONNECTED" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  CONNECTED
                </span>
              )}

              {item.status === "LOGGED_OUT" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-800 border border-slate-700 text-slate-400">
                  UNLINKED
                </span>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Battery Level
                </span>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Battery className="w-4 h-4 text-emerald-400" />
                  {item.batteryLevel}%
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Warm-Up Tier
                </span>
                <p className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Tier {item.warmupTier} (500 msgs/day)
                </p>
              </div>
            </div>

            {/* Card Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
              {item.status === "CONNECTED" ? (
                <button
                  onClick={() => handleDisconnectNumber(item.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors bg-transparent border-none cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect Session</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenConnectModal}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors bg-transparent border-none cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Pair with QR Code</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* QR Pairing Modal */}
      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        shopId={selectedShop.id}
        shopName={selectedShop.name}
        onSuccess={() => {
          setNumbers((prev) =>
            prev.map((num) =>
              num.shopName === selectedShop.name ? { ...num, status: "CONNECTED" } : num
            )
          );
        }}
      />
    </div>
  );
}
