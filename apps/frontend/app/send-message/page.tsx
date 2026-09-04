"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getBackendUrl } from "@/lib/backend-url";
import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { 
  Send, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  HelpCircle, 
  Layers, 
  Smartphone, 
  Scissors, 
  Globe, 
  Eraser, 
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  MessageSquare,
  BarChart2,
  MapPin,
  UserCheck,
  Paperclip,
  Calendar,
  Shuffle,
  ChevronDown,
  Check,
  Loader2,
  FileText,
  Search,
  Users,
  Clock,
  Settings2,
  Info,
  PhoneCall,
  ExternalLink,
  CornerDownLeft,
  Copy,
  Menu,
  CheckSquare,
  Lock
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  phoneNumber: string | null;
  displayName: string | null;
  status: string;
}

interface ContactRow {
  id: string;
  name: string;
  number: string;
  city?: string;
  tag?: string;
  var1?: string;
  var2?: string;
  var3?: string;
  var4?: string;
  var5?: string;
  var6?: string;
  var7?: string;
}

interface AudienceSegment {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
}

interface AttachedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
}

export type WhatsAppMessageType = 
  | "Text"
  | "Text With Media"
  | "Poll"
  | "Poll With Media";

const PRESET_TEMPLATES: Record<string, { text: string; type: WhatsAppMessageType }> = {
  "New Message": {
    text: "",
    type: "Text"
  },
  "Festival Offer": {
    text: "Hello {{name}}! 🌟 Special Festival Offer: Enjoy 20% OFF on all designer spectacles and lenses at Optical Manager! Use coupon code: FESTIVAL20 when you visit. Valid till Sunday! 👓✨",
    type: "Text With Media"
  },
  "Eye Test Appointment": {
    text: "Dear {{name}}, this is a friendly reminder for your scheduled Comprehensive Eye Examination at Optical Manager. Our certified optometrist is ready to assist you. Location: {{city}} clinic. Reply 1 to confirm or 2 to reschedule.",
    type: "Text"
  },
  "Order Ready for Pickup": {
    text: "Great news {{name}}! 🎉 Your eyewear order is crafted and quality-checked. It is ready for pickup at our clinic. Please bring your receipt when visiting.",
    type: "Text"
  }
};

// High-Performance Client-Side Smart Image Compression (Max 1280px HD, Quality 0.82)
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
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
      }

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

export default function CampaignsStudioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-medium">Loading Campaign Studio...</div>}>
      <CampaignsStudioInner />
    </Suspense>
  );
}

