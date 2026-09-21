"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { normalizePublicMediaUrl, isLikelyImageUrl } from "@/lib/media-url-utils";
import {
  FileText,
  Plus,
  Search,
  Send,
  Trash2,
  Edit2,
  Copy,
  Sparkles,
  Check,
  X,
  Loader2,
  Image as ImageIcon,
  Video,
  MessageSquare,
  BarChart2,
  CheckSquare,
  Eye,
  Crown,
  Sun,
  Glasses,
  CheckCircle2,
  Calendar,
  Gift,
  Tag,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Info,
  Layers,
  ShoppingBag,
  Percent,
  Clock,
  Upload,
  Link as LinkIcon,
  ShieldCheck,
  AlertTriangle,
  Smile,
  User,
  PhoneCall,
  Mail,
  Building2,
  FileCheck,
  CheckCheck,
  Lock,
  RefreshCw,
  PauseCircle,
  Globe,
  HelpCircle
} from "lucide-react";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("broadcast_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const BACKEND_URL = getBackendUrl();

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface TemplateItem {
  id: string;
  organizationId: string;
  shopId?: string;
  title: string;
  bodyText: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "PROMO" | "GREETING" | "REMINDER" | "VIP" | "TRANSACTIONAL" | "GENERAL" | string;
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  icon?: string;
  variables: Array<{ key: string; description: string; fallback?: string }>;
  // WABA Meta Fields
  metaTemplateId?: string;
  metaTemplateName?: string;
  metaStatus: "LOCAL_DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED";
  metaRejectionReason?: string;
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
  headerContent?: string;
  footerText?: string;
  buttons: TemplateButton[];
  sampleValues: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

type MetaStatusFilter = "ALL" | "APPROVED" | "PENDING" | "LOCAL_DRAFT" | "REJECTED";

const CATEGORY_DEFINITIONS: Array<{
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: "ALL", label: "All Categories", icon: Layers, color: "text-slate-700 dark:text-slate-300" },
  { id: "MARKETING", label: "Marketing", icon: Sun, color: "text-orange-600 dark:text-orange-400" },
  { id: "UTILITY", label: "Utility & Alerts", icon: CheckCircle2, color: "text-blue-600 dark:text-blue-400" },
  { id: "AUTHENTICATION", label: "Authentication (OTP)", icon: ShieldCheck, color: "text-purple-600 dark:text-purple-400" },
  { id: "PROMO", label: "Offers & Promos", icon: Tag, color: "text-rose-600 dark:text-rose-400" },
  { id: "VIP", label: "VIP & Loyalty", icon: Crown, color: "text-amber-600 dark:text-amber-400" },
];

const CRM_VARIABLE_SHORTCUTS = [
  { key: "{{1}}", label: "Customer Name", sample: "Rahul Sharma", icon: User },
  { key: "{{2}}", label: "Store / Business Name", sample: "OpticalManager", icon: Building2 },
  { key: "{{3}}", label: "City / Branch", sample: "Delhi Downtown", icon: Tag },
  { key: "{{4}}", label: "Promo / Order #", sample: "FESTIVE500", icon: Gift },
];

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  switch (category) {
    case "MARKETING":
    case "PROMO":
      return Sun;
    case "UTILITY":
    case "TRANSACTIONAL":
      return CheckCircle2;
    case "AUTHENTICATION":
      return ShieldCheck;
    case "VIP":
      return Crown;
    case "REMINDER":
      return Calendar;
    default:
      return MessageSquare;
  }
}

