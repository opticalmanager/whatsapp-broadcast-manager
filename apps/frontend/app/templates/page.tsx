"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Shuffle,
  Smile,
  User,
  PhoneCall,
  Mail,
  Building2,
  FileCheck,
  Sparkle,
  CheckCheck,
  Lock
} from "lucide-react";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("broadcast_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const BACKEND_URL = getBackendUrl();

type TemplateCategory = "ALL" | "PROMO" | "GREETING" | "REMINDER" | "VIP" | "TRANSACTIONAL" | "GENERAL";

interface TemplateItem {
  id: string;
  organizationId: string;
  shopId?: string;
  title: string;
  bodyText: string;
  category: "PROMO" | "GREETING" | "REMINDER" | "VIP" | "TRANSACTIONAL" | "GENERAL";
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  icon?: string;
  variables: Array<{ key: string; description: string; fallback?: string }>;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_DEFINITIONS: Array<{
  id: TemplateCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: "ALL", label: "All Templates", icon: Layers, color: "text-slate-700 dark:text-slate-300" },
  { id: "PROMO", label: "Offers & Promos", icon: Sun, color: "text-orange-600 dark:text-orange-400" },
  { id: "GREETING", label: "Greetings & Welcome", icon: Sparkles, color: "text-purple-600 dark:text-purple-400" },
  { id: "REMINDER", label: "Follow-up & Reminders", icon: Calendar, color: "text-emerald-600 dark:text-emerald-400" },
  { id: "VIP", label: "VIP & Loyalty Perks", icon: Crown, color: "text-amber-600 dark:text-amber-400" },
  { id: "TRANSACTIONAL", label: "Orders & Invoices", icon: CheckCircle2, color: "text-teal-600 dark:text-teal-400" },
  { id: "GENERAL", label: "General Broadcast", icon: MessageSquare, color: "text-slate-600 dark:text-slate-400" },
];

// Universal CRM Variable Categories (Applicable to any business)
const UNIVERSAL_VARIABLES = [
  { key: "{{name}}", label: "Contact Name (DB)", sample: "Rahul Sharma", icon: User, group: "Name" },
  { key: "{{whatsapp_name}}", label: "WhatsApp Profile Name", sample: "Rahul S.", icon: Smile, group: "Name" },
  { key: "{{phone}}", label: "Phone Number", sample: "+91 98765 43210", icon: PhoneCall, group: "Contact" },
  { key: "{{city}}", label: "City / Area", sample: "Delhi", icon: Tag, group: "Contact" },
  { key: "{{email}}", label: "Email Address", sample: "rahul@gmail.com", icon: Mail, group: "Contact" },
  { key: "{{business_name}}", label: "Your Business Name", sample: "OpticalManager", icon: Building2, group: "Business" },
  { key: "{{discount}}", label: "Discount % or ₹", sample: "20%", icon: Percent, group: "Offers" },
  { key: "{{coupon_code}}", label: "Coupon / Voucher Code", sample: "FESTIVE500", icon: Gift, group: "Offers" },
  { key: "{{expiry_date}}", label: "Offer Expiry Date", sample: "this Sunday", icon: Clock, group: "Offers" },
  { key: "{{order_number}}", label: "Order / Invoice #", sample: "#INV-8920", icon: FileCheck, group: "Orders" },
  { key: "{{due_date}}", label: "Appointment / Due Date", sample: "14 May 2025", icon: Calendar, group: "Orders" },
  { key: "{{custom_1}}", label: "Custom Field 1", sample: "Premium Lens", icon: Tag, group: "Custom" },
];

const SPINTAX_PRESETS = [
  { label: "Friendly Greeting", pattern: "{Hello|Hi|Hey|Dear}" },
  { label: "Time-based Greeting", pattern: "{Good morning|Good afternoon|Greetings|Hello}" },
  { label: "Regional Friendly", pattern: "{Namaste|Hello|Hi|Greetings}" },
  { label: "VIP / Formal", pattern: "{Dear Valued Customer|Greetings|Hello|Dear}" },
];

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  switch (category) {
    case "PROMO":
      return Sun;
    case "GREETING":
      return Sparkles;
    case "REMINDER":
      return Calendar;
    case "VIP":
      return Crown;
    case "TRANSACTIONAL":
      return CheckCircle2;
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
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("ALL");

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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesBody = t.bodyText.toLowerCase().includes(q);
        if (!matchesTitle && !matchesBody) return false;
      }
      return true;
    });
  }, [templates, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 space-y-4">
      
      {/* 1. TOP HEADER & SUMMARY BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              WhatsApp Message Templates
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              {templates.length} Templates
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Build reusable promotional flyers, customer follow-up reminders, and loyalty broadcast templates with anti-spam Spintax & dynamic CRM tags
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => {
            setEditingTemplate(null);
            setIsEditorOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Template</span>
        </button>
      </div>

      {/* 2. CONTROLS BAR: SEARCH & CATEGORY TABS */}
      <div className="space-y-3 shrink-0">
        
        {/* Search & Stats */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by title or keywords..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Showing <strong>{filteredTemplates.length}</strong> of {templates.length} templates</span>
          </div>
        </div>

        {/* Category Filter Pills with Real Lucide Icons */}
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
            <p className="text-xs font-medium">Loading WhatsApp templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="h-80 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8 space-y-4 bg-white/50 dark:bg-slate-900/50">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No templates found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchQuery || selectedCategory !== "ALL"
                  ? "No templates match your active search or category filter."
                  : "Create your first reusable WhatsApp template with dynamic tokens to power your marketing campaigns."}
              </p>
            </div>
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tmpl) => {
              const CategoryIcon = getCategoryIcon(tmpl.category);

              return (
                <div
                  key={tmpl.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 group"
                >
                  {/* Top: Icon, Title, Badges */}
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
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {tmpl.category} • Updated {new Date(tmpl.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Media Badge */}
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        {tmpl.mediaType === "IMAGE" && <ImageIcon className="w-3 h-3 text-emerald-600" />}
                        {tmpl.mediaType === "DOCUMENT" && <FileText className="w-3 h-3 text-blue-600" />}
                        {tmpl.mediaType === "VIDEO" && <Video className="w-3 h-3 text-purple-600" />}
                        {tmpl.mediaType === "NONE" && <MessageSquare className="w-3 h-3 text-slate-400" />}
                        <span>{tmpl.mediaType}</span>
                      </span>
                    </div>

                    {/* Image Preview Thumbnail if media exists */}
                    {tmpl.mediaType === "IMAGE" && tmpl.mediaUrl && (
                      <div className="h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tmpl.mediaUrl}
                          alt={tmpl.title}
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Message Body Preview */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed whitespace-pre-wrap line-clamp-3">
                      {tmpl.bodyText}
                    </div>

                    {/* Dynamic Variable Chips */}
                    {tmpl.variables && tmpl.variables.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {tmpl.variables.map((v) => (
                          <span
                            key={v.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-mono font-bold"
                          >
                            <Tag className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{v.key}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions -> DIRECTLY REDIRECT TO ACTIVE CAMPAIGN STUDIO (/send-message) */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    
                    {/* Launch Campaign with this Template */}
                    <button
                      onClick={() => router.push(`/send-message?template=${tmpl.id}`)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      <span>Use in Campaign</span>
                    </button>

                    {/* Edit, Duplicate, Delete */}
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

      {/* 4. TEMPLATE EDITOR MODAL */}
      {isEditorOpen && (
        <TemplateEditorModal
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
/* COMPONENT: TEMPLATE EDITOR MODAL (WITH DUAL MEDIA, SPINTAX & COMPRESSION) */
/* ========================================================================= */
function TemplateEditorModal({
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
  // Form State
  const [title, setTitle] = useState(initialData?.title || "");
  const [category, setCategory] = useState<TemplateItem["category"]>(initialData?.category || "PROMO");
  
  // Media State (Dual: Upload vs Public URL)
  const [mediaType, setMediaType] = useState<TemplateItem["mediaType"]>(initialData?.mediaType || "NONE");
  const [mediaSourceMode, setMediaSourceMode] = useState<"UPLOAD" | "URL">(initialData?.mediaUrl ? "URL" : "UPLOAD");
  const [mediaUrl, setMediaUrl] = useState(initialData?.mediaUrl || "");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [compressionStats, setCompressionStats] = useState<string | null>(null);

  // Message & Spintax State (Auto-Spintax Enabled by default)
  const [autoSpintaxEnabled, setAutoSpintaxEnabled] = useState(true);
  const [isVariableDropdownOpen, setIsVariableDropdownOpen] = useState(false);
  const [isSpintaxDropdownOpen, setIsSpintaxDropdownOpen] = useState(false);
  const [spintaxPattern, setSpintaxPattern] = useState("{Hello|Hi|Hey|Dear}");
  const [bodyText, setBodyText] = useState(
    initialData?.bodyText || "{Hello|Hi|Hey|Dear} "
  );
  const [unsubSettings, setUnsubSettings] = useState<{ enabled: boolean; optoutText: string }>({
    enabled: true,
    optoutText: "_Reply STOP to unsubscribe from promotional messages._",
  });

  useEffect(() => {
    async function loadUnsub() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/unsubscribers/settings`, { headers: getAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setUnsubSettings({
              enabled: json.data.enabled !== false,
              optoutText: json.data.optoutText || "Reply STOP to unsubscribe from promotional messages.",
            });
          }
        }
      } catch {}
    }
    loadUnsub();
  }, []);

  // Poll Builder State (when mediaType is POLL)
  const [pollQuestion, setPollQuestion] = useState<string>(
    initialData?.variables?.find((v: any) => v.key === "poll_question")?.fallback ||
    "Would you like to schedule an eye checkup this week?"
  );
  const [pollOptions, setPollOptions] = useState<string[]>(() => {
    const raw = initialData?.variables?.find((v: any) => v.key === "poll_options")?.fallback;
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return ["Yes, definitely!", "Maybe next week", "No, thanks"];
  });
  const [pollMultipleAnswers, setPollMultipleAnswers] = useState<boolean>(
    initialData?.variables?.find((v: any) => v.key === "poll_multiple")?.fallback === "true"
  );

  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  // Handle Spintax Toggle Switch
  const handleToggleSpintax = (checked: boolean) => {
    setAutoSpintaxEnabled(checked);
    if (checked) {
      if (!bodyText.startsWith("{")) {
        setBodyText(spintaxPattern + " " + bodyText);
      }
    } else {
      const cleaned = bodyText.replace(/^{[^}]+}s*/, "");
      setBodyText(cleaned);
    }
  };

  // Change Spintax Preset Pattern
  const handleApplySpintaxPreset = (newPattern: string) => {
    setSpintaxPattern(newPattern);
    if (autoSpintaxEnabled) {
      if (bodyText.startsWith("{")) {
        const afterSpintax = bodyText.replace(/^{[^}]+}s*/, "");
        setBodyText(newPattern + " " + afterSpintax);
      } else {
        setBodyText(newPattern + " " + bodyText);
      }
    }
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
        setMediaType("IMAGE");
        const compressed = await compressImageFile(file);
        finalBase64 = compressed.base64;
        mimeType = "image/jpeg";
        filename = file.name.replace(/\.[^/.]+$/, ".jpg");
        setCompressionStats(`Compressed: ${compressed.originalKB} KB → ${compressed.compressedKB} KB (${Math.round((1 - compressed.compressedKB / compressed.originalKB) * 100)}% saved)`);
      } else if (file.type === "application/pdf") {
        setMediaType("DOCUMENT");
        finalBase64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        setCompressionStats(`Size: ${Math.round(file.size / 1024)} KB`);
      } else {
        setMediaType("VIDEO");
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

      const json = await res.json();
      if (res.ok && json.success && json.data?.fileUrl) {
        setMediaUrl(json.data.fileUrl);
        toast.success("Media uploaded successfully!");
      } else {
        setMediaUrl(finalBase64);
        toast.success("Media loaded into template!");
      }
    } catch {
      toast.error("Failed to upload media file.");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle URL change & auto-detect media type
  const handleUrlChange = (val: string) => {
    setMediaUrl(val);
    const clean = val.trim().toLowerCase();
    if (clean.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i) || clean.includes("awsstatic.com") || clean.includes("unsplash.com") || clean.includes("r2.dev")) {
      if (mediaType === "NONE") setMediaType("IMAGE");
    } else if (clean.endsWith(".pdf")) {
      if (mediaType === "NONE") setMediaType("DOCUMENT");
    } else if (clean.endsWith(".mp4")) {
      if (mediaType === "NONE") setMediaType("VIDEO");
    }
  };

  // Insert variable token at cursor position in textarea
  const handleInsertVariable = (token: string) => {
    if (!textareaRef.current) {
      setBodyText((prev) => prev + " " + token);
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const newText = bodyText.substring(0, start) + token + bodyText.substring(end);

    setBodyText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    if (!title.trim()) {
      toast.error("Please enter a template title.");
      return;
    }
    if (!bodyText.trim()) {
      toast.error("Please write the message body.");
      return;
    }

    try {
      isSubmittingRef.current = true;
      setSaving(true);

      const payload = {
        title: title.trim(),
        category,
        mediaType,
        mediaUrl: (mediaType !== "NONE" && mediaType !== "POLL") ? (mediaUrl.trim() || undefined) : undefined,
        bodyText: bodyText.trim(),
        variables: mediaType === "POLL" ? [
          { key: "poll_question", description: pollQuestion, fallback: pollQuestion },
          { key: "poll_options", description: "Poll Options", fallback: JSON.stringify(pollOptions) },
          { key: "poll_multiple", description: "Multiple Answers", fallback: String(pollMultipleAnswers) }
        ] : undefined,
      };

      const url = initialData ? `${BACKEND_URL}/api/v1/templates/${initialData.id}` : `${BACKEND_URL}/api/v1/templates`;
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(initialData ? "Template updated successfully!" : "Template created successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to save template.");
      }
    } catch {
      toast.error("Error saving template.");
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
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
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {initialData ? "Edit WhatsApp Template" : "Create New WhatsApp Template"}
              </h2>
              <p className="text-xs text-slate-500">
                Universal business broadcast template with anti-spam Spintax and dynamic CRM variables
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

        {/* 2-Column Body: Left Form + Right Live WhatsApp Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
          
          {/* Left Column: Form Controls (7 cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
            
            {/* Title & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Template Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Festival Special Offer, Appointment Reminder"
                  required
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="PROMO">☀️ Offers & Promos</option>
                  <option value="GREETING">✨ Greetings & Welcome</option>
                  <option value="REMINDER">📅 Follow-up & Reminders</option>
                  <option value="VIP">👑 VIP & Loyalty Perks</option>
                  <option value="TRANSACTIONAL">✅ Orders & Invoices</option>
                  <option value="GENERAL">💬 General Broadcast</option>
                </select>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* MEDIA ATTACHMENT: PROMINENT BUTTONS + DUAL UPLOAD + PUBLIC LINK + NOTICE  */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Media Attachment Format:</span>
              </label>

              {/* Prominent Media Format Selector Buttons with Icons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { type: "NONE", label: "Text Only", icon: MessageSquare, desc: "No media" },
                  { type: "IMAGE", label: "Image Banner", icon: ImageIcon, desc: "JPG / PNG" },
                  { type: "DOCUMENT", label: "PDF Document", icon: FileText, desc: "PDF files" },
                  { type: "VIDEO", label: "Video", icon: Video, desc: "MP4 files" },
                  { type: "POLL", label: "WhatsApp Poll", icon: BarChart2, desc: "Interactive voting" },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSel = mediaType === m.type;
                  return (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => {
                        setMediaType(m.type as any);
                        if (m.type !== "NONE" && m.type !== "POLL" && !mediaUrl) {
                          setMediaSourceMode("UPLOAD");
                        }
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-2xs ${
                        isSel
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500/60"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSel ? "text-white" : "text-emerald-600"}`} />
                      <div className="leading-tight">
                        <p className="text-xs font-bold">{m.label}</p>
                        <p className={`text-[9px] ${isSel ? "text-emerald-100" : "text-slate-400"}`}>{m.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Poll Configuration (When POLL is selected) */}
              {mediaType === "POLL" && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp Poll Configuration</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pollMultipleAnswers}
                        onChange={(e) => setPollMultipleAnswers(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span>Allow multiple answers</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Poll Question
                    </label>
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="e.g. Would you like to schedule an eye examination this week?"
                      className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Poll Options ({pollOptions.length}/12)
                    </label>
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...pollOptions];
                            updated[idx] = e.target.value;
                            setPollOptions(updated);
                          }}
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {pollOptions.length < 12 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`])}
                        className="text-xs font-bold text-emerald-600 hover:underline mt-1 cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Option</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {mediaType !== "NONE" && mediaType !== "POLL" && (
                <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                  {/* Mode Selector Tabs: Upload from Device vs Public Link */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaSourceMode("UPLOAD")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        mediaSourceMode === "UPLOAD"
                          ? "bg-white dark:bg-slate-900 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Upload from Device</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaSourceMode("URL")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        mediaSourceMode === "URL"
                          ? "bg-white dark:bg-slate-900 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Paste Public Link</span>
                    </button>
                  </div>

                  {/* Mode 1: Upload from Device (with automatic client-side compression) */}
                  {mediaSourceMode === "UPLOAD" && (
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={
                          mediaType === "IMAGE"
                            ? "image/*"
                            : mediaType === "DOCUMENT"
                            ? "application/pdf"
                            : "video/mp4,video/*"
                        }
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl bg-white dark:bg-slate-900/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-1.5"
                      >
                        {uploadingMedia ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Compressing & uploading media...</span>
                          </div>
                        ) : mediaUrl ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Media attached successfully! Click to replace</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-emerald-600" />
                            <p className="text-xs font-bold text-slate-800 dark:text-white">
                              Click to choose {mediaType.toLowerCase()} file from your device
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Images are automatically compressed to ensure fast delivery
                            </p>
                          </>
                        )}
                      </div>

                      {compressionStats && (
                        <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          ⚡ {compressionStats}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: Paste Public URL (100% Pastable and Editable with Instant Thumbnail) */}
                  {mediaSourceMode === "URL" && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Paste Direct Media URL
                        </label>
                        <input
                          type="text"
                          value={mediaUrl}
                          onChange={(e) => handleUrlChange(e.target.value)}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData("text");
                            if (pasted) {
                              handleUrlChange(pasted.trim());
                              toast.success("Public URL pasted!");
                            }
                          }}
                          placeholder="https://example.com/banner.jpg or https://d1.awsstatic.com/..."
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      {/* Instant URL Thumbnail Confirmation */}
                      {mediaUrl && mediaType === "IMAGE" && (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={mediaUrl}
                              alt="URL Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                          <div className="truncate flex-1">
                            <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{mediaUrl}</p>
                            <p className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>Image link verified & active</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 30-Day Expiry Yellow Warning Notice */}
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-amber-800 dark:text-amber-300 text-[11px] leading-tight">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Notice:</strong> Files uploaded directly from your device are retained on the CDN for 30 days. For permanent long-term broadcast campaigns, you can also paste a permanent public link.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* MESSAGE COMPOSER WITH TOP-RIGHT INSERT VARIABLE & INSERT SPINTAX DROPDOWNS */}
            {/* ========================================================================= */}
            <div className="space-y-2">
              
              {/* Header row with MESSAGE label on left, Insert Variable & Insert Spintax on right */}
              <div className="flex items-center justify-between pb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  MESSAGE
                </label>

                {/* Right Controls: {} Insert variable | 🔀 Insert spintax (with dropdowns & small toggle) */}
                <div className="flex items-center gap-4 relative">
                  
                  {/* 1. Insert Variable Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVariableDropdownOpen(!isVariableDropdownOpen);
                        setIsSpintaxDropdownOpen(false);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                    >
                      <span className="font-mono text-emerald-600 font-bold">&#123; &#125;</span>
                      <span>Insert variable</span>
                    </button>

                    {isVariableDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="py-1">
                          <button type="button" onClick={() => { handleInsertVariable("{{name}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{name}}"}</span>
                            <span className="text-[11px] text-slate-400">Full Name</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{whatsapp_name}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{whatsapp_name}}"}</span>
                            <span className="text-[11px] text-slate-400">WhatsApp Name</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{phone}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{phone}}"}</span>
                            <span className="text-[11px] text-slate-400">Number</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{city}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{city}}"}</span>
                            <span className="text-[11px] text-slate-400">City/Location</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{date}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{date}}"}</span>
                            <span className="text-[11px] text-slate-400">Current Date</span>
                          </button>
                        </div>
                        <div className="py-1">
                          <button type="button" onClick={() => { handleInsertVariable("{{business_name}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{business_name}}"}</span>
                            <span className="text-[11px] text-slate-400">Business Name</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{discount}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{discount}}"}</span>
                            <span className="text-[11px] text-slate-400">Discount Offer</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{coupon_code}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{coupon_code}}"}</span>
                            <span className="text-[11px] text-slate-400">Coupon Code</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{due_date}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{due_date}}"}</span>
                            <span className="text-[11px] text-slate-400">Due Date</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{var1}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{var1}}"}</span>
                            <span className="text-[11px] text-slate-400">Custom Var 1</span>
                          </button>
                          <button type="button" onClick={() => { handleInsertVariable("{{var2}}"); setIsVariableDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between group cursor-pointer">
                            <span className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{"{{var2}}"}</span>
                            <span className="text-[11px] text-slate-400">Custom Var 2</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Insert Spintax Dropdown & Toggle Switch */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSpintaxDropdownOpen(!isSpintaxDropdownOpen);
                          setIsVariableDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                      >
                        <Shuffle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Insert spintax</span>
                      </button>

                      {isSpintaxDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1.5">
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Anti-Spam Variations
                          </div>
                          {[
                            { pattern: "{Hello|Hi|Hey|Dear}", label: "Friendly Greeting" },
                            { pattern: "{Good morning|Good afternoon|Greetings|Hello}", label: "Time-based Greeting" },
                            { pattern: "{Namaste|Hello|Hi|Greetings}", label: "Regional Friendly" },
                            { pattern: "{Dear Valued Customer|Greetings|Hello|Dear}", label: "VIP / Formal" },
                            { pattern: "{Thanks|Thank you|Many thanks}", label: "Appreciation" },
                          ].map((s) => (
                            <button
                              key={s.pattern}
                              type="button"
                              onClick={() => {
                                handleInsertVariable(s.pattern);
                                setIsSpintaxDropdownOpen(false);
                              }}
                              className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex flex-col group cursor-pointer"
                            >
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">{s.pattern}</span>
                              <span className="text-[10px] text-slate-400">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Small Spintax Switch Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoSpintaxEnabled}
                      onClick={() => handleToggleSpintax(!autoSpintaxEnabled)}
                      title={autoSpintaxEnabled ? "Auto-Spintax is ON" : "Auto-Spintax is OFF"}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoSpintaxEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          autoSpintaxEnabled ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                </div>
              </div>

              {/* Message Body Textarea with Docked Locked Footer */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/40 transition-all shadow-inner">
                <textarea
                  ref={textareaRef}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  required
                  disabled={saving}
                  placeholder="Type your message here... Use {{name}} to personalize, or use {Hello|Hi|Hey} for anti-spam randomization."
                  className="w-full p-3.5 bg-transparent border-none text-xs text-slate-900 dark:text-white font-sans leading-relaxed focus:outline-none resize-y"
                />

                {/* Locked Opt-Out Footer Docked at Bottom of Template Textarea */}
                {unsubSettings.enabled && (
                  <div className="px-3.5 py-2.5 bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0 font-mono text-[11px]">
                      <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        {unsubSettings.optoutText}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 uppercase tracking-wider">
                      [Locked Opt-Out Footer]
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-0.5">
                <span>⚡ Anti-spam spintax {autoSpintaxEnabled ? "active" : "disabled"}</span>
                <span>{bodyText.length} characters</span>
              </div>
            </div>

            {/* Modal Bottom Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Template...</span>
                  </>
                ) : (
                  <span>{initialData ? "Update Template" : "Save Template 🚀"}</span>
                )}
              </button>
            </div>

          </form>

          {/* Right Column: Live WhatsApp Chat Mobile Preview (Light Background Theme) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="w-full flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live WhatsApp Preview (Light Theme)</span>
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">Real-Time</span>
            </div>

            <WhatsAppTemplateLivePreview
              bodyText={bodyText}
              mediaType={mediaType}
              mediaUrl={mediaUrl}
              pollQuestion={pollQuestion}
              pollOptions={pollOptions}
              pollMultiple={pollMultipleAnswers}
              optoutText={unsubSettings.enabled ? unsubSettings.optoutText : undefined}
            />
          </div>

        </div>

      </div>
    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: WHATSAPP TEMPLATE LIVE PHONE PREVIEW (LIGHT BACKGROUND THEME)  */
/* ========================================================================= */
function WhatsAppTemplateLivePreview({
  bodyText,
  mediaType,
  mediaUrl,
  pollQuestion,
  pollOptions,
  pollMultiple,
  optoutText,
}: {
  bodyText: string;
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL";
  mediaUrl?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  pollMultiple?: boolean;
  optoutText?: string;
}) {
  // Resolve Spintax patterns (e.g. {Hello|Hi|Hey|Dear} -> pick first)
  let resolvedText = (bodyText || "Type your marketing message on the left...")
    .replace(/{([^{}]+)}/g, (_, choices) => {
      const options = choices.split("|");
      return options[0] || choices;
    });

  // Universal CRM Variable substitutions with realistic samples
  resolvedText = resolvedText
    .replace(/{{s*names*}}/g, "Rahul Sharma")
    .replace(/{{s*customer_names*}}/g, "Rahul Sharma")
    .replace(/{{s*whatsapp_names*}}/g, "Rahul S.")
    .replace(/{{s*phones*}}/g, "+91 98765 43210")
    .replace(/{{s*citys*}}/g, "Delhi")
    .replace(/{{s*emails*}}/g, "rahul@gmail.com")
    .replace(/{{s*business_names*}}/g, "OpticalManager")
    .replace(/{{s*shop_names*}}/g, "OpticalManager")
    .replace(/{{s*discounts*}}/g, "20%")
    .replace(/{{s*discount_percents*}}/g, "20%")
    .replace(/{{s*coupon_codes*}}/g, "FESTIVE500")
    .replace(/{{s*voucher_codes*}}/g, "FESTIVE500")
    .replace(/{{s*expiry_dates*}}/g, "this Sunday")
    .replace(/{{s*order_numbers*}}/g, "#INV-8920")
    .replace(/{{s*order_ids*}}/g, "#INV-8920")
    .replace(/{{s*due_dates*}}/g, "14 May 2025")
    .replace(/{{s*last_prescription_dates*}}/g, "14 May 2024")
    .replace(/{{s*custom_1s*}}/g, "Premium Lens");

  if (optoutText && optoutText.trim()) {
    let opt = optoutText.trim();
    if (!opt.startsWith("_") && !opt.endsWith("_")) {
      opt = `_${opt}_`;
    }
    resolvedText = (resolvedText ? resolvedText.trim() + "\n\n" : "") + opt;
  }

  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full max-w-[280px] sm:max-w-[300px] select-none">
      <div className="bg-slate-200 dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-700 rounded-[32px] p-2 shadow-2xl relative overflow-hidden">
        
        {/* Smartphone Camera Notch */}
        <div className="w-20 h-3 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2" />

        {/* WhatsApp Mobile Chat Header (Light Green Emerald) */}
        <div className="bg-[#008069] p-2.5 rounded-t-xl flex items-center gap-2 text-white shadow-xs">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
            OM
          </div>
          <div className="truncate flex-1">
            <p className="text-[11px] font-bold leading-tight truncate text-white">Your Business Name</p>
            <p className="text-[8px] text-emerald-100 leading-none">Official Business Account</p>
          </div>
        </div>

        {/* WhatsApp Mobile Chat Wallpaper Background (LIGHT CREAM THEME) */}
        <div className="bg-[#efeae2] p-2.5 min-h-[300px] flex flex-col justify-end rounded-b-xl space-y-2 relative border border-slate-300/40">
          
          {/* Chat Message Bubble (LIGHT GREEN OUTGOING BUBBLE) */}
          <div className="bg-[#d9fdd3] text-[#111b21] rounded-xl rounded-tr-none p-2.5 space-y-1.5 max-w-[95%] ml-auto border border-emerald-200/60 shadow-xs">
            
            {/* Media Preview */}
            {mediaType === "IMAGE" && (
              <div className="rounded-lg overflow-hidden bg-slate-100 border border-slate-300 max-h-36 shadow-2xs">
                {mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl}
                    alt="Template Media"
                    className="w-full h-auto object-cover max-h-36"
                    onError={(e) => {
                      (e.target as HTMLElement).style.opacity = "0.8";
                    }}
                  />
                ) : (
                  <div className="p-4 text-center text-slate-500 space-y-1">
                    <ImageIcon className="w-6 h-6 mx-auto text-emerald-600" />
                    <p className="text-[9px] font-bold">Image Attachment Preview</p>
                  </div>
                )}
              </div>
            )}

            {mediaType === "DOCUMENT" && (
              <div className="bg-white border border-slate-200 p-2 rounded-lg flex items-center gap-2 shadow-2xs">
                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                <div className="truncate text-xs">
                  <p className="font-bold truncate text-slate-900 text-[10px]">Brochure_Catalog.pdf</p>
                  <p className="text-[8px] text-slate-500">PDF Document • 1.2 MB</p>
                </div>
              </div>
            )}

            {mediaType === "VIDEO" && (
              <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-600 shadow-2xs">
                <Video className="w-6 h-6 text-purple-600" />
                <p className="text-[8px] font-bold">Video Attachment Preview</p>
              </div>
            )}

            {/* Message Body Text */}
            {resolvedText && (
              <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-[#111b21] font-sans">
                {resolvedText}
              </p>
            )}

            {/* Poll Preview */}
            {mediaType === "POLL" && (
              <div className="bg-white/90 dark:bg-black/40 rounded-xl p-2.5 space-y-1.5 text-xs border border-emerald-300/80 shadow-2xs">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{pollQuestion || "Poll Question"}</span>
                </div>
                <div className="space-y-1 pt-0.5">
                  {(pollOptions && pollOptions.length > 0 ? pollOptions : ["Option 1", "Option 2"]).map((opt, idx) => (
                    <div key={idx} className="p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 flex items-center justify-between text-[10px] text-slate-800 dark:text-slate-200 font-medium">
                      <div className="flex items-center gap-1.5">
                        {pollMultiple ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <div className="w-2.5 h-2.5 rounded-full border border-slate-400" />}
                        <span>{opt}</span>
                      </div>
                      <span className="text-[8px] text-slate-400">0%</span>
                    </div>
                  ))}
                </div>
                <div className="text-[8px] text-slate-500 pt-0.5 text-right">
                  {pollMultiple ? "Select one or more" : "Select one"}
                </div>
              </div>
            )}

            {/* Timestamp & Double Blue Tick */}
            <div className="flex items-center justify-end gap-1 text-[8px] text-[#667781] pt-0.5">
              <span>{currentTime}</span>
              <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
            </div>
          </div>

          <div className="text-center text-[8px] text-slate-500 py-0.5">
            🔒 End-to-end encrypted • WhatsApp Broadcast Engine
          </div>
        </div>

      </div>
    </div>
  );
}