function CampaignsStudioInner() {
  const { user: authUser, getAuthHeaders, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");
  const audienceParam = searchParams.get("audience");
  const backendUrl = getBackendUrl();

  // Left Panel - 1. Campaign Name
  const [campaignName, setCampaignName] = useState<string>(() => {
    const d = new Date();
    const formatted = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `Campaign ${formatted}, ${time}`;
  });

  // Left Panel - 2. Recipients Tabs
  const [recipientTab, setRecipientTab] = useState<"CSV" | "Paste" | "Groups" | "Contacts">("Paste");
  
  // 1. Paste Tab State (Starts CLEAN)
  const [pasteRawText, setPasteRawText] = useState<string>("");
  
  // 2. CSV Tab State (Starts CLEAN)
  const [csvContacts, setCsvContacts] = useState<ContactRow[]>([]);
  
  // 3. Groups (Audiences) Tab State
  const [savedAudiences, setSavedAudiences] = useState<AudienceSegment[]>([]);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>([]);

  // 4. Contacts Tab State
  const [allDbContacts, setAllDbContacts] = useState<any[]>([]);
  const [contactsSearch, setContactsSearch] = useState<string>("");
  const [selectedDbContactIds, setSelectedDbContactIds] = useState<string[]>([]);
  const [contactsLoading, setContactsLoading] = useState<boolean>(false);
  const [contactsSerialFrom, setContactsSerialFrom] = useState<string>("");
  const [contactsSerialTo, setContactsSerialTo] = useState<string>("");

  const handleApplyContactsSerialRange = () => {
    const from = parseInt(contactsSerialFrom, 10);
    const to = parseInt(contactsSerialTo, 10);
    if (isNaN(from) || isNaN(to)) {
      toast.error("Please enter valid serial numbers for From and To.");
      return;
    }
    if (from < 1 || to < from) {
      toast.error("From serial must be at least 1 and To serial must be greater than or equal to From.");
      return;
    }

    const matchingIds: string[] = [];
    allDbContacts.forEach((c, index) => {
      const sNo = c.serialNumber != null ? c.serialNumber : index + 1;
      if (sNo >= from && sNo <= to) {
        matchingIds.push(c.id);
      }
    });

    if (matchingIds.length === 0) {
      toast.error(`No contacts found in serial range #${from} to #${to}.`);
      return;
    }

    setSelectedDbContactIds(matchingIds);
    toast.success(`Selected ${matchingIds.length} contact(s) from serial #${from} to #${to}.`);
  };

  // Left Panel - 3. Template & 8 WhatsApp Message Types matching Image 1
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("New Message");
  const [isVariableDropdownOpen, setIsVariableDropdownOpen] = useState(false);
  const [isSpintaxDropdownOpen, setIsSpintaxDropdownOpen] = useState(false);
  const [autoSpintaxEnabled, setAutoSpintaxEnabled] = useState(true);
  const [messageType, setMessageType] = useState<WhatsAppMessageType>("Text");
  const [mediaFormat, setMediaFormat] = useState<"NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL">("NONE");

  // Left Panel - 4. Message Composer Text & Anti-Ban Spintax
  const [messageText, setMessageText] = useState<string>("{Hello|Hi|Hey|Dear} ");
  
  // Attachments State (Starts CLEAN)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [compressionStats, setCompressionStats] = useState<string | null>(null);
  const [textWithMediaMode, setTextWithMediaMode] = useState<"caption" | "separate">("caption");
  const [publicMediaUrl, setPublicMediaUrl] = useState<string>("");
  const [templateMediaUrl, setTemplateMediaUrl] = useState<string>("");

  // Poll Builder State (for Poll & Poll With Media)
  const [pollQuestion, setPollQuestion] = useState<string>("Would you like to schedule an eye checkup this week?");
  const [pollOptions, setPollOptions] = useState<string[]>(["Yes, definitely!", "Maybe next week", "No, thanks"]);
  const [pollMultipleAnswers, setPollMultipleAnswers] = useState<boolean>(false);

  // Format Switcher Helper (Matching template modal cards)
  const handleSelectMediaFormat = (format: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "POLL") => {
    setMediaFormat(format);
    if (format === "NONE") {
      setMessageType("Text");
    } else if (format === "POLL") {
      setMessageType("Poll");
    } else {
      setMessageType("Text With Media");
    }
  };

  // Right Panel - Send Pacing State
  const [useAccountDelay, setUseAccountDelay] = useState<boolean>(true);
  const [warmupRamp, setWarmupRamp] = useState<boolean>(true);
  const [batchSizeStr, setBatchSizeStr] = useState<string>("5");
  const [batchPauseStr, setBatchPauseStr] = useState<string>("60");

  // Right Panel - Send From Selected Instances
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

  // Modals State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawSheetData, setRawSheetData] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<any>({
    name: -1, phone: -1, city: -1, tag: -1, var1: -1, var2: -1, var3: -1, var4: -1
  });
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = useState(false);
  const [countryCodeInput, setCountryCodeInput] = useState("91");

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastSettings, setBroadcastSettings] = useState<{
    minDelaySec: number;
    maxDelaySec: number;
    sleepEnabled: boolean;
    sleepAfterMessages: number;
    sleepForSeconds: number;
  }>({
    minDelaySec: 50,
    maxDelaySec: 60,
    sleepEnabled: true,
    sleepAfterMessages: 10,
    sleepForSeconds: 60,
  });

  const [unsubSettings, setUnsubSettings] = useState<{ enabled: boolean; optoutText: string }>({
    enabled: true,
    optoutText: "_Reply STOP to unsubscribe from promotional messages._",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if active message type requires media attachments
  const isMediaRequired = useMemo(() => {
    return (
      messageType === "Text With Media" ||
      messageType === "Poll With Media"
    );
  }, [messageType]);

  // Determine if active message type is Poll
  const isPollMode = useMemo(() => {
    return messageType === "Poll" || messageType === "Poll With Media" || mediaFormat === "POLL";
  }, [messageType, mediaFormat]);

  // ==========================================
  // 1. DATA FETCHING
  // ==========================================

  useEffect(() => {
    async function loadInitialData() {
      if (!isAuthenticated) return;
      const headers = getAuthHeaders();

      // 0. Load DB Templates from PostgreSQL
      try {
        const tRes = await fetch(`${backendUrl}/api/v1/templates`, { headers });
        if (tRes.ok) {
          const tJson = await tRes.json();
          if (tJson.success && Array.isArray(tJson.data)) {
            setDbTemplates(tJson.data);
          }
        }
      } catch {}

      // 0. Load Global Broadcast Settings for Real Pace Calculation
      try {
        const setRes = await fetch(`${backendUrl}/api/v1/settings`, { headers });
        if (setRes.ok) {
          const setJson = await setRes.json();
          if (setJson.success && setJson.data) {
            setBroadcastSettings({
              minDelaySec: Number(setJson.data.minDelaySec) || 15,
              maxDelaySec: Number(setJson.data.maxDelaySec) || 20,
              sleepEnabled: setJson.data.sleepEnabled !== false,
              sleepAfterMessages: Number(setJson.data.sleepAfterMessages) || 25,
              sleepForSeconds: Number(setJson.data.sleepForSeconds) || 10,
            });
          }
        }
      } catch {}

      // 0. Load Unsubscriber Settings
      try {
        const unRes = await fetch(`${backendUrl}/api/v1/unsubscribers/settings`, { headers });
        if (unRes.ok) {
          const unJson = await unRes.json();
          if (unJson.success && unJson.data) {
            setUnsubSettings({
              enabled: unJson.data.enabled !== false,
              optoutText: unJson.data.optoutText || "Reply STOP to unsubscribe from promotional messages.",
            });
          }
        }
      } catch {}

      // 1. Load WhatsApp Instances
      try {
        const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setInstances(json.data);
            const connectedIds = json.data.filter((i: any) => i.status === "CONNECTED").map((i: any) => i.id);
            setSelectedInstanceIds(connectedIds.length > 0 ? connectedIds : (json.data[0] ? [json.data[0].id] : []));
          }
        }
      } catch {}

      // 2. Load Saved Audiences
      try {
        const res = await fetch(`${backendUrl}/api/v1/audiences`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setSavedAudiences(json.data);
          }
        }
      } catch {}

      // 3. Load DB Contacts
      try {
        setContactsLoading(true);
        const res = await fetch(`${backendUrl}/api/v1/contacts?limit=10000`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setAllDbContacts(json.data);
          }
        }
      } catch {} finally {
        setContactsLoading(false);
      }

      // 4. Handle Template Query Param
      if (templateParam) {
        try {
          const tRes = await fetch(`${backendUrl}/api/v1/templates/${templateParam}`, { headers });
          if (tRes.ok) {
            const tJson = await tRes.json();
            const tpl = tJson.data || tJson;
            if (tpl && tpl.bodyText) {
              setMessageText(tpl.bodyText);
              const tplMedia = tpl.mediaType || (tpl.mediaUrl ? "IMAGE" : "NONE");
              setMediaFormat(tplMedia);
              if (tplMedia === "POLL") {
                setMessageType("Poll");
                const q = tpl.variables?.find((v: any) => v.key === "poll_question")?.fallback;
                if (q) setPollQuestion(q);
                const opts = tpl.variables?.find((v: any) => v.key === "poll_options")?.fallback;
                if (opts) {
                  try { setPollOptions(JSON.parse(opts)); } catch {}
                }
                const mult = tpl.variables?.find((v: any) => v.key === "poll_multiple")?.fallback;
                if (mult) setPollMultipleAnswers(mult === "true");
              } else if (tplMedia === "IMAGE" || tplMedia === "DOCUMENT" || tplMedia === "VIDEO" || tpl.mediaUrl) {
                setMessageType("Text With Media");
                if (tpl.mediaUrl) setPublicMediaUrl(tpl.mediaUrl);
              } else {
                setMessageType("Text");
              }
              toast.success(`Loaded template: "${tpl.title}"`);
            }
          }
        } catch {}
      }

      // 5. Handle Audience Query Param
      if (audienceParam) {
        setRecipientTab("Groups");
        setSelectedAudienceIds([audienceParam]);
      }
    }

    loadInitialData();
  }, [isAuthenticated, templateParam, audienceParam]);

  // Handle Template Switching with PostgreSQL DB templates
  const handleSelectTemplate = (templateIdOrKey: string) => {
    setSelectedTemplateKey(templateIdOrKey);
    if (templateIdOrKey === "New Message") {
      setMessageText("");
      setMessageType("Text");
      setMediaFormat("NONE");
      setPublicMediaUrl("");
      setTemplateMediaUrl("");
      setAttachedFiles([]);
      return;
    }

    // Check DB templates first
    const dbTpl = dbTemplates.find((t) => t.id === templateIdOrKey);
    if (dbTpl) {
      setMessageText(dbTpl.bodyText);
      const tplMedia = (dbTpl as any).mediaType || (dbTpl.mediaUrl ? "IMAGE" : "NONE");
      setMediaFormat(tplMedia);

      if (tplMedia === "POLL") {
        setMessageType("Poll");
        const q = dbTpl.variables?.find((v: any) => v.key === "poll_question")?.fallback;
        if (q) setPollQuestion(q);
        const opts = dbTpl.variables?.find((v: any) => v.key === "poll_options")?.fallback;
        if (opts) {
          try { setPollOptions(JSON.parse(opts)); } catch {}
        }
        const mult = dbTpl.variables?.find((v: any) => v.key === "poll_multiple")?.fallback;
        if (mult) setPollMultipleAnswers(mult === "true");
        setTemplateMediaUrl("");
        setAttachedFiles([]);
      } else if (tplMedia === "IMAGE" || tplMedia === "DOCUMENT" || tplMedia === "VIDEO" || dbTpl.mediaUrl) {
        setMessageType("Text With Media");
        if (dbTpl.mediaUrl) {
          setTemplateMediaUrl(dbTpl.mediaUrl);
          setAttachedFiles([
            {
              id: "tpl-media-" + dbTpl.id,
              name: `${dbTpl.title} ${tplMedia === "DOCUMENT" ? "Document" : tplMedia === "VIDEO" ? "Video" : "Image"}`,
              size: "Template Media",
              type: tplMedia === "DOCUMENT" ? "application/pdf" : tplMedia === "VIDEO" ? "video/mp4" : "image/jpeg",
              url: dbTpl.mediaUrl,
            },
          ]);
        } else {
          setTemplateMediaUrl("");
          setAttachedFiles([]);
        }
      } else {
        setMessageType("Text");
        setTemplateMediaUrl("");
        setAttachedFiles([]);
      }

      // DO NOT overwrite publicMediaUrl input box with backend/template URL; keep it clean for manual entry
      setPublicMediaUrl("");
      toast.success(`Applied template: "${dbTpl.title}"`);
      return;
    }

    // Fallback to preset
    const tpl = PRESET_TEMPLATES[templateIdOrKey];
    if (tpl) {
      setMessageText(tpl.text);
      setMessageType(tpl.type);
      setMediaFormat(tpl.type.includes("Poll") ? "POLL" : tpl.type.includes("Media") ? "IMAGE" : "NONE");
    }
  };

  // Toggle Auto-Spintax
  const handleToggleSpintax = (checked: boolean) => {
    setAutoSpintaxEnabled(checked);
    if (checked) {
      if (!messageText.startsWith("{")) {
        setMessageText("{Hello|Hi|Hey|Dear} " + messageText);
      }
    } else {
      const cleaned = messageText.replace(/^\{[^\}]+\}\s*/, "");
      setMessageText(cleaned);
    }
  };

  // Generic Insert at Cursor
  const insertAtCursor = (token: string) => {
    if (!textareaRef.current) {
      setMessageText((prev) => prev + " " + token);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const newText = messageText.substring(0, start) + token + messageText.substring(end);
    setMessageText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // ==========================================
  // 2. RECIPIENTS COMPUTATION
  // ==========================================

  const parsedPastedNumbers = useMemo(() => {
    if (!pasteRawText.trim()) return [];
    const lines = pasteRawText.split(/[\n,;]+/);
    const valid: Array<{ phone: string; name: string }> = [];
    const seen = new Set<string>();

    lines.forEach((l, idx) => {
      const clean = l.replace(/\D/g, "");
      if (clean.length >= 10 && clean.length <= 15 && !seen.has(clean)) {
        seen.add(clean);
        valid.push({
          phone: clean.startsWith("0") ? "91" + clean.slice(1) : clean.length === 10 ? "91" + clean : clean,
          name: `Recipient ${idx + 1}`
        });
      }
    });
    return valid;
  }, [pasteRawText]);

  const audienceSelectedCount = useMemo(() => {
    return savedAudiences
      .filter((a) => selectedAudienceIds.includes(a.id))
      .reduce((sum, a) => sum + (Number(a.contactCount) || 0), 0);
  }, [savedAudiences, selectedAudienceIds]);

  const totalRecipientsCount = useMemo(() => {
    if (recipientTab === "Paste") return parsedPastedNumbers.length;
    if (recipientTab === "CSV") return csvContacts.length;
    if (recipientTab === "Groups") return audienceSelectedCount;
    if (recipientTab === "Contacts") return selectedDbContactIds.length;
    return 0;
  }, [recipientTab, parsedPastedNumbers, csvContacts, audienceSelectedCount, selectedDbContactIds]);

  const activeSendingAccountsCount = useMemo(() => {
    if (selectedInstanceIds.length > 0) return selectedInstanceIds.length;
    return instances.filter((i) => i.status === "CONNECTED").length || 1;
  }, [selectedInstanceIds, instances]);

  // Real Sample Recipient for Dynamic Variable Preview
  const sampleRecipientData = useMemo(() => {
    if (recipientTab === "Paste" && parsedPastedNumbers.length > 0) {
      return {
        name: parsedPastedNumbers[0].name || "Valued Customer",
        phone: "+" + parsedPastedNumbers[0].phone.replace(/\D/g, ""),
        city: "Main City",
        var1: "Sample 1",
        var2: "Sample 2",
      };
    }
    if (recipientTab === "CSV" && csvContacts.length > 0) {
      const c = csvContacts[0];
      return {
        name: c.name || "Valued Customer",
        phone: c.number ? (c.number.startsWith("+") ? c.number : "+" + c.number.replace(/\D/g, "")) : "+91 98765 43210",
        city: c.city || "Main City",
        var1: c.var1 || "Sample 1",
        var2: c.var2 || "Sample 2",
      };
    }
    if (recipientTab === "Contacts" && selectedDbContactIds.length > 0) {
      const contact = allDbContacts.find((c) => selectedDbContactIds.includes(c.id));
      if (contact) {
        return {
          name: contact.name || "Valued Customer",
          phone: contact.phone ? (contact.phone.startsWith("+") ? contact.phone : "+" + contact.phone.replace(/\D/g, "")) : "+91 98765 43210",
          city: contact.city || "Main City",
          var1: "Sample 1",
          var2: "Sample 2",
        };
      }
    }
    return {
      name: "Rahul Sharma",
      phone: "+91 98765 43210",
      city: "Mumbai",
      var1: "Sample 1",
      var2: "Sample 2",
    };
  }, [recipientTab, parsedPastedNumbers, csvContacts, selectedDbContactIds, allDbContacts]);

  // Real Pace & Realistic Estimated Duration (Calculated from PostgreSQL broadcast_settings)
  const { estimatedPacePerHour, estimatedDurationDisplay } = useMemo(() => {
    const numAccounts = Math.max(1, activeSendingAccountsCount);
    const avgDelay = (broadcastSettings.minDelaySec + broadcastSettings.maxDelaySec) / 2;
    const sleepOverhead =
      broadcastSettings.sleepEnabled && broadcastSettings.sleepAfterMessages > 0
        ? broadcastSettings.sleepForSeconds / broadcastSettings.sleepAfterMessages
        : 0;
    const effectiveSecPerBroadcast = (avgDelay + sleepOverhead) / numAccounts;

    const pace = Math.round(3600 / effectiveSecPerBroadcast);

    if (totalRecipientsCount === 0) {
      return {
        estimatedPacePerHour: pace,
        estimatedDurationDisplay: "—",
      };
    }

    const totalSeconds = Math.round(totalRecipientsCount * effectiveSecPerBroadcast);
    let durStr = "";
    if (totalSeconds < 60) {
      durStr = `~${totalSeconds} sec`;
    } else if (totalSeconds < 3600) {
      const mins = Math.floor(totalSeconds / 60);
      const remSecs = totalSeconds % 60;
      durStr = remSecs > 0 ? `~${mins} min ${remSecs}s` : `~${mins} min`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const remMins = Math.round((totalSeconds % 3600) / 60);
      durStr = `~${hours}h ${remMins}m`;
    }

    return {
      estimatedPacePerHour: pace,
      estimatedDurationDisplay: durStr,
    };
  }, [broadcastSettings, activeSendingAccountsCount, totalRecipientsCount]);

  // ==========================================
  // 3. UTILITIES & FORMATTING
  // ==========================================

  const insertVariable = (varCode: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = messageText;
    const replacement = `{{${varCode}}}`;
    const updated = text.substring(0, start) + replacement + text.substring(end);
    setMessageText(updated);
    setIsVariableDropdownOpen(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  const insertSpintax = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = messageText.substring(start, end);
    const replacement = selected ? `{${selected}|option2|option3}` : "{hi|hello|hey}";
    const updated = messageText.substring(0, start) + replacement + messageText.substring(end);
    setMessageText(updated);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  // Preview Spintax resolver for real-time visualization with real recipient data
  const previewResolvedText = useMemo(() => {
    if (!messageText && (!unsubSettings.enabled || !unsubSettings.optoutText)) return "";
    let resolved = messageText || "";
    // 1. Spintax resolution (picks 1st variation for preview)
    resolved = resolved.replace(/\{([^{}]+)\}/g, (_, opts) => opts.split("|")[0]);
    
    // 2. Real dynamic variable substitutions
    const previewName = sampleRecipientData.name && !sampleRecipientData.name.startsWith("Recipient") && sampleRecipientData.name !== "Customer" && sampleRecipientData.name !== "Valued Customer" ? sampleRecipientData.name : "";
    resolved = resolved
      .replace(/\{\{whatsapp[-_]?name\}\}/gi, previewName)
      .replace(/\{\{push[-_]?name\}\}/gi, previewName)
      .replace(/\{\{customer[-_]?name\}\}/gi, previewName)
      .replace(/\{\{name\}\}/gi, previewName)
      .replace(/\{\{(phone|number|whatsapp[-_]?number|mobile)\}\}/gi, sampleRecipientData.phone)
      .replace(/\{\{(city|location)\}\}/gi, sampleRecipientData.city)
      .replace(/\{\{(date|today)\}\}/gi, new Date().toLocaleDateString("en-GB"))
      .replace(/\{\{var1\}\}/gi, sampleRecipientData.var1)
      .replace(/\{\{var2\}\}/gi, sampleRecipientData.var2)
      .replace(/\{\{(shop[-_]?name|business[-_]?name)\}\}/gi, "Dhaba Opticals")
      .replace(/\{\{(coupon[-_]?code|voucher[-_]?code)\}\}/gi, "FESTIVAL20")
      .replace(/\{\{discount\}\}/gi, "20%")
      .replace(/ +([,!.?:;])/g, "$1")
      .replace(/  +/g, " ");

    // 3. Opt-out compliance footer (rendered in italic)
    if (unsubSettings.enabled && unsubSettings.optoutText) {
      let opt = unsubSettings.optoutText.trim();
      if (!opt.startsWith("_") && !opt.endsWith("_")) {
        opt = `_${opt}_`;
      }
      if (opt) {
        resolved = (resolved ? resolved.trim() + "\n\n" : "") + opt;
      }
    }
    return resolved;
  }, [messageText, unsubSettings, sampleRecipientData]);

  // Smart File Upload Handling with High-Speed Compression & Instant Preview
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (attachedFiles.length >= 5) {
      toast.error("Maximum 5 attachments allowed.");
      return;
    }

    const file = files[0];
    setCompressionStats(null);

    try {
      let finalBase64 = "";
      let mimeType = file.type || "image/jpeg";
      let filename = file.name;
      let displaySize = (file.size / 1024).toFixed(1) + " KB";

      if (file.type.startsWith("image/")) {
        setMediaFormat("IMAGE");
        const compressed = await compressImageFile(file);
        finalBase64 = compressed.base64;
        mimeType = "image/jpeg";
        filename = file.name.replace(/\.[^/.]+$/, ".jpg");
        displaySize = compressed.compressedKB + " KB";
        const savedPct = Math.max(0, Math.round((1 - compressed.compressedKB / Math.max(compressed.originalKB, 1)) * 100));
        setCompressionStats(`⚡ Smart Compressed: ${compressed.originalKB} KB → ${compressed.compressedKB} KB (${savedPct}% saved)`);
      } else {
        finalBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      let finalMediaUrl = finalBase64;

      // Try uploading to backend endpoint for permanent URL
      try {
        const res = await fetch(`${backendUrl}/api/v1/media/upload-direct`, {
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
          if (json.success && json.data?.fileUrl) {
            finalMediaUrl = json.data.fileUrl;
          }
        }
      } catch {}

      const newAttach: AttachedFile = {
        id: "f-" + Date.now(),
        name: filename,
        size: displaySize,
        type: mimeType,
        url: finalMediaUrl,
      };

      setAttachedFiles((prev) => [...prev, newAttach].slice(0, 5));
      setTemplateMediaUrl("");
      setMediaFormat(mimeType.startsWith("image/") ? "IMAGE" : mimeType.includes("pdf") ? "DOCUMENT" : mimeType.startsWith("video/") ? "VIDEO" : "IMAGE");
      setMessageType("Text With Media");
      toast.success(`Attached ${filename} (${displaySize})`);
    } catch {
      toast.error("Failed to process and compress attached file.");
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Paste Utilities
  const handlePasteRemoveDuplicates = () => {
    const lines = pasteRawText.split(/[\n,;]+/);
    const seen = new Set<string>();
    const deduped: string[] = [];
    lines.forEach((l) => {
      const clean = l.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        deduped.push(clean);
      }
    });
    setPasteRawText(deduped.join("\n"));
    toast.success(`Removed duplicate numbers.`);
  };

  const handleInsertCountryCodeToPaste = () => {
    const code = countryCodeInput.trim().replace(/\D/g, "") || "91";
    const lines = pasteRawText.split(/[\n,;]+/);
    const modified = lines.map((l) => {
      const digits = l.replace(/\D/g, "");
      if (digits.length === 10) return code + digits;
      if (digits.length === 11 && digits.startsWith("0")) return code + digits.slice(1);
      return l;
    });
    setPasteRawText(modified.join("\n"));
    setIsCountryCodeModalOpen(false);
    toast.success(`Prepended +${code} to 10-digit numbers.`);
  };

  // ==========================================
  // 4. 4-STEP CSV IMPORT WIZARD LOGIC
  // ==========================================

  const handleFileDropOrSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const jsonSheet: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

        if (!jsonSheet || jsonSheet.length === 0) {
          toast.error("Uploaded file is empty.");
          return;
        }

        setRawSheetData(jsonSheet);
        setHeaderRowIdx(0);
        autoDetectColumns(jsonSheet, 0);
        setWizardStep(2);
      } catch (err: any) {
        toast.error("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const autoDetectColumns = (sheet: any[][], headerIdx: number) => {
    if (!sheet[headerIdx]) return;
    const headers = sheet[headerIdx].map((h: any) =>
      String(h || "").trim().toLowerCase().replace(/[\s_-]/g, "")
    );

    const mapping: any = {
      name: -1, phone: -1, city: -1, tag: -1, var1: -1, var2: -1, var3: -1, var4: -1
    };

    headers.forEach((h: string, idx: number) => {
      if (mapping.phone === -1 && ["phone", "mobile", "contact", "number", "phonenumber", "whatsapp", "tel", "cell"].includes(h)) {
        mapping.phone = idx;
      } else if (mapping.name === -1 && ["name", "fullname", "customername", "clientname", "patientname", "first"].includes(h)) {
        mapping.name = idx;
      } else if (mapping.city === -1 && ["city", "location", "town", "district"].includes(h)) {
        mapping.city = idx;
      } else if (mapping.tag === -1 && ["tag", "tags", "category", "group"].includes(h)) {
        mapping.tag = idx;
      } else if (mapping.var1 === -1 && h.includes("var1")) mapping.var1 = idx;
      else if (mapping.var2 === -1 && h.includes("var2")) mapping.var2 = idx;
    });

    if (mapping.phone === -1) {
      for (let c = 0; c < headers.length; c++) {
        const sampleVal = String(sheet[headerIdx + 1]?.[c] || "").replace(/\D/g, "");
        if (sampleVal.length >= 10 && sampleVal.length <= 15) {
          mapping.phone = c;
          break;
        }
      }
    }

    setColumnMapping(mapping);
  };

  const processAndValidateData = () => {
    if (columnMapping.phone === -1) {
      toast.error("Please match a column to 'Phone Number'.");
      return;
    }

    const dataRows = rawSheetData.slice(headerRowIdx + 1);
    const validated: any[] = [];

    dataRows.forEach((r, idx) => {
      if (!r || r.length === 0 || r.every((cell) => cell === undefined || cell === "")) return;
      const rawPhone = String(r[columnMapping.phone] || "").trim();
      const rawName = columnMapping.name !== -1 ? String(r[columnMapping.name] || "").trim() : "";
      const rawCity = columnMapping.city !== -1 ? String(r[columnMapping.city] || "").trim() : "";
      const v1 = columnMapping.var1 !== -1 ? String(r[columnMapping.var1] || "").trim() : "";
      const v2 = columnMapping.var2 !== -1 ? String(r[columnMapping.var2] || "").trim() : "";

      const cleanNum = rawPhone.replace(/\D/g, "");
      let isValid = cleanNum.length >= 10 && cleanNum.length <= 15;
      let errorMsg = !cleanNum ? "Missing number" : cleanNum.length < 10 ? "Less than 10 digits" : "";

      validated.push({
        row: {
          id: `csv_${idx}_${Date.now()}`,
          name: rawName || "Customer",
          number: cleanNum || rawPhone,
          city: rawCity,
          var1: v1,
          var2: v2
        },
        valid: isValid,
        errorMsg,
        selected: isValid
      });
    });

    setValidatedRows(validated);
    setWizardStep(4);
  };

  const handleConfirmImport = () => {
    const selected = validatedRows.filter((item) => item.selected && item.valid).map((item) => item.row);
    if (selected.length === 0) {
      toast.error("No valid rows selected.");
      return;
    }
    setCsvContacts((prev) => [...prev, ...selected]);
    setIsWizardOpen(false);
    toast.success(`Imported ${selected.length} contacts from file!`);
  };

  // ==========================================
  // 5. CAMPAIGN DISPATCH
  // ==========================================

  const handleStartCampaign = async (scheduleIso?: string) => {
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }

    if (totalRecipientsCount === 0) {
      toast.error("Please add at least one recipient (via CSV, paste numbers, groups, or contacts).");
      return;
    }

    if (!messageText.trim() && !pollQuestion.trim()) {
      toast.error("Message content cannot be empty.");
      return;
    }

    let finalRecipients: Array<{ id: string; phone: string; name?: string; variables?: any }> = [];

    if (recipientTab === "Paste") {
      finalRecipients = parsedPastedNumbers.map((p, idx) => ({
        id: `pst_${idx}_${Date.now()}`,
        phone: p.phone,
        name: p.name,
        variables: { name: p.name, customer_name: p.name }
      }));
    } else if (recipientTab === "CSV") {
      finalRecipients = csvContacts.map((c) => ({
        id: c.id,
        phone: c.number,
        name: c.name,
        variables: { name: c.name, customer_name: c.name, city: c.city || "", var1: c.var1 || "", var2: c.var2 || "" }
      }));
    } else if (recipientTab === "Contacts") {
      finalRecipients = allDbContacts
        .filter((c) => selectedDbContactIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          phone: c.phone,
          name: c.name,
          variables: { name: c.name, customer_name: c.name, city: c.city || "" }
        }));
    } else if (recipientTab === "Groups") {
      if (selectedAudienceIds.length === 0) {
        toast.error("Please select at least one contact segment.");
        return;
      }

      // Fetch actual real contacts for all selected segments from backend
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const fetchedContacts: any[] = [];

      for (const audId of selectedAudienceIds) {
        try {
          const res = await fetch(`${backendUrl}/api/v1/audiences/${audId}/contacts`, { headers });
          if (res.ok) {
            const json = await res.json();
            const list = json.data || json.contacts || (Array.isArray(json) ? json : []);
            if (Array.isArray(list)) {
              fetchedContacts.push(...list);
            }
          }
        } catch (err) {
          console.error("Error fetching segment contacts:", err);
        }
      }

      // Deduplicate contacts by 10-digit phone number
      const seenPhones = new Set<string>();
      finalRecipients = [];

      for (const c of fetchedContacts) {
        const rawPhone = String(c.phone || c.number || "").replace(/\D/g, "");
        const phone10 = rawPhone.slice(-10);
        if (phone10.length === 10 && !seenPhones.has(phone10)) {
          seenPhones.add(phone10);
          finalRecipients.push({
            id: c.id || `seg_${Date.now()}_${finalRecipients.length}`,
            phone: rawPhone.length === 10 ? "91" + rawPhone : rawPhone,
            name: c.name || "Customer",
            variables: {
              name: c.name || "Customer",
              customer_name: c.name || "Customer",
              phone: rawPhone,
              city: c.city || "",
              var1: c.var1 || "",
              var2: c.var2 || "",
            }
          });
        }
      }

      if (finalRecipients.length === 0) {
        toast.error("The selected contact segment has 0 contacts. Please select a segment with contacts or add members first.");
        return;
      }
    }

    try {
      setSending(true);
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      
      const payload: any = {
        name: campaignName.trim(),
        messageText,
        mediaUrl: publicMediaUrl.trim() || (attachedFiles[0]?.url ? attachedFiles[0].url : undefined) || (templateMediaUrl.trim() ? templateMediaUrl : undefined),
        sendFromInstances: selectedInstanceIds.length > 0 ? selectedInstanceIds : undefined,
        recipients: finalRecipients,
        targetAudienceType: recipientTab,
        audienceNames: recipientTab === "Groups" ? savedAudiences.filter((a) => selectedAudienceIds.includes(a.id)).map((a) => a.name) : undefined,
        warmupRamp,
        batchSize: Number(batchSizeStr) || 0,
        batchPause: Number(batchPauseStr) || 60,
        textWithMediaMode,
        messageTypeOption: messageType,
        pollData: isPollMode ? { question: pollQuestion, options: pollOptions, multiple: pollMultipleAnswers } : undefined,
        scheduledAt: scheduleIso || undefined
      };

      const res = await fetch(`${backendUrl}/api/v1/campaigns`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (scheduleIso) {
          toast.success(`Campaign "${campaignName}" successfully scheduled for ${new Date(scheduleIso).toLocaleString()}!`);
          setIsScheduleModalOpen(false);
        } else {
          toast.success(`Broadcast campaign "${campaignName}" launched across ${totalRecipientsCount} recipients!`);
        setTimeout(() => router.push("/campaigns"), 600);
        }
      } else {
        toast.error("Failed to launch campaign. Check active WhatsApp connection.");
      }
    } catch {
      toast.error("Network error while dispatching campaign.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-600" />
            <span>Campaigns</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compose and broadcast multi-variable personalized messages with automatic load balancing and number warmup.
          </p>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =========================================================================
            LEFT PANEL: Campaign Form, Recipients, Template, Message Composer (7 cols)
            ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Campaign Name & Recipients Selection */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-5">
            
            {/* Campaign Name */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Campaign name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Festival Offer Broadcast"
                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Recipients Section with 4 Navigation Tabs */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                RECIPIENTS
              </label>

              {/* Tab Navigation Pill Bar */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setRecipientTab("CSV")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "CSV"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("Paste")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "Paste"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("Groups")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "Groups"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Groups
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("Contacts")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "Contacts"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Contacts
                </button>
              </div>

              {/* 1. PASTE TAB CONTENT */}
              {recipientTab === "Paste" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Paste Numbers
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCountryCodeModalOpen(true)}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Insert Country Code (+91)</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={pasteRawText}
                    onChange={(e) => setPasteRawText(e.target.value)}
                    placeholder="+919876543210&#10;9876543211&#10;+91 98765 43212 (one per line or comma-separated)"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{parsedPastedNumbers.length} valid numbers parsed</span>
                    {parsedPastedNumbers.length > 0 && (
                      <button
                        type="button"
                        onClick={handlePasteRemoveDuplicates}
                        className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Remove duplicates
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 2. CSV TAB CONTENT */}
              {recipientTab === "CSV" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Imported Contacts ({csvContacts.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        setIsWizardOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{csvContacts.length === 0 ? "Launch 4-Step Import Wizard" : "Re-Import File"}</span>
                    </button>
                  </div>

                  {csvContacts.length === 0 ? (
                    <div 
                      onClick={() => { setWizardStep(1); setIsWizardOpen(true); }}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 transition-colors"
                    >
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Click to upload Excel / CSV File</p>
                      <p className="text-[11px] text-slate-400">Supports .xlsx, .xls, .csv with automatic column matching</p>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="p-2">Name</th>
                            <th className="p-2">Phone</th>
                            <th className="p-2">Variable 1</th>
                            <th className="p-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {csvContacts.map((c) => (
                            <tr key={c.id}>
                              <td className="p-2 font-medium">{c.name}</td>
                              <td className="p-2 font-mono font-bold text-emerald-600">{c.number}</td>
                              <td className="p-2 text-slate-400">{c.var1 || "-"}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setCsvContacts((prev) => prev.filter((item) => item.id !== c.id))}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. GROUPS TAB CONTENT */}
              {recipientTab === "Groups" && (
                <div className="space-y-3 pt-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Saved Audiences
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
                    {savedAudiences.length === 0 ? (
                      <div className="col-span-2 p-4 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
                        No saved audiences found.
                      </div>
                    ) : (
                      savedAudiences.map((aud) => {
                        const isSelected = selectedAudienceIds.includes(aud.id);
                        return (
                          <div
                            key={aud.id}
                            onClick={() => {
                              setSelectedAudienceIds((prev) =>
                                isSelected ? prev.filter((id) => id !== aud.id) : [...prev, aud.id]
                              );
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white">{aud.name}</p>
                              <p className="text-[10px] text-slate-500">{aud.contactCount || 0} contacts</p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* 4. CONTACTS TAB CONTENT */}
              {recipientTab === "Contacts" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={contactsSearch}
                        onChange={(e) => setContactsSearch(e.target.value)}
                        placeholder="Search contacts by name, phone..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDbContactIds.length === allDbContacts.length) {
                          setSelectedDbContactIds([]);
                        } else {
                          setSelectedDbContactIds(allDbContacts.map((c) => c.id));
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {selectedDbContactIds.length === allDbContacts.length && allDbContacts.length > 0 ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Serial Range Selection: Exactly as requested ("under serach bar show from and to (uner that user can add serial number then it get slected and then sent capign to them)") */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                        Select by Serial Range:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({selectedDbContactIds.length} of {allDbContacts.length} selected)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-semibold">From #</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={contactsSerialFrom}
                          onChange={(e) => setContactsSerialFrom(e.target.value)}
                          className="w-14 bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-semibold">To #</span>
                        <input
                          type="number"
                          min="1"
                          placeholder={String(allDbContacts.length || 100)}
                          value={contactsSerialTo}
                          onChange={(e) => setContactsSerialTo(e.target.value)}
                          className="w-14 bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyContactsSerialRange}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Select Range
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContactsSerialFrom("");
                          setContactsSerialTo("");
                          setSelectedDbContactIds([]);
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5 w-8"></th>
                          <th className="p-2.5 w-12 text-center">#</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Phone</th>
                          <th className="p-2.5">City</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {allDbContacts
                          .filter((c) => (c.name || "").toLowerCase().includes(contactsSearch.toLowerCase()) || (c.phone || "").includes(contactsSearch))
                          .map((c, idx) => {
                            const isSelected = selectedDbContactIds.includes(c.id);
                            const sNo = c.serialNumber != null ? c.serialNumber : idx + 1;
                            return (
                              <tr
                                key={c.id}
                                onClick={() => {
                                  setSelectedDbContactIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                  );
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                }`}
                              >
                                <td className="p-2.5 w-8">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded text-emerald-600 cursor-pointer"
                                  />
                                </td>
                                <td className="p-2.5 w-12 text-center font-mono font-bold text-[11px] text-slate-500 dark:text-slate-400">
                                  #{sNo}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800 dark:text-white">{c.name || "Customer"}</td>
                                <td className="p-2.5 font-mono text-slate-500">{c.phone}</td>
                                <td className="p-2.5 text-slate-400">{c.city || "-"}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Section 2: Template & Media Format Selection matching Template Modal & Image */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                * Select Template (Optional)
              </label>
              <div className="relative mt-1.5">
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 pr-8 cursor-pointer"
                >
                  <option value="New Message">Blank / Custom Message</option>
                  {dbTemplates.length > 0 && (
                    <optgroup label="Your Templates">
                      {dbTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Media Attachment Format: Prominent 5-card selector matching user design & template modal */}
            <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Media Attachment Format:</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { type: "NONE", label: "Text Only", icon: MessageSquare, desc: "No media" },
                  { type: "IMAGE", label: "Image Banner", icon: ImageIcon, desc: "JPG / PNG" },
                  { type: "DOCUMENT", label: "PDF Document", icon: FileText, desc: "PDF files" },
                  { type: "VIDEO", label: "Video", icon: Video, desc: "MP4 files" },
                  { type: "POLL", label: "WhatsApp Poll", icon: BarChart2, desc: "Interactive voting" },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSel = mediaFormat === m.type;
                  return (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => handleSelectMediaFormat(m.type as any)}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-2xs ${
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
            </div>
          </div>

          {/* Section 3: Dynamic Message Composer Card matching Image 2 */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-5">
            
            {/* 1. MEDIA ATTACHMENT SECTION (Shown when Image, Document, or Video is selected) */}
            {(mediaFormat === "IMAGE" || mediaFormat === "DOCUMENT" || mediaFormat === "VIDEO" || isMediaRequired || attachedFiles.length > 0 || publicMediaUrl.trim().length > 0) && (
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Media Attachment ({mediaFormat === "NONE" || mediaFormat === "POLL" ? "Custom" : mediaFormat})</span>
                </label>

                {/* List of Attached Files */}
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                        {file.name.endsWith(".jpg") || file.name.endsWith(".png") ? "IMG" : "DOC"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{file.name}</p>
                        <p className="text-[11px] text-slate-400">{file.size}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add File Button & URL Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{attachedFiles.length === 0 ? "Upload from device" : "Add another file"}</span>
                    <span className="text-slate-400 font-normal">({attachedFiles.length}/5)</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <input
                    type="text"
                    value={publicMediaUrl}
                    onChange={(e) => setPublicMediaUrl(e.target.value)}
                    placeholder="Or paste public Image / PDF / Video URL"
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                  />
                </div>

                {compressionStats && (
                  <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                    {compressionStats}
                  </div>
                )}

                {/* TEXT WITH MEDIA Radio Options */}
                <div className="pt-1.5 space-y-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    TEXT WITH MEDIA DISPLAY
                  </label>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mediaMode"
                        checked={textWithMediaMode === "caption"}
                        onChange={() => setTextWithMediaMode("caption")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">As caption</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mediaMode"
                        checked={textWithMediaMode === "separate"}
                        onChange={() => setTextWithMediaMode("separate")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">As a separate message</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 2. POLL BUILDER (Shown when Poll is selected) */}
            {(mediaFormat === "POLL" || isPollMode) && (
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-emerald-600" />
                      <span>WhatsApp Poll Builder</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">Recipients can vote directly in WhatsApp</p>
                  </div>

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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Poll Question
                  </label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="e.g. Would you like to schedule an eye examination this week?"
                    className="w-full mt-1.5 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
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
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                          className="text-rose-500 p-1"
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

            {/* 3. TEXT COMPOSER (Matching Image 2 & Template Editor) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  MESSAGE
                </label>

                {/* Variable, Spintax & Spintax Toggle Switch matching user screenshot */}
                <div className="flex items-center gap-3">
                  {/* Insert Variable Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsVariableDropdownOpen(!isVariableDropdownOpen)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 cursor-pointer"
                    >
                      <span>&#123; &#125; Insert variable</span>
                    </button>

                    {isVariableDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 z-30 animate-in fade-in">
                        <button type="button" onClick={() => insertVariable("whatsapp-name")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-emerald-600 dark:text-emerald-400 font-bold">{"{{whatsapp-name}} (WhatsApp Name)"}</button>
                        <button type="button" onClick={() => insertVariable("name")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">{"{{name}} (Full Name)"}</button>
                        <button type="button" onClick={() => insertVariable("phone")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">{"{{phone}} (Number)"}</button>
                        <button type="button" onClick={() => insertVariable("city")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">{"{{city}} (City/Location)"}</button>
                        <button type="button" onClick={() => insertVariable("date")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">{"{{date}} (Current Date)"}</button>
                        <button type="button" onClick={() => insertVariable("var1")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">{"{{var1}} (Custom Var 1)"}</button>
                        <button type="button" onClick={() => insertVariable("var2")} className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">{"{{var2}} (Custom Var 2)"}</button>
                      </div>
                    )}
                  </div>

                  {/* Insert Spintax Button */}
                  <button
                    type="button"
                    onClick={insertSpintax}
                    className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Insert spintax</span>
                  </button>

                  {/* Spintax Switch Toggle */}
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

              {/* Integrated Textarea Frame with Docked Locked Footer */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/40 transition-all">
                <textarea
                  ref={textareaRef}
                  rows={6}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here... Use {{name}} to personalize, or use {Hello|Hi|Hey} for anti-spam randomization."
                  className="w-full p-3.5 bg-transparent border-none text-xs text-slate-800 dark:text-white focus:outline-none leading-relaxed font-sans resize-y"
                />

                {/* Locked Opt-Out Footer Docked at Bottom of Textarea */}
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
                <span>{messageText.length} characters</span>
              </div>
            </div>

          </div>

        </div>

        {/* =========================================================================
            RIGHT PANEL: Live Preview, Send Pacing, Instance Selector (5 cols)
            ========================================================================= */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* 1. Live WhatsApp Message Preview Bubble (Real-Time Media + Text) */}
          <div className="p-4 bg-[#efeae2] dark:bg-[#0b141a] border border-slate-300/80 dark:border-emerald-950 rounded-2xl shadow-inner min-h-[160px] flex flex-col justify-center select-none">
            {(() => {
              const mediaPreview = publicMediaUrl.trim() || attachedFiles[0]?.url || templateMediaUrl;
              const hasText = Boolean(previewResolvedText && previewResolvedText.trim().length > 0);
              const hasMedia = Boolean(mediaPreview);
              const hasPoll = Boolean(isPollMode && pollQuestion);

              if (!hasText && !hasMedia && !hasPoll) {
                return (
                  <p className="text-xs text-center text-slate-400 italic">
                    Your live WhatsApp message preview will appear here
                  </p>
                );
              }

              const isImage = 
                mediaFormat === "IMAGE" ||
                (attachedFiles[0] && attachedFiles[0].type && attachedFiles[0].type.startsWith("image/")) ||
                (mediaPreview && (
                  mediaPreview.startsWith("data:image") ||
                  mediaPreview.includes("blob:") ||
                  /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(mediaPreview) ||
                  mediaPreview.includes("unsplash.com") ||
                  mediaPreview.includes("r2.dev") ||
                  mediaPreview.includes("/uploads/")
                ));

              const isVideo = 
                mediaFormat === "VIDEO" ||
                (attachedFiles[0] && attachedFiles[0].type && attachedFiles[0].type.startsWith("video/")) ||
                (mediaPreview && /\.(mp4|mov|webm)(\?|$)/i.test(mediaPreview));

              const isDoc = 
                mediaFormat === "DOCUMENT" ||
                (attachedFiles[0] && attachedFiles[0].type && attachedFiles[0].type.includes("pdf")) ||
                (mediaPreview && /\.pdf(\?|$)/i.test(mediaPreview));

              // If user selected "As a separate message" with an attached image
              if (textWithMediaMode === "separate" && hasMedia && hasText) {
                return (
                  <div className="space-y-2 max-w-xs ml-auto w-full">
                    {/* Bubble 1: Media Item */}
                    <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-2 rounded-2xl rounded-tr-xs shadow-xs space-y-1 ml-auto">
                      {isImage ? (
                        <div className="rounded-xl overflow-hidden bg-black/10 border border-black/10 max-h-56 shadow-2xs">
                          <img
                            src={mediaPreview}
                            alt="Message Media"
                            className="w-full h-auto object-cover max-h-56 rounded-lg"
                          />
                        </div>
                      ) : isDoc ? (
                        <div className="p-2.5 bg-white/80 dark:bg-black/20 rounded-xl flex items-center gap-2.5 text-xs font-medium border border-emerald-900/10">
                          <FileText className="w-5 h-5 text-red-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-[11px]">{attachedFiles[0]?.name || "Document.pdf"}</p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-300 uppercase">{attachedFiles[0]?.size || "PDF Document"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white/80 dark:bg-black/20 rounded-xl flex items-center gap-2 text-xs font-medium">
                          <Video className="w-5 h-5 text-purple-600" />
                          <span>Video Attachment</span>
                        </div>
                      )}
                      <div className="flex justify-end text-[9px] text-slate-500 dark:text-slate-300 pr-1">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                      </div>
                    </div>

                    {/* Bubble 2: Separate Text Message */}
                    <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3 rounded-2xl rounded-tr-xs shadow-xs space-y-1.5 ml-auto">
                      <p className="text-xs whitespace-pre-line leading-relaxed font-normal">
                        {previewResolvedText}
                      </p>
                      <div className="flex justify-end text-[9px] text-slate-500 dark:text-slate-300">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                      </div>
                    </div>
                  </div>
                );
              }

              // Single Unified Bubble (Caption Mode or Media Only / Text Only)
              return (
                <div className="max-w-xs ml-auto w-full bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-2.5 rounded-2xl rounded-tr-xs shadow-xs space-y-2">
                  
                  {/* Media Header */}
                  {hasMedia && (
                    <>
                      {isImage ? (
                        <div className="rounded-xl overflow-hidden bg-black/10 border border-black/10 max-h-56 shadow-2xs">
                          <img
                            src={mediaPreview}
                            alt="Message Banner"
                            className="w-full h-auto object-cover max-h-56 rounded-lg"
                          />
                        </div>
                      ) : isDoc ? (
                        <div className="p-2.5 bg-white/80 dark:bg-black/20 rounded-xl flex items-center gap-2.5 text-xs font-medium border border-emerald-900/10">
                          <FileText className="w-5 h-5 text-red-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-[11px]">{attachedFiles[0]?.name || "Document.pdf"}</p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-300 uppercase">{attachedFiles[0]?.size || "PDF Document"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white/80 dark:bg-black/20 rounded-xl flex items-center gap-2 text-xs font-medium">
                          <Video className="w-5 h-5 text-purple-600" />
                          <span>Video Attachment</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Caption / Text */}
                  {hasText && (
                    <p className="text-xs whitespace-pre-line leading-relaxed font-normal px-1">
                      {previewResolvedText}
                    </p>
                  )}

                  {/* Poll */}
                  {hasPoll && (
                    <div className="p-2.5 bg-white/70 dark:bg-black/30 rounded-xl space-y-1.5 text-xs">
                      <p className="font-bold">{pollQuestion}</p>
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="px-2 py-1 bg-white/90 dark:bg-black/50 rounded text-[11px] flex items-center gap-1.5">
                          {pollMultipleAnswers ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <span>○</span>}
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end text-[9px] text-slate-500 dark:text-slate-300 pr-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 2. Summary Card */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Recipients</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">{totalRecipientsCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Sending accounts</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">{activeSendingAccountsCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Pace</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">{estimatedPacePerHour}/h</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Estimated time</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">
                {estimatedDurationDisplay}
              </span>
            </div>
          </div>

          {/* 3. Send Pacing Card */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
              Send pacing
            </h4>

            {/* Checkbox 1: Use each account delay */}
            <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useAccountDelay}
                onChange={(e) => setUseAccountDelay(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Use each account's delay (Settings)</span>
            </label>

            {/* Checkbox 2: Warmup ramp */}
            <div className="space-y-1">
              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={warmupRamp}
                  onChange={(e) => setWarmupRamp(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-semibold">Warmup ramp (slower at start)</span>
              </label>
              <p className="text-[11px] text-slate-400 pl-5 leading-tight">
                First ~30% of sends use up to 2x delay, then normal pace — safer for cold numbers.
              </p>
            </div>

            {/* Batch Inputs (Only these two, smooth editable) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Batch size (0=off)
                </label>
                <input
                  type="text"
                  value={batchSizeStr}
                  onChange={(e) => setBatchSizeStr(e.target.value)}
                  placeholder="5"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Batch pause (sec)
                </label>
                <input
                  type="text"
                  value={batchPauseStr}
                  onChange={(e) => setBatchPauseStr(e.target.value)}
                  placeholder="60"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* 4. SEND FROM (SELECT ONE OR MORE) - Placed directly above Start Campaign */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                SEND FROM (SELECT ONE OR MORE)
              </label>

              <button
                type="button"
                onClick={() => {
                  const allIds = instances.map((i) => i.id);
                  if (selectedInstanceIds.length === allIds.length) {
                    setSelectedInstanceIds([]);
                  } else {
                    setSelectedInstanceIds(allIds);
                  }
                }}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {selectedInstanceIds.length === instances.length ? "Deselect All" : "⚡ Select All (Load Balanced)"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {instances.length === 0 ? (
                <p className="text-xs text-slate-400">No paired devices found. Pair a device in the Devices page.</p>
              ) : (
                instances.map((inst) => {
                  const isSelected = selectedInstanceIds.includes(inst.id);
                  return (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => {
                        setSelectedInstanceIds((prev) =>
                          isSelected ? prev.filter((id) => id !== inst.id) : [...prev, inst.id]
                        );
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600"
                          : "bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{inst.instanceName}</span>
                    </button>
                  );
                })
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              • Broadcast volume will be distributed across the selected connected devices.
            </p>
          </div>

          {/* 5. Action Buttons: Start campaign & Schedule */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={sending || totalRecipientsCount === 0}
              onClick={() => handleStartCampaign()}
              className="flex-1 py-3.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Broadcast...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Start campaign</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="py-3.5 px-5 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule</span>
            </button>
          </div>

        </div>

      </div>

      {/* =========================================================================
          INSERT COUNTRY CODE MODAL
          ========================================================================= */}
      {isCountryCodeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              <span>Insert Country Code</span>
            </h3>
            <p className="text-xs text-slate-500">
              Prepend country code to all 10-digit phone numbers in the paste box:
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Country Dial Code
              </label>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-bold text-slate-500">+</span>
                <input
                  type="text"
                  value={countryCodeInput}
                  onChange={(e) => setCountryCodeInput(e.target.value)}
                  placeholder="91"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCountryCodeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertCountryCodeToPaste}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs"
              >
                Apply Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          INDUSTRY-GRADE SCHEDULE CAMPAIGN MODAL
          ========================================================================= */}
      {isScheduleModalOpen && (() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const selectedDateTimeObj = new Date(`${scheduledDate}T${scheduledTime || "10:00"}:00`);
        const isValidDate = !isNaN(selectedDateTimeObj.getTime());
        const isPast = isValidDate && selectedDateTimeObj.getTime() < Date.now();

        // Check if selected time is within safe delivery window (10:00 - 19:00)
        const hour = parseInt((scheduledTime || "10:00").split(":")[0], 10);
        const isOptimalHours = hour >= 10 && hour < 19;

        // Quick Preset Helpers
        const applyPreset = (preset: "15m" | "1h" | "tomorrow_10am" | "tomorrow_2pm" | "next_mon_10am") => {
          const now = new Date();
          if (preset === "15m") {
            const d = new Date(now.getTime() + 15 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime(d.toTimeString().slice(0, 5));
          } else if (preset === "1h") {
            const d = new Date(now.getTime() + 60 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime(d.toTimeString().slice(0, 5));
          } else if (preset === "tomorrow_10am") {
            const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime("10:00");
          } else if (preset === "tomorrow_2pm") {
            const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime("14:00");
          } else if (preset === "next_mon_10am") {
            const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            while (d.getDay() !== 1) {
              d.setDate(d.getDate() + 1);
            }
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime("10:00");
          }
        };

        // Formatted date string for preview
        const formattedDateDisplay = isValidDate
          ? selectedDateTimeObj.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        const formattedTimeDisplay = isValidDate
          ? selectedDateTimeObj.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          : "";

        // Relative time calculation
        const getRelativeTimeString = () => {
          if (!isValidDate) return "";
          const diffMs = selectedDateTimeObj.getTime() - Date.now();
          if (diffMs <= 0) return "Right now";
          const diffMins = Math.round(diffMs / (1000 * 60));
          if (diffMins < 60) return `in ${diffMins} minutes`;
          const diffHours = Math.floor(diffMins / 60);
          const remMins = diffMins % 60;
          if (diffHours < 24) return `in ${diffHours}h ${remMins}m`;
          const diffDays = Math.floor(diffHours / 24);
          return `in ${diffDays} day${diffDays > 1 ? "s" : ""} (${diffHours % 24}h)`;
        };

        const handleConfirmSchedule = () => {
          if (!isValidDate || isPast) {
            toast.error("Please select a valid future date and time");
            return;
          }
          setIsScheduleModalOpen(false);
          handleStartCampaign(selectedDateTimeObj.toISOString());
        };

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
              
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xs shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Schedule Broadcast
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Set automated launch time with smart delivery window pacing
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                
                {/* 1. Quick Presets Bar */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Time Presets
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset("15m")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      ⚡ In 15 Mins
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("1h")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      🕒 In 1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("tomorrow_10am")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      🌅 Tomorrow 10:00 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("tomorrow_2pm")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      ☀️ Tomorrow 02:00 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("next_mon_10am")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      📅 Next Mon 10:00 AM
                    </button>
                  </div>
                </div>

                {/* 2. Custom Date & Time Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select Date</span>
                    </label>
                    <input
                      type="date"
                      min={todayStr}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    />
                  </div>

                  {/* Time Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select Time</span>
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    />
                  </div>

                </div>

                {/* 3. Delivery Window & Optimal Hours Advisory */}
                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  isOptimalHours
                    ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"
                }`}>
                  {isOptimalHours ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 text-[11px] leading-relaxed font-medium">
                    {isOptimalHours ? (
                      <p>
                        <strong>✓ Active Business Hours:</strong> This launch time aligns with peak WhatsApp read hours (10:00 AM – 07:00 PM), maximizing conversions and preventing spam flags.
                      </p>
                    ) : (
                      <p>
                        <strong>⚠️ Outside Business Hours:</strong> Sending late at night may cause lower reply rates. The automated delivery window engine may hold dispatch until 10:00 AM next morning for safety.
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Live Schedule Summary Banner */}
                {isValidDate && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Target Schedule:
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {getRelativeTimeString()}
                      </span>
                    </div>

                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {formattedDateDisplay} at {formattedTimeDisplay}
                    </div>

                    <div className="pt-1 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800">
                      <span>👥 {totalRecipientsCount} Recipients</span>
                      <span>📱 {selectedInstanceIds.length || 1} Senders</span>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#0e1320] border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!isValidDate || isPast || sending}
                  onClick={handleConfirmSchedule}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Schedule Broadcast</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          4-STEP CSV IMPORT WIZARD MODAL
          ========================================================================= */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#0e1320] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep > 1 ? "bg-emerald-600 text-white" : "border-2 border-emerald-600 text-emerald-600 font-black"
                  }`}>
                    {wizardStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </span>
                  <span className={wizardStep === 1 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Upload Excel File
                  </span>
                </div>
                <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep > 2 ? "bg-emerald-600 text-white" : wizardStep === 2 ? "border-2 border-emerald-600 text-emerald-600 font-black" : "border border-slate-300 text-slate-400"
                  }`}>
                    {wizardStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
                  </span>
                  <span className={wizardStep === 2 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Select header row
                  </span>
                </div>
                <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep > 3 ? "bg-emerald-600 text-white" : wizardStep === 3 ? "border-2 border-emerald-600 text-emerald-600 font-black" : "border border-slate-300 text-slate-400"
                  }`}>
                    {wizardStep > 3 ? <Check className="w-3.5 h-3.5" /> : "3"}
                  </span>
                  <span className={wizardStep === 3 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Match Columns
                  </span>
                </div>
                <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep === 4 ? "border-2 border-emerald-600 text-emerald-600 font-black" : "border border-slate-300 text-slate-400"
                  }`}>
                    4
                  </span>
                  <span className={wizardStep === 4 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Validate data
                  </span>
                </div>
              </div>

              <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Upload Excel File</h3>
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleFileDropOrSelect(e.dataTransfer.files[0]);
                    }}
                    className="border-2 border-dashed border-indigo-300 dark:border-indigo-800/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 hover:border-emerald-500 transition-colors"
                  >
                    <FileSpreadsheet className="w-12 h-12 text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Upload .xlsx, .xls or .csv file</p>
                    <label className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                      <span>Select file</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileDropOrSelect(e.target.files[0]); }} />
                    </label>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Select header row</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <tbody>
                        {rawSheetData.slice(0, 6).map((row, rIdx) => (
                          <tr 
                            key={rIdx}
                            onClick={() => { setHeaderRowIdx(rIdx); autoDetectColumns(rawSheetData, rIdx); }}
                            className={`cursor-pointer transition-colors ${headerRowIdx === rIdx ? "bg-indigo-50/80 dark:bg-indigo-950/40 font-bold" : "hover:bg-slate-50"}`}
                          >
                            <td className="p-3 w-10 text-center">
                              <input type="radio" name="headerRow" checked={headerRowIdx === rIdx} onChange={() => { setHeaderRowIdx(rIdx); autoDetectColumns(rawSheetData, rIdx); }} />
                            </td>
                            {row.map((cell: any, cIdx: number) => (
                              <td key={cIdx} className="p-3 border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">{String(cell || "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Back</button>
                    <button onClick={() => setWizardStep(3)} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Next: Match Columns</button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Match Columns</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 space-y-1.5">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300">* Phone Number (Mandatory)</label>
                      <select
                        value={columnMapping.phone}
                        onChange={(e) => setColumnMapping({ ...columnMapping, phone: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 rounded-lg text-xs"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {rawSheetData[headerRowIdx]?.map((h: any, idx: number) => (
                          <option key={idx} value={idx}>Column {idx + 1}: {String(h || "")}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Name (Optional)</label>
                      <select
                        value={columnMapping.name}
                        onChange={(e) => setColumnMapping({ ...columnMapping, name: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={-1}>-- Ignore --</option>
                        {rawSheetData[headerRowIdx]?.map((h: any, idx: number) => (
                          <option key={idx} value={idx}>Column {idx + 1}: {String(h || "")}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City / Location</label>
                      <select
                        value={columnMapping.city}
                        onChange={(e) => setColumnMapping({ ...columnMapping, city: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={-1}>-- Ignore --</option>
                        {rawSheetData[headerRowIdx]?.map((h: any, idx: number) => (
                          <option key={idx} value={idx}>Column {idx + 1}: {String(h || "")}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setWizardStep(2)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Back</button>
                    <button onClick={processAndValidateData} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Next: Validate</button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Validate data</h3>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={showOnlyErrors} onChange={(e) => setShowOnlyErrors(e.target.checked)} />
                      <span>Show only rows with errors</span>
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-72">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 border-b text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="p-3 w-8"><input type="checkbox" checked={validatedRows.every((r) => r.selected)} onChange={(e) => setValidatedRows(validatedRows.map((r) => ({ ...r, selected: e.target.checked })))} /></th>
                          <th className="p-3">NAME</th>
                          <th className="p-3">PHONE</th>
                          <th className="p-3">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {validatedRows.filter((item) => (showOnlyErrors ? !item.valid : true)).map((item, idx) => (
                          <tr key={idx} className={item.valid ? "" : "bg-rose-50 dark:bg-rose-950/20"}>
                            <td className="p-3"><input type="checkbox" checked={item.selected} onChange={(e) => setValidatedRows(validatedRows.map((r, i) => i === idx ? { ...r, selected: e.target.checked } : r))} /></td>
                            <td className="p-3 font-medium">{item.row.name}</td>
                            <td className="p-3 font-mono font-bold">{item.row.number}</td>
                            <td className="p-3">
                              {item.valid ? <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Valid</span> : <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">{item.errorMsg}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button onClick={() => setWizardStep(3)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Back</button>
                    <button onClick={handleConfirmImport} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Confirm</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