// Client-side image compression
async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<{ file: File; base64: string; originalKB: number; compressedKB: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
            const reader2 = new FileReader();
            reader2.onload = () => {
              const originalKB = Math.round(file.size / 1024);
              const compressedKB = Math.round(compressedFile.size / 1024);
              resolve({
                file: compressedFile,
                base64: reader2.result as string,
                originalKB,
                compressedKB,
              });
            };
            reader2.readAsDataURL(compressedFile);
          } else {
            resolve({
              file,
              base64: img.src,
              originalKB: Math.round(file.size / 1024),
              compressedKB: Math.round(file.size / 1024),
            });
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function WhatsAppTemplatesPage() {
  const router = useRouter();

  // State
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<MetaStatusFilter>("ALL");

  // WABA connection state
  const [wabaConnected, setWabaConnected] = useState<boolean>(false);
  const [wabaChecked, setWabaChecked] = useState<boolean>(false);

  // Syncing and Submitting States
  const [syncingMeta, setSyncingMeta] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/templates`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTemplates(json.data);
        }
      }
    } catch {
      toast.error("Failed to load WhatsApp templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Check WABA connection on mount
  useEffect(() => {
    async function checkWabaAndLoad() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/waba/config`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          const isConnected = json.success && json.data?.status === "CONNECTED";
          setWabaConnected(isConnected);
          setWabaChecked(true);

          // Auto-sync from Meta on first load if WABA is connected
          if (isConnected) {
            await fetchTemplates();
            // Silently attempt background sync to get latest approved templates
            try {
              const syncRes = await fetch(`${BACKEND_URL}/api/v1/templates/sync-from-meta`, {
                method: "POST",
                headers: getAuthHeaders(),
              });
              const syncJson = await syncRes.json();
              if (syncRes.ok && syncJson.success && syncJson.count > 0) {
                setLastSyncCount(syncJson.count);
                await fetchTemplates(); // Re-fetch after sync
              }
            } catch {
              // Silent background sync failure — don't show error to user
            }
          } else {
            await fetchTemplates();
          }
        } else {
          setWabaChecked(true);
          await fetchTemplates();
        }
      } catch {
        setWabaChecked(true);
        await fetchTemplates();
      }
    }
    checkWabaAndLoad();
  }, [fetchTemplates]);

  // 1-Click Sync Templates from Meta Cloud API
  const handleSyncFromMeta = async () => {
    try {
      setSyncingMeta(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/templates/sync-from-meta`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const count = json.count || 0;
        setLastSyncCount(count);
        toast.success(json.message || `Synchronized ${count} templates from Meta!`);
        fetchTemplates();
      } else {
        const msg = json.message || "Failed to sync templates from Meta.";
        // Check if it's a token expiry issue and prompt user
        if (msg.includes("190") || msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("token")) {
          toast.error(msg, {
            duration: 8000,
            action: {
              label: "Go to Settings",
              onClick: () => router.push("/settings#waba"),
            },
          });
        } else {
          toast.error(msg);
        }
      }
    } catch {
      toast.error("Network error while syncing templates from Meta.");
    } finally {
      setSyncingMeta(false);
    }
  };

  // 1-Click Submit Template to Meta for Verification
  const handleSubmitToMeta = async (id: string, title: string) => {
    try {
      setSubmittingId(id);
      const res = await fetch(`${BACKEND_URL}/api/v1/templates/${id}/submit-to-meta`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`"${title}" submitted to Meta for verification! Status: ${json.data?.metaStatus || "PENDING"}`);
        fetchTemplates();
      } else {
        toast.error(json.message || "Meta rejected template submission. Check parameter requirements.");
        fetchTemplates();
      }
    } catch {
      toast.error("Error submitting template to Meta Cloud API.");
    } finally {
      setSubmittingId(null);
    }
  };

  // Duplicate template
  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/templates/${id}/duplicate`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success("Template duplicated successfully!");
        fetchTemplates();
      } else {
        toast.error("Failed to duplicate template.");
      }
    } catch {
      toast.error("Error duplicating template.");
    }
  };

  // Delete template
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete template "${title}"?`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/templates/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success(`Template "${title}" deleted.`);
        fetchTemplates();
      } else {
        toast.error("Failed to delete template.");
      }
    } catch {
      toast.error("Error deleting template.");
    }
  };

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (selectedCategory !== "ALL" && t.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "LOCAL_DRAFT" && t.metaStatus && t.metaStatus !== "LOCAL_DRAFT") return false;
        if (selectedStatus !== "LOCAL_DRAFT" && t.metaStatus !== selectedStatus) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesBody = t.bodyText.toLowerCase().includes(q);
        const matchesSlug = t.metaTemplateName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody && !matchesSlug) return false;
      }
      return true;
    });
  }, [templates, selectedCategory, selectedStatus, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 space-y-4">
      
      {/* 1. TOP HEADER & SUMMARY BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              Meta WhatsApp Template Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              {templates.length} Templates
            </span>
            {lastSyncCount !== null && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5" />
                {lastSyncCount} synced from Meta
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create, test, and submit official WhatsApp Cloud API templates to Meta for instant verification. Sync existing templates in 1-click.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSyncFromMeta}
            disabled={syncingMeta}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold cursor-pointer flex items-center gap-2 shadow-2xs transition-all disabled:opacity-50 ${
              wabaConnected
                ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-600 text-white"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-700 dark:text-slate-300"
            }`}
            title="Fetch all verified templates directly from your Meta Business account"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingMeta ? "animate-spin" : ""} ${wabaConnected ? "text-white" : "text-emerald-600"}`} />
            <span>{syncingMeta ? "Syncing from Meta..." : "Sync from Meta"}</span>
          </button>

          <button
            onClick={() => {
              setEditingTemplate(null);
              setIsEditorOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold border-none cursor-pointer flex items-center gap-2 shadow-sm transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* WABA Auto-Sync Info Banner */}
      {wabaChecked && wabaConnected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-emerald-800 dark:text-emerald-300 font-medium">
            <strong>WABA Connected</strong> — Your approved Meta templates are automatically synced from your connected account. Click <strong>Sync from Meta</strong> anytime to pull the latest templates.
          </span>
          <button
            onClick={handleSyncFromMeta}
            disabled={syncingMeta}
            className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0 cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncingMeta ? "animate-spin" : ""}`} />
            <span>{syncingMeta ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      )}
      {wabaChecked && !wabaConnected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs shrink-0">
          <span className="text-amber-800 dark:text-amber-300 font-medium flex-1">
            ⚠️ <strong>WABA Not Connected</strong> — Connect your Meta WhatsApp Business Account in Settings to auto-import your approved templates.
          </span>
          <button
            onClick={() => router.push("/settings")}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Connect in Settings →
          </button>
        </div>
      )}

      {/* 2. CONTROLS BAR: SEARCH, STATUS TABS & CATEGORY PILLS */}
      <div className="space-y-3 shrink-0">
        
        {/* Search & Status Badges Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          
          {/* Search */}
          <div className="relative flex-1 md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, body, or meta_template_name..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Meta Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "All Status", count: templates.length },
              { id: "APPROVED", label: "Approved", count: templates.filter((t) => t.metaStatus === "APPROVED").length, color: "text-emerald-600" },
              { id: "PENDING", label: "Pending", count: templates.filter((t) => t.metaStatus === "PENDING").length, color: "text-amber-600" },
              { id: "LOCAL_DRAFT", label: "Drafts", count: templates.filter((t) => !t.metaStatus || t.metaStatus === "LOCAL_DRAFT").length, color: "text-slate-500" },
              { id: "REJECTED", label: "Rejected", count: templates.filter((t) => t.metaStatus === "REJECTED").length, color: "text-rose-600" },
            ].map((st) => {
              const isSel = selectedStatus === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setSelectedStatus(st.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSel
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSel ? "bg-white/20 text-white dark:bg-black/20 dark:text-black" : "bg-slate-200 dark:bg-slate-800 text-slate-600"
                  }`}>
                    {st.count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_DEFINITIONS.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count = cat.id === "ALL" ? templates.length : templates.filter((t) => t.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : cat.color}`} />
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? "bg-emerald-700/60 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* 3. TEMPLATES GRID */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Loading Meta WhatsApp templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="h-80 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8 space-y-4 bg-white/50 dark:bg-slate-900/50">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No templates found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchQuery || selectedCategory !== "ALL" || selectedStatus !== "ALL"
                  ? "No templates match your active filters or search criteria."
                  : "Create your first template or click 'Sync from Meta' to import existing verified templates."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncFromMeta}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sync from Meta</span>
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setIsEditorOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Template</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tmpl) => {
              const CategoryIcon = getCategoryIcon(tmpl.category);
              const isSubmitting = submittingId === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 group relative"
                >
                  {/* Top: Icon, Title, Meta Status Badges */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center font-bold text-sm shadow-2xs">
                          <CategoryIcon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors line-clamp-1">
                            {tmpl.title}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{tmpl.category}</span>
                            <span>•</span>
                            <span>{tmpl.language || "en_US"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Meta Status Badge */}
                      {tmpl.metaStatus === "APPROVED" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Approved</span>
                        </span>
                      )}
                      {tmpl.metaStatus === "PENDING" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1 shadow-2xs">
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin" />
                          <span>Pending</span>
                        </span>
                      )}
                      {tmpl.metaStatus === "REJECTED" && (
                        <span
                          title={tmpl.metaRejectionReason || "Template was rejected by Meta"}
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 flex items-center gap-1 shadow-2xs cursor-help"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>Rejected</span>
                        </span>
                      )}
                      {(!tmpl.metaStatus || tmpl.metaStatus === "LOCAL_DRAFT") && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs">
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>Draft</span>
                        </span>
                      )}
                    </div>

                    {/* Meta Identifier Slug */}
                    {tmpl.metaTemplateName && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate">
                        <span className="text-emerald-600 font-bold">meta:</span>
                        <span className="truncate">{tmpl.metaTemplateName}</span>
                      </div>
                    )}

                    {/* Rejection Alert if rejected */}
                    {tmpl.metaStatus === "REJECTED" && tmpl.metaRejectionReason && (
                      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{tmpl.metaRejectionReason}</span>
                      </div>
                    )}

                    {/* Image / Media Preview Thumbnail */}
                    {(tmpl.mediaType === "IMAGE" || tmpl.headerType === "IMAGE" || isLikelyImageUrl(tmpl.mediaUrl)) && tmpl.mediaUrl && (
                      <div className="h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={normalizePublicMediaUrl(tmpl.mediaUrl)}
                          alt={tmpl.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    {/* Message Body Snippet */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed font-sans bg-slate-50/70 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      {tmpl.bodyText}
                    </p>

                    {/* Interactive Buttons Pill Summary */}
                    {Array.isArray(tmpl.buttons) && tmpl.buttons.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tmpl.buttons.map((b, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1"
                          >
                            {b.type === "URL" ? <ExternalLink className="w-2.5 h-2.5" /> : b.type === "PHONE_NUMBER" ? <PhoneCall className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                            <span>{b.text}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    
                    {/* Submit to Meta Action (If not already approved) */}
                    {tmpl.metaStatus !== "APPROVED" ? (
                      <button
                        onClick={() => handleSubmitToMeta(tmpl.id, tmpl.title)}
                        disabled={isSubmitting}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/50 cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                        title="Submit to Meta Graph API for official template approval"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{isSubmitting ? "Submitting..." : tmpl.metaStatus === "REJECTED" ? "Re-submit to Meta" : "Submit to Meta"}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Ready for Broadcasts</span>
                      </span>
                    )}

                    {/* Edit, Duplicate, Delete Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTemplate(tmpl);
                          setIsEditorOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border-none bg-transparent cursor-pointer transition-colors"
                        title="Edit Template"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(tmpl.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 border-none bg-transparent cursor-pointer transition-colors"
                        title="Duplicate Template"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tmpl.id, tmpl.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-none bg-transparent cursor-pointer transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. OFFICIAL META TEMPLATE STUDIO MODAL */}
      {isEditorOpen && (
        <MetaTemplateEditorModal
          isOpen={isEditorOpen}
          initialData={editingTemplate}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            fetchTemplates();
          }}
        />
      )}

    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: OFFICIAL META TEMPLATE STUDIO MODAL                            */
/* ========================================================================= */
function MetaTemplateEditorModal({
  isOpen,
  initialData,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  initialData: TemplateItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // 1. Basic Info
  const [title, setTitle] = useState(initialData?.title || "");
  const [metaTemplateName, setMetaTemplateName] = useState(
    initialData?.metaTemplateName || 
    (initialData?.title ? initialData.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64) : "")
  );
  const [category, setCategory] = useState<string>(initialData?.category || "MARKETING");
  const [language, setLanguage] = useState<string>(initialData?.language || "en_US");

  // 2. Header Component
  const [headerType, setHeaderType] = useState<"NONE" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO">(
    initialData?.headerType || (initialData?.mediaType && initialData.mediaType !== "POLL" ? initialData.mediaType : "NONE")
  );
  const [headerContent, setHeaderContent] = useState(initialData?.headerContent || "");
  const [headerSample, setHeaderSample] = useState(initialData?.sampleValues?.["header_1"] || "Special Announcement");
  const [mediaSourceMode, setMediaSourceMode] = useState<"UPLOAD" | "URL">(initialData?.mediaUrl ? "URL" : "UPLOAD");
  const [mediaUrl, setMediaUrl] = useState(initialData?.mediaUrl || "");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [compressionStats, setCompressionStats] = useState<string | null>(null);

  // 3. Body Component & Positional Variables
  const [bodyText, setBodyText] = useState(
    initialData?.bodyText || "Hello {{1}},\n\nWe have a special announcement from {{2}}! Your order {{3}} is ready."
  );
  const [sampleValues, setSampleValues] = useState<Record<string, string>>(() => {
    return initialData?.sampleValues || {
      "1": "Rahul Sharma",
      "2": "OpticalManager",
      "3": "OM-8920",
    };
  });

  // 4. Footer Component
  const [footerText, setFooterText] = useState(initialData?.footerText || "Reply STOP to unsubscribe");

  // 5. Buttons Component (Up to 3)
  const [buttons, setButtons] = useState<TemplateButton[]>(() => {
    if (initialData?.buttons && Array.isArray(initialData.buttons) && initialData.buttons.length > 0) {
      return initialData.buttons;
    }
    return [
      { type: "QUICK_REPLY", text: "Contact Support" }
    ];
  });

  const [saving, setSaving] = useState(false);
  const [submittingToMeta, setSubmittingToMeta] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-slugify meta name when user changes title (if not manually edited)
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!initialData) {
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
      setMetaTemplateName(slug);
    }
  };

  // Detect variables {{1}}, {{2}} or {{name}} in body text
  const detectedVariables = useMemo(() => {
    const matches = bodyText.match(/{{([a-zA-Z0-9_-]+)}}/g);
    if (!matches) return [];
    return Array.from(new Set(matches)).map((m) => m.replace(/[{}]/g, ""));
  }, [bodyText]);

  // Handle inserting variable token at cursor position
  const handleInsertToken = (token: string) => {
    if (!textareaRef.current) {
      setBodyText((prev) => prev + " " + token);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = bodyText.substring(0, start) + token + bodyText.substring(end);
    setBodyText(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + token.length, start + token.length);
      }
    }, 50);
  };

  // Handle Device File Upload with Client-Side Compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingMedia(true);
      setCompressionStats(null);

      let finalBase64 = "";
      let mimeType = file.type;
      let filename = file.name;

      if (file.type.startsWith("image/")) {
        const compressed = await compressImageFile(file);
        finalBase64 = compressed.base64;
        mimeType = "image/jpeg";
        filename = file.name.replace(/\.[^/.]+$/, ".jpg");
        setCompressionStats(`Compressed: ${compressed.originalKB} KB → ${compressed.compressedKB} KB`);
      } else {
        finalBase64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        setCompressionStats(`Size: ${Math.round(file.size / 1024)} KB`);
      }

      // Upload to backend media endpoint
      const res = await fetch(`${BACKEND_URL}/api/v1/media/upload-direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          filename,
          mimeType,
          base64Data: finalBase64,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.url) {
          setMediaUrl(json.data.url);
          setHeaderContent(json.data.url);
          toast.success("Header media uploaded successfully!");
        }
      } else {
        toast.error("Failed to upload media file.");
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle Add Button (Max 3)
  const handleAddButton = () => {
    if (buttons.length >= 3) {
      toast.error("Meta limits message templates to a maximum of 3 buttons.");
      return;
    }
    setButtons([...buttons, { type: "QUICK_REPLY", text: `Button ${buttons.length + 1}` }]);
  };

  // Handle Save Template (as Draft or submit to Meta)
  const handleSave = async (submitDirectly: boolean = false) => {
    if (!title.trim()) {
      toast.error("Please enter a template title.");
      return;
    }
    if (!bodyText.trim()) {
      toast.error("Please enter message body text.");
      return;
    }

    const cleanSlug = metaTemplateName.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
    if (!cleanSlug) {
      toast.error("Meta Template Identifier must contain lowercase letters and underscores only.");
      return;
    }

    const mergedSampleValues = { ...sampleValues };
    if (headerType === "TEXT" && headerSample) {
      mergedSampleValues["header_1"] = headerSample;
    }

    const payload = {
      title: title.trim(),
      metaTemplateName: cleanSlug,
      category,
      language,
      headerType,
      headerContent: headerType === "TEXT" ? headerContent : (mediaUrl || headerContent),
      mediaType: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) ? (headerType as any) : "NONE",
      mediaUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) ? mediaUrl : undefined,
      bodyText: bodyText.trim(),
      footerText: footerText.trim() || undefined,
      buttons,
      sampleValues: mergedSampleValues,
    };

    try {
      if (submitDirectly) {
        setSubmittingToMeta(true);
      } else {
        setSaving(true);
      }

      let savedTemplateId = initialData?.id;

      if (initialData?.id) {
        // Update existing template
        const res = await fetch(`${BACKEND_URL}/api/v1/templates/${initialData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to update template.");
        }
      } else {
        // Create new template
        const res = await fetch(`${BACKEND_URL}/api/v1/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to create template.");
        }
        savedTemplateId = json.data?.id;
      }

      if (submitDirectly && savedTemplateId) {
        // Immediately submit to Meta for verification
        const submitRes = await fetch(`${BACKEND_URL}/api/v1/templates/${savedTemplateId}/submit-to-meta`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const submitJson = await submitRes.json();
        if (!submitRes.ok || !submitJson.success) {
          throw new Error(submitJson.message || "Failed to submit to Meta API.");
        }
        toast.success(`Template submitted to Meta successfully! Status: ${submitJson.data?.metaStatus || "PENDING"}`);
      } else {
        toast.success(initialData ? "Template saved successfully!" : "Template created successfully!");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error saving template.");
    } finally {
      setSaving(false);
      setSubmittingToMeta(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {initialData ? "Edit Meta WhatsApp Template" : "Create Official Meta WhatsApp Template"}
              </h2>
              <p className="text-xs text-slate-500">
                Configure your template components with positional variables, sample values, and live smartphone preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Body: Left Form + Right Live WhatsApp Smartphone Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
          
          {/* Left Column: Form Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* 1. Title & Meta Identifier Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Template Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Summer Polarized Sunglasses Offer"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Meta Identifier *</span>
                  <span className="text-[10px] text-slate-400 font-normal">(lowercase & underscores)</span>
                </label>
                <input
                  type="text"
                  value={metaTemplateName}
                  onChange={(e) => setMetaTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="e.g. summer_sunglasses_offer"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* 2. Category & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Official Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="MARKETING">☀️ MARKETING (Offers, promos, discounts)</option>
                  <option value="UTILITY">✅ UTILITY (Confirmations, orders, reminders)</option>
                  <option value="AUTHENTICATION">🔒 AUTHENTICATION (OTP codes, verifications)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Language *</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
                >
                  <option value="en_US">en_US (English - US)</option>
                  <option value="en_GB">en_GB (English - UK)</option>
                  <option value="hi">hi (Hindi)</option>
                  <option value="es">es (Spanish)</option>
                  <option value="pt_BR">pt_BR (Portuguese - BR)</option>
                  <option value="ar">ar (Arabic)</option>
                </select>
              </div>
            </div>

            {/* 3. Header Component (Optional) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Header Format (Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">Add bold title or media banner</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { type: "NONE", label: "None", icon: X },
                  { type: "TEXT", label: "Text", icon: MessageSquare },
                  { type: "IMAGE", label: "Image", icon: ImageIcon },
                  { type: "DOCUMENT", label: "Document", icon: FileText },
                  { type: "VIDEO", label: "Video", icon: Video },
                ].map((h) => {
                  const Icon = h.icon;
                  const isSel = headerType === h.type;
                  return (
                    <button
                      key={h.type}
                      type="button"
                      onClick={() => setHeaderType(h.type as any)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSel
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500/60"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSel ? "text-white" : "text-emerald-600"}`} />
                      <span className="text-[10px] font-bold">{h.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Text Header Field */}
              {headerType === "TEXT" && (
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Header Headline Text (Max 60 chars)</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={headerContent}
                      onChange={(e) => setHeaderContent(e.target.value)}
                      placeholder="e.g. Exclusive Weekend Special!"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Media Header (Image / Video / Document) */}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaSourceMode("UPLOAD")}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        mediaSourceMode === "UPLOAD"
                          ? "bg-white dark:bg-slate-900 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <Upload className="w-3 h-3 text-emerald-600" />
                      <span>Upload Sample Media</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaSourceMode("URL")}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        mediaSourceMode === "URL"
                          ? "bg-white dark:bg-slate-900 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <LinkIcon className="w-3 h-3 text-blue-600" />
                      <span>Paste Public URL</span>
                    </button>
                  </div>

                  {mediaSourceMode === "UPLOAD" ? (
                    <div className="space-y-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={headerType === "IMAGE" ? "image/*" : headerType === "DOCUMENT" ? "application/pdf" : "video/*"}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {uploadingMedia ? (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading media sample...</span>
                          </div>
                        ) : mediaUrl ? (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Media attached! Click to replace</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-emerald-600" />
                            <span>Choose sample {headerType.toLowerCase()} file</span>
                          </div>
                        )}
                      </div>
                      {compressionStats && (
                        <p className="text-[10px] text-emerald-600 font-mono">⚡ {compressionStats}</p>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => {
                        setMediaUrl(e.target.value);
                        setHeaderContent(e.target.value);
                      }}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              )}
            </div>

            {/* 4. Body Component (Mandatory) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Message Body *</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Use positional variables &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">{bodyText.length}/1024</span>
              </div>

              {/* Fast Token Insertion Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {["{{1}}", "{{2}}", "{{3}}", "{{4}}"].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handleInsertToken(token)}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-[10px] font-mono font-bold cursor-pointer transition-all"
                  >
                    + {token}
                  </button>
                ))}

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                {CRM_VARIABLE_SHORTCUTS.map((crm) => (
                  <button
                    key={crm.label}
                    type="button"
                    onClick={() => {
                      handleInsertToken(crm.key);
                      setSampleValues((prev) => ({ ...prev, [crm.key.replace(/[{}]/g, "")]: crm.sample }));
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold cursor-pointer transition-all flex items-center gap-1"
                  >
                    <crm.icon className="w-2.5 h-2.5 text-slate-500" />
                    <span>{crm.label}</span>
                  </button>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                rows={5}
                maxLength={1024}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Type your WhatsApp message here. Use {{1}} for customer name, {{2}} for store name..."
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs leading-relaxed focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* 5. Variable Sample Values (Required by Meta Cloud API) */}
            {detectedVariables.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Sample Values for Meta Approval (Required)
                  </span>
                </div>
                <p className="text-[10px] text-amber-800 dark:text-amber-300">
                  Meta requires realistic sample values for all variables to verify your message context before approving the template.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {detectedVariables.map((vKey) => (
                    <div key={vKey} className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-200">
                        &#123;&#123;{vKey}&#125;&#125; Sample:
                      </label>
                      <input
                        type="text"
                        value={sampleValues[vKey] || ""}
                        onChange={(e) => setSampleValues({ ...sampleValues, [vKey]: e.target.value })}
                        placeholder={`e.g. Rahul Sharma`}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Footer Component (Optional) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Footer Text (Optional)</label>
                <span className="text-[10px] text-slate-400 font-mono">{footerText.length}/60</span>
              </div>
              <input
                type="text"
                maxLength={60}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Reply STOP to unsubscribe"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* 7. Interactive Buttons Component (Optional - Max 3) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Interactive Buttons ({buttons.length}/3)</span>
                </label>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Button</span>
                  </button>
                )}
              </div>

              {buttons.map((btn, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={btn.type}
                        onChange={(e) => {
                          const updated = [...buttons];
                          updated[idx].type = e.target.value as any;
                          setButtons(updated);
                        }}
                        className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <option value="QUICK_REPLY">🔘 Quick Reply</option>
                        <option value="URL">🔗 Call to Action: URL</option>
                        <option value="PHONE_NUMBER">📞 Call to Action: Phone</option>
                      </select>

                      <input
                        type="text"
                        maxLength={25}
                        value={btn.text}
                        onChange={(e) => {
                          const updated = [...buttons];
                          updated[idx].text = e.target.value;
                          setButtons(updated);
                        }}
                        placeholder="Button Label (Max 25 chars)"
                        className="flex-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {btn.type === "URL" && (
                    <input
                      type="url"
                      value={btn.url || ""}
                      onChange={(e) => {
                        const updated = [...buttons];
                        updated[idx].url = e.target.value;
                        setButtons(updated);
                      }}
                      placeholder="https://example.com/shop"
                      className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  )}

                  {btn.type === "PHONE_NUMBER" && (
                    <input
                      type="tel"
                      value={btn.phoneNumber || ""}
                      onChange={(e) => {
                        const updated = [...buttons];
                        updated[idx].phoneNumber = e.target.value;
                        setButtons(updated);
                      }}
                      placeholder="+919876543210 (Country code required)"
                      className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving || submittingToMeta}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 text-xs font-bold cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {saving ? "Saving Draft..." : "Save as Draft"}
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || submittingToMeta}
                className="px-4.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingToMeta ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{submittingToMeta ? "Submitting to Meta..." : "Submit to Meta for Verification"}</span>
              </button>
            </div>

          </div>

          {/* Right Column: Live WhatsApp Smartphone Mockup Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start py-2">
            <LiveWhatsAppSmartphonePreview
              headerType={headerType}
              headerContent={headerContent}
              headerSample={headerSample}
              mediaUrl={mediaUrl}
              bodyText={bodyText}
              sampleValues={sampleValues}
              footerText={footerText}
              buttons={buttons}
            />
          </div>

        </div>

      </div>
    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: LIVE WHATSAPP SMARTPHONE MOCKUP PREVIEW                        */
/* ========================================================================= */
function LiveWhatsAppSmartphonePreview({
  headerType,
  headerContent,
  headerSample,
  mediaUrl,
  bodyText,
  sampleValues,
  footerText,
  buttons,
}: {
  headerType: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
  headerContent?: string;
  headerSample?: string;
  mediaUrl?: string;
  bodyText: string;
  sampleValues: Record<string, string>;
  footerText?: string;
  buttons: TemplateButton[];
}) {
  // Substitute positional numbered variables {{1}}, {{2}} with sample values
  let resolvedBody = (bodyText || "Your message preview will appear here...")
    .replace(/{{([a-zA-Z0-9_-]+)}}/g, (_, key) => {
      if (sampleValues[key]) return sampleValues[key];
      if (key === "1" || key === "name") return "Rahul Sharma";
      if (key === "2" || key === "shop_name" || key === "business_name") return "OpticalManager";
      if (key === "3" || key === "city") return "Delhi";
      return `[${key}]`;
    });

  let resolvedHeader = (headerContent || "")
    .replace(/{{1}}/g, headerSample || "Special Announcement");

  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full max-w-[300px] select-none sticky top-2">
      <div className="bg-slate-200 dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-700 rounded-[32px] p-2 shadow-2xl relative overflow-hidden">
        
        {/* Smartphone Camera Notch */}
        <div className="w-20 h-3 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2" />

        {/* WhatsApp Mobile Chat Header (Official Green) */}
        <div className="bg-[#008069] p-2.5 rounded-t-xl flex items-center gap-2 text-white shadow-xs">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
            OM
          </div>
          <div className="truncate flex-1">
            <p className="text-[11px] font-bold leading-tight truncate text-white">Your Business Name</p>
            <p className="text-[8px] text-emerald-100 leading-none">Official Business Account • Meta Verified</p>
          </div>
        </div>

        {/* WhatsApp Mobile Chat Wallpaper Background (LIGHT CREAM THEME) */}
        <div className="bg-[#efeae2] p-2.5 min-h-[340px] flex flex-col justify-end rounded-b-xl space-y-2 relative border border-slate-300/40">
          
          {/* Chat Message Bubble (LIGHT GREEN OUTGOING BUBBLE) */}
          <div className="bg-[#d9fdd3] text-[#111b21] rounded-xl rounded-tr-none p-2.5 space-y-1.5 max-w-[96%] ml-auto border border-emerald-200/60 shadow-xs">
            
            {/* Header Rendering */}
            {headerType === "TEXT" && resolvedHeader && (
              <p className="text-[12px] font-bold text-[#111b21] leading-tight pb-0.5 border-b border-emerald-300/40">
                {resolvedHeader}
              </p>
            )}

            {headerType === "IMAGE" && (
              <div className="rounded-lg overflow-hidden bg-slate-100 border border-slate-300 max-h-36 shadow-2xs">
                {mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={normalizePublicMediaUrl(mediaUrl)}
                    alt="Template Header Media"
                    className="w-full h-auto object-cover max-h-36"
                  />
                ) : (
                  <div className="p-4 text-center text-slate-500 space-y-1">
                    <ImageIcon className="w-6 h-6 mx-auto text-emerald-600" />
                    <p className="text-[9px] font-bold">Image Header Preview</p>
                  </div>
                )}
              </div>
            )}

            {headerType === "DOCUMENT" && (
              <div className="bg-white border border-slate-200 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                <div className="truncate text-xs">
                  <p className="font-bold truncate text-slate-900 text-[10px]">Document_Catalog.pdf</p>
                  <p className="text-[8px] text-slate-500">PDF Document • 1.2 MB</p>
                </div>
              </div>
            )}

            {headerType === "VIDEO" && (
              <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-600 shadow-2xs">
                <Video className="w-6 h-6 text-purple-600" />
                <p className="text-[8px] font-bold">Video Header Preview</p>
              </div>
            )}

            {/* Message Body Text */}
            <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-[#111b21] font-sans">
              {resolvedBody}
            </p>

            {/* Footer Text */}
            {footerText && footerText.trim() && (
              <p className="text-[9px] text-[#667781] leading-tight pt-0.5">
                {footerText}
              </p>
            )}

            {/* Timestamp & Double Blue Tick */}
            <div className="flex items-center justify-end gap-1 text-[8px] text-[#667781] pt-0.5">
              <span>{currentTime}</span>
              <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
            </div>

            {/* WhatsApp Call to Action / Interactive Buttons (Rendered within bubble as official WhatsApp actions) */}
            {Array.isArray(buttons) && buttons.length > 0 && (
              <div className="pt-1 border-t border-emerald-300/60 -mx-2.5 -mb-2.5 divide-y divide-emerald-300/40">
                {buttons.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 text-center text-[11px] font-bold text-[#00a884] hover:bg-emerald-100/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-white/40"
                  >
                    {b.type === "URL" && <ExternalLink className="w-3 h-3 text-[#00a884]" />}
                    {b.type === "PHONE_NUMBER" && <PhoneCall className="w-3 h-3 text-[#00a884]" />}
                    {b.type === "QUICK_REPLY" && <MessageSquare className="w-3 h-3 text-[#00a884]" />}
                    <span>{b.text || `Button ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}

          </div>

          <div className="text-center text-[8px] text-slate-500 py-0.5">
            🔒 End-to-end encrypted • Official Meta WhatsApp Cloud API
          </div>
        </div>

      </div>
    </div>
  );
}
