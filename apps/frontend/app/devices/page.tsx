"use client";

import React, { useState, useEffect, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { 
  Plus, 
  Edit3, 
  LogOut, 
  Trash2, 
  QrCode, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Smartphone,
  ShieldCheck,
  Sparkles,
  Loader2,
  Timer,
  User
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  organizationId: string;
  phoneNumber: string | null;
  displayName: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "LOGGED_OUT" | "INITIALIZING" | "GENERATING_QR";
  qrBase64?: string;
  connectedAt: string | null;
  notes?: string;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  accountMaturityType?: "FRESH" | "MATURED";
  warmupStartedAt?: string | null;
  currentWarmupDay?: number;
  warmupWeek?: number;
  dailySentToday?: number;
  dailyLimit?: number;
}

export default function DevicesPage() {
  const { user: authUser, getAuthHeaders, isAuthenticated } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [selectedInstanceForQr, setSelectedInstanceForQr] = useState<WhatsAppInstance | null>(null);
  const [editingInstance, setEditingInstance] = useState<WhatsAppInstance | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceNotes, setNewInstanceNotes] = useState("");
  const [newMaturityType, setNewMaturityType] = useState<"FRESH" | "MATURED">("FRESH");
  const [editMaturityType, setEditMaturityType] = useState<"FRESH" | "MATURED">("MATURED");
  const [actionLoading, setActionLoading] = useState(false);
  const [savedDelays, setSavedDelays] = useState<Record<string, { min: number; max: number }>>({});
  const [delaySettings, setDelaySettings] = useState<Record<string, { min: number | string; max: number | string }>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved">>({});
  const socketRef = useRef<Socket | null>(null);

  const backendUrl = getBackendUrl();

  const fetchInstances = async (showLoading = false) => {
    if (!isAuthenticated) return;
    try {
      if (showLoading) setLoading(true);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setInstances(json.data);
          
          // Track saved vs editing values
          const serverSaved: Record<string, { min: number; max: number }> = {};
          json.data.forEach((inst: WhatsAppInstance) => {
            serverSaved[inst.id] = {
              min: inst.minDelaySeconds ?? 5,
              max: inst.maxDelaySeconds ?? 30,
            };
          });
          setSavedDelays((prev) => ({ ...serverSaved, ...prev }));

          setDelaySettings((prev) => {
            const next = { ...prev };
            json.data.forEach((inst: WhatsAppInstance) => {
              if (!next[inst.id]) {
                next[inst.id] = {
                  min: inst.minDelaySeconds ?? 5,
                  max: inst.maxDelaySeconds ?? 30,
                };
              }
            });
            return next;
          });
        }
      }
    } catch {
      // Quiet background polling fallback
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleDelayChange = (instanceId: string, field: "min" | "max", val: string) => {
    setDelaySettings((prev) => {
      const current = prev[instanceId] || { min: 5, max: 30 };
      return {
        ...prev,
        [instanceId]: {
          ...current,
          [field]: val === "" ? "" : Math.max(1, parseInt(val, 10) || 1),
        },
      };
    });
  };

  const handleSaveDelay = async (instanceId: string) => {
    const current = delaySettings[instanceId] || { min: 5, max: 30 };
    const minVal = Math.max(1, Math.min(Number(current.min) || 5, 300));
    const maxVal = Math.max(minVal, Math.min(Number(current.max) || 30, 300));

    // Update state to valid numbers
    setDelaySettings((prev) => ({
      ...prev,
      [instanceId]: { min: minVal, max: maxVal },
    }));

    setSaveStatus((prev) => ({ ...prev, [instanceId]: "saving" }));
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances/${instanceId}/delay-settings`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          minDelaySeconds: minVal,
          maxDelaySeconds: maxVal,
        }),
      });

      if (res.ok) {
        setSavedDelays((prev) => ({
          ...prev,
          [instanceId]: { min: minVal, max: maxVal },
        }));
        setSaveStatus((prev) => ({ ...prev, [instanceId]: "saved" }));
        toast.success(`Anti-ban delay updated: ${minVal}s → ${maxVal}s`);

        // Automatically hide the button after 1.5s
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [instanceId]: "idle" }));
        }, 1500);
      } else {
        setSaveStatus((prev) => ({ ...prev, [instanceId]: "idle" }));
        toast.error("Failed to update delay settings");
      }
    } catch {
      setSaveStatus((prev) => ({ ...prev, [instanceId]: "idle" }));
      toast.error("Network error saving delay settings");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInstances(true);
    const interval = setInterval(() => fetchInstances(false), 3000);

    // Setup real-time WebSocket connection for instant QR code delivery
    const token = typeof window !== 'undefined' ? localStorage.getItem('broadcast_token') : null;
    const socket: Socket = io(`${backendUrl}/ws/whatsapp`, {
      transports: ["websocket", "polling"],
      query: { token: token || "" },
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("qr_code", (payload: { numberId: string; qrBase64: string; status?: string }) => {
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === payload.numberId
            ? { ...inst, qrBase64: payload.qrBase64, status: "GENERATING_QR" }
            : inst
        )
      );
      setSelectedInstanceForQr((prev) => {
        if (prev && prev.id === payload.numberId) {
          return { ...prev, qrBase64: payload.qrBase64, status: "GENERATING_QR" };
        }
        return prev;
      });
    });

    socket.on("session_connected", (payload: { numberId: string; phoneNumber?: string; displayName?: string }) => {
      toast.success(`WhatsApp Outlet ${payload.displayName || payload.numberId} Connected & Active!`);
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === payload.numberId
            ? { ...inst, status: "CONNECTED", phoneNumber: payload.phoneNumber || inst.phoneNumber, qrBase64: undefined }
            : inst
        )
      );
      setSelectedInstanceForQr((prev) => {
        if (prev && prev.id === payload.numberId) {
          return { ...prev, status: "CONNECTED", phoneNumber: payload.phoneNumber || prev.phoneNumber, qrBase64: undefined };
        }
        return prev;
      });
      fetchInstances(false);
    });

    socket.on("status_changed", (payload: { numberId: string; status: any }) => {
      fetchInstances(false);
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [isAuthenticated]);

  // Dedicated rapid poll for QR when modal is open
  useEffect(() => {
    if (!selectedInstanceForQr || selectedInstanceForQr.status === "CONNECTED") return;
    const qrInterval = setInterval(async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances/${selectedInstanceForQr.id}/qr`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            if (json.data.qrBase64) {
              setSelectedInstanceForQr((prev) => prev ? { ...prev, qrBase64: json.data.qrBase64, status: json.data.status } : null);
            }
            if (json.data.status === "CONNECTED") {
              setSelectedInstanceForQr((prev) => prev ? { ...prev, status: "CONNECTED", phoneNumber: json.data.phoneNumber, qrBase64: undefined } : null);
              fetchInstances(false);
            }
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(qrInterval);
  }, [selectedInstanceForQr?.id, selectedInstanceForQr?.status]);

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) {
      toast.error("Please enter an instance name");
      return;
    }

    try {
      setActionLoading(true);
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          instanceName: newInstanceName, 
          notes: newInstanceNotes,
          accountMaturityType: newMaturityType 
        }),
      });

      if (res.ok) {
        const json = await res.json();
        toast.success("New instance created! Pairing socket started.");
        setIsCreating(false);
        setNewInstanceName("");
        setNewInstanceNotes("");
        setNewMaturityType("FRESH");
        fetchInstances();
        if (json.data) {
          setSelectedInstanceForQr(json.data);
        }
      } else {
        toast.error("Failed to create instance");
      }
    } catch (err: any) {
      toast.error(err.message || "Error creating instance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInstance) return;

    try {
      setActionLoading(true);
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances/${editingInstance.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ 
          instanceName: editName, 
          notes: editNotes,
          accountMaturityType: editMaturityType
        }),
      });

      if (res.ok) {
        toast.success("Instance updated successfully");
        setEditingInstance(null);
        fetchInstances();
      }
    } catch (err: any) {
      toast.error("Failed to update instance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogoutInstance = async (instanceId: string) => {
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances/${instanceId}/logout`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        toast.success("Instance logged out successfully");
        fetchInstances();
      }
    } catch {
      toast.error("Error logging out instance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm("Are you sure you want to delete this WhatsApp instance? All auth files will be removed.")) return;
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances/${instanceId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        toast.success("Instance deleted");
        fetchInstances();
      }
    } catch {
      toast.error("Error deleting instance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowQr = async (instance: WhatsAppInstance) => {
    if (instance.status === "CONNECTED") {
      setSelectedInstanceForQr(instance);
      return;
    }
    // Start with fresh loading state (never show stale QR)
    setSelectedInstanceForQr({ ...instance, qrBase64: undefined, status: "INITIALIZING" });
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances/${instance.id}/reconnect`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.qrBase64) {
          setSelectedInstanceForQr((prev) => prev && prev.id === instance.id ? { ...prev, qrBase64: json.data.qrBase64, status: "GENERATING_QR" } : prev);
        }
      }
      fetchInstances(false);
    } catch {}
  };

    const userName = authUser?.fullName ? authUser.fullName.split(" ")[0] : "Raman";

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Top Banner Header Clean & Sleek */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            WhatsApp Devices
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pair and manage multiple WhatsApp numbers for round-robin broadcast load balancing.
          </p>
        </div>

        {/* Create Instance Button */}
        <div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Instance</span>
          </button>
        </div>
      </div>

      {/* Simple & Clean Total Daily Capacity Box */}
      {(() => {
        const connectedList = instances.filter((i) => i.status === "CONNECTED");
        const totalConnected = connectedList.length;
        const totalSentToday = instances.reduce((sum, i) => sum + (i.dailySentToday || 0), 0);
        const totalPoolCapacity = connectedList.reduce(
          (sum, i) => sum + (i.dailyLimit || (i.accountMaturityType === "FRESH" ? 50 : 500)),
          0
        );
        const poolProgress =
          totalPoolCapacity > 0
            ? Math.min(100, Math.round((totalSentToday / totalPoolCapacity) * 100))
            : 0;

        return (
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3 max-w-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Total Daily Sending Capacity
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                    {totalConnected} Active {totalConnected === 1 ? "Device" : "Devices"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Combined 24-hour dispatch quota across all connected WhatsApp numbers.
                </p>
              </div>

              <div className="sm:text-right shrink-0">
                <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                  {totalSentToday} / {totalPoolCapacity} msgs
                </span>
                <span className="text-[11px] text-slate-400 block font-medium">
                  {poolProgress}% used today
                </span>
              </div>
            </div>

            {/* Sleek Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${poolProgress}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Main Devices Cards */}
      <div className="space-y-4 max-w-2xl">
        {instances.length === 0 && !loading ? (
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Connected Devices</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Create an instance and scan the QR code using your WhatsApp mobile app to start broadcasting.
              </p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Device</span>
            </button>
          </div>
        ) : (
          instances.map((inst) => {
            const isReady = inst.status === "CONNECTED";
            const isQr = inst.status === "GENERATING_QR" || inst.status === "INITIALIZING";
            const isFresh = inst.accountMaturityType === "FRESH";
            const dailyLimit = inst.dailyLimit || (isFresh ? 50 : 500);
            const dailySent = inst.dailySentToday || 0;
            const progressPercent = Math.min(100, Math.round((dailySent / dailyLimit) * 100));

            return (
              <div 
                key={inst.id} 
                className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700/80 p-4 sm:p-5 space-y-3.5 transition-all"
              >
                {/* Top Section: Identity + Status + Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* Left: Avatar + Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xs">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      {/* Live Status Indicator Dot */}
                      <span 
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#111726] ${
                          isReady ? "bg-emerald-500" : isQr ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                        }`} 
                      />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {inst.displayName || inst.instanceName || "WhatsApp Sender"}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingInstance(inst);
                            setEditName(inst.instanceName);
                            setEditNotes(inst.notes || "");
                            setEditMaturityType(inst.accountMaturityType || "MATURED");
                          }}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit instance properties"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                          {inst.phoneNumber ? `+${inst.phoneNumber.replace(/\D/g, "")}` : "No number paired yet"}
                        </span>
                        
                        {/* Maturity Badge */}
                        {isFresh ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                            🌿 Warmup Week {inst.warmupWeek || 1}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200/60 dark:border-blue-800/40">
                            ⚡ Matured (500/day)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    {/* Status Pill */}
                    {isReady ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                        Connected
                      </span>
                    ) : isQr ? (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-200/60 dark:border-amber-800/40 animate-pulse">
                        Pairing...
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
                        Disconnected
                      </span>
                    )}

                    {/* Disconnect / Show QR */}
                    {isReady ? (
                      <button
                        onClick={() => handleLogoutInstance(inst.id)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleShowQr(inst)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Show QR</span>
                      </button>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={() => handleDeleteInstance(inst.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer border border-rose-200/60 dark:border-rose-800/40"
                    >
                      Remove
                    </button>
                  </div>

                </div>

                {/* Bottom Section: Warmup Progress Bar or Matured Indicator */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  {isFresh ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span>🌿</span>
                          <span>Warmup Schedule: Day {inst.currentWarmupDay || 1}/28 (Week {inst.warmupWeek || 1})</span>
                        </span>
                        
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                          {dailySent} / {dailyLimit} sent today ({progressPercent}%)
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>Matured Account: 500 msgs/day Capacity</span>
                        </span>
                        
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                          {dailySent} / 500 sent today ({progressPercent}%)
                        </span>
                      </div>

                      {/* Visual Progress Bar for Matured */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* =========================================================================
          QR CODE MODAL (Matching Image 2 with Step-by-Step Instructions)
          ========================================================================= */}
      {selectedInstanceForQr && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#25D366]" />
                <span>QR Code — {selectedInstanceForQr.instanceName}</span>
              </h3>
              <button 
                onClick={() => setSelectedInstanceForQr(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {selectedInstanceForQr.status === "CONNECTED" ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    WhatsApp Connected Successfully!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    Linked Number: <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedInstanceForQr.phoneNumber || "Active"}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Your session cookies and encryption keys are synced and protected 24/7.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Left Column: High-Contrast QR Code */}
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {selectedInstanceForQr.qrBase64 ? (
                      <img 
                        src={selectedInstanceForQr.qrBase64} 
                        alt="WhatsApp QR Code"
                        className="w-52 h-52 rounded-xl shadow-xs"
                      />
                    ) : (
                      <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-400 space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                        <p className="text-xs font-semibold text-center">Generating Secure WhatsApp QR...</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500 font-medium">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Live Multi-Device Pairing</span>
                    </div>
                  </div>

                  {/* Right Column: Step-by-Step Instructions */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      To pair with WhatsApp:
                    </h4>

                    <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-slate-800 dark:text-white">1.</span>
                        <span>Open <strong>WhatsApp</strong> on your phone</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-slate-800 dark:text-white">2.</span>
                        <span>Tap <strong>Menu (⋮)</strong> or <strong>Settings (⚙)</strong> &gt; <strong>Linked Devices</strong></span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="font-bold text-slate-800 dark:text-white">3.</span>
                        <span>Tap <strong>Link a Device</strong> and scan the code on this screen</span>
                      </li>
                    </ol>

                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>End-to-end encrypted Multi-Device sync keeps your session connected 24/7.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer matching Image 2 */}
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#0e1320] border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedInstanceForQr(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => setSelectedInstanceForQr(null)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                Ok
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE INSTANCE MODAL
          ========================================================================= */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>Create WhatsApp Instance</span>
              </h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Instance Name / Outlet Identifier
                </label>
                <input
                  type="text"
                  required
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="e.g. Marketing Sender #2, Support Line"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Maturity Tier Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  WhatsApp Account Maturity & Warmup Tier
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Fresh Number */}
                  <div
                    onClick={() => setNewMaturityType("FRESH")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      newMaturityType === "FRESH"
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-lg">🌿</div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Fresh / New WhatsApp Number
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                          Safe Warmup
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Brand new SIM card. Activates automated 4-Week Anti-Ban warmup schedule (starts at 50/day and ramps up safely).
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Matured Number */}
                  <div
                    onClick={() => setNewMaturityType("MATURED")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      newMaturityType === "MATURED"
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-lg">⚡</div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Matured / Established Number
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                          500+/day
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Existing active WhatsApp number with history of sending 500+ messages per day. High-volume broadcast ready.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newInstanceNotes}
                  onChange={(e) => setNewInstanceNotes(e.target.value)}
                  placeholder="e.g. Secondary SIM card for festival dispatches"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Creating..." : "Create & Pair (QR)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT INSTANCE MODAL
          ========================================================================= */}
      {editingInstance && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                Edit Instance: {editingInstance.instanceName}
              </h3>
              <button onClick={() => setEditingInstance(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateInstance} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Instance Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Account Maturity Tier
                </label>
                <select
                  value={editMaturityType}
                  onChange={(e) => setEditMaturityType(e.target.value as "FRESH" | "MATURED")}
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="FRESH">🌿 Fresh Number (4-Week Warmup Schedule)</option>
                  <option value="MATURED">⚡ Matured Account (High-Volume Ready - 500+/day)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingInstance(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
